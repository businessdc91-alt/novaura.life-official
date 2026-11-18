// localModels.js — Models running on this machine (LM Studio, the built-in AI, Ollama).
// Every call goes through queryLocalAi, which only ever talks to 127.0.0.1,
// so nothing here can reach a cloud endpoint or another machine.

import { probeLocalAi, queryLocalAi, streamLocalAi } from './nativeService.js';
import { releaseComfyModels } from './engines/mediaRoom.js';
import { createStreamReader, assembleStream } from './localStream.js';
import {
  resolveReasoningParams,
  ollamaThinkValue,
  openAiReasoningEffort,
  reasoningTokenBudget,
} from './reasoningConfig.js';

// LM Studio is the preferred runtime, so it is listed (and picked) first. The
// built-in AI is llama.cpp run by Sovereign itself (engines/builtinAi.js); the
// native bridge adds its API key, so it is queried like any OpenAI-style server.
export const LOCAL_RUNTIMES = {
  lmstudio: { label: 'LM Studio', port: 1234, tagsPath: '/v1/models' },
  novaura: { label: 'Built-in AI', port: 39281, tagsPath: '/v1/models' },
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
      } else if (runtime === 'ollama') {
        // Ollama lists models currently in memory at /api/ps.
        const res = await queryLocalAi(cfg.port, '/api/ps', 'GET');
        loaded = (Array.isArray(res?.models) ? res.models : []).map(m => m.name || m.model).filter(Boolean);
      } else {
        // The built-in server lists every model in its folder, each with its load state.
        const res = await queryLocalAi(cfg.port, '/models', 'GET');
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (rows.length) names = rows.map(m => m.id);
        loaded = rows.filter(m => m.status?.value === 'loaded').map(m => m.id);
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

// ── Ollama on the CPU ──────────────────────────────────────────────────────
// Lets Ollama run on system RAM while LM Studio keeps the GPU, or work at all
// when Ollama's GPU build does not support the card.

const OLLAMA_CPU_KEY = 'novaura_ollama_cpu_only';
const GPU_FAILURE_RE = /cuda|ptx|rocm|vulkan|out of memory|llama-server process has terminated|unable to allocate/i;

export function ollamaCpuOnly() {
  try {
    return localStorage.getItem(OLLAMA_CPU_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOllamaCpuOnly(enabled) {
  try {
    localStorage.setItem(OLLAMA_CPU_KEY, enabled ? 'true' : 'false');
  } catch { /* storage unavailable */ }
}

// A model that could not load for lack of memory. Not every "Failed to load
// model": LM Studio says that for a crashed runtime too, and freeing the image
// engine would not help then.
const NO_ROOM_RE = /insufficient system resources|requires approximately|out of memory|outofdevicememory|unable to allocate|failed to allocate|not enough memory/i;

/**
 * When a chat model cannot load because the image and music engine fills the
 * graphics card, ask the engine to let go of its models (they reload on its next
 * job). Resolves true when the engine was running.
 */
async function freeMediaMemory(model) {
  if (!(await releaseComfyModels())) return false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('novaura:mesh_toast', { detail: {
      type: 'info',
      appId: 'ai_engines',
      title: `Made room for ${model}`,
      message: 'The image and music engine unloaded its models so the chat model could load. They load again on the next image or song.',
    } }));
  }
  return true;
}

// Reasoning models wrap their scratchpad in <think> tags; strip it from chat output.
export function cleanCompletion(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^<think>[\s\S]*$/i, '')
    .trim();
}

/**
 * Run a chat completion on a local model.
 * messages: [{ role: 'system'|'user'|'assistant', content }]
 * With onToken(piece) the reply is streamed and each piece is handed over as the model
 * writes it; where streaming is not available, onToken gets the whole reply once.
 * Either way the cleaned reply is returned.
 */
export async function runLocalChat(ref, messages, options = {}) {
  const { onToken, ...rest } = options || {};
  if (typeof onToken !== 'function') return chatOnce(ref, messages, rest, null);
  let streamed = false;
  const text = await chatOnce(ref, messages, rest, (piece) => {
    streamed = true;
    onToken(piece);
  });
  if (!streamed && text) onToken(text);
  return text;
}

async function chatOnce(
  ref,
  messages,
  {
    maxTokens = 400,
    temperature = 0.7,
    jsonSchema,
    think,
    reasoningEffort,
    effort,
    scope,
    strictMaxTokens = false,
    onThinking,
  } = {},
  onPiece
) {
  const parsed = typeof ref === 'string' ? parseModelRef(ref) : ref;
  if (!parsed) throw new Error('No local model selected.');
  const cfg = LOCAL_RUNTIMES[parsed.runtime];

  // The reply comes back in the shape of a non-streamed one either way, so the
  // retries below work the same.
  let streaming = typeof onPiece === 'function';
  const post = async (path, payload) => {
    if (streaming) {
      const kind = parsed.runtime === 'ollama' ? 'ollama' : 'openai';
      try {
        const reader = createStreamReader(kind, (d) => { if (d.content) onPiece(d.content); });
        const res = await streamLocalAi(cfg.port, path, { ...payload, stream: true }, (text) => reader.push(text));
        if (res.status >= 200 && res.status < 300) return assembleStream(kind, res.body);
        try {
          return JSON.parse(res.body);
        } catch {
          return { error: res.body || `${cfg.label} answered with HTTP ${res.status}.` };
        }
      } catch (err) {
        console.warn('[LocalModels] Streaming is not available; asking for the whole reply instead:', err?.message || err);
        streaming = false;
      }
    }
    return queryLocalAi(cfg.port, path, 'POST', { ...payload, stream: false });
  };
  const resolved = resolveReasoningParams({ think, reasoningEffort, effort, scope });
  const effectiveMaxTokens = reasoningTokenBudget(maxTokens, resolved, {
    strictMaxTokens: strictMaxTokens || Boolean(jsonSchema && !resolved.think),
  });

  if (parsed.runtime === 'ollama') {
    const thinkParam = ollamaThinkValue(parsed.model, resolved);
    const ask = (cpuOnly, includeThink = true) => post('/api/chat', {
      model: parsed.model,
      messages,
      ...(includeThink ? { think: thinkParam } : {}),
      // A JSON schema constrains the reply to valid JSON of that shape.
      ...(jsonSchema ? { format: jsonSchema } : {}),
      // num_gpu 0 keeps every layer in system RAM and runs on the CPU.
      options: { temperature, num_predict: effectiveMaxTokens, ...(cpuOnly ? { num_gpu: 0 } : {}) },
    });
    let res = await ask(ollamaCpuOnly());
    if (/does not support thinking|unknown field.*think/i.test(String(res?.error || ''))) {
      res = await ask(ollamaCpuOnly(), false);
    }
    // Out of VRAM because of image or music models: free those before blaming the GPU.
    if (!ollamaCpuOnly() && NO_ROOM_RE.test(String(res?.error || '')) && await freeMediaMemory(parsed.model)) {
      res = await ask(false);
    }
    // Ollama's GPU build can crash on cards it does not support (for example
    // "the provided PTX was compiled with an unsupported toolchain" on older
    // NVIDIA cards). Retry on the CPU and remember the choice.
    if (!ollamaCpuOnly() && GPU_FAILURE_RE.test(String(res?.error || ''))) {
      console.warn('[LocalModels] Ollama GPU run failed; retrying on the CPU and remembering that:', res.error);
      setOllamaCpuOnly(true);
      res = await ask(true);
    }
    if (res && typeof res === 'object' && typeof res.message?.content === 'string') {
      if (res.message.thinking && typeof onThinking === 'function') {
        onThinking(res.message.thinking);
      }
      return cleanCompletion(res.message.content);
    }
    throw new Error(res?.error || `Ollama did not return a reply. Is "${parsed.model}" installed?`);
  }

  const lmEffort = openAiReasoningEffort(resolved);
  const ask = (includeEffort = true) => post('/v1/chat/completions', {
    model: parsed.model,
    messages,
    temperature,
    max_tokens: effectiveMaxTokens,
    ...(includeEffort ? { reasoning_effort: lmEffort } : {}),
    ...(jsonSchema ? { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: jsonSchema } } } : {}),
  });
  let res = await ask(true);
  if (
    typeof res?.choices?.[0]?.message?.content !== 'string' &&
    /reasoning_effort|unknown field|unrecognized/i.test(String(res?.error?.message || res?.error || ''))
  ) {
    res = await ask(false);
  }
  if (typeof res?.choices?.[0]?.message?.content !== 'string' && NO_ROOM_RE.test(String(res?.error?.message || res?.error || '')) && await freeMediaMemory(parsed.model)) {
    res = await ask(true);
  }
  const msg = res?.choices?.[0]?.message;
  const trace = msg?.reasoning_content || msg?.reasoning;
  if (trace && typeof onThinking === 'function') onThinking(trace);
  const text = msg?.content;
  if (typeof text === 'string') return cleanCompletion(text);
  const message = String(res?.error?.message || res?.error || `${cfg.label} did not return a reply. Is "${parsed.model}" loaded?`);
  if (/insufficient system resources|requires approximately/i.test(message)) {
    throw new Error(`${message} The memory estimate is driven mostly by the model's context length. In LM Studio, open the model's settings and lower its context length (32,768 is plenty for Cybeni), then try again.`);
  }
  if (/startup was aborted|exited before becoming healthy/i.test(message)) {
    throw new Error(`${message} LM Studio's runtime crashed while loading it. Load the model in LM Studio itself to see the reason; a graphics card that fails under Vulkan is a common one (LM Studio's hardware settings can leave it out).`);
  }
  if (/failed to load model/i.test(message)) {
    throw new Error(`${message} LM Studio could not load it, most likely because the models already loaded leave too little VRAM. Unload a model in LM Studio, or pick a loaded model (marked ●).`);
  }
  throw new Error(message);
}
