// fullStackRuntime.js — Zero-config managed full-stack runtime (@cybeni/backend + window.novaura)
// plus production Node.js + SQLite/JSON full-stack export bundle & .novapp manifest builder.

/**
 * Virtual ES module injected into every Cybeni preview as `@cybeni/backend` and `@novaura/sdk`,
 * and also mounted globally as `window.novaura` and `window.cybeniBackend`.
 *
 * Completely self-contained (zero imports, safe even inside opaque-origin srcdoc sandboxes).
 */
export const CYBENI_BACKEND_MODULE_SOURCE = `
// Every Cybeni app is served from the same origin, so each one keeps its data under its own
// name (window.__cybeniAppId, set by the preview builder). Without a name (a standalone
// export on its own origin) the keys have no prefix.
const APP_NS = (typeof window !== 'undefined' && typeof window.__cybeniAppId === 'string' && window.__cybeniAppId)
  ? window.__cybeniAppId + ':'
  : '';
const DB_PREFIX = '__cybeni_db__:' + APP_NS;
const KV_PREFIX = '__cybeni_kv__:' + APP_NS;
const USERS_KEY = '__cybeni_auth_users__' + (APP_NS ? ':' + APP_NS : '');
const SESSION_KEY = '__cybeni_auth_session__' + (APP_NS ? ':' + APP_NS : '');
const FILES_KEY = '__cybeni_files__';

const memStorage = new Map();
function canUseLocalStorage() {
  try {
    const k = '__cybeni_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
const hasLocalStorage = typeof window !== 'undefined' && canUseLocalStorage();

function rawGet(key) {
  if (hasLocalStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch { /* fall through to memory */ }
  }
  return memStorage.has(key) ? memStorage.get(key) : null;
}

function rawSet(key, value) {
  if (hasLocalStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch { /* quota / security fallback */ }
  }
  memStorage.set(key, String(value));
}

function rawRemove(key) {
  if (hasLocalStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch { /* ignore */ }
  }
  memStorage.delete(key);
}

function rawKeys() {
  const keys = new Set(memStorage.keys());
  if (hasLocalStorage) {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) keys.add(k);
      }
    } catch { /* ignore */ }
  }
  return Array.from(keys);
}

function clone(val) {
  try {
    return val === undefined ? undefined : JSON.parse(JSON.stringify(val));
  } catch {
    return val;
  }
}

function genId(prefix = 'id') {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return prefix + '_' + crypto.randomUUID().slice(0, 12);
    }
  } catch { /* ignore */ }
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── Passwords ────────────────────────────────────────────────────────────────
// Stored as PBKDF2-HMAC-SHA256. Plain JavaScript and synchronous, so auth.signUp and
// auth.signIn keep returning their result directly (apps rely on that). Accounts saved by
// earlier builds with a 64-bit hash still sign in and are moved over when they do.
// (No backslashes in this module: it lives inside a template string.)

const PBKDF2_ROUNDS = 20000;
const PBKDF2_TAG = 'pbkdf2-sha256';
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const SHA_W = new Uint32Array(64);

function sha256(bytes) {
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
  view.setUint32(padded.length - 4, (len << 3) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = SHA_W;
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = W[i - 15];
      const y = W[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K256[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, H[i]);
  return out;
}

function toHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

function pbkdf2Sha256(password, salt, rounds) {
  const enc = new TextEncoder();
  let key = enc.encode(String(password));
  if (key.length > 64) key = sha256(key);
  const inner = new Uint8Array(64 + 32);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    const k = key[i] || 0;
    inner[i] = k ^ 0x36;
    outer[i] = k ^ 0x5c;
  }
  const hmac = (msg) => {
    let first;
    if (msg.length === 32) {
      inner.set(msg, 64);
      first = sha256(inner);
    } else {
      const buf = new Uint8Array(64 + msg.length);
      buf.set(inner.subarray(0, 64));
      buf.set(msg, 64);
      first = sha256(buf);
    }
    outer.set(first, 64);
    return sha256(outer);
  };
  const saltBytes = enc.encode(String(salt));
  const block = new Uint8Array(saltBytes.length + 4);
  block.set(saltBytes);
  block[block.length - 1] = 1;
  let u = hmac(block);
  const out = u.slice();
  for (let r = 1; r < rounds; r++) {
    u = hmac(u);
    for (let i = 0; i < 32; i++) out[i] ^= u[i];
  }
  return toHex(out);
}

function newSalt() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      return toHex(crypto.getRandomValues(new Uint8Array(16)));
    }
  } catch { /* fall through */ }
  let s = '';
  while (s.length < 32) s += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return s.slice(0, 32);
}

function hashPassword(password, salt) {
  return PBKDF2_TAG + '$' + PBKDF2_ROUNDS + '$' + pbkdf2Sha256(password, salt, PBKDF2_ROUNDS);
}

function sameText(x, y) {
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// 'ok', 'legacy' (right password, old hash: rehash it) or false.
function checkPassword(user, password) {
  const stored = String(user?.passwordHash || '');
  const parts = stored.split('$');
  if (parts[0] === PBKDF2_TAG) {
    const rounds = Number(parts[1]);
    if (parts.length !== 3 || !Number.isInteger(rounds) || rounds < 1 || rounds > 5000000 || parts[2].length !== 64) return false;
    return sameText(parts[2], pbkdf2Sha256(password, user.salt, rounds)) ? 'ok' : false;
  }
  return sameText(stored, legacyHash(password, user.salt)) ? 'legacy' : false;
}

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

function postParent(payload) {
  try {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ __cybeni: true, ...payload }, '*');
    }
  } catch { /* ignore cross-origin restrictions */ }
}

// ── Collections / Relational-style Table Store ──────────────────────────────

const tableListeners = new Map();
const authListeners = new Set();

function readTable(name) {
  const raw = rawGet(DB_PREFIX + name);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTable(name, rows) {
  rawSet(DB_PREFIX + name, JSON.stringify(Array.isArray(rows) ? rows : []));
  notifyTable(name);
  syncParent();
}

function matchesFilter(row, filter) {
  if (!filter) return true;
  if (typeof filter === 'function') return Boolean(filter(clone(row)));
  if (typeof filter === 'object') {
    for (const [k, v] of Object.entries(filter)) {
      if (row?.[k] !== v) return false;
    }
    return true;
  }
  return true;
}

function notifyTable(name) {
  const listeners = tableListeners.get(name);
  if (!listeners || !listeners.size) return;
  const rows = clone(readTable(name));
  for (const fn of listeners) {
    try { fn(rows); } catch { /* listener error isolated */ }
  }
}

function readUsers() {
  const raw = rawGet(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function publicUser(u) {
  if (!u || typeof u !== 'object') return null;
  const { passwordHash: _h, salt: _s, ...pub } = u;
  return clone(pub);
}

function syncParent() {
  postParent({
    type: 'db-sync',
    tables: db.dump(),
    users: auth.listUsers(),
    currentUser: auth.currentUser(),
  });
}

function collection(rawName) {
  const name = String(rawName || 'items').trim() || 'items';
  const api = {
    name,
    list(filter) {
      return clone(readTable(name).filter((row) => matchesFilter(row, filter)));
    },
    get(id) {
      const target = String(id);
      const found = readTable(name).find((r) => String(r?.id) === target);
      return found ? clone(found) : null;
    },
    insert(record) {
      const rows = readTable(name);
      const now = new Date().toISOString();
      const base = record && typeof record === 'object' ? clone(record) : { value: record };
      const row = {
        ...base,
        id: base.id != null && String(base.id).trim() ? String(base.id) : genId('row'),
        createdAt: base.createdAt || now,
        updatedAt: now,
      };
      rows.push(row);
      writeTable(name, rows);
      return clone(row);
    },
    update(id, patch) {
      const target = String(id);
      const rows = readTable(name);
      const idx = rows.findIndex((r) => String(r?.id) === target);
      if (idx === -1) return null;
      const now = new Date().toISOString();
      const next = {
        ...rows[idx],
        ...(patch && typeof patch === 'object' ? clone(patch) : {}),
        id: rows[idx].id,
        updatedAt: now,
      };
      rows[idx] = next;
      writeTable(name, rows);
      return clone(next);
    },
    upsert(record) {
      if (record && record.id != null && api.get(record.id)) {
        return api.update(record.id, record);
      }
      return api.insert(record);
    },
    remove(id) {
      const target = String(id);
      const rows = readTable(name);
      const next = rows.filter((r) => String(r?.id) !== target);
      if (next.length === rows.length) return false;
      writeTable(name, next);
      return true;
    },
    delete(id) {
      return api.remove(id);
    },
    clear() {
      writeTable(name, []);
    },
    count(filter) {
      return api.list(filter).length;
    },
    seed(records) {
      if (!Array.isArray(records) || readTable(name).length > 0) {
        return api.list();
      }
      const now = new Date().toISOString();
      const rows = records.map((rec) => {
        const base = rec && typeof rec === 'object' ? clone(rec) : { value: rec };
        return {
          ...base,
          id: base.id != null && String(base.id).trim() ? String(base.id) : genId('row'),
          createdAt: base.createdAt || now,
          updatedAt: now,
        };
      });
      writeTable(name, rows);
      return clone(rows);
    },
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      if (!tableListeners.has(name)) tableListeners.set(name, new Set());
      tableListeners.get(name).add(fn);
      try { fn(api.list()); } catch { /* isolate initial callback */ }
      return () => {
        tableListeners.get(name)?.delete(fn);
      };
    },
  };
  return api;
}

export const db = {
  collection,
  table: collection,
  tables() {
    const names = new Set();
    for (const k of rawKeys()) {
      if (k.startsWith(DB_PREFIX)) names.add(k.slice(DB_PREFIX.length));
    }
    return Array.from(names).sort();
  },
  dump() {
    const out = {};
    for (const name of db.tables()) {
      out[name] = clone(readTable(name));
    }
    return out;
  },
  restore(snapshot, { replace = false } = {}) {
    if (!snapshot || typeof snapshot !== 'object') return;
    if (replace) {
      for (const name of db.tables()) {
        if (!(name in snapshot)) {
          rawRemove(DB_PREFIX + name);
          notifyTable(name);
        }
      }
    }
    for (const [name, rows] of Object.entries(snapshot)) {
      if (!Array.isArray(rows)) continue;
      rawSet(DB_PREFIX + name, JSON.stringify(rows));
      notifyTable(name);
    }
    syncParent();
  },
};

// ── Zero-Config Auth & RBAC ──────────────────────────────────────────────────

function notifyAuth() {
  const user = auth.currentUser();
  for (const fn of authListeners) {
    try { fn(user); } catch { /* isolate listener */ }
  }
  syncParent();
}

export const auth = {
  currentUser() {
    const sid = rawGet(SESSION_KEY);
    if (!sid) return null;
    const found = readUsers().find((u) => u.id === sid);
    return publicUser(found);
  },
  listUsers() {
    return readUsers().map(publicUser);
  },
  signUp({ email, password, name, role } = {}) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { user: null, error: 'Please enter a valid email address.' };
    }
    if (!password || String(password).length < 4) {
      return { user: null, error: 'Password must be at least 4 characters.' };
    }
    const users = readUsers();
    if (users.some((u) => u.email === cleanEmail)) {
      return { user: null, error: 'An account with this email already exists.' };
    }
    const salt = newSalt();
    const user = {
      id: genId('usr'),
      email: cleanEmail,
      name: String(name || cleanEmail.split('@')[0]).trim().slice(0, 80),
      role: role ? String(role).trim().toLowerCase() : (users.length === 0 ? 'admin' : 'member'),
      salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    rawSet(USERS_KEY, JSON.stringify(users));
    rawSet(SESSION_KEY, user.id);
    notifyAuth();
    return { user: publicUser(user), error: null };
  },
  signIn({ email, password } = {}) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const users = readUsers();
    const found = users.find((u) => u.email === cleanEmail);
    const verdict = found ? checkPassword(found, password || '') : false;
    if (!verdict) {
      return { user: null, error: 'Invalid email or password.' };
    }
    if (verdict === 'legacy') {
      found.salt = newSalt();
      found.passwordHash = hashPassword(password || '', found.salt);
      rawSet(USERS_KEY, JSON.stringify(users));
    }
    rawSet(SESSION_KEY, found.id);
    notifyAuth();
    return { user: publicUser(found), error: null };
  },
  demoSignIn(role = 'admin') {
    const users = readUsers();
    let user = users.find((u) => u.role === role) || users[0];
    if (!user) {
      const created = auth.signUp({
        email: role === 'admin' ? 'admin@cybeni.local' : 'user@cybeni.local',
        password: 'demo-password',
        name: role === 'admin' ? 'Demo Admin' : 'Demo Member',
        role,
      });
      return created;
    }
    rawSet(SESSION_KEY, user.id);
    notifyAuth();
    return { user: publicUser(user), error: null };
  },
  signOut() {
    rawRemove(SESSION_KEY);
    notifyAuth();
  },
  hasRole(role) {
    const u = auth.currentUser();
    return Boolean(u && (u.role === 'admin' || u.role === role));
  },
  onAuthChange(fn) {
    if (typeof fn !== 'function') return () => {};
    authListeners.add(fn);
    try { fn(auth.currentUser()); } catch { /* isolate */ }
    return () => {
      authListeners.delete(fn);
    };
  },
};

// ── Key-Value & App File Storage ─────────────────────────────────────────────

export const storage = {
  get(key, fallback = null) {
    const raw = rawGet(KV_PREFIX + String(key));
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch { return raw; }
  },
  set(key, value) {
    rawSet(KV_PREFIX + String(key), JSON.stringify(value));
    return value;
  },
  remove(key) {
    rawRemove(KV_PREFIX + String(key));
  },
  keys() {
    return rawKeys().filter((k) => k.startsWith(KV_PREFIX)).map((k) => k.slice(KV_PREFIX.length));
  },
  clear() {
    for (const k of storage.keys()) rawRemove(KV_PREFIX + k);
  },
};

export const files = {
  save({ name, type = 'application/octet-stream', dataUrl }) {
    const list = storage.get(FILES_KEY, []);
    const entry = {
      id: genId('file'),
      name: String(name || 'untitled'),
      type,
      dataUrl: String(dataUrl || ''),
      createdAt: new Date().toISOString(),
    };
    list.push(entry);
    storage.set(FILES_KEY, list);
    return clone(entry);
  },
  list() {
    return clone(storage.get(FILES_KEY, []));
  },
  remove(id) {
    const list = storage.get(FILES_KEY, []);
    storage.set(FILES_KEY, list.filter((f) => f.id !== id));
  },
};

// ── Parent AI Chat Bridge ────────────────────────────────────────────────────

const pendingAi = new Map();

export const ai = {
  chat(messagesOrPrompt, opts = {}) {
    const messages = Array.isArray(messagesOrPrompt)
      ? messagesOrPrompt
      : [{ role: 'user', content: String(messagesOrPrompt || '') }];

    if (typeof window === 'undefined' || !window.parent || window.parent === window) {
      return Promise.reject(new Error('AI bridge requires Cybeni or Sovereign OS host runtime.'));
    }

    const requestId = genId('ai');
    const onToken = typeof opts.onToken === 'function' ? opts.onToken : null;
    // Counted from the last sign of life, so a long streamed reply is not cut off;
    // a big local model can also take a while to load before the first piece.
    const waitMs = Math.min(600000, Number(opts.timeoutMs) || 120000);
    return new Promise((resolve, reject) => {
      let timer = null;
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          pendingAi.delete(requestId);
          reject(new Error('AI request timed out waiting for host response.'));
        }, waitMs);
      };
      arm();

      pendingAi.set(requestId, {
        resolve: (text) => { clearTimeout(timer); resolve(text); },
        reject: (err) => { clearTimeout(timer); reject(err); },
        piece: (text) => {
          arm();
          if (onToken) {
            try { onToken(text); } catch { /* the app's callback failed; the reply still arrives */ }
          }
        },
      });

      postParent({
        type: 'ai-request',
        requestId,
        messages: clone(messages),
        opts: {
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          system: opts.system,
          stream: Boolean(onToken),
        },
      });
    });
  },
};

export const novaura = {
  version: '1.0',
  db,
  auth,
  storage,
  files,
  ai,
};

if (typeof window !== 'undefined') {
  window.novaura = novaura;
  window.cybeniBackend = novaura;

  window.addEventListener('message', (e) => {
    // Only the OS window that hosts this app may answer AI requests or manage its data;
    // a frame the app embeds (or a window it opened) may not.
    if (!e || e.source !== window.parent || window.parent === window) return;
    const d = e.data;
    if (!d || typeof d !== 'object') return;

    if (d.__cybeniAiChunk && d.requestId && pendingAi.has(d.requestId)) {
      pendingAi.get(d.requestId).piece(String(d.text ?? ''));
      return;
    }

    if (d.__cybeniAiReply && d.requestId && pendingAi.has(d.requestId)) {
      const waiter = pendingAi.get(d.requestId);
      pendingAi.delete(d.requestId);
      if (d.error) waiter.reject(new Error(String(d.error)));
      else waiter.resolve(String(d.text ?? ''));
      return;
    }

    if (!d.__cybeniDbAdmin) return;
    if (d.action === 'request-sync') {
      syncParent();
    } else if (d.action === 'insert' && d.table && d.record) {
      db.collection(d.table).insert(d.record);
    } else if (d.action === 'update' && d.table && d.id != null) {
      db.collection(d.table).update(d.id, d.patch || {});
    } else if (d.action === 'remove' && d.table && d.id != null) {
      db.collection(d.table).remove(d.id);
    } else if (d.action === 'clear' && d.table) {
      db.collection(d.table).clear();
    } else if (d.action === 'restore' && d.snapshot) {
      db.restore(d.snapshot, { replace: Boolean(d.replace) });
    } else if (d.action === 'signout') {
      auth.signOut();
    }
  });

  // Initial telemetry sync after frame listeners settle.
  setTimeout(syncParent, 50);
}

export default novaura;
`;

/**
 * Generate a `.novapp` manifest JSON object aligned with Sovereign OS's app bundle spec.
 */
export function buildNovappManifest(projectName, slug, files = []) {
  const fileList = Array.isArray(files) ? files : [];
  const hasIndexHtml = fileList.some((f) => String(f?.path || '').toLowerCase() === 'index.html');
  const cleanSlug = String(slug || 'cybeni-app').trim() || 'cybeni-app';
  const cleanName = String(projectName || cleanSlug).trim().slice(0, 60) || 'Cybeni App';
  return {
    format: 'novapp-v1',
    id: cleanSlug,
    name: cleanName,
    version: '1.0.0',
    entry: hasIndexHtml ? 'index.html' : 'src/App.jsx',
    runtime: '@cybeni/backend',
    permissions: ['storage.kv', 'ai.chat'],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate production full-stack Node.js + SQLite (with JSON persistence fallback)
 * REST server, Dockerfile, package.json, and deployment instructions for exporting
 * a Cybeni project as an independently deployable full-stack bundle.
 */
export function generateFullStackServerFiles(projectName, existingFiles = []) {
  const fileList = Array.isArray(existingFiles) ? existingFiles : [];
  const cleanName = String(projectName || 'cybeni-app').trim() || 'cybeni-app';
  const pkgSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cybeni-app';

  const existingPkgFile = fileList.find((f) => f.path === 'package.json');
  let pkgObj = {
    name: pkgSlug,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      start: 'node server/server.mjs',
      dev: 'node server/server.mjs',
    },
    engines: {
      node: '>=20.0.0',
    },
  };
  if (existingPkgFile) {
    try {
      const parsed = JSON.parse(existingPkgFile.content);
      pkgObj = {
        ...parsed,
        type: parsed.type || 'module',
        scripts: { ...(parsed.scripts || {}), start: 'node server/server.mjs' },
        engines: { node: '>=20.0.0', ...(parsed.engines || {}) },
      };
    } catch { /* ignore invalid existing package.json */ }
  }

  const serverMjs = `// server/server.mjs — Full-stack production Node.js server for "${cleanName}"
// Zero required npm dependencies. Uses built-in node:sqlite on Node 22+ with automatic JSON disk fallback.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const PORT = Number(process.env.PORT || 8080);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(24).toString('hex');

fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Storage Adapter (node:sqlite with JSON fallback) ─────────────────────────

async function createStore() {
  try {
    const sqlite = await import('node:sqlite');
    const dbPath = path.join(DATA_DIR, 'app.sqlite');
    const db = new sqlite.DatabaseSync(dbPath);
    db.exec(\`
      CREATE TABLE IF NOT EXISTS collections (
        table_name TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (table_name, id)
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    \`);
    return {
      mode: 'sqlite',
      list(table) {
        const stmt = db.prepare('SELECT data FROM collections WHERE table_name = ? ORDER BY updated_at ASC');
        return stmt.all(table).map((r) => JSON.parse(r.data));
      },
      insert(table, row) {
        const now = new Date().toISOString();
        const item = { ...row, id: String(row.id || crypto.randomUUID()), createdAt: row.createdAt || now, updatedAt: now };
        db.prepare('INSERT OR REPLACE INTO collections (table_name, id, data, updated_at) VALUES (?, ?, ?, ?)')
          .run(table, item.id, JSON.stringify(item), now);
        return item;
      },
      update(table, id, patch) {
        const found = db.prepare('SELECT data FROM collections WHERE table_name = ? AND id = ?').get(table, String(id));
        if (!found) return null;
        const now = new Date().toISOString();
        const item = { ...JSON.parse(found.data), ...patch, id: String(id), updatedAt: now };
        db.prepare('UPDATE collections SET data = ?, updated_at = ? WHERE table_name = ? AND id = ?')
          .run(JSON.stringify(item), now, table, String(id));
        return item;
      },
      remove(table, id) {
        const res = db.prepare('DELETE FROM collections WHERE table_name = ? AND id = ?').run(table, String(id));
        return res.changes > 0;
      },
      findUserByEmail(email) {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase()) || null;
      },
      findUserById(id) {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(String(id)) || null;
      },
      countUsers() {
        return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      },
      createUser(user) {
        db.prepare('INSERT INTO users (id, email, name, role, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(user.id, user.email, user.name, user.role, user.salt, user.password_hash, user.created_at);
        return user;
      },
    };
  } catch {
    const jsonPath = path.join(DATA_DIR, 'db.json');
    const load = () => {
      if (!fs.existsSync(jsonPath)) return { collections: {}, users: [] };
      try { return JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch { return { collections: {}, users: [] }; }
    };
    const save = (state) => fs.writeFileSync(jsonPath, JSON.stringify(state, null, 2), 'utf8');
    return {
      mode: 'json-file',
      list(table) {
        const state = load();
        return state.collections[table] || [];
      },
      insert(table, row) {
        const state = load();
        const now = new Date().toISOString();
        const item = { ...row, id: String(row.id || crypto.randomUUID()), createdAt: row.createdAt || now, updatedAt: now };
        if (!Array.isArray(state.collections[table])) state.collections[table] = [];
        state.collections[table].push(item);
        save(state);
        return item;
      },
      update(table, id, patch) {
        const state = load();
        const rows = state.collections[table] || [];
        const idx = rows.findIndex((r) => String(r.id) === String(id));
        if (idx === -1) return null;
        rows[idx] = { ...rows[idx], ...patch, id: rows[idx].id, updatedAt: new Date().toISOString() };
        save(state);
        return rows[idx];
      },
      remove(table, id) {
        const state = load();
        const rows = state.collections[table] || [];
        const next = rows.filter((r) => String(r.id) !== String(id));
        state.collections[table] = next;
        save(state);
        return next.length !== rows.length;
      },
      findUserByEmail(email) {
        return load().users.find((u) => u.email === String(email).toLowerCase()) || null;
      },
      findUserById(id) {
        return load().users.find((u) => u.id === String(id)) || null;
      },
      countUsers() {
        return load().users.length;
      },
      createUser(user) {
        const state = load();
        state.users.push(user);
        save(state);
        return user;
      },
    };
  }
}

const store = await createStore();

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 32).toString('hex');
}

function signToken(userId) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 2 * 1024 * 1024) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function currentUserFromReq(req) {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieHeader = req.headers.cookie || '';
  const match = /(?:^|;\\s*)cybeni_session=([^;]+)/.exec(cookieHeader);
  const uid = verifyToken(bearer || match?.[1]);
  if (!uid) return null;
  const user = store.findUserById(uid);
  if (!user) return null;
  const { password_hash: _p, salt: _s, ...pub } = user;
  return pub;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, storage: store.mode, app: ${JSON.stringify(cleanName)} });
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      return sendJson(res, 200, { user: currentUserFromReq(req) });
    }

    if (pathname === '/api/auth/signup' && req.method === 'POST') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email.includes('@') || password.length < 4) {
        return sendJson(res, 400, { error: 'Valid email and 4+ char password required.' });
      }
      if (store.findUserByEmail(email)) {
        return sendJson(res, 409, { error: 'Account already exists.' });
      }
      const salt = crypto.randomBytes(16).toString('hex');
      const role = store.countUsers() === 0 ? 'admin' : 'member';
      const user = store.createUser({
        id: 'usr_' + crypto.randomUUID().slice(0, 12),
        email,
        name: String(body.name || email.split('@')[0]).slice(0, 80),
        role,
        salt,
        password_hash: hashPassword(password, salt),
        created_at: new Date().toISOString(),
      });
      const token = signToken(user.id);
      const { password_hash: _p, salt: _s, ...pub } = user;
      return sendJson(res, 201, { user: pub, token }, {
        'set-cookie': 'cybeni_session=' + token + '; HttpOnly; Path=/; SameSite=Lax',
      });
    }

    if (pathname === '/api/auth/signin' && req.method === 'POST') {
      const body = await readBody(req);
      const user = store.findUserByEmail(body.email || '');
      if (!user || user.password_hash !== hashPassword(body.password || '', user.salt)) {
        return sendJson(res, 401, { error: 'Invalid credentials.' });
      }
      const token = signToken(user.id);
      const { password_hash: _p, salt: _s, ...pub } = user;
      return sendJson(res, 200, { user: pub, token }, {
        'set-cookie': 'cybeni_session=' + token + '; HttpOnly; Path=/; SameSite=Lax',
      });
    }

    if (pathname === '/api/auth/signout' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true }, {
        'set-cookie': 'cybeni_session=; HttpOnly; Path=/; Max-Age=0',
      });
    }

    const dbMatch = /^\\/api\\/db\\/([a-zA-Z0-9_-]+)(?:\\/([a-zA-Z0-9_.-]+))?$/.exec(pathname);
    if (dbMatch) {
      const table = dbMatch[1];
      const id = dbMatch[2];
      if (req.method === 'GET' && !id) {
        return sendJson(res, 200, { rows: store.list(table) });
      }
      if (req.method === 'POST' && !id) {
        const body = await readBody(req);
        return sendJson(res, 201, { row: store.insert(table, body) });
      }
      if ((req.method === 'PATCH' || req.method === 'PUT') && id) {
        const body = await readBody(req);
        const updated = store.update(table, id, body);
        return updated ? sendJson(res, 200, { row: updated }) : sendJson(res, 404, { error: 'Not found' });
      }
      if (req.method === 'DELETE' && id) {
        const removed = store.remove(table, id);
        return removed ? sendJson(res, 200, { deleted: true }) : sendJson(res, 404, { error: 'Not found' });
      }
    }

    // Static app hosting with traversal guard
    const rel = pathname === '/' ? 'standalone.html' : pathname.replace(/^\\/+/, '');
    let candidate = path.resolve(ROOT_DIR, rel);
    if (!candidate.startsWith(ROOT_DIR + path.sep) && candidate !== path.join(ROOT_DIR, 'standalone.html')) {
      return sendJson(res, 403, { error: 'Forbidden' });
    }
    if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
      candidate = fs.existsSync(path.join(ROOT_DIR, 'standalone.html'))
        ? path.join(ROOT_DIR, 'standalone.html')
        : path.join(ROOT_DIR, 'index.html');
    }
    if (!fs.existsSync(candidate)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(candidate).pipe(res);
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[Cybeni Full-Stack] Serving "${cleanName}" on http://0.0.0.0:' + PORT + ' (' + store.mode + ')');
});
`;

  const dockerfile = `FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/server.mjs"]
`;

  const readme = `# ${cleanName} — Full-Stack Server Bundle

Generated by Cybeni Builder (Sovereign OS).

## Run locally (Node.js 20+)
\`\`\`bash
npm start
# Opens REST API + App at http://localhost:8080
\`\`\`

- Database persistence automatically uses built-in SQLite (\`server/data/app.sqlite\` on Node 22+) or disk JSON (\`server/data/db.json\` on Node 20).
- Auth endpoints: \`POST /api/auth/signup\`, \`POST /api/auth/signin\`, \`POST /api/auth/signout\`, \`GET /api/auth/me\`
- Table REST endpoints: \`GET|POST /api/db/:table\`, \`PATCH|DELETE /api/db/:table/:id\`

## Deploy with Docker / Cloud Run
\`\`\`bash
docker build -t ${pkgSlug} .
docker run -p 8080:8080 ${pkgSlug}
\`\`\`
`;

  return [
    { path: 'server/server.mjs', content: serverMjs },
    { path: 'package.json', content: `${JSON.stringify(pkgObj, null, 2)}\n` },
    { path: 'Dockerfile', content: dockerfile },
    { path: 'README.fullstack.md', content: readme },
  ];
}

