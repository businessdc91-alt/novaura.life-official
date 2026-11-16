// Surfaces in the browser: the OffscreenCanvas-backed surface the app uses.
import { test, assert } from './harness.js';
import { CanvasSurface, createSurface, setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceCases } from '../cases/surfaceCases.js';

setSurfaceFactory(null);

test('createSurface gives a CanvasSurface in the browser', () => {
  assert.ok(createSurface(2, 2) instanceof CanvasSurface);
});

for (const [name, fn] of surfaceCases(createSurface, assert)) test(name, fn);

test('toPngBlob gives a PNG that loads back', async () => {
  const s = createSurface(3, 2);
  const blob = await s.toPngBlob();
  assert.equal(blob.type, 'image/png');
  const bitmap = await createImageBitmap(blob);
  assert.equal(bitmap.width, 3);
  assert.equal(bitmap.height, 2);
});
