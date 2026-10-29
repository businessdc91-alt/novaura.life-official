// imageGen.js — Album covers and app icons with a local SDXL model in ComfyUI,
// plus background removal so icons sit cleanly on any surface.

import { ensureComfyRunning, availableOptions, runWorkflow, fetchOutput, MODEL_CATALOG } from './comfyEngine.js';

const IMAGE_MODEL_PREFERENCE = [/sd_xl_base/i, /sdxl/i, /juggernaut/i, /dreamshaper/i, /realvis/i, /\.safetensors$/i];
const NOT_IMAGE = /ace_step|acestep|stable_audio|audio/i;

/** The best installed image checkpoint, or null (then offer MODEL_CATALOG's SDXL). */
export async function pickImageModel() {
  const names = (await availableOptions('CheckpointLoaderSimple', 'ckpt_name')).filter(n => !NOT_IMAGE.test(n));
  for (const re of IMAGE_MODEL_PREFERENCE) {
    const hit = names.find(n => re.test(n));
    if (hit) return hit;
  }
  return null;
}

export const SDXL_ENTRY = MODEL_CATALOG.find(m => m.id === 'sdxl-base');

export function buildImageWorkflow({ prompt, negative, checkpoint, width = 1024, height = 1024, steps = 25, cfg = 6.5, seed = Math.floor(Math.random() * 2 ** 31), prefix = 'Sovereign' }) {
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    2: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: prompt } },
    3: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: negative || 'text, watermark, signature, blurry, low quality, deformed, jpeg artifacts' } },
    4: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    5: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed, steps, cfg, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1 } },
    6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    7: { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: prefix } },
  };
}

/** Generate one image. Resolves with a PNG Blob. */
export async function generateImage({ prompt, negative, width, height, steps, onProgress, prefix }) {
  await ensureComfyRunning({ onStatus: (s) => onProgress?.({ status: s }) });
  const checkpoint = await pickImageModel();
  if (!checkpoint) {
    const err = new Error('No image model is installed. Install Stable Diffusion XL from AI Engines (one click, 6.9 GB).');
    err.code = 'NO_IMAGE_MODEL';
    throw err;
  }
  const outputs = await runWorkflow(buildImageWorkflow({ prompt, negative, checkpoint, width, height, steps, prefix }), { onProgress });
  const image = outputs.find(o => o.kind === 'image');
  if (!image) throw new Error('The image model produced no image.');
  return fetchOutput(image);
}

export function coverPrompt({ title, genre, era, moods = [], concept }) {
  return [
    'album cover artwork, square format, professional record sleeve design',
    concept || `${(moods[0] || 'striking').toLowerCase()} imagery for a ${era || ''} ${genre || ''} record called "${title || 'Untitled'}"`,
    'bold composition, rich color grading, high detail, no text, no letters',
  ].join(', ');
}

export function iconPrompt(concept, style = 'modern flat') {
  return `app icon of ${concept}, ${style} style, single centered symbol, bold simple shapes, soft gradient, high contrast, plain pure white background, no text, no border, no shadow on the background`;
}

// ── Background removal ─────────────────────────────────────────────────────

/**
 * Remove a near-uniform background from RGBA pixels by flood-filling inward from
 * the edges, then feathering the mask edge. Works for icons rendered on a plain
 * background. Mutates and returns `data` (Uint8ClampedArray, RGBA).
 */
export function removeBackground(data, width, height, { tolerance = 80, step = 14, feather = 2 } = {}) {
  const idx = (x, y) => (y * width + x) * 4;
  // Background colour: the median of the border pixels.
  const border = [];
  for (let x = 0; x < width; x++) border.push(idx(x, 0), idx(x, height - 1));
  for (let y = 0; y < height; y++) border.push(idx(0, y), idx(width - 1, y));
  const med = [0, 1, 2].map(c => {
    const vals = border.map(i => data[i + c]).sort((a, b) => a - b);
    return vals[vals.length >> 1];
  });
  const dist = (i, r, g, b) => Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b);
  const close = (i) => dist(i, med[0], med[1], med[2]) <= tolerance;
  // Image models rarely paint a flat background: it drifts in brightness and carries
  // soft shadows. The fill follows that drift (each step must be small) while staying
  // in the background's colour family, so it cannot leak through an object's outline.
  const bg = new Uint8Array(width * height);
  const stack = [];
  for (const i of border) {
    const p = i / 4;
    if (!bg[p] && close(i)) { bg[p] = 1; stack.push(p); }
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % width, y = (p - x) / width;
    const pi = p * 4;
    const nbrs = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
    for (const q of nbrs) {
      if (q < 0 || bg[q]) continue;
      const qi = q * 4;
      if (dist(qi, data[pi], data[pi + 1], data[pi + 2]) <= step && close(qi)) { bg[q] = 1; stack.push(q); }
    }
  }
  // Feathered alpha: foreground pixels near the background fade slightly.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (bg[p]) { data[p * 4 + 3] = 0; continue; }
      let near = 0, total = 0;
      for (let dy = -feather; dy <= feather; dy++) {
        for (let dx = -feather; dx <= feather; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          total++;
          if (bg[ny * width + nx]) near++;
        }
      }
      // Specks surrounded by background (stray noise at the edges) are cleared.
      if (near / total > 0.8) data[p * 4 + 3] = 0;
      else if (near) data[p * 4 + 3] = Math.round(255 * (1 - (near / total) * 0.85));
    }
  }
  return data;
}

/** Browser helper: Blob in, transparent PNG Blob out, resized to `size`. */
export async function makeIconPng(blob, size = 512) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  removeBackground(img.data, img.width, img.height);
  ctx.putImageData(img, 0, 0);
  const out = new OffscreenCanvas(size, size);
  out.getContext('2d').drawImage(canvas, 0, 0, size, size);
  return out.convertToBlob({ type: 'image/png' });
}

/**
 * Run an image task, installing Stable Diffusion XL first (after asking) if no
 * image model is present. onStatus(text) reports download progress.
 */
export async function withImageModel(task, { onStatus } = {}) {
  try {
    return await task();
  } catch (err) {
    if (err.code !== 'NO_IMAGE_MODEL') throw err;
    const { getEngineConfig, downloadModel } = await import('./comfyEngine.js');
    const { installDir } = await getEngineConfig();
    if (!installDir) {
      window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: 'ai_engines' }));
      throw new Error('Set up the local AI engine first (AI Engines is opening), then try again.');
    }
    if (!window.confirm('Images need an image model. Install Stable Diffusion XL now? (6.9 GB, free for commercial use)')) throw err;
    await downloadModel(SDXL_ENTRY, { onProgress: (p) => onStatus?.(`Installing SDXL: ${Math.round(p.fraction * 100)}%`) });
    onStatus?.('SDXL installed. Generating…');
    return task();
  }
}
