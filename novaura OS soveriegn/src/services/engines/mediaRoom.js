// mediaRoom.js — Room on the graphics card for image and music models.
//
// ComfyUI manages only its own memory. Chat models loaded in LM Studio, Ollama or
// the built-in AI keep theirs until something unloads them, so a song or image job
// can find the card full. Before a job, Sovereign compares the room ComfyUI can
// get with what the job's models need and, when it is short, unloads chat models,
// the smallest that is enough (else the smallest, then the next), until the job
// fits. They load again by themselves the next time something asks them for a
// reply. The other way round, a chat model that cannot load asks ComfyUI to let go
// of its models (releaseComfyModels).
//
// No app imports, so tests can load it directly.

export const COMFY_URL = 'http://127.0.0.1:8188';

const GB = 1024 ** 3;
/** Working memory a job needs on top of its weights (latents, attention, decoding). */
export const HEADROOM_BYTES = 1.5 * GB;

// Loader nodes and the inputs that name a model file.
const LOADER_INPUTS = {
  CheckpointLoaderSimple: ['ckpt_name'],
  UNETLoader: ['unet_name'],
  CLIPLoader: ['clip_name'],
  DualCLIPLoader: ['clip_name1', 'clip_name2'],
  TripleCLIPLoader: ['clip_name1', 'clip_name2', 'clip_name3'],
  VAELoader: ['vae_name'],
  LoraLoader: ['lora_name'],
  LoraLoaderModelOnly: ['lora_name'],
  ControlNetLoader: ['control_net_name'],
  UpscaleModelLoader: ['model_name'],
};

/** The model files a workflow loads, each once. */
export function workflowModelFiles(workflow) {
  const files = new Set();
  for (const node of Object.values(workflow || {})) {
    for (const input of LOADER_INPUTS[node?.class_type] || []) {
      const file = node.inputs?.[input];
      if (typeof file === 'string' && file) files.add(file);
    }
  }
  return [...files];
}

/**
 * Memory a job needs: its model files, doubled on cards that run weights in fp32
 * (ComfyUI does on NVIDIA cards older than Pascal), plus headroom. Files ComfyUI
 * does not report are left out; 0 when none is known.
 * installed: [{ file, bytes }] from engine_list_models.
 */
export function jobNeedBytes(files, installed, { fp32 = false } = {}) {
  let weights = 0;
  for (const file of files || []) {
    const hit = (installed || []).find(m => m.file === file);
    if (hit) weights += hit.bytes || 0;
  }
  return weights ? weights * (fp32 ? 2 : 1) + HEADROOM_BYTES : 0;
}

/** True for an NVIDIA compute capability ("52", "86", "120") on which ComfyUI keeps weights in fp32. */
export function runsInFp32(capability) {
  const cap = Number(capability);
  return Number.isFinite(cap) && cap > 0 && Math.floor(cap / 10) < 6;
}

/**
 * The room ComfyUI can get on its device, from /system_stats: what is free plus
 * what its own models hold (it unloads those itself when a job needs the space).
 * { kind: 'vram' | 'ram', bytes }, or null when it cannot be measured (DirectML
 * reports a fixed placeholder).
 */
export function deviceRoom(stats) {
  const d = stats?.devices?.[0];
  if (!d || !Number.isFinite(d.vram_free)) return null;
  if (d.type === 'cpu') return { kind: 'ram', bytes: d.vram_free };
  if (d.type === 'privateuseone' || /directml/i.test(String(d.name))) return null;
  const ownModels = Math.max(0, (d.torch_vram_total || 0) - (d.torch_vram_free || 0));
  return { kind: 'vram', bytes: d.vram_free + ownModels };
}

/** Below this on ComfyUI's card, a runtime's models free nothing worth unloading them for. */
export const MIN_ON_CARD_BYTES = 256 * 1024 ** 2;

const lower = (s) => String(s || '').toLowerCase().replace(/\//g, '\\');
const under = (path, dir) => Boolean(dir) && lower(path).startsWith(lower(dir).replace(/\\+$/, '') + '\\');

/**
 * Where chat models really sit. A model's file size says little: LM Studio may
 * keep most of a model in system RAM, or on a second graphics card. With Windows'
 * graphics memory per process (engine_gpu_process_memory: [{ adapter, bytes, path }]),
 * each candidate's gpuBytes becomes its share of what its runtime holds on
 * ComfyUI's card, and a runtime with almost nothing there frees nothing for it
 * (onGpu false). Candidates come back unchanged when ComfyUI's card can't be
 * told (its process holds no graphics memory, or the list is empty).
 * comfyDir: the engine's install folder; builtinDir: the built-in AI's folder,
 * which may sit inside it.
 */
export function placeOnComfyCard(candidates, processes, { comfyDir, builtinDir = '' } = {}) {
  const procs = Array.isArray(processes) ? processes : [];
  const comfy = procs
    .filter(p => under(p.path, comfyDir) && !under(p.path, builtinDir) && /python[^\\]*\.exe$/i.test(String(p.path)))
    .sort((a, b) => b.bytes - a.bytes)[0];
  if (!comfy) return candidates;
  const owner = (path) => (under(path, builtinDir) ? 'novaura'
    : /\\\.lmstudio\\/i.test(lower(path)) ? 'lmstudio'
    : /\\ollama[^\\]*\.exe$|\\ollama\\/i.test(lower(path)) ? 'ollama'
    : null);
  const onCard = {};
  for (const p of procs) {
    if (p === comfy || p.adapter !== comfy.adapter) continue;
    const who = owner(p.path);
    if (who) onCard[who] = (onCard[who] || 0) + (p.bytes || 0);
  }
  const totals = {};
  for (const c of candidates) totals[c.runtime] = (totals[c.runtime] || 0) + (c.bytes || 0);
  return candidates.map(c => {
    const here = onCard[c.runtime] || 0;
    if (here < MIN_ON_CARD_BYTES) return { ...c, gpuBytes: 0, onGpu: false };
    const share = totals[c.runtime] ? Math.round(here * (c.bytes || 0) / totals[c.runtime]) : here;
    return { ...c, gpuBytes: share, onGpu: true };
  });
}

const sizeOn = (c, vram) => (vram && Number.isFinite(c.gpuBytes) ? c.gpuBytes : c.bytes) || 0;

/**
 * The chat model to unload next for a shortfall: the smallest that frees enough
 * by itself, else the smallest (the next call picks again with what is left).
 * candidates: [{ runtime, id, label, bytes, gpuBytes?, onGpu: true | false | null }].
 * When the shortfall is VRAM, models known to run on the CPU are skipped: they free none.
 */
export function nextEviction(candidates, shortfall, { vram = true } = {}) {
  const eligible = (candidates || [])
    .filter(c => !(vram && c.onGpu === false) && sizeOn(c, vram) > 0)
    .sort((a, b) => sizeOn(a, vram) - sizeOn(b, vram));
  return eligible.find(c => sizeOn(c, vram) >= shortfall) || eligible[0] || null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Unload chat models until `need` bytes fit. readRoom() resolves with the current
 * room in bytes (or null), unload(model) unloads one. A model whose unloading
 * frees almost nothing here lives on another graphics card or in system RAM; the
 * other models of its runtime with no known placement are then left alone.
 * Resolves with the models unloaded, in order.
 */
export async function freeRoom({ need, room, candidates, vram = true, readRoom, unload, onStatus, settleMs = 750, settleTries = 10 }) {
  let left = [...(candidates || [])];
  let current = room;
  const unloaded = [];
  while (current < need) {
    const pick = nextEviction(left, need - current, { vram });
    if (!pick) break;
    left = left.filter(c => c !== pick);
    onStatus?.(`Unloading ${pick.label} to make room…`);
    try {
      await unload(pick);
    } catch (err) {
      console.warn('[MediaRoom] Could not unload', pick.label, err?.message || err);
      continue;
    }
    unloaded.push(pick);
    // The runtime hands the memory back within a second or two.
    const before = current;
    const expected = sizeOn(pick, vram);
    for (let i = 0; i < settleTries; i++) {
      await sleep(settleMs);
      current = (await readRoom()) ?? current;
      if (current - before >= expected * 0.5) break;
    }
    if (current - before < expected * 0.1) left = left.filter(c => c.runtime !== pick.runtime || c.onGpu === true);
  }
  return unloaded;
}

/** True for a ComfyUI error caused by running out of memory. */
export const isOutOfMemory = (message) => /out of memory|OutOfMemoryError|Allocation on device|not enough memory|DefaultCPUAllocator|E_OUTOFMEMORY/i.test(String(message || ''));

const comfyStats = () => fetch(`${COMFY_URL}/system_stats`, { signal: AbortSignal.timeout(2500) }).then(r => r.json()).catch(() => null);

/** Releases closer together than this are skipped, so a run of failing chats can't keep emptying ComfyUI. */
export const RELEASE_COOLDOWN_MS = 60000;
let lastRelease = 0;

/**
 * Ask ComfyUI to unload its models and drop its caches, so a chat model can load,
 * and wait (up to waitMs) until the memory is back; that takes a few seconds, and
 * a job in progress finishes first. Resolves true when ComfyUI let go of at least
 * 1 GB; false when it isn't running, holds less, or released within the last minute.
 */
export async function releaseComfyModels({ waitMs = 10000 } = {}) {
  const held = (await comfyStats())?.devices?.[0];
  if (!held || held.type === 'cpu' || (held.torch_vram_total || 0) < GB) return false;
  if (Date.now() - lastRelease < RELEASE_COOLDOWN_MS) return false;
  lastRelease = Date.now();
  try {
    const res = await fetch(`${COMFY_URL}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  for (const t0 = Date.now(); Date.now() - t0 < waitMs;) {
    await sleep(750);
    const d = (await comfyStats())?.devices?.[0];
    if (!d || d.type === 'cpu' || (d.torch_vram_total || 0) < 0.5 * GB) break;
  }
  return true;
}
