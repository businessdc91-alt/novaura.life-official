// kernels.js — The pixel filters, as pure functions on RGBA arrays.
//
// runFilter computes just rows y0..y1 of the result, reading neighbours from `src`.
// The worker pool hands each worker a strip of the image plus `overlapFor` rows of
// margin, and `originY` (where the strip starts in the image), so splitting the work
// across cores gives exactly the same pixels as one pass. Edges extend outward.

const range = (min, max, def, step = 1) => ({ min, max, default: def, step });

export const FILTERS = {
  unsharp: { label: 'Unsharp Mask', params: { amount: range(1, 500, 100), radius: range(0.5, 100, 2, 0.1), threshold: range(0, 255, 0) } },
  sharpen: { label: 'Sharpen', params: {} },
  addNoise: { label: 'Add Noise', params: { amount: range(0, 100, 10), mono: { kind: 'bool', default: false }, seed: { kind: 'seed', default: 1 } } },
  reduceNoise: { label: 'Reduce Noise', params: { radius: range(1, 10, 1) } },
  motionBlur: { label: 'Motion Blur', params: { angle: range(-180, 180, 0), distance: range(1, 200, 10) } },
  pixelate: { label: 'Pixelate', params: { cell: range(2, 200, 10) } },
  emboss: { label: 'Emboss', params: { angle: range(-180, 180, 135), height: range(1, 10, 2) } },
  findEdges: { label: 'Find Edges', params: {} },
};

export function defaultFilterParams(id) {
  return Object.fromEntries(Object.entries(FILTERS[id].params).map(([k, p]) => [k, p.default]));
}

/** How many rows of neighbours a filter reads above and below each row. */
export function overlapFor(id, p) {
  switch (id) {
    case 'unsharp': return Math.ceil(3 * p.radius);
    case 'reduceNoise': return p.radius | 0;
    case 'motionBlur': return Math.ceil(p.distance);
    case 'pixelate': return p.cell | 0;
    default: return 1;
  }
}

function hash(seed, x, y, c) {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(c + 1, 83492791)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Rows y0..y1 of filter `id` applied to src, as RGBA bytes. meta.originY: src's first row in the whole image. */
export function runFilter(id, src, p, [y0, y1] = [0, src.height], { originY = 0 } = {}) {
  const { width: W, height: H, data: s } = src;
  const out = new Uint8ClampedArray((y1 - y0) * W * 4);
  const cx = x => (x < 0 ? 0 : x >= W ? W - 1 : x);
  const cy = y => (y < 0 ? 0 : y >= H ? H - 1 : y);
  const idx = (x, y) => (cy(y) * W + cx(x)) * 4;
  const o = (x, y) => ((y - y0) * W + x) * 4;

  switch (id) {
    case 'sharpen':
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < W; x++) {
          const i = idx(x, y);
          const up = idx(x, y - 1); const dn = idx(x, y + 1); const lf = idx(x - 1, y); const rt = idx(x + 1, y);
          const k = o(x, y);
          for (let c = 0; c < 3; c++) out[k + c] = 5 * s[i + c] - s[up + c] - s[dn + c] - s[lf + c] - s[rt + c];
          out[k + 3] = s[i + 3];
        }
      }
      return out;

    case 'findEdges':
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < W; x++) {
          const k = o(x, y);
          for (let c = 0; c < 3; c++) {
            const v = (dx, dy) => s[idx(x + dx, y + dy) + c];
            const gx = v(1, -1) + 2 * v(1, 0) + v(1, 1) - v(-1, -1) - 2 * v(-1, 0) - v(-1, 1);
            const gy = v(-1, 1) + 2 * v(0, 1) + v(1, 1) - v(-1, -1) - 2 * v(0, -1) - v(1, -1);
            out[k + c] = 255 - Math.min(255, Math.sqrt(gx * gx + gy * gy));
          }
          out[k + 3] = s[idx(x, y) + 3];
        }
      }
      return out;

    case 'emboss': {
      const a = (p.angle * Math.PI) / 180;
      const dx = Math.round(Math.cos(a));
      const dy = Math.round(Math.sin(a));
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < W; x++) {
          const fwd = idx(x + dx, y + dy);
          const back = idx(x - dx, y - dy);
          const k = o(x, y);
          for (let c = 0; c < 3; c++) out[k + c] = 128 + p.height * (s[fwd + c] - s[back + c]);
          out[k + 3] = s[idx(x, y) + 3];
        }
      }
      return out;
    }

    case 'addNoise': {
      const spread = p.amount * 2.55;
      for (let y = y0; y < y1; y++) {
        const ay = originY + y;
        for (let x = 0; x < W; x++) {
          const i = idx(x, y);
          const k = o(x, y);
          for (let c = 0; c < 3; c++) {
            const n = (hash(p.seed, x, ay, p.mono ? 0 : c) / 4294967296) * 2 - 1;
            out[k + c] = s[i + c] + n * spread;
          }
          out[k + 3] = s[i + 3];
        }
      }
      return out;
    }

    case 'motionBlur': {
      const count = Math.max(1, Math.round(p.distance));
      const step = p.distance / count;
      const a = (p.angle * Math.PI) / 180;
      const offsets = Array.from({ length: count }, (_, i) => {
        const t = (i - (count - 1) / 2) * step;
        return [Math.round(t * Math.cos(a)), Math.round(t * Math.sin(a))];
      });
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < W; x++) {
          const sum = [0, 0, 0, 0];
          for (const [ox, oy] of offsets) {
            const i = idx(x + ox, y + oy);
            for (let c = 0; c < 4; c++) sum[c] += s[i + c];
          }
          const k = o(x, y);
          for (let c = 0; c < 4; c++) out[k + c] = sum[c] / count;
        }
      }
      return out;
    }

    case 'pixelate': {
      const cell = Math.max(1, p.cell | 0);
      const averages = new Map();
      for (let y = y0; y < y1; y++) {
        const top = Math.floor((originY + y) / cell) * cell - originY;
        for (let x = 0; x < W; x++) {
          const left = Math.floor(x / cell) * cell;
          const key = `${left},${top}`;
          let avg = averages.get(key);
          if (!avg) {
            const sum = [0, 0, 0, 0];
            let n = 0;
            for (let yy = Math.max(0, top); yy < Math.min(H, top + cell); yy++) {
              for (let xx = left; xx < Math.min(W, left + cell); xx++) {
                const i = (yy * W + xx) * 4;
                for (let c = 0; c < 4; c++) sum[c] += s[i + c];
                n++;
              }
            }
            avg = sum.map(v => v / n);
            averages.set(key, avg);
          }
          out.set(avg, o(x, y));
        }
      }
      return out;
    }

    case 'reduceNoise': {
      // Huang's running median: one histogram per channel, slid along the row.
      const r = Math.max(1, p.radius | 0);
      const half = ((2 * r + 1) ** 2) >> 1;
      for (let y = y0; y < y1; y++) {
        for (let c = 0; c < 3; c++) {
          const hist = new Uint32Array(256);
          const column = (x, delta) => {
            for (let dy = -r; dy <= r; dy++) hist[s[idx(x, y + dy) + c]] += delta;
          };
          for (let dx = -r; dx <= r; dx++) column(dx, 1);
          let m = 0;
          let below = 0;
          while (below + hist[m] <= half) { below += hist[m]; m++; }
          out[o(0, y) + c] = m;
          for (let x = 1; x < W; x++) {
            for (let dy = -r; dy <= r; dy++) {
              const gone = s[idx(x - 1 - r, y + dy) + c];
              hist[gone]--;
              if (gone < m) below--;
              const come = s[idx(x + r, y + dy) + c];
              hist[come]++;
              if (come < m) below++;
            }
            if (below > half) {
              while (below > half) { m--; below -= hist[m]; }
            } else {
              while (below + hist[m] <= half) { below += hist[m]; m++; }
            }
            out[o(x, y) + c] = m;
          }
        }
        for (let x = 0; x < W; x++) out[o(x, y) + 3] = s[idx(x, y) + 3];
      }
      return out;
    }

    case 'unsharp': {
      const sigma = Math.max(0.1, p.radius);
      const k = Math.ceil(3 * sigma);
      const weights = Array.from({ length: 2 * k + 1 }, (_, i) => Math.exp(-((i - k) ** 2) / (2 * sigma * sigma)));
      const total = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < weights.length; i++) weights[i] /= total;
      // Horizontal pass over the rows the vertical pass will need.
      const hy0 = Math.max(0, y0 - k);
      const hy1 = Math.min(H, y1 + k);
      const horizontal = new Float32Array((hy1 - hy0) * W * 3);
      for (let y = hy0; y < hy1; y++) {
        for (let x = 0; x < W; x++) {
          const h = ((y - hy0) * W + x) * 3;
          for (let t = -k; t <= k; t++) {
            const i = idx(x + t, y);
            const w = weights[t + k];
            horizontal[h] += s[i] * w; horizontal[h + 1] += s[i + 1] * w; horizontal[h + 2] += s[i + 2] * w;
          }
        }
      }
      const hAt = (x, y) => ((Math.min(hy1 - 1, Math.max(hy0, y)) - hy0) * W + x) * 3;
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < W; x++) {
          const blur = [0, 0, 0];
          for (let t = -k; t <= k; t++) {
            const h = hAt(x, cy(y + t));
            const w = weights[t + k];
            blur[0] += horizontal[h] * w; blur[1] += horizontal[h + 1] * w; blur[2] += horizontal[h + 2] * w;
          }
          const i = idx(x, y);
          const kk = o(x, y);
          for (let c = 0; c < 3; c++) {
            const diff = s[i + c] - blur[c];
            out[kk + c] = Math.abs(diff) >= p.threshold ? s[i + c] + (p.amount / 100) * diff : s[i + c];
          }
          out[kk + 3] = s[i + 3];
        }
      }
      return out;
    }

    default:
      throw new Error(`Unknown filter "${id}".`);
  }
}
