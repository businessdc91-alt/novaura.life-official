import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coversDesktop,
  anyCovers,
  SIDEBAR_Z_LEFT,
  SIDEBAR_Z_RIGHT,
  SIDEBAR_Z_DEMOTED,
} from '../../src/components/desktop/windowLayering.js';

test('coversDesktop: a maximized, visible window covers the desktop', () => {
  assert.equal(coversDesktop({ maximized: true, minimized: false }), true);
});

test('coversDesktop: a maximized window that is minimized covers nothing (sidebars return)', () => {
  // The non-obvious edge: minimizing a maximized window must bring the sidebars back.
  assert.equal(coversDesktop({ maximized: true, minimized: true }), false);
});

test('coversDesktop: a normal or absent window never covers the desktop', () => {
  assert.equal(coversDesktop({ maximized: false, minimized: false }), false);
  assert.equal(coversDesktop(null), false);
  assert.equal(coversDesktop(undefined), false);
});

test('anyCovers: true only when at least one window covers the desktop', () => {
  assert.equal(anyCovers(new Set()), false);
  assert.equal(anyCovers(new Set(['w1'])), true);
  assert.equal(anyCovers([]), false);
  assert.equal(anyCovers(['a', 'b']), true);
  assert.equal(anyCovers(null), false);
});

test('demoted sidebar z sits below the window layer; defaults sit above it', () => {
  // WindowManager hands windows z-indexes in roughly the 100..7000 range.
  assert.ok(SIDEBAR_Z_DEMOTED < 100, 'demoted must be below the window layer');
  assert.ok(SIDEBAR_Z_LEFT > 7000, 'left default must be above the window layer');
  assert.ok(SIDEBAR_Z_RIGHT > 7000, 'right default must be above the window layer');
});
