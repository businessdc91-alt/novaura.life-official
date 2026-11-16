// Project files: the PNG codec array surfaces use, and .novaart pack/unpack round trips.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { encodePng, decodePng } from '../../src/creative/io/png.js';
import { packProject, unpackProject } from '../../src/creative/io/novaart.js';
import { createDocument, createLayer, insertLayer, surfaceOf } from '../../src/creative/document.js';
import { createMask } from '../../src/creative/masks.js';
import { buildZipBlob, crc32, listZipEntries } from '../../src/services/zipService.js';
import { defaultParams } from '../../src/creative/adjustments.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

function seeded(w, h, seed = 3) {
  let s = seed;
  return { width: w, height: h, data: Uint8ClampedArray.from({ length: w * h * 4 }, () => (s = (s * 1103515245 + 12345) >>> 0) >>> 24) };
}

test('png encode→decode round-trips random RGBA', async () => {
  const src = seeded(13, 7);
  const png = await encodePng(src);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const back = await decodePng(png);
  assert.deepEqual([back.width, back.height], [13, 7]);
  assert.deepEqual([...back.data], [...src.data]);
});

async function zlib(bytes) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

test('decodePng reads an RGB (type 2) PNG with one IDAT and filter 1', async () => {
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, 2); hv.setUint32(4, 1); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Uint8Array.from([1, 10, 20, 30, 5, 5, 5]); // Sub filter: the second pixel is (15, 25, 35)
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', await zlib(raw)), chunk('IEND', new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { png.set(p, at); at += p.length; }
  const img = await decodePng(png);
  assert.deepEqual([...img.data], [10, 20, 30, 255, 15, 25, 35, 255]);
});

test('decodePng refuses what it cannot read', async () => {
  await assert.rejects(decodePng(new Uint8Array([1, 2, 3])), /Unsupported PNG/);
});

function sampleDoc() {
  const doc = createDocument({ name: 'Poster', width: 6, height: 4, background: '#204060' });
  const art = createLayer(doc, 'pixel', { name: 'Art', surface: new ArraySurface(3, 2), x: 2, y: 1, opacity: 0.75, blend: 'lighter', psdBlend: 'linear dodge' });
  surfaceOf(doc, art).write(0, 0, seeded(3, 2));
  insertLayer(doc, art, 1);
  art.mask = createMask(doc, false);
  surfaceOf(doc, art, 'mask').write(1, 1, { width: 1, height: 1, data: new Uint8ClampedArray([200, 200, 200, 255]) });
  const shape = createLayer(doc, 'shape', { shape: 'star', x: 1, y: 1, w: 4, h: 2, rotation: 15, radius: 0, sides: 6, innerRatio: 0.4, fill: '#ff0000', stroke: null, strokeWidth: 0 });
  insertLayer(doc, shape, 2);
  const text = createLayer(doc, 'text', { text: 'Hi', fontFamily: 'Impact', fontSize: 30, role: 'memeTop', locked: true });
  insertLayer(doc, text, 3);
  const adjust = createLayer(doc, 'adjust', { adjust: 'curves', params: { ...defaultParams('curves'), points: { rgb: [[0, 0], [128, 100], [255, 255]] } }, visible: false });
  insertLayer(doc, adjust, 4);
  doc.activeLayerId = shape.id;
  return doc;
}

const strip = l => {
  const { bufferId, rev, mask, ...rest } = l;
  return { ...rest, mask: mask ? { ...mask, bufferId: undefined } : null };
};

test('packProject→unpackProject restores every layer field, pixel bytes, masks, psdBlend and role', async () => {
  const doc = sampleDoc();
  const blob = await packProject(doc);
  const names = (await listZipEntries(blob)).map(e => e.path);
  assert.ok(names.includes('document.json'));
  assert.ok(names.includes(`layers/${doc.layers[1].id}.png`));
  assert.ok(names.includes(`masks/${doc.layers[1].id}.png`));
  assert.ok(!names.includes('thumbnail.png'), 'no thumbnail without a canvas');

  const back = await unpackProject(blob);
  assert.deepEqual([back.name, back.width, back.height, back.activeLayerId], ['Poster', 6, 4, doc.activeLayerId]);
  assert.deepEqual(back.layers.map(strip), doc.layers.map(strip));
  for (const [i, part] of [[0, 'layer'], [1, 'layer'], [1, 'mask']]) {
    const a = surfaceOf(doc, doc.layers[i], part);
    const b = surfaceOf(back, back.layers[i], part);
    assert.deepEqual([...b.read(0, 0, b.width, b.height).data], [...a.read(0, 0, a.width, a.height).data], `${i} ${part}`);
  }
  assert.equal(back.version, 0);
});

test('a newer version is refused with the message', async () => {
  const blob = await buildZipBlob([{ path: 'document.json', bytes: new TextEncoder().encode(JSON.stringify({ format: 'novaart', version: 2, layers: [] })) }]);
  await assert.rejects(unpackProject(blob), /This project was made by a newer Creative Studio\./);
  const notOurs = await buildZipBlob([{ path: 'readme.txt', bytes: new TextEncoder().encode('hi') }]);
  await assert.rejects(unpackProject(notOurs), /isn't a Creative Studio project/);
});

test('saveProject saves into /Creative Studio the first time, then over the same file', async () => {
  const { createStudioStore } = await import('../../src/creative/studioStore.js');
  const { saveProject, openFileBlob } = await import('../../src/creative/io/projectFiles.js');
  const { setLayerProps } = await import('../../src/creative/edits.js');
  const saved = new Map();
  const files = {
    uniqueChildPath: async (parent, name) => `${parent}/${saved.has(`${parent}/${name}`) ? `copy of ${name}` : name}`,
    saveFile: async (path, blob, mime) => { saved.set(path, { blob, mime }); },
  };
  const store = createStudioStore();
  const session = store.newDocument({ name: 'Poster: final?', width: 4, height: 4 });
  setLayerProps(session, session.doc.layers[0].id, { opacity: 0.5 }, { tab: 'paint' });
  assert.equal(session.dirty, true);
  const path = await saveProject(store, session, { files });
  assert.equal(path, '/Creative Studio/Poster- final-.novaart');
  assert.equal(saved.get(path).mime, 'application/x-novaart');
  assert.equal(session.savedPath, path);
  assert.equal(session.dirty, false);
  setLayerProps(session, session.doc.layers[0].id, { opacity: 0.25 }, { tab: 'paint' });
  assert.equal(await saveProject(store, session, { files }), path, 'saving again keeps the same file');

  const reopened = await openFileBlob(store, saved.get(path).blob, 'Poster- final-.novaart', { savedPath: path });
  assert.equal(reopened.savedPath, path);
  assert.equal(reopened.dirty, false);
  assert.equal(reopened.doc.layers[0].opacity, 0.25);
  assert.equal(store.getState().activeId, reopened.id);
});
