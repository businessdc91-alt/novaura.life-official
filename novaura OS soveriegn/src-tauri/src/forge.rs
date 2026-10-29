//! Discovery Forge native helpers.
//!
//! - `forge_fetch_text`: fetch a page from an allowlisted site (itch.io has no
//!   public search API and no CORS), so this cannot be used as a general proxy.
//! - `forge_install_desktop_app`: put a finished app on the user's PC with its own
//!   icon. It opens in an Edge app window (no browser chrome, its own profile).
//!   Names and paths reach PowerShell as script parameters, never as code.

use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};

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

fn host_of(url: &str) -> Option<&str> {
    let rest = url.strip_prefix("https://")?;
    let host = rest.split(['/', '?', '#']).next()?;
    if host.contains('@') || host.contains(':') {
        return None;
    }
    Some(host)
}

fn allowed_fetch(url: &str) -> bool {
    match host_of(url) {
        Some(h) => h == "itch.io" || (h.ends_with(".itch.io") && h.len() > 8 && !h[..h.len() - 8].contains('.')),
        None => false,
    }
}

#[tauri::command]
pub fn forge_fetch_text(url: String) -> Result<String, String> {
    if !allowed_fetch(&url) || url.contains(char::is_whitespace) || url.contains('"') {
        return Err("That site is not on the Forge's fetch list".into());
    }
    let mut cmd = Command::new("curl.exe");
    cmd.args(["-sL", "--fail", "--max-time", "20", "--max-filesize", "6000000", "-A", "Mozilla/5.0 (NovauraSovereign Forge)"])
        .arg(&url)
        .stdin(Stdio::null());
    let out = hidden(&mut cmd).output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(format!("Fetch failed (curl exit {})", out.status.code().unwrap_or(-1)));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

fn valid_slug(s: &str) -> bool {
    (1..=40).contains(&s.len()) && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn valid_name(s: &str) -> bool {
    (1..=60).contains(&s.chars().count()) && s.chars().all(|c| c.is_alphanumeric() || " -_.&'!".contains(c))
}

/// Wrap a PNG in an .ico container (Windows Vista+ reads PNG-encoded icons).
pub fn png_to_ico(png: &[u8]) -> Vec<u8> {
    let mut ico = Vec::with_capacity(22 + png.len());
    ico.extend_from_slice(&[0, 0, 1, 0, 1, 0]); // ICONDIR: reserved, type=icon, count=1
    ico.extend_from_slice(&[0, 0, 0, 0]); // 256x256 (0 means 256), no palette, reserved
    ico.extend_from_slice(&1u16.to_le_bytes()); // planes
    ico.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
    ico.extend_from_slice(&(png.len() as u32).to_le_bytes());
    ico.extend_from_slice(&22u32.to_le_bytes()); // image data offset
    ico.extend_from_slice(png);
    ico
}

const SHORTCUT_SCRIPT: &str = r#"
param([string]$Name, [string]$AppDir, [string]$Index, [string]$Icon)
$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge was not found.' }
$desktop = [Environment]::GetFolderPath('Desktop')
$link = Join-Path $desktop ($Name + '.lnk')
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($link)
$sc.TargetPath = $edge
$uri = ([System.Uri]$Index).AbsoluteUri
$sc.Arguments = "--app=`"$uri`" --user-data-dir=`"$AppDir\profile`" --no-first-run"
$sc.IconLocation = $Icon
$sc.WorkingDirectory = $AppDir
$sc.Description = $Name
$sc.Save()
Write-Output $link
"#;

fn apps_root() -> Result<PathBuf, String> {
    let base = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA is not set".to_string())?;
    Ok(PathBuf::from(base).join("NovauraApps"))
}

#[tauri::command]
pub fn forge_install_desktop_app(slug: String, name: String, html: String, icon_png_base64: Option<String>) -> Result<String, String> {
    if !valid_slug(&slug) {
        return Err("Invalid app id".into());
    }
    if !valid_name(&name) {
        return Err("Use letters, numbers, spaces and - _ . & ' ! in the app name (60 characters max)".into());
    }
    if html.len() > 30_000_000 {
        return Err("The app is too large to install".into());
    }
    let dir = apps_root()?.join(&slug);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let index = dir.join("index.html");
    fs::write(&index, html).map_err(|e| e.to_string())?;
    let icon = dir.join("icon.ico");
    if let Some(b64) = icon_png_base64 {
        use base64::Engine;
        let png = base64::engine::general_purpose::STANDARD.decode(b64.trim()).map_err(|e| format!("Bad icon data: {e}"))?;
        if png.len() < 8 || &png[..8] != b"\x89PNG\r\n\x1a\n" {
            return Err("The icon must be a PNG".into());
        }
        fs::write(&icon, png_to_ico(&png)).map_err(|e| e.to_string())?;
    }
    let script = dir.join("make-shortcut.ps1");
    fs::write(&script, SHORTCUT_SCRIPT).map_err(|e| e.to_string())?;
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(&script)
        .arg("-Name").arg(&name)
        .arg("-AppDir").arg(&dir)
        .arg("-Index").arg(&index)
        .arg("-Icon").arg(if icon.exists() { icon.clone() } else { index.clone() })
        .stdin(Stdio::null());
    let out = hidden(&mut cmd).output().map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&script);
    if !out.status.success() {
        return Err(format!("Could not create the shortcut: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fetch_allowlist() {
        assert!(allowed_fetch("https://itch.io/search?q=platformer"));
        assert!(allowed_fetch("https://kenney.itch.io/"));
        assert!(!allowed_fetch("https://evil.com/itch.io"));
        assert!(!allowed_fetch("https://itch.io.evil.com/"));
        assert!(!allowed_fetch("https://a.b.itch.io/"));
        assert!(!allowed_fetch("http://itch.io/"));
        assert!(!allowed_fetch("https://user@itch.io/"));
        assert!(!allowed_fetch("https://itch.io:8080/"));
        assert!(!allowed_fetch("https://localhost/"));
    }

    #[test]
    fn names_and_slugs() {
        assert!(valid_slug("my-app-2"));
        assert!(!valid_slug("My App"));
        assert!(!valid_slug("../x"));
        assert!(valid_name("Dillan's Notes & Tasks!"));
        assert!(!valid_name("x\"; Remove-Item"));
        assert!(!valid_name("a$(b)"));
    }

    #[test]
    fn ico_wraps_png() {
        let png = b"\x89PNG\r\n\x1a\nrest-of-png".to_vec();
        let ico = png_to_ico(&png);
        assert_eq!(&ico[..4], &[0, 0, 1, 0]);
        assert_eq!(u32::from_le_bytes(ico[14..18].try_into().unwrap()) as usize, png.len());
        assert_eq!(u32::from_le_bytes(ico[18..22].try_into().unwrap()), 22);
        assert_eq!(&ico[22..], &png[..]);
    }
}
