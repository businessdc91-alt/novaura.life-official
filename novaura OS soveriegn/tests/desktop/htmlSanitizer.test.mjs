// Content from other people can't lift itself out of its box to pose as an OS dialog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanStyle, cleanClass } from '../../src/services/htmlSanitizer.js';

test('positioning, stacking and transforms are dropped from styles', () => {
  assert.equal(cleanStyle('position: fixed; inset: 0; z-index: 9999; color: red'), 'color: red');
  assert.equal(cleanStyle('transform: translate(-50%, -50%); font-weight: bold'), 'font-weight: bold');
  assert.equal(cleanStyle('background: url(https://x/y.png); text-align: center'), 'text-align: center');
});

test('the OS utility classes that position things are dropped, others kept', () => {
  assert.equal(cleanClass('fixed inset-0 z-50 bg-black text-white'), 'inset-0 bg-black text-white');
  assert.equal(cleanClass('md:absolute hover:z-[9999] -top-4 w-screen h-screen p-4'), '-top-4 p-4');
  assert.equal(cleanClass('scene-break end-of-chapter italic'), 'scene-break end-of-chapter italic');
  assert.equal(cleanClass('!fixed translate-x-1/2'), '');
});
