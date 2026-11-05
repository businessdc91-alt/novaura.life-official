//! Template Library native helpers: unpack a template bundle into
//! Documents\NovauraSovereign\Templates\<folder>.
//!
//! The web side checks the bundle's signature and every file's SHA-256 before
//! it sends a byte. This side keeps each write inside that install's own new
//! folder: paths are checked again, nothing is overwritten, and nothing is
//! written through a link.
use std::fs;
use std::io::Write;
use std::path::PathBuf;

fn templates_root() -> PathBuf {
    crate::get_documents_dir().join("Templates")
}

fn valid_folder(name: &str) -> bool {
    (1..=90).contains(&name.len())
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_')
        && !name.starts_with('.')
        && !name.ends_with('.')
}

/// The same rules as isSafeTemplatePath in novaTemplates.js.
fn safe_rel_path(p: &str) -> Option<PathBuf> {
    if p.is_empty() || p.len() > 400 || p.starts_with('/') || p.contains('\\') {
        return None;
    }
    let mut out = PathBuf::new();
    for seg in p.split('/') {
        if seg.is_empty() || seg.chars().count() > 200 || seg == "." || seg == ".." {
            return None;
        }
        if seg.chars().any(|c| "<>:\"|?*".contains(c) || (c as u32) < 0x20) || seg.ends_with('.') || seg.ends_with(' ') {
            return None;
        }
        let stem = seg.split('.').next().unwrap_or("").to_ascii_lowercase();
        let device = matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
            || ((stem.starts_with("com") || stem.starts_with("lpt")) && stem.len() == 4 && stem.as_bytes()[3].is_ascii_digit());
        if device {
            return None;
        }
        out.push(seg);
    }
    Some(out)
}

fn percent_decode(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = s.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

#[derive(serde::Serialize)]
pub struct TemplateFolder {
    pub folder: String,
    pub path: String,
}

/// Create a new, empty folder for an install: `base`, or `base-2`, `base-3`… when
/// taken. An existing folder may hold the user's own work, so it is never reused.
#[tauri::command]
pub fn template_prepare_dir(base: String) -> Result<TemplateFolder, String> {
    if !valid_folder(&base) || base.len() > 80 {
        return Err("Invalid template folder name".into());
    }
    let root = templates_root();
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    for i in 1..1000 {
        let name = if i == 1 { base.clone() } else { format!("{base}-{i}") };
        let dir = root.join(&name);
        match fs::create_dir(&dir) {
            Ok(()) => return Ok(TemplateFolder { folder: name, path: dir.to_string_lossy().into_owned() }),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
    Err("Too many copies of this template".into())
}

/// Write one file of an install. The body is the file's bytes; the folder and
/// the (percent-encoded) path come in the x-template-folder and x-template-path headers.
#[tauri::command]
pub fn template_write_file(request: tauri::ipc::Request) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("Expected the file's bytes".into());
    };
    let header = |k: &str| request.headers().get(k).and_then(|v| v.to_str().ok()).map(str::to_string);
    let folder = header("x-template-folder").ok_or("Missing template folder")?;
    let rel = header("x-template-path").and_then(|p| percent_decode(&p)).ok_or("Missing file path")?;
    if !valid_folder(&folder) {
        return Err("Invalid template folder name".into());
    }
    let rel_path = safe_rel_path(&rel).ok_or_else(|| format!("Unsafe file path: {rel}"))?;
    let dir = templates_root().join(&folder);
    if !dir.is_dir() {
        return Err("The template folder does not exist".into());
    }
    let dest = dir.join(rel_path);
    let parent = dest.parent().ok_or("Bad file path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    // A link or junction inside the folder must not carry the write elsewhere.
    let inside = parent.canonicalize().map_err(|e| e.to_string())?.starts_with(dir.canonicalize().map_err(|e| e.to_string())?);
    if !inside {
        return Err(format!("{rel} would land outside the template folder"));
    }
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&dest)
        .map_err(|e| format!("{rel}: {e}"))?;
    f.write_all(data).map_err(|e| format!("{rel}: {e}"))
}

/// Open an installed template's folder in the file manager.
#[tauri::command]
pub fn template_open_dir(folder: String) -> Result<(), String> {
    if !valid_folder(&folder) {
        return Err("Invalid template folder name".into());
    }
    let dir = templates_root().join(&folder);
    if !dir.is_dir() {
        return Err("That template folder is no longer there".into());
    }
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let program = "xdg-open";
    std::process::Command::new(program).arg(&dir).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_must_stay_inside_and_be_portable() {
        assert!(safe_rel_path("Scripts/GameState.gd").is_some());
        assert!(safe_rel_path("assets/hologram_ui/1. Free Hologram/Button 1.png").is_some());
        for bad in ["", "/etc/passwd", "a/../b", "./a", "a\\b", "C:/x", "a/b:c", "con", "COM1.txt", "a/nul.png", "trailing.", "space ", "a//b", "tab\tname"] {
            assert!(safe_rel_path(bad).is_none(), "{bad:?} should be refused");
        }
    }

    #[test]
    fn folder_names_are_plain() {
        assert!(valid_folder("aetherium-tcg-0.1.0-prealpha"));
        assert!(valid_folder("novaura-webos-0.1.0-prealpha-2"));
        for bad in ["", "..", ".hidden", "a/b", "a\\b", "x.", "name with space", "ü"] {
            assert!(!valid_folder(bad), "{bad:?} should be refused");
        }
    }

    #[test]
    fn percent_decoding_round_trips_and_rejects_junk() {
        assert_eq!(percent_decode("a%20b%2Fc").as_deref(), Some("a b/c"));
        assert_eq!(percent_decode("caf%C3%A9").as_deref(), Some("café"));
        assert!(percent_decode("bad%zz").is_none());
        assert!(percent_decode("cut%4").is_none());
    }
}
