// removeBackground.js — Remove a plain background, working inward from the image edges.
//
// The background colour is the most common colour around the edges (grouped loosely
// first, then the most frequent exact colour in that group). Edge pixels within
// `tolerance` of it seed a flood that spreads to neighbours within tolerance of the
// colour that reached them, so the same colour enclosed inside the subject survives.

import { getLayer } from './document.js';
import { beginStroke } from './stroke.js';

const dist = (d, i, r, g, b) => Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b);

function edgePixels(W, H) {
  const out = [];
  for (let x = 0; x < W; x++) { out.push(x); if (H > 1) out.push((H - 1) * W + x); }
  for (let y = 1; y < H - 1; y++) { out.push(y * W); if (W > 1) out.push(y * W + W - 1); }
  return out;
}

/** Make the background transparent in place; returns how many pixels were cleared. */
export function removeBackground(pixels, tolerance) {
  const { width: W, height: H, data: d } = pixels;
  const edges = edgePixels(W, H);

  // The background: the most common loose colour group on the edges, then its most common exact colour.
  const groups = new Map();
  for (const p of edges) {
    const i = p * 4;
    if (!d[i + 3]) continue;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    if (!groups.has(key)) groups.set(key, new Map());
    const exact = groups.get(key);
    const colour = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    exact.set(colour, (exact.get(colour) || 0) + 1);
  }
  let reference = null;
  let bestGroup = -1;
  for (const exact of groups.values()) {
    const total = [...exact.values()].reduce((a, b) => a + b, 0);
    if (total <= bestGroup) continue;
    bestGroup = total;
    reference = [...exact.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  const ref = reference == null ? null : [(reference >> 16) & 255, (reference >> 8) & 255, reference & 255];

  const seen = new Uint8Array(W * H);
  const seedOf = new Int32Array(W * H).fill(-1);
  const queue = [];
  for (const p of edges) {
    const i = p * 4;
    if (seen[p]) continue;
    if (!d[i + 3] || (ref && dist(d, i, ...ref) <= tolerance)) { seen[p] = 1; seedOf[p] = p; queue.push(p); }
  }
  for (let q = 0; q < queue.length; q++) {
    const p = queue[q];
    const s = seedOf[p] * 4;
    const x = p % W;
    for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p + W < W * H ? p + W : -1]) {
      if (n < 0 || seen[n]) continue;
      const i = n * 4;
      const transparent = !d[i + 3];
      if (transparent || (d[s + 3] && dist(d, i, d[s], d[s + 1], d[s + 2]) <= tolerance)) {
        seen[n] = 1;
        seedOf[n] = seedOf[p]; // compare with the edge colour that started this flood, so it can't creep along a gradient
        queue.push(n);
      }
    }
  }
  let cleared = 0;
  for (const p of queue) {
    if (d[p * 4 + 3]) cleared++;
    d[p * 4 + 3] = 0;
  }
  return cleared;
}

/** Remove the background of the active pixel layer as one Photo step. */
export function removeBackgroundOnLayer(session, tolerance, { tab = 'photo' } = {}) {
  const { doc } = session;
  const layer = getLayer(doc, doc.activeLayerId);
  if (!layer) return { ok: false, reason: 'Choose a layer first.' };
  const begun = beginStroke(session, { layerId: layer.id, part: 'layer' }, { tab, label: 'Remove background' });
  if (!begun.ok) return begun;
  const { stroke } = begun;
  const surface = stroke.surface;
  stroke.touch({ x: stroke.origin.x, y: stroke.origin.y, w: surface.width, h: surface.height });
  const pixels = surface.read(0, 0, surface.width, surface.height);
  const cleared = removeBackground(pixels, tolerance);
  surface.write(0, 0, pixels);
  stroke.end();
  session.compositor?.invalidate();
  return { ok: true, cleared };
}
