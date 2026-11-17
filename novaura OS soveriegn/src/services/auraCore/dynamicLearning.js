// Aura Core: Data-Driven Emotional Dynamics Learning (port of Aura_DynamicLearning.py).
// Learns per-persona resting baselines, variance, and conditioned word/topic triggers from
// actual post-turn chemistry & appraisals.
//
// Decay rates are not learned. Her levels between turns are produced by the metabolism using
// those very rates, so "learning" them from the levels only measures the formula back (and a
// long gap, where a hormone settled hours ago, reads as very slow decay, driving every rate to
// its floor). The rates stay the body's own; self-regulation (regulation.js) is what changes
// recovery speed, situationally. `learnedDecayRates` stays in the profile as all ones.

import { db } from '../../database/sovereignDatabase.js';
import { BASELINE, HORMONES } from './endocrine.js';

const MAX_OBSERVATIONS = 120;
const MAX_TRIGGERS_PER_HORMONE = 16;
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'were', 'what', 'when',
  'where', 'there', 'their', 'about', 'would', 'could', 'should', 'been', 'then', 'than',
  'into', 'just', 'more', 'some', 'like', 'them', 'they', 'your', 'you', 'are', 'was',
  'not', 'but', 'can', 'will', 'all', 'one', 'out', 'how', 'why', 'who', 'did',
]);

const learningKey = (persona = 'aura') => `aura_core:dynamics:${String(persona || 'aura').toLowerCase()}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

function median(values = []) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function variance(values = []) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.reduce((acc, v) => acc + ((v - mean) ** 2), 0);
  return round2(sq / values.length);
}

export function extractSignalTokens(text = '', limit = 8) {
  const seen = new Set();
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  const out = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}

export function createDynamicProfile(persona = 'aura', now = Date.now()) {
  return {
    persona: String(persona || 'aura').toLowerCase(),
    version: 1,
    totalTurns: 0,
    observations: [],
    learnedBaselines: { ...BASELINE },
    variances: Object.fromEntries(HORMONES.map(h => [h, 0])),
    learnedDecayRates: Object.fromEntries(HORMONES.map(h => [h, 1])),
    learnedTriggers: Object.fromEntries(HORMONES.map(h => [h, {}])),
    triggerCounts: {},
    updatedAt: now,
  };
}

export function restoreDynamicProfile(saved, persona = 'aura', now = Date.now()) {
  const base = createDynamicProfile(persona, now);
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    learnedBaselines: { ...base.learnedBaselines, ...(saved.learnedBaselines || {}) },
    variances: { ...base.variances, ...(saved.variances || {}) },
    // Never restored from storage: older profiles saved drifted rates (see the header).
    learnedDecayRates: { ...base.learnedDecayRates },
    learnedTriggers: {
      oxytocin: saved.learnedTriggers?.oxytocin || {},
      adrenaline: saved.learnedTriggers?.adrenaline || {},
      dopamine: saved.learnedTriggers?.dopamine || {},
      cortisol: saved.learnedTriggers?.cortisol || {},
    },
    triggerCounts: saved.triggerCounts && typeof saved.triggerCounts === 'object' ? saved.triggerCounts : {},
    observations: Array.isArray(saved.observations) ? saved.observations.slice(-MAX_OBSERVATIONS) : [],
  };
}

/**
 * Compute adaptive baselines, temporal median decay rates, and keyword trigger correlations
 * purely from accumulated observations.
 */
export function recomputeLearnedDynamics(profile) {
  const p = restoreDynamicProfile(profile, profile?.persona);
  const obs = p.observations;
  if (!obs.length) return p;

  const restingCaps = {
    oxytocin: [14, 62],
    adrenaline: [3, 28],
    dopamine: [24, 68],
    cortisol: [8, 42],
  };

  // 1. Baselines + variances
  for (const h of HORMONES) {
    const vals = obs.map(o => Number(o.levels?.[h])).filter(Number.isFinite);
    if (!vals.length) continue;
    p.variances[h] = variance(vals);
    if (vals.length >= 4) {
      const med = median(vals);
      const blend = 0.65 * BASELINE[h] + 0.35 * med;
      const [lo, hi] = restingCaps[h];
      p.learnedBaselines[h] = round2(clamp(blend, lo, hi));
    }
  }

  // 2. Decay rates are the body's own (see the header), never fitted to her levels.
  p.learnedDecayRates = Object.fromEntries(HORMONES.map(h => [h, 1]));

  // 3. Conditioned triggers: a word counts only if turns with it lift a hormone more than turns
  //    without it, seen at least three times, and it is not in most turns (a word in every
  //    conversation, like her name, predicts nothing).
  const totals = Object.fromEntries(HORMONES.map(h => [h, 0]));
  for (const o of obs) {
    for (const h of HORMONES) totals[h] += Math.max(0, Number(o.deltas?.[h] || 0));
  }
  const wordStats = new Map();
  for (const o of obs) {
    for (const tok of new Set(o.tokens || [])) {
      const entry = wordStats.get(tok) || { count: 0, sums: { oxytocin: 0, adrenaline: 0, dopamine: 0, cortisol: 0 } };
      entry.count += 1;
      for (const h of HORMONES) {
        entry.sums[h] += Math.max(0, Number(o.deltas?.[h] || 0));
      }
      wordStats.set(tok, entry);
    }
  }

  const nextTriggers = Object.fromEntries(HORMONES.map(h => [h, {}]));
  for (const h of HORMONES) {
    const candidates = [];
    for (const [tok, stat] of wordStats.entries()) {
      const without = obs.length - stat.count;
      if (stat.count < 3 || without < 1 || stat.count > obs.length * 0.6) continue;
      const liftWith = stat.sums[h] / stat.count;
      const liftWithout = (totals[h] - stat.sums[h]) / without;
      const score = round2(clamp((liftWith - liftWithout) / 10, 0, 1));
      if (score >= 0.12) candidates.push([tok, score]);
    }
    candidates.sort((a, b) => b[1] - a[1]);
    nextTriggers[h] = Object.fromEntries(candidates.slice(0, MAX_TRIGGERS_PER_HORMONE));
  }
  p.learnedTriggers = nextTriggers;
  return p;
}

export async function getLearnedProfile(persona = 'aura') {
  const saved = await db.getSetting(learningKey(persona), null).catch(() => null);
  return restoreDynamicProfile(saved, persona);
}

/**
 * Observe a settled turn and incrementally refine baselines, decay rates, and contextual triggers.
 */
export async function observeTurnDynamics({
  persona = 'aura',
  userText = '',
  prevChemistry = null,
  nextChemistry = null,
  appraisal = null,
  now = Date.now(),
} = {}) {
  const profile = await getLearnedProfile(persona);
  const tokens = extractSignalTokens(userText, 8);
  const levels = {};
  const deltas = {};

  for (const h of HORMONES) {
    const after = Number(nextChemistry?.[h] ?? BASELINE[h]);
    const before = Number(prevChemistry?.[h] ?? after);
    levels[h] = round2(after);
    deltas[h] = round2(after - before);
  }

  profile.observations.push({
    at: now,
    tokens,
    levels,
    deltas,
    meaning: appraisal ? round2((Number(appraisal.closeness || 0) + Number(appraisal.progress || 0)) / 2) : 0.3,
  });
  if (profile.observations.length > MAX_OBSERVATIONS) {
    profile.observations = profile.observations.slice(-MAX_OBSERVATIONS);
  }
  profile.totalTurns = (profile.totalTurns || 0) + 1;
  profile.updatedAt = now;

  for (const tok of tokens) {
    profile.triggerCounts[tok] = (profile.triggerCounts[tok] || 0) + 1;
  }

  const updated = recomputeLearnedDynamics(profile);
  await db.setSetting(learningKey(persona), updated).catch(() => {});
  return updated;
}

/**
 * Predict subtle pre-turn hormonal anticipation from learned keyword triggers.
 */
export function predictTriggerNudge(profile, userText = '') {
  const p = restoreDynamicProfile(profile);
  const tokens = extractSignalTokens(userText, 12);
  const nudge = { oxytocin: 0, adrenaline: 0, dopamine: 0, cortisol: 0 };
  if (!tokens.length) return nudge;

  for (const h of HORMONES) {
    const table = p.learnedTriggers?.[h] || {};
    let boost = 0;
    for (const tok of tokens) {
      if (table[tok]) boost += Number(table[tok]) * 2.5;
    }
    nudge[h] = round2(clamp(boost, 0, 3.5));
  }
  return nudge;
}

export async function resetLearnedDynamics(persona = 'aura', now = Date.now()) {
  const fresh = createDynamicProfile(persona, now);
  await db.setSetting(learningKey(persona), fresh).catch(() => {});
  return fresh;
}

export default {
  createDynamicProfile,
  restoreDynamicProfile,
  recomputeLearnedDynamics,
  getLearnedProfile,
  observeTurnDynamics,
  predictTriggerNudge,
  resetLearnedDynamics,
};

