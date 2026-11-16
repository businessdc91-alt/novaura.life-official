// The canvas view's maths (screen ↔ document, fit, zoom) and the studio's keyboard shortcuts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenToDoc, fitView, zoomAt, ZOOM_MIN, ZOOM_MAX } from '../../src/creative/view.js';
import { shouldHandleShortcut, historyActionFor, studioActionFor, nextBrushSize } from '../../src/creative/shortcuts.js';

test('screenToDoc at zoom 2, pan (30,40), rect at (100,50)', () => {
  const view = { zoom: 2, panX: 30, panY: 40 };
  assert.deepEqual(screenToDoc({ clientX: 160, clientY: 140 }, view, { left: 100, top: 50 }), { x: 15, y: 25 });
});

test('screenToDoc is unaffected by devicePixelRatio 1.5', () => {
  const rect = { left: 10, top: 20 };
  const at1 = screenToDoc({ clientX: 210, clientY: 120 }, { zoom: 0.5, panX: 0, panY: 0, dpr: 1 }, rect);
  const at15 = screenToDoc({ clientX: 210, clientY: 120 }, { zoom: 0.5, panX: 0, panY: 0, dpr: 1.5 }, rect);
  assert.deepEqual(at1, { x: 400, y: 200 });
  assert.deepEqual(at15, at1);
});

test('fitView centres and fits', () => {
  const v = fitView(200, 100, 600, 400);
  assert.ok(Math.abs(v.zoom - 2.76) < 1e-9);
  assert.ok(Math.abs(v.panX - 24) < 1e-9);
  assert.ok(Math.abs(v.panY - 62) < 1e-9);
  const big = fitView(10000, 5000, 600, 400);
  assert.ok(big.zoom >= ZOOM_MIN);
});

test('zoomAt keeps the anchor point fixed and clamps to 0.1–32', () => {
  const view = { zoom: 1, panX: 10, panY: 20 };
  const anchor = { x: 110, y: 70 };
  const before = screenToDoc({ clientX: anchor.x, clientY: anchor.y }, view, { left: 0, top: 0 });
  const zoomed = zoomAt(view, 2, anchor);
  assert.equal(zoomed.zoom, 2);
  assert.deepEqual(screenToDoc({ clientX: anchor.x, clientY: anchor.y }, zoomed, { left: 0, top: 0 }), before);
  assert.equal(zoomAt(view, 1000, anchor).zoom, ZOOM_MAX);
  assert.equal(zoomAt(view, 0.0001, anchor).zoom, ZOOM_MIN);
  assert.equal(ZOOM_MIN, 0.1);
  assert.equal(ZOOM_MAX, 32);
});

const key = (k, extra = {}) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target: { tagName: 'DIV', isContentEditable: false }, ...extra });

test('shouldHandleShortcut is false for INPUT, TEXTAREA, SELECT and contentEditable targets', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(shouldHandleShortcut(key('z', { ctrlKey: true, target: { tagName } })), false, tagName);
  assert.equal(shouldHandleShortcut(key('z', { ctrlKey: true, target: { tagName: 'DIV', isContentEditable: true } })), false);
  assert.equal(shouldHandleShortcut(key('z', { ctrlKey: true })), true);
  assert.equal(shouldHandleShortcut(key('z', { ctrlKey: true, target: null })), true);
});

test('historyActionFor maps Ctrl+Z → undo, Ctrl+Shift+Z and Ctrl+Y → redo, plain Z → null', () => {
  assert.equal(historyActionFor(key('z', { ctrlKey: true })), 'undo');
  assert.equal(historyActionFor(key('Z', { ctrlKey: true, shiftKey: true })), 'redo');
  assert.equal(historyActionFor(key('y', { ctrlKey: true })), 'redo');
  assert.equal(historyActionFor(key('z', { metaKey: true })), 'undo');
  assert.equal(historyActionFor(key('z')), null);
  assert.equal(historyActionFor(key('y')), null);
});

test('studioActionFor maps X, [ and ]', () => {
  assert.equal(studioActionFor(key('x')), 'swapColours');
  assert.equal(studioActionFor(key('X')), 'swapColours');
  assert.equal(studioActionFor(key('[')), 'brushSmaller');
  assert.equal(studioActionFor(key(']')), 'brushLarger');
  assert.equal(studioActionFor(key('x', { ctrlKey: true })), null);
  assert.equal(studioActionFor(key('q')), null);
});

test('[ and ] step the brush size by 10%, at least 1, within 1–500', () => {
  assert.equal(nextBrushSize(100, +1), 110);
  assert.equal(nextBrushSize(100, -1), 90);
  assert.equal(nextBrushSize(3, +1), 4);
  assert.equal(nextBrushSize(1, -1), 1);
  assert.equal(nextBrushSize(495, +1), 500);
});
