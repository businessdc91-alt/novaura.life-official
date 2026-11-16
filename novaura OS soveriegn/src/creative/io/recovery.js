// recovery.js — Crash recovery for the Creative Studio.
//
// Every couple of minutes, each document with unsaved changes is packed as a .novaart
// copy into its own IndexedDB database (novaura_creative_recovery), apart from
// Sovereign's main database. Saving or closing a document clears its copy. When the
// studio closes, copies are written at once. When it opens and copies exist, it offers
// to restore them.

import { packProject, unpackProject } from './novaart.js';

const DB_NAME = 'novaura_creative_recovery';
const STORE = 'docs';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const docs = req.result.createObjectStore(STORE, { keyPath: 'id' });
      docs.createIndex('updatedAt', 'updatedAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.result ?? result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveRecovery(session) {
  const blob = await packProject(session.doc, { thumbnail: false });
  await withStore('readwrite', s => s.put({ id: session.id, name: session.doc.name, updatedAt: Date.now(), blob }));
}

/** The copies waiting to be restored: [{ id, name, updatedAt }], newest first. */
export async function listRecovery() {
  const all = await withStore('readonly', s => s.getAll());
  return all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function takeRecovery(id) {
  const record = await withStore('readonly', s => s.get(id));
  if (!record) throw new Error('That recovered document is no longer there.');
  return unpackProject(record.blob);
}

export async function clearRecovery(id) {
  await withStore('readwrite', s => s.delete(id));
}

/** Keep copies of unsaved documents every intervalMs; returns stop(). Also flushes on store.dispose(). */
export function startRecovery(store, intervalMs = 120000) {
  const copied = new Map(); // session id → the document version last copied
  let running = Promise.resolve();

  const clearGone = () => {
    const sessions = new Map(store.getState().sessions.map(s => [s.id, s]));
    for (const id of [...copied.keys()]) {
      const s = sessions.get(id);
      if (!s || !s.dirty) {
        copied.delete(id);
        running = running.then(() => clearRecovery(id)).catch(() => {});
      }
    }
  };

  const copyDirty = () => {
    running = running.then(async () => {
      for (const s of store.getState().sessions) {
        if (!s.dirty || copied.get(s.id) === s.doc.version) continue;
        const version = s.doc.version;
        await saveRecovery(s);
        copied.set(s.id, version);
      }
    }).catch(() => {});
    return running;
  };

  const timer = setInterval(copyDirty, intervalMs);
  const unsubscribe = store.subscribe(clearGone);
  const unregister = store.onDispose(() => copyDirty());
  // The app quitting doesn't unmount anything: copy what we can as the page goes away.
  const onPageHide = () => { copyDirty(); };
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide);
  return () => {
    clearInterval(timer);
    unsubscribe();
    unregister();
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
  };
}
