// Photo helpers that are pure logic: fitting oversized images, and removing a background from the edges in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithinLimit } from '../../src/creative/io/raster.js';
import { removeBackground } from '../../src/creative/removeBackground.js';

test('fitWithinLimit(30000, 8000) → 16384 × 4369, and images within the limit are left alone', () => {
  const big = fitWithinLimit(30000, 8000);
  assert.equal(big.width, 16384);
  assert.equal(big.height, 4369);
  assert.ok(Math.abs(big.scale - 0.5461) < 1e-3);
  assert.deepEqual(fitWithinLimit(4000, 3000), { width: 4000, height: 3000, scale: 1 });
  assert.deepEqual(fitWithinLimit(100, 20000), { width: 82, height: 16384, scale: 16384 / 20000 });
});

// Rows of characters: '.' white, '#' black, 'r' red.
function grid(rows) {
  const colours = { '.': [255, 255, 255, 255], '#': [0, 0, 0, 255], r: [255, 0, 0, 255] };
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * rows.length * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => data.set(colours[ch], (y * width + x) * 4)));
  return { width, height: rows.length, data };
}
const alphaMap = p => Array.from({ length: p.height }, (_, y) => Array.from({ length: p.width }, (_, x) => (p.data[(y * p.width + x) * 4 + 3] ? 'x' : '_')).join(''));

test('removeBackground clears a white border but keeps white pixels enclosed inside a black ring', () => {
  const p = grid([
    '.......',
    '.#####.',
    '.#...#.',
    '.#...#.',
    '.#####.',
    '.......',
  ]);
  const cleared = removeBackground(p, 10);
  assert.deepEqual(alphaMap(p), [
    '_______',
    '_xxxxx_',
    '_xxxxx_',
    '_xxxxx_',
    '_xxxxx_',
    '_______',
  ]);
  assert.equal(cleared, 22);
});

test('tolerance 0 only clears exact matches', () => {
  const p = grid(['....', '.rr.', '....']);
  p.data.set([250, 255, 255, 255], 0); // the top-left corner is nearly, not exactly, white
  removeBackground(p, 0);
  assert.equal(p.data[3], 255, 'the near-white corner stays');
  assert.equal(p.data[4 + 3], 0, 'exact white is cleared');
  assert.equal(p.data[(1 * 4 + 1) * 4 + 3], 255, 'the subject stays');
  const q = grid(['....', '.rr.', '....']);
  q.data.set([250, 255, 255, 255], 0);
  removeBackground(q, 10);
  assert.equal(q.data[3], 0, 'within tolerance 10 it goes too');
});

test('the background colour is the most common edge colour, so a subject touching the edge survives', () => {
  const p = grid([
    '......',
    '.rr...',
    'rrr...',
    '......',
  ]);
  removeBackground(p, 10);
  assert.deepEqual(alphaMap(p), ['______', '_xx___', 'xxx___', '______']);
});
