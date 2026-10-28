/**
 * NovAura Sovereign OS — kernelStorage
 *
 * User-hosted Private Cloud Storage Layer.
 * Drop-in replacement for localStorage across the entire Sovereign codebase.
 * Routes all reads/writes through the Sovereign Database (private local DB)
 * with an instant in-memory cache and localStorage fallback.
 */

import { db } from '../database/sovereignDatabase.js';

let _memCache = new Map();

// Keys that are device-specific or sensitive
const LOCAL_ONLY_KEYS = new Set([
  'novaura_boot_flag',
  'novaura_first_visit',
  'novaura_sovereign_auth_vault',
]);

function isLocalOnly(key) {
  return LOCAL_ONLY_KEYS.has(key);
}

// ─── Sync localStorage shim ──────────────────────────────────────────────────

function localGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function localSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function localRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ─── Public API ──────────────────────────────────────────────────────────────

const kernelStorage = {
  /**
   * Synchronous get — returns value from memory cache if available,
   * otherwise falls back to localStorage.
   */
  getItem(key) {
    if (_memCache.has(key)) {
      const v = _memCache.get(key);
      return typeof v === 'string' ? v : JSON.stringify(v);
    }
    const val = localGet(key);
    if (val !== null) {
      _memCache.set(key, val);
    }
    return val;
  },

  /**
   * Async get — queries private cloud database, populates memory cache.
   */
  async getItemAsync(key) {
    if (_memCache.has(key)) {
      const v = _memCache.get(key);
      return typeof v === 'string' ? v : JSON.stringify(v);
    }
    try {
      const record = await db.settings.get(key);
      if (record && record.value !== undefined) {
        _memCache.set(key, record.value);
        return typeof record.value === 'string' ? record.value : JSON.stringify(record.value);
      }
    } catch {}
    return localGet(key);
  },

  /**
   * Set — writes to memory cache, mirrors to localStorage,
   * and asynchronously persists to the local private cloud database.
   */
  setItem(key, value) {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    _memCache.set(key, strVal);
    localSet(key, strVal);

    if (!isLocalOnly(key)) {
      let parsed = strVal;
      try { parsed = JSON.parse(strVal); } catch {}
      db.settings.put({ key, value: parsed, updatedAt: Date.now() }).catch(() => {});
    }
  },

  /**
   * Remove from memory cache, local storage, and private cloud database.
   */
  removeItem(key) {
    _memCache.delete(key);
    localRemove(key);
    if (!isLocalOnly(key)) {
      db.settings.delete(key).catch(() => {});
    }
  },

  /**
   * Clear all non-protected keys.
   */
  clear() {
    _memCache.clear();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !isLocalOnly(k)) localStorage.removeItem(k);
      }
    } catch {}
  },

  /**
   * Warm up memory cache from private cloud database
   */
  async warmup() {
    try {
      const allSettings = await db.settings.toArray();
      for (const item of allSettings) {
        _memCache.set(item.key, item.value);
      }
    } catch (e) {
      console.warn('[kernelStorage] Warmup note:', e.message);
    }
  }
};

// Initial warmup
kernelStorage.warmup();

export { kernelStorage };
export default kernelStorage;
