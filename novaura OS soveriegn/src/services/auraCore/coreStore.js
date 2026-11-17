// Aura Core: one safe way to change a stored record.
//
// Her state lives in a few settings records that several loops write: the heartbeat, the
// post-turn appraisal, engram recall and consolidation, and the Phoenix bookkeeping. A
// plain read, slow await, write lets one writer erase another's change. Here every change
// is a read-modify-write that runs alone per key:
//   - in this window, changes to one key run one after another;
//   - across windows, the read and write share one IndexedDB transaction.
// The mutator must be synchronous (do slow work before calling) because an IndexedDB
// transaction closes as soon as it waits on anything outside the database.

import { db } from '../../database/sovereignDatabase.js';

const chains = new Map();

/**
 * Apply `mutator(current)` to the record at `key` and store what it returns.
 * Returning `undefined` leaves the record as it is. Resolves to the stored value.
 */
export function mutateSetting(key, mutator, fallback = null) {
  const run = async () => {
    const apply = async () => {
      const current = await db.getSetting(key, fallback);
      const next = mutator(current);
      if (next && typeof next.then === 'function') {
        throw new Error('mutateSetting: the mutator must be synchronous');
      }
      if (next === undefined) return undefined;
      await db.setSetting(key, next);
      return next;
    };
    return typeof db.transaction === 'function' && db.settings
      ? db.transaction('rw', db.settings, apply)
      : apply();
  };
  const prior = chains.get(key) || Promise.resolve();
  const result = prior.then(run, run);
  const tail = result.catch(() => {});
  chains.set(key, tail);
  tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return result;
}

export default { mutateSetting };
