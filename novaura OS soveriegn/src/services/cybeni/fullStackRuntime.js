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

function hashSecret(secret, salt) {
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
    const salt = genId('salt');
    const user = {
      id: genId('usr'),
      email: cleanEmail,
      name: String(name || cleanEmail.split('@')[0]).trim().slice(0, 80),
      role: role ? String(role).trim().toLowerCase() : (users.length === 0 ? 'admin' : 'member'),
      salt,
      passwordHash: hashSecret(password, salt),
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
    if (!found || found.passwordHash !== hashSecret(password || '', found.salt)) {
      return { user: null, error: 'Invalid email or password.' };
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
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingAi.delete(requestId);
        reject(new Error('AI request timed out waiting for host response.'));
      }, Math.min(120000, Number(opts.timeoutMs) || 45000));

      pendingAi.set(requestId, {
        resolve: (text) => { clearTimeout(timer); resolve(text); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });

      postParent({
        type: 'ai-request',
        requestId,
        messages: clone(messages),
        opts: {
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          system: opts.system,
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

