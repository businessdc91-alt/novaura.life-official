// move.js — Move the selected layer by dragging, or nudge it with the arrow keys.
// Pixel layers change their x, y, so nothing is lost off the canvas; a mask moves with its layer.

import { getLayer, canEdit, collectDescendants } from '../document.js';
import { setLayerProps, setBatchLayerProps } from '../edits.js';

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

function applyMove(ctx, target, dx, dy, meta) {
  if (target.kind === 'group') {
    const entries = [];
    for (const item of target.children) {
      const p = moved(item.layer, item.start, dx, dy);
      if (Object.keys(p).length) entries.push({ id: item.layer.id, patch: p });
    }
    const r = setBatchLayerProps(ctx.session, entries, { tab: ctx.tab, label: 'Move group', ...meta });
    if (!r.ok) ctx.notify(r.reason);
  } else {
    const r = setLayerProps(ctx.session, target.layer.id, moved(target.layer, target.start, dx, dy), { tab: ctx.tab, label: 'Move layer', ...meta });
    if (!r.ok) ctx.notify(r.reason);
  }
  ctx.compositor?.invalidate();
  ctx.requestRender();
}

function targetFor(ctx) {
  const layer = movable(ctx);
  if (!layer) return null;
  if (layer.kind === 'group') {
    const kids = [layer, ...collectDescendants(ctx.session.doc, layer.id)]
      .filter(l => !l.locked && l.kind !== 'adjust' && (l.kind !== 'group' || l.mask));
    return { kind: 'group', layer, children: kids.map(l => ({ layer: l, start: snapshot(l) })) };
  }
  return { kind: 'leaf', layer, start: snapshot(layer) };
}

export const move = {
  id: 'move',
  cursor: 'move',
  down(ctx, p) {
    const t = targetFor(ctx);
    drag = t ? { target: t, sx: p.x, sy: p.y, id: ++dragCount } : null;
  },
  move(ctx, p) {
    if (!drag) return;
    const dx = Math.round(p.x - drag.sx);
    const dy = Math.round(p.y - drag.sy);
    applyMove(ctx, drag.target, dx, dy, { mergeKey: `move:${drag.target.layer.id}:${drag.id}` });
  },
  up() { drag = null; },
  cancel() { drag = null; },
  /** Arrow keys nudge 1 px, or 10 px with Shift; returns true when it handled the key. */
  key(ctx, event) {
    const dir = ARROWS[event.key];
    if (!dir) return false;
    const t = targetFor(ctx);
    if (!t) return true;
    const step = event.shiftKey ? 10 : 1;
    applyMove(ctx, t, dir[0] * step, dir[1] * step, {
      mergeKey: `nudge:${t.layer.id}`, mergeWindowMs: 500, label: 'Nudge layer',
    });
    return true;
  },
};
