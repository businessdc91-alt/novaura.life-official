//! Pure, Tauri-free rules for Aunlock drive recovery (Plan 1). No I/O here, so
//! `npm run tauri:test` can run it; the Tauri shell that spawns PowerShell lives elsewhere.
//!
//! Same house style as `aunlock_devices_rules`: a fail-closed read-only allowlist guard for
//! PowerShell, and tolerant, deny-by-default JSON normalization that never panics.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Component, Path, PathBuf};

/// Read-only PowerShell query for drive health (SMART-ish counters). Only reads state; the
/// `health_query_passes_read_only_guard` test keeps it inside the allowlist. Fields a drive does
/// not expose come back null and normalize to `None` / "unknown" (deny-by-default).
pub const AUNLOCK_HEALTH_QUERY: &str = r#"$ErrorActionPreference='SilentlyContinue';
$out=foreach($p in (Get-PhysicalDisk)){
  $r=$p | Get-StorageReliabilityCounter;
  $h=[string]$p.HealthStatus;
  if(-not $h){ $h=[string]((Get-Disk -Number $p.DeviceId).HealthStatus) }
  [pscustomobject]@{
    Serial=[string]$p.SerialNumber;
    HealthStatus=$h;
    Temperature=$r.Temperature;
    Wear=$r.Wear;
    PowerOnHours=$r.PowerOnHours;
    ReallocatedSectors=$null
  }
}
@($out) | ConvertTo-Json -Depth 3 -Compress"#;

/// Whether a PowerShell query is strictly read-only: every `Verb-Noun` cmdlet it names is on the
/// allowlist and it contains no `>` redirection. ALLOWLIST, fail-closed: any other cmdlet
/// (`Set-Volume`, `Out-File`, ...) makes this false.
///
/// Assumes CONSTANT, developer-authored queries (the hardcoded `AUNLOCK_*` constants): it is a
/// code-review tripwire, NOT a sanitizer for untrusted input. Never pass user-supplied text to
/// the PowerShell `-Command`. Cmdlet matching is case-insensitive because PowerShell is.
pub fn recover_query_is_read_only(query: &str) -> bool {
    const ALLOWED: [&str; 7] = [
        "Get-PhysicalDisk",
        "Get-BitLockerVolume",
        "Get-StorageReliabilityCounter",
        "Get-Disk",
        "Get-Partition",
        "Get-Volume",
        "ConvertTo-Json",
    ];
    if query.contains('>') {
        return false; // no output redirection to a file
    }
    query
        .split(|c: char| !(c.is_ascii_alphanumeric() || c == '-'))
        .filter(|tok| is_cmdlet_shaped(tok))
        .all(|tok| ALLOWED.iter().any(|a| a.eq_ignore_ascii_case(tok)))
}

/// A token shaped like a cmdlet (`Verb-Noun`): letter-initial alphabetic verb, one dash,
/// letter-initial alphanumeric noun. Parameters (`-Depth`) and members (`HealthStatus`) are not.
fn is_cmdlet_shaped(tok: &str) -> bool {
    match tok.split_once('-') {
        Some((verb, noun)) => {
            !verb.is_empty()
                && verb.chars().next().is_some_and(|c| c.is_ascii_alphabetic())
                && verb.chars().all(|c| c.is_ascii_alphabetic())
                && !noun.is_empty()
                && noun.chars().next().is_some_and(|c| c.is_ascii_alphabetic())
                && !noun.contains('-')
                && noun.chars().all(|c| c.is_ascii_alphanumeric())
        }
        None => false,
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HealthReport {
    /// `ok` | `warn` | `fail` | `unknown` (deny-by-default).
    pub status: String,
    pub temperature_c: Option<i64>,
    pub power_on_hours: Option<u64>,
    pub reallocated_sectors: Option<u64>,
    pub wear_pct: Option<u8>,
    pub source: String,
}

fn unknown_report() -> HealthReport {
    HealthReport {
        status: "unknown".to_string(),
        temperature_c: None,
        power_on_hours: None,
        reallocated_sectors: None,
        wear_pct: None,
        source: "none".to_string(),
    }
}

/// Healthy -> ok, Warning -> warn, Unhealthy -> fail, anything else -> unknown.
fn norm_health_status(o: &Value) -> &'static str {
    match o.get("HealthStatus").and_then(Value::as_str).map(str::trim) {
        Some(s) if s.eq_ignore_ascii_case("healthy") => "ok",
        Some(s) if s.eq_ignore_ascii_case("warning") => "warn",
        Some(s) if s.eq_ignore_ascii_case("unhealthy") => "fail",
        _ => "unknown",
    }
}

/// Severity for picking the worst disk: fail > warn > ok > unknown. A known problem outranks
/// everything; a known-ok disk outranks an unknown one.
fn severity(status: &str) -> u8 {
    match status {
        "fail" => 3,
        "warn" => 2,
        "ok" => 1,
        _ => 0,
    }
}

fn opt_u64(o: &Value, key: &str) -> Option<u64> {
    o.get(key).and_then(Value::as_u64)
}

/// Parse the health payload. Tolerates an array (reports the worst disk), a bare object, or
/// garbage (-> status "unknown"). Never panics.
pub fn normalize_health(json: &str) -> HealthReport {
    normalize_health_for(json, None)
}

/// Like `normalize_health`, but when `serial` (trimmed, case-insensitive) matches a disk's
/// `Serial`, report THAT disk. With no serial or no match, fall back to the machine-worst disk.
pub fn normalize_health_for(json: &str, serial: Option<&str>) -> HealthReport {
    let val: Value = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return unknown_report(),
    };
    let items: Vec<&Value> = match &val {
        Value::Array(arr) => arr.iter().filter(|v| v.is_object()).collect(),
        Value::Object(_) => vec![&val],
        _ => Vec::new(),
    };
    let want = serial.map(str::trim).filter(|s| !s.is_empty());
    if let Some(w) = want {
        if let Some(o) = items
            .iter()
            .find(|o| non_empty_str(o, "Serial").is_some_and(|s| s.eq_ignore_ascii_case(w)))
        {
            return report_from(o, norm_health_status(o));
        }
    }
    let mut worst: Option<(&Value, &'static str)> = None;
    for o in items {
        let s = norm_health_status(o);
        if worst.map_or(true, |(_, ws)| severity(s) > severity(ws)) {
            worst = Some((o, s));
        }
    }
    let Some((o, status)) = worst else {
        return unknown_report();
    };
    report_from(o, status)
}

fn report_from(o: &Value, status: &str) -> HealthReport {
    HealthReport {
        status: status.to_string(),
        temperature_c: o.get("Temperature").and_then(|t| {
            t.as_i64().or_else(|| {
                t.as_f64()
                    .filter(|f| f.is_finite())
                    .map(|f| f.round() as i64)
            })
        }),
        power_on_hours: opt_u64(o, "PowerOnHours"),
        reallocated_sectors: opt_u64(o, "ReallocatedSectors"),
        wear_pct: opt_u64(o, "Wear")
            .and_then(|w| u8::try_from(w).ok())
            .filter(|w| *w <= 100),
        source: "powershell".to_string(),
    }
}

/// Read-only PowerShell query listing every volume with its parent disk's serial/size. It is a
/// CONSTANT: the target serial/size is NEVER interpolated here; `resolve_volumes` filters in Rust.
///
/// `Encrypted` comes from REAL BitLocker status (`Get-BitLockerVolume`, keyed by drive letter):
/// a record whose `VolumeStatus` is not `FullyDecrypted`, or whose `LockStatus` is `Locked`, =>
/// `true` (covers suspended-protection volumes, which still hold encrypted data, and locked ones);
/// only a `FullyDecrypted` volume is `false`. `ProtectionStatus` is deliberately NOT used. It is
/// never inferred from the filesystem. A volume with no BitLocker record (cmdlet missing/blocked,
/// no drive letter) gets `null`, which `resolve_volumes` treats as NOT recoverable
/// (deny-by-default).
pub const AUNLOCK_VOLUMES_QUERY: &str = r#"$ErrorActionPreference='SilentlyContinue';
$enc=@{};
foreach($b in (Get-BitLockerVolume)){
  $m=([string]$b.MountPoint).TrimEnd(':').ToUpper();
  if($m){ $enc[$m]=(([string]$b.VolumeStatus -ne 'FullyDecrypted') -or ([string]$b.LockStatus -eq 'Locked')) }
}
$out=foreach($d in (Get-Disk)){
  foreach($p in (Get-Partition -DiskNumber $d.Number)){
    $v=$p | Get-Volume;
    $fs=[string]$v.FileSystem;
    $k=([string]$p.DriveLetter).ToUpper();
    $e=$null;
    if($k -and $enc.ContainsKey($k)){ $e=$enc[$k] }
    [pscustomobject]@{
      Serial=[string]$d.SerialNumber;
      DiskSize=$d.Size;
      DriveLetter=[string]$p.DriveLetter;
      FileSystem=$fs;
      FileSystemLabel=[string]$v.FileSystemLabel;
      VolumeSize=$v.Size;
      Encrypted=$e
    }
  }
}
@($out) | ConvertTo-Json -Depth 3 -Compress"#;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VolumeSpec {
    pub drive_letter: Option<String>,
    pub fs_type: Option<String>,
    pub label: Option<String>,
    pub size_bytes: Option<u64>,
    pub encrypted: bool,
    pub readable: bool,
}

const MOUNTABLE_FS: [&str; 4] = ["NTFS", "exFAT", "FAT32", "FAT"];

fn is_mountable_fs(fs: &str) -> bool {
    MOUNTABLE_FS.iter().any(|m| m.eq_ignore_ascii_case(fs.trim()))
}

fn non_empty_str(o: &Value, key: &str) -> Option<String> {
    o.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Pick the volumes of the disk identified by `serial` (preferred) or else `size_bytes`.
/// Tolerant (array / bare object / garbage -> empty), never panics. With neither selector, or no
/// match, returns empty (deny-by-default). A volume whose `Encrypted` flag is missing/null is
/// marked `readable=false`, so `volume_is_recoverable` refuses it.
pub fn resolve_volumes(json: &str, serial: Option<&str>, size_bytes: Option<u64>) -> Vec<VolumeSpec> {
    let val: Value = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let items: Vec<&Value> = match &val {
        Value::Array(arr) => arr.iter().filter(|v| v.is_object()).collect(),
        Value::Object(_) => vec![&val],
        _ => Vec::new(),
    };
    let serial = serial.map(str::trim).filter(|s| !s.is_empty());
    let matches = |o: &Value| -> bool {
        if let Some(want) = serial {
            return non_empty_str(o, "Serial").is_some_and(|s| s.eq_ignore_ascii_case(want));
        }
        match size_bytes {
            Some(sz) => opt_u64(o, "DiskSize") == Some(sz),
            None => false,
        }
    };
    let matched: Vec<&Value> = items.into_iter().filter(|o| matches(o)).collect();
    // Size-only matching must identify exactly one disk; several same-size disks (or rows we
    // cannot tell apart for lack of a serial) are ambiguous, so deny rather than guess.
    if serial.is_none() {
        let mut keys: Vec<String> = matched
            .iter()
            .map(|o| non_empty_str(o, "Serial").unwrap_or_default().to_ascii_lowercase())
            .collect();
        keys.sort();
        keys.dedup();
        let unserialed_multi = keys.iter().any(String::is_empty) && matched.len() > 1;
        if keys.len() > 1 || unserialed_multi {
            return Vec::new();
        }
    }
    matched.into_iter().map(volume_spec_from).collect()
}

fn volume_spec_from(o: &Value) -> VolumeSpec {
    let fs_type = non_empty_str(o, "FileSystem");
    let enc_flag = o.get("Encrypted").and_then(Value::as_bool);
    let known_fs = fs_type.as_deref().is_some_and(is_mountable_fs);
    VolumeSpec {
        drive_letter: non_empty_str(o, "DriveLetter"),
        fs_type,
        label: non_empty_str(o, "FileSystemLabel"),
        size_bytes: opt_u64(o, "VolumeSize"),
        encrypted: enc_flag.unwrap_or(false),
        readable: known_fs && enc_flag.is_some(),
    }
}

/// Find the volume mounted at `drive_letter` across ALL disks in the volumes-query JSON. `None`
/// when absent, malformed, or ambiguous (more than one row claims the letter): deny-by-default.
pub fn volume_by_letter(json: &str, drive_letter: &str) -> Option<VolumeSpec> {
    let want = drive_letter.trim().trim_end_matches(':').to_ascii_uppercase();
    if want.len() != 1 {
        return None;
    }
    let val: Value = serde_json::from_str(json).ok()?;
    let items: Vec<&Value> = match &val {
        Value::Array(arr) => arr.iter().filter(|v| v.is_object()).collect(),
        Value::Object(_) => vec![&val],
        _ => return None,
    };
    let mut hits = items
        .into_iter()
        .filter(|o| non_empty_str(o, "DriveLetter").is_some_and(|l| l.eq_ignore_ascii_case(&want)));
    let first = hits.next()?;
    if hits.next().is_some() {
        return None;
    }
    Some(volume_spec_from(first))
}

/// Recoverable only when plaintext, readable, and a known mountable filesystem.
pub fn volume_is_recoverable(v: &VolumeSpec) -> bool {
    !v.encrypted && v.readable && v.fs_type.as_deref().is_some_and(is_mountable_fs)
}

/// Per-user folders copied by the "preset" recovery profile.
pub const PRESET_FOLDERS: [&str; 8] = [
    "Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music", "Favorites", "Links",
];

/// Keep real user profile directory names; drop system/template profiles. `Public` is kept.
pub fn select_preset_profiles(entries: &[String]) -> Vec<String> {
    const EXCLUDED: [&str; 5] = [
        "Default",
        "Default User",
        "All Users",
        "systemprofile",
        "defaultuser0",
    ];
    entries
        .iter()
        .filter(|e| {
            let t = e.trim();
            !t.is_empty() && !EXCLUDED.iter().any(|x| x.eq_ignore_ascii_case(t))
        })
        .cloned()
        .collect()
}

/// Lexically normalize a path: drop `.`, resolve `..` against a preceding normal component.
/// `None` when a `..` would climb past the start/root/prefix (ambiguous => caller denies).
fn normalize_lexical(p: &Path) -> Option<Vec<Component<'_>>> {
    let mut out: Vec<Component> = Vec::new();
    for c in p.components() {
        match c {
            Component::CurDir => {}
            Component::ParentDir => match out.last() {
                Some(Component::Normal(_)) => {
                    out.pop();
                }
                _ => return None,
            },
            other => out.push(other),
        }
    }
    Some(out)
}

/// Traversal guard: true only when `candidate`, after lexical normalization, is `base` itself or
/// lies beneath it. Lexical ONLY (no I/O, symlinks are handled by `should_skip_reparse`). Fail
/// closed: an empty base, a `..` that climbs past the root, a different drive, or a relative vs
/// absolute mismatch all give false. Comparison is case-sensitive, so a case-variant spelling is
/// rejected rather than allowed.
pub fn path_is_contained(base: &Path, candidate: &Path) -> bool {
    let (Some(b), Some(c)) = (normalize_lexical(base), normalize_lexical(candidate)) else {
        return false;
    };
    if b.is_empty() || c.len() < b.len() {
        return false;
    }
    b.iter().zip(c.iter()).all(|(x, y)| x == y)
}

/// Never follow symlinks or reparse points (junctions etc.): they can redirect recovery outside
/// the intended scope. Skip when either flag is set.
pub fn should_skip_reparse(is_symlink: bool, is_reparse_point: bool) -> bool {
    is_symlink || is_reparse_point
}

/// Free space that must remain on the staging disk after a copy.
// NOTE: deliberately small so the unit-test scale (free=1000, next=100) works; the I/O layer
// should pass `free_bytes` already net of any larger reserve it wants.
pub const SAFETY_MARGIN: u64 = 512;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StageDecision {
    Proceed,
    StopBudget,
    StopDisk,
}

/// Backpressure before staging the next file. Disk is checked first. Checked arithmetic: an
/// overflowing sum is treated as a stop, never a false `Proceed`.
pub fn can_stage_next(free_bytes: u64, staged_bytes: u64, budget_bytes: u64, next_size: u64) -> StageDecision {
    match next_size.checked_add(SAFETY_MARGIN) {
        Some(need) if free_bytes >= need => {}
        _ => return StageDecision::StopDisk, // short on disk, or the sum overflowed
    }
    match staged_bytes.checked_add(next_size) {
        Some(total) if total <= budget_bytes => StageDecision::Proceed,
        _ => StageDecision::StopBudget, // over budget, or the sum overflowed
    }
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

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SkippedEntry {
    pub path: String,
    pub reason: String,
}

/// Result of a recovery run: everything staged, everything omitted (with why), and whether the
/// run covered the whole selection.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecoverOutcome {
    pub entries: Vec<RecoveredEntry>,
    pub skipped: Vec<SkippedEntry>,
    pub complete: bool,
    pub stop_reason: Option<String>,
}

/// `complete` only when nothing was skipped and the run was not stopped.
pub fn build_outcome(entries: Vec<RecoveredEntry>, skipped: Vec<SkippedEntry>, stop_reason: Option<String>) -> RecoverOutcome {
    let complete = skipped.is_empty() && stop_reason.is_none();
    RecoverOutcome { entries, skipped, complete, stop_reason }
}

/// The human-readable stop reason for a backpressure decision (`None` for `Proceed`).
pub fn stop_reason(d: StageDecision) -> Option<&'static str> {
    match d {
        StageDecision::Proceed => None,
        StageDecision::StopDisk => Some("disk full"),
        StageDecision::StopBudget => Some("budget"),
    }
}

/// `app_data/aunlock_recovered/<job_id>` with every char outside `[A-Za-z0-9_]` in `job_id`
/// replaced by `_`, so a hostile id cannot traverse. An empty id becomes `_`.
pub fn staging_dir(app_data: &Path, job_id: &str) -> PathBuf {
    let mut id: String = job_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' })
        .collect();
    if id.is_empty() {
        id.push('_');
    }
    app_data.join("aunlock_recovered").join(id)
}

/// Relative path inside the staging tree: `<DRIVE>/<source components without root/prefix>`,
/// `/`-separated. The drive is the first ASCII letter of `drive_letter` uppercased (else `_`).
/// `.`/`..` components are dropped so the result can never escape the staging dir.
pub fn staged_rel_path(drive_letter: &str, source: &Path) -> String {
    let drive = drive_letter
        .chars()
        .find(|c| c.is_ascii_alphabetic())
        .map(|c| c.to_ascii_uppercase())
        .unwrap_or('_');
    let mut out = drive.to_string();
    for c in source.components() {
        if let Component::Normal(n) = c {
            out.push('/');
            out.push_str(&n.to_string_lossy());
        }
    }
    out
}

/// Make one path component safe to create on Windows: invalid characters (including `:`, which
/// would open an alternate data stream) and control chars become `_`; reserved device names
/// (CON, PRN, AUX, NUL, COM1-9, LPT1-9, with or without an extension, any case) get a leading
/// `_`; trailing dots/spaces become `_`; empty, `.` and `..` become `_`.
pub fn sanitize_path_component(name: &str) -> String {
    let mut s: String = name
        .chars()
        .map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect();
    if s != "." && s != ".." {
        break_trailing(&mut s);
    }
    if s.is_empty() || s == "." || s == ".." {
        return "_".to_string();
    }
    let stem = s.split('.').next().unwrap_or("").trim_end();
    let up = stem.to_ascii_uppercase();
    let reserved = matches!(up.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((up.starts_with("COM") || up.starts_with("LPT"))
            && up.len() == 4
            && matches!(up.as_bytes()[3], b'1'..=b'9'));
    if reserved {
        s.insert(0, '_');
    }
    s
}

// Replace any further trailing dot/space (a run like "a. ." needs every char replaced).
fn break_trailing(s: &mut String) {
    let trimmed = s.trim_end_matches(|c| c == '.' || c == ' ').len();
    let extra = s.len() - trimmed;
    if extra > 0 {
        s.truncate(trimmed);
        s.push_str(&"_".repeat(extra));
    }
}

/// Sanitize a `staged_rel_path` result: the first component (the drive letter) is kept, every
/// following `/`-separated component goes through `sanitize_path_component`.
pub fn sanitize_staged_rel(rel: &str) -> String {
    rel.split('/')
        .enumerate()
        .map(|(i, c)| if i == 0 { c.to_string() } else { sanitize_path_component(c) })
        .collect::<Vec<_>>()
        .join("/")
}

/// One staged-file record: `u32 LE sealed_key_len || sealed_key || u32 LE ct_len || ct`.
pub fn encode_record(sealed_key: &[u8], ct: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(8 + sealed_key.len() + ct.len());
    out.extend_from_slice(&(sealed_key.len() as u32).to_le_bytes());
    out.extend_from_slice(sealed_key);
    out.extend_from_slice(&(ct.len() as u32).to_le_bytes());
    out.extend_from_slice(ct);
    out
}

/// Parse the record at `pos`; returns `(sealed_key, ct, next_pos)`. `Err` on any truncation or
/// overrun (never panics).
pub fn split_record(buf: &[u8], pos: usize) -> Result<(&[u8], &[u8], usize), CryptoError> {
    fn take(buf: &[u8], pos: usize) -> Result<(&[u8], usize), CryptoError> {
        let end4 = pos.checked_add(4).ok_or(CryptoError::Format)?;
        let len = u32::from_le_bytes(buf.get(pos..end4).ok_or(CryptoError::Format)?.try_into().map_err(|_| CryptoError::Format)?) as usize;
        let end = end4.checked_add(len).ok_or(CryptoError::Format)?;
        Ok((buf.get(end4..end).ok_or(CryptoError::Format)?, end))
    }
    let (k, p) = take(buf, pos)?;
    let (c, p) = take(buf, p)?;
    Ok((k, c, p))
}

// ---- Streaming AEAD frame format (staged-file encryption) ----------------------------------
//
// Sealed stream layout:
//   nonce_prefix (4 random bytes)
//   then, per frame:  len (u32 LE, = ciphertext+tag length) || ciphertext || 16-byte tag
// Frame i (0-based) is sealed with ChaCha20-Poly1305, nonce = nonce_prefix(4) || i as u64 LE (8),
// and AAD b"more" for every frame except the final one, which uses b"last". Dropping the tail of
// the stream therefore leaves no `last`-tagged frame and decryption reports `Truncated`; frames
// cannot be reordered or spliced because the counter is part of the nonce. An empty plaintext
// still emits exactly one (empty) `last` frame.
//
// SECURITY INVARIANT: the 32-byte key MUST be freshly generated from a CSPRNG and UNIQUE to
// this one stream/file. It MUST NEVER be reused across `encrypt_chunks` calls or files. The frame
// counter restarts at 0 on every call, so cross-call nonce uniqueness rests only on the 4-byte
// (32-bit) random prefix; with a reused key a birthday collision (~2^16 files) reuses a nonce,
// which for ChaCha20-Poly1305 destroys both confidentiality and integrity.

use chacha20poly1305::aead::{Aead, KeyInit, OsRng, Payload, AeadCore};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};

/// Plaintext bytes per frame.
pub const FRAME_SIZE: usize = 65536;
const TAG_LEN: usize = 16;
const AAD_MORE: &[u8] = b"more";
const AAD_LAST: &[u8] = b"last";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CryptoError {
    /// AEAD authentication failed (wrong key or tampered data).
    Tag,
    /// The stream ended without a frame tagged as the last one.
    Truncated,
    /// Malformed header, length prefix, or trailing data.
    Format,
}

fn frame_nonce(prefix: &[u8; 4], counter: u64) -> Nonce {
    let mut n = [0u8; 12];
    n[..4].copy_from_slice(prefix);
    n[4..].copy_from_slice(&counter.to_le_bytes());
    *Nonce::from_slice(&n)
}

/// Seal `plaintext` into the framed stream described above, under a fresh random nonce prefix.
///
/// # Safety (security invariant)
/// `key` MUST be a freshly generated, CSPRNG-derived 32-byte key UNIQUE to this stream/file, and
/// MUST NOT be reused across calls or files. Only the 4-byte random nonce prefix separates nonces
/// between calls, so reusing a key risks a nonce collision and total loss of confidentiality and
/// integrity.
pub fn encrypt_chunks(key: &[u8; 32], plaintext: &[u8]) -> Vec<u8> {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    // A random 12-byte nonce from the AEAD's own generator; only its first 4 bytes are kept.
    let rand = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let mut prefix = [0u8; 4];
    prefix.copy_from_slice(&rand[..4]);

    let mut out = Vec::with_capacity(4 + plaintext.len() + (plaintext.len() / FRAME_SIZE + 1) * (4 + TAG_LEN));
    out.extend_from_slice(&prefix);
    let empty: [&[u8]; 1] = [&[]];
    let chunks: Vec<&[u8]> = if plaintext.is_empty() { empty.to_vec() } else { plaintext.chunks(FRAME_SIZE).collect() };
    let last_idx = chunks.len() - 1;
    for (i, chunk) in chunks.iter().enumerate() {
        let aad = if i == last_idx { AAD_LAST } else { AAD_MORE };
        let ct = cipher
            .encrypt(&frame_nonce(&prefix, i as u64), Payload { msg: chunk, aad })
            .expect("sealing a frame of at most FRAME_SIZE bytes cannot fail");
        out.extend_from_slice(&(ct.len() as u32).to_le_bytes());
        out.extend_from_slice(&ct);
    }
    out
}

/// Open a stream produced by `encrypt_chunks`. Never panics on malformed input.
pub fn decrypt_chunks(key: &[u8; 32], sealed: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let prefix: [u8; 4] = sealed.get(..4).ok_or(CryptoError::Format)?.try_into().map_err(|_| CryptoError::Format)?;
    let mut pos = 4usize;
    let mut out = Vec::new();
    let mut counter: u64 = 0;
    loop {
        if pos == sealed.len() {
            return Err(CryptoError::Truncated);
        }
        let len_bytes: [u8; 4] = sealed
            .get(pos..pos.checked_add(4).ok_or(CryptoError::Format)?)
            .ok_or(CryptoError::Format)?
            .try_into()
            .map_err(|_| CryptoError::Format)?;
        let len = u32::from_le_bytes(len_bytes) as usize;
        if len < TAG_LEN || len > FRAME_SIZE + TAG_LEN {
            return Err(CryptoError::Format);
        }
        let start = pos + 4;
        let end = start.checked_add(len).ok_or(CryptoError::Format)?;
        let frame = sealed.get(start..end).ok_or(CryptoError::Format)?;
        let nonce = frame_nonce(&prefix, counter);
        if let Ok(pt) = cipher.decrypt(&nonce, Payload { msg: frame, aad: AAD_MORE }) {
            out.extend_from_slice(&pt);
        } else if let Ok(pt) = cipher.decrypt(&nonce, Payload { msg: frame, aad: AAD_LAST }) {
            if end != sealed.len() {
                return Err(CryptoError::Format); // bytes after the final frame
            }
            out.extend_from_slice(&pt);
            return Ok(out);
        } else {
            return Err(CryptoError::Tag);
        }
        pos = end;
        counter = counter.checked_add(1).ok_or(CryptoError::Format)?;
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_query_passes_read_only_guard() {
        assert!(recover_query_is_read_only(AUNLOCK_HEALTH_QUERY));
    }
    #[test]
    fn guard_rejects_a_write_cmdlet() {
        assert!(!recover_query_is_read_only(
            "Get-Disk | Set-Volume -NewFileSystemLabel x | ConvertTo-Json"
        ));
        assert!(!recover_query_is_read_only("Get-Disk > c:\\x.json"));
    }
    #[test]
    fn normalize_health_reads_counters() {
        let j = r#"[{"HealthStatus":"Healthy","Temperature":34,"PowerOnHours":1200,"ReallocatedSectors":0,"Wear":5}]"#;
        let h = normalize_health(j);
        assert_eq!(h.status, "ok");
        assert_eq!(h.temperature_c, Some(34));
        assert_eq!(h.wear_pct, Some(5));
    }
    #[test]
    fn normalize_health_garbage_is_unknown_no_panic() {
        assert_eq!(normalize_health("not json").status, "unknown");
        assert_eq!(normalize_health("").status, "unknown");
    }
    #[test]
    fn normalize_health_maps_failing() {
        assert_eq!(
            normalize_health(r#"[{"HealthStatus":"Unhealthy"}]"#).status,
            "fail"
        );
        assert_eq!(
            normalize_health(r#"[{"HealthStatus":"Warning"}]"#).status,
            "warn"
        );
    }

    #[test]
    fn empty_array_and_bare_object() {
        assert_eq!(normalize_health("[]").status, "unknown");
        let h = normalize_health(r#"{"HealthStatus":"Healthy","PowerOnHours":7}"#);
        assert_eq!(h.status, "ok");
        assert_eq!(h.power_on_hours, Some(7));
    }

    #[test]
    fn worst_of_array_wins() {
        let j = r#"[{"HealthStatus":"Healthy"},{"HealthStatus":"Unhealthy"}]"#;
        assert_eq!(normalize_health(j).status, "fail");
    }

    #[test]
    fn out_of_range_wear_is_none_and_float_temp_rounds() {
        let h = normalize_health(r#"[{"HealthStatus":"Healthy","Wear":150,"Temperature":33.6}]"#);
        assert_eq!(h.wear_pct, None);
        assert_eq!(h.temperature_c, Some(34));
    }

    #[test]
    fn guard_is_case_insensitive_fail_closed() {
        for bad in [
            "get-disk | set-volume -NewFileSystemLabel x | convertto-json",
            "Get-Disk | SET-VOLUME -NewFileSystemLabel x",
            "Get-Disk | Set-Volume -NewFileSystemLabel x",
            "get-disk | out-file c:\\x",
            "Get-Disk | OUT-FILE x",
            "get-disk | mount-diskimage",
        ] {
            assert!(!recover_query_is_read_only(bad), "guard must reject: {bad}");
        }
        assert!(recover_query_is_read_only("get-disk | convertto-json"));
        assert!(recover_query_is_read_only(AUNLOCK_HEALTH_QUERY));
    }

    fn vs(fs: &str, enc: bool, readable: bool) -> VolumeSpec {
        VolumeSpec {
            drive_letter: Some("E".into()),
            fs_type: Some(fs.into()),
            label: None,
            size_bytes: None,
            encrypted: enc,
            readable,
        }
    }

    #[test]
    fn volumes_query_is_read_only() {
        assert!(recover_query_is_read_only(AUNLOCK_VOLUMES_QUERY));
    }
    #[test]
    fn volumes_query_uses_real_bitlocker_status_not_fs_inference() {
        assert!(recover_query_is_read_only("Get-BitLockerVolume | ConvertTo-Json"));
        assert!(AUNLOCK_VOLUMES_QUERY.contains("Get-BitLockerVolume"));
        assert!(!AUNLOCK_VOLUMES_QUERY.contains("'RAW'"));
    }
    #[test]
    fn bitlocker_on_volume_is_refused_even_with_plain_fs() {
        let j = r#"[{"Serial":"S","DriveLetter":"E","FileSystem":"NTFS","Encrypted":true}]"#;
        let v = resolve_volumes(j, Some("S"), None);
        assert!(v[0].encrypted);
        assert!(!volume_is_recoverable(&v[0]));
    }
    #[test]
    fn volumes_query_derives_encrypted_from_volume_and_lock_status() {
        for needle in ["VolumeStatus", "LockStatus", "FullyDecrypted", "Locked"] {
            assert!(AUNLOCK_VOLUMES_QUERY.contains(needle), "missing {needle}");
        }
        assert!(!AUNLOCK_VOLUMES_QUERY.contains("ProtectionStatus -eq"));
        assert!(recover_query_is_read_only(AUNLOCK_VOLUMES_QUERY));
    }
    #[test]
    fn suspended_and_locked_volumes_are_refused() {
        // Suspended (ProtectionStatus Off, VolumeStatus FullyEncrypted) and Locked both emit
        // Encrypted=true from the query.
        let j = r#"[{"Serial":"S","DriveLetter":"E","FileSystem":"NTFS","Encrypted":true},
                    {"Serial":"S","DriveLetter":"F","FileSystem":"","Encrypted":true}]"#;
        let v = resolve_volumes(j, Some("S"), None);
        assert_eq!(v.len(), 2);
        assert!(v.iter().all(|x| !volume_is_recoverable(x)));
    }
    #[test]
    fn fully_decrypted_volume_is_recoverable() {
        let j = r#"[{"Serial":"S","DriveLetter":"E","FileSystem":"NTFS","Encrypted":false}]"#;
        let v = resolve_volumes(j, Some("S"), None);
        assert!(!v[0].encrypted);
        assert!(volume_is_recoverable(&v[0]));
    }
    #[test]
    fn size_match_ambiguous_returns_empty() {
        let j = r#"[{"Serial":"A","DiskSize":1000,"DriveLetter":"E","FileSystem":"NTFS","Encrypted":false},
                    {"Serial":"B","DiskSize":1000,"DriveLetter":"F","FileSystem":"NTFS","Encrypted":false}]"#;
        assert!(resolve_volumes(j, None, Some(1000)).is_empty());
        assert_eq!(resolve_volumes(j, Some("B"), Some(1000)).len(), 1);
        let k = r#"[{"Serial":"A","DiskSize":1000,"DriveLetter":"E","FileSystem":"NTFS","Encrypted":false},
                    {"Serial":"A","DiskSize":1000,"DriveLetter":"F","FileSystem":"NTFS","Encrypted":false}]"#;
        assert_eq!(resolve_volumes(k, None, Some(1000)).len(), 2);
    }
    #[test]
    fn resolve_matches_by_serial() {
        let j = r#"[{"Serial":"WD-ABC123","DriveLetter":"E","FileSystem":"NTFS","VolumeSize":500000,"Encrypted":false}]"#;
        let v = resolve_volumes(j, Some("WD-ABC123"), None);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].drive_letter.as_deref(), Some("E"));
        assert!(v[0].readable);
    }
    #[test]
    fn resolve_falls_back_to_size_and_filters_others() {
        let j = r#"[{"Serial":"A","DiskSize":1000,"DriveLetter":"E","FileSystem":"NTFS","Encrypted":false},
                    {"Serial":"B","DiskSize":2000,"DriveLetter":"F","FileSystem":"NTFS","Encrypted":false}]"#;
        let v = resolve_volumes(j, None, Some(2000));
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].drive_letter.as_deref(), Some("F"));
        assert!(resolve_volumes(j, Some("ZZZ"), None).is_empty());
        assert!(resolve_volumes(j, None, None).is_empty());
    }
    #[test]
    fn resolve_unknown_encryption_is_not_recoverable() {
        let j = r#"{"Serial":"S","DriveLetter":"E","FileSystem":"NTFS"}"#;
        let v = resolve_volumes(j, Some("S"), None);
        assert_eq!(v.len(), 1);
        assert!(!v[0].readable);
        assert!(!volume_is_recoverable(&v[0]));
        let j2 = r#"[{"Serial":"S","DriveLetter":"E","FileSystem":"NTFS","Encrypted":null}]"#;
        assert!(!volume_is_recoverable(&resolve_volumes(j2, Some("S"), None)[0]));
    }
    #[test]
    fn resolve_garbage_is_empty_no_panic() {
        assert!(resolve_volumes("not json", Some("x"), None).is_empty());
        assert!(resolve_volumes("", Some("x"), None).is_empty());
        assert!(resolve_volumes("[1,\"a\",null]", Some("x"), None).is_empty());
    }
    #[test]
    fn recoverable_rejects_encrypted_and_raw() {
        assert!(!volume_is_recoverable(&vs("NTFS", true, true)));
        assert!(!volume_is_recoverable(&vs("RAW", false, true)));
        assert!(!volume_is_recoverable(&vs("NTFS", false, false)));
        assert!(volume_is_recoverable(&vs("exFAT", false, true)));
        assert!(volume_is_recoverable(&vs("ntfs", false, true)));
    }
    #[test]
    fn preset_profiles_exclude_system_and_default() {
        let got = select_preset_profiles(&[
            "sam".into(),
            "Default".into(),
            "Default User".into(),
            "All Users".into(),
            "Public".into(),
            "systemprofile".into(),
        ]);
        assert_eq!(got, vec!["sam".to_string(), "Public".to_string()]);
        let got2 = select_preset_profiles(&["DEFAULTUSER0".into(), "bob".into()]);
        assert_eq!(got2, vec!["bob".to_string()]);
    }
    #[test]
    fn preset_folders_are_the_eight() {
        assert_eq!(PRESET_FOLDERS.len(), 8);
        assert!(PRESET_FOLDERS.contains(&"Desktop") && PRESET_FOLDERS.contains(&"Links"));
    }

    #[test]
    fn contained_rejects_parent_escape() {
        let base = Path::new("E:/Users/sam");
        assert!(path_is_contained(base, Path::new("E:/Users/sam/Documents/a.txt")));
        assert!(!path_is_contained(base, Path::new("E:/Users/sam/../Administrator/secret")));
    }
    #[test]
    fn contained_edge_cases_fail_closed() {
        let base = Path::new("E:/Users/sam");
        assert!(path_is_contained(base, Path::new("E:/Users/sam/./a/../b.txt")));
        assert!(!path_is_contained(base, Path::new("E:/Users/samuel/a.txt")));
        assert!(!path_is_contained(base, Path::new("F:/Users/sam/a.txt")));
        assert!(!path_is_contained(base, Path::new("E:/../Users/sam/a.txt")));
        assert!(!path_is_contained(base, Path::new("Users/sam/a.txt")));
        assert!(path_is_contained(Path::new("E:/Users/sam/../x"), Path::new("E:/Users/x/a")));
        assert!(!path_is_contained(Path::new(""), Path::new("E:/a")));
    }
    #[test]
    fn reparse_points_are_skipped() {
        assert!(should_skip_reparse(true, false));
        assert!(should_skip_reparse(false, true));
        assert!(!should_skip_reparse(false, false));
    }
    #[test]
    fn backpressure_stops_on_disk_and_budget() {
        assert!(matches!(can_stage_next(1000, 0, 10_000, 100), StageDecision::Proceed));
        assert!(matches!(can_stage_next(50, 0, 10_000, 100), StageDecision::StopDisk));
        assert!(matches!(can_stage_next(10_000, 9_950, 10_000, 100), StageDecision::StopBudget));
    }
    #[test]
    fn backpressure_never_overflows() {
        assert!(matches!(can_stage_next(u64::MAX, 0, u64::MAX, u64::MAX), StageDecision::StopDisk));
        assert!(matches!(can_stage_next(u64::MAX, u64::MAX, u64::MAX, 1), StageDecision::StopBudget));
    }
    #[test]
    fn staging_dir_sanitizes_job_id() {
        let p = staging_dir(Path::new("C:/data"), "job_1_../../x");
        assert!(p.ends_with("aunlock_recovered/job_1______x") || !p.to_string_lossy().contains(".."));
        // "job_1_" + 6 replaced chars of "../../" + "x" => 7 underscores before the x.
        assert!(p.ends_with("aunlock_recovered/job_1_______x"));
        let q = staging_dir(Path::new("C:/data"), "..");
        assert!(!q.to_string_lossy().contains(".."));
        assert!(q.starts_with("C:/data/aunlock_recovered"));
    }
    #[test]
    fn staged_rel_path_keeps_drive_and_drops_root() {
        assert_eq!(
            staged_rel_path("e", Path::new("E:/Users/sam/Documents/a.txt")),
            "E/Users/sam/Documents/a.txt"
        );
        assert_eq!(staged_rel_path("E:", Path::new("E:/a/../b.txt")), "E/a/b.txt");
        assert_eq!(staged_rel_path("", Path::new("x.txt")), "_/x.txt");
    }
    #[test]
    fn encrypt_then_decrypt_round_trips() {
        let key = [7u8; 32];
        let data = vec![9u8; FRAME_SIZE * 2 + 123];
        assert_eq!(decrypt_chunks(&key, &encrypt_chunks(&key, &data)).unwrap(), data);
    }
    #[test]
    fn empty_plaintext_round_trips() {
        let key = [1u8; 32];
        assert_eq!(decrypt_chunks(&key, &encrypt_chunks(&key, &[])).unwrap(), Vec::<u8>::new());
    }
    #[test]
    fn dropping_the_last_frame_is_detected() {
        let key = [3u8; 32];
        let data = vec![5u8; FRAME_SIZE * 3];
        let sealed = encrypt_chunks(&key, &data);
        let truncated = &sealed[..sealed.len() - FRAME_SIZE / 2]; // chop the tail
        assert!(matches!(
            decrypt_chunks(&key, truncated),
            Err(CryptoError::Truncated) | Err(CryptoError::Format) | Err(CryptoError::Tag)
        ));
    }
    #[test]
    fn dropping_whole_final_frame_is_truncated() {
        let key = [3u8; 32];
        let sealed = encrypt_chunks(&key, &vec![5u8; FRAME_SIZE * 3]);
        // Header 4 + 3 full frames of (4 + FRAME_SIZE + 16) + final empty-or-not frame; here the
        // data is an exact multiple, so the 3rd frame is the last. Cut it off at a boundary.
        let frame = 4 + FRAME_SIZE + 16;
        assert_eq!(sealed.len(), 4 + 3 * frame);
        assert!(matches!(decrypt_chunks(&key, &sealed[..4 + 2 * frame]), Err(CryptoError::Truncated)));
    }
    #[test]
    fn wrong_key_fails_tag() {
        let data = vec![2u8; 100];
        let sealed = encrypt_chunks(&[4u8; 32], &data);
        assert!(matches!(
            decrypt_chunks(&[5u8; 32], &sealed),
            Err(CryptoError::Tag) | Err(CryptoError::Format)
        ));
    }
    #[test]
    fn malformed_streams_error_without_panic() {
        let key = [8u8; 32];
        assert!(matches!(decrypt_chunks(&key, &[]), Err(CryptoError::Format)));
        assert!(matches!(decrypt_chunks(&key, &[1, 2, 3]), Err(CryptoError::Format)));
        assert!(matches!(decrypt_chunks(&key, &[0, 0, 0, 0]), Err(CryptoError::Truncated)));
        // Length prefix claims more than is present.
        assert!(matches!(decrypt_chunks(&key, &[0, 0, 0, 0, 255, 255, 255, 255, 1]), Err(CryptoError::Format)));
        // Frame shorter than a tag.
        assert!(matches!(decrypt_chunks(&key, &[0, 0, 0, 0, 2, 0, 0, 0, 1, 2]), Err(CryptoError::Format)));
        // Bit flip in a valid stream.
        let mut sealed = encrypt_chunks(&key, b"hello");
        let n = sealed.len();
        sealed[n - 1] ^= 1;
        assert!(matches!(decrypt_chunks(&key, &sealed), Err(CryptoError::Tag)));
    }
    #[test]
    fn data_after_the_last_frame_is_rejected() {
        let key = [6u8; 32];
        let mut sealed = encrypt_chunks(&key, b"abc");
        sealed.extend_from_slice(&[0, 0, 0, 0]);
        assert!(matches!(decrypt_chunks(&key, &sealed), Err(CryptoError::Format)));
    }

    #[test]
    fn component_replaces_ads_colon_and_bad_chars() {
        assert_eq!(sanitize_path_component("file.txt:Zone.Identifier"), "file.txt_Zone.Identifier");
        assert_eq!(sanitize_path_component("a<b>c|d?e*f\"g"), "a_b_c_d_e_f_g");
    }
    #[test]
    fn component_rejects_reserved_device_names() {
        for n in ["CON", "con", "PRN", "Aux", "NUL", "COM1", "com9", "LPT1", "lpt9", "CON.txt", "nul.tar.gz"] {
            let out = sanitize_path_component(n);
            assert!(out.starts_with('_'), "{n} -> {out}");
        }
        assert_eq!(sanitize_path_component("COM0"), "COM0");
        assert_eq!(sanitize_path_component("console"), "console");
    }
    #[test]
    fn component_fixes_trailing_dot_space_and_empty() {
        assert_eq!(sanitize_path_component("name. "), "name__");
        assert_eq!(sanitize_path_component(""), "_");
        assert_eq!(sanitize_path_component(".."), "_");
        assert_eq!(sanitize_path_component("."), "_");
        assert_eq!(sanitize_path_component("a\u{1}b"), "a_b");
    }
    #[test]
    fn rel_path_sanitizes_each_component_but_keeps_drive() {
        assert_eq!(sanitize_staged_rel("C/Users/bob/NUL/a:b.txt"), "C/Users/bob/_NUL/a_b.txt");
        assert_eq!(sanitize_staged_rel("C/../x"), "C/_/x");
    }
    #[test]
    fn record_roundtrips_and_rejects_malformed() {
        let mut buf = encode_record(b"sealedkey", b"ciphertext");
        buf.extend(encode_record(b"k2", b"c2"));
        let (k, c, next) = split_record(&buf, 0).unwrap();
        assert_eq!((k, c), (&b"sealedkey"[..], &b"ciphertext"[..]));
        let (k2, c2, end) = split_record(&buf, next).unwrap();
        assert_eq!((k2, c2), (&b"k2"[..], &b"c2"[..]));
        assert_eq!(end, buf.len());
        assert!(split_record(&buf, end).is_err());
        assert!(split_record(&buf[..3], 0).is_err());
        assert!(split_record(&[255, 255, 255, 255, 0], 0).is_err());
        assert!(split_record(&buf[..buf.len() - 1], next).is_err());
    }

    #[test]
    fn health_for_serial_selects_matching_disk_not_worst() {
        let j = r#"[{"Serial":"SYS1","HealthStatus":"Unhealthy","PowerOnHours":9},
                    {"Serial":" usb-77 ","HealthStatus":"Healthy","PowerOnHours":42}]"#;
        let r = normalize_health_for(j, Some("USB-77"));
        assert_eq!(r.status, "ok");
        assert_eq!(r.power_on_hours, Some(42));
        // No serial, or no match: machine-worst fallback.
        assert_eq!(normalize_health_for(j, None).status, "fail");
        assert_eq!(normalize_health_for(j, Some("nope")).status, "fail");
        assert_eq!(normalize_health_for(j, Some("  ")).status, "fail");
        assert_eq!(normalize_health(j).status, "fail");
    }
    #[test]
    fn health_query_projects_serial_and_stays_read_only() {
        assert!(AUNLOCK_HEALTH_QUERY.contains("SerialNumber"));
        assert!(recover_query_is_read_only(AUNLOCK_HEALTH_QUERY));
    }
    fn entry(p: &str) -> RecoveredEntry {
        RecoveredEntry { path: p.into(), size: 1, staged_ref: "C/x".into(), source_type: "live".into(), checksum: "00".into() }
    }
    #[test]
    fn outcome_complete_only_when_nothing_skipped_or_stopped() {
        let o = build_outcome(vec![entry("a")], vec![], None);
        assert!(o.complete && o.stop_reason.is_none() && o.skipped.is_empty());
        let skip = SkippedEntry { path: "b".into(), reason: "unreadable".into() };
        let o = build_outcome(vec![entry("a")], vec![skip], None);
        assert!(!o.complete && o.stop_reason.is_none() && o.entries.len() == 1);
        let o = build_outcome(vec![entry("a")], vec![], Some("disk full".into()));
        assert!(!o.complete && o.stop_reason.as_deref() == Some("disk full"));
    }
    #[test]
    fn stop_decisions_map_to_reasons() {
        assert_eq!(stop_reason(StageDecision::Proceed), None);
        assert_eq!(stop_reason(StageDecision::StopDisk), Some("disk full"));
        assert_eq!(stop_reason(StageDecision::StopBudget), Some("budget"));
    }
    #[test]
    fn outcome_serializes_camel_case() {
        let o = build_outcome(vec![], vec![], Some("budget".into()));
        let v = serde_json::to_value(&o).unwrap();
        assert_eq!(v["stopReason"], "budget");
        assert_eq!(v["complete"], false);
        assert!(v["skipped"].is_array() && v["entries"].is_array());
    }

    #[test]
    fn volume_by_letter_finds_unique_and_denies_otherwise() {
        let j = r#"[{"Serial":"A","DriveLetter":"E","FileSystem":"NTFS","Encrypted":false,"VolumeSize":5},
                    {"Serial":"B","DriveLetter":"F","FileSystem":"NTFS","Encrypted":true}]"#;
        let e = volume_by_letter(j, "e:").unwrap();
        assert!(volume_is_recoverable(&e));
        assert!(!volume_is_recoverable(&volume_by_letter(j, "F").unwrap()));
        assert!(volume_by_letter(j, "G").is_none());
        assert!(volume_by_letter(j, "EF").is_none());
        assert!(volume_by_letter("garbage", "E").is_none());
        let dup = r#"[{"DriveLetter":"E","FileSystem":"NTFS","Encrypted":false},{"DriveLetter":"E","FileSystem":"NTFS","Encrypted":false}]"#;
        assert!(volume_by_letter(dup, "E").is_none());
    }
}
