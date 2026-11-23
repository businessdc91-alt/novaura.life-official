//! Aunlock drive recovery (Plan 1) — the thin Tauri I/O shell.
//!
//! All decisions (read-only query guard, JSON normalization, device binding, path containment,
//! entry classification, backpressure, staging paths, path sanitization, record framing, AEAD, the
//! in-flight registry) live in the pure, unit-tested `crate::aunlock_recover_rules`. This module
//! only performs I/O: it spawns the read-only PowerShell queries, walks the SOURCE volume strictly
//! read-only, and writes encrypted copies into the app's staging tree. It is proven by the gated
//! live check (`docs/superpowers/live-checks/aunlock-drive-recovery.md`), not by CI.
//!
//! TRUST BOUNDARY: every command that reads a volume first binds the drive letter to the intaken
//! device (`bind_volume`): the letter must be one of THAT device's volumes, not on a system/boot
//! disk, and recoverable (plaintext, verified, mountable). A recovery also refuses to stage onto
//! the drive it is reading.
//!
//! READ-ONLY SOURCE: source files are only ever opened with `File::open` (read-only) and the
//! source volume is only listed/stat'ed. Nothing is created, written, truncated, mounted for
//! write, or repartitioned on it. Links (junctions/symlinks) are never followed; online-only cloud
//! files are not opened (that would download them onto the source); EFS files are not recovered.
//! Every entry the walk does not read is recorded — in `skipped`, or in `links` for links.
//!
//! STAGED FILE LAYOUT: a concatenation of per-block records, one per <=16 MiB plaintext block:
//!   `u32 LE sealed_key_len || sealed_key || u32 LE ct_len || ct`
//! where `sealed_key = seal_vault_payload(base64(fresh 32-byte CSPRNG key))` (DPAPI on Windows)
//! and `ct = encrypt_chunks(key, block)`. Every block uses its own fresh key.
//!
//! ONE RUN PER JOB: a recovery registers in the in-flight table. A second run on the same job is
//! refused, and a purge of a running job cancels it (the walk stops at the next entry and never
//! recreates staging) and reports an error so the caller retries the delete once it has stopped.

pub use crate::aunlock_recover_rules::{HealthReport, RecoverOutcome, RecoveredEntry, SkippedEntry, VolumeSpec};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryLite {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    /// Why this entry can't be recovered (a link, an online-only cloud file, EFS), or `None`.
    pub note: Option<String>,
}

/// One job folder under staging and how long ago it was created (`None` when unreadable). The
/// caller only purges an unknown folder once it is past the retention window: another Sovereign
/// build sharing this staging root may still own a younger one.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StagedJob {
    pub id: String,
    pub age_secs: Option<u64>,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecoverSelection {
    #[serde(default)]
    pub preset: bool,
    #[serde(default)]
    pub paths: Vec<String>,
}

#[cfg(not(windows))]
fn off_platform<T>() -> Result<T, String> {
    Err("Aunlock drive recovery is only available on Windows".to_string())
}

#[cfg(windows)]
mod imp {
    use super::{DirEntryLite, RecoverOutcome, RecoverSelection, RecoveredEntry, SkippedEntry, StagedJob};
    use crate::aunlock_recover_rules::{
        bind_volume, build_outcome, can_stage_next, classify_entry, decrypt_chunks, encode_record, encrypt_chunks,
        entry_skip_reason, job_key, normalize_health_for, onedrive_roots, path_is_contained, record_lengths_ok,
        recover_query_is_read_only, resolve_volumes, sanitize_staged_rel, select_preset_profiles, stop_reason,
        staged_job_ids, staged_rel_path, staging_dir, staging_on_source, EntryKind, HealthReport, InFlight,
        VolumeSpec, AUNLOCK_HEALTH_QUERY, AUNLOCK_VOLUMES_QUERY, PRESET_FOLDERS, SEALED_KEY_MAX,
    };
    use base64::{Engine, engine::general_purpose::STANDARD};
    use chacha20poly1305::aead::{KeyInit, OsRng};
    use chacha20poly1305::ChaCha20Poly1305;
    use sha2::{Digest, Sha256};
    use std::collections::HashSet;
    use std::fs::{self, File};
    use std::io::{BufReader, Read, Write};
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::fs::MetadataExt;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, OnceLock};

    /// Plaintext block size; memory per file is bounded by this.
    const BLOCK: usize = 16 * 1024 * 1024;
    /// Free space that must always remain on the staging disk (the pure SAFETY_MARGIN is a floor).
    const DISK_RESERVE: u64 = 256 * 1024 * 1024;
    /// Generous per-job cap; the real limiter is free disk space.
    const JOB_BUDGET: u64 = u64::MAX / 2;
    const CANCELLED: &str = "cancelled";

    /// Recoveries running right now, one per job.
    fn inflight() -> &'static InFlight {
        static REG: OnceLock<InFlight> = OnceLock::new();
        REG.get_or_init(InFlight::new)
    }

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
        let _ = size_bytes; // matching is by serial; no serial/match falls back to the worst disk
        let out = run_guarded(AUNLOCK_HEALTH_QUERY)?;
        Ok(normalize_health_for(&out, serial.as_deref()))
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

    /// Bind `drive_letter` to the intaken device's volumes (one PowerShell call) and return its root.
    fn bound_root(serial: Option<&str>, size_bytes: Option<u64>, drive_letter: &str) -> Result<(char, PathBuf), String> {
        let (drive, root) = drive_root(drive_letter)?;
        let vols = run_guarded(AUNLOCK_VOLUMES_QUERY)?;
        bind_volume(&vols, serial, size_bytes, &drive.to_string())?;
        Ok((drive, root))
    }

    fn kind_of(md: &fs::Metadata) -> EntryKind {
        classify_entry(md.file_type().is_symlink(), md.is_dir(), md.file_attributes())
    }

    /// True when no component from `root` down to `path` (inclusive) is a link (junction/symlink).
    /// Data-bearing reparse folders (a OneDrive folder, say) are fine; links never are.
    fn chain_has_no_link(root: &Path, path: &Path) -> bool {
        let Ok(rel) = path.strip_prefix(root) else { return false };
        let mut cur = root.to_path_buf();
        for comp in rel.components() {
            cur.push(comp);
            match fs::symlink_metadata(&cur) {
                Ok(md) if kind_of(&md) != EntryKind::Link => {}
                _ => return false,
            }
        }
        true
    }

    /// Names of the real (non-link) sub-folders of `dir`.
    fn dir_names(dir: &Path) -> Result<Vec<String>, String> {
        let rd = fs::read_dir(dir).map_err(|e| format!("unreadable folder: {e}"))?;
        Ok(rd
            .filter_map(|e| e.ok())
            .filter(|e| {
                fs::symlink_metadata(e.path())
                    .map(|m| m.is_dir() && kind_of(&m) == EntryKind::Normal)
                    .unwrap_or(false)
            })
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect())
    }

    pub fn list_dir(
        serial: Option<String>,
        size_bytes: Option<u64>,
        drive_letter: String,
        subpath: String,
    ) -> Result<Vec<DirEntryLite>, String> {
        let (_, root) = bound_root(serial.as_deref(), size_bytes, &drive_letter)?;
        let target = root.join(subpath.trim());
        if !path_is_contained(&root, &target) {
            return Err("path escapes the volume root".to_string());
        }
        if !chain_has_no_link(&root, &target) {
            return Err("refusing to follow a link (junction/symlink)".to_string());
        }
        let mut out = Vec::new();
        for entry in fs::read_dir(&target).map_err(|e| format!("could not list folder: {e}"))? {
            let Ok(entry) = entry else { continue };
            let Ok(md) = fs::symlink_metadata(entry.path()) else { continue };
            let kind = kind_of(&md);
            out.push(DirEntryLite {
                name: entry.file_name().to_string_lossy().into_owned(),
                is_dir: md.is_dir() && kind == EntryKind::Normal,
                size: if md.is_dir() { 0 } else { md.len() },
                note: entry_skip_reason(kind).map(str::to_string),
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

    /// Read exactly `buf.len()` bytes; `Ok(false)` only for a clean end of file before any byte.
    fn read_full_or_eof(r: &mut impl Read, buf: &mut [u8]) -> Result<bool, String> {
        let mut got = 0;
        while got < buf.len() {
            let n = r.read(&mut buf[got..]).map_err(|e| format!("read staged file: {e}"))?;
            if n == 0 {
                return if got == 0 { Ok(false) } else { Err("staged file is truncated".to_string()) };
            }
            got += n;
        }
        Ok(true)
    }

    fn read_exact_staged(r: &mut impl Read, buf: &mut [u8]) -> Result<(), String> {
        if read_full_or_eof(r, buf)? || buf.is_empty() {
            Ok(())
        } else {
            Err("staged file is truncated".to_string())
        }
    }

    /// Verify a staged copy: decrypt it record by record (bounded memory, length-capped, only
    /// DPAPI-sealed keys accepted) and check it holds exactly `size` bytes with SHA-256 `checksum`.
    pub fn verify(job_id: String, staged_ref: String, size: u64, checksum: String) -> Result<bool, String> {
        let staging = staging_dir(&crate::get_app_data_dir(), &job_id);
        let path = staged_ref.split('/').fold(staging.clone(), |p, c| p.join(c));
        if staged_ref.trim().is_empty() || path == staging || !path_is_contained(&staging, &path) {
            return Err("staged path escapes the job directory".to_string());
        }
        let mut f = BufReader::new(File::open(&path).map_err(|e| format!("open staged file: {e}"))?);
        let mut hasher = Sha256::new();
        let (mut total, mut records) = (0u64, 0u64);
        let mut len4 = [0u8; 4];
        while read_full_or_eof(&mut f, &mut len4)? {
            let key_len = u32::from_le_bytes(len4) as usize;
            if !(1..=SEALED_KEY_MAX).contains(&key_len) {
                return Err("malformed staged record".to_string());
            }
            let mut sealed = vec![0u8; key_len];
            read_exact_staged(&mut f, &mut sealed)?;
            read_exact_staged(&mut f, &mut len4)?;
            let ct_len = u32::from_le_bytes(len4) as usize;
            if !record_lengths_ok(key_len, ct_len) {
                return Err("malformed staged record".to_string());
            }
            let mut ct = vec![0u8; ct_len];
            read_exact_staged(&mut f, &mut ct)?;
            let sealed = String::from_utf8(sealed).map_err(|_| "malformed staged key".to_string())?;
            if !sealed.starts_with(crate::VAULT_DPAPI_PREFIX) {
                return Err("a staged key is not DPAPI-sealed".to_string());
            }
            let key_b64 = crate::open_vault_payload(sealed)?;
            let key_vec = STANDARD.decode(key_b64.trim()).map_err(|_| "malformed staged key".to_string())?;
            let mut key: [u8; 32] = key_vec.try_into().map_err(|_| "malformed staged key".to_string())?;
            let pt = decrypt_chunks(&key, &ct);
            key.fill(0);
            std::hint::black_box(&key);
            let pt = pt.map_err(|e| format!("a staged block failed to decrypt ({e:?})"))?;
            hasher.update(&pt);
            total += pt.len() as u64;
            records += 1;
        }
        if records == 0 {
            return Err("staged file has no records".to_string());
        }
        let hex: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
        Ok(total == size && hex.eq_ignore_ascii_case(checksum.trim()))
    }

    struct Job {
        staging: PathBuf,
        drive: char,
        root: PathBuf,
        staged_bytes: u64,
        used_refs: HashSet<String>,
        entries: Vec<RecoveredEntry>,
        skipped: Vec<SkippedEntry>,
        links: Vec<SkippedEntry>,
        stop: Option<String>,
        cancel: Arc<AtomicBool>,
    }

    impl Job {
        fn skip(&mut self, path: &Path, reason: &str) {
            self.skipped.push(SkippedEntry { path: path.to_string_lossy().into_owned(), reason: reason.to_string() });
        }

        fn link(&mut self, path: &Path) {
            let reason = entry_skip_reason(EntryKind::Link).unwrap_or("link — not followed");
            self.links.push(SkippedEntry { path: path.to_string_lossy().into_owned(), reason: reason.to_string() });
        }

        /// A cancel means the job is being discarded: stop, and never create staging again.
        fn cancelled(&mut self) -> bool {
            if self.cancel.load(Ordering::SeqCst) {
                self.stop = Some(CANCELLED.to_string());
                return true;
            }
            false
        }

        /// Stage one source file, honoring backpressure. Once the job has been stopped
        /// (disk/budget) every later file is only recorded as skipped with the stop reason.
        /// Per-file read failures are skipped with a reason and the job goes on.
        fn add_file(&mut self, src: &Path, size_hint: u64) {
            if self.cancelled() {
                return;
            }
            if let Some(reason) = self.stop.clone() {
                self.skip(src, &reason);
                return;
            }
            if !path_is_contained(&self.root, src) {
                self.skip(src, "outside volume");
                return;
            }
            if let Err(e) = fs::create_dir_all(&self.staging) {
                self.stop = Some("disk full".to_string());
                self.skip(src, &format!("staging unavailable: {e}"));
                return;
            }
            let free = match free_bytes(&self.staging) {
                Ok(f) => f.saturating_sub(DISK_RESERVE),
                Err(e) => {
                    self.stop = Some("disk full".to_string());
                    self.skip(src, &format!("free space unknown: {e}"));
                    return;
                }
            };
            if let Some(reason) = stop_reason(can_stage_next(free, self.staged_bytes, JOB_BUDGET, size_hint)) {
                self.stop = Some(reason.to_string());
                self.skip(src, reason);
                return;
            }
            let base = sanitize_staged_rel(&staged_rel_path(&self.drive.to_string(), src));
            let mut rel = base.clone();
            let mut n = 1u32;
            while !self.used_refs.insert(rel.to_lowercase()) {
                n += 1;
                rel = format!("{base}~{n}");
            }
            let dst = rel.split('/').fold(self.staging.clone(), |p, c| p.join(c));
            if !path_is_contained(&self.staging, &dst) {
                self.skip(src, "internal: staged path escaped the job directory");
                return;
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
                Err(e) => self.skip(src, &format!("unreadable: {e}")),
            }
        }

        /// Judge one entry by its own metadata: walk it, read it, or record why not.
        fn consider(&mut self, path: PathBuf, md: &fs::Metadata, stack: &mut Vec<PathBuf>) {
            match kind_of(md) {
                EntryKind::Link => self.link(&path),
                k @ (EntryKind::CloudOnline | EntryKind::Efs) => {
                    self.skip(&path, entry_skip_reason(k).unwrap_or("not recovered"));
                }
                EntryKind::Normal if md.is_dir() => stack.push(path),
                EntryKind::Normal if md.is_file() => self.add_file(&path, md.len()),
                EntryKind::Normal => self.skip(&path, "not a regular file"),
            }
        }

        /// Walk `dir` read-only (iteratively). Nothing is dropped silently: every entry that is
        /// not read is recorded with a reason.
        fn walk(&mut self, dir: &Path) {
            let mut stack = vec![dir.to_path_buf()];
            while let Some(d) = stack.pop() {
                if self.cancelled() {
                    return;
                }
                let rd = match fs::read_dir(&d) {
                    Ok(rd) => rd,
                    Err(e) => {
                        self.skip(&d, &format!("unreadable folder: {e}"));
                        continue;
                    }
                };
                for entry in rd {
                    if self.cancelled() {
                        return;
                    }
                    let entry = match entry {
                        Ok(e) => e,
                        Err(e) => {
                            self.skip(&d, &format!("unreadable folder entry: {e}"));
                            continue;
                        }
                    };
                    let path = entry.path();
                    match fs::symlink_metadata(&path) {
                        Ok(md) => self.consider(path, &md, &mut stack),
                        Err(e) => self.skip(&path, &format!("unreadable: {e}")),
                    }
                }
            }
        }
    }

    pub fn recover_files(
        job_id: String,
        serial: Option<String>,
        size_bytes: Option<u64>,
        drive_letter: String,
        selection: RecoverSelection,
    ) -> Result<RecoverOutcome, String> {
        if !selection.preset && selection.paths.is_empty() {
            return Err("nothing selected to recover".to_string());
        }
        // Trust boundary: the letter must be a recoverable, non-system volume of THIS device.
        let (drive, root) = bound_root(serial.as_deref(), size_bytes, &drive_letter)?;
        let staging = staging_dir(&crate::get_app_data_dir(), &job_id);
        if staging_on_source(&staging, drive) {
            return Err(format!(
                "the staging folder is on drive {drive}: — the drive being recovered; refusing to write to it"
            ));
        }
        let guard = inflight()
            .begin(&job_key(&job_id))
            .ok_or_else(|| "a recovery is already running for this job".to_string())?;
        let mut job = Job {
            staging,
            drive,
            root: root.clone(),
            staged_bytes: 0,
            used_refs: HashSet::new(),
            entries: Vec::new(),
            skipped: Vec::new(),
            links: Vec::new(),
            stop: None,
            cancel: guard.cancel_flag(),
        };

        // Validate EVERY selected path up front. One that escapes the volume or crosses a link is
        // bad input — a hard Err before anything is staged. One that can't be read is a skip.
        let prefix = format!("{drive}:");
        let mut selected: Vec<(PathBuf, fs::Metadata)> = Vec::new();
        for raw in &selection.paths {
            let s = raw.trim();
            if s.len() < 2 || !s.is_char_boundary(2) || !s[..2].eq_ignore_ascii_case(&prefix) {
                return Err(format!("selected path is not on volume {drive}: {raw}"));
            }
            let candidate = PathBuf::from(format!("{prefix}{}", &s[2..]));
            if !path_is_contained(&root, &candidate) || !chain_has_no_link(&root, &candidate) {
                return Err(format!("selected path is outside the volume or crosses a link: {raw}"));
            }
            match fs::symlink_metadata(&candidate) {
                Ok(md) => selected.push((candidate, md)),
                Err(e) => job.skip(&candidate, &format!("unreadable: {e}")),
            }
        }

        if selection.preset {
            let users = root.join("Users");
            match (users.exists(), chain_has_no_link(&root, &users)) {
                (false, _) => job.skip(&users, "no Windows user profiles on this volume"),
                (true, false) => job.link(&users),
                (true, true) => match dir_names(&users) {
                    Err(e) => job.skip(&users, &e),
                    Ok(profiles) => {
                        for profile in select_preset_profiles(&profiles) {
                            let home = users.join(&profile);
                            let mut folders: Vec<String> = PRESET_FOLDERS.iter().map(|f| f.to_string()).collect();
                            match dir_names(&home) {
                                Ok(names) => folders.extend(onedrive_roots(&names)),
                                Err(e) => job.skip(&home, &e),
                            }
                            for folder in folders {
                                let p = home.join(&folder);
                                if p.exists() && chain_has_no_link(&root, &p) {
                                    job.walk(&p);
                                }
                            }
                        }
                    }
                },
            }
        }

        for (candidate, md) in selected {
            if md.is_dir() {
                job.walk(&candidate);
            } else {
                let mut unused = Vec::new();
                job.consider(candidate, &md, &mut unused);
            }
        }

        drop(guard); // the run is over: a purge may now delete
        let stop = job.stop.take();
        Ok(build_outcome(job.entries, job.skipped, job.links, stop))
    }

    pub fn purge(job_id: String) -> Result<bool, String> {
        if inflight().cancel(&job_key(&job_id)) {
            return Err(
                "a recovery is still running for this job — it has been told to stop; the delete will be retried"
                    .to_string(),
            );
        }
        let dir = staging_dir(&crate::get_app_data_dir(), &job_id);
        if !dir.exists() {
            return Ok(true);
        }
        fs::remove_dir_all(&dir).map_err(|e| format!("could not purge staging: {e}"))?;
        Ok(!dir.exists())
    }

    /// The job folders currently under staging, each with its age (used to purge any the catalog
    /// no longer knows, once they are past retention).
    pub fn list_staged_jobs() -> Result<Vec<StagedJob>, String> {
        let dir = crate::get_app_data_dir().join("aunlock_recovered");
        let rd = match fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(format!("could not list staging: {e}")),
        };
        let mut ages: Vec<(String, Option<u64>)> = Vec::new();
        for entry in rd.filter_map(|e| e.ok()) {
            let Ok(md) = fs::symlink_metadata(entry.path()) else { continue };
            if !md.is_dir() || md.file_type().is_symlink() {
                continue;
            }
            // A future or unreadable timestamp gives no age, so the folder is kept.
            let age = md
                .created()
                .or_else(|_| md.modified())
                .ok()
                .and_then(|t| std::time::SystemTime::now().duration_since(t).ok())
                .map(|d| d.as_secs());
            ages.push((entry.file_name().to_string_lossy().into_owned(), age));
        }
        let names: Vec<String> = ages.iter().map(|(n, _)| n.clone()).collect();
        let valid = staged_job_ids(&names);
        Ok(ages
            .into_iter()
            .filter(|(n, _)| valid.contains(n))
            .map(|(id, age_secs)| StagedJob { id, age_secs })
            .collect())
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
pub async fn aunlock_list_dir(
    serial: Option<String>,
    size_bytes: Option<u64>,
    drive_letter: String,
    subpath: String,
) -> Result<Vec<DirEntryLite>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || imp::list_dir(serial, size_bytes, drive_letter, subpath))
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (serial, size_bytes, drive_letter, subpath);
        off_platform()
    }
}

#[tauri::command]
pub async fn aunlock_recover_files(
    job_id: String,
    serial: Option<String>,
    size_bytes: Option<u64>,
    drive_letter: String,
    selection: RecoverSelection,
) -> Result<RecoverOutcome, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || imp::recover_files(job_id, serial, size_bytes, drive_letter, selection))
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (job_id, serial, size_bytes, drive_letter, selection);
        off_platform()
    }
}

#[tauri::command]
pub async fn aunlock_verify_recovered(job_id: String, staged_ref: String, size: u64, checksum: String) -> Result<bool, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || imp::verify(job_id, staged_ref, size, checksum))
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
        let _ = (job_id, staged_ref, size, checksum);
        off_platform()
    }
}

#[tauri::command]
pub async fn aunlock_list_staged_jobs() -> Result<Vec<StagedJob>, String> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(imp::list_staged_jobs)
            .await
            .map_err(|e| format!("task failed: {e}"))?
    }
    #[cfg(not(windows))]
    {
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
