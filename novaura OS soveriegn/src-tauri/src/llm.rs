//! Built-in AI: llama.cpp's llama-server, run by Sovereign as a local model server.
//!
//! One click downloads a pinned llama.cpp build and a model. Models live in
//! `<install>/models/<name>/` (the weights, plus an `mmproj-…` file for models
//! that read images), and llama-server runs in router mode over that folder: it
//! lists every model there and loads whichever one a request names, one at a
//! time. Models come from the curated catalog below (hashes compiled in) or from
//! any Hugging Face repo (each file checked against the SHA-256 Hugging Face
//! publishes for it). Only https downloads from huggingface.co and the pinned
//! llama.cpp release are possible, and only .gguf files are written.
//!
//! The server listens on 127.0.0.1 only. A random API key, created at each start
//! and passed in the environment (so the per-model processes the router starts
//! require it too, and it never shows in a process list), is added to
//! Sovereign's own requests by the local-AI bridge in lib.rs (`auth_header`).
//! Other programs and websites on the machine cannot use it; the slots endpoint
//! (which shows recent prompts) and the bundled web UI are off. The server and
//! every model process stop with Sovereign.

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::engines::{curl_retries_all_errors, hide_window, tail, validate_install_dir};

/// The port the built-in server listens on (localModels.js lists it as a runtime).
pub const BUILTIN_PORT: u16 = 39281;
const LLAMA_BUILD: &str = "b11980";
/// llama-server only answers cross-origin requests from Sovereign itself.
const APP_ORIGIN: &str = "http://tauri.localhost";
/// Context size for every model. Gemma 4 handles 128K+, but the cache grows with it.
const CONTEXT: u32 = 32768;
const MAX_FILE_BYTES: u64 = 400 * 1024 * 1024 * 1024;

#[derive(Clone)]
struct FileSpec {
    url: String,
    file: String,
    sha256: String,
    bytes: u64,
}

#[derive(Clone, Copy)]
struct Artifact {
    url: &'static str,
    file: &'static str,
    sha256: &'static str,
    bytes: u64,
}

impl Artifact {
    fn spec(&self) -> FileSpec {
        FileSpec { url: self.url.into(), file: self.file.into(), sha256: self.sha256.into(), bytes: self.bytes }
    }
}

/// llama.cpp's official Windows build with the Vulkan backend (NVIDIA, AMD and
/// Intel GPUs) and CPU backends for every x64 processor family.
const RUNTIME: Artifact = Artifact {
    url: "https://github.com/ggml-org/llama.cpp/releases/download/b11980/llama-b11980-bin-win-vulkan-x64.zip",
    file: "llama-b11980-bin-win-vulkan-x64.zip",
    sha256: "9b3acb66bbdc317a77e8334b3d37bd3edb7c81d0bfc094d0a36a4e83e3733187",
    bytes: 37_347_228,
};

struct ModelSpec {
    id: &'static str,
    label: &'static str,
    weights: Artifact,
    /// The vision projector: lets the model read images.
    vision: Artifact,
    min_ram_gb: u32,
    blurb: &'static str,
}

// Google's official GGUFs from ggml-org (Apache 2.0, not gated). Hashes are the
// files' Git LFS object ids on Hugging Face, which are their SHA-256.
const MODELS: [ModelSpec; 4] = [
    ModelSpec {
        id: "gemma-4-e4b",
        label: "Gemma 4 E4B",
        weights: Artifact {
            url: "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_0.gguf",
            file: "gemma-4-E4B-it-Q4_0.gguf",
            sha256: "a555b900214b477d8880e7832e0b8925e139b0159640036b09fe472b6f2097f2",
            bytes: 4_590_807_392,
        },
        vision: Artifact {
            url: "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/mmproj-gemma-4-E4B-it-Q8_0.gguf",
            file: "mmproj-gemma-4-E4B-it-Q8_0.gguf",
            sha256: "197f49a93027f9843772bd24a6a9e0be2a32a788de5a3def330e9c585d86edd1",
            bytes: 559_874_816,
        },
        min_ram_gb: 8,
        blurb: "Recommended. Fast on most PCs, good at writing, chat and code, and can read images.",
    },
    ModelSpec {
        id: "gemma-4-e2b",
        label: "Gemma 4 E2B",
        weights: Artifact {
            url: "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_0.gguf",
            file: "gemma-4-E2B-it-Q4_0.gguf",
            sha256: "8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52",
            bytes: 2_841_481_184,
        },
        vision: Artifact {
            url: "https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/main/mmproj-gemma-4-E2B-it-Q8_0.gguf",
            file: "mmproj-gemma-4-E2B-it-Q8_0.gguf",
            sha256: "9406f99c16d68cda4f1f0552192dcc99021ea1fc6d2fd50b1dc3ccf30d04b292",
            bytes: 557_368_064,
        },
        min_ram_gb: 6,
        blurb: "For older or low-memory PCs. Smaller and quicker, less capable.",
    },
    ModelSpec {
        id: "gemma-4-12b",
        label: "Gemma 4 12B",
        weights: Artifact {
            url: "https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/gemma-4-12B-it-Q4_0.gguf",
            file: "gemma-4-12B-it-Q4_0.gguf",
            sha256: "3712b9bd32cae83a22f67ee7a4466d8d7a4f21646ac8a07d19bf9418e8767a70",
            bytes: 7_219_673_216,
        },
        vision: Artifact {
            url: "https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/mmproj-gemma-4-12B-it-Q8_0.gguf",
            file: "mmproj-gemma-4-12B-it-Q8_0.gguf",
            sha256: "6b1088334bda27d7f293dcf426c0efaf1f1f20b65415ea354b695dbed9a0d65d",
            bytes: 158_987_648,
        },
        min_ram_gb: 16,
        blurb: "Much stronger at reasoning and code. Wants a GPU with 10 GB or more.",
    },
    ModelSpec {
        id: "gemma-4-26b-a4b",
        label: "Gemma 4 26B A4B",
        weights: Artifact {
            url: "https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF/resolve/main/gemma-4-26B-A4B-it-Q4_0.gguf",
            file: "gemma-4-26B-A4B-it-Q4_0.gguf",
            sha256: "d208665ab1cd3a69f7a9a4bc59430e8448c8093d9b06334f566ac59d6d504a03",
            bytes: 14_618_145_824,
        },
        vision: Artifact {
            url: "https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF/resolve/main/mmproj-gemma-4-26B-A4B-it-Q8_0.gguf",
            file: "mmproj-gemma-4-26B-A4B-it-Q8_0.gguf",
            sha256: "cc4e855736da450bf1e162d8cccfe0ad685727d0c9e04ef7dd8d884f3121039b",
            bytes: 806_408_320,
        },
        min_ram_gb: 24,
        blurb: "Mixture of experts: 26B parameters, about 4B active per token. Near-12B speed, close to 31B quality; needs lots of memory.",
    },
];

fn catalog_model(id: &str) -> Result<&'static ModelSpec, String> {
    MODELS.iter().find(|m| m.id == id).ok_or_else(|| format!("Unknown model: {id}"))
}

// ── State ────────────────────────────────────────────────────────────────────

#[derive(Clone, Default, Serialize)]
pub struct InstallProgress {
    running: bool,
    model_id: String,
    stage: String,
    bytes: u64,
    total: u64,
    done: bool,
    error: Option<String>,
}

struct Server {
    child: Child,
    key: String,
}

#[derive(Default)]
struct State {
    progress: InstallProgress,
    cancel: bool,
    curl: Option<Child>,
    server: Option<Server>,
}

fn state() -> &'static Mutex<State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(State::default()))
}

fn set_progress(f: impl FnOnce(&mut InstallProgress)) {
    if let Ok(mut st) = state().lock() {
        f(&mut st.progress);
    }
}

fn cancelled() -> bool {
    state().lock().map(|st| st.cancel).unwrap_or(true)
}

// ── Names and paths ──────────────────────────────────────────────────────────

fn runtime_dir(dir: &Path) -> PathBuf {
    dir.join("runtime").join(LLAMA_BUILD)
}

fn server_exe(dir: &Path) -> PathBuf {
    runtime_dir(dir).join("llama-server.exe")
}

fn models_dir(dir: &Path) -> PathBuf {
    dir.join("models")
}

/// A model folder name: what the router calls the model.
fn valid_model_name(name: &str) -> bool {
    (1..=80).contains(&name.len())
        && !name.starts_with('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
}

fn valid_repo(repo: &str) -> bool {
    let mut parts = repo.split('/');
    let (Some(owner), Some(name), None) = (parts.next(), parts.next(), parts.next()) else { return false };
    [owner, name].iter().all(|p| {
        (1..=96).contains(&p.len())
            && p.chars().next().map(|c| c.is_ascii_alphanumeric()).unwrap_or(false)
            && p.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
    })
}

/// A .gguf path inside a repo ("model.gguf", "Q4_K_M/model-00001-of-00002.gguf").
fn valid_repo_path(path: &str) -> bool {
    path.len() <= 200
        && path.to_lowercase().ends_with(".gguf")
        && path.split('/').all(|seg| !seg.is_empty() && seg != "." && seg != ".." && !seg.starts_with('.') && seg.chars().all(|c| c.is_ascii_alphanumeric() || "._-+".contains(c)))
}

fn valid_sha256(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}

fn part_path(target: &Path) -> PathBuf {
    target.with_extension(format!("{}.part", target.extension().and_then(|e| e.to_str()).unwrap_or("bin")))
}

/// A file counts as installed once it has been hashed and matched; the marker
/// records that so status checks never re-read gigabytes.
fn marker(path: &Path) -> PathBuf {
    path.with_extension(format!("{}.sha256", path.extension().and_then(|e| e.to_str()).unwrap_or("bin")))
}

fn is_verified(path: &Path, sha256: &str, bytes: u64) -> bool {
    path.exists()
        && fs::metadata(path).map(|m| m.len() == bytes).unwrap_or(false)
        && fs::read_to_string(marker(path)).map(|s| s.trim() == sha256).unwrap_or(false)
}

// ── Downloads ────────────────────────────────────────────────────────────────

fn sha256_file(path: &Path, on_progress: impl Fn(u64)) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 4 * 1024 * 1024];
    let mut done = 0u64;
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        done += n as u64;
        on_progress(done);
        if cancelled() {
            return Err("Cancelled".into());
        }
    }
    Ok(hasher.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Download one file to `target` (resuming a partial file), then verify it.
fn fetch(spec: &FileSpec, target: &Path, stage: &str, token: Option<&str>) -> Result<(), String> {
    if is_verified(target, &spec.sha256, spec.bytes) {
        return Ok(());
    }
    fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
    let part = part_path(target);
    if fs::metadata(&part).map(|m| m.len() > spec.bytes).unwrap_or(false) {
        let _ = fs::remove_file(&part);
    }
    if target.exists() {
        // A complete file without its marker (for example copied in by hand): check it.
        let _ = fs::rename(target, &part);
    }
    set_progress(|p| { p.stage = stage.into(); p.total = spec.bytes; p.bytes = fs::metadata(&part).map(|m| m.len()).unwrap_or(0); });

    if fs::metadata(&part).map(|m| m.len()).unwrap_or(0) < spec.bytes {
        let mut cmd = Command::new("curl.exe");
        // Resume (-C -) after drops; a transfer stuck under 1 KB/s for a minute counts as dropped.
        cmd.args(["-L", "--fail", "--proto", "=https", "--proto-redir", "=https", "--retry", "20", "--retry-delay", "10", "--speed-limit", "1024", "--speed-time", "60", "-C", "-"]);
        if curl_retries_all_errors() {
            cmd.arg("--retry-all-errors");
        }
        cmd.args(["--silent", "--show-error", "-K", "-", "-o"]).arg(&part).arg(&spec.url)
            .stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::piped());
        let mut child = hide_window(&mut cmd).spawn().map_err(|e| format!("Could not start the download: {e}"))?;
        // Config on stdin keeps a Hugging Face token out of the process list.
        if let Some(mut stdin) = child.stdin.take() {
            let clean: String = token.unwrap_or_default().chars().filter(|c| c.is_ascii_alphanumeric() || "_-".contains(*c)).collect();
            let config = if clean.is_empty() { String::new() } else { format!("header = \"Authorization: Bearer {clean}\"\n") };
            let _ = stdin.write_all(config.as_bytes());
        }
        state().lock().map_err(|_| "Built-in AI state unavailable")?.curl = Some(child);
        loop {
            std::thread::sleep(Duration::from_millis(500));
            let bytes = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
            set_progress(|p| p.bytes = bytes);
            let mut st = state().lock().map_err(|_| "Built-in AI state unavailable")?;
            if st.cancel {
                if let Some(mut c) = st.curl.take() { let _ = c.kill(); let _ = c.wait(); }
                return Err("Cancelled".into());
            }
            let Some(child) = st.curl.as_mut() else { return Err("Cancelled".into()) };
            match child.try_wait() {
                Ok(None) => continue,
                Ok(Some(status)) => {
                    let mut child = st.curl.take().unwrap();
                    drop(st);
                    if status.success() {
                        break;
                    }
                    let mut err = String::new();
                    if let Some(mut e) = child.stderr.take() { let _ = e.read_to_string(&mut err); }
                    if err.contains("401") || err.contains("403") {
                        return Err("Hugging Face refused the download. This model may need you to accept its license on huggingface.co and add a Hugging Face token in Settings.".into());
                    }
                    return Err(format!("The download stopped ({}). Check your connection and try again; it resumes where it left off.", err.trim().chars().take(200).collect::<String>()));
                }
                Err(e) => return Err(e.to_string()),
            }
        }
    }

    let name = spec.file.clone();
    set_progress(|p| { p.stage = format!("Checking {name}"); p.bytes = 0; });
    let hash = sha256_file(&part, |n| set_progress(|p| p.bytes = n))?;
    if hash != spec.sha256 {
        let _ = fs::remove_file(&part);
        return Err(format!("{} did not match its published checksum, so it was deleted. Try the download again.", spec.file));
    }
    fs::rename(&part, target).map_err(|e| e.to_string())?;
    fs::write(marker(target), &spec.sha256).map_err(|e| e.to_string())?;
    Ok(())
}

fn ensure_runtime(dir: &Path) -> Result<(), String> {
    if server_exe(dir).exists() {
        return Ok(());
    }
    let zip = dir.join("runtime").join(RUNTIME.file);
    fetch(&RUNTIME.spec(), &zip, "Downloading the AI runtime (llama.cpp)", None)?;
    set_progress(|p| { p.stage = "Unpacking the runtime".into(); p.bytes = 0; p.total = 0; });
    let tmp = dir.join("runtime").join(format!("{LLAMA_BUILD}.unpacking"));
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    // Windows' own tar (bsdtar) reads zip archives.
    let mut cmd = Command::new("tar.exe");
    cmd.arg("-xf").arg(&zip).arg("-C").arg(&tmp).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    let ok = hide_window(&mut cmd).status().map(|s| s.success()).unwrap_or(false);
    if !ok || !tmp.join("llama-server.exe").exists() {
        let _ = fs::remove_dir_all(&tmp);
        return Err("Could not unpack the AI runtime.".into());
    }
    let _ = fs::remove_dir_all(runtime_dir(dir));
    fs::rename(&tmp, runtime_dir(dir)).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&zip);
    let _ = fs::remove_file(marker(&zip));
    Ok(())
}

/// Run a download job on its own thread; one at a time.
fn start_job(dir: PathBuf, label: String, job: impl FnOnce(&Path) -> Result<(), String> + Send + 'static) -> Result<(), String> {
    {
        let mut st = state().lock().map_err(|_| "Built-in AI state unavailable")?;
        if st.progress.running {
            return Err("A download is already running".into());
        }
        st.cancel = false;
        st.progress = InstallProgress { running: true, model_id: label, stage: "Starting".into(), ..Default::default() };
    }
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
    std::thread::spawn(move || {
        let result = ensure_runtime(&dir).and_then(|_| job(&dir));
        set_progress(|p| {
            p.running = false;
            match result {
                Ok(()) => { p.done = true; p.stage = "Ready".into(); p.error = None; }
                Err(e) => { p.done = false; p.error = Some(e); }
            }
        });
    });
    Ok(())
}

// ── Commands: catalog, models, downloads ─────────────────────────────────────

#[derive(Serialize)]
pub struct CatalogModel {
    id: &'static str,
    label: &'static str,
    bytes: u64,
    min_ram_gb: u32,
    blurb: &'static str,
    installed: bool,
}

#[derive(Serialize)]
pub struct Catalog {
    runtime_build: &'static str,
    runtime_bytes: u64,
    runtime_installed: bool,
    port: u16,
    models_dir: String,
    models: Vec<CatalogModel>,
}

#[tauri::command]
pub fn llm_catalog(install_dir: String) -> Result<Catalog, String> {
    let dir = validate_install_dir(&install_dir)?;
    Ok(Catalog {
        runtime_build: LLAMA_BUILD,
        runtime_bytes: RUNTIME.bytes,
        runtime_installed: server_exe(&dir).exists(),
        port: BUILTIN_PORT,
        models_dir: models_dir(&dir).to_string_lossy().into_owned(),
        models: MODELS.iter().map(|m| CatalogModel {
            id: m.id,
            label: m.label,
            bytes: m.weights.bytes + m.vision.bytes,
            min_ram_gb: m.min_ram_gb,
            blurb: m.blurb,
            installed: is_verified(&models_dir(&dir).join(m.id).join(m.weights.file), m.weights.sha256, m.weights.bytes),
        }).collect(),
    })
}

/// Download (or finish downloading) the runtime and a catalog model.
#[tauri::command]
pub fn llm_install(install_dir: String, model_id: String) -> Result<(), String> {
    let dir = validate_install_dir(&install_dir)?;
    let spec = catalog_model(&model_id)?;
    start_job(dir, spec.id.into(), move |dir| {
        let folder = models_dir(dir).join(spec.id);
        fetch(&spec.weights.spec(), &folder.join(spec.weights.file), &format!("Downloading {}", spec.label), None)?;
        fetch(&spec.vision.spec(), &folder.join(spec.vision.file), &format!("Downloading {} image support", spec.label), None)
    })
}

#[derive(Deserialize)]
pub struct HfFileIn {
    path: String,
    sha256: String,
    bytes: u64,
}

/// Download GGUF files from a Hugging Face repo into `models/<name>/`.
/// `files` are the weights (all parts of a split model) and optionally an mmproj file,
/// with the sizes and SHA-256 Hugging Face lists for them.
#[tauri::command]
pub fn llm_download_hf(install_dir: String, repo: String, name: String, files: Vec<HfFileIn>, token: Option<String>) -> Result<(), String> {
    let dir = validate_install_dir(&install_dir)?;
    if !valid_repo(&repo) {
        return Err("Not a Hugging Face repo name (owner/model)".into());
    }
    if !valid_model_name(&name) {
        return Err("Use only letters, numbers and . _ - in the model name".into());
    }
    if files.is_empty() || files.len() > 64 {
        return Err("Choose the model's files".into());
    }
    let mut specs = Vec::with_capacity(files.len());
    for f in &files {
        if !valid_repo_path(&f.path) || !valid_sha256(&f.sha256) || f.bytes == 0 || f.bytes > MAX_FILE_BYTES {
            return Err(format!("Not a downloadable model file: {}", f.path));
        }
        let file = f.path.rsplit('/').next().unwrap().to_string();
        specs.push(FileSpec { url: format!("https://huggingface.co/{repo}/resolve/main/{}", f.path), file, sha256: f.sha256.clone(), bytes: f.bytes });
    }
    let token = token.filter(|t| !t.trim().is_empty());
    start_job(dir, name.clone(), move |dir| {
        let folder = models_dir(dir).join(&name);
        let count = specs.len();
        for (i, spec) in specs.iter().enumerate() {
            let stage = if count > 1 { format!("Downloading {name} ({} of {count})", i + 1) } else { format!("Downloading {name}") };
            fetch(spec, &folder.join(&spec.file), &stage, token.as_deref())?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn llm_install_status() -> Result<InstallProgress, String> {
    Ok(state().lock().map_err(|_| "Built-in AI state unavailable")?.progress.clone())
}

#[tauri::command]
pub fn llm_cancel_install() -> Result<(), String> {
    let mut st = state().lock().map_err(|_| "Built-in AI state unavailable")?;
    st.cancel = true;
    if let Some(mut c) = st.curl.take() {
        let _ = c.kill();
    }
    Ok(())
}

#[derive(Serialize)]
pub struct LocalModel {
    /// The router's name for it: the folder name, or the file name without .gguf.
    id: String,
    bytes: u64,
    vision: bool,
    /// Every file finished (no .part left).
    complete: bool,
    catalog_id: Option<&'static str>,
}

/// Everything in the models folder the router can serve.
#[tauri::command]
pub fn llm_list_models(install_dir: String) -> Result<Vec<LocalModel>, String> {
    let dir = validate_install_dir(&install_dir)?;
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir(models_dir(&dir)) else { return Ok(out) };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        let path = e.path();
        if path.is_dir() {
            let mut bytes = 0;
            let (mut weights, mut vision, mut partial) = (false, false, false);
            for f in fs::read_dir(&path).into_iter().flatten().flatten() {
                let fname = f.file_name().to_string_lossy().to_lowercase();
                let len = f.metadata().map(|m| m.len()).unwrap_or(0);
                if fname.ends_with(".part") {
                    partial = true;
                } else if fname.ends_with(".gguf") {
                    bytes += len;
                    if fname.starts_with("mmproj") { vision = true } else { weights = true }
                }
            }
            if weights || partial {
                out.push(LocalModel { catalog_id: MODELS.iter().find(|m| m.id == name).map(|m| m.id), id: name, bytes, vision, complete: weights && !partial });
            }
        } else if name.to_lowercase().ends_with(".gguf") && !name.to_lowercase().starts_with("mmproj") {
            let bytes = e.metadata().map(|m| m.len()).unwrap_or(0);
            out.push(LocalModel { id: name[..name.len() - 5].to_string(), bytes, vision: false, complete: true, catalog_id: None });
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

#[derive(Serialize)]
pub struct ControlVectorFile {
    name: String,
    path: String,
    bytes: u64,
}

#[derive(Deserialize)]
pub struct ControlVectorArg {
    name: String,
    scale: f32,
}

fn control_vectors_dir(install_dir: &Path) -> PathBuf {
    install_dir.join("control-vectors")
}

/// Valid .gguf control vector files placed in `<install_dir>/control-vectors/`.
#[tauri::command]
pub fn llm_list_control_vectors(install_dir: String) -> Result<Vec<ControlVectorFile>, String> {
    let dir = validate_install_dir(&install_dir)?;
    let vec_dir = control_vectors_dir(&dir);
    let _ = fs::create_dir_all(&vec_dir);
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir(&vec_dir) else { return Ok(out) };
    for e in entries.flatten() {
        let fname = e.file_name().to_string_lossy().into_owned();
        let path = e.path();
        if path.is_file() && fname.to_lowercase().ends_with(".gguf") {
            let bytes = e.metadata().map(|m| m.len()).unwrap_or(0);
            out.push(ControlVectorFile {
                name: fname,
                path: path.to_string_lossy().into_owned(),
                bytes,
            });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

/// Show the models folder in Explorer (models copied in by hand are served too).
#[tauri::command]
pub fn llm_open_models_folder(install_dir: String) -> Result<(), String> {
    let dir = validate_install_dir(&install_dir)?;
    let target = models_dir(&dir);
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    Command::new("explorer").arg(&target).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a model's folder (or loose file) to free disk space. Unload it first.
#[tauri::command]
pub fn llm_remove_model(install_dir: String, model: String) -> Result<(), String> {
    let dir = validate_install_dir(&install_dir)?;
    if !valid_model_name(&model) {
        return Err("Unknown model".into());
    }
    let folder = models_dir(&dir).join(&model);
    let loose = models_dir(&dir).join(format!("{model}.gguf"));
    let result = if folder.is_dir() {
        fs::remove_dir_all(&folder)
    } else if loose.is_file() {
        fs::remove_file(&loose).and_then(|_| { let _ = fs::remove_file(marker(&loose)); Ok(()) })
    } else {
        return Ok(());
    };
    result.map_err(|e| format!("Could not delete {model}: {e}. If it is loaded, unload it or stop the built-in AI first."))
}

// ── Commands: the server ─────────────────────────────────────────────────────

fn random_key() -> Result<String, String> {
    let mut bytes = [0u8; 24];
    #[cfg(windows)]
    {
        use windows_sys::Win32::Security::Cryptography::{BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG};
        let status = unsafe { BCryptGenRandom(std::ptr::null_mut(), bytes.as_mut_ptr(), bytes.len() as u32, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
        if status != 0 {
            return Err("Could not create a key for the built-in AI".into());
        }
    }
    #[cfg(not(windows))]
    {
        fs::File::open("/dev/urandom").and_then(|mut f| f.read_exact(&mut bytes)).map_err(|e| e.to_string())?;
    }
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

/// The GPU with the most free memory, as llama.cpp names it ("Vulkan0"), or None for CPU only.
fn best_device(exe: &Path) -> Option<String> {
    let mut cmd = Command::new(exe);
    cmd.arg("--list-devices").stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let out = hide_window(&mut cmd).output().ok()?;
    let text = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
    parse_best_device(&text)
}

fn parse_best_device(text: &str) -> Option<String> {
    // Lines look like "  Vulkan0: Quadro M6000 24GB (24728 MiB, 23948 MiB free)".
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            let (name, rest) = line.split_once(':')?;
            if name.is_empty() || name.contains(' ') || !name.chars().all(|c| c.is_ascii_alphanumeric()) {
                return None;
            }
            let free = rest.rsplit_once(" MiB free")?.0.rsplit(|c: char| !c.is_ascii_digit()).next()?.parse::<u64>().ok()?;
            Some((name.to_string(), free))
        })
        .max_by_key(|(_, free)| *free)
        .map(|(name, _)| name)
}

/// The router starts one process per loaded model; ending the router alone would
/// leave those holding the GPU, so the whole tree goes.
fn kill_tree(pid: u32) {
    let mut cmd = Command::new("taskkill");
    cmd.args(["/PID", &pid.to_string(), "/T", "/F"]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    let _ = hide_window(&mut cmd).status();
}

fn pid_file(dir: &Path) -> PathBuf {
    dir.join("llama-server.pid")
}

/// A router left by a Sovereign that crashed: stopped only if it is ours (its
/// command line serves this install's models folder), never another app's llama-server.
fn stop_stale(dir: &Path) {
    let Some(pid) = fs::read_to_string(pid_file(dir)).ok().and_then(|s| s.trim().parse::<u32>().ok()) else { return };
    let mut ps = Command::new("powershell");
    ps.args(["-NoProfile", "-Command", &format!("(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine")]);
    let cmdline = hide_window(&mut ps).output().map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase()).unwrap_or_default();
    if cmdline.contains("llama-server") && cmdline.contains(&models_dir(dir).to_string_lossy().to_lowercase()) {
        kill_tree(pid);
    }
    let _ = fs::remove_file(pid_file(dir));
}

fn server_alive(st: &mut State) -> bool {
    match st.server.as_mut() {
        Some(s) => matches!(s.child.try_wait(), Ok(None)),
        None => false,
    }
}

fn stop_server() {
    let server = state().lock().ok().and_then(|mut st| st.server.take());
    if let Some(mut s) = server {
        kill_tree(s.child.id());
        let _ = s.child.wait();
    }
}

#[derive(Serialize)]
pub struct LlmStatus {
    running: bool,
    port: u16,
    log_tail: String,
}

fn status_for(dir: &Path) -> LlmStatus {
    let running = state().lock().map(|mut st| server_alive(&mut st)).unwrap_or(false);
    LlmStatus { running, port: BUILTIN_PORT, log_tail: tail(&dir.join("llama-server.log"), 4000) }
}

/// Start the model server over this install's models folder (or keep it running).
/// `cpu_only` keeps every model in system RAM; `control_vectors` applies validated
/// `--control-vector-scaled` activation steering files from `<install>/control-vectors/`.
#[tauri::command]
pub fn llm_start(install_dir: String, cpu_only: Option<bool>, control_vectors: Option<Vec<ControlVectorArg>>) -> Result<LlmStatus, String> {
    let dir = validate_install_dir(&install_dir)?;
    let exe = server_exe(&dir);
    if !exe.exists() {
        return Err("The built-in AI is not set up yet".into());
    }
    {
        let mut st = state().lock().map_err(|_| "Built-in AI state unavailable")?;
        if server_alive(&mut st) {
            drop(st);
            return Ok(status_for(&dir));
        }
    }
    stop_server();
    stop_stale(&dir);
    fs::create_dir_all(models_dir(&dir)).map_err(|e| e.to_string())?;

    let key = random_key()?;
    let mut args: Vec<String> = vec![
        "--models-dir".into(), models_dir(&dir).to_string_lossy().into_owned(),
        // One model in memory at a time; asking for another swaps it in.
        "--models-max".into(), "1".into(),
        "--host".into(), "127.0.0.1".into(),
        "--port".into(), BUILTIN_PORT.to_string(),
        "--no-slots".into(),
        "--no-webui".into(),
        "--cors-origins".into(), APP_ORIGIN.into(),
        "-c".into(), CONTEXT.to_string(),
        "--jinja".into(),
        // Fills the chosen device as far as it fits; the rest runs on the CPU.
        "--fit".into(), "on".into(),
    ];
    if let Some(vectors) = control_vectors {
        let vec_dir = control_vectors_dir(&dir);
        for v in vectors.into_iter().take(8) {
            if !valid_model_name(&v.name) || !v.name.to_lowercase().ends_with(".gguf") {
                continue;
            }
            let target = vec_dir.join(&v.name);
            if target.is_file() {
                let scale = if v.scale.is_finite() { v.scale.clamp(-4.0, 4.0) } else { 0.0 };
                args.push("--control-vector-scaled".into());
                args.push(target.to_string_lossy().into_owned());
                args.push(format!("{scale:.3}"));
            }
        }
    }
    if cpu_only.unwrap_or(false) {
        args.push("--device".into());
        args.push("none".into());
    } else if let Some(dev) = best_device(&exe) {
        args.push("--device".into());
        args.push(dev);
    }

    let log = fs::File::create(dir.join("llama-server.log")).map_err(|e| e.to_string())?;
    let log_err = log.try_clone().map_err(|e| e.to_string())?;
    let mut cmd = Command::new(&exe);
    cmd.args(&args)
        // In the environment, so the router's per-model processes require it as well.
        .env("LLAMA_API_KEY", &key)
        .current_dir(runtime_dir(&dir))
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err));
    let child = hide_window(&mut cmd).spawn().map_err(|e| format!("Could not start the built-in AI: {e}"))?;
    let _ = fs::write(pid_file(&dir), child.id().to_string());
    state().lock().map_err(|_| "Built-in AI state unavailable")?.server = Some(Server { child, key });
    Ok(status_for(&dir))
}

#[tauri::command]
pub fn llm_stop(install_dir: String) -> Result<(), String> {
    let dir = validate_install_dir(&install_dir)?;
    stop_server();
    let _ = fs::remove_file(pid_file(&dir));
    Ok(())
}

#[tauri::command]
pub fn llm_status(install_dir: String) -> Result<LlmStatus, String> {
    let dir = validate_install_dir(&install_dir)?;
    Ok(status_for(&dir))
}

/// The header that lets Sovereign's own local-AI requests through, for the built-in port only.
pub fn auth_header(port: u16) -> String {
    if port != BUILTIN_PORT {
        return String::new();
    }
    state()
        .lock()
        .ok()
        .and_then(|st| st.server.as_ref().map(|s| format!("Authorization: Bearer {}\r\n", s.key)))
        .unwrap_or_default()
}

/// Runs as Sovereign exits: the server, its model processes and any download stop with it.
pub fn shutdown() {
    let server = state().lock().ok().and_then(|mut st| {
        st.cancel = true;
        if let Some(mut c) = st.curl.take() {
            let _ = c.kill();
        }
        st.server.take()
    });
    if let Some(s) = server {
        kill_tree(s.child.id());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_the_gpu_with_most_free_memory() {
        let text = "Available devices:\n  Vulkan0: Quadro M6000 24GB (24728 MiB, 23948 MiB free)\n  Vulkan1: Radeon RX 580 Series (8192 MiB, 7403 MiB free)\n";
        assert_eq!(parse_best_device(text).as_deref(), Some("Vulkan0"));
        assert_eq!(parse_best_device("Available devices:\n"), None);
    }

    #[test]
    fn hugging_face_names_and_paths() {
        assert!(valid_repo("ggml-org/gemma-4-E4B-it-GGUF"));
        assert!(valid_repo("unsloth/Qwen3.6-27B-GGUF"));
        assert!(!valid_repo("ggml-org"));
        assert!(!valid_repo("a/b/c"));
        assert!(!valid_repo("../etc"));
        assert!(!valid_repo("owner/name?x=1"));
        assert!(valid_repo_path("model-Q4_K_M.gguf"));
        assert!(valid_repo_path("Q4_K_M/model-00001-of-00002.gguf"));
        assert!(!valid_repo_path("../model.gguf"));
        assert!(!valid_repo_path("model.exe"));
        assert!(!valid_repo_path(".hidden.gguf"));
        assert!(!valid_repo_path("a b.gguf"));
        assert!(valid_model_name("Qwen3.6-27B-Q4_K_M"));
        assert!(!valid_model_name("../x"));
        assert!(!valid_model_name(".x"));
        assert!(!valid_model_name("a/b"));
        assert!(valid_sha256("a555b900214b477d8880e7832e0b8925e139b0159640036b09fe472b6f2097f2"));
        assert!(!valid_sha256("A555"));
    }
}
