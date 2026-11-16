// Undoable edits and strokes: every change is one history step that undoes and redoes cleanly.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { createDocument, createLayer, insertLayer, getLayer, surfaceOf } from '../../src/creative/document.js';
import { createHistory } from '../../src/creative/history.js';
import {
  addLayer, deleteLayer, moveLayerTo, setLayerProps, duplicateLayer, setActiveLayer,
} from '../../src/creative/edits.js';
import { beginStroke } from '../../src/creative/stroke.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const PAINT = { tab: 'paint' };
const session = (w = 20, h = 20) => ({ doc: createDocument({ width: w, height: h }), history: createHistory() });
const names = doc => doc.layers.map(l => l.name);
const px = (surface, x, y) => [...surface.read(x, y, 1, 1).data];
const solid = (w, h, rgba) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: w, height: h, data };
};
const RED = [255, 0, 0, 255];

test('addLayer inserts above active and becomes active', () => {
  const s = session();
  const r = addLayer(s, 'pixel', { name: 'A' }, PAINT);
  assert.equal(r.ok, true);
  assert.deepEqual(names(s.doc), ['Background', 'A']);
  assert.equal(s.doc.activeLayerId, r.layer.id);
  setActiveLayer(s, s.doc.layers[0].id);
  addLayer(s, 'pixel', { name: 'B' }, PAINT);
  assert.deepEqual(names(s.doc), ['Background', 'B', 'A']);
  assert.equal(s.history.steps.length, 2);
  s.history.undo();
  assert.deepEqual(names(s.doc), ['Background', 'A']);
  assert.equal(s.doc.activeLayerId, s.doc.layers[0].id);
  s.history.undo();
  assert.deepEqual(names(s.doc), ['Background']);
  assert.equal(s.doc.buffers.has(r.layer.bufferId), false);
  s.history.redo();
  assert.deepEqual(names(s.doc), ['Background', 'A']);
  assert.equal(s.doc.buffers.has(r.layer.bufferId), true);
});

test('setLayerProps on a locked layer refuses edit but allows visible/name/locked', () => {
  const s = session();
  const layer = s.doc.layers[0];
  setLayerProps(s, layer.id, { locked: true }, PAINT);
  assert.deepEqual(setLayerProps(s, layer.id, { opacity: 0.3 }, PAINT), { ok: false, reason: '"Background" is locked.' });
  assert.deepEqual(setLayerProps(s, layer.id, { x: 5 }, PAINT), { ok: false, reason: '"Background" is locked.' });
  assert.equal(layer.opacity, 1);
  assert.equal(setLayerProps(s, layer.id, { visible: false }, PAINT).ok, true);
  assert.equal(setLayerProps(s, layer.id, { name: 'Base' }, PAINT).ok, true);
  assert.equal(setLayerProps(s, layer.id, { locked: false }, PAINT).ok, true);
  assert.equal(setLayerProps(s, layer.id, { opacity: 0.3 }, PAINT).ok, true);
  assert.equal(s.history.steps.length, 5);
  s.history.undo();
  assert.equal(layer.opacity, 1);
  s.history.redo();
  assert.equal(layer.opacity, 0.3);
});

test('opacity drag merges into one step via mergeKey', () => {
  const s = session();
  const layer = s.doc.layers[0];
  for (const v of [0.9, 0.7, 0.4]) setLayerProps(s, layer.id, { opacity: v }, { tab: 'paint', mergeKey: `opacity:${layer.id}:d1` });
  assert.equal(s.history.steps.length, 1);
  assert.equal(s.history.steps[0].label, 'Opacity');
  s.history.undo();
  assert.equal(layer.opacity, 1);
  s.history.redo();
  assert.equal(layer.opacity, 0.4);
});

test('setLayerProps with unchanged values adds no step', () => {
  const s = session();
  assert.equal(setLayerProps(s, s.doc.layers[0].id, { opacity: 1 }, PAINT).ok, true);
  assert.equal(s.history.steps.length, 0);
});

test('deleteLayer refuses the last layer, and undo brings a deleted layer back with its pixels', () => {
  const s = session();
  const only = s.doc.layers[0];
  assert.deepEqual(deleteLayer(s, only.id, PAINT), { ok: false, reason: 'A document needs at least one layer.' });
  const { layer } = addLayer(s, 'pixel', { name: 'A' }, PAINT);
  surfaceOf(s.doc, layer).write(0, 0, solid(1, 1, RED));
  assert.equal(deleteLayer(s, layer.id, PAINT).ok, true);
  assert.deepEqual(names(s.doc), ['Background']);
  assert.equal(s.doc.activeLayerId, only.id);
  assert.equal(s.doc.buffers.has(layer.bufferId), false);
  s.history.undo();
  assert.deepEqual(names(s.doc), ['Background', 'A']);
  assert.deepEqual(px(surfaceOf(s.doc, layer), 0, 0), RED);
  assert.equal(s.doc.activeLayerId, layer.id);
});

test('deleteLayer refuses a locked layer', () => {
  const s = session();
  const { layer } = addLayer(s, 'pixel', { name: 'Keep', locked: true }, PAINT);
  assert.deepEqual(deleteLayer(s, layer.id, PAINT), { ok: false, reason: '"Keep" is locked.' });
});

test('moveLayerTo reorders even when locked', () => {
  const s = session();
  addLayer(s, 'pixel', { name: 'A', locked: true }, PAINT);
  addLayer(s, 'pixel', { name: 'B' }, PAINT);
  const a = s.doc.layers[1];
  assert.equal(moveLayerTo(s, a.id, 2, PAINT).ok, true);
  assert.deepEqual(names(s.doc), ['Background', 'B', 'A']);
  s.history.undo();
  assert.deepEqual(names(s.doc), ['Background', 'A', 'B']);
});

test('duplicateLayer copies pixels into a separate buffer', () => {
  const s = session();
  const base = s.doc.layers[0];
  const r = duplicateLayer(s, base.id, PAINT);
  assert.equal(r.ok, true);
  assert.deepEqual(names(s.doc), ['Background', 'Background copy']);
  surfaceOf(s.doc, r.layer).write(0, 0, solid(1, 1, RED));
  assert.deepEqual(px(surfaceOf(s.doc, base), 0, 0), [255, 255, 255, 255]);
  s.history.undo();
  assert.deepEqual(names(s.doc), ['Background']);
});

test('stroke on a 10×10 layer at (50,50) that touches (0,0) grows the layer to the canvas, and one undo restores both size and pixels', () => {
  const s = { doc: createDocument({ width: 100, height: 100, background: 'transparent' }), history: createHistory() };
  const small = new ArraySurface(10, 10);
  small.write(0, 0, solid(10, 10, [0, 0, 255, 255]));
  const layer = createLayer(s.doc, 'pixel', { name: 'Small', surface: small, x: 50, y: 50 });
  insertLayer(s.doc, layer, 1);

  const begun = beginStroke(s, { layerId: layer.id }, { tab: 'paint', label: 'Brush stroke' });
  assert.equal(begun.ok, true);
  const { stroke } = begun;
  stroke.ensureCovers({ x: 0, y: 0, w: 4, h: 4 });
  assert.deepEqual(stroke.origin, { x: 0, y: 0 });
  stroke.touch({ x: 0, y: 0, w: 4, h: 4 });
  stroke.surface.write(0, 0, solid(4, 4, RED));
  const step = stroke.end();
  assert.equal(step.label, 'Brush stroke');
  assert.equal(step.tab, 'paint');
  assert.equal(s.history.steps.length, 1);
  assert.deepEqual([layer.x, layer.y, layer.width, layer.height], [0, 0, 100, 100]);
  assert.deepEqual(px(surfaceOf(s.doc, layer), 0, 0), RED);
  assert.deepEqual(px(surfaceOf(s.doc, layer), 55, 55), [0, 0, 255, 255]);

  s.history.undo();
  assert.deepEqual([layer.x, layer.y, layer.width, layer.height], [50, 50, 10, 10]);
  assert.equal(surfaceOf(s.doc, layer).width, 10);
  assert.deepEqual(px(surfaceOf(s.doc, layer), 5, 5), [0, 0, 255, 255]);

  s.history.redo();
  assert.deepEqual([layer.width, layer.height], [100, 100]);
  assert.deepEqual(px(surfaceOf(s.doc, layer), 0, 0), RED);
});

test('touches made before the layer grows still undo correctly', () => {
  const s = { doc: createDocument({ width: 40, height: 40, background: 'transparent' }), history: createHistory() };
  const small = new ArraySurface(10, 10);
  const layer = createLayer(s.doc, 'pixel', { surface: small, x: 20, y: 20 });
  insertLayer(s.doc, layer, 1);
  const { stroke } = beginStroke(s, { layerId: layer.id }, { tab: 'paint', label: 'Brush stroke' });
  stroke.touch({ x: 22, y: 22, w: 2, h: 2 });
  stroke.surface.write(2, 2, solid(2, 2, RED));
  stroke.ensureCovers({ x: 0, y: 0, w: 2, h: 2 });
  stroke.touch({ x: 0, y: 0, w: 2, h: 2 });
  stroke.surface.write(0, 0, solid(2, 2, RED));
  stroke.end();
  assert.deepEqual(px(surfaceOf(s.doc, layer), 22, 22), RED);
  assert.deepEqual(px(surfaceOf(s.doc, layer), 0, 0), RED);
  s.history.undo();
  assert.equal(surfaceOf(s.doc, layer).width, 10);
  assert.deepEqual(px(surfaceOf(s.doc, layer), 2, 2), [0, 0, 0, 0]);
});

test('stroke.cancel() restores pixels and pushes nothing', () => {
  const s = session();
  const base = s.doc.layers[0];
  const { stroke } = beginStroke(s, { layerId: base.id }, PAINT);
  stroke.touch({ x: 0, y: 0, w: 3, h: 3 });
  stroke.surface.write(0, 0, solid(3, 3, RED));
  stroke.cancel();
  assert.deepEqual(px(surfaceOf(s.doc, base), 1, 1), [255, 255, 255, 255]);
  assert.equal(s.history.steps.length, 0);
});

test('a stroke that changed nothing pushes nothing', () => {
  const s = session();
  const { stroke } = beginStroke(s, { layerId: s.doc.layers[0].id }, PAINT);
  stroke.touch({ x: 0, y: 0, w: 3, h: 3 });
  assert.equal(stroke.end(), null);
  assert.equal(s.history.steps.length, 0);
});

test('a stroke that grew the layer but drew nothing leaves the layer as it was', () => {
  const s = { doc: createDocument({ width: 40, height: 40, background: 'transparent' }), history: createHistory() };
  const layer = createLayer(s.doc, 'pixel', { surface: new ArraySurface(10, 10), x: 20, y: 20 });
  insertLayer(s.doc, layer, 1);
  const { stroke } = beginStroke(s, { layerId: layer.id }, PAINT);
  stroke.ensureCovers({ x: 0, y: 0, w: 2, h: 2 });
  assert.equal(stroke.end(), null);
  assert.equal(s.history.steps.length, 0);
  assert.deepEqual([layer.x, layer.y, layer.width, layer.height], [20, 20, 10, 10]);
});

test('beginStroke refuses a locked layer with its reason', () => {
  const s = session();
  const base = s.doc.layers[0];
  setLayerProps(s, base.id, { locked: true }, PAINT);
  assert.deepEqual(beginStroke(s, { layerId: base.id }, PAINT), { ok: false, reason: '"Background" is locked.' });
  assert.equal(getLayer(s.doc, base.id).locked, true);
});
