// The background keeps moving while another app has focus unless the pause setting is on.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = { hidden: false, focused: true };
const listeners = new Map();
const on = (type, fn) => listeners.set(type, fn);
globalThis.document = {
  get hidden() { return page.hidden; },
  hasFocus: () => page.focused,
  addEventListener: on,
  removeEventListener: () => {},
};
globalThis.window = { addEventListener: on, removeEventListener: () => {} };
let frames = 0;
globalThis.requestAnimationFrame = () => ++frames;
globalThis.cancelAnimationFrame = () => {};

const { isAppActive, runPacedLoop } = await import('../../src/components/backgrounds/backgroundPacing.js');

test('another app in front pauses only with the setting on; minimized always pauses', () => {
  page.hidden = false; page.focused = false;
  assert.equal(isAppActive(), true);
  assert.equal(isAppActive(false), true);
  assert.equal(isAppActive(true), false);
  page.hidden = true; page.focused = false;
  assert.equal(isAppActive(false), false);
  page.hidden = false; page.focused = true;
  assert.equal(isAppActive(true), true);
});

test('the loop follows the setting when focus leaves', () => {
  let pause = false;
  page.hidden = false; page.focused = true;
  frames = 0;
  const stop = runPacedLoop(() => {}, () => false, () => pause);
  assert.equal(frames, 1); // started
  page.focused = false;
  listeners.get('focus')(); // a sync with focus gone: keeps running, no restart needed
  assert.equal(frames, 1);
  pause = true;
  listeners.get('focus')(); // now it stops
  page.focused = true;
  listeners.get('focus')(); // and starts again when the app is back
  assert.equal(frames, 2);
  stop();
});
