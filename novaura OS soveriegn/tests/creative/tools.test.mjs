// Paint tools, the parts that are pure logic: dab spacing, pressure, flood fill, moving, and tool keys.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { createStudioStore } from '../../src/creative/studioStore.js';
import { setLayerProps } from '../../src/creative/edits.js';
import { dabPositions, dabSize } from '../../src/creative/tools/brush.js';
import { floodFill } from '../../src/creative/tools/fill.js';
import { toolForKey, toolContext, TOOLS } from '../../src/creative/tools/index.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

test('dabPositions spaces dabs evenly', () => {
  const { points, carry } = dabPositions({ x: 0, y: 0 }, { x: 10, y: 0 }, 2, 0);
  assert.deepEqual(points.map(p => p.x), [0, 2, 4, 6, 8, 10]);
  assert.ok(points.every(p => p.y === 0));
  assert.equal(carry, 2);
});

test('carry continues spacing across segments', () => {
  const a = dabPositions({ x: 0, y: 0 }, { x: 3, y: 0 }, 2, 0);
  const b = dabPositions({ x: 3, y: 0 }, { x: 6, y: 0 }, 2, a.carry);
  assert.deepEqual([...a.points, ...b.points].map(p => p.x), [0, 2, 4, 6]);
});

test('dabPositions interpolates pressure along the segment', () => {
  const { points } = dabPositions({ x: 0, y: 0, pressure: 0 }, { x: 4, y: 0, pressure: 1 }, 2, 0);
  assert.deepEqual(points.map(p => p.pressure), [0, 0.5, 1]);
});

test('dabSize: pressure 0.5 halves size when on, ignored when off, minimum 1', () => {
  assert.equal(dabSize(20, 0.5, true), 10);
  assert.equal(dabSize(20, 0.5, false), 20);
  assert.equal(dabSize(20, 0, true), 1);
  assert.equal(dabSize(1, 0.1, true), 1);
});

function grid(rows) {
  // rows of single chars: '.' white, '#' black, 'r' red
  const colours = { '.': [255, 255, 255, 255], '#': [0, 0, 0, 255], r: [255, 0, 0, 255], g: [0, 200, 0, 255] };
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => data.set(colours[ch], (y * width + x) * 4)));
  return { width, height, data };
}
const charAt = (p, x, y) => {
  const i = (y * p.width + x) * 4;
  const c = [...p.data.slice(i, i + 4)].join(',');
  return { '255,255,255,255': '.', '0,0,0,255': '#', '255,0,0,255': 'r', '0,200,0,255': 'g' }[c] || '?';
};
const render = p => Array.from({ length: p.height }, (_, y) => Array.from({ length: p.width }, (_, x) => charAt(p, x, y)).join(''));

test('floodFill fills a contiguous region within tolerance and returns its rect', () => {
  const p = grid(['..#..', '..#..', '..#..']);
  const rect = floodFill(p, 0, 0, [255, 0, 0, 255], { tolerance: 0, contiguous: true });
  assert.deepEqual(render(p), ['rr#..', 'rr#..', 'rr#..']);
  assert.deepEqual(rect, { x: 0, y: 0, w: 2, h: 3 });
});

test('floodFill tolerance includes near colours', () => {
  const nearWhite = () => {
    const p = grid(['..', '..']);
    p.data.set([250, 250, 250, 255], 4); // pixel (1,0) is 5 away from white
    return p;
  };
  const wide = nearWhite();
  floodFill(wide, 0, 0, [0, 200, 0, 255], { tolerance: 5, contiguous: true });
  assert.deepEqual(render(wide), ['gg', 'gg']);
  const tight = nearWhite();
  floodFill(tight, 0, 0, [0, 200, 0, 255], { tolerance: 4, contiguous: true });
  assert.deepEqual(render(tight), ['g?', 'gg'], 'the near-white pixel is left alone');
});

test('floodFill non-contiguous fills all matching pixels', () => {
  const p = grid(['..#..', '..#..']);
  const rect = floodFill(p, 0, 0, [255, 0, 0, 255], { tolerance: 0, contiguous: false });
  assert.deepEqual(render(p), ['rr#rr', 'rr#rr']);
  assert.deepEqual(rect, { x: 0, y: 0, w: 5, h: 2 });
});

test('floodFill samples another image when sample is given', () => {
  const target = grid(['....', '....']);
  const sample = grid(['..#.', '..#.']);
  floodFill(target, 0, 0, [255, 0, 0, 255], { tolerance: 0, contiguous: true, sample });
  assert.deepEqual(render(target), ['rr..', 'rr..']);
});

test('floodFill outside the image does nothing', () => {
  const p = grid(['..']);
  assert.equal(floodFill(p, 5, 5, [255, 0, 0, 255], { tolerance: 0, contiguous: true }), null);
});

function moveSetup() {
  const store = createStudioStore();
  const session = store.newDocument({ width: 20, height: 20 });
  const notes = [];
  const ctx = toolContext(store, { notify: m => notes.push(m), requestRender: () => {} });
  return { store, session, ctx, notes, layer: session.doc.layers[0] };
}

test('move tool: arrow nudges 1 px, Shift 10 px, and nudges within 500 ms merge', () => {
  const { session, ctx, layer } = moveSetup();
  const move = TOOLS.move;
  assert.equal(move.key(ctx, { key: 'ArrowRight', shiftKey: false }), true);
  assert.equal(move.key(ctx, { key: 'ArrowDown', shiftKey: true }), true);
  assert.equal(move.key(ctx, { key: 'ArrowLeft', shiftKey: false }), true);
  assert.deepEqual([layer.x, layer.y], [0, 10]);
  assert.equal(session.history.steps.length, 1);
  session.history.undo();
  assert.deepEqual([layer.x, layer.y], [0, 0]);
  assert.equal(move.key(ctx, { key: 'q', shiftKey: false }), false);
});

test('move tool drag moves by the pointer offset as one step', () => {
  const { session, ctx, layer } = moveSetup();
  const move = TOOLS.move;
  move.down(ctx, { x: 5, y: 5, pressure: 1, coalesced: [] });
  move.move(ctx, { x: 8, y: 6, pressure: 1, coalesced: [] });
  move.move(ctx, { x: 12.4, y: 9.6, pressure: 1, coalesced: [] });
  move.up(ctx, { x: 12.4, y: 9.6, pressure: 1, coalesced: [] });
  assert.deepEqual([layer.x, layer.y], [7, 5]);
  assert.equal(session.history.steps.length, 1);
});

test('move on a locked layer notifies the lock reason and changes nothing', () => {
  const { session, ctx, notes, layer } = moveSetup();
  setLayerProps(session, layer.id, { locked: true }, { tab: 'paint' });
  TOOLS.move.key(ctx, { key: 'ArrowRight', shiftKey: false });
  TOOLS.move.down(ctx, { x: 1, y: 1, pressure: 1, coalesced: [] });
  TOOLS.move.move(ctx, { x: 5, y: 5, pressure: 1, coalesced: [] });
  assert.deepEqual([layer.x, layer.y], [0, 0]);
  assert.deepEqual(notes, ['"Background" is locked.', '"Background" is locked.']);
});

test('toolForKey maps B/N/E/G/I/V', () => {
  const key = (k, extra = {}) => toolForKey({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...extra });
  assert.equal(key('b'), 'brush');
  assert.equal(key('B'), 'brush');
  assert.equal(key('n'), 'pencil');
  assert.equal(key('e'), 'eraser');
  assert.equal(key('g'), 'fill');
  assert.equal(key('i'), 'eyedropper');
  assert.equal(key('v'), 'move');
  assert.equal(key('b', { ctrlKey: true }), null);
  assert.equal(key('x'), null);
});
