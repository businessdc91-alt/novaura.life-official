/**
 * AURA NOVA - SIDECAR BRIDGE (Rust)
 * Spawns aura_sidecar binary, communicates via stdin/stdout NDJSON.
 * Exposes Tauri commands: aura_chat, aura_stream, aura_recall,
 *                         aura_store_engram, aura_fact_check, aura_status
 */

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;
use tauri::{AppHandle, Manager, Runtime};
use tokio::sync::oneshot;

// ── IPC message types ─────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct IpcMessage {
    pub id: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: Value,
}

// ── Sidecar state (managed by Tauri) ─────────────────────────────────────────

pub struct AuraSidecar {
    stdin: Mutex<ChildStdin>,
    /// Pending requests: id → oneshot sender for reply
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>,
    /// Streaming listeners: id → AppHandle + event name
    stream_listeners: Arc<Mutex<HashMap<String, String>>>,
}

impl AuraSidecar {
    /// Spawn the sidecar process and start the stdout reader thread.
    pub fn spawn<R: Runtime>(app: AppHandle<R>, tier: &str) -> Result<Self, String> {
        // Resolve sidecar binary path relative to app data dir
        let resource_dir = app
            .path_resolver()
            .resource_dir()
            .ok_or("Cannot resolve resource dir")?;

        let sidecar_bin = resource_dir
            .join("sidecar")
            .join(if cfg!(windows) { "aura_sidecar.exe" } else { "aura_sidecar" });

        let mut child: Child = Command::new(&sidecar_bin)
            .env("AURA_TIER", tier)
            .env("PYTHONUNBUFFERED", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null()) // stderr goes to sidecar log file, not here
            .spawn()
            .map_err(|e| format!("Failed to spawn aura_sidecar: {e}"))?;

        let stdin = child.stdin.take().ok_or("No stdin")?;
        let stdout = child.stdout.take().ok_or("No stdout")?;

        let pending: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let stream_listeners: Arc<Mutex<HashMap<String, String>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let pending_clone = Arc::clone(&pending);
        let stream_clone = Arc::clone(&stream_listeners);
        let app_clone = app.clone();

        // ── Stdout reader thread ──────────────────────────────────────────────
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => break,
                };
                if line.is_empty() {
                    continue;
                }
                let msg: IpcMessage = match serde_json::from_str(&line) {
                    Ok(m) => m,
                    Err(e) => {
                        eprintln!("[SIDECAR] Parse error: {e} — {line}");
                        continue;
                    }
                };

                match msg.msg_type.as_str() {
                    // Streaming tokens — emit as Tauri event
                    "stream_chunk" => {
                        let listeners = stream_clone.lock().unwrap();
                        if let Some(event_name) = listeners.get(&msg.id) {
                            let _ = app_clone.emit_all(event_name, &msg.payload);
                        }
                    }
                    "stream_end" => {
                        let mut listeners = stream_clone.lock().unwrap();
                        if let Some(event_name) = listeners.remove(&msg.id) {
                            let mut payload = msg.payload.clone();
                            payload["done"] = json!(true);
                            let _ = app_clone.emit_all(&event_name, &payload);
                        }
                        // Also resolve the pending oneshot
                        let mut p = pending_clone.lock().unwrap();
                        if let Some(tx) = p.remove(&msg.id) {
                            let _ = tx.send(msg.payload);
                        }
                    }
                    // Events broadcast to all windows (ready, engram_formed, etc.)
                    "ready" | "event" => {
                        let _ = app_clone.emit_all("aura-event", &msg);
                    }
                    // Single-shot replies — resolve the oneshot
                    _ => {
                        let mut p = pending_clone.lock().unwrap();
                        if let Some(tx) = p.remove(&msg.id) {
                            let _ = tx.send(msg.payload);
                        }
                    }
                }
            }
        });

        Ok(Self {
            stdin: Mutex::new(stdin),
            pending,
            stream_listeners,
        })
    }

    /// Send a message and wait for reply (async-friendly via oneshot).
    pub async fn request(&self, msg_type: &str, payload: Value) -> Result<Value, String> {
        let id = Uuid::new_v4().to_string();
        let msg = IpcMessage {
            id: id.clone(),
            msg_type: msg_type.to_string(),
            payload,
        };

        let json_line = serde_json::to_string(&msg).map_err(|e| e.to_string())? + "\n";

        // Register pending reply
        let (tx, rx) = oneshot::channel::<Value>();
        {
            let mut p = self.pending.lock().unwrap();
            p.insert(id.clone(), tx);
        }

        // Write to stdin
        {
            let mut stdin = self.stdin.lock().unwrap();
            stdin.write_all(json_line.as_bytes()).map_err(|e| e.to_string())?;
            stdin.flush().map_err(|e| e.to_string())?;
        }

        // Await reply with 60s timeout
        tokio::time::timeout(
            std::time::Duration::from_secs(60),
            rx,
        )
        .await
        .map_err(|_| "Aura sidecar timeout".to_string())?
        .map_err(|_| "Sidecar channel closed".to_string())
    }

    /// Register a streaming request — responses come as Tauri events.
    pub fn register_stream(&self, msg_id: &str, event_name: &str) {
        let mut listeners = self.stream_listeners.lock().unwrap();
        listeners.insert(msg_id.to_string(), event_name.to_string());
    }

    pub fn send_raw(&self, msg: &IpcMessage) -> Result<(), String> {
        let json_line = serde_json::to_string(msg).map_err(|e| e.to_string())? + "\n";
        let mut stdin = self.stdin.lock().unwrap();
        stdin.write_all(json_line.as_bytes()).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())
    }
}

// ── Tauri commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn aura_chat(
    input: String,
    context: Option<Value>,
    state: tauri::State<'_, Arc<AuraSidecar>>,
) -> Result<Value, String> {
    state
        .request("chat", json!({ "input": input, "context": context }))
        .await
}

#[tauri::command]
pub async fn aura_stream(
    input: String,
    context: Option<Value>,
    event_name: String,
    state: tauri::State<'_, Arc<AuraSidecar>>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    state.register_stream(&id, &event_name);

    let msg = IpcMessage {
        id: id.clone(),
        msg_type: "stream_chat".to_string(),
        payload: json!({ "input": input, "context": context }),
    };

    // Register pending for stream_end
    let (tx, _rx) = oneshot::channel::<Value>();
    {
        let mut p = state.pending.lock().unwrap();
        p.insert(id.clone(), tx);
    }

    state.send_raw(&msg)?;
    Ok(id)
}

#[tauri::command]
pub async fn aura_recall(
    query: String,
    limit: Option<u32>,
    state: tauri::State<'_, Arc<AuraSidecar>>,
) -> Result<Value, String> {
    state
        .request("recall", json!({ "query": query, "limit": limit.unwrap_or(12) }))
        .await
}

#[tauri::command]
pub async fn aura_store_engram(
    content: String,
    category: Option<String>,
    tags: Option<Vec<String>>,
    emotional_valence: Option<f64>,
    state: tauri::State<'_, Arc<AuraSidecar>>,
) -> Result<Value, String> {
    state
        .request(
            "engram_store",
            json!({
                "content": content,
                "category": category.unwrap_or_else(|| "interaction".to_string()),
                "tags": tags.unwrap_or_default(),
                "emotional_valence": emotional_valence.unwrap_or(0.0),
            }),
        )
        .await
}

#[tauri::command]
pub async fn aura_fact_check(
    claim: String,
    state: tauri::State<'_, Arc<AuraSidecar>>,
) -> Result<Value, String> {
    state
        .request("fact_check", json!({ "claim": claim }))
        .await
}

#[tauri::command]
pub async fn aura_status(
    state: tauri::State<'_, Arc<AuraSidecar>>,
) -> Result<Value, String> {
    state.request("status", json!({})).await
}
