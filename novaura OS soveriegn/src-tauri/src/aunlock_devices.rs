//! Aunlock read-only device bridge (Phase 1b-A) — the thin Tauri I/O shell.
//!
//! This module only *runs* the read-only PowerShell query and hands its output to the pure,
//! unit-tested `normalize_devices`. The query, the normalization, and the read-only guard all
//! live in `aunlock_devices_rules` so they can be tested without linking Tauri. This spawn path
//! is the one line CI can't cover; it is proven by the Task 6 gated live check.
//!
//! Read-only: it enumerates disks and reads their specs. It never writes to, mounts-for-write,
//! repartitions, or unlocks any device.

#[path = "aunlock_devices_rules.rs"]
mod aunlock_devices_rules;

pub use aunlock_devices_rules::DeviceSpec;
use aunlock_devices_rules::{normalize_devices, AUNLOCK_CIM_QUERY};

/// Enumerate connected devices and read their specs. Returns the normalized records, an empty
/// list when nothing is connected (or off-Windows), or an `Err` when PowerShell can't run — the
/// caller distinguishes an empty list from a failure.
#[tauri::command]
pub async fn aunlock_enumerate_devices() -> Result<Vec<DeviceSpec>, String> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                AUNLOCK_CIM_QUERY,
            ])
            .output()
            .map_err(|e| format!("could not run PowerShell: {e}"))?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("device enumeration failed: {}", err.trim()));
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(normalize_devices(&stdout))
    }
    #[cfg(not(windows))]
    {
        let _ = AUNLOCK_CIM_QUERY;
        let _ = normalize_devices;
        Ok(Vec::new())
    }
}
