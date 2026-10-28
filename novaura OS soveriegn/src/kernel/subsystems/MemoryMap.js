import { db } from '../../database/sovereignDatabase.js';

/**
 * NovAura Sovereign OS — MemoryMap (Private Cloud Memory)
 * Long-term and short-term OS memory backed by local private cloud database.
 */

class MemoryMap {
  constructor() {
    this._kernel = null;
    this._cache = new Map();
    this._writeQueue = new Map();
    this._DEBOUNCE = 300;
  }

  init(kernel) {
    this._kernel = kernel;
  }

  async onReady() {
    try {
      const records = await db.settings.toArray();
      for (const item of records) {
        if (item.key.startsWith('mem:')) {
          this._cache.set(item.key.slice(4), item.value);
        }
      }
    } catch (e) {
      console.warn('[MemoryMap] Ready notice:', e.message);
    }
  }

  set(key, value, options = {}) {
    const entry = {
      value,
      tags: options.tags || [],
      expiresAt: options.ttl ? Date.now() + options.ttl : null,
      updatedAt: Date.now(),
    };

    this._cache.set(key, entry);
    this._scheduleWrite(key, entry);
    this._kernel.ipc.emit('memory:set', { key, value });
  }

  get(key, fallback = null) {
    const entry = this._cache.get(key);
    if (!entry) return fallback;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      this.forget(key);
      return fallback;
    }
    return entry.value;
  }

  async forget(key) {
    this._cache.delete(key);
    if (this._writeQueue.has(key)) {
      clearTimeout(this._writeQueue.get(key).timer);
      this._writeQueue.delete(key);
    }
    try {
      await db.settings.delete(`mem:${key}`);
      this._kernel.ipc.emit('memory:forget', { key });
    } catch {}
  }

  _scheduleWrite(key, entry) {
    if (this._writeQueue.has(key)) clearTimeout(this._writeQueue.get(key).timer);
    const timer = setTimeout(() => this._flush(key, entry), this._DEBOUNCE);
    this._writeQueue.set(key, { entry, timer });
  }

  async _flush(key, entry) {
    this._writeQueue.delete(key);
    try {
      await db.settings.put({
        key: `mem:${key}`,
        value: entry,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[MemoryMap] Flush error:', e.message);
    }
  }

  snapshotWorkspace() {
    if (!this._kernel?.wm) return;
    const windows = this._kernel.wm.getAll().map(w => ({
      type: w.type,
      title: w.title,
      props: w.props,
      state: w.state,
      zIndex: w.zIndex,
      id: w.id
    }));
    this.set('workspace:snapshot', windows, { tags: ['workspace', 'system'] });
  }

  restoreWorkspace() {
    const snapshot = this.get('workspace:snapshot');
    if (!snapshot?.length) return 0;
    snapshot.forEach(w => {
      this._kernel.wm.open(w.type, w.title, w.props || {});
    });
    return snapshot.length;
  }
}

export default MemoryMap;
