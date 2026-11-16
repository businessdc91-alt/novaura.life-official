// Layer masks: adding, removing, inverting, applying, and growing like a layer.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { createDocument, surfaceOf } from '../../src/creative/document.js';
import { createHistory } from '../../src/creative/history.js';
import { addMask, deleteMask, invertMask, applyMask, setMaskEnabled, setLayerProps } from '../../src/creative/edits.js';
import { beginStroke } from '../../src/creative/stroke.js';
import { greyOf, maskColour } from '../../src/creative/masks.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const PAINT = { tab: 'paint' };
const session = () => ({ doc: createDocument({ width: 20, height: 10 }), history: createHistory() });
const px = (s, x, y) => [...s.read(x, y, 1, 1).data];
const solid = (w, h, rgba) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: w, height: h, data };
};

test('greyOf(#ffffff) === 255 and greyOf(#ff0000) === 76', () => {
  assert.equal(greyOf('#ffffff'), 255);
  assert.equal(greyOf('#ff0000'), 76);
  assert.equal(greyOf('#000000'), 0);
  assert.equal(maskColour('#ff0000'), '#4c4c4c');
});

test('addMask: reveal all is white, hide all is black, and the mask becomes the target', () => {
  const s = session();
  const layer = s.doc.layers[0];
  assert.equal(addMask(s, layer.id, true, PAINT).ok, true);
  assert.deepEqual(layer.mask, { x: 0, y: 0, width: 20, height: 10, bufferId: layer.mask.bufferId, defaultValue: 255, enabled: true });
  assert.deepEqual(px(surfaceOf(s.doc, layer, 'mask'), 3, 3), [255, 255, 255, 255]);
  assert.equal(s.doc.activeTarget, 'mask');
  assert.deepEqual(addMask(s, layer.id, false, PAINT), { ok: false, reason: 'This layer already has a mask.' });

  const t = session();
  addMask(t, t.doc.layers[0].id, false, PAINT);
  assert.equal(t.doc.layers[0].mask.defaultValue, 0);
  assert.deepEqual(px(surfaceOf(t.doc, t.doc.layers[0], 'mask'), 3, 3), [0, 0, 0, 255]);
});

test('addMask on a locked layer refuses', () => {
  const s = session();
  const layer = s.doc.layers[0];
  setLayerProps(s, layer.id, { locked: true }, PAINT);
  assert.deepEqual(addMask(s, layer.id, true, PAINT), { ok: false, reason: '"Background" is locked.' });
});

test('addMask then undo removes it', () => {
  const s = session();
  const layer = s.doc.layers[0];
  addMask(s, layer.id, true, PAINT);
  const bufferId = layer.mask.bufferId;
  s.history.undo();
  assert.equal(layer.mask, null);
  assert.equal(s.doc.buffers.has(bufferId), false);
  assert.equal(s.doc.activeTarget, 'layer');
  s.history.redo();
  assert.equal(layer.mask.bufferId, bufferId);
  assert.equal(s.doc.buffers.has(bufferId), true);
});

test('deleteMask and undo', () => {
  const s = session();
  const layer = s.doc.layers[0];
  addMask(s, layer.id, true, PAINT);
  assert.equal(deleteMask(s, layer.id, PAINT).ok, true);
  assert.equal(layer.mask, null);
  assert.equal(s.doc.activeTarget, 'layer');
  s.history.undo();
  assert.ok(layer.mask);
});

test('setMaskEnabled turns the mask off and on', () => {
  const s = session();
  const layer = s.doc.layers[0];
  addMask(s, layer.id, true, PAINT);
  setMaskEnabled(s, layer.id, false, PAINT);
  assert.equal(layer.mask.enabled, false);
  s.history.undo();
  assert.equal(layer.mask.enabled, true);
});

test('invertMask twice restores the pixels', () => {
  const s = session();
  const layer = s.doc.layers[0];
  addMask(s, layer.id, true, PAINT);
  const m = surfaceOf(s.doc, layer, 'mask');
  m.write(0, 0, solid(5, 5, [40, 40, 40, 255]));
  invertMask(s, layer.id, PAINT);
  assert.deepEqual(px(m, 1, 1), [215, 215, 215, 255]);
  assert.deepEqual(px(m, 10, 5), [0, 0, 0, 255]);
  assert.equal(layer.mask.defaultValue, 0);
  invertMask(s, layer.id, PAINT);
  assert.deepEqual(px(m, 1, 1), [40, 40, 40, 255]);
  assert.equal(layer.mask.defaultValue, 255);
  s.history.undo();
  s.history.undo();
  assert.deepEqual(px(surfaceOf(s.doc, layer, 'mask'), 1, 1), [40, 40, 40, 255]);
  assert.equal(layer.mask.defaultValue, 255);
});

test('applyMask multiplies alpha', () => {
  const s = session();
  const layer = s.doc.layers[0];
  addMask(s, layer.id, true, PAINT);
  surfaceOf(s.doc, layer, 'mask').write(0, 0, solid(20, 10, [128, 128, 128, 255]));
  assert.equal(applyMask(s, layer.id, PAINT).ok, true);
  assert.equal(layer.mask, null);
  const a = px(surfaceOf(s.doc, layer), 4, 4)[3];
  assert.ok(Math.abs(a - 128) <= 1, `alpha ${a}`);
  s.history.undo();
  assert.ok(layer.mask);
  assert.equal(px(surfaceOf(s.doc, layer), 4, 4)[3], 255);
});

test('applyMask is for pixel layers only', async () => {
  const s = session();
  const { addLayer } = await import('../../src/creative/edits.js');
  const { layer } = addLayer(s, 'shape', { shape: 'rect', x: 0, y: 0, w: 5, h: 5 }, PAINT);
  addMask(s, layer.id, true, PAINT);
  assert.deepEqual(applyMask(s, layer.id, PAINT), { ok: false, reason: 'Only pixel layers can have their mask applied.' });
});

test('a mask grows like a layer when painted outside its bounds', () => {
  const s = session();
  const layer = s.doc.layers[0];
  addMask(s, layer.id, false, PAINT);
  // Make it a small mask, as an opened PSD can have.
  const small = new ArraySurface(4, 4);
  small.write(0, 0, solid(4, 4, [255, 255, 255, 255]));
  s.doc.buffers.set(layer.mask.bufferId, small);
  Object.assign(layer.mask, { x: 8, y: 3, width: 4, height: 4, defaultValue: 0 });
  const { stroke } = beginStroke(s, { layerId: layer.id, part: 'mask' }, { tab: 'paint', label: 'Brush stroke' });
  stroke.ensureCovers({ x: 0, y: 0, w: 2, h: 2 });
  stroke.touch({ x: 0, y: 0, w: 2, h: 2 });
  stroke.surface.write(0, 0, solid(2, 2, [255, 255, 255, 255]));
  stroke.end();
  const m = surfaceOf(s.doc, layer, 'mask');
  assert.deepEqual([layer.mask.x, layer.mask.y, m.width, m.height], [0, 0, 20, 10]);
  assert.deepEqual(px(m, 9, 4), [255, 255, 255, 255], 'old mask content kept');
  assert.deepEqual(px(m, 15, 8), [0, 0, 0, 255], 'new area takes the default');
  s.history.undo();
  assert.equal(surfaceOf(s.doc, layer, 'mask').width, 4);
});
