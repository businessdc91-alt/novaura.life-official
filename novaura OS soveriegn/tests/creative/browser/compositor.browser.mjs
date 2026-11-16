// The compositor in a real canvas: opacity, blend modes, offsets, dirty areas, live strokes and caches.
import { test, assert } from './harness.js';
import { setSurfaceFactory, createSurface } from '../../../src/creative/surface.js';
import { createDocument, createLayer, insertLayer, surfaceOf } from '../../../src/creative/document.js';
import { createHistory } from '../../../src/creative/history.js';
import { mergeDown } from '../../../src/creative/edits.js';
import { createCompositor, composeLayers, flatten, compositeBelow } from '../../../src/creative/compositor.js';

setSurfaceFactory(null);

function fill(surface, colour, x = 0, y = 0, w = surface.width, h = surface.height) {
  surface.ctx.fillStyle = colour;
  surface.ctx.fillRect(x, y, w, h);
}

function layerOf(doc, name, colour, props = {}, size = null) {
  const surface = size ? createSurface(size[0], size[1]) : createSurface(doc.width, doc.height);
  if (colour) fill(surface, colour);
  const layer = createLayer(doc, 'pixel', { name, surface, ...props });
  insertLayer(doc, layer, doc.layers.length);
  return layer;
}

function target(w, h, colour = null) {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (colour) { ctx.fillStyle = colour; ctx.fillRect(0, 0, w, h); }
  return ctx;
}

const at = (ctx, x, y) => [...ctx.getImageData(x, y, 1, 1).data];
const near = (actual, expected, tol, msg) => expected.forEach((v, i) => assert.near(actual[i], v, tol, `${msg} channel ${i}`));

test('normal at 50% over white', () => {
  const doc = createDocument({ width: 4, height: 4 });
  layerOf(doc, 'Red', '#ff0000', { opacity: 0.5 });
  const ctx = target(4, 4);
  createCompositor(doc).render(ctx);
  near(at(ctx, 1, 1), [255, 128, 128, 255], 1, 'pixel');
});

test('multiply', () => {
  const doc = createDocument({ width: 4, height: 4, background: '#ff0000' });
  layerOf(doc, 'Grey', '#808080', { blend: 'multiply' });
  const ctx = target(4, 4);
  createCompositor(doc).render(ctx);
  near(at(ctx, 2, 2), [128, 0, 0, 255], 1, 'pixel');
});

test('hidden layers are skipped', () => {
  const doc = createDocument({ width: 4, height: 4 });
  layerOf(doc, 'Red', '#ff0000', { visible: false });
  const ctx = target(4, 4);
  createCompositor(doc).render(ctx);
  assert.deepEqual(at(ctx, 0, 0), [255, 255, 255, 255]);
});

test('pixel layer offset x,y is respected', () => {
  const doc = createDocument({ width: 10, height: 10 });
  layerOf(doc, 'Dot', '#0000ff', { x: 6, y: 7 }, [2, 2]);
  const ctx = target(10, 10);
  createCompositor(doc).render(ctx);
  assert.deepEqual(at(ctx, 6, 7), [0, 0, 255, 255]);
  assert.deepEqual(at(ctx, 7, 8), [0, 0, 255, 255]);
  assert.deepEqual(at(ctx, 5, 7), [255, 255, 255, 255]);
});

test('render(rect) only changes pixels inside rect', () => {
  const doc = createDocument({ width: 10, height: 10, background: '#ff0000' });
  const ctx = target(10, 10, '#0000ff');
  createCompositor(doc).render(ctx, { x: 2, y: 2, w: 3, h: 3 });
  assert.deepEqual(at(ctx, 3, 3), [255, 0, 0, 255]);
  assert.deepEqual(at(ctx, 0, 0), [0, 0, 255, 255]);
  assert.deepEqual(at(ctx, 6, 6), [0, 0, 255, 255]);
});

test('live stroke shows on its layer with stroke opacity, and erase cuts through', () => {
  const doc = createDocument({ width: 8, height: 8 });
  const top = layerOf(doc, 'Top', null);
  const stroke = createSurface(8, 8);
  fill(stroke, '#000000', 0, 0, 4, 8);
  const comp = createCompositor(doc);
  comp.setFocusLayer(top.id);
  comp.setLiveStroke({ layerId: top.id, part: 'layer', surface: stroke, origin: { x: 0, y: 0 }, opacity: 0.5, erase: false });
  const ctx = target(8, 8);
  comp.render(ctx);
  near(at(ctx, 1, 1), [128, 128, 128, 255], 1, 'half-strength stroke');
  assert.deepEqual(at(ctx, 6, 1), [255, 255, 255, 255]);

  fill(surfaceOf(doc, top), '#00ff00');
  comp.invalidate();
  comp.setLiveStroke({ layerId: top.id, part: 'layer', surface: stroke, origin: { x: 0, y: 0 }, opacity: 1, erase: true });
  comp.render(ctx);
  assert.deepEqual(at(ctx, 1, 1), [255, 255, 255, 255], 'erased down to the white background');
  assert.deepEqual(at(ctx, 6, 1), [0, 255, 0, 255]);
  comp.setLiveStroke(null);
  comp.render(ctx);
  assert.deepEqual(at(ctx, 1, 1), [0, 255, 0, 255], 'without the live stroke the layer is whole');
});

test('below-cache: after setFocusLayer(top), changing a lower layer and calling invalidate() still shows the change', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const lower = layerOf(doc, 'Lower', '#ff0000');
  const top = layerOf(doc, 'Top', null);
  const comp = createCompositor(doc);
  comp.setFocusLayer(top.id);
  const ctx = target(4, 4);
  comp.render(ctx);
  assert.deepEqual(at(ctx, 0, 0), [255, 0, 0, 255]);
  fill(surfaceOf(doc, lower), '#0000ff');
  comp.invalidate();
  comp.render(ctx);
  assert.deepEqual(at(ctx, 0, 0), [0, 0, 255, 255]);
});

test('a change to a lower layer\'s fields refreshes the cache through rev', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const lower = layerOf(doc, 'Lower', '#ff0000');
  const top = layerOf(doc, 'Top', null);
  const comp = createCompositor(doc);
  comp.setFocusLayer(top.id);
  const ctx = target(4, 4);
  comp.render(ctx);
  lower.visible = false;
  lower.rev = ++doc.version;
  comp.render(ctx);
  assert.deepEqual(at(ctx, 0, 0), [255, 255, 255, 255]);
});

test('composeLayers of a subset ignores other layers', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const red = layerOf(doc, 'Red', '#ff0000', { opacity: 0.5 });
  layerOf(doc, 'Blue', '#0000ff');
  const s = composeLayers(doc, [red]);
  near([...s.read(0, 0, 1, 1).data], [255, 0, 0, 128], 1, 'red alone at half alpha');
  const region = composeLayers(doc, [red], { x: 2, y: 2, width: 2, height: 2 });
  assert.equal(region.width, 2);
  assert.deepEqual([...flatten(doc).read(0, 0, 1, 1).data], [0, 0, 255, 255]);
  near([...compositeBelow(doc, doc.layers[2].id).read(0, 0, 1, 1).data], [255, 128, 128, 255], 1, 'below Blue');
});

test('mergeDown gives one pixel layer that looks the same, and undo restores both', async () => {
  const doc = createDocument({ width: 4, height: 4, background: '#ff0000' });
  layerOf(doc, 'Grey', '#808080', { blend: 'multiply' });
  const s = { doc, history: createHistory() };
  const before = [...flatten(doc).read(1, 1, 1, 1).data];
  const r = await mergeDown(s, doc.layers[1].id, { tab: 'paint' });
  assert.equal(r.ok, true);
  assert.equal(doc.layers.length, 1);
  assert.equal(doc.layers[0].name, 'Background');
  assert.deepEqual([...flatten(doc).read(1, 1, 1, 1).data], before);
  s.history.undo();
  assert.deepEqual(doc.layers.map(l => l.name), ['Background', 'Grey']);
  assert.deepEqual([...flatten(doc).read(1, 1, 1, 1).data], before);
});
