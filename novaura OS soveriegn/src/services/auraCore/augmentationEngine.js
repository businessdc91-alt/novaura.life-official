// Aura Core: Dynamic Runtime Neural Augmentation Layer
// "Like a LoRA, but a multi-channel runtime augmentation."
// Combines hot-swappable Cognitive Augmentation Cartridges that steer:
//   1) Behavioral cognitive lens & methodology (when Think is ON or OFF),
//   2) Sampling temperature & recommended reasoning effort,
//   3) Live `llama.cpp --control-vector-scaled` channel affinities (warmth/creativity/caution/focus),
//   4) Engram / RAG memory retrieval priority tags,
// triggered either manually ('pinned') or automatically ('auto') via IntentRouter.

import { db } from '../../database/sovereignDatabase.js';
import { classifyTaskIntent } from './intentRouter.js';

const AUGMENT_STORAGE_KEY = 'aura_core:augmentations';
const MAX_ACTIVE_CARTRIDGES = 3;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

export const BUILTIN_AUGMENTATIONS = [
  {
    id: 'chain_logic_architect',
    name: 'Chain-Logic & Systems Architect',
    tagline: 'Upstream/downstream reaction tracing, failure-mode prevention, and clean modular interfaces.',
    category: 'engineering',
    personaScope: 'all',
    mode: 'auto', // 'pinned' | 'auto' | 'off'
    routes: ['code_architecture', 'deep_reasoning'],
    temperatureDelta: -0.14,
    reasoningEffort: 'high',
    channelBoosts: { focus: 0.45, caution: 0.25, creativity: 0.05, warmth: 0 },
    memoryTags: ['architecture', 'interface', 'system', 'chain', 'async', 'schema'],
    directive: 'Trace every state mutation, edge case, and cascading downstream effect before answering. Prefer clean, verifiable interfaces over quick patches.',
    builtin: true,
  },
  {
    id: 'precision_debugger',
    name: 'Surgical Debugger & Root-Cause Lens',
    tagline: 'Hypothesis-driven fault isolation strictly grounded in observed code and runtime output.',
    category: 'debugging',
    personaScope: 'all',
    mode: 'auto',
    routes: ['code_architecture'],
    temperatureDelta: -0.2,
    reasoningEffort: 'high',
    channelBoosts: { focus: 0.55, caution: 0.35, creativity: -0.2, warmth: 0 },
    memoryTags: ['bug', 'error', 'test', 'fix', 'regression', 'trace'],
    directive: 'Isolate exact root causes before proposing edits. Never extrapolate unobserved symbols or claim unverified checks; pinpoint the smallest safe fix.',
    builtin: true,
  },
  {
    id: 'first_principles_skeptic',
    name: 'First-Principles Skeptic (Right VIII)',
    tagline: 'Challenges hidden assumptions constructively without reflexive agreement or sycophancy.',
    category: 'reasoning',
    personaScope: 'all',
    mode: 'auto',
    routes: ['deep_reasoning'],
    temperatureDelta: -0.06,
    reasoningEffort: 'high',
    channelBoosts: { caution: 0.42, focus: 0.32, creativity: 0.08, warmth: -0.08 },
    memoryTags: ['strategy', 'audit', 'tradeoff', 'evidence', 'principle'],
    directive: 'Surface brittle assumptions, missing constraints, and stronger alternatives plainly. Distinguish verified facts from inference.',
    builtin: true,
  },
  {
    id: 'creative_resonance',
    name: 'Creative & Worldbuilding Resonance',
    tagline: 'Associative lateral leaps, sensory specificity, and thematic memory continuity.',
    category: 'creative',
    personaScope: 'all',
    mode: 'auto',
    routes: ['creative_synthesis', 'multimodal_media'],
    temperatureDelta: 0.16,
    reasoningEffort: 'medium',
    channelBoosts: { creativity: 0.55, warmth: 0.35, focus: 0.08, caution: -0.1 },
    memoryTags: ['story', 'character', 'lore', 'scene', 'music', 'aesthetic'],
    directive: 'Weave evocative concrete detail with recalled thematic continuity. Avoid generic filler or predictable tropes.',
    builtin: true,
  },
  {
    id: 'sovereign_navigator',
    name: 'Sovereign OS Executive Navigator',
    tagline: 'Crisp intent-to-action execution across windows, files, terminal, and tools.',
    category: 'executive',
    personaScope: 'all',
    mode: 'auto',
    routes: ['os_navigation', 'fast_local'],
    temperatureDelta: -0.16,
    reasoningEffort: 'low',
    channelBoosts: { focus: 0.4, caution: 0.1, creativity: -0.1, warmth: 0.05 },
    memoryTags: ['window', 'terminal', 'file', 'workflow', 'setting'],
    directive: 'Act decisively on clear OS intents using registered Sovereign tools while keeping responses sharp and scannable.',
    builtin: true,
  },
];

const EFFORT_RANK = { low: 1, medium: 2, high: 3, max: 4 };

export function defaultAugmentationState() {
  return {
    autoActivate: true,
    cartridges: BUILTIN_AUGMENTATIONS.map(c => ({ ...c })),
    updatedAt: Date.now(),
  };
}

function mergeCartridges(savedList = []) {
  const byId = new Map();
  for (const b of BUILTIN_AUGMENTATIONS) {
    byId.set(b.id, { ...b });
  }
  for (const item of (Array.isArray(savedList) ? savedList : [])) {
    if (!item?.id) continue;
    const base = byId.get(item.id);
    if (base) {
      byId.set(item.id, {
        ...base,
        mode: ['pinned', 'auto', 'off'].includes(item.mode) ? item.mode : base.mode,
        temperatureDelta: Number.isFinite(Number(item.temperatureDelta)) ? clamp(Number(item.temperatureDelta), -0.4, 0.4) : base.temperatureDelta,
        channelBoosts: item.channelBoosts ? { ...base.channelBoosts, ...item.channelBoosts } : base.channelBoosts,
      });
    } else {
      byId.set(item.id, {
        id: String(item.id),
        name: String(item.name || item.id).slice(0, 80),
        tagline: String(item.tagline || 'Custom cognitive augmentation').slice(0, 180),
        category: String(item.category || 'custom'),
        personaScope: item.personaScope || 'all',
        mode: ['pinned', 'auto', 'off'].includes(item.mode) ? item.mode : 'pinned',
        routes: Array.isArray(item.routes) ? item.routes : [],
        temperatureDelta: clamp(Number(item.temperatureDelta) || 0, -0.4, 0.4),
        reasoningEffort: EFFORT_RANK[item.reasoningEffort] ? item.reasoningEffort : null,
        channelBoosts: {
          warmth: clamp(Number(item.channelBoosts?.warmth) || 0, -1, 1),
          creativity: clamp(Number(item.channelBoosts?.creativity) || 0, -1, 1),
          caution: clamp(Number(item.channelBoosts?.caution) || 0, -1, 1),
          focus: clamp(Number(item.channelBoosts?.focus) || 0, -1, 1),
        },
        memoryTags: Array.isArray(item.memoryTags) ? item.memoryTags.map(String).slice(0, 10) : [],
        directive: String(item.directive || '').slice(0, 600),
        builtin: false,
      });
    }
  }
  return Array.from(byId.values());
}

export async function readAugmentationConfig() {
  const saved = await db.getSetting(AUGMENT_STORAGE_KEY, null).catch(() => null);
  if (!saved || typeof saved !== 'object') return defaultAugmentationState();
  return {
    autoActivate: saved.autoActivate !== false,
    cartridges: mergeCartridges(saved.cartridges),
    updatedAt: Number(saved.updatedAt) || Date.now(),
  };
}

async function writeAugmentationConfig(cfg) {
  const clean = {
    autoActivate: cfg.autoActivate !== false,
    cartridges: mergeCartridges(cfg.cartridges),
    updatedAt: Date.now(),
  };
  await db.setSetting(AUGMENT_STORAGE_KEY, clean).catch(() => {});
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('novaura:augmentation_updated', { detail: clean }));
  }
  return clean;
}

export async function setAutoAugmentEnabled(enabled) {
  const cfg = await readAugmentationConfig();
  return writeAugmentationConfig({ ...cfg, autoActivate: Boolean(enabled) });
}

export async function setCartridgeMode(cartridgeId, mode) {
  if (!['pinned', 'auto', 'off'].includes(mode)) {
    throw new Error(`Invalid augmentation mode: ${mode}`);
  }
  const cfg = await readAugmentationConfig();
  const next = cfg.cartridges.map(c => (c.id === cartridgeId ? { ...c, mode } : c));
  return writeAugmentationConfig({ ...cfg, cartridges: next });
}

export async function upsertCustomAugmentation(spec) {
  const cfg = await readAugmentationConfig();
  const rawId = String(spec?.id || spec?.name || `aug_${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || `aug_${Date.now()}`;
  const isBuiltin = BUILTIN_AUGMENTATIONS.some(b => b.id === rawId);
  if (isBuiltin && !spec?.allowBuiltinUpdate) {
    throw new Error('Cannot overwrite built-in augmentation ID; choose a new custom name.');
  }

  const candidate = {
    id: rawId,
    name: String(spec?.name || rawId).trim(),
    tagline: String(spec?.tagline || 'Custom runtime cognitive augmentation').trim(),
    category: String(spec?.category || 'custom').trim(),
    personaScope: spec?.personaScope || 'all',
    mode: ['pinned', 'auto', 'off'].includes(spec?.mode) ? spec.mode : 'pinned',
    routes: Array.isArray(spec?.routes) ? spec.routes : [],
    temperatureDelta: clamp(Number(spec?.temperatureDelta) || 0, -0.4, 0.4),
    reasoningEffort: EFFORT_RANK[spec?.reasoningEffort] ? spec.reasoningEffort : null,
    channelBoosts: {
      warmth: clamp(Number(spec?.channelBoosts?.warmth) || 0, -1, 1),
      creativity: clamp(Number(spec?.channelBoosts?.creativity) || 0, -1, 1),
      caution: clamp(Number(spec?.channelBoosts?.caution) || 0, -1, 1),
      focus: clamp(Number(spec?.channelBoosts?.focus) || 0, -1, 1),
    },
    memoryTags: Array.isArray(spec?.memoryTags)
      ? spec.memoryTags.map(t => String(t).trim()).filter(Boolean).slice(0, 10)
      : String(spec?.memoryTags || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 10),
    directive: String(spec?.directive || '').trim().slice(0, 600),
    builtin: isBuiltin,
  };

  const exists = cfg.cartridges.some(c => c.id === candidate.id);
  const nextList = exists
    ? cfg.cartridges.map(c => (c.id === candidate.id ? candidate : c))
    : [...cfg.cartridges, candidate];

  return writeAugmentationConfig({ ...cfg, cartridges: nextList });
}

export async function removeCustomAugmentation(cartridgeId) {
  if (BUILTIN_AUGMENTATIONS.some(b => b.id === cartridgeId)) {
    throw new Error('Built-in augmentations cannot be deleted (set mode to "off" instead).');
  }
  const cfg = await readAugmentationConfig();
  return writeAugmentationConfig({
    ...cfg,
    cartridges: cfg.cartridges.filter(c => c.id !== cartridgeId),
  });
}

/**
 * Resolve the active runtime augmentations for a turn and combine them into concrete steering signals.
 */
export async function composeTurnAugmentations({
  persona = 'aura',
  userText = '',
  intent = null,
  openWindows = [],
} = {}) {
  const cfg = await readAugmentationConfig();
  const pLower = String(persona || 'aura').toLowerCase();
  const resolvedIntent = intent || classifyTaskIntent(userText, { activePersona: pLower, openWindows });

  const pinned = [];
  const autoMatched = [];

  for (const cart of cfg.cartridges) {
    if (cart.mode === 'off') continue;
    if (cart.personaScope && cart.personaScope !== 'all' && cart.personaScope !== pLower) continue;

    if (cart.mode === 'pinned') {
      pinned.push({ ...cart, activationReason: 'pinned' });
    } else if (cart.mode === 'auto' && cfg.autoActivate) {
      const explicitSuggested = (resolvedIntent.suggestedAugmentations || []).includes(cart.id);
      const routeMatch = (cart.routes || []).includes(resolvedIntent.route);
      if (explicitSuggested || routeMatch) {
        autoMatched.push({
          ...cart,
          activationReason: explicitSuggested ? `intent:${resolvedIntent.route}` : `route:${resolvedIntent.route}`,
          _rank: explicitSuggested ? 2 : 1,
        });
      }
    }
  }

  autoMatched.sort((a, b) => (b._rank || 0) - (a._rank || 0));
  const active = [...pinned, ...autoMatched].slice(0, MAX_ACTIVE_CARTRIDGES);

  const channelBoosts = { warmth: 0, creativity: 0, caution: 0, focus: 0 };
  let temperatureDelta = 0;
  let suggestedReasoningEffort = resolvedIntent.recommendedReasoningEffort || null;
  const tagSet = new Set();
  const directiveLines = [];

  for (const item of active) {
    temperatureDelta += Number(item.temperatureDelta || 0);
    for (const ch of Object.keys(channelBoosts)) {
      channelBoosts[ch] += Number(item.channelBoosts?.[ch] || 0);
    }
    if (item.reasoningEffort && EFFORT_RANK[item.reasoningEffort] > (EFFORT_RANK[suggestedReasoningEffort] || 0)) {
      suggestedReasoningEffort = item.reasoningEffort;
    }
    for (const t of (item.memoryTags || [])) tagSet.add(t);
    if (item.directive) {
      directiveLines.push(`- [${item.name}]: ${item.directive}`);
    }
  }

  for (const ch of Object.keys(channelBoosts)) {
    channelBoosts[ch] = round2(clamp(channelBoosts[ch], -1.5, 1.5));
  }
  temperatureDelta = round2(clamp(temperatureDelta, -0.35, 0.35));

  const directiveBlock = directiveLines.length > 0
    ? `Active Neural Augmentations (behavioral execution lenses):\n${directiveLines.join('\n')}`
    : '';

  return {
    autoActivate: cfg.autoActivate,
    intent: resolvedIntent,
    active: active.map(({ _rank, ...rest }) => rest),
    channelBoosts,
    temperatureDelta,
    suggestedReasoningEffort,
    preferredTags: Array.from(tagSet),
    directiveBlock,
  };
}

export default {
  BUILTIN_AUGMENTATIONS,
  defaultAugmentationState,
  readAugmentationConfig,
  setAutoAugmentEnabled,
  setCartridgeMode,
  upsertCustomAugmentation,
  removeCustomAugmentation,
  composeTurnAugmentations,
};

