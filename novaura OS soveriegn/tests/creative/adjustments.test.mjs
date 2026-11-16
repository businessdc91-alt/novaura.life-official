// Adjustment definitions: lookup tables, per-pixel maths, canvas filters and SVG filters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADJUSTMENTS, defaultParams, buildLut, applyAdjustmentPixels, canvasFilter, svgFilter, curveTable, isIdentity,
} from '../../src/creative/adjustments.js';
import { createDocument, createLayer } from '../../src/creative/document.js';

const one = (r, g, b, a = 255) => ({ width: 1, height: 1, data: new Uint8ClampedArray([r, g, b, a]) });
const run = (type, params, pixels, geom = { docWidth: pixels.width, docHeight: pixels.height, originX: 0, originY: 0 }) => {
  applyAdjustmentPixels(type, { ...defaultParams(type), ...params }, pixels, geom);
  return [...pixels.data];
};
const lut = (type, params) => buildLut(type, { ...defaultParams(type), ...params });

test('the twelve adjustments and their labels', () => {
  assert.deepEqual(Object.keys(ADJUSTMENTS), [
    'brightnessContrast', 'hueSaturation', 'vibrance', 'levels', 'curves', 'blackWhite',
    'invert', 'threshold', 'posterize', 'sepia', 'blur', 'vignette',
  ]);
  assert.equal(ADJUSTMENTS.blackWhite.label, 'Black & White');
  assert.deepEqual(ADJUSTMENTS.levels.params.gamma, { min: 0.1, max: 9.99, default: 1, step: 0.01 });
  assert.equal(createLayer(createDocument({ width: 2, height: 2 }), 'adjust', { adjust: 'levels' }).name, 'Levels');
});

test('levels identity at defaults', () => {
  const t = lut('levels', {});
  for (const v of [0, 1, 77, 128, 254, 255]) assert.equal(t.r[v], v);
  assert.equal(isIdentity('levels', defaultParams('levels')), true);
});

test('levels inBlack 64 maps 64→0 and 255→255', () => {
  const t = lut('levels', { inBlack: 64 });
  assert.equal(t.r[64], 0);
  assert.equal(t.r[30], 0);
  assert.equal(t.r[255], 255);
});

test('levels gamma 2 maps 128→181', () => {
  assert.ok(Math.abs(lut('levels', { gamma: 2 }).g[128] - 181) <= 1);
});

test('posterize 2 maps 100→0, 200→255', () => {
  const t = lut('posterize', { levels: 2 });
  assert.equal(t.r[100], 0);
  assert.equal(t.r[200], 255);
});

test('threshold 128: (200,200,200)→255, (50,50,50)→0', () => {
  assert.deepEqual(run('threshold', { level: 128 }, one(200, 200, 200)), [255, 255, 255, 255]);
  assert.deepEqual(run('threshold', { level: 128 }, one(50, 50, 50, 99)), [0, 0, 0, 99]);
});

test('invert twice is identity', () => {
  const p = one(10, 100, 250);
  run('invert', {}, p);
  assert.deepEqual([...p.data], [245, 155, 5, 255]);
  run('invert', {}, p);
  assert.deepEqual([...p.data], [10, 100, 250, 255]);
});

test('curves through (0,0),(255,255) is identity', () => {
  const t = curveTable([[0, 0], [255, 255]]);
  for (let v = 0; v < 256; v++) assert.equal(t[v], v);
});

test('curves is monotone between increasing points', () => {
  const t = curveTable([[0, 0], [64, 100], [192, 150], [255, 255]]);
  for (let v = 1; v < 256; v++) assert.ok(t[v] >= t[v - 1], `at ${v}`);
  assert.equal(t[64], 100);
  assert.equal(t[192], 150);
  const flat = curveTable([[50, 20], [200, 220]]);
  assert.equal(flat[0], 20, 'flat before the first point');
  assert.equal(flat[255], 220, 'flat after the last point');
});

test('curves channel then rgb compose', () => {
  const t = lut('curves', { points: { rgb: [[0, 255], [255, 0]], r: [[0, 0], [255, 128]] } });
  assert.ok(Math.abs(t.r[255] - 127) <= 1);
  assert.equal(t.g[255], 0);
});

test('brightnessContrast(0,0) identity; brightness 50 maps 100→150', () => {
  const id = lut('brightnessContrast', {});
  for (const v of [0, 100, 200, 255]) assert.equal(id.r[v], v);
  assert.equal(lut('brightnessContrast', { brightness: 50 }).r[100], 150);
  assert.equal(lut('brightnessContrast', { contrast: 100 }).r[200], 255);
});

test('hueSaturation hue 120 maps pure red to pure green', () => {
  const [r, g, b] = run('hueSaturation', { hue: 120 }, one(255, 0, 0));
  assert.ok(r <= 1 && g >= 254 && b <= 1, `${r},${g},${b}`);
  const [gr, gg, gb] = run('hueSaturation', { saturation: -100 }, one(255, 0, 0));
  assert.ok(gr === gg && gg === gb, 'saturation -100 is grey');
});

test('vibrance boosts dull colours more than bright ones', () => {
  const dull = run('vibrance', { vibrance: 100 }, one(140, 120, 120));
  const vivid = run('vibrance', { vibrance: 100 }, one(250, 20, 20));
  assert.ok(dull[0] - dull[1] > 20, `dull spread grows: ${dull}`);
  assert.ok(vivid[0] - vivid[1] <= 255);
  assert.deepEqual(run('vibrance', {}, one(140, 120, 120)), [140, 120, 120, 255]);
});

test('blackWhite 100 makes r=g=b=lum', () => {
  const [r, g, b] = run('blackWhite', { amount: 100 }, one(255, 0, 0));
  assert.deepEqual([r, g, b], [76, 76, 76]);
});

test('vignette amount −100 size 100 softness 100: centre unchanged, corner black', () => {
  const w = 101;
  const pixels = { width: w, height: w, data: new Uint8ClampedArray(w * w * 4).fill(200) };
  run('vignette', { amount: -100, size: 100, softness: 100 }, pixels);
  const at = (x, y) => pixels.data[(y * w + x) * 4];
  assert.ok(at(50, 50) >= 199, `centre ${at(50, 50)}`);
  assert.ok(at(0, 0) <= 3, `corner ${at(0, 0)}`);
});

test('vignette uses document position, not the strip it is given', () => {
  const strip = { width: 10, height: 1, data: new Uint8ClampedArray(40).fill(200) };
  applyAdjustmentPixels('vignette', { amount: -100, size: 100, softness: 100 }, strip, { docWidth: 10, docHeight: 100, originX: 0, originY: 0 });
  assert.ok(strip.data[0] < 20, 'the top row of a tall document is near a corner');
});

test('canvasFilter for sepia/blur; null for lut kinds', () => {
  assert.equal(canvasFilter('sepia', { amount: 60 }), 'sepia(60%)');
  assert.equal(canvasFilter('blur', { radius: 4 }), 'blur(4px)');
  assert.equal(canvasFilter('levels', defaultParams('levels')), null);
  assert.equal(ADJUSTMENTS.sepia.compute, 'filter');
  assert.equal(ADJUSTMENTS.levels.compute, 'lut');
  assert.equal(ADJUSTMENTS.vignette.compute, 'pixel');
});

test('svgFilter for levels uses feComponentTransfer with a 256-entry table', () => {
  const svg = svgFilter('levels', { ...defaultParams('levels'), inBlack: 20 }, 'f1');
  assert.match(svg, /^<filter id="f1"/);
  assert.match(svg, /<feComponentTransfer>/);
  const table = /<feFuncR type="table" tableValues="([^"]+)"/.exec(svg)[1].split(' ');
  assert.equal(table.length, 256);
  assert.match(svgFilter('blur', { radius: 3 }, 'b'), /<feGaussianBlur stdDeviation="3"/);
  assert.equal(svgFilter('vignette', defaultParams('vignette'), 'v'), null, 'vignette has no SVG filter; it is baked');
});

test('isIdentity spots settings that change nothing', () => {
  assert.equal(isIdentity('brightnessContrast', { brightness: 0, contrast: 0 }), true);
  assert.equal(isIdentity('brightnessContrast', { brightness: 1, contrast: 0 }), false);
  assert.equal(isIdentity('invert', {}), false);
  assert.equal(isIdentity('blur', { radius: 0 }), true);
});
