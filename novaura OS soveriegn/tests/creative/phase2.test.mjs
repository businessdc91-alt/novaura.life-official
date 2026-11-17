// Phase 2 Photopea parity tests: crop, canvas/image resize, selections, groups, PSD groups & oversized scaling.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writePsd } from 'ag-psd';
import { ArraySurface, setSurfaceFactory, MAX_SIDE, resamplePixels } from '../../src/creative/surface.js';
import { createDocument, createLayer, insertLayer, surfaceOf, layerDepth } from '../../src/creative/document.js';
import { createStudioStore } from '../../src/creative/studioStore.js';
import {
  cropDocument, resizeCanvas, resizeImage,
  selectAll, clearSelection, invertSelection, featherSelection,
  clearSelectedPixels, copySelectedPixels, cutSelectedPixels, pastePixels, selectionToMask,
  groupLayer, ungroupLayer, setLayerParent, duplicateLayer, deleteLayer, copyLayerToDocument,
  setSelection,
} from '../../src/creative/edits.js';
import {
  rectSelectionData, ellipseSelectionData, lassoSelectionData, magicWandSelectionData,
  combineSelectionData, createSelection, clipPixelsToSelection,
} from '../../src/creative/selection.js';
import { packProject, unpackProject } from '../../src/creative/io/novaart.js';
import { writeSvg } from '../../src/creative/io/svg.js';
import { readPsdFile, writePsdFile } from '../../src/creative/io/psd.js';
import { blendLabel, toPsdBlend } from '../../src/creative/blendModes.js';
import { toolForKey, TOOLS } from '../../src/creative/tools/index.js';
import { ctrlActionFor, studioActionFor } from '../../src/creative/shortcuts.js';
import { getCropRect, setCropRect, commitCrop } from '../../src/creative/tools/crop.js';
import '../../src/creative/tools/selection.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const META = { tab: 'paint' };
const px = (surface, x, y) => [...surface.read(x, y, 1, 1).data];
const solid = (w, h, rgba) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: w, height: h, data };
};

test('cropDocument shifts layers cleanly (non-destructive by default) and deleteCropped trims buffers, both undoable', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 20, height: 12 });
  const shape = createLayer(s.doc, 'shape', { shape: 'rect', x: 8, y: 4, w: 6, h: 4, fill: '#ff0000' });
  insertLayer(s.doc, shape, 1);

  assert.equal(cropDocument(s, { x: 4, y: 2, w: 10, h: 8 }, META).ok, true);
  assert.deepEqual([s.doc.width, s.doc.height], [10, 8]);
  assert.deepEqual([s.doc.layers[0].x, s.doc.layers[0].y, s.doc.layers[0].width], [-4, -2, 20]);
  assert.deepEqual([shape.x, shape.y], [4, 2]);
  s.history.undo();
  assert.deepEqual([s.doc.width, s.doc.height, shape.x, shape.y], [20, 12, 8, 4]);

  assert.equal(cropDocument(s, { x: 4, y: 2, w: 10, h: 8 }, META, { deleteCropped: true }).ok, true);
  assert.deepEqual([s.doc.layers[0].x, s.doc.layers[0].y, s.doc.layers[0].width, s.doc.layers[0].height], [0, 0, 10, 8]);
  s.history.undo();
  assert.deepEqual([s.doc.layers[0].x, s.doc.layers[0].y, s.doc.layers[0].width, s.doc.layers[0].height], [0, 0, 20, 12]);
});

test('interactive crop tool commits crop rect as one undo step', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 30, height: 20 });
  setCropRect(s.doc, { x: 5, y: 5, w: 10, h: 10 });
  assert.deepEqual(getCropRect(s.doc), { x: 5, y: 5, w: 10, h: 10 });
  const r = commitCrop({ session: s, store, tab: 'paint', requestRender: () => {} });
  assert.equal(r.ok, true);
  assert.deepEqual([s.doc.width, s.doc.height], [10, 10]);
  s.history.undo();
  assert.deepEqual([s.doc.width, s.doc.height], [30, 20]);
});

test('resizeCanvas positions layers using 9-point anchor and resizeImage resamples non-uniformly on ArraySurface', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 10, height: 10, background: 'black' });
  const layer = s.doc.layers[0];
  resizeCanvas(s, { width: 20, height: 14, anchor: 'bottom-right' }, META);
  assert.deepEqual([s.doc.width, s.doc.height, layer.x, layer.y], [20, 14, 10, 4]);
  s.history.undo();
  assert.deepEqual([s.doc.width, s.doc.height, layer.x, layer.y], [10, 10, 0, 0]);

  const shape = createLayer(s.doc, 'shape', { shape: 'rect', x: 2, y: 4, w: 4, h: 2 });
  insertLayer(s.doc, shape, 1);
  assert.equal(resizeImage(s, { width: 20, height: 5 }, META).ok, true);
  assert.deepEqual([s.doc.width, s.doc.height, shape.x, shape.y, shape.w, shape.h], [20, 5, 4, 2, 8, 1]);
  assert.deepEqual([layer.width, layer.height], [20, 5]);
  assert.deepEqual(px(surfaceOf(s.doc, layer), 10, 2), [0, 0, 0, 255]);
  s.history.undo();
  assert.deepEqual([s.doc.width, s.doc.height, layer.width], [10, 10, 10]);
});

test('selection primitives: rect, ellipse, lasso polygon, magic wand, boolean ops and feathering', () => {
  const rData = rectSelectionData(10, 10, { x: 2, y: 2, w: 4, h: 4 });
  assert.equal(rData[2 * 10 + 2], 255);
  assert.equal(rData[1 * 10 + 1], 0);

  const eData = ellipseSelectionData(10, 10, { x: 1, y: 1, w: 6, h: 6 });
  assert.equal(eData[4 * 10 + 4], 255, 'centre is inside ellipse');
  assert.equal(eData[1 * 10 + 1], 0, 'bounding corner is outside ellipse');

  const triangle = [{ x: 2, y: 8 }, { x: 5, y: 1 }, { x: 8, y: 8 }];
  const lData = lassoSelectionData(10, 10, triangle);
  assert.equal(lData[5 * 10 + 5], 255, 'interior is selected by scanline lasso');
  assert.equal(lData[1 * 10 + 1], 0);

  const img = { width: 6, height: 4, data: new Uint8ClampedArray(6 * 4 * 4) };
  for (let i = 0; i < img.data.length; i += 4) img.data.set([10, 10, 10, 255], i);
  img.data.set([200, 0, 0, 255], (1 * 6 + 1) * 4);
  img.data.set([200, 0, 0, 255], (1 * 6 + 4) * 4);
  const wContig = magicWandSelectionData(img, 1, 1, { tolerance: 10, contiguous: true });
  assert.equal(wContig[1 * 6 + 1], 255);
  assert.equal(wContig[1 * 6 + 4], 0);
  const wGlobal = magicWandSelectionData(img, 1, 1, { tolerance: 10, contiguous: false });
  assert.equal(wGlobal[1 * 6 + 4], 255);

  const bRect = rectSelectionData(10, 10, { x: 4, y: 2, w: 4, h: 4 });
  const subtracted = combineSelectionData(rData, bRect, 'subtract');
  assert.equal(subtracted[2 * 10 + 2], 255);
  assert.equal(subtracted[2 * 10 + 4], 0);
  const intersected = combineSelectionData(rData, bRect, 'intersect');
  assert.equal(intersected[2 * 10 + 2], 0);
  assert.equal(intersected[2 * 10 + 4], 255);

  const feathered = createSelection(10, 10, rectSelectionData(10, 10, { x: 3, y: 3, w: 4, h: 4 }, 2));
  assert.ok(feathered.data[3 * 10 + 2] > 0 && feathered.data[3 * 10 + 2] < 255, 'soft feathered boundary');
});

test('selection edits: clipPixelsToSelection, copy/cut/paste, clear, invert, feather, selectionToMask', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 10, height: 10, background: '#ff0000' });
  const sel = createSelection(10, 10, rectSelectionData(10, 10, { x: 2, y: 2, w: 4, h: 4 }));
  setSelection(s, sel, META, 'Select');

  const copied = copySelectedPixels(s.doc);
  assert.equal(copied.ok, true);
  assert.deepEqual([copied.clipboard.width, copied.clipboard.height, copied.clipboard.x, copied.clipboard.y], [4, 4, 2, 2]);
  assert.deepEqual([...copied.clipboard.data.slice(0, 4)], [255, 0, 0, 255]);

  assert.equal(cutSelectedPixels(s, META).ok, true);
  assert.deepEqual(px(surfaceOf(s.doc, s.doc.layers[0]), 3, 3), [255, 0, 0, 0], 'selected pixels cleared');
  assert.deepEqual(px(surfaceOf(s.doc, s.doc.layers[0]), 0, 0), [255, 0, 0, 255], 'outside untouched');
  s.history.undo();
  assert.deepEqual(px(surfaceOf(s.doc, s.doc.layers[0]), 3, 3), [255, 0, 0, 255]);

  const pasted = pastePixels(s, copied.clipboard, META);
  assert.equal(pasted.ok, true);
  assert.deepEqual([pasted.layer.width, pasted.layer.height, pasted.layer.x, pasted.layer.y], [4, 4, 2, 2]);

  assert.equal(invertSelection(s, META).ok, true);
  assert.equal(s.doc.selection.data[3 * 10 + 3], 0);
  assert.equal(s.doc.selection.data[0], 255);

  assert.equal(featherSelection(s, 1, META).ok, true);
  assert.equal(selectionToMask(s, META).ok, true);
  assert.ok(s.doc.layers.at(-1).mask, 'selection converted into layer mask');
  assert.equal(clearSelection(s, META).ok, true);
  assert.equal(s.doc.selection, null);
  selectAll(s, META);
  assert.deepEqual(s.doc.selection.bounds, { x: 0, y: 0, w: 10, h: 10 });
  clearSelectedPixels(s, META);

  // Direct test of clipPixelsToSelection leaving unselected pixels intact.
  const before = solid(4, 4, [10, 20, 30, 255]);
  const after = solid(4, 4, [200, 200, 200, 255]);
  const miniSel = createSelection(4, 4, rectSelectionData(4, 4, { x: 1, y: 1, w: 2, h: 2 }));
  clipPixelsToSelection(after, before, 0, 0, miniSel);
  assert.deepEqual([...after.data.slice(0, 4)], [10, 20, 30, 255]);
  assert.deepEqual([...after.data.slice((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 4)], [200, 200, 200, 255]);
});

test('layer groups: group, ungroup, cycle protection, duplicate subtree, delete group, .novaart & SVG round-trip', async () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 12, height: 12 });
  const a = createLayer(s.doc, 'pixel', { name: 'A' });
  insertLayer(s.doc, a, 1);
  s.doc.activeLayerId = a.id;

  const gr = groupLayer(s, a.id, META);
  assert.equal(gr.ok, true);
  const g = gr.layer;
  assert.equal(g.kind, 'group');
  assert.equal(g.blend, 'pass-through');
  assert.equal(blendLabel(g), 'Pass Through');
  assert.equal(toPsdBlend(g), 'pass through');
  assert.equal(a.parentId, g.id);
  assert.equal(layerDepth(s.doc, a), 1);

  assert.equal(setLayerParent(s, g.id, g.id, META).ok, false, 'cannot parent group into itself');

  const dup = duplicateLayer(s, g.id, META);
  assert.equal(dup.ok, true);
  assert.equal(dup.layer.kind, 'group');
  assert.equal(s.doc.layers.filter(l => l.parentId === dup.layer.id).length, 1);

  // .novaart pack & unpack keeps groups & parentId
  const blob = await packProject(s.doc, { thumbnail: false });
  const back = await unpackProject(blob);
  const backGroup = back.layers.find(l => l.id === g.id);
  assert.equal(backGroup.kind, 'group');
  assert.equal(back.layers.find(l => l.id === a.id).parentId, g.id);

  // SVG exports nested <g> for group
  const svg = await writeSvg(s.doc, { pngDataUrl: async () => 'data:image/png;base64,AA', measure: t => t.length * 6, bake: () => new ArraySurface(1, 1) });
  assert.match(svg, new RegExp(`<g id="l-${g.id}"[^>]*inkscape:label="Group 1"[^>]*><g id="l-${a.id}"`));

  // Copy group to another document copies group + child cleanly
  const other = store.newDocument({ width: 12, height: 12 });
  const copied = copyLayerToDocument(s, g.id, other, META);
  assert.equal(copied.ok, true);
  assert.equal(other.doc.layers.filter(l => l.parentId === copied.layer.id).length, 1);

  // Deleting group removes group and child, undo restores both
  assert.equal(deleteLayer(s, g.id, META).ok, true);
  assert.equal(s.doc.layers.some(l => l.id === a.id), false);
  s.history.undo();
  assert.equal(s.doc.layers.some(l => l.id === a.id), true);

  // Ungroup promotes child out cleanly
  assert.equal(ungroupLayer(s, g.id, META).ok, true);
  assert.equal(a.parentId, null);
  assert.equal(s.doc.layers.some(l => l.id === g.id), false);
  s.history.undo();
  assert.equal(a.parentId, g.id);
});

test('PSD export and re-import round-trips hierarchical layer groups', () => {
  const doc = createDocument({ name: 'Grouped', width: 8, height: 8 });
  const group = createLayer(doc, 'group', { name: 'Folder', opacity: 0.8, blend: 'screen' });
  const inner = createLayer(doc, 'pixel', { name: 'Inner', parentId: group.id, surface: new ArraySurface(2, 2), x: 1, y: 1 });
  insertLayer(doc, inner, 1);
  insertLayer(doc, group, 2);

  const empty = { width: doc.width, height: doc.height, data: new Uint8ClampedArray(doc.width * doc.height * 4) };
  const bytes = new Uint8Array(writePsdFile(doc, { flatten: () => ({ read: () => empty }) }));
  const { doc: back, report } = readPsdFile(bytes);
  assert.deepEqual(report, []);
  const bg = back.layers.find(l => l.name === 'Folder');
  const bi = back.layers.find(l => l.name === 'Inner');
  assert.equal(bg.kind, 'group');
  assert.equal(bg.blend, 'screen');
  assert.ok(Math.abs(bg.opacity - 0.8) < 0.01);
  assert.equal(bi.parentId, bg.id);
});

test('oversized PSD dimensions (>16384 px) downscale proportionally with a report instead of throwing', () => {
  const bytes = new Uint8Array(writePsd({
    width: 100, height: 50,
    imageData: solid(100, 50, [255, 255, 255, 255]),
    children: [{ name: 'Layer', left: 20, top: 10, imageData: solid(20, 10, [0, 128, 255, 255]) }],
  }, { generateThumbnail: false, noBackground: true }));
  // Patch PSD big-endian uint32 header height=32768 (bytes 14..17) and width=32768 (bytes 18..21)?
  // Wait: ag-psd reads channel data matching actual image dimensions, so verify resamplePixels + fit check
  // on a real >16384 PSD header where image data stays empty/small:
  const emptyPsd = new Uint8Array(writePsd({ width: 20000, height: 10000, children: [] }, { generateThumbnail: false, noBackground: true }));
  const { doc, report } = readPsdFile(emptyPsd);
  assert.ok(doc.width <= MAX_SIDE && doc.height <= MAX_SIDE);
  assert.deepEqual([doc.width, doc.height], [16384, 8192]);
  assert.match(report[0], /Scaled down from 20000×10000 to 16384×8192/);

  // And verify bilinear resamplePixels halves dimensions accurately
  const src = { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4).fill(200) };
  const half = resamplePixels(src, 2, 2);
  assert.deepEqual([half.width, half.height, half.data[0]], [2, 2, 200]);
  assert.ok(bytes.length > 0);
});

test('Phase 2 tool shortcuts and Ctrl shortcuts resolve without breaking unmodified studio keys', () => {
  for (const [k, id] of [['m', 'marquee'], ['l', 'lasso'], ['w', 'wand'], ['c', 'crop']]) {
    assert.ok(TOOLS[id], `${id} registered`);
    assert.equal(toolForKey({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false }), id);
  }
  assert.equal(ctrlActionFor({ key: 'a', ctrlKey: true }), 'selectAll');
  assert.equal(ctrlActionFor({ key: 'd', ctrlKey: true }), 'deselect');
  assert.equal(ctrlActionFor({ key: 'i', ctrlKey: true, shiftKey: true }), 'invertSelection');
  assert.equal(ctrlActionFor({ key: 'g', ctrlKey: true }), 'group');
  assert.equal(ctrlActionFor({ key: 'g', ctrlKey: true, shiftKey: true }), 'ungroup');
  assert.equal(ctrlActionFor({ key: 'c', ctrlKey: true }), 'copy');
  assert.equal(ctrlActionFor({ key: 'x', ctrlKey: true }), 'cut');
  assert.equal(ctrlActionFor({ key: 'v', ctrlKey: true }), 'paste');
  assert.equal(studioActionFor({ key: 'Delete', ctrlKey: false, metaKey: false, altKey: false }), 'clearSelection');
});

