// masks.js — Layer masks.
//
// A mask is a grey picture: white shows the layer, black hides it, grey partly shows
// it. It is stored as an opaque grey RGB surface (so painting greys works naturally)
// with its own position and size; outside that rectangle it counts as defaultValue.
// The compositor needs it as alpha, so a converted copy is cached per mask and
// refreshed when the layer changes (or just the painted area, during a stroke).

import { createSurface } from './surface.js';
import { setMaskProvider } from './compositor.js';
import { hexToRgba, rgbToHex } from './colour.js';

/** The grey a colour paints on a mask (its luminance). */
export function greyOf(hex) {
  const [r, g, b] = hexToRgba(hex);
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

export function maskColour(hex) {
  const v = greyOf(hex);
  return rgbToHex([v, v, v]);
}

function fillGrey(surface, v) {
  if (surface.ctx) {
    surface.ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    surface.ctx.fillRect(0, 0, surface.width, surface.height);
    return;
  }
  const row = new Uint8ClampedArray(surface.width * 4);
  for (let i = 0; i < row.length; i += 4) { row[i] = v; row[i + 1] = v; row[i + 2] = v; row[i + 3] = 255; }
  for (let y = 0; y < surface.height; y++) surface.write(0, y, { width: surface.width, height: 1, data: row });
}

/** A new canvas-sized mask (white to reveal all, black to hide all), registered in doc.buffers. */
export function createMask(doc, reveal) {
  const v = reveal ? 255 : 0;
  const surface = createSurface(doc.width, doc.height);
  fillGrey(surface, v);
  const bufferId = globalThis.crypto.randomUUID();
  doc.buffers.set(bufferId, surface);
  return { x: 0, y: 0, width: doc.width, height: doc.height, bufferId, defaultValue: v, enabled: true };
}

/** Invert grey values in place; alpha is left alone. */
export function invertPixels(pixels) {
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
  return pixels;
}

function greyToAlpha(pixels) {
  const out = new Uint8ClampedArray(pixels.data.length);
  for (let i = 0; i < out.length; i += 4) out[i + 3] = pixels.data[i];
  return { width: pixels.width, height: pixels.height, data: out };
}

const alphaCache = new WeakMap(); // grey surface → { rev, alpha }

/** The mask as an alpha surface for the compositor: { surface, x, y, defaultValue }, or null. */
export function maskAlpha(doc, layer) {
  const m = layer.mask;
  const grey = m && doc.buffers.get(m.bufferId);
  if (!grey) return null;
  let entry = alphaCache.get(grey);
  if (!entry || entry.rev !== layer.rev) {
    const reuse = entry?.alpha && entry.alpha.width === grey.width && entry.alpha.height === grey.height;
    const alpha = reuse ? entry.alpha : createSurface(grey.width, grey.height);
    alpha.write(0, 0, greyToAlpha(grey.read(0, 0, grey.width, grey.height)));
    entry = { rev: layer.rev, alpha };
    alphaCache.set(grey, entry);
  }
  return { surface: entry.alpha, x: m.x, y: m.y, defaultValue: m.defaultValue };
}

/** Refresh part of the cached alpha (document coordinates) while a mask is being painted. */
export function invalidateMaskAlpha(doc, layer, rect) {
  const m = layer.mask;
  const grey = m && doc.buffers.get(m.bufferId);
  const entry = grey && alphaCache.get(grey);
  if (!entry || entry.rev !== layer.rev) return; // the next maskAlpha rebuilds it all
  const x0 = Math.max(0, Math.floor(rect.x - m.x));
  const y0 = Math.max(0, Math.floor(rect.y - m.y));
  const x1 = Math.min(grey.width, Math.ceil(rect.x + rect.w - m.x));
  const y1 = Math.min(grey.height, Math.ceil(rect.y + rect.h - m.y));
  if (x1 <= x0 || y1 <= y0) return;
  entry.alpha.write(x0, y0, greyToAlpha(grey.read(x0, y0, x1 - x0, y1 - y0)));
}

setMaskProvider(maskAlpha);
