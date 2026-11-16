// Per-document history: undo, redo, merging, branching, jumping and the memory budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, compoundStep } from '../../src/creative/history.js';

// A step that changes box.value from `from` to `to`; the change is made when created,
// as the editor does before pushing.
function change(box, to, extra = {}) {
  const from = box.value;
  box.value = to;
  const step = {
    label: extra.label || `set ${to}`, tab: extra.tab || 'paint', bytes: extra.bytes ?? 64,
    mergeKey: extra.mergeKey, mergeWindowMs: extra.mergeWindowMs,
    apply() { box.value = to; },
    revert() { box.value = from; },
  };
  // Merging keeps the first step's starting value and the newest step's result.
  step.mergeWith = function mergeWith(newer) {
    const merged = { ...newer, revert: () => { box.value = from; } };
    merged.mergeWith = mergeWith;
    return merged;
  };
  return step;
}

test('undo/redo walks the steps and reports the step', () => {
  const box = { value: 0 };
  const h = createHistory();
  h.push(change(box, 1, { label: 'one' }));
  h.push(change(box, 2, { label: 'two' }));
  assert.equal(h.undo().label, 'two');
  assert.equal(box.value, 1);
  assert.equal(h.undo().label, 'one');
  assert.equal(box.value, 0);
  assert.equal(h.undo(), null);
  assert.equal(h.canUndo(), false);
  assert.equal(h.redo().label, 'one');
  assert.equal(box.value, 1);
  assert.equal(h.redo().label, 'two');
  assert.equal(box.value, 2);
  assert.equal(h.redo(), null);
  assert.equal(h.canRedo(), false);
});

test('push after undo drops the undone steps', () => {
  const box = { value: 0 };
  const h = createHistory();
  h.push(change(box, 1));
  h.push(change(box, 2));
  h.undo();
  h.push(change(box, 5));
  assert.equal(h.steps.length, 2);
  assert.equal(h.canRedo(), false);
  h.undo();
  assert.equal(box.value, 1);
});

test('merge: same mergeKey merges into one step; undo reverts to the value before the first', () => {
  const box = { value: 100 };
  const h = createHistory();
  for (const v of [90, 70, 40]) h.push(change(box, v, { mergeKey: 'opacity:a:drag1', label: 'Opacity' }));
  assert.equal(h.steps.length, 1);
  assert.equal(box.value, 40);
  h.undo();
  assert.equal(box.value, 100);
  h.redo();
  assert.equal(box.value, 40);
  h.push(change(box, 20, { mergeKey: 'opacity:a:drag2' }));
  assert.equal(h.steps.length, 2);
});

test('merge window: nudges 400 ms apart merge, 600 ms apart do not', () => {
  const box = { value: 0 };
  let t = 1000;
  const h = createHistory({ now: () => t });
  h.push(change(box, 1, { mergeKey: 'nudge:a', mergeWindowMs: 500 }));
  t += 400;
  h.push(change(box, 2, { mergeKey: 'nudge:a', mergeWindowMs: 500 }));
  assert.equal(h.steps.length, 1);
  t += 600;
  h.push(change(box, 3, { mergeKey: 'nudge:a', mergeWindowMs: 500 }));
  assert.equal(h.steps.length, 2);
});

test('no merge into a step that was undone', () => {
  const box = { value: 0 };
  const h = createHistory();
  h.push(change(box, 1, { mergeKey: 'k' }));
  h.undo();
  h.push(change(box, 2, { mergeKey: 'k' }));
  assert.equal(h.steps.length, 1);
  h.undo();
  assert.equal(box.value, 0);
});

test('budget drops the oldest steps but always keeps the newest', () => {
  const box = { value: 0 };
  const h = createHistory({ budgetBytes: 250 });
  for (const v of [1, 2, 3]) h.push(change(box, v, { bytes: 100, label: `s${v}` }));
  assert.deepEqual(h.steps.map(s => s.label), ['s2', 's3']);
  assert.equal(h.cursor, 2);
  assert.equal(h.totalBytes(), 200);

  const tiny = createHistory({ budgetBytes: 10 });
  tiny.push(change(box, 9, { bytes: 1000, label: 'huge' }));
  assert.deepEqual(tiny.steps.map(s => s.label), ['huge']);

  const later = createHistory();
  for (const v of [1, 2, 3]) later.push(change(box, v, { bytes: 100 }));
  later.setBudget(150);
  assert.equal(later.steps.length, 1);
});

test('jumpTo(1) from cursor 3 reverts two steps, in order', () => {
  const box = { value: 0 };
  const order = [];
  const h = createHistory();
  for (const v of [1, 2, 3]) {
    const s = change(box, v);
    const revert = s.revert;
    s.revert = () => { order.push(v); revert(); };
    h.push(s);
  }
  h.jumpTo(1);
  assert.deepEqual(order, [3, 2]);
  assert.equal(box.value, 1);
  assert.equal(h.cursor, 1);
  h.jumpTo(3);
  assert.equal(box.value, 3);
});

test('subscribe fires on push/undo/redo/jump and version increases', () => {
  const box = { value: 0 };
  const h = createHistory();
  let calls = 0;
  const stop = h.subscribe(() => { calls++; });
  const v0 = h.version;
  h.push(change(box, 1));
  h.push(change(box, 2));
  h.undo();
  h.redo();
  h.jumpTo(0);
  assert.equal(calls, 5);
  assert.ok(h.version >= v0 + 5);
  stop();
  h.redo();
  assert.equal(calls, 5);
});

test('compoundStep reverts in reverse order', () => {
  const order = [];
  const part = id => ({ bytes: 10, apply: () => order.push(`apply ${id}`), revert: () => order.push(`revert ${id}`) });
  const step = compoundStep([part('a'), part('b')], { label: 'Brush stroke', tab: 'paint' });
  assert.equal(step.label, 'Brush stroke');
  assert.equal(step.tab, 'paint');
  assert.equal(step.bytes, 20);
  step.revert();
  step.apply();
  assert.deepEqual(order, ['revert b', 'revert a', 'apply a', 'apply b']);
});
