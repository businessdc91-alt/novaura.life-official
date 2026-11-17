//! Local C++20 and C# (.NET / csc.exe) compilation bridge for Cybeni standalone builds.
//! Runs inside a per-project temp build sandbox and invokes only discovered system compiler
//! binaries directly (`g++`/`clang++` or `dotnet`/`csc.exe`), never executing untrusted scripts.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const MAX_FILES: usize = 256;
const MAX_SOURCE_BYTES: usize = 8 * 1024 * 1024;
const MAX_EXE_DOWNLOAD_BYTES: usize = 25 * 1024 * 1024;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[derive(Deserialize, Clone, Debug)]
pub struct NativeFileIn {
    pub path: String,
    pub content: String,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct CompilerDiagnostic {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub severity: String,
    pub message: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainInfo {
    pub available: bool,
    pub compiler: String,
    pub path: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NativeToolchainsStatus {
    pub cpp: ToolchainInfo,
    pub csharp: ToolchainInfo,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NativeCompileResult {
    pub ok: bool,
    pub lang: String,
    pub compiler: String,
    pub exe_name: String,
    pub exe_path: String,
    pub exe_size: u64,
    pub exe_base64: Option<String>,
    pub errors: Vec<String>,
    pub diagnostics: Vec<CompilerDiagnostic>,
    pub output: String,
}

pub fn sanitize_slug(slug: &str) -> Result<String, String> {
    let clean: String = slug
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = clean.trim_matches('-').to_string();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return Err("Invalid project identifier.".to_string());
    }
    Ok(trimmed)
}

pub fn sanitize_rel_path(raw: &str) -> Result<String, String> {
    let normalized = raw.replace('\\', "/");
    let trimmed = normalized.trim_start_matches('/');
    if trimmed.is_empty()
        || trimmed.contains('\0')
        || trimmed.starts_with('/')
        || trimmed.contains(':')
    {
        return Err(format!("Unsafe file path: {raw}"));
    }
    let mut parts = Vec::new();
    for seg in trimmed.split('/') {
        if seg.is_empty() || seg == "." {
            continue;
        }
        if seg == ".." {
            return Err(format!("Path traversal blocked: {raw}"));
        }
        parts.push(seg);
    }
    if parts.is_empty() {
        return Err(format!("Empty file path: {raw}"));
    }
    Ok(parts.join("/"))
}

fn find_in_path(exe_name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(exe_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn find_cpp_compiler() -> Option<(&'static str, PathBuf)> {
    #[cfg(windows)]
    {
        if let Some(p) = find_in_path("g++.exe") {
            return Some(("g++", p));
        }
        if let Some(p) = find_in_path("clang++.exe") {
            return Some(("clang++", p));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let winlibs = PathBuf::from(local)
                .join("Microsoft")
                .join("WinGet")
                .join("Packages")
                .join("BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe")
                .join("mingw64")
                .join("bin")
                .join("g++.exe");
            if winlibs.is_file() {
                return Some(("g++", winlibs));
            }
        }
        for fixed in [
            r"C:\msys64\mingw64\bin\g++.exe",
            r"C:\mingw64\bin\g++.exe",
        ] {
            let p = PathBuf::from(fixed);
            if p.is_file() {
                return Some(("g++", p));
            }
        }
    }
    #[cfg(not(windows))]
    {
        if let Some(p) = find_in_path("g++") {
            return Some(("g++", p));
        }
        if let Some(p) = find_in_path("clang++") {
            return Some(("clang++", p));
        }
    }
    None
}

fn find_csharp_compiler() -> Option<(&'static str, PathBuf)> {
    #[cfg(windows)]
    {
        if let Some(p) = find_in_path("dotnet.exe") {
            return Some(("dotnet", p));
        }
        for fixed in [
            r"C:\Program Files\dotnet\dotnet.exe",
            r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
            r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe",
        ] {
            let p = PathBuf::from(fixed);
            if p.is_file() {
                let name = if fixed.ends_with("dotnet.exe") {
                    "dotnet"
                } else {
                    "csc"
                };
                return Some((name, p));
            }
        }
    }
    #[cfg(not(windows))]
    {
        if let Some(p) = find_in_path("dotnet") {
            return Some(("dotnet", p));
        }
        if let Some(p) = find_in_path("mcs") {
            return Some(("mcs", p));
        }
    }
    None
}

pub fn parse_compiler_diagnostics(raw_output: &str) -> (Vec<CompilerDiagnostic>, Vec<String>) {
    let mut diagnostics = Vec::new();
    let mut errors = Vec::new();

    for line in raw_output.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        // GCC/Clang shape: path/to/file.cpp:12:5: error: expected ';'
        // CSC/MSBuild shape: Program.cs(12,5): error CS1002: ; expected
        if let Some(diag) = try_parse_gcc_diag(t).or_else(|| try_parse_msbuild_diag(t)) {
            if diag.severity == "error" || diag.severity == "fatal error" {
                errors.push(format!("{}:{}: {}", diag.file, diag.line, diag.message));
            }
            diagnostics.push(diag);
        } else if t.to_ascii_lowercase().contains("error:")
            || t.to_ascii_lowercase().contains(": error ")
            || t.contains("undefined reference to")
        {
            errors.push(t.chars().take(280).collect());
        }
    }
    if errors.is_empty() && !raw_output.trim().is_empty() {
        for line in raw_output.lines().take(6) {
            let t = line.trim();
            if !t.is_empty() {
                errors.push(t.chars().take(280).collect());
            }
        }
    }
    errors.truncate(16);
    diagnostics.truncate(32);
    (diagnostics, errors)
}

fn try_parse_gcc_diag(line: &str) -> Option<CompilerDiagnostic> {
    let bytes = line.as_bytes();
    let start_scan = if bytes.len() > 2 && bytes[1] == b':' { 2 } else { 0 };
    let rest = &line[start_scan..];
    let c1 = rest.find(':')?;
    let file = line[..start_scan + c1].to_string();
    let after1 = &rest[c1 + 1..];
    let c2 = after1.find(':')?;
    let line_no: u32 = after1[..c2].trim().parse().ok()?;
    let after2 = &after1[c2 + 1..];

    let (col_no, after_pos) = if let Some(c3) = after2.find(':') {
        if let Ok(col) = after2[..c3].trim().parse::<u32>() {
            (col, after2[c3 + 1..].trim())
        } else {
            (1, after2.trim())
        }
    } else {
        (1, after2.trim())
    };

    for sev in ["fatal error:", "error:", "warning:", "note:"] {
        if let Some(msg) = after_pos.strip_prefix(sev) {
            return Some(CompilerDiagnostic {
                file,
                line: line_no,
                column: col_no,
                severity: sev.trim_end_matches(':').to_string(),
                message: msg.trim().to_string(),
            });
        }
    }
    None
}

fn try_parse_msbuild_diag(line: &str) -> Option<CompilerDiagnostic> {
    let paren_open = line.find('(')?;
    let paren_close = line[paren_open..].find("):")? + paren_open;
    let file = line[..paren_open].trim().to_string();
    let coords = &line[paren_open + 1..paren_close];
    let mut parts = coords.split(',');
    let line_no: u32 = parts.next()?.trim().parse().ok()?;
    let col_no: u32 = parts.next().and_then(|s| s.trim().parse().ok()).unwrap_or(1);
    let after = line[paren_close + 2..].trim();
    if let Some(colon) = after.find(':') {
        let kind_part = after[..colon].to_ascii_lowercase();
        let sev = if kind_part.contains("error") {
            "error"
        } else if kind_part.contains("warning") {
            "warning"
        } else {
            return None;
        };
        return Some(CompilerDiagnostic {
            file,
            line: line_no,
            column: col_no,
            severity: sev.to_string(),
            message: after[colon + 1..].trim().to_string(),
        });
    }
    None
}

#[tauri::command]
pub fn cybeni_native_toolchains() -> NativeToolchainsStatus {
    let cpp = match find_cpp_compiler() {
        Some((name, path)) => ToolchainInfo {
            available: true,
            compiler: name.to_string(),
            path: path.to_string_lossy().to_string(),
        },
        None => ToolchainInfo {
            available: false,
            compiler: "none".to_string(),
            path: String::new(),
        },
    };
    let csharp = match find_csharp_compiler() {
        Some((name, path)) => ToolchainInfo {
            available: true,
            compiler: name.to_string(),
            path: path.to_string_lossy().to_string(),
        },
        None => ToolchainInfo {
            available: false,
            compiler: "none".to_string(),
            path: String::new(),
        },
    };
    NativeToolchainsStatus { cpp, csharp }
}

#[tauri::command]
pub async fn cybeni_native_compile(
    slug: String,
    lang: String,
    files: Vec<NativeFileIn>,
    check_only: bool,
) -> Result<NativeCompileResult, String> {
    if files.len() > MAX_FILES {
        return Err("Too many files in project.".to_string());
    }
    let total_bytes: usize = files.iter().map(|f| f.content.len()).sum();
    if total_bytes > MAX_SOURCE_BYTES {
        return Err("Project source exceeds native compile size budget.".to_string());
    }

    let clean_slug = sanitize_slug(&slug)?;
    let lang_lower = lang.trim().to_ascii_lowercase();
    if lang_lower != "cpp" && lang_lower != "csharp" {
        return Err("Unsupported native compile language; expected 'cpp' or 'csharp'.".to_string());
    }

    let build_root = std::env::temp_dir()
        .join("novaura-cybeni-native")
        .join(&clean_slug);
    if build_root.exists() {
        let _ = fs::remove_dir_all(&build_root);
    }
    fs::create_dir_all(&build_root).map_err(|e| format!("Failed creating build workspace: {e}"))?;

    let mut clean_files = Vec::new();
    for f in files {
        let rel = sanitize_rel_path(&f.path)?;
        let dest = build_root.join(&rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed creating folder: {e}"))?;
        }
        fs::write(&dest, f.content.as_bytes()).map_err(|e| format!("Failed writing {rel}: {e}"))?;
        clean_files.push((rel, f.content));
    }

    let exe_name = if cfg!(windows) {
        format!("{clean_slug}.exe")
    } else {
        clean_slug.clone()
    };
    let out_exe = build_root.join(&exe_name);

    let (compiler_label, output_text, success, resolved_exe) = if lang_lower == "cpp" {
        compile_cpp(&build_root, &clean_files, &out_exe, check_only)?
    } else {
        compile_csharp(&build_root, &clean_files, &out_exe, check_only)?
    };

    let (diagnostics, errors) = if success {
        (Vec::new(), Vec::new())
    } else {
        parse_compiler_diagnostics(&output_text)
    };

    let mut exe_size = 0u64;
    let mut exe_base64 = None;
    let mut exe_path_str = String::new();
    if success && !check_only {
        if let Some(bin_path) = resolved_exe.filter(|p| p.is_file()) {
            exe_path_str = bin_path.to_string_lossy().to_string();
            if let Ok(meta) = fs::metadata(&bin_path) {
                exe_size = meta.len();
                if exe_size <= MAX_EXE_DOWNLOAD_BYTES as u64 {
                    if let Ok(bytes) = fs::read(&bin_path) {
                        exe_base64 = Some(BASE64.encode(&bytes));
                    }
                }
            }
        }
    }

    Ok(NativeCompileResult {
        ok: success,
        lang: lang_lower,
        compiler: compiler_label,
        exe_name,
        exe_path: exe_path_str,
        exe_size,
        exe_base64,
        errors,
        diagnostics,
        output: output_text.chars().take(16000).collect(),
    })
}

fn prepend_compiler_path(cmd: &mut Command, compiler: &Path) {
    if let Some(bin_dir) = compiler.parent() {
        let orig = std::env::var_os("PATH").unwrap_or_default();
        let mut paths = vec![bin_dir.to_path_buf()];
        paths.extend(std::env::split_paths(&orig));
        if let Ok(joined) = std::env::join_paths(paths) {
            cmd.env("PATH", joined);
        }
    }
}

fn compile_cpp(
    root: &Path,
    files: &[(String, String)],
    out_exe: &Path,
    check_only: bool,
) -> Result<(String, String, bool, Option<PathBuf>), String> {
    let Some((label, compiler)) = find_cpp_compiler() else {
        return Err("No C++ compiler found. Install WinLibs MinGW (winget install BrechtSanders.WinLibs.POSIX.UCRT) or clang++.".to_string());
    };
    let cpp_sources: Vec<&String> = files
        .iter()
        .map(|(p, _)| p)
        .filter(|p| {
            let lower = p.to_ascii_lowercase();
            lower.ends_with(".cpp")
                || lower.ends_with(".cc")
                || lower.ends_with(".cxx")
                || lower.ends_with(".c")
        })
        .collect();
    if cpp_sources.is_empty() {
        return Err("No .cpp/.cc/.cxx/.c source files found.".to_string());
    }

    let combined_code: String = files
        .iter()
        .map(|(_, c)| c.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    let uses_win_gui = combined_code.contains("<windows.h>")
        || combined_code.contains("WinMain")
        || combined_code.contains("wWinMain");
    let uses_wmain = combined_code.contains("wWinMain") || combined_code.contains("wmain(");
    let uses_d2d = combined_code.contains("<d2d1.h>") || combined_code.contains("<dwrite.h>");
    let uses_gl = combined_code.contains("<GL/") || combined_code.contains("glClear");

    let mut cmd = Command::new(&compiler);
    hidden(&mut cmd);
    prepend_compiler_path(&mut cmd, &compiler);
    cmd.current_dir(root);
    cmd.arg("-std=c++20").arg("-O2").arg("-I.");
    if uses_win_gui {
        cmd.args(["-D_WIN32_WINNT=0x0A00", "-DWINVER=0x0A00"]);
    }
    if root.join("include").is_dir() {
        cmd.arg("-Iinclude");
    }
    for src in cpp_sources {
        cmd.arg(src);
    }
    if check_only {
        cmd.arg("-fsyntax-only");
    } else {
        cmd.arg("-o").arg(out_exe);
        cmd.arg("-static-libgcc").arg("-static-libstdc++");
        if uses_wmain {
            cmd.arg("-municode");
        }
        if uses_win_gui {
            cmd.args(["-mwindows", "-luser32", "-lgdi32", "-ldwmapi"]);
        }
        if uses_d2d {
            cmd.args(["-ld2d1", "-ldwrite", "-lole32"]);
        }
        if uses_gl {
            cmd.arg("-lopengl32");
        }
    }

    let out = cmd
        .output()
        .map_err(|e| format!("Failed starting {label}: {e}"))?;
    let merged = format!(
        "{}\n{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
    .trim()
    .to_string();
    Ok((
        label.to_string(),
        merged,
        out.status.success(),
        Some(out_exe.to_path_buf()),
    ))
}

fn compile_csharp(
    root: &Path,
    files: &[(String, String)],
    out_exe: &Path,
    check_only: bool,
) -> Result<(String, String, bool, Option<PathBuf>), String> {
    let Some((label, compiler)) = find_csharp_compiler() else {
        return Err("No C# compiler found (neither dotnet SDK nor csc.exe). Install .NET 8 SDK with: winget install Microsoft.DotNet.SDK.8".to_string());
    };
    let cs_sources: Vec<&String> = files
        .iter()
        .map(|(p, _)| p)
        .filter(|p| p.to_ascii_lowercase().ends_with(".cs"))
        .collect();
    if cs_sources.is_empty() {
        return Err("No .cs source files found.".to_string());
    }

    let csproj = files
        .iter()
        .map(|(p, _)| p)
        .find(|p| p.to_ascii_lowercase().ends_with(".csproj"));

    if label == "dotnet" {
        if csproj.is_none() {
            return Err("dotnet compiler requires a .csproj file in the project.".to_string());
        }
        let dist_dir = root.join("cybeni_out");
        let mut cmd = Command::new(&compiler);
        hidden(&mut cmd);
        cmd.current_dir(root);
        if check_only {
            cmd.args(["build", csproj.unwrap(), "--no-restore", "-c", "Release"])
                .arg("-v:minimal");
            // Retry without --no-restore if restore needed; keep offline check clean first
            let mut full_cmd = Command::new(&compiler);
            hidden(&mut full_cmd);
            full_cmd
                .current_dir(root)
                .args(["build", csproj.unwrap(), "-c", "Release", "-o"])
                .arg(&dist_dir);
            let out = full_cmd
                .output()
                .map_err(|e| format!("Failed starting dotnet: {e}"))?;
            let merged = format!(
                "{}\n{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            )
            .trim()
            .to_string();
            return Ok(("dotnet".to_string(), merged, out.status.success(), None));
        }
        cmd.args(["publish", csproj.unwrap(), "-c", "Release", "-o"])
            .arg(&dist_dir);
        let out = cmd
            .output()
            .map_err(|e| format!("Failed starting dotnet: {e}"))?;
        let merged = format!(
            "{}\n{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        )
        .trim()
        .to_string();
        let produced = fs::read_dir(&dist_dir)
            .ok()
            .and_then(|rd| {
                rd.filter_map(Result::ok)
                    .map(|e| e.path())
                    .find(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("exe")))
            });
        return Ok(("dotnet".to_string(), merged, out.status.success(), produced));
    }

    // csc.exe fallback (built into Windows .NET Framework 4.x)
    let combined_code: String = files
        .iter()
        .map(|(_, c)| c.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    let win_exe = combined_code.contains("System.Windows.Forms");

    let mut cmd = Command::new(&compiler);
    hidden(&mut cmd);
    cmd.current_dir(root);
    cmd.arg("/nologo");
    cmd.arg(if win_exe {
        "/target:winexe"
    } else {
        "/target:exe"
    });
    cmd.arg(format!("/out:{}", out_exe.display()));
    cmd.args([
        "/reference:System.dll",
        "/reference:System.Core.dll",
        "/reference:System.Drawing.dll",
        "/reference:System.Windows.Forms.dll",
        "/reference:System.Net.Http.dll",
    ]);
    for src in cs_sources {
        cmd.arg(src);
    }

    let out = cmd
        .output()
        .map_err(|e| format!("Failed starting {label}: {e}"))?;
    let merged = format!(
        "{}\n{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
    .trim()
    .to_string();
    Ok((
        label.to_string(),
        merged,
        out.status.success(),
        Some(out_exe.to_path_buf()),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_paths_and_blocks_traversal() {
        assert_eq!(sanitize_rel_path("/src/main.cpp").unwrap(), "src/main.cpp");
        assert!(sanitize_rel_path("../secret.cpp").is_err());
        assert!(sanitize_rel_path("C:/Windows/win.ini").is_err());
        assert!(sanitize_slug("my_app-1").is_ok());
        assert!(sanitize_slug("///").is_err());
    }

    #[test]
    fn parses_gcc_and_csc_diagnostics() {
        let raw = "src/main.cpp:12:5: error: 'foo' was not declared in this scope\nProgram.cs(8,13): error CS1002: ; expected\n";
        let (diags, errors) = parse_compiler_diagnostics(raw);
        assert_eq!(diags.len(), 2);
        assert_eq!(diags[0].file, "src/main.cpp");
        assert_eq!(diags[0].line, 12);
        assert_eq!(diags[0].severity, "error");
        assert_eq!(diags[1].file, "Program.cs");
        assert_eq!(diags[1].line, 8);
        assert_eq!(errors.len(), 2);
    }
}
