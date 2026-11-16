//! Bundled web games, served on their own origin.
//!
//! Games such as The Gilded Cage ship inside the app (public/games/<name>/) but
//! are served from the `cygame` protocol (`http://cygame.localhost/<name>/...`
//! on Windows), a different origin from the OS UI. The game can keep its own
//! saves in that origin's storage, yet it cannot read the OS's IndexedDB
//! (identity keys, vault) or reach its JavaScript.
//!
//! SECURITY: WebView2 injects Tauri's IPC bridge into every frame (see
//! preview.rs). What keeps a game away from OS commands is that GAME_CSP never
//! allows `http://ipc.localhost`. Do not widen `connect-src` to `http:` or `*`.

use tauri::http::{header, Request, Response, StatusCode};
use tauri::{AppHandle, Runtime};

use crate::preview::{clean_path, percent_decode};

/// Only these folders under public/games are served.
const GAMES: &[&str] = &["gilded-cage"];

/// The game's own files, inline scripts and styles, and its optional AI
/// helpers: LM Studio or Ollama on this machine, or OpenAI with the player's
/// own key. No other network access.
pub const GAME_CSP: &str = "default-src 'self' data: blob:; \
script-src 'self' 'unsafe-inline'; \
style-src 'self' 'unsafe-inline'; \
img-src 'self' data: blob:; \
font-src 'self' data:; \
media-src 'self' data: blob:; \
connect-src 'self' http://localhost:1234 http://127.0.0.1:1234 http://localhost:11434 http://127.0.0.1:11434 https://api.openai.com; \
frame-src 'none'; form-action 'none'; object-src 'none'; base-uri 'self'";

fn respond(status: StatusCode, mime: &str, body: Vec<u8>, cache: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_SECURITY_POLICY, GAME_CSP)
        .header(header::CACHE_CONTROL, cache)
        .header("X-Content-Type-Options", "nosniff")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// The bundled file a request maps to (`games/<name>/<path>`), or None.
pub fn asset_path(uri_path: &str) -> Option<String> {
    let raw = percent_decode(uri_path);
    let trimmed = raw.trim_start_matches('/');
    let (game, rest) = trimmed.split_once('/').unwrap_or((trimmed, ""));
    if !GAMES.contains(&game) {
        return None;
    }
    let rest = if rest.is_empty() || rest.ends_with('/') { format!("{rest}index.html") } else { rest.to_string() };
    clean_path(&rest).map(|p| format!("games/{game}/{p}"))
}

pub fn handle<R: Runtime>(app: &AppHandle<R>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let Some(path) = asset_path(request.uri().path()) else {
        return respond(StatusCode::NOT_FOUND, "text/plain", b"Unknown game".to_vec(), "no-store");
    };
    match app.asset_resolver().get(path.clone()) {
        Some(asset) => {
            // Bundled file names carry content hashes; the page itself is re-read each time.
            let cache = if path.ends_with(".html") { "no-store" } else { "public, max-age=86400" };
            respond(StatusCode::OK, &asset.mime_type, asset.bytes, cache)
        }
        None => respond(StatusCode::NOT_FOUND, "text/plain", format!("Not in this build: {path}").into_bytes(), "no-store"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_games_and_clean_paths() {
        assert_eq!(asset_path("/gilded-cage/").as_deref(), Some("games/gilded-cage/index.html"));
        assert_eq!(asset_path("/gilded-cage").as_deref(), Some("games/gilded-cage/index.html"));
        assert_eq!(asset_path("/gilded-cage/_expo/static/js/web/a.js").as_deref(), Some("games/gilded-cage/_expo/static/js/web/a.js"));
        assert_eq!(asset_path("/gilded-cage/assets/My%20Art.png").as_deref(), Some("games/gilded-cage/assets/My Art.png"));
        assert!(asset_path("/other-game/index.html").is_none());
        assert!(asset_path("/gilded-cage/../../index.html").is_none());
        assert!(asset_path("/gilded-cage/%2e%2e/secret").is_none());
        assert!(asset_path("/../gilded-cage/index.html").is_none());
    }

    #[test]
    fn policy_never_reaches_the_ipc_host() {
        assert!(!GAME_CSP.contains("ipc"));
        assert!(!GAME_CSP.contains("http: ") && !GAME_CSP.contains(" *"));
    }
}
