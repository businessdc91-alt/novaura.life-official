// Live benchmark: Cybeni builds benchmark apps on the real local models, verifying
// with the real test agent in headless Chrome (same contract as the app's verifier),
// then each build is scored against the benchmark's hidden tests.
//
// Usage (from novaura OS soveriegn/):
//   node tests/cybeni/live-bench.mjs <ids, comma separated | all> [mode]
//   ROLES='{"architect":"local|lmstudio:...", ...}' node tests/cybeni/live-bench.mjs todo
//   RESCORE=<run folder> node tests/cybeni/live-bench.mjs calculator   (score a saved build again)
// Output: tests/cybeni/.runs/<timestamp>/ (summary, raw model replies, built files).
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MODE = process.argv[3] || 'standard';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { runPipeline, phasesFor } = await import(pathToFileURL(`${ROOT}/src/services/cybeni/pipeline.js`).href);
const { buildPreview } = await import(pathToFileURL(`${ROOT}/src/services/cybeni/previewBuilder.js`).href);
const { runLocalChat } = await import(pathToFileURL(`${ROOT}/src/services/localModels.js`).href);
// benchmarks.js also imports the app's storage; only its data is needed here.
const src = readFileSync(`${ROOT}/src/services/cybeni/benchmarks.js`, 'utf8');
const dataOnly = src.replace(/^import .*$/gm, '').replace(/const HISTORY_KEY[\s\S]*$/, '');
const { BENCHMARKS } = await import(`data:text/javascript;base64,${Buffer.from(dataOnly).toString('base64')}`);
const IDS = !process.argv[2] || process.argv[2] === 'all' ? BENCHMARKS.map(b => b.id) : process.argv[2].split(',');

const roles = process.env.ROLES ? JSON.parse(process.env.ROLES) : {
  architect: 'local|lmstudio:google/gemma-4-26b-a4b-qat',
  developer: 'local|lmstudio:google/gemma-4-26b-a4b-qat',
  reviewer: 'local|lmstudio:gemma4-12b-qat-uncensored-hauhaucs-balanced',
  designer: 'local|lmstudio:google/gemma-4-26b-a4b-qat',
};

const RUNS = join(ROOT, 'tests/cybeni/.runs');
const runDir = process.env.RESCORE ? resolve(RUNS, process.env.RESCORE) : join(RUNS, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
mkdirSync(runDir, { recursive: true });

// ── Preview server and browser ──
let served = new Map();
let session = 'a0';
const HARNESS = `<!DOCTYPE html><html><body><script>
window.runCheck = (src, tests) => new Promise(resolve => {
  const events = []; let ready = null;
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals');
  f.style.cssText = 'width:1024px;height:768px;border:0';
  let finished = false;
  const done = (timedOut, results) => { if (finished) return; finished = true; removeEventListener('message', on); f.remove(); resolve({ events, ready, timedOut, results }); };
  const hard = setTimeout(() => done(true, []), 20000);
  const budget = Math.min(180000, 5000 + tests.reduce((n, t) => n + 1500 + t.steps.length * 4500, 0));
  const on = (e) => {
    if (e.source !== f.contentWindow || !e.data || !e.data.__cybeni) return;
    const d = e.data; events.push(d);
    if (d.type === 'ready' && !ready) { ready = d; clearTimeout(hard); setTimeout(() => { f.contentWindow.postMessage({ __cybeniTests: true, tests }, '*'); setTimeout(() => done(false, null), budget); }, 900); }
    if (d.type === 'test-results') done(false, d.results);
  };
  addEventListener('message', on);
  f.src = src + '?v=' + Date.now() + '&cybeni-isolate=1';
  document.body.append(f);
});
</script></body></html>`;
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/harness') { res.setHeader('Content-Type', 'text/html'); res.end(HARNESS); return; }
  const m = /^\/([a-z0-9]+)\/(.*)$/.exec(url);
  const file = m && m[1] === session && (served.get(m[2] || 'index.html') || (!/\.\w+$/.test(m[2]) && served.get('index.html')));
  if (!file) { res.statusCode = 404; res.end('missing'); return; }
  res.setHeader('Content-Type', file.mime); res.end(file.content);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const debugPort = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cybl-'))}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let targets = [];
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json(); if (targets.some(t => t.type === 'page')) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 250)); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let msgId = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const n = ++msgId; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Page.navigate', { url: `http://127.0.0.1:${port}/harness` });
await new Promise(r => setTimeout(r, 800));

const NOISE = [/cdn\.tailwindcss\.com should not be used in production/i, /Download the React DevTools/i];
async function verify(files, { tests = [] } = {}) {
  session = `s${Date.now().toString(36)}`;
  const base = `http://127.0.0.1:${port}/${session}/`;
  const out = buildPreview(files, { mode: 'server', baseUrl: base });
  served = new Map(out.serverFiles.map(f => [f.path, f]));
  // Same as the app: one load for errors, then a fresh load for each test.
  const check = async (list) => {
    const r = await send('Runtime.evaluate', { expression: `window.runCheck(${JSON.stringify(`${base}index.html`)}, ${JSON.stringify(list)})`, awaitPromise: true, returnByValue: true });
    return r.result?.result?.value || { events: [], ready: null, timedOut: true, results: [] };
  };
  const v = await check([]);
  const errors = v.events.filter(e => e.type === 'error').map(e => e.message + (e.line ? ` (line ${e.line})` : ''))
    .concat(v.events.filter(e => e.type === 'console' && e.level === 'error' && !NOISE.some(n => n.test(e.text))).map(e => e.text));
  if (v.timedOut && !v.ready) errors.push('The app did not finish loading within 20 seconds. An import may be failing, or the page may be stuck in a loop.');
  const results = [];
  for (const t of tests) {
    const one = v.ready ? await check([t]) : null;
    results.push(one?.results?.[0] || { id: t.id, requirement: t.requirement || '', name: t.name, passed: false, failedStep: -1, message: v.ready ? 'The test did not finish in time.' : 'The app never loaded.' });
  }
  const passed = results.filter(x => x.passed).length;
  console.log(`      [verify] ${[...new Set(errors)].length} error(s); ${v.ready ? (v.ready.empty ? 'blank page' : 'rendered') : 'never ready'}; tests ${passed}/${tests.length}`);
  return { errors: [...new Set(errors)].slice(0, 10), blank: v.ready ? Boolean(v.ready.empty) : true, timedOut: v.timedOut, tests: results };
}

// The previews load React and Tailwind from CDNs; without them every app "never loads".
async function online() {
  try { await fetch('https://esm.sh/', { method: 'HEAD', signal: AbortSignal.timeout(8000) }); return true; } catch { return false; }
}

// ── Runs ──
console.log(`run folder: ${runDir}`);
console.log('roles:', JSON.stringify(roles));
const summary = [];
for (const id of IDS) {
  const b = BENCHMARKS.find(x => x.id === id);
  if (!b) { console.log(`unknown benchmark ${id}`); continue; }
  console.log(`\n=== ${b.title} (${MODE}) ===`);
  if (!(await online())) console.log('      WARNING: esm.sh is unreachable, so previews cannot load React. Results for this app are not meaningful.');
  const outDir = join(runDir, `out-${id}`);
  if (process.env.RESCORE) {
    if (!existsSync(outDir)) { console.log(`no saved build in ${outDir}`); continue; }
    const saved = readdirSync(outDir).filter(n => n !== 'standalone.html').map(n => ({ path: n.replace(/__/g, '/'), content: readFileSync(join(outDir, n), 'utf8') }));
    const hidden = await verify(saved, { tests: b.tests });
    const hp = hidden.tests.filter(r => r.passed).length;
    console.log(`Rescored saved build: HIDDEN TESTS ${hp}/${b.tests.length}`);
    for (const r of hidden.tests.filter(x => !x.passed)) console.log(`   hidden fail ${r.name}: ${r.message.slice(0, 220)}`);
    summary.push({ id, approved: 'saved', own: '-', hidden: `${hp}/${b.tests.length}`, s: 0, calls: 0 });
    continue;
  }
  const labels = Object.fromEntries(phasesFor(MODE).map(p => [p.id, p.label]));
  const rawDir = join(runDir, `raw-${id}`);
  mkdirSync(rawDir, { recursive: true });
  const t0 = Date.now();
  const res = await runPipeline({ request: b.request, files: [], mode: MODE, roles }, {
    runModel: async (key, messages, opts) => {
      const t = Date.now();
      const reply = await runLocalChat(key.slice(6), messages, opts);
      writeFileSync(join(rawDir, `${Date.now()}-${key.split(':').pop().slice(0, 18).replace(/[^a-z0-9-]/gi, '_')}.txt`), `${messages[messages.length - 1].content.slice(-1500)}\n\n===== REPLY (${reply.length} chars, ${Math.round((Date.now() - t) / 1000)}s) =====\n${reply}`);
      return reply;
    },
    verify,
    onPhase: (pid, p) => { if (p.status !== 'running') console.log(`${p.status.padEnd(8)} ${labels[pid]}${p.note ? ` — ${p.note}` : ''}${p.ms ? ` (${Math.round(p.ms / 1000)}s)` : ''}`); },
    onLog: (t) => console.log(`      ${t}`),
    ask: async (q) => { console.log(`      QUESTION: ${q} -> "Use your best judgement."`); return 'Use your best judgement.'; },
  });
  const ownTests = res.testResults ? `${res.testResults.filter(r => r.passed).length}/${res.tests.length}` : 'none';
  const hidden = await verify(res.files, { tests: b.tests });
  const hp = hidden.tests.filter(r => r.passed).length;
  console.log(`\nResult: ${res.status}; approved ${res.approved}; own tests ${ownTests}; HIDDEN TESTS ${hp}/${b.tests.length}; ${res.stats.modelCalls} model calls; ${res.stats.fallbacks || 0} fallbacks; ${Math.round((Date.now() - t0) / 1000)}s`);
  for (const r of hidden.tests.filter(x => !x.passed)) console.log(`   hidden fail ${r.name}: ${r.message.slice(0, 220)}`);
  mkdirSync(outDir, { recursive: true });
  for (const f of res.files) writeFileSync(join(outDir, f.path.replace(/\//g, '__')), f.content);
  writeFileSync(join(outDir, 'standalone.html'), buildPreview(res.files, { mode: 'inline' }).html);
  summary.push({ id, approved: res.approved, own: ownTests, hidden: `${hp}/${b.tests.length}`, s: Math.round((Date.now() - t0) / 1000), calls: res.stats.modelCalls, fallbacks: res.stats.fallbacks || 0 });
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify({ mode: MODE, roles, summary }, null, 2));
}
console.log('\n=== SUMMARY ===');
for (const s of summary) console.log(`${s.id.padEnd(12)} hidden ${s.hidden.padEnd(5)} own ${s.own.padEnd(5)} approved ${String(s.approved).padEnd(5)} ${s.calls} calls ${s.s}s`);
ws.close(); chrome.kill(); server.close();
process.exit(0);
