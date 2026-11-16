// compositor.js — Draws a document's layers into one picture.
//
// Layers are drawn bottom to top. A pixel layer draws its surface with its opacity
// and blend mode. Shape and text layers (and any layer with a mask or a live stroke)
// are first drawn alone into a scratch canvas, masked, then composited, so opacity
// fades the whole layer at once. Adjustment layers transform everything beneath them.
//
// createCompositor(doc) keeps a document-sized picture and redraws only what changed:
// dirty rectangles during a stroke, everything after the document changes. While a
// layer is being edited (setFocusLayer), the layers beneath it are cached as one picture.
//
// This is the one module a GPU backend would replace.

import { CanvasSurface, createSurface } from './surface.js';

const renderers = new Map(); // kind → fn(ctx, doc, layer), drawing in document coordinates
let maskProvider = null;     // fn(doc, layer) → { surface, x, y, defaultValue } | null (alpha = visibility)
let adjustmentProvider = null; // fn(doc, layer, belowSurface, region) → Surface (same size as below)

export function registerLayerRenderer(kind, fn) { renderers.set(kind, fn); }
export function setMaskProvider(fn) { maskProvider = fn; }
export function setAdjustmentProvider(fn) { adjustmentProvider = fn; }

const canvasFor = (w, h) => new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
const full = doc => ({ x: 0, y: 0, w: doc.width, h: doc.height });

function intersect(a, b) {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

function union(a, b) {
  if (!a) return b;
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  return { x: x0, y: y0, w: Math.max(a.x + a.w, b.x + b.w) - x0, h: Math.max(a.y + a.h, b.y + b.h) - y0 };
}

// A scratch context covering `region`, set up to draw in document coordinates.
function scratch(region) {
  const ctx = canvasFor(region.w, region.h).getContext('2d');
  ctx.translate(-region.x, -region.y);
  return ctx;
}

function surfaceCanvas(doc, id) {
  return doc.buffers.get(id)?.canvas || null;
}

// Multiply the scratch layer's alpha by its mask (outside the mask's rectangle, its default).
function applyMask(doc, layer, ctx, region) {
  if (!layer.mask || layer.mask.enabled === false || !maskProvider) return;
  const m = maskProvider(doc, layer);
  if (!m) return;
  const maskCtx = scratch(region);
  if (m.defaultValue !== 0) {
    maskCtx.fillStyle = '#000';
    maskCtx.fillRect(region.x, region.y, region.w, region.h);
    maskCtx.clearRect(m.x, m.y, m.surface.width, m.surface.height);
  }
  maskCtx.drawImage(m.surface.canvas, m.x, m.y);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCtx.canvas, 0, 0);
  ctx.restore();
}

function drawLive(ctx, live) {
  ctx.save();
  ctx.globalAlpha = live.opacity;
  ctx.globalCompositeOperation = live.erase ? 'destination-out' : 'source-over';
  ctx.drawImage(live.surface.canvas, live.origin.x, live.origin.y);
  ctx.restore();
}

// Draw one layer alone (no opacity, no blend) into a scratch context covering region.
function layerAlone(doc, layer, region, live) {
  const ctx = scratch(region);
  if (layer.kind === 'pixel') {
    const canvas = surfaceCanvas(doc, layer.bufferId);
    if (canvas) ctx.drawImage(canvas, layer.x, layer.y);
    if (live && live.layerId === layer.id && live.part === 'layer') drawLive(ctx, live);
  } else {
    const render = renderers.get(layer.kind);
    if (!render) return null;
    render(ctx, doc, layer);
  }
  applyMask(doc, layer, ctx, region);
  return ctx;
}

function needsScratch(layer, live) {
  return layer.kind !== 'pixel' || (layer.mask && layer.mask.enabled !== false) || (live && live.layerId === layer.id);
}

/**
 * Composite `layers` (bottom to top) onto `target`, a context already drawing in
 * document coordinates and holding whatever lies beneath them, within `region`.
 */
function paint(target, doc, layers, region, live = null) {
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    if (layer.kind === 'adjust') {
      if (!adjustmentProvider) continue;
      paintAdjustment(target, doc, layer, region);
      continue;
    }
    target.save();
    target.globalAlpha = layer.opacity;
    target.globalCompositeOperation = layer.blend || 'source-over';
    if (needsScratch(layer, live)) {
      const alone = layerAlone(doc, layer, region, live);
      if (alone) target.drawImage(alone.canvas, region.x, region.y);
    } else {
      const canvas = surfaceCanvas(doc, layer.bufferId);
      if (canvas) target.drawImage(canvas, layer.x, layer.y);
    }
    target.restore();
  }
}

function paintAdjustment(target, doc, layer, region) {
  const below = new CanvasSurface(region.w, region.h);
  below.ctx.drawImage(target.canvas, region.x - originOf(target).x, region.y - originOf(target).y, region.w, region.h, 0, 0, region.w, region.h);
  const adjusted = adjustmentProvider(doc, layer, below, region);
  if (!adjusted) return;
  const ctx = scratch(region);
  ctx.drawImage(adjusted.canvas, region.x, region.y);
  applyMask(doc, layer, ctx, region);
  target.save();
  target.globalAlpha = layer.opacity;
  target.globalCompositeOperation = 'source-over';
  target.drawImage(ctx.canvas, region.x, region.y);
  target.restore();
}

// Where document (0, 0) sits on a target context's canvas (targets are translated by -region).
function originOf(ctx) {
  const m = ctx.getTransform();
  return { x: -m.e, y: -m.f };
}

/** The composite of `layers` alone over transparency, as a surface covering the given area. */
export function composeLayers(doc, layers, { x = 0, y = 0, width = doc.width, height = doc.height } = {}) {
  const surface = new CanvasSurface(width, height);
  surface.ctx.save();
  surface.ctx.translate(-x, -y);
  paint(surface.ctx, doc, layers, { x, y, w: width, h: height });
  surface.ctx.restore();
  return surface;
}

export const flatten = doc => composeLayers(doc, doc.layers);

export function compositeBelow(doc, layerId) {
  const index = doc.layers.findIndex(l => l.id === layerId);
  return composeLayers(doc, doc.layers.slice(0, Math.max(0, index)));
}

/** One layer's own pixels, unmasked and at full opacity: { surface, x, y }. */
export function rasterizeLayer(doc, layer) {
  if (layer.kind === 'pixel') {
    return { surface: doc.buffers.get(layer.bufferId).clone(), x: layer.x, y: layer.y };
  }
  const surface = createSurface(doc.width, doc.height);
  const render = renderers.get(layer.kind);
  if (render) render(surface.ctx, doc, layer);
  return { surface, x: 0, y: 0 };
}

export function createCompositor(doc) {
  let output = null;
  let dirty = null;
  let seenVersion = -1;
  let focusId = null;
  let live = null;
  let cache = null; // { canvas, key }

  function belowKey(index) {
    const below = doc.layers.slice(0, index);
    return below.map(l => `${l.id}:${l.rev}`).join('|');
  }

  function belowCache(index) {
    const key = belowKey(index);
    if (cache && cache.key === key && cache.width === doc.width && cache.height === doc.height) return cache.canvas;
    const canvas = canvasFor(doc.width, doc.height);
    paint(canvas.getContext('2d'), doc, doc.layers.slice(0, index), full(doc));
    cache = { canvas, key, width: doc.width, height: doc.height };
    return canvas;
  }

  function recompose(region) {
    const ctx = output.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.rect(region.x, region.y, region.w, region.h);
    ctx.clip();
    ctx.clearRect(region.x, region.y, region.w, region.h);
    const focusIndex = focusId ? doc.layers.findIndex(l => l.id === focusId) : -1;
    if (focusIndex > 0) {
      ctx.drawImage(belowCache(focusIndex), region.x, region.y, region.w, region.h, region.x, region.y, region.w, region.h);
      paint(ctx, doc, doc.layers.slice(focusIndex), region, live);
    } else {
      paint(ctx, doc, doc.layers, region, live);
    }
    ctx.restore();
  }

  function sync() {
    if (!output || output.width !== doc.width || output.height !== doc.height) {
      output = canvasFor(doc.width, doc.height);
      dirty = full(doc);
    }
    if (doc.version !== seenVersion) {
      seenVersion = doc.version;
      dirty = full(doc);
    }
    if (dirty) {
      const region = intersect(dirty, full(doc));
      dirty = null;
      if (region) recompose(region);
    }
  }

  return {
    /** Draw the composite (or the part in rect) over whatever ctx holds, in document coordinates. */
    render(ctx, rect = full(doc)) {
      sync();
      const r = intersect(rect, full(doc));
      if (!r) return;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(output, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
      ctx.restore();
    },
    /** Mark an area for redrawing; with no rect, redraw everything and drop the cache. */
    invalidate(rect) {
      if (rect) { dirty = union(dirty, rect); return; }
      cache = null;
      dirty = full(doc);
    },
    setFocusLayer(id) {
      if (id === focusId) return;
      focusId = id;
      cache = null;
      dirty = full(doc);
    },
    setLiveStroke(next) {
      live = next;
      dirty = full(doc);
    },
    /** The current composite canvas (redrawn first if needed). */
    canvas() { sync(); return output; },
    dispose() { output = null; cache = null; live = null; },
  };
}
