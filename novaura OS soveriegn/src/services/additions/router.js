// router.js — Answers what one running addition asks the OS over its port (the wire
// format is in bridgeSource.js). Every request is checked here, on the OS side:
//   - permissions: notify, ai.chat and files.* need a grant; a granted service that
//     isn't built yet says not_available;
//   - budgets: 50 requests per second (a token bucket; events are not counted),
//     messages up to 16 MB, larger values in chunks, and the addition's quota;
//   - storage only ever touches this addition's own data.
// Blocked network origins the frame reports are passed to onBlocked once cleaned;
// local addresses never are.

import { CHUNK_BYTES, LOCAL_STORAGE_LIMIT_BYTES, MAX_MESSAGE_BYTES, REQUESTS_PER_SECOND } from './limits.js';
import { cleanNetworkOrigin, originOf } from './network.js';
import { isArrayBuffer, isBlob, measure, sizeOf, utf8Length } from './size.js';

const PENDING_MS = 60_000;
const TITLE_MAX = 120;
const CODES = new Set(['unknown_method', 'permission_denied', 'not_available', 'rate_limited', 'too_large', 'quota_exceeded', 'bad_request']);
const VIEWS = {
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array,
  Float32Array, Float64Array, BigInt64Array, BigUint64Array, DataView,
};
// Methods that need a permission, and the service that will answer them once granted.
const GUARDED = {
  notify: { permission: 'notifications', service: 'notify', what: 'send notifications' },
  'ai.chat': { permission: 'ai', service: 'aiChat', what: 'use your AI model' },
  'files.open': { permission: 'files', service: 'filesOpen', what: 'open files' },
  'files.save': { permission: 'files', service: 'filesSave', what: 'save files' },
};

function fail(code, message, extra) {
  const err = new Error(message);
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
}

const needKey = (a) => {
  if (typeof a.key !== 'string') throw fail('bad_request', 'A storage key must be text.');
  return a.key;
};

/** Where to cut a string into pieces of at most `limit` UTF-8 bytes ([start, end] pairs), never splitting a surrogate pair. */
function stringCuts(s, limit) {
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
    if (bytes + n > limit && i > start) { out.push([start, i]); start = i; bytes = 0; }
    bytes += n;
    i += width - 1;
  }
  if (start < s.length) out.push([start, s.length]);
  return out;
}

export function cleanTitle(text) {
  return String(text ?? '')
    // Control characters (line breaks, NUL…) become spaces: a title is one line of text.
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_MAX);
}

export function createRouter({ addition, data, ui, onBlocked = () => {}, now = Date.now, limits = {}, services = {} }) {
  const appId = addition.id;
  const granted = new Set(addition.grants?.permissions || []);
  const quotaBytes = addition.quotaBytes;
  const chunkBytes = limits.chunkBytes ?? CHUNK_BYTES;
  const maxMessage = limits.maxMessageBytes ?? MAX_MESSAGE_BYTES;
  const rps = limits.requestsPerSecond ?? REQUESTS_PER_SECOND;
  // Events are budgeted too: the frame is untrusted. An honest bridge sends at most one
  // localStorage batch every 50 ms and reports each blocked origin once.
  const eventRate = limits.eventsPerSecond ?? 25;
  const eventBurst = limits.eventBurst ?? 40;
  const maxEventOps = limits.maxEventOps ?? 100_000;
  const maxEventBytes = limits.maxEventBytes ?? LOCAL_STORAGE_LIMIT_BYTES + 1024 ** 2;
  const maxBlocked = limits.maxBlockedOrigins ?? 32;
  // One pending chunked read per key, and never more held than the addition may store.
  const maxPendingReadBytes = limits.maxPendingReadBytes ?? quotaBytes;

  // Token bucket: `rps` requests a second, with bursts up to `rps`.
  let tokens = rps;
  let last = now();
  function take() {
    const t = now();
    tokens = Math.min(rps, tokens + ((t - last) * rps) / 1000);
    last = t;
    if (tokens >= 1) { tokens -= 1; return 0; }
    return Math.max(1, Math.ceil(((1 - tokens) * 1000) / rps));
  }
  let eventTokens = eventBurst;
  let eventLast = now();
  function takeEvent() {
    const t = now();
    eventTokens = Math.min(eventBurst, eventTokens + ((t - eventLast) * eventRate) / 1000);
    eventLast = t;
    if (eventTokens < 1) return false;
    eventTokens -= 1;
    return true;
  }
  const reported = new Set();

  // Chunked uploads (one per key) and chunked reads, dropped after 60 s.
  const uploads = new Map();
  const reads = new Map();
  let pendingReadBytes = 0;
  let seq = 0;
  function dropRead(id) {
    const r = reads.get(id);
    if (!r) return;
    reads.delete(id);
    pendingReadBytes -= r.size;
  }
  function sweep() {
    const t = now();
    for (const [id, u] of uploads) if (u.expires < t) uploads.delete(id);
    for (const [id, r] of reads) if (r.expires < t) dropRead(id);
  }

  async function setValue(key, value) {
    await data.set(appId, key, value, { quotaBytes });
    return true;
  }

  const METHODS = {
    async 'storage.get'(a) {
      const key = needKey(a);
      // A new read of a key replaces any unfinished one, so repeated reads can't pile up copies.
      for (const [id, r] of reads) if (r.key === key) dropRead(id);
      const value = await data.get(appId, key);
      const kind = typeof value === 'string' ? 'string' : isArrayBuffer(value) || ArrayBuffer.isView(value) ? 'bytes' : isBlob(value) ? 'blob' : null;
      if (!kind || sizeOf(value) <= chunkBytes) return { value };
      const size = sizeOf(value);
      if (pendingReadBytes + size > maxPendingReadBytes) throw fail('rate_limited', 'Too much is being read at once; waiting.', { retryAfterMs: 1000 });
      const id = `r${++seq}`;
      // Pieces are cut when asked for, from the one stored value.
      const read = { key, kind, size, value, expires: now() + PENDING_MS };
      if (kind === 'string') read.cuts = stringCuts(value, chunkBytes);
      else if (kind === 'bytes') {
        if (!isArrayBuffer(value) && Object.hasOwn(VIEWS, value.constructor?.name)) read.view = value.constructor.name;
      } else read.type = value.type || '';
      read.count = read.cuts ? read.cuts.length : Math.ceil(size / chunkBytes);
      reads.set(id, read);
      pendingReadBytes += size;
      const head = { readId: id, kind, size: read.size, count: read.count };
      if (read.view) head.view = read.view;
      if (kind === 'blob') head.type = read.type;
      return { chunked: head };
    },

    async 'storage.get.chunk'(a) {
      const read = reads.get(a.readId);
      const index = Number(a.index);
      if (!read || !Number.isInteger(index) || index < 0 || index >= read.count) throw fail('bad_request', 'No such piece to read.');
      read.expires = now() + PENDING_MS;
      if (index === read.count - 1) dropRead(a.readId);
      const { value } = read;
      if (read.cuts) return value.slice(read.cuts[index][0], read.cuts[index][1]);
      const from = index * chunkBytes;
      const to = Math.min(read.size, from + chunkBytes);
      if (read.kind === 'blob') return value.slice(from, to).arrayBuffer();
      const buf = isArrayBuffer(value) ? value : value.buffer;
      const off = isArrayBuffer(value) ? 0 : value.byteOffset;
      return buf.slice(off + from, off + to);
    },

    'storage.set'(a) {
      return setValue(needKey(a), a.value);
    },

    'storage.put.begin'(a) {
      const key = needKey(a);
      const size = Number(a.size);
      if (!['string', 'bytes', 'blob'].includes(a.kind) || !Number.isSafeInteger(size) || size < 0) throw fail('bad_request', 'A chunked upload needs a kind and a size.');
      for (const [id, u] of uploads) if (u.key === key) uploads.delete(id);
      let pendingBytes = size;
      for (const u of uploads.values()) pendingBytes += u.size;
      if (size > quotaBytes || pendingBytes > quotaBytes) throw fail('quota_exceeded', 'This addition has used all of its storage space.');
      const id = `u${++seq}`;
      uploads.set(id, {
        key, kind: a.kind, size, parts: [], received: 0, expires: now() + PENDING_MS,
        type: typeof a.type === 'string' ? a.type.slice(0, 200) : '',
        view: Object.hasOwn(VIEWS, a.view) ? a.view : null,
      });
      return { uploadId: id };
    },

    'storage.put.chunk'(a) {
      const u = uploads.get(a.uploadId);
      if (!u) throw fail('bad_request', 'That upload has expired or never began.');
      if (Number(a.index) !== u.parts.length) throw fail('bad_request', `Expected piece ${u.parts.length}.`);
      const text = u.kind === 'string';
      if (text ? typeof a.data !== 'string' : !(isArrayBuffer(a.data) || ArrayBuffer.isView(a.data))) throw fail('bad_request', 'That piece is the wrong type.');
      const n = text ? utf8Length(a.data) : a.data.byteLength;
      if (u.received + n > u.size) throw fail('too_large', 'The upload is larger than it said it would be.');
      u.parts.push(a.data);
      u.received += n;
      u.expires = now() + PENDING_MS;
      return true;
    },

    async 'storage.put.commit'(a) {
      const u = uploads.get(a.uploadId);
      if (!u) throw fail('bad_request', 'That upload has expired or never began.');
      uploads.delete(a.uploadId);
      if (Number(a.count) !== u.parts.length || u.received !== u.size) throw fail('bad_request', 'The upload is missing pieces.');
      let value;
      if (u.kind === 'string') value = u.parts.join('');
      else if (u.kind === 'blob') value = new Blob(u.parts, { type: u.type });
      else {
        const out = new Uint8Array(u.size);
        let at = 0;
        for (const p of u.parts) {
          const bytes = isArrayBuffer(p) ? new Uint8Array(p) : new Uint8Array(p.buffer, p.byteOffset, p.byteLength);
          out.set(bytes, at);
          at += bytes.byteLength;
        }
        value = u.view && u.view !== 'Uint8Array' ? new VIEWS[u.view](out.buffer) : u.view ? out : out.buffer;
      }
      return setValue(u.key, value);
    },

    async 'storage.remove'(a) {
      await data.remove(appId, needKey(a));
      return true;
    },
    'storage.keys'() { return data.keys(appId); },
    'storage.usage'() { return data.usage(appId); },

    'ui.setTitle'(a) {
      ui.setTitle(cleanTitle(a.text));
      return true;
    },
    'ui.close'() {
      ui.close();
      return true;
    },
  };
  for (const [m, g] of Object.entries(GUARDED)) {
    METHODS[m] = (a) => {
      if (!granted.has(g.permission)) throw fail('permission_denied', `This addition hasn't been allowed to ${g.what}.`);
      const service = services[g.service];
      if (typeof service !== 'function') throw fail('not_available', `This version of Sovereign can't ${g.what} for additions yet.`);
      return service(a, { appId, addition });
    };
  }

  async function onEvent(msg) {
    if (msg.t === 'ls.batch' && Array.isArray(msg.ops)) {
      if (!takeEvent()) return;
      let bytes;
      try { bytes = measure(msg.ops, maxEventBytes); } catch { return; }
      if (msg.ops.length > maxEventOps || bytes > maxEventBytes) {
        console.warn(`[additions] ${appId}: an oversized localStorage batch was refused`);
        return;
      }
      try {
        await data.writeLocalStorage(appId, msg.ops, { quotaBytes });
      } catch (err) {
        console.warn(`[additions] ${appId}: localStorage write refused (${err?.code || err?.message || err})`);
      }
    } else if (msg.t === 'blocked') {
      const origin = cleanNetworkOrigin(originOf(String(msg.uri || '')) || '');
      if (origin && !reported.has(origin) && reported.size < maxBlocked) {
        reported.add(origin);
        try { onBlocked(origin); } catch { /* the window may be gone */ }
      }
    }
  }

  return {
    async handle(msg) {
      sweep();
      if (!msg || typeof msg !== 'object') return null;
      if (typeof msg.id !== 'number') {
        await onEvent(msg);
        return null;
      }
      const { id } = msg;
      const reply = (code, message, extra) => ({ id, ok: false, e: { code, message, ...extra } });
      const wait = take();
      if (wait) return reply('rate_limited', 'Too many requests; waiting.', { retryAfterMs: wait });
      let size;
      try { size = measure(msg.a, maxMessage); } catch (err) { return reply('bad_request', String(err?.message || err)); }
      if (size > maxMessage) return reply('too_large', 'That message is larger than 16 MB; send it in pieces.');
      if (typeof msg.m !== 'string' || !Object.hasOwn(METHODS, msg.m)) return reply('unknown_method', `novaura has no method ${String(msg.m)}.`);
      try {
        const v = await METHODS[msg.m](msg.a && typeof msg.a === 'object' ? msg.a : {});
        return { id, ok: true, v };
      } catch (err) {
        return reply(CODES.has(err?.code) ? err.code : 'internal', String(err?.message || err), err?.retryAfterMs ? { retryAfterMs: err.retryAfterMs } : undefined);
      }
    },
  };
}
