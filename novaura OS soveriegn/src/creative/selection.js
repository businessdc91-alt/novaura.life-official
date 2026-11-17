// selection.js — Pixel selection mattes: Marquee, Lasso, Magic Wand, boolean ops,
// feathering, boundary detection, and clipping edits against the active selection.
//
// A selection is { id, width, height, data: Uint8ClampedArray, bounds: { x, y, w, h } | null }
// stored in doc.selection (null = no active selection, edits affect everything).
// Keeping data as a single 0..255 channel per document pixel works identically in
// both the browser and Node tests at 1/4 the memory of RGBA.

const newId = () => globalThis.crypto.randomUUID();

/** Compute tight non-zero bounding box of a selection matte, or null when empty. */
export function computeSelectionBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (data[row + x] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function createSelection(width, height, data = null) {
  const buf = data || new Uint8ClampedArray(width * height);
  const bounds = computeSelectionBounds(buf, width, height);
  return bounds ? { id: newId(), width, height, data: buf, bounds } : null;
}

export const cloneSelection = sel => (sel ? { ...sel, data: sel.data.slice(), bounds: sel.bounds ? { ...sel.bounds } : null } : null);

function clampRect(rect, width, height) {
  const x0 = Math.max(0, Math.round(Math.min(rect.x, rect.x + rect.w)));
  const y0 = Math.max(0, Math.round(Math.min(rect.y, rect.y + rect.h)));
  const x1 = Math.min(width, Math.round(Math.max(rect.x, rect.x + rect.w)));
  const y1 = Math.min(height, Math.round(Math.max(rect.y, rect.y + rect.h)));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

// Fast O(W*H) separable box blur (two passes approximate a smooth Gaussian feather).
function boxBlurH(src, dst, w, h, r) {
  const div = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[row + Math.max(0, Math.min(w - 1, k))];
    for (let x = 0; x < w; x++) {
      dst[row + x] = Math.round(sum / div);
      const outIdx = Math.max(0, x - r);
      const inIdx = Math.min(w - 1, x + r + 1);
      sum += src[row + inIdx] - src[row + outIdx];
    }
  }
}

function boxBlurV(src, dst, w, h, r) {
  const div = r * 2 + 1;
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[Math.max(0, Math.min(h - 1, k)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = Math.round(sum / div);
      const outY = Math.max(0, y - r);
      const inY = Math.min(h - 1, y + r + 1);
      sum += src[inY * w + x] - src[outY * w + x];
    }
  }
}

export function featherMaskData(data, width, height, radius) {
  const r = Math.min(128, Math.round(Number(radius) || 0));
  if (r <= 0) return data;
  let a = data.slice();
  let b = new Uint8ClampedArray(data.length);
  for (let pass = 0; pass < 2; pass++) {
    boxBlurH(a, b, width, height, r);
    boxBlurV(b, a, width, height, r);
  }
  return a;
}

export function rectSelectionData(width, height, rect, feather = 0) {
  const r = clampRect(rect, width, height);
  if (!r) return null;
  const data = new Uint8ClampedArray(width * height);
  for (let y = r.y; y < r.y + r.h; y++) data.fill(255, y * width + r.x, y * width + r.x + r.w);
  return feather > 0 ? featherMaskData(data, width, height, feather) : data;
}

export function ellipseSelectionData(width, height, rect, feather = 0) {
  const r = clampRect(rect, width, height);
  if (!r) return null;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rx = r.w / 2;
  const ry = r.h / 2;
  const data = new Uint8ClampedArray(width * height);
  for (let y = r.y; y < r.y + r.h; y++) {
    const dy = (y + 0.5 - cy) / ry;
    const dy2 = dy * dy;
    if (dy2 > 1) continue;
    const row = y * width;
    for (let x = r.x; x < r.x + r.w; x++) {
      const dx = (x + 0.5 - cx) / rx;
      if (dx * dx + dy2 <= 1) data[row + x] = 255;
    }
  }
  return feather > 0 ? featherMaskData(data, width, height, feather) : data;
}

export function lassoSelectionData(width, height, points, feather = 0) {
  if (!points || points.length < 3) return null;
  let minY = height;
  let maxY = 0;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(height - 1, Math.ceil(maxY));
  if (yEnd < yStart) return null;

  const data = new Uint8ClampedArray(width * height);
  const n = points.length;
  const nodes = [];
  for (let y = yStart; y <= yEnd; y++) {
    const py = y + 0.5;
    nodes.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = points[i];
      const b = points[j];
      if ((a.y < py && b.y >= py) || (b.y < py && a.y >= py)) {
        nodes.push(a.x + ((py - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    nodes.sort((u, v) => u - v);
    const row = y * width;
    for (let i = 0; i + 1 < nodes.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(nodes[i] - 0.5));
      const x1 = Math.min(width - 1, Math.floor(nodes[i + 1] - 0.5));
      if (x1 >= x0) data.fill(255, row + x0, row + x1 + 1);
    }
  }
  return feather > 0 ? featherMaskData(data, width, height, feather) : data;
}

export function magicWandSelectionData(pixels, sx, sy, { tolerance = 32, contiguous = true, feather = 0 } = {}) {
  const { width, height, data: src } = pixels;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return null;
  const i0 = (y0 * width + x0) * 4;
  const ref = [src[i0], src[i0 + 1], src[i0 + 2], src[i0 + 3]];
  const matches = (p) => {
    const i = p * 4;
    return Math.abs(src[i] - ref[0]) <= tolerance
      && Math.abs(src[i + 1] - ref[1]) <= tolerance
      && Math.abs(src[i + 2] - ref[2]) <= tolerance
      && Math.abs(src[i + 3] - ref[3]) <= tolerance;
  };

  const out = new Uint8ClampedArray(width * height);
  if (!contiguous) {
    for (let p = 0; p < width * height; p++) if (matches(p)) out[p] = 255;
  } else {
    const seen = new Uint8Array(width * height);
    const stack = [y0 * width + x0];
    seen[stack[0]] = 1;
    while (stack.length) {
      const p = stack.pop();
      if (!matches(p)) continue;
      out[p] = 255;
      const px = p % width;
      if (px > 0 && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (px < width - 1 && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (p >= width && !seen[p - width]) { seen[p - width] = 1; stack.push(p - width); }
      if (p + width < width * height && !seen[p + width]) { seen[p + width] = 1; stack.push(p + width); }
    }
  }
  return feather > 0 ? featherMaskData(out, width, height, feather) : out;
}

export function combineSelectionData(currentData, nextData, mode = 'replace') {
  if (!nextData) return mode === 'replace' ? null : (currentData ? currentData.slice() : null);
  if (mode === 'replace' || !currentData) {
    if (mode === 'subtract' || mode === 'intersect') return null;
    return nextData.slice();
  }
  const out = new Uint8ClampedArray(nextData.length);
  for (let i = 0; i < out.length; i++) {
    const a = currentData[i];
    const b = nextData[i];
    if (mode === 'add') out[i] = Math.max(a, b);
    else if (mode === 'subtract') out[i] = Math.max(0, a - b);
    else if (mode === 'intersect') out[i] = Math.round((a * b) / 255);
    else out[i] = b;
  }
  return out;
}

export function invertSelectionMask(sel, width, height) {
  const data = new Uint8ClampedArray(width * height);
  if (!sel) data.fill(255);
  else for (let i = 0; i < data.length; i++) data[i] = 255 - sel.data[i];
  return createSelection(width, height, data);
}

export function translateSelectionMask(sel, dx, dy, width, height) {
  if (!sel) return null;
  const data = new Uint8ClampedArray(width * height);
  const x0 = Math.max(0, dx);
  const y0 = Math.max(0, dy);
  const x1 = Math.min(width, sel.width + dx);
  const y1 = Math.min(height, sel.height + dy);
  for (let y = y0; y < y1; y++) {
    const sy = y - dy;
    const rowDst = y * width;
    const rowSrc = sy * sel.width;
    for (let x = x0; x < x1; x++) data[rowDst + x] = sel.data[rowSrc + (x - dx)];
  }
  return createSelection(width, height, data);
}

export function resampleSelectionMask(sel, targetW, targetH) {
  if (!sel) return null;
  const data = new Uint8ClampedArray(targetW * targetH);
  const sx = sel.width / targetW;
  const sy = sel.height / targetH;
  for (let y = 0; y < targetH; y++) {
    const srcY = Math.min(sel.height - 1, Math.floor((y + 0.5) * sy));
    const dstRow = y * targetW;
    const srcRow = srcY * sel.width;
    for (let x = 0; x < targetW; x++) data[dstRow + x] = sel.data[srcRow + Math.min(sel.width - 1, Math.floor((x + 0.5) * sx))];
  }
  return createSelection(targetW, targetH, data);
}

/**
 * Blend edited `afterPixels` back with `beforePixels` according to `selection` alpha,
 * so any pixel outside the selection keeps its exact prior RGBA values.
 * `ox, oy` is the top-left document coordinate of `afterPixels`.
 */
export function clipPixelsToSelection(afterPixels, beforePixels, ox, oy, selection) {
  if (!selection) return afterPixels;
  const { width, height, data: dst } = afterPixels;
  const before = beforePixels.data;
  const sel = selection.data;
  const sw = selection.width;
  const sh = selection.height;
  for (let y = 0; y < height; y++) {
    const dy = oy + y;
    const row = y * width;
    const sRow = dy * sw;
    for (let x = 0; x < width; x++) {
      const dx = ox + x;
      const i = (row + x) * 4;
      const m = dx >= 0 && dy >= 0 && dx < sw && dy < sh ? sel[sRow + dx] : 0;
      if (m >= 255) continue;
      if (m <= 0) {
        dst[i] = before[i]; dst[i + 1] = before[i + 1]; dst[i + 2] = before[i + 2]; dst[i + 3] = before[i + 3];
      } else {
        const t = m / 255;
        const inv = 1 - t;
        dst[i] = Math.round(before[i] * inv + dst[i] * t);
        dst[i + 1] = Math.round(before[i + 1] * inv + dst[i + 1] * t);
        dst[i + 2] = Math.round(before[i + 2] * inv + dst[i + 2] * t);
        dst[i + 3] = Math.round(before[i + 3] * inv + dst[i + 3] * t);
      }
    }
  }
  return afterPixels;
}

// Cache a crisp 1px alternating black/white dashed outline bitmap per selection instance.
const outlineCache = new WeakMap();

export function selectionOutlineCanvas(sel) {
  if (!sel || !sel.bounds || typeof OffscreenCanvas !== 'function') return null;
  if (outlineCache.has(sel)) return outlineCache.get(sel);
  const { width: w, height: h, data, bounds } = sel;
  const bw = bounds.w;
  const bh = bounds.h;
  const canvas = new OffscreenCanvas(bw, bh);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(bw, bh);
  const out = img.data;
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] >= 128;

  for (let y = bounds.y; y < bounds.y + bh; y++) {
    for (let x = bounds.x; x < bounds.x + bw; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (!edge) continue;
      const stripe = ((x + y) >> 2) & 1;
      const oi = ((y - bounds.y) * bw + (x - bounds.x)) * 4;
      if (stripe) { out[oi] = 255; out[oi + 1] = 255; out[oi + 2] = 255; out[oi + 3] = 255; }
      else { out[oi] = 15; out[oi + 1] = 23; out[oi + 2] = 42; out[oi + 3] = 255; }
    }
  }
  ctx.putImageData(img, 0, 0);
  const hit = { canvas, x: bounds.x, y: bounds.y, w: bw, h: bh };
  outlineCache.set(sel, hit);
  return hit;
}

