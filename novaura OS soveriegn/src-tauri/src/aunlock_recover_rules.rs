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
pub fn recover_query_is_read_only(query: &str) -> bool {
    const ALLOWED: [&str; 6] = [
        "Get-PhysicalDisk",
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
        .all(|tok| ALLOWED.contains(&tok))
}

/// A token shaped like a cmdlet (`Verb-Noun`): uppercase-initial alphabetic verb, one dash,
/// uppercase-initial alphanumeric noun. Parameters (`-Depth`) and members (`HealthStatus`) are not.
fn is_cmdlet_shaped(tok: &str) -> bool {
    match tok.split_once('-') {
        Some((verb, noun)) => {
            !verb.is_empty()
                && verb.chars().next().is_some_and(|c| c.is_ascii_uppercase())
                && verb.chars().all(|c| c.is_ascii_alphabetic())
                && !noun.is_empty()
                && noun.chars().next().is_some_and(|c| c.is_ascii_uppercase())
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
            t.as_i64().or_else(|| t.as_f64().filter(|f| f.is_finite()).map(|f| f.round() as i64))
        }),
        power_on_hours: opt_u64(o, "PowerOnHours"),
        reallocated_sectors: opt_u64(o, "ReallocatedSectors"),
        wear_pct: opt_u64(o, "Wear").and_then(|w| u8::try_from(w).ok()).filter(|w| *w <= 100),
        source: "powershell".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
