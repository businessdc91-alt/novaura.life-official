// shape.js — The shape tool (U).
//
// Drag on the canvas to draw a new shape layer (Shift for a square or circle); the
// drawing is previewed and becomes one layer, one step, when released. With a shape
// layer selected, drag a handle to resize or rotate it, or drag inside it to move it;
// each drag is one step.

import { getLayer, canEdit } from '../document.js';
import { addLayer, setLayerProps } from '../edits.js';
import { defaultShape } from '../shapes.js';
import { hitHandle, dragHandle, insideShape } from '../transformHandles.js';
import { registerTool } from './index.js';

const LABELS = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', polygon: 'Polygon', star: 'Star' };

let mode = null;
let preview = null;
let dragCount = 0;

/** The shape being drawn right now (for the canvas overlay), or null. */
export const shapePreview = () => preview;

function box(a, b, square) {
  let w = b.x - a.x;
  let h = b.y - a.y;
  if (square) {
    const side = Math.max(Math.abs(w), Math.abs(h));
    w = Math.sign(w || 1) * side;
    h = Math.sign(h || 1) * side;
  }
  return { x: Math.round(Math.min(a.x, a.x + w)), y: Math.round(Math.min(a.y, a.y + h)), w: Math.round(Math.abs(w)), h: Math.round(Math.abs(h)) };
}

function newShape(ctx, start, p) {
  const state = ctx.store.getState();
  const kind = state.shape.kind;
  if (kind === 'line') {
    const fields = defaultShape('line', { x1: Math.round(start.x), y1: Math.round(start.y), x2: Math.round(p.x), y2: Math.round(p.y) }, state.colours);
    fields.strokeWidth = state.shape.strokeWidth;
    return fields;
  }
  const fields = defaultShape(kind, box(start, p, p.shift), state.colours);
  if (state.shape.stroke) {
    fields.stroke = state.colours.secondary;
    fields.strokeWidth = state.shape.strokeWidth;
  }
  return fields;
}

const farEnough = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) >= 2;

function movedFields(snapshot, dx, dy) {
  if (snapshot.shape === 'line') return { x1: snapshot.x1 + dx, y1: snapshot.y1 + dy, x2: snapshot.x2 + dx, y2: snapshot.y2 + dy };
  return { x: snapshot.x + dx, y: snapshot.y + dy };
}

function redraw(ctx) {
  ctx.compositor?.invalidate();
  ctx.requestRender();
}

function update(ctx, p) {
  if (!mode) return;
  if (mode.kind === 'create') {
    preview = farEnough(mode.start, p) ? newShape(ctx, mode.start, p) : null;
    ctx.requestRender();
    return;
  }
  const patch = mode.kind === 'handle'
    ? dragHandle(mode.snapshot, mode.handle, mode.start, p, { shift: p.shift })
    : movedFields(mode.snapshot, Math.round(p.x - mode.start.x), Math.round(p.y - mode.start.y));
  const r = setLayerProps(ctx.session, mode.layerId, patch, {
    tab: ctx.tab, label: mode.kind === 'handle' ? 'Transform shape' : 'Move layer', mergeKey: `shape:${mode.layerId}:${mode.dragId}`,
  });
  if (!r.ok) ctx.notify(r.reason);
  redraw(ctx);
}

function finish(ctx, p) {
  if (!mode) return;
  if (mode.kind === 'create') {
    const fields = p && farEnough(mode.start, p) ? newShape(ctx, mode.start, p) : preview;
    if (fields) {
      const r = addLayer(ctx.session, 'shape', fields, { tab: ctx.tab, label: LABELS[fields.shape] });
      if (!r.ok) ctx.notify(r.reason);
    }
  } else if (p) {
    update(ctx, p);
  }
  mode = null;
  preview = null;
  redraw(ctx);
}

export const shape = {
  id: 'shape',
  cursor: 'crosshair',
  down(ctx, p) {
    const s = ctx.session;
    if (!s) return;
    const zoom = ctx.view?.zoom || 1;
    const layer = getLayer(s.doc, s.doc.activeLayerId);
    if (layer?.kind === 'shape') {
      const handle = hitHandle(layer, p.x, p.y, 8 / zoom, { rotateOffset: 24 / zoom });
      if (handle || insideShape(layer, p.x, p.y, 3 / zoom)) {
        const allowed = canEdit(layer, handle ? 'edit' : 'move');
        if (!allowed.ok) { ctx.notify(allowed.reason); mode = null; return; }
        mode = { kind: handle ? 'handle' : 'move', handle, layerId: layer.id, snapshot: { ...layer }, start: p, dragId: ++dragCount };
        return;
      }
    }
    mode = { kind: 'create', start: p };
    preview = null;
  },
  move: update,
  up: finish,
  /** The pointer was lost: keep what was drawn so far. */
  cancel(ctx) { finish(ctx, null); },
};

registerTool(shape);
