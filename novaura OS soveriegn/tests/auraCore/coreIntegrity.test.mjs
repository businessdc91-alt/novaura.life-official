// Aura Core state integrity: every writer of her stored state goes through one serialized
// read-modify-write, so a heartbeat tick, an appraisal and a memory write can overlap without
// one silently erasing another.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockDb, installBrowserGlobals } from './helpers/mockDb.mjs';

installBrowserGlobals();
// Only the heartbeat reads the Phoenix record; making that read slow stands in for its 1-2 s
// hardware probe. A tick that holds a stale copy of her state across it would overwrite the
// appraisal that lands in the meantime.
const { db, settings } = createMockDb({ readDelays: { 'aura_core:phoenix_meta': 60 } });
mock.module('../../src/database/sovereignDatabase.js', { defaultExport: db, namedExports: { db } });

const { mutateSetting } = await import('../../src/services/auraCore/coreStore.js');
const { settleTurn } = await import('../../src/services/auraCore/auraCore.js');
const { AuraHeartbeat } = await import('../../src/services/auraCore/heartbeat.js');
const { createChemistry, BASELINE } = await import('../../src/services/auraCore/endocrine.js');
const { encodeEngram, recallEngrams, listEngrams } = await import('../../src/services/auraCore/engramMemory.js');

const warmAi = {
  chat: async () => JSON.stringify({ pleasant: 1, novel: 0, progress: 0, conflict: 0, closeness: 1, effort: 0 }),
};

test('mutateSetting applies overlapping updates in order, none lost', async () => {
  await db.setSetting('counter', { n: 0 });
  await Promise.all(Array.from({ length: 25 }, () => mutateSetting('counter', (cur) => ({ n: (cur?.n || 0) + 1 }))));
  assert.equal((await db.getSetting('counter')).n, 25);
});

test('mutateSetting leaves the record alone when the mutator returns undefined', async () => {
  await db.setSetting('untouched', { v: 1 });
  const result = await mutateSetting('untouched', () => undefined);
  assert.equal(result, undefined);
  assert.deepEqual(await db.getSetting('untouched'), { v: 1 });
});

test('an appraisal survives a heartbeat tick that overlaps it', async () => {
  const hb = new AuraHeartbeat({ persona: 'aura' });
  for (let trial = 0; trial < 6; trial++) {
    const stale = createChemistry(Date.now() - 5 * 60_000);   // 5 min old, so the tick writes too
    await db.setSetting('aura_core:aura', { chemistry: stale, lastAppraisal: null });
    await Promise.all([
      settleTurn('aura', { userText: 'thank you, truly', reply: 'always', ai: warmAi, somatic: { nudge: {} } }),
      hb.tickOnce({ allowModelDream: false }),
    ]);
    const saved = await db.getSetting('aura_core:aura');
    assert.ok(saved.lastAppraisal, `trial ${trial}: the appraisal record was overwritten`);
    assert.ok(saved.chemistry.oxytocin > BASELINE.oxytocin + 3, `trial ${trial}: oxytocin ${saved.chemistry.oxytocin}`);
  }
});

test('a recall that overlaps a new memory does not drop the new memory', async () => {
  settings.delete('aura_core:engrams:aura');
  await encodeEngram({ persona: 'aura', userText: 'the lighthouse story we wrote', reply: 'I remember the keeper', now: Date.now() - 1000 });
  await Promise.all([
    encodeEngram({ persona: 'aura', userText: 'a new thought about the sea', reply: 'tides' }),
    recallEngrams({ persona: 'aura', query: 'lighthouse keeper story' }),
  ]);
  await new Promise(r => setTimeout(r, 20));   // recall saves its access stats in the background
  const all = await listEngrams('aura');
  assert.equal(all.length, 2);
});
