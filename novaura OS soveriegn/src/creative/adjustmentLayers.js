// adjustmentLayers.js — Draws adjustment layers for the compositor.
//
// The compositor hands over everything beneath the adjustment layer (for the area being
// drawn); this returns the adjusted copy. Canvas-filter adjustments (sepia, blur) use
// ctx.filter; LUT adjustments run in O(pixels) directly; heavy per-pixel adjustments
// (hueSaturation, vibrance, vignette, etc.) offload onto the shared Web Worker pool on
// large canvases while showing an instant quarter-resolution preview during slider drags.

import { CanvasSurface, surfaceFromPixels } from './surface.js';
import { setAdjustmentProvider } from './compositor.js';
import { ADJUSTMENTS, applyAdjustmentPixels, canvasFilter, isIdentity } from './adjustments.js';
import { sharedFilterPool } from './filters/pool.js';

const cache = new WeakMap(); // layer → { key, surface }
const pending = new WeakMap(); // layer → { key, controller, preview }
let workerThreshold = 250_000; // pixels above which 'pixel' adjustments run in workers

export function setAdjustmentWorkerThreshold(pixels) {
  workerThreshold = Math.max(0, Number(pixels) || 0);
}

function beneathKey(doc, layer, region) {
  const index = doc.layers.indexOf(layer);
  const below = doc.layers.slice(0, index).map(l => `${l.id}:${l.rev}`).join('|');
  return `${JSON.stringify(layer.params)}#${below}#${region.x},${region.y},${region.w},${region.h}#${doc.width}x${doc.height}`;
}

function fastPreviewSurface(doc, layer, below, region) {
  const factor = Math.max(2, Math.min(4, Math.floor(Math.min(below.width, below.height) / 32) || 2));
  const pw = Math.max(1, Math.round(below.width / factor));
  const ph = Math.max(1, Math.round(below.height / factor));
  const small = new CanvasSurface(pw, ph);
  small.ctx.imageSmoothingEnabled = true;
  small.ctx.imageSmoothingQuality = 'medium';
  small.ctx.drawImage(below.canvas, 0, 0, pw, ph);
  const smallPixels = small.read(0, 0, pw, ph);
  applyAdjustmentPixels(layer.adjust, layer.params, smallPixels, {
    docWidth: Math.max(1, Math.round(doc.width / factor)),
    docHeight: Math.max(1, Math.round(doc.height / factor)),
    originX: Math.round(region.x / factor),
    originY: Math.round(region.y / factor),
  });
  small.write(0, 0, smallPixels);
  const out = new CanvasSurface(below.width, below.height);
  out.ctx.imageSmoothingEnabled = true;
  out.ctx.imageSmoothingQuality = 'medium';
  out.ctx.drawImage(small.canvas, 0, 0, below.width, below.height);
  return out;
}

export function adjustBelow(doc, layer, below, region, onAsyncReady = null) {
  const def = ADJUSTMENTS[layer.adjust];
  if (!def || isIdentity(layer.adjust, layer.params)) return null;
  const whole = region.x === 0 && region.y === 0 && region.w === doc.width && region.h === doc.height;
  const key = whole ? beneathKey(doc, layer, region) : null;
  const hit = key && cache.get(layer);
  if (hit && hit.key === key) return hit.surface;

  let surface;
  if (def.compute === 'filter') {
    surface = new CanvasSurface(below.width, below.height);
    surface.ctx.filter = canvasFilter(layer.adjust, layer.params);
    surface.ctx.drawImage(below.canvas, 0, 0);
    surface.ctx.filter = 'none';
    if (key) cache.set(layer, { key, surface });
    return surface;
  }

  const area = below.width * below.height;
  const useWorkers = !!onAsyncReady && def.compute === 'pixel' && typeof Worker === 'function' && area > workerThreshold;
  if (useWorkers && key) {
    const active = pending.get(layer);
    if (active && active.key === key) return active.preview;
    active?.controller.abort();
    const controller = new AbortController();
    const preview = fastPreviewSurface(doc, layer, below, region);
    pending.set(layer, { key, controller, preview });
    const pixels = below.read(0, 0, below.width, below.height);
    const geom = { docWidth: doc.width, docHeight: doc.height, originX: region.x, originY: region.y };
    sharedFilterPool().runAdjustment(layer.adjust, layer.params, pixels, geom, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        cache.set(layer, { key, surface: surfaceFromPixels(result) });
        if (pending.get(layer)?.controller === controller) pending.delete(layer);
        onAsyncReady();
      })
      .catch(() => {
        if (pending.get(layer)?.controller === controller) pending.delete(layer);
      });
    return preview;
  }

  const pixels = below.read(0, 0, below.width, below.height);
  applyAdjustmentPixels(layer.adjust, layer.params, pixels, {
    docWidth: doc.width, docHeight: doc.height, originX: region.x, originY: region.y,
  });
  surface = surfaceFromPixels(pixels);
  if (key) cache.set(layer, { key, surface });
  return surface;
}

setAdjustmentProvider(adjustBelow);
