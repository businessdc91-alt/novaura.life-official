// applyFilter.js — Run a filter on the active pixel layer (or its mask) as one undoable
// Photo step, on the worker pool. Cancelling puts everything back and adds no step.

import { getLayer } from './document.js';
import { beginStroke } from './stroke.js';
import { FILTERS } from './filters/kernels.js';
import { sharedFilterPool } from './filters/pool.js';

export async function applyFilter(session, id, params, { tab = 'photo', pool = sharedFilterPool(), onProgress, signal } = {}) {
  const { doc } = session;
  const layer = getLayer(doc, doc.activeLayerId);
  if (!layer) return { ok: false, reason: 'Choose a layer first.' };
  const part = doc.activeTarget === 'mask' ? 'mask' : 'layer';
  const begun = beginStroke(session, { layerId: layer.id, part }, { tab, label: FILTERS[id].label });
  if (!begun.ok) return begun;
  const { stroke } = begun;
  const surface = stroke.surface;
  const origin = stroke.origin;
  stroke.touch({ x: origin.x, y: origin.y, w: surface.width, h: surface.height });
  const pixels = surface.read(0, 0, surface.width, surface.height);
  let result;
  try {
    result = await pool.run(id, pixels, params, { onProgress, signal });
  } catch (err) {
    stroke.cancel();
    if (err?.name === 'AbortError') return { ok: false, reason: 'Cancelled.', cancelled: true };
    return { ok: false, reason: `${FILTERS[id].label} failed: ${err?.message || err}` };
  }
  surface.write(0, 0, result);
  stroke.end();
  session.compositor?.invalidate();
  return { ok: true };
}
