// PNG, JPG and WebP export in a real browser.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { exportRaster } from '../../../src/creative/io/raster.js';

setSurfaceFactory(null);

function doc(background = 'transparent') {
  const store = createStudioStore();
  const s = store.newDocument({ width: 60, height: 40, background });
  const layer = s.doc.layers[0];
  const surface = surfaceOf(s.doc, layer);
  for (let i = 0; i < 60; i += 6) { surface.ctx.fillStyle = `hsl(${i * 6}, 80%, 50%)`; surface.ctx.fillRect(i, 10, 6, 20); }
  layer.rev = ++s.doc.version;
  return s.doc;
}

test('PNG export at 2× is twice the size', async () => {
  const blob = await exportRaster(doc(), { type: 'image/png', scale: 2 });
  assert.equal(blob.type, 'image/png');
  const bmp = await createImageBitmap(blob);
  assert.deepEqual([bmp.width, bmp.height], [120, 80]);
});

test('JPG has no transparency: the transparent corner is white', async () => {
  const blob = await exportRaster(doc('transparent'), { type: 'image/jpeg', quality: 0.95 });
  assert.equal(blob.type, 'image/jpeg');
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  c.getContext('2d').drawImage(bmp, 0, 0);
  const [r, g, b, a] = c.getContext('2d').getImageData(1, 1, 1, 1).data;
  assert.ok(r > 245 && g > 245 && b > 245 && a === 255, `${r},${g},${b},${a}`);
});

test('WebP quality 10 is smaller than quality 90', async () => {
  // A noisy picture, so quality actually matters (at 1.0 Chrome switches to lossless WebP).
  const noisy = doc('white');
  const s = surfaceOf(noisy, noisy.layers[0]);
  const img = s.ctx.createImageData(60, 40);
  let seed = 7;
  for (let i = 0; i < img.data.length; i++) img.data[i] = i % 4 === 3 ? 255 : (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24;
  s.ctx.putImageData(img, 0, 0);
  noisy.layers[0].rev = ++noisy.version;
  const low = await exportRaster(noisy, { type: 'image/webp', quality: 0.1 });
  const high = await exportRaster(noisy, { type: 'image/webp', quality: 0.9 });
  assert.equal(low.type, 'image/webp');
  assert.ok(low.size < high.size, `${low.size} < ${high.size}`);
});
