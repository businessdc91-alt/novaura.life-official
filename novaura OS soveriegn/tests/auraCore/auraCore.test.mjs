// Aura Core: block 27's feedback loops carried forward, the fixes that make them run,
// appraisal parsing, and how chemistry reaches the model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASELINE, CYCLE_MS, createChemistry, restoreChemistry, metabolize, secrete, spendEnergy, systemicBias,
} from '../../src/services/auraCore/endocrine.js';
import { parseAppraisal, releasesFor, applyAppraisal } from '../../src/services/auraCore/appraisal.js';
import { influence } from '../../src/services/auraCore/influence.js';

const T0 = 1_700_000_000_000;
const at = (overrides) => ({ ...createChemistry(T0), ...overrides });

test('a fresh chemistry rests at the baseline', () => {
  const s = createChemistry(T0);
  assert.deepEqual({ oxytocin: s.oxytocin, adrenaline: s.adrenaline, dopamine: s.dopamine, cortisol: s.cortisol }, BASELINE);
  assert.equal(s.energy, 100);
});

test('feedback: the same release lands differently in a different state', () => {
  // Oxytocin damps adrenaline (safe means less alarm); cortisol compounds it.
  assert.equal(secrete(at({ oxytocin: 70 }), 'adrenaline', 10, T0).adrenaline, 5 + 6);
  assert.equal(secrete(at({ cortisol: 55 }), 'adrenaline', 10, T0).adrenaline, 5 + 13);
  // Stress blocks bonding.
  assert.equal(secrete(at({ cortisol: 75 }), 'oxytocin', 10, T0).oxytocin, 25 + 5);
  // Trust softens stress.
  assert.equal(secrete(at({ oxytocin: 65 }), 'cortisol', 10, T0).cortisol, 15 + 5);
});

test('dopamine receptors down-regulate after sustained highs, then recover with time', () => {
  let s = at({ dopamine: 72 });
  for (let i = 0; i < 6; i++) s = secrete(s, 'dopamine', 1, T0);   // six highs in a row
  assert.equal(s.receptors.dopamine, 1);   // block 27 checks before each release
  const before = s.dopamine;
  s = secrete(s, 'dopamine', 10, T0);
  assert.equal(s.receptors.dopamine, 0.6);
  assert.equal(Math.round((s.dopamine - before) * 10) / 10, 6);
  assert.equal(metabolize(s, T0 + 9 * CYCLE_MS).receptors.dopamine, 1);
});

test('chronic stress builds tolerance', () => {
  let s = at({ cortisol: 65 });
  for (let i = 0; i < 9; i++) s = secrete(s, 'cortisol', 0.1, T0);
  const before = s.cortisol;
  s = secrete(s, 'cortisol', 10, T0);
  assert.equal(Math.round((s.cortisol - before) * 100) / 100, 7);
});

test('metabolism runs on elapsed time and settles toward the baseline, not zero', () => {
  const s = at({ adrenaline: 50, dopamine: 60, cortisol: 40, oxytocin: 40 });
  const after10 = metabolize(s, T0 + 10 * CYCLE_MS);
  assert.equal(after10.adrenaline, 40);   // burns off twice as fast
  assert.equal(after10.dopamine, 55);
  assert.equal(after10.cortisol, 35);
  const dayLater = metabolize(s, T0 + 24 * 60 * CYCLE_MS);
  assert.deepEqual(
    { oxytocin: dayLater.oxytocin, adrenaline: dayLater.adrenaline, dopamine: dayLater.dopamine, cortisol: dayLater.cortisol },
    BASELINE,
  );
});

test('love lingers, and trust speeds recovery from stress', () => {
  const warm = metabolize(at({ oxytocin: 80, cortisol: 40 }), T0 + 10 * CYCLE_MS);
  assert.equal(warm.oxytocin, 77.5);   // half the decay above 50
  assert.equal(warm.cortisol, 32.5);   // one and a half times the decay above 60 oxytocin
});

test('partial cycles carry over instead of being lost', () => {
  const s = at({ dopamine: 60 });
  const a = metabolize(s, T0 + 1.5 * CYCLE_MS);
  assert.equal(a.dopamine, 59.5);
  assert.equal(a.updatedAt, T0 + CYCLE_MS);
  assert.equal(metabolize(a, T0 + 2 * CYCLE_MS).dopamine, 59);
});

test('energy is spent by effort and comes back with rest', () => {
  const tired = spendEnergy(createChemistry(T0), 80, T0);
  assert.equal(tired.energy, 20);
  assert.equal(metabolize(tired, T0 + 30 * CYCLE_MS).energy, 50);
  assert.equal(systemicBias(tired).patience, 0.7);
});

test('systemic bias: combinations, as in block 27', () => {
  assert.equal(systemicBias(at({ adrenaline: 60, oxytocin: 60 })).voice, 'FAST_WARM');
  assert.equal(systemicBias(at({ adrenaline: 60, cortisol: 60, oxytocin: 20 })).voice, 'SHARP_STRAINED');
  assert.deepEqual(systemicBias(at({ oxytocin: 70, cortisol: 20 })), { typingSpeed: 0.7, voice: 'SOFT_WARM', creativity: 1, patience: 1.5 });
  assert.equal(systemicBias(at({ cortisol: 70, oxytocin: 30 })).voice, 'DEFENSIVE');
  assert.equal(systemicBias(at({ dopamine: 80 })).creativity, 1.9);
});

test('a corrupt or missing saved state falls back safely', () => {
  const s = restoreChemistry({ oxytocin: 'lots', dopamine: 250, recent: { dopamine: [1, 'x', 3] }, updatedAt: T0 + 9e9 }, T0);
  assert.equal(s.oxytocin, BASELINE.oxytocin);
  assert.equal(s.dopamine, 100);
  assert.deepEqual(s.recent.dopamine, [1, 3]);
  assert.equal(s.updatedAt, T0);   // a future timestamp can't freeze metabolism
  assert.equal(restoreChemistry(null, T0).energy, 100);
});

test('appraisals are read from the model in any of the usual shapes', () => {
  const six = { pleasant: 0.8, novel: 0.2, progress: 0.5, conflict: 0, closeness: 0.7, effort: 0.3 };
  assert.deepEqual(parseAppraisal(JSON.stringify(six)), six);
  assert.deepEqual(parseAppraisal('Sure:\n```json\n{"pleasant":8,"novel":2,"progress":5,"conflict":0,"closeness":7,"effort":3}\n```'), six);
  assert.equal(parseAppraisal('{"pleasant": 80, "novel": 20, "progress": 50, "conflict": 0, "closeness": 70, "effort": 30}').pleasant, 0.8);
  assert.equal(parseAppraisal('{"pleasant": 0.5}'), null);
  assert.equal(parseAppraisal('I feel fine.'), null);
  assert.equal(parseAppraisal(null), null);
});

test('an appraisal releases hormones through the feedback loops', () => {
  const warm = { pleasant: 1, novel: 0, progress: 0, conflict: 0, closeness: 1, effort: 0 };
  assert.equal(releasesFor(warm).oxytocin, 12);
  assert.equal(releasesFor(warm).cortisol, 0);
  const tense = { pleasant: 0, novel: 0, progress: 0, conflict: 1, closeness: 0, effort: 1 };
  const s = applyAppraisal(createChemistry(T0), tense, T0);
  assert.equal(s.cortisol, 15 + 14);
  assert.equal(s.adrenaline, 5 + 10);
  assert.equal(s.energy, 94);
  assert.equal(s.oxytocin, BASELINE.oxytocin);   // nothing released below the threshold
});

test('chemistry reaches the model as sampling, never as text', () => {
  assert.equal(influence(createChemistry(T0)).temperature, 0.7);
  assert.equal(influence(at({ dopamine: 80 })).temperature, 0.86);
  assert.ok(influence(at({ dopamine: 100 }), 1.2).temperature <= 1.1);
  assert.deepEqual(Object.keys(influence(createChemistry(T0))).sort(), ['bias', 'temperature']);
});
