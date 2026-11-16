// Pixel patches: history stores only the tiles an edit touched, before and after.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, createSurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { beginPixelEdit, applyPatch } from '../../src/creative/pixelRecorder.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const solid = (w, h, rgba) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: w, height: h, data };
};
const RED = [255, 0, 0, 255];

test('only touched tiles are stored', () => {
  const s = createSurface(600, 600);
  const rec = beginPixelEdit(s, 256);
  rec.touch(10, 10, 5, 5);
  s.write(10, 10, solid(5, 5, RED));
  const patch = rec.finish();
  assert.equal(patch.tiles.length, 1);
  assert.equal(patch.bytes, 256 * 256 * 4 * 2);
  assert.deepEqual(patch.rect, { x: 0, y: 0, w: 256, h: 256 });
});

test('edge tiles are clipped', () => {
  const s = createSurface(600, 600);
  const rec = beginPixelEdit(s, 256);
  rec.touch(590, 5, 20, 5);
  s.write(590, 5, solid(10, 5, RED));
  const [tile] = rec.finish().tiles;
  assert.equal(tile.x, 512);
  assert.equal(tile.w, 88);
  assert.equal(tile.h, 256);
});

test('a touch spanning tiles stores each of them', () => {
  const s = createSurface(600, 600);
  const rec = beginPixelEdit(s, 256);
  rec.touch(250, 250, 10, 10);
  s.write(250, 250, solid(10, 10, RED));
  assert.equal(rec.finish().tiles.length, 4);
});

test('unchanged tiles are dropped and nothing changed gives null', () => {
  const s = createSurface(600, 600);
  const rec = beginPixelEdit(s, 256);
  rec.touch(0, 0, 600, 600);
  s.write(300, 300, solid(1, 1, RED));
  const patch = rec.finish();
  assert.equal(patch.tiles.length, 1);
  assert.equal(patch.tiles[0].x, 256);

  const idle = beginPixelEdit(s, 256);
  idle.touch(0, 0, 50, 50);
  assert.equal(idle.finish(), null);
  assert.equal(beginPixelEdit(s, 256).finish(), null);
});

test('before/after round-trip', () => {
  const s = createSurface(300, 300);
  s.write(0, 0, solid(300, 300, [10, 20, 30, 255]));
  const original = s.read(0, 0, 300, 300).data.slice();
  const rec = beginPixelEdit(s, 128);
  rec.touch(100, 100, 150, 150);
  s.write(100, 100, solid(150, 150, RED));
  const edited = s.read(0, 0, 300, 300).data.slice();
  const patch = rec.finish();
  applyPatch(s, patch, 'before');
  assert.deepEqual(s.read(0, 0, 300, 300).data, original);
  applyPatch(s, patch, 'after');
  assert.deepEqual(s.read(0, 0, 300, 300).data, edited);
});

test('touch saves the original only the first time', () => {
  const s = createSurface(64, 64);
  const rec = beginPixelEdit(s, 64);
  rec.touch(0, 0, 4, 4);
  s.write(0, 0, solid(4, 4, RED));
  rec.touch(0, 0, 4, 4);
  s.write(0, 0, solid(4, 4, [0, 255, 0, 255]));
  const patch = rec.finish();
  applyPatch(s, patch, 'before');
  assert.deepEqual([...s.read(0, 0, 1, 1).data], [0, 0, 0, 0]);
});

test('touches outside the surface are ignored', () => {
  const s = createSurface(64, 64);
  const rec = beginPixelEdit(s, 32);
  rec.touch(-50, -50, 10, 10);
  rec.touch(100, 100, 10, 10);
  assert.equal(rec.finish(), null);
});
