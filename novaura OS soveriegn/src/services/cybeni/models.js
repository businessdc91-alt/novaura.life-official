// models.js — Every model Cybeni can put to work, from one place:
//   local|<runtime>:<model>      LM Studio / Ollama on this PC (127.0.0.1 only)
//   exchange|<keyId>|<ref>       someone's hosted model, via an Inference Exchange key
//   cloud|<provider>             a cloud provider whose key is in the local vault
//
// A model key is just a string, so pipeline role assignments can be saved.

import { discoverLocalModels, describeModelRef, runLocalChat } from '../localModels.js';
import { listRemoteModels, callRemoteModel } from '../inferenceExchange.js';
import { kernel } from '../../kernel/NovaKernel.js';

export const CLOUD_PROVIDERS = [
  { id: 'claude', label: 'Claude', keyName: 'claude' },
  { id: 'gemini', label: 'Gemini', keyName: 'gemini' },
  { id: 'byok', label: 'OpenAI-compatible (BYOK)', keyName: 'byok' },
  { id: 'openrouter', label: 'OpenRouter', keyName: 'openrouter' },
];

function cloudKeyPresent(provider) {
  try {
    return Boolean(kernel?.ai?.getKey?.(provider.keyName));
  } catch {
    return false;
  }
}

/**
 * List available models, grouped for a picker.
 * Returns [{ key, label, group, loaded? }], loaded local models first.
 */
export async function listCybeniModels() {
  const out = [];
  const local = await discoverLocalModels().catch(() => []);
  for (const runtime of local) {
    if (!runtime.online) continue;
    for (const ref of runtime.models) {
      out.push({
        key: `local|${ref}`,
        label: describeModelRef(ref),
        group: `${runtime.label} on this PC`,
        loaded: runtime.loaded.includes(ref),
      });
    }
  }
  for (const r of await listRemoteModels().catch(() => [])) {
    out.push({ key: `exchange|${r.keyId}|${r.ref}`, label: r.label, group: 'Inference Exchange' });
  }
  for (const p of CLOUD_PROVIDERS) {
    if (cloudKeyPresent(p)) out.push({ key: `cloud|${p.id}`, label: `${p.label} (your key)`, group: 'Cloud (your vault keys)' });
  }
  return out;
}

export function describeModelKey(key) {
  const k = String(key || '');
  if (k.startsWith('local|')) return describeModelRef(k.slice(6));
  if (k.startsWith('exchange|')) return `${describeModelRef(k.split('|').slice(2).join('|'))} (Exchange)`;
  if (k.startsWith('cloud|')) return CLOUD_PROVIDERS.find(p => p.id === k.slice(6))?.label || k.slice(6);
  return 'No model';
}

// Long passes on big local models (or a host's) can take many minutes.
const EXCHANGE_TIMEOUT_MS = 45 * 60 * 1000;

/**
 * Run a chat completion on any model key. Resolves with the reply text.
 * Always keep the system message: without one, LM Studio and Ollama fall back to
 * the model's own preset system prompt, which may be a roleplay persona.
 */
export async function runModel(key, messages, { maxTokens = 4096, temperature = 0.3 } = {}) {
  const k = String(key || '');
  if (k.startsWith('local|')) {
    return runLocalChat(k.slice(6), messages, { maxTokens, temperature });
  }
  if (k.startsWith('exchange|')) {
    const [, keyId, ...rest] = k.split('|');
    return callRemoteModel(keyId, rest.join('|'), messages, { maxTokens, temperature, timeoutMs: EXCHANGE_TIMEOUT_MS });
  }
  if (k.startsWith('cloud|')) {
    if (!kernel?.ai?.chat) throw new Error('The AI subsystem is not ready yet.');
    return kernel.ai.chat(messages, { provider: k.slice(6), maxTokens, temperature, useRag: false });
  }
  throw new Error('No model chosen for this step.');
}

// Size in billions of parameters from a model name ("qwen3-coder-80b", "gemma-4-26b-a4b"), else null.
export function modelSizeB(key) {
  const m = /(\d+(?:\.\d+)?)\s*b(?![a-z])/i.exec(String(key).split('|').pop());
  return m ? Number(m[1]) : null;
}

// Family from a model name: "gemma", "qwen", "llama", "mistral", ...
function family(key) {
  const name = String(key).split('|').pop().split(':').pop().split('/').pop().toLowerCase();
  return /^[a-z]+/.exec(name)?.[0] || name;
}

/**
 * Suggest role assignments from what is available.
 * - developer: a cloud model if there is a key, else the biggest coder model, else the biggest model
 * - reviewer: the biggest model from a different family (then any different model), so code is
 *   cross-checked by a second model rather than marked by its own author
 * - architect: a mixture-of-experts model (fast short verdicts) or the reviewer
 * Tiny models (under 4B) are only used when nothing else exists, and loaded models
 * are preferred over ones that would have to be loaded (see `ready` below).
 */
export function suggestRoles(models) {
  const keys = models.map(m => m.key);
  if (!keys.length) return { architect: '', developer: '', reviewer: '', designer: '' };
  const loaded = new Set(models.filter(m => m.loaded).map(m => m.key));
  const size = (k) => (k.startsWith('cloud|') ? 1000 : modelSizeB(k) ?? 7);
  const score = (k) => size(k) + (loaded.has(k) ? 0.5 : 0); // prefer loaded on ties: no reload wait
  const capable = keys.filter(k => size(k) >= 4);
  // Models already loaded (or in the cloud) are guaranteed to run. Others must be
  // loaded on demand and may not fit in VRAM next to what is loaded.
  const ready = capable.filter(k => loaded.has(k) || k.startsWith('cloud|'));
  const sorted = (list) => list.slice().sort((a, b) => score(b) - score(a));
  const devPool = sorted(ready.length ? ready : capable.length ? capable : keys);

  const developer = devPool.find(k => k.startsWith('cloud|')) || devPool.find(k => /coder|code/i.test(k)) || devPool[0];
  // A local developer competes for VRAM, so the other roles stay on loaded models.
  // A cloud developer leaves the GPU free for loading any local model.
  const pool = developer.startsWith('cloud|') ? sorted(capable.length ? capable : keys) : devPool;
  const reviewer = pool.find(k => k !== developer && family(k) !== family(developer))
    || pool.find(k => k !== developer)
    || developer;
  // With the developer on LM Studio, an Ollama model makes a good architect: its
  // output is short plans and verdicts, and Ollama can run it on the CPU and system
  // RAM (see localModels.ollamaCpuOnly) without competing for the GPU.
  const ollama = developer.startsWith('local|lmstudio:')
    ? sorted(capable.filter(k => k.startsWith('local|ollama:')))[0]
    : null;
  const architect = ollama || pool.find(k => /-a\d+b|moe/i.test(k) && k !== developer) || reviewer;
  return { architect, developer, reviewer, designer: architect === ollama ? developer : architect };
}
