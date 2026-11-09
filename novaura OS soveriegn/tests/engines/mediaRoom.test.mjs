import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  workflowModelFiles, jobNeedBytes, runsInFp32, deviceRoom, placeOnComfyCard, nextEviction, freeRoom, isOutOfMemory, HEADROOM_BYTES,
  releaseComfyModels, RELEASE_COOLDOWN_MS,
} from '../../src/services/engines/mediaRoom.js';
import { buildWarmupWorkflow, isDynamicVramFailure } from '../../src/services/engines/checkpoints.js';

const GB = 1024 ** 3;

// The two checkpoints on the test PC, with their real sizes.
const INSTALLED = [
  { folder: 'checkpoints', file: 'ace_step_1.5_turbo_aio.safetensors', bytes: 10_030_000_000 },
  { folder: 'checkpoints', file: 'sd_xl_base_1.0.safetensors', bytes: 6_940_000_000 },
  { folder: 'vae', file: 'sdxl_vae.safetensors', bytes: 335_000_000 },
];

// /system_stats from ComfyUI 0.44 on a 24 GB Quadro with SDXL loaded.
const QUADRO = {
  devices: [{ name: 'cuda:0 Quadro M6000 24GB : native', type: 'cuda', index: 0, vram_total: 25769541632, vram_free: 14448674816, torch_vram_total: 10559160320, torch_vram_free: 210388992 }],
};

test('a workflow names its model files once, from every kind of loader', () => {
  assert.deepEqual(workflowModelFiles(buildWarmupWorkflow('sd_xl_base_1.0.safetensors')), ['sd_xl_base_1.0.safetensors']);
  const wf = {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'a.safetensors' } },
    2: { class_type: 'VAELoader', inputs: { vae_name: 'v.safetensors' } },
    3: { class_type: 'DualCLIPLoader', inputs: { clip_name1: 'c1.safetensors', clip_name2: 'c2.safetensors' } },
    4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'a.safetensors' } },
    5: { class_type: 'KSampler', inputs: { model: ['1', 0] } },
  };
  assert.deepEqual(workflowModelFiles(wf), ['a.safetensors', 'v.safetensors', 'c1.safetensors', 'c2.safetensors']);
  assert.deepEqual(workflowModelFiles(null), []);
});

test('a job needs its weights plus headroom, twice the weights on fp32 cards', () => {
  const files = ['sd_xl_base_1.0.safetensors', 'sdxl_vae.safetensors'];
  assert.equal(jobNeedBytes(files, INSTALLED), 7_275_000_000 + HEADROOM_BYTES);
  assert.equal(jobNeedBytes(files, INSTALLED, { fp32: true }), 2 * 7_275_000_000 + HEADROOM_BYTES);
  // Files ComfyUI doesn't report can't be sized: no estimate, so nothing is unloaded for them.
  assert.equal(jobNeedBytes(['unknown.safetensors'], INSTALLED), 0);
});

test('only NVIDIA cards older than Pascal keep weights in fp32', () => {
  assert.equal(runsInFp32('52'), true); // Maxwell (Quadro M6000)
  assert.equal(runsInFp32('61'), false);
  assert.equal(runsInFp32('86'), false);
  assert.equal(runsInFp32('120'), false); // Blackwell, 12.0
  assert.equal(runsInFp32(undefined), false);
});

test('room counts what ComfyUI\'s own models hold, since it unloads those itself', () => {
  const room = deviceRoom(QUADRO);
  assert.equal(room.kind, 'vram');
  assert.equal(room.bytes, 14448674816 + 10559160320 - 210388992);
  assert.deepEqual(deviceRoom({ devices: [{ type: 'cpu', name: 'cpu', vram_free: 8 * GB, torch_vram_total: 64 * GB, torch_vram_free: 8 * GB }] }), { kind: 'ram', bytes: 8 * GB });
  // DirectML reports a fixed 1 GB: unmeasurable, so never a reason to unload anything.
  assert.equal(deviceRoom({ devices: [{ type: 'privateuseone', name: 'privateuseone:0', vram_free: GB, torch_vram_total: GB, torch_vram_free: GB }] }), null);
  assert.equal(deviceRoom(null), null);
  assert.equal(deviceRoom({ devices: [] }), null);
});

const LOADED = [
  { runtime: 'lmstudio', id: 'big', label: 'Big (LM Studio)', bytes: 18 * GB, onGpu: null },
  { runtime: 'lmstudio', id: 'mid', label: 'Mid (LM Studio)', bytes: 7 * GB, onGpu: null },
  { runtime: 'ollama', id: 'tiny', label: 'tiny (Ollama)', bytes: 2 * GB, gpuBytes: 2 * GB, onGpu: true },
  { runtime: 'ollama', id: 'cpu', label: 'cpu (Ollama)', bytes: 5 * GB, gpuBytes: 0, onGpu: false },
];

test('the smallest model that frees enough goes first', () => {
  assert.equal(nextEviction(LOADED, 6 * GB).id, 'mid');
  assert.equal(nextEviction(LOADED, 1 * GB).id, 'tiny');
  assert.equal(nextEviction(LOADED, 10 * GB).id, 'big');
});

test('when none is enough alone, the smallest goes first', () => {
  assert.equal(nextEviction(LOADED, 30 * GB).id, 'tiny');
});

test('models running on the CPU free no VRAM, but do free RAM', () => {
  const onlyCpu = LOADED.filter(c => c.id === 'cpu');
  assert.equal(nextEviction(onlyCpu, GB), null);
  assert.equal(nextEviction(onlyCpu, GB, { vram: false }).id, 'cpu');
  assert.equal(nextEviction([], GB), null);
});

// A fake PC: unloading a model hands its memory back to the card, unless it lives elsewhere.
function fakePc({ room, onCard }) {
  const state = { room, unloaded: [] };
  return {
    state,
    readRoom: async () => state.room,
    unload: async (m) => {
      state.unloaded.push(m.id);
      if (onCard.includes(m.id)) state.room += m.gpuBytes ?? m.bytes;
    },
  };
}

test('freeRoom unloads until the job fits, then stops', async () => {
  const pc = fakePc({ room: 4 * GB, onCard: ['big', 'mid', 'tiny'] });
  const statuses = [];
  const unloaded = await freeRoom({ need: 10 * GB, room: 4 * GB, candidates: LOADED, readRoom: pc.readRoom, unload: pc.unload, onStatus: s => statuses.push(s), settleMs: 1 });
  assert.deepEqual(unloaded.map(u => u.id), ['mid']);
  assert.equal(pc.state.room, 11 * GB);
  assert.match(statuses[0], /Unloading Mid \(LM Studio\)/);
});

test('freeRoom does nothing when the job already fits', async () => {
  const pc = fakePc({ room: 20 * GB, onCard: [] });
  const unloaded = await freeRoom({ need: 10 * GB, room: 20 * GB, candidates: LOADED, readRoom: pc.readRoom, unload: pc.unload, settleMs: 1 });
  assert.deepEqual(unloaded, []);
  assert.deepEqual(pc.state.unloaded, []);
});

test('a runtime whose model freed nothing here is left alone after that', async () => {
  // LM Studio runs on a second graphics card: unloading its models frees nothing for ComfyUI.
  const pc = fakePc({ room: 4 * GB, onCard: ['tiny'] });
  const unloaded = await freeRoom({ need: 10 * GB, room: 4 * GB, candidates: LOADED, readRoom: pc.readRoom, unload: pc.unload, settleMs: 1, settleTries: 2 });
  // 'mid' is tried once (and frees nothing), so 'big' is spared; Ollama's GPU model goes.
  assert.deepEqual(unloaded.map(u => u.id), ['mid', 'tiny']);
  assert.ok(!pc.state.unloaded.includes('big'));
});

test('a model that refuses to unload is skipped, not retried', async () => {
  const pc = fakePc({ room: 4 * GB, onCard: ['big', 'tiny'] });
  const unload = async (m) => { if (m.id === 'mid') throw new Error('busy'); return pc.unload(m); };
  const unloaded = await freeRoom({ need: 10 * GB, room: 4 * GB, candidates: LOADED, readRoom: pc.readRoom, unload, settleMs: 1 });
  assert.deepEqual(unloaded.map(u => u.id), ['big']);
});

// engine_gpu_process_memory on the test PC: ComfyUI on the Quadro (adapter …16f6d),
// the desktop on the Radeon (…17bfd), and LM Studio's runtime with 1.45 GB on the Quadro.
const QUADRO_CARD = '0x00000000_0x00016f6d';
const RADEON_CARD = '0x00000000_0x00017bfd';
const PROCESSES = [
  { pid: 36516, adapter: QUADRO_CARD, bytes: 10_559_160_320, path: 'E:\\NovauraAI\\tools\\python\\cpython-3.12-windows-x86_64-none\\python.exe' },
  { pid: 20644, adapter: QUADRO_CARD, bytes: 1_556_925_644, path: 'C:\\Users\\Busin\\.lmstudio\\extensions\\backends\\llama.cpp-win-x86_64-vulkan-avx2-2.41.0\\llama-server.exe' },
  { pid: 14512, adapter: RADEON_CARD, bytes: 41_750_528, path: 'D:\\lm studio\\LM Studio.exe' },
  { pid: 9048, adapter: RADEON_CARD, bytes: 506_933_248, path: 'C:\\WINDOWS\\Explorer.EXE' },
  { pid: 1832, adapter: RADEON_CARD, bytes: 112_390_144, path: null },
];
const QWEN = { runtime: 'lmstudio', id: 'qwen/qwen3.6-35b-a3b', label: 'Qwen3.6 35B A3B (LM Studio)', bytes: 22_069_769_172, onGpu: null };

test('a model counts only what its runtime holds on ComfyUI\'s card', () => {
  const [placed] = placeOnComfyCard([QWEN], PROCESSES, { comfyDir: 'E:\\NovauraAI', builtinDir: 'E:\\NovauraAI\\BuiltInAI' });
  // 20.5 GB on disk, 1.45 GB on the Quadro: unloading it frees 1.45 GB for ComfyUI.
  assert.equal(placed.gpuBytes, 1_556_925_644);
  assert.equal(placed.onGpu, true);
  // So it is not "enough" for a 5 GB shortfall when something else is.
  const ollama = { runtime: 'ollama', id: 'g', label: 'g (Ollama)', bytes: 9 * GB, gpuBytes: 6 * GB, onGpu: true };
  assert.equal(nextEviction([placed, ollama], 5 * GB).id, 'g');
});

test('a runtime on another card frees nothing for ComfyUI', () => {
  const elsewhere = PROCESSES.map(p => (p.pid === 20644 ? { ...p, adapter: RADEON_CARD } : p));
  const [placed] = placeOnComfyCard([QWEN], elsewhere, { comfyDir: 'E:\\NovauraAI' });
  assert.equal(placed.onGpu, false);
  assert.equal(nextEviction([placed], GB), null);
});

test('several models of one runtime share its memory on the card by size', () => {
  const small = { ...QWEN, id: 'small', bytes: 7_000_000_000 };
  const big = { ...QWEN, id: 'big', bytes: 21_000_000_000 };
  const [s, b] = placeOnComfyCard([small, big], PROCESSES, { comfyDir: 'E:\\NovauraAI' });
  assert.equal(s.gpuBytes + b.gpuBytes, 1_556_925_644);
  assert.ok(b.gpuBytes > s.gpuBytes * 2.9);
});

test('the built-in AI inside the engine folder is not mistaken for ComfyUI', () => {
  const procs = [
    { pid: 1, adapter: QUADRO_CARD, bytes: 4 * GB, path: 'E:\\NovauraAI\\BuiltInAI\\runtime\\llama-server.exe' },
    { pid: 2, adapter: QUADRO_CARD, bytes: 300 * 1024 ** 2, path: 'E:\\NovauraAI\\tools\\python\\python.exe' },
  ];
  const gemma = { runtime: 'novaura', id: 'gemma-4-e4b', label: 'gemma-4-e4b (Built-in AI)', bytes: 5 * GB, onGpu: null };
  const [placed] = placeOnComfyCard([gemma], procs, { comfyDir: 'E:\\NovauraAI', builtinDir: 'E:\\NovauraAI\\BuiltInAI' });
  assert.equal(placed.gpuBytes, 4 * GB);
});

test('without ComfyUI in the list, candidates stay as they were', () => {
  assert.deepEqual(placeOnComfyCard([QWEN], [], { comfyDir: 'E:\\NovauraAI' }), [QWEN]);
  assert.deepEqual(placeOnComfyCard([QWEN], PROCESSES.slice(1), { comfyDir: 'E:\\NovauraAI' }), [QWEN]);
});

test('ComfyUI is asked to let go only when it holds memory, at most once a minute', async () => {
  const realFetch = globalThis.fetch;
  let held = 0.2 * GB;
  const posts = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (opts.method === 'POST') { posts.push(JSON.parse(opts.body)); held = 0.1 * GB; return { ok: true }; }
    return { ok: true, json: async () => ({ devices: [{ type: 'cuda', vram_free: 10 * GB, torch_vram_total: held, torch_vram_free: 0 }] }) };
  };
  try {
    // Next to nothing loaded: releasing would only cost the next image or song a reload.
    assert.equal(await releaseComfyModels({ waitMs: 50 }), false);
    assert.equal(posts.length, 0);
    held = 10 * GB;
    assert.equal(await releaseComfyModels({ waitMs: 2000 }), true);
    assert.deepEqual(posts, [{ unload_models: true, free_memory: true }]);
    // A second failing chat right after doesn't empty it again.
    held = 10 * GB;
    assert.equal(await releaseComfyModels({ waitMs: 50 }), false);
    assert.equal(posts.length, 1);
    assert.ok(RELEASE_COOLDOWN_MS >= 60000);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('out-of-memory errors are told apart from the dynamic VRAM failure', () => {
  for (const msg of [
    'Generation failed: Allocation on device 0 would exceed allowed memory. (out of memory)',
    'Generation failed: CUDA out of memory. Tried to allocate 2.00 GiB',
    'torch.OutOfMemoryError: CUDA out of memory.',
    'Generation failed: [enforce fail at alloc_cpu.cpp:117] data. DefaultCPUAllocator: not enough memory',
  ]) assert.equal(isOutOfMemory(msg), true, msg);
  const dynamic = 'Generation failed: hostbuf_file_reader failed: Insufficient system resources exist to complete the requested service. (os error 1450)';
  assert.equal(isOutOfMemory(dynamic), false);
  assert.equal(isDynamicVramFailure(dynamic), true);
  assert.equal(isOutOfMemory('The AI engine rejected the job: 400'), false);
});
