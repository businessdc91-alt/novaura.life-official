//! Path-jailed, snapshot-backed Source Auto-Repair & Verification Bridge for Sovereign OS.
//! Strictly gated behind opt-in local repository selection, immutable security denylists
//! (`repair_rules.rs`), automatic pre-patch backups, instant rollback, and allowlisted
//! verification commands (`oxlint`, `node --test`, `vite build`, `tauri:build`).

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

#[path = "repair_rules.rs"]
pub mod rules;

const MAX_SOURCE_BYTES: u64 = 512 * 1024;

#[derive(Deserialize, Debug)]
pub struct StagedPatchEdit {
    pub rel_path: String,
    pub target: String,
    pub replacement: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SnapshotManifest {
    pub snapshot_id: String,
    pub repo_root: String,
    pub files: Vec<String>,
}

#[derive(Serialize, Debug)]
pub struct StagedPatchResult {
    pub snapshot_id: String,
    pub modified_files: Vec<String>,
}

#[derive(Serialize, Debug)]
pub struct VerifyStepResult {
    pub step: String,
    pub ok: bool,
    pub exit_code: i32,
    pub duration_ms: u128,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Serialize, Debug)]
pub struct VerificationReport {
    pub passed: bool,
    pub steps: Vec<VerifyStepResult>,
}

fn snapshots_base_dir() -> PathBuf {
    let base = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let mut path = PathBuf::from(base);
    path.push("novaura-sovereign");
    path.push("repair_snapshots");
    path
}

fn truncate_output(raw: &[u8], limit: usize) -> String {
    let s = String::from_utf8_lossy(raw);
    if s.len() <= limit {
        s.to_string()
    } else {
        let mut tail_start = s.len().saturating_sub(limit);
        while tail_start < s.len() && !s.is_char_boundary(tail_start) {
            tail_start += 1;
        }
        format!("...[truncated]...\n{}", &s[tail_start..])
    }
}

fn run_npm_script(repo_root: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd.exe");
        cmd.arg("/C").arg("npm");
        for a in args {
            cmd.arg(a);
        }
        cmd.current_dir(repo_root);
        cmd.output().map_err(|e| format!("Could not launch npm: {}", e))
    }
    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("npm");
        for a in args {
            cmd.arg(a);
        }
        cmd.current_dir(repo_root);
        cmd.output().map_err(|e| format!("Could not launch npm: {}", e))
    }
}

fn run_npx_args(repo_root: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd.exe");
        cmd.arg("/C").arg("npx");
        for a in args {
            cmd.arg(a);
        }
        cmd.current_dir(repo_root);
        cmd.output().map_err(|e| format!("Could not launch npx: {}", e))
    }
    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("npx");
        for a in args {
            cmd.arg(a);
        }
        cmd.current_dir(repo_root);
        cmd.output().map_err(|e| format!("Could not launch npx: {}", e))
    }
}

/// Resolve `root`/`clean_rel` to its real canonical path, following any symlinks, and reject it
/// unless it still lands inside the (already-canonical) repo root AND re-passes the path jail on
/// its RESOLVED relative path. This closes a symlink inside an allowed dir that points at a
/// protected module (`src-tauri/`, sentinel, …) or outside the repo entirely. Auto-repair only
/// ever modifies files that already exist, so `canonicalize` always resolves here.
fn resolve_jailed_path(root: &Path, clean_rel: &Path) -> Result<PathBuf, String> {
    let canon = root
        .join(clean_rel)
        .canonicalize()
        .map_err(|e| format!("Path could not be resolved: {}", e))?;
    let rel = canon
        .strip_prefix(root)
        .map_err(|_| "Security boundary: resolved path escapes the repository (symlink?).".to_string())?;
    let rel_str = rel.to_string_lossy().replace('\\', "/");
    rules::validate_repair_rel_path(&rel_str)?;
    Ok(canon)
}

/// Safely read a source file inside an opt-in Sovereign OS repository checkout.
#[tauri::command]
pub fn repair_read_source(repo_root: String, rel_path: String) -> Result<String, String> {
    let root = rules::validate_repair_repo_root(Path::new(&repo_root))?;
    let clean_rel = rules::validate_repair_rel_path(&rel_path)?;
    let full = resolve_jailed_path(&root, &clean_rel)?;
    let meta = fs::metadata(&full).map_err(|e| format!("File not readable: {}", e))?;
    if meta.len() > MAX_SOURCE_BYTES {
        return Err("Source file exceeds 512 KB auto-repair limit.".into());
    }
    fs::read_to_string(&full).map_err(|e| format!("Could not read file: {}", e))
}

/// Atomically snapshot target files and apply verified string-replacement edits.
/// If any target string does not match uniquely, ZERO files are modified.
#[tauri::command]
pub fn repair_apply_staged_patch(
    repo_root: String,
    snapshot_id: String,
    edits: Vec<StagedPatchEdit>,
) -> Result<StagedPatchResult, String> {
    if edits.is_empty() {
        return Err("No patch edits provided.".into());
    }
    let root = rules::validate_repair_repo_root(Path::new(&repo_root))?;
    let snap_id = rules::validate_snapshot_id(&snapshot_id)?;

    // Phase 1: Validate all paths and compute all in-memory replacements atomically
    // Supports multiple sequential edits targeting the same file while preserving its untouched original.
    let mut staged: Vec<(PathBuf, String, String, String)> = Vec::new();
    let mut index_by_path: std::collections::HashMap<PathBuf, usize> =
        std::collections::HashMap::new();
    for edit in &edits {
        let clean_rel = rules::validate_repair_rel_path(&edit.rel_path)?;
        if edit.target.is_empty() {
            return Err(format!("Edit target cannot be empty for '{}'.", edit.rel_path));
        }
        if let Some(&idx) = index_by_path.get(&clean_rel) {
            let current = &staged[idx].3;
            let matches = current.matches(&edit.target).count();
            if matches == 0 {
                return Err(format!(
                    "Target snippet not found in '{}' — patch aborted safely with zero changes.",
                    edit.rel_path
                ));
            }
            if matches > 1 {
                return Err(format!(
                    "Target snippet matched {} times in '{}' — provide more surrounding context.",
                    matches, edit.rel_path
                ));
            }
            staged[idx].3 = current.replacen(&edit.target, &edit.replacement, 1);
        } else {
            let full = resolve_jailed_path(&root, &clean_rel)?;
            let original = fs::read_to_string(&full)
                .map_err(|e| format!("Could not read '{}': {}", edit.rel_path, e))?;
            let matches = original.matches(&edit.target).count();
            if matches == 0 {
                return Err(format!(
                    "Target snippet not found in '{}' — patch aborted safely with zero changes.",
                    edit.rel_path
                ));
            }
            if matches > 1 {
                return Err(format!(
                    "Target snippet matched {} times in '{}' — provide more surrounding context.",
                    matches, edit.rel_path
                ));
            }
            let updated = original.replacen(&edit.target, &edit.replacement, 1);
            let idx = staged.len();
            index_by_path.insert(clean_rel.clone(), idx);
            staged.push((clean_rel, edit.rel_path.clone(), original, updated));
        }
    }

    // Phase 2: Persist pre-patch backup snapshot
    let snap_dir = snapshots_base_dir().join(&snap_id);
    fs::create_dir_all(&snap_dir).map_err(|e| format!("Could not create snapshot dir: {}", e))?;

    let mut manifest_files: Vec<String> = Vec::new();
    for (clean_rel, raw_rel, original, _) in &staged {
        let backup_dest = snap_dir.join("files").join(clean_rel);
        if let Some(parent) = backup_dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Backup dir error: {}", e))?;
        }
        fs::write(&backup_dest, original)
            .map_err(|e| format!("Could not snapshot '{}': {}", raw_rel, e))?;
        manifest_files.push(raw_rel.replace('\\', "/"));
    }

    let manifest = SnapshotManifest {
        snapshot_id: snap_id.clone(),
        repo_root: root.to_string_lossy().to_string(),
        files: manifest_files.clone(),
    };
    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(snap_dir.join("manifest.json"), manifest_json)
        .map_err(|e| format!("Could not write snapshot manifest: {}", e))?;

    // Phase 3: Write updated files (auto-restore prior files if a mid-patch write fails)
    let mut written: Vec<(&PathBuf, &String)> = Vec::new();
    for (clean_rel, raw_rel, original, updated) in &staged {
        let full = root.join(clean_rel);
        if let Err(e) = fs::write(&full, updated) {
            for (prev_rel, prev_orig) in &written {
                let _ = fs::write(root.join(prev_rel), prev_orig);
            }
            return Err(format!(
                "Failed writing patched '{}' (prior edits rolled back): {}",
                raw_rel, e
            ));
        }
        written.push((clean_rel, original));
    }

    Ok(StagedPatchResult {
        snapshot_id: snap_id,
        modified_files: manifest_files,
    })
}

/// Restore exact pre-patch file contents from a saved repair snapshot (1-click rollback).
#[tauri::command]
pub fn repair_rollback_snapshot(repo_root: String, snapshot_id: String) -> Result<Vec<String>, String> {
    let root = rules::validate_repair_repo_root(Path::new(&repo_root))?;
    let snap_id = rules::validate_snapshot_id(&snapshot_id)?;
    let snap_dir = snapshots_base_dir().join(&snap_id);
    let manifest_raw = fs::read_to_string(snap_dir.join("manifest.json"))
        .map_err(|e| format!("Snapshot '{}' not found: {}", snap_id, e))?;
    let manifest: SnapshotManifest =
        serde_json::from_str(&manifest_raw).map_err(|e| format!("Corrupt snapshot manifest: {}", e))?;

    let mut restored = Vec::new();
    for raw_rel in &manifest.files {
        let clean_rel = rules::validate_repair_rel_path(raw_rel)?;
        let backup_src = snap_dir.join("files").join(&clean_rel);
        let original = fs::read_to_string(&backup_src)
            .map_err(|e| format!("Could not read backup for '{}': {}", raw_rel, e))?;
        let target = resolve_jailed_path(&root, &clean_rel)?;
        fs::write(&target, original)
            .map_err(|e| format!("Could not restore '{}': {}", raw_rel, e))?;
        restored.push(raw_rel.clone());
    }
    Ok(restored)
}

/// Execute allowlisted verification gates (`oxlint`, `npm_test`, `vite_build`) inside the opt-in repo.
#[tauri::command]
pub async fn repair_run_verification(
    repo_root: String,
    steps: Vec<String>,
    changed_files: Vec<String>,
) -> Result<VerificationReport, String> {
    let root = rules::validate_repair_repo_root(Path::new(&repo_root))?;
    let mut valid_steps: Vec<&'static str> = Vec::new();
    for s in &steps {
        valid_steps.push(rules::validate_verify_step(s)?);
    }
    let mut valid_files: Vec<String> = Vec::new();
    for f in &changed_files {
        let clean = rules::validate_repair_rel_path(f)?;
        valid_files.push(clean.to_string_lossy().replace('\\', "/"));
    }

    tauri::async_runtime::spawn_blocking(move || {
        let mut results: Vec<VerifyStepResult> = Vec::new();
        let mut all_ok = true;

        for step in valid_steps {
            let started = Instant::now();
            let output_res = match step {
                "oxlint" => {
                    let mut args: Vec<&str> = vec!["oxlint"];
                    if valid_files.is_empty() {
                        args.push("src");
                    } else {
                        for f in &valid_files {
                            args.push(f.as_str());
                        }
                    }
                    run_npx_args(&root, &args)
                }
                "npm_test" => run_npm_script(&root, &["test"]),
                "vite_build" => run_npm_script(&root, &["run", "build"]),
                "tauri_build" => run_npm_script(&root, &["run", "tauri:build"]),
                _ => Err(format!("Unsupported step '{}'", step)),
            };

            let duration_ms = started.elapsed().as_millis();
            match output_res {
                Ok(out) => {
                    let ok = out.status.success();
                    if !ok {
                        all_ok = false;
                    }
                    results.push(VerifyStepResult {
                        step: step.to_string(),
                        ok,
                        exit_code: out.status.code().unwrap_or(-1),
                        duration_ms,
                        stdout: truncate_output(&out.stdout, 4000),
                        stderr: truncate_output(&out.stderr, 4000),
                    });
                    if !ok {
                        break;
                    }
                }
                Err(err) => {
                    all_ok = false;
                    results.push(VerifyStepResult {
                        step: step.to_string(),
                        ok: false,
                        exit_code: -1,
                        duration_ms,
                        stdout: String::new(),
                        stderr: err,
                    });
                    break;
                }
            }
        }

        Ok(VerificationReport {
            passed: all_ok,
            steps: results,
        })
    })
    .await
    .map_err(|e| format!("Verification worker error: {}", e))?
}
