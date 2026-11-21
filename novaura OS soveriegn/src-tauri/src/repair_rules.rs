//! Pure Tauri-free security & path validation rules for Sovereign Self-Repair Source Mode.
//! Compiled into both the main Tauri crate and `pure-tests` so `cargo test` always verifies them.

use std::path::{Component, Path, PathBuf};

/// Protected security, authentication, licensing, sandbox, and cloud-egress files that
/// automated AI repair is NEVER permitted to modify.
const PROTECTED_PATH_FRAGMENTS: &[&str] = &[
    "sentinel",
    "aunlock",
    "credentialenclave",
    "complianceservice",
    "securitycompliance",
    "sovereignauth",
    // auth / identity / trust core (precise fragments — bare "auth"/"mesh"/"crypto" would wrongly
    // block feature files like AICoAuthorPanel, MeshWaterBackground, or the crypto *price* tracker)
    "interappsecuritybroker",
    "authsubsystem",
    "decentralizedauth",
    "founderauth",
    "novaauth",
    "meshcrypto",
    "trustedauthorities",
    "license",
    "cloud.rs",
    "password.rs",
    "preview.rs",
    "main.rs",
    "lib.rs",
    "profiles.rs",
    "betafeedback.js",
    "sovereignmesh.js",
    ".env",
    ".git",
];

/// Allowed top-level directories for automated source-mode patching.
const ALLOWED_TOP_DIRS: &[&str] = &["src", "tests", "public"];

/// Allowed verification / build steps (fixed allowlist — zero arbitrary shell execution).
pub const ALLOWED_VERIFY_STEPS: &[&str] = &["oxlint", "npm_test", "vite_build", "tauri_build"];

/// Validate that a relative file path is strictly contained within `src/`, `tests/`, or `public/`,
/// has no traversal segments, and does not touch protected security/auth/sandbox modules.
pub fn validate_repair_rel_path(rel_path: &str) -> Result<PathBuf, String> {
    let trimmed = rel_path.trim();
    if trimmed.is_empty() {
        return Err("Relative file path cannot be empty.".into());
    }
    if trimmed.contains('\0') {
        return Err("Null byte rejected in path.".into());
    }
    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || normalized.contains(':') {
        return Err("Path must be relative to the Sovereign repository root.".into());
    }

    let p = Path::new(&normalized);
    let mut parts: Vec<String> = Vec::new();
    for comp in p.components() {
        match comp {
            Component::Normal(os) => {
                let s = os.to_string_lossy().to_string();
                if s.starts_with('.') {
                    return Err(format!("Hidden path segment '{}' is blocked from auto-repair.", s));
                }
                parts.push(s);
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Directory traversal or absolute path components are rejected.".into());
            }
        }
    }

    if parts.len() < 2 {
        return Err("Target file must reside inside src/, tests/, or public/.".into());
    }
    let top = parts[0].as_str();
    if !ALLOWED_TOP_DIRS.contains(&top) {
        return Err(format!(
            "Top-level directory '{}' is outside the auto-repair allowlist ({}).",
            top,
            ALLOWED_TOP_DIRS.join(", ")
        ));
    }

    let lower = normalized.to_ascii_lowercase();
    for forbidden in PROTECTED_PATH_FRAGMENTS {
        if lower.contains(forbidden) {
            return Err(format!(
                "Security boundary: '{}' matches protected module '{}'; automated patching is refused.",
                normalized, forbidden
            ));
        }
    }

    let mut clean = PathBuf::new();
    for part in parts {
        clean.push(part);
    }
    Ok(clean)
}

/// Validate a snapshot identifier (strictly safe alphanumeric/dash/underscore).
pub fn validate_snapshot_id(id: &str) -> Result<String, String> {
    let s = id.trim();
    if s.is_empty() || s.len() > 64 {
        return Err("Snapshot ID must be 1..64 characters.".into());
    }
    if !s
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Snapshot ID contains invalid characters.".into());
    }
    Ok(s.to_string())
}

/// Validate that a requested verification step is on the strict command allowlist.
pub fn validate_verify_step(step: &str) -> Result<&'static str, String> {
    let s = step.trim();
    ALLOWED_VERIFY_STEPS
        .iter()
        .copied()
        .find(|allowed| *allowed == s)
        .ok_or_else(|| format!("Verification step '{}' is not on the allowlist.", s))
}

/// Check that a repository root directory looks like a valid Sovereign OS source tree
/// (`package.json` and `src/` both exist) and is not a drive/system root.
pub fn validate_repair_repo_root(root: &Path) -> Result<PathBuf, String> {
    if !root.is_absolute() {
        return Err("Repository root must be an absolute path.".into());
    }
    let canon = root
        .canonicalize()
        .map_err(|e| format!("Repository root could not be resolved: {}", e))?;
    if canon.parent().is_none() {
        return Err("Filesystem root cannot be used as a repair repository.".into());
    }
    if !canon.join("package.json").is_file() || !canon.join("src").is_dir() {
        return Err("Directory does not look like a Sovereign OS source checkout (missing package.json or src/).".into());
    }
    Ok(canon)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_normal_ui_and_service_files() {
        assert_eq!(
            validate_repair_rel_path("src/components/windows/CardForgeWindow.jsx").unwrap(),
            PathBuf::from("src").join("components").join("windows").join("CardForgeWindow.jsx")
        );
        assert!(validate_repair_rel_path("tests/media/pixEngine.test.mjs").is_ok());
    }

    #[test]
    fn blocks_traversal_and_outside_dirs() {
        assert!(validate_repair_rel_path("../secret.txt").is_err());
        assert!(validate_repair_rel_path("src/../../Windows/win.ini").is_err());
        assert!(validate_repair_rel_path("src-tauri/src/lib.rs").is_err());
        assert!(validate_repair_rel_path("package.json").is_err());
        assert!(validate_repair_rel_path("/etc/passwd").is_err());
        assert!(validate_repair_rel_path("C:\\Windows\\System32\\cmd.exe").is_err());
    }

    #[test]
    fn blocks_protected_security_modules() {
        assert!(validate_repair_rel_path("src/kernel/subsystems/SentinelShield.js").is_err());
        assert!(validate_repair_rel_path("src/services/sentinel/probeRunner.js").is_err());
        assert!(validate_repair_rel_path("src/services/credentialEnclaveService.js").is_err());
        assert!(validate_repair_rel_path("src/services/security/complianceService.js").is_err());
        assert!(validate_repair_rel_path("src/services/sovereignAuth.js").is_err());
        assert!(validate_repair_rel_path("src/services/aunlock/catalog.js").is_err());
        assert!(validate_repair_rel_path("src/services/sovereignMesh.js").is_err());
        assert!(validate_repair_rel_path("src/config/betaFeedback.js").is_err());
    }

    #[test]
    fn blocks_additional_security_critical_frontend_modules() {
        // security/auth/crypto/license/trust core that auto-repair must never rewrite
        for p in [
            "src/kernel/InterAppSecurityBroker.js",
            "src/kernel/subsystems/AuthSubsystem.js",
            "src/services/decentralizedAuthService.js",
            "src/services/founderAuthService.js",
            "src/services/novaAuthClient.js",
            "src/services/meshCrypto.js",
            "src/config/trustedAuthorities.js",
            "src/services/founderLicense.js",
            "src/services/forge/licenses.js",
            "src/components/windows/settings/SecurityCompliancePanel.jsx",
        ] {
            assert!(validate_repair_rel_path(p).is_err(), "must be protected: {p}");
        }
        // feature files that merely share a keyword must STAY patchable (no over-block)
        for p in [
            "src/components/windows/literature/panels/AICoAuthorPanel.jsx", // "author"
            "src/components/backgrounds/MeshWaterBackground.jsx",           // "mesh"
            "src/components/windows/CryptoPredictionTrackerWindow.jsx",     // crypto *price* tracker
        ] {
            assert!(validate_repair_rel_path(p).is_ok(), "must stay patchable: {p}");
        }
    }

    #[test]
    fn validates_snapshot_ids_and_verify_steps() {
        assert_eq!(validate_snapshot_id("snap_2026_01-ab").unwrap(), "snap_2026_01-ab");
        assert!(validate_snapshot_id("../escape").is_err());
        assert!(validate_snapshot_id("").is_err());

        assert_eq!(validate_verify_step("oxlint").unwrap(), "oxlint");
        assert_eq!(validate_verify_step("npm_test").unwrap(), "npm_test");
        assert_eq!(validate_verify_step("vite_build").unwrap(), "vite_build");
        assert!(validate_verify_step("rm -rf /").is_err());
    }
}

