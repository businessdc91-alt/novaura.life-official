// The document model: backgrounds, layer defaults, the lock rules, and low-level changes.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import {
  createDocument, createLayer, getLayer, layerIndex, surfaceOf, canEdit, touchLayer,
  insertLayer, removeLayerAt, moveLayer, assignLayer, cloneLayer, takeBuffers, putBuffers,
} from '../../src/creative/document.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const pixel = (doc, layer, x = 0, y = 0) => [...surfaceOf(doc, layer).read(x, y, 1, 1).data];

test('createDocument: white, transparent and custom-colour backgrounds', () => {
  const white = createDocument({ width: 8, height: 6 });
  assert.equal(white.layers.length, 1);
  assert.equal(white.layers[0].name, 'Background');
  assert.deepEqual(pixel(white, white.layers[0], 7, 5), [255, 255, 255, 255]);
  assert.equal(white.activeLayerId, white.layers[0].id);
  assert.equal(white.activeTarget, 'layer');
  assert.equal(white.name, 'Untitled');

  const clear = createDocument({ name: 'Logo', width: 4, height: 4, background: 'transparent' });
  assert.equal(clear.layers[0].name, 'Layer 1');
  assert.deepEqual(pixel(clear, clear.layers[0]), [0, 0, 0, 0]);
  assert.equal(clear.name, 'Logo');

  const tinted = createDocument({ width: 2, height: 2, background: '#102030' });
  assert.deepEqual(pixel(tinted, tinted.layers[0], 1, 1), [16, 32, 48, 255]);
  const black = createDocument({ width: 2, height: 2, background: 'black' });
  assert.deepEqual(pixel(black, black.layers[0]), [0, 0, 0, 255]);
});

test('createDocument rejects sizes outside 1–16384', () => {
  assert.throws(() => createDocument({ width: 0, height: 10 }), RangeError);
  assert.throws(() => createDocument({ width: 16385, height: 10 }), RangeError);
});

test('createLayer defaults', () => {
  const doc = createDocument({ width: 10, height: 5 });
  const p = createLayer(doc, 'pixel');
  assert.equal(p.kind, 'pixel');
  assert.equal(p.visible, true);
  assert.equal(p.opacity, 1);
  assert.equal(p.blend, 'source-over');
  assert.equal(p.locked, false);
  assert.equal(p.mask, null);
  assert.equal(p.psdBlend, null);
  assert.equal(p.role, null);
  assert.deepEqual([p.x, p.y, p.width, p.height], [0, 0, 10, 5]);
  assert.ok(doc.buffers.get(p.bufferId) instanceof ArraySurface);
  assert.match(p.id, /^[0-9a-f-]{36}$/);
  assert.equal(p.name, 'Layer 1');
  assert.equal(createLayer(doc, 'pixel').name, 'Layer 2');

  assert.equal(createLayer(doc, 'shape', { shape: 'rect' }).name, 'Rectangle');
  assert.equal(createLayer(doc, 'shape', { shape: 'star' }).name, 'Star');
  assert.equal(createLayer(doc, 'text', { text: 'Hello there' }).name, 'Hello there');
  assert.equal(createLayer(doc, 'adjust', { adjust: 'levels' }).name, 'levels');
  assert.equal(createLayer(doc, 'pixel', { name: 'Sky' }).name, 'Sky');
});

test('createLayer adopts a given surface and its size', () => {
  const doc = createDocument({ width: 10, height: 10 });
  const surface = new ArraySurface(3, 2);
  const p = createLayer(doc, 'pixel', { surface, x: 4, y: 5 });
  assert.deepEqual([p.x, p.y, p.width, p.height], [4, 5, 3, 2]);
  assert.equal(doc.buffers.get(p.bufferId), surface);
  assert.equal('surface' in p, false);
});

test('lock rules: a locked layer allows visibility, unlock, rename and reorder only', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const layer = createLayer(doc, 'pixel', { name: 'Sky', locked: true });
  for (const action of ['visibility', 'unlock', 'rename', 'reorder']) assert.deepEqual(canEdit(layer, action), { ok: true }, action);
  for (const action of ['paint', 'move', 'edit', 'mask', 'delete']) {
    assert.deepEqual(canEdit(layer, action), { ok: false, reason: '"Sky" is locked.' }, action);
  }
  const open = createLayer(doc, 'pixel');
  for (const action of ['paint', 'move', 'edit', 'mask', 'delete']) assert.deepEqual(canEdit(open, action), { ok: true }, action);
});

test('only pixel layers can be painted on', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const shape = createLayer(doc, 'shape', { shape: 'ellipse' });
  assert.deepEqual(canEdit(shape, 'paint'), {
    ok: false, reason: 'Only pixel layers can be painted on. Paint its mask, or add a pixel layer.',
  });
});

test('insert, move, remove and lookups bump the version and touch layers', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const v0 = doc.version;
  const a = createLayer(doc, 'pixel', { name: 'A' });
  insertLayer(doc, a, 1);
  assert.equal(layerIndex(doc, a.id), 1);
  assert.equal(getLayer(doc, a.id), a);
  assert.ok(doc.version > v0);
  assert.equal(a.rev, doc.version);
  moveLayer(doc, 1, 0);
  assert.equal(doc.layers[0], a);
  assert.equal(removeLayerAt(doc, 0), a);
  assert.equal(getLayer(doc, a.id), undefined);
  assert.equal(layerIndex(doc, a.id), -1);
});

test('assignLayer returns the previous values and bumps the version', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const layer = doc.layers[0];
  const v = doc.version;
  const previous = assignLayer(doc, layer.id, { opacity: 0.5, name: 'Base' });
  assert.deepEqual(previous, { opacity: 1, name: 'Background' });
  assert.equal(layer.opacity, 0.5);
  assert.equal(doc.version, v + 1);
  assert.equal(layer.rev, doc.version);
});

test('touchLayer sets rev to the new version', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const layer = doc.layers[0];
  touchLayer(doc, layer);
  assert.equal(layer.rev, doc.version);
});

test('cloneLayer gives a new id and separate buffers, mask included', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const src = doc.layers[0];
  const maskSurface = new ArraySurface(4, 4);
  doc.buffers.set('m1', maskSurface);
  src.mask = { x: 0, y: 0, width: 4, height: 4, bufferId: 'm1', defaultValue: 255, enabled: true };
  const copy = cloneLayer(doc, src);
  assert.notEqual(copy.id, src.id);
  assert.notEqual(copy.bufferId, src.bufferId);
  assert.notEqual(copy.mask.bufferId, 'm1');
  surfaceOf(doc, copy).clear();
  assert.deepEqual(pixel(doc, src), [255, 255, 255, 255]);
  assert.ok(surfaceOf(doc, copy, 'mask') instanceof ArraySurface);
  assert.notEqual(surfaceOf(doc, copy, 'mask'), maskSurface);

  const other = createDocument({ width: 4, height: 4 });
  const moved = cloneLayer(doc, src, other);
  assert.ok(other.buffers.has(moved.bufferId));
  assert.equal(doc.buffers.has(moved.bufferId), false);
});

test('takeBuffers and putBuffers move a layer\'s buffers out and back', () => {
  const doc = createDocument({ width: 4, height: 4 });
  const layer = doc.layers[0];
  const taken = takeBuffers(doc, layer);
  assert.equal(doc.buffers.has(layer.bufferId), false);
  putBuffers(doc, taken);
  assert.equal(doc.buffers.has(layer.bufferId), true);
});
