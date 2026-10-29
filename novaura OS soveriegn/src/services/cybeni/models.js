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

// Local and Exchange models get a single user turn: some local chat templates
// (Gemma's, for one) reject a separate system role.
function mergeSystem(messages) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const rest = messages.filter(m => m.role !== 'system');
  if (!system) return rest;
  if (rest.length && rest[0].role === 'user') {
    return [{ role: 'user', content: `${system}\n\n${rest[0].content}` }, ...rest.slice(1)];
  }
  return [{ role: 'user', content: system }, ...rest];
}

/** Run a chat completion on any model key. Resolves with the reply text. */
export async function runModel(key, messages, { maxTokens = 4096, temperature = 0.3 } = {}) {
  const k = String(key || '');
  if (k.startsWith('local|')) {
    return runLocalChat(k.slice(6), mergeSystem(messages), { maxTokens, temperature });
  }
  if (k.startsWith('exchange|')) {
    const [, keyId, ...rest] = k.split('|');
    return callRemoteModel(keyId, rest.join('|'), mergeSystem(messages), { maxTokens, temperature, timeoutMs: 300000 });
  }
  if (k.startsWith('cloud|')) {
    if (!kernel?.ai?.chat) throw new Error('The AI subsystem is not ready yet.');
    return kernel.ai.chat(messages, { provider: k.slice(6), maxTokens, temperature, useRag: false });
  }
  throw new Error('No model chosen for this step.');
}

/**
 * Suggest role assignments from what is available. The reviewer gets a
 * different model from the developer whenever there is one, so code is
 * cross-checked by a second model rather than marked by its own author.
 */
export function suggestRoles(models) {
  const keys = models.map(m => m.key);
  if (!keys.length) return { architect: '', developer: '', reviewer: '', designer: '' };
  const loaded = models.filter(m => m.loaded).map(m => m.key);
  const cloud = keys.filter(k => k.startsWith('cloud|'));
  const developer = cloud[0] || loaded[0] || keys[0];
  const other = [...cloud, ...loaded, ...keys].find(k => k !== developer) || developer;
  return { architect: other, developer, reviewer: other, designer: developer };
}
