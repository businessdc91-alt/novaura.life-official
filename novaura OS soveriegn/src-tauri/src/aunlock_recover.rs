//! Aunlock drive recovery (Plan 1) — the thin Tauri I/O shell.
//!
//! All decisions (read-only query guard, JSON normalization, path containment, reparse policy,
//! backpressure, staging paths, path sanitization, record framing, AEAD) live in the pure,
//! unit-tested `crate::aunlock_recover_rules`. This module only performs I/O: it spawns the
//! read-only PowerShell queries, walks the SOURCE volume strictly read-only, and writes encrypted
//! copies into the app's staging tree. It is proven by the gated live check
//! (`docs/superpowers/live-checks/aunlock-drive-recovery.md`), not by CI.
//!
//! READ-ONLY SOURCE: source files are only ever opened with `File::open` (read-only) and the
//! source volume is only listed/stat'ed. Nothing is created, written, truncated, mounted for
//! write, or repartitioned on it. Reparse points / symlinks are never followed.
//!
//! STAGED FILE LAYOUT: a concatenation of per-block records, one per <=16 MiB plaintext block:
//!   `u32 LE sealed_key_len || sealed_key || u32 LE ct_len || ct`
//! where `sealed_key = seal_vault_payload(base64(fresh 32-byte CSPRNG key))` (DPAPI on Windows)
//! and `ct = encrypt_chunks(key, block)`. Every block uses its own fresh key.

pub use crate::aunlock_recover_rules::{HealthReport, VolumeSpec};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryLite {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecoverSelection {
    #[serde(default)]
    pub preset: bool,
    #[serde(default)]
    pub paths: Vec<String>,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecoveredEntry {
    pub path: String,
    pub size: u64,
    pub staged_ref: String,
    pub source_type: String,
    pub checksum: String,
}

#[cfg(not(windows))]
fn off_platform<T>() -> Result<T, String> {
    Err("Aunlock drive recovery is only available on Windows".to_string())
}

#[cfg(windows)]
mod imp {
    use super::{DirEntryLite, RecoverSelection, RecoveredEntry};
    use crate::aunlock_recover_rules::{
        can_stage_next, decrypt_chunks, encode_record, encrypt_chunks, normalize_health,
        path_is_contained, recover_query_is_read_only, resolve_volumes, sanitize_staged_rel,
        select_preset_profiles, should_skip_reparse, split_record, staged_rel_path, staging_dir,
        volume_by_letter, volume_is_recoverable, HealthReport, StageDecision, VolumeSpec,
        AUNLOCK_HEALTH_QUERY, AUNLOCK_VOLUMES_QUERY, PRESET_FOLDERS,
    };
    use base64::{Engine, engine::general_purpose::STANDARD};
    use chacha20poly1305::aead::{KeyInit, OsRng};
    use chacha20poly1305::ChaCha20Poly1305;
    use sha2::{Digest, Sha256};
    use std::collections::HashSet;
    use std::fs::{self, File};
    use std::io::{Read, Write};
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::fs::MetadataExt;
    use std::path::{Path, PathBuf};

    /// Plaintext block size; memory per file is bounded by this.
    const BLOCK: usize = 16 * 1024 * 1024;
    /// Free space that must always remain on the staging disk (the pure SAFETY_MARGIN is a floor).
    const DISK_RESERVE: u64 = 256 * 1024 * 1024;
    /// Generous per-job cap; the real limiter is free disk space.
    const JOB_BUDGET: u64 = u64::MAX / 2;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;

    unsafe extern "system" {
        fn GetDiskFreeSpaceExW(
            dir: *const u16,
            avail_to_caller: *mut u64,
            total: *mut u64,
            total_free: *mut u64,
        ) -> i32;
    }

    fn free_bytes(dir: &Path) -> Result<u64, String> {
        let wide: Vec<u16> = dir.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let (mut avail, mut total, mut free) = (0u64, 0u64, 0u64);
        // SAFETY: `wide` is NUL-terminated and outlives the call; the out-pointers are valid.
        let ok = unsafe { GetDiskFreeSpaceExW(wide.as_ptr(), &mut avail, &mut total, &mut free) };
        if ok == 0 {
            return Err(format!("could not read free space: {}", std::io::Error::last_os_error()));
        }
        Ok(avail)
    }

    /// Run a PowerShell query that has passed the read-only guard (fail-closed).
    fn run_guarded(query: &str) -> Result<String, String> {
        if !recover_query_is_read_only(query) {
            return Err("internal: query failed its read-only guard".to_string());
        }
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", query])
            .output()
            .map_err(|e| format!("could not run PowerShell: {e}"))?;
        if !output.status.success() {
            return Err(format!("query failed: {}", String::from_utf8_lossy(&output.stderr).trim()));
        }
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }

    pub fn read_health(serial: Option<String>, size_bytes: Option<u64>) -> Result<HealthReport, String> {
        let _ = (&serial, size_bytes); // the health query is whole-machine; the pure fn takes JSON only
        let out = run_guarded(AUNLOCK_HEALTH_QUERY)?;
        Ok(normalize_health(&out))
    }

    pub fn resolve_vols(serial: Option<String>, size_bytes: Option<u64>) -> Result<Vec<VolumeSpec>, String> {
        let out = run_guarded(AUNLOCK_VOLUMES_QUERY)?;
        Ok(resolve_volumes(&out, serial.as_deref(), size_bytes))
    }

    /// `(uppercase letter, "X:\\")` from a drive-letter string such as `E`, `e:` or `E:\`.
    fn drive_root(drive_letter: &str) -> Result<(char, PathBuf), String> {
        let t = drive_letter.trim().trim_end_matches(['\\', '/']).trim_end_matches(':');
        let mut chars = t.chars();
        match (chars.next(), chars.next()) {
            (Some(c), None) if c.is_ascii_alphabetic() => {
                let c = c.to_ascii_uppercase();
                Ok((c, PathBuf::from(format!("{c}:\\"))))
            }
            _ => Err("invalid drive letter".to_string()),
        }
    }

    fn is_reparse(md: &fs::Metadata) -> bool {
        should_skip_reparse(
            md.file_type().is_symlink(),
            md.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0,
        )
    }

    /// True when no component from `root` down to `path` (inclusive) is a reparse point/symlink.
    fn chain_has_no_reparse(root: &Path, path: &Path) -> bool {
        let Ok(rel) = path.strip_prefix(root) else { return false };
        let mut cur = root.to_path_buf();
        for comp in rel.components() {
            cur.push(comp);
            match fs::symlink_metadata(&cur) {
                Ok(md) if !is_reparse(&md) => {}
                _ => return false,
            }
        }
        true
    }

    pub fn list_dir(drive_letter: String, subpath: String) -> Result<Vec<DirEntryLite>, String> {
        let (_, root) = drive_root(&drive_letter)?;
        let target = root.join(subpath.trim());
        if !path_is_contained(&root, &target) {
            return Err("path escapes the volume root".to_string());
        }
        if !chain_has_no_reparse(&root, &target) {
            return Err("refusing to follow a link/reparse point".to_string());
        }
        let mut out = Vec::new();
        for entry in fs::read_dir(&target).map_err(|e| format!("could not list folder: {e}"))? {
            let Ok(entry) = entry else { continue };
            let Ok(md) = fs::symlink_metadata(entry.path()) else { continue };
            if is_reparse(&md) {
                continue;
            }
            out.push(DirEntryLite {
                name: entry.file_name().to_string_lossy().into_owned(),
                is_dir: md.is_dir(),
                size: if md.is_dir() { 0 } else { md.len() },
            });
        }
        out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
        Ok(out)
    }

    /// Stream one source file (read-only) into the staged per-block record format. Returns
    /// `(bytes_read, sha256_hex)`. A partial staged file is removed on any error.
    fn stage_file(src: &Path, dst: &Path) -> Result<(u64, String), String> {
        let r = stage_file_inner(src, dst);
        if r.is_err() {
            let _ = fs::remove_file(dst);
        }
        r
    }

    fn stage_file_inner(src: &Path, dst: &Path) -> Result<(u64, String), String> {
        let mut input = File::open(src).map_err(|e| format!("open {}: {e}", src.display()))?; // READ-ONLY
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create staging dir: {e}"))?;
        }
        let mut output = File::create(dst).map_err(|e| format!("create staged file: {e}"))?;
        let mut hasher = Sha256::new();
        let mut total: u64 = 0;
        let mut block: Vec<u8> = Vec::new();
        let mut wrote_any = false;
        loop {
            block.clear();
            (&mut input)
                .take(BLOCK as u64)
                .read_to_end(&mut block)
                .map_err(|e| format!("read {}: {e}", src.display()))?;
            if block.is_empty() && wrote_any {
                break;
            }
            hasher.update(&block);
            total += block.len() as u64;
            // Fresh CSPRNG key for EVERY encrypt_chunks call (never reused across blocks/files).
            let mut key = [0u8; 32];
            key.copy_from_slice(ChaCha20Poly1305::generate_key(&mut OsRng).as_slice());
            let sealed_key = crate::seal_vault_payload(&STANDARD.encode(key))?;
            let ct = encrypt_chunks(&key, &block);
            key.fill(0);
            std::hint::black_box(&key);
            output
                .write_all(&encode_record(sealed_key.as_bytes(), &ct))
                .map_err(|e| format!("write staged file: {e}"))?;
            wrote_any = true;
            if block.is_empty() {
                break; // empty source: exactly one (empty, `last`) record
            }
        }
        output.flush().map_err(|e| format!("flush staged file: {e}"))?;
        let digest = hasher.finalize();
        Ok((total, digest.iter().map(|b| format!("{b:02x}")).collect()))
    }

    /// Re-open a staged file and verify it decrypts to `size` bytes with SHA-256 `checksum`.
    /// Used by the live check and future recovery; reads record by record (bounded memory is not
    /// needed here because each record is <= one block).
    #[allow(dead_code)]
    pub fn verify_staged(path: &Path, size: u64, checksum: &str) -> Result<bool, String> {
        let buf = fs::read(path).map_err(|e| format!("read staged file: {e}"))?;
        let mut hasher = Sha256::new();
        let (mut pos, mut total) = (0usize, 0u64);
        while pos < buf.len() {
            let (sk, ct, next) = split_record(&buf, pos).map_err(|_| "malformed staged record".to_string())?;
            let key_b64 = crate::open_vault_payload(String::from_utf8_lossy(sk).into_owned())?;
            let key_vec = STANDARD.decode(key_b64.trim()).map_err(|e| format!("key decode: {e}"))?;
            let key: [u8; 32] = key_vec.try_into().map_err(|_| "bad key length".to_string())?;
            let pt = decrypt_chunks(&key, ct).map_err(|e| format!("decrypt: {e:?}"))?;
            hasher.update(&pt);
            total += pt.len() as u64;
            pos = next;
        }
        let hex: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
        Ok(total == size && hex == checksum)
    }

    struct Job {
        staging: PathBuf,
        drive: char,
        root: PathBuf,
        staged_bytes: u64,
        used_refs: HashSet<String>,
        entries: Vec<RecoveredEntry>,
        skipped: u64,
    }

    impl Job {
        /// Stage one source file, honoring backpressure. `Err` is a clean fatal stop.
        fn add_file(&mut self, src: &Path, size_hint: u64) -> Result<(), String> {
            if !path_is_contained(&self.root, src) {
                return Err(format!("refusing path outside the volume: {}", src.display()));
            }
            fs::create_dir_all(&self.staging).map_err(|e| format!("create staging dir: {e}"))?;
            let free = free_bytes(&self.staging)?.saturating_sub(DISK_RESERVE);
            match can_stage_next(free, self.staged_bytes, JOB_BUDGET, size_hint) {
                StageDecision::Proceed => {}
                StageDecision::StopDisk => {
                    return Err(format!(
                        "stopped: staging disk is nearly full ({} files staged so far); free space or purge and retry",
                        self.entries.len()
                    ));
                }
                StageDecision::StopBudget => {
                    return Err(format!("stopped: job byte budget reached ({} files staged)", self.entries.len()));
                }
            }
            let mut rel = sanitize_staged_rel(&staged_rel_path(&self.drive.to_string(), src));
            let mut n = 1u32;
            while !self.used_refs.insert(rel.to_lowercase()) {
                n += 1;
                rel = format!("{}~{n}", sanitize_staged_rel(&staged_rel_path(&self.drive.to_string(), src)));
            }
            let dst = rel.split('/').fold(self.staging.clone(), |p, c| p.join(c));
            if !path_is_contained(&self.staging, &dst) {
                return Err("internal: staged path escaped the job directory".to_string());
            }
            match stage_file(src, &dst) {
                Ok((size, checksum)) => {
                    self.staged_bytes = self.staged_bytes.saturating_add(size);
                    self.entries.push(RecoveredEntry {
                        path: src.to_string_lossy().into_owned(),
                        size,
                        staged_ref: rel,
                        source_type: "live".to_string(),
                        checksum,
                    });
                }
                // An unreadable source file (bad sector, locked, denied) must not abort the job.
                Err(_) => self.skipped += 1,
            }
            Ok(())
        }

        /// Walk `dir` read-only (iteratively), never following reparse points.
        fn walk(&mut self, dir: &Path) -> Result<(), String> {
            let mut stack = vec![dir.to_path_buf()];
            while let Some(d) = stack.pop() {
                let Ok(rd) = fs::read_dir(&d) else {
                    self.skipped += 1;
                    continue;
                };
                for entry in rd {
                    let Ok(entry) = entry else { continue };
                    let path = entry.path();
                    let Ok(md) = fs::symlink_metadata(&path) else { continue };
                    if is_reparse(&md) {
                        continue;
                    }
                    if md.is_dir() {
                        stack.push(path);
                    } else if md.is_file() {
                        self.add_file(&path, md.len())?;
                    }
                }
            }
            Ok(())
        }
    }

    pub fn recover_files(job_id: String, drive_letter: String, selection: RecoverSelection) -> Result<Vec<RecoveredEntry>, String> {
        let (drive, root) = drive_root(&drive_letter)?;
        if !selection.preset && selection.paths.is_empty() {
            return Err("nothing selected to recover".to_string());
        }
        // Refuse anything that is not a plaintext, readable, mountable volume (route to reclaim).
        let vols_json = run_guarded(AUNLOCK_VOLUMES_QUERY)?;
        match volume_by_letter(&vols_json, &drive.to_string()) {
            Some(v) if volume_is_recoverable(&v) => {}
            _ => {
                return Err(format!(
                    "volume {drive}: is encrypted, locked, unreadable or unrecognized and cannot be recovered live; use the reclaim path"
                ));
            }
        }
        let mut job = Job {
            staging: staging_dir(&crate::get_app_data_dir(), &job_id),
            drive,
            root: root.clone(),
            staged_bytes: 0,
            used_refs: HashSet::new(),
            entries: Vec::new(),
            skipped: 0,
        };

        if selection.preset {
            let users = root.join("Users");
            if chain_has_no_reparse(&root, &users) {
                let names: Vec<String> = fs::read_dir(&users)
                    .map(|rd| {
                        rd.filter_map(|e| e.ok())
                            .filter(|e| fs::symlink_metadata(e.path()).map(|m| m.is_dir() && !is_reparse(&m)).unwrap_or(false))
                            .map(|e| e.file_name().to_string_lossy().into_owned())
                            .collect()
                    })
                    .unwrap_or_default();
                for profile in select_preset_profiles(&names) {
                    for folder in PRESET_FOLDERS {
                        let p = users.join(&profile).join(folder);
                        if p.exists() && chain_has_no_reparse(&root, &p) {
                            job.walk(&p)?;
                        }
                    }
                }
            }
        }

        for raw in &selection.paths {
            let s = raw.trim();
            let prefix = format!("{drive}:");
            if s.len() < 2 || !s.is_char_boundary(2) || !s[..2].eq_ignore_ascii_case(&prefix) {
                return Err(format!("selected path is not on volume {drive}: {raw}"));
            }
            let candidate = PathBuf::from(format!("{prefix}{}", &s[2..]));
            if !path_is_contained(&root, &candidate) || !chain_has_no_reparse(&root, &candidate) {
                return Err(format!("selected path is outside the volume or crosses a link: {raw}"));
            }
            let md = fs::symlink_metadata(&candidate).map_err(|e| format!("cannot read {raw}: {e}"))?;
            if md.is_dir() {
                job.walk(&candidate)?;
            } else if md.is_file() {
                job.add_file(&candidate, md.len())?;
            }
        }

        if job.entries.is_empty() && job.skipped > 0 {
            return Err(format!("no files could be read ({} unreadable); the drive may be failing", job.skipped));
        }
        Ok(job.entries)
    }

    pub fn purge(job_id: String) -> Result<bool, String> {
        let dir = staging_dir(&crate::get_app_data_dir(), &job_id);
        if !dir.exists() {
            return Ok(true);
        }
        fs::remove_dir_all(&dir).map_err(|e| format!("could not purge staging: {e}"))?;
        Ok(!dir.exists())
    }
}

#[tauri::command]
pub async fn aunlock_read_health(serial: Option<String>, size_bytes: Option<u64>) -> Result<HealthReport, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || imp::read_health(serial, size_bytes))
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (serial, size_bytes);
        off_platform()
    }
}

#[tauri::command]
pub async fn aunlock_resolve_volumes(serial: Option<String>, size_bytes: Option<u64>) -> Result<Vec<VolumeSpec>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || imp::resolve_vols(serial, size_bytes))
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (serial, size_bytes);
        off_platform()
    }
}

#[tauri::command]
pub async fn aunlock_list_dir(drive_letter: String, subpath: String) -> Result<Vec<DirEntryLite>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || imp::list_dir(drive_letter, subpath))
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (drive_letter, subpath);
        off_platform()
    }
}

#[tauri::command]
pub async fn aunlock_recover_files(job_id: String, drive_letter: String, selection: RecoverSelection) -> Result<Vec<RecoveredEntry>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || imp::recover_files(job_id, drive_letter, selection))
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (job_id, drive_letter, selection);
        off_platform()
    }
}

#[tauri::command]
pub async fn aunlock_purge_recovered(job_id: String) -> Result<bool, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || imp::purge(job_id))
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = job_id;
        off_platform()
    }
}
