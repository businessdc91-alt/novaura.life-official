// The in-preview backend (@cybeni/backend): streamed ai.chat replies and stored passwords.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { CYBENI_BACKEND_MODULE_SOURCE } from '../../src/services/cybeni/fullStackRuntime.js';

let loads = 0;
async function loadApp(appId = 'test-app') {
  const store = new Map();
  const listeners = [];
  const posted = [];
  const parent = { postMessage(data) { posted.push(data); } };
  const win = {
    localStorage: {
      get length() { return store.size; },
      key(i) { return Array.from(store.keys())[i] ?? null; },
      getItem(k) { return store.has(k) ? store.get(k) : null; },
      setItem(k, v) { store.set(k, String(v)); },
      removeItem(k) { store.delete(k); },
    },
    parent,
    __cybeniAppId: appId,
    addEventListener(type, fn) { if (type === 'message') listeners.push(fn); },
  };
  globalThis.window = win;
  const src = `${CYBENI_BACKEND_MODULE_SOURCE}\n// load ${++loads}`;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src, 'utf8').toString('base64')}`);
  const send = (source, data) => listeners.forEach(fn => fn({ source, data }));
  const users = () => JSON.parse(store.get(`__cybeni_auth_users__:${appId}:`) || '[]');
  return { ...mod, win, parent, posted, send, store, users };
}

test('ai.chat with onToken asks for a stream and hands each piece to the app', async () => {
  const app = await loadApp();
  const pieces = [];
  const done = app.ai.chat('Tell me a joke', { onToken: (t) => pieces.push(t) });
  const req = app.posted.find(p => p.type === 'ai-request');
  assert.ok(req, 'the request reaches the OS');
  assert.equal(req.opts.stream, true);

  app.send(app.parent, { __cybeniAiChunk: true, requestId: req.requestId, text: 'Why did ' });
  app.send({ postMessage() {} }, { __cybeniAiChunk: true, requestId: req.requestId, text: 'INJECTED' });
  app.send(app.parent, { __cybeniAiChunk: true, requestId: req.requestId, text: 'the chicken…' });
  app.send(app.parent, { __cybeniAiReply: true, requestId: req.requestId, text: 'Why did the chicken…' });
  assert.equal(await done, 'Why did the chicken…');
  assert.deepEqual(pieces, ['Why did ', 'the chicken…'], 'only pieces from the OS window are used');
});

test('ai.chat without onToken does not ask for a stream', async () => {
  const app = await loadApp();
  const done = app.ai.chat([{ role: 'user', content: 'hi' }]);
  const req = app.posted.find(p => p.type === 'ai-request');
  assert.equal(req.opts.stream, false);
  app.send(app.parent, { __cybeniAiReply: true, requestId: req.requestId, text: 'hello' });
  assert.equal(await done, 'hello');
});

test('a password is stored as PBKDF2-SHA256 with a random salt', async () => {
  const app = await loadApp();
  assert.equal(app.auth.signUp({ email: 'ann@example.com', password: 'correct horse' }).error, null);
  const [user] = app.users();
  const m = /^pbkdf2-sha256\$(\d+)\$([0-9a-f]{64})$/.exec(user.passwordHash);
  assert.ok(m, `stored as pbkdf2-sha256$rounds$hash, got ${user.passwordHash}`);
  assert.match(user.salt, /^[0-9a-f]{32}$/, '16 random bytes of salt');
  assert.ok(Number(m[1]) >= 10000, 'at least 10,000 rounds');
  assert.equal(m[2], pbkdf2Sync('correct horse', user.salt, Number(m[1]), 32, 'sha256').toString('hex'), 'matches a reference PBKDF2');

  app.auth.signOut();
  assert.equal(app.auth.signIn({ email: 'ann@example.com', password: 'wrong' }).user, null);
  assert.equal(app.auth.signIn({ email: 'ann@example.com', password: 'correct horse' }).user?.email, 'ann@example.com');
});

test('non-ASCII passwords hash the same as a reference PBKDF2', async () => {
  const app = await loadApp();
  app.auth.signUp({ email: 'zoe@example.com', password: 'pässwörd ✓ 🔑' });
  const [user] = app.users();
  const [, rounds, hex] = user.passwordHash.split('$');
  assert.equal(hex, pbkdf2Sync('pässwörd ✓ 🔑', user.salt, Number(rounds), 32, 'sha256').toString('hex'));
});

// The hash earlier builds stored, so accounts made with them still sign in.
function legacyHash(secret, salt) {
  const input = String(salt || 'cybeni') + ':' + String(secret || '');
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

test('an account saved with the old hash still signs in and is moved to the new one', async () => {
  const app = await loadApp('old-app');
  const old = { id: 'usr_1', email: 'old@example.com', name: 'old', role: 'admin', salt: 'salt_abc', passwordHash: legacyHash('hunter22', 'salt_abc'), createdAt: '2026-11-01T00:00:00.000Z' };
  app.store.set('__cybeni_auth_users__:old-app:', JSON.stringify([old]));
  assert.equal(app.auth.signIn({ email: 'old@example.com', password: 'nope' }).user, null);
  assert.equal(app.users()[0].passwordHash, old.passwordHash, 'a failed sign-in changes nothing');
  assert.equal(app.auth.signIn({ email: 'old@example.com', password: 'hunter22' }).user?.id, 'usr_1');
  const [moved] = app.users();
  assert.match(moved.passwordHash, /^pbkdf2-sha256\$/);
  assert.equal(moved.passwordHash.split('$')[2], pbkdf2Sync('hunter22', moved.salt, Number(moved.passwordHash.split('$')[1]), 32, 'sha256').toString('hex'));
  app.auth.signOut();
  assert.equal(app.auth.signIn({ email: 'old@example.com', password: 'hunter22' }).user?.id, 'usr_1', 'and signs in with the new hash');
});

test('@cybeni/backend keeps an existing v1 window.novaura', async () => {
  const bridge = Object.freeze({ version: 1 });
  const realWindow = { localStorage: { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }, parent: { postMessage() {} }, addEventListener() {} };
  Object.defineProperty(realWindow, 'novaura', { value: bridge, writable: false, configurable: false, enumerable: true });
  globalThis.window = realWindow;
  const src = `${CYBENI_BACKEND_MODULE_SOURCE}\n// load v1 guard ${++loads}`;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src, 'utf8').toString('base64')}`);
  assert.equal(realWindow.novaura, bridge, 'the addition bridge stays');
  assert.equal(realWindow.cybeniBackend, mod.novaura, 'the backend is still reachable');
});
