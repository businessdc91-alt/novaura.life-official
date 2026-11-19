//! Thin Tauri commands that start and stop a throwaway Windows Sandbox for a probe run.
//! The isolation and the loopback serving happen inside the sandbox (startup.ps1); these
//! commands only validate the run folders, write the `.wsb`, and launch/kill the sandbox.
//! They REFUSE when Windows Sandbox is not installed — never a silent downgrade to weaker
//! isolation. Exercised by the Task 9 live check, not by CI.

#[path = "sentinel_runner_rules.rs"]
#[allow(dead_code)] // channel_name/parse_channel_name are used by pure-tests and mirrored in channel.js
mod sentinel_runner_rules;

use sentinel_runner_rules::{validate_run_dir, wsb_config};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

struct Session {
    wsb_path: String,
}

fn sessions() -> &'static Mutex<HashMap<String, Session>> {
    static S: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(HashMap::new()))
}

/// The full path to WindowsSandbox.exe if the optional feature is installed, else None.
fn windows_sandbox_exe() -> Option<String> {
    let root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    let p = format!("{root}\\System32\\WindowsSandbox.exe");
    if std::path::Path::new(&p).exists() {
        Some(p)
    } else {
        None
    }
}

fn millis_now() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[tauri::command]
pub fn sentinel_sandbox_start(in_dir: String, io_dir: String) -> Result<String, String> {
    validate_run_dir(&in_dir)?;
    validate_run_dir(&io_dir)?;
    let exe = windows_sandbox_exe().ok_or_else(|| {
        "Windows Sandbox is not available. Enable the \"Windows Sandbox\" optional feature, then retry."
            .to_string()
    })?;
    let wsb = wsb_config(&in_dir, &io_dir);
    let wsb_path = format!("{in_dir}\\run.wsb");
    std::fs::write(&wsb_path, wsb).map_err(|e| format!("Could not write sandbox config: {e}"))?;
    std::process::Command::new(&exe)
        .arg(&wsb_path)
        .spawn()
        .map_err(|e| format!("Could not start Windows Sandbox: {e}"))?;
    let id = format!("sbx_{}", millis_now());
    sessions().lock().unwrap().insert(id.clone(), Session { wsb_path });
    Ok(id)
}

#[tauri::command]
pub fn sentinel_sandbox_stop(session_id: String) -> Result<(), String> {
    if let Some(s) = sessions().lock().unwrap().remove(&session_id) {
        let _ = std::fs::remove_file(&s.wsb_path);
    }
    // Windows Sandbox has no stop CLI; closing its client ends the throwaway VM.
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "WindowsSandboxClient.exe", "/F"])
        .output();
    Ok(())
}
