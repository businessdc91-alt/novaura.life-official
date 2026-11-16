// Shape geometry (paths, bounds, SVG) and the transform handles that edit it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPE_KINDS, defaultShape, shapePathData, shapeBounds, shapeSvg } from '../../src/creative/shapes.js';
import { handlesFor, hitHandle, dragHandle } from '../../src/creative/transformHandles.js';

const rect = (extra = {}) => ({ shape: 'rect', x: 0, y: 0, w: 100, h: 50, rotation: 0, radius: 0, sides: 5, innerRatio: 0.5, fill: '#ff0000', stroke: null, strokeWidth: 0, ...extra });
const vertices = d => (d.match(/[ML]/g) || []).length;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

test('the five shape kinds', () => {
  assert.deepEqual(SHAPE_KINDS, ['rect', 'ellipse', 'line', 'polygon', 'star']);
});

test('defaultShape: filled with the main colour, no outline; a line gets an outline instead', () => {
  const colours = { primary: '#123456', secondary: '#ffffff' };
  const r = defaultShape('rect', { x: 5, y: 6, w: 7, h: 8 }, colours);
  assert.deepEqual(r, { shape: 'rect', x: 5, y: 6, w: 7, h: 8, rotation: 0, radius: 0, sides: 5, innerRatio: 0.5, fill: '#123456', stroke: null, strokeWidth: 0 });
  const line = defaultShape('line', { x1: 1, y1: 2, x2: 30, y2: 40 }, colours);
  assert.equal(line.fill, null);
  assert.equal(line.stroke, '#123456');
  assert.equal(line.strokeWidth, 4);
  assert.deepEqual([line.x1, line.y1, line.x2, line.y2], [1, 2, 30, 40]);
});

test('rect path with radius 0 is M x y H … Z', () => {
  assert.equal(shapePathData(rect({ x: 10, y: 20 })), 'M 10 20 H 110 V 70 H 10 Z');
  const rounded = shapePathData(rect({ radius: 10 }));
  assert.match(rounded, /^M 10 0 H 90 A 10 10 0 0 1 100 10/);
  assert.match(shapePathData(rect({ radius: 999 })), /A 25 25/, 'radius is capped at half the short side');
});

test('ellipse path is two arcs', () => {
  assert.equal(shapePathData({ ...rect(), shape: 'ellipse' }), 'M 0 25 A 50 25 0 1 0 100 25 A 50 25 0 1 0 0 25 Z');
});

test('polygon has sides vertices', () => {
  assert.equal(vertices(shapePathData(rect({ shape: 'polygon', sides: 6 }))), 6);
  assert.equal(vertices(shapePathData(rect({ shape: 'polygon', sides: 3 }))), 3);
});

test('star has 2×points vertices alternating radius', () => {
  const d = shapePathData(rect({ shape: 'star', sides: 5, innerRatio: 0.4, w: 100, h: 100 }));
  assert.equal(vertices(d), 10);
  const pts = [...d.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map(m => Math.hypot(+m[1] - 50, +m[2] - 50));
  assert.ok(near(pts[0], 50, 1e-3) && near(pts[1], 20, 1e-3) && near(pts[2], 50, 1e-3));
});

test('line path', () => {
  assert.equal(shapePathData({ shape: 'line', x1: 1, y1: 2, x2: 3, y2: 4 }), 'M 1 2 L 3 4');
});

test('bounds of a 100×50 rect rotated 90° is 50×100 about the same centre', () => {
  const b = shapeBounds(rect({ rotation: 90 }));
  assert.ok(near(b.x, 25) && near(b.y, -25) && near(b.w, 50) && near(b.h, 100), JSON.stringify(b));
  const outlined = shapeBounds(rect({ stroke: '#000000', strokeWidth: 10 }));
  assert.deepEqual(outlined, { x: -5, y: -5, w: 110, h: 60 });
});

test('handles of an unrotated rect sit on its corners and edge midpoints, with rotate 24 px above n', () => {
  const h = Object.fromEntries(handlesFor(rect()).map(({ id, x, y }) => [id, [Math.round(x), Math.round(y)]]));
  assert.deepEqual(h, {
    nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 25], se: [100, 50], s: [50, 50], sw: [0, 50], w: [0, 25], rotate: [50, -24],
  });
  assert.deepEqual(handlesFor({ shape: 'line', x1: 1, y1: 2, x2: 3, y2: 4 }).map(h => h.id), ['p1', 'p2']);
});

test('hitHandle finds the handle under the pointer, or null', () => {
  assert.equal(hitHandle(rect(), 101, 49, 4), 'se');
  assert.equal(hitHandle(rect(), 50, -22, 4), 'rotate');
  assert.equal(hitHandle(rect(), 40, 30, 4), null);
});

test('dragging se by (10,20) grows w,h by 10,20', () => {
  assert.deepEqual(dragHandle(rect(), 'se', { x: 100, y: 50 }, { x: 110, y: 70 }, {}), { x: 0, y: 0, w: 110, h: 70 });
  assert.deepEqual(dragHandle(rect(), 'nw', { x: 0, y: 0 }, { x: 10, y: 5 }, {}), { x: 10, y: 5, w: 90, h: 45 });
  assert.deepEqual(dragHandle(rect(), 'e', { x: 100, y: 25 }, { x: 120, y: 90 }, {}), { x: 0, y: 0, w: 120, h: 50 });
});

test('dragging past the opposite edge flips instead of going negative', () => {
  const p = dragHandle(rect(), 'e', { x: 100, y: 25 }, { x: -20, y: 25 }, {});
  assert.deepEqual(p, { x: -20, y: 0, w: 20, h: 50 });
});

test('shift-drag keeps aspect', () => {
  assert.deepEqual(dragHandle(rect(), 'se', { x: 100, y: 50 }, { x: 110, y: 100 }, { shift: true }), { x: 0, y: 0, w: 200, h: 100 });
});

test('resizing a rotated shape keeps the opposite corner in place', () => {
  const r = rect({ rotation: 90 });
  const before = handlesFor(r).find(h => h.id === 'nw');
  const patch = dragHandle(r, 'se', { x: 0, y: 0 }, { x: 0, y: 10 }, {});
  const after = handlesFor({ ...r, ...patch }).find(h => h.id === 'nw');
  assert.ok(near(before.x, after.x, 1e-6) && near(before.y, after.y, 1e-6), `${JSON.stringify(before)} vs ${JSON.stringify(after)}`);
  assert.ok(near(patch.w, 110, 1e-6), JSON.stringify(patch));
});

test('rotate handle snaps to 15° with shift', () => {
  const start = { x: 50, y: -25 };
  const now = { x: 50 + 50 * Math.sin(50 * Math.PI / 180), y: 25 - 50 * Math.cos(50 * Math.PI / 180) };
  assert.ok(near(dragHandle(rect(), 'rotate', start, now, {}).rotation, 50, 1e-6));
  assert.equal(dragHandle(rect(), 'rotate', start, now, { shift: true }).rotation, 45);
});

test('dragging a line end moves just that end', () => {
  const line = { shape: 'line', x1: 0, y1: 0, x2: 10, y2: 0 };
  assert.deepEqual(dragHandle(line, 'p2', { x: 10, y: 0 }, { x: 15, y: 5 }, {}), { x2: 15, y2: 5 });
});

test('shapeSvg for a line gives <line x1 y1 x2 y2>', () => {
  const svg = shapeSvg({ shape: 'line', x1: 1, y1: 2, x2: 3, y2: 4, stroke: '#000000', strokeWidth: 2, fill: null });
  assert.match(svg, /^<line x1="1" y1="2" x2="3" y2="4"/);
  assert.match(svg, /stroke="#000000"/);
  assert.match(shapeSvg(rect({ rotation: 30 })), /^<rect x="0" y="0" width="100" height="50" .*transform="rotate\(30 50 25\)"/);
  assert.match(shapeSvg({ ...rect(), shape: 'ellipse' }), /^<ellipse cx="50" cy="25" rx="50" ry="25"/);
  assert.match(shapeSvg(rect({ shape: 'star' })), /^<path d="M /);
  assert.match(shapeSvg(rect()), /fill="#ff0000"/);
  assert.match(shapeSvg(rect()), /stroke="none"/);
});
