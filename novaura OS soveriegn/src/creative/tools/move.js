// move.js — Move the selected layer by dragging, or nudge it with the arrow keys.
// Pixel layers change their x, y, so nothing is lost off the canvas; a mask moves with its layer.

import { getLayer, canEdit } from '../document.js';
import { setLayerProps } from '../edits.js';

let drag = null;
let dragCount = 0;

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function positionOf(layer) {
  if (layer.shape === 'line') return { x1: layer.x1, y1: layer.y1, x2: layer.x2, y2: layer.y2 };
  return { x: layer.x ?? 0, y: layer.y ?? 0 };
}

function moved(layer, start, dx, dy) {
  const patch = 'x1' in start
    ? { x1: start.x1 + dx, y1: start.y1 + dy, x2: start.x2 + dx, y2: start.y2 + dy }
    : { x: start.x + dx, y: start.y + dy };
  if (layer.mask) patch.mask = { ...layer.mask, x: start.maskX + dx, y: start.maskY + dy };
  return patch;
}

function snapshot(layer) {
  return { ...positionOf(layer), maskX: layer.mask?.x ?? 0, maskY: layer.mask?.y ?? 0 };
}

// The active layer if it can be moved; otherwise tells the person why and returns null.
function movable(ctx) {
  const doc = ctx.session?.doc;
  const layer = doc && getLayer(doc, doc.activeLayerId);
  if (!layer) return null;
  if (layer.kind === 'adjust') { ctx.notify('Adjustment layers have no position to move.'); return null; }
  const allowed = canEdit(layer, 'move');
  if (!allowed.ok) { ctx.notify(allowed.reason); return null; }
  return layer;
}

function apply(ctx, layer, patch, meta) {
  const r = setLayerProps(ctx.session, layer.id, patch, { tab: ctx.tab, label: 'Move layer', ...meta });
  if (!r.ok) ctx.notify(r.reason);
  ctx.compositor?.invalidate();
  ctx.requestRender();
}

export const move = {
  id: 'move',
  cursor: 'move',
  down(ctx, p) {
    const layer = movable(ctx);
    drag = layer ? { layer, sx: p.x, sy: p.y, start: snapshot(layer), id: ++dragCount } : null;
  },
  move(ctx, p) {
    if (!drag) return;
    const dx = Math.round(p.x - drag.sx);
    const dy = Math.round(p.y - drag.sy);
    apply(ctx, drag.layer, moved(drag.layer, drag.start, dx, dy), { mergeKey: `move:${drag.layer.id}:${drag.id}` });
  },
  up() { drag = null; },
  cancel() { drag = null; },
  /** Arrow keys nudge 1 px, or 10 px with Shift; returns true when it handled the key. */
  key(ctx, event) {
    const dir = ARROWS[event.key];
    if (!dir) return false;
    const layer = movable(ctx);
    if (!layer) return true;
    const step = event.shiftKey ? 10 : 1;
    apply(ctx, layer, moved(layer, snapshot(layer), dir[0] * step, dir[1] * step), {
      mergeKey: `nudge:${layer.id}`, mergeWindowMs: 500, label: 'Nudge layer',
    });
    return true;
  },
};
