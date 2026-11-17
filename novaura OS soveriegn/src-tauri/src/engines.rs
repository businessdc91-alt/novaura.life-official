//! Local AI engines: one-click ComfyUI install, process control and model downloads.
//!
//! Everything that spawns a process takes validated input only:
//! - install directories must be plain absolute paths (no shell metacharacters),
//! - the PyTorch backend comes from a fixed list,
//! - downloads are limited to Hugging Face and GitHub, and land inside the install
//!   directory's model folders with an allowed file extension.
//! Access tokens are passed to curl on stdin, never on the command line.

use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use serde::Serialize;

const INSTALL_SCRIPT: &str = include_str!("../scripts/install-comfyui.ps1");
const TORCH_VARIANTS: [&str; 4] = ["cu126", "cu128", "cpu", "directml"];
const MODEL_FOLDERS: [&str; 12] = [
    "checkpoints", "diffusion_models", "text_encoders", "clip", "vae", "loras",
    "upscale_models", "audio_encoders", "controlnet", "embeddings", "unet", "clip_vision",
];
const MODEL_EXTENSIONS: [&str; 9] = ["safetensors", "ckpt", "pt", "pth", "bin", "gguf", "onnx", "json", "yaml"];
const DOWNLOAD_HOSTS: [&str; 3] = ["https://huggingface.co/", "https://github.com/", "https://objects.githubusercontent.com/"];
/// ComfyUI only accepts cross-origin requests from Sovereign itself.
const APP_ORIGIN: &str = "http://tauri.localhost";

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub(crate) fn hide_window(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

struct Download {
    child: Child,
    part: PathBuf,
    target: PathBuf,
}

#[derive(Default)]
struct State {
    installs: HashMap<String, Child>,
    downloads: HashMap<String, Download>,
    /// The install whose engine is stopped when Sovereign exits (see `shutdown`).
    stop_on_exit: Option<PathBuf>,
}

fn state() -> &'static Mutex<State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(State::default()))
}

/// An absolute Windows path such as `E:\NovauraAI\ComfyUI`, with no characters a
/// shell could interpret.
pub(crate) fn validate_install_dir(dir: &str) -> Result<PathBuf, String> {
    let d = dir.trim();
    let bytes = d.as_bytes();
    let drive_ok = bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && (bytes[2] == b'\\' || bytes[2] == b'/');
    if !drive_ok || d.len() > 180 {
        return Err("Choose an absolute folder such as E:\\NovauraAI".into());
    }
    if d.split(['\\', '/']).any(|seg| seg == "..") {
        return Err("The folder may not contain '..'".into());
    }
    if !d.chars().all(|c| c.is_ascii_alphanumeric() || " _-.:\\/()".contains(c)) {
        return Err("Use only letters, numbers, spaces and - _ . ( ) in the folder path".into());
    }
    Ok(PathBuf::from(d))
}

pub(crate) fn tail(path: &Path, max: usize) -> String {
    let text = fs::read(path).map(|b| String::from_utf8_lossy(&b).into_owned()).unwrap_or_default();
    let start = text.len().saturating_sub(max);
    let mut s = start;
    while s < text.len() && !text.is_char_boundary(s) {
        s += 1;
    }
    text[s..].to_string()
}

// ── Install ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct InstallStatus {
    running: bool,
    exit_code: Option<i32>,
    status: Option<serde_json::Value>,
    log_tail: String,
    installed: bool,
    engine: Option<serde_json::Value>,
}

#[tauri::command]
pub fn engine_install_comfyui(install_dir: String, torch_variant: String) -> Result<(), String> {
    let dir = validate_install_dir(&install_dir)?;
    if !TORCH_VARIANTS.contains(&torch_variant.as_str()) {
        return Err("Unknown PyTorch backend".into());
    }
    let key = dir.to_string_lossy().to_lowercase();
    let mut st = state().lock().map_err(|_| "Engine state unavailable")?;
    if let Some(child) = st.installs.get_mut(&key) {
        if matches!(child.try_wait(), Ok(None)) {
            return Err("An install is already running for this folder".into());
        }
    }
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
    let script = dir.join("novaura-install.ps1");
    fs::write(&script, INSTALL_SCRIPT).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(dir.join("novaura-install.status.json"));
    let log = fs::File::create(dir.join("novaura-install.log")).map_err(|e| e.to_string())?;
    let log_err = log.try_clone().map_err(|e| e.to_string())?;

    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(&script)
        .arg("-InstallDir")
        .arg(&dir)
        .arg("-TorchVariant")
        .arg(&torch_variant)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err));
    let child = hide_window(&mut cmd).spawn().map_err(|e| format!("Could not start the installer: {e}"))?;
    st.installs.insert(key, child);
    Ok(())
}

#[tauri::command]
pub fn engine_install_status(install_dir: String) -> Result<InstallStatus, String> {
    let dir = validate_install_dir(&install_dir)?;
    let key = dir.to_string_lossy().to_lowercase();
    let mut st = state().lock().map_err(|_| "Engine state unavailable")?;
    let (running, exit_code) = match st.installs.get_mut(&key) {
        Some(child) => match child.try_wait() {
            Ok(None) => (true, None),
            Ok(Some(status)) => (false, status.code()),
            Err(_) => (false, None),
        },
        None => (false, None),
    };
    let read_json = |name: &str| fs::read_to_string(dir.join(name)).ok().and_then(|s| serde_json::from_str(s.trim_start_matches('\u{feff}')).ok());
    Ok(InstallStatus {
        running,
        exit_code,
        status: read_json("novaura-install.status.json"),
        log_tail: tail(&dir.join("novaura-install.log"), 4000),
        installed: dir.join("venv").join("Scripts").join("python.exe").exists() && dir.join("ComfyUI").join("main.py").exists(),
        engine: read_json("novaura-engine.json"),
    })
}

// ── Run ──────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ComfyStatus {
    pid: Option<u32>,
    alive: bool,
    log_tail: String,
}

fn pid_alive(pid: u32) -> bool {
    let mut cmd = Command::new("tasklist");
    cmd.args(["/FI", &format!("PID eq {pid}"), "/NH", "/FO", "CSV"]);
    hide_window(&mut cmd)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase().contains("python"))
        .unwrap_or(false)
}

fn read_pid(dir: &Path) -> Option<u32> {
    fs::read_to_string(dir.join("comfyui.pid")).ok()?.trim().parse().ok()
}

#[tauri::command]
pub fn engine_comfy_start(install_dir: String, extra: Option<Vec<String>>) -> Result<u32, String> {
    let dir = validate_install_dir(&install_dir)?;
    if let Some(pid) = read_pid(&dir) {
        if pid_alive(pid) {
            return Ok(pid);
        }
    }
    let python = dir.join("venv").join("Scripts").join("python.exe");
    let main = dir.join("ComfyUI").join("main.py");
    if !python.exists() || !main.exists() {
        return Err("ComfyUI is not installed in this folder yet".into());
    }
    let mut args: Vec<String> = vec![
        main.to_string_lossy().into_owned(),
        "--listen".into(), "127.0.0.1".into(),
        "--port".into(), "8188".into(),
        "--enable-cors-header".into(), APP_ORIGIN.into(),
    ];
    // Only known-safe switches may be added from the app.
    const ALLOWED: [&str; 8] = ["--cpu", "--directml", "--lowvram", "--normalvram", "--highvram", "--force-fp32", "--disable-smart-memory", "--disable-dynamic-vram"];
    for flag in extra.unwrap_or_default() {
        if ALLOWED.contains(&flag.as_str()) {
            args.push(flag);
        }
    }
    let log = fs::File::create(dir.join("comfyui.log")).map_err(|e| e.to_string())?;
    let log_err = log.try_clone().map_err(|e| e.to_string())?;
    let mut cmd = Command::new(&python);
    cmd.args(&args)
        .current_dir(dir.join("ComfyUI"))
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err));
    let child = hide_window(&mut cmd).spawn().map_err(|e| format!("Could not start ComfyUI: {e}"))?;
    let pid = child.id();
    fs::write(dir.join("comfyui.pid"), pid.to_string()).map_err(|e| e.to_string())?;
    // The process keeps running if Sovereign closes; the pid file lets us stop it later.
    std::mem::forget(child);
    Ok(pid)
}

fn stop_engine(dir: &Path) -> bool {
    let Some(pid) = read_pid(dir) else { return false };
    let ok = pid_alive(pid) && {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/PID", &pid.to_string(), "/T", "/F"]);
        hide_window(&mut cmd).status().map(|s| s.success()).unwrap_or(false)
    };
    let _ = fs::remove_file(dir.join("comfyui.pid"));
    ok
}

#[tauri::command]
pub fn engine_comfy_stop(install_dir: String) -> Result<bool, String> {
    let dir = validate_install_dir(&install_dir)?;
    Ok(stop_engine(&dir))
}

/// Whether the engine in this install stops when Sovereign exits.
#[tauri::command]
pub fn engine_comfy_stop_on_exit(install_dir: String, enabled: bool) -> Result<(), String> {
    let dir = validate_install_dir(&install_dir)?;
    let mut st = state().lock().map_err(|_| "Engine state unavailable")?;
    st.stop_on_exit = enabled.then_some(dir);
    Ok(())
}

/// Runs as Sovereign exits. Downloads are cancelled (they resume from their
/// .part files next time; left running, a second curl would write the same
/// file), and the engine is stopped if the user chose that.
pub fn shutdown() {
    let Ok(mut st) = state().lock() else { return };
    for (_, mut d) in st.downloads.drain() {
        let _ = d.child.kill();
    }
    if let Some(dir) = st.stop_on_exit.take() {
        stop_engine(&dir);
    }
}

#[tauri::command]
pub fn engine_comfy_status(install_dir: String) -> Result<ComfyStatus, String> {
    let dir = validate_install_dir(&install_dir)?;
    let pid = read_pid(&dir);
    Ok(ComfyStatus {
        alive: pid.map(pid_alive).unwrap_or(false),
        pid,
        log_tail: tail(&dir.join("comfyui.log"), 4000),
    })
}

// ── Models ───────────────────────────────────────────────────────────────────

/// `models/<folder>/<file>` inside the install's ComfyUI folder.
fn model_target(dir: &Path, rel: &str) -> Result<PathBuf, String> {
    let parts: Vec<&str> = rel.split('/').collect();
    let ok = parts.len() == 3
        && parts[0] == "models"
        && MODEL_FOLDERS.contains(&parts[1])
        && !parts[2].is_empty()
        && parts[2].len() <= 160
        && parts[2].chars().all(|c| c.is_ascii_alphanumeric() || "._-+".contains(c))
        && !parts[2].starts_with('.')
        && MODEL_EXTENSIONS.iter().any(|ext| parts[2].to_lowercase().ends_with(&format!(".{ext}")));
    if !ok {
        return Err(format!("Not an allowed model path: {rel}"));
    }
    Ok(dir.join("ComfyUI").join("models").join(parts[1]).join(parts[2]))
}

/// curl 7.71+ can retry after any failure (a lost connection included); the
/// curl in older Windows 10 builds rejects the flag, so it is only added when supported.
pub(crate) fn curl_retries_all_errors() -> bool {
    static SUPPORTED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *SUPPORTED.get_or_init(|| {
        let mut cmd = Command::new("curl.exe");
        cmd.arg("--version").stdout(Stdio::piped()).stderr(Stdio::null());
        let Ok(out) = hide_window(&mut cmd).output() else { return false };
        let text = String::from_utf8_lossy(&out.stdout);
        let version = text.split_whitespace().nth(1).unwrap_or("");
        let mut nums = version.split('.').map(|n| n.parse::<u32>().unwrap_or(0));
        let (major, minor) = (nums.next().unwrap_or(0), nums.next().unwrap_or(0));
        (major, minor) >= (7, 71)
    })
}

#[derive(Serialize)]
pub struct DownloadStatus {
    running: bool,
    bytes: u64,
    done: bool,
    error: Option<String>,
}

#[tauri::command]
pub fn engine_download_model(
    id: String,
    install_dir: String,
    url: String,
    rel_path: String,
    token: Option<String>,
) -> Result<bool, String> {
    let dir = validate_install_dir(&install_dir)?;
    if !DOWNLOAD_HOSTS.iter().any(|h| url.starts_with(h)) || url.contains(char::is_whitespace) || url.contains('"') {
        return Err("Downloads are limited to Hugging Face and GitHub".into());
    }
    if id.is_empty() || id.len() > 80 || !id.chars().all(|c| c.is_ascii_alphanumeric() || "_-".contains(c)) {
        return Err("Invalid download id".into());
    }
    let target = model_target(&dir, &rel_path)?;
    if target.exists() {
        return Ok(true); // already downloaded
    }
    fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
    let part = target.with_extension(format!("{}.part", target.extension().and_then(|e| e.to_str()).unwrap_or("bin")));

    let mut st = state().lock().map_err(|_| "Engine state unavailable")?;
    if let Some(d) = st.downloads.get_mut(&id) {
        if matches!(d.child.try_wait(), Ok(None)) {
            return Ok(false);
        }
    }
    let mut cmd = Command::new("curl.exe");
    // Resume (-C -) after drops; a transfer stuck under 1 KB/s for a minute counts as dropped.
    cmd.args(["-L", "--fail", "--proto", "=https", "--proto-redir", "=https", "--retry", "20", "--retry-delay", "10", "--speed-limit", "1024", "--speed-time", "60", "-C", "-"]);
    if curl_retries_all_errors() {
        cmd.arg("--retry-all-errors");
    }
    cmd.args(["--silent", "--show-error", "-K", "-", "-o"])
        .arg(&part)
        .arg(&url)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    let mut child = hide_window(&mut cmd).spawn().map_err(|e| format!("Could not start the download: {e}"))?;
    // Config on stdin keeps any token out of the process list.
    if let Some(mut stdin) = child.stdin.take() {
        let token = token.unwrap_or_default();
        let clean: String = token.chars().filter(|c| c.is_ascii_alphanumeric() || "_-".contains(*c)).collect();
        let config = if clean.is_empty() { String::new() } else { format!("header = \"Authorization: Bearer {clean}\"\n") };
        let _ = stdin.write_all(config.as_bytes());
    }
    st.downloads.insert(id, Download { child, part, target });
    Ok(false)
}

#[tauri::command]
pub fn engine_download_status(id: String) -> Result<DownloadStatus, String> {
    let mut st = state().lock().map_err(|_| "Engine state unavailable")?;
    let Some(d) = st.downloads.get_mut(&id) else {
        return Ok(DownloadStatus { running: false, bytes: 0, done: false, error: Some("No such download".into()) });
    };
    let bytes = fs::metadata(&d.part).map(|m| m.len()).or_else(|_| fs::metadata(&d.target).map(|m| m.len())).unwrap_or(0);
    match d.child.try_wait() {
        Ok(None) => Ok(DownloadStatus { running: true, bytes, done: false, error: None }),
        Ok(Some(status)) if status.success() => {
            if d.part.exists() {
                fs::rename(&d.part, &d.target).map_err(|e| e.to_string())?;
            }
            Ok(DownloadStatus { running: false, bytes, done: true, error: None })
        }
        Ok(Some(status)) => {
            let mut err = String::new();
            if let Some(mut stderr) = d.child.stderr.take() {
                use std::io::Read;
                let _ = stderr.read_to_string(&mut err);
            }
            let msg = if err.contains("401") || err.contains("403") {
                "Access denied. This model may need you to accept its license on Hugging Face and add a Hugging Face token in Settings.".to_string()
            } else {
                format!("Download failed (curl exit {}): {}", status.code().unwrap_or(-1), err.trim())
            };
            Ok(DownloadStatus { running: false, bytes, done: false, error: Some(msg) })
        }
        Err(e) => Ok(DownloadStatus { running: false, bytes, done: false, error: Some(e.to_string()) }),
    }
}

#[tauri::command]
pub fn engine_download_cancel(id: String) -> Result<(), String> {
    let mut st = state().lock().map_err(|_| "Engine state unavailable")?;
    if let Some(mut d) = st.downloads.remove(&id) {
        let _ = d.child.kill();
    }
    Ok(())
}

#[derive(Serialize)]
pub struct InstalledModel {
    folder: String,
    file: String,
    bytes: u64,
}

#[tauri::command]
pub fn engine_list_models(install_dir: String) -> Result<Vec<InstalledModel>, String> {
    let dir = validate_install_dir(&install_dir)?;
    let mut out = Vec::new();
    for folder in MODEL_FOLDERS {
        let Ok(entries) = fs::read_dir(dir.join("ComfyUI").join("models").join(folder)) else { continue };
        for e in entries.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.ends_with(".part") || name.starts_with("put_") {
                continue;
            }
            if let Ok(meta) = e.metadata() {
                if meta.is_file() {
                    out.push(InstalledModel { folder: folder.to_string(), file: name, bytes: meta.len() });
                }
            }
        }
    }
    Ok(out)
}

// ── Hardware ─────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct EngineHardware {
    gpus: Vec<String>,
    nvidia: Option<NvidiaGpu>,
    drives: Vec<DriveSpace>,
}

#[derive(Serialize)]
pub struct NvidiaGpu {
    name: String,
    driver: String,
    vram_mb: u64,
    compute_cap: String,
}

#[derive(Serialize)]
pub struct DriveSpace {
    letter: String,
    free_gb: u64,
    total_gb: u64,
}

#[tauri::command]
pub fn engine_hardware() -> Result<EngineHardware, String> {
    let mut nvidia = None;
    let mut smi = Command::new("nvidia-smi");
    smi.args(["--query-gpu=name,driver_version,memory.total,compute_cap", "--format=csv,noheader,nounits"]);
    if let Ok(out) = hide_window(&mut smi).output() {
        let text = String::from_utf8_lossy(&out.stdout);
        if let Some(line) = text.lines().next() {
            let f: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
            if f.len() >= 4 {
                nvidia = Some(NvidiaGpu {
                    name: f[0].to_string(),
                    driver: f[1].to_string(),
                    vram_mb: f[2].parse().unwrap_or(0),
                    compute_cap: f[3].to_string(),
                });
            }
        }
    }
    let mut ps = Command::new("powershell");
    ps.args([
        "-NoProfile", "-Command",
        "$g = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }); \
         $d = @(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | ForEach-Object { @{ letter = $_.Name; free_gb = [math]::Floor($_.Free / 1GB); total_gb = [math]::Floor(($_.Free + $_.Used) / 1GB) } }); \
         @{ gpus = $g; drives = $d } | ConvertTo-Json -Compress -Depth 4",
    ]);
    let out = hide_window(&mut ps).output().map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap_or(serde_json::json!({}));
    let gpus = v["gpus"].as_array().map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
    let drives = v["drives"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|d| Some(DriveSpace {
                    letter: d["letter"].as_str()?.to_string(),
                    free_gb: d["free_gb"].as_u64().unwrap_or(0),
                    total_gb: d["total_gb"].as_u64().unwrap_or(0),
                }))
                .collect()
        })
        .unwrap_or_default();
    Ok(EngineHardware { gpus, nvidia, drives })
}

#[derive(Serialize, serde::Deserialize)]
pub struct GpuProcessMemory {
    pid: u32,
    adapter: String,
    bytes: u64,
    path: Option<String>,
}

/// Dedicated graphics memory per process and graphics card, as Task Manager
/// shows it (the WMI class names are the same in every Windows language). The
/// image and music engine uses it to tell how much of each chat runtime sits on
/// its own card before unloading anything. Empty when Windows doesn't say.
#[tauri::command]
pub fn engine_gpu_process_memory() -> Result<Vec<GpuProcessMemory>, String> {
    let mut ps = Command::new("powershell");
    ps.args([
        "-NoProfile", "-Command",
        "$rows = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUProcessMemory -ErrorAction SilentlyContinue | \
           Where-Object { $_.DedicatedUsage -gt 32MB } | ForEach-Object { \
             if ($_.Name -match '^pid_(\\d+)_luid_(0x[0-9A-Fa-f]+_0x[0-9A-Fa-f]+)') { \
               $p = [int]$Matches[1]; \
               [pscustomobject]@{ pid = $p; adapter = $Matches[2].ToLower(); bytes = [int64]$_.DedicatedUsage; path = (Get-Process -Id $p -ErrorAction SilentlyContinue).Path } } }); \
         ConvertTo-Json -InputObject $rows -Compress -Depth 3",
    ]);
    let out = hide_window(&mut ps).output().map_err(|e| e.to_string())?;
    Ok(serde_json::from_slice(&out.stdout).unwrap_or_default())
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct LiveGpuTelemetry {
    pub name: String,
    pub temp_c: Option<f32>,
    pub load_pct: Option<f32>,
    pub vram_used_mb: Option<u64>,
    pub vram_total_mb: Option<u64>,
    pub power_w: Option<f32>,
}

#[derive(Serialize, Debug, Clone)]
pub struct LiveHardwareTelemetry {
    pub gpu: Option<LiveGpuTelemetry>,
    pub ram_total_mb: Option<u64>,
    pub ram_free_mb: Option<u64>,
    pub cpu_load_pct: Option<f32>,
}

fn parse_optional_f32(raw: &str) -> Option<f32> {
    let s = raw.trim();
    if s.is_empty() || s.eq_ignore_ascii_case("[n/a]") || s.eq_ignore_ascii_case("n/a") {
        return None;
    }
    s.parse::<f32>().ok().filter(|v| v.is_finite())
}

fn parse_optional_u64(raw: &str) -> Option<u64> {
    let s = raw.trim();
    if s.is_empty() || s.eq_ignore_ascii_case("[n/a]") || s.eq_ignore_ascii_case("n/a") {
        return None;
    }
    s.parse::<u64>().ok()
}

pub fn parse_nvidia_telemetry(text: &str) -> Option<LiveGpuTelemetry> {
    let line = text.lines().find(|l| !l.trim().is_empty())?;
    let f: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
    if f.len() < 6 {
        return None;
    }
    Some(LiveGpuTelemetry {
        name: f[0].to_string(),
        temp_c: parse_optional_f32(f[1]),
        load_pct: parse_optional_f32(f[2]),
        vram_used_mb: parse_optional_u64(f[3]),
        vram_total_mb: parse_optional_u64(f[4]),
        power_w: parse_optional_f32(f[5]),
    })
}

/// Fast non-destructive hardware interoception probe (GPU thermal/load/VRAM + host RAM/CPU load).
#[tauri::command]
pub fn engine_live_telemetry() -> Result<LiveHardwareTelemetry, String> {
    let mut gpu = None;
    let mut smi = Command::new("nvidia-smi");
    smi.args([
        "--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw",
        "--format=csv,noheader,nounits",
    ]);
    if let Ok(out) = hide_window(&mut smi).output() {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            gpu = parse_nvidia_telemetry(&text);
        }
    }

    let mut ram_total_mb = None;
    let mut ram_free_mb = None;
    let mut cpu_load_pct = None;
    let mut ps = Command::new("powershell");
    ps.args([
        "-NoProfile",
        "-Command",
        "$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue; \
         $cpu = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average; \
         @{ ram_total_mb = if ($os) { [math]::Floor($os.TotalVisibleMemorySize / 1024) } else { $null }; \
            ram_free_mb = if ($os) { [math]::Floor($os.FreePhysicalMemory / 1024) } else { $null }; \
            cpu_load_pct = $cpu } | ConvertTo-Json -Compress",
    ]);
    if let Ok(out) = hide_window(&mut ps).output() {
        if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
            ram_total_mb = v["ram_total_mb"].as_u64();
            ram_free_mb = v["ram_free_mb"].as_u64();
            cpu_load_pct = v["cpu_load_pct"].as_f64().map(|x| x as f32);
        }
    }

    Ok(LiveHardwareTelemetry {
        gpu,
        ram_total_mb,
        ram_free_mb,
        cpu_load_pct,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_dir_validation() {
        assert!(validate_install_dir("E:\\NovauraAI\\ComfyUI").is_ok());
        assert!(validate_install_dir("E:/Novaura AI (models)").is_ok());
        assert!(validate_install_dir("relative\\path").is_err());
        assert!(validate_install_dir("E:\\a\\..\\Windows").is_err());
        assert!(validate_install_dir("E:\\x; rm -rf").is_err());
        assert!(validate_install_dir("E:\\$(evil)").is_err());
        assert!(validate_install_dir("E:\\a`b").is_err());
    }

    #[test]
    fn model_target_validation() {
        let dir = PathBuf::from("E:\\AI");
        assert!(model_target(&dir, "models/checkpoints/ace_step_v1_3.5b.safetensors").is_ok());
        assert!(model_target(&dir, "models/text_encoders/t5-base.safetensors").is_ok());
        assert!(model_target(&dir, "models/../../evil.safetensors").is_err());
        assert!(model_target(&dir, "models/checkpoints/evil.exe").is_err());
        assert!(model_target(&dir, "models/custom_nodes/x.safetensors").is_err());
        assert!(model_target(&dir, "models/checkpoints/a b.safetensors").is_err());
        assert!(model_target(&dir, "models/checkpoints/.hidden.safetensors").is_err());
        assert!(model_target(&dir, "checkpoints/x.safetensors").is_err());
    }

    #[test]
    fn nvidia_telemetry_parser() {
        let sample = "NVIDIA GeForce RTX 4090, 62, 48, 8420, 24564, 215.40\n";
        let parsed = parse_nvidia_telemetry(sample).expect("parsed GPU telemetry");
        assert_eq!(parsed.name, "NVIDIA GeForce RTX 4090");
        assert_eq!(parsed.temp_c, Some(62.0));
        assert_eq!(parsed.load_pct, Some(48.0));
        assert_eq!(parsed.vram_used_mb, Some(8420));
        assert_eq!(parsed.vram_total_mb, Some(24564));
        assert!((parsed.power_w.unwrap() - 215.4).abs() < 0.01);

        let na_sample = "Quadro M6000, 51, [N/A], 1200, 24576, N/A\n";
        let parsed_na = parse_nvidia_telemetry(na_sample).expect("parsed GPU with N/A fields");
        assert_eq!(parsed_na.load_pct, None);
        assert_eq!(parsed_na.power_w, None);
        assert_eq!(parse_nvidia_telemetry(""), None);
    }
}
