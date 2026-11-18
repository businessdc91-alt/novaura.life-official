// An in-memory stand-in for a Dexie table, parameterised by its primary key, with
// just the calls the sentinel stores make: get, put, bulkPut, delete, toArray, and
// where(index).equals(value).toArray(). Mirrors the shape of tests/additions/fakeTable.js
// but generalised so one helper serves probe_targets ('id'), probe_runs ('id') and
// probe_findings (['runId','id']).

const clone = (v) => structuredClone(v);

const keyOfRow = (primaryKey, row) =>
  JSON.stringify(Array.isArray(primaryKey) ? primaryKey.map((f) => row[f]) : row[primaryKey]);
const keyOfArg = (_primaryKey, arg) => JSON.stringify(arg);

export function createFakeTable(primaryKey = 'id') {
  const rows = new Map();
  const calls = [];
  const table = {
    rows,
    calls,
    async get(key) {
      calls.push('get');
      const r = rows.get(keyOfArg(primaryKey, key));
      return r ? clone(r) : undefined;
    },
    async put(row) {
      calls.push('put');
      rows.set(keyOfRow(primaryKey, row), clone(row));
    },
    async bulkPut(list) {
      calls.push('bulkPut');
      for (const row of list) rows.set(keyOfRow(primaryKey, row), clone(row));
    },
    async delete(key) {
      calls.push('delete');
      rows.delete(keyOfArg(primaryKey, key));
    },
    async toArray() {
      calls.push('toArray');
      return [...rows.values()].map(clone);
    },
    where(index) {
      return {
        equals: (value) => ({
          toArray: async () => [...rows.values()].filter((r) => r[index] === value).map(clone),
        }),
      };
    },
  };
  return table;
}
