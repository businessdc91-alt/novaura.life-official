/**
 * NovAura Sovereign OS — Settings Store Subsystem
 * Local private cloud settings persistence. Zero cloud dependence.
 */

import { db } from '../../database/sovereignDatabase.js';

class SettingsStore {
  constructor() {
    this._kernel = null;
    this._cache = new Map();
    this._watchers = new Map();
    this._pendingWrites = new Map();
    this._flushTimer = null;
  }

  init(kernel) {
    this._kernel = kernel;

    kernel.ipc.on('settings:set', ({ key, value }) => {
      this.set(key, value);
    });

    kernel.ipc.on('system:shutdown', () => {
      this._flush();
    });
  }

  async onReady() {
    try {
      const records = await db.settings.toArray();
      for (const item of records) {
        this._cache.set(item.key, item.value);
      }
      this._kernel.ipc.emit('settings:loaded', { count: records.length });
    } catch (e) {
      console.warn('[SettingsStore] Local load notice:', e.message);
    }
  }

  get(key, defaultValue = null) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    return defaultValue;
  }

  set(key, value) {
    this._cache.set(key, value);
    this._pendingWrites.set(key, value);
    this._notifyWatchers(key, value);
    this._kernel.ipc.emit('settings:changed', { key, value });

    if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => this._flush(), 1500);
    }
  }

  watch(key, handler) {
    if (!this._watchers.has(key)) this._watchers.set(key, new Set());
    this._watchers.get(key).add(handler);
    return () => this._watchers.get(key)?.delete(handler);
  }

  async _flush() {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._pendingWrites.size === 0) return;

    const entries = [...this._pendingWrites.entries()];
    this._pendingWrites.clear();

    try {
      for (const [key, value] of entries) {
        await db.settings.put({ key, value, updatedAt: Date.now() });
      }
    } catch (e) {
      console.error('[SettingsStore] Flush error:', e);
    }
  }

  _notifyWatchers(key, value) {
    const set = this._watchers.get(key);
    if (set) {
      set.forEach(h => {
        try { h(value); } catch (e) { console.error('[SettingsStore] watcher error', e); }
      });
    }
  }

  destroy() {
    this._flush();
    this._watchers.clear();
  }
}

export default SettingsStore;
