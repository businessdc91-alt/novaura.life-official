// An in-memory stand-in for the Dexie `addition_data` table (primary key
// [appId+key], index appId), with just the calls the additions code makes.

const pk = (appId, key) => JSON.stringify([appId, key]);
const clone = (v) => structuredClone(v);

function collection(pick, rows) {
  return {
    toArray: async () => pick().map(clone),
    primaryKeys: async () => pick().map((r) => [r.appId, r.key]),
    each: async (fn) => { for (const r of pick()) fn(clone(r)); },
    delete: async () => {
      const list = pick();
      for (const r of list) rows.delete(pk(r.appId, r.key));
      return list.length;
    },
  };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const cmpPair = (a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]);

export function createFakeTable() {
  const rows = new Map();
  const calls = [];
  const table = {
    rows,
    calls,
    async get(key) {
      calls.push('get');
      const r = rows.get(pk(key[0], key[1]));
      return r ? clone(r) : undefined;
    },
    async put(row) {
      calls.push('put');
      rows.set(pk(row.appId, row.key), clone(row));
    },
    async bulkPut(list) {
      calls.push('bulkPut');
      for (const row of list) rows.set(pk(row.appId, row.key), clone(row));
    },
    async delete(key) {
      calls.push('delete');
      rows.delete(pk(key[0], key[1]));
    },
    async bulkDelete(keys) {
      calls.push('bulkDelete');
      for (const key of keys) rows.delete(pk(key[0], key[1]));
    },
    where(index) {
      if (index === 'appId') {
        return { equals: (appId) => collection(() => [...rows.values()].filter((r) => r.appId === appId), rows) };
      }
      if (index === '[appId+key]') {
        return {
          between: (lo, hi) =>
            collection(
              () => [...rows.values()].filter((r) => cmpPair([r.appId, r.key], lo) >= 0 && cmpPair([r.appId, r.key], hi) < 0),
              rows,
            ),
        };
      }
      throw new Error(`fake table has no index ${index}`);
    },
  };
  return table;
}
