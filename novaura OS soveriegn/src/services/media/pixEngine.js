// pixEngine.js — Unified PixAI-Class Multi-Output Image, Photo-Transform & Image-to-Video Engine.
// Supports:
//  1. Local ComfyUI (txt2img batch 1-4, img2img LoadImage->VAEEncode->RepeatLatentBatch->KSampler,
//     and Wan 2.1 Image-to-Video workflow graph).
//  2. Google Gemini Multimodal Image (gemini-2.5-flash-image, etc.), Imagen 3/4, & Gemini Veo I2V.
//  3. Google Cloud Vertex AI (Gemini / Imagen / Veo endpoints).
//  4. OpenAI (gpt-image-1 generations + multipart photo /images/edits, dall-e-3) & Custom OpenAI-compatible BYOK.
// Strictly enforces Sovereign OS Air-Gap Lock for all outbound cloud calls.

import { COMFY_URL, makeRoomFor } from '../engines/comfyEngine.js';
import { getSecurityPolicy } from '../security/complianceService.js';

export const IMAGE_PROVIDERS = [
  { id: 'comfy', label: 'Local ComfyUI (Offline GPU)', local: true, supportsImg2Img: true, supportsBatch: true },
  { id: 'gemini', label: 'Gemini / Imagen (BYOK)', local: false, supportsImg2Img: true, supportsBatch: true, defaultModel: 'gemini-2.5-flash-image' },
  { id: 'vertex', label: 'Vertex AI (BYOK)', local: false, supportsImg2Img: true, supportsBatch: true, defaultModel: 'gemini-2.5-flash-image' },
  { id: 'openai', label: 'OpenAI GPT-Image / DALL-E (BYOK)', local: false, supportsImg2Img: true, supportsBatch: true, defaultModel: 'gpt-image-1' },
  { id: 'custom', label: 'Custom Endpoint (BYOK)', local: false, supportsImg2Img: false, supportsBatch: true, defaultModel: 'flux-pro' },
];

export const VIDEO_PROVIDERS = [
  { id: 'comfy_wan', label: 'Local ComfyUI Wan 2.1 I2V (Offline)', local: true, defaultModel: 'wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors' },
  { id: 'gemini_veo', label: 'Gemini Veo I2V (BYOK)', local: false, defaultModel: 'veo-2.0-generate-001' },
  { id: 'vertex_veo', label: 'Vertex AI Veo I2V (BYOK)', local: false, defaultModel: 'veo-2.0-generate-001' },
  { id: 'custom_video', label: 'Custom Video API (BYOK)', local: false, defaultModel: 'i2v-standard' },
];

function isTauri() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

function assertCloudAllowed() {
  if (getSecurityPolicy().airGappedAiOnly) {
    throw new Error(
      'Cloud media egress is blocked: Strict Air-Gapped Local-Only AI mode is active. Switch to Local ComfyUI or disable Air-Gap Lock in Settings → Security & SOC 2.'
    );
  }
}

/** Clamp diffusion dimensions to safe multiples of 64 (or 8). */
export function snapDimension(value, fallback = 1024, step = 64) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  const clamped = Math.max(256, Math.min(2048, n));
  return Math.max(256, Math.round(clamped / step) * step);
}

/** Parse a data URL into { mimeType, base64 }. */
export function parseDataUrl(dataUrl) {
  const str = String(dataUrl || '');
  const m = str.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

/** Convert an image URL or Data URL into { mimeType, base64, blob }. */
export async function resolveImagePayload(imageUrlOrBlob) {
  if (typeof imageUrlOrBlob === 'string') {
    const parsed = parseDataUrl(imageUrlOrBlob);
    if (parsed) {
      const bin = atob(parsed.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { ...parsed, blob: new Blob([bytes], { type: parsed.mimeType }) };
    }
    const res = await fetch(imageUrlOrBlob);
    if (!res.ok) throw new Error(`Could not read reference image (${res.status}).`);
    const blob = await res.blob();
    return blobToImagePayload(blob);
  }
  if (imageUrlOrBlob instanceof Blob) {
    return blobToImagePayload(imageUrlOrBlob);
  }
  throw new Error('Invalid reference image input.');
}

async function blobToImagePayload(blob) {
  const mimeType = blob.type || 'image/png';
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { mimeType, base64: btoa(binary), blob };
}

/** Resolve nearest Imagen/Veo aspectRatio string from pixel dimensions. */
export function toAspectRatioString(width, height) {
  const r = (Number(width) || 1024) / (Number(height) || 1024);
  if (r >= 1.55) return '16:9';
  if (r >= 1.2) return '4:3';
  if (r <= 0.65) return '9:16';
  if (r <= 0.85) return '3:4';
  return '1:1';
}

/** Resolve nearest OpenAI size string from pixel dimensions. */
export function toOpenAiSize(width, height, model = 'gpt-image-1') {
  const w = Number(width) || 1024;
  const h = Number(height) || 1024;
  if (String(model).includes('gpt-image')) {
    if (w > h * 1.15) return '1536x1024';
    if (h > w * 1.15) return '1024x1536';
    return '1024x1024';
  }
  if (w > h * 1.15) return '1792x1024';
  if (h > w * 1.15) return '1024x1792';
  return '1024x1024';
}

/** Try to resolve a saved provider key from Sovereign OS's encrypted vault if not passed inline. */
export async function resolveProviderKey(providerId, inlineKey = '') {
  if (inlineKey && String(inlineKey).trim()) return String(inlineKey).trim();
  try {
    const { getVaultKey } = await import('../literatureAiService.js');
    const lookupName =
      providerId === 'gemini' || providerId === 'gemini_veo'
        ? 'gemini'
        : providerId === 'openai'
          ? 'openai'
          : providerId === 'vertex' || providerId === 'vertex_veo'
            ? 'vertex_api_key'
            : 'byok';
    const found = await getVaultKey(lookupName);
    if (found) return String(found).trim();
  } catch {
    // Vault unavailable in headless unit test environments.
  }
  return '';
}

async function sendJsonRequest({ url, method = 'POST', headers = {}, body, timeoutSecs = 180, customEndpoint = false }) {
  const json = body === undefined ? undefined : JSON.stringify(body);
  if (isTauri() && !customEndpoint) {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke('cloud_ai_request', {
      request: {
        url,
        method,
        headers: Object.entries(headers),
        body: json ?? null,
        timeout_secs: timeoutSecs,
      },
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, text: res.body };
  }
  const res = await fetch(url, { method, headers, body: json });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

// ── COMFYUI WORKFLOW BUILDERS (LOCAL OFFLINE) ────────────────────────────────

/**
 * Build a ComfyUI Text-to-Image workflow supporting batch_size 1..4 outputs.
 */
export function buildComfyTxt2ImgWorkflow({
  prompt,
  negativePrompt = 'blurry, distorted, low quality, artifacts, watermark',
  width = 1024,
  height = 1024,
  steps = 24,
  cfg = 7.0,
  samplerName = 'dpmpp_2m',
  scheduler = 'karras',
  seed = Math.floor(Math.random() * 2147483647),
  batchSize = 1,
  checkpointName,
  filenamePrefix = 'Novaura_Pix',
}) {
  const w = snapDimension(width, 1024);
  const h = snapDimension(height, 1024);
  const count = Math.max(1, Math.min(4, Number(batchSize) || 1));

  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        cfg,
        denoise: 1,
        latent_image: ['5', 0],
        model: ['4', 0],
        negative: ['7', 0],
        positive: ['6', 0],
        sampler_name: samplerName,
        scheduler,
        seed,
        steps,
      },
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpointName },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { batch_size: count, height: h, width: w },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['4', 1], text: prompt },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['4', 1], text: negativePrompt },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: filenamePrefix, images: ['8', 0] },
    },
  };
}

/**
 * Build a ComfyUI Image-to-Image workflow (Photo -> Action Figure / Anime / Pencil / Caricature / Style Transfer).
 * Scales the uploaded photo cleanly to target dimensions, VAE-encodes it, optionally repeats the latent batch
 * for multi-output candidate grids (1..4), and samples with controlled denoise.
 */
export function buildComfyImg2ImgWorkflow({
  prompt,
  negativePrompt = 'blurry, distorted, low quality, artifacts, watermark',
  imageFilename,
  width = 832,
  height = 1152,
  denoise = 0.58,
  steps = 26,
  cfg = 6.8,
  samplerName = 'dpmpp_2m',
  scheduler = 'karras',
  seed = Math.floor(Math.random() * 2147483647),
  batchSize = 1,
  checkpointName,
  filenamePrefix = 'Novaura_Transform',
}) {
  const w = snapDimension(width, 832);
  const h = snapDimension(height, 1152);
  const count = Math.max(1, Math.min(4, Number(batchSize) || 1));
  const clampedDenoise = Math.max(0.15, Math.min(0.95, Number(denoise) || 0.58));

  const workflow = {
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpointName },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['4', 1], text: prompt },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { clip: ['4', 1], text: negativePrompt },
    },
    '10': {
      class_type: 'LoadImage',
      inputs: { image: imageFilename },
    },
    '11': {
      class_type: 'ImageScale',
      inputs: {
        image: ['10', 0],
        upscale_method: 'lanczos',
        width: w,
        height: h,
        crop: 'center',
      },
    },
    '12': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['11', 0], vae: ['4', 2] },
    },
    '3': {
      class_type: 'KSampler',
      inputs: {
        cfg,
        denoise: clampedDenoise,
        latent_image: count > 1 ? ['13', 0] : ['12', 0],
        model: ['4', 0],
        negative: ['7', 0],
        positive: ['6', 0],
        sampler_name: samplerName,
        scheduler,
        seed,
        steps,
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: filenamePrefix, images: ['8', 0] },
    },
  };

  if (count > 1) {
    workflow['13'] = {
      class_type: 'RepeatLatentBatch',
      inputs: { samples: ['12', 0], amount: count },
    };
  }

  return workflow;
}

/**
 * Build a ComfyUI Wan 2.1 Image-to-Video workflow graph.
 * Outputs an animated WebP clip directly viewable in HTML5 / browser video/img players.
 */
export function buildComfyWanI2VWorkflow({
  prompt,
  negativePrompt = 'static, frozen, blurry, jittery, distorted face, low quality, watermark',
  imageFilename,
  width = 832,
  height = 480,
  frames = 33,
  fps = 16,
  steps = 20,
  cfg = 6.0,
  seed = Math.floor(Math.random() * 2147483647),
  modelName = 'wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors',
  clipName = 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
  vaeName = 'wan_2.1_vae.safetensors',
  clipVisionName = 'clip_vision_h.safetensors',
  filenamePrefix = 'Novaura_I2V',
}) {
  const w = snapDimension(width, 832, 16);
  const h = snapDimension(height, 480, 16);
  // Wan 2.1 requires frame count of (4k + 1), e.g. 17, 33, 49, 65, 81
  const snappedFrames = Math.max(17, Math.min(81, Math.round((Number(frames) - 1) / 4) * 4 + 1));

  return {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: modelName, weight_dtype: 'fp8_e4m3fn' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: clipName, type: 'wan' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: vaeName } },
    '4': { class_type: 'CLIPVisionLoader', inputs: { clip_name: clipVisionName } },
    '5': { class_type: 'LoadImage', inputs: { image: imageFilename } },
    '6': { class_type: 'CLIPVisionEncode', inputs: { clip_vision: ['4', 0], image: ['5', 0], crop: 'center' } },
    '7': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: prompt } },
    '8': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: negativePrompt } },
    '9': {
      class_type: 'WanImageToVideo',
      inputs: {
        positive: ['7', 0],
        negative: ['8', 0],
        vae: ['3', 0],
        clip_vision_output: ['6', 0],
        start_image: ['5', 0],
        width: w,
        height: h,
        length: snappedFrames,
        batch_size: 1,
      },
    },
    '10': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['9', 0],
        negative: ['9', 1],
        latent_image: ['9', 2],
        seed,
        steps,
        cfg,
        sampler_name: 'uni_pc',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    '11': { class_type: 'VAEDecode', inputs: { samples: ['10', 0], vae: ['3', 0] } },
    '12': {
      class_type: 'SaveAnimatedWEBP',
      inputs: {
        images: ['11', 0],
        filename_prefix: filenamePrefix,
        fps: Math.max(8, Math.min(30, Number(fps) || 16)),
        lossless: false,
        quality: 85,
        method: 'default',
      },
    },
  };
}

/** Upload an image Blob or Data URL into ComfyUI's input directory for LoadImage workflows. */
export async function uploadImageToComfy(imageUrlOrBlob, filename = `ref_${Date.now()}.png`, endpoint = COMFY_URL) {
  const payload = await resolveImagePayload(imageUrlOrBlob);
  const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const form = new FormData();
  form.append('image', payload.blob, safeName);
  form.append('overwrite', 'true');
  const res = await fetch(`${endpoint.replace(/\/+$/, '')}/upload/image`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`ComfyUI image upload failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.name || safeName;
}

/** Extract all image / animated webp / gif / mp4 outputs from a ComfyUI history run object. */
export function parseComfyMediaOutputs(run, endpoint = COMFY_URL) {
  const base = endpoint.replace(/\/+$/, '');
  const results = [];
  if (!run?.outputs) return results;
  for (const nodeId of Object.keys(run.outputs)) {
    const out = run.outputs[nodeId];
    for (const key of ['images', 'gifs', 'videos']) {
      if (!Array.isArray(out?.[key])) continue;
      for (const item of out[key]) {
        const lower = String(item.filename || '').toLowerCase();
        const isVideo = key === 'videos' || lower.endsWith('.mp4') || lower.endsWith('.webm');
        const isAnimated = key === 'gifs' || lower.endsWith('.webp') || lower.endsWith('.gif');
        results.push({
          kind: isVideo ? 'video' : isAnimated ? 'animated' : 'image',
          filename: item.filename,
          subfolder: item.subfolder || '',
          type: item.type || 'output',
          url: `${base}/view?filename=${encodeURIComponent(item.filename)}&subfolder=${encodeURIComponent(item.subfolder || '')}&type=${encodeURIComponent(item.type || 'output')}`,
        });
      }
    }
  }
  return results;
}

async function runComfyGraph(workflow, endpoint, timeoutMs = 180000) {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  if (cleanEndpoint.replace('localhost', '127.0.0.1') === COMFY_URL) {
    await makeRoomFor(workflow).catch(() => {});
  }
  const clientId = `novaura_pix_${Date.now()}`;
  const res = await fetch(`${cleanEndpoint}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!res.ok) {
    throw new Error(`ComfyUI error (${res.status}): ${await res.text()}`);
  }
  const queued = await res.json();
  const promptId = queued.prompt_id;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const hRes = await fetch(`${cleanEndpoint}/history/${promptId}`);
      if (hRes.ok) {
        const history = await hRes.json();
        const run = history[promptId];
        if (run?.status?.status_str === 'error') {
          const msg = run.status?.messages?.find(m => m[0] === 'execution_error')?.[1]?.exception_message;
          throw new Error(msg || 'ComfyUI workflow execution failed.');
        }
        const media = parseComfyMediaOutputs(run, cleanEndpoint);
        if (media.length > 0) return media;
      }
    } catch (err) {
      if (err.message?.includes('ComfyUI workflow execution failed')) throw err;
    }
    await new Promise(r => setTimeout(r, 1400));
  }
  throw new Error(`ComfyUI generation timed out after ${Math.round(timeoutMs / 1000)}s.`);
}

// ── CLOUD BYOK IMAGE GENERATION (GEMINI / VERTEX / OPENAI / CUSTOM) ──────────

/**
 * Generate images using Google Gemini Native Multimodal Image OR Imagen 3/4,
 * supporting both Google AI Studio (`provider='gemini'`) and Vertex AI (`provider='vertex'`).
 */
export async function generateGeminiOrVertexImages({
  provider = 'gemini',
  apiKey,
  model = 'gemini-2.5-flash-image',
  prompt,
  negativePrompt = '',
  referenceImageUrl = null,
  width = 1024,
  height = 1024,
  count = 1,
  vertexProject = '',
  vertexRegion = 'us-central1',
  onProgress,
}) {
  assertCloudAllowed();
  const key = await resolveProviderKey(provider, apiKey);
  if (!key) {
    throw new Error(
      provider === 'vertex'
        ? 'Vertex AI access token / API key required. Enter it in Studio settings or Vault.'
        : 'Gemini API key required. Add one in Settings → AI Keys & Models or directly in Media Foundry.'
    );
  }

  const isVertex = provider === 'vertex';
  if (isVertex && !String(vertexProject || '').trim()) {
    throw new Error('Vertex AI requires a GCP Project ID.');
  }

  const cleanModel = String(model || 'gemini-2.5-flash-image').trim();
  const baseUrl = isVertex
    ? `https://${encodeURIComponent(vertexRegion)}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(vertexProject)}/locations/${encodeURIComponent(vertexRegion)}/publishers/google/models/${encodeURIComponent(cleanModel)}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}`;
  const authHeaders = isVertex
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }
    : { 'Content-Type': 'application/json', 'x-goog-api-key': key };

  const sampleCount = Math.max(1, Math.min(4, Number(count) || 1));

  // Branch A: Imagen :predict API
  if (cleanModel.toLowerCase().startsWith('imagen')) {
    onProgress?.(`Calling ${isVertex ? 'Vertex' : 'Gemini'} Imagen (${sampleCount} take${sampleCount > 1 ? 's' : ''})…`);
    const res = await sendJsonRequest({
      url: `${baseUrl}:predict`,
      headers: authHeaders,
      body: {
        instances: [{ prompt }],
        parameters: {
          sampleCount,
          aspectRatio: toAspectRatioString(width, height),
          ...(negativePrompt ? { negativePrompt } : {}),
        },
      },
    });
    if (!res.ok) throw new Error(`Imagen API error (${res.status}): ${res.text.slice(0, 320)}`);
    const data = JSON.parse(res.text);
    const preds = Array.isArray(data?.predictions) ? data.predictions : [];
    const urls = preds
      .map(p => p?.bytesBase64Encoded ? `data:${p.mimeType || 'image/png'};base64,${p.bytesBase64Encoded}` : null)
      .filter(Boolean);
    if (!urls.length) throw new Error('Imagen returned no image predictions.');
    return urls;
  }

  // Branch B: Gemini Multimodal Native Image Generation & Photo Editing (:generateContent)
  let refPayload = null;
  if (referenceImageUrl) {
    refPayload = await resolveImagePayload(referenceImageUrl);
  }

  const urls = [];
  for (let i = 0; i < sampleCount; i++) {
    onProgress?.(`Generating take ${i + 1} of ${sampleCount} via ${cleanModel}…`);
    const variantPrompt =
      sampleCount > 1
        ? `${prompt}\n\n(Creative variation #${i + 1}: keep exact quality and likeness while exploring a distinct pose/lighting nuance. Avoid: ${negativePrompt || 'artifacts, blur, watermark'}.)`
        : `${prompt}${negativePrompt ? `\n\nAvoid: ${negativePrompt}` : ''}`;

    const parts = [];
    if (refPayload) {
      parts.push({ inlineData: { mimeType: refPayload.mimeType, data: refPayload.base64 } });
    }
    parts.push({ text: variantPrompt });

    const res = await sendJsonRequest({
      url: `${baseUrl}:generateContent`,
      headers: authHeaders,
      body: {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.7 + i * 0.08,
        },
      },
    });
    if (!res.ok) throw new Error(`Gemini Image API error (${res.status}): ${res.text.slice(0, 320)}`);
    const data = JSON.parse(res.text);
    const outParts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = outParts.find(p => p?.inlineData?.data);
    if (!imgPart) {
      const textNote = outParts.find(p => p?.text)?.text || 'No image data returned.';
      throw new Error(`Gemini returned text instead of an image: ${textNote.slice(0, 200)}`);
    }
    urls.push(`data:${imgPart.inlineData.mimeType || 'image/png'};base64,${imgPart.inlineData.data}`);
  }
  return urls;
}

/**
 * Generate or edit images using OpenAI (gpt-image-1 / dall-e-3) or any OpenAI-compatible BYOK endpoint.
 */
export async function generateOpenAiOrCustomImages({
  provider = 'openai',
  apiKey,
  endpointUrl = 'https://api.openai.com/v1/images/generations',
  model = 'gpt-image-1',
  prompt,
  referenceImageUrl = null,
  width = 1024,
  height = 1024,
  count = 1,
  onProgress,
}) {
  assertCloudAllowed();
  const key = await resolveProviderKey(provider, apiKey);
  if (!key) {
    throw new Error('BYOK API Key required. Add your OpenAI key in Settings → AI Keys & Models or enter it below.');
  }

  const n = Math.max(1, Math.min(4, Number(count) || 1));
  const size = toOpenAiSize(width, height, model);

  // Reference Photo Edit branch via /v1/images/edits (multipart FormData)
  if (referenceImageUrl && provider === 'openai') {
    onProgress?.(`Uploading reference photo to OpenAI ${model} (${n} take${n > 1 ? 's' : ''})…`);
    const refPayload = await resolveImagePayload(referenceImageUrl);
    const editUrl = endpointUrl.replace(/\/images\/generations\/?$/, '/images/edits');
    const form = new FormData();
    form.append('model', model.includes('dall-e-3') ? 'gpt-image-1' : model);
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('n', String(n));
    form.append('image', refPayload.blob, 'reference.png');

    const res = await fetch(editUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI Image Edit error (${res.status}): ${(await res.text()).slice(0, 320)}`);
    const data = await res.json();
    const urls = (data?.data || [])
      .map(d => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url || null))
      .filter(Boolean);
    if (!urls.length) throw new Error('OpenAI Image Edit returned no images.');
    return urls;
  }

  // Standard generations endpoint (note: dall-e-3 enforces n=1 per call, so loop when n>1)
  const calls = model === 'dall-e-3' ? n : 1;
  const perCallN = model === 'dall-e-3' ? 1 : n;
  const urls = [];

  for (let c = 0; c < calls; c++) {
    onProgress?.(`Generating ${calls > 1 ? `take ${c + 1}/${calls}` : `${n} take${n > 1 ? 's' : ''}`} via ${model}…`);
    const body = {
      model,
      prompt,
      n: perCallN,
      size,
      ...(model.includes('dall-e') ? { response_format: 'b64_json' } : {}),
    };
    const res = await sendJsonRequest({
      url: endpointUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body,
      customEndpoint: provider === 'custom',
    });
    if (!res.ok) throw new Error(`Cloud Image API error (${res.status}): ${res.text.slice(0, 320)}`);
    const data = JSON.parse(res.text);
    for (const item of data?.data || []) {
      if (item.b64_json) urls.push(`data:image/png;base64,${item.b64_json}`);
      else if (item.url) urls.push(item.url);
    }
  }
  if (!urls.length) throw new Error('Image endpoint returned no image payload.');
  return urls;
}

// ── UNIFIED MULTI-OUTPUT ORCHESTRATOR ────────────────────────────────────────

/**
 * Unified multi-output generator across Local ComfyUI (txt2img + img2img) and BYOK Cloud
 * (Gemini, Vertex, OpenAI, Custom). Returns an array of candidate records for side-by-side picking.
 */
export async function generateMultiCandidates({
  provider = 'comfy',
  prompt,
  negativePrompt = '',
  referenceImageUrl = null,
  width = 1024,
  height = 1024,
  steps = 25,
  cfg = 7.0,
  denoise = 0.58,
  seed = Math.floor(Math.random() * 2147483647),
  count = 2,
  presetId = null,
  // ComfyUI options
  comfyEndpoint = COMFY_URL,
  checkpointName = '',
  // Cloud BYOK options
  apiKey = '',
  model = '',
  endpointUrl = 'https://api.openai.com/v1/images/generations',
  vertexProject = '',
  vertexRegion = 'us-central1',
  onProgress,
}) {
  if (!String(prompt || '').trim()) {
    throw new Error('Prompt cannot be empty.');
  }
  const batchCount = Math.max(1, Math.min(4, Number(count) || 1));
  const baseSeed = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 2147483647);

  let rawUrls = [];
  if (provider === 'comfy') {
    if (!checkpointName) {
      throw new Error('No ComfyUI checkpoint selected. Install Flux.1 or SDXL or switch to a BYOK Cloud provider.');
    }
    let workflow;
    if (referenceImageUrl) {
      onProgress?.('Uploading reference image to local ComfyUI…');
      const uploadedName = await uploadImageToComfy(referenceImageUrl, `novaura_ref_${Date.now()}.png`, comfyEndpoint);
      onProgress?.(`Running local img2img transform (${batchCount} variation${batchCount > 1 ? 's' : ''})…`);
      workflow = buildComfyImg2ImgWorkflow({
        prompt,
        negativePrompt,
        imageFilename: uploadedName,
        width,
        height,
        denoise,
        steps,
        cfg,
        seed: baseSeed,
        batchSize: batchCount,
        checkpointName,
      });
    } else {
      onProgress?.(`Running local txt2img batch (${batchCount} variation${batchCount > 1 ? 's' : ''})…`);
      workflow = buildComfyTxt2ImgWorkflow({
        prompt,
        negativePrompt,
        width,
        height,
        steps,
        cfg,
        seed: baseSeed,
        batchSize: batchCount,
        checkpointName,
      });
    }
    const outputs = await runComfyGraph(workflow, comfyEndpoint);
    rawUrls = outputs.map(o => o.url);
  } else if (provider === 'gemini' || provider === 'vertex') {
    rawUrls = await generateGeminiOrVertexImages({
      provider,
      apiKey,
      model: model || 'gemini-2.5-flash-image',
      prompt,
      negativePrompt,
      referenceImageUrl,
      width,
      height,
      count: batchCount,
      vertexProject,
      vertexRegion,
      onProgress,
    });
  } else {
    rawUrls = await generateOpenAiOrCustomImages({
      provider,
      apiKey,
      endpointUrl,
      model: model || 'gpt-image-1',
      prompt,
      referenceImageUrl,
      width,
      height,
      count: batchCount,
      onProgress,
    });
  }

  const now = new Date().toISOString();
  return rawUrls.map((url, idx) => ({
    id: `cand_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    url,
    index: idx,
    seed: baseSeed + idx,
    provider,
    model: provider === 'comfy' ? checkpointName : model,
    presetId,
    prompt,
    negativePrompt,
    width,
    height,
    hasReference: Boolean(referenceImageUrl),
    favorite: false,
    createdAt: now,
  }));
}

// ── IMAGE-TO-VIDEO (I2V) ENGINE ──────────────────────────────────────────────

/**
 * Generate a video clip from an input image using Local ComfyUI Wan 2.1 I2V,
 * BYOK Gemini / Vertex Veo, or a Custom BYOK Video API endpoint.
 */
export async function generateVideoFromImage({
  provider = 'comfy_wan',
  imageUrl,
  prompt,
  negativePrompt = 'static, blurry, distorted, flicker, watermark',
  durationSeconds = 5,
  aspectRatio = '16:9',
  width = 832,
  height = 480,
  fps = 16,
  motionStrength = 0.5,
  comfyEndpoint = COMFY_URL,
  wanModelName = 'wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors',
  apiKey = '',
  model = 'veo-2.0-generate-001',
  customEndpointUrl = '',
  vertexProject = '',
  vertexRegion = 'us-central1',
  onProgress,
}) {
  if (!imageUrl) throw new Error('Source image is required for Image-to-Video generation.');
  if (!String(prompt || '').trim()) throw new Error('Motion prompt cannot be empty.');

  // 1. Local ComfyUI Wan 2.1 I2V
  if (provider === 'comfy_wan') {
    onProgress?.('Uploading source image to local ComfyUI for Wan 2.1 I2V…');
    const uploadedName = await uploadImageToComfy(imageUrl, `novaura_i2v_${Date.now()}.png`, comfyEndpoint);
    const frames = Math.max(17, Math.min(81, Math.round(durationSeconds * fps) + 1));
    const workflow = buildComfyWanI2VWorkflow({
      prompt,
      negativePrompt,
      imageFilename: uploadedName,
      width,
      height,
      frames,
      fps,
      modelName: wanModelName,
    });
    onProgress?.('Synthesizing video frames locally via Wan 2.1 I2V…');
    const outputs = await runComfyGraph(workflow, comfyEndpoint, 600000);
    const clip = outputs.find(o => o.kind === 'video' || o.kind === 'animated') || outputs[0];
    if (!clip) throw new Error('Wan 2.1 I2V finished without returning a video or animated WebP output.');
    return {
      url: clip.url,
      kind: clip.kind,
      provider,
      model: wanModelName,
      durationSeconds,
      createdAt: new Date().toISOString(),
    };
  }

  assertCloudAllowed();
  const ref = await resolveImagePayload(imageUrl);

  // 2. Gemini / Vertex Veo Image-to-Video (:predictLongRunning + operation poll)
  if (provider === 'gemini_veo' || provider === 'vertex_veo') {
    const isVertex = provider === 'vertex_veo';
    const key = await resolveProviderKey(provider, apiKey);
    if (!key) throw new Error(`${isVertex ? 'Vertex AI' : 'Gemini'} API key required for Veo Image-to-Video.`);
    if (isVertex && !String(vertexProject || '').trim()) throw new Error('Vertex AI Veo requires a GCP Project ID.');

    const cleanModel = String(model || 'veo-2.0-generate-001').trim();
    const apiRoot = isVertex
      ? `https://${encodeURIComponent(vertexRegion)}-aiplatform.googleapis.com/v1`
      : 'https://generativelanguage.googleapis.com/v1beta';
    const modelPath = isVertex
      ? `projects/${encodeURIComponent(vertexProject)}/locations/${encodeURIComponent(vertexRegion)}/publishers/google/models/${encodeURIComponent(cleanModel)}`
      : `models/${encodeURIComponent(cleanModel)}`;
    const authHeaders = isVertex
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }
      : { 'Content-Type': 'application/json', 'x-goog-api-key': key };

    onProgress?.(`Submitting Image-to-Video job to ${cleanModel}…`);
    const startRes = await sendJsonRequest({
      url: `${apiRoot}/${modelPath}:predictLongRunning`,
      headers: authHeaders,
      body: {
        instances: [
          {
            prompt,
            image: { bytesBase64Encoded: ref.base64, mimeType: ref.mimeType },
          },
        ],
        parameters: {
          aspectRatio,
          durationSeconds: Math.max(4, Math.min(8, Number(durationSeconds) || 5)),
        },
      },
    });
    if (!startRes.ok) throw new Error(`Veo API error (${startRes.status}): ${startRes.text.slice(0, 320)}`);
    const op = JSON.parse(startRes.text);
    const opName = op?.name;
    if (!opName) throw new Error('Veo did not return an operation ID.');

    const pollStart = Date.now();
    while (Date.now() - pollStart < 420000) {
      await new Promise(r => setTimeout(r, 4000));
      onProgress?.(`Rendering video via ${cleanModel} (${Math.round((Date.now() - pollStart) / 1000)}s)…`);
      const pollRes = await sendJsonRequest({
        url: `${apiRoot}/${opName}`,
        method: 'GET',
        headers: authHeaders,
      });
      if (!pollRes.ok) throw new Error(`Veo status poll error (${pollRes.status}): ${pollRes.text.slice(0, 240)}`);
      const status = JSON.parse(pollRes.text);
      if (status.done) {
        if (status.error) throw new Error(status.error.message || 'Veo video generation failed.');
        const sample =
          status.response?.generateVideoResponse?.generatedSamples?.[0]?.video ||
          status.response?.videos?.[0] ||
          null;
        if (sample?.bytesBase64Encoded) {
          return {
            url: `data:${sample.mimeType || 'video/mp4'};base64,${sample.bytesBase64Encoded}`,
            kind: 'video',
            provider,
            model: cleanModel,
            durationSeconds,
            createdAt: new Date().toISOString(),
          };
        }
        if (sample?.uri) {
          const downloadUrl = isVertex ? sample.uri : `${sample.uri}${sample.uri.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`;
          return {
            url: downloadUrl,
            kind: 'video',
            provider,
            model: cleanModel,
            durationSeconds,
            createdAt: new Date().toISOString(),
          };
        }
        throw new Error('Veo completed without returning a downloadable video payload.');
      }
    }
    throw new Error('Veo video generation timed out after 7 minutes.');
  }

  // 3. Custom BYOK Video API
  if (!String(customEndpointUrl || '').trim()) {
    throw new Error('Enter a Custom BYOK Video API URL first.');
  }
  const key = await resolveProviderKey(provider, apiKey);
  onProgress?.('Dispatching Image-to-Video request to Custom BYOK endpoint…');
  const res = await sendJsonRequest({
    url: customEndpointUrl,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: {
      model: model || 'i2v-standard',
      prompt,
      negative_prompt: negativePrompt,
      image: `data:${ref.mimeType};base64,${ref.base64}`,
      duration_seconds: durationSeconds,
      aspect_ratio: aspectRatio,
      motion_strength: motionStrength,
    },
    customEndpoint: true,
    timeoutSecs: 300,
  });
  if (!res.ok) throw new Error(`Custom Video API error (${res.status}): ${res.text.slice(0, 320)}`);
  const data = JSON.parse(res.text);
  const videoUrl =
    data?.video_url ||
    data?.url ||
    data?.data?.[0]?.url ||
    (data?.b64_video ? `data:video/mp4;base64,${data.b64_video}` : null);
  if (!videoUrl) throw new Error('Custom Video API returned no video URL.');
  return {
    url: videoUrl,
    kind: 'video',
    provider,
    model,
    durationSeconds,
    createdAt: new Date().toISOString(),
  };
}

