// checkpoints.js — Which ComfyUI checkpoint the image tools use, and the job
// that loads one ahead of time. No app imports, so tests can load it directly.

const IMAGE_MODEL_PREFERENCE = [/sd_xl_base/i, /sdxl/i, /juggernaut/i, /dreamshaper/i, /realvis/i, /\.safetensors$/i];
const NOT_IMAGE = /ace_step|acestep|stable_audio|audio/i;

export const isImageCheckpoint = (name) => !NOT_IMAGE.test(String(name));

/** The user's default if ComfyUI has it, else the best image checkpoint, else null. */
export function chooseImageCheckpoint(names, defaultModel = '') {
  const images = (names || []).filter(isImageCheckpoint);
  if (defaultModel && images.includes(defaultModel)) return defaultModel;
  for (const re of IMAGE_MODEL_PREFERENCE) {
    const hit = images.find(n => re.test(n));
    if (hit) return hit;
  }
  return null;
}

/**
 * ComfyUI 0.4x streams weights through comfy-aimdo ("dynamic VRAM"). On some
 * PCs its pinned file reads fail (Windows error 1450, insufficient system
 * resources), and every later job in that process fails too. ComfyUI's classic
 * loader (--disable-dynamic-vram) works there.
 */
export const isDynamicVramFailure = (message) => /hostbuf_file_reader|aimdo|xfer_file/i.test(String(message || ''));

/**
 * ComfyUI loads a checkpoint only when a job uses it. This one-step 256 px job
 * loads the model, text encoder and VAE, and its preview is thrown away. ComfyUI
 * caches the loader's output by its inputs, so the next job that names the same
 * file starts sampling at once. A fresh seed keeps the job from being skipped
 * as already done. cfg 1 also skips the negative pass, and KSampler sizes the
 * empty latent for SDXL, SD3 and Flux alike.
 */
export function buildWarmupWorkflow(checkpoint, seed = Math.floor(Math.random() * 2 ** 31)) {
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    2: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: 'warm-up' } },
    3: { class_type: 'EmptyLatentImage', inputs: { width: 256, height: 256, batch_size: 1 } },
    4: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['2', 0], latent_image: ['3', 0], seed, steps: 1, cfg: 1, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
    5: { class_type: 'VAEDecode', inputs: { samples: ['4', 0], vae: ['1', 2] } },
    6: { class_type: 'PreviewImage', inputs: { images: ['5', 0] } },
  };
}
