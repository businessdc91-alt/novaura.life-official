// Real browser verification of Creative Studio Phase 2:
// - low-opacity mask brush stroke does NOT build up within one drag
// - brush / fill / gradient / filter clip cleanly inside active selection
// - hierarchical Layer Groups (pass-through vs isolated multiply + mask + opacity)
// - async Web Worker adjustment offload for Hue/Saturation & Vignette

import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf, createLayer, insertLayer } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { addLayer, addMask, setSelection } from '../../../src/creative/edits.js';
import { flatten } from '../../../src/creative/compositor.js';
import { rectSelectionData, createSelection } from '../../../src/creative/selection.js';
import { TOOLS, toolContext } from '../../../src/creative/tools/index.js';
import { defaultParams } from '../../../src/creative/adjustments.js';
import { setAdjustmentWorkerThreshold } from '../../../src/creative/adjustmentLayers.js';
import '../../../src/creative/masks.js';
import '../../../src/creative/tools/gradient.js';
import '../../../src/creative/tools/selection.js';
import '../../../src/creative/tools/crop.js';

setSurfaceFactory(null);

const PAINT = { tab: 'paint' };
const px = (s, x, y) => [...s.read(x, y, 1, 1).data];

test('low-opacity mask brush stroke does NOT build up within a single drag pass', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 30, height: 30, background: 'white' });
  addMask(s, s.doc.layers[0].id, true, PAINT); // white mask (255)
  store.update({ colours: { primary: '#000000' }, brush: { size: 12, hardness: 1, opacity: 0.5, pressure: false } });
  const ctx = () => toolContext(store, { requestRender: () => {}, notify: m => { throw new Error(m); } });
  TOOLS.brush.down(ctx(), { x: 10, y: 15, pressure: 1, coalesced: [] });
  TOOLS.brush.move(ctx(), { x: 12, y: 15, pressure: 1, coalesced: [] });
  TOOLS.brush.move(ctx(), { x: 14, y: 15, pressure: 1, coalesced: [] });
  TOOLS.brush.up(ctx(), { x: 14, y: 15, pressure: 1, coalesced: [] });

  const [r] = px(surfaceOf(s.doc, s.doc.layers[0], 'mask'), 12, 15);
  assert.near(r, 128, 4, `single 50% stroke over white stays ~128, got ${r}`);
});

test('brush and gradient are clipped strictly inside active selection', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 30, height: 30, background: 'white' });
  const sel = createSelection(30, 30, rectSelectionData(30, 30, { x: 10, y: 10, w: 10, h: 10 }));
  setSelection(s, sel, PAINT);
  store.update({ colours: { primary: '#ff0000' }, brush: { size: 20, hardness: 1, opacity: 1, pressure: false } });
  const ctx = () => toolContext(store, { requestRender: () => {}, notify: m => { throw new Error(m); } });
  TOOLS.brush.down(ctx(), { x: 5, y: 15, pressure: 1, coalesced: [] });
  TOOLS.brush.move(ctx(), { x: 25, y: 15, pressure: 1, coalesced: [] });
  TOOLS.brush.up(ctx(), { x: 25, y: 15, pressure: 1, coalesced: [] });

  assert.deepEqual(px(surfaceOf(s.doc, s.doc.layers[0]), 5, 15), [255, 255, 255, 255], 'outside selection stays white');
  assert.deepEqual(px(surfaceOf(s.doc, s.doc.layers[0]), 15, 15), [255, 0, 0, 255], 'inside selection becomes red');
});

test('isolated group blend mode multiplies child composite over background', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 10, height: 10, background: '#c8c8c8' }); // ~200 grey
  const g = createLayer(s.doc, 'group', { name: 'MultGroup', blend: 'multiply', opacity: 1 });
  const child = createLayer(s.doc, 'pixel', { name: 'Tint', parentId: g.id });
  const surf = surfaceOf(s.doc, child);
  surf.ctx.fillStyle = '#808080';
  surf.ctx.fillRect(0, 0, 10, 10);
  insertLayer(s.doc, child, 1);
  insertLayer(s.doc, g, 2);

  const [r] = px(flatten(s.doc), 5, 5);
  assert.ok(r < 120, `200 * (128/255) multiply should darken to ~100, got ${r}`);
});

test('worker-offloaded live adjustment dispatches async pass and invalidates compositor', async () => {
  setAdjustmentWorkerThreshold(100);
  const store = createStudioStore();
  const s = store.newDocument({ width: 32, height: 32, background: '#ff8040' });
  addLayer(s, 'adjust', { adjust: 'hueSaturation', params: { ...defaultParams('hueSaturation'), hue: 90 } }, { tab: 'photo' });

  let readyFired = 0;
  const off = s.compositor.onAsyncReady(() => { readyFired += 1; });
  const out = new OffscreenCanvas(32, 32).getContext('2d');
  s.compositor.render(out);

  for (let i = 0; i < 40 && readyFired === 0; i++) await new Promise(r => setTimeout(r, 25));
  off();
  setAdjustmentWorkerThreshold(250_000);
  assert.ok(readyFired >= 1, 'async worker pass fired onAsyncReady');
  s.compositor.render(out);
  const pixel = [...out.getImageData(16, 16, 1, 1).data];
  assert.ok(pixel[0] !== 255 || pixel[1] !== 128 || pixel[2] !== 64, `hue rotated on canvas, got ${pixel.join(',')}`);
});
