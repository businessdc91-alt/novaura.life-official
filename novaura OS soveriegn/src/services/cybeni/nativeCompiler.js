// nativeCompiler.js — Client bridge for C++20 / C# native compiler detection,
// verification inside Sovereign OS Desktop (Tauri), and browser-safe source bundle fallback.

import { detectNativeLanguage, generateNativeBuildFiles, nativeStaticCheck } from './nativeReference.js';

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

export async function probeNativeToolchains() {
  if (!isTauri()) {
    return {
      cpp: { available: false, compiler: 'browser-only', path: '' },
      csharp: { available: false, compiler: 'browser-only', path: '' },
      tauri: false,
    };
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke('cybeni_native_toolchains');
    return { ...res, tauri: true };
  } catch {
    return {
      cpp: { available: false, compiler: 'unavailable', path: '' },
      csharp: { available: false, compiler: 'unavailable', path: '' },
      tauri: false,
    };
  }
}

/**
 * Compile (or syntax/type check) C++20 / C# sources via Tauri native bridge.
 * In browser-only dev mode, runs deterministic static analysis and returns a clear capability notice.
 */
export async function compileNativeProject(slug, rawFiles, { checkOnly = false } = {}) {
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  const lang = detectNativeLanguage('', files.map(f => f.path));
  if (!lang) {
    return { ok: true, skipped: true, lang: null, errors: [], diagnostics: [] };
  }

  const staticIssues = nativeStaticCheck(files);
  if (staticIssues.length) {
    return {
      ok: false,
      lang,
      compiler: 'static-check',
      errors: staticIssues.map(i => i.message),
      diagnostics: staticIssues.map(i => ({ file: i.path, line: 1, column: 1, severity: 'error', message: i.message })),
      output: staticIssues.map(i => i.message).join('\n'),
    };
  }

  if (!isTauri()) {
    return {
      ok: true,
      lang,
      browserOnly: true,
      compiler: 'static-only',
      errors: [],
      diagnostics: [],
      output: 'Static C++/C# verification passed. Download the native source zip or open in Sovereign Desktop app to compile .exe.',
    };
  }

  const normalized = files.map(f => ({ path: f.path, content: String(f.content ?? '') }));
  // Ensure missing build files (.csproj / CMakeLists.txt) exist for dotnet/cmake if needed.
  const extras = generateNativeBuildFiles(lang, slug, normalized);
  const fullSet = [...normalized, ...extras];

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('cybeni_native_compile', {
    slug,
    lang,
    files: fullSet,
    checkOnly,
  });
}

/**
 * Assemble complete native project bundle (project files + CMakeLists.txt / .csproj + build.ps1).
 */
export function buildNativeSourceBundleFiles(projectName, rawFiles) {
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  const lang = detectNativeLanguage('', files.map(f => f.path)) || 'cpp';
  const extras = generateNativeBuildFiles(lang, projectName, files);
  const byPath = new Map(files.map(f => [f.path, f.content]));
  for (const e of extras) {
    if (!byPath.has(e.path)) byPath.set(e.path, e.content);
  }
  return { lang, files: [...byPath.entries()].map(([path, content]) => ({ path, content })) };
}

export function base64ToUint8Array(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

