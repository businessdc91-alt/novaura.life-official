// bridgeSource.js — The novaura API v1 as it runs inside an addition's frame,
// served as `__novaura/v1.js` before the app's own scripts.
//
// bridgeMain is a real function so it can be linted and tested, but it is shipped as
// its source text, so it must not refer to anything outside itself. It:
//   1. takes the boot data (`window.__novauraBoot`: app, storage snapshot, theme, OS
//      origin) off the page;
//   2. installs localStorage (backed by the snapshot, written through to the OS) and an
//      in-memory sessionStorage before any app code runs;
//   3. reads the launch nonce from `#nv=…`, clears the hash, and says hello to the OS;
//   4. waits for the OS's MessageChannel port and sends every later message through it;
//   5. defines a frozen `window.novaura`.
// With no boot data (the app reloaded itself) it asks the OS to relaunch it.
//
// Port wire format: requests { id, m, a }; replies { id, ok: true, v } or
// { id, ok: false, e: { code, message, retryAfterMs? } }; events from the frame
// { t: 'ls.batch', ops } and { t: 'blocked', uri, directive }; to the frame { t: 'theme', theme }.

import { CHUNK_BYTES, LOCAL_STORAGE_LIMIT_BYTES, LS_BATCH_MS } from './limits.js';

export function bridgeMain(limits) {
  'use strict';
  const w = window;
  const CHUNK = limits.chunkBytes;
  const LS_LIMIT = limits.localStorageLimit;
  const BATCH_MS = limits.batchMs;

  const utf8 = (s) => {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { n += 4; i++; }
      else n += 3;
    }
    return n;
  };
  const tagOf = (v) => Object.prototype.toString.call(v);
  const isBuffer = (v) => tagOf(v) === '[object ArrayBuffer]';
  const isBlob = (v) => tagOf(v) === '[object Blob]' || tagOf(v) === '[object File]';
  const makeError = (code, message) => {
    const e = new Error(message || code);
    e.name = 'NovauraError';
    e.code = code;
    return e;
  };
  const rethrowLater = (err) => w.setTimeout(() => { throw err; }, 0);

  // ── 1. Boot data ──────────────────────────────────────────────────────────
  const boot = w.__novauraBoot || null;
  try { delete w.__novauraBoot; } catch { w.__novauraBoot = undefined; }
  // The web view may inject the OS's IPC handles into every frame. The CSP already
  // blocks the IPC host; taking the handles away too means a widened policy alone
  // could never hand an addition the OS's commands.
  for (const name of ['__TAURI_INTERNALS__', '__TAURI__', 'ipc']) {
    try { delete w[name]; } catch { /* keep going */ }
    try { if (w[name] !== undefined) Object.defineProperty(w, name, { value: undefined, configurable: false, writable: false }); } catch { /* keep going */ }
  }

  let nonce = null;
  try {
    const m = /(?:^#|&)nv=([A-Za-z0-9]+)/.exec(String(w.location.hash || ''));
    nonce = m ? m[1] : null;
  } catch { nonce = null; }
  // An inline (srcdoc) frame has no address to carry the nonce, so its boot data does.
  if (!nonce && boot && typeof boot.nonce === 'string' && /^[A-Za-z0-9]+$/.test(boot.nonce)) nonce = boot.nonce;
  const fromHash = Boolean(nonce) && !(boot && boot.nonce === nonce);
  const connectable = Boolean(boot && nonce);

  // ── Port and requests ─────────────────────────────────────────────────────
  let port = null;
  const outbox = [];
  const pending = new Map();
  let seq = 0;

  function failSend(msg, err) {
    const p = typeof msg.id === 'number' ? pending.get(msg.id) : null;
    if (!p) return;
    pending.delete(msg.id);
    p.reject(makeError('bad_request', `This value can't be sent to the OS: ${err && err.message ? err.message : err}`));
  }
  function send(msg) {
    if (!port) { outbox.push(msg); return; }
    try { port.postMessage(msg); } catch (err) { failSend(msg, err); }
  }
  function call(m, a) {
    if (!connectable) return Promise.reject(makeError('not_connected', 'This app is restarting to reconnect to the OS.'));
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const msg = { id, m, a };
      pending.set(id, { resolve, reject, msg });
      send(msg);
    });
  }
  function onReply(d) {
    const p = pending.get(d.id);
    if (!p) return;
    if (d.ok) { pending.delete(d.id); p.resolve(d.v); return; }
    const e = d.e || {};
    if (e.code === 'rate_limited') {
      // Backpressure, not failure: wait as long as the OS asks, then send it again.
      w.setTimeout(() => send(p.msg), Math.max(1, Number(e.retryAfterMs) || 100));
      return;
    }
    pending.delete(d.id);
    p.reject(makeError(e.code || 'error', e.message));
  }

  // ── 2. Storage replacements ───────────────────────────────────────────────
  let lsOps = [];
  let lsIndex = new Map();
  let lsTimer = null;
  function flushLs() {
    if (lsTimer !== null) { w.clearTimeout(lsTimer); lsTimer = null; }
    if (!port || !lsOps.length) return;
    const ops = lsOps;
    lsOps = [];
    lsIndex = new Map();
    send({ t: 'ls.batch', ops });
  }
  function queueLs(op) {
    if (op.op === 'clear') { lsOps = [op]; lsIndex = new Map(); }
    else {
      const i = lsIndex.get(op.key);
      if (i !== undefined) lsOps[i] = op;
      else { lsIndex.set(op.key, lsOps.length); lsOps.push(op); }
    }
    if (lsTimer === null) lsTimer = w.setTimeout(() => { lsTimer = null; flushLs(); }, BATCH_MS);
  }

  function makeStorage(initial, persist) {
    const map = new Map();
    const sizes = new Map();
    let bytes = 0;
    for (const k of Object.keys(initial || {})) {
      const v = String(initial[k]);
      const n = utf8(k) + utf8(v);
      map.set(k, v);
      sizes.set(k, n);
      bytes += n;
    }
    const api = {
      getItem(k) { k = String(k); return map.has(k) ? map.get(k) : null; },
      setItem(k, v) {
        k = String(k);
        v = String(v);
        const next = utf8(k) + utf8(v);
        const old = sizes.get(k) || 0;
        if (bytes - old + next > LS_LIMIT) {
          throw new w.DOMException(`Setting the value of '${k}' exceeded the quota.`, 'QuotaExceededError');
        }
        map.set(k, v);
        sizes.set(k, next);
        bytes += next - old;
        if (persist) persist({ op: 'set', key: k, value: v });
      },
      removeItem(k) {
        k = String(k);
        if (!map.has(k)) return;
        bytes -= sizes.get(k) || 0;
        map.delete(k);
        sizes.delete(k);
        if (persist) persist({ op: 'remove', key: k });
      },
      clear() {
        map.clear();
        sizes.clear();
        bytes = 0;
        if (persist) persist({ op: 'clear' });
      },
      key(i) {
        const keys = [...map.keys()];
        return i >= 0 && i < keys.length ? keys[i] : null;
      },
    };
    const own = (p) => Object.prototype.hasOwnProperty.call(api, p);
    return new Proxy({}, {
      get(_t, p) {
        if (p === 'length') return map.size;
        if (typeof p === 'symbol') return p === Symbol.toStringTag ? 'Storage' : undefined;
        if (own(p)) return api[p];
        if (map.has(p)) return map.get(p);
        return p in Object.prototype ? Object.prototype[p] : undefined;
      },
      set(_t, p, v) {
        if (typeof p === 'string' && !own(p) && p !== 'length') api.setItem(p, v);
        return true;
      },
      has(_t, p) { return typeof p === 'string' && (own(p) || p === 'length' || map.has(p)); },
      deleteProperty(_t, p) { if (typeof p === 'string') api.removeItem(p); return true; },
      ownKeys() { return [...map.keys()]; },
      getOwnPropertyDescriptor(_t, p) {
        return typeof p === 'string' && map.has(p) ? { value: map.get(p), writable: true, enumerable: true, configurable: true } : undefined;
      },
      defineProperty(_t, p, d) {
        if (typeof p === 'string' && 'value' in d) api.setItem(p, d.value);
        return true;
      },
    });
  }

  const local = makeStorage(boot ? boot.snapshot : null, connectable ? queueLs : null);
  const session = makeStorage(null, null);
  for (const [name, value] of [['localStorage', local], ['sessionStorage', session]]) {
    try { Object.defineProperty(w, name, { value, configurable: true, enumerable: true, writable: false }); } catch { /* keep going */ }
  }

  // ── 3. Clear the launch nonce from the address ────────────────────────────
  if (fromHash) {
    try { w.history.replaceState(null, '', String(w.location.pathname || '') + String(w.location.search || '')); } catch { /* keep going */ }
  }

  // ── 4. The OS's port ──────────────────────────────────────────────────────
  let theme = boot ? boot.theme || null : null;
  const themeListeners = new Set();
  function onPortMessage(ev) {
    const d = ev && ev.data;
    if (!d || typeof d !== 'object') return;
    if (typeof d.id === 'number') { onReply(d); return; }
    if (d.t === 'theme') {
      theme = d.theme || null;
      for (const fn of [...themeListeners]) {
        try { fn(theme); } catch (err) { rethrowLater(err); }
      }
    }
  }
  w.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__novaura !== 'port') return;
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (port || !connectable || e.source !== w.parent || e.origin !== boot.hostOrigin) return;
    const p = e.ports && e.ports[0];
    if (!p) return;
    port = p;
    port.onmessage = onPortMessage;
    if (typeof port.start === 'function') port.start();
    for (const msg of outbox.splice(0)) send(msg);
    flushLs();
  }, true);
  w.addEventListener('pagehide', () => flushLs());
  try {
    w.document.addEventListener('visibilitychange', () => {
      if (w.document.visibilityState === 'hidden') flushLs();
    });
  } catch { /* keep going */ }

  // Report each network origin the CSP blocked, once, so the OS can offer to allow it.
  const reported = new Set();
  try {
    w.document.addEventListener('securitypolicyviolation', (e) => {
      const uri = String(e.blockedURI || '');
      if (!connectable || !/^(https?|wss?):/i.test(uri)) return;
      let origin = uri;
      try { origin = new w.URL(uri).origin; } catch { origin = uri; }
      if (reported.has(origin)) return;
      reported.add(origin);
      send({ t: 'blocked', uri, directive: String(e.effectiveDirective || e.violatedDirective || '') });
    }, true);
  } catch { /* keep going */ }

  // ── Storage calls, in chunks when large ───────────────────────────────────
  function chunkString(s) {
    const out = [];
    let start = 0;
    let bytes = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      let n = 3;
      let width = 1;
      if (c < 0x80) n = 1;
      else if (c < 0x800) n = 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { n = 4; width = 2; }
      if (bytes + n > CHUNK && i > start) { out.push(s.slice(start, i)); start = i; bytes = 0; }
      bytes += n;
      i += width - 1;
    }
    if (start < s.length) out.push(s.slice(start));
    return out;
  }
  const VIEWS = {
    Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array,
    Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView,
  };

  async function storageSet(key, value) {
    key = String(key);
    let kind = null;
    let size = 0;
    if (typeof value === 'string') { kind = 'string'; size = utf8(value); }
    else if (isBuffer(value) || ArrayBuffer.isView(value)) { kind = 'bytes'; size = value.byteLength; }
    else if (isBlob(value)) { kind = 'blob'; size = value.size; }
    if (!kind || size <= CHUNK) { await call('storage.set', { key, value }); return; }

    const begin = { key, kind, size };
    if (kind === 'blob') begin.type = String(value.type || '');
    if (kind === 'bytes' && !isBuffer(value)) begin.view = value.constructor && value.constructor.name;
    const { uploadId } = await call('storage.put.begin', begin);
    let index = 0;
    if (kind === 'string') {
      for (const data of chunkString(value)) await call('storage.put.chunk', { uploadId, index: index++, data });
    } else if (kind === 'bytes') {
      const buf = isBuffer(value) ? value : value.buffer;
      const off = isBuffer(value) ? 0 : value.byteOffset;
      for (let i = 0; i < size; i += CHUNK) {
        await call('storage.put.chunk', { uploadId, index: index++, data: buf.slice(off + i, off + Math.min(size, i + CHUNK)) });
      }
    } else {
      for (let i = 0; i < size; i += CHUNK) {
        const data = await value.slice(i, Math.min(size, i + CHUNK)).arrayBuffer();
        await call('storage.put.chunk', { uploadId, index: index++, data });
      }
    }
    await call('storage.put.commit', { uploadId, count: index });
  }

  async function storageGet(key) {
    const r = await call('storage.get', { key: String(key) });
    if (!r || !r.chunked) return r ? r.value : undefined;
    const c = r.chunked;
    const parts = [];
    for (let i = 0; i < c.count; i++) parts.push(await call('storage.get.chunk', { readId: c.readId, index: i }));
    if (c.kind === 'string') return parts.join('');
    if (c.kind === 'blob') return new w.Blob(parts, { type: c.type || '' });
    const out = new Uint8Array(c.size);
    let at = 0;
    for (const p of parts) {
      const u = new Uint8Array(p);
      out.set(u, at);
      at += u.byteLength;
    }
    const View = c.view && Object.prototype.hasOwnProperty.call(VIEWS, c.view) ? VIEWS[c.view] : null;
    return View ? new View(out.buffer) : out.buffer;
  }

  // ── 5. The API ────────────────────────────────────────────────────────────
  const storage = Object.freeze({
    get: storageGet,
    set: storageSet,
    remove: (key) => call('storage.remove', { key: String(key) }),
    keys: () => call('storage.keys', {}),
    usage: () => call('storage.usage', {}),
  });
  const ui = Object.freeze({
    theme: () => Promise.resolve(theme),
    onThemeChange(fn) {
      if (typeof fn !== 'function') throw new TypeError('novaura.ui.onThemeChange needs a function');
      themeListeners.add(fn);
      return () => { themeListeners.delete(fn); };
    },
    setTitle: (text) => call('ui.setTitle', { text: String(text == null ? '' : text) }),
    close: () => call('ui.close', {}),
  });
  const ai = Object.freeze({
    chat(messages, opts) {
      const o = opts || {};
      const clean = {};
      for (const k of ['maxTokens', 'temperature', 'stream']) if (o[k] !== undefined) clean[k] = o[k];
      return call('ai.chat', { messages, opts: clean });
    },
  });
  const files = Object.freeze({
    open: (opts) => call('files.open', { accept: opts && opts.accept, multiple: Boolean(opts && opts.multiple) }),
    save: (name, data) => call('files.save', { name: String(name), data }),
  });
  const a = boot && boot.app;
  const app = a
    ? Object.freeze({ id: a.id, name: a.name, version: a.version, permissions: Object.freeze([...(a.permissions || [])]) })
    : null;
  const novaura = Object.freeze({
    version: 1,
    app,
    storage,
    ui,
    notify: (o) => call('notify', { title: String((o && o.title) || ''), body: String((o && o.body) || '') }),
    ai,
    files,
  });
  try { Object.defineProperty(w, 'novaura', { value: novaura, enumerable: true, configurable: false, writable: false }); } catch { /* keep going */ }

  // ── Say hello, or ask to be relaunched ────────────────────────────────────
  try {
    if (connectable) {
      w.parent.postMessage({ __novaura: 'hello', nonce, apiVersion: 1 }, boot.hostOrigin);
    } else {
      const path = String(w.location.pathname || '').split('/').slice(2).join('/') + String(w.location.search || '');
      w.parent.postMessage({ __novaura: 'relaunch', path }, '*');
      // Without its data the app must not start (it could save over what it had, or
      // reload itself again); stop loading until the OS relaunches it.
      if (typeof w.stop === 'function') w.stop();
    }
  } catch { /* no parent to talk to */ }
}

export const LIMITS = { chunkBytes: CHUNK_BYTES, localStorageLimit: LOCAL_STORAGE_LIMIT_BYTES, batchMs: LS_BATCH_MS };

/** The bridge as a classic script with the given limits (tests pass small ones). */
export function bridgeSource(limits = LIMITS) {
  return `(${bridgeMain.toString()})(${JSON.stringify(limits)});\n`;
}

/** `__novaura/v1.js` */
export const NOVAURA_V1_SOURCE = bridgeSource(LIMITS);
