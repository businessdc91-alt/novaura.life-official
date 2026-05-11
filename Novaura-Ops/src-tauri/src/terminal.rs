use serde::Serialize;
use std::process::Command;
use tauri::command;

#[derive(Serialize)]
pub struct TerminalOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[command]
pub async fn terminal_execute(cmd: String, cwd: Option<String>) -> Result<TerminalOutput, String> {
    let shell = if cfg!(windows) { "cmd" } else { "sh" };
    let flag = if cfg!(windows) { "/C" } else { "-c" };
    let mut builder = Command::new(shell);
    builder.args([flag, &cmd]);
    if let Some(dir) = cwd {
        builder.current_dir(&dir);
    }
    let output = builder.output().map_err(|e| e.to_string())?;
    Ok(TerminalOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[command]
pub async fn project_build(project_path: String) -> Result<TerminalOutput, String> {
    terminal_execute("npm run build".to_string(), Some(project_path)).await
}

#[command]
pub async fn project_install_deps(project_path: String) -> Result<TerminalOutput, String> {
    terminal_execute("npm install".to_string(), Some(project_path)).await
}

#[command]
pub async fn project_info(project_path: String) -> Result<serde_json::Value, String> {
    let pkg = std::fs::read_to_string(format!("{}/package.json", project_path))
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&pkg).map_err(|e| e.to_string())
}

#[command]
pub async fn project_list_files(project_path: String, depth: Option<u32>) -> Result<Vec<String>, String> {
    let max_depth = depth.unwrap_or(3);
    let mut files = Vec::new();
    fn walk(path: &str, current_depth: u32, max: u32, out: &mut Vec<String>) {
        if current_depth > max { return; }
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let p = entry.path();
                let name = p.to_string_lossy().to_string();
                if name.contains("node_modules") || name.contains(".git") || name.contains("target") { continue; }
                out.push(name.clone());
                if p.is_dir() { walk(&name, current_depth + 1, max, out); }
            }
        }
    }
    walk(&project_path, 0, max_depth, &mut files);
    Ok(files)
}
