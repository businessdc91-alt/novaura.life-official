// png.js — A small PNG encoder and decoder for array surfaces (Node tests, and anywhere
// there is no canvas). The app's canvas surfaces use the browser's own PNG support.
// Writes 8-bit RGBA; reads 8-bit greyscale, grey+alpha, RGB and RGBA, non-interlaced.

import { crc32 } from '../../services/zipService.js';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** RGBA pixels → PNG bytes. */
export async function encodePng({ width, height, data }) {
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const parts = [Uint8Array.from(SIGNATURE), chunk('IHDR', ihdr), chunk('IDAT', await through(raw, new CompressionStream('deflate'))), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const unsupported = () => new Error('Unsupported PNG: only 8-bit greyscale, RGB and RGBA without interlacing.');
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** PNG bytes → RGBA pixels. */
export async function decodePng(bytes) {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw unsupported();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let type = -1;
  const idat = [];
  for (let p = 8; p + 8 <= bytes.length;) {
    const len = view.getUint32(p);
    const name = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const body = bytes.subarray(p + 8, p + 8 + len);
    if (name === 'IHDR') {
      width = view.getUint32(p + 8);
      height = view.getUint32(p + 12);
      const depth = body[8];
      type = body[9];
      if (depth !== 8 || body[12] !== 0 || !(type in CHANNELS)) throw unsupported();
    } else if (name === 'IDAT') {
      idat.push(body);
    } else if (name === 'IEND') {
      break;
    }
    p += 12 + len;
  }
  if (!width || !height || !idat.length) throw unsupported();
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of idat) { joined.set(c, at); at += c.length; }
  const raw = await through(joined, new DecompressionStream('deflate'));
  const bpp = CHANNELS[type];
  const stride = width * bpp;
  if (raw.length < (stride + 1) * height) throw unsupported();
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = rows.subarray(y * stride, (y + 1) * stride);
    const prev = y ? rows.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw unsupported();
      out[i] = v & 255;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += bpp) {
    const o = i * 4;
    if (type === 6) { data[o] = rows[j]; data[o + 1] = rows[j + 1]; data[o + 2] = rows[j + 2]; data[o + 3] = rows[j + 3]; }
    else if (type === 2) { data[o] = rows[j]; data[o + 1] = rows[j + 1]; data[o + 2] = rows[j + 2]; data[o + 3] = 255; }
    else if (type === 4) { data[o] = data[o + 1] = data[o + 2] = rows[j]; data[o + 3] = rows[j + 1]; }
    else { data[o] = data[o + 1] = data[o + 2] = rows[j]; data[o + 3] = 255; }
  }
  return { width, height, data };
}
