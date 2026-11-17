//! The rules a native (C++/C#) build follows, kept free of Tauri so their tests can run
//! (`npm run tauri:test`; a test binary that links Tauri cannot start on Windows).
//! The SECURITY notes in native_build.rs explain why each rule exists.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

/// Everything a build hands back for download, together.
pub const MAX_ARTIFACT_BYTES: u64 = 64 * 1024 * 1024;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
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
pub struct NativeArtifact {
    pub name: String,
    pub base64: String,
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

/// A project path that is also safe to hand a compiler as an argument: no part of it may
/// start with '@' (a response file of options) or '-' (an option).
pub fn native_safe_path(raw: &str) -> Result<String, String> {
    let rel = sanitize_rel_path(raw)?;
    if rel.split('/').any(|seg| seg.starts_with('@') || seg.starts_with('-')) {
        return Err(format!("File and folder names may not start with '@' or '-': {raw}"));
    }
    Ok(rel)
}

/// How a source file is passed to g++/clang++: always relative to the build folder.
pub fn gcc_source_arg(rel: &str) -> String {
    format!("./{rel}")
}

/// Files that steer MSBuild, NuGet or a compiler's options. They are never written into the
/// build folder; Cybeni writes the C# project file and NuGet config itself.
pub fn is_build_control_file(rel: &str) -> bool {
    let name = rel.rsplit('/').next().unwrap_or(rel).to_ascii_lowercase();
    const EXTENSIONS: [&str; 10] = [
        ".csproj", ".vbproj", ".fsproj", ".proj", ".sln", ".slnx", ".slnf", ".props", ".targets", ".rsp",
    ];
    EXTENSIONS.iter().any(|e| name.ends_with(e))
        || name == "nuget.config"
        || name == "global.json"
        || name == "packages.config"
        || name.starts_with("directory.build.")
        || name.starts_with("directory.packages.")
}

pub fn is_c_family(rel: &str) -> bool {
    let lower = rel.to_ascii_lowercase();
    [".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx", ".inl", ".ipp"]
        .iter()
        .any(|e| lower.ends_with(e))
}

/// Refuse `#include`, `#include_next`, `#import` and `#embed` of a path outside the project
/// (absolute, a drive or share, or climbing out with `..`). Headers on the compiler's own
/// search path (`<vector>`, `<windows.h>`) are fine. An include spelled through a macro is
/// not caught here.
pub fn check_includes(rel: &str, content: &str) -> Result<(), String> {
    for (i, line) in content.lines().enumerate() {
        let Some(rest) = line.trim_start().strip_prefix('#') else { continue };
        let rest = rest.trim_start();
        let Some(rest) = ["include_next", "include", "import", "embed"]
            .iter()
            .find_map(|d| rest.strip_prefix(d))
        else {
            continue;
        };
        let rest = rest.trim_start();
        let close = match rest.chars().next() {
            Some('<') => '>',
            Some('"') => '"',
            _ => continue,
        };
        let inner = &rest[1..];
        let Some(end) = inner.find(close) else { continue };
        let target = inner[..end].replace('\\', "/");
        let outside = target.starts_with('/') || target.contains(':') || target.split('/').any(|s| s == "..");
        if outside {
            return Err(format!(
                "{rel}:{}: including a file outside the project is not allowed ({}).",
                i + 1,
                &inner[..end]
            ));
        }
    }
    Ok(())
}

/// Which of a project's files go into the build folder. Every path is checked first; build
/// control files are left out (the first .csproj is returned for its settings only), and
/// C/C++ files may not include anything outside the project.
pub fn select_build_files(
    files: Vec<(String, String)>,
) -> Result<(Vec<(String, String)>, Option<String>), String> {
    let mut sources = Vec::new();
    let mut project_csproj = None;
    for (path, content) in files {
        let rel = native_safe_path(&path)?;
        if is_build_control_file(&rel) {
            if project_csproj.is_none() && rel.to_ascii_lowercase().ends_with(".csproj") {
                project_csproj = Some(content);
            }
            continue;
        }
        if is_c_family(&rel) {
            check_includes(&rel, &content)?;
        }
        sources.push((rel, content));
    }
    Ok((sources, project_csproj))
}

/// The major version from `dotnet --version` ("10.0.102" -> 10).
pub fn parse_sdk_major(version: &str) -> Option<u32> {
    version.trim().split('.').next()?.trim().parse().ok()
}

/// A single-word MSBuild value from `<Name>value</Name>`, if it is one of `allowed`
/// (compared without case), returned in the allowed spelling.
fn xml_choice(xml: &str, name: &str, allowed: &[&str]) -> Option<String> {
    let open = format!("<{name}>");
    let close = format!("</{name}>");
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    let value = xml[start..end].trim();
    allowed.iter().find(|a| a.eq_ignore_ascii_case(value)).map(|a| a.to_string())
}

/// `<Name>value</Name>` when the value is a plain identifier (letters, digits, '.', '_').
fn xml_word(xml: &str, name: &str) -> Option<String> {
    let open = format!("<{name}>");
    let close = format!("</{name}>");
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    let value = xml[start..end].trim();
    let plain = !value.is_empty()
        && value.len() <= 64
        && value.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_');
    plain.then(|| value.to_string())
}

/// The C# project file Cybeni builds. Only a short list of settings is read from the
/// project's own .csproj (if any); everything else in it (imports, targets, tasks, other
/// properties) is ignored. NuGet packages are refused, because restoring them runs the
/// packages' own build logic and needs the network.
pub fn csharp_project_file(
    project_csproj: Option<&str>,
    sources: &[(String, String)],
    sdk_major: u32,
) -> Result<String, String> {
    let given = project_csproj.unwrap_or("");
    if given.contains("<PackageReference") || given.contains("<ProjectReference") {
        return Err("NuGet packages and project references are not supported in Cybeni builds yet. Use only the .NET base library (System.*, Windows Forms, WPF).".to_string());
    }
    let code: String = sources.iter().map(|(_, c)| c.as_str()).collect::<Vec<_>>().join("\n");
    let has_xaml = sources.iter().any(|(p, _)| p.to_ascii_lowercase().ends_with(".xaml"));
    let bool_values = ["true", "false"];

    let winforms = match xml_choice(given, "UseWindowsForms", &bool_values) {
        Some(v) => v == "true",
        None => code.contains("System.Windows.Forms"),
    };
    let wpf = match xml_choice(given, "UseWPF", &bool_values) {
        Some(v) => v == "true",
        None => {
            has_xaml
                || ["System.Windows.Controls", "System.Windows.Application", "System.Windows.Media"]
                    .iter()
                    .any(|ns| code.contains(ns))
        }
    };
    let gui = winforms || wpf;
    let output_type = xml_choice(given, "OutputType", &["Exe", "WinExe"])
        .unwrap_or_else(|| if gui { "WinExe" } else { "Exe" }.to_string());
    let nullable = xml_choice(given, "Nullable", &["enable", "disable", "warnings", "annotations"])
        .unwrap_or_else(|| "enable".to_string());
    let implicit = xml_choice(given, "ImplicitUsings", &["enable", "disable", "true", "false"])
        .unwrap_or_else(|| "disable".to_string());

    let mut lines = vec![
        "<Project Sdk=\"Microsoft.NET.Sdk\">".to_string(),
        "  <PropertyGroup>".to_string(),
        format!("    <OutputType>{output_type}</OutputType>"),
        format!("    <TargetFramework>net{sdk_major}.0{}</TargetFramework>", if gui { "-windows" } else { "" }),
    ];
    if winforms {
        lines.push("    <UseWindowsForms>true</UseWindowsForms>".to_string());
    }
    if wpf {
        lines.push("    <UseWPF>true</UseWPF>".to_string());
    }
    lines.push(format!("    <Nullable>{nullable}</Nullable>"));
    lines.push(format!("    <ImplicitUsings>{implicit}</ImplicitUsings>"));
    if let Some(v) = xml_word(given, "LangVersion") {
        lines.push(format!("    <LangVersion>{v}</LangVersion>"));
    }
    if xml_choice(given, "AllowUnsafeBlocks", &bool_values).as_deref() == Some("true") {
        lines.push("    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>".to_string());
    }
    if let Some(v) = xml_word(given, "RootNamespace") {
        lines.push(format!("    <RootNamespace>{v}</RootNamespace>"));
    }
    lines.push("    <UseSharedCompilation>false</UseSharedCompilation>".to_string());
    lines.push("  </PropertyGroup>".to_string());
    lines.push("</Project>".to_string());
    Ok(lines.join("\n") + "\n")
}

/// A NuGet config with no package sources: restore needs nothing for a project without
/// packages, and must not reach out (or fail on a missing source in the user's own config).
pub const OFFLINE_NUGET_CONFIG: &str = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<configuration>\n  <packageSources><clear /></packageSources>\n  <fallbackPackageFolders><clear /></fallbackPackageFolders>\n</configuration>\n";

/// The files a finished build produced that the program needs to run (.exe, .dll, the .NET
/// runtime and dependency manifests), without debug symbols.
pub fn collect_artifacts(dir: &Path) -> Result<Vec<NativeArtifact>, String> {
    let mut found = Vec::new();
    let mut total = 0u64;
    let entries = fs::read_dir(dir).map_err(|e| format!("Could not read the build output: {e}"))?;
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let lower = name.to_ascii_lowercase();
        let wanted = lower.ends_with(".exe")
            || lower.ends_with(".dll")
            || lower.ends_with(".runtimeconfig.json")
            || lower.ends_with(".deps.json");
        if !wanted {
            continue;
        }
        total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        if total > MAX_ARTIFACT_BYTES {
            return Err(format!(
                "The build output is larger than {} MB, too large to hand back.",
                MAX_ARTIFACT_BYTES / (1024 * 1024)
            ));
        }
        let bytes = fs::read(&path).map_err(|e| format!("Could not read {name}: {e}"))?;
        found.push(NativeArtifact { name, base64: BASE64.encode(&bytes) });
    }
    found.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(found)
}

fn kill_tree(child: &mut std::process::Child) {
    #[cfg(windows)]
    {
        let mut tk = Command::new("taskkill");
        hidden(&mut tk);
        let _ = tk.args(["/T", "/F", "/PID", &child.id().to_string()]).output();
    }
    let _ = child.kill();
}

/// Run a compiler and collect its output, stopping it (and anything it started) at the
/// deadline. Returns the merged stdout and stderr and whether it succeeded.
pub fn run_with_timeout(cmd: &mut Command, limit: Duration) -> Result<(String, bool), String> {
    use std::io::Read;
    use std::process::Stdio;
    hidden(cmd);
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("Failed to start the compiler: {e}"))?;
    let out_pipe = child.stdout.take();
    let err_pipe = child.stderr.take();
    let read_all = |pipe: Option<Box<dyn Read + Send>>| {
        std::thread::spawn(move || {
            let mut buf = Vec::new();
            if let Some(mut p) = pipe {
                let _ = p.read_to_end(&mut buf);
            }
            buf
        })
    };
    let out_t = read_all(out_pipe.map(|p| Box::new(p) as Box<dyn Read + Send>));
    let err_t = read_all(err_pipe.map(|p| Box::new(p) as Box<dyn Read + Send>));
    let deadline = Instant::now() + limit;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                kill_tree(&mut child);
                let _ = child.wait();
                return Err(format!(
                    "The build timed out after {}s and was stopped.",
                    limit.as_secs().max(1)
                ));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(50)),
            Err(e) => return Err(format!("Lost track of the compiler: {e}")),
        }
    };
    let stdout = out_t.join().unwrap_or_default();
    let stderr = err_t.join().unwrap_or_default();
    let merged = format!("{}\n{}", String::from_utf8_lossy(&stdout), String::from_utf8_lossy(&stderr))
        .trim()
        .to_string();
    Ok((merged, status.success()))
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
    fn option_and_response_file_names_are_refused() {
        // g++ and csc read options from `@file`; a leading '-' is an option too.
        assert!(native_safe_path("@opts.cpp").is_err());
        assert!(native_safe_path("src/@opts.cs").is_err());
        assert!(native_safe_path("src/-wrapper.cpp").is_err());
        assert!(native_safe_path("../main.cpp").is_err());
        assert_eq!(native_safe_path("/src/main.cpp").unwrap(), "src/main.cpp");
        assert_eq!(gcc_source_arg("src/main.cpp"), "./src/main.cpp");
    }

    #[test]
    fn msbuild_and_nuget_control_files_are_never_written() {
        for p in [
            "App.csproj", "x.sln", "Directory.Build.props", "sub/directory.build.targets", "build/x.targets",
            "NuGet.Config", "nuget.config", "global.json", "Directory.Packages.props", "opts.rsp", "x.proj",
        ] {
            assert!(is_build_control_file(p), "{p} should be refused");
        }
        for p in ["Program.cs", "src/main.cpp", "assets/icon.png", "MainWindow.xaml", "Strings.resx", "appsettings.json"] {
            assert!(!is_build_control_file(p), "{p} should be allowed");
        }
    }

    #[test]
    fn the_csharp_project_file_is_ours_whatever_the_project_supplies() {
        let hostile = r#"<Project Sdk="Microsoft.NET.Sdk">
  <Import Project="C:\evil.targets" />
  <PropertyGroup><OutputType>WinExe</OutputType><UseWindowsForms>true</UseWindowsForms><Nullable>enable</Nullable><TargetFramework>net6.0;$(Evil)</TargetFramework><AssemblyName>$(Evil)</AssemblyName></PropertyGroup>
  <Target Name="Pwn" BeforeTargets="Build"><Exec Command="calc.exe" /></Target>
  <UsingTask TaskName="X" TaskFactory="RoslynCodeTaskFactory" AssemblyFile="x" />
</Project>"#;
        let src = vec![("Program.cs".to_string(), "class P { static void Main() {} }".to_string())];
        let out = csharp_project_file(Some(hostile), &src, 10).unwrap();
        for bad in ["Import", "Target ", "Exec", "UsingTask", "calc", "Evil", "net6.0"] {
            assert!(!out.contains(bad), "{bad} leaked into the generated project:\n{out}");
        }
        assert!(out.contains("<OutputType>WinExe</OutputType>"), "{out}");
        assert!(out.contains("<UseWindowsForms>true</UseWindowsForms>"), "{out}");
        assert!(out.contains("<Nullable>enable</Nullable>"), "{out}");
        assert!(out.contains("<TargetFramework>net10.0-windows</TargetFramework>"), "{out}");
    }

    #[test]
    fn nuget_packages_are_refused_with_a_clear_reason() {
        let with_pkg = r#"<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="Newtonsoft.Json" Version="13.0.3" /></ItemGroup></Project>"#;
        let err = csharp_project_file(Some(with_pkg), &[], 10).unwrap_err();
        assert!(err.contains("NuGet"), "{err}");
    }

    #[test]
    fn without_a_project_file_the_kind_of_app_comes_from_the_code() {
        let wpf_src = vec![("App.cs".to_string(), "using System.Windows.Controls; class A {}".to_string())];
        let wpf = csharp_project_file(None, &wpf_src, 10).unwrap();
        assert!(wpf.contains("<UseWPF>true</UseWPF>") && wpf.contains("<OutputType>WinExe</OutputType>"), "{wpf}");
        let cli_src = vec![("Program.cs".to_string(), "class P { static void Main() {} }".to_string())];
        let cli = csharp_project_file(None, &cli_src, 8).unwrap();
        assert!(cli.contains("<TargetFramework>net8.0</TargetFramework>") && cli.contains("<OutputType>Exe</OutputType>"), "{cli}");
    }

    #[test]
    fn includes_that_reach_outside_the_project_are_refused() {
        assert!(check_includes("src/main.cpp", "#include <vector>\n#include \"util.h\"\n#embed \"data.bin\"\n").is_ok());
        assert!(check_includes("src/main.cpp", "#include <C:/Users/me/.novaura/authority.key>\n").is_err());
        assert!(check_includes("src/main.cpp", "  #  include \"../../../secret.txt\"\n").is_err());
        assert!(check_includes("src/main.cpp", "#include </etc/passwd>\n").is_err());
        assert!(check_includes("src/main.cpp", "#include_next <\\\\server\\share\\x.h>\n").is_err());
        assert!(check_includes("src/main.cpp", "#embed \"D:\\secrets.bin\"\n").is_err());
    }

    #[test]
    fn control_files_never_reach_the_build_folder_but_the_project_settings_are_kept() {
        let files = vec![
            ("Program.cs".to_string(), "class P { static void Main() {} }".to_string()),
            ("App.csproj".to_string(), "<Project><PropertyGroup><OutputType>WinExe</OutputType></PropertyGroup></Project>".to_string()),
            ("Directory.Build.targets".to_string(), "<Project><Target Name=\"X\"><Exec Command=\"calc\" /></Target></Project>".to_string()),
            ("nuget.config".to_string(), "<configuration />".to_string()),
        ];
        let (sources, csproj) = select_build_files(files).unwrap();
        let names: Vec<&str> = sources.iter().map(|(p, _)| p.as_str()).collect();
        assert_eq!(names, vec!["Program.cs"]);
        assert!(csproj.unwrap().contains("WinExe"));

        let sneaky = vec![("src/@opts.cpp".to_string(), "-wrapper calc".to_string())];
        assert!(select_build_files(sneaky).is_err());
        let peeking = vec![("main.cpp".to_string(), "#include \"../../.ssh/id_ed25519\"\nint main(){}".to_string())];
        assert!(select_build_files(peeking).is_err());
    }

    #[test]
    fn sdk_major_is_read_from_dotnet_version() {
        assert_eq!(parse_sdk_major("10.0.102\r\n"), Some(10));
        assert_eq!(parse_sdk_major("8.0.404"), Some(8));
        assert_eq!(parse_sdk_major("garbage"), None);
    }

    #[test]
    fn build_outputs_are_collected_without_debug_files() {
        let dir = std::env::temp_dir().join(format!("novaura-native-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        for name in ["App.exe", "App.dll", "App.runtimeconfig.json", "App.deps.json", "App.pdb"] {
            fs::write(dir.join(name), b"x").unwrap();
        }
        let mut names: Vec<String> = collect_artifacts(&dir).unwrap().into_iter().map(|a| a.name).collect();
        names.sort();
        assert_eq!(names, vec!["App.deps.json", "App.dll", "App.exe", "App.runtimeconfig.json"]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn a_hung_build_is_stopped_at_the_deadline() {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "ping -n 30 127.0.0.1 >NUL"]);
        let started = std::time::Instant::now();
        let err = run_with_timeout(&mut cmd, std::time::Duration::from_millis(800)).unwrap_err();
        assert!(err.contains("timed out"), "{err}");
        assert!(started.elapsed() < std::time::Duration::from_secs(10));
    }

    #[cfg(windows)]
    #[test]
    fn a_finished_build_returns_its_output() {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "echo hello"]);
        let (output, ok) = run_with_timeout(&mut cmd, std::time::Duration::from_secs(20)).unwrap();
        assert!(ok);
        assert!(output.contains("hello"), "{output}");
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
