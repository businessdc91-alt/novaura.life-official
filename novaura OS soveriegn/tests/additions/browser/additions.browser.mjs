// Additions end to end in a real browser: the real launch, controller, host, router
// and data store (on real IndexedDB), with the fake cyprev server standing in for the
// OS's protocol and serving each session with its golden ADDITION_CSP. Run with:
//   npm run test:additions   (needs the dev server: npx vite --port 5199 --strictPort)
import { test, assert } from '../../creative/browser/harness.js';
import { publish, clear, goldenCsp, cyprevBase, newSessionId, messageFrom } from './cyprev.js';
import Dexie from 'dexie';
import { launchAddition } from '/src/services/additions/launch.js';
import { createAdditionController } from '/src/services/additions/controller.js';
import { connectAddition } from '/src/services/additions/host.js';
import { createRouter } from '/src/services/additions/router.js';
import { createAdditionData } from '/src/services/additions/dataStore.js';
import { localManifest } from '/src/services/additions/manifest.js';
import { currentTheme } from '/src/services/additions/theme.js';
import fixtureHtml from '../fixture-app/index.html?raw';
import fixtureApp from '../fixture-app/app.js?raw';
import fixtureChecks from '../fixture-app/checks.js?raw';

// A database of its own, laid out like the OS's addition_data table.
const testDb = new Dexie(`additions-browser-test-${Date.now()}`);
testDb.version(1).stores({ addition_data: '[appId+key], appId' });
const data = createAdditionData(testDb.addition_data);

const FIXTURE = [
  { path: 'index.html', content: fixtureHtml },
  { path: 'app.js', content: fixtureApp },
  { path: 'checks.js', content: fixtureChecks },
];
const page = (script) => [{ path: 'index.html', content: `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">${script}</script></body></html>` }];

const additionFor = (slug) => ({
  id: `user_${slug}`,
  slug,
  name: slug,
  manifest: localManifest({ slug, name: slug }),
  grants: { permissions: [], network: [] },
  requested: { network: [] },
  legacy: false,
  legacyNotes: [],
  quotaBytes: 1024 ** 3,
});

// What the OS does for an addition window, with the fake cyprev server as `invoke`.
async function openAddition(slug, files) {
  const addition = additionFor(slug);
  const invoke = async (cmd, args) => {
    if (cmd === 'addition_publish') return (await publish(args.session, args.files, { csp: await goldenCsp(args.network), once: args.once })).count;
    if (cmd === 'addition_clear') return clear(args.session);
    throw new Error(`unexpected command ${cmd}`);
  };
  const banners = [];
  const titles = [];
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:480px;height:320px;border:0';
  document.body.appendChild(frame);
  const ctrl = createAdditionController({
    appId: addition.id,
    deps: {
      ensureMigrated: async () => {},
      getAddition: async () => addition,
      launch: (a, { path }) => launchAddition(a, {
        data, invoke, loadFiles: async () => files, hostOrigin: location.origin,
        newSession: newSessionId, newNonce: newSessionId, theme: currentTheme(),
        baseUrl: (s) => `${cyprevBase()}${s}/`, path,
      }),
      stop: (session) => clear(session),
      connect: (opts) => connectAddition(opts),
      createRouter: (opts) => createRouter({ ...opts, data }),
      noteBlockedOrigin: async () => true,
      subscribeTheme: () => () => {},
      events: new EventTarget(),
      setTitle: (t) => titles.push(t),
      close() {},
      currentTheme,
    },
    onState: (s) => { if (s.banner) banners.push(s.banner); },
  });
  await ctrl.start(frame);
  return {
    addition, frame, ctrl, banners, titles,
    close() { frame.remove(); ctrl.dispose(); },
  };
}

const from = (app, key, ms = 15_000) => messageFrom(app.frame, (d) => d && key in d, ms).then((e) => e.data);

test('the contract fixture passes every check', async () => {
  const app = await openAddition('fixture', FIXTURE);
  const { __fixture: results } = await from(app, '__fixture');
  for (const r of results) assert.ok(r.ok, `${r.name}: ${r.detail}`);
  assert.equal(results.length, 13);
  assert.deepEqual(app.titles, ['Contract fixture']);
  app.close();
});

test("an addition cannot read another addition's data", async () => {
  const a = await openAddition('alpha', page(`
    await novaura.storage.set('secret', 'from alpha');
    localStorage.setItem('secret', 'from alpha');
    parent.postMessage({ saved: true }, '*');`));
  await from(a, 'saved');
  a.close();
  const b = await openAddition('beta', page(`
    parent.postMessage({ stored: (await novaura.storage.get('secret')) ?? null, local: localStorage.getItem('secret'), keys: await novaura.storage.keys() }, '*');`));
  const seen = await from(b, 'stored');
  assert.deepEqual(seen, { stored: null, local: null, keys: [] });
  b.close();
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(await data.get('user_alpha', 'secret'), 'from alpha');
  assert.equal((await data.snapshotLocalStorage('user_alpha')).secret, 'from alpha');
});

test('an addition cannot reach local ports or the IPC host', async () => {
  const app = await openAddition('net', page(`
    const results = [];
    for (const url of ['http://127.0.0.1:1234/v1/models', 'http://localhost:11434/api/tags', 'http://ipc.localhost/plugin:x', 'https://api.weather.gov/points']) {
      try { await fetch(url); results.push('fetched'); } catch { results.push('blocked'); }
    }
    await new Promise((r) => setTimeout(r, 300));
    parent.postMessage({ results }, '*');`));
  const { results } = await from(app, 'results');
  assert.deepEqual(results, ['blocked', 'blocked', 'blocked', 'blocked']);
  await new Promise((r) => setTimeout(r, 200));
  // Only the https origin is offered to the person, once.
  assert.deepEqual(app.banners.map((b) => b.origin), ['https://api.weather.gov']);
  app.close();
});

test('an addition cannot open the OS database', async () => {
  const app = await openAddition('idb', page(`
    let outcome;
    try {
      const req = indexedDB.open('NovauraSovereignPrivateCloud');
      outcome = await new Promise((res) => { req.onsuccess = () => res('opened'); req.onerror = () => res('error'); });
    } catch (e) { outcome = 'threw ' + e.name; }
    parent.postMessage({ outcome }, '*');`));
  const { outcome } = await from(app, 'outcome');
  assert.ok(outcome !== 'opened', `the addition opened the OS database (${outcome})`);
  app.close();
});

test('a method that was not granted rejects', async () => {
  const app = await openAddition('denied', page(`
    const codes = [];
    for (const call of [() => novaura.notify({ title: 'x' }), () => novaura.ai.chat([{ role: 'user', content: 'hi' }]), () => novaura.files.open({})]) {
      try { await call(); codes.push('allowed'); } catch (e) { codes.push(e.code); }
    }
    parent.postMessage({ codes }, '*');`));
  const { codes } = await from(app, 'codes');
  assert.deepEqual(codes, ['permission_denied', 'permission_denied', 'permission_denied']);
  app.close();
});

test('localStorage survives a relaunch', async () => {
  const app = await openAddition('counter', page(`
    const n = Number(localStorage.getItem('count') || 0) + 1;
    localStorage.setItem('count', String(n));
    parent.postMessage({ count: n, at: Date.now() }, '*');`));
  const first = await from(app, 'count');
  assert.equal(first.count, 1);
  await app.ctrl.relaunch();
  const second = await messageFrom(app.frame, (d) => d && 'count' in d && d.at > first.at, 15_000).then((e) => e.data);
  assert.equal(second.count, 2);
  app.close();
});

test('an app that reloads itself comes back with its data', async () => {
  const app = await openAddition('reloader', page(`
    if (localStorage.getItem('reloaded') !== 'yes') {
      localStorage.setItem('reloaded', 'yes');
      location.reload();
    } else {
      parent.postMessage({ reloaded: localStorage.getItem('reloaded'), hash: location.hash }, '*');
    }`));
  const back = await from(app, 'reloaded', 20_000);
  assert.equal(back.reloaded, 'yes');
  assert.equal(back.hash, '', 'the launch nonce is not left in the address');
  app.close();
});

test('a write right before the window closes is kept', async () => {
  const app = await openAddition('closer', page(`
    localStorage.setItem('last', 'kept');
    parent.postMessage({ wrote: true }, '*');`));
  await from(app, 'wrote');
  app.close();
  await new Promise((r) => setTimeout(r, 1300));
  assert.equal((await data.snapshotLocalStorage('user_closer')).last, 'kept');
});
