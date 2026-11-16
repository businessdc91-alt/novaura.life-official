// PSD export in a real browser: baked adjustments and the composite match the canvas pixel for pixel.
// Run through Vite (ag-psd needs bundling): node scripts/browser-test.mjs --vite=http://localhost:5199/ <this file>
import { test, assert } from './harness.js';
import { readPsd } from 'ag-psd';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { addLayer, addMask } from '../../../src/creative/edits.js';
import { defaultParams } from '../../../src/creative/adjustments.js';
import { flatten } from '../../../src/creative/compositor.js';
import { readPsdFile, writePsdFile } from '../../../src/creative/io/psd.js';

setSurfaceFactory(null);

const PHOTO = { tab: 'photo' };

function maxDiff(a, b) {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

function sampleDoc() {
  const store = createStudioStore();
  const session = store.newDocument({ width: 40, height: 30, background: 'white' });
  const { layer } = addLayer(session, 'pixel', { name: 'Paint' }, PHOTO);
  const s = surfaceOf(session.doc, layer);
  const g = s.ctx.createLinearGradient(0, 0, 40, 0);
  g.addColorStop(0, '#ff3300');
  g.addColorStop(1, '#0033ff');
  s.ctx.fillStyle = g;
  s.ctx.fillRect(5, 5, 30, 20);
  const inv = addLayer(session, 'adjust', { name: 'Invert', adjust: 'invert', params: {}, opacity: 0.6 }, PHOTO).layer;
  addMask(session, inv.id, true, PHOTO);
  const m = surfaceOf(session.doc, inv, 'mask');
  m.ctx.fillStyle = '#000000';
  m.ctx.fillRect(20, 0, 20, 30);
  inv.rev = ++session.doc.version;
  addLayer(session, 'adjust', { name: 'Soften', adjust: 'blur', params: { ...defaultParams('blur'), radius: 2 } }, PHOTO);
  addLayer(session, 'shape', { shape: 'ellipse', x: 10, y: 8, w: 12, h: 10, fill: '#00cc66', blend: 'multiply' }, PHOTO);
  return session.doc;
}

test('the baked layer over the layers beneath reproduces flatten() pixel for pixel', () => {
  const doc = sampleDoc();
  const { doc: back } = readPsdFile(new Uint8Array(writePsdFile(doc, { exactLook: true })));
  assert.ok(back.layers.some(l => l.name === 'Invert (baked)'));
  assert.ok(back.layers.some(l => l.name === 'Soften (baked)'));
  const want = flatten(doc).read(0, 0, 40, 30).data;
  const got = flatten(back).read(0, 0, 40, 30).data;
  assert.ok(maxDiff(want, got) <= 1, `max channel difference ${maxDiff(want, got)}`);
});

test('the exported composite equals flatten()', () => {
  const doc = sampleDoc();
  const psd = readPsd(writePsdFile(doc), { useImageData: true, skipLayerImageData: true });
  const want = flatten(doc).read(0, 0, 40, 30).data;
  assert.ok(maxDiff(want, psd.imageData.data) <= 1, `max channel difference ${maxDiff(want, psd.imageData.data)}`);
});

test('without exactLook, Invert goes out live and the round trip still looks the same', () => {
  const doc = sampleDoc();
  const { doc: back } = readPsdFile(new Uint8Array(writePsdFile(doc)));
  assert.equal(back.layers.find(l => l.name === 'Invert').kind, 'adjust');
  const diff = maxDiff(flatten(doc).read(0, 0, 40, 30).data, flatten(back).read(0, 0, 40, 30).data);
  assert.ok(diff <= 1, `max channel difference ${diff}`);
});
