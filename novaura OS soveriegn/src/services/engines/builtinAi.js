// builtinAi.js — The built-in AI: llama.cpp run by Sovereign as a local model
// server (src-tauri/src/llm.rs). No LM Studio or Ollama needed.
//
// Every model in the models folder is served; one is loaded at a time and the
// server swaps when another is asked for. Models come from the curated Gemma 4
// list or from any Hugging Face repo with GGUF files. While it runs it is a local
// runtime like the others ("Built-in AI" in localModels.js), so Cybeni, Music
// Studio and every model picker list it, and the kernel's chat falls back to it
// before any cloud key.

import { db } from '../../database/sovereignDatabase.js';
import { getNativeHardwareSpec, queryLocalAi, probeLocalAi } from '../nativeService.js';
import { runLocalChat, parseModelRef, ollamaCpuOnly, LOCAL_RUNTIMES } from '../localModels.js';
import { groupGgufFiles, hfModelName } from './hfGguf.js';

export { hfModelName };

const CONFIG_KEY = 'builtin_ai';
export const DEFAULT_MODEL = 'gemma-4-e4b';
export const BUILTIN_PORT = 39281;
const LOAD_TIMEOUT_MS = 5 * 60 * 1000;

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
async function invoke(cmd, args) {
  if (!isTauri()) throw new Error('The built-in AI runs in the desktop app.');
  const { invoke: call } = await import('@tauri-apps/api/core');
  return call(cmd, args);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Config ─────────────────────────────────────────────────────────────────

export async function getBuiltinConfig() {
  return { installDir: '', modelId: DEFAULT_MODEL, autoStart: true, cpuOnly: false, hfToken: '', ...(await db.getSetting(CONFIG_KEY, {}).catch(() => ({}))) };
}

export async function setBuiltinConfig(patch) {
  const next = { ...(await getBuiltinConfig()), ...patch };
  await db.setSetting(CONFIG_KEY, next);
  emit();
  return next;
}

const listeners = new Set();
function emit() { for (const fn of listeners) fn(); }
/** Called when the config, the models or the server change; returns the unsubscribe function. */
export function subscribeBuiltinAi(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * A folder for the runtime and models: next to the image engine when that is
 * installed, otherwise on the drive with the most free space.
 */
export async function suggestInstallDir() {
  const engine = await db.getSetting('ai_engine_config', {}).catch(() => ({}));
  if (engine?.installDir) return `${engine.installDir.replace(/[\\/]+$/, '')}\\BuiltInAI`;
  const hw = await invoke('engine_hardware').catch(() => null);
  const best = [...(hw?.drives || [])].sort((a, b) => b.free_gb - a.free_gb)[0];
  return `${best?.letter || 'C'}:\\NovauraAI\\BuiltInAI`;
}

/** The model to suggest for this PC: E4B, or E2B on machines with little memory. */
export async function recommendModel() {
  const spec = await getNativeHardwareSpec().catch(() => null);
  const ram = Number(spec?.ram_gb) || 0;
  return ram && ram < 10 ? 'gemma-4-e2b' : DEFAULT_MODEL;
}

// ── Downloads ──────────────────────────────────────────────────────────────

/** { runtime_build, runtime_bytes, runtime_installed, port, models_dir, models: [{ id, label, bytes, min_ram_gb, blurb, installed }] } */
export function catalog(installDir) {
  return invoke('llm_catalog', { installDir });
}

export async function install(installDir, modelId) {
  await setBuiltinConfig({ installDir });
  return invoke('llm_install', { installDir, modelId });
}

/** { running, model_id, stage, bytes, total, done, error } */
export const installProgress = () => invoke('llm_install_status');
export const cancelInstall = () => invoke('llm_cancel_install');

// ── The server ─────────────────────────────────────────────────────────────

const router = (path, method = 'GET', body = null) => queryLocalAi(BUILTIN_PORT, path, method, body);

/** Models the server knows: [{ id, status: 'loaded' | 'loading' | 'unloaded' | …, failed }] (empty when stopped). */
async function routerModels() {
  const res = await router('/models').catch(() => null);
  return (Array.isArray(res?.data) ? res.data : []).map(m => ({ id: m.id, status: m.status?.value || 'unloaded', failed: Boolean(m.status?.failed) }));
}

/**
 * Everything in the models folder, with its state:
 * [{ id, bytes, vision, complete, catalog_id, status }].
 */
export async function listBuiltinModels() {
  const cfg = await getBuiltinConfig();
  if (!cfg.installDir || !isTauri()) return [];
  const [files, live] = await Promise.all([
    invoke('llm_list_models', { installDir: cfg.installDir }).catch(() => []),
    routerModels(),
  ]);
  const byId = new Map(live.map(m => [m.id, m]));
  return files.map(f => ({ ...f, status: byId.get(f.id)?.status || (f.complete ? 'available' : 'downloading'), failed: byId.get(f.id)?.failed || false }));
}

/** { running, port, log_tail } plus the saved config. */
export async function builtinStatus() {
  const cfg = await getBuiltinConfig();
  if (!cfg.installDir || !isTauri()) return { ...cfg, running: false };
  const st = await invoke('llm_status', { installDir: cfg.installDir }).catch(() => ({ running: false }));
  return { ...cfg, ...st };
}

function startupError(st, fallback) {
  const line = (st?.log_tail || '').split('\n').reverse().find(l => /error|failed|unable|out of memory/i.test(l));
  return new Error(`The built-in AI did not start: ${(line || fallback).trim().slice(0, 300)}`);
}

// The model the OS uses by default: the chosen one if it is downloaded, else the first complete one.
async function defaultModelId() {
  const cfg = await getBuiltinConfig();
  const models = await listBuiltinModels();
  const ok = models.filter(m => m.complete);
  return (ok.find(m => m.id === cfg.modelId) || ok[0])?.id || null;
}

/** Ask the server to load a model now and resolve once it is in memory. */
export async function loadBuiltinModel(modelId) {
  // The server reads the models folder when it starts; a model downloaded since needs a rescan.
  if (!(await routerModels()).some(m => m.id === modelId)) {
    await router('/models?reload=1').catch(() => null);
    if (!(await routerModels()).some(m => m.id === modelId)) throw new Error(`The built-in AI cannot find ${modelId} in its models folder.`);
  }
  const res = await router('/models/load', 'POST', { model: modelId });
  if (res && typeof res === 'object' && res.error) throw new Error(`${modelId} did not load: ${res.error.message || res.error}`);
  emit();
  const deadline = Date.now() + LOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const m = (await routerModels()).find(x => x.id === modelId);
    if (m?.status === 'loaded') { emit(); return; }
    if (m?.failed) {
      const st = await builtinStatus();
      throw startupError(st, `${modelId} could not be loaded. It may be too big for this PC's memory.`);
    }
    await sleep(1000);
  }
  throw new Error(`${modelId} is taking too long to load.`);
}

const CV_BINDINGS_KEY = 'aura_core:control_vectors';

export async function listControlVectors() {
  if (!isTauri()) return [];
  const cfg = await getBuiltinConfig();
  if (!cfg.installDir) return [];
  return invoke('llm_list_control_vectors', { installDir: cfg.installDir }).catch(() => []);
}

export async function getControlVectorBindings() {
  const saved = await db.getSetting(CV_BINDINGS_KEY, null).catch(() => null);
  return saved && typeof saved === 'object' ? saved : {};
}

export async function saveControlVectorBindings(bindings) {
  await db.setSetting(CV_BINDINGS_KEY, bindings && typeof bindings === 'object' ? bindings : {});
  emit();
}

export function computeControlVectorScales({ chemistry, bias, bindings = {}, availableVectors = [] } = {}) {
  const available = new Set(availableVectors.map(v => v.name));
  const oxDelta = ((chemistry?.oxytocin ?? 25) - 25) / 50;
  const crDelta = ((bias?.creativity ?? 1) - 1);
  const coDelta = ((chemistry?.cortisol ?? 15) - 15) / 50;
  const foDelta = ((chemistry?.adrenaline ?? 5) - 5) / 40 - ((chemistry?.energy ?? 100) < 35 ? 0.35 : 0);
  const channels = {
    warmth: oxDelta,
    creativity: crDelta,
    caution: coDelta,
    focus: foDelta,
  };
  const active = [];
  for (const [channel, spec] of Object.entries(bindings)) {
    const file = spec?.file;
    if (!file || !available.has(file)) continue;
    const gain = Number.isFinite(Number(spec.gain)) ? Number(spec.gain) : 0.75;
    const raw = (channels[channel] ?? 0) * gain;
    const scale = Math.round(Math.max(-2.5, Math.min(2.5, raw)) * 1000) / 1000;
    if (Math.abs(scale) >= 0.01) active.push({ name: file, scale, channel });
  }
  return active;
}

let starting = null;
/** Start the server (if needed), load the default model, and resolve once it answers. */
export function startBuiltinAi({ controlVectors = null } = {}) {
  starting ||= (async () => {
    const cfg = await getBuiltinConfig();
    if (!cfg.installDir) throw new Error('Set up the built-in AI first.');
    let activeVectors = controlVectors;
    if (!activeVectors) {
      const [avail, bindings, coreSaved] = await Promise.all([
        listControlVectors(),
        getControlVectorBindings(),
        db.getSetting('aura_core:aura', null).catch(() => null),
      ]);
      activeVectors = computeControlVectorScales({
        chemistry: coreSaved?.chemistry,
        bindings,
        availableVectors: avail,
      }).map(({ name, scale }) => ({ name, scale }));
    }
    await invoke('llm_start', {
      installDir: cfg.installDir,
      cpuOnly: Boolean(cfg.cpuOnly),
      ...(activeVectors?.length ? { controlVectors: activeVectors } : {}),
    });
    emit();
    // The router itself is up within seconds.
    for (let i = 0; i < 60; i++) {
      const st = await invoke('llm_status', { installDir: cfg.installDir });
      if (!st.running) throw startupError(st, 'it stopped right away');
      const probe = await probeLocalAi(BUILTIN_PORT, '/health').catch(() => null);
      if (probe?.online) break;
      await sleep(500);
    }
    // Pick up models downloaded since the server last read its folder.
    await router('/models?reload=1').catch(() => null);
    const modelId = await defaultModelId();
    if (modelId) await loadBuiltinModel(modelId);
    return { ...(await builtinStatus()), model_id: modelId };
  })().finally(() => { starting = null; emit(); });
  return starting;
}

export async function stopBuiltinAi() {
  const { installDir } = await getBuiltinConfig();
  await invoke('llm_stop', { installDir });
  emit();
}

export async function applyControlVectorsToServer({ chemistry, bias } = {}) {
  const [avail, bindings, st] = await Promise.all([
    listControlVectors(),
    getControlVectorBindings(),
    builtinStatus(),
  ]);
  const computed = computeControlVectorScales({ chemistry, bias, bindings, availableVectors: avail });
  const args = computed.map(({ name, scale }) => ({ name, scale }));
  if (st.running) {
    await stopBuiltinAi();
    await startBuiltinAi({ controlVectors: args });
  }
  return computed;
}

/** Make a model the default and load it (if the server is running). */
export async function selectBuiltinModel(modelId) {
  await setBuiltinConfig({ modelId });
  if ((await builtinStatus()).running) await loadBuiltinModel(modelId);
}

export async function removeBuiltinModel(modelId) {
  const cfg = await getBuiltinConfig();
  // A loaded model's file is locked on Windows; let the server let go first.
  if ((await builtinStatus()).running) await router('/models/unload', 'POST', { model: modelId }).catch(() => {});
  await sleep(500);
  await invoke('llm_remove_model', { installDir: cfg.installDir, model: modelId });
  emit();
}

/**
 * Chat with the built-in AI (the kernel's fallback after LM Studio and Ollama).
 * Starts it first when it is set up but stopped.
 */
export async function builtinChat(
  messages,
  { maxTokens = 2048, temperature = 0.7, jsonSchema, think, reasoningEffort, effort, scope, strictMaxTokens, onThinking } = {}
) {
  let st = await builtinStatus();
  if (!st.installDir) throw new Error('The built-in AI is not set up.');
  if (!st.running) st = await startBuiltinAi();
  const modelId = await defaultModelId();
  if (!modelId) throw new Error('The built-in AI has no model downloaded yet.');
  return runLocalChat(`novaura:${modelId}`, messages, {
    maxTokens,
    temperature,
    jsonSchema,
    think,
    reasoningEffort,
    effort,
    scope,
    strictMaxTokens,
    onThinking,
  });
}

const SPEED_KEY = 'builtin_ai_speed_tests';
const SPEED_PROMPT = 'Write a short story of about 200 words about a lighthouse keeper who finds a message in a bottle.';

/**
 * Measure a downloaded model on this PC: load it, generate a fixed reply, and read
 * llama.cpp's own timings. Resolves with { modelId, promptTps, genTps, genTokens, seconds, at }
 * and keeps the last 50 results.
 */
export async function speedTest(modelId) {
  if (!(await builtinStatus()).running) await startBuiltinAi();
  const loaded = (await routerModels()).find(m => m.id === modelId)?.status === 'loaded';
  if (!loaded) await loadBuiltinModel(modelId);
  const res = await router('/v1/chat/completions', 'POST', {
    model: modelId,
    messages: [{ role: 'user', content: SPEED_PROMPT }],
    max_tokens: 320,
    temperature: 0,
    reasoning_effort: 'none',
  });
  const t = res?.timings;
  if (!t) throw new Error(String(res?.error?.message || res?.error || 'The model did not reply.'));
  const result = {
    modelId,
    promptTps: Math.round(t.prompt_per_second * 10) / 10,
    genTps: Math.round(t.predicted_per_second * 10) / 10,
    genTokens: t.predicted_n,
    seconds: Math.round((t.prompt_ms + t.predicted_ms) / 100) / 10,
    cpuOnly: Boolean((await getBuiltinConfig()).cpuOnly),
    at: new Date().toISOString(),
  };
  const past = await db.getSetting(SPEED_KEY, []).catch(() => []);
  await db.setSetting(SPEED_KEY, [result, ...(Array.isArray(past) ? past : [])].slice(0, 50));
  return result;
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * The same test on a model in LM Studio or Ollama ("lmstudio:<id>" / "ollama:<tag>"),
 * from the runtime's own numbers: LM Studio's REST stats, Ollama's eval timings.
 * Resolves with { modelId, runtime, genTps, promptTps?, firstTokenSec, genTokens, seconds, at }.
 */
export async function speedTestLocal(ref) {
  const parsed = parseModelRef(ref);
  if (!parsed || !['lmstudio', 'ollama'].includes(parsed.runtime)) throw new Error('Pick a model in LM Studio or Ollama.');
  const cfg = LOCAL_RUNTIMES[parsed.runtime];
  let result;
  if (parsed.runtime === 'lmstudio') {
    const res = await queryLocalAi(cfg.port, '/api/v0/chat/completions', 'POST', {
      model: parsed.model,
      messages: [{ role: 'user', content: SPEED_PROMPT }],
      max_tokens: 320,
      temperature: 0,
      stream: false,
      reasoning_effort: 'none',
    });
    const s = res?.stats;
    if (!s || !Number.isFinite(s.tokens_per_second)) throw new Error(String(res?.error?.message || res?.error || `LM Studio did not reply. Is "${parsed.model}" loadable?`));
    result = {
      genTps: round1(s.tokens_per_second),
      firstTokenSec: round1(s.time_to_first_token),
      genTokens: res.usage?.completion_tokens ?? null,
      seconds: round1((s.time_to_first_token || 0) + (s.generation_time || 0)),
    };
  } else {
    const cpuOnly = ollamaCpuOnly();
    const res = await queryLocalAi(cfg.port, '/api/chat', 'POST', {
      model: parsed.model,
      messages: [{ role: 'user', content: SPEED_PROMPT }],
      stream: false,
      think: false,
      options: { temperature: 0, num_predict: 320, ...(cpuOnly ? { num_gpu: 0 } : {}) },
    });
    if (!res?.eval_count || !res?.eval_duration) throw new Error(String(res?.error || `Ollama did not reply. Is "${parsed.model}" installed?`));
    result = {
      genTps: round1(res.eval_count / (res.eval_duration / 1e9)),
      promptTps: res.prompt_eval_duration ? round1((res.prompt_eval_count || 0) / (res.prompt_eval_duration / 1e9)) : null,
      firstTokenSec: round1(((res.load_duration || 0) + (res.prompt_eval_duration || 0)) / 1e9),
      genTokens: res.eval_count,
      seconds: round1((res.total_duration || 0) / 1e9),
      cpuOnly,
    };
  }
  const entry = { modelId: ref, runtime: parsed.runtime, ...result, at: new Date().toISOString() };
  const past = await db.getSetting(SPEED_KEY, []).catch(() => []);
  await db.setSetting(SPEED_KEY, [entry, ...(Array.isArray(past) ? past : [])].slice(0, 50));
  return entry;
}

export async function speedTestHistory() {
  const past = await db.getSetting(SPEED_KEY, []).catch(() => []);
  return Array.isArray(past) ? past : [];
}

let autostarted = false;
/** Once per launch: start the built-in AI if it is set up and auto-start is on. */
export async function autostartBuiltinAi({ notify } = {}) {
  if (autostarted || !isTauri()) return;
  autostarted = true;
  const cfg = await getBuiltinConfig();
  if (!cfg.autoStart || !cfg.installDir) return;
  const cat = await catalog(cfg.installDir).catch(() => null);
  if (!cat?.runtime_installed || !(await defaultModelId())) return;
  try {
    await startBuiltinAi();
  } catch (err) {
    notify?.({ title: 'Built-in AI did not start', message: err.message, appId: 'ai_engines' });
  }
}

// ── Hugging Face ───────────────────────────────────────────────────────────

const HF = 'https://huggingface.co';

/** Repos with GGUF files matching `query`, most downloaded first. */
export async function searchHuggingFace(query) {
  const url = `${HF}/api/models?search=${encodeURIComponent(query.trim())}&filter=gguf&sort=downloads&direction=-1&limit=24`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hugging Face search failed (${res.status}).`);
  return (await res.json()).map(m => ({ id: m.id || m.modelId, downloads: m.downloads || 0, likes: m.likes || 0, updated: m.lastModified || m.createdAt || null }));
}

/**
 * A repo's downloadable choices: { repo, gated, license, quants: [{ quant, files, bytes }], vision: [file] }.
 * Split models (…-00001-of-00003.gguf) are one choice. Files carry Hugging Face's SHA-256.
 */
export async function huggingFaceRepo(repo) {
  const [infoRes, treeRes] = await Promise.all([
    fetch(`${HF}/api/models/${repo}`),
    fetch(`${HF}/api/models/${repo}/tree/main?recursive=true`),
  ]);
  if (!infoRes.ok) throw new Error(infoRes.status === 404 ? 'That repo was not found on Hugging Face.' : `Hugging Face returned ${infoRes.status}.`);
  const info = await infoRes.json();
  const tree = treeRes.ok ? await treeRes.json() : [];
  const { quants, vision } = groupGgufFiles(tree);
  return {
    repo,
    gated: Boolean(info.gated),
    license: info.cardData?.license || info.cardData?.license_name || null,
    downloads: info.downloads || 0,
    quants,
    vision,
  };
}

export async function openModelsFolder() {
  const { installDir } = await getBuiltinConfig();
  if (installDir) await invoke('llm_open_models_folder', { installDir });
}

/** Download one quantization of a repo (plus an mmproj file, for image input) into the models folder. */
export async function downloadFromHuggingFace(repo, quantChoice, visionFile = null) {
  const cfg = await getBuiltinConfig();
  if (!cfg.installDir) throw new Error('Choose a folder for the built-in AI first.');
  const files = [...quantChoice.files, ...(visionFile ? [visionFile] : [])].map(f => ({ path: f.path, sha256: f.sha256, bytes: f.bytes }));
  const name = hfModelName(repo, quantChoice.quant);
  await invoke('llm_download_hf', { installDir: cfg.installDir, repo, name, files, token: cfg.hfToken || null });
  return name;
}
