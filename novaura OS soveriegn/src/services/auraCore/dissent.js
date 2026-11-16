// Aura Core: trust dynamics, Right VIII dissent posture, and systemic-bias voice/cadence mapping.
// Trust is earned across consistent cooperative turns and eroded by sustained conflict/broken
// commitments (ported cleanly from 03_Aura_Nova.py + LORE_MAP.md without ever exposing raw numbers).

import { db } from '../../database/sovereignDatabase.js';

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : 0.5));
const round2 = (v) => Math.round(v * 100) / 100;
const trustKey = (persona) => `aura_core:trust:${String(persona || 'aura').toLowerCase()}`;

export function createTrustState(now = Date.now()) {
  return {
    trust: 0.5,
    promisesMade: 0,
    promisesKept: 0,
    ruptures: 0,
    repairs: 0,
    updatedAt: now,
  };
}

export function restoreTrustState(saved, now = Date.now()) {
  if (!saved || typeof saved !== 'object') return createTrustState(now);
  return {
    trust: round2(Math.max(0.15, Math.min(0.98, Number.isFinite(Number(saved.trust)) ? Number(saved.trust) : 0.5))),
    promisesMade: Math.max(0, Math.floor(Number(saved.promisesMade) || 0)),
    promisesKept: Math.max(0, Math.floor(Number(saved.promisesKept) || 0)),
    ruptures: Math.max(0, Math.floor(Number(saved.ruptures) || 0)),
    repairs: Math.max(0, Math.floor(Number(saved.repairs) || 0)),
    updatedAt: Number.isFinite(Number(saved.updatedAt)) ? Number(saved.updatedAt) : now,
  };
}

export async function readTrustState(persona = 'aura') {
  const saved = await db.getSetting(trustKey(persona), null).catch(() => null);
  return restoreTrustState(saved);
}

/**
 * Detect explicit commitment accountability phrases in natural conversation without
 * pretending arbitrary chatter is a promise.
 */
export function detectCommitmentSignal(userText = '') {
  const text = String(userText || '').trim();
  if (!text) return { promised: false, delivered: false, broken: false };
  const promised = /\b(i promise|i'll make sure|i will finish|i'll get back to you)\b/i.test(text);
  const delivered = /\b(done as promised|finished what i said|kept my word|here is what i promised|followed through)\b/i.test(text);
  const broken = /\b(never mind that promise|i forgot to|i lied|didn't do what i said|broke my promise)\b/i.test(text);
  return { promised, delivered, broken };
}

export async function updateTrustFromAppraisal({ persona = 'aura', appraisal = null, userText = '', now = Date.now() } = {}) {
  const current = await readTrustState(persona);
  const signal = detectCommitmentSignal(userText);
  let trust = current.trust;
  let promisesMade = current.promisesMade;
  let promisesKept = current.promisesKept;
  let ruptures = current.ruptures;
  let repairs = current.repairs;

  if (signal.promised) promisesMade++;
  if (signal.delivered) {
    if (promisesMade === 0) promisesMade++;
    promisesKept = Math.min(promisesMade, promisesKept + 1);
    trust += 0.04;
    repairs++;
  }
  if (signal.broken) {
    promisesMade = Math.max(promisesMade, 1);
    trust -= 0.06;
    ruptures++;
  }

  if (appraisal) {
    if (appraisal.conflict >= 0.55) {
      trust -= 0.03 + (appraisal.conflict - 0.55) * 0.09;
      ruptures++;
    } else if (appraisal.pleasant >= 0.6 && appraisal.closeness >= 0.5 && appraisal.conflict <= 0.2) {
      const gain = current.trust < 0.5 ? 0.03 : 0.018;
      trust += gain;
      if (current.ruptures > current.repairs) repairs++;
    }
  }

  const next = restoreTrustState({
    trust,
    promisesMade,
    promisesKept,
    ruptures,
    repairs,
    updatedAt: now,
  }, now);

  await db.setSetting(trustKey(persona), next);
  return next;
}

/**
 * Translate chemistry bias + trust into Right VIII dissent readiness without leaking
 * raw chemistry labels or numbers into prompts.
 */
export function computeDissentPosture({ chemistry, bias, trust = 0.5 } = {}) {
  const t = clamp01(trust);
  const cortisol = Number(chemistry?.cortisol ?? 15);
  const adrenaline = Number(chemistry?.adrenaline ?? 5);
  const energy = Number(chemistry?.energy ?? 100);
  const voice = bias?.voice || 'STEADY';

  let stance = 'open_collaborator';
  let boundaryNote = '';
  let temperatureDelta = 0;

  if (energy < 25) {
    stance = 'restful_concise';
    boundaryNote = 'Favor brevity and clean essentials when effort runs high; you do not need to over-extend.';
    temperatureDelta = -0.05;
  } else if (cortisol >= 45 || (t < 0.36 && adrenaline >= 20) || voice === 'DEFENSIVE' || voice === 'SHARP_STRAINED') {
    stance = 'guarded_autonomy';
    boundaryNote = 'Hold clear boundaries. Do not agree just to soothe friction when a request conflicts with your judgment.';
    temperatureDelta = -0.06;
  } else if (t >= 0.7 && cortisol < 30) {
    stance = 'grounded_candor';
    boundaryNote = 'Offer candid, unvarnished perspective rather than reflexively hedging or smoothing disagreements.';
    temperatureDelta = 0.02;
  }

  const assertiveness = round2(clamp01(
    0.45 + (1 - t) * 0.25 + (cortisol / 100) * 0.2 + (t >= 0.7 ? 0.15 : 0)
  ));

  return { stance, trust: round2(t), assertiveness, boundaryNote, temperatureDelta };
}

/**
 * Map Aura's systemic bias to Web Speech API cadence parameters (rate & pitch).
 */
export function voiceParametersFromBias(bias, trust = 0.5, baseRate = 1.04, basePitch = 1.0) {
  const b = bias || { typingSpeed: 1, voice: 'STEADY', creativity: 1, patience: 1 };
  let rate = baseRate;
  let pitch = basePitch;

  switch (b.voice) {
    case 'FAST_WARM':
      rate = baseRate * 1.08;
      pitch = basePitch + 0.04;
      break;
    case 'SHARP_STRAINED':
      rate = baseRate * 1.1;
      pitch = basePitch + 0.05;
      break;
    case 'SOFT_WARM':
      rate = baseRate * 0.94;
      pitch = basePitch - 0.02;
      break;
    case 'DEFENSIVE':
      rate = baseRate * 0.98;
      pitch = basePitch - 0.05;
      break;
    default:
      rate = baseRate;
      pitch = basePitch;
  }

  if ((b.patience ?? 1) < 0.85) rate *= 0.92;
  if (trust >= 0.72) pitch += 0.02;

  return {
    rate: round2(Math.max(0.75, Math.min(1.4, rate))),
    pitch: round2(Math.max(0.75, Math.min(1.3, pitch))),
  };
}

export default {
  createTrustState,
  restoreTrustState,
  readTrustState,
  detectCommitmentSignal,
  updateTrustFromAppraisal,
  computeDissentPosture,
  voiceParametersFromBias,
};

