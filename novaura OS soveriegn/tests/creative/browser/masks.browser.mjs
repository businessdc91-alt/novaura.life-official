// Masks on a real canvas: hiding and showing, defaults outside the mask, turning off, and painting greys.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { addLayer, addMask, setMaskEnabled } from '../../../src/creative/edits.js';
import { flatten } from '../../../src/creative/compositor.js';
import { TOOLS, toolContext } from '../../../src/creative/tools/index.js';
import '../../../src/creative/masks.js';
import '../../../src/creative/tools/gradient.js';

setSurfaceFactory(null);

const PAINT = { tab: 'paint' };
const px = (s, x, y) => [...s.read(x, y, 1, 1).data];

// A white background with a red layer above it.
function setup() {
  const store = createStudioStore();
  const session = store.newDocument({ width: 40, height: 20, background: 'white' });
  const { layer } = addLayer(session, 'pixel', { name: 'Red' }, PAINT);
  const s = surfaceOf(session.doc, layer);
  s.ctx.fillStyle = '#ff0000';
  s.ctx.fillRect(0, 0, 40, 20);
  const ctx = () => toolContext(store, { requestRender: () => {}, notify: m => { throw new Error(m); } });
  return { store, session, layer, ctx };
}

test('a hide-all mask hides the layer; a reveal-all mask shows it', () => {
  const hide = setup();
  addMask(hide.session, hide.layer.id, false, PAINT);
  assert.deepEqual(px(flatten(hide.session.doc), 5, 5), [255, 255, 255, 255]);
  const show = setup();
  addMask(show.session, show.layer.id, true, PAINT);
  assert.deepEqual(px(flatten(show.session.doc), 5, 5), [255, 0, 0, 255]);
});

test('a grey mask partly shows the layer', () => {
  const { session, layer } = setup();
  addMask(session, layer.id, true, PAINT);
  const m = surfaceOf(session.doc, layer, 'mask');
  m.ctx.fillStyle = 'rgb(128, 128, 128)';
  m.ctx.fillRect(0, 0, 40, 20);
  layer.rev = ++session.doc.version;
  const p = px(flatten(session.doc), 5, 5);
  assert.near(p[1], 127, 2, 'half red over white');
});

test('outside the mask rect, defaultValue applies', () => {
  const { session, layer } = setup();
  addMask(session, layer.id, true, PAINT);
  const m = surfaceOf(session.doc, layer, 'mask');
  const small = new OffscreenCanvas(10, 10);
  const sctx = small.getContext('2d');
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, 10, 10);
  m.resizeCanvas(10, 10, 0, 0);
  m.ctx.drawImage(small, 0, 0);
  Object.assign(layer.mask, { x: 0, y: 0, width: 10, height: 10, defaultValue: 0 });
  layer.rev = ++session.doc.version;
  const flat = flatten(session.doc);
  assert.deepEqual(px(flat, 5, 5), [255, 0, 0, 255], 'inside the mask: shown');
  assert.deepEqual(px(flat, 30, 5), [255, 255, 255, 255], 'outside, default 0: hidden');
  layer.mask.defaultValue = 255;
  layer.rev = ++session.doc.version;
  assert.deepEqual(px(flatten(session.doc), 30, 5), [255, 0, 0, 255], 'outside, default 255: shown');
});

test('a disabled mask is ignored', () => {
  const { session, layer } = setup();
  addMask(session, layer.id, false, PAINT);
  setMaskEnabled(session, layer.id, false, PAINT);
  assert.deepEqual(px(flatten(session.doc), 5, 5), [255, 0, 0, 255]);
});

test('brush on the mask target paints grey', () => {
  const { store, session, layer, ctx } = setup();
  addMask(session, layer.id, false, PAINT);
  store.update({ colours: { primary: '#ff0000' }, brush: { size: 6, hardness: 1, opacity: 1, pressure: false } });
  TOOLS.brush.down(ctx(), { x: 20, y: 10, pressure: 1, coalesced: [] });
  TOOLS.brush.up(ctx(), { x: 20, y: 10, pressure: 1, coalesced: [] });
  assert.deepEqual(px(surfaceOf(session.doc, layer, 'mask'), 20, 10), [76, 76, 76, 255]);
  assert.deepEqual(px(surfaceOf(session.doc, layer), 20, 10), [255, 0, 0, 255], 'the layer itself is untouched');
  assert.equal(session.history.steps.at(-1).label, 'Brush stroke');
});

test('the eraser on the mask target paints black', () => {
  const { store, session, layer, ctx } = setup();
  addMask(session, layer.id, true, PAINT);
  store.update({ brush: { size: 6, hardness: 1, opacity: 1, pressure: false } });
  TOOLS.eraser.down(ctx(), { x: 20, y: 10, pressure: 1, coalesced: [] });
  TOOLS.eraser.up(ctx(), { x: 20, y: 10, pressure: 1, coalesced: [] });
  assert.deepEqual(px(surfaceOf(session.doc, layer, 'mask'), 20, 10), [0, 0, 0, 255]);
  assert.deepEqual(px(flatten(session.doc), 20, 10), [255, 255, 255, 255], 'the erased area of the mask hides the layer');
});

test('fill and gradient on a mask paint greys', () => {
  const { store, session, layer, ctx } = setup();
  addMask(session, layer.id, false, PAINT);
  store.update({ colours: { primary: '#ffffff', secondary: '#000000' } });
  TOOLS.fill.down(ctx(), { x: 3, y: 3, pressure: 1, coalesced: [] });
  assert.deepEqual(px(surfaceOf(session.doc, layer, 'mask'), 30, 10), [255, 255, 255, 255]);
  store.update({ colours: { primary: '#ff0000', secondary: '#000000' }, gradient: { type: 'linear', mode: 'toSecondary' } });
  TOOLS.gradient.down(ctx(), { x: 0, y: 10, pressure: 1, coalesced: [] });
  TOOLS.gradient.up(ctx(), { x: 39, y: 10, pressure: 1, coalesced: [] });
  const left = px(surfaceOf(session.doc, layer, 'mask'), 0, 10);
  assert.ok(left[0] === left[1] && left[1] === left[2], `grey, not red (${left})`);
  assert.near(left[0], 76, 3, 'red paints as its grey');
});
