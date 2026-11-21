//! Pure, Tauri-free rules for Aunlock's read-only device bridge (Phase 1b-A).
//!
//! `normalize_devices` turns the read-only PowerShell CIM payload (produced by the
//! `aunlock_enumerate_devices` command) into `DeviceSpec` records. No I/O happens here, so
//! `npm run tauri:test` can run it. The actual hardware read is proven by a gated live check,
//! not in CI.
//!
//! Classification is DENY-BY-DEFAULT: an unrecognised `kind` or an undetermined `lock` becomes
//! `"unknown"`, never a guess, so an unidentified device never silently advances. The host
//! OS/boot disk is flagged `system_disk` so it can never be chosen as an intake/sanitize target.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSpec {
    pub id: String,
    pub kind: String,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub ram: Option<String>,
    pub cpu: Option<String>,
    pub storage: Option<String>,
    pub battery: Option<String>,
    pub lock: String,
    pub bus: Option<String>,
    pub removable: bool,
    pub system_disk: bool,
    pub size_bytes: Option<u64>,
}

/// Parse the CIM payload into device records. Tolerates a bare object (PowerShell emits one, not
/// an array, for a single device), an array, or garbage (→ empty). Never panics.
pub fn normalize_devices(cim_json: &str) -> Vec<DeviceSpec> {
    let val: Value = match serde_json::from_str(cim_json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    match &val {
        Value::Array(arr) => arr.iter().map(map_one).collect(),
        Value::Object(_) => vec![map_one(&val)],
        _ => Vec::new(),
    }
}

/// A trimmed, non-empty string at `key`, else `None` (missing, null, or blank all collapse to
/// None so a blank serial never reads as a real one).
fn opt_str(o: &Value, key: &str) -> Option<String> {
    o.get(key)
        .and_then(Value::as_str)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Deny-by-default: only the recognised kinds pass through; anything else is `"unknown"`.
fn norm_kind(v: Option<&Value>) -> String {
    match v.and_then(Value::as_str) {
        Some(k) if matches!(k, "laptop" | "phone" | "drive") => k.to_string(),
        _ => "unknown".to_string(),
    }
}

/// Lock resolves only on a clear encryption signal: `true` → encrypted, `false` → none; an
/// absent/undetermined flag stays `"unknown"` (deny-by-default).
fn norm_lock(v: Option<&Value>) -> String {
    match v.and_then(Value::as_bool) {
        Some(true) => "encrypted".to_string(),
        Some(false) => "none".to_string(),
        None => "unknown".to_string(),
    }
}

/// A stable id: the serial when present, else a model+size slug so repeated scans of the same
/// device keep the same id.
fn device_id(o: &Value) -> String {
    if let Some(s) = opt_str(o, "SerialNumber") {
        return format!("dev-{s}");
    }
    let model = opt_str(o, "Model")
        .or_else(|| opt_str(o, "FriendlyName"))
        .unwrap_or_else(|| "device".to_string());
    let size = o.get("Size").and_then(Value::as_u64).unwrap_or(0);
    format!("dev-{}-{}", model.replace(' ', "_"), size)
}

fn map_one(o: &Value) -> DeviceSpec {
    let is_boot = o.get("IsBoot").and_then(Value::as_bool).unwrap_or(false);
    let is_system = o.get("IsSystem").and_then(Value::as_bool).unwrap_or(false);
    DeviceSpec {
        id: device_id(o),
        kind: norm_kind(o.get("Kind")),
        model: opt_str(o, "Model").or_else(|| opt_str(o, "FriendlyName")),
        serial: opt_str(o, "SerialNumber"),
        ram: opt_str(o, "Ram"),
        cpu: opt_str(o, "Cpu"),
        storage: opt_str(o, "Storage"),
        battery: opt_str(o, "Battery"),
        lock: norm_lock(o.get("Encrypted")),
        bus: opt_str(o, "BusType"),
        removable: o
            .get("RemovableMedia")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        system_disk: is_boot || is_system,
        size_bytes: o.get("Size").and_then(Value::as_u64),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DISK_USB_FIXTURE: &str = r#"[
      {"Kind":"drive","Model":"WD Elements 25A3","SerialNumber":"WD-ABC123","Size":500107862016,
       "BusType":"USB","MediaType":"HDD","RemovableMedia":true,"IsBoot":false,"IsSystem":false,
       "Encrypted":false}
    ]"#;

    const DISK_SYSTEM_FIXTURE: &str = r#"[
      {"Kind":"drive","Model":"Samsung SSD 980","SerialNumber":"S649NF0","Size":1000204886016,
       "BusType":"NVMe","MediaType":"SSD","RemovableMedia":false,"IsBoot":true,"IsSystem":true,
       "Encrypted":true}
    ]"#;

    const SINGLE_OBJECT_FIXTURE: &str = r#"
      {"Kind":"drive","Model":"Kingston DT","SerialNumber":"KING1","Size":16000000000,
       "BusType":"USB","MediaType":"Removable","RemovableMedia":true,"IsBoot":false,
       "IsSystem":false,"Encrypted":false}
    "#;

    const PARTIAL_FIXTURE: &str = r#"[{"Model":"Mystery Device","Size":null}]"#;

    const BITLOCKER_FIXTURE: &str = r#"[
      {"Kind":"drive","Model":"Crucial MX500","SerialNumber":"CRU9","Size":500107862016,
       "BusType":"SATA","MediaType":"SSD","RemovableMedia":false,"IsBoot":false,"IsSystem":false,
       "Encrypted":true}
    ]"#;

    // one fixed data disk, USB adapter
    #[test]
    fn maps_a_usb_data_drive() {
        let v = normalize_devices(DISK_USB_FIXTURE);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].kind, "drive");
        assert_eq!(v[0].serial.as_deref(), Some("WD-ABC123"));
        assert_eq!(v[0].removable, true);
        assert_eq!(v[0].system_disk, false);
    }

    // the host OS/boot disk must be flagged
    #[test]
    fn flags_the_system_boot_disk() {
        let v = normalize_devices(DISK_SYSTEM_FIXTURE);
        assert_eq!(v[0].system_disk, true);
    }

    // PowerShell emits a bare object (not an array) for a single device
    #[test]
    fn tolerates_a_single_object_payload() {
        let v = normalize_devices(SINGLE_OBJECT_FIXTURE);
        assert_eq!(v.len(), 1);
    }

    // missing/null fields never panic and stay deny-by-default
    #[test]
    fn missing_fields_are_deny_by_default() {
        let v = normalize_devices(PARTIAL_FIXTURE);
        assert_eq!(v[0].kind, "unknown");
        assert_eq!(v[0].lock, "unknown");
        assert_eq!(v[0].serial, None);
    }

    // a BitLocker-protected volume reports an encrypted lock hint
    #[test]
    fn reports_encrypted_lock_when_bitlocker_on() {
        let v = normalize_devices(BITLOCKER_FIXTURE);
        assert_eq!(v[0].lock, "encrypted");
    }

    #[test]
    fn garbage_returns_empty() {
        assert_eq!(normalize_devices("not json").len(), 0);
        assert_eq!(normalize_devices("").len(), 0);
    }

    #[test]
    fn empty_array_returns_empty() {
        assert_eq!(normalize_devices("[]").len(), 0);
    }
}
