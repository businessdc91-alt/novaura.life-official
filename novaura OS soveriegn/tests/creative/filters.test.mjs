// Filters: each one's maths, and splitting the work into strips gives exactly the same result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILTERS, runFilter, overlapFor, defaultFilterParams } from '../../src/creative/filters/kernels.js';
import { planStrips, runInStrips } from '../../src/creative/filters/pool.js';

const flat = (w, h, rgba) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: w, height: h, data };
};
const at = (p, x, y) => [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];
const whole = (id, src, params = {}) => ({ width: src.width, height: src.height, data: runFilter(id, src, { ...defaultFilterParams(id), ...params }) });

function seeded(w, h, seed = 7) {
  let s = seed;
  const data = Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => ((i % 4) === 3 ? 255 : (s = (s * 1103515245 + 12345) >>> 0) >>> 24));
  return { width: w, height: h, data };
}

test('the eight filters', () => {
  assert.deepEqual(Object.keys(FILTERS), ['unsharp', 'sharpen', 'addNoise', 'reduceNoise', 'motionBlur', 'pixelate', 'emboss', 'findEdges']);
  assert.equal(FILTERS.unsharp.label, 'Unsharp Mask');
});

test('overlap each filter needs from its neighbours', () => {
  assert.equal(overlapFor('unsharp', { radius: 2.2 }), 7);
  assert.equal(overlapFor('reduceNoise', { radius: 4 }), 4);
  assert.equal(overlapFor('motionBlur', { distance: 12.5 }), 13);
  assert.equal(overlapFor('pixelate', { cell: 16 }), 16);
  assert.equal(overlapFor('sharpen', {}), 1);
});

test('sharpen on a flat image is unchanged', () => {
  const src = flat(6, 5, [90, 120, 200, 255]);
  assert.deepEqual([...whole('sharpen', src).data], [...src.data]);
});

test('pixelate cell 2 averages 2×2 blocks', () => {
  const src = flat(4, 2, [0, 0, 0, 255]);
  src.data.set([200, 100, 40, 255], 0); // (0,0)
  const out = whole('pixelate', src, { cell: 2 });
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) assert.deepEqual(at(out, x, y), [50, 25, 10, 255]);
  assert.deepEqual(at(out, 2, 0), [0, 0, 0, 255]);
});

test('reduceNoise removes a single hot pixel', () => {
  const src = flat(7, 7, [100, 100, 100, 255]);
  src.data.set([255, 0, 255, 255], (3 * 7 + 3) * 4);
  assert.deepEqual(at(whole('reduceNoise', src, { radius: 1 }), 3, 3), [100, 100, 100, 255]);
});

test('findEdges on a flat image is white', () => {
  const out = whole('findEdges', flat(5, 5, [30, 60, 90, 255]));
  assert.deepEqual(at(out, 2, 2), [255, 255, 255, 255]);
  const edge = flat(6, 2, [0, 0, 0, 255]);
  for (let y = 0; y < 2; y++) for (let x = 3; x < 6; x++) edge.data.set([255, 255, 255, 255], (y * 6 + x) * 4);
  assert.ok(at(whole('findEdges', edge), 3, 0)[0] < 128, 'an edge is dark');
});

test('motionBlur distance 1 is identity', () => {
  const src = seeded(9, 6);
  assert.deepEqual([...whole('motionBlur', src, { distance: 1, angle: 30 }).data], [...src.data]);
});

test('addNoise is identical across runs with the same seed, and differs with another', () => {
  const src = flat(8, 8, [128, 128, 128, 255]);
  const a = whole('addNoise', src, { amount: 40, seed: 3 }).data;
  const b = whole('addNoise', src, { amount: 40, seed: 3 }).data;
  const c = whole('addNoise', src, { amount: 40, seed: 4 }).data;
  assert.deepEqual([...a], [...b]);
  assert.notDeepEqual([...a], [...c]);
  const mono = whole('addNoise', src, { amount: 40, seed: 3, mono: true });
  const [r, g, bl] = at(mono, 2, 2);
  assert.ok(r === g && g === bl, 'mono noise keeps grey');
});

test('unsharp sharpens an edge and leaves flat areas alone', () => {
  const src = flat(10, 3, [100, 100, 100, 255]);
  for (let y = 0; y < 3; y++) for (let x = 5; x < 10; x++) src.data.set([200, 200, 200, 255], (y * 10 + x) * 4);
  const out = whole('unsharp', src, { amount: 150, radius: 1, threshold: 0 });
  assert.ok(at(out, 4, 1)[0] < 100 && at(out, 5, 1)[0] > 200, 'overshoot on both sides of the edge');
  assert.deepEqual(at(out, 0, 1), [100, 100, 100, 255]);
});

test('emboss turns a flat image mid-grey', () => {
  assert.deepEqual(at(whole('emboss', flat(5, 5, [10, 200, 90, 255])), 2, 2), [128, 128, 128, 255]);
});

test('planStrips covers every row exactly once with overlap clamped to bounds', () => {
  for (const [height, count, overlap] of [[61, 7, 3], [10, 3, 0], [5, 9, 2], [100, 1, 50]]) {
    const strips = planStrips(height, count, overlap);
    const covered = [];
    for (const s of strips) {
      for (let y = s.y0; y < s.y1; y++) covered.push(y);
      assert.equal(s.srcY0, Math.max(0, s.y0 - overlap));
      assert.equal(s.srcY1, Math.min(height, s.y1 + overlap));
    }
    assert.deepEqual(covered, Array.from({ length: height }, (_, i) => i), `${height}/${count}`);
  }
});

test('for every filter, runInStrips with 1, 3 and 7 strips equals runFilter on the whole image', async () => {
  const src = seeded(97, 61);
  const params = {
    unsharp: { amount: 120, radius: 2.2, threshold: 3 }, sharpen: {}, addNoise: { amount: 30, seed: 9, mono: false },
    reduceNoise: { radius: 2 }, motionBlur: { angle: 37, distance: 9 }, pixelate: { cell: 7 }, emboss: { angle: 135, height: 3 }, findEdges: {},
  };
  const local = async (id, slice, p, rows, meta) => runFilter(id, slice, p, rows, meta);
  for (const id of Object.keys(FILTERS)) {
    const p = { ...defaultFilterParams(id), ...params[id] };
    const expected = [...runFilter(id, src, p)];
    for (const count of [1, 3, 7]) {
      const got = await runInStrips(id, src, p, count, local);
      assert.deepEqual([...got.data], expected, `${id} with ${count} strips`);
    }
  }
});
