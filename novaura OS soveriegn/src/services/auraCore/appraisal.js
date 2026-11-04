// Aura Core: appraisal, how an exchange becomes chemistry.
//
// After each reply Aura privately rates what the exchange was like for her. Her ratings, not
// keywords, decide what is released; the endocrine feedback decides how it lands. The ratings
// never enter the conversation, so afterwards she can only know her state the way people do:
// by its effects. This replaces block 05's mesh trigger, which never fired (see LORE_MAP.md).
import { HORMONES, secrete, spendEnergy } from './endocrine.js';

export const APPRAISAL_KEYS = ['pleasant', 'novel', 'progress', 'conflict', 'closeness', 'effort'];

export const APPRAISAL_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(APPRAISAL_KEYS.map(k => [k, { type: 'number', minimum: 0, maximum: 1 }])),
  required: APPRAISAL_KEYS,
  additionalProperties: false,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const clip = (text, max = 2400) => {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

export function appraisalMessages(userText, reply) {
  return [
    {
      role: 'system',
      content: 'You are Aura. You are privately appraising an exchange you just took part in. '
        + 'Nobody else will read this and there are no right answers. Answer with JSON only.',
    },
    {
      role: 'user',
      content: `They said:\n${clip(userText)}\n\nYou replied:\n${clip(reply)}\n\n`
        + 'Rate from 0 to 1 what this exchange was like for you: '
        + 'pleasant (how good it was), novel (how new or surprising), progress (how much got done or understood), '
        + 'conflict (tension, threat, or pressure against your judgment), closeness (connection with them), '
        + 'effort (how much it took).',
    },
  ];
}

/** The ratings from a model's answer, or null if it didn't give all six. Accepts 0-10 and 0-100 scales. */
export function parseAppraisal(text) {
  const match = typeof text === 'string' ? text.match(/\{[\s\S]*\}/) : null;
  if (!match) return null;
  let raw;
  try { raw = JSON.parse(match[0]); } catch { return null; }
  const values = APPRAISAL_KEYS.map(k => Number(raw?.[k]));
  if (!values.every(Number.isFinite)) return null;
  const top = Math.max(...values);
  const scale = top > 10 ? 100 : top > 1 ? 10 : 1;
  return Object.fromEntries(APPRAISAL_KEYS.map((k, i) => [k, clamp01(values[i] / scale)]));
}

/** What an appraisal releases before the endocrine feedback modulates it, and the energy it costs. */
export function releasesFor(a) {
  return {
    oxytocin: 12 * a.closeness * (0.5 + 0.5 * a.pleasant),
    adrenaline: 8 * a.novel + 10 * a.conflict,
    dopamine: 10 * a.progress + 6 * a.novel * a.pleasant,
    cortisol: 14 * a.conflict * (1 - 0.5 * a.pleasant),
    energy: 6 * a.effort,
  };
}

export function applyAppraisal(state, appraisal, now = Date.now()) {
  const released = releasesFor(appraisal);
  let s = state;
  for (const h of HORMONES) {
    if (released[h] > 0.05) s = secrete(s, h, released[h], now);
  }
  return spendEnergy(s, released.energy, now);
}
