//! Pure rules for the Sentinel Probe's Windows Sandbox runner: the `.wsb` config that
//! maps the in/io folders and launches the startup script, validation of the host-side
//! working directory, and the control-channel file names. Tauri-free so
//! `npm run tauri:test` can run it. The in-sandbox PowerShell (startup.ps1 / executor.ps1)
//! is static and proven in the Task 9 live check, not in CI.

/// Escape the five XML-significant characters so a host path can't break the `.wsb`.
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// The Windows Sandbox `.wsb` for one probe run. `in_dir` (the copied target content and
/// the scripts) is mapped read-only; `io_dir` (the control channel) read-write. The
/// network adapter is removed outright, and the logon command runs startup.ps1 from the
/// mapped `in` folder, which also blocks the firewall and serves the copy on loopback.
pub fn wsb_config(in_dir: &str, io_dir: &str) -> String {
    format!(
        "<Configuration>\n\
  <VGpu>Disable</VGpu>\n\
  <Networking>Disable</Networking>\n\
  <ClipboardRedirection>Disable</ClipboardRedirection>\n\
  <PrinterRedirection>Disable</PrinterRedirection>\n\
  <AudioInput>Disable</AudioInput>\n\
  <VideoInput>Disable</VideoInput>\n\
  <ProtectedClient>Enable</ProtectedClient>\n\
  <MappedFolders>\n\
    <MappedFolder>\n\
      <HostFolder>{in_h}</HostFolder>\n\
      <SandboxFolder>C:\\sentinel\\in</SandboxFolder>\n\
      <ReadOnly>true</ReadOnly>\n\
    </MappedFolder>\n\
    <MappedFolder>\n\
      <HostFolder>{io_h}</HostFolder>\n\
      <SandboxFolder>C:\\sentinel\\io</SandboxFolder>\n\
      <ReadOnly>false</ReadOnly>\n\
    </MappedFolder>\n\
  </MappedFolders>\n\
  <LogonCommand>\n\
    <Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\\sentinel\\in\\startup.ps1</Command>\n\
  </LogonCommand>\n\
</Configuration>\n",
        in_h = xml_escape(in_dir),
        io_h = xml_escape(io_dir),
    )
}

/// The host-side working directory for a run must be an absolute path, carry no `..`
/// component, and sit under the OS temp area. A directory that fails any of these is
/// refused rather than used.
pub fn validate_run_dir(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("run dir is empty".into());
    }
    if path.contains("..") {
        return Err("run dir must not contain '..'".into());
    }
    if !std::path::Path::new(path).is_absolute() {
        return Err("run dir must be an absolute path".into());
    }
    let temp = std::env::temp_dir();
    let temp = temp.to_string_lossy();
    if !is_under(path, &temp) {
        return Err(format!("run dir must be under the OS temp area ({temp})"));
    }
    Ok(())
}

fn norm(s: &str) -> String {
    s.replace('\\', "/").trim_end_matches('/').to_ascii_lowercase()
}

/// True when `path` is `base` or a descendant of it (case-insensitive, separator-agnostic).
fn is_under(path: &str, base: &str) -> bool {
    let (p, b) = (norm(path), norm(base));
    !b.is_empty() && (p == b || p.starts_with(&format!("{b}/")))
}

/// The channel file name for command/observation number `n`, e.g. `cmd-3.json`.
pub fn channel_name(kind: &str, n: u32) -> String {
    format!("{kind}-{n}.json")
}

/// Parse a channel file name back to `(kind, n)`, or `None` for anything that is not
/// exactly `<lowercase-kind>-<digits>.json` with no path parts — a foreign file dropped
/// in the io folder is rejected, not acted on.
pub fn parse_channel_name(name: &str) -> Option<(String, u32)> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return None;
    }
    let stem = name.strip_suffix(".json")?;
    let (kind, num) = stem.split_once('-')?;
    if kind.is_empty() || !kind.bytes().all(|b| b.is_ascii_lowercase()) {
        return None;
    }
    if num.is_empty() || !num.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let n: u32 = num.parse().ok()?;
    Some((kind.to_string(), n))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_wsb_maps_both_folders_and_runs_startup() {
        let w = wsb_config("C:\\host\\in", "C:\\host\\io");
        assert!(w.contains("<HostFolder>C:\\host\\in</HostFolder>"), "{w}");
        assert!(w.contains("<HostFolder>C:\\host\\io</HostFolder>"), "{w}");
        assert!(w.contains("<SandboxFolder>C:\\sentinel\\in</SandboxFolder>"), "{w}");
        assert!(w.contains("<SandboxFolder>C:\\sentinel\\io</SandboxFolder>"), "{w}");
        assert!(w.contains("<ReadOnly>true</ReadOnly>"), "{w}");
        assert!(w.contains("<ReadOnly>false</ReadOnly>"), "{w}");
        assert!(w.contains("startup.ps1"), "{w}");
        // No egress is pinned at the config level too: the network adapter is removed.
        assert!(w.contains("<Networking>Disable</Networking>"), "{w}");
    }

    #[test]
    fn a_run_dir_with_dotdot_is_refused() {
        let base = std::env::temp_dir();
        let evil = base.join("..").join("evil");
        assert!(validate_run_dir(evil.to_str().unwrap()).is_err());
        assert!(validate_run_dir("relative/not/absolute").is_err());
    }

    #[test]
    fn an_absolute_temp_run_dir_is_accepted() {
        let base = std::env::temp_dir();
        let dir = base.join("sentinel").join("run-abc123");
        assert!(validate_run_dir(dir.to_str().unwrap()).is_ok(), "{dir:?}");
    }

    #[test]
    fn channel_names_round_trip_and_a_foreign_name_is_rejected() {
        for n in [0u32, 1, 3, 7, 42, 1000] {
            assert_eq!(parse_channel_name(&channel_name("cmd", n)), Some(("cmd".to_string(), n)));
            assert_eq!(parse_channel_name(&channel_name("obs", n)), Some(("obs".to_string(), n)));
        }
        for bad in [
            "hack.exe", "cmd-3.txt", "cmd-.json", "cmd-x.json", "../cmd-3.json",
            "cmd/3.json", "cmd\\3.json", "CMD-3.json", "obs-3.json.exe",
        ] {
            assert_eq!(parse_channel_name(bad), None, "{bad}");
        }
    }
}
