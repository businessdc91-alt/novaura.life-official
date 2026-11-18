//! Streams a local AI server's reply to the web view while it is generated, so the
//! person sees progress instead of waiting minutes for a big local model to finish.
//! Like `query_local_ai_raw`, it only ever talks to 127.0.0.1, and the built-in AI's
//! key is added here so the web view never sees it.

#[path = "local_ai_stream_rules.rs"]
mod rules;

use rules::ResponseDecoder;
use std::time::Duration;
use tauri::ipc::Channel;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(60);
/// Bounds the whole generation, as for the non-streaming request.
const READ_TIMEOUT_SECS: u64 = 45 * 60;

#[derive(serde::Serialize)]
pub struct LocalAiStreamResult {
    pub status: u16,
    /// The whole body. While the status is 2xx it was also sent through the channel piece by piece.
    pub body: String,
}

#[tauri::command]
pub async fn query_local_ai_stream(
    port: u16,
    path: String,
    body: String,
    on_data: Channel<String>,
) -> Result<LocalAiStreamResult, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    if !path.starts_with('/') || path.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("That is not a local AI path.".into());
    }

    let mut stream = tokio::time::timeout(CONNECT_TIMEOUT, tokio::net::TcpStream::connect(("127.0.0.1", port)))
        .await
        .map_err(|_| "CONNECT_TIMEOUT".to_string())?
        .map_err(|e| e.to_string())?;

    let head = format!(
        "POST {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccept: text/event-stream, application/x-ndjson, application/json\r\nUser-Agent: NovAura-Sovereign-Kernel\r\n{}Connection: close\r\n\r\n",
        body.len(),
        crate::llm::auth_header(port)
    );
    stream.write_all(head.as_bytes()).await.map_err(|e| e.to_string())?;
    stream.write_all(body.as_bytes()).await.map_err(|e| e.to_string())?;

    let mut decoder = ResponseDecoder::new();
    let mut all = String::new();
    let mut buf = vec![0u8; 16 * 1024];
    let read_all = async {
        loop {
            match stream.read(&mut buf).await {
                Ok(0) => return Ok(()),
                Ok(n) => {
                    let text = decoder.push(&buf[..n]);
                    if text.is_empty() {
                        continue;
                    }
                    if matches!(decoder.status(), Some(200..=299)) {
                        // The web view may have closed; the reply is still returned whole.
                        let _ = on_data.send(text.clone());
                    }
                    all.push_str(&text);
                }
                Err(e) => return Err(e.to_string()),
            }
        }
    };
    tokio::time::timeout(Duration::from_secs(READ_TIMEOUT_SECS), read_all)
        .await
        .map_err(|_| format!("The local model did not finish within {} minutes.", READ_TIMEOUT_SECS / 60))??;

    all.push_str(&decoder.finish());
    Ok(LocalAiStreamResult { status: decoder.status().unwrap_or(0), body: all })
}
