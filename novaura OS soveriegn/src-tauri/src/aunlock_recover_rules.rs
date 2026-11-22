//! Pure, Tauri-free rules for Aunlock drive recovery (Plan 1). No I/O here, so
//! `npm run tauri:test` can run it; the Tauri shell that spawns PowerShell lives elsewhere.
//!
//! Same house style as `aunlock_devices_rules`: a fail-closed read-only allowlist guard for
//! PowerShell, and tolerant, deny-by-default JSON normalization that never panics.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Read-only PowerShell query for drive health (SMART-ish counters). Only reads state; the
/// `health_query_passes_read_only_guard` test keeps it inside the allowlist. Fields a drive does
/// not expose come back null and normalize to `None` / "unknown" (deny-by-default).
pub const AUNLOCK_HEALTH_QUERY: &str = r#"$ErrorActionPreference='SilentlyContinue';
$out=foreach($p in (Get-PhysicalDisk)){
  $r=$p | Get-StorageReliabilityCounter;
  $h=[string]$p.HealthStatus;
  if(-not $h){ $h=[string]((Get-Disk -Number $p.DeviceId).HealthStatus) }
  [pscustomobject]@{
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
    let val: Value = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return unknown_report(),
    };
    let items: Vec<&Value> = match &val {
        Value::Array(arr) => arr.iter().filter(|v| v.is_object()).collect(),
        Value::Object(_) => vec![&val],
        _ => Vec::new(),
    };
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
    matched
        .into_iter()
        .map(|o| {
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
        })
        .collect()
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
}
