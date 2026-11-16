// The worker pool in a real browser: same result as one pass, progress, cancelling, adjustments.
import { test, assert } from './harness.js';
import { runFilter, defaultFilterParams } from '../../../src/creative/filters/kernels.js';
import { createFilterPool } from '../../../src/creative/filters/pool.js';
import { applyAdjustmentPixels, defaultParams } from '../../../src/creative/adjustments.js';

function seeded(w, h, seed = 11) {
  let s = seed;
  const data = Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => ((i % 4) === 3 ? 255 : (s = (s * 1103515245 + 12345) >>> 0) >>> 24));
  return { width: w, height: h, data };
}
const copy = p => ({ width: p.width, height: p.height, data: p.data.slice() });

test('the worker pool gives the same bytes as runFilter and reports progress to 1', async () => {
  const pool = createFilterPool({ size: 4 });
  const src = seeded(120, 90);
  const params = { ...defaultFilterParams('unsharp'), amount: 140, radius: 1.6, threshold: 2 };
  const expected = runFilter('unsharp', src, params);
  const progress = [];
  const out = await pool.run('unsharp', copy(src), params, { onProgress: v => progress.push(v) });
  assert.deepEqual([...out.data], [...expected]);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.length > 2, 'progress was reported along the way');
  pool.dispose();
});

test('abort() rejects with AbortError', async () => {
  const pool = createFilterPool({ size: 2 });
  const controller = new AbortController();
  const job = pool.run('reduceNoise', seeded(400, 300), { radius: 6 }, { signal: controller.signal });
  controller.abort();
  let name = null;
  try { await job; } catch (err) { name = err.name; }
  assert.equal(name, 'AbortError');
  pool.dispose();
});

test('adjustments split across workers match the single pass, vignette included', async () => {
  const pool = createFilterPool({ size: 3 });
  const src = seeded(64, 50);
  const params = { ...defaultParams('vignette'), amount: -80 };
  const geom = { docWidth: 64, docHeight: 50, originX: 0, originY: 0 };
  const expected = copy(src);
  applyAdjustmentPixels('vignette', params, expected, geom);
  const out = await pool.runAdjustment('vignette', params, copy(src), geom);
  assert.deepEqual([...out.data], [...expected.data]);
  pool.dispose();
});

test('applying a filter edits the active layer as one step; cancelling leaves it unchanged', async () => {
  const { setSurfaceFactory } = await import('../../../src/creative/surface.js');
  const { createStudioStore } = await import('../../../src/creative/studioStore.js');
  const { surfaceOf } = await import('../../../src/creative/document.js');
  const { applyFilter } = await import('../../../src/creative/applyFilter.js');
  setSurfaceFactory(null);
  const store = createStudioStore();
  const session = store.newDocument({ width: 40, height: 30, background: '#ff0000' });
  const layer = session.doc.layers[0];
  const pool = createFilterPool({ size: 2 });
  const r = await applyFilter(session, 'emboss', { angle: 135, height: 2 }, { pool });
  assert.equal(r.ok, true);
  assert.equal(session.history.steps.length, 1);
  assert.equal(session.history.steps[0].label, 'Emboss');
  assert.equal(session.history.steps[0].tab, 'photo');
  assert.deepEqual([...surfaceOf(session.doc, layer).read(5, 5, 1, 1).data], [128, 128, 128, 255]);
  session.history.undo();
  assert.deepEqual([...surfaceOf(session.doc, layer).read(5, 5, 1, 1).data], [255, 0, 0, 255]);

  const before = [...surfaceOf(session.doc, layer).read(0, 0, 40, 30).data];
  const controller = new AbortController();
  const job = applyFilter(session, 'reduceNoise', { radius: 8 }, { pool, signal: controller.signal });
  controller.abort();
  const cancelled = await job;
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual([...surfaceOf(session.doc, layer).read(0, 0, 40, 30).data], before);
  assert.equal(session.history.steps.length, 1, 'the cancelled filter added no step');
  pool.dispose();
});

test('filters refuse shape and text layers', async () => {
  const { createStudioStore } = await import('../../../src/creative/studioStore.js');
  const { addLayer } = await import('../../../src/creative/edits.js');
  const { applyFilter } = await import('../../../src/creative/applyFilter.js');
  const store = createStudioStore();
  const session = store.newDocument({ width: 10, height: 10 });
  addLayer(session, 'shape', { shape: 'rect', x: 0, y: 0, w: 5, h: 5 }, { tab: 'photo' });
  const r = await applyFilter(session, 'sharpen', {}, { pool: createFilterPool({ size: 1 }) });
  assert.deepEqual(r, { ok: false, reason: 'Only pixel layers can be painted on. Paint its mask, or add a pixel layer.' });
});
