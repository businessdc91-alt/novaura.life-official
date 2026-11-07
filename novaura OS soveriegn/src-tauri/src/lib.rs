pub mod cloud;
pub mod engines;
pub mod llm;
pub mod forge;
pub mod mesh;
pub mod preview;
pub mod templates;
mod password;
pub mod profiles;
mod transfers;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use mesh::{MeshManager, MeshStatus};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone, Debug)]
pub struct AuthorityKeyDef {
    pub kid: &'static str,
    pub pubkey_hex: &'static str,
    pub status: &'static str, // "ACTIVE", "REVOKED", "SUPERSEDED"
    pub tier: &'static str,   // "ROOT_GENESIS", "COMMERCIAL"
}

pub const TRUSTED_AUTHORITIES: &[AuthorityKeyDef] = &[
    AuthorityKeyDef {
        kid: "nova-auth-2026-v1",
        pubkey_hex: "e71dced6ba1e1646f9ad868a00c0479933d602775f81cbf81bf6e9b6a49e0143",
        status: "ACTIVE",
        tier: "ROOT_GENESIS",
    },
    AuthorityKeyDef {
        kid: "nova-auth-operator",
        pubkey_hex: "d442d3ac7b1385393c95e17691dade298efe48b79751a550f74ad8de253d8a23",
        status: "ACTIVE",
        tier: "FOUNDER_GENESIS",
    },
];

static REBOOT_AUTH_NONCE: AtomicU64 = AtomicU64::new(0);
static REBOOT_AUTH_TIMESTAMP: AtomicU64 = AtomicU64::new(0);

fn hex_to_32_bytes(hex: &str) -> Option<[u8; 32]> {
    if hex.len() != 64 {
        return None;
    }
    let mut bytes = [0u8; 32];
    for i in 0..32 {
        bytes[i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(bytes)
}

fn decode_b64url(s: &str) -> Result<Vec<u8>, String> {
    let clean = s.trim_end_matches('=');
    URL_SAFE_NO_PAD.decode(clean).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub sovereign_root: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LicenseVerification {
    pub valid: bool,
    pub tier: String,
    pub holder: String,
    pub fingerprint: String,
    pub reason: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct DecodedLicensePayload {
    #[serde(default)]
    pub v: u32,
    pub tier: String,
    pub holder: String,
    #[serde(default, rename = "nodeId")]
    pub node_id: Option<String>,
    #[serde(default)]
    pub issued: Option<serde_json::Value>,
    #[serde(default)]
    pub expires: Option<serde_json::Value>,
    #[serde(default)]
    pub kid: Option<String>,
    #[serde(default, rename = "licenseId")]
    pub license_id: Option<String>,
}

fn parse_license_timestamp(val: &Option<serde_json::Value>) -> Option<u64> {
    match val {
        Some(serde_json::Value::Number(n)) => n.as_u64(),
        Some(serde_json::Value::String(s)) => s.parse::<u64>().ok(),
        _ => None,
    }
}

fn get_app_data_dir() -> PathBuf {
    let base = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let mut path = PathBuf::from(base);
    path.push("novaura-sovereign");
    path
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "sovereign-node".to_string());

    let root = get_app_data_dir();
    let _ = fs::create_dir_all(&root);

    // Dynamic authentic evaluation of node network state
    let is_connected = std::net::TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([1, 1, 1, 1], 53)),
        std::time::Duration::from_millis(150),
    ).is_ok();

    let status = if is_connected {
        "CONNECTED_SOVEREIGN_NODE".to_string()
    } else {
        "AIR_GAPPED_SECURE".to_string()
    };

    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname,
        sovereign_root: root.to_string_lossy().to_string(),
        status,
    }
}

#[tauri::command]
fn verify_native_license(key: String) -> LicenseVerification {
    let trimmed = key.trim();

    // Strict Ed25519 Token Verification: NOVA1.<payload_b64>.<sig_b64>
    let parts: Vec<&str> = trimmed.split('.').collect();
    if parts.len() != 3 || parts[0] != "NOVA1" {
        return LicenseVerification {
            valid: false,
            tier: "UNVERIFIED".to_string(),
            holder: "Unknown".to_string(),
            fingerprint: "".to_string(),
            reason: Some("MALFORMED_TOKEN: License must follow NOVA1.<payload>.<signature> specification.".to_string()),
        };
    }

    let payload_b64 = parts[1];
    let sig_b64 = parts[2];

    let sig_bytes = match decode_b64url(sig_b64) {
        Ok(b) if b.len() == 64 => b,
        _ => {
            return LicenseVerification {
                valid: false,
                tier: "UNVERIFIED".to_string(),
                holder: "Unknown".to_string(),
                fingerprint: "".to_string(),
                reason: Some("INVALID_SIGNATURE_ENCODING: Corrupt or malformed signature bytes.".to_string()),
            };
        }
    };

    let sig = match Signature::from_slice(&sig_bytes) {
        Ok(s) => s,
        Err(_) => {
            return LicenseVerification {
                valid: false,
                tier: "UNVERIFIED".to_string(),
                holder: "Unknown".to_string(),
                fingerprint: "".to_string(),
                reason: Some("INVALID_SIGNATURE: Malformed cryptographic signature structure.".to_string()),
            };
        }
    };

    // Decode JSON payload
    let payload_json_bytes = match decode_b64url(payload_b64) {
        Ok(b) => b,
        Err(e) => {
            return LicenseVerification {
                valid: false,
                tier: "UNVERIFIED".to_string(),
                holder: "Unknown".to_string(),
                fingerprint: "".to_string(),
                reason: Some(format!("PAYLOAD_DECODE_ERROR: {}", e)),
            };
        }
    };

    let payload: DecodedLicensePayload = match serde_json::from_slice(&payload_json_bytes) {
        Ok(p) => p,
        Err(e) => {
            return LicenseVerification {
                valid: false,
                tier: "UNVERIFIED".to_string(),
                holder: "Unknown".to_string(),
                fingerprint: "".to_string(),
                reason: Some(format!("PAYLOAD_PARSE_ERROR: Invalid JSON schema: {}", e)),
            };
        }
    };

    // Key ID Resolution & Revocation Verification
    let target_kid = payload.kid.as_deref().unwrap_or("nova-auth-2026-v1");
    let authority = match TRUSTED_AUTHORITIES.iter().find(|a| a.kid == target_kid) {
        Some(a) => a,
        None => {
            return LicenseVerification {
                valid: false,
                tier: "UNVERIFIED".to_string(),
                holder: payload.holder,
                fingerprint: "".to_string(),
                reason: Some(format!("UNKNOWN_AUTHORITY_KID: Authority key ID '{}' is not recognized.", target_kid)),
            };
        }
    };

    if authority.status == "REVOKED" {
        return LicenseVerification {
            valid: false,
            tier: "REVOKED".to_string(),
            holder: payload.holder,
            fingerprint: "".to_string(),
            reason: Some(format!("REVOKED_AUTHORITY_KEY: Authority key ID '{}' has been revoked.", target_kid)),
        };
    }

    let pubkey_bytes = match hex_to_32_bytes(authority.pubkey_hex) {
        Some(p) => p,
        None => {
            return LicenseVerification {
                valid: false,
                tier: "UNVERIFIED".to_string(),
                holder: "Unknown".to_string(),
                fingerprint: "".to_string(),
                reason: Some("AUTHORITY_CONFIG_ERROR: Invalid Authority public key configuration.".to_string()),
            };
        }
    };

    let verifying_key = match VerifyingKey::from_bytes(&pubkey_bytes) {
        Ok(vk) => vk,
        Err(e) => {
            return LicenseVerification {
                valid: false,
                tier: "UNVERIFIED".to_string(),
                holder: "Unknown".to_string(),
                fingerprint: "".to_string(),
                reason: Some(format!("AUTHORITY_KEY_ERROR: {}", e)),
            };
        }
    };

    // Verify signature over the base64 payload bytes using Authority Key
    if verifying_key.verify(payload_b64.as_bytes(), &sig).is_err() {
        return LicenseVerification {
            valid: false,
            tier: "UNVERIFIED".to_string(),
            holder: "Unknown".to_string(),
            fingerprint: "".to_string(),
            reason: Some("CRYPTOGRAPHIC_VERIFICATION_FAILED: Signature does not match Sovereign Authority Root.".to_string()),
        };
    }

    // 1. Expiration Verification
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if let Some(exp) = parse_license_timestamp(&payload.expires) {
        if exp > 0 && now > exp {
            return LicenseVerification {
                valid: false,
                tier: payload.tier,
                holder: payload.holder,
                fingerprint: payload.node_id.unwrap_or_default(),
                reason: Some(format!("LICENSE_EXPIRED: License expired at UNIX timestamp {}.", exp)),
            };
        }
    }

    // 2. Hardware Node Binding Verification (Strict: every license must be bound to host hardware)
    let current_fingerprint = get_hardware_fingerprint();
    let licensed_node = payload.node_id.as_deref().unwrap_or("").trim();
    if licensed_node.is_empty() {
        return LicenseVerification {
            valid: false,
            tier: payload.tier,
            holder: payload.holder,
            fingerprint: current_fingerprint,
            reason: Some("UNBOUND_LICENSE: License must be bound to a hardware node ID.".to_string()),
        };
    }

    if !accepted_hardware_fingerprints().iter().any(|id| id == licensed_node) {
        return LicenseVerification {
            valid: false,
            tier: payload.tier,
            holder: payload.holder,
            fingerprint: current_fingerprint.clone(),
            reason: Some(format!(
                "MACHINE_BINDING_MISMATCH: License is bound to node '{}', but current host is '{}'.",
                licensed_node, current_fingerprint
            )),
        };
    }

    // Report the node ID the license matched (current or legacy) so the
    // frontend can bind the saved record to it.
    LicenseVerification {
        valid: true,
        tier: payload.tier,
        holder: payload.holder,
        fingerprint: licensed_node.to_string(),
        reason: None,
    }
}

#[tauri::command]
fn save_sovereign_file(filename: String, content: String) -> Result<String, String> {
    let mut path = profiles::data_dir();
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    // Sanitize filename
    let clean_name: String = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect();
    path.push(clean_name);

    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_sovereign_file(filename: String) -> Result<String, String> {
    let mut path = profiles::data_dir();
    let clean_name: String = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect();
    path.push(clean_name);

    fs::read_to_string(&path).map_err(|e| e.to_string())
}

fn fnv_node_hash(input: &str) -> String {
    let mut hash1: u64 = 0xcbf29ce484222325;
    let mut hash2: u64 = 0x100000001b3;
    for b in input.as_bytes() {
        hash1 ^= *b as u64;
        hash1 = hash1.wrapping_mul(0x100000001b3);
        hash2 = (hash2.wrapping_add(*b as u64)).wrapping_mul(0x9e3779b97f4a7c15);
    }
    format!("NODE-{:08X}{:08X}", (hash1 >> 32) as u32, (hash2 >> 32) as u32)
}

/// Original node ID (OS, arch, hostname, username). Changes when the PC or
/// user account is renamed. Still accepted so previously issued licenses keep working.
fn legacy_hardware_fingerprint() -> String {
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "sovereign-host".to_string());
    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "operator".to_string());
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    fnv_node_hash(&format!("{}:{}:{}:{}", os, arch, hostname, username))
}

/// Windows installation GUID (HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid).
/// Survives hostname and username changes; changes only on OS reinstall.
#[cfg(target_os = "windows")]
fn read_machine_guid() -> Option<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = std::process::Command::new("reg")
        .args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .find(|l| l.contains("MachineGuid"))
        .and_then(|l| l.split_whitespace().last())
        .map(|g| g.trim().to_lowercase())
        .filter(|g| g.len() >= 32)
}

#[cfg(target_os = "linux")]
fn read_machine_guid() -> Option<String> {
    fs::read_to_string("/etc/machine-id")
        .ok()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| s.len() >= 32)
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn read_machine_guid() -> Option<String> {
    None
}

fn current_hardware_fingerprint() -> String {
    static CACHED: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    CACHED
        .get_or_init(|| match read_machine_guid() {
            Some(guid) => fnv_node_hash(&format!("nova-node-v2:{}", guid)),
            None => legacy_hardware_fingerprint(),
        })
        .clone()
}

/// Every node ID this machine may legitimately present (current first).
fn accepted_hardware_fingerprints() -> Vec<String> {
    let current = current_hardware_fingerprint();
    let legacy = legacy_hardware_fingerprint();
    if current == legacy {
        vec![current]
    } else {
        vec![current, legacy]
    }
}

#[tauri::command]
fn get_hardware_fingerprint() -> String {
    current_hardware_fingerprint()
}

#[tauri::command]
fn save_node_certificate(cert_json: String) -> Result<bool, String> {
    let mut path = get_app_data_dir();
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("node_certificate.json");
    fs::write(&path, cert_json).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn read_node_certificate() -> Result<Option<String>, String> {
    let mut path = get_app_data_dir();
    path.push("node_certificate.json");
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

// ---------------------------------------------------------------------------
// At-rest protection for vault files (database mirror, etc.).
// On Windows the payload is encrypted with DPAPI, bound to the current Windows
// user account. Files written before this change (plain JSON) still load.
// ---------------------------------------------------------------------------
const VAULT_DPAPI_PREFIX: &str = "NOVADPAPI1:";

#[cfg(windows)]
mod dpapi {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    fn take_blob(blob: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        let out = unsafe { std::slice::from_raw_parts(blob.pbData, blob.cbData as usize).to_vec() };
        unsafe { LocalFree(blob.pbData as _) };
        out
    }

    pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
        let input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
        let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = unsafe {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if ok == 0 {
            return Err(format!("DPAPI protect failed: {}", std::io::Error::last_os_error()));
        }
        Ok(take_blob(output))
    }

    pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
        let input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
        let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = unsafe {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if ok == 0 {
            return Err(format!("DPAPI unprotect failed: {}", std::io::Error::last_os_error()));
        }
        Ok(take_blob(output))
    }
}

fn seal_vault_payload(payload: &str) -> Result<String, String> {
    #[cfg(windows)]
    {
        let sealed = dpapi::protect(payload.as_bytes())?;
        return Ok(format!("{}{}", VAULT_DPAPI_PREFIX, URL_SAFE_NO_PAD.encode(sealed)));
    }
    #[cfg(not(windows))]
    {
        Ok(payload.to_string())
    }
}

fn open_vault_payload(stored: String) -> Result<String, String> {
    match stored.strip_prefix(VAULT_DPAPI_PREFIX) {
        None => Ok(stored), // legacy plaintext file
        Some(encoded) => {
            #[cfg(windows)]
            {
                let sealed = URL_SAFE_NO_PAD
                    .decode(encoded.trim())
                    .map_err(|e| format!("Vault decode failed: {}", e))?;
                let plain = dpapi::unprotect(&sealed)?;
                return String::from_utf8(plain).map_err(|e| format!("Vault UTF-8 error: {}", e));
            }
            #[cfg(not(windows))]
            {
                let _ = encoded;
                Err("Vault file is DPAPI-protected and can only be opened on Windows.".to_string())
            }
        }
    }
}

#[tauri::command]
fn sync_vault_state(filename: String, payload: String) -> Result<bool, String> {
    // Per profile: a new profile's empty database must never rehydrate from someone else's mirror.
    let mut path = profiles::data_dir();
    path.push("vault");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    let clean_name: String = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect();
    path.push(clean_name);
    let sealed = seal_vault_payload(&payload)?;
    // Write to a temp file then rename, so a crash never leaves a half-written vault.
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, sealed).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn load_vault_state(filename: String) -> Result<Option<String>, String> {
    let mut path = profiles::data_dir();
    path.push("vault");
    let clean_name: String = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect();
    path.push(clean_name);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(Some(open_vault_payload(content)?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn get_authentic_drive_telemetry() -> Result<String, String> {
    // Look for the helper script next to the executable only. A working-directory
    // relative path would run whatever script the launch folder happens to contain.
    let candidates: Vec<std::path::PathBuf> = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("scripts").join("get_authentic_storage_telemetry.ps1")))
        .into_iter()
        .collect();

    let mut command = std::process::Command::new("powershell");
    command.args(&["-NoProfile", "-ExecutionPolicy", "Bypass"]);

    let mut found = false;
    for c in &candidates {
        if c.is_file() {
            command.arg("-File").arg(c);
            found = true;
            break;
        }
    }

    if !found {
        command.args(&[
            "-Command",
            "$v = Get-Volume | Where-Object { $_.DriveLetter -ne $null } | Select-Object DriveLetter, FileSystemLabel, FileSystem, DriveType, SizeRemaining, Size; $p = Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, BusType, OperationalStatus, HealthStatus, Size, SerialNumber; $part = Get-Partition | Select-Object DiskNumber, PartitionNumber, DriveLetter, IsBoot, IsSystem, Size, Type; [PSCustomObject]@{ Volumes = $v; PhysicalDisks = $p; Partitions = $part } | ConvertTo-Json -Depth 4",
        ]);
    }

    let output = command.output().map_err(|e| format!("PowerShell error: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        Err(err)
    }
}

#[tauri::command]
fn request_uefi_reboot_authorization() -> Result<u64, String> {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let mut hasher = RandomState::new().build_hasher();
    hasher.write_u64(now);
    hasher.write(get_hardware_fingerprint().as_bytes());
    let token = hasher.finish();
    let safe_token = if token == 0 { 1 } else { token };

    REBOOT_AUTH_NONCE.store(safe_token, Ordering::SeqCst);
    REBOOT_AUTH_TIMESTAMP.store(now, Ordering::SeqCst);

    Ok(safe_token)
}

#[tauri::command]
fn trigger_uefi_firmware_reboot(authorization_token: u64) -> Result<String, String> {
    consume_firmware_authorization(authorization_token)?;

    let output = std::process::Command::new("shutdown")
        .args(&["/r", "/fw", "/t", "0"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok("Dispatched hardware reboot into UEFI setup.".to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        Err(err)
    }
}

/// Consumes a challenge nonce issued by `request_uefi_reboot_authorization`.
fn consume_firmware_authorization(authorization_token: u64) -> Result<(), String> {
    let stored_token = REBOOT_AUTH_NONCE.swap(0, Ordering::SeqCst);
    let stored_time = REBOOT_AUTH_TIMESTAMP.swap(0, Ordering::SeqCst);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    if stored_token == 0 || authorization_token != stored_token {
        return Err("AUTHORIZATION_REJECTED: Invalid or unissued firmware challenge nonce.".to_string());
    }
    if now.saturating_sub(stored_time) > 30 {
        return Err("AUTHORIZATION_EXPIRED: Firmware challenge token expired (30-second TTL).".to_string());
    }
    Ok(())
}

/// Accepts only BCD identifiers: a braced GUID or a well-known alias such as {current}.
fn is_valid_bcd_identifier(entry_id: &str) -> bool {
    let id = entry_id.trim();
    if !(id.starts_with('{') && id.ends_with('}')) || id.len() < 3 || id.len() > 40 {
        return false;
    }
    let inner = &id[1..id.len() - 1];
    let is_guid = inner.len() == 36
        && inner.chars().enumerate().all(|(i, c)| match i {
            8 | 13 | 18 | 23 => c == '-',
            _ => c.is_ascii_hexdigit(),
        });
    let is_alias = matches!(inner, "current" | "default" | "bootmgr" | "fwbootmgr");
    is_guid || is_alias
}

#[tauri::command]
fn set_uefi_boot_target(entry_id: String, authorization_token: u64) -> Result<String, String> {
    if !is_valid_bcd_identifier(&entry_id) {
        return Err("INVALID_BOOT_ENTRY: Expected a BCD identifier such as {current} or a braced GUID.".to_string());
    }
    consume_firmware_authorization(authorization_token)?;

    let output = std::process::Command::new("bcdedit")
        .args(&["/default", entry_id.trim()])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(format!("Configured BCD default boot to {}", entry_id.trim()))
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        Err(err)
    }
}

#[tauri::command]
fn clean_user_temp_cache() -> Result<u64, String> {
    let base_temp = std::env::temp_dir();
    let mut deleted_bytes: u64 = 0;

    // 1. Clean app-specific subfolder if it exists
    let app_temp = base_temp.join("novaura-sovereign");
    if app_temp.exists() && app_temp.is_dir() {
        if let Ok(entries) = fs::read_dir(&app_temp) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Ok(meta) = p.metadata() {
                    let len = meta.len();
                    if meta.is_file() && fs::remove_file(&p).is_ok() {
                        deleted_bytes += len;
                    }
                }
            }
        }
    }

    // 2. Clean only scoped files in base_temp matching novaura prefixes
    if let Ok(entries) = fs::read_dir(&base_temp) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                let lower = name.to_lowercase();
                if lower.starts_with("novaura_") || lower.starts_with("sovereign_") || lower.starts_with("cybeni_") {
                    if let Ok(metadata) = entry.metadata() {
                        let len = metadata.len();
                        if metadata.is_file() && fs::remove_file(&path).is_ok() {
                            deleted_bytes += len;
                        }
                    }
                }
            }
        }
    }
    Ok(deleted_bytes)
}

/// Documents\NovauraSovereign for the active profile (profiles.rs gives others a subfolder).
fn get_documents_dir() -> PathBuf {
    profiles::documents_dir(get_documents_dir_for_main())
}

fn get_documents_dir_for_main() -> PathBuf {
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let mut p = PathBuf::from(userprofile);
        p.push("Documents");
        p.push("NovauraSovereign");
        return p;
    }
    if let Ok(home) = std::env::var("HOME") {
        let mut p = PathBuf::from(home);
        p.push("Documents");
        p.push("NovauraSovereign");
        return p;
    }
    let mut p = get_app_data_dir();
    p.push("workspace");
    p
}

/// Validates a user-chosen sync directory.
///
/// Rules: absolute path only, no `..` or `.` components, and it must sit inside
/// the user's profile (or the app data / documents roots). Inside the profile,
/// `AppData` and dot-config folders are blocked (except this app's own data
/// directory), which keeps writes away from Startup folders and autorun paths.
fn resolve_safe_sync_root(target_dir: Option<String>) -> Result<PathBuf, String> {
    use std::path::Component;

    let raw = match target_dir {
        Some(ref d) if !d.trim().is_empty() => d.trim().to_string(),
        _ => return Ok(get_documents_dir()),
    };
    let candidate = PathBuf::from(&raw);

    if !candidate.is_absolute() {
        return Err("TARGET_DIR_PROHIBITED: Sync directory must be an absolute path.".to_string());
    }
    if candidate
        .components()
        .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
    {
        return Err("TARGET_DIR_PROHIBITED: Relative segments ('..' or '.') are not allowed.".to_string());
    }

    // Resolve symlinks/junctions through the deepest existing ancestor so a
    // link inside the profile cannot redirect the sync root elsewhere.
    let mut existing = candidate.clone();
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    while !existing.exists() {
        match (existing.file_name().map(|n| n.to_os_string()), existing.parent()) {
            (Some(name), Some(parent)) => {
                tail.push(name);
                existing = parent.to_path_buf();
            }
            _ => break,
        }
    }
    let mut resolved = existing.canonicalize().unwrap_or(existing);
    for name in tail.into_iter().rev() {
        resolved.push(name);
    }

    let canon = |p: PathBuf| p.canonicalize().unwrap_or(p);
    let app_data = canon(get_app_data_dir());
    let documents = canon(get_documents_dir());
    let mut profile_roots: Vec<PathBuf> = Vec::new();
    for var in ["USERPROFILE", "HOME"] {
        if let Ok(v) = std::env::var(var) {
            profile_roots.push(canon(PathBuf::from(v)));
        }
    }

    if resolved.starts_with(&app_data) || resolved.starts_with(&documents) {
        return Ok(resolved);
    }

    for root in &profile_roots {
        if resolved.starts_with(root) {
            if resolved == *root {
                return Err("TARGET_DIR_PROHIBITED: Choose a folder inside your profile, not the profile root.".to_string());
            }
            let first = resolved
                .strip_prefix(root)
                .ok()
                .and_then(|rel| rel.components().next())
                .map(|c| c.as_os_str().to_string_lossy().to_lowercase());
            if matches!(first.as_deref(), Some("appdata") | Some(".ssh") | Some(".config") | Some(".local")) {
                return Err("TARGET_DIR_PROHIBITED: Application and system configuration folders are protected.".to_string());
            }
            return Ok(resolved);
        }
    }

    Err("TARGET_DIR_PROHIBITED: Target directory must reside within your user profile or documents.".to_string())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProjectFileSyncItem {
    pub path: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SyncNativeResult {
    pub success: bool,
    pub count: usize,
    pub root_path: String,
    pub errors: Vec<String>,
}

#[tauri::command]
fn get_default_sync_directory() -> Result<String, String> {
    let p = get_documents_dir();
    let _ = fs::create_dir_all(&p);
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
fn sync_native_project_files(target_dir: Option<String>, files_json: String) -> Result<SyncNativeResult, String> {
    let root = resolve_safe_sync_root(target_dir)?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let items: Vec<ProjectFileSyncItem> = serde_json::from_str(&files_json)
        .map_err(|e| format!("Invalid JSON payload: {}", e))?;

    let mut count = 0;
    let mut errors = Vec::new();

    for item in items {
        let trimmed_path = item.path.trim();
        if trimmed_path.is_empty() || trimmed_path.contains("..") || trimmed_path.contains(':') || trimmed_path.contains('\0') {
            errors.push(format!("Illegal path component in {}", item.path));
            continue;
        }

        let clean_rel = trimmed_path.trim_start_matches('/').trim_start_matches('\\');
        let mut dest = root.clone();
        let mut valid_segments = true;

        for segment in clean_rel.split(|c| c == '/' || c == '\\') {
            let seg = segment.trim();
            if seg.is_empty() {
                continue;
            }
            if seg == "." || seg == ".." || seg.contains(':') || seg.contains('\0') {
                valid_segments = false;
                break;
            }
            dest.push(seg);
        }

        if !valid_segments {
            errors.push(format!("Illegal segment in path {}", item.path));
            continue;
        }

        // Verify destination containment under root
        if !dest.starts_with(&root) {
            errors.push(format!("Path traversal blocked for {}", item.path));
            continue;
        }

        if let Some(parent) = dest.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                errors.push(format!("Failed to create directory for {}: {}", item.path, e));
                continue;
            }
        }

        match fs::write(&dest, item.content) {
            Ok(_) => count += 1,
            Err(e) => errors.push(format!("Failed to write {}: {}", item.path, e)),
        }
    }

    Ok(SyncNativeResult {
        success: errors.is_empty(),
        count,
        root_path: root.to_string_lossy().to_string(),
        errors,
    })
}

#[derive(Serialize, Deserialize, Debug)]
pub struct NativeFileReadItem {
    pub path: String,
    pub content: String,
    pub size: u64,
}

fn collect_native_files_recursive(current: &PathBuf, root: &PathBuf, results: &mut Vec<NativeFileReadItem>) {
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_native_files_recursive(&path, root, results);
            } else if path.is_file() {
                if let Ok(metadata) = path.metadata() {
                    if metadata.len() < 10 * 1024 * 1024 {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if let Ok(rel) = path.strip_prefix(root) {
                                let norm_path = format!("/{}", rel.to_string_lossy().replace('\\', "/"));
                                results.push(NativeFileReadItem {
                                    path: norm_path,
                                    content,
                                    size: metadata.len(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn read_native_project_files(target_dir: Option<String>) -> Result<String, String> {
    let root = resolve_safe_sync_root(target_dir)?;

    if !root.exists() {
        return Ok("[]".to_string());
    }

    let mut results = Vec::new();
    collect_native_files_recursive(&root, &root, &mut results);

    serde_json::to_string(&results).map_err(|e| e.to_string())
}

// ── Files received over the mesh (transfers.rs) ──────────────────────────────
// Pieces arrive decrypted from meshTransfers.js and go straight to disk, so a
// transfer of any size never sits in memory. Disk work runs off the async threads.

/// Documents\NovauraSovereign\Received for the active profile.
fn received_dir() -> PathBuf {
    get_documents_dir().join("Received")
}

async fn blocking<T: Send + 'static>(job: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn transfer_recv_open(id: String, name: String, size: u64) -> Result<u64, String> {
    let dir = received_dir();
    blocking(move || transfers::open(&dir, &id, &name, size)).await
}

/// One piece as raw bytes (no base64 over IPC); the transfer id and offset come
/// as `x-transfer-id` and `x-offset` headers.
#[tauri::command]
async fn transfer_recv_write(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("A piece of the file must be sent as raw bytes.".to_string());
    };
    let header = |name: &str| request.headers().get(name).and_then(|v| v.to_str().ok()).map(str::to_string);
    let id = header("x-transfer-id").ok_or("Missing transfer id.")?;
    let offset: u64 = header("x-offset").and_then(|v| v.parse().ok()).ok_or("Missing offset.")?;
    let bytes = bytes.clone();
    blocking(move || transfers::write(&id, offset, &bytes)).await
}

#[tauri::command]
async fn transfer_recv_finish(id: String, sha256: String) -> Result<String, String> {
    blocking(move || transfers::finish(&id, &sha256).map(|p| p.to_string_lossy().to_string())).await
}

#[tauri::command]
async fn transfer_recv_cancel(id: String) -> Result<(), String> {
    let dir = received_dir();
    blocking(move || transfers::cancel(&dir, &id)).await
}

/// Opens Explorer on a received file (only files inside the received folder).
#[tauri::command]
fn transfer_reveal(path: Option<String>) -> Result<(), String> {
    let dir = received_dir();
    let _ = fs::create_dir_all(&dir);
    let mut cmd = std::process::Command::new("explorer");
    match path.map(PathBuf::from) {
        Some(p) if transfers::is_inside(&dir, &p) => cmd.arg(format!("/select,{}", p.display())),
        Some(_) => return Err("That file is not in the received folder.".to_string()),
        None => cmd.arg(dir.as_os_str()),
    };
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_native_sync_folder(path: Option<String>) -> Result<bool, String> {
    let target = resolve_safe_sync_root(path)?;
    let _ = fs::create_dir_all(&target);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(target.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(true)
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(target.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(true)
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(target.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(true)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(false)
    }
}

#[tauri::command]
async fn mesh_get_status(mesh: tauri::State<'_, MeshManager>) -> Result<MeshStatus, String> {
    Ok(mesh.get_status().await)
}

#[tauri::command]
async fn mesh_broadcast_packet(
    mesh: tauri::State<'_, MeshManager>,
    packet_type: String,
    payload: serde_json::Value,
    signature: Option<String>,
    sender_pubkey: Option<String>,
    sender_id: Option<String>,
    timestamp_ms: Option<u64>,
) -> Result<bool, String> {
    mesh.broadcast_packet(packet_type, payload, signature, sender_pubkey, sender_id, timestamp_ms).await
}

#[tauri::command]
async fn mesh_send_direct_packet(
    mesh: tauri::State<'_, MeshManager>,
    recipient_id: String,
    packet_type: String,
    payload: serde_json::Value,
    signature: Option<String>,
    sender_pubkey: Option<String>,
    sender_id: Option<String>,
    timestamp_ms: Option<u64>,
) -> Result<bool, String> {
    mesh.send_direct_packet(recipient_id, packet_type, payload, signature, sender_pubkey, sender_id, timestamp_ms).await
}

#[tauri::command]
async fn mesh_connect_peer(
    mesh: tauri::State<'_, MeshManager>,
    address: String,
) -> Result<mesh::MeshPeer, String> {
    mesh.connect_peer(address).await
}

#[tauri::command]
async fn mesh_set_relay(
    mesh: tauri::State<'_, MeshManager>,
    relay_address: Option<String>,
) -> Result<bool, String> {
    mesh.set_relay(relay_address).await
}

#[tauri::command]
async fn mesh_switch_room(
    mesh: tauri::State<'_, MeshManager>,
    room: String,
) -> Result<bool, String> {
    mesh.switch_room(room).await
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TorStatus {
    pub is_active: bool,
    pub port: u16,
    pub mode: String,
}

#[tauri::command]
async fn probe_tor_socks_status(port: Option<u16>) -> Result<TorStatus, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let candidate_ports = if let Some(p) = port {
        vec![p]
    } else {
        vec![9050, 9150]
    };

    for p in candidate_ports {
        let addr = format!("127.0.0.1:{}", p);
        if let Ok(Ok(mut stream)) = tokio::time::timeout(
            std::time::Duration::from_millis(500),
            tokio::net::TcpStream::connect(&addr),
        ).await {
            // Send RFC 1928 SOCKS5 greeting
            if stream.write_all(&[0x05, 0x01, 0x00]).await.is_ok() {
                let mut resp = [0u8; 2];
                if let Ok(Ok(_)) = tokio::time::timeout(
                    std::time::Duration::from_millis(500),
                    stream.read_exact(&mut resp),
                ).await {
                    if resp[0] == 0x05 && resp[1] == 0x00 {
                        return Ok(TorStatus {
                            is_active: true,
                            port: p,
                            mode: "SOCKS5_DIRECT".to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(TorStatus {
        is_active: false,
        port: 9050,
        mode: "UNAVAILABLE".to_string(),
    })
}

#[tauri::command]
async fn fetch_onion_raw(
    onion_url: String,
    socks_port: Option<u16>,
) -> Result<String, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let trimmed = onion_url.trim();

    // 1. CRLF, Null-Byte, and Control Character Defense (Header Injection / Smuggling Prevention)
    if trimmed.chars().any(|c| c == '\r' || c == '\n' || c == '\0' || (c as u32) < 0x20 || c as u32 == 0x7f) {
        return Err("MALFORMED_URL: URL contains forbidden CRLF, null bytes, or control characters.".to_string());
    }

    let without_scheme = if let Some(stripped) = trimmed.strip_prefix("http://") {
        stripped
    } else if let Some(stripped) = trimmed.strip_prefix("https://") {
        stripped
    } else if let Some(stripped) = trimmed.strip_prefix("tor://") {
        stripped
    } else {
        trimmed
    };

    let (host_port, raw_path) = match without_scheme.find('/') {
        Some(idx) => (&without_scheme[..idx], &without_scheme[idx..]),
        None => (without_scheme, "/"),
    };

    let (host, port) = match host_port.find(':') {
        Some(idx) => {
            let h = &host_port[..idx];
            let p = host_port[idx + 1..].parse::<u16>().map_err(|_| "INVALID_PORT".to_string())?;
            (h, p)
        }
        None => (host_port, 80),
    };

    // 2. Strict .onion Domain Validation (Prevent SSRF / Cleartext Domain Leaks)
    let host_lower = host.to_lowercase();
    if !host_lower.ends_with(".onion") {
        return Err("PROHIBITED_HOST: fetch_onion_raw strictly requires a .onion hidden service destination.".to_string());
    }

    // Host characters must be RFC-compliant domain labels (alphanumeric, hyphen, dot)
    if !host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') {
        return Err("INVALID_HOST_CHARACTERS: Host contains forbidden characters.".to_string());
    }

    let path = if raw_path.is_empty() { "/" } else { raw_path };

    // 3. Port Restriction: Constrain strictly to standard Tor SOCKS ports (9050, 9150)
    let target_port = match socks_port {
        Some(p) if p == 9050 || p == 9150 => p,
        Some(invalid_port) => {
            return Err(format!(
                "PROHIBITED_SOCKS_PORT: Port {} is unauthorized. Only standard Tor SOCKS ports 9050 or 9150 are permitted.",
                invalid_port
            ));
        }
        None => 9050,
    };
    let socks_addr = format!("127.0.0.1:{}", target_port);

    let mut stream = match tokio::time::timeout(
        std::time::Duration::from_secs(3),
        tokio::net::TcpStream::connect(&socks_addr),
    ).await {
        Ok(Ok(s)) => s,
        _ => return Err("LOCAL_SOCKS_UNAVAILABLE".to_string()),
    };

    // 4. SOCKS5 Handshake
    if stream.write_all(&[0x05, 0x01, 0x00]).await.is_err() {
        return Err("SOCKS5_HANDSHAKE_WRITE_FAILED".to_string());
    }

    let mut handshake_resp = [0u8; 2];
    if stream.read_exact(&mut handshake_resp).await.is_err() || handshake_resp[0] != 0x05 || handshake_resp[1] != 0x00 {
        return Err("SOCKS5_AUTH_FAILED".to_string());
    }

    // 5. CONNECT Command (Domain format)
    let host_bytes = host.as_bytes();
    let host_len = host_bytes.len();
    if host_len > 255 {
        return Err("HOST_TOO_LONG".to_string());
    }

    let mut connect_req = Vec::with_capacity(4 + 1 + host_len + 2);
    connect_req.extend_from_slice(&[0x05, 0x01, 0x00, 0x03, host_len as u8]);
    connect_req.extend_from_slice(host_bytes);
    connect_req.extend_from_slice(&port.to_be_bytes());

    if stream.write_all(&connect_req).await.is_err() {
        return Err("SOCKS5_CONNECT_WRITE_FAILED".to_string());
    }

    let mut connect_resp = [0u8; 4];
    if stream.read_exact(&mut connect_resp).await.is_err() || connect_resp[1] != 0x00 {
        return Err(format!("SOCKS5_CONNECT_REJECTED_CODE_{}", connect_resp[1]));
    }

    // Skip the remainder of the SOCKS5 response address
    match connect_resp[3] {
        0x01 => {
            let mut buf = [0u8; 4 + 2]; // IPv4 (4) + Port (2)
            let _ = stream.read_exact(&mut buf).await;
        }
        0x03 => {
            let mut len_buf = [0u8; 1];
            if stream.read_exact(&mut len_buf).await.is_ok() {
                let mut domain_buf = vec![0u8; len_buf[0] as usize + 2];
                let _ = stream.read_exact(&mut domain_buf).await;
            }
        }
        0x04 => {
            let mut buf = [0u8; 16 + 2]; // IPv6 (16) + Port (2)
            let _ = stream.read_exact(&mut buf).await;
        }
        _ => {}
    }

    // 6. Send HTTP GET Request with sanitized headers
    let http_get = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0\r\nAccept: text/plain,text/markdown;q=0.9,*/*;q=0.1\r\nConnection: close\r\n\r\n",
        path, host
    );

    if stream.write_all(http_get.as_bytes()).await.is_err() {
        return Err("HTTP_GET_WRITE_FAILED".to_string());
    }

    let mut body = Vec::new();
    let mut chunk = [0u8; 4096];
    while let Ok(n) = stream.read(&mut chunk).await {
        if n == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..n]);
        if body.len() > 2 * 1024 * 1024 { // 2MB safety limit
            break;
        }
    }

    String::from_utf8(body).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LocalAiProbeResult {
    pub online: bool,
    pub latency_ms: Option<u64>,
    pub model: Option<String>,
    pub models: Vec<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
async fn probe_local_ai(port: u16, path: String) -> Result<LocalAiProbeResult, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let start = std::time::Instant::now();
    let addr = format!("127.0.0.1:{}", port);
    let mut stream = match tokio::time::timeout(
        std::time::Duration::from_millis(2500),
        tokio::net::TcpStream::connect(&addr),
    ).await {
        Ok(Ok(s)) => s,
        _ => {
            return Ok(LocalAiProbeResult {
                online: false,
                latency_ms: None,
                model: None,
                models: vec![],
                version: None,
                error: Some("OFFLINE".to_string()),
            });
        }
    };

    let target_path = if path.starts_with('/') { path } else { format!("/{}", path) };
    let req = format!(
        "GET {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nAccept: application/json\r\nUser-Agent: NovAura-Sovereign-Kernel\r\n{}Connection: close\r\n\r\n",
        target_path, port, llm::auth_header(port)
    );

    if stream.write_all(req.as_bytes()).await.is_err() {
        return Ok(LocalAiProbeResult {
            online: false,
            latency_ms: None,
            model: None,
            models: vec![],
            version: None,
            error: Some("WRITE_FAILED".to_string()),
        });
    }

    let mut response_bytes = Vec::new();
    let mut buf = [0u8; 4096];
    let _ = tokio::time::timeout(std::time::Duration::from_millis(2500), async {
        loop {
            match stream.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => response_bytes.extend_from_slice(&buf[..n]),
                Err(_) => break,
            }
        }
    }).await;

    let latency = start.elapsed().as_millis() as u64;

    if response_bytes.is_empty() {
        return Ok(LocalAiProbeResult {
            online: false,
            latency_ms: None,
            model: None,
            models: vec![],
            version: None,
            error: Some("EMPTY_RESPONSE".to_string()),
        });
    }

    let resp_str = String::from_utf8_lossy(&response_bytes);
    let header_end = resp_str.find("\r\n\r\n").or_else(|| resp_str.find("\n\n"));
    let body = match header_end {
        Some(idx) => resp_str[idx..].trim_start(),
        None => resp_str.as_ref(),
    };

    if let Ok(val) = serde_json::from_str::<serde_json::Value>(body) {
        let mut model_names = Vec::new();
        let mut first_model = None;

        if let Some(models_arr) = val.get("models").and_then(|m| m.as_array()) {
            for m in models_arr {
                if let Some(name) = m.get("name").or_else(|| m.get("model")).and_then(|n| n.as_str()) {
                    model_names.push(name.to_string());
                }
            }
            if !model_names.is_empty() {
                first_model = Some(model_names[0].clone());
            }
        } else if let Some(data_arr) = val.get("data").and_then(|d| d.as_array()) {
            for m in data_arr {
                if let Some(id) = m.get("id").and_then(|n| n.as_str()) {
                    model_names.push(id.to_string());
                }
            }
            if !model_names.is_empty() {
                first_model = Some(model_names[0].clone());
            }
        }

        return Ok(LocalAiProbeResult {
            online: true,
            latency_ms: Some(latency),
            model: first_model,
            models: model_names,
            version: val.get("version").and_then(|v| v.as_str()).map(|s| s.to_string()),
            error: None,
        });
    }

    Ok(LocalAiProbeResult {
        online: true,
        latency_ms: Some(latency),
        model: None,
        models: vec![],
        version: None,
        error: None,
    })
}

#[tauri::command]
async fn query_local_ai_raw(
    port: u16,
    path: String,
    method: String,
    body: Option<String>,
) -> Result<String, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let addr = format!("127.0.0.1:{}", port);
    let mut stream = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    .map_err(|_| "CONNECT_TIMEOUT".to_string())?
    .map_err(|e| e.to_string())?;

    let target_path = if path.starts_with('/') { path } else { format!("/{}", path) };
    let method_upper = method.to_uppercase();
    let body_str = body.unwrap_or_default();
    let body_bytes = body_str.as_bytes();

    let req = format!(
        "{} {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccept: application/json\r\nUser-Agent: NovAura-Sovereign-Kernel\r\n{}Connection: close\r\n\r\n{}",
        method_upper, target_path, port, body_bytes.len(), llm::auth_header(port), body_str
    );

    stream.write_all(req.as_bytes()).await.map_err(|e| e.to_string())?;

    // Non-streaming replies arrive all at once when generation ends, so this bounds
    // the whole generation. It is generous because big local models (or ones that
    // spill into system RAM) can take a long time; it exists so a stalled server
    // cannot hang a caller forever.
    const LOCAL_AI_READ_TIMEOUT_SECS: u64 = 45 * 60;
    let mut response_bytes = Vec::new();
    let mut buf = [0u8; 8192];
    let read_all = async {
        loop {
            match stream.read(&mut buf).await {
                Ok(0) => return Ok(()),
                Ok(n) => response_bytes.extend_from_slice(&buf[..n]),
                Err(e) => return Err(e.to_string()),
            }
        }
    };
    tokio::time::timeout(std::time::Duration::from_secs(LOCAL_AI_READ_TIMEOUT_SECS), read_all)
        .await
        .map_err(|_| format!("The local model did not finish within {} minutes.", LOCAL_AI_READ_TIMEOUT_SECS / 60))??;

    Ok(String::from_utf8_lossy(&http_response_body(&response_bytes)).into_owned())
}

/// Extract the body of a raw HTTP/1.1 response, undoing chunked transfer encoding.
/// Ollama switches to chunked encoding once a reply passes ~4 KB, and returning the
/// raw chunk framing made long completions unparseable as JSON.
fn http_response_body(raw: &[u8]) -> Vec<u8> {
    let (header_end, sep_len) = match raw.windows(4).position(|w| w == b"\r\n\r\n") {
        Some(i) => (i, 4),
        None => match raw.windows(2).position(|w| w == b"\n\n") {
            Some(i) => (i, 2),
            None => return raw.to_vec(),
        },
    };
    let headers = String::from_utf8_lossy(&raw[..header_end]).to_ascii_lowercase();
    let body = &raw[header_end + sep_len..];
    let chunked = headers
        .lines()
        .any(|l| l.starts_with("transfer-encoding:") && l.contains("chunked"));
    if !chunked {
        return body.to_vec();
    }

    let mut out = Vec::with_capacity(body.len());
    let mut pos = 0;
    while pos < body.len() {
        let line_end = match body[pos..].windows(2).position(|w| w == b"\r\n") {
            Some(i) => pos + i,
            None => break,
        };
        let size_str = String::from_utf8_lossy(&body[pos..line_end]);
        let size_hex = size_str.split(';').next().unwrap_or("").trim();
        let size = match usize::from_str_radix(size_hex, 16) {
            Ok(n) => n,
            Err(_) => break,
        };
        if size == 0 {
            break;
        }
        let start = line_end + 2;
        let end = (start + size).min(body.len());
        out.extend_from_slice(&body[start..end]);
        pos = end + 2;
    }
    out
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NativeGpuEntry {
    pub name: String,
    pub vram_gb: f32,
    pub is_dedicated: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NativeHardwareSpec {
    pub cpu_name: String,
    pub cpu_cores: u32,
    pub cpu_threads: u32,
    pub ram_gb: f32,
    pub gpus: Vec<NativeGpuEntry>,
    pub primary_compute_gpu: Option<NativeGpuEntry>,
    pub total_vram_gb: f32,
}

#[tauri::command]
async fn get_native_hardware_spec() -> Result<NativeHardwareSpec, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-Command",
            "[PSCustomObject]@{ cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors); ram_bytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory; gpus = @(Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM) } | ConvertTo-Json -Compress -Depth 3",
        ]);
        cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    let cpu_name = val.get("cpu").and_then(|c| c.get("Name")).and_then(|n| n.as_str()).unwrap_or("Intel Core i9").trim().to_string();
                    let cpu_cores = val.get("cpu").and_then(|c| c.get("NumberOfCores")).and_then(|n| n.as_u64()).unwrap_or(14) as u32;
                    let cpu_threads = val.get("cpu").and_then(|c| c.get("NumberOfLogicalProcessors")).and_then(|n| n.as_u64()).unwrap_or(28) as u32;
                    let ram_bytes = val.get("ram_bytes").and_then(|b| b.as_f64()).unwrap_or(68719476736.0);
                    let ram_gb = ((ram_bytes / (1024.0 * 1024.0 * 1024.0) * 10.0).round()) / 10.0;

                    let mut gpus = Vec::new();
                    let mut total_vram: f32 = 0.0;

                    if let Some(gpu_arr) = val.get("gpus").and_then(|g| g.as_array()) {
                        for g in gpu_arr {
                            let name = g.get("Name").and_then(|n| n.as_str()).unwrap_or("").trim().to_string();
                            if name.is_empty() || name.to_lowercase().contains("virtual") {
                                continue;
                            }

                            let mut vram: f32 = 4.0;
                            let n_lower = name.to_lowercase();
                            if n_lower.contains("24gb") || n_lower.contains("m6000 24") || n_lower.contains("4090") || n_lower.contains("3090") {
                                vram = 24.0;
                            } else if n_lower.contains("16gb") || n_lower.contains("4080") || n_lower.contains("w6800") {
                                vram = 16.0;
                            } else if n_lower.contains("12gb") || n_lower.contains("4070") || n_lower.contains("3060") {
                                vram = 12.0;
                            } else if n_lower.contains("rx 580") || n_lower.contains("580 series") || n_lower.contains("3070") || n_lower.contains("2080") {
                                vram = 8.0;
                            } else if let Some(adapter_ram) = g.get("AdapterRAM").and_then(|a| a.as_f64()) {
                                if adapter_ram > 0.0 {
                                    vram = (adapter_ram / (1024.0 * 1024.0 * 1024.0)).max(4.0) as f32;
                                }
                            }

                            let is_dedicated = n_lower.contains("nvidia") || n_lower.contains("radeon") || n_lower.contains("geforce") || n_lower.contains("quadro");

                            gpus.push(NativeGpuEntry {
                                name,
                                vram_gb: vram,
                                is_dedicated,
                            });
                            total_vram += vram;
                        }
                    }

                    // Sort GPUs descending by VRAM so highest compute capacity is index 0
                    gpus.sort_by(|a, b| b.vram_gb.partial_cmp(&a.vram_gb).unwrap_or(std::cmp::Ordering::Equal));
                    let primary = gpus.first().cloned();

                    return Ok(NativeHardwareSpec {
                        cpu_name,
                        cpu_cores,
                        cpu_threads,
                        ram_gb: ram_gb as f32,
                        gpus,
                        primary_compute_gpu: primary,
                        total_vram_gb: total_vram,
                    });
                }
            }
        }
    }

    Err("Could not retrieve native hardware specifications".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // First, before any window: which profile's data this process opens.
    profiles::init_from_args();
    let node_id = get_hardware_fingerprint();
    let node_name = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "sovereign-node".to_string());
    let mut mesh_manager = MeshManager::new(node_id, node_name);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(mesh_manager.clone())
        // Cybeni previews run on their own origin, isolated from the OS UI (see preview.rs).
        .register_uri_scheme_protocol("cyprev", |_ctx, request| preview::handle(&request))
        // Pop-out windows (src/services/popoutWindows.js) belong to the desktop:
        // closing the main window quits the app instead of leaving them orphaned.
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                use tauri::Manager;
                window.app_handle().exit(0);
            }
        })
        .setup(move |app| {
            let handle = app.handle().clone();
            mesh_manager.set_app_handle(handle);
            let mesh_to_start = mesh_manager.clone();
            tauri::async_runtime::spawn(async move {
                mesh_to_start.start().await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            verify_native_license,
            save_sovereign_file,
            read_sovereign_file,
            get_hardware_fingerprint,
            save_node_certificate,
            read_node_certificate,
            sync_vault_state,
            load_vault_state,
            get_authentic_drive_telemetry,
            request_uefi_reboot_authorization,
            trigger_uefi_firmware_reboot,
            set_uefi_boot_target,
            clean_user_temp_cache,
            get_default_sync_directory,
            sync_native_project_files,
            read_native_project_files,
            open_native_sync_folder,
            transfer_recv_open,
            transfer_recv_write,
            transfer_recv_finish,
            transfer_recv_cancel,
            transfer_reveal,
            mesh_get_status,
            mesh_broadcast_packet,
            mesh_send_direct_packet,
            mesh_connect_peer,
            mesh_set_relay,
            mesh_switch_room,
            probe_tor_socks_status,
            fetch_onion_raw,
            probe_local_ai,
            query_local_ai_raw,
            get_native_hardware_spec,
            preview::cybeni_preview_publish,
            preview::cybeni_preview_clear,
            preview::site_preview_publish,
            llm::llm_catalog,
            llm::llm_install,
            llm::llm_install_status,
            llm::llm_download_hf,
            llm::llm_list_models,
            llm::llm_open_models_folder,
            llm::llm_cancel_install,
            llm::llm_remove_model,
            llm::llm_start,
            llm::llm_stop,
            llm::llm_status,
            engines::engine_install_comfyui,
            engines::engine_install_status,
            engines::engine_comfy_start,
            engines::engine_comfy_stop,
            engines::engine_comfy_stop_on_exit,
            engines::engine_comfy_status,
            engines::engine_download_model,
            engines::engine_download_status,
            engines::engine_download_cancel,
            engines::engine_list_models,
            engines::engine_hardware,
            cloud::cloud_ai_request,
            forge::forge_fetch_text,
            forge::forge_install_desktop_app,
            templates::template_prepare_dir,
            templates::template_write_file,
            templates::template_open_dir,
            profiles::profiles_state,
            profiles::profile_create,
            profiles::profile_update,
            profiles::profile_set_password,
            profiles::profile_remove,
            profiles::profile_enter,
            profiles::profile_switch,
            profiles::autostart_get,
            profiles::autostart_set,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                engines::shutdown();
                llm::shutdown();
            }
        });
}

#[cfg(test)]
mod safety_tests {
    use super::*;

    fn profile() -> PathBuf {
        PathBuf::from(std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap())
    }

    #[test]
    fn sync_root_defaults_to_documents() {
        assert_eq!(resolve_safe_sync_root(None).unwrap(), get_documents_dir());
        assert_eq!(resolve_safe_sync_root(Some("   ".into())).unwrap(), get_documents_dir());
    }

    #[test]
    fn sync_root_rejects_parent_traversal_even_when_missing() {
        let sneaky = profile().join("does-not-exist-xyz").join("..").join("..").join("..").join("Windows").join("Temp");
        assert!(resolve_safe_sync_root(Some(sneaky.to_string_lossy().into())).is_err());
    }

    #[test]
    fn sync_root_rejects_relative_and_outside_paths() {
        assert!(resolve_safe_sync_root(Some("relative/folder".into())).is_err());
        #[cfg(windows)]
        assert!(resolve_safe_sync_root(Some(r"C:\Windows\Temp\novaura".into())).is_err());
        #[cfg(not(windows))]
        assert!(resolve_safe_sync_root(Some("/etc/novaura".into())).is_err());
    }

    #[test]
    fn sync_root_blocks_appdata_and_profile_root() {
        let startup = profile().join("AppData").join("Roaming").join("Microsoft").join("Windows").join("Start Menu").join("Programs").join("Startup");
        assert!(resolve_safe_sync_root(Some(startup.to_string_lossy().into())).is_err());
        assert!(resolve_safe_sync_root(Some(profile().join(".ssh").to_string_lossy().into())).is_err());
        assert!(resolve_safe_sync_root(Some(profile().to_string_lossy().into())).is_err());
    }

    #[test]
    fn sync_root_allows_folders_inside_profile() {
        let ok = profile().join("Desktop").join("novaura-sync-test-not-created");
        assert!(resolve_safe_sync_root(Some(ok.to_string_lossy().into())).is_ok());
    }

    #[test]
    fn bcd_identifier_validation() {
        assert!(is_valid_bcd_identifier("{current}"));
        assert!(is_valid_bcd_identifier("{bootmgr}"));
        assert!(is_valid_bcd_identifier("{a1b2c3d4-e5f6-7890-abcd-ef0123456789}"));
        assert!(!is_valid_bcd_identifier("{recovery}"));
        assert!(!is_valid_bcd_identifier("current"));
        assert!(!is_valid_bcd_identifier("{current} /set"));
        assert!(!is_valid_bcd_identifier("{a1b2c3d4-e5f6-7890-abcd-ef01234567zz}"));
    }

    #[test]
    fn firmware_nonce_is_single_use() {
        let token = request_uefi_reboot_authorization().unwrap();
        assert!(consume_firmware_authorization(token).is_ok());
        assert!(consume_firmware_authorization(token).is_err());
        assert!(consume_firmware_authorization(12345).is_err());
    }

    #[test]
    fn fingerprints_are_stable_and_include_legacy() {
        let ids = accepted_hardware_fingerprints();
        assert!(!ids.is_empty());
        assert_eq!(ids[0], current_hardware_fingerprint());
        assert!(ids.contains(&legacy_hardware_fingerprint()));
        assert!(ids.iter().all(|id| id.starts_with("NODE-") && id.len() == 21));
    }

    #[cfg(windows)]
    #[test]
    fn vault_seal_round_trip_and_legacy_plaintext() {
        let secret = r#"{"vault":[{"id":"gemini","value":"sk-test"}]}"#;
        let sealed = seal_vault_payload(secret).unwrap();
        assert!(sealed.starts_with(VAULT_DPAPI_PREFIX));
        assert!(!sealed.contains("sk-test"));
        assert_eq!(open_vault_payload(sealed).unwrap(), secret);
        assert_eq!(open_vault_payload(secret.to_string()).unwrap(), secret);
    }

    #[test]
    fn http_body_plain_and_chunked() {
        let plain = b"HTTP/1.1 200 OK\r\nContent-Length: 7\r\n\r\n{\"a\":1}";
        assert_eq!(http_response_body(plain), b"{\"a\":1}".to_vec());

        let chunked = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\n{\"a\"\r\n3;ext=1\r\n:1}\r\n0\r\n\r\n";
        assert_eq!(http_response_body(chunked), b"{\"a\":1}".to_vec());

        let bare = b"HTTP/1.1 200 OK\n\n{}";
        assert_eq!(http_response_body(bare), b"{}".to_vec());
    }
}
