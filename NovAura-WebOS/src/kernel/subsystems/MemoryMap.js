import { db } from '../../config/firebase.js';
import { 
  doc, setDoc, deleteDoc, collection, onSnapshot, 
  query, where, serverTimestamp 
} from 'firebase/firestore';

/**
 * NovAura OS — MemoryMap (Neural Sync v3)
 * 
 * This is the OS's long-term and short-term memory. 
 * Upgraded for REAL-TIME synchronization across all devices.
 * Everything recorded here is permanent and synced live.
 */

const MAX_CACHE = 1000;

class MemoryMap {
  constructor() {
    this._kernel = null;
    this._uid = null;
    this._cache = new Map();
    this._writeQueue = new Map();
    this._DEBOUNCE = 500; // Faster sync for "everything recorded" intent
    this._unsubscribe = null;
  }

  init(kernel) {
    this._kernel = kernel;
    this._uid = kernel.auth?.uid;

    kernel.ipc.on('auth:changed', ({ uid }) => {
      this._uid = uid || null;
      this._cache.clear();
      if (this._unsubscribe) {
        this._unsubscribe();
        this._unsubscribe = null;
      }
      if (uid) this._startNeuralSync();
    });

    if (this._uid) this._startNeuralSync();
  }

  /**
   * Set a memory. Persisted to Firestore and synced to all devices.
   */
  set(key, value, options = {}) {
    const entry = {
      value,
      tags: options.tags || [],
      expiresAt: options.ttl ? Date.now() + options.ttl : null,
      updatedAt: Date.now(),
    };
    
    // Update local cache immediately for zero-latency UI
    this._cache.set(key, entry);
    
    // Queue for cloud persistence
    this._scheduleWrite(key, entry);
    
    // Inform the rest of the OS
    this._kernel.ipc.emit('memory:set', { key, value });
  }

  /**
   * Recall a memory.
   */
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
    if (!this._uid || !db) return;
    try {
      await deleteDoc(doc(db, this._docPath(key)));
      this._kernel.ipc.emit('memory:forget', { key });
    } catch {}
  }

  /**
   * START NEURAL SYNC (The Real-Time Engine)
   * Connects this device's memory to the global cloud state.
   */
  _startNeuralSync() {
    if (!this._uid || !db) return;
    
    const colRef = collection(db, 'users', this._uid, 'memory');
    const q = query(colRef);

    this._unsubscribe = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const key = data.key;

        if (change.type === 'removed') {
          this._cache.delete(key);
          this._kernel.ipc.emit('memory:remote_forget', { key });
        } else {
          // If we have a pending local write, don't overwrite with old server data
          if (this._writeQueue.has(key)) return;

          const entry = {
            value: data.value,
            tags: data.tags || [],
            expiresAt: data.expiresAt || null,
            updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
          };

          this._cache.set(key, entry);
          this._kernel.ipc.emit('memory:synced', { key, value: data.value });
        }
      });
    }, (err) => {
      console.warn('[MemoryMap] Sync error:', err);
    });
  }

  _docPath(key) {
    const safe = String(key || 'empty').replace(/[^a-zA-Z0-9_-]/g, '_') || 'empty';
    return 'users/' + this._uid + '/memory/' + safe;
  }

  _scheduleWrite(key, entry) {
    if (this._writeQueue.has(key)) clearTimeout(this._writeQueue.get(key).timer);
    const timer = setTimeout(() => this._flush(key, entry), this._DEBOUNCE);
    this._writeQueue.set(key, { entry, timer });
  }

  async _flush(key, entry) {
    if (!this._uid || !db) return;
    this._writeQueue.delete(key);
    try {
      await setDoc(doc(db, this._docPath(key)), {
        key,
        value: entry.value,
        tags: entry.tags,
        expiresAt: entry.expiresAt,
        updatedAt: serverTimestamp(),
        uid: this._uid,
      });
    } catch (e) {
      console.warn('[Memory] Sync flush failed:', key, e.message);
    }
  }

  // --- Workspace Logic ---

  snapshotWorkspace() {
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
