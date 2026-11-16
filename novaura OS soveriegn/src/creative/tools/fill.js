// fill.js — The fill bucket.

import { getLayer } from '../document.js';
import { beginStroke } from '../stroke.js';
import { hexToRgba } from '../colour.js';
import { maskColour } from '../masks.js';

/**
 * Fill pixels matching the colour at (x, y), within `tolerance` on every channel, with rgba.
 * contiguous: only the connected area; otherwise every matching pixel. `sample` (same size)
 * decides what matches, e.g. the whole picture, while `pixels` is what gets filled.
 * Mutates `pixels`; returns the filled rectangle, or null.
 */
export function floodFill(pixels, x, y, rgba, { tolerance = 0, contiguous = true, sample = null } = {}) {
  const { width, height, data } = pixels;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const src = sample ? sample.data : data;
  const i0 = (y * width + x) * 4;
  const ref = [src[i0], src[i0 + 1], src[i0 + 2], src[i0 + 3]];
  const matches = i => Math.abs(src[i] - ref[0]) <= tolerance && Math.abs(src[i + 1] - ref[1]) <= tolerance
    && Math.abs(src[i + 2] - ref[2]) <= tolerance && Math.abs(src[i + 3] - ref[3]) <= tolerance;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  const paintAt = p => {
    data.set(rgba, p * 4);
    const px = p % width;
    const py = (p - px) / width;
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  };

  if (!contiguous) {
    // Decide every match first, so filling cannot change what matches.
    const hits = [];
    for (let p = 0; p < width * height; p++) if (matches(p * 4)) hits.push(p);
    hits.forEach(paintAt);
  } else {
    const seen = new Uint8Array(width * height);
    const stack = [y * width + x];
    seen[stack[0]] = 1;
    while (stack.length) {
      const p = stack.pop();
      if (!matches(p * 4)) continue;
      paintAt(p);
      const px = p % width;
      for (const n of [px > 0 ? p - 1 : -1, px < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (n >= 0 && n < width * height && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function region(pixels, rect) {
  const out = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++) {
    const s = ((rect.y + y) * pixels.width + rect.x) * 4;
    out.set(pixels.data.subarray(s, s + rect.w * 4), y * rect.w * 4);
  }
  return { width: rect.w, height: rect.h, data: out };
}

export const fill = {
  id: 'fill',
  cursor: 'crosshair',
  async down(ctx, p) {
    const s = ctx.session;
    if (!s) return;
    const doc = s.doc;
    const layer = getLayer(doc, doc.activeLayerId);
    if (!layer) return;
    const part = doc.activeTarget === 'mask' ? 'mask' : 'layer';
    const begun = beginStroke(s, { layerId: layer.id, part }, { tab: ctx.tab, label: 'Fill' });
    if (!begun.ok) { ctx.notify(begun.reason); return; }
    const { stroke } = begun;
    stroke.ensureCovers({ x: 0, y: 0, w: doc.width, h: doc.height });
    const surface = stroke.surface;
    const o = stroke.origin;
    const pixels = surface.read(0, 0, surface.width, surface.height);
    const state = ctx.store.getState();
    let sample = null;
    if (state.fill.sampleAll) {
      const { flatten } = await import('../compositor.js');
      sample = flatten(doc).read(o.x, o.y, surface.width, surface.height);
    }
    const colour = part === 'mask' ? maskColour(state.colours.primary) : state.colours.primary;
    const rect = floodFill(pixels, p.x - o.x, p.y - o.y, hexToRgba(colour), { ...state.fill, sample });
    if (!rect) { stroke.cancel(); return; }
    stroke.touch({ x: rect.x + o.x, y: rect.y + o.y, w: rect.w, h: rect.h });
    surface.write(rect.x, rect.y, region(pixels, rect));
    stroke.end();
    ctx.compositor?.invalidate();
    ctx.requestRender();
  },
  move() {},
  up() {},
  cancel() {},
};
