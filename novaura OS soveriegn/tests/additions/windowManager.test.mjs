import { test } from 'node:test';
import assert from 'node:assert/strict';
import WindowManager from '../../src/kernel/subsystems/WindowManager.js';

test('setTitle changes the title', () => {
  const wm = new WindowManager();
  const win = wm.open('user_notes', 'Notes');
  const seen = [];
  wm.subscribe((all) => seen.push(all.map((w) => w.title)));
  wm.setTitle(win.id, 'Notes — Groceries');
  assert.equal(wm.getById(win.id).title, 'Notes — Groceries');
  assert.deepEqual(seen, [['Notes — Groceries']]);
  wm.setTitle('no_such_window', 'x');
  assert.equal(seen.length, 1);
});
