// Runs the novaura v1 bridge source inside node:vm with a small fake window, so its
// behaviour can be checked without a browser. Used by bridge.test.mjs.
import vm from 'node:vm';
import { bridgeSource } from '../../src/services/additions/bridgeSource.js';

export const HOST = 'http://tauri.localhost';
export const tick0 = () => new Promise((r) => setImmediate(r));

export function defaultBoot(extra = {}) {
  return {
    app: { id: 'local.notes', name: 'Notes', version: '1.0.0', permissions: [] },
    snapshot: { theme: 'dark' },
    theme: { name: 'default', mode: 'dark', colors: { background: 'hsl(0 0% 4%)' } },
    hostOrigin: HOST,
    ...extra,
  };
}

export function fakePort() {
  return {
    sent: [],
    closed: false,
    onmessage: null,
    postMessage(m) { this.sent.push(structuredClone(m)); },
    start() {},
    close() { this.closed = true; },
    reply(data) { this.onmessage?.({ data }); },
  };
}

/**
 * A fake frame. `boot: null` means no boot data (a reload); `limits` are the
 * bridge's { chunkBytes, localStorageLimit, batchMs }.
 */
export function makeFrame({ boot = defaultBoot(), hash = '#nv=n0nce', pathname = '/sess1234/index.html', limits = { chunkBytes: 64, localStorageLimit: 1000, batchMs: 50 } } = {}) {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const listeners = { window: new Map(), document: new Map() };
  const on = (where) => (type, fn) => {
    if (!listeners[where].has(type)) listeners[where].set(type, []);
    listeners[where].get(type).push(fn);
  };
  const posted = [];
  const replaced = [];
  const parent = { postMessage: (msg, target, transfer) => posted.push({ msg: structuredClone(msg), target, transfer }) };
  const win = {
    location: { hash, pathname, search: '' },
    history: { replaceState: (_s, _t, url) => { replaced.push(url); win.location.hash = ''; } },
    parent,
    addEventListener: on('window'),
    removeEventListener() {},
    document: { addEventListener: on('document'), removeEventListener() {} },
    setTimeout: (fn, ms = 0) => { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    DOMException,
    Blob,
    URL,
    console,
    __novauraBoot: boot,
  };
  win.window = win;
  win.self = win;
  if (boot === null) delete win.__novauraBoot;
  vm.createContext(win);
  vm.runInContext(bridgeSource(limits), win);

  const frame = {
    win,
    posted,
    replaced,
    novaura: win.novaura,
    dispatch(where, type, event) {
      for (const fn of listeners[where].get(type) || []) fn({ stopImmediatePropagation() {}, ...event });
    },
    /** Hand the bridge a port as the OS would. */
    connect(port = fakePort(), { source = parent, origin = HOST } = {}) {
      frame.dispatch('window', 'message', { source, origin, data: { __novaura: 'port' }, ports: [port] });
      return port;
    },
    async tick(ms) {
      now += ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= now).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        due[1].fn();
        await tick0();
      }
      await tick0();
    },
  };
  return frame;
}

/** Answer every request the bridge sends on `port` with handler(m, a) -> v (throw { code } to fail). */
export function autoReply(port, handler) {
  port.postMessage = function (m) {
    const msg = structuredClone(m);
    this.sent.push(msg);
    if (typeof msg.id !== 'number') return;
    Promise.resolve()
      .then(() => handler(msg.m, msg.a))
      .then((v) => this.onmessage?.({ data: { id: msg.id, ok: true, v } }), (e) => this.onmessage?.({ data: { id: msg.id, ok: false, e } }));
  };
  return port;
}
