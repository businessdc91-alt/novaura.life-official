// Opening and placing images, removing a background, and doubling the document, in a real browser.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { addLayer, addMask, upscaleDocument } from '../../../src/creative/edits.js';
import { openImageFile, documentFromImage, placeImage, scaledNotice } from '../../../src/creative/io/raster.js';
import { removeBackgroundOnLayer } from '../../../src/creative/removeBackground.js';
import { defaultParams } from '../../../src/creative/adjustments.js';

setSurfaceFactory(null);

const PHOTO = { tab: 'photo' };

async function pngBlob(w, h, paint) {
  const c = new OffscreenCanvas(w, h);
  paint(c.getContext('2d'));
  return c.convertToBlob({ type: 'image/png' });
}

test('open a PNG blob makes a document its size', async () => {
  const blob = await pngBlob(30, 20, (ctx) => { ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 30, 20); });
  const opened = await openImageFile(blob, 'leaf.png');
  assert.equal(opened.scaledFrom, null);
  assert.equal(scaledNotice(opened), null);
  const doc = documentFromImage(opened, 'leaf.png');
  assert.deepEqual([doc.width, doc.height, doc.name], [30, 20, 'leaf']);
  assert.equal(doc.layers.length, 1);
  assert.equal(doc.layers[0].name, 'leaf');
  assert.deepEqual([...surfaceOf(doc, doc.layers[0]).read(5, 5, 1, 1).data], [0, 255, 0, 255]);
  const store = createStudioStore();
  const session = store.openDocument(doc);
  assert.equal(session.dirty, false);
});

test('an SVG with no size opens at 1024 on its long side', async () => {
  const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="red"/></svg>'], { type: 'image/svg+xml' });
  const opened = await openImageFile(svg, 'logo.svg');
  assert.deepEqual([opened.width, opened.height], [1024, 512]);
  assert.deepEqual([...opened.surface.read(500, 250, 1, 1).data], [255, 0, 0, 255]);
});

test('a file that is not an image is refused with a clear message', async () => {
  let message = '';
  try { await openImageFile(new Blob(['hello'], { type: 'text/plain' }), 'notes.txt'); } catch (err) { message = err.message; }
  assert.equal(message, '"notes.txt" isn\'t an image Creative Studio can open.');
});

test('place adds a layer at its own size, centred', async () => {
  const store = createStudioStore();
  const session = store.newDocument({ width: 100, height: 60 });
  const opened = await openImageFile(await pngBlob(20, 10, (ctx) => { ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 20, 10); }), 'tag.png');
  const r = placeImage(session, opened, 'tag.png', PHOTO);
  assert.equal(r.ok, true);
  assert.deepEqual([r.layer.x, r.layer.y, r.layer.width, r.layer.height], [40, 25, 20, 10]);
  assert.equal(session.history.steps.at(-1).label, 'Place tag');
});

test('removing a background is one Photo step on the active layer', () => {
  const store = createStudioStore();
  const session = store.newDocument({ width: 20, height: 20, background: 'white' });
  const s = surfaceOf(session.doc, session.doc.layers[0]);
  s.ctx.fillStyle = '#0000ff';
  s.ctx.fillRect(5, 5, 10, 10);
  const r = removeBackgroundOnLayer(session, 20);
  assert.equal(r.ok, true);
  assert.equal(r.cleared, 300);
  assert.equal(surfaceOf(session.doc, session.doc.layers[0]).read(0, 0, 1, 1).data[3], 0);
  assert.equal(surfaceOf(session.doc, session.doc.layers[0]).read(10, 10, 1, 1).data[3], 255);
  assert.equal(session.history.steps.at(-1).label, 'Remove background');
  session.history.undo();
  assert.equal(surfaceOf(session.doc, session.doc.layers[0]).read(0, 0, 1, 1).data[3], 255);
});

test('upscaleDocument doubles size, layer x/y, shape w/h and fontSize', () => {
  const store = createStudioStore();
  const session = store.newDocument({ width: 50, height: 40, background: 'white' });
  const shape = addLayer(session, 'shape', { shape: 'rect', x: 5, y: 6, w: 10, h: 8, rotation: 0, radius: 2, fill: '#ff0000', stroke: '#000000', strokeWidth: 3 }, PHOTO).layer;
  const text = addLayer(session, 'text', { text: 'Hi', x: 2, y: 3, fontSize: 12, strokeWidth: 1, wrapWidth: 30 }, PHOTO).layer;
  const blur = addLayer(session, 'adjust', { adjust: 'blur', params: { ...defaultParams('blur'), radius: 3 } }, PHOTO).layer;
  addMask(session, shape.id, true, PHOTO);
  const r = upscaleDocument(session, 2, PHOTO);
  assert.equal(r.ok, true);
  assert.deepEqual([session.doc.width, session.doc.height], [100, 80]);
  const bg = session.doc.layers[0];
  assert.deepEqual([bg.width, bg.height], [100, 80]);
  assert.equal(surfaceOf(session.doc, bg).width, 100);
  assert.deepEqual([shape.x, shape.y, shape.w, shape.h, shape.radius, shape.strokeWidth], [10, 12, 20, 16, 4, 6]);
  assert.deepEqual([shape.mask.width, shape.mask.height, surfaceOf(session.doc, shape, 'mask').width], [100, 80, 100]);
  assert.deepEqual([text.x, text.y, text.fontSize, text.strokeWidth, text.wrapWidth], [4, 6, 24, 2, 60]);
  assert.equal(blur.params.radius, 6);
  assert.equal(session.history.steps.at(-1).label, '2× Upscale');

  session.history.undo();
  assert.deepEqual([session.doc.width, session.doc.height], [50, 40]);
  assert.deepEqual([bg.width, surfaceOf(session.doc, bg).width], [50, 50]);
  assert.deepEqual([shape.x, shape.w, shape.radius], [5, 10, 2]);
  assert.equal(surfaceOf(session.doc, shape, 'mask').width, 50);
  assert.equal(text.fontSize, 12);
  assert.equal(blur.params.radius, 3);
  session.history.redo();
  assert.equal(session.doc.width, 100);
});

test('upscaleDocument refuses past 16384', () => {
  const store = createStudioStore();
  const session = store.newDocument({ width: 9000, height: 4 });
  assert.deepEqual(upscaleDocument(session, 2, PHOTO), { ok: false, reason: '2× would make the image larger than 16384 px.' });
  assert.equal(session.doc.width, 9000);
});
