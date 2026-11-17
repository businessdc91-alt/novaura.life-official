// nativeReference.js — C++20 and C# (.NET) reference library, language detection,
// deterministic static analysis (balanced delimiters, entry points, local includes),
// and CMake/.csproj/PowerShell standalone build file generation for Cybeni.

const CPP_EXT_RE = /\.(c|cc|cpp|cxx|h|hh|hpp|hxx)$/i;
const CPP_SRC_RE = /\.(c|cc|cpp|cxx)$/i;
const CSHARP_EXT_RE = /\.(cs|csx)$/i;
const DELIM_CHECK_RE = /\.(c|cc|cpp|cxx|h|hh|hpp|hxx|cs)$/i;

const CPP_REQ_RE = /\b(c\+\+|cpp|mingw|gcc|g\+\+|win32|direct2d|d2d1|imgui|raylib|sdl2?|cmake|stl)\b/i;
const CSHARP_REQ_RE = /(?:c#|\bcsharp\b|\.net\b|\bdotnet\b|\bwpf\b|\bwinforms\b|\bmonogame\b|\bcsproj\b)/i;

/**
 * Detect whether a project or request targets native C++ or C#.
 * Returns 'cpp' | 'csharp' | null.
 */
export function detectNativeLanguage(request = '', filePaths = []) {
  const paths = Array.isArray(filePaths) ? filePaths.map(String) : [];
  if (paths.some(p => CSHARP_EXT_RE.test(p) || /\.csproj$/i.test(p))) return 'csharp';
  if (paths.some(p => CPP_SRC_RE.test(p) || /(^|\/)CMakeLists\.txt$/i.test(p))) return 'cpp';
  const req = String(request || '');
  if (CSHARP_REQ_RE.test(req)) return 'csharp';
  if (CPP_REQ_RE.test(req)) return 'cpp';
  return null;
}

const CPP_REFERENCE_GUIDE = [
  '## C++20 Standalone Reference & Build Rules',
  '- Target ISO C++20 (`-std=c++20`) compatible with MinGW-w64 `g++` and MSVC.',
  '- Standard library headers ready everywhere with zero external packages: `<iostream>`, `<vector>`, `<string>`, `<string_view>`, `<filesystem>`, `<thread>`, `<mutex>`, `<condition_variable>`, `<atomic>`, `<chrono>`, `<cmath>`, `<fstream>`, `<sstream>`, `<algorithm>`, `<memory>`, `<array>`, `<unordered_map>`.',
  '- Native Windows Desktop GUI options (built into MinGW Windows SDK — NO external downloads needed):',
  '  - Win32 GUI: define `#define _WIN32_WINNT 0x0A00` before `#include <windows.h>`, and implement `int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int)` (or use `-municode` with `wWinMain`). Link with `-mwindows -lgdi32 -luser32 -ldwmapi`.',
  '  - Hardware-accelerated Win32 + Direct2D: `#include <d2d1.h>`, `<dwrite.h>`, `<dwmapi.h>` (dark title bar via `DwmSetWindowAttribute(hwnd, 20, &dark, sizeof(dark))`).',
  '  - Console/CLI & Audio WAV synthesis: pure standard C++20 (`int main(int argc, char** argv)`) compiles cleanly with `-static -static-libgcc -static-libstdc++`.',
  '- Code hygiene rules verified statically and by `g++`:',
  '  - Include every header you use; add `#pragma once` to every `.hpp`/`.h` header.',
  '  - Keep all `{ }`, `( )`, `[ ]` balanced; define exactly one entry point (`main` or `WinMain` or `wWinMain`).',
  '  - Also keep `CMakeLists.txt` (or `build.ps1`) valid and matching actual `.cpp` paths in the project.',
  '  - **Visual Twin rule**: Keep `index.html` + `src/App.jsx` (the React/Tailwind web UI) synchronized as an interactive live Visual Twin simulating the native C++ app\'s screens, controls, calculations, and outputs so the browser preview and acceptance tests verify every feature.',
].join('\n');

const CSHARP_REFERENCE_GUIDE = [
  '## C# (.NET / WinForms / Console) Standalone Reference & Build Rules',
  '- Write clean, self-contained C# compatible with both `.NET 8+ SDK` (`dotnet publish -p:PublishSingleFile=true`) and Windows built-in `csc.exe` (.NET Framework 4.x) unless ASP.NET Core or WPF is specifically requested:',
  '  - Prefer explicit `using System;`, explicit namespace/class structure with `[STAThread] public static void Main(string[] args)` so both `csc.exe` and `dotnet build` compile cleanly with zero ambiguity.',
  '  - Use standard block method bodies (`{ return ...; }`), explicit `new List<T>()`, and classic `delegate { ... }` / `{ ... }` syntax (avoid C# 6+ `=>` members or C# 12 `[1, 2]` collection expressions unless targeting `.NET 8+` explicitly) so even built-in Windows `csc.exe` compiles cleanly with zero SDK install.',
  '- Built-in Windows WinForms GUI (compiles with `csc.exe /target:winexe /r:System.Windows.Forms.dll /r:System.Drawing.dll` OR `<UseWindowsForms>true</UseWindowsForms>` in `.csproj`):',
  '  - `System.Windows.Forms` (`Form`, `Panel`, `Label`, `Button`, `TextBox`, `ListBox`, `Timer`, `NotifyIcon`, `MenuStrip`), `System.Drawing` (`Color.FromArgb`, `Font`).',
  '- Systems / CLI / Storage APIs: `System.IO`, `System.Collections.Generic`, `System.Linq`, `System.Threading.Tasks`, `System.Security.Cryptography`.',
  '- Keep a clean `<AppName>.csproj` (`<OutputType>Exe</OutputType>` or `WinExe`, `<PublishSingleFile>true</PublishSingleFile>`) and `build.ps1`.',
  '- **Visual Twin rule**: Keep `index.html` + `src/App.jsx` synchronized as an interactive Visual Twin simulating the C# app\'s UI/workflows so the browser preview & acceptance tests verify all features live.',
].join('\n');

export function nativeReferenceNotes(lang) {
  if (lang === 'cpp') return CPP_REFERENCE_GUIDE;
  if (lang === 'csharp') return CSHARP_REFERENCE_GUIDE;
  return '';
}

/**
 * Check balanced {}, (), [] while ignoring string literals, char literals, and // or /* *\/ comments.
 * Returns { ok: boolean, error?: string, line?: number }.
 */
export function checkBalancedDelimiters(code) {
  const src = String(code || '');
  const stack = [];
  const matchOpen = { ')': '(', ']': '[', '}': '{' };
  let line = 1;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === '\n') { line++; i++; continue; }
    // Line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    // C++ raw string literal R"delim(...)delim"
    if (ch === 'R' && next === '"') {
      const openParen = src.indexOf('(', i + 2);
      if (openParen > i + 1 && openParen - (i + 2) <= 16) {
        const delim = src.slice(i + 2, openParen);
        const endMarker = `)${delim}"`;
        const closePos = src.indexOf(endMarker, openParen + 1);
        if (closePos !== -1) {
          for (let k = i; k < closePos + endMarker.length; k++) {
            if (src[k] === '\n') line++;
          }
          i = closePos + endMarker.length;
          continue;
        }
      }
    }
    // Standard string or char literal (ignoring C++14+ numeric digit separators like 1'000'000)
    if (ch === "'" && i > 0 && /[0-9a-fA-F]/.test(src[i - 1]) && next && /[0-9a-fA-F]/.test(next)) {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      // C# verbatim strings @"..." skip escape sequences inside quotes
      const verbatim = ch === '"' && i > 0 && src[i - 1] === '@' && (i < 2 || src[i - 2] !== '\\');
      const quote = ch;
      const startLine = line;
      i++;
      while (i < src.length) {
        const c = src[i];
        if (c === '\n') line++;
        if (verbatim) {
          if (c === '"' && src[i + 1] === '"') { i += 2; continue; }
          if (c === '"') { i++; break; }
        } else {
          if (c === '\\') { i += 2; continue; }
          if (c === quote) { i++; break; }
        }
        i++;
      }
      if (i > src.length) return { ok: false, line: startLine, error: `Unclosed ${quote} literal starting on line ${startLine}.` };
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push({ ch, line });
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const top = stack.pop();
      if (!top || top.ch !== matchOpen[ch]) {
        return {
          ok: false,
          line,
          error: `Unexpected '${ch}' on line ${line}${top ? ` (opened '${top.ch}' on line ${top.line})` : ''}.`,
        };
      }
    }
    i++;
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return { ok: false, line: unclosed.line, error: `Unclosed '${unclosed.ch}' opened on line ${unclosed.line}.` };
  }
  return { ok: true };
}

function stripCommentsAndStringsForScan(code) {
  return String(code || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * Fast, deterministic static checks for C++ and C# project files.
 * Returns [{ type, path, message }] compatible with previewBuilder.staticCheck().
 */
export function nativeStaticCheck(rawFiles) {
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  const issues = [];
  const fileSet = new Set(files.map(f => String(f?.path || '').replace(/^\/+/, '').replace(/\\/g, '/')));

  const cppSources = files.filter(f => CPP_SRC_RE.test(String(f?.path || '')));
  const csharpSources = files.filter(f => CSHARP_EXT_RE.test(String(f?.path || '')));

  for (const f of files) {
    const path = String(f?.path || '');
    const content = String(f?.content ?? '');
    if (!DELIM_CHECK_RE.test(path)) continue;

    const bal = checkBalancedDelimiters(content);
    if (!bal.ok) {
      issues.push({ type: 'native-syntax', path, message: `${path}: ${bal.error}` });
    }

    if (CPP_EXT_RE.test(path)) {
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const incRe = /^\s*#\s*include\s*"([^"]+)"/gm;
      let m;
      while ((m = incRe.exec(content)) !== null) {
        const header = m[1].replace(/^\.\//, '');
        const relCandidate = dir ? `${dir}/${header}` : header;
        if (!fileSet.has(header) && !fileSet.has(relCandidate) && !fileSet.has(`include/${header}`) && !fileSet.has(`src/${header}`)) {
          issues.push({
            type: 'native-missing-include',
            path,
            message: `${path} includes "${m[1]}", which does not exist in the project.`,
          });
        }
      }
    }
  }

  if (cppSources.length > 0) {
    const hasEntry = cppSources.some(f => {
      const stripped = stripCommentsAndStringsForScan(f.content);
      return /\b(main|wmain|WinMain|wWinMain)\s*\(/.test(stripped);
    });
    if (!hasEntry) {
      issues.push({
        type: 'native-no-entry',
        path: cppSources[0].path,
        message: 'C++ project has .cpp/.c source files but none defines main(), WinMain(), or wWinMain().',
      });
    }
  }

  if (csharpSources.length > 0) {
    const hasCsproj = files.some(f => /\.csproj$/i.test(String(f?.path || '')));
    const hasMain = csharpSources.some(f => {
      const stripped = stripCommentsAndStringsForScan(f.content);
      return /\bMain\s*\(/.test(stripped);
    });
    if (!hasMain && !hasCsproj) {
      issues.push({
        type: 'native-no-entry',
        path: csharpSources[0].path,
        message: 'C# project has .cs files without a static Main() method or .csproj file.',
      });
    }
  }

  return issues;
}

/**
 * Generate turnkey build files (CMakeLists.txt + build.ps1 or .csproj + build.ps1)
 * for standalone C++ or C# zip exports when omitted.
 */
export function generateNativeBuildFiles(lang, projectName, files = []) {
  const list = Array.isArray(files) ? files : [];
  const cleanName = String(projectName || 'CybeniApp').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'CybeniApp';
  const generated = [];

  if (lang === 'cpp') {
    const cppFiles = list.filter(f => /\.(cpp|cc|cxx|c)$/i.test(f.path)).map(f => f.path);
    const hasCmake = list.some(f => f.path.toLowerCase() === 'cmakelists.txt');
    const usesWinGui = list.some(f => /WinMain|wWinMain|<windows\.h>/i.test(String(f.content || '')));
    const usesWMain = list.some(f => /wWinMain|wmain\s*\(/i.test(String(f.content || '')));
    const usesD2d = list.some(f => /<d2d1\.h>|<dwrite\.h>/i.test(String(f.content || '')));
    const libs = [];
    if (usesWinGui) libs.push('user32', 'gdi32', 'dwmapi');
    if (usesD2d) libs.push('d2d1', 'dwrite');

    if (!hasCmake && cppFiles.length > 0) {
      const sourcesLine = cppFiles.join(' ');
      const cmake = [
        'cmake_minimum_required(VERSION 3.20)',
        `project(${cleanName} LANGUAGES CXX)`,
        'set(CMAKE_CXX_STANDARD 20)',
        'set(CMAKE_CXX_STANDARD_REQUIRED ON)',
        `add_executable(${cleanName}${usesWinGui ? ' WIN32' : ''} ${sourcesLine})`,
        libs.length ? `target_link_libraries(${cleanName} PRIVATE ${libs.join(' ')})` : '',
        'if(MINGW)',
        `  target_link_options(${cleanName} PRIVATE -static-libgcc -static-libstdc++${usesWinGui ? ' -mwindows' : ''})`,
        'endif()',
        '',
      ].filter(Boolean).join('\n');
      generated.push({ path: 'CMakeLists.txt', content: cmake });
    }

    if (!list.some(f => f.path.toLowerCase() === 'build.ps1') && cppFiles.length > 0) {
      const linkFlags = [
        '-std=c++20',
        '-O2',
        '-static-libgcc',
        '-static-libstdc++',
        ...(usesWinGui ? ['-D_WIN32_WINNT=0x0A00', '-DWINVER=0x0A00', '-mwindows'] : []),
        ...(usesWMain ? ['-municode'] : []),
        ...libs.map(l => `-l${l}`),
      ].join(' ');
      generated.push({
        path: 'build.ps1',
        content: [
          `$ErrorActionPreference = 'Stop'`,
          `$sources = @(${cppFiles.map(p => `'${p}'`).join(', ')})`,
          `Write-Host "Building ${cleanName}.exe with g++..."`,
          `& g++ @sources -I. -o "${cleanName}.exe" ${linkFlags}`,
          `if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`,
          `Write-Host "Built ${cleanName}.exe successfully."`,
          '',
        ].join('\n'),
      });
    }
  } else if (lang === 'csharp') {
    const csFiles = list.filter(f => CSHARP_EXT_RE.test(f.path)).map(f => f.path);
    const hasCsproj = list.some(f => /\.csproj$/i.test(f.path));
    const usesWinForms = list.some(f => /System\.Windows\.Forms/i.test(String(f.content || '')));
    const usesWpf = list.some(f => /System\.Windows\.(Controls|Application|Media)/i.test(String(f.content || '')));

    if (!hasCsproj && csFiles.length > 0) {
      const sdk = (usesWinForms || usesWpf) ? 'Microsoft.NET.Sdk' : 'Microsoft.NET.Sdk';
      const outputType = (usesWinForms || usesWpf) ? 'WinExe' : 'Exe';
      const csproj = [
        `<Project Sdk="${sdk}">`,
        '  <PropertyGroup>',
        `    <OutputType>${outputType}</OutputType>`,
        usesWinForms || usesWpf ? '    <TargetFramework>net8.0-windows</TargetFramework>' : '    <TargetFramework>net8.0</TargetFramework>',
        usesWinForms ? '    <UseWindowsForms>true</UseWindowsForms>' : '',
        usesWpf ? '    <UseWPF>true</UseWPF>' : '',
        '    <ImplicitUsings>disable</ImplicitUsings>',
        '    <Nullable>enable</Nullable>',
        '    <PublishSingleFile>true</PublishSingleFile>',
        '    <SelfContained>true</SelfContained>',
        '  </PropertyGroup>',
        '</Project>',
        '',
      ].filter(Boolean).join('\n');
      generated.push({ path: `${cleanName}.csproj`, content: csproj });
    }

    if (!list.some(f => f.path.toLowerCase() === 'build.ps1') && csFiles.length > 0) {
      generated.push({
        path: 'build.ps1',
        content: [
          `$ErrorActionPreference = 'Stop'`,
          `if (Get-Command dotnet -ErrorAction SilentlyContinue) {`,
          `  dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ./dist`,
          `} else {`,
          `  $csc = "$env:WINDIR\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"`,
          `  if (-not (Test-Path $csc)) { throw "Install .NET 8 SDK or Windows .NET Framework to compile." }`,
          `  $target = ${usesWinForms ? `'winexe'` : `'exe'`}`,
          `  & $csc /nologo /target:$target /out:"${cleanName}.exe" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Net.Http.dll ${csFiles.map(p => `"${p}"`).join(' ')}`,
          `}`,
          '',
        ].join('\n'),
      });
    }
  }

  return generated;
}
