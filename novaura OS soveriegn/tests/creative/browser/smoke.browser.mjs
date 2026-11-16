// Harness self-check: a real canvas works in the test browser, and a failing test is reported.
import { test, assert } from './harness.js';

test('OffscreenCanvas works', () => {
  const canvas = new OffscreenCanvas(2, 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 1, 1);
  assert.deepEqual([...ctx.getImageData(0, 0, 1, 1).data], [255, 0, 0, 255]);
});

if (location.search.includes('selftest')) {
  test('a failing test is reported as FAIL', () => {
    assert.equal(1, 2, 'deliberate failure');
  });
}
