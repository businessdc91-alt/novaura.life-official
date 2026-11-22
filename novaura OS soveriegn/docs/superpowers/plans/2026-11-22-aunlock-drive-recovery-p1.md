# Aunlock Drive Recovery — Plan 1 (Access + Live Recovery + Staging + Health) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Aunlock's `recover` step real — read-only, owner-authorized recovery of a drive's live files (browse+select and one-click presets) into an encrypted on-disk staging tree, with SMART health and retention that truly deletes the bytes.

**Architecture:** New Rust `aunlock_recover.rs` (thin Tauri I/O shell) over a pure, unit-tested `aunlock_recover_rules.rs` (read-only-PowerShell guard, health/volume parsing, refusal + preset selection + path-safety + backpressure predicates, streaming-AEAD frame format). JS orchestrates through the existing `controller.recover` seam; a new `nativeRecover.js` bridge invokes the Rust commands; `catalog.putRecovered` gains fields; `discardJob`/retention sweep call a new `purgeRecovered` so on-disk bytes die with the rows. The spawn / raw-FS / DPAPI lines CI can't cover are proven by one gated live check (like the device bridge's live check).

**Tech Stack:** Tauri 2 (Rust, edition 2024, rust-version 1.90), React/Vite, Dexie. New Rust crate: `chacha20poly1305` (RustCrypto, permissive license). Existing: `sha2` (checksums), `windows-sys` DPAPI (`seal_vault_payload`), `tokio`.

**Spec:** novaura OS soveriegn/docs/superpowers/specs/2026-11-22-aunlock-drive-recovery-design.md (parent: .../2026-11-19-aunlock-nova-design.md)

## Global Constraints

- **Sovereign only — never touch `NovAura-WebOS/`.** All native code in `novaura OS soveriegn/src-tauri/`, all JS in `novaura OS soveriegn/src/`.
- **Read-only source, always.** The owner's device is never opened for write, mounted-for-write, or modified. Every PowerShell query passes the read-only allowlist guard (fail-closed); file access uses read-only opens.
- **HARD BOUNDARY: no lock circumvention.** An encrypted (BitLocker/`lock==encrypted`), RAW, or non-mountable volume is **refused and routed to reclaim**, never force-opened and never a silent empty success.
- **Encrypted at rest.** Recovered bytes are encrypted on disk with a streaming AEAD; the per-file key is DPAPI-sealed. No whole file is loaded into memory.
- **Retention ≤10 days / 3 most-recent jobs, with REAL on-disk byte deletion** on purge/expiry/discard — not just Dexie rows.
- **No KB/size caps.** Multi-GB files stream in chunks; a free-space + per-job byte budget provides backpressure and stops cleanly rather than filling the host disk.
- **Native by default** (no GPL/third-party engines in Plan 1).
- Commit attribution, every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Test commands: JS — `node --experimental-test-module-mocks --test "tests/**/*.test.mjs"` (a single file: `node --experimental-test-module-mocks --test tests/aunlock/<f>.test.mjs`). Rust — `npm run tauri:test`.

## Review Focus

- **Read-only source never written** — happy-path copy tests don't prove the source is untouched: Task 1 (every PS query passes the read-only guard; no write cmdlet is allowlisted) and Task 10 (live check asserts source volume contents + mtimes unchanged after a recover).
- **Reparse points / symlinks / junctions** on the source followed off-scope or off-volume — Task 3 (`should_skip_reparse` skips them; `path_is_contained` rejects `..`-escape for both source walk and staged write).
- **Encrypted/locked/RAW volume refusal actually fires** (not a silent empty "recovered") — Task 2 (`volume_is_recoverable` false for encrypted/RAW/unknown-FS) + Task 7 (controller refuses `lockState==='encrypted'` with a reclaim reason) + Task 10 (live check on a BitLocker volume).
- **Retention deletes on-disk bytes, not just rows** — Task 8 (`discardJob` and the sweep call `native.purgeRecovered(jobId)`) + Task 10 (live check: staging dir gone after discard/expiry).
- **Recovered file contents never logged or stored inline** — Task 7 (recovered rows carry only `{jobId,path,size,stagedRef,sourceType,checksum}` — no contents field; a surfaced native error is redacted via the flight recorder, not raw).
- **Host disk exhaustion / malformed directory structures** — Task 3 (`can_stage_next` → `StopDisk`/`StopBudget`) + Task 1 (`normalize_health`/`resolve_volumes` tolerate garbage JSON without panicking).

---

### Task 1: Pure rules — read-only PowerShell guard + SMART health normalization

**Files:**
- Create: `src-tauri/src/aunlock_recover_rules.rs`
- Test: inline `#[cfg(test)] mod tests` in the same file (pattern of `aunlock_devices_rules.rs`)

**Interfaces:**
- Produces: `pub const AUNLOCK_HEALTH_QUERY: &str`; `pub fn recover_query_is_read_only(query: &str) -> bool`; `pub fn normalize_health(json: &str) -> HealthReport`; `pub struct HealthReport { pub status: String, pub temperature_c: Option<i64>, pub power_on_hours: Option<u64>, pub reallocated_sectors: Option<u64>, pub wear_pct: Option<u8>, pub source: String }` (`#[serde(rename_all = "camelCase")]`, `status ∈ ok|warn|fail|unknown`, deny-by-default `unknown`).
- `recover_query_is_read_only` is `aunlock_devices_rules::query_is_read_only`'s allowlist widened to: `Get-PhysicalDisk, Get-StorageReliabilityCounter, Get-Disk, Get-Partition, Get-Volume, ConvertTo-Json` (reuse the `is_cmdlet_shaped` logic + `'>'` redirection ban). `AUNLOCK_HEALTH_QUERY` reads health via `Get-PhysicalDisk`/`Get-StorageReliabilityCounter`/`Get-Disk` (HealthStatus, Temperature, Wear, PowerOnHours, ReallocatedSectors) and `ConvertTo-Json -Compress`.

- [ ] **Step 1: Write failing tests**

```rust
#[test] fn health_query_passes_read_only_guard() { assert!(recover_query_is_read_only(AUNLOCK_HEALTH_QUERY)); }
#[test] fn guard_rejects_a_write_cmdlet() {
    assert!(!recover_query_is_read_only("Get-Disk | Set-Volume -NewFileSystemLabel x | ConvertTo-Json"));
    assert!(!recover_query_is_read_only("Get-Disk > c:\\x.json"));
}
#[test] fn normalize_health_reads_counters() {
    let j = r#"[{"HealthStatus":"Healthy","Temperature":34,"PowerOnHours":1200,"ReallocatedSectors":0,"Wear":5}]"#;
    let h = normalize_health(j);
    assert_eq!(h.status, "ok"); assert_eq!(h.temperature_c, Some(34)); assert_eq!(h.wear_pct, Some(5));
}
#[test] fn normalize_health_garbage_is_unknown_no_panic() {
    assert_eq!(normalize_health("not json").status, "unknown");
    assert_eq!(normalize_health("").status, "unknown");
}
#[test] fn normalize_health_maps_failing() {
    assert_eq!(normalize_health(r#"[{"HealthStatus":"Unhealthy"}]"#).status, "fail");
    assert_eq!(normalize_health(r#"[{"HealthStatus":"Warning"}]"#).status, "warn");
}
```

- [ ] **Step 2: Run tests, verify they fail** — `npm run tauri:test` → FAIL (module/functions missing).
- [ ] **Step 3: Implement** `recover_query_is_read_only`, `AUNLOCK_HEALTH_QUERY`, `HealthReport`, `normalize_health` in `aunlock_recover_rules.rs`. Map `HealthStatus`: Healthy→ok, Warning→warn, Unhealthy→fail, else unknown. Tolerate array or bare object or garbage (mirror `normalize_devices`).
- [ ] **Step 4: Run tests, verify pass** — `npm run tauri:test` → PASS.
- [ ] **Step 5: Commit** — `git add src-tauri/src/aunlock_recover_rules.rs && git commit`.

---

### Task 2: Pure rules — volume resolution, refusal predicate, preset selection

**Files:**
- Modify: `src-tauri/src/aunlock_recover_rules.rs`

**Interfaces:**
- Produces: `pub const AUNLOCK_VOLUMES_QUERY: &str` (read-only: `Get-Disk | Get-Partition | Get-Volume`, projecting per-volume `{Serial, DiskSize, DriveLetter, FileSystem, FileSystemLabel, VolumeSize, Encrypted}`; passes `recover_query_is_read_only`). `pub struct VolumeSpec { pub drive_letter: Option<String>, pub fs_type: Option<String>, pub label: Option<String>, pub size_bytes: Option<u64>, pub encrypted: bool, pub readable: bool }` (camelCase). `pub fn resolve_volumes(json: &str, serial: Option<&str>, size_bytes: Option<u64>) -> Vec<VolumeSpec>` (matches disks by serial, else by size; never injects the serial into PowerShell — matching is here, in Rust). `pub fn volume_is_recoverable(v: &VolumeSpec) -> bool`. `pub const PRESET_FOLDERS: [&str; 8]` = Desktop, Documents, Downloads, Pictures, Videos, Music, Favorites, Links. `pub fn select_preset_profiles(entries: &[String]) -> Vec<String>`.
- Consumes: Task 1's module.

- [ ] **Step 1: Write failing tests**

```rust
#[test] fn volumes_query_is_read_only() { assert!(recover_query_is_read_only(AUNLOCK_VOLUMES_QUERY)); }
#[test] fn resolve_matches_by_serial() {
    let j = r#"[{"Serial":"WD-ABC123","DriveLetter":"E","FileSystem":"NTFS","VolumeSize":500000,"Encrypted":false}]"#;
    let v = resolve_volumes(j, Some("WD-ABC123"), None);
    assert_eq!(v.len(), 1); assert_eq!(v[0].drive_letter.as_deref(), Some("E")); assert_eq!(v[0].readable, true);
}
#[test] fn recoverable_rejects_encrypted_and_raw() {
    assert!(!volume_is_recoverable(&VolumeSpec{drive_letter:Some("E".into()),fs_type:Some("NTFS".into()),label:None,size_bytes:None,encrypted:true,readable:true}));
    assert!(!volume_is_recoverable(&VolumeSpec{drive_letter:Some("E".into()),fs_type:Some("RAW".into()),label:None,size_bytes:None,encrypted:false,readable:true}));
    assert!(volume_is_recoverable(&VolumeSpec{drive_letter:Some("E".into()),fs_type:Some("exFAT".into()),label:None,size_bytes:None,encrypted:false,readable:true}));
}
#[test] fn preset_profiles_exclude_system_and_default() {
    let got = select_preset_profiles(&["sam".into(),"Default".into(),"Default User".into(),"All Users".into(),"Public".into(),"systemprofile".into()]);
    assert_eq!(got, vec!["sam".to_string(), "Public".to_string()]);
}
```

- [ ] **Step 2: Run, verify fail** — `npm run tauri:test` → FAIL.
- [ ] **Step 3: Implement.** `volume_is_recoverable`: `!encrypted && readable && fs_type ∈ {NTFS,exFAT,FAT32,FAT}` (case-insensitive). `resolve_volumes`: tolerant parse, `readable = fs_type is a known mountable FS`, `encrypted` from the flag (deny-by-default: a missing/null encrypted flag ⇒ `readable=false` so it is refused). `select_preset_profiles`: keep profile dir names except `Default`, `Default User`, `All Users`, `systemprofile`, `defaultuser0` (case-insensitive); keep `Public`.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 3: Pure rules — path containment, reparse guard, backpressure, staging paths

**Files:**
- Modify: `src-tauri/src/aunlock_recover_rules.rs`

**Interfaces:**
- Produces: `pub fn path_is_contained(base: &std::path::Path, candidate: &std::path::Path) -> bool` (lexical, after normalizing `.`/`..`; a candidate that escapes `base` is false). `pub fn should_skip_reparse(is_symlink: bool, is_reparse_point: bool) -> bool`. `pub enum StageDecision { Proceed, StopBudget, StopDisk }` + `pub fn can_stage_next(free_bytes: u64, staged_bytes: u64, budget_bytes: u64, next_size: u64) -> StageDecision`. `pub fn staging_dir(app_data: &std::path::Path, job_id: &str) -> std::path::PathBuf` (= `app_data/aunlock_recovered/<job_id>`, `job_id` sanitized to `[A-Za-z0-9_]`). `pub fn staged_rel_path(drive_letter: &str, source: &std::path::Path) -> String`.

- [ ] **Step 1: Write failing tests**

```rust
#[test] fn contained_rejects_parent_escape() {
    let base = Path::new("E:/Users/sam");
    assert!(path_is_contained(base, Path::new("E:/Users/sam/Documents/a.txt")));
    assert!(!path_is_contained(base, Path::new("E:/Users/sam/../Administrator/secret")));
}
#[test] fn reparse_points_are_skipped() {
    assert!(should_skip_reparse(true, false));
    assert!(should_skip_reparse(false, true));
    assert!(!should_skip_reparse(false, false));
}
#[test] fn backpressure_stops_on_disk_and_budget() {
    assert!(matches!(can_stage_next(1000, 0, 10_000, 100), StageDecision::Proceed));
    assert!(matches!(can_stage_next(50, 0, 10_000, 100), StageDecision::StopDisk));
    assert!(matches!(can_stage_next(10_000, 9_950, 10_000, 100), StageDecision::StopBudget));
}
#[test] fn staging_dir_sanitizes_job_id() {
    let p = staging_dir(Path::new("C:/data"), "job_1_../../x");
    assert!(p.ends_with("aunlock_recovered/job_1______x") || !p.to_string_lossy().contains(".."));
}
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement.** `can_stage_next`: `StopDisk` when `free_bytes < next_size + SAFETY_MARGIN`; `StopBudget` when `staged_bytes + next_size > budget_bytes`; else `Proceed` (check disk first). `path_is_contained`: compare normalized component paths. `staging_dir`: replace every char not `[A-Za-z0-9_]` in `job_id` with `_`.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 4: Pure rules — streaming AEAD frame format (encrypt/decrypt + truncation detection)

**Files:**
- Modify: `src-tauri/src/aunlock_recover_rules.rs`
- Modify: `src-tauri/Cargo.toml` (add `chacha20poly1305`)

**Interfaces:**
- Produces: `pub const FRAME_SIZE: usize = 65536;` `pub fn encrypt_chunks(key: &[u8; 32], plaintext: &[u8]) -> Vec<u8>` (frames plaintext into `FRAME_SIZE` chunks; each frame AEAD-sealed with a per-frame nonce = 4-byte random prefix ⊕ 8-byte LE counter, and the final frame tagged via AAD `b"last"` vs `b"more"`). `pub fn decrypt_chunks(key: &[u8; 32], sealed: &[u8]) -> Result<Vec<u8>, CryptoError>` (rejects a stream whose last frame is not tagged `last` ⇒ truncation). `pub enum CryptoError { Tag, Truncated, Format }`.

- [ ] **Step 1: Add dependency** — in `Cargo.toml` `[dependencies]`: `chacha20poly1305 = { version = "0.10.1", features = ["std"] }` (use its re-exported `aead::OsRng`/`getrandom` for the random key + nonce prefix; implementer confirms the exact feature name against the pinned version).
- [ ] **Step 2: Write failing tests**

```rust
#[test] fn encrypt_then_decrypt_round_trips() {
    let key = [7u8;32]; let data = vec![9u8; FRAME_SIZE*2 + 123];
    assert_eq!(decrypt_chunks(&key, &encrypt_chunks(&key, &data)).unwrap(), data);
}
#[test] fn empty_plaintext_round_trips() {
    let key=[1u8;32]; assert_eq!(decrypt_chunks(&key, &encrypt_chunks(&key, &[])).unwrap(), Vec::<u8>::new());
}
#[test] fn dropping_the_last_frame_is_detected() {
    let key=[3u8;32]; let data=vec![5u8; FRAME_SIZE*3];
    let sealed = encrypt_chunks(&key,&data);
    let truncated = &sealed[..sealed.len() - FRAME_SIZE/2]; // chop the tail
    assert!(matches!(decrypt_chunks(&key, truncated), Err(CryptoError::Truncated) | Err(CryptoError::Format) | Err(CryptoError::Tag)));
}
#[test] fn wrong_key_fails_tag() {
    let data=vec![2u8; 100]; let sealed=encrypt_chunks(&[4u8;32], &data);
    assert!(matches!(decrypt_chunks(&[5u8;32], &sealed), Err(CryptoError::Tag) | Err(CryptoError::Format)));
}
```

- [ ] **Step 3: Run, verify fail** — `npm run tauri:test` → FAIL.
- [ ] **Step 4: Implement** the frame writer/reader with `ChaCha20Poly1305`. Each sealed frame = `len(4 LE) || ciphertext+tag`; header = `nonce_prefix(4)`. Last frame AAD `b"last"`; others `b"more"`. `decrypt_chunks` fails `Truncated` if it reaches the end without a `last`-tagged frame.
- [ ] **Step 5: Run, verify pass.**
- [ ] **Step 6: Commit.**

---

### Task 5: Rust I/O shell — recover commands + registration (gated live check)

**Files:**
- Create: `src-tauri/src/aunlock_recover.rs`
- Modify: `src-tauri/src/lib.rs` (add `pub mod aunlock_recover;` near line 10; register commands in `generate_handler!` after `aunlock_devices::aunlock_enumerate_devices`)
- Create: `docs/superpowers/live-checks/aunlock-drive-recovery.md` (the gated manual check — see Task 10)

**Interfaces:**
- Produces Tauri commands (all `#[tauri::command] pub async fn`, `Result<_, String>`, `#[cfg(windows)]` real / non-windows stub returning an off-platform `Err`):
  - `aunlock_read_health(serial: Option<String>, size_bytes: Option<u64>) -> Result<HealthReport, String>`
  - `aunlock_resolve_volumes(serial: Option<String>, size_bytes: Option<u64>) -> Result<Vec<VolumeSpec>, String>`
  - `aunlock_list_dir(drive_letter: String, subpath: String) -> Result<Vec<DirEntryLite>, String>` (`DirEntryLite { name, is_dir, size }`; read-only; skips reparse points via `should_skip_reparse`; rejects a `subpath` that escapes the volume root via `path_is_contained`)
  - `aunlock_recover_files(job_id: String, drive_letter: String, selection: RecoverSelection) -> Result<Vec<RecoveredEntry>, String>` (`RecoverSelection { preset: bool, paths: Vec<String> }`; `RecoveredEntry { path, size, staged_ref, source_type, checksum }`, `source_type="live"`)
  - `aunlock_purge_recovered(job_id: String) -> Result<bool, String>` (removes `staging_dir(get_app_data_dir(), &job_id)` recursively; absent tree ⇒ `Ok(true)`)
- Consumes: Tasks 1–4 (all pure fns), `get_app_data_dir`, `seal_vault_payload` (seal the per-file 32-byte key, base64), `sha2::Sha256` (checksum of source while streaming), the `recover_query_is_read_only` guard before every spawn (fail-closed).

- [ ] **Step 1:** Spawn health/volumes via PowerShell exactly as `aunlock_devices.rs` does (`-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command`), guarded by `recover_query_is_read_only(..)` → `Err` if it ever fails. Parse with Task 1/2 pure fns.
- [ ] **Step 2:** `aunlock_recover_files`: resolve staging via `staging_dir`; for preset, list `<drive>:\Users`, `select_preset_profiles`, join `PRESET_FOLDERS`, walk each existing folder read-only; for `paths`, validate each with `path_is_contained` against the volume root. Per file: `can_stage_next` gate → open source **read-only** → stream through `Sha256` + `encrypt_chunks` frames (generate a random key, `seal_vault_payload` it, write sealed key + ciphertext to `staged_ref`) → push `RecoveredEntry`. Never read a whole file into memory (frame-at-a-time).
- [ ] **Step 3:** Register the five commands and `pub mod aunlock_recover;`. Build: `npm run tauri:test` compiles and all Task 1–4 tests still pass.
- [ ] **Step 4 (verification — gated live check):** write `docs/superpowers/live-checks/aunlock-drive-recovery.md` describing the manual run (Task 10's checklist). CI cannot drive real hardware; this file is the proof obligation. Mark the task's automated portion done when `npm run tauri:test` is green (compile + pure tests); the live check is run at Task 10.
- [ ] **Step 5: Commit** — `git add src-tauri/src/aunlock_recover.rs src-tauri/src/lib.rs docs/superpowers/live-checks/aunlock-drive-recovery.md && git commit`.

---

### Task 6: JS native bridge — `nativeRecover.js`

**Files:**
- Create: `src/services/aunlock/nativeRecover.js`
- Test: `tests/aunlock/nativeRecover.test.mjs`

**Interfaces:**
- Produces: `export function createNativeRecover({ invoke, isTauri }) -> { readHealth(device), resolveVolumes(device), listDir(driveLetter, subpath), recoverFiles(jobId, driveLetter, selection), purgeRecovered(jobId) }`. Each maps a device record's `serial`/`sizeBytes` to the command args and `invoke(...)`; off-desktop (`!isTauri()`) it **throws** `'Drive recovery runs in the Sovereign desktop app.'` (mirrors `nativeDevices.js`).
- Consumes: Task 5 command names/shapes.

- [ ] **Step 1: Write failing tests** — with a fake `invoke` spy and `isTauri: () => true`: `resolveVolumes({serial:'WD-ABC123'})` calls `invoke('aunlock_resolve_volumes', {serial:'WD-ABC123', sizeBytes: null})`; `purgeRecovered('job_1')` calls `invoke('aunlock_purge_recovered',{jobId:'job_1'})`; with `isTauri: () => false`, every method rejects.
- [ ] **Step 2: Run, verify fail** — `node --experimental-test-module-mocks --test tests/aunlock/nativeRecover.test.mjs`.
- [ ] **Step 3: Implement** `createNativeRecover`.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 7: Catalog + controller wiring — recovery with staged manifest, health, browse, volumes

**Files:**
- Modify: `src/services/aunlock/catalog.js` (recovered row shape — no schema change)
- Modify: `src/services/aunlock/controller.js`
- Test: `tests/aunlock/recoverController.test.mjs`

**Interfaces:**
- `putRecovered(entry)` now persists `{ jobId, path, size, stagedRef, sourceType, checksum }` (same compound key `[jobId,path]`; extra fields are non-indexed — no DB version bump).
- Controller `createController({ catalog, native, ... })` where `native` gains `{ readHealth, resolveVolumes, listDir, recoverFiles, purgeRecovered }` (plus existing `enumerate, recover?, wipe`). New methods:
  - `readHealth(jobId) -> { ok, health } | { ok:false, reason }`
  - `listVolumes(jobId) -> { ok, volumes } | { ok:false, reason }` — refuses when `device.lockState==='encrypted'` with the reclaim reason.
  - `browse(jobId, { driveLetter, subpath }) -> { ok, entries }`
  - `recover(jobId, { driveLetter=null, selection={preset:true} } = {})` — gate → device → refuse `lockState==='encrypted'` (reclaim reason). When `driveLetter` is set, recover from that one volume; when `null` (one-click preset), call `native.resolveVolumes(device)` then recover from **each** volume for which `volume_is_recoverable`, aggregating the manifest. For every entry `catalog.putRecovered({ jobId, ...entry })`; then `setStatus(jobId,'recovered')` → `{ ok:true, manifest }`. If no recoverable volume exists, return `{ ok:false, reason }` (reclaim note).
- `getController()` wires `createNativeRecover({ invoke: tauriInvoke, isTauri })` into the `native` object.

- [ ] **Step 1: Write failing tests** (fake catalog + fake native):
  - `recover` with an encrypted device returns `{ok:false}` and its reason mentions reclaim; `native.recoverFiles` is **not** called.
  - `recover` on a clean device writes one recovered row per manifest entry, each carrying `stagedRef` and `sourceType:'live'`, and sets status `recovered`.
  - recovered rows contain **no** `contents`/`bytes` field (contents never stored inline).
  - `listVolumes` on an encrypted device refuses; on a clean device returns `native.resolveVolumes`' list.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the catalog field pass-through and the controller methods.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 8: Retention byte-deletion — `purgeRecovered` wired into discard + sweep

**Files:**
- Modify: `src/services/aunlock/controller.js`
- Test: `tests/aunlock/retentionPurge.test.mjs`

**Interfaces:**
- Consumes: `native.purgeRecovered(jobId)` (Task 6), `catalog.deleteJobCascade` (existing), `jobsToPurge` (existing).
- `discardJob(jobId)` and the internal `sweep()` now call `native.purgeRecovered(jobId)` for each dropped job **in addition to** `catalog.deleteJobCascade(jobId)`.

- [ ] **Step 1: Write failing tests** — a fake native recording `purgeRecovered` calls: `discardJob('job_x')` calls `purgeRecovered('job_x')` and `deleteJobCascade('job_x')`; `newJob()` over a job list that is past the window purges the expired job's bytes (`purgeRecovered` called with its id). A `purgeRecovered` that rejects must not abort the DB cascade (bytes-purge failure is logged, rows still removed).
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — call `purgeRecovered` (guarded by try/catch so a missing-tree/reject can't block row cleanup) alongside `deleteJobCascade` in `sweep` and `discardJob`.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 9: Recovery panel view-model — `recoveryPanel.js`

**Files:**
- Create: `src/services/aunlock/recoveryPanel.js`
- Test: `tests/aunlock/recoveryPanel.test.mjs`

**Interfaces:**
- Produces (all pure): `describeHealth(health) -> { label, tone }` (tone ∈ ok|warn|fail|unknown; label e.g. `"Healthy · 34°C · 1200 h"`); `describeVolumes(volumes) -> { rows }` (`row { driveLetter, label, sub, recoverable, reason }`, `recoverable` mirrors `volume_is_recoverable`, `reason` set to a reclaim note when encrypted/RAW); `describeDirEntries(entries) -> { rows }` (dirs first, then files; each `{ name, isDir, size, humanSize }`); `describeStaged(recovered) -> { rows, totalBytes }`.
- Consumes: the shapes from Tasks 5/7.

- [ ] **Step 1: Write failing tests** — encrypted volume row is `recoverable:false` with a reclaim `reason`; `describeHealth` maps `status:'fail'` to `tone:'fail'`; `describeStaged` sums sizes.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**

---

### Task 10: Recovery UI in `AunlockWindow` + run the gated live check

**Files:**
- Modify: `src/components/windows/AunlockWindow.jsx` (extend `JobPanel`)
- Modify: `docs/superpowers/live-checks/aunlock-drive-recovery.md` (record the run)

**Interfaces:**
- Consumes: `controller.readHealth/listVolumes/browse/recover`, `recoveryPanel.js` describers. The UI is a thin consumer — its logic lives in the tested view-model (Task 9) and controller (Task 7).

- [ ] **Step 1:** Add to `JobPanel`: a **health banner** (from `readHealth`), a **volumes list** (from `listVolumes`; non-recoverable rows show the reclaim note, disabled), a **browse tree** (`browse` + `describeDirEntries`, click to descend, checkbox select), **preset buttons** ("Recover user files" → `recover(jobId,{driveLetter,selection:{preset:true}})`) and a **selected-recover** button (`selection:{paths}`), and a **staged-results list** (`listRecovered` + `describeStaged`, with per-file verify/progress). Keep the existing authorization + scan/intake flow.
- [ ] **Step 2: Verify build** — `npm run build` (vite) succeeds; `node --experimental-test-module-mocks --test "tests/**/*.test.mjs"` green.
- [ ] **Step 3: Gated live check** (manual, in the installed desktop build): attach a known **unencrypted** USB/adapter drive → intake → authorize → read health → list volumes → browse → preset-recover → confirm staged files decrypt+verify → **discard** and confirm the on-disk `aunlock_recovered/<jobId>` tree is gone → attach a **BitLocker-locked** volume and confirm it is **refused/reclaim**, not recovered → confirm the **source drive's files + mtimes are unchanged**. Record results + the app build date in the live-check doc (all Sovereign builds carry version 1.0.0, so compare `app.exe` dates to confirm you are on the freshly built binary, not a stale installer).
- [ ] **Step 4: Commit** — `git add src/components/windows/AunlockWindow.jsx docs/superpowers/live-checks/aunlock-drive-recovery.md && git commit`.

---

## Self-review notes

- **Spec coverage:** read-only access + refusal (T2,T5,T7,T10), SMART health (T1,T5,T9,T10), browse+select + presets (T2,T5,T7,T9,T10), encrypted streaming staging (T3,T4,T5), manifest + `stagedRef`/`sourceType` (T5,T7), verify (T5 checksum, T10), backpressure/no-caps (T3,T5), native.recover wiring (T6,T7), retention byte-deletion (T8), UI panel (T9,T10). Imaging/non-Windows-FS/carving/partition/RAID/device-class are **out** (later plans) — none appear here.
- **Type consistency:** `VolumeSpec`/`HealthReport`/`RecoveredEntry`/`DirEntryLite` names identical across Rust (T1–T5) and the JS bridge/view-model (T6,T7,T9); `volume_is_recoverable` logic appears once (Rust) and is mirrored read-only in `describeVolumes`.
- **Proportion:** bodies are omitted; steps carry signatures, test names, and assertions only.
- **Review Focus:** every item above is pinned to a task's test or the gated live check.
