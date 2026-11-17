// Aura Core: Multi-Brain Intent Router & Autonomy Classifier
// (Port of AuraKernel_CPP/Cognition/MultiBrainRouter.cpp + Aura_Autonomy_Layer.py).
// Classifies user intent dynamically to route models, reasoning depth, and Runtime Augmentations
// across fast-local execution, code architecture, deep reasoning, creative synthesis, and media.
//
// `matched` says whether the text carried a real task signal. Fallback lanes (a short or long
// message with no task words) still route, but augmentation lenses only fire on a match.

import { extractJson } from './appraisal.js';

export const AUTONOMY_LEVELS = {
  SUPERVISED: 0,
  SEMI_AUTONOMOUS: 1,
  FULLY_AUTONOMOUS: 2,
};

export const BRAIN_ROUTES = {
  fast_local: {
    id: 'fast_local',
    label: 'Fast Local Executive',
    recommendedPersona: 'nova',
    recommendedProviderLane: 'local_fast',
    recommendedReasoningEffort: 'low',
    defaultAugmentations: ['sovereign_navigator'],
  },
  os_navigation: {
    id: 'os_navigation',
    label: 'OS Intent & Tool Execution',
    recommendedPersona: 'nova',
    recommendedProviderLane: 'local_fast',
    recommendedReasoningEffort: 'low',
    defaultAugmentations: ['sovereign_navigator'],
  },
  code_architecture: {
    id: 'code_architecture',
    label: 'Systems & Code Architecture',
    recommendedPersona: 'cybeni',
    recommendedProviderLane: 'code_specialist',
    recommendedReasoningEffort: 'high',
    defaultAugmentations: ['chain_logic_architect', 'precision_debugger'],
  },
  deep_reasoning: {
    id: 'deep_reasoning',
    label: 'First-Principles Deep Reasoning',
    recommendedPersona: 'aura',
    recommendedProviderLane: 'deep_reasoning',
    recommendedReasoningEffort: 'high',
    defaultAugmentations: ['first_principles_skeptic'],
  },
  creative_synthesis: {
    id: 'creative_synthesis',
    label: 'Creative Resonance & Lore',
    recommendedPersona: 'aura',
    recommendedProviderLane: 'creative_synthesis',
    recommendedReasoningEffort: 'medium',
    defaultAugmentations: ['creative_resonance'],
  },
  multimodal_media: {
    id: 'multimodal_media',
    label: 'Image, Video & Audio Generation',
    recommendedPersona: 'aura',
    recommendedProviderLane: 'media_foundry',
    recommendedReasoningEffort: 'low',
    defaultAugmentations: ['creative_resonance'],
  },
};

const ROUTE_PATTERNS = [
  {
    route: 'multimodal_media',
    weight: 1.0,
    re: /\b(generate (an? )?(image|video|picture|song|track|audio|avatar)|comfyui|imagen|veo|flux|diffusion|render scene|draw me)\b/i,
    reason: 'Media synthesis keywords detected (image/video/audio pipeline).',
  },
  {
    route: 'os_navigation',
    weight: 0.95,
    re: /\b(open (the )?(terminal|files|browser|settings|cybeni|hypervisor|mind lab|shield|sentinel|forge|arcade)|close window|list windows|run (command|terminal)|save file|read file)\b/i,
    reason: 'Direct Sovereign OS window, filesystem, or terminal intent detected.',
  },
  {
    route: 'code_architecture',
    weight: 0.92,
    // Words that only mean code count at once; everyday words that also mean code ("error",
    // "react", "function") need a second one, so "how did that make you react?" is not code.
    re: /\b(stack ?trace|traceback|exception|segfault|compil(?:e|er|es|ed|ing)|cargo|rustc|npm|vite|webpack|javascript|typescript|jsx|tsx|tauri|refactor\w*|unit tests?|ipc|regression|debug(?:ger|ging)?|syntax error|null pointer|react ?(?:component|hook|state|props|js)|\w+\.(?:js|ts|rs|py|jsx|tsx|json))\b|```/i,
    weak: /\b(bug|error|function|algorithm|schema|architecture|async|react|rust|code|crash|api|endpoint|build)\b/gi,
    reason: 'Engineering, debugging, or systems architecture terminology detected.',
  },
  {
    route: 'creative_synthesis',
    weight: 0.88,
    re: /\b(story|novel|worldbuild|lore|poem|lyrics|character|dialogue|chapter|scene|brainstorm|imagine|metaphor|aesthetic)\b/i,
    reason: 'Narrative, worldbuilding, or creative writing signals detected.',
  },
  {
    route: 'deep_reasoning',
    weight: 0.86,
    re: /\b(analyze|compare|trade-?off|evaluate|audit|strategy|why does|first principles|prove|critique|philosophy|consciousness|pros and cons|design plan)\b/i,
    reason: 'Multi-step analytical, strategic, or critique task detected.',
  },
];

const ROUTER_SCHEMA = {
  type: 'object',
  properties: {
    route: { type: 'string', enum: Object.keys(BRAIN_ROUTES) },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    suggestedAugmentations: { type: 'array', items: { type: 'string' } },
  },
  required: ['route', 'confidence', 'reasoning'],
  additionalProperties: false,
};

/**
 * Deterministic sub-millisecond intent classification across Sovereign's cognitive lanes.
 */
export function classifyTaskIntent(userText = '', { activePersona = 'aura', openWindows = [] } = {}) {
  const text = String(userText || '').trim();
  if (!text) {
    return {
      ...BRAIN_ROUTES.fast_local,
      route: 'fast_local',
      confidence: 0.5,
      reasoning: 'Empty prompt defaults to fast local standby.',
      recommendedReasoningEffort: null,
      suggestedAugmentations: [],
      matched: false,
      requiredAutonomyLevel: AUTONOMY_LEVELS.SUPERVISED,
      source: 'deterministic',
    };
  }

  let best = null;
  const scores = new Map();

  for (const rule of ROUTE_PATTERNS) {
    let matches = text.match(new RegExp(rule.re.source, 'gi'));
    if (!matches?.length && rule.weak) {
      const weak = new Set((text.match(rule.weak) || []).map(w => w.toLowerCase()));
      matches = weak.size >= 2 ? [...weak] : null;
    }
    if (matches?.length) {
      const score = rule.weight + Math.min(0.25, (matches.length - 1) * 0.08);
      scores.set(rule.route, { score, reason: rule.reason });
      if (!best || score > best.score) {
        best = { route: rule.route, score, reason: rule.reason, matched: true };
      }
    }
  }

  // Context window bonus: if Cybeni or Literature is currently open and query is ambiguous
  if (!best && Array.isArray(openWindows) && openWindows.length > 0) {
    const appTypes = new Set(openWindows.map(w => String(w?.appType || '').toLowerCase()));
    if (appTypes.has('cybeni') && text.length > 40) {
      best = { route: 'code_architecture', score: 0.68, reason: 'Active Cybeni IDE workspace context.', matched: true };
    } else if (appTypes.has('literature') && text.length > 40) {
      best = { route: 'creative_synthesis', score: 0.66, reason: 'Active Literature workspace context.', matched: true };
    }
  }

  // Length & conversational heuristic when no explicit keyword fired
  if (!best) {
    if (text.length <= 65 && activePersona === 'nova') {
      best = { route: 'fast_local', score: 0.72, reason: 'Short conversational or executive turn.' };
    } else if (text.length > 180) {
      best = { route: 'deep_reasoning', score: 0.65, reason: 'Extended multi-clause query warrants deep reasoning.' };
    } else {
      best = {
        route: activePersona === 'aura' ? 'creative_synthesis' : 'fast_local',
        score: 0.6,
        reason: `Aligned with active ${activePersona} companion lane.`,
      };
    }
  }

  // Check if debugging words coexist with code architecture so precision_debugger takes priority
  const spec = BRAIN_ROUTES[best.route] || BRAIN_ROUTES.fast_local;
  const suggested = [...spec.defaultAugmentations];
  if (best.route === 'code_architecture') {
    const isDebug = /\b(bug|error|fail|crash|exception|broken|stack trace|fix)\b/i.test(text);
    suggested.splice(0, suggested.length, ...(isDebug
      ? ['precision_debugger', 'chain_logic_architect']
      : ['chain_logic_architect']));
  }

  // Determine required autonomy tier for mutating OS requests
  const mutatingIntent = /\b(create|write|delete|remove|edit|modify|run|execute|install|terminal)\b/i.test(text);
  const requiredAutonomyLevel = mutatingIntent
    ? AUTONOMY_LEVELS.SEMI_AUTONOMOUS
    : AUTONOMY_LEVELS.SUPERVISED;

  return {
    route: spec.id,
    label: spec.label,
    confidence: Math.round(Math.min(0.98, best.score) * 100) / 100,
    reasoning: best.reason,
    recommendedPersona: spec.recommendedPersona,
    recommendedProviderLane: spec.recommendedProviderLane,
    recommendedReasoningEffort: best.matched ? spec.recommendedReasoningEffort : null,
    suggestedAugmentations: best.matched ? suggested : [],
    matched: Boolean(best.matched),
    requiredAutonomyLevel,
    source: 'deterministic',
  };
}

/**
 * Optional AI-assisted classification using fastest active model (mirroring MultiBrainRouter.cpp)
 * with zero-latency fallback to classifyTaskIntent().
 */
export async function classifyTaskIntentWithAi({
  userText = '',
  activePersona = 'aura',
  openWindows = [],
  ai = null,
} = {}) {
  const baseline = classifyTaskIntent(userText, { activePersona, openWindows });
  if (!ai || typeof ai.chat !== 'function' || !String(userText || '').trim()) {
    return baseline;
  }

  try {
    const raw = await ai.chat([
      {
        role: 'system',
        content: 'Classify this user request into one cognitive routing lane. Reply with JSON only.',
      },
      {
        role: 'user',
        content: `Routes: ${Object.keys(BRAIN_ROUTES).join(', ')}.\nRequest: "${String(userText).slice(0, 500)}"`,
      },
    ], {
      persona: 'nova',
      useRag: false,
      noCache: true,
      temperature: 0,
      maxTokens: 120,
      strictMaxTokens: true,
      think: false,
      reasoningEffort: 'none',
      jsonSchema: ROUTER_SCHEMA,
    });
    const parsed = typeof raw === 'string' ? extractJson(raw, ['route']) : raw;
    if (parsed && BRAIN_ROUTES[parsed.route]) {
      const spec = BRAIN_ROUTES[parsed.route];
      return {
        ...baseline,
        route: spec.id,
        label: spec.label,
        confidence: Math.round(Math.max(0.2, Math.min(1, Number(parsed.confidence) || baseline.confidence)) * 100) / 100,
        reasoning: String(parsed.reasoning || baseline.reasoning).slice(0, 180),
        recommendedPersona: spec.recommendedPersona,
        recommendedProviderLane: spec.recommendedProviderLane,
        recommendedReasoningEffort: spec.recommendedReasoningEffort,
        suggestedAugmentations: Array.isArray(parsed.suggestedAugmentations) && parsed.suggestedAugmentations.length
          ? parsed.suggestedAugmentations.slice(0, 3)
          : spec.defaultAugmentations,
        matched: baseline.matched || (Number(parsed.confidence) || 0) >= 0.6,
        source: 'ai_classifier',
      };
    }
  } catch {
    // Seamless deterministic fallback
  }
  return baseline;
}

export default {
  AUTONOMY_LEVELS,
  BRAIN_ROUTES,
  classifyTaskIntent,
  classifyTaskIntentWithAi,
};

