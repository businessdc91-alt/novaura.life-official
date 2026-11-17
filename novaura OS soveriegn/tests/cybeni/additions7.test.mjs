// Tests for Cybeni's 7 competitive additions:
//   1. @cybeni/backend & @novaura/sdk virtual full-stack runtime (CRUD, Auth/RBAC, Storage, Admin bridge)
//   2. Full-stack Node + SQLite server & .novapp manifest generation
//   3. Visual DOM Audit & Vision/Layout auto-repair in pipeline
//   4. Offline Tailwind fallback shim & @cybeni/backend isolation from esm.sh
//   5. Interactive Visual Element Inspector & React Fiber component tracing instrumentation
//   6. Unified line diff computation, multimodal image forwarding, streaming callbacks, & binary asset bridge

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'sucrase';
import {
  CYBENI_BACKEND_MODULE_SOURCE,
  buildNovappManifest,
  generateFullStackServerFiles,
} from '../../src/services/cybeni/fullStackRuntime.js';
import { OFFLINE_TAILWIND_FALLBACK_SCRIPT, computeLineDiff } from '../../src/services/cybeni/offlineShims.js';
import { buildPreview } from '../../src/services/cybeni/previewBuilder.js';
import { TEST_AGENT_SOURCE } from '../../src/services/cybeni/testAgent.js';
import * as P from '../../src/services/cybeni/pipeline.js';
import * as L from '../../src/services/cybeni/libraryNotes.js';

test('@cybeni/backend runtime supports CRUD, reactive subscriptions, Auth/RBAC, and KV storage', async () => {
  // Minimal browser-like storage + window shim so we can execute the exact injected module in Node.
  const store = new Map();
  const listeners = new Map();
  const posted = [];
  const origWindow = globalThis.window;
  const fakeWindow = {
    localStorage: {
      get length() { return store.size; },
      key(i) { return Array.from(store.keys())[i] ?? null; },
      getItem(k) { return store.has(k) ? store.get(k) : null; },
      setItem(k, v) { store.set(k, String(v)); },
      removeItem(k) { store.delete(k); },
    },
    parent: { postMessage(msg) { posted.push(msg); } },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
  };
  fakeWindow.parent.window = fakeWindow;
  globalThis.window = fakeWindow;

  try {
    const b64 = Buffer.from(CYBENI_BACKEND_MODULE_SOURCE, 'utf8').toString('base64');
    const mod = await import(`data:text/javascript;base64,${b64}`);
    const { db, auth, storage } = mod;

    assert.equal(fakeWindow.novaura.version, '1.0');
    assert.equal(fakeWindow.cybeniBackend, fakeWindow.novaura);

    // Collections CRUD + seed + subscribe
    const tasks = db.collection('tasks');
    const snapshots = [];
    const unsub = tasks.subscribe(rows => snapshots.push(rows));
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].length, 0);

    tasks.seed([{ id: 'seed-1', title: 'Initial', done: false }]);
    assert.equal(tasks.count(), 1);
    // Calling seed again when non-empty must be a no-op
    tasks.seed([{ title: 'Duplicate seed' }]);
    assert.equal(tasks.count(), 1);

    const added = tasks.insert({ title: 'Ship Cybeni', done: false });
    assert.ok(added.id && added.createdAt);
    assert.equal(tasks.list({ done: false }).length, 2);

    const updated = tasks.update(added.id, { done: true });
    assert.equal(updated.done, true);
    assert.equal(tasks.get(added.id)?.done, true);

    assert.equal(tasks.remove('seed-1'), true);
    assert.equal(tasks.count(), 1);
    unsub();

    // Parent Admin Bridge mutates table and triggers sync
    for (const fn of listeners.get('message') || []) {
      // From the hosting OS window: the runtime ignores data commands from any other sender.
      fn({ source: fakeWindow.parent, data: { __cybeniDbAdmin: true, action: 'insert', table: 'tasks', record: { title: 'From Admin' } } });
    }
    assert.equal(tasks.count(), 2);
    assert.ok(posted.some(m => m.__cybeni && m.type === 'db-sync' && m.tables?.tasks?.length === 2));

    // Auth & RBAC
    const badEmail = auth.signUp({ email: 'not-an-email', password: 'secret' });
    assert.ok(badEmail.error && !badEmail.user);

    const adminRes = auth.signUp({ email: 'Founder@NovAura.test', password: 'password123', name: 'Founder' });
    assert.equal(adminRes.error, null);
    assert.equal(adminRes.user.role, 'admin');
    assert.equal(auth.hasRole('editor'), true);

    const dup = auth.signUp({ email: 'founder@novaura.test', password: 'password123' });
    assert.ok(dup.error && !dup.user);

    auth.signOut();
    assert.equal(auth.currentUser(), null);
    assert.ok(auth.signIn({ email: 'founder@novaura.test', password: 'wrong' }).error);
    assert.equal(auth.signIn({ email: 'founder@novaura.test', password: 'password123' }).user?.name, 'Founder');

    // KV Storage
    storage.set('theme', { mode: 'dark' });
    assert.deepEqual(storage.get('theme'), { mode: 'dark' });
    assert.ok(storage.keys().includes('theme'));
    storage.remove('theme');
    assert.equal(storage.get('theme', 'fallback'), 'fallback');
  } finally {
    if (origWindow === undefined) delete globalThis.window;
    else globalThis.window = origWindow;
  }
});

test('previewBuilder registers @cybeni/backend, @novaura/sdk, offline Tailwind fallback, and binary assets', () => {
  const pngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const files = [
    { path: 'index.html', content: '<!DOCTYPE html><html><head></head><body><div id="root"></div><img src="assets/logo.png"><script type="module" src="/src/main.jsx"></script></body></html>' },
    { path: 'src/main.jsx', content: "import React from 'react';\nimport { db, auth } from '@cybeni/backend';\nimport logo from '../assets/logo.png';\nconsole.log(db, auth, logo);" },
    { path: 'assets/logo.png', content: pngData },
    { path: 'assets/bad.svg', content: '<svg></script><rect/></svg>' },
  ];

  const inline = buildPreview(files, { mode: 'inline' });
  assert.equal(inline.issues.length, 0, 'binary assets and @cybeni/backend resolve with zero missing-import issues');
  assert.ok(!inline.npm.includes('@cybeni/backend'), '@cybeni/backend is internal, not queued for esm.sh');
  assert.ok(inline.html.includes('"@cybeni/backend":"data:text/javascript;base64,'), 'inline importmap maps @cybeni/backend');
  assert.ok(inline.html.includes('"@novaura/sdk":"data:text/javascript;base64,'), 'inline importmap maps @novaura/sdk');
  assert.ok(inline.html.includes(`<img src="${pngData}">`), 'relative img src rewritten to asset data URL');
  assert.ok(inline.html.includes('cybeni-offline-tw'), 'offline Tailwind fallback script injected');
  assert.ok(!inline.html.includes('</script><rect/></svg>'), 'XSS script close inside SVG asset data map is escaped');

  const srv = buildPreview(files, { mode: 'server', baseUrl: 'http://cyprev.localhost/abc/' });
  assert.equal(srv.issues.length, 0);
  assert.ok(srv.html.includes('"@cybeni/backend":"http://cyprev.localhost/abc/_cybeni_internal/backend.js"'));
  assert.ok(srv.serverFiles.some(f => f.path === '_cybeni_internal/backend.js'));
  assert.ok(srv.serverFiles.some(f => f.path === 'assets/logo.png.assetmod.js'));
  assert.ok(OFFLINE_TAILWIND_FALLBACK_SCRIPT.includes('hasTailwind'));
});

test('generateFullStackServerFiles and buildNovappManifest create valid Node+SQLite server & manifest', () => {
  const projectFiles = [
    { path: 'index.html', content: '<!DOCTYPE html><html><body>Hi</body></html>' },
    { path: 'package.json', content: JSON.stringify({ name: 'custom-app', version: '2.0.0', dependencies: { react: '18.3.1' } }) },
  ];
  const bundle = generateFullStackServerFiles('My SaaS App', projectFiles);
  const byPath = new Map(bundle.map(f => [f.path, f.content]));

  assert.ok(byPath.has('server/server.mjs'));
  assert.ok(byPath.has('Dockerfile'));
  assert.ok(byPath.has('README.fullstack.md'));
  const serverSrc = byPath.get('server/server.mjs');
  assert.doesNotThrow(() => transform(serverSrc, { transforms: [] }), 'generated server.mjs parses cleanly as valid ESM');
  assert.match(serverSrc, /\/api\\\/db\\\//);
  assert.ok(serverSrc.includes('/api/auth/signup'));
  assert.ok(serverSrc.includes("import('node:sqlite')"));

  const pkg = JSON.parse(byPath.get('package.json'));
  assert.equal(pkg.scripts.start, 'node server/server.mjs');
  assert.equal(pkg.dependencies.react, '18.3.1');

  const manifest = buildNovappManifest('My SaaS App', 'my-saas-app', projectFiles);
  assert.equal(manifest.format, 'novapp-v1');
  assert.equal(manifest.id, 'my-saas-app');
  assert.equal(manifest.entry, 'index.html');
  assert.equal(manifest.runtime, '@cybeni/backend');
});

test('computeLineDiff computes accurate unified additions, removals, and line numbers', () => {
  const diff = computeLineDiff('a\nb\nc\nd', 'a\nb2\nc\ne\nd');
  assert.equal(diff.approximate, false);
  assert.equal(diff.added, 2);
  assert.equal(diff.removed, 1);
  assert.deepEqual(
    diff.lines.map(l => `${l.type}:${l.line}`),
    ['same:a', 'del:b', 'add:b2', 'same:c', 'add:e', 'same:d'],
  );

  // Oversized diff guard falls back cleanly without hanging
  const bigA = Array.from({ length: 800 }, (_, i) => `old-${i}`).join('\n');
  const bigB = Array.from({ length: 800 }, (_, i) => `new-${i}`).join('\n');
  const approx = computeLineDiff(bigA, bigB);
  assert.equal(approx.approximate, true);
  assert.equal(approx.removed, 800);
  assert.equal(approx.added, 800);
});

test('testAgent source includes visualAudit and interactive element inspector', () => {
  assert.ok(TEST_AGENT_SOURCE.includes('literal-object-render'));
  assert.ok(TEST_AGENT_SOURCE.includes('literal-nan-render'));
  assert.ok(TEST_AGENT_SOURCE.includes('horizontal-overflow'));
  assert.ok(TEST_AGENT_SOURCE.includes('broken-image'));
  assert.ok(TEST_AGENT_SOURCE.includes('unlabelled-button'));
  assert.ok(TEST_AGENT_SOURCE.includes('overlapping-controls'));
  assert.ok(TEST_AGENT_SOURCE.includes('__cybeniInspect'));
  assert.ok(TEST_AGENT_SOURCE.includes('element-picked'));
  assert.ok(TEST_AGENT_SOURCE.includes('__reactFiber$'));
  assert.ok(L.libraryNotes("import { db } from '@cybeni/backend';").includes('db.collection'));
});

test('pipeline forwards multimodal images, streams callbacks, stubs binary assets, and repairs critical visual issues', async () => {
  const seenOpts = [];
  const seenPrompts = [];
  const streams = [];
  let fixedVisual = false;
  const imgData = 'data:image/png;base64,' + 'A'.repeat(400);

  const runModel = async (key, messages, opts) => {
    seenOpts.push(opts);
    seenPrompts.push(messages[1].content);
    opts.onToken?.('chunk-1');
    const task = messages[1].content.slice(messages[1].content.lastIndexOf('## Your task'));
    if (task.includes('failed with these problems')) {
      fixedVisual = true;
      return '```src/App.jsx\nexport default function App(){return <div>Clean User</div>}\n```';
    }
    return '```src/App.jsx\nexport default function App(){return <div>{user}</div>}\n```';
  };

  const verify = async () => ({
    errors: [],
    blank: false,
    visualIssues: fixedVisual
      ? []
      : [{ kind: 'literal-object-render', message: 'Rendered "[object Object]" inside div', selector: 'div' }],
    tests: [],
  });

  const out = await P.runPipeline({
    request: 'Build user card matching wireframe',
    mode: 'quick',
    files: [
      { path: 'index.html', content: '<!DOCTYPE html><html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' },
      { path: 'src/main.jsx', content: "import App from './App.jsx';" },
      { path: 'src/App.jsx', content: 'export default function App(){return null}' },
      { path: 'assets/wireframe.png', content: imgData },
    ],
    images: [{ name: 'wireframe.png', mime: 'image/png', dataUrl: imgData }],
    roles: { architect: 'dev', developer: 'dev', reviewer: 'rev', designer: 'dev' },
  }, {
    runModel,
    verify,
    onStream: (info) => streams.push(info),
  });

  assert.equal(out.status, 'done');
  assert.equal(out.runtimeClean, true, 'critical visual defect triggered runtime-fix and became clean');
  assert.ok(seenOpts.every(o => o.images?.length === 1), 'images option forwarded to runModel');
  assert.ok(seenPrompts[0].includes('Binary asset "assets/wireframe.png"'), 'binary asset stubbed out of text context');
  assert.ok(!seenPrompts[0].includes('A'.repeat(400)), 'raw base64 binary payload omitted from text prompt');
  assert.ok(streams.some(s => s.status === 'streaming' && s.chars > 0), 'onStream callback invoked');
});
