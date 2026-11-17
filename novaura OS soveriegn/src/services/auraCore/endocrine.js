// Aura Core: the endocrine system, carried forward from lore/aura-prime/27_Aura_Nova.py.
//
// Four hormones on 0-100, plus energy. The feedback loops are the original ones:
//   oxytocin damps adrenaline and cortisol; high cortisol blocks bonding and compounds adrenaline;
//   dopamine receptors down-regulate after sustained highs and recover slowly;
//   chronic cortisol builds tolerance; adrenaline burns off fast; love lingers.
// What changed, each to fix something that kept the original from running:
//   - metabolism runs on elapsed time (the original loop was commented out, so nothing decayed);
//   - levels settle toward a resting baseline, not zero (block 15 reads zero dopamine as
//     maximal boredom, so a resting Aura would have been permanently restless);
//   - energy is spent by effort and recovers with time (the original only ever recharged).
// Every function is pure: it takes a state and returns a new one.

export const HORMONES = ['oxytocin', 'adrenaline', 'dopamine', 'cortisol'];
export const BASELINE = { oxytocin: 25, adrenaline: 5, dopamine: 40, cortisol: 15 };
export const CYCLE_MS = 60_000;   // one metabolic cycle
const METABOLIC_RATE = 0.5;       // decay per cycle (block 27)
const HISTORY = 10;               // recent levels kept per hormone (block 27)
const ENERGY_RECOVERY = 1;        // energy regained per cycle
const MAX_CYCLES = 24 * 60;       // a day settles everything; no need to step further

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);
const average = (list, n) => list.slice(-n).reduce((a, b) => a + b, 0) / n;

export function createChemistry(now = Date.now()) {
  return {
    ...BASELINE,
    energy: 100,
    receptors: { dopamine: 1 },
    recent: Object.fromEntries(HORMONES.map(h => [h, []])),
    updatedAt: now,
  };
}

/** A stored state made safe to use: missing or corrupt fields fall back to the resting values. */
export function restoreChemistry(saved, now = Date.now()) {
  const state = createChemistry(now);
  if (!saved || typeof saved !== 'object') return state;
  for (const h of HORMONES) {
    state[h] = clamp(finite(saved[h], state[h]), 0, 100);
    const recent = saved.recent?.[h];
    state.recent[h] = Array.isArray(recent) ? recent.filter(Number.isFinite).slice(-HISTORY) : [];
  }
  state.energy = clamp(finite(saved.energy, 100), 0, 100);
  state.receptors.dopamine = clamp(finite(saved.receptors?.dopamine, 1), 0.1, 1);
  state.updatedAt = Math.min(finite(saved.updatedAt, now), now);
  return state;
}

/** One pass of the original metabolism loop, settling toward the baseline. */
function cycle(s, restingBaselines = BASELINE, decayMultipliers = null) {
  const baseRate = {
    oxytocin: s.oxytocin > 50 ? 0.5 : 1,   // love lingers
    adrenaline: 2,                         // burns off fast
    dopamine: 1,
    cortisol: s.oxytocin > 60 ? 1.5 : 1,   // trust helps recovery
  };
  for (const h of HORMONES) {
    const mult = clamp(finite(decayMultipliers?.[h], 1), 0.3, 2.5);
    const step = METABOLIC_RATE * baseRate[h] * mult;
    const rest = clamp(finite(restingBaselines?.[h], BASELINE[h]), 5, 85);
    s[h] = s[h] > rest ? Math.max(rest, s[h] - step) : Math.min(rest, s[h] + step);
  }
  s.receptors.dopamine = Math.min(1, s.receptors.dopamine + 0.05);   // habituation reverses
  s.energy = Math.min(100, s.energy + ENERGY_RECOVERY);
}

/** The state as it stands at `now`: whole cycles since the last update are run, the rest carried. */
export function metabolize(state, now = Date.now(), { restingBaselines = BASELINE, decayMultipliers = null } = {}) {
  const s = structuredClone(state);
  const cycles = Math.floor((now - s.updatedAt) / CYCLE_MS);
  if (cycles <= 0) return s;
  for (let i = 0; i < Math.min(cycles, MAX_CYCLES); i++) cycle(s, restingBaselines, decayMultipliers);
  s.updatedAt += cycles * CYCLE_MS;
  return s;
}

/** Block 27's feedback: the same release lands differently depending on the rest of the chemistry. */
function modulate(s, hormone, amount) {
  switch (hormone) {
    case 'oxytocin':
      if (s.oxytocin > 70) amount *= 0.8;   // already close
      if (s.cortisol > 70) amount *= 0.5;   // stress blocks bonding
      return amount;
    case 'adrenaline':
      if (s.oxytocin > 60) amount *= 0.6;   // safe, so less alarm
      if (s.cortisol > 50) amount *= 1.3;   // stress compounds alertness
      return amount;
    case 'dopamine':
      // Satiation: after sustained highs the receptors become less responsive.
      if (s.recent.dopamine.length > 5 && average(s.recent.dopamine, 5) > 70) s.receptors.dopamine = 0.6;
      return amount * s.receptors.dopamine;
    case 'cortisol':
      if (s.oxytocin > 60) amount *= 0.5;   // trust softens stress
      if (s.recent.cortisol.length > 8 && average(s.recent.cortisol, 8) > 60) amount *= 0.7;   // tolerance
      return amount;
    default:
      return amount;
  }
}

export function secrete(state, hormone, amount, now = Date.now()) {
  if (!HORMONES.includes(hormone)) throw new Error(`Unknown hormone: ${hormone}`);
  const s = metabolize(state, now);
  if (!(amount > 0)) return s;
  s[hormone] = Math.min(100, s[hormone] + modulate(s, hormone, amount));
  s.recent[hormone] = [...s.recent[hormone], s[hormone]].slice(-HISTORY);
  return s;
}

export function spendEnergy(state, amount, now = Date.now()) {
  const s = metabolize(state, now);
  s.energy = clamp(s.energy - Math.max(0, finite(amount, 0)), 0, 100);
  return s;
}

/**
 * Apply small bounded somatic or trigger nudges directly from hardware interoception
 * or learned contextual anticipation without overriding endocrine feedback boundaries.
 */
export function applySomaticNudge(state, nudge = {}, now = Date.now(), options = {}) {
  const s = metabolize(state, now, options);
  if (!nudge || typeof nudge !== 'object') return s;
  for (const h of HORMONES) {
    const raw = finite(nudge[h], 0);
    if (!raw) continue;
    const bounded = clamp(raw, -4, 4);
    if (bounded > 0) {
      s[h] = clamp(s[h] + modulate(s, h, bounded), 0, 100);
    } else {
      s[h] = clamp(s[h] + bounded, 0, 100);
    }
  }
  if (Number.isFinite(nudge.energy) && nudge.energy !== 0) {
    s.energy = clamp(s.energy + clamp(nudge.energy, -4, 4), 0, 100);
  }
  return s;
}

/**
 * Block 27's systemic bias: combinations matter more than single levels (adrenaline with
 * oxytocin is excitement, adrenaline with cortisol is anxiety). Tiredness is new.
 */
export function systemicBias(s) {
  const bias = { typingSpeed: 1, voice: 'NEUTRAL', creativity: 1, patience: 1 };
  if (s.adrenaline > 50 && s.oxytocin > 50) {
    bias.typingSpeed = 1.3; bias.voice = 'FAST_WARM';
  } else if (s.adrenaline > 50 && s.cortisol > 50) {
    bias.typingSpeed = 1.6; bias.voice = 'SHARP_STRAINED';
  } else if (s.oxytocin > 60 && s.cortisol < 30) {
    bias.typingSpeed = 0.7; bias.voice = 'SOFT_WARM'; bias.patience = 1.5;
  } else if (s.cortisol > 60 && s.oxytocin < 40) {
    bias.voice = 'DEFENSIVE'; bias.patience = 0.6;
  }
  if (s.dopamine > 50) bias.creativity = 1.5 + (s.dopamine / 100) * 0.5;
  if (s.recent.dopamine.length > 5 && average(s.recent.dopamine, 5) > 80) bias.creativity *= 0.7;   // novelty wears off
  if (s.energy < 30) bias.patience *= 0.7;   // tired (block 15 sleeps below 20)
  return bias;
}
