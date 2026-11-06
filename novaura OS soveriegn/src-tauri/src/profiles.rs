//! Profiles: separate people on one PC, each with their own Sovereign data.
//!
//! A profile is picked at startup (src/components/ProfilePicker.jsx). The first
//! profile, "main", keeps the data the app has always had. Every other profile runs
//! in its own process with WEBVIEW2_USER_DATA_FOLDER pointing at its own folder, so
//! its IndexedDB, localStorage and pop-out windows never see anyone else's, and its
//! native files (vault mirror, synced documents, templates) live in its own folders.
//! The node itself (license, node certificate, mesh relay, AI models) is shared.
//!
//! Entering a profile other than the one this process runs restarts the app with
//! `--profile <id>`. For a profile with a password the process that checked it also
//! writes a one-time ticket, so `--profile` alone can't open it. The password keeps
//! people out of a profile inside Sovereign; it doesn't encrypt the files on disk.

use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::password;

pub const MAIN: &str = "main";
/// tauri.conf.json `identifier`: WebView2 data lives under %LOCALAPPDATA%\<identifier>.
const IDENTIFIER: &str = "life.novaura.sovereign";
const DEFAULT_COLOR: &str = "#22d3ee";
const TICKET_LIFETIME: Duration = Duration::from_secs(60);
const MAX_PROFILES: usize = 12;

#[derive(Serialize, Deserialize, Clone)]
struct PasswordRecord {
    salt: String,
    hash: String,
    iterations: u32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Profile {
    id: String,
    name: String,
    color: String,
    #[serde(default)]
    created_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    password: Option<PasswordRecord>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Registry {
    #[serde(default)]
    last_used: Option<String>,
    #[serde(default)]
    profiles: Vec<Profile>,
}

/// What the picker may know about a profile (never the password record).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileView {
    id: String,
    name: String,
    color: String,
    created_at: u64,
    has_password: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilesState {
    profiles: Vec<ProfileView>,
    /// The profile whose data this process holds.
    active: String,
    last_used: String,
    /// Started with `--profile`: the choice is made, go straight to the desktop.
    chosen: bool,
    /// Started with `--choose` ("Switch profile"): open the picker right away.
    choose: bool,
    /// Started by Windows at sign-in.
    autostart: bool,
    /// Why a requested profile wasn't opened, for the picker to show.
    notice: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entered {
    /// True when the app is restarting into the profile; this process is about to exit.
    relaunching: bool,
}

struct Session {
    profile: String,
    chosen: bool,
    choose: bool,
    autostart: bool,
    notice: Option<String>,
}

static SESSION: OnceLock<Session> = OnceLock::new();
static REGISTRY_LOCK: Mutex<()> = Mutex::new(());

fn session() -> &'static Session {
    SESSION.get_or_init(|| Session { profile: MAIN.into(), chosen: false, choose: false, autostart: false, notice: None })
}

/// The profile whose data this process holds.
pub fn active() -> &'static str {
    &session().profile
}

/// Native files that belong to the active profile (vault mirror, saved files).
pub fn data_dir() -> PathBuf {
    profile_data_dir(active())
}

/// The active profile's documents folder, given the main one (Documents\NovauraSovereign).
pub fn documents_dir(main: PathBuf) -> PathBuf {
    if active() == MAIN { main } else { main.join("Profiles").join(active()) }
}

fn profile_data_dir(id: &str) -> PathBuf {
    if id == MAIN { crate::get_app_data_dir() } else { crate::get_app_data_dir().join("profiles").join(id) }
}

fn webview_dir(id: &str) -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    Some(PathBuf::from(local).join(IDENTIFIER).join("profiles").join(id))
}

fn registry_path() -> PathBuf {
    crate::get_app_data_dir().join("profiles.json")
}

fn valid_id(id: &str) -> bool {
    id == MAIN || (id.len() == 13 && id.starts_with('p') && id[1..].bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()))
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn random_bytes<const N: usize>() -> Result<[u8; N], String> {
    let mut bytes = [0u8; N];
    #[cfg(windows)]
    {
        use windows_sys::Win32::Security::Cryptography::{BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG};
        let status = unsafe { BCryptGenRandom(std::ptr::null_mut(), bytes.as_mut_ptr(), N as u32, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
        if status != 0 {
            return Err("The system random number generator failed".into());
        }
    }
    #[cfg(not(windows))]
    {
        use std::io::Read;
        fs::File::open("/dev/urandom").and_then(|mut f| f.read_exact(&mut bytes)).map_err(|e| e.to_string())?;
    }
    Ok(bytes)
}

fn load() -> Registry {
    let mut registry: Registry = fs::read_to_string(registry_path())
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    registry.profiles.retain(|p| valid_id(&p.id));
    if !registry.profiles.iter().any(|p| p.id == MAIN) {
        registry.profiles.insert(0, Profile { id: MAIN.into(), name: "Main".into(), color: DEFAULT_COLOR.into(), created_at: 0, password: None });
    }
    registry
}

fn save(registry: &Registry) -> Result<(), String> {
    let path = registry_path();
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(registry).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

fn view(p: &Profile) -> ProfileView {
    ProfileView { id: p.id.clone(), name: p.name.clone(), color: p.color.clone(), created_at: p.created_at, has_password: p.password.is_some() }
}

fn clean_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 32 || name.chars().any(char::is_control) {
        return Err("A profile name is 1 to 32 characters.".into());
    }
    Ok(name.to_string())
}

fn clean_color(color: &str) -> String {
    let ok = color.len() == 7 && color.starts_with('#') && color[1..].bytes().all(|b| b.is_ascii_hexdigit());
    if ok { color.to_ascii_lowercase() } else { DEFAULT_COLOR.into() }
}

fn new_password(password: &str) -> Result<PasswordRecord, String> {
    let count = password.chars().count();
    if !(4..=128).contains(&count) {
        return Err("A password is 4 to 128 characters.".into());
    }
    let salt = random_bytes::<16>()?;
    let hash = password::pbkdf2_sha256(password.as_bytes(), &salt, password::ITERATIONS);
    Ok(PasswordRecord { salt: password::to_hex(&salt), hash: password::to_hex(&hash), iterations: password::ITERATIONS })
}

fn password_ok(record: &Option<PasswordRecord>, attempt: Option<&str>) -> bool {
    let Some(record) = record else { return true };
    let (Some(attempt), Some(salt), Some(hash)) = (attempt, password::from_hex(&record.salt), password::from_hex(&record.hash)) else {
        return false;
    };
    password::same(&password::pbkdf2_sha256(attempt.as_bytes(), &salt, record.iterations), &hash)
}

fn ticket_path(id: &str) -> PathBuf {
    profile_data_dir(id).join("launch_ticket")
}

fn issue_ticket(id: &str) -> Result<String, String> {
    let token = password::to_hex(&random_bytes::<24>()?);
    let path = ticket_path(id);
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::write(&path, format!("{token}\n{}", now_secs() + TICKET_LIFETIME.as_secs())).map_err(|e| e.to_string())?;
    Ok(token)
}

/// A ticket opens the profile once, within its lifetime.
fn redeem_ticket(id: &str, presented: Option<&str>) -> bool {
    let path = ticket_path(id);
    let stored = fs::read_to_string(&path).unwrap_or_default();
    let _ = fs::remove_file(&path);
    let mut lines = stored.lines();
    let (Some(token), Some(expires), Some(presented)) = (lines.next(), lines.next().and_then(|e| e.parse::<u64>().ok()), presented) else {
        return false;
    };
    now_secs() <= expires && password::same(token.as_bytes(), presented.as_bytes())
}

/// Reads `--profile`, `--ticket`, `--choose` and `--autostart`. For a profile other
/// than main, points WebView2 at that profile's own folder. Must run before Tauri
/// creates any window, while this is the only thread.
pub fn init_from_args() {
    let args: Vec<String> = std::env::args().collect();
    let flag = |name: &str| args.iter().any(|a| a == name);
    let value = |name: &str| args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).map(String::as_str);

    let mut session = Session { profile: MAIN.into(), chosen: false, choose: flag("--choose"), autostart: flag("--autostart"), notice: None };
    if let Some(id) = value("--profile") {
        let registry = load();
        match registry.profiles.iter().find(|p| valid_id(id) && p.id == id) {
            None => {
                session.choose = true;
                session.notice = Some("That profile no longer exists.".into());
            }
            Some(profile) if profile.password.is_some() && !redeem_ticket(id, value("--ticket")) => {
                session.choose = true;
                session.notice = Some(format!("{} has a password. Sign in here.", profile.name));
            }
            Some(_) => {
                session.profile = id.to_string();
                session.chosen = true;
            }
        }
    }
    if session.profile != MAIN {
        if let Some(dir) = webview_dir(&session.profile) {
            let _ = fs::create_dir_all(&dir);
            // SAFETY: run() calls this first, before Tauri or any other thread starts.
            unsafe { std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &dir) };
        }
    }
    let _ = SESSION.set(session);
}

/// Start a fresh copy of the app with `args` and close this one.
fn relaunch(app: &AppHandle, args: &[&str]) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    std::process::Command::new(exe)
        .args(args)
        // The new process picks its own data folder; it must not inherit this profile's.
        .env_remove("WEBVIEW2_USER_DATA_FOLDER")
        .spawn()
        .map_err(|e| format!("Could not restart Sovereign: {e}"))?;
    let app = app.clone();
    std::thread::spawn(move || {
        // Let the command's reply reach the page first.
        std::thread::sleep(Duration::from_millis(250));
        app.exit(0);
    });
    Ok(())
}

#[tauri::command]
pub fn profiles_state() -> ProfilesState {
    let registry = load();
    let s = session();
    let last_used = registry.last_used.filter(|id| registry.profiles.iter().any(|p| &p.id == id)).unwrap_or_else(|| MAIN.into());
    ProfilesState {
        profiles: registry.profiles.iter().map(view).collect(),
        active: s.profile.clone(),
        last_used,
        chosen: s.chosen,
        choose: s.choose,
        autostart: s.autostart,
        notice: s.notice.clone(),
    }
}

#[tauri::command]
pub fn profile_create(name: String, color: String, password: Option<String>) -> Result<ProfileView, String> {
    let name = clean_name(&name)?;
    let password = password.filter(|p| !p.is_empty()).map(|p| new_password(&p)).transpose()?;
    let _guard = REGISTRY_LOCK.lock().map_err(|e| e.to_string())?;
    let mut registry = load();
    if registry.profiles.len() >= MAX_PROFILES {
        return Err(format!("Sovereign holds up to {MAX_PROFILES} profiles."));
    }
    if registry.profiles.iter().any(|p| p.name.eq_ignore_ascii_case(&name)) {
        return Err(format!("There is already a profile called {name}."));
    }
    let id = format!("p{}", &password::to_hex(&random_bytes::<6>()?));
    let profile = Profile { id, name, color: clean_color(&color), created_at: now_secs(), password };
    let shown = view(&profile);
    registry.profiles.push(profile);
    save(&registry)?;
    Ok(shown)
}

#[tauri::command]
pub fn profile_update(id: String, name: String, color: String) -> Result<ProfileView, String> {
    let name = clean_name(&name)?;
    let _guard = REGISTRY_LOCK.lock().map_err(|e| e.to_string())?;
    let mut registry = load();
    if registry.profiles.iter().any(|p| p.id != id && p.name.eq_ignore_ascii_case(&name)) {
        return Err(format!("There is already a profile called {name}."));
    }
    let profile = registry.profiles.iter_mut().find(|p| p.id == id).ok_or("No such profile.")?;
    profile.name = name;
    profile.color = clean_color(&color);
    let shown = view(profile);
    save(&registry)?;
    Ok(shown)
}

/// Set, change (`current` required) or remove (`next` empty) a profile's password.
#[tauri::command]
pub fn profile_set_password(id: String, current: Option<String>, next: Option<String>) -> Result<bool, String> {
    let next = next.filter(|p| !p.is_empty()).map(|p| new_password(&p)).transpose()?;
    let _guard = REGISTRY_LOCK.lock().map_err(|e| e.to_string())?;
    let mut registry = load();
    let profile = registry.profiles.iter_mut().find(|p| p.id == id).ok_or("No such profile.")?;
    if !password_ok(&profile.password, current.as_deref()) {
        return Err("The current password isn't right.".into());
    }
    profile.password = next;
    save(&registry)?;
    Ok(true)
}

/// Deletes a profile and its Sovereign data. Its Documents folder stays (the path is returned).
#[tauri::command]
pub fn profile_remove(id: String, password: Option<String>) -> Result<String, String> {
    if id == MAIN || id == active() {
        return Err("The main profile and the one in use can't be removed.".into());
    }
    let _guard = REGISTRY_LOCK.lock().map_err(|e| e.to_string())?;
    let mut registry = load();
    let index = registry.profiles.iter().position(|p| p.id == id).ok_or("No such profile.")?;
    if !password_ok(&registry.profiles[index].password, password.as_deref()) {
        return Err("That password isn't right.".into());
    }
    registry.profiles.remove(index);
    if registry.last_used.as_deref() == Some(id.as_str()) {
        registry.last_used = Some(MAIN.into());
    }
    save(&registry)?;
    if let Some(dir) = webview_dir(&id) {
        let _ = fs::remove_dir_all(dir);
    }
    let _ = fs::remove_dir_all(profile_data_dir(&id));
    Ok(crate::get_documents_dir_for_main().join("Profiles").join(&id).to_string_lossy().into_owned())
}

/// Checks the password, then opens the profile: here when this process already holds
/// its data, otherwise by restarting into it.
#[tauri::command]
pub fn profile_enter(app: AppHandle, id: String, password: Option<String>) -> Result<Entered, String> {
    let registry = {
        let _guard = REGISTRY_LOCK.lock().map_err(|e| e.to_string())?;
        let mut registry = load();
        let profile = registry.profiles.iter().find(|p| p.id == id).ok_or("No such profile.")?;
        if !password_ok(&profile.password, password.as_deref()) {
            return Err("That password isn't right.".into());
        }
        registry.last_used = Some(id.clone());
        save(&registry)?;
        registry
    };
    if id == active() {
        return Ok(Entered { relaunching: false });
    }
    let protected = registry.profiles.iter().any(|p| p.id == id && p.password.is_some());
    let ticket = if protected { Some(issue_ticket(&id)?) } else { None };
    let mut args = vec!["--profile", id.as_str()];
    if let Some(ticket) = ticket.as_deref() {
        args.extend(["--ticket", ticket]);
    }
    relaunch(&app, &args)?;
    Ok(Entered { relaunching: true })
}

/// "Switch profile": restart to the picker (which runs in the main profile's process).
#[tauri::command]
pub fn profile_switch(app: AppHandle) -> Result<(), String> {
    relaunch(&app, &["--choose"])
}

// ── Start with Windows ─────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Autostart {
    enabled: bool,
    /// The command Windows runs at sign-in, when enabled.
    command: Option<String>,
    /// Whether that command starts this copy of the app.
    this_app: bool,
}

fn autostart_command() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!("\"{}\" --autostart", exe.display()))
}

#[cfg(windows)]
mod run_key {
    use windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND;
    use windows_sys::Win32::System::Registry::{HKEY_CURRENT_USER, REG_SZ, RRF_RT_REG_SZ, RegDeleteKeyValueW, RegGetValueW, RegSetKeyValueW};

    const SUBKEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const NAME: &str = "Novaura Sovereign OS";

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn get() -> Option<String> {
        let (subkey, name) = (wide(SUBKEY), wide(NAME));
        let mut buf = vec![0u16; 2048];
        let mut bytes = (buf.len() * 2) as u32;
        let status = unsafe {
            RegGetValueW(HKEY_CURRENT_USER, subkey.as_ptr(), name.as_ptr(), RRF_RT_REG_SZ, std::ptr::null_mut(), buf.as_mut_ptr().cast(), &mut bytes)
        };
        if status != 0 {
            return None;
        }
        let len = (bytes as usize / 2).saturating_sub(1);
        Some(String::from_utf16_lossy(&buf[..len]))
    }

    pub fn set(command: &str) -> Result<(), String> {
        let (subkey, name, data) = (wide(SUBKEY), wide(NAME), wide(command));
        let status = unsafe {
            RegSetKeyValueW(HKEY_CURRENT_USER, subkey.as_ptr(), name.as_ptr(), REG_SZ, data.as_ptr().cast(), (data.len() * 2) as u32)
        };
        if status == 0 { Ok(()) } else { Err(format!("Windows refused the startup entry (error {status}).")) }
    }

    pub fn delete() -> Result<(), String> {
        let (subkey, name) = (wide(SUBKEY), wide(NAME));
        let status = unsafe { RegDeleteKeyValueW(HKEY_CURRENT_USER, subkey.as_ptr(), name.as_ptr()) };
        if status == 0 || status == ERROR_FILE_NOT_FOUND { Ok(()) } else { Err(format!("Windows refused to remove the startup entry (error {status}).")) }
    }
}

#[cfg(not(windows))]
mod run_key {
    pub fn get() -> Option<String> { None }
    pub fn set(_command: &str) -> Result<(), String> { Err("Starting with the system is only built for Windows.".into()) }
    pub fn delete() -> Result<(), String> { Ok(()) }
}

#[tauri::command]
pub fn autostart_get() -> Autostart {
    let command = run_key::get();
    let this_app = match (&command, autostart_command()) {
        (Some(current), Ok(ours)) => current.eq_ignore_ascii_case(&ours),
        _ => false,
    };
    Autostart { enabled: command.is_some(), command, this_app }
}

/// Start (or stop starting) this copy of Sovereign when the user signs in to Windows.
#[tauri::command]
pub fn autostart_set(enabled: bool) -> Result<Autostart, String> {
    if enabled { run_key::set(&autostart_command()?)? } else { run_key::delete()? }
    Ok(autostart_get())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_main_or_generated() {
        assert!(valid_id("main"));
        assert!(valid_id("p0123456789ab"));
        assert!(!valid_id("p0123456789AB"));
        assert!(!valid_id("../main"));
        assert!(!valid_id("p0123"));
    }

    #[test]
    fn names_and_colors_are_cleaned() {
        assert_eq!(clean_name("  Dillan ").unwrap(), "Dillan");
        assert!(clean_name("").is_err());
        assert!(clean_name("a\nb").is_err());
        assert_eq!(clean_color("#A78BFA"), "#a78bfa");
        assert_eq!(clean_color("red"), DEFAULT_COLOR);
    }

    #[test]
    fn passwords_check_out() {
        let record = Some(new_password("open sesame").unwrap());
        assert!(password_ok(&record, Some("open sesame")));
        assert!(!password_ok(&record, Some("open sesame!")));
        assert!(!password_ok(&record, None));
        assert!(password_ok(&None, None));
        assert!(new_password("abc").is_err());
    }
}
