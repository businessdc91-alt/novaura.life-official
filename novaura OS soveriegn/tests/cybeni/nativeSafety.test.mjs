// Review fixes for the native (C++/C#) build path and the in-preview backend.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starterFiles } from '../../src/services/cybeni/starters.js';
import * as P from '../../src/services/cybeni/pipeline.js';
import { CYBENI_BACKEND_MODULE_SOURCE } from '../../src/services/cybeni/fullStackRuntime.js';
import { buildPreview } from '../../src/services/cybeni/previewBuilder.js';

// One shared localStorage, as every Cybeni app on the cyprev origin has.
function sharedOrigin() {
  const store = new Map();
  const localStorage = {
    get length() { return store.size; },
    key(i) { return Array.from(store.keys())[i] ?? null; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
  };
  return { store, localStorage };
}

let loads = 0;
async function loadRuntime(origin, appId) {
  const listeners = [];
  const parent = { postMessage() {} };
  const win = {
    localStorage: origin.localStorage,
    parent,
    __cybeniAppId: appId,
    addEventListener(type, fn) { if (type === 'message') listeners.push(fn); },
  };
  // The runtime reads `window` when it is called, not only when it loads, so it stays set.
  // Every app here shares the one localStorage, so whichever window is current, the
  // storage is the same.
  globalThis.window = win;
  // A fresh module per app (same source would come back from the module cache).
  const src = `${CYBENI_BACKEND_MODULE_SOURCE}\n// load ${++loads}`;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src, 'utf8').toString('base64')}`);
  const send = (source, data) => listeners.forEach(fn => fn({ source, data }));
  return { ...mod, win, send };
}

test('two Cybeni apps on the same origin keep their own tables and accounts', async () => {
  const origin = sharedOrigin();
  const a = await loadRuntime(origin, 'habit-tracker');
  a.db.collection('todos').insert({ title: 'from A' });
  assert.equal(a.auth.signUp({ email: 'a@example.com', password: 'secret1' }).error, null);

  const b = await loadRuntime(origin, 'recipe-box');
  assert.deepEqual(b.db.collection('todos').list(), [], "B does not see A's rows");
  assert.deepEqual(b.db.tables(), []);
  assert.equal(b.auth.currentUser(), null, "B is not signed in as A's user");
  assert.deepEqual(b.auth.listUsers(), []);
  assert.equal(a.db.collection('todos').count(), 1, "A's data is still there");
});

test("the backend obeys data commands only from the OS window, not from frames it embeds", async () => {
  const origin = sharedOrigin();
  const app = await loadRuntime(origin, 'notes');
  app.db.collection('notes').insert({ title: 'keep me' });
  const embedded = { postMessage() {} };
  app.send(embedded, { __cybeniDbAdmin: true, action: 'clear', table: 'notes' });
  assert.equal(app.db.collection('notes').count(), 1, 'a message from another frame is ignored');
  app.send(app.win.parent, { __cybeniDbAdmin: true, action: 'clear', table: 'notes' });
  assert.equal(app.db.collection('notes').count(), 0, 'the OS window can still manage the data');
});

test('a preview names its app before the backend loads', () => {
  const { html } = buildPreview([{ path: 'index.html', content: '<!doctype html><html><head></head><body><div id="root"></div></body></html>' }], { mode: 'inline', appId: 'habit-tracker' });
  const named = html.indexOf('window.__cybeniAppId="habit-tracker"');
  assert.ok(named > -1, 'the app id is set');
  assert.ok(named < html.indexOf("import '@cybeni/backend'"), 'before the backend module runs');
});

const ROLES = { architect: 'arch', developer: 'dev', reviewer: 'rev', designer: 'dev' };

test('no C++ compiler on the machine: the native check is skipped and the preview is still checked', async () => {
  const prompts = [];
  const runModel = async (key, messages) => {
    prompts.push(messages[1].content);
    return '```src/main.cpp\n#include <iostream>\nint main(){ std::cout << "ok"; return 0; }\n```';
  };
  let verified = 0;
  const logLines = [];
  const out = await P.runPipeline({
    request: 'Write a C++20 CLI metrics analyzer',
    mode: 'quick',
    files: starterFiles('cpp'),
    roles: ROLES,
  }, {
    runModel,
    onLog: (t) => logLines.push(t),
    compileNative: async () => { throw new Error('No C++ compiler found. Install WinLibs MinGW.'); },
    verify: async () => { verified++; return { errors: [], blank: false, visualIssues: [], tests: [] }; },
  });
  assert.equal(out.status, 'done');
  assert.ok(verified > 0, 'the web preview was still verified');
  assert.equal(out.runtimeClean, true, 'a missing toolchain is not a problem in the code');
  assert.ok(!prompts.some(p => p.includes('No C++ compiler found')), 'the model is never asked to fix a missing compiler');
  assert.ok(logLines.some(l => /native check skipped/i.test(l)), 'the log says the native check was skipped');
});
