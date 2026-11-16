// pool.js — Run filters and adjustments on every CPU core.
//
// The image is cut into horizontal strips; each goes to a worker with enough rows of
// margin for the filter's reach, so the result is identical to one pass. Long jobs
// report progress and can be cancelled with an AbortSignal.

import { overlapFor } from './kernels.js';

/** Strips covering every row once: [{ y0, y1, srcY0, srcY1 }], with margins clamped to the image. */
export function planStrips(height, count, overlap) {
  const n = Math.max(1, Math.min(count, height));
  const base = Math.floor(height / n);
  const extra = height % n;
  const strips = [];
  let y = 0;
  for (let i = 0; i < n; i++) {
    const rows = base + (i < extra ? 1 : 0);
    strips.push({ y0: y, y1: y + rows, srcY0: Math.max(0, y - overlap), srcY1: Math.min(height, y + rows + overlap) });
    y += rows;
  }
  return strips;
}

const sliceRows = (src, y0, y1) => ({
  width: src.width, height: y1 - y0, data: src.data.slice(y0 * src.width * 4, y1 * src.width * 4),
});

/** Run filter `id` strip by strip through runStrip(id, slice, params, [a, b], { originY }) → rows. */
export async function runInStrips(id, src, params, count, runStrip, onStrip = () => {}) {
  const strips = planStrips(src.height, count, overlapFor(id, params));
  const out = { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data.length) };
  await Promise.all(strips.map(async (s, index) => {
    const rows = await runStrip(id, sliceRows(src, s.srcY0, s.srcY1), params, [s.y0 - s.srcY0, s.y1 - s.srcY0], { originY: s.srcY0 }, index);
    out.data.set(rows, s.y0 * src.width * 4);
    onStrip(index, strips.length);
  }));
  return out;
}

const abortError = () => new DOMException('The filter was cancelled.', 'AbortError');

/** A pool of module workers sized to the CPU. */
export function createFilterPool({ size = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4 } = {}) {
  const workers = [];
  const waiting = new Map(); // `${job}:${index}` → { resolve, reject }
  let nextJob = 0;
  let turn = 0;

  function worker() {
    if (workers.length < size) {
      const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        const { job, index, rows, error } = e.data;
        const key = `${job}:${index}`;
        const pending = waiting.get(key);
        if (!pending) return;
        waiting.delete(key);
        if (error) pending.reject(new Error(error)); else pending.resolve(rows);
      };
      workers.push(w);
      return w;
    }
    return workers[turn++ % workers.length];
  }

  function post(message, transfer) {
    return new Promise((resolve, reject) => {
      waiting.set(`${message.job}:${message.index}`, { resolve, reject });
      worker().postMessage(message, transfer);
    });
  }

  async function runJob(run, { onProgress, signal } = {}) {
    if (signal?.aborted) throw abortError();
    const job = ++nextJob;
    let cancelled = null;
    const onAbort = () => {
      for (const key of [...waiting.keys()]) {
        if (key.startsWith(`${job}:`)) { waiting.get(key).reject(abortError()); waiting.delete(key); }
      }
      cancelled = abortError();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const result = await run(job);
      if (cancelled) throw cancelled;
      onProgress?.(1);
      return result;
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  const stripCount = height => Math.min(height, Math.max(size * 2, 8));

  return {
    size,
    /** Filter a whole image: { width, height, data } → a new one. */
    run(id, src, params, options = {}) {
      return runJob(job => runInStrips(id, src, params, stripCount(src.height), (fid, slice, p, rows, meta, index) => post(
        { job, index, kind: 'filter', id: fid, params: p, src: slice, rows, meta }, [slice.data.buffer],
      ), (done, total) => options.onProgress?.((done + 1) / (total + 1))), options);
    },
    /** A 'lut' or 'pixel' adjustment on an image, split across workers. */
    runAdjustment(type, params, pixels, geom, options = {}) {
      return runJob(async (job) => {
        const strips = planStrips(pixels.height, stripCount(pixels.height), 0);
        const out = { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data.length) };
        await Promise.all(strips.map(async (s, index) => {
          const slice = sliceRows(pixels, s.y0, s.y1);
          const rows = await post({ job, index, kind: 'adjust', type, params, pixels: slice, geom: { ...geom, originY: (geom.originY || 0) + s.y0 } }, [slice.data.buffer]);
          out.data.set(rows, s.y0 * pixels.width * 4);
        }));
        return out;
      }, options);
    },
    dispose() {
      for (const w of workers) w.terminate();
      workers.length = 0;
      waiting.clear();
    },
  };
}

let shared = null;
/** The studio's one pool, made on first use. */
export function sharedFilterPool() {
  if (!shared) shared = createFilterPool();
  return shared;
}
