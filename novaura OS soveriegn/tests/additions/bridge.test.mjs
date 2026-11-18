import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFrame, fakePort, autoReply, defaultBoot, HOST, tick0 } from './bridgeHarness.js';
import { NOVAURA_V1_SOURCE } from '../../src/services/additions/bridgeSource.js';
import { CHUNK_BYTES, LOCAL_STORAGE_LIMIT_BYTES, LS_BATCH_MS } from '../../src/services/additions/limits.js';

test('the shipped source carries the real limits', () => {
  assert.ok(NOVAURA_V1_SOURCE.includes(JSON.stringify({ chunkBytes: CHUNK_BYTES, localStorageLimit: LOCAL_STORAGE_LIMIT_BYTES, batchMs: LS_BATCH_MS })));
});

test('hello carries the nonce, goes only to the OS origin, and the hash is cleared', () => {
  const f = makeFrame();
  assert.equal(f.win.stopped, 0);
  assert.equal(f.posted.length, 1);
  assert.deepEqual(f.posted[0].msg, { __novaura: 'hello', nonce: 'n0nce', apiVersion: 1 });
  assert.equal(f.posted[0].target, HOST);
  assert.equal(f.win.location.hash, '');
  assert.deepEqual(f.replaced, ['/sess1234/index.html']);
});

test('boot data is removed from the page', () => {
  const f = makeFrame();
  assert.equal(f.win.__novauraBoot, undefined);
  assert.equal('__novauraBoot' in f.win, false);
});

test('localStorage reads the snapshot before anything is sent', () => {
  const f = makeFrame();
  assert.equal(f.win.localStorage.getItem('theme'), 'dark');
  assert.equal(f.win.localStorage.theme, 'dark');
  assert.equal(f.win.localStorage.length, 1);
  assert.equal(f.win.localStorage.key(0), 'theme');
  assert.deepEqual(Object.keys(f.win.localStorage), ['theme']);
  assert.equal(f.win.localStorage.getItem('missing'), null);
  assert.equal(f.posted.length, 1); // only hello
  assert.equal(f.win.sessionStorage.getItem('theme'), null);
});

test('localStorage writes go out as one batch after 50 ms, and early writes wait for the port', async () => {
  const f = makeFrame();
  f.win.localStorage.setItem('a', 1);
  f.win.localStorage.b = 'two';
  f.win.localStorage.setItem('a', 'one');
  await f.tick(60);
  const port = f.connect();
  await tick0();
  assert.deepEqual(port.sent, [{ t: 'ls.batch', ops: [{ op: 'set', key: 'a', value: 'one' }, { op: 'set', key: 'b', value: 'two' }] }]);
  f.win.localStorage.removeItem('a');
  delete f.win.localStorage.b;
  await f.tick(49);
  assert.equal(port.sent.length, 1);
  await f.tick(1);
  assert.deepEqual(port.sent[1], { t: 'ls.batch', ops: [{ op: 'remove', key: 'a' }, { op: 'remove', key: 'b' }] });
  f.win.localStorage.setItem('x', 'y');
  f.win.localStorage.clear();
  f.win.localStorage.setItem('z', 'w');
  await f.tick(50);
  assert.deepEqual(port.sent[2], { t: 'ls.batch', ops: [{ op: 'clear' }, { op: 'set', key: 'z', value: 'w' }] });
});

test('a write past 64 MB throws QuotaExceededError and keeps the old value', () => {
  const f = makeFrame({ boot: defaultBoot({ snapshot: {} }) }); // limit 1000 bytes in this frame
  const ls = f.win.localStorage;
  ls.setItem('big', 'x'.repeat(900));
  assert.throws(() => ls.setItem('big2', 'y'.repeat(200)), (e) => e.name === 'QuotaExceededError');
  assert.equal(ls.getItem('big2'), null);
  ls.setItem('big', 'z'.repeat(990)); // replaces, 993 bytes in all
  assert.throws(() => ls.setItem('big', 'w'.repeat(1200)), (e) => e.name === 'QuotaExceededError');
  assert.equal(ls.getItem('big'), 'z'.repeat(990));
});

test('pending writes are flushed when the page hides', async () => {
  const f = makeFrame();
  const port = f.connect();
  f.win.localStorage.setItem('k', 'v');
  assert.equal(port.sent.length, 0);
  f.dispatch('window', 'pagehide', {});
  assert.deepEqual(port.sent, [{ t: 'ls.batch', ops: [{ op: 'set', key: 'k', value: 'v' }] }]);
  await f.tick(100);
  assert.equal(port.sent.length, 1);
});

test('novaura.version is 1, novaura.app comes from boot, and the object is frozen', () => {
  const f = makeFrame();
  const n = f.win.novaura;
  assert.equal(n.version, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(n.app)), { id: 'local.notes', name: 'Notes', version: '1.0.0', permissions: [] });
  for (const part of [n, n.app, n.storage, n.ui, n.ai, n.files]) assert.ok(Object.isFrozen(part));
  assert.throws(() => { f.win.novaura = { version: 99 }; }, TypeError);
  assert.equal(f.win.novaura, n);
  assert.equal(typeof n.notify, 'function');
});

test("a call resolves with the OS's value", async () => {
  const f = makeFrame();
  const port = f.connect();
  const p = f.win.novaura.storage.get('x');
  await tick0();
  assert.deepEqual(port.sent[0], { id: port.sent[0].id, m: 'storage.get', a: { key: 'x' } });
  port.reply({ id: port.sent[0].id, ok: true, v: { value: 'hi' } });
  assert.equal(await p, 'hi');
});

test('an error reply rejects with its code', async () => {
  const f = makeFrame();
  const port = f.connect();
  const p = f.win.novaura.notify({ title: 'Hi', body: 'there' });
  await tick0();
  assert.equal(port.sent[0].m, 'notify');
  port.reply({ id: port.sent[0].id, ok: false, e: { code: 'permission_denied', message: 'Not allowed' } });
  await assert.rejects(p, (e) => e.code === 'permission_denied' && e.message === 'Not allowed');
});

test('rate_limited is retried after retryAfterMs', async () => {
  const f = makeFrame();
  const port = f.connect();
  const p = f.win.novaura.storage.keys();
  await tick0();
  const { id } = port.sent[0];
  port.reply({ id, ok: false, e: { code: 'rate_limited', retryAfterMs: 100 } });
  await f.tick(99);
  assert.equal(port.sent.length, 1);
  await f.tick(1);
  assert.equal(port.sent.length, 2);
  assert.equal(port.sent[1].id, id);
  port.reply({ id, ok: true, v: ['a'] });
  assert.deepEqual([...(await p)], ['a']);
});

test('a port from another source, or a second port, is ignored', async () => {
  const f = makeFrame();
  const stranger = f.connect(fakePort(), { source: { postMessage() {} } });
  const wrongOrigin = f.connect(fakePort(), { origin: 'https://evil.example' });
  const p = f.win.novaura.storage.usage();
  await tick0();
  assert.equal(stranger.sent.length, 0);
  assert.equal(wrongOrigin.sent.length, 0);
  const port = f.connect();
  const second = f.connect();
  await tick0();
  assert.equal(port.sent.length, 1);
  port.reply({ id: port.sent[0].id, ok: true, v: 5 });
  assert.equal(await p, 5);
  f.win.novaura.storage.usage();
  await tick0();
  assert.equal(second.sent.length, 0);
  assert.equal(port.sent.length, 2);
});

test('without boot data it asks to be relaunched, calls reject not_connected, and localStorage still works in memory', async () => {
  const f = makeFrame({ boot: null, hash: '', pathname: '/sess1234/settings/profile' });
  assert.deepEqual(f.posted.map((p) => p.msg), [{ __novaura: 'relaunch', path: 'settings/profile' }]);
  assert.equal(f.win.stopped, 1, 'the page stops loading, so the app does not run without its data');
  await assert.rejects(f.win.novaura.storage.get('x'), (e) => e.code === 'not_connected');
  f.win.localStorage.setItem('k', 'v');
  assert.equal(f.win.localStorage.getItem('k'), 'v');
  assert.equal(f.win.novaura.app, null);
});

test('theme events reach onThemeChange listeners until unsubscribed', async () => {
  const f = makeFrame();
  const port = f.connect();
  assert.equal((await f.win.novaura.ui.theme()).mode, 'dark');
  const seen = [];
  const off = f.win.novaura.ui.onThemeChange((t) => seen.push(t.mode));
  port.reply({ t: 'theme', theme: { mode: 'light', colors: {} } });
  assert.deepEqual(seen, ['light']);
  assert.equal((await f.win.novaura.ui.theme()).mode, 'light');
  off();
  port.reply({ t: 'theme', theme: { mode: 'dark', colors: {} } });
  assert.deepEqual(seen, ['light']);
});

test('large values go in chunks no bigger than chunkBytes', async () => {
  const f = makeFrame(); // chunkBytes 64
  const stored = new Map();
  const uploads = new Map();
  const reads = new Map();
  let n = 0;
  const port = autoReply(fakePort(), (m, a) => {
    if (m === 'storage.set') { stored.set(a.key, a.value); return true; }
    if (m === 'storage.put.begin') { const id = `u${++n}`; uploads.set(id, { ...a, parts: [] }); return { uploadId: id }; }
    if (m === 'storage.put.chunk') { uploads.get(a.uploadId).parts[a.index] = a.data; return true; }
    if (m === 'storage.put.commit') {
      const u = uploads.get(a.uploadId);
      stored.set(u.key, u.kind === 'string' ? u.parts.join('') : Buffer.concat(u.parts.map((p) => Buffer.from(p))));
      return true;
    }
    if (m === 'storage.get') {
      const v = stored.get(a.key);
      const parts = typeof v === 'string' ? v.match(/[\s\S]{1,50}/g) : [v.subarray(0, 64), v.subarray(64)].map((b) => new Uint8Array(b).buffer);
      const id = `r${++n}`;
      reads.set(id, parts);
      return { chunked: { readId: id, kind: typeof v === 'string' ? 'string' : 'bytes', size: v.length, count: parts.length } };
    }
    if (m === 'storage.get.chunk') return reads.get(a.readId)[a.index];
    throw { code: 'unknown_method' };
  });
  f.connect(port);
  const text = 'ab😀'.repeat(60); // 360 UTF-8 bytes
  await f.win.novaura.storage.set('text', text);
  const textChunks = port.sent.filter((s) => s.m === 'storage.put.chunk' && typeof s.a.data === 'string');
  assert.ok(textChunks.length >= 6, `${textChunks.length} chunks`);
  for (const c of textChunks) assert.ok(Buffer.byteLength(c.a.data) <= 64, `chunk of ${Buffer.byteLength(c.a.data)} bytes`);
  assert.equal(stored.get('text'), text);

  const bytes = new Uint8Array(150).map((_, i) => i);
  await f.win.novaura.storage.set('bytes', bytes.buffer);
  const byteChunks = port.sent.filter((s) => s.m === 'storage.put.chunk' && typeof s.a.data !== 'string');
  assert.equal(byteChunks.length, 3);
  for (const c of byteChunks) assert.ok(c.a.data.byteLength <= 64);
  assert.deepEqual([...stored.get('bytes')], [...bytes]);

  await f.win.novaura.storage.set('small', 'tiny');
  assert.equal(port.sent.at(-1).m, 'storage.set');

  assert.equal(await f.win.novaura.storage.get('text'), text);
  const back = await f.win.novaura.storage.get('bytes');
  assert.deepEqual([...new Uint8Array(back)], [...bytes]);
});

test('a blocked origin is reported once', async () => {
  const f = makeFrame();
  const port = f.connect();
  const violation = (blockedURI, effectiveDirective = 'connect-src') => f.dispatch('document', 'securitypolicyviolation', { blockedURI, effectiveDirective });
  violation('https://api.example.com/a');
  violation('https://api.example.com/b?x=1');
  violation('inline', 'script-src-elem');
  violation('wss://live.example.com/socket');
  await tick0();
  assert.deepEqual(port.sent, [
    { t: 'blocked', uri: 'https://api.example.com/a', directive: 'connect-src' },
    { t: 'blocked', uri: 'wss://live.example.com/socket', directive: 'connect-src' },
  ]);
});

test('ai.chat sends only cloneable options', async () => {
  const f = makeFrame();
  const port = f.connect();
  f.win.novaura.ai.chat([{ role: 'user', content: 'hi' }], { maxTokens: 10, temperature: 0.2, stream: true, onToken() {} }).catch(() => {});
  await tick0();
  assert.deepEqual(port.sent[0].a, { messages: [{ role: 'user', content: 'hi' }], opts: { maxTokens: 10, temperature: 0.2, stream: true } });
});

test('an inline frame with no hash takes its nonce from the boot data', () => {
  const f = makeFrame({ boot: defaultBoot({ nonce: 'inl1ne' }), hash: '', pathname: 'srcdoc' });
  assert.deepEqual(f.posted[0].msg, { __novaura: 'hello', nonce: 'inl1ne', apiVersion: 1 });
  const hashWins = makeFrame({ boot: defaultBoot({ nonce: 'inl1ne' }), hash: '#nv=fr0mhash' });
  assert.equal(hashWins.posted[0].msg.nonce, 'fr0mhash');
});

test("the OS's IPC handles are taken off the page before the app runs", () => {
  const f = makeFrame({ globals: { __TAURI_INTERNALS__: { invoke() {} }, ipc: { postMessage() {} }, __TAURI__: {} } });
  assert.equal(f.win.__TAURI_INTERNALS__, undefined);
  assert.equal(f.win.ipc, undefined);
  assert.equal(f.win.__TAURI__, undefined);
});
