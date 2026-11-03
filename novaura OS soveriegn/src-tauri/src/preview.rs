//! Isolated preview server for Cybeni.
//!
//! Generated apps are served from the `cyprev` custom protocol
//! (`http://cyprev.localhost/<session>/...` on Windows), a different origin
//! from the OS UI. The preview therefore cannot read the OS's IndexedDB
//! (identity keys, vault) or reach its JavaScript. It cannot call OS commands
//! either: although WebView2 also injects Tauri's IPC bridge into this frame, the
//! CSP below blocks the IPC host, and WebView2 does not deliver iframe messages to
//! the app. Verified in the running app: an invoke from the preview had no effect.
//!
//! Files live in memory only, keyed by session, and are replaced on every build.
//!
//! Single-page sites (the Website Builder preview, and sites opened in the
//! Browser) are served here too through `site_preview_publish`: the OS window's
//! CSP carries script hashes, which switch off 'unsafe-inline' in srcdoc frames,
//! so their inline scripts would never run there. A site that came over the
//! mesh gets SITE_CSP_STRICT: scripts run, but nothing leaves the machine.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::Deserialize;
use tauri::http::{header, Request, Response, StatusCode};

const MAX_FILES: usize = 600;
const MAX_TOTAL_BYTES: usize = 24 * 1024 * 1024;
const MAX_SESSIONS: usize = 8;

/// The preview's own policy: it may load packages from esm.sh and common CDNs and
/// call out to the network like a normal web app, but never the IPC host.
///
/// SECURITY: WebView2 injects Tauri's IPC bridge into this frame too (verified in
/// the running app), and Tauri treats app-registered protocols such as `cyprev` as
/// a *local* origin for its permission checks. What keeps generated code away
/// from OS commands is that `connect-src` (and `form-action`) never allow
/// `http://ipc.localhost`. Do not widen them to `http:` or `*`.
const PREVIEW_CSP: &str = "default-src 'self' data: blob:; \
script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://esm.sh https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com; \
style-src 'self' 'unsafe-inline' https:; \
img-src 'self' data: blob: https:; \
font-src 'self' data: https:; \
media-src 'self' data: blob: https:; \
connect-src 'self' https: wss: http://127.0.0.1:* http://localhost:*; \
frame-src 'self' blob: data: https:; \
form-action 'self' https:; \
object-src 'none'; base-uri 'self'";

/// For pages from other people: inline script and style only, no network at all
/// (no beacons, no fetches, no remote images or fonts, no form posts).
const SITE_CSP_STRICT: &str = "default-src 'none'; \
script-src 'unsafe-inline'; style-src 'unsafe-inline'; \
img-src data: blob:; font-src data:; media-src data: blob:; \
connect-src 'none'; frame-src 'none'; form-action 'none'; \
object-src 'none'; base-uri 'none'";

const MAX_SITE_BYTES: usize = 4 * 1024 * 1024;

struct PreviewFile {
    mime: String,
    body: Vec<u8>,
}

struct Session {
    files: HashMap<String, PreviewFile>,
    updated: u64,
    csp: &'static str,
}

fn insert_session(session: String, entry: Session) -> Result<(), String> {
    let mut sessions = store().lock().map_err(|_| "Preview store poisoned".to_string())?;
    sessions.insert(session, entry);
    // Keep memory bounded: drop the least recently updated sessions.
    while sessions.len() > MAX_SESSIONS {
        if let Some(oldest) = sessions.iter().min_by_key(|(_, s)| s.updated).map(|(k, _)| k.clone()) {
            sessions.remove(&oldest);
        } else {
            break;
        }
    }
    Ok(())
}

fn store() -> &'static Mutex<HashMap<String, Session>> {
    static STORE: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Deserialize)]
pub struct PreviewFileIn {
    pub path: String,
    pub content: String,
    pub mime: String,
}

fn valid_session(id: &str) -> bool {
    (8..=40).contains(&id.len()) && id.chars().all(|c| c.is_ascii_alphanumeric())
}

/// Accept only plain relative paths: no `..`, no backslashes, no absolute paths.
fn clean_path(path: &str) -> Option<String> {
    let trimmed = path.trim_start_matches('/');
    if trimmed.is_empty() || trimmed.len() > 300 || trimmed.contains('\\') || trimmed.contains('\0') {
        return None;
    }
    let mut parts = Vec::new();
    for seg in trimmed.split('/') {
        match seg {
            "" | "." => continue,
            ".." => return None,
            s => parts.push(s),
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("/"))
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Replace a session's files with a new build.
#[tauri::command]
pub fn cybeni_preview_publish(session: String, files: Vec<PreviewFileIn>) -> Result<usize, String> {
    if !valid_session(&session) {
        return Err("Invalid preview session id".into());
    }
    if files.len() > MAX_FILES {
        return Err(format!("Too many files for preview (max {MAX_FILES})"));
    }
    let total: usize = files.iter().map(|f| f.content.len()).sum();
    if total > MAX_TOTAL_BYTES {
        return Err("Project is too large to preview (24 MB limit)".into());
    }

    let mut map = HashMap::with_capacity(files.len());
    for f in files {
        let path = clean_path(&f.path).ok_or_else(|| format!("Rejected preview path: {}", f.path))?;
        let mime = if f.mime.len() <= 100 && !f.mime.contains(['\r', '\n']) {
            f.mime
        } else {
            "text/plain".to_string()
        };
        map.insert(path, PreviewFile { mime, body: f.content.into_bytes() });
    }
    let count = map.len();
    insert_session(session, Session { files: map, updated: now_ms(), csp: PREVIEW_CSP })?;
    Ok(count)
}

/// Serve one HTML page as `<session>/index.html`. `strict` is for pages that
/// came from other people (see SITE_CSP_STRICT).
#[tauri::command]
pub fn site_preview_publish(session: String, html: String, strict: bool) -> Result<(), String> {
    if !valid_session(&session) {
        return Err("Invalid preview session id".into());
    }
    if html.len() > MAX_SITE_BYTES {
        return Err("Site is too large to preview (4 MB limit)".into());
    }
    let mut files = HashMap::with_capacity(1);
    files.insert("index.html".to_string(), PreviewFile { mime: "text/html; charset=utf-8".into(), body: html.into_bytes() });
    insert_session(session, Session { files, updated: now_ms(), csp: if strict { SITE_CSP_STRICT } else { PREVIEW_CSP } })
}

#[tauri::command]
pub fn cybeni_preview_clear(session: String) -> Result<(), String> {
    if let Ok(mut sessions) = store().lock() {
        sessions.remove(&session);
    }
    Ok(())
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push(hi * 16 + lo);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn respond(status: StatusCode, mime: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    respond_with(status, mime, body, PREVIEW_CSP)
}

fn respond_with(status: StatusCode, mime: &str, body: Vec<u8>, csp: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_SECURITY_POLICY, csp)
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header("X-Content-Type-Options", "nosniff")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// Serve `/<session>/<path>`. Unknown extension-less paths fall back to
/// index.html so client-side routers work.
pub fn handle(request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let raw = percent_decode(request.uri().path());
    let trimmed = raw.trim_start_matches('/');
    let (session, rest) = trimmed.split_once('/').unwrap_or((trimmed, ""));
    if !valid_session(session) {
        return respond(StatusCode::NOT_FOUND, "text/plain", b"Unknown preview".to_vec());
    }
    let path = if rest.is_empty() || rest.ends_with('/') { format!("{rest}index.html") } else { rest.to_string() };
    let Some(path) = clean_path(&path) else {
        return respond(StatusCode::BAD_REQUEST, "text/plain", b"Bad path".to_vec());
    };

    let sessions = match store().lock() {
        Ok(s) => s,
        Err(_) => return respond(StatusCode::INTERNAL_SERVER_ERROR, "text/plain", b"Preview store unavailable".to_vec()),
    };
    let Some(sess) = sessions.get(session) else {
        return respond(StatusCode::NOT_FOUND, "text/plain", b"Preview expired. Rebuild it in Cybeni.".to_vec());
    };
    let last = path.rsplit('/').next().unwrap_or("");
    let file = sess.files.get(&path).or_else(|| {
        if last.contains('.') { None } else { sess.files.get("index.html") }
    });
    match file {
        Some(f) => respond_with(StatusCode::OK, &f.mime, f.body.clone(), sess.csp),
        None => respond(StatusCode::NOT_FOUND, "text/plain", format!("Not found in project: {path}").into_bytes()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_cleaning() {
        assert_eq!(clean_path("/src/App.jsx").as_deref(), Some("src/App.jsx"));
        assert_eq!(clean_path("./a/./b.js").as_deref(), Some("a/b.js"));
        assert!(clean_path("../etc/passwd").is_none());
        assert!(clean_path("a/../../b").is_none());
        assert!(clean_path("a\\b").is_none());
        assert!(clean_path("").is_none());
    }

    #[test]
    fn serves_published_files_with_isolating_headers() {
        cybeni_preview_publish(
            "testsession1".into(),
            vec![
                PreviewFileIn { path: "index.html".into(), content: "<h1>hi</h1>".into(), mime: "text/html".into() },
                PreviewFileIn { path: "src/My App.js".into(), content: "export {}".into(), mime: "text/javascript".into() },
            ],
        )
        .unwrap();
        let get = |p: &str| handle(&Request::builder().uri(format!("http://cyprev.localhost{p}")).body(Vec::new()).unwrap());

        let index = get("/testsession1/");
        assert_eq!(index.status(), StatusCode::OK);
        assert_eq!(index.body(), b"<h1>hi</h1>");
        assert!(index.headers()[header::CONTENT_SECURITY_POLICY].to_str().unwrap().contains("connect-src 'self' https:"));

        let spaced = get("/testsession1/src/My%20App.js");
        assert_eq!(spaced.status(), StatusCode::OK);
        assert_eq!(spaced.headers()[header::CONTENT_TYPE], "text/javascript");

        assert_eq!(get("/testsession1/settings/profile").body(), b"<h1>hi</h1>"); // SPA fallback
        assert_eq!(get("/testsession1/missing.js").status(), StatusCode::NOT_FOUND);
        assert_eq!(get("/testsession1/%2e%2e/secret").status(), StatusCode::BAD_REQUEST);
        assert_eq!(get("/nosuchsession/").status(), StatusCode::NOT_FOUND);
        assert!(cybeni_preview_publish("bad id!".into(), vec![]).is_err());
        assert!(cybeni_preview_publish(
            "testsession2".into(),
            vec![PreviewFileIn { path: "../x".into(), content: String::new(), mime: "text/plain".into() }]
        )
        .is_err());
    }
}
