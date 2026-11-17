// selection.js (tools) — Marquee (M), Lasso (L), and Magic Wand (W).
//
// Shift+click adds to selection, Alt+click subtracts, Shift+Alt intersects.
// When replacing with Marquee/Lasso, holding Shift after mouse-down constrains 1:1.

import { getLayer, surfaceOf } from '../document.js';
import { setSelection } from '../edits.js';
import {
  createSelection, combineSelectionData, rectSelectionData, ellipseSelectionData,
  lassoSelectionData, magicWandSelectionData,
} from '../selection.js';
import { registerTool } from './index.js';

let draft = null;

/** Live preview geometry while dragging marquee or lasso, or null. */
export const selectionPreview = () => draft;

function modeFromEvent(p, defaultMode = 'replace') {
  if (p.shift && p.alt) return 'intersect';
  if (p.shift) return 'add';
  if (p.alt) return 'subtract';
  return defaultMode || 'replace';
}

function dragRect(a, b, square) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  return {
    x: Math.round(Math.min(a.x, a.x + dx)),
    y: Math.round(Math.min(a.y, a.y + dy)),
    w: Math.round(Math.abs(dx)),
    h: Math.round(Math.abs(dy)),
  };
}

function applyNewSelection(ctx, data, mode, label) {
  const s = ctx.session;
  if (!s) return;
  const { doc } = s;
  const combined = combineSelectionData(doc.selection?.data || null, data, mode);
  const next = combined ? createSelection(doc.width, doc.height, combined) : null;
  setSelection(s, next, { tab: ctx.tab }, label);
  ctx.requestRender();
}

export const marquee = {
  id: 'marquee',
  cursor: 'crosshair',
  down(ctx, p) {
    const s = ctx.session;
    if (!s) return;
    const sel = ctx.store.getState().selection;
    draft = {
      kind: sel.shape === 'ellipse' ? 'ellipse' : 'rect',
      start: { x: p.x, y: p.y },
      rect: { x: Math.round(p.x), y: Math.round(p.y), w: 0, h: 0 },
      mode: modeFromEvent(p, sel.mode),
      constrainIfShift: !p.shift,
    };
  },
  move(ctx, p) {
    if (!draft) return;
    draft.rect = dragRect(draft.start, p, p.shift && draft.constrainIfShift);
    ctx.requestRender();
  },
  up(ctx, p) {
    const was = draft;
    draft = null;
    if (!was || !ctx.session) { ctx.requestRender(); return; }
    const rect = p ? dragRect(was.start, p, p.shift && was.constrainIfShift) : was.rect;
    const { doc } = ctx.session;
    const sel = ctx.store.getState().selection;
    if (rect.w < 2 || rect.h < 2) {
      if (was.mode === 'replace') applyNewSelection(ctx, null, 'replace', 'Deselect');
      else ctx.requestRender();
      return;
    }
    const data = was.kind === 'ellipse'
      ? ellipseSelectionData(doc.width, doc.height, rect, sel.feather)
      : rectSelectionData(doc.width, doc.height, rect, sel.feather);
    applyNewSelection(ctx, data, was.mode, was.kind === 'ellipse' ? 'Elliptical marquee' : 'Rectangular marquee');
  },
  cancel(ctx) { draft = null; ctx.requestRender(); },
};

export const lasso = {
  id: 'lasso',
  cursor: 'crosshair',
  down(ctx, p) {
    const s = ctx.session;
    if (!s) return;
    const sel = ctx.store.getState().selection;
    draft = {
      kind: 'lasso',
      points: [{ x: p.x, y: p.y }],
      mode: modeFromEvent(p, sel.mode),
    };
    ctx.requestRender();
  },
  move(ctx, p) {
    if (!draft) return;
    const last = draft.points.at(-1);
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 2) {
      draft.points.push({ x: p.x, y: p.y });
      ctx.requestRender();
    }
  },
  up(ctx, p) {
    const was = draft;
    draft = null;
    if (!was || !ctx.session) { ctx.requestRender(); return; }
    if (p) was.points.push({ x: p.x, y: p.y });
    const { doc } = ctx.session;
    const sel = ctx.store.getState().selection;
    if (was.points.length < 3) {
      if (was.mode === 'replace') applyNewSelection(ctx, null, 'replace', 'Deselect');
      else ctx.requestRender();
      return;
    }
    const data = lassoSelectionData(doc.width, doc.height, was.points, sel.feather);
    applyNewSelection(ctx, data, was.mode, 'Lasso selection');
  },
  cancel(ctx) { draft = null; ctx.requestRender(); },
};

export const wand = {
  id: 'wand',
  cursor: 'crosshair',
  down(ctx, p) {
    const s = ctx.session;
    if (!s) return;
    const { doc } = s;
    const sel = ctx.store.getState().selection;
    const mode = modeFromEvent(p, sel.mode);
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return;

    let samplePixels;
    if (sel.sampleAll !== false || !doc.activeLayerId) {
      const canvas = ctx.compositor?.canvas();
      if (!canvas) return;
      samplePixels = canvas.getContext('2d').getImageData(0, 0, doc.width, doc.height);
    } else {
      const layer = getLayer(doc, doc.activeLayerId);
      if (!layer || layer.kind !== 'pixel') {
        const canvas = ctx.compositor?.canvas();
        if (!canvas) return;
        samplePixels = canvas.getContext('2d').getImageData(0, 0, doc.width, doc.height);
      } else {
        const surf = surfaceOf(doc, layer);
        samplePixels = surf.read(-layer.x, -layer.y, doc.width, doc.height);
      }
    }
    const data = magicWandSelectionData(samplePixels, x, y, {
      tolerance: sel.tolerance ?? 32,
      contiguous: sel.contiguous !== false,
      feather: sel.feather ?? 0,
    });
    applyNewSelection(ctx, data, mode, 'Magic wand');
  },
  move() {},
  up() {},
  cancel() {},
};

registerTool(marquee);
registerTool(lasso);
registerTool(wand);

