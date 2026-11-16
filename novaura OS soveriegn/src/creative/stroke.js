// stroke.js — One pixel edit (a brush stroke, a fill, a filter) recorded as one undoable step.
//
//   const r = beginStroke(session, { layerId, part: 'layer' | 'mask' }, { tab, label });
//   r.stroke.ensureCovers(rect)   // before drawing where the layer might not reach
//   r.stroke.touch(rect)          // before changing pixels in rect (document coordinates)
//   ...draw into r.stroke.surface, at rect minus r.stroke.origin...
//   r.stroke.end()                // pushes the step; or cancel() to put everything back
//
// A layer smaller than the canvas grows to cover the canvas the first time a stroke
// reaches outside it; the growth and the stroke undo together.

import { getLayer, surfaceOf, canEdit, touchLayer } from './document.js';
import { createSurface } from './surface.js';
import { beginPixelEdit, applyPatch } from './pixelRecorder.js';
import { patchStep, commitPatch } from './edits.js';

const inside = (r, b) => r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.width && r.y + r.h <= b.y + b.height;

export function beginStroke(s, { layerId, part = 'layer' }, meta) {
  const { doc } = s;
  const layer = getLayer(doc, layerId);
  if (!layer) return { ok: false, reason: 'That layer no longer exists.' };
  if (part === 'mask' && !layer.mask) return { ok: false, reason: 'This layer has no mask.' };
  const allowed = canEdit(layer, part === 'mask' ? 'mask' : 'paint');
  if (!allowed.ok) return allowed;

  const bounds = () => (part === 'mask' ? layer.mask : layer);
  const bufferId = () => (part === 'mask' ? layer.mask.bufferId : layer.bufferId);
  let recorder = beginPixelEdit(surfaceOf(doc, layer, part));
  const pending = []; // patch steps recorded before the layer grew (they apply to the old surface)
  let grow = null;

  function growToCanvas() {
    const b = bounds();
    const x0 = Math.min(b.x, 0);
    const y0 = Math.min(b.y, 0);
    const x1 = Math.max(b.x + b.width, doc.width);
    const y1 = Math.max(b.y + b.height, doc.height);
    if (x0 === b.x && y0 === b.y && x1 === b.x + b.width && y1 === b.y + b.height) return null;
    const old = surfaceOf(doc, layer, part);
    let grown;
    if (part === 'mask') {
      // New mask area takes the mask's default: everything outside it was showing or hidden already.
      grown = createSurface(x1 - x0, y1 - y0);
      const v = b.defaultValue ?? 255;
      const row = new Uint8ClampedArray(grown.width * 4);
      for (let i = 0; i < row.length; i += 4) { row[i] = v; row[i + 1] = v; row[i + 2] = v; row[i + 3] = 255; }
      for (let y = 0; y < grown.height; y++) grown.write(0, y, { width: grown.width, height: 1, data: row });
      grown.write(b.x - x0, b.y - y0, old.read(0, 0, old.width, old.height));
    } else {
      grown = old.clone();
      grown.resizeCanvas(x1 - x0, y1 - y0, b.x - x0, b.y - y0);
    }
    const before = { x: b.x, y: b.y, width: b.width, height: b.height, surface: old };
    const after = { x: x0, y: y0, width: x1 - x0, height: y1 - y0, surface: grown };
    const set = state => {
      doc.buffers.set(bufferId(), state.surface);
      Object.assign(bounds(), { x: state.x, y: state.y, width: state.width, height: state.height });
      touchLayer(doc, layer);
    };
    set(after);
    return { bytes: old.bytes, apply: () => set(after), revert: () => set(before) };
  }

  const stroke = {
    get surface() { return surfaceOf(doc, layer, part); },
    get origin() { const b = bounds(); return { x: b.x, y: b.y }; },

    ensureCovers(rect) {
      if (grow || inside(rect, bounds())) return;
      const earlier = recorder.finish();
      if (earlier) pending.push(patchStep(s, layer, part, earlier));
      grow = growToCanvas();
      recorder = beginPixelEdit(surfaceOf(doc, layer, part));
    },

    touch(rect) {
      const o = stroke.origin;
      recorder.touch(rect.x - o.x, rect.y - o.y, rect.w, rect.h);
    },

    end() {
      const patch = recorder.finish();
      // Order matters: earlier edits apply to the old surface, then the growth swaps in the grown one.
      if (!patch && !pending.length) {
        if (grow) { grow.revert(); grow = null; } // grew but drew nothing: leave the layer as it was
        return null;
      }
      const extra = [...pending, ...(grow ? [grow] : [])];
      return commitPatch(s, layerId, part, patch, meta, extra);
    },

    cancel() {
      const patch = recorder.finish();
      if (patch) applyPatch(surfaceOf(doc, layer, part), patch, 'before');
      if (grow) grow.revert();
      for (let i = pending.length - 1; i >= 0; i--) pending[i].revert();
      touchLayer(doc, layer);
    },
  };
  return { ok: true, stroke };
}
