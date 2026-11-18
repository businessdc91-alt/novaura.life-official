// previewBuilder.js — Turns a Cybeni project (plain text files) into something a
// browser can run, with no build server:
//   - JSX / TypeScript are transpiled with Sucrase.
//   - Imports between project files are rewritten to "@cy/<path>" and resolved
//     through an import map; npm packages resolve to esm.sh.
//   - CSS and JSON imports become small JS modules.
//   - An error reporter is injected first, so runtime errors, failed imports
//     and blank renders are posted back to Cybeni for self-repair.
//
// Two outputs:
//   server mode -> files for the isolated preview origin (cyprev protocol)
//   inline mode -> one self-contained HTML document (export / mesh publish)
//
// Pure functions: no DOM or database access, so it can be tested in Node.

import { transform } from 'sucrase';
import { TEST_AGENT_SOURCE, STORAGE_ISOLATION_SOURCE } from './testAgent.js';
import { NOVAURA_V1_SOURCE } from '../additions/bridgeSource.js';
import { pinnedSpecifier } from './libraryNotes.js';
import { CYBENI_BACKEND_MODULE_SOURCE } from './fullStackRuntime.js';
import { OFFLINE_TAILWIND_FALLBACK_SCRIPT } from './offlineShims.js';
import { nativeStaticCheck } from './nativeReference.js';

export const REACT_VERSION = '18.3.1';
const ESM_CDN = 'https://esm.sh';

const SCRIPT_EXT = /\.(m?jsx?|tsx?)$/i;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|ico|mp3|wav|ogg|mp4|webm|woff2?)$/i;
const VIRTUAL_BACKEND_PATH = '_cybeni_internal/backend.js';
const VIRTUAL_PACKAGES = new Set(['@cybeni/backend', '@novaura/sdk']);
const ENTRY_CANDIDATES = [
  'src/main.jsx', 'src/main.tsx', 'src/main.js', 'src/main.ts',
  'src/index.jsx', 'src/index.tsx', 'src/index.js', 'src/index.ts',
  'main.jsx', 'main.tsx', 'main.js', 'index.jsx', 'index.tsx', 'index.js', 'app.js', 'script.js',
];
const APP_CANDIDATES = ['src/App.jsx', 'src/App.tsx', 'src/App.js', 'App.jsx', 'App.tsx', 'App.js'];

export function normalizePath(p) {
  const parts = [];
  for (const seg of String(p || '').replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function dirname(p) {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

export function mimeFor(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return {
    html: 'text/html', htm: 'text/html', css: 'text/css', json: 'application/json',
    js: 'text/javascript', mjs: 'text/javascript', jsx: 'text/javascript', ts: 'text/javascript', tsx: 'text/javascript',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', ico: 'image/x-icon', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    mp4: 'video/mp4', webm: 'video/webm', woff: 'font/woff', woff2: 'font/woff2',
    cpp: 'text/x-c++src', cc: 'text/x-c++src', cxx: 'text/x-c++src', h: 'text/x-chdr', hpp: 'text/x-c++hdr', c: 'text/x-csrc',
    cs: 'text/x-csharp', csproj: 'application/xml', sln: 'text/plain', xaml: 'application/xml',
    cmake: 'text/plain', ps1: 'text/plain',
    txt: 'text/plain', md: 'text/markdown', xml: 'application/xml',
  }[ext] || 'text/plain';
}

/** Resolve a relative/absolute import from `fromPath` to a project file, trying common extensions. */
export function resolveImport(fromPath, spec, fileSet) {
  const base = spec.startsWith('/') ? spec.slice(1) : normalizePath(`${dirname(fromPath)}/${spec}`);
  const tries = [base, `${base}.jsx`, `${base}.tsx`, `${base}.js`, `${base}.ts`, `${base}.mjs`, `${base}.json`,
    `${base}/index.jsx`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.ts`];
  return tries.find(t => fileSet.has(t)) || null;
}

const isRelative = (spec) => spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
const isUrl = (spec) => /^(https?:|data:|blob:)/.test(spec);

// Static `import ... from 'x'`, `import 'x'`, `export ... from 'x'`, and dynamic `import('x')`.
const STATIC_IMPORT_RE = /\b(import|export)(\s*(?:[^'";()]*?\sfrom\s*)?)(['"])([^'"\n]+)\3/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;

function moduleSpecifierFor(target) {
  if (/\.css$/i.test(target)) return `@cy/${target}.cssmod.js`;
  if (/\.json$/i.test(target)) return `@cy/${target}.jsonmod.js`;
  if (ASSET_EXT.test(target)) return `@cy/${target}.assetmod.js`;
  return `@cy/${target}`;
}

function rewriteImports(path, code, fileSet, issues, bare) {
  const fix = (spec) => {
    if (isUrl(spec)) return spec;
    if (isRelative(spec)) {
      const target = resolveImport(path, spec, fileSet);
      if (!target) {
        issues.push({ type: 'missing-import', path, message: `${path} imports "${spec}", but no such file exists in the project.` });
        return spec;
      }
      return moduleSpecifierFor(target);
    }
    if (spec.startsWith('@cy/') || VIRTUAL_PACKAGES.has(spec)) return spec;
    bare.add(spec);
    return spec;
  };
  return code
    .replace(STATIC_IMPORT_RE, (m, kw, mid, q, spec) => `${kw}${mid}${q}${fix(spec)}${q}`)
    .replace(DYNAMIC_IMPORT_RE, (m, q, spec) => `import(${q}${fix(spec)}${q})`);
}

function transpile(path, code, issues, { jsxRuntime = 'automatic' } = {}) {
  const isTs = /\.tsx?$/i.test(path);
  const transforms = isTs ? (/\.tsx$/i.test(path) ? ['typescript', 'jsx'] : ['typescript']) : ['jsx'];
  try {
    return transform(code, { transforms, jsxRuntime, production: true, filePath: path }).code;
  } catch (err) {
    const loc = err.loc ? ` (line ${err.loc.line}, column ${err.loc.column + 1})` : '';
    issues.push({ type: 'syntax', path, message: `Syntax error in ${path}${loc}: ${String(err.message).split('\n')[0]}` });
    return null;
  }
}

/** Map every bare npm specifier the project uses to esm.sh, keeping a single React. */
export function npmImportMap(bareSpecifiers) {
  const map = {
    react: `${ESM_CDN}/react@${REACT_VERSION}`,
    'react/jsx-runtime': `${ESM_CDN}/react@${REACT_VERSION}/jsx-runtime`,
    'react-dom': `${ESM_CDN}/react-dom@${REACT_VERSION}?external=react`,
    'react-dom/client': `${ESM_CDN}/react-dom@${REACT_VERSION}/client?external=react,react-dom`,
  };
  // Common packages are pinned to the major version Cybeni's library notes describe.
  for (const spec of bareSpecifiers) {
    if (VIRTUAL_PACKAGES.has(spec)) continue;
    if (!map[spec]) map[spec] = `${ESM_CDN}/${pinnedSpecifier(spec)}?external=react,react-dom`;
  }
  return map;
}

// Runs before anything else in the preview and reports back to Cybeni.
export const ERROR_REPORTER = `(function(){
  var send=function(type,data){try{parent.postMessage(Object.assign({__cybeni:true,type:type},data),'*');}catch(e){}};
  var text=function(v){try{return typeof v==='string'?v:(v&&v.stack)?String(v.stack):JSON.stringify(v);}catch(e){return String(v);}};
  window.addEventListener('error',function(e){
    var t=e.target;
    if(t&&t!==window&&t.tagName){send('error',{message:'Failed to load '+t.tagName.toLowerCase()+' '+(t.src||t.href||'')});return;}
    send('error',{message:String(e.message||e.error),source:e.filename||'',line:e.lineno||0,column:e.colno||0,stack:e.error&&e.error.stack?String(e.error.stack):''});
  },true);
  window.addEventListener('unhandledrejection',function(e){send('error',{message:'Unhandled promise rejection: '+text(e.reason)});});
  ['log','info','warn','error'].forEach(function(level){
    var orig=console[level];
    console[level]=function(){var args=[].slice.call(arguments);send('console',{level:level,text:args.map(text).join(' ').slice(0,2000)});try{orig.apply(console,args);}catch(e){}};
  });
  window.addEventListener('load',function(){setTimeout(function(){
    var root=document.getElementById('root')||document.getElementById('app');
    var visible=(document.body&&document.body.innerText||'').trim();
    var empty=root?root.childElementCount===0:(!document.body||(document.body.childElementCount<=1&&!visible));
    var visualIssues=typeof window.__cybeniVisualAudit==='function'?window.__cybeniVisualAudit():[];
    send('ready',{empty:empty,textSample:visible.slice(0,200),visualIssues:visualIssues});
  },1200);});
})();`;

function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const escapeScript = (code) => code.replace(/<\/script/gi, '<\\/script');

function pickEntryHtml(files) {
  return files.find(f => f.path === 'index.html') || files.find(f => /^[^/]+\.html?$/i.test(f.path)) || null;
}

/**
 * Build a runnable preview of a project.
 * files: [{ path, content }] with project-relative paths.
 * options.mode: 'server' (needs options.baseUrl, e.g. http://cyprev.localhost/<session>/), 'inline',
 * or 'addition': like 'server', but the page first loads the launch's boot data and the
 * novaura v1 bridge (src/services/additions), with no test agent, storage isolation or
 * app name. options.inlineScripts ({ boot, bridge }) builds an addition as one inline
 * document instead (a plain browser in development).
 */
/** Put `head` first inside the page's <head> (making one if needed). */
function withHead(html, head) {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => `${m}\n${head}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => `${m}\n<head>${head}</head>`);
  return `${head}\n${html}`;
}

export function buildPreview(rawFiles, { mode = 'inline', baseUrl = '', appId = '', inlineScripts = null } = {}) {
  const addition = mode === 'addition';
  const served = mode === 'server' || (addition && !inlineScripts);
  const files = rawFiles
    .map(f => ({ path: normalizePath(f.path), content: typeof f.content === 'string' ? f.content : '' }))
    .filter(f => f.path);
  const fileSet = new Set(files.map(f => f.path));
  const byPath = new Map(files.map(f => [f.path, f.content]));
  const issues = [];
  const bare = new Set();
  const modules = new Map(); // "@cy/<path>" target path -> compiled JS
  const assetMap = {}; // project asset path -> resolved URL / data URL

  // Always register the built-in zero-config full-stack runtime module.
  modules.set(VIRTUAL_BACKEND_PATH, CYBENI_BACKEND_MODULE_SOURCE);

  // 1. Compile every script module, plus CSS/JSON/binary asset wrappers.
  for (const f of files) {
    if (SCRIPT_EXT.test(f.path)) {
      const js = transpile(f.path, f.content, issues);
      if (js !== null) modules.set(f.path, rewriteImports(f.path, js, fileSet, issues, bare));
    } else if (/\.css$/i.test(f.path)) {
      modules.set(`${f.path}.cssmod.js`,
        `const css = ${JSON.stringify(f.content)};\nconst el = document.createElement('style');\nel.setAttribute('data-file', ${JSON.stringify(f.path)});\nel.textContent = css;\ndocument.head.appendChild(el);\nexport default css;\n`);
    } else if (/\.json$/i.test(f.path)) {
      try {
        JSON.parse(f.content);
        modules.set(`${f.path}.jsonmod.js`, `export default ${f.content};\n`);
      } catch (err) {
        issues.push({ type: 'syntax', path: f.path, message: `Invalid JSON in ${f.path}: ${err.message}` });
      }
    } else if (ASSET_EXT.test(f.path) || /^\s*data:/i.test(f.content)) {
      const trimmed = f.content.trim();
      let assetUrl;
      if (/^data:/i.test(trimmed)) assetUrl = trimmed;
      else if (/\.svg$/i.test(f.path)) assetUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(f.content)}`;
      else assetUrl = served ? `${baseUrl}${f.path}` : trimmed;
      assetMap[f.path] = assetUrl;
      modules.set(`${f.path}.assetmod.js`, `export default ${JSON.stringify(assetUrl)};\n`);
    }
  }

  // 2. Find or generate the HTML entry.
  let html;
  let entryNote = null;
  const entryHtml = pickEntryHtml(files);
  if (entryHtml) {
    html = entryHtml.content;
  } else {
    const entry = ENTRY_CANDIDATES.find(p => fileSet.has(p));
    const app = APP_CANDIDATES.find(p => fileSet.has(p));
    let boot = '';
    if (entry) {
      boot = `import '@cy/${entry}';`;
    } else if (app) {
      boot = `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from '@cy/${app}';\ncreateRoot(document.getElementById('root')).render(React.createElement(App));`;
      bare.add('react').add('react-dom/client');
      entryNote = `No entry file found, so ${app} is mounted automatically.`;
    } else if (files.some(f => /\.(c|cc|cpp|cxx|cs)$/i.test(f.path))) {
      entryNote = 'Native C++/C# source project without an HTML Visual Twin; compile via Ship -> Compile Standalone .exe.';
    } else {
      issues.push({ type: 'no-entry', path: '', message: 'The project has no index.html and no entry module (such as src/main.jsx), so there is nothing to run.' });
    }
    html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body>\n<div id="root">${entryNote && !app ? '<div style="font-family:system-ui;padding:24px;color:#94a3b8;background:#020617;min-height:100vh">Native C++ / C# project — inspect code or compile standalone executable via Ship.</div>' : ''}</div>\n${boot ? `<script type="module">${boot}</script>` : ''}\n</body>\n</html>`;
  }
  const htmlPath = entryHtml?.path || 'index.html';

  // 3. Rewrite local <script> and <link rel="stylesheet"> references.
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*(['"])([^'"]+)\2([^>]*)>\s*<\/script>/gi, (match, pre, q, src, post) => {
    if (isUrl(src) || src.startsWith('//')) return match;
    const target = resolveImport(htmlPath, src.startsWith('/') ? src : `./${src.replace(/^\.\//, '')}`, fileSet);
    if (!target) {
      issues.push({ type: 'missing-import', path: htmlPath, message: `${htmlPath} loads "${src}", but no such file exists in the project.` });
      return match;
    }
    const attrs = `${pre} ${post}`;
    if (/type\s*=\s*['"]module['"]/i.test(attrs)) {
      return `<script type="module">import '@cy/${target}';</script>`;
    }
    // Classic script: inline it (JSX in text/babel scripts is compiled here).
    const babel = /type\s*=\s*['"]text\/(babel|jsx)['"]/i.test(attrs);
    const code = babel ? transpile(target, byPath.get(target) || '', issues, { jsxRuntime: 'classic' }) : byPath.get(target);
    return `<script>${escapeScript(code || '')}</script>`;
  });
  html = html.replace(/<script\b([^>]*)type\s*=\s*(['"])text\/(?:babel|jsx)\2([^>]*)>([\s\S]*?)<\/script>/gi, (match, pre, q, post, body) => {
    const code = transpile(htmlPath, body, issues, { jsxRuntime: 'classic' });
    return `<script>${escapeScript(code || '')}</script>`;
  });
  // Inline module scripts may import project files too.
  html = html.replace(/<script\b([^>]*type\s*=\s*['"]module['"][^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) return match;
    return `<script type="module">${escapeScript(rewriteImports(htmlPath, body, fileSet, issues, bare))}</script>`;
  });
  html = html.replace(/<link\b([^>]*)>/gi, (match, attrs) => {
    if (!/rel\s*=\s*['"]stylesheet['"]/i.test(attrs)) return match;
    const href = /href\s*=\s*(['"])([^'"]+)\1/i.exec(attrs)?.[2];
    if (!href || isUrl(href) || href.startsWith('//')) return match;
    const target = resolveImport(htmlPath, href.startsWith('/') ? href : `./${href.replace(/^\.\//, '')}`, fileSet);
    if (!target) {
      issues.push({ type: 'missing-import', path: htmlPath, message: `${htmlPath} links "${href}", but no such file exists in the project.` });
      return match;
    }
    return `<style data-file="${target}">${byPath.get(target)}</style>`;
  });
  // Rewrite relative <img src="..."> / <audio src="..."> / <source src="..."> to resolved asset URLs.
  if (Object.keys(assetMap).length > 0) {
    html = html.replace(/(<(?:img|audio|video|source)\b[^>]*?\bsrc\s*=\s*)(['"])([^'"]+)\2/gi, (match, prefix, q, src) => {
      if (isUrl(src) || src.startsWith('//')) return match;
      const target = resolveImport(htmlPath, src.startsWith('/') ? src : `./${src.replace(/^\.\//, '')}`, fileSet);
      if (target && assetMap[target]) return `${prefix}${q}${assetMap[target]}${q}`;
      return match;
    });
  }

  // 4. Import map and error reporter go first in <head>.
  // A project's own import map (models often write one, sometimes broken, e.g.
  // closed with </importmap>) is lifted out and merged, so there is only one map.
  const ownImports = {};
  html = html.replace(/<script\b[^>]*type\s*=\s*['"]importmap['"][^>]*>([\s\S]*?)<\/(?:script|importmap)\s*>/gi, (match, body) => {
    try {
      Object.assign(ownImports, JSON.parse(body).imports || {});
    } catch {
      issues.push({ type: 'import-map', path: htmlPath, message: `${htmlPath} contains an invalid import map, so it was ignored. Cybeni resolves bare imports automatically; the import map can be removed.` });
    }
    return '';
  });
  // Cybeni keeps control of React (one shared copy) and of project files + virtual @cybeni/backend runtime.
  const imports = { ...ownImports, ...npmImportMap(bare) };
  for (const [spec, target] of Object.entries(ownImports)) {
    if (!/^react(-dom)?(\/|$)/.test(spec) && !spec.startsWith('@cy/') && !VIRTUAL_PACKAGES.has(spec)) imports[spec] = target;
  }
  const backendUrl = served
    ? `${baseUrl}${VIRTUAL_BACKEND_PATH}`
    : `data:text/javascript;base64,${toBase64Utf8(CYBENI_BACKEND_MODULE_SOURCE)}`;
  imports['@cybeni/backend'] = backendUrl;
  imports['@novaura/sdk'] = backendUrl;
  if (served) {
    imports['@cy/'] = baseUrl;
  } else {
    for (const [path, code] of modules) imports[`@cy/${path}`] = `data:text/javascript;base64,${toBase64Utf8(code)}`;
  }
  const safeAssetJson = JSON.stringify(assetMap).replace(/</g, '\\u003c');
  const assetBootstrap = Object.keys(assetMap).length > 0
    ? `\n<script>(function(){var m=${safeAssetJson};window.__cybeniAssets=m;function fix(){document.querySelectorAll('img[src],audio[src],video[src],source[src]').forEach(function(el){var s=el.getAttribute('src')||'';if(/^https?:|^data:|^blob:|^\\/\\//.test(s))return;var k=s.replace(/^\\.\\//,'').replace(/^\\//,'');if(m[k])el.setAttribute('src',m[k]);});}if(typeof MutationObserver==='function'){new MutationObserver(fix).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});}window.addEventListener('DOMContentLoaded',fix);})();</script>`
    : '';
  // The app's name comes first: @cybeni/backend keeps each app's data apart on the shared origin.
  // Storage isolation must run before the app reads storage; the test agent waits for instructions.
  const appIdScript = appId
    ? `<script>window.__cybeniAppId=${JSON.stringify(String(appId).slice(0, 80)).replace(/</g, '\\u003c')};</script>\n`
    : '';
  // An addition starts with its boot data and the novaura bridge, before anything of its own.
  const additionHead = !addition ? ''
    : inlineScripts
      ? `${inlineScripts.csp ? `<meta http-equiv="Content-Security-Policy" content="${String(inlineScripts.csp).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">\n` : ''}<script>${escapeScript(inlineScripts.boot)}</script>\n<script>${escapeScript(inlineScripts.bridge)}</script>\n`
      : `<script src="${baseUrl}__novaura/boot.js"></script>\n<script src="${baseUrl}__novaura/v1.js"></script>\n`;
  const previewOnly = addition ? '' : `${appIdScript}<script>${STORAGE_ISOLATION_SOURCE}</script>\n`;
  const testAgent = addition ? '' : `\n<script>${escapeScript(TEST_AGENT_SOURCE)}</script>`;
  const head = `${additionHead}${previewOnly}<script>${ERROR_REPORTER}</script>${testAgent}\n<script>${escapeScript(OFFLINE_TAILWIND_FALLBACK_SCRIPT)}</script>${assetBootstrap}\n<script type="importmap">${JSON.stringify({ imports })}</script>\n<script type="module">import '@cybeni/backend';</script>`;
  html = withHead(html, head);

  issues.push(...nativeStaticCheck(files));

  const result = { html, issues, npm: [...bare].sort(), entryNote };
  if (served) {
    const serverFiles = [];
    for (const f of files) {
      if (modules.has(f.path) || f.path === htmlPath) continue;
      // Other pages of an addition need the bridge too (it asks for a relaunch onto them).
      const page = addition && /\.html?$/i.test(f.path);
      serverFiles.push({ path: f.path, content: page ? withHead(f.content, additionHead) : f.content, mime: mimeFor(f.path) });
    }
    for (const [path, code] of modules) serverFiles.push({ path, content: code, mime: 'text/javascript' });
    serverFiles.push({ path: 'index.html', content: html, mime: 'text/html' });
    if (addition) serverFiles.push({ path: '__novaura/v1.js', content: NOVAURA_V1_SOURCE, mime: 'text/javascript' });
    result.serverFiles = serverFiles;
  }
  return result;
}

/** Fast, deterministic checks (syntax, missing files, entry point) without running anything. */
export function staticCheck(files) {
  return buildPreview(files, { mode: 'inline' }).issues;
}
