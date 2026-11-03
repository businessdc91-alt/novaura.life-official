import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isImageCheckpoint, chooseImageCheckpoint, buildWarmupWorkflow, isDynamicVramFailure } from '../../src/services/engines/checkpoints.js';

const INSTALLED = ['ace_step_1.5_turbo_aio.safetensors', 'dreamshaper_8.safetensors', 'sd_xl_base_1.0.safetensors'];

test('music checkpoints are never picked for images', () => {
  assert.equal(isImageCheckpoint('ace_step_1.5_turbo_aio.safetensors'), false);
  assert.equal(isImageCheckpoint('stable_audio_open_1.0.safetensors'), false);
  assert.equal(isImageCheckpoint('sd_xl_base_1.0.safetensors'), true);
  assert.equal(chooseImageCheckpoint(['ace_step_1.5_turbo_aio.safetensors']), null);
});

test('automatic choice prefers SDXL over alphabetical order', () => {
  assert.equal(chooseImageCheckpoint(INSTALLED), 'sd_xl_base_1.0.safetensors');
  assert.equal(chooseImageCheckpoint(INSTALLED, ''), 'sd_xl_base_1.0.safetensors');
});

test('the default model wins when ComfyUI has it', () => {
  assert.equal(chooseImageCheckpoint(INSTALLED, 'dreamshaper_8.safetensors'), 'dreamshaper_8.safetensors');
  // Removed from disk, or not an image model: fall back to the automatic choice.
  assert.equal(chooseImageCheckpoint(INSTALLED, 'gone.safetensors'), 'sd_xl_base_1.0.safetensors');
  assert.equal(chooseImageCheckpoint(INSTALLED, 'ace_step_1.5_turbo_aio.safetensors'), 'sd_xl_base_1.0.safetensors');
  assert.equal(chooseImageCheckpoint(undefined, 'x'), null);
});

test('warm-up job loads the checkpoint once, cheaply, and saves nothing', () => {
  const wf = buildWarmupWorkflow('sd_xl_base_1.0.safetensors', 7);
  const nodes = Object.values(wf);
  const loaders = nodes.filter(n => n.class_type === 'CheckpointLoaderSimple');
  assert.equal(loaders.length, 1);
  assert.deepEqual(loaders[0].inputs, { ckpt_name: 'sd_xl_base_1.0.safetensors' });
  const sampler = nodes.find(n => n.class_type === 'KSampler').inputs;
  assert.equal(sampler.steps, 1);
  assert.equal(sampler.cfg, 1);
  assert.equal(sampler.seed, 7);
  const latent = nodes.find(n => n.class_type === 'EmptyLatentImage').inputs;
  assert.ok(latent.width <= 256 && latent.height <= 256);
  assert.ok(nodes.some(n => n.class_type === 'PreviewImage'));
  assert.ok(!nodes.some(n => n.class_type === 'SaveImage'));
  // Every link points at a node in the graph.
  for (const n of nodes) {
    for (const v of Object.values(n.inputs)) if (Array.isArray(v)) assert.ok(wf[v[0]], `missing node ${v[0]}`);
  }
  // A fresh seed each time, so ComfyUI never skips it as already done.
  const seeds = new Set(Array.from({ length: 5 }, () => buildWarmupWorkflow('a')[4].inputs.seed));
  assert.ok(seeds.size > 1);
});

test('only the dynamic VRAM loader failure switches to classic loading', () => {
  // As runWorkflow reports the failure seen on a Quadro M6000 with ComfyUI 0.43.
  assert.equal(isDynamicVramFailure('Generation failed: hostbuf_file_reader_read failed'), true);
  assert.equal(isDynamicVramFailure('aimdo: src/xfer-file.c:120:ERROR:xfer_file_transfer: worker failed'), true);
  assert.equal(isDynamicVramFailure('Generation failed: CUDA out of memory.'), false);
  assert.equal(isDynamicVramFailure('The AI engine rejected the job: 400'), false);
  assert.equal(isDynamicVramFailure(undefined), false);
});
