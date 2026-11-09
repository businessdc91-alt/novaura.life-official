// chatModelMemory.js — The chat models loaded right now in LM Studio, Ollama and
// the built-in AI, and unloading one of them so an image or music model fits
// (mediaRoom.js decides which). Each runtime reloads a model by itself the next
// time a chat asks for it.

import { queryLocalAi } from '../nativeService.js';
import { LOCAL_RUNTIMES, ollamaCpuOnly } from '../localModels.js';
import { BUILTIN_PORT, getBuiltinConfig, listBuiltinModels } from './builtinAi.js';

const LMSTUDIO_PORT = LOCAL_RUNTIMES.lmstudio.port;
const OLLAMA_PORT = LOCAL_RUNTIMES.ollama.port;

// LM Studio 0.4+ lists every loaded instance with the model's size on disk.
async function lmStudioLoaded() {
  const res = await queryLocalAi(LMSTUDIO_PORT, '/api/v1/models', 'GET');
  const models = Array.isArray(res?.models) ? res.models : [];
  return models
    .filter(m => m.type !== 'embedding')
    .flatMap(m => (m.loaded_instances || []).map(inst => ({
      runtime: 'lmstudio',
      id: inst.id,
      label: `${m.display_name || m.key} (LM Studio)`,
      bytes: Number(m.size_bytes) || 0,
      onGpu: null,
    })));
}

// Ollama reports how much of each loaded model sits in VRAM.
async function ollamaLoaded() {
  const res = await queryLocalAi(OLLAMA_PORT, '/api/ps', 'GET');
  return (Array.isArray(res?.models) ? res.models : []).map(m => ({
    runtime: 'ollama',
    id: m.name || m.model,
    label: `${m.name || m.model} (Ollama)`,
    bytes: Number(m.size) || 0,
    gpuBytes: Number(m.size_vram) || 0,
    onGpu: ollamaCpuOnly() ? false : Number(m.size_vram) > 0,
  })).filter(m => m.id);
}

async function builtinLoaded() {
  const cfg = await getBuiltinConfig();
  if (!cfg.installDir) return [];
  return (await listBuiltinModels())
    .filter(m => m.status === 'loaded')
    .map(m => ({ runtime: 'novaura', id: m.id, label: `${m.id} (Built-in AI)`, bytes: Number(m.bytes) || 0, onGpu: cfg.cpuOnly ? false : null }));
}

/**
 * Every chat model in memory now: [{ runtime, id, label, bytes, gpuBytes?, onGpu }].
 * Runtimes that are not running are skipped.
 */
export async function loadedChatModels() {
  const lists = await Promise.all([lmStudioLoaded(), ollamaLoaded(), builtinLoaded()].map(p => p.catch(() => [])));
  return lists.flat();
}

/** Unload one model from its runtime. */
export async function unloadChatModel(model) {
  let res;
  if (model.runtime === 'lmstudio') res = await queryLocalAi(LMSTUDIO_PORT, '/api/v1/models/unload', 'POST', { instance_id: model.id });
  else if (model.runtime === 'ollama') res = await queryLocalAi(OLLAMA_PORT, '/api/generate', 'POST', { model: model.id, keep_alive: 0 });
  else res = await queryLocalAi(BUILTIN_PORT, '/models/unload', 'POST', { model: model.id });
  if (res && typeof res === 'object' && res.error) throw new Error(String(res.error.message || res.error));
}
