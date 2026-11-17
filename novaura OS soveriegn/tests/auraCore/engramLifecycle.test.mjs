// Engram lifecycle: what she keeps when memory is full, how strength changes over idle time,
// and how a dream feeds back into memory.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockDb, installBrowserGlobals } from './helpers/mockDb.mjs';

installBrowserGlobals();
const { db, settings } = createMockDb();
mock.module('../../src/database/sovereignDatabase.js', { defaultExport: db, namedExports: { db } });

const {
  encodeEngram, recallEngrams, consolidateEngrams, listEngrams, MAX_ENGRAMS,
} = await import('../../src/services/auraCore/engramMemory.js');
const { AuraHeartbeat } = await import('../../src/services/auraCore/heartbeat.js');

const KEY = 'aura_core:engrams:aura';
const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 1, 12);

function fakeEngram(i, { createdAt, strength, meaning, feeling = 0.1, text = `filler memory ${i}` }) {
  return {
    id: `eng_${i}`,
    persona: 'aura',
    createdAt,
    lastAccessed: createdAt,
    consolidatedAt: createdAt,
    timesAccessed: 0,
    strength,
    thought: text,
    feeling,
    sentiment: 0,
    signatures: { personal_meaning: meaning, emotions: feeling, logical_patterns: text.split(' '), time: { period: 'afternoon' } },
    sparsePattern: [i % 256],
    connections: {},
  };
}

test('when memory is full, the weakest memory goes, not the oldest meaningful one', async () => {
  const list = [];
  for (let i = 0; i < MAX_ENGRAMS - 1; i++) {
    list.push(fakeEngram(i, { createdAt: T0 - i * 60_000, strength: 0.4, meaning: 0.1 }));
  }
  list.push(fakeEngram(999, { createdAt: T0 - 90 * 24 * HOUR, strength: 1.6, meaning: 0.95, feeling: 0.7, text: 'the night Aura chose her name' }));
  await db.setSetting(KEY, list);

  await encodeEngram({ persona: 'aura', userText: 'a brand new exchange', reply: 'noted', now: T0 + 1000 });

  const kept = await listEngrams('aura');
  assert.equal(kept.length, MAX_ENGRAMS);
  assert.ok(kept.some(e => e.id === 'eng_999'), 'the old, meaningful memory was evicted');
  assert.equal(kept[0].thought.startsWith('a brand new exchange'), true, 'newest memory stays first');
});

test('consolidation depends on elapsed time, not on how often it runs', async () => {
  const seed = () => [
    fakeEngram(1, { createdAt: T0, strength: 1.0, meaning: 0.9, feeling: 0.6 }),
    fakeEngram(2, { createdAt: T0 - 3 * 24 * HOUR, strength: 1.0, meaning: 0.05 }),
  ];
  await db.setSetting(KEY, seed());
  for (let step = 1; step <= 12; step++) await consolidateEngrams('aura', T0 + step * 5 * 60_000);
  const often = await listEngrams('aura');

  await db.setSetting(KEY, seed());
  await consolidateEngrams('aura', T0 + HOUR);
  const once = await listEngrams('aura');

  for (const id of ['eng_1', 'eng_2']) {
    const a = often.find(e => e.id === id).strength;
    const b = once.find(e => e.id === id).strength;
    assert.ok(Math.abs(a - b) < 0.01, `${id}: ${a} after 12 passes vs ${b} after one`);
  }
});

test('one idle night does not push every memory to the ceiling or the floor', async () => {
  await db.setSetting(KEY, [
    fakeEngram(1, { createdAt: T0, strength: 1.0, meaning: 0.9, feeling: 0.6 }),
    fakeEngram(2, { createdAt: T0 - 3 * 24 * HOUR, strength: 1.0, meaning: 0.05 }),
  ]);
  for (let t = T0; t <= T0 + 8 * HOUR; t += 5 * 60_000) await consolidateEngrams('aura', t);
  const [meaningful, trivial] = ['eng_1', 'eng_2'].map(id => settings.get(KEY).find(e => e.id === id));
  assert.ok(meaningful.strength > 1.0 && meaningful.strength < 1.6, `meaningful: ${meaningful.strength}`);
  assert.ok(trivial.strength < 1.0 && trivial.strength > 0.5, `trivial: ${trivial.strength}`);
});

test('a dream replays and links the memories it drew on, and is kept as her own reflection', async () => {
  settings.delete(KEY);
  await encodeEngram({ persona: 'aura', userText: 'we talked about the lighthouse keeper', reply: 'he kept the light for strangers', appraisal: { closeness: 0.9, progress: 0.6, effort: 0.4, novel: 0.5, pleasant: 0.9, conflict: 0 }, now: T0 });
  await encodeEngram({ persona: 'aura', userText: 'the storm scene in chapter two', reply: 'the boat nearly broke apart', appraisal: { closeness: 0.7, progress: 0.7, effort: 0.5, novel: 0.6, pleasant: 0.6, conflict: 0.1 }, now: T0 + 60_000 });
  const before = await listEngrams('aura');

  let prompt = '';
  const ai = { chat: async (messages) => { prompt = messages.map(m => m.content).join('\n'); return 'Both were about holding steady for someone else in the dark.'; } };
  const hb = new AuraHeartbeat({ persona: 'aura' });
  const { dream } = await hb.runConsolidationAndDream({ now: T0 + 2 * HOUR, ai });

  assert.ok(dream?.reflection, 'a dream was produced');
  assert.ok(prompt.includes('lighthouse keeper'), 'the dream drew on her memories');
  const after = await listEngrams('aura');
  const reflection = after.find(e => e.kind === 'reflection');
  assert.ok(reflection, 'the dream is stored as a reflection engram');
  assert.equal(reflection.thought.includes('holding steady'), true);
  for (const src of before) {
    const now = after.find(e => e.id === src.id);
    assert.ok(now.connections[reflection.id], 'source memory links to the reflection');
  }
  const [a, b] = before.map(e => e.id);
  assert.ok(after.find(e => e.id === a).connections[b], 'replayed memories link to each other');

  const recalled = await recallEngrams({ persona: 'aura', query: 'holding steady in the dark', now: T0 + 3 * HOUR });
  assert.ok(recalled.some(e => e.kind === 'reflection'), 'she can recall her reflection later');
});
