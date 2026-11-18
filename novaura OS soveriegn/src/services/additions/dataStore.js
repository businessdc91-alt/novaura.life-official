// dataStore.js — Each addition's saved data, kept by the OS in the `addition_data`
// table (primary key [appId+key]). An addition runs on an opaque origin with no
// browser storage of its own, so everything it saves comes through here:
//   ls:<key>  its localStorage replacement (strings, at most 64 MB in all)
//   s:<key>   novaura.storage values (anything structured-cloneable)
// Rows are { appId, key, value, size, updatedAt }. Usage per addition is worked out
// from the rows once per session and then kept up to date, so a write never has to
// read the addition's other data.

import { db } from '../../database/sovereignDatabase.js';
import { DEFAULT_QUOTA_BYTES, LOCAL_STORAGE_LIMIT_BYTES } from './limits.js';
import { sizeOf } from './size.js';

export { sizeOf };

const LS = 'ls:';
const ST = 's:';
// ';' sorts right after ':', so [appId, 'ls:'] up to [appId, 'ls;'] is every ls: key.
const range = (appId, prefix) => [[appId, prefix], [appId, prefix.slice(0, -1) + ';']];

function quotaError(message) {
  const err = new Error(message);
  err.code = 'quota_exceeded';
  return err;
}

export function createAdditionData(table) {
  const usageCache = new Map(); // appId -> Promise<{ total, ls, sizes: Map<rowKey, bytes> }>
  const queues = new Map(); // appId -> tail of that addition's write queue

  function cacheFor(appId) {
    let pending = usageCache.get(appId);
    if (!pending) {
      pending = (async () => {
        const c = { total: 0, ls: 0, sizes: new Map() };
        await table.where('appId').equals(appId).each((row) => {
          const size = Number(row.size) || 0;
          c.sizes.set(row.key, size);
          c.total += size;
          if (row.key.startsWith(LS)) c.ls += size;
        });
        return c;
      })();
      usageCache.set(appId, pending);
      pending.catch(() => usageCache.delete(appId));
    }
    return pending;
  }

  // Writes to one addition run one at a time, so two of them can't both pass the quota check.
  function serial(appId, fn) {
    const run = (queues.get(appId) || Promise.resolve()).then(fn, fn);
    queues.set(appId, run.catch(() => {}));
    return run;
  }

  return {
    /** Waits behind writes already queued, so a relaunch sees what the app saved just before. */
    snapshotLocalStorage(appId) {
      return serial(appId, async () => {
        const [lo, hi] = range(appId, LS);
        const rows = await table.where('[appId+key]').between(lo, hi).toArray();
        const out = {};
        for (const row of rows) out[row.key.slice(LS.length)] = String(row.value);
        return out;
      });
    },

    /** Apply localStorage ops ({ op: 'set'|'remove'|'clear', key?, value? }) in order, all or nothing. */
    writeLocalStorage(appId, ops, { quotaBytes = DEFAULT_QUOTA_BYTES } = {}) {
      return serial(appId, async () => {
        const c = await cacheFor(appId);
        let cleared = false;
        const changes = new Map();
        for (const o of ops || []) {
          if (o?.op === 'clear') { cleared = true; changes.clear(); }
          else if (o?.op === 'set' && typeof o.key === 'string') changes.set(o.key, String(o.value));
          else if (o?.op === 'remove' && typeof o.key === 'string') changes.set(o.key, null);
        }
        const existing = [...c.sizes.keys()].filter((k) => k.startsWith(LS));
        let lsDelta = cleared ? -c.ls : 0;
        const puts = [];
        const dels = [];
        for (const [key, value] of changes) {
          const rowKey = LS + key;
          const old = cleared ? 0 : (c.sizes.get(rowKey) ?? 0);
          if (value == null) {
            if (!cleared && c.sizes.has(rowKey)) dels.push(rowKey);
            lsDelta -= old;
          } else {
            const size = sizeOf(value) + sizeOf(key);
            puts.push({ appId, key: rowKey, value, size, updatedAt: Date.now() });
            lsDelta += size - old;
          }
        }
        if (lsDelta > 0 && c.ls + lsDelta > LOCAL_STORAGE_LIMIT_BYTES) {
          throw quotaError('localStorage is full (64 MB). Use novaura.storage for larger data.');
        }
        if (lsDelta > 0 && c.total + lsDelta > quotaBytes) throw quotaError('This addition has used all of its storage space.');

        if (cleared && existing.length) await table.bulkDelete(existing.map((k) => [appId, k]));
        if (dels.length) await table.bulkDelete(dels.map((k) => [appId, k]));
        if (puts.length) await table.bulkPut(puts);
        if (cleared) for (const k of existing) c.sizes.delete(k);
        for (const k of dels) c.sizes.delete(k);
        for (const row of puts) c.sizes.set(row.key, row.size);
        c.ls += lsDelta;
        c.total += lsDelta;
      });
    },

    async get(appId, key) {
      return (await table.get([appId, ST + key]))?.value;
    },

    /** Rejects with code 'quota_exceeded' (leaving the old value) when it would not fit. */
    set(appId, key, value, { quotaBytes = DEFAULT_QUOTA_BYTES } = {}) {
      return serial(appId, async () => {
        const c = await cacheFor(appId);
        const rowKey = ST + key;
        const size = sizeOf(value) + sizeOf(key);
        const delta = size - (c.sizes.get(rowKey) ?? 0);
        if (delta > 0 && c.total + delta > quotaBytes) throw quotaError('This addition has used all of its storage space.');
        await table.put({ appId, key: rowKey, value, size, updatedAt: Date.now() });
        c.sizes.set(rowKey, size);
        c.total += delta;
      });
    },

    remove(appId, key) {
      return serial(appId, async () => {
        const c = await cacheFor(appId);
        const rowKey = ST + key;
        await table.delete([appId, rowKey]);
        c.total -= c.sizes.get(rowKey) ?? 0;
        c.sizes.delete(rowKey);
      });
    },

    async keys(appId) {
      const [lo, hi] = range(appId, ST);
      const keys = await table.where('[appId+key]').between(lo, hi).primaryKeys();
      return keys.map((k) => k[1].slice(ST.length));
    },

    async usage(appId) {
      return (await cacheFor(appId)).total;
    },

    clearApp(appId) {
      return serial(appId, async () => {
        await table.where('appId').equals(appId).delete();
        usageCache.set(appId, Promise.resolve({ total: 0, ls: 0, sizes: new Map() }));
      });
    },
  };
}

let shared = null;

/** The one store over the OS database's addition_data table. */
export function getAdditionData() {
  if (!shared) shared = createAdditionData(db.addition_data);
  return shared;
}
