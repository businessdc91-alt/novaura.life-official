// adjustmentLayers.js — Draws adjustment layers for the compositor.
//
// The compositor hands over everything beneath the adjustment layer (for the area being
// drawn); this returns the adjusted copy. Canvas-filter adjustments (sepia, blur) use
// ctx.filter; the rest run their lookup tables or per-pixel maths. A full-picture result
// is cached until the settings or anything beneath changes.

import { CanvasSurface, surfaceFromPixels } from './surface.js';
import { setAdjustmentProvider } from './compositor.js';
import { ADJUSTMENTS, applyAdjustmentPixels, canvasFilter, isIdentity } from './adjustments.js';

const cache = new WeakMap(); // layer → { key, surface }

function beneathKey(doc, layer, region) {
  const index = doc.layers.indexOf(layer);
  const below = doc.layers.slice(0, index).map(l => `${l.id}:${l.rev}`).join('|');
  return `${JSON.stringify(layer.params)}#${below}#${region.x},${region.y},${region.w},${region.h}#${doc.width}x${doc.height}`;
}

export function adjustBelow(doc, layer, below, region) {
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
  } else {
    const pixels = below.read(0, 0, below.width, below.height);
    applyAdjustmentPixels(layer.adjust, layer.params, pixels, { docWidth: doc.width, docHeight: doc.height, originX: region.x, originY: region.y });
    surface = surfaceFromPixels(pixels);
  }
  if (key) cache.set(layer, { key, surface });
  return surface;
}

setAdjustmentProvider(adjustBelow);
