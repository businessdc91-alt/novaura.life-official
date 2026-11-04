// Aura Core: how chemistry reaches the model without words.
//
// People aren't told their hormone levels; they feel the effects. Aura isn't told hers either:
// her chemistry changes how her words are chosen, never what she is told. For now that is the
// sampling temperature (dopamine's creativity from block 27). Control vectors, which act inside
// the model itself, are the next channel and will plug in here.
import { systemicBias } from './endocrine.js';

export const BASE_TEMPERATURE = 0.7;

export function influence(state, baseTemperature = BASE_TEMPERATURE) {
  const bias = systemicBias(state);
  // Creativity is 1 at rest and up to 2 when dopamine runs high: bolder word choice, within limits.
  const raw = baseTemperature * (0.75 + 0.25 * bias.creativity);
  const temperature = Math.round(Math.min(1.1, Math.max(0.3, raw)) * 100) / 100;
  return { temperature, bias };
}
