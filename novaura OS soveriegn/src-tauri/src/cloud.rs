 //! Cloud AI requests for bring-your-own-key providers.
//!
//! Several providers (Kimi, Qwen's DashScope, Amazon Bedrock) do not accept
//! requests from a web page, so the app sends them through curl here. Limits:
//! - https only, and only to the API hosts of known providers, so this is not a
//!   general proxy;
//! - headers and the body reach curl on stdin as a config file, so API keys never
//!   appear in the process list or on disk;
//! - GET and POST only, header names and values are checked, and replies are capped.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};

const HOSTS: &[&str] = &[
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "api.openai.com",
    "api.moonshot.ai",
    "api.moonshot.cn",
    "dashscope-intl.aliyuncs.com",
    "dashscope.aliyuncs.com",
    "api.deepseek.com",
    "api.mistral.ai",
    "api.x.ai",
    "openrouter.ai",
];

const MAX_REPLY_BYTES: usize = 24 * 1024 * 1024;
const MAX_REQUEST_BYTES: usize = 32 * 1024 * 1024;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Amazon Bedrock's runtime lives at bedrock-runtime.<region>.amazonaws.com.
fn bedrock_host(host: &str) -> bool {
    let Some(region) = host.strip_prefix("bedrock-runtime.").and_then(|r| r.strip_suffix(".amazonaws.com")) else {
        return false;
    };
    (2..=30).contains(&region.len()) && region.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

pub fn allowed_url(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else { return false };
    if url.chars().any(|c| c.is_whitespace() || c == '"' || c == '\\') {
        return false;
    }
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    if host.contains('@') || host.contains(':') {
        return false;
    }
    HOSTS.contains(&host) || bedrock_host(host)
}

fn valid_header_name(name: &str) -> bool {
    (1..=64).contains(&name.len()) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn valid_header_value(value: &str) -> bool {
    value.len() <= 8192 && !value.chars().any(|c| c == '\r' || c == '\n' || c == '\0')
}

/// Quote a value for a curl config file ("..." with backslash escapes).
pub fn config_quote(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for c in value.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

#[derive(Deserialize)]
pub struct CloudRequest {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
    timeout_secs: Option<u64>,
}

#[derive(Serialize, Debug)]
pub struct CloudResponse {
    status: u16,
    body: String,
}

/// The curl config (headers and body) for a request, after validation.
pub fn build_config(headers: &[(String, String)], body: Option<&str>) -> Result<String, String> {
    let mut config = String::new();
    for (name, value) in headers {
        if !valid_header_name(name) || !valid_header_value(value) {
            return Err(format!("Invalid header: {name}"));
        }
        config.push_str(&format!("header = {}\n", config_quote(&format!("{name}: {value}"))));
    }
    if let Some(body) = body {
        // curl reads "@name" as a file to send; request bodies are JSON and never start with "@".
        if body.starts_with('@') {
            return Err("Invalid request body".into());
        }
        if body.len() > MAX_REQUEST_BYTES {
            return Err("Request body is too large.".into());
        }
        config.push_str(&format!("data-binary = {}\n", config_quote(body)));
    }
    Ok(config)
}

/// Split curl's output: the reply body, then a newline and the HTTP status code.
pub fn split_status(output: &str) -> Option<(u16, &str)> {
    let at = output.rfind('\n')?;
    let status = output[at + 1..].trim().parse::<u16>().ok()?;
    Some((status, &output[..at]))
}

fn send(req: CloudRequest) -> Result<CloudResponse, String> {
    if !allowed_url(&req.url) {
        return Err("That address is not a supported AI provider.".into());
    }
    let method = req.method.to_ascii_uppercase();
    if method != "GET" && method != "POST" {
        return Err("Only GET and POST are allowed.".into());
    }
    let config = build_config(&req.headers, req.body.as_deref())?;
    let timeout = req.timeout_secs.unwrap_or(300).clamp(5, 3600).to_string();

    let mut cmd = Command::new("curl.exe");
    // --proto =https and --max-redirs 0 keep every request on the allowlisted https host.
    cmd.args(["-sS", "--compressed", "--proto", "=https", "--max-redirs", "0", "--max-filesize", "25165824", "--max-time", &timeout, "-X", &method, "-K", "-", "-w", "\n%{http_code}"])
        .arg(&req.url)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = hidden(&mut cmd).spawn().map_err(|e| format!("Could not start the request: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(config.as_bytes()).map_err(|e| e.to_string())?;
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if out.stdout.len() > MAX_REPLY_BYTES {
        return Err("The provider's reply was too large.".into());
    }
    let text = String::from_utf8_lossy(&out.stdout);
    match split_status(&text) {
        Some((status, body)) if status > 0 => Ok(CloudResponse { status, body: body.to_string() }),
        _ => {
            let err = String::from_utf8_lossy(&out.stderr);
            Err(format!("Could not reach the provider: {}", err.trim()))
        }
    }
}

#[tauri::command]
pub async fn cloud_ai_request(request: CloudRequest) -> Result<CloudResponse, String> {
    tauri::async_runtime::spawn_blocking(move || send(request)).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_allowlist() {
        assert!(allowed_url("https://api.anthropic.com/v1/messages"));
        assert!(allowed_url("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"));
        assert!(allowed_url("https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-pro-v1:0/converse"));
        assert!(!allowed_url("http://api.openai.com/v1/models"));
        assert!(!allowed_url("https://evil.example.com/v1"));
        assert!(!allowed_url("https://api.openai.com.evil.com/v1"));
        assert!(!allowed_url("https://user@api.openai.com/v1"));
        assert!(!allowed_url("https://api.openai.com:8443/v1"));
        assert!(!allowed_url("https://bedrock-runtime.evil.com.amazonaws.com/x"));
        assert!(!allowed_url("https://bedrock-runtime..amazonaws.com/x"));
        assert!(!allowed_url("https://api.openai.com/v1 -K x"));
    }

    #[test]
    fn config_escapes_and_validates() {
        let cfg = build_config(
            &[("Authorization".into(), "Bearer abc".into())],
            Some("{\"a\":\"line\\nquote\\\" back\\\\\"}"),
        )
        .unwrap();
        assert_eq!(cfg.lines().next().unwrap(), "header = \"Authorization: Bearer abc\"");
        assert!(cfg.contains("data-binary = \"{\\\"a\\\":\\\"line\\\\nquote\\\\\\\" back\\\\\\\\\\\"}\""));
        assert!(build_config(&[("Bad Name".into(), "x".into())], None).is_err());
        assert!(build_config(&[("X-Key".into(), "a\nheader = evil".into())], None).is_err());
        assert!(build_config(&[], Some("@C:/secret.txt")).is_err());
    }

    #[test]
    fn status_split() {
        assert_eq!(split_status("{\"ok\":1}\n200"), Some((200, "{\"ok\":1}")));
        assert_eq!(split_status("line1\nline2\n429"), Some((429, "line1\nline2")));
        assert_eq!(split_status("\n000"), Some((0, "")));
        assert_eq!(split_status("no status"), None);
    }
}
