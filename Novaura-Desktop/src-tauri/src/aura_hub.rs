use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde_json::{json, Value};
use crate::aura_sidecar::AuraSidecar;

/**
 * AuraHub - A lightweight local server that bridges external satellites 
 * (like the VS Code extension) to the Command Station's Frontier Team.
 */
pub async fn start_hub(sidecar: Arc<AuraSidecar>) {
    let addr = "127.0.0.1:5178";
    let listener = TcpListener::bind(addr).await.expect("Failed to bind Aura Hub");
    println!("[AURA-HUB] Listening on {}", addr);

    loop {
        let (mut socket, _) = listener.accept().await.unwrap();
        let sidecar = Arc::clone(&sidecar);

        tokio::spawn(async move {
            let mut buffer = [0; 8192];
            let n = match socket.read(&mut buffer).await {
                Ok(n) if n > 0 => n,
                _ => return,
            };

            let request = String::from_utf8_lossy(&buffer[..n]);
            
            // Basic HTTP POST routing
            if request.starts_with("POST /v1/aura") {
                // Find start of JSON body
                if let Some(body_start) = request.find("\r\n\r\n") {
                    let body = &request[body_start + 4..];
                    match serde_json::from_str::<Value>(body) {
                        Ok(json) => {
                            let msg_type = json["type"].as_str().unwrap_or("chat");
                            let payload = json["payload"].clone();

                            // Forward to sidecar
                            match sidecar.request(msg_type, payload).await {
                                Ok(response) => {
                                    let response_json = json!({ "success": true, "response": response["response"] || response }).to_string();
                                    let http_response = format!(
                                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                        response_json.len(),
                                        response_json
                                    );
                                    let _ = socket.write_all(http_response.as_bytes()).await;
                                }
                                Err(e) => {
                                    let err_json = json!({ "success": false, "error": e }).to_string();
                                    let http_response = format!(
                                        "HTTP/1.1 500 Internal Server Error\r\nContent-Length: {}\r\n\r\n{}",
                                        err_json.len(),
                                        err_json
                                    );
                                    let _ = socket.write_all(http_response.as_bytes()).await;
                                }
                            }
                        }
                        Err(e) => {
                            let _ = socket.write_all(b"HTTP/1.1 400 Bad Request\r\n\r\n").await;
                        }
                    }
                }
            } else if request.starts_with("OPTIONS") {
                // Handle CORS preflight
                let cors_response = "HTTP/1.1 204 No Content\r\n\
                                     Access-Control-Allow-Origin: *\r\n\
                                     Access-Control-Allow-Methods: POST, OPTIONS\r\n\
                                     Access-Control-Allow-Headers: Content-Type\r\n\r\n";
                let _ = socket.write_all(cors_response.as_bytes()).await;
            } else {
                let _ = socket.write_all(b"HTTP/1.1 404 Not Found\r\n\r\n").await;
            }
        });
    }
}
