// crop.js (tool) — Interactive Crop tool (C): drag handles or draw a rectangle,
// move the frame inside, Enter commits an undoable cropDocument step, Esc resets.

import { cropDocument } from '../edits.js';
import { registerTool } from './index.js';

export const CROP_ASPECTS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1 Square', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16 Story', ratio: 9 / 16 },
];

let cropState = null; // { docId, rect: { x, y, w, h } }
let drag = null;

function ratioOf(aspectId) {
  return CROP_ASPECTS.find(a => a.id === aspectId)?.ratio ?? null;
}

export function getCropRect(doc) {
  if (!doc) return null;
  if (cropState && cropState.docId === doc.id) return cropState.rect;
  return { x: 0, y: 0, w: doc.width, h: doc.height };
}

export function setCropRect(doc, rect) {
  if (!doc) return;
  cropState = rect
    ? {
        docId: doc.id,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.max(1, Math.round(rect.w)),
          h: Math.max(1, Math.round(rect.h)),
        },
      }
    : null;
}

export function clearCropRect() {
  cropState = null;
  drag = null;
}

export function cropHandles(rect) {
  if (!rect) return [];
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return [
    { id: 'nw', x, y }, { id: 'n', x: cx, y }, { id: 'ne', x: x + w, y },
    { id: 'e', x: x + w, y: cy }, { id: 'se', x: x + w, y: y + h },
    { id: 's', x: cx, y: y + h }, { id: 'sw', x, y: y + h }, { id: 'w', x, y: cy },
  ];
}

function hitHandle(rect, p, zoom = 1) {
  const r = 10 / zoom;
  for (const h of cropHandles(rect)) {
    if (Math.abs(p.x - h.x) <= r && Math.abs(p.y - h.y) <= r) return h.id;
  }
  return null;
}

function constrainRect(rect, ratio, anchorX, anchorY) {
  if (!ratio) return rect;
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(w / ratio));
  return {
    x: anchorX === 'right' ? Math.round(rect.x + rect.w - w) : Math.round(rect.x),
    y: anchorY === 'bottom' ? Math.round(rect.y + rect.h - h) : Math.round(rect.y),
    w, h,
  };
}

function resized(startRect, handle, p, ratio) {
  let x0 = startRect.x;
  let y0 = startRect.y;
  let x1 = startRect.x + startRect.w;
  let y1 = startRect.y + startRect.h;
  if (handle.includes('w')) x0 = Math.min(x1 - 1, Math.round(p.x));
  if (handle.includes('e')) x1 = Math.max(x0 + 1, Math.round(p.x));
  if (handle.includes('n')) y0 = Math.min(y1 - 1, Math.round(p.y));
  if (handle.includes('s')) y1 = Math.max(y0 + 1, Math.round(p.y));
  const rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  if (!ratio) return rect;
  if (handle === 'n' || handle === 's') {
    const w = Math.max(1, Math.round(rect.h * ratio));
    return { x: Math.round(x0 + (rect.w - w) / 2), y: y0, w, h: rect.h };
  }
  return constrainRect(rect, ratio, handle.includes('w') ? 'right' : 'left', handle.includes('n') ? 'bottom' : 'top');
}

export function commitCrop(ctx) {
  const s = ctx.session;
  if (!s) return { ok: false, reason: 'No active document.' };
  const rect = getCropRect(s.doc);
  const deleteCropped = !!ctx.store.getState().crop?.deleteCropped;
  const r = cropDocument(s, rect, { tab: ctx.tab }, { deleteCropped });
  if (!r.ok) { ctx.notify?.(r.reason); return r; }
  clearCropRect();
  ctx.compositor?.invalidate();
  ctx.store.bump();
  ctx.requestRender();
  return r;
}

export function cancelCrop(ctx) {
  clearCropRect();
  ctx.store?.bump();
  ctx.requestRender?.();
}

export const crop = {
  id: 'crop',
  cursor: 'crosshair',
  down(ctx, p) {
    const s = ctx.session;
    if (!s) return;
    const rect = getCropRect(s.doc);
    setCropRect(s.doc, rect);
    const h = hitHandle(rect, p, ctx.view?.zoom || 1);
    if (h) {
      drag = { kind: 'handle', handle: h, startRect: { ...rect }, start: p };
      return;
    }
    if (p.x >= rect.x && p.y >= rect.y && p.x <= rect.x + rect.w && p.y <= rect.y + rect.h) {
      drag = { kind: 'move', startRect: { ...rect }, start: p };
      return;
    }
    drag = { kind: 'create', start: p };
  },
  move(ctx, p) {
    const s = ctx.session;
    if (!drag || !s) return;
    const cropPrefs = ctx.store.getState().crop || {};
    const ratio = ratioOf(cropPrefs.aspect) || (p.shift ? 1 : null);
    if (drag.kind === 'move') {
      const dx = Math.round(p.x - drag.start.x);
      const dy = Math.round(p.y - drag.start.y);
      setCropRect(s.doc, { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy });
    } else if (drag.kind === 'handle') {
      setCropRect(s.doc, resized(drag.startRect, drag.handle, p, ratio));
    } else if (drag.kind === 'create') {
      let w = p.x - drag.start.x;
      let h = p.y - drag.start.y;
      if (ratio) {
        const signH = Math.sign(h || 1);
        h = signH * Math.abs(w) / ratio;
      }
      const x = Math.round(Math.min(drag.start.x, drag.start.x + w));
      const y = Math.round(Math.min(drag.start.y, drag.start.y + h));
      setCropRect(s.doc, { x, y, w: Math.max(1, Math.round(Math.abs(w))), h: Math.max(1, Math.round(Math.abs(h))) });
    }
    ctx.store.bump();
    ctx.requestRender();
  },
  up() { drag = null; },
  cancel() { drag = null; },
  key(ctx, event) {
    if (event.key === 'Enter') { commitCrop(ctx); return true; }
    if (event.key === 'Escape') { cancelCrop(ctx); return true; }
    return false;
  },
};

registerTool(crop);

