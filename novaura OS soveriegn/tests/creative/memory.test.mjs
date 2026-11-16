// Memory budgets sized to the PC, saved overrides, and what open documents use.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { budgetsFor, loadBudgets, usage, SETTINGS_KEY } from '../../src/creative/memory.js';
import { createStudioStore } from '../../src/creative/studioStore.js';
import { addLayer, addMask, setLayerProps } from '../../src/creative/edits.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const GiB = 2 ** 30;

test('budgetsFor(16) → history 2 GiB, warn 8 GiB', () => {
  assert.deepEqual(budgetsFor(16), { ramGB: 16, historyBytes: 2 * GiB, warnBytes: 8 * GiB });
});

test('budgetsFor(64) → history 8 GiB', () => {
  assert.equal(budgetsFor(64).historyBytes, 8 * GiB);
  assert.equal(budgetsFor(64).warnBytes, 32 * GiB);
});

test('loadBudgets reads the RAM from the hardware check', async () => {
  const b = await loadBudgets({ evaluate: async () => ({ detected: { ramGB: 32 } }), getSetting: async (k, d) => d });
  assert.deepEqual(b, budgetsFor(32));
});

test('loadBudgets falls back to 16 GB when evaluate throws', async () => {
  const b = await loadBudgets({ evaluate: async () => { throw new Error('no native'); }, getSetting: async (k, d) => d });
  assert.deepEqual(b, budgetsFor(16));
  const missing = await loadBudgets({ evaluate: async () => ({ detected: {} }), getSetting: async (k, d) => d });
  assert.deepEqual(missing, budgetsFor(16));
});

test('saved overrides win', async () => {
  const seen = [];
  const b = await loadBudgets({
    evaluate: async () => ({ detected: { ramGB: 16 } }),
    getSetting: async (key, def) => { seen.push(key); return { historyBytes: 5 * GiB }; },
  });
  assert.equal(SETTINGS_KEY, 'creative_studio_settings_v1');
  assert.deepEqual(seen, ['creative_studio_settings_v1']);
  assert.equal(b.historyBytes, 5 * GiB);
  assert.equal(b.warnBytes, 8 * GiB);
});

test('usage sums surfaces, masks and history bytes across sessions', () => {
  const store = createStudioStore();
  const a = store.newDocument({ width: 10, height: 10 });
  const b = store.newDocument({ width: 20, height: 5 });
  addLayer(a, 'pixel', {}, { tab: 'paint' });
  addMask(b, b.doc.layers[0].id, true, { tab: 'paint' });
  setLayerProps(b, b.doc.layers[0].id, { opacity: 0.5 }, { tab: 'paint' });
  const u = usage(store.getState().sessions);
  assert.equal(u.layers, 10 * 10 * 4 * 2 + 20 * 5 * 4 * 2);
  assert.equal(u.history, a.history.totalBytes() + b.history.totalBytes());
  assert.equal(u.total, u.layers + u.history);
});
