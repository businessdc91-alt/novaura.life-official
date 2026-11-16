// raster.js — Opening images (PNG, JPG, WebP, GIF first frame, BMP, SVG) as documents or layers.
// Images wider or taller than 16384 px open scaled down to fit, with a notice.

import { createSurface, MAX_SIDE } from '../surface.js';
import { createDocument, createLayer, insertLayer, removeLayerAt } from '../document.js';
import { addLayer } from '../edits.js';

/** The size an image opens at: unchanged if it fits, else scaled to fit within max on both sides. */
export function fitWithinLimit(w, h, max = MAX_SIDE) {
  if (w <= max && h <= max) return { width: w, height: h, scale: 1 };
  const scale = Math.min(max / w, max / h);
  return { width: Math.min(max, Math.max(1, Math.round(w * scale))), height: Math.min(max, Math.max(1, Math.round(h * scale))), scale };
}

const isSvg = (blob, name) => blob.type === 'image/svg+xml' || /\.svg$/i.test(name || '');

// An SVG with no width/height opens at 1024 px on its long side (keeping its viewBox shape).
function svgSize(text) {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0] || '';
  const attr = n => parseFloat(new RegExp(`\\s${n}\\s*=\\s*["']([\\d.]+)(px)?["']`, 'i').exec(tag)?.[1]);
  const w = attr('width');
  const h = attr('height');
  if (w > 0 && h > 0) return { width: Math.round(w), height: Math.round(h) };
  const box = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
  if (box) {
    const bw = +box[1];
    const bh = +box[2];
    const k = 1024 / Math.max(bw, bh);
    return { width: Math.max(1, Math.round(bw * k)), height: Math.max(1, Math.round(bh * k)) };
  }
  return { width: 1024, height: 1024 };
}

async function decode(blob, name) {
  if (isSvg(blob, name)) {
    const size = svgSize(await blob.text());
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'image/svg+xml' }));
    const img = new Image(size.width, size.height);
    img.src = url;
    try { await img.decode(); } catch { URL.revokeObjectURL(url); throw new Error(`"${name}" isn't a readable SVG image.`); }
    return { source: img, width: size.width, height: size.height, done: () => URL.revokeObjectURL(url) };
  }
  let bitmap;
  try { bitmap = await createImageBitmap(blob); } catch { throw new Error(`"${name || 'That file'}" isn't an image Creative Studio can open.`); }
  return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close?.() };
}

/** Decode an image file: { surface, width, height, scaledFrom: { width, height } | null }. */
export async function openImageFile(blob, name = '') {
  const img = await decode(blob, name);
  try {
    const fit = fitWithinLimit(img.width, img.height);
    const surface = createSurface(fit.width, fit.height);
    surface.ctx.imageSmoothingQuality = 'high';
    surface.ctx.drawImage(img.source, 0, 0, fit.width, fit.height);
    return { surface, width: fit.width, height: fit.height, scaledFrom: fit.scale === 1 ? null : { width: img.width, height: img.height } };
  } finally {
    img.done();
  }
}

const baseName = name => String(name || 'Image').replace(/\.[^.]+$/, '') || 'Image';

/** A new document the size of the opened image, holding it as its only layer. */
export function documentFromImage(opened, name) {
  const doc = createDocument({ name: baseName(name), width: opened.width, height: opened.height, background: 'transparent' });
  removeLayerAt(doc, 0);
  doc.buffers.clear();
  const layer = createLayer(doc, 'pixel', { name: baseName(name), surface: opened.surface });
  insertLayer(doc, layer, 0);
  doc.activeLayerId = layer.id;
  doc.version = 0;
  return doc;
}

/** Add the opened image as a new layer, centred on the canvas. */
export function placeImage(session, opened, name, meta) {
  const { doc } = session;
  return addLayer(session, 'pixel', {
    name: baseName(name), surface: opened.surface,
    x: Math.round((doc.width - opened.width) / 2), y: Math.round((doc.height - opened.height) / 2),
  }, { label: `Place ${baseName(name)}`, ...meta });
}

/** The notice to show when an image was too big and opened scaled. */
export function scaledNotice(opened) {
  if (!opened.scaledFrom) return null;
  return `Opened at ${opened.width}×${opened.height} — the original ${opened.scaledFrom.width}×${opened.scaledFrom.height} is over the 16384 px limit.`;
}

// ── Exporting flat images ─────────────────────────────────────────────────────

/** The flattened picture as PNG, JPG (on white) or WebP, optionally scaled 2× or 3×. */
export async function exportRaster(doc, { type = 'image/png', quality = 0.92, scale = 1 } = {}) {
  const w = Math.round(doc.width * scale);
  const h = Math.round(doc.height * scale);
  if (w > MAX_SIDE || h > MAX_SIDE) throw new Error('That scale would make the image larger than 16384 px.');
  const { flatten } = await import('../compositor.js');
  const flat = flatten(doc);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); } // JPG has no transparency
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(flat.canvas, 0, 0, w, h);
  return canvas.convertToBlob(type === 'image/png' ? { type } : { type, quality });
}

// ── Dropping files on the studio ──────────────────────────────────────────────

const PROJECT_OR_PSD = /\.(psd|novaart)$/i;
const IMAGE_FILE = /\.(png|jpe?g|webp|gif|bmp|svg)$/i;

/**
 * Where dropped files go: PSDs and projects always open as documents; images open
 * when dropped on the tabs and are placed as layers when dropped on the canvas.
 */
export function classifyDrop(target, files) {
  return [...files].map((file) => {
    if (PROJECT_OR_PSD.test(file.name)) return { file, action: 'open' };
    if (IMAGE_FILE.test(file.name) || /^image\//.test(file.type || '')) return { file, action: target === 'canvas' ? 'place' : 'open' };
    return { file, action: 'reject' };
  });
}
