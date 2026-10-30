// zipService.js — ZIP archives with no dependencies. `buildZip` writes stored
// (uncompressed) entries synchronously; `compressZip` deflates through the
// browser's CompressionStream; `readZip` extracts stored and deflated entries.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Archive-safe relative path: forward slashes, no leading slash, no `.` parts; '' if it contains `..`. */
export function safeEntryPath(path) {
  const parts = String(path || '').replace(/\\/g, '/').split('/');
  if (parts.includes('..')) return '';
  return parts.filter(p => p && p !== '.').join('/');
}

function entryBytes(f) {
  if (f.bytes instanceof Uint8Array) return f.bytes;
  if (f.bytes instanceof ArrayBuffer) return new Uint8Array(f.bytes);
  return new TextEncoder().encode(String(f.content ?? ''));
}

function dosStamp(date) {
  return {
    time: ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff,
    day: (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff,
  };
}

// entries: [{ name: Uint8Array, method, crc, size, data, dir? }]
function assemble(entries, date) {
  const { time, day } = dosStamp(date);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const local = new Uint8Array(30 + e.name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, e.method, true);
    lv.setUint16(10, time, true); lv.setUint16(12, day, true); lv.setUint32(14, e.crc, true);
    lv.setUint32(18, e.data.length, true); lv.setUint32(22, e.size, true); lv.setUint16(26, e.name.length, true); lv.setUint16(28, 0, true);
    local.set(e.name, 30);
    const central = new Uint8Array(46 + e.name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, e.method, true);
    cv.setUint16(12, time, true); cv.setUint16(14, day, true); cv.setUint32(16, e.crc, true);
    cv.setUint32(20, e.data.length, true); cv.setUint32(24, e.size, true); cv.setUint16(28, e.name.length, true);
    if (e.dir) cv.setUint32(38, 0x10, true); // MS-DOS directory attribute
    cv.setUint32(42, offset, true);
    central.set(e.name, 46);
    locals.push(local, e.data);
    centrals.push(central);
    offset += local.length + e.data.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

/** files: [{ path, content } | { path, bytes }] → stored ZIP bytes. */
export function buildZip(files, date = new Date()) {
  const enc = new TextEncoder();
  return assemble(files.map(f => {
    const data = entryBytes(f);
    return { name: enc.encode(safeEntryPath(f.path)), method: 0, crc: crc32(data), size: data.length, data };
  }), date);
}

async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/**
 * files: [{ path, content } | { path, bytes } | { path, dir: true }] → deflated ZIP bytes.
 * Entries that would not shrink are stored; without CompressionStream everything is stored.
 */
export async function compressZip(files, date = new Date()) {
  const enc = new TextEncoder();
  const canDeflate = typeof CompressionStream === 'function';
  const entries = [];
  for (const f of files) {
    const clean = safeEntryPath(f.path);
    if (!clean) continue;
    if (f.dir) {
      entries.push({ name: enc.encode(`${clean}/`), method: 0, crc: 0, size: 0, data: new Uint8Array(0), dir: true });
      continue;
    }
    const data = entryBytes(f);
    let packed = data;
    let method = 0;
    if (canDeflate && data.length > 64) {
      const deflated = await through(data, new CompressionStream('deflate-raw'));
      if (deflated.length < data.length) { packed = deflated; method = 8; }
    }
    entries.push({ name: enc.encode(clean), method, crc: crc32(data), size: data.length, data: packed });
  }
  return assemble(entries, date);
}

/**
 * ZIP bytes → [{ path, bytes, dir }]. Supports stored and deflated entries (not ZIP64
 * or encryption). Entries whose path would climb out of the archive (`..`) are skipped.
 */
export async function readZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive.');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  if (p === 0xffffffff || count === 0xffff) throw new Error('ZIP64 archives are not supported.');
  const dec = new TextDecoder();
  const out = [];
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw new Error('The ZIP directory is damaged.');
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const compSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localAt = view.getUint32(p + 42, true);
    const rawName = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    const dir = rawName.endsWith('/') || rawName.endsWith('\\');
    const path = safeEntryPath(rawName);
    if (!path) continue;
    if (dir) { out.push({ path, bytes: new Uint8Array(0), dir: true }); continue; }
    if (flags & 1) throw new Error(`"${path}" is encrypted; encrypted archives are not supported.`);
    if (view.getUint32(localAt, true) !== 0x04034b50) throw new Error(`The ZIP entry "${path}" is damaged.`);
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    const packed = bytes.subarray(dataAt, dataAt + compSize);
    let data;
    if (method === 0) data = packed.slice();
    else if (method === 8) {
      if (typeof DecompressionStream !== 'function') throw new Error('This system cannot inflate compressed ZIP entries.');
      data = await through(packed, new DecompressionStream('deflate-raw'));
    } else throw new Error(`"${path}" uses an unsupported compression method (${method}).`);
    if (data.length !== size || crc32(data) !== crc) throw new Error(`"${path}" failed its checksum; the archive is corrupt.`);
    out.push({ path, bytes: data, dir: false });
  }
  return out;
}
