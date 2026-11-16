// brush.js — The brush, pencil and eraser.
//
// A stroke is drawn as dabs into its own buffer at full strength, and shown live
// through the compositor at the brush's opacity. When the stroke ends, the buffer is
// merged into the layer once, at that opacity, so overlapping dabs never build up past
// it. The eraser merges with destination-out. The pencil stamps hard, pixel-aligned
// dabs with no anti-aliasing.

import { createSurface } from '../surface.js';
import { getLayer } from '../document.js';
import { beginStroke } from '../stroke.js';
import { hexToRgba, rgbaCss } from '../colour.js';
import { maskColour, invalidateMaskAlpha } from '../masks.js';

/** Dab centres from `from` to `to`, `spacing` apart, continuing `carry` px into the segment. */
export function dabPositions(from, to, spacing, carry) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const pa = from.pressure ?? 1;
  const pb = to.pressure ?? 1;
  const points = [];
  let d = carry;
  while (d <= length + 1e-9) {
    const t = length === 0 ? 0 : d / length;
    points.push({ x: from.x + dx * t, y: from.y + dy * t, pressure: pa + (pb - pa) * t });
    d += spacing;
  }
  return { points, carry: d - length };
}

export function dabSize(size, pressure, usePressure) {
  return Math.max(1, usePressure ? size * pressure : size);
}

// One stroke buffer per canvas size, reused and cleared between strokes.
let buffer = null;
function strokeBuffer(width, height) {
  if (!buffer || buffer.width !== width || buffer.height !== height) buffer = createSurface(width, height);
  return buffer;
}

// Pencil dabs: hard-edged circles of whole pixels, cached per diameter and colour.
const pencilDabs = new Map();
function pencilDab(diameter, colour) {
  const key = `${diameter}|${colour}`;
  if (pencilDabs.has(key)) return pencilDabs.get(key);
  const canvas = new OffscreenCanvas(diameter, diameter);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(diameter, diameter);
  const [r, g, b] = hexToRgba(colour);
  const c = (diameter - 1) / 2;
  const rr = (diameter / 2) ** 2;
  for (let y = 0; y < diameter; y++) {
    for (let x = 0; x < diameter; x++) {
      if ((x - c) ** 2 + (y - c) ** 2 <= rr) image.data.set([r, g, b, 255], (y * diameter + x) * 4);
    }
  }
  ctx.putImageData(image, 0, 0);
  if (pencilDabs.size > 64) pencilDabs.clear();
  pencilDabs.set(key, canvas);
  return canvas;
}

// The area a dab covers, in the same coordinates as its centre.
function dabRect(mode, x, y, size) {
  if (mode === 'pencil') {
    const d = Math.max(1, Math.round(size));
    return { x: Math.round(x - d / 2), y: Math.round(y - d / 2), w: d, h: d };
  }
  const r = size / 2;
  return { x: Math.floor(x - r) - 1, y: Math.floor(y - r) - 1, w: Math.ceil(size) + 3, h: Math.ceil(size) + 3 };
}

function drawDab(ctx, mode, x, y, size, colour, hardness) {
  if (mode === 'pencil') {
    const d = Math.max(1, Math.round(size));
    ctx.drawImage(pencilDab(d, colour), Math.round(x - d / 2), Math.round(y - d / 2));
    return;
  }
  const r = size / 2;
  if (hardness >= 0.99) {
    ctx.fillStyle = colour;
  } else {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(Math.max(0, Math.min(0.99, hardness)), colour);
    g.addColorStop(1, rgbaCss(colour, 0));
    ctx.fillStyle = g;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const unite = (a, b) => {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

function clipTo(rect, doc) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(doc.width, rect.x + rect.w);
  const y1 = Math.min(doc.height, rect.y + rect.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

const LABELS = { brush: 'Brush stroke', pencil: 'Pencil stroke', eraser: 'Erase' };

function makePaintTool(id) {
  let active = null;

  function dab(ctx, point) {
    const { settings, buf, doc, stroke } = active;
    const size = dabSize(settings.size, point.pressure ?? 1, settings.pressure);
    const mode = id === 'pencil' ? 'pencil' : 'brush';
    active.spacing = id === 'pencil' ? 1 : Math.max(1, settings.size * 0.15);
    const inside = clipTo(dabRect(mode, point.x, point.y, size), doc);
    if (active.direct) {
      // On a mask, dabs go straight into the mask's greys, so the change shows as it is painted.
      if (!inside) return;
      stroke.ensureCovers(inside);
      stroke.touch(inside);
      const o = stroke.origin;
      const target = stroke.surface.ctx;
      target.save();
      target.translate(-o.x, -o.y);
      target.globalAlpha = settings.opacity;
      drawDab(target, mode, point.x, point.y, size, active.colour, settings.hardness);
      target.restore();
      invalidateMaskAlpha(doc, active.layer, inside);
    } else {
      drawDab(buf.ctx, mode, point.x, point.y, size, active.colour, settings.hardness);
      if (!inside) return;
      stroke.ensureCovers(inside);
    }
    active.bounds = unite(active.bounds, inside);
    ctx.compositor?.invalidate(inside);
    ctx.requestRender(inside);
  }

  function to(ctx, point) {
    const { points, carry } = dabPositions(active.last, point, active.spacing, active.carry);
    for (const p of points) dab(ctx, p);
    active.carry = carry;
    active.last = point;
  }

  function finish(ctx) {
    if (!active) return;
    const { stroke, buf, bounds, settings } = active;
    if (bounds && !active.direct) {
      stroke.touch(bounds);
      const o = stroke.origin;
      const target = stroke.surface.ctx;
      target.save();
      target.globalAlpha = settings.opacity;
      target.globalCompositeOperation = id === 'eraser' ? 'destination-out' : 'source-over';
      target.drawImage(buf.canvas, bounds.x, bounds.y, bounds.w, bounds.h, bounds.x - o.x, bounds.y - o.y, bounds.w, bounds.h);
      target.restore();
      buf.ctx.clearRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
    ctx.compositor?.setLiveStroke(null);
    stroke.end();
    ctx.compositor?.invalidate();
    ctx.requestRender();
    active = null;
  }

  return {
    id,
    cursor: 'crosshair',
    down(ctx, p) {
      const s = ctx.session;
      if (!s || active) return;
      const doc = s.doc;
      const layer = getLayer(doc, doc.activeLayerId);
      if (!layer) return;
      const part = doc.activeTarget === 'mask' ? 'mask' : 'layer';
      const begun = beginStroke(s, { layerId: layer.id, part }, { tab: ctx.tab, label: LABELS[id] });
      if (!begun.ok) { ctx.notify(begun.reason); return; }
      const state = ctx.store.getState();
      const direct = part === 'mask';
      let colour = id === 'eraser' ? '#000000' : state.colours.primary;
      if (direct && id !== 'eraser') colour = maskColour(colour); // on a mask: the colour's grey; the eraser paints black
      active = {
        doc, layer, direct, stroke: begun.stroke, buf: direct ? null : strokeBuffer(doc.width, doc.height),
        bounds: null, last: p, carry: 0, spacing: 1, settings: { ...state.brush }, colour,
      };
      ctx.compositor?.setFocusLayer(layer.id);
      if (!direct) {
        ctx.compositor?.setLiveStroke({
          layerId: layer.id, part, surface: active.buf, origin: { x: 0, y: 0 },
          opacity: active.settings.opacity, erase: id === 'eraser',
        });
      }
      const first = dabPositions(p, p, 1, 0);
      dab(ctx, first.points[0]);
      active.carry = active.spacing;
    },
    move(ctx, p) {
      if (!active) return;
      for (const c of p.coalesced?.length ? p.coalesced : [p]) to(ctx, c);
    },
    up(ctx, p) {
      if (!active) return;
      if (p) to(ctx, p);
      finish(ctx);
    },
    /** The pointer was lost mid-stroke: keep what was drawn, as one step. */
    cancel(ctx) { finish(ctx); },
  };
}

export const brush = makePaintTool('brush');
export const pencil = makePaintTool('pencil');
export const eraser = makePaintTool('eraser');
