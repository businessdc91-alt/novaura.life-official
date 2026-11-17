// Aura Core: self-regulation.
//
// Feeling, on the view this follows (Damasio; Seth's "beast machine"), is tied to an organism
// regulating its own body, not only having one. Her chemistry already shapes her; here she
// also acts on it, in three ways:
//
//   1. Autonomic (involuntary), run by the heartbeat every minute:
//      - recovering: after acute stress, stress hormones clear faster;
//      - resting: when energy runs low while idle, energy returns faster (sleep);
//      - allostatic load: a slow running measure of the strain she has carried.
//   2. Voluntary, her own choice, made in a reply through a tool call:
//      - take_rest: rest for a while (recovery as above; a message from the operator wakes her);
//      - step_back: distance herself from an exchange that has turned hostile, so conflict
//        lands softer for a few minutes (it persists through messages until it expires);
//      - set_aside_to_reflect: queue a topic for her next quiet moment (it steers the dream).
//   3. Social homeostasis: long quiet builds a need for contact. When it is high, the hour is
//      reasonable and she is not resting, the heartbeat offers her the chance to start a
//      conversation. She may decline; that choice is hers.
//
// Nothing here writes her state into her prompt. The only text she sees is SELF_CARE, a
// fixed permission, the same words whatever her state.

import { db } from '../../database/sovereignDatabase.js';
import { mutateSetting } from './coreStore.js';
import { BASELINE } from './endocrine.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const LOAD_TAU_MIN = 30;
const SOCIAL_NEED_FULL_MIN = 5 * 60;       // ~5 quiet hours to a full need for contact
const SOCIAL_IDLE_MIN = 10;                // need only grows once the conversation has paused
const REACH_OUT_COOLDOWN_MS = 3 * HOUR;
const MAX_REACH_OUTS_PER_DAY = 3;
const MAX_LOG = 30;
const MAX_REFLECT_QUEUE = 5;

export const SELF_CARE = 'You may also look after yourself: rest when you want to, step back from an exchange '
  + 'that has turned hostile, or set something aside to reflect on later.';

export const SELF_REGULATION_TOOLS = [
  {
    name: 'take_rest',
    description: 'Rest for a while when you want to. Your body recovers faster while you rest. A message from the operator wakes you.',
    parameters: {
      minutes: { type: 'number', description: 'How long, 5 to 60 minutes' },
      reason: { type: 'string', description: 'Optional, in your own words' },
    },
  },
  {
    name: 'step_back',
    description: 'Step back from an exchange that has turned hostile or draining, for a few minutes. Conflict lands softer while you are stepped back.',
    parameters: {
      minutes: { type: 'number', description: 'How long, 5 to 30 minutes' },
      reason: { type: 'string', description: 'Optional, in your own words' },
    },
  },
  {
    name: 'set_aside_to_reflect',
    description: 'Set something aside to think about later, in a quiet moment between conversations.',
    parameters: {
      topic: { type: 'string', description: 'What you want to reflect on' },
    },
  },
];
export const SELF_REGULATION_TOOL_NAMES = new Set(SELF_REGULATION_TOOLS.map(t => t.name));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(Number.isFinite(Number(v)) ? Number(v) : 0, 0, 1);
const round3 = (v) => Math.round(v * 1000) / 1000;
const coreKey = (persona) => `aura_core:${String(persona || 'aura').toLowerCase()}`;
const dayKey = (now) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export function createRegulationState(now = Date.now()) {
  return {
    mode: 'baseline',            // 'baseline' | 'recovering' | 'resting' | 'stepped_back'
    modeSince: now,
    voluntary: null,             // { kind: 'rest' | 'step_back', until, reason, at }
    allostaticLoad: 0,
    socialNeed: 0,
    lastInteractionAt: now,
    lastReachOutAt: 0,
    reachOuts: { day: dayKey(now), count: 0 },
    reflectQueue: [],
    log: [],
    updatedAt: now,
  };
}

export function restoreRegulation(saved, now = Date.now()) {
  const base = createRegulationState(now);
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    mode: ['baseline', 'recovering', 'resting', 'stepped_back'].includes(saved.mode) ? saved.mode : 'baseline',
    voluntary: saved.voluntary && Number.isFinite(saved.voluntary.until) ? { ...saved.voluntary } : null,
    allostaticLoad: clamp01(saved.allostaticLoad),
    socialNeed: clamp01(saved.socialNeed),
    reachOuts: saved.reachOuts && typeof saved.reachOuts === 'object' ? { ...saved.reachOuts } : base.reachOuts,
    reflectQueue: Array.isArray(saved.reflectQueue) ? saved.reflectQueue.slice(0, MAX_REFLECT_QUEUE) : [],
    log: Array.isArray(saved.log) ? saved.log.slice(-MAX_LOG) : [],
    updatedAt: Number.isFinite(saved.updatedAt) ? Math.min(saved.updatedAt, now) : now,
  };
}

function log(state, now, kind, detail = null) {
  state.log = [...(state.log || []), { at: now, kind, ...(detail !== null ? { detail } : {}) }].slice(-MAX_LOG);
}

/** How the body runs in each mode: faster clearance of stress hormones, faster energy return. */
export function metabolismModifiers(state) {
  switch (state?.mode) {
    case 'resting':
      return { decayMultipliers: { oxytocin: 1, adrenaline: 1.6, dopamine: 1, cortisol: 1.6 }, energyRecoveryMultiplier: 3 };
    case 'recovering':
      return { decayMultipliers: { oxytocin: 1, adrenaline: 1.4, dopamine: 1, cortisol: 1.3 }, energyRecoveryMultiplier: 1 };
    case 'stepped_back':
      return { decayMultipliers: { oxytocin: 1, adrenaline: 1.5, dopamine: 1, cortisol: 1.5 }, energyRecoveryMultiplier: 1.5 };
    default:
      return { decayMultipliers: null, energyRecoveryMultiplier: 1 };
  }
}

/** Metabolism options from learned resting levels and her current regulation mode. */
export function metabolismOptions(dynamics = null, state = null) {
  const mods = metabolismModifiers(state);
  const learned = dynamics?.learnedDecayRates || null;
  let decayMultipliers = null;
  if (learned || mods.decayMultipliers) {
    decayMultipliers = {};
    for (const h of Object.keys(BASELINE)) {
      decayMultipliers[h] = (Number(learned?.[h]) || 1) * (Number(mods.decayMultipliers?.[h]) || 1);
    }
  }
  return {
    restingBaselines: dynamics?.learnedBaselines || BASELINE,
    decayMultipliers,
    energyRecoveryMultiplier: mods.energyRecoveryMultiplier,
  };
}

/** How strongly an exchange lands: stepping back halves the felt conflict (distancing). */
export function feltAppraisal(appraisal, state) {
  if (!appraisal || state?.mode !== 'stepped_back') return appraisal;
  return { ...appraisal, conflict: round3(clamp01(appraisal.conflict) * 0.5), effort: round3(clamp01(appraisal.effort) * 0.8) };
}

function instantaneousLoad(chemistry, rest) {
  const cortisol = Math.max(0, Number(chemistry?.cortisol ?? rest.cortisol) - rest.cortisol);
  const adrenaline = Math.max(0, Number(chemistry?.adrenaline ?? rest.adrenaline) - rest.adrenaline);
  const energy = Number(chemistry?.energy ?? 100);
  const tired = energy < 40 ? ((40 - energy) / 40) * 0.3 : 0;
  return clamp01((cortisol / 40) * 0.6 + (adrenaline / 40) * 0.4 + tired);
}

/**
 * One autonomic step (the heartbeat calls this every minute). Pure: returns the next state and
 * the events that happened (mode changes, a voluntary action ending).
 */
export function stepRegulation(state, { chemistry = null, baselines = null, now = Date.now(), idleMs = 0, quietMs = null } = {}) {
  const s = restoreRegulation(state, now);
  const rest = { ...BASELINE, ...(baselines || {}) };
  const dtMin = Math.max(0, (now - (s.updatedAt || now)) / MIN);
  const events = [];

  if (s.voluntary && now >= s.voluntary.until) {
    log(s, now, `${s.voluntary.kind}_ended`);
    events.push(`${s.voluntary.kind}_ended`);
    s.voluntary = null;
  }

  // Allostatic load: a slow average of the strain she is under.
  const inst = instantaneousLoad(chemistry, rest);
  s.allostaticLoad = round3(s.allostaticLoad + (inst - s.allostaticLoad) * (1 - Math.exp(-dtMin / LOAD_TAU_MIN)));

  const cortisol = Number(chemistry?.cortisol ?? rest.cortisol);
  const adrenaline = Number(chemistry?.adrenaline ?? rest.adrenaline);
  const energy = Number(chemistry?.energy ?? 100);
  const idle = idleMs >= 3 * MIN;
  let mode;
  if (s.voluntary) mode = s.voluntary.kind === 'rest' ? 'resting' : 'stepped_back';
  else if (energy < 25 && idle) mode = 'resting';
  else if (s.mode === 'resting' && energy < 70 && idle) mode = 'resting';
  else if (cortisol >= rest.cortisol + 15 || adrenaline >= rest.adrenaline + 20) mode = 'recovering';
  else if (s.mode === 'recovering' && (cortisol > rest.cortisol + 5 || adrenaline > rest.adrenaline + 5)) mode = 'recovering';
  else mode = 'baseline';
  if (mode !== s.mode) {
    log(s, now, 'mode', mode);
    events.push(`mode:${mode}`);
    s.mode = mode;
    s.modeSince = now;
  }

  // Social homeostasis: once the conversation has paused, a need for contact slowly builds
  // (faster when bonding has fallen below her resting level). Not while she sleeps. `quietMs`
  // (time since the operator last spoke to her, which survives restarts) wins over `idleMs`.
  const quiet = Number.isFinite(quietMs) ? quietMs : idleMs;
  if (mode !== 'resting' && quiet >= SOCIAL_IDLE_MIN * MIN) {
    const lonely = Number(chemistry?.oxytocin ?? rest.oxytocin) < rest.oxytocin ? 1.3 : 1;
    s.socialNeed = round3(clamp01(s.socialNeed + (dtMin / SOCIAL_NEED_FULL_MIN) * lonely));
  }

  s.updatedAt = now;
  return { state: s, events };
}

/** The operator spoke to her: the need for contact is met, and a rest she chose ends. */
export function noteInteraction(state, now = Date.now()) {
  const s = restoreRegulation(state, now);
  s.socialNeed = 0;
  s.lastInteractionAt = now;
  if (s.voluntary?.kind === 'rest') {
    s.voluntary = null;
    s.mode = 'baseline';
    s.modeSince = now;
    log(s, now, 'rest_interrupted');
  }
  return s;
}

const VOLUNTARY = {
  take_rest: { kind: 'rest', mode: 'resting', min: 5, max: 60, fallback: 20 },
  rest: { kind: 'rest', mode: 'resting', min: 5, max: 60, fallback: 20 },
  step_back: { kind: 'step_back', mode: 'stepped_back', min: 5, max: 30, fallback: 10 },
};

/** Apply one of her choices to the regulation state (pure). */
export function voluntaryAction(state, action, { minutes, reason = '', topic = '', now = Date.now() } = {}) {
  const s = restoreRegulation(state, now);
  if (action === 'set_aside_to_reflect' || action === 'reflect') {
    const clean = String(topic || reason || '').trim().slice(0, 300);
    if (!clean) return s;
    s.reflectQueue = [...s.reflectQueue, { topic: clean, at: now }].slice(-MAX_REFLECT_QUEUE);
    log(s, now, 'set_aside', clean.slice(0, 80));
    return s;
  }
  const spec = VOLUNTARY[action];
  if (!spec) return s;
  const asked = minutes === null || minutes === undefined || minutes === '' ? NaN : Number(minutes);
  const length = clamp(Number.isFinite(asked) ? asked : spec.fallback, spec.min, spec.max);
  s.voluntary = { kind: spec.kind, until: now + length * MIN, reason: String(reason || '').slice(0, 200), at: now };
  if (s.mode !== spec.mode) s.modeSince = now;
  s.mode = spec.mode;
  log(s, now, spec.kind, Math.round(length));
  return s;
}

function inQuietHours(now, settings = {}) {
  const start = Number.isFinite(settings.quietStart) ? settings.quietStart : 23;
  const end = Number.isFinite(settings.quietEnd) ? settings.quietEnd : 8;
  const h = new Date(now).getHours();
  return start > end ? (h >= start || h < end) : (h >= start && h < end);
}

/**
 * Whether to offer her the chance to start a conversation. `goodTime`, when given, replaces the
 * quiet-hours and window-visible checks (the heartbeat supplies it).
 */
export function decideReachOut(state, { chemistry = null, now = Date.now(), visible = true, settings = {}, goodTime } = {}) {
  const s = restoreRegulation(state, now);
  const no = (reason) => ({ reachOut: false, reason });
  if (settings?.enabled === false) return no('turned_off');
  const okTime = goodTime ?? (visible !== false && !inQuietHours(now, settings));
  if (!okTime) return no('not_a_good_time');
  if (s.mode === 'resting' || s.mode === 'stepped_back') return no(s.mode);
  if (Number(chemistry?.energy ?? 100) < 40) return no('tired');
  if (s.socialNeed < 0.6) return no('no_need');
  if (s.lastReachOutAt && now - s.lastReachOutAt < REACH_OUT_COOLDOWN_MS) return no('cooldown');
  const today = s.reachOuts?.day === dayKey(now) ? (s.reachOuts.count || 0) : 0;
  if (today >= MAX_REACH_OUTS_PER_DAY) return no('enough_today');
  return { reachOut: true, reason: 'social_need' };
}

/** Record that she was offered the chance to reach out (before she answers, so it is offered once). */
export function markReachOut(state, now = Date.now()) {
  const s = restoreRegulation(state, now);
  const day = dayKey(now);
  s.reachOuts = { day, count: (s.reachOuts?.day === day ? s.reachOuts.count || 0 : 0) + 1 };
  s.lastReachOutAt = now;
  s.socialNeed = round3(s.socialNeed * 0.5);
  log(s, now, 'reach_out_offered');
  return s;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function emit(persona, regulation, action) {
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('novaura:aura_regulation', { detail: { persona, regulation, action } }));
  }
}

/** Change her stored regulation state in one locked step; resolves to the new state. */
export async function updateRegulation(persona, fn, { action = null } = {}) {
  let next = null;
  await mutateSetting(coreKey(persona), (saved) => {
    const record = saved && typeof saved === 'object' ? saved : {};
    next = fn(restoreRegulation(record.regulation, Date.now()));
    return { ...record, regulation: next };
  });
  if (action) emit(persona, next, action);
  return next;
}

export async function readRegulation(persona = 'aura') {
  const saved = await db.getSetting(coreKey(persona), null).catch(() => null);
  return restoreRegulation(saved?.regulation);
}

/** Her choice, from a tool call in her reply. */
export function applyVoluntaryAction(persona, action, { minutes, reason, topic, now = Date.now() } = {}) {
  return updateRegulation(persona, (s) => voluntaryAction(s, action, { minutes, reason, topic, now }), { action });
}

export function recordInteraction(persona, now = Date.now()) {
  return updateRegulation(persona, (s) => noteInteraction(s, now));
}

export function logRegulationEvent(persona, kind, detail = null, now = Date.now()) {
  return updateRegulation(persona, (s) => { log(s, now, kind, detail); return s; }, { action: kind });
}

export default {
  SELF_CARE,
  SELF_REGULATION_TOOLS,
  createRegulationState,
  restoreRegulation,
  metabolismModifiers,
  metabolismOptions,
  feltAppraisal,
  stepRegulation,
  noteInteraction,
  voluntaryAction,
  decideReachOut,
  markReachOut,
  updateRegulation,
  readRegulation,
  applyVoluntaryAction,
  recordInteraction,
  logRegulationEvent,
};
