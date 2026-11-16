// eyedropper.js — Pick the main colour from the picture (default) or from the current layer.

import { getLayer, surfaceOf } from '../document.js';
import { rgbToHex } from '../colour.js';

let picking = false;

function pick(ctx, p) {
  const doc = ctx.session?.doc;
  if (!doc) return;
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return;
  let rgba;
  if (ctx.store.getState().eyedropper.sample === 'layer') {
    const layer = getLayer(doc, doc.activeLayerId);
    if (!layer || layer.kind !== 'pixel') return;
    rgba = surfaceOf(doc, layer).read(x - layer.x, y - layer.y, 1, 1).data;
  } else {
    rgba = ctx.compositor.canvas().getContext('2d').getImageData(x, y, 1, 1).data;
  }
  if (rgba[3] === 0) return; // nothing there to pick
  ctx.store.update({ colours: { primary: rgbToHex(rgba) } });
}

export const eyedropper = {
  id: 'eyedropper',
  cursor: 'crosshair',
  down(ctx, p) { picking = true; pick(ctx, p); },
  move(ctx, p) { if (picking) pick(ctx, p); },
  up() { picking = false; },
  cancel() { picking = false; },
};
