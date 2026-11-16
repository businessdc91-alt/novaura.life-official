// surface.js — Pixel buffers for the Creative Studio engine.
//
// In the app a surface is an OffscreenCanvas, so drawing is fast and done by the
// browser. In Node tests it is a plain RGBA array with the same methods, so the
// engine (documents, history, fills, file formats) can be tested without a browser.
// Pixels are non-premultiplied RGBA: { width, height, data: Uint8ClampedArray },
// the same shape as ImageData.

export const MAX_SIDE = 16384;

function checkSize(width, height) {
  const ok = n => Number.isInteger(n) && n >= 1 && n <= MAX_SIDE;
  if (!ok(width) || !ok(height)) throw new RangeError('Canvas sides must be 1–16384 px.');
}

const blank = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

// The part of (x, y, w, h) that falls inside a width × height surface, or null.
function clip(x, y, w, h, width, height) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(width, x + w);
  const y1 = Math.min(height, y + h);
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

// Copy rows of `src` (sw wide) into `dst` (dw wide), for the region clipped against both.
function blit(src, sw, sh, dst, dw, dh, dx, dy) {
  const c = clip(dx, dy, sw, sh, dw, dh);
  if (!c) return;
  const rowBytes = (c.x1 - c.x0) * 4;
  for (let y = c.y0; y < c.y1; y++) {
    const s = ((y - dy) * sw + (c.x0 - dx)) * 4;
    dst.set(src.subarray(s, s + rowBytes), (y * dw + c.x0) * 4);
  }
}

/** An RGBA array with the surface methods. Used by Node tests and as a fallback. */
export class ArraySurface {
  constructor(width, height, data = null) {
    checkSize(width, height);
    this.width = width;
    this.height = height;
    this.data = data || new Uint8ClampedArray(width * height * 4);
    this.canvas = null;
    this.ctx = null;
  }

  get bytes() { return this.width * this.height * 4; }

  read(x, y, w, h) {
    const out = blank(w, h);
    blit(this.data, this.width, this.height, out.data, w, h, -x, -y);
    return out;
  }

  write(x, y, pixels) {
    blit(pixels.data, pixels.width, pixels.height, this.data, this.width, this.height, x, y);
  }

  clear() { this.data.fill(0); }

  resizeCanvas(width, height, offsetX = 0, offsetY = 0) {
    checkSize(width, height);
    const next = new Uint8ClampedArray(width * height * 4);
    blit(this.data, this.width, this.height, next, width, height, offsetX, offsetY);
    this.data = next;
    this.width = width;
    this.height = height;
  }

  clone() { return new ArraySurface(this.width, this.height, this.data.slice()); }

  async toPngBlob() {
    const { encodePng } = await loadPng();
    return new Blob([await encodePng(this.read(0, 0, this.width, this.height))], { type: 'image/png' });
  }
}

/** An OffscreenCanvas with the surface methods. What the app uses. */
export class CanvasSurface {
  constructor(width, height, canvas = null) {
    checkSize(width, height);
    this.canvas = canvas || new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }
  get bytes() { return this.width * this.height * 4; }

  read(x, y, w, h) {
    const c = clip(x, y, w, h, this.width, this.height);
    if (c && c.x0 === x && c.y0 === y && c.x1 === x + w && c.y1 === y + h) return this.ctx.getImageData(x, y, w, h);
    const out = blank(w, h);
    if (c) {
      const part = this.ctx.getImageData(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
      blit(part.data, part.width, part.height, out.data, w, h, c.x0 - x, c.y0 - y);
    }
    return out;
  }

  write(x, y, pixels) {
    const image = pixels instanceof ImageData ? pixels : new ImageData(pixels.data, pixels.width, pixels.height);
    this.ctx.putImageData(image, x, y);
  }

  clear() { this.ctx.clearRect(0, 0, this.width, this.height); }

  resizeCanvas(width, height, offsetX = 0, offsetY = 0) {
    checkSize(width, height);
    const old = this.canvas;
    this.canvas = new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.drawImage(old, offsetX, offsetY);
  }

  clone() {
    const copy = new CanvasSurface(this.width, this.height);
    copy.ctx.drawImage(this.canvas, 0, 0);
    return copy;
  }

  toPngBlob() { return this.canvas.convertToBlob({ type: 'image/png' }); }
}

let factory = null;

/** Tests force ArraySurface with setSurfaceFactory((w, h) => new ArraySurface(w, h)); null restores the default. */
export function setSurfaceFactory(fn) { factory = fn || null; }

export function createSurface(width, height) {
  checkSize(width, height);
  if (factory) return factory(width, height);
  return typeof OffscreenCanvas === 'function' ? new CanvasSurface(width, height) : new ArraySurface(width, height);
}

export function surfaceFromPixels(pixels) {
  const s = createSurface(pixels.width, pixels.height);
  s.write(0, 0, pixels);
  return s;
}

// PNG encoding and decoding for array surfaces (loaded only when one needs it).
const loadPng = () => import('./io/png.js');

export async function surfaceFromPngBlob(blob) {
  const probe = createSurface(1, 1);
  if (probe instanceof CanvasSurface && typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const s = createSurface(bitmap.width, bitmap.height);
    s.ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return s;
  }
  const { decodePng } = await loadPng();
  return surfaceFromPixels(await decodePng(new Uint8Array(await blob.arrayBuffer())));
}
