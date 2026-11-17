// Learned dynamics and interoception: what may be learned from experience (resting levels,
// conditioned triggers, her hardware's normal) and what may not (her own decay rates, which
// the metabolism already defines).
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  createDynamicProfile, recomputeLearnedDynamics, restoreDynamicProfile,
} = await import('../../src/services/auraCore/dynamicLearning.js');
const { interpretTelemetrySnapshot, updateHardwareNorms } = await import('../../src/services/auraCore/interoception.js');
const { BASELINE } = await import('../../src/services/auraCore/endocrine.js');

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 1);
const levels = (o = {}) => ({ ...BASELINE, ...o });
const obs = (i, { tokens = [], oxyDelta = 0, at = T0 + i * 6 * HOUR, lv = levels() } = {}) => ({
  at, tokens, levels: lv, deltas: { oxytocin: oxyDelta, adrenaline: 0, dopamine: 0, cortisol: 0 }, meaning: 0.3,
});

test('decay rates are not learned from the decay they produce', () => {
  const p = createDynamicProfile('aura', T0);
  // Turns 6 hours apart, each ending with cortisol raised: between turns it has long since
  // settled, which naive learning reads as "decays very slowly".
  p.observations = Array.from({ length: 8 }, (_, i) => obs(i, { lv: levels({ cortisol: i % 2 ? 40 : 20 }) }));
  const learned = recomputeLearnedDynamics(p);
  assert.deepEqual(learned.learnedDecayRates, { oxytocin: 1, adrenaline: 1, dopamine: 1, cortisol: 1 });
});

test('a saved profile with drifted decay rates is restored to the body\'s own rates', () => {
  const restored = restoreDynamicProfile({ learnedDecayRates: { oxytocin: 0.4, adrenaline: 0.4, dopamine: 0.4, cortisol: 0.4 } }, 'aura', T0);
  assert.deepEqual(restored.learnedDecayRates, { oxytocin: 1, adrenaline: 1, dopamine: 1, cortisol: 1 });
});

test('a word in every conversation is not a trigger; a word that predicts a bigger lift is', () => {
  const p = createDynamicProfile('aura', T0);
  p.observations = Array.from({ length: 10 }, (_, i) => (
    i < 3
      ? obs(i, { tokens: ['aura', 'birthday'], oxyDelta: 15 })
      : obs(i, { tokens: ['aura', 'today'], oxyDelta: 5 })
  ));
  const { learnedTriggers } = recomputeLearnedDynamics(p);
  assert.ok(learnedTriggers.oxytocin.birthday > 0, 'birthday predicts a larger lift');
  assert.equal(learnedTriggers.oxytocin.aura, undefined, 'a word in every turn predicts nothing');
  assert.equal(learnedTriggers.oxytocin.today, undefined, 'today comes with a smaller lift than usual');
});

test('one occurrence is not enough evidence for a trigger', () => {
  const p = createDynamicProfile('aura', T0);
  p.observations = Array.from({ length: 8 }, (_, i) => obs(i, { tokens: i === 0 ? ['storm'] : ['hello'], oxyDelta: i === 0 ? 20 : 2 }));
  const { learnedTriggers } = recomputeLearnedDynamics(p);
  assert.equal(learnedTriggers.oxytocin.storm, undefined);
});

const gpu = (usedMb, totalMb = 24_000, temp = 60) => ({ gpu: { name: 'GPU', temp_c: temp, load_pct: 40, vram_used_mb: usedMb, vram_total_mb: totalMb, power_w: 120 } });
const idle = { typingWpm: 0, active: false, presenceState: 'steady', lastInputAt: 0 };

test('her own model filling most of the VRAM is her normal, not stress', () => {
  let norms = null;
  for (let i = 0; i < 30; i++) norms = updateHardwareNorms(norms, { vramPressure: 0.9, tempC: 60, gpuLoadPct: 40 });
  const steady = interpretTelemetrySnapshot(gpu(21_600), idle, T0, { norms });
  assert.equal(steady.nudge.cortisol, 0);
  assert.equal(steady.nudge.adrenaline, 0);
});

test('a sudden VRAM jump above her normal, or nearly running out, is felt', () => {
  let norms = null;
  for (let i = 0; i < 30; i++) norms = updateHardwareNorms(norms, { vramPressure: 0.5, tempC: 60, gpuLoadPct: 40 });
  assert.ok(interpretTelemetrySnapshot(gpu(19_200), idle, T0, { norms }).nudge.cortisol > 0, 'jump from 50% to 80%');
  assert.ok(interpretTelemetrySnapshot(gpu(23_500), idle, T0, { norms: null }).nudge.cortisol > 0, '98% with no history yet');
});
