// browser-test.mjs — Run *.browser.mjs test files in headless Edge or Chrome.
//
//   node scripts/browser-test.mjs tests/creative/browser/surface.browser.mjs [...more]
//   node scripts/browser-test.mjs --selftest tests/creative/browser/smoke.browser.mjs
//
// Serves the project folder over http://127.0.0.1, loads each file in a runner page
// (tests/creative/browser/harness.js), and prints "ok  <name>" or "FAIL <name> (<why>)".
// Exits 1 when anything fails, including page errors and console errors.
// The browser is CHROME_PATH, else Edge (the engine behind WebView2), else Chrome.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, normalize, extname, relative, isAbsolute, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HARNESS = '/tests/creative/browser/harness.js';
const TIMEOUT_MS = 60_000;
const TYPES = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif',
  '.psd': 'application/octet-stream', '.wasm': 'application/wasm', '.css': 'text/css',
};

const args = process.argv.slice(2);
const selftest = args.includes('--selftest');
const files = args.filter(a => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node scripts/browser-test.mjs [--selftest] <file.browser.mjs>...');
  process.exit(2);
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  const found = candidates.find(p => existsSync(p));
  if (!found) throw new Error('No Edge or Chrome found; set CHROME_PATH.');
  return found;
}

function runnerPage(file) {
  const target = JSON.stringify(`/${file.split(sep).join('/')}`);
  return `<!doctype html><meta charset="utf-8"><title>browser test</title><script type="module">
import { run, reportLoadError } from ${JSON.stringify(HARNESS)};
try { await import(${target}); } catch (err) { reportLoadError(err); }
await run();
</script>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__runner.html') {
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    res.end(runnerPage(url.searchParams.get('file') || ''));
    return;
  }
  const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  const rel = relative(ROOT, path);
  if (rel.startsWith('..') || isAbsolute(rel)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const HTTP = server.address().port;

const PORT = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'novaura-browser-test-'));
const browser = spawn(findBrowser(), [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
let nextId = 0;
const pending = new Map();
let pageErrors = [];

async function connect() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
        ws.onmessage = (m) => {
          const msg = JSON.parse(m.data);
          if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
          if (msg.method === 'Runtime.exceptionThrown') {
            const d = msg.params.exceptionDetails;
            pageErrors.push(`page exception: ${(d.exception?.description || d.text || '').split('\n')[0]}`);
          }
          if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
            pageErrors.push(`console.error: ${msg.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
          }
          if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error' && !/favicon/.test(msg.params.entry.url || '')) {
            pageErrors.push(`browser log: ${msg.params.entry.text.slice(0, 300)}`);
          }
        };
        return;
      }
    } catch { /* the browser is still starting */ }
    await sleep(150);
  }
  throw new Error('Could not connect to the browser.');
}

const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++nextId;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
}

let failed = 0;
try {
  await connect();
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  for (const file of files) {
    console.log(`# ${file}`);
    pageErrors = [];
    const query = `file=${encodeURIComponent(file)}${selftest ? '&selftest=1' : ''}`;
    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP}/__runner.html?${query}` });
    const start = Date.now();
    let done = false;
    while (Date.now() - start < TIMEOUT_MS) {
      await sleep(200);
      if (await evaluate('window.__done === true')) { done = true; break; }
    }
    const results = done ? await evaluate('window.__results') : [];
    if (!done) results.push({ name: 'run', ok: false, message: `timed out after ${TIMEOUT_MS / 1000} s` });
    for (const e of pageErrors) results.push({ name: 'page', ok: false, message: e });
    for (const r of results) {
      if (r.ok) console.log(`ok   ${r.name}`);
      else { failed++; console.log(`FAIL ${r.name} (${r.message})`); }
    }
  }
} catch (err) {
  failed++;
  console.log(`FAIL harness (${err.message})`);
} finally {
  try { ws?.close(); } catch { /* closing */ }
  browser.kill();
  server.close();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold it */ }
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
