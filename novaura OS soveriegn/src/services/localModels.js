// localModels.js — Models running on this machine (Ollama / LM Studio).
// Every call goes through queryLocalAi, which only ever talks to 127.0.0.1,
// so nothing here can reach a cloud endpoint or another machine.

import { probeLocalAi, queryLocalAi } from './nativeService.js';

// LM Studio is the preferred runtime, so it is listed (and picked) first.
export const LOCAL_RUNTIMES = {
  lmstudio: { label: 'LM Studio', port: 1234, tagsPath: '/v1/models' },
  ollama: { label: 'Ollama', port: 11434, tagsPath: '/api/tags' },
};

// A model reference is "<runtime>:<model tag>", e.g. "ollama:gemma3:12b".
export function toModelRef(runtime, model) {
  return `${runtime}:${model}`;
}

export function parseModelRef(ref) {
  const str = String(ref || '');
  const idx = str.indexOf(':');
  if (idx <= 0) return null;
  const runtime = str.slice(0, idx);
  const model = str.slice(idx + 1);
  if (!LOCAL_RUNTIMES[runtime] || !model) return null;
  return { runtime, model };
}

export function describeModelRef(ref) {
  const parsed = parseModelRef(ref);
  if (!parsed) return String(ref || 'unknown model');
  return `${parsed.model} (${LOCAL_RUNTIMES[parsed.runtime].label})`;
}

/**
 * Probe the local runtimes and list every installed chat model, marking the ones
 * loaded in memory right now (they answer fastest). Loaded models come first.
 * Returns [{ runtime, label, online, models: [ref, ...], loaded: [ref, ...] }].
 */
export async function discoverLocalModels() {
  return Promise.all(Object.entries(LOCAL_RUNTIMES).map(async ([runtime, cfg]) => {
    // The probe has a short timeout, so offline runtimes are skipped quickly.
    const probe = await probeLocalAi(cfg.port, cfg.tagsPath).catch(() => null);
    if (!probe?.online) return { runtime, label: cfg.label, online: false, models: [], loaded: [] };

    let names = probe.models || [];
    let loaded = [];
    try {
      if (runtime === 'lmstudio') {
        // LM Studio's native endpoint reports type and load state per model.
        const res = await queryLocalAi(cfg.port, '/api/v0/models', 'GET');
        const rows = Array.isArray(res?.data) ? res.data.filter(m => m?.id && m.type !== 'embeddings') : [];
        if (rows.length) {
          names = rows.map(m => m.id);
          loaded = rows.filter(m => m.state === 'loaded').map(m => m.id);
        }
      } else {
        // Ollama lists models currently in memory at /api/ps.
        const res = await queryLocalAi(cfg.port, '/api/ps', 'GET');
        loaded = (Array.isArray(res?.models) ? res.models : []).map(m => m.name || m.model).filter(Boolean);
      }
    } catch { /* older runtime without load info: list installed models only */ }

    // Embedding models show up in the same lists but cannot chat.
    names = names.filter(m => !/embed/i.test(m));
    const loadedSet = new Set(loaded);
    names.sort((x, y) => Number(loadedSet.has(y)) - Number(loadedSet.has(x)));
    return {
      runtime,
      label: cfg.label,
      online: true,
      models: names.map(m => toModelRef(runtime, m)),
      loaded: names.filter(m => loadedSet.has(m)).map(m => toModelRef(runtime, m)),
    };
  }));
}

// Reasoning models wrap their scratchpad in <think> tags; strip it from chat output.
function cleanCompletion(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^<think>[\s\S]*$/i, '')
    .trim();
}

/**
 * Run a chat completion on a local model.
 * messages: [{ role: 'system'|'user'|'assistant', content }]
 */
export async function runLocalChat(ref, messages, { maxTokens = 400, temperature = 0.7 } = {}) {
  const parsed = typeof ref === 'string' ? parseModelRef(ref) : ref;
  if (!parsed) throw new Error('No local model selected.');
  const cfg = LOCAL_RUNTIMES[parsed.runtime];

  if (parsed.runtime === 'ollama') {
    const res = await queryLocalAi(cfg.port, '/api/chat', 'POST', {
      model: parsed.model,
      messages,
      stream: false,
      // Thinking models would otherwise spend the short reply budget thinking.
      think: false,
      options: { temperature, num_predict: maxTokens },
    });
    if (res && typeof res === 'object' && typeof res.message?.content === 'string') {
      return cleanCompletion(res.message.content);
    }
    throw new Error(res?.error || `Ollama did not return a reply. Is "${parsed.model}" installed?`);
  }

  const res = await queryLocalAi(cfg.port, '/v1/chat/completions', 'POST', {
    model: parsed.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
    // Same reason as think:false above; LM Studio ignores it for non-reasoning models.
    reasoning_effort: 'none',
  });
  const text = res?.choices?.[0]?.message?.content;
  if (typeof text === 'string') return cleanCompletion(text);
  const message = String(res?.error?.message || res?.error || `LM Studio did not return a reply. Is "${parsed.model}" loaded?`);
  if (/failed to load model/i.test(message)) {
    throw new Error(`${message} LM Studio could not load it, most likely because the models already loaded leave too little VRAM. Unload a model in LM Studio, or pick a loaded model (marked ●).`);
  }
  throw new Error(message);
}
