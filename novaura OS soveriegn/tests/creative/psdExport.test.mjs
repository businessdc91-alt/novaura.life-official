// Exporting PSD files: every layer property survives a round trip; adjustments go out live or baked.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { createDocument, createLayer, insertLayer, surfaceOf } from '../../src/creative/document.js';
import { createMask } from '../../src/creative/masks.js';
import { defaultParams } from '../../src/creative/adjustments.js';
import { readPsdFile, writePsdFile } from '../../src/creative/io/psd.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const solid = (w, h, rgba) => ({ width: w, height: h, data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => rgba[i % 4]) });

// Array stand-ins for the compositor (Node has no canvas). Only what these tests need.
const fakes = {
  rasterize: (doc, layer) => {
    const s = new ArraySurface(doc.width, doc.height);
    s.write(1, 1, solid(2, 2, [0, 0, 255, 255]));
    return { surface: s, x: 0, y: 0 };
  },
  flatten: doc => new ArraySurface(doc.width, doc.height),
  compositeBelow: doc => {
    const s = new ArraySurface(doc.width, doc.height);
    s.write(0, 0, solid(doc.width, doc.height, [100, 100, 100, 255]));
    return s;
  },
  adjustBelow: (doc, layer, below) => {
    const s = below.clone();
    s.write(0, 0, solid(doc.width, doc.height, [155, 155, 155, 255]));
    return s;
  },
};

function sampleDoc() {
  const doc = createDocument({ name: 'Out', width: 8, height: 6, background: '#102030' });
  const art = createLayer(doc, 'pixel', { name: 'Art', surface: new ArraySurface(3, 2), x: 2, y: 1, opacity: 0.6, blend: 'lighter', psdBlend: 'linear dodge', locked: true, visible: false });
  surfaceOf(doc, art).write(0, 0, solid(3, 2, [250, 10, 10, 255]));
  insertLayer(doc, art, 1);
  art.mask = createMask(doc, false);
  surfaceOf(doc, art, 'mask').write(2, 2, solid(2, 2, [200, 200, 200, 255]));
  art.mask.enabled = false;
  const shape = createLayer(doc, 'shape', { shape: 'rect', x: 1, y: 1, w: 2, h: 2, fill: '#0000ff', blend: 'screen' });
  insertLayer(doc, shape, 2);
  return doc;
}

test('round trip: writePsdFile → readPsdFile keeps every layer property, mask and psdBlend', () => {
  const doc = sampleDoc();
  const { doc: back, report } = readPsdFile(new Uint8Array(writePsdFile(doc, fakes)));
  assert.deepEqual(report, []);
  assert.deepEqual(back.layers.map(l => l.name), ['Background', 'Art', 'Rectangle']);
  const art = back.layers[1];
  assert.deepEqual([art.x, art.y, art.width, art.height, art.visible, art.locked, art.blend, art.psdBlend], [2, 1, 3, 2, false, true, 'lighter', 'linear dodge']);
  assert.ok(Math.abs(art.opacity - 0.6) < 0.005);
  assert.deepEqual([...surfaceOf(back, art).read(0, 0, 1, 1).data], [250, 10, 10, 255]);
  assert.deepEqual([art.mask.defaultValue, art.mask.enabled], [0, false]);
  assert.deepEqual([...surfaceOf(back, art, 'mask').read(art.mask.x === 0 ? 2 : 2 - art.mask.x, 2 - art.mask.y, 1, 1).data], [200, 200, 200, 255]);
  const rect = back.layers[2];
  assert.equal(rect.kind, 'pixel', 'shapes go out as pixels');
  assert.equal(rect.blend, 'screen');
  assert.deepEqual([...surfaceOf(back, rect).read(1 - rect.x, 1 - rect.y, 1, 1).data], [0, 0, 255, 255]);
});

test('a levels adjust layer round-trips live', () => {
  const doc = createDocument({ width: 4, height: 4 });
  insertLayer(doc, createLayer(doc, 'adjust', { name: 'Levels', adjust: 'levels', params: { ...defaultParams('levels'), inBlack: 30, gamma: 1.4 } }), 1);
  const { doc: back } = readPsdFile(new Uint8Array(writePsdFile(doc, fakes)));
  const l = back.layers.find(x => x.name === 'Levels');
  assert.equal(l.kind, 'adjust');
  assert.equal(l.params.inBlack, 30);
  assert.ok(Math.abs(l.params.gamma - 1.4) < 0.01);
});

test('exactLook bakes it to a pixel layer named "(baked)"', () => {
  const doc = createDocument({ width: 4, height: 4 });
  insertLayer(doc, createLayer(doc, 'adjust', { name: 'Levels', adjust: 'levels', params: defaultParams('levels'), opacity: 0.5 }), 1);
  const { doc: back } = readPsdFile(new Uint8Array(writePsdFile(doc, { ...fakes, exactLook: true })));
  const l = back.layers.find(x => x.name === 'Levels (baked)');
  assert.equal(l.kind, 'pixel');
  assert.equal(l.blend, 'source-over');
  assert.ok(Math.abs(l.opacity - 0.5) < 0.005);
  assert.deepEqual([...surfaceOf(back, l).read(1, 1, 1, 1).data], [155, 155, 155, 255]);
});

test('blur is always baked', () => {
  const doc = createDocument({ width: 4, height: 4 });
  insertLayer(doc, createLayer(doc, 'adjust', { name: 'Soften', adjust: 'blur', params: { radius: 3 } }), 1);
  const { doc: back } = readPsdFile(new Uint8Array(writePsdFile(doc, fakes)));
  assert.ok(back.layers.some(x => x.name === 'Soften (baked)' && x.kind === 'pixel'));
});
