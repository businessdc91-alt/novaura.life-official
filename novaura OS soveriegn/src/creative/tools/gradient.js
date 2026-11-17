// gradient.js — The gradient tool (Shift+G): drag from start to end to fill the layer (or
// its mask) with a linear or radial gradient, from the main colour to the second colour
// or to transparent. One drag is one step.

import { getLayer } from '../document.js';
import { beginStroke } from '../stroke.js';
import { rgbaCss } from '../colour.js';
import { maskColour, invalidateMaskAlpha } from '../masks.js';
import { clipPixelsToSelection } from '../selection.js';
import { registerTool } from './index.js';

let drag = null;

/** The line being dragged right now (for the canvas overlay), or null. */
export const gradientPreview = () => (drag?.end ? { start: drag.start, end: drag.end } : null);

export function gradientStops(primary, secondary, mode) {
  return [
    { offset: 0, colour: rgbaCss(primary, 1) },
    { offset: 1, colour: mode === 'toTransparent' ? rgbaCss(primary, 0) : rgbaCss(secondary, 1) },
  ];
}

function apply(ctx, start, end) {
  const s = ctx.session;
  const doc = s.doc;
  const layer = getLayer(doc, doc.activeLayerId);
  if (!layer) return;
  const part = doc.activeTarget === 'mask' ? 'mask' : 'layer';
  const begun = beginStroke(s, { layerId: layer.id, part }, { tab: ctx.tab, label: 'Gradient' });
  if (!begun.ok) { ctx.notify(begun.reason); return; }
  const { stroke } = begun;
  const area = { x: 0, y: 0, w: doc.width, h: doc.height };
  stroke.ensureCovers(area);
  stroke.touch(area);
  const o = stroke.origin;
  const before = doc.selection ? stroke.surface.read(-o.x, -o.y, doc.width, doc.height) : null;
  const target = stroke.surface.ctx;
  const { colours: picked, gradient } = ctx.store.getState();
  const colours = part === 'mask' // a mask takes greys
    ? { primary: maskColour(picked.primary), secondary: maskColour(picked.secondary) }
    : picked;
  const g = gradient.type === 'radial'
    ? target.createRadialGradient(start.x - o.x, start.y - o.y, 0, start.x - o.x, start.y - o.y, Math.hypot(end.x - start.x, end.y - start.y))
    : target.createLinearGradient(start.x - o.x, start.y - o.y, end.x - o.x, end.y - o.y);
  for (const stop of gradientStops(colours.primary, colours.secondary, gradient.mode)) g.addColorStop(stop.offset, stop.colour);
  target.save();
  target.fillStyle = g;
  target.fillRect(-o.x, -o.y, doc.width, doc.height);
  target.restore();
  if (doc.selection && before) {
    const after = stroke.surface.read(-o.x, -o.y, doc.width, doc.height);
    clipPixelsToSelection(after, before, 0, 0, doc.selection);
    stroke.surface.write(-o.x, -o.y, after);
  }
  if (part === 'mask') invalidateMaskAlpha(doc, layer, area);
  stroke.end();
  ctx.compositor?.invalidate();
  ctx.requestRender();
}

export const gradient = {
  id: 'gradient',
  cursor: 'crosshair',
  down(ctx, p) { drag = { start: { x: p.x, y: p.y }, end: null }; },
  move(ctx, p) {
    if (!drag) return;
    drag.end = { x: p.x, y: p.y };
    ctx.requestRender();
  },
  up(ctx, p) {
    if (!drag) return;
    const { start } = drag;
    const end = p ? { x: p.x, y: p.y } : drag.end;
    drag = null;
    if (end && Math.hypot(end.x - start.x, end.y - start.y) >= 1) apply(ctx, start, end);
    ctx.requestRender();
  },
  cancel(ctx) { gradient.up(ctx, null); },
};

registerTool(gradient);
