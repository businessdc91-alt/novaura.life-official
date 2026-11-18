// The contract fixture against the real bridge, host and router, wired through a
// real MessageChannel. The bridge runs in a node:vm context standing in for the frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { NOVAURA_V1_SOURCE } from '../../src/services/additions/bridgeSource.js';
import { connectAddition } from '../../src/services/additions/host.js';
import { createRouter } from '../../src/services/additions/router.js';
import { createAdditionData } from '../../src/services/additions/dataStore.js';
import { createFakeTable } from './fakeTable.js';
import { runChecks } from './fixture-app/checks.js';

const HOST = 'http://tauri.localhost';

function frameContext({ boot, nonce, hostWindow }) {
  const listeners = { window: new Map(), document: new Map() };
  const on = (where) => (type, fn) => {
    if (!listeners[where].has(type)) listeners[where].set(type, []);
    listeners[where].get(type).push(fn);
  };
  const ctx = {
    location: { hash: `#nv=${nonce}`, pathname: '/sess0001/index.html', search: '' },
    history: { replaceState: () => { ctx.location.hash = ''; } },
    addEventListener: on('window'),
    removeEventListener() {},
    document: { addEventListener: on('document'), removeEventListener() {} },
    setTimeout, clearTimeout, DOMException, Blob, URL, console,
    __novauraBoot: boot,
  };
  // What the host sees as frame.contentWindow, and what the frame sees as its parent.
  const contentWindow = {
    postMessage(data, _target, transfer = []) {
      for (const fn of listeners.window.get('message') || []) fn({ data, source: ctx.parent, origin: HOST, ports: transfer, stopImmediatePropagation() {} });
    },
  };
  ctx.parent = {
    postMessage(data, target) {
      assert.ok(target === HOST || target === '*', `posted to ${target}`);
      hostWindow.dispatchEvent(Object.assign(new Event('message'), { data, source: contentWindow, origin: 'null' }));
    },
  };
  ctx.window = ctx;
  ctx.self = ctx;
  return { ctx, contentWindow };
}

test('the contract fixture passes against the real bridge, host and router', async () => {
  const nonce = 'c0ntract1';
  const hostWindow = new EventTarget();
  const table = createFakeTable();
  const data = createAdditionData(table);
  const addition = { id: 'user_fixture', grants: { permissions: [], network: [] }, quotaBytes: 1024 ** 3 };
  const titles = [];
  const router = createRouter({ addition, data, ui: { theme: () => ({ mode: 'dark' }), setTitle: (t) => titles.push(t), close() {} } });
  const boot = {
    app: { id: 'local.fixture', name: 'Fixture', version: '1.0.0', permissions: [] },
    snapshot: {},
    theme: { name: 'default', mode: 'dark', colors: {} },
    hostOrigin: HOST,
  };
  const { ctx, contentWindow } = frameContext({ boot, nonce, hostWindow });
  const conn = connectAddition({ frame: { contentWindow }, nonce, hostWindow, router, onRelaunch() {}, drainMs: 0 });
  vm.createContext(ctx);
  vm.runInContext(NOVAURA_V1_SOURCE, ctx);

  const results = await runChecks(ctx.novaura, { localStorage: ctx.localStorage });
  for (const r of results) assert.ok(r.ok, `${r.name}: ${r.detail}`);
  assert.equal(results.length, 13);
  assert.deepEqual(titles, ['Contract fixture']);

  // The localStorage write reaches the OS once its batch goes out.
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(await data.snapshotLocalStorage('user_fixture'), { contract: 'yes' });
  conn.dispose();
  await new Promise((r) => setTimeout(r, 20));
});
