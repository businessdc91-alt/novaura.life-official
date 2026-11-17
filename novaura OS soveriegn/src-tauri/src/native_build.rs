//! Local C++20 and C# compilation for Cybeni standalone builds.
//!
//! Each build runs in its own temp folder and calls a discovered compiler directly
//! (`g++`/`clang++`, the `dotnet` SDK, or the .NET Framework `csc.exe`).
//!
//! SECURITY: compiling is not running, but a build system can run code, and a project's files
//! may come from an imported repository or from a model that read one. Cybeni checks C++ and C#
//! by itself during a build (no click), so:
//! - C#: the project's own .csproj is never built. Cybeni writes its own project file from a
//!   short list of settings (output type, WinForms/WPF, nullable, ...), refuses NuGet packages,
//!   never writes MSBuild or NuGet control files (Directory.Build.*, *.targets, nuget.config, ...)
//!   into the build folder, and gives the build a NuGet config with no package sources.
//!   Nothing is downloaded and no project-supplied build logic runs.
//! - g++ and csc read options from `@file` arguments, and an argument that starts with '-' is
//!   an option: such file names are refused, and g++ gets sources as `./path`.
//! - An `#include`/`#embed` of a path outside the project is refused, so a compiler error
//!   cannot quote a private file into the build log (which goes to the model).
//! - Every compile has a deadline and runs off the async runtime.

#[path = "native_build_rules.rs"]
mod rules;
pub use rules::*;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

const MAX_FILES: usize = 256;
const MAX_SOURCE_BYTES: usize = 8 * 1024 * 1024;
const CHECK_TIMEOUT: Duration = Duration::from_secs(120);
const BUILD_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Deserialize, Clone, Debug)]
pub struct NativeFileIn {
    pub path: String,
    pub content: String,
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
    /// The program when it is a single file (g++, csc).
    pub exe_base64: Option<String>,
    /// Every file the program needs to run (a `dotnet` build is an .exe plus its .dll and
    /// runtime files); download these together.
    pub artifacts: Vec<NativeArtifact>,
    pub errors: Vec<String>,
    pub diagnostics: Vec<CompilerDiagnostic>,
    pub output: String,
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

/// Compile (or only check) a project. Runs on a blocking thread so a long build does not
/// stall the app's other commands.
#[tauri::command]
pub async fn cybeni_native_compile(
    slug: String,
    lang: String,
    files: Vec<NativeFileIn>,
    check_only: bool,
) -> Result<NativeCompileResult, String> {
    tauri::async_runtime::spawn_blocking(move || compile_blocking(slug, lang, files, check_only))
        .await
        .map_err(|e| format!("The native build task failed: {e}"))?
}

fn compile_blocking(
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

    // Every path is checked before anything is written.
    let (sources, project_csproj) = select_build_files(files.into_iter().map(|f| (f.path, f.content)).collect())?;

    let build_root = std::env::temp_dir()
        .join("novaura-cybeni-native")
        .join(&clean_slug);
    if build_root.exists() {
        let _ = fs::remove_dir_all(&build_root);
    }
    fs::create_dir_all(&build_root).map_err(|e| format!("Failed creating build workspace: {e}"))?;
    for (rel, content) in &sources {
        let dest = build_root.join(rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed creating folder: {e}"))?;
        }
        fs::write(&dest, content.as_bytes()).map_err(|e| format!("Failed writing {rel}: {e}"))?;
    }

    let exe_name = if cfg!(windows) {
        format!("{clean_slug}.exe")
    } else {
        clean_slug.clone()
    };
    let limit = if check_only { CHECK_TIMEOUT } else { BUILD_TIMEOUT };

    let built = if lang_lower == "cpp" {
        compile_cpp(&build_root, &sources, &build_root.join(&exe_name), check_only, limit)?
    } else {
        compile_csharp(&build_root, &clean_slug, &sources, project_csproj.as_deref(), &exe_name, check_only, limit)?
    };

    let (diagnostics, errors) = if built.success {
        (Vec::new(), Vec::new())
    } else {
        parse_compiler_diagnostics(&built.output)
    };

    let mut result = NativeCompileResult {
        ok: built.success,
        lang: lang_lower,
        compiler: built.compiler,
        exe_name: exe_name.clone(),
        exe_path: String::new(),
        exe_size: 0,
        exe_base64: None,
        artifacts: Vec::new(),
        errors,
        diagnostics,
        output: built.output.chars().take(16000).collect(),
    };
    if built.success && !check_only {
        let artifacts = match &built.output_dir {
            Some(dir) => collect_artifacts(dir)?,
            None => collect_artifacts_single(&build_root.join(&exe_name))?,
        };
        let exe = built.output_dir.as_ref().map_or_else(|| build_root.join(&exe_name), |d| d.join(&exe_name));
        result.exe_path = exe.to_string_lossy().to_string();
        result.exe_size = fs::metadata(&exe).map(|m| m.len()).unwrap_or(0);
        if artifacts.len() == 1 {
            result.exe_base64 = Some(artifacts[0].base64.clone());
        }
        result.artifacts = artifacts;
    }
    Ok(result)
}

fn collect_artifacts_single(exe: &Path) -> Result<Vec<NativeArtifact>, String> {
    if !exe.is_file() {
        return Ok(Vec::new());
    }
    let size = fs::metadata(exe).map(|m| m.len()).unwrap_or(0);
    if size > MAX_ARTIFACT_BYTES {
        return Err(format!(
            "The program is larger than {} MB, too large to hand back.",
            MAX_ARTIFACT_BYTES / (1024 * 1024)
        ));
    }
    let bytes = fs::read(exe).map_err(|e| format!("Could not read the program: {e}"))?;
    let name = exe.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    Ok(vec![NativeArtifact { name, base64: BASE64.encode(&bytes) }])
}

struct Built {
    compiler: String,
    output: String,
    success: bool,
    /// Where a multi-file build (dotnet) put its output; single-file builds leave it unset.
    output_dir: Option<PathBuf>,
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
    limit: Duration,
) -> Result<Built, String> {
    let Some((label, compiler)) = find_cpp_compiler() else {
        return Err("No C++ compiler found. Install WinLibs MinGW (winget install BrechtSanders.WinLibs.POSIX.UCRT) or clang++.".to_string());
    };
    let cpp_sources: Vec<&String> = files
        .iter()
        .map(|(p, _)| p)
        .filter(|p| {
            let lower = p.to_ascii_lowercase();
            lower.ends_with(".cpp") || lower.ends_with(".cc") || lower.ends_with(".cxx") || lower.ends_with(".c")
        })
        .collect();
    if cpp_sources.is_empty() {
        return Err("No .cpp/.cc/.cxx/.c source files found.".to_string());
    }

    let combined_code: String = files.iter().map(|(_, c)| c.as_str()).collect::<Vec<_>>().join("\n");
    let uses_win_gui = combined_code.contains("<windows.h>")
        || combined_code.contains("WinMain")
        || combined_code.contains("wWinMain");
    let uses_wmain = combined_code.contains("wWinMain") || combined_code.contains("wmain(");
    let uses_d2d = combined_code.contains("<d2d1.h>") || combined_code.contains("<dwrite.h>");
    let uses_gl = combined_code.contains("<GL/") || combined_code.contains("glClear");

    let mut cmd = Command::new(&compiler);
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
        cmd.arg(gcc_source_arg(src));
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

    let (output, success) = run_with_timeout(&mut cmd, limit)?;
    Ok(Built { compiler: label.to_string(), output, success, output_dir: None })
}

fn dotnet_sdk_major(dotnet: &Path, root: &Path) -> Result<u32, String> {
    let mut cmd = Command::new(dotnet);
    cmd.current_dir(root).arg("--version").env("DOTNET_NOLOGO", "1").env("DOTNET_CLI_TELEMETRY_OPTOUT", "1");
    let (out, ok) = run_with_timeout(&mut cmd, Duration::from_secs(30))?;
    let major = out.lines().filter_map(parse_sdk_major).next();
    match major {
        Some(m) if ok => Ok(m),
        _ => Err(format!("Could not read the .NET SDK version: {}", out.chars().take(200).collect::<String>())),
    }
}

fn compile_csharp(
    root: &Path,
    slug: &str,
    files: &[(String, String)],
    project_csproj: Option<&str>,
    exe_name: &str,
    check_only: bool,
    limit: Duration,
) -> Result<Built, String> {
    let Some((label, compiler)) = find_csharp_compiler() else {
        return Err("No C# compiler found (neither dotnet SDK nor csc.exe). Install the .NET SDK with: winget install Microsoft.DotNet.SDK.8".to_string());
    };
    let cs_sources: Vec<&String> = files
        .iter()
        .map(|(p, _)| p)
        .filter(|p| p.to_ascii_lowercase().ends_with(".cs"))
        .collect();
    if cs_sources.is_empty() {
        return Err("No .cs source files found.".to_string());
    }

    if label == "dotnet" {
        let major = dotnet_sdk_major(&compiler, root)?;
        let csproj = csharp_project_file(project_csproj, files, major)?;
        let csproj_name = format!("{slug}.csproj");
        fs::write(root.join(&csproj_name), csproj).map_err(|e| format!("Failed writing the project file: {e}"))?;
        fs::write(root.join("NuGet.Config"), OFFLINE_NUGET_CONFIG)
            .map_err(|e| format!("Failed writing the NuGet config: {e}"))?;
        let dist_dir = root.join("cybeni_out");
        let mut cmd = Command::new(&compiler);
        cmd.current_dir(root)
            .env("DOTNET_NOLOGO", "1")
            .env("DOTNET_CLI_TELEMETRY_OPTOUT", "1")
            .env("DOTNET_SKIP_FIRST_TIME_EXPERIENCE", "1")
            .env("DOTNET_GENERATE_ASPNET_CERTIFICATE", "false")
            .args(["build", &csproj_name, "-c", "Release", "-o"])
            .arg(&dist_dir)
            .args([
                "-nologo",
                "-nodeReuse:false",
                "-p:ImportDirectoryBuildProps=false",
                "-p:ImportDirectoryBuildTargets=false",
                "-p:ImportDirectoryPackagesProps=false",
            ]);
        if major >= 7 {
            cmd.arg("--disable-build-servers");
        }
        let (output, success) = run_with_timeout(&mut cmd, limit)?;
        let produced = success && !check_only && dist_dir.join(exe_name).is_file();
        return Ok(Built {
            compiler: "dotnet".to_string(),
            output,
            success,
            output_dir: produced.then_some(dist_dir),
        });
    }

    // csc.exe (the .NET Framework 4.x compiler built into Windows)
    let combined_code: String = files.iter().map(|(_, c)| c.as_str()).collect::<Vec<_>>().join("\n");
    let win_exe = combined_code.contains("System.Windows.Forms");
    let out_exe = root.join(exe_name);
    let mut cmd = Command::new(&compiler);
    cmd.current_dir(root);
    cmd.arg("/nologo");
    cmd.arg(if win_exe { "/target:winexe" } else { "/target:exe" });
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
    let (output, success) = run_with_timeout(&mut cmd, limit)?;
    Ok(Built { compiler: label.to_string(), output, success, output_dir: None })
}
