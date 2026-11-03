// comfyEngine.js — ComfyUI as a managed local engine for music, images and icons.
//
// One click installs ComfyUI with the right PyTorch for the user's GPU (see
// src-tauri/scripts/install-comfyui.ps1), starts it on 127.0.0.1:8188 and
// downloads models from a verified catalog. Everything runs on the user's PC.

import { db } from '../../database/sovereignDatabase.js';
import { isDynamicVramFailure } from './checkpoints.js';

const CONFIG_KEY = 'ai_engine_config';
export const COMFY_URL = 'http://127.0.0.1:8188';
const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

async function invoke(cmd, args) {
  if (!isTauri()) throw new Error('This needs the Sovereign desktop app.');
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke(cmd, args);
}

// ── Model catalog (sizes and licenses checked against Hugging Face) ───────────

export const MODEL_CATALOG = [
  {
    id: 'ace15-turbo',
    name: 'ACE-Step 1.5 Turbo',
    purpose: 'music',
    summary: 'Full songs with vocals and lyrics, or instrumentals. Genre, mood, BPM, key and language control. Fast (8 steps).',
    license: 'Apache-2.0',
    commercial: true,
    vramGb: 12,
    files: [{ url: 'https://huggingface.co/Comfy-Org/ACE-Step-1.5/resolve/main/checkpoints/ace_step_1.5_turbo_aio.safetensors', rel: 'models/checkpoints/ace_step_1.5_turbo_aio.safetensors', bytes: 10030000000 }],
    recommended: true,
  },
  {
    id: 'ace-v1',
    name: 'ACE-Step v1 3.5B',
    purpose: 'music',
    summary: 'The earlier ACE-Step release. Smaller download; slower (50 steps) and less polished than 1.5.',
    license: 'Apache-2.0',
    commercial: true,
    vramGb: 10,
    files: [{ url: 'https://huggingface.co/Comfy-Org/ACE-Step/resolve/main/all_in_one/ace_step_v1_3.5b.safetensors', rel: 'models/checkpoints/ace_step_v1_3.5b.safetensors', bytes: 7700000000 }],
  },
  {
    id: 'sdxl-base',
    name: 'Stable Diffusion XL 1.0',
    purpose: 'image',
    summary: 'Album covers, app icons and artwork at 1024 px.',
    license: 'CreativeML Open RAIL++-M',
    commercial: true,
    licenseNote: 'Commercial use allowed; use restrictions on harmful content apply.',
    vramGb: 8,
    files: [{ url: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors', rel: 'models/checkpoints/sd_xl_base_1.0.safetensors', bytes: 6940000000 }],
    recommended: true,
  },
];

export function modelFileName(entry) {
  return entry.files[0].rel.split('/').pop();
}

// ── Configuration ──────────────────────────────────────────────────────────

// autoStart: start the engine when the desktop opens and load defaultModel
// ('' picks the best installed image model). stopOnExit: stop it when Sovereign closes.
// classicLoading: start ComfyUI with --disable-dynamic-vram (see isDynamicVramFailure).
export async function getEngineConfig() {
  return { installDir: '', torchVariant: '', autoStart: true, stopOnExit: true, defaultModel: '', classicLoading: false, ...(await db.getSetting(CONFIG_KEY, {}).catch(() => ({}))) };
}

export async function setEngineConfig(patch) {
  const next = { ...(await getEngineConfig()), ...patch };
  await db.setSetting(CONFIG_KEY, next);
  return next;
}

/**
 * Pick a PyTorch backend for this PC.
 * Returns { variant, reason, warning? }.
 */
export function recommendBackend(hw) {
  const nv = hw?.nvidia;
  if (nv) {
    const cap = parseFloat(nv.compute_cap) || 0;
    const driver = parseFloat(nv.driver) || 0;
    if (driver && driver < 560) {
      return { variant: 'cpu', reason: `${nv.name} found, but driver ${nv.driver} is too old for current PyTorch.`, warning: 'Update the NVIDIA driver to 560 or newer to use the GPU. Running on the CPU until then.' };
    }
    if (cap >= 7.5 && driver >= 570) return { variant: 'cu128', reason: `${nv.name} (compute ${nv.compute_cap}) with CUDA 12.8.` };
    return { variant: 'cu126', reason: `${nv.name} (compute ${nv.compute_cap}) with CUDA 12.6, which still supports older cards.` };
  }
  const amd = (hw?.gpus || []).find(g => /radeon|amd/i.test(g));
  if (amd) return { variant: 'directml', reason: `${amd} through DirectML.`, warning: 'AMD support on Windows uses DirectML: it works, but slower than NVIDIA CUDA.' };
  return { variant: 'cpu', reason: 'No supported GPU found; running on the CPU (slow, but it works).' };
}

export function hardware() {
  return invoke('engine_hardware');
}

// ── Install, start, stop ───────────────────────────────────────────────────

export async function installComfy(installDir, torchVariant) {
  await setEngineConfig({ installDir, torchVariant });
  return invoke('engine_install_comfyui', { installDir, torchVariant });
}

export function installStatus(installDir) {
  return invoke('engine_install_status', { installDir });
}

/** Tell the native side whether to stop the engine when Sovereign exits. */
export async function applyStopOnExit() {
  const { installDir, stopOnExit } = await getEngineConfig();
  if (installDir) await invoke('engine_comfy_stop_on_exit', { installDir, enabled: stopOnExit !== false });
}

export async function startComfy() {
  const { installDir, torchVariant, classicLoading } = await getEngineConfig();
  if (!installDir) throw new Error('Install the engine first.');
  await applyStopOnExit().catch(() => {});
  const extra = torchVariant === 'cpu' ? ['--cpu'] : torchVariant === 'directml' ? ['--directml'] : [];
  if (classicLoading) extra.push('--disable-dynamic-vram');
  return invoke('engine_comfy_start', { installDir, extra });
}

/** True when err is the dynamic VRAM failure and the classic loader is not in use yet. */
export async function needsClassicLoading(err) {
  return isDynamicVramFailure(err?.message) && !(await getEngineConfig()).classicLoading;
}

/** Switch to the classic loader for good and restart the engine with it. */
export async function restartWithClassicLoading() {
  const { installDir } = await setEngineConfig({ classicLoading: true });
  await invoke('engine_comfy_stop', { installDir });
  for (let i = 0; i < 20 && (await probeComfy(500)); i++) await new Promise(r => setTimeout(r, 500));
  await ensureComfyRunning({ markReady: false });
}

export async function stopComfy() {
  const { installDir } = await getEngineConfig();
  const stopped = installDir ? await invoke('engine_comfy_stop', { installDir }) : false;
  setEngineStatus({ phase: 'idle' });
  return stopped;
}

// ── Engine status (the system bar shows it) ────────────────────────────────

let _status = { phase: 'idle', model: null, message: '' };
const _statusListeners = new Set();

/** { phase: 'idle' | 'starting' | 'loading' | 'ready' | 'error', model, message } */
export function getEngineStatus() {
  return _status;
}

export function subscribeEngineStatus(fn) {
  _statusListeners.add(fn);
  return () => { _statusListeners.delete(fn); };
}

export function setEngineStatus(next) {
  _status = { phase: 'idle', model: null, message: '', ...next };
  for (const fn of _statusListeners) fn(_status);
}

export async function comfyProcessStatus() {
  const { installDir } = await getEngineConfig();
  return installDir ? invoke('engine_comfy_status', { installDir }) : { alive: false, pid: null, log_tail: '' };
}

/** Is ComfyUI answering? Returns system stats or null. */
export async function probeComfy(timeoutMs = 2500) {
  try {
    const res = await fetch(`${COMFY_URL}/system_stats`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Start ComfyUI if needed and wait until it answers. markReady: false leaves the
 * status at 'starting' for a caller that loads a model next.
 */
export async function ensureComfyRunning({ timeoutMs = 180000, onStatus, markReady = true } = {}) {
  const running = { phase: 'ready', message: 'The local AI engine is running.' };
  if (await probeComfy()) {
    if (markReady && (_status.phase === 'idle' || _status.phase === 'error')) setEngineStatus(running);
    return true;
  }
  onStatus?.('Starting the local AI engine…');
  setEngineStatus({ phase: 'starting', message: 'Starting the local AI engine…' });
  try {
    await startComfy();
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      await new Promise(r => setTimeout(r, 2000));
      if (await probeComfy()) {
        if (markReady) setEngineStatus(running);
        return true;
      }
      const proc = await comfyProcessStatus().catch(() => null);
      if (proc && !proc.alive) {
        const last = (proc.log_tail || '').trim().split('\n').slice(-3).join(' ');
        throw new Error(`The AI engine stopped while starting. ${last}`);
      }
    }
    throw new Error('The AI engine did not start within 3 minutes.');
  } catch (err) {
    setEngineStatus({ phase: 'error', message: err.message || String(err) });
    throw err;
  }
}

// ── Models ─────────────────────────────────────────────────────────────────

export async function installedModels() {
  const { installDir } = await getEngineConfig();
  if (!installDir) return [];
  return invoke('engine_list_models', { installDir }).catch(() => []);
}

export function isModelInstalled(entry, installed) {
  return entry.files.every(f => {
    const [, folder, file] = f.rel.split('/');
    return installed.some(m => m.folder === folder && m.file === file);
  });
}

/**
 * Download a catalog model. Calls onProgress({ bytes, total, fraction }).
 * Resolves when every file is in place.
 */
const MAX_RESUMES = 8;

export async function downloadModel(entry, { onProgress, token } = {}) {
  const { installDir } = await getEngineConfig();
  if (!installDir) throw new Error('Install the engine first.');
  const total = entry.files.reduce((n, f) => n + (f.bytes || 0), 0);
  let doneBytes = 0;
  for (let i = 0; i < entry.files.length; i++) {
    const f = entry.files[i];
    const id = `${entry.id}-${i}`;
    const start = () => invoke('engine_download_model', { id, installDir, url: f.url, relPath: f.rel, token: token || null });
    if (await start()) { doneBytes += f.bytes || 0; continue; } // already on disk
    // curl already retries and resumes; if it still gives up (a long outage), wait
    // and resume from the partial file. Denied access and cancelling are final.
    let resumes = 0;
    for (;;) {
      await new Promise(r => setTimeout(r, 1500));
      const s = await invoke('engine_download_status', { id });
      onProgress?.({ bytes: doneBytes + s.bytes, total, fraction: total ? Math.min(1, (doneBytes + s.bytes) / total) : 0 });
      if (s.done) break;
      if (s.error === 'No such download') throw new Error('Download cancelled.');
      if (s.error) {
        if (/access denied/i.test(s.error) || resumes >= MAX_RESUMES) throw new Error(s.error);
        resumes++;
        const wait = Math.min(120, 15 * resumes);
        onProgress?.({ bytes: doneBytes + s.bytes, total, fraction: total ? Math.min(1, (doneBytes + s.bytes) / total) : 0, status: `Connection lost. Resuming in ${wait}s (try ${resumes} of ${MAX_RESUMES})` });
        await new Promise(r => setTimeout(r, wait * 1000));
        await start();
        continue;
      }
      if (!s.running) break;
    }
    doneBytes += f.bytes || 0;
  }
}

export async function cancelDownload(entry) {
  for (let i = 0; i < entry.files.length; i++) await invoke('engine_download_cancel', { id: `${entry.id}-${i}` }).catch(() => {});
}

// ── ComfyUI client ─────────────────────────────────────────────────────────

const _objectInfo = new Map();

export async function nodeInfo(nodeClass) {
  if (_objectInfo.has(nodeClass)) return _objectInfo.get(nodeClass);
  const res = await fetch(`${COMFY_URL}/object_info/${encodeURIComponent(nodeClass)}`);
  const data = res.ok ? await res.json() : {};
  const info = data[nodeClass] || null;
  _objectInfo.set(nodeClass, info);
  return info;
}

/** Names of the files ComfyUI can load for a loader input (e.g. checkpoints). */
export async function availableOptions(nodeClass, inputName) {
  _objectInfo.delete(nodeClass);
  const info = await nodeInfo(nodeClass);
  const spec = info?.input?.required?.[inputName] || info?.input?.optional?.[inputName];
  return Array.isArray(spec?.[0]) ? spec[0] : [];
}

/** Throw a readable error if this ComfyUI lacks a node the workflow needs. */
export async function requireNodes(classes) {
  const missing = [];
  for (const c of classes) if (!(await nodeInfo(c))) missing.push(c);
  if (missing.length) throw new Error(`This ComfyUI is missing ${missing.join(', ')}. Update it with Reinstall in AI Engines.`);
}

export async function uploadInput(file, name) {
  const form = new FormData();
  form.append('image', file, name || file.name);
  form.append('overwrite', 'true');
  const res = await fetch(`${COMFY_URL}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload to the AI engine failed (${res.status}).`);
  return (await res.json()).name;
}

/**
 * Queue a workflow and wait for its outputs.
 * Calls onProgress({ value, max, node }) from ComfyUI's live progress stream.
 * Resolves with [{ kind: 'audio' | 'image', filename, subfolder, type, url }].
 */
export async function runWorkflow(workflow, { onProgress, timeoutMs = 30 * 60000 } = {}) {
  const clientId = `nova_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let ws = null;
  try {
    ws = new WebSocket(`${COMFY_URL.replace('http', 'ws')}/ws?clientId=${clientId}`);
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return; // binary preview frames
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'progress') onProgress?.({ value: msg.data.value, max: msg.data.max, node: msg.data.node });
        else if (msg.type === 'executing' && msg.data?.node) onProgress?.({ node: msg.data.node });
      } catch { /* ignore */ }
    };
  } catch { /* progress is optional */ }

  try {
    const res = await fetch(`${COMFY_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      const detail = body.node_errors ? Object.values(body.node_errors).flatMap(n => n.errors || []).map(e => `${e.message}: ${e.details}`).join('; ') : '';
      throw new Error(`The AI engine rejected the job: ${body.error?.message || res.status}${detail ? ` (${detail})` : ''}`);
    }
    const promptId = body.prompt_id;
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      await new Promise(r => setTimeout(r, 1500));
      const h = await fetch(`${COMFY_URL}/history/${promptId}`).then(r => r.json()).catch(() => ({}));
      const run = h[promptId];
      if (!run) continue;
      if (run.status?.status_str === 'error') {
        const err = (run.status.messages || []).find(m => m[0] === 'execution_error')?.[1];
        throw new Error(`Generation failed${err ? `: ${err.exception_message}` : '.'}`);
      }
      if (run.status?.completed || Object.keys(run.outputs || {}).length) {
        const out = [];
        for (const node of Object.values(run.outputs || {})) {
          for (const a of node.audio || []) out.push({ kind: 'audio', ...a });
          for (const im of node.images || []) out.push({ kind: 'image', ...im });
        }
        if (out.length) {
          return out.map(o => ({ ...o, url: `${COMFY_URL}/view?filename=${encodeURIComponent(o.filename)}&subfolder=${encodeURIComponent(o.subfolder || '')}&type=${encodeURIComponent(o.type || 'output')}` }));
        }
      }
    }
    throw new Error('Generation timed out.');
  } finally {
    try { ws?.close(); } catch { /* already closed */ }
  }
}

export async function fetchOutput(output) {
  const res = await fetch(output.url);
  if (!res.ok) throw new Error(`Could not read the generated file (${res.status}).`);
  return res.blob();
}
