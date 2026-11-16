// The exported SVG, drawn by the browser, looks like the canvas: shapes, pictures, masks, blends, adjustments.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { addLayer, addMask } from '../../../src/creative/edits.js';
import { flatten } from '../../../src/creative/compositor.js';
import { writeSvg } from '../../../src/creative/io/svg.js';

setSurfaceFactory(null);

const PAINT = { tab: 'paint' };

async function renderSvg(svg, w, h) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.getContext('2d');
  } finally {
    URL.revokeObjectURL(url);
  }
}

test('the SVG matches the canvas inside each region', async () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 120, height: 80, background: 'white' });
  const photo = addLayer(s, 'pixel', { name: 'Photo' }, PAINT).layer;
  const ps = surfaceOf(s.doc, photo);
  ps.ctx.fillStyle = '#3366cc';
  ps.ctx.fillRect(0, 40, 120, 40);
  addLayer(s, 'shape', { shape: 'rect', x: 10, y: 10, w: 40, h: 50, rotation: 0, radius: 0, fill: '#ffcc00', stroke: null, strokeWidth: 0, blend: 'multiply' }, PAINT);
  const ell = addLayer(s, 'shape', { shape: 'ellipse', x: 70, y: 10, w: 40, h: 40, rotation: 0, fill: '#cc0033', stroke: '#000000', strokeWidth: 4 }, PAINT).layer;
  addMask(s, ell.id, true, PAINT);
  const m = surfaceOf(s.doc, ell, 'mask');
  m.ctx.fillStyle = '#000000';
  m.ctx.fillRect(90, 0, 30, 80);
  ell.rev = ++s.doc.version;
  addLayer(s, 'adjust', { name: 'Invert', adjust: 'invert', params: {}, opacity: 0.25 }, PAINT);

  const want = flatten(s.doc).ctx;
  const got = await renderSvg(await writeSvg(s.doc), 120, 80);
  const at = (ctx, x, y) => [...ctx.getImageData(x, y, 1, 1).data];
  for (const [x, y, what] of [[5, 5, 'white paper'], [30, 30, 'yellow rect multiplied on white'], [30, 60, 'rect multiplied on blue'], [80, 30, 'ellipse where the mask is white'], [100, 30, 'ellipse hidden by the mask'], [100, 70, 'blue photo']]) {
    const a = at(want, x, y);
    const b = at(got, x, y);
    const diff = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    assert.ok(diff <= 3, `${what}: canvas ${a} vs SVG ${b}`);
  }
});
