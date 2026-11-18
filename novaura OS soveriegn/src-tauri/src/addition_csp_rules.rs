//! Which network origins an addition may reach, and the Content-Security-Policy
//! built from them. Tauri-free so `npm run tauri:test` can run it. The cases live in
//! `tests/additions/*.txt` and the JS mirror (`src/services/additions/network.js`)
//! is checked against the same files.
//!
//! An origin is accepted only as `https://host[:port]` or `wss://host[:port]`, with a
//! dotted DNS name for the host. IP literals, `localhost` and every `*.localhost` name
//! (which covers `ipc.localhost`, the OS's own IPC host) are refused, so an addition
//! can never be allowed to reach a local server or the OS itself.

/// The cleaned origin (`scheme://host[:port]`, lowercase), or `None` if it may not be allowed.
pub fn clean_network_origin(input: &str) -> Option<String> {
    let s = input.strip_suffix('/').unwrap_or(input);
    let (scheme, rest) = s.split_once("://")?;
    let scheme = scheme.to_ascii_lowercase();
    if scheme != "https" && scheme != "wss" {
        return None;
    }
    // Only host and port may follow: no userinfo, path, query, fragment, wildcard,
    // brackets (IPv6), quotes, separators or whitespace.
    if rest.is_empty() || !rest.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b':')) {
        return None;
    }
    let (host, port) = match rest.split_once(':') {
        Some((h, p)) => (h, Some(p)),
        None => (rest, None),
    };
    let port = match port {
        None => None,
        Some(p) => {
            if p.is_empty() || p.len() > 5 || !p.bytes().all(|b| b.is_ascii_digit()) {
                return None;
            }
            let n: u32 = p.parse().ok()?;
            if n == 0 || n > 65535 {
                return None;
            }
            Some(n)
        }
    };
    let host = host.to_ascii_lowercase();
    if !valid_host(&host) {
        return None;
    }
    Some(match port {
        Some(n) => format!("{scheme}://{host}:{n}"),
        None => format!("{scheme}://{host}"),
    })
}

fn valid_host(host: &str) -> bool {
    if host.len() > 253 || host.ends_with('.') {
        return false;
    }
    let labels: Vec<&str> = host.split('.').collect();
    if labels.len() < 2 {
        return false;
    }
    let ldh = |l: &&str| {
        !l.is_empty()
            && l.len() <= 63
            && !l.starts_with('-')
            && !l.ends_with('-')
            && l.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
    };
    if !labels.iter().all(ldh) {
        return false;
    }
    let last = labels[labels.len() - 1];
    // An all-digit last label is an IPv4 literal in some spelling; `localhost` covers
    // every name under it, including `ipc.localhost`.
    !last.bytes().all(|b| b.is_ascii_digit()) && last != "localhost"
}

/// The CSP for one addition session. Every origin in `network` must pass
/// `clean_network_origin`; the first one that does not is named in the error rather
/// than silently left out. Duplicates are removed and the order is kept.
pub fn addition_csp(network: &[String]) -> Result<String, String> {
    let mut clean: Vec<String> = Vec::new();
    for raw in network {
        let Some(origin) = clean_network_origin(raw) else {
            return Err(format!("Not an allowed network origin: {raw}"));
        };
        if !clean.contains(&origin) {
            clean.push(origin);
        }
    }
    let n = if clean.is_empty() { String::new() } else { format!(" {}", clean.join(" ")) };
    const CDNS: &str = "https://esm.sh https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com";
    Ok(format!(
        "default-src 'self' data: blob:; \
script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: {CDNS}; \
style-src 'self' 'unsafe-inline' data: {CDNS}; \
img-src 'self' data: blob:{n}; \
font-src 'self' data: blob:{n}; \
media-src 'self' data: blob:{n}; \
connect-src 'self' data: blob:{n}; \
frame-src 'self' data: blob:{n}; \
form-action 'self'{n}; \
worker-src 'self' blob:; \
object-src 'none'; base-uri 'self'"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CASES: &str = include_str!("../../tests/additions/network-origins.cases.txt");
    const GOLDEN: &str = include_str!("../../tests/additions/addition-csp.golden.txt");

    fn golden_blocks() -> Vec<(Vec<String>, String)> {
        let mut out = Vec::new();
        let mut network: Option<Vec<String>> = None;
        for line in GOLDEN.lines() {
            if let Some(rest) = line.strip_prefix("network:") {
                network = Some(rest.split_whitespace().map(String::from).collect());
            } else if let Some(rest) = line.strip_prefix("csp: ") {
                out.push((network.take().expect("csp line without a network line"), rest.to_string()));
            }
        }
        out
    }

    #[test]
    fn network_origin_cases_match_the_shared_table() {
        let mut checked = 0;
        for line in CASES.lines() {
            if line.trim().is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some(rest) = line.strip_prefix("ok ") {
                let (input, clean) = rest.split_once(" => ").expect("ok case needs =>");
                assert_eq!(clean_network_origin(input).as_deref(), Some(clean), "case: {line}");
            } else if let Some(input) = line.strip_prefix("bad ") {
                assert_eq!(clean_network_origin(input), None, "case: {line}");
            } else {
                panic!("unreadable case line: {line}");
            }
            checked += 1;
        }
        assert!(checked >= 25, "only {checked} cases read");
    }

    #[test]
    fn addition_csp_matches_the_golden_file() {
        let blocks = golden_blocks();
        assert_eq!(blocks.len(), 2);
        for (network, csp) in blocks {
            assert_eq!(addition_csp(&network).unwrap(), csp, "network: {network:?}");
        }
    }

    #[test]
    fn a_bad_origin_is_refused_not_dropped() {
        let err = addition_csp(&["https://ok.example".into(), "http://bad".into()]).unwrap_err();
        assert!(err.contains("http://bad"), "{err}");
    }

    #[test]
    fn duplicates_are_removed_and_order_is_kept() {
        let csp = addition_csp(&[
            "https://b.example".into(),
            "https://A.example/".into(),
            "https://b.example".into(),
        ])
        .unwrap();
        assert!(csp.contains("connect-src 'self' data: blob: https://b.example https://a.example;"), "{csp}");
    }

    #[test]
    fn the_csp_never_allows_local_ports_or_the_ipc_host() {
        for (_, csp) in golden_blocks() {
            for banned in ["localhost", "127.0.0.1", "ipc."] {
                assert!(!csp.contains(banned), "{banned} in {csp}");
            }
        }
    }
}
