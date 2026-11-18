import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdditionController } from '../../src/services/additions/controller.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeFrame() {
  const attrs = {};
  return {
    src: '',
    srcdoc: '',
    attrs,
    contentWindow: {},
    setAttribute(k, v) { attrs[k] = v; },
    removeAttribute(k) { delete attrs[k]; if (k === 'srcdoc') this.srcdoc = ''; },
    addEventListener() {},
    removeEventListener() {},
  };
}

function setup({ addition = {} } = {}) {
  let n = 0;
  let current = {
    id: 'user_notes', slug: 'notes', name: 'Notes',
    manifest: { id: 'local.notes', name: 'Notes', version: '1.0.0' },
    grants: { permissions: [], network: [] }, requested: { network: [] }, quotaBytes: 1024 ** 3,
    ...addition,
  };
  const log = { launches: [], stops: [], connects: [], disposed: [], titles: [], closes: 0, noted: [], states: [], routers: [] };
  const events = new EventTarget();
  const noteResults = new Map();
  const deps = {
    ensureMigrated: async () => {},
    getAddition: async (id) => (id === current.id ? structuredClone(current) : null),
    launch: async (a, { path }) => {
      n++;
      const out = { session: `sess${n}aaaa`, nonce: `nonce${n}`, src: `http://cyprev.localhost/sess${n}aaaa/${path || 'index.html'}#nv=nonce${n}`, sandbox: 'allow-scripts allow-forms allow-modals', issues: [] };
      log.launches.push({ addition: a, path, out });
      return out;
    },
    stop: async (session) => { log.stops.push(session); },
    connect: ({ nonce, router, onRelaunch }) => {
      const c = { nonce, router, onRelaunch, themes: [] };
      log.connects.push(c);
      return { dispose: () => log.disposed.push(nonce), pushTheme: (t) => c.themes.push(t) };
    },
    createRouter: (opts) => { log.routers.push(opts); return { handle: async () => null }; },
    noteBlockedOrigin: async (id, origin) => { log.noted.push(origin); const seen = noteResults.get(origin); noteResults.set(origin, true); return !seen; },
    subscribeTheme: (fn) => { deps.pushTheme = fn; return () => { deps.pushTheme = null; }; },
    events,
    setTitle: (t) => log.titles.push(t),
    close: () => { log.closes++; },
    settleMs: 0,
    blankTimeoutMs: 0,
  };
  const frame = fakeFrame();
  const ctrl = createAdditionController({ appId: 'user_notes', deps, onState: (s) => log.states.push(s) });
  const change = (appId, patch = {}) => {
    if (appId === current.id) current = { ...current, ...patch };
    events.dispatchEvent(new CustomEvent('novaura:addition_changed', { detail: appId }));
  };
  return { ctrl, frame, log, deps, change };
}

const settle = async () => { for (let i = 0; i < 5; i++) await tick(); };

test('start launches into the frame it was given', async () => {
  const { ctrl, frame, log } = setup();
  const doc = await ctrl.start(frame);
  assert.equal(doc.src, 'http://cyprev.localhost/sess1aaaa/index.html#nv=nonce1');
  assert.equal(frame.src, doc.src);
  assert.equal(log.connects[0].nonce, 'nonce1');
  assert.equal(log.routers[0].addition.id, 'user_notes');
  ctrl.dispose();
});

test('a relaunch request starts a new session and nonce and clears the old one', async () => {
  const { ctrl, frame, log } = setup();
  await ctrl.start(frame);
  log.connects[0].onRelaunch({ path: 'settings/profile' });
  await settle();
  assert.equal(log.launches.length, 2);
  assert.equal(log.launches[1].path, 'settings/profile');
  assert.deepEqual(log.disposed, ['nonce1']);
  assert.deepEqual(log.stops, ['sess1aaaa']);
  assert.equal(log.connects[1].nonce, 'nonce2');
  assert.equal(frame.src, 'http://cyprev.localhost/sess2aaaa/settings/profile#nv=nonce2');
  ctrl.dispose();
});

test('a change to this addition relaunches it; a change to another does not', async () => {
  const { ctrl, frame, log, change } = setup();
  await ctrl.start(frame);
  change('user_other');
  await settle();
  assert.equal(log.launches.length, 1);
  // Only what it asked for changed (a blocked origin was noted): no relaunch.
  change('user_notes', { requested: { network: ['https://api.weather.gov'] } });
  await settle();
  assert.equal(log.launches.length, 1);
  // The person granted it: relaunch, so the new CSP applies.
  change('user_notes', { grants: { permissions: [], network: ['https://api.weather.gov'] } });
  await settle();
  assert.equal(log.launches.length, 2);
  assert.deepEqual(log.launches[1].addition.grants.network, ['https://api.weather.gov']);
  ctrl.dispose();
});

test('a blocked origin raises the banner once', async () => {
  const { ctrl, frame, log } = setup();
  await ctrl.start(frame);
  const onBlocked = log.routers[0].onBlocked;
  onBlocked('https://api.weather.gov');
  onBlocked('https://api.weather.gov');
  await settle();
  const banners = log.states.filter((s) => s.banner);
  assert.equal(banners.length, 1);
  assert.deepEqual(banners[0].banner, { origin: 'https://api.weather.gov', name: 'Notes' });
  assert.deepEqual(log.noted, ['https://api.weather.gov', 'https://api.weather.gov']);
  ctrl.dispose();
});

test('dispose clears the session and stops listening', async () => {
  const { ctrl, frame, log, change, deps } = setup();
  await ctrl.start(frame);
  ctrl.dispose();
  assert.deepEqual(log.stops, ['sess1aaaa']);
  assert.deepEqual(log.disposed, ['nonce1']);
  assert.equal(deps.pushTheme, null, 'theme subscription ended');
  change('user_notes', { grants: { permissions: [], network: ['https://x.example'] } });
  log.connects[0].onRelaunch({ path: '' });
  await settle();
  assert.equal(log.launches.length, 1);
});

test('setTitle and close reach the window', async () => {
  const { ctrl, frame, log } = setup();
  await ctrl.start(frame);
  const { ui } = log.routers[0];
  ui.setTitle('Groceries');
  ui.setTitle('');
  ui.close();
  assert.deepEqual(log.titles, ['Groceries', 'Notes']);
  assert.equal(log.closes, 1);
  ctrl.dispose();
});

test('theme changes are pushed to the running addition', async () => {
  const { ctrl, frame, log, deps } = setup();
  await ctrl.start(frame);
  deps.pushTheme({ mode: 'light' });
  assert.deepEqual(log.connects[0].themes, [{ mode: 'light' }]);
  ctrl.dispose();
});

test('an addition that no longer exists shows an error instead of launching', async () => {
  const { ctrl, frame, log } = setup({ addition: { id: 'user_gone' } });
  await ctrl.start(frame);
  assert.equal(log.launches.length, 0);
  assert.ok(log.states.some((s) => /removed/i.test(s.error || '')));
  ctrl.dispose();
});
