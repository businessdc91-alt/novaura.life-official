//! In-memory file store for addition sessions served by `cyprev`. Tauri-free so
//! `npm run tauri:test` can run it; `preview.rs` holds one of these behind a mutex.
//!
//! Additions have their own pool, apart from Cybeni previews, so rebuilding previews
//! can never push out a running addition. Each session carries the CSP built for it
//! from the network origins the person approved. Files marked "once" (the storage
//! snapshot, `__novaura/boot.js`) are removed as soon as they are served, so nothing
//! can fetch them again later.

use std::collections::HashMap;

pub const MAX_ADDITION_SESSIONS: usize = 32;
pub const MAX_ADDITION_SESSION_BYTES: usize = 256 * 1024 * 1024;
pub const MAX_ADDITION_TOTAL_BYTES: usize = 1024 * 1024 * 1024;
pub const MAX_ADDITION_FILES: usize = 4000;

/// A session id: 8 to 40 ASCII letters and digits.
pub fn valid_session(id: &str) -> bool {
    (8..=40).contains(&id.len()) && id.chars().all(|c| c.is_ascii_alphanumeric())
}

/// Accept only plain relative paths: no `..`, no backslashes, no absolute paths.
pub fn clean_path(path: &str) -> Option<String> {
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
    if parts.is_empty() { None } else { Some(parts.join("/")) }
}

/// Decode `%XX` escapes; anything malformed is kept as written.
pub fn percent_decode(input: &str) -> String {
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

/// What `serve` found for a request.
pub enum Served {
    /// No addition session by that id: the caller serves it as a preview, as before.
    NotAddition,
    File { mime: String, body: Vec<u8>, csp: String },
    /// The session exists but not the file (or the path was not a clean one).
    Missing { csp: String },
}

struct AdditionFile {
    mime: String,
    body: Vec<u8>,
    once: bool,
}

struct AdditionSession {
    files: HashMap<String, AdditionFile>,
    csp: String,
    bytes: usize,
    updated: u64,
}

pub struct AdditionSessions {
    sessions: HashMap<String, AdditionSession>,
    max_sessions: usize,
    max_session_bytes: usize,
    max_total_bytes: usize,
    max_files: usize,
}

impl Default for AdditionSessions {
    fn default() -> Self {
        Self::new()
    }
}

impl AdditionSessions {
    pub fn new() -> Self {
        Self::with_limits(MAX_ADDITION_SESSIONS, MAX_ADDITION_SESSION_BYTES, MAX_ADDITION_TOTAL_BYTES, MAX_ADDITION_FILES)
    }

    pub fn with_limits(max_sessions: usize, max_session_bytes: usize, max_total_bytes: usize, max_files: usize) -> Self {
        Self { sessions: HashMap::new(), max_sessions, max_session_bytes, max_total_bytes, max_files }
    }

    /// Replace a session's files. `once` names files that may be served a single time.
    /// Returns the number of files stored. Past the pool limits the least recently
    /// published sessions are dropped, never the one just published.
    pub fn publish(
        &mut self,
        session: &str,
        files: Vec<(String, String, Vec<u8>)>,
        csp: String,
        once: &[String],
        now: u64,
    ) -> Result<usize, String> {
        if !valid_session(session) {
            return Err("Invalid addition session id".into());
        }
        if files.len() > self.max_files {
            return Err(format!("Too many files for one addition (max {})", self.max_files));
        }
        let bytes: usize = files.iter().map(|(_, _, b)| b.len()).sum();
        if bytes > self.max_session_bytes {
            return Err(format!("Addition is too large to run ({} MB limit)", self.max_session_bytes / (1024 * 1024)));
        }
        let once: Vec<String> = once.iter().filter_map(|p| clean_path(p)).collect();
        let mut map = HashMap::with_capacity(files.len());
        for (path, mime, body) in files {
            let clean = clean_path(&path).ok_or_else(|| format!("Rejected addition path: {path}"))?;
            let mime = if mime.len() <= 100 && !mime.contains(['\r', '\n']) { mime } else { "text/plain".to_string() };
            let once = once.contains(&clean);
            map.insert(clean, AdditionFile { mime, body, once });
        }
        let count = map.len();
        self.sessions.insert(session.to_string(), AdditionSession { files: map, csp, bytes, updated: now });

        loop {
            let total: usize = self.sessions.values().map(|s| s.bytes).sum();
            if self.sessions.len() <= self.max_sessions && total <= self.max_total_bytes {
                break;
            }
            let oldest = self
                .sessions
                .iter()
                .filter(|(id, _)| id.as_str() != session)
                .min_by_key(|(_, s)| s.updated)
                .map(|(id, _)| id.clone());
            match oldest {
                Some(id) => {
                    self.sessions.remove(&id);
                }
                None => break,
            }
        }
        Ok(count)
    }

    /// Serve `raw_path` (decoded, relative to the session). An empty path or one ending
    /// in `/` means its `index.html`; an unknown path without a dot in its last segment
    /// falls back to `index.html` so client-side routers work.
    pub fn serve(&mut self, session: &str, raw_path: &str) -> Served {
        let Some(sess) = self.sessions.get_mut(session) else {
            return Served::NotAddition;
        };
        let path = if raw_path.is_empty() || raw_path.ends_with('/') { format!("{raw_path}index.html") } else { raw_path.to_string() };
        let Some(path) = clean_path(&path) else {
            return Served::Missing { csp: sess.csp.clone() };
        };
        let last = path.rsplit('/').next().unwrap_or("");
        let key = if sess.files.contains_key(&path) {
            path
        } else if !last.contains('.') && sess.files.contains_key("index.html") {
            "index.html".to_string()
        } else {
            return Served::Missing { csp: sess.csp.clone() };
        };
        let once = sess.files.get(&key).map(|f| f.once).unwrap_or(false);
        let file = if once {
            let f = sess.files.remove(&key).expect("checked above");
            sess.bytes = sess.bytes.saturating_sub(f.body.len());
            f
        } else {
            let f = &sess.files[&key];
            AdditionFile { mime: f.mime.clone(), body: f.body.clone(), once: false }
        };
        Served::File { mime: file.mime, body: file.body, csp: sess.csp.clone() }
    }

    pub fn clear(&mut self, session: &str) {
        self.sessions.remove(session);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(path: &str, body: &str) -> (String, String, Vec<u8>) {
        let mime = if path.ends_with(".html") { "text/html" } else { "text/javascript" };
        (path.to_string(), mime.to_string(), body.as_bytes().to_vec())
    }

    fn body(served: Served) -> Vec<u8> {
        match served {
            Served::File { body, .. } => body,
            Served::Missing { .. } => b"<missing>".to_vec(),
            Served::NotAddition => b"<not addition>".to_vec(),
        }
    }

    #[test]
    fn path_cleaning() {
        assert_eq!(clean_path("/src/App.jsx").as_deref(), Some("src/App.jsx"));
        assert_eq!(clean_path("./a/./b.js").as_deref(), Some("a/b.js"));
        assert!(clean_path("../etc/passwd").is_none());
        assert!(clean_path("a/../../b").is_none());
        assert!(clean_path("a\\b").is_none());
        assert!(clean_path("").is_none());
        assert_eq!(percent_decode("My%20App.js"), "My App.js");
        assert_eq!(percent_decode("bad%zz"), "bad%zz");
    }

    #[test]
    fn serves_files_with_the_session_csp() {
        let mut s = AdditionSessions::new();
        let n = s
            .publish("addsession01", vec![file("index.html", "<h1>hi</h1>"), file("src/My App.js", "export {}")], "csp-a".into(), &[], 1)
            .unwrap();
        assert_eq!(n, 2);
        match s.serve("addsession01", "") {
            Served::File { mime, body, csp } => {
                assert_eq!(mime, "text/html");
                assert_eq!(body, b"<h1>hi</h1>");
                assert_eq!(csp, "csp-a");
            }
            _ => panic!("index.html not served"),
        }
        assert_eq!(body(s.serve("addsession01", "src/My App.js")), b"export {}");
    }

    #[test]
    fn once_files_are_served_one_time() {
        let mut s = AdditionSessions::new();
        s.publish(
            "addsession01",
            vec![file("index.html", "x"), file("__novaura/boot.js", "boot"), file("__novaura/v1.js", "bridge")],
            "csp".into(),
            &["/__novaura/boot.js".to_string()],
            1,
        )
        .unwrap();
        assert_eq!(body(s.serve("addsession01", "__novaura/boot.js")), b"boot");
        match s.serve("addsession01", "__novaura/boot.js") {
            Served::Missing { csp } => assert_eq!(csp, "csp"),
            _ => panic!("boot.js served twice"),
        }
        assert_eq!(body(s.serve("addsession01", "__novaura/v1.js")), b"bridge");
        assert_eq!(body(s.serve("addsession01", "__novaura/v1.js")), b"bridge");
    }

    #[test]
    fn spa_fallback_and_bad_paths() {
        let mut s = AdditionSessions::new();
        s.publish("addsession01", vec![file("index.html", "<h1>hi</h1>")], "csp".into(), &[], 1).unwrap();
        assert_eq!(body(s.serve("addsession01", "settings/profile")), b"<h1>hi</h1>");
        assert_eq!(body(s.serve("addsession01", "deep/")), b"<missing>"); // deep/index.html, has a dot
        assert_eq!(body(s.serve("addsession01", "missing.js")), b"<missing>");
        assert_eq!(body(s.serve("addsession01", "../secret")), b"<missing>");
        assert!(s.publish("bad id!", vec![], "csp".into(), &[], 1).is_err());
        assert!(s.publish("addsession02", vec![file("../x", "")], "csp".into(), &[], 1).is_err());
    }

    #[test]
    fn oversized_sessions_are_refused() {
        let mut s = AdditionSessions::with_limits(4, 10, 100, 3);
        let err = s.publish("addsession01", vec![file("a.js", "0123456789X")], "csp".into(), &[], 1).unwrap_err();
        assert!(err.contains("too large"), "{err}");
        let four = vec![file("a.js", ""), file("b.js", ""), file("c.js", ""), file("d.js", "")];
        let err = s.publish("addsession01", four, "csp".into(), &[], 1).unwrap_err();
        assert!(err.contains("Too many files"), "{err}");
        // A refused publish leaves nothing behind.
        assert!(matches!(s.serve("addsession01", ""), Served::NotAddition));
    }

    #[test]
    fn past_the_pool_size_the_oldest_session_goes_but_never_the_new_one() {
        let mut s = AdditionSessions::with_limits(3, 10, 24, 10);
        for (i, id) in ["addsession01", "addsession02", "addsession03", "addsession04"].iter().enumerate() {
            s.publish(id, vec![file("index.html", "12345")], "csp".into(), &[], i as u64).unwrap();
        }
        assert!(matches!(s.serve("addsession01", ""), Served::NotAddition));
        assert!(matches!(s.serve("addsession04", ""), Served::File { .. }));
        // Total bytes: a 10-byte session pushes out the oldest until the pool fits in 25.
        s.publish("addsession05", vec![file("index.html", "0123456789")], "csp".into(), &[], 10).unwrap();
        s.publish("addsession06", vec![file("index.html", "0123456789")], "csp".into(), &[], 11).unwrap();
        assert!(matches!(s.serve("addsession05", ""), Served::File { .. }));
        assert!(matches!(s.serve("addsession06", ""), Served::File { .. }));
        assert!(matches!(s.serve("addsession04", ""), Served::NotAddition));
        // Republishing a session replaces it rather than counting it twice.
        s.publish("addsession06", vec![file("index.html", "new")], "csp".into(), &[], 12).unwrap();
        assert_eq!(body(s.serve("addsession06", "")), b"new");
        assert!(matches!(s.serve("addsession05", ""), Served::File { .. }));
    }

    #[test]
    fn an_unknown_session_is_not_an_addition() {
        let mut s = AdditionSessions::new();
        assert!(matches!(s.serve("somepreview1", ""), Served::NotAddition));
        s.publish("addsession01", vec![file("index.html", "x")], "csp".into(), &[], 1).unwrap();
        s.clear("addsession01");
        assert!(matches!(s.serve("addsession01", ""), Served::NotAddition));
    }
}
