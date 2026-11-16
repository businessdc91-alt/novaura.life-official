// Persistent configuration for model thinking (`think`) and reasoning depth (`reasoning_effort`).
// Default is Think ON at Medium effort so capable reasoning models think unless explicitly dialed
// down in a model picker submenu or constrained for strict short-budget JSON tasks.

const STORAGE_KEY = 'novaura_reasoning_config_v1';

export const REASONING_EFFORTS = ['none', 'low', 'medium', 'high', 'max'];

export const REASONING_EFFORT_INFO = {
  none: { id: 'none', label: 'Off', short: 'Off', hint: 'Direct answer without internal thinking' },
  low: { id: 'low', label: 'Low', short: 'Low', hint: 'Quick reasoning pass (~1k token budget)' },
  medium: { id: 'medium', label: 'Medium', short: 'Med', hint: 'Balanced depth & speed (~4k budget)' },
  high: { id: 'high', label: 'High', short: 'High', hint: 'Deep multi-step reasoning (~8k budget)' },
  max: { id: 'max', label: 'Max', short: 'Max', hint: 'Maximum reasoning headroom (~16k budget)' },
};

export const DEFAULT_REASONING = Object.freeze({
  think: true,
  reasoningEffort: 'medium',
});

const THINK_TOKEN_FLOOR = {
  none: 0,
  low: 1024,
  medium: 2048,
  high: 4096,
  max: 6144,
};

const GEMINI_BUDGET = {
  none: 0,
  low: 1024,
  medium: 4096,
  high: 8192,
  max: 16384,
};

let memoryStore = {
  global: { ...DEFAULT_REASONING },
  scopes: {},
};

function sanitizeEntry(entry, fallback = DEFAULT_REASONING) {
  const base = fallback || DEFAULT_REASONING;
  const rawEffort = String(entry?.reasoningEffort || entry?.effort || '').toLowerCase();
  const validEffort = REASONING_EFFORTS.includes(rawEffort) ? rawEffort : base.reasoningEffort;
  const hasExplicitThink = typeof entry?.think === 'boolean';
  let think = hasExplicitThink ? entry.think : (validEffort !== 'none' ? base.think : false);
  let effort = validEffort;

  if (!think) {
    effort = 'none';
  } else if (effort === 'none') {
    effort = base.reasoningEffort && base.reasoningEffort !== 'none' ? base.reasoningEffort : 'medium';
  }

  return { think, reasoningEffort: effort };
}

function readStore() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const globalCfg = sanitizeEntry(parsed.global, DEFAULT_REASONING);
          const scopes = {};
          if (parsed.scopes && typeof parsed.scopes === 'object') {
            for (const [k, v] of Object.entries(parsed.scopes)) {
              if (k && v && typeof v === 'object') scopes[k] = sanitizeEntry(v, globalCfg);
            }
          }
          memoryStore = { global: globalCfg, scopes };
        }
      }
    }
  } catch {
    // Keep memoryStore on storage read failure
  }
  return memoryStore;
}

function writeStore(nextStore) {
  memoryStore = nextStore;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
    }
  } catch {
    // Ignore storage quota / headless errors
  }
  import('../database/sovereignDatabase.js')
    .then(({ db }) => db?.setSetting?.('reasoning_config', nextStore))
    .catch(() => {});
}

export async function hydrateReasoningConfigFromDb() {
  try {
    const { db } = await import('../database/sovereignDatabase.js');
    const saved = await db?.getSetting?.('reasoning_config', null);
    if (saved && typeof saved === 'object') {
      const globalCfg = sanitizeEntry(saved.global, DEFAULT_REASONING);
      const scopes = {};
      if (saved.scopes && typeof saved.scopes === 'object') {
        for (const [k, v] of Object.entries(saved.scopes)) {
          if (k && v && typeof v === 'object') scopes[k] = sanitizeEntry(v, globalCfg);
        }
      }
      memoryStore = { global: globalCfg, scopes };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
      }
      emitChange('global', memoryStore.global);
    }
  } catch {
    // Non-critical during early test/headless boot
  }
}

function emitChange(scope, config) {
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('novaura:reasoning_changed', {
      detail: { scope, config },
    }));
  }
}

export function getReasoningConfig(scope = 'global') {
  const store = readStore();
  if (!scope || scope === 'global') {
    return { ...store.global };
  }
  const override = store.scopes?.[scope];
  return override ? { ...override } : { ...store.global };
}

export function hasReasoningOverride(scope) {
  if (!scope || scope === 'global') return false;
  const store = readStore();
  return Boolean(store.scopes && scope in store.scopes);
}

export function setReasoningConfig(patch = {}, scope = 'global') {
  const store = readStore();
  const base = getReasoningConfig(scope);
  const nextRaw = { ...base, ...patch };

  // Keep think & reasoningEffort mutually coherent across user gestures:
  // toggling think OFF disables reasoning; picking an active effort enables think ON.
  if (patch.reasoningEffort && patch.reasoningEffort !== 'none' && patch.think === undefined) {
    nextRaw.think = true;
  } else if (patch.reasoningEffort === 'none' && patch.think === undefined) {
    nextRaw.think = false;
  } else if (patch.think === true && (nextRaw.reasoningEffort === 'none' || !nextRaw.reasoningEffort)) {
    nextRaw.reasoningEffort = store.global.reasoningEffort !== 'none' ? store.global.reasoningEffort : 'medium';
  }

  const nextEntry = sanitizeEntry(nextRaw, store.global);
  const nextStore = (!scope || scope === 'global')
    ? { ...store, global: nextEntry }
    : { ...store, scopes: { ...store.scopes, [scope]: nextEntry } };

  writeStore(nextStore);
  emitChange(scope || 'global', nextEntry);
  return { ...nextEntry };
}

export function clearReasoningOverride(scope) {
  if (!scope || scope === 'global') return getReasoningConfig('global');
  const store = readStore();
  if (!store.scopes || !(scope in store.scopes)) return getReasoningConfig('global');
  const nextScopes = { ...store.scopes };
  delete nextScopes[scope];
  const nextStore = { ...store, scopes: nextScopes };
  writeStore(nextStore);
  const globalCfg = getReasoningConfig('global');
  emitChange(scope, globalCfg);
  return globalCfg;
}

/**
 * Resolve final { think, reasoningEffort } for an inference call.
 * Explicit caller flags (`think`, `reasoningEffort`, `effort`) always take precedence
 * so tight structured JSON subtasks can opt out when needed, while interactive calls
 * default to Think ON at the active scope's reasoning effort.
 */
export function resolveReasoningParams(options = {}) {
  const scoped = getReasoningConfig(options.scope || 'global');
  const explicitEffort = options.reasoningEffort ?? options.effort;
  const hasExplicitThink = typeof options.think === 'boolean';
  const hasExplicitEffort = typeof explicitEffort === 'string' && REASONING_EFFORTS.includes(explicitEffort.toLowerCase());

  if (!hasExplicitThink && !hasExplicitEffort) {
    return { ...scoped };
  }

  const effortNorm = hasExplicitEffort ? explicitEffort.toLowerCase() : scoped.reasoningEffort;
  let think = hasExplicitThink ? options.think : (hasExplicitEffort ? effortNorm !== 'none' : scoped.think);
  let effort = hasExplicitEffort ? effortNorm : scoped.reasoningEffort;

  if (!think) {
    effort = 'none';
  } else if (effort === 'none') {
    effort = scoped.reasoningEffort !== 'none' ? scoped.reasoningEffort : 'medium';
  }

  return { think, reasoningEffort: effort };
}

export function ollamaThinkValue(model, resolved) {
  if (!resolved.think || resolved.reasoningEffort === 'none') return false;
  if (/gpt-oss/i.test(String(model || ''))) {
    return resolved.reasoningEffort === 'max' ? 'high' : resolved.reasoningEffort;
  }
  return true;
}

export function openAiReasoningEffort(resolved) {
  if (!resolved.think || resolved.reasoningEffort === 'none') return 'none';
  return resolved.reasoningEffort === 'max' ? 'high' : resolved.reasoningEffort;
}

export function anthropicEffort(resolved) {
  if (!resolved.think || resolved.reasoningEffort === 'none') return 'low';
  return resolved.reasoningEffort;
}

export function geminiThinkingConfig(resolved) {
  if (!resolved.think || resolved.reasoningEffort === 'none') {
    return { thinkingBudget: 0 };
  }
  return { thinkingBudget: GEMINI_BUDGET[resolved.reasoningEffort] ?? 4096 };
}

export function reasoningTokenBudget(baseMaxTokens, resolved, { strictMaxTokens = false } = {}) {
  const numeric = Number(baseMaxTokens);
  const safeBase = Number.isFinite(numeric) && numeric > 0 ? numeric : 2048;
  if (strictMaxTokens || !resolved.think || resolved.reasoningEffort === 'none') {
    return safeBase;
  }
  const floor = THINK_TOKEN_FLOOR[resolved.reasoningEffort] || 2048;
  return Math.max(safeBase, floor);
}

export default {
  REASONING_EFFORTS,
  REASONING_EFFORT_INFO,
  DEFAULT_REASONING,
  getReasoningConfig,
  hasReasoningOverride,
  setReasoningConfig,
  clearReasoningOverride,
  resolveReasoningParams,
  ollamaThinkValue,
  openAiReasoningEffort,
  anthropicEffort,
  geminiThinkingConfig,
  reasoningTokenBudget,
};

