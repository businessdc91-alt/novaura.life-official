// In-memory stand-in for the Dexie database, close enough to the real API for Aura Core:
// settings get/put, a `memories` table with the query chains the RAG service uses, chat
// history, and `transaction` (which just runs its scope here). Optional per-key read delays
// let a test hold one reader on a slow read the way a real hardware probe would.
export function createMockDb({ readDelays = {} } = {}) {
  const settings = new Map();
  const memoryRows = [];
  const chatRows = [];
  let nextId = 1;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const clone = (v) => (v === undefined ? v : structuredClone(v));

  const sortedMemories = (rows, field) => [...rows].sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')));
  const memoryChain = (rowsFn) => ({
    reverse: () => ({ sortBy: async (field) => sortedMemories(rowsFn(), field).reverse().map(clone) }),
    sortBy: async (field) => sortedMemories(rowsFn(), field).map(clone),
    toArray: async () => rowsFn().map(clone),
  });

  const db = {
    settings: {
      get: async (key) => (settings.has(key) ? { key, value: clone(settings.get(key)) } : undefined),
      put: async ({ key, value }) => { settings.set(key, clone(value)); return key; },
    },
    async getSetting(key, fallback = null) {
      if (readDelays[key]) await sleep(readDelays[key]);
      return settings.has(key) ? clone(settings.get(key)) : fallback;
    },
    async setSetting(key, value) {
      settings.set(key, clone(value));
      return key;
    },
    async transaction(...args) {
      return args[args.length - 1]();
    },
    memories: {
      add: async (rec) => { const id = nextId++; memoryRows.push({ ...clone(rec), id }); return id; },
      get: async (id) => clone(memoryRows.find(r => r.id === id)),
      update: async (id, patch) => {
        const i = memoryRows.findIndex(r => r.id === id);
        if (i < 0) return 0;
        memoryRows[i] = { ...memoryRows[i], ...clone(patch) };
        return 1;
      },
      delete: async (id) => { const i = memoryRows.findIndex(r => r.id === id); if (i >= 0) memoryRows.splice(i, 1); },
      where: (field) => ({ equals: (val) => memoryChain(() => memoryRows.filter(r => r[field] === val)) }),
      ...memoryChain(() => memoryRows),
    },
    chat_history: {
      add: async (row) => { const id = nextId++; chatRows.push({ ...clone(row), id }); return id; },
      where: (field) => ({
        equals: (val) => {
          const rows = () => chatRows.filter(r => r[field] === val);
          return {
            reverse: () => ({ limit: (n) => ({ toArray: async () => rows().slice(-n).reverse().map(clone) }) }),
            toArray: async () => rows().map(clone),
          };
        },
      }),
    },
    vault: {
      put: async () => {}, get: async () => undefined, toArray: async () => [],
    },
    documents: {
      toArray: async () => [],
      where: () => ({ equals: () => ({ limit: () => ({ toArray: async () => [] }) }) }),
    },
  };

  return { db, settings, memoryRows, chatRows };
}

/** Minimal browser globals the Aura Core services touch. */
export function installBrowserGlobals() {
  const events = new EventTarget();
  const seen = [];
  globalThis.window = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: (e) => { seen.push(e); return events.dispatchEvent(e); },
  };
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
  };
  return { events: seen };
}
