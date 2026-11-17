// Opening PSD files: layers, groups, masks, blend modes, adjustments, and an honest report of what changed.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writePsd } from 'ag-psd';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { surfaceOf } from '../../src/creative/document.js';
import { readPsdFile, toRgba8 } from '../../src/creative/io/psd.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const px = (w, h, rgba) => ({ width: w, height: h, data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => rgba[i % 4]) });
const psdBytes = (children, extra = {}) => new Uint8Array(writePsd({ width: 10, height: 8, imageData: px(10, 8, [255, 255, 255, 255]), children, ...extra }, { generateThumbnail: false, noBackground: true }));
const byName = (doc, name) => doc.layers.find(l => l.name === name);

test('names, positions, opacity, hidden, protected→locked and blend survive', () => {
  const { doc, report } = readPsdFile(psdBytes([
    { name: 'Base', left: 0, top: 0, imageData: px(10, 8, [10, 20, 30, 255]) },
    { name: 'Spot', left: 3, top: 2, opacity: 0.5, blendMode: 'multiply', hidden: true, protected: { transparency: true, composite: true, position: true }, imageData: px(4, 3, [200, 0, 0, 255]) },
  ]));
  assert.deepEqual([doc.width, doc.height], [10, 8]);
  assert.deepEqual(doc.layers.map(l => l.name), ['Base', 'Spot']);
  const spot = byName(doc, 'Spot');
  assert.deepEqual([spot.kind, spot.x, spot.y, spot.width, spot.height], ['pixel', 3, 2, 4, 3]);
  assert.ok(Math.abs(spot.opacity - 0.5) < 0.005);
  assert.equal(spot.visible, false);
  assert.equal(spot.locked, true);
  assert.equal(spot.blend, 'multiply');
  assert.equal(spot.psdBlend, null);
  assert.deepEqual([...surfaceOf(doc, spot).read(0, 0, 1, 1).data], [200, 0, 0, 255]);
  assert.equal(doc.activeLayerId, spot.id);
  assert.deepEqual(report, []);
});

test("'linear dodge' reads as blend 'lighter' with psdBlend 'linear dodge'", () => {
  const { doc } = readPsdFile(psdBytes([{ name: 'Glow', left: 0, top: 0, blendMode: 'linear dodge', imageData: px(2, 2, [50, 50, 50, 255]) }]));
  assert.equal(byName(doc, 'Glow').blend, 'lighter');
  assert.equal(byName(doc, 'Glow').psdBlend, 'linear dodge');
});

test('a mask with defaultColor 0 reads with defaultValue 0', () => {
  const { doc } = readPsdFile(psdBytes([{
    name: 'Masked', left: 0, top: 0, imageData: px(10, 8, [0, 0, 255, 255]),
    mask: { left: 2, top: 1, right: 6, bottom: 5, defaultColor: 0, disabled: true, imageData: px(4, 4, [180, 180, 180, 255]) },
  }]));
  const layer = byName(doc, 'Masked');
  assert.deepEqual([layer.mask.x, layer.mask.y, layer.mask.width, layer.mask.height, layer.mask.defaultValue, layer.mask.enabled], [2, 1, 4, 4, 0, false]);
  assert.deepEqual([...surfaceOf(doc, layer, 'mask').read(1, 1, 1, 1).data], [180, 180, 180, 255]);
});

test('groups import as real folder layers preserving visibility, opacity and parentId', () => {
  const bytes = psdBytes([
    { name: 'Hidden group', hidden: true, blendMode: 'pass through', children: [{ name: 'In hidden', left: 0, top: 0, imageData: px(1, 1, [1, 1, 1, 255]) }] },
    { name: 'Half group', opacity: 0.5, blendMode: 'pass through', children: [{ name: 'In half', left: 0, top: 0, opacity: 0.5, imageData: px(1, 1, [2, 2, 2, 255]) }] },
  ]);
  const { doc, report } = readPsdFile(bytes);
  const g1 = byName(doc, 'Hidden group');
  const g2 = byName(doc, 'Half group');
  assert.equal(g1.kind, 'group');
  assert.equal(g1.visible, false);
  assert.equal(byName(doc, 'In hidden').parentId, g1.id);
  assert.equal(g2.kind, 'group');
  assert.ok(Math.abs(g2.opacity - 0.5) < 0.01);
  assert.equal(byName(doc, 'In half').parentId, g2.id);
  assert.deepEqual(report, []);
});

test('a group blend mode like multiply is kept directly on the group layer (and preserveGroups:false flattens with report)', () => {
  const bytes = psdBytes([{ name: 'Mult', blendMode: 'multiply', children: [{ name: 'Inside', left: 0, top: 0, imageData: px(1, 1, [9, 9, 9, 255]) }] }]);
  const { doc, report } = readPsdFile(bytes);
  const g = byName(doc, 'Mult');
  assert.equal(g.kind, 'group');
  assert.equal(g.blend, 'multiply');
  assert.deepEqual(report, []);

  const legacy = readPsdFile(bytes, 'Legacy', { preserveGroups: false });
  assert.deepEqual(legacy.report, ['Group "Mult": blend mode "multiply" can\'t be kept; its layers use their own modes.']);
});

test('a levels adjustment becomes a levels adjust layer with the same values', () => {
  const { doc } = readPsdFile(psdBytes([{ name: 'Levels 1', adjustment: { type: 'levels', channels: [{ shadowInput: 20, highlightInput: 230, shadowOutput: 5, highlightOutput: 250, midtoneInput: 1.2 }] } }]));
  const l = byName(doc, 'Levels 1');
  assert.equal(l.kind, 'adjust');
  assert.equal(l.adjust, 'levels');
  assert.deepEqual(l.params, { inBlack: 20, inWhite: 230, gamma: 1.2, outBlack: 5, outWhite: 250 });
});

test('the other supported adjustments come in live', () => {
  const { doc } = readPsdFile(psdBytes([
    { name: 'BC', adjustment: { type: 'brightness/contrast', brightness: 30, contrast: -20 } },
    { name: 'HS', adjustment: { type: 'hue/saturation', master: { hue: 45, saturation: -10, lightness: 5 } } },
    { name: 'Inv', adjustment: { type: 'invert' } },
    { name: 'Post', adjustment: { type: 'posterize', levels: 6 } },
    { name: 'Thr', adjustment: { type: 'threshold', level: 90 } },
    { name: 'Vib', adjustment: { type: 'vibrance', vibrance: 25, saturation: 10 } },
    { name: 'BW', adjustment: { type: 'black & white' } },
    { name: 'Curves', adjustment: { type: 'curves', channels: [[{ input: 0, output: 0 }, { input: 128, output: 150 }, { input: 255, output: 255 }]] } },
  ]));
  const p = n => byName(doc, n).params;
  assert.deepEqual(p('BC'), { brightness: 30, contrast: -20 });
  assert.deepEqual(p('HS'), { hue: 45, saturation: -10, lightness: 5 });
  assert.equal(byName(doc, 'Inv').adjust, 'invert');
  assert.deepEqual(p('Post'), { levels: 6 });
  assert.deepEqual(p('Thr'), { level: 90 });
  assert.deepEqual(p('Vib'), { vibrance: 25, saturation: 10 });
  assert.deepEqual(p('BW'), { amount: 100 });
  assert.deepEqual(p('Curves').points.rgb, [[0, 0], [128, 150], [255, 255]]);
});

test('an unsupported adjustment becomes a hidden placeholder and a report line', () => {
  const { doc, report } = readPsdFile(psdBytes([{ name: 'Exposure 1', adjustment: { type: 'exposure', exposure: 1, offset: 0, gamma: 1 } }]));
  const l = byName(doc, 'Exposure 1');
  assert.equal(l.visible, false);
  assert.equal(l.kind, 'pixel');
  assert.deepEqual(report, ['"Exposure 1": the exposure adjustment can\'t be shown here, so it was switched off.']);
});

test('effects produce a report line', () => {
  const { report } = readPsdFile(psdBytes([{
    name: 'Title', left: 0, top: 0, imageData: px(2, 2, [0, 0, 0, 255]),
    effects: { dropShadow: [{ enabled: true, size: { units: 'Pixels', value: 4 }, distance: { units: 'Pixels', value: 2 }, angle: 120, opacity: 0.6 }], stroke: [{ enabled: false, size: { units: 'Pixels', value: 1 } }] },
  }]));
  assert.deepEqual(report, ['"Title": layer effects (drop shadow) were dropped.']);
});

test('text keeps its words in the layer name', () => {
  const { doc } = readPsdFile(psdBytes([{ name: 'Layer 7', left: 0, top: 0, imageData: px(3, 2, [0, 0, 0, 255]), text: { text: 'Grand opening' } }]));
  assert.equal(doc.layers[0].name, 'Layer 7 — "Grand opening"');
});

test('colour modes Creative Studio cannot read are refused clearly', () => {
  const bytes = psdBytes([{ name: 'A', left: 0, top: 0, imageData: px(1, 1, [0, 0, 0, 255]) }]);
  bytes[24] = 0; bytes[25] = 9; // Lab
  assert.throws(() => readPsdFile(bytes), /This PSD uses Lab colour, which Creative Studio can't open yet\./);
  assert.throws(() => readPsdFile(new Uint8Array([1, 2, 3, 4])), /isn't a Photoshop file/);
});

test('16-bit and 32-bit pixels convert to 8-bit', () => {
  assert.deepEqual([...toRgba8({ width: 1, height: 1, data: Uint16Array.from([65535, 32768, 0, 65535]) }).data], [255, 128, 0, 255]);
  assert.deepEqual([...toRgba8({ width: 1, height: 1, data: Float32Array.from([1, 0.5, 0, 1]) }).data], [255, 128, 0, 255]);
});
