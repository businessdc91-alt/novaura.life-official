// worker.js — A filter worker: runs one strip of a filter or an adjustment and sends the rows back.

import { runFilter } from './kernels.js';
import { applyAdjustmentPixels } from '../adjustments.js';

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.kind === 'filter') {
      const rows = runFilter(m.id, m.src, m.params, m.rows, m.meta);
      self.postMessage({ job: m.job, index: m.index, rows }, [rows.buffer]);
    } else {
      applyAdjustmentPixels(m.type, m.params, m.pixels, m.geom);
      self.postMessage({ job: m.job, index: m.index, rows: m.pixels.data }, [m.pixels.data.buffer]);
    }
  } catch (err) {
    self.postMessage({ job: m.job, index: m.index, error: String(err?.message || err) });
  }
};
