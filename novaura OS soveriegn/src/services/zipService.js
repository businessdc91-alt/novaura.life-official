// zipService.js — ZIP archives with no dependencies. `buildZip` writes stored
// (uncompressed) entries synchronously; `compressZip` deflates through the
// browser's CompressionStream; `buildZipBlob` writes stored entries as a Blob
// made of parts, so archives larger than memory can be built; `readZip` extracts
// stored and deflated entries; `listZipEntries` / `readZipEntry` read a Blob one
// entry at a time. ZIP64 (entries or archives over 4 GB) is read everywhere and
// written by buildZipBlob when a size or offset needs it.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crcUpdate(c, bytes) {
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return c;
}

export function crc32(bytes) {
  return (crcUpdate(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
}

/** CRC-32 of a Blob, read in chunks so it never has to fit in memory at once. */
export async function crc32Blob(blob) {
  let c = 0xffffffff;
  const reader = blob.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    c = crcUpdate(c, value);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const MAX32 = 0xffffffff;

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
 * `store: true` keeps an entry uncompressed (an EPUB's leading mimetype must be).
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
    if (canDeflate && !f.store && data.length > 64) {
      const deflated = await through(data, new CompressionStream('deflate-raw'));
      if (deflated.length < data.length) { packed = deflated; method = 8; }
    }
    entries.push({ name: enc.encode(clean), method, crc: crc32(data), size: data.length, data: packed });
  }
  return assemble(entries, date);
}

/**
 * files: [{ path, blob } | { path, bytes }] → a stored ZIP as a Blob built from parts
 * (the data Blobs are referenced, not copied). zip64: 'auto' writes ZIP64 records when
 * a size or offset reaches 4 GB or there are 65535+ entries; 'always' writes them anyway.
 */
export async function buildZipBlob(files, { date = new Date(), zip64 = 'auto' } = {}) {
  const enc = new TextEncoder();
  const { time, day } = dosStamp(date);
  const always = zip64 === 'always';
  const parts = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const clean = safeEntryPath(f.path);
    if (!clean) continue;
    const name = enc.encode(clean);
    const data = f.blob instanceof Blob ? f.blob : entryBytes(f);
    const size = data instanceof Blob ? data.size : data.length;
    const crc = data instanceof Blob ? await crc32Blob(data) : crc32(data);
    const big = always || size >= MAX32 || offset >= MAX32;

    const localExtra = big ? 20 : 0;
    const local = new Uint8Array(30 + name.length + localExtra);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, big ? 45 : 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true); lv.setUint16(12, day, true); lv.setUint32(14, crc, true);
    lv.setUint32(18, big ? MAX32 : size, true); lv.setUint32(22, big ? MAX32 : size, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, localExtra, true);
    local.set(name, 30);
    if (big) {
      const x = 30 + name.length;
      lv.setUint16(x, 0x0001, true); lv.setUint16(x + 2, 16, true);
      lv.setBigUint64(x + 4, BigInt(size), true); lv.setBigUint64(x + 12, BigInt(size), true);
    }

    const centralExtra = big ? 28 : 0;
    const central = new Uint8Array(46 + name.length + centralExtra);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, big ? 45 : 20, true); cv.setUint16(6, big ? 45 : 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true); cv.setUint16(14, day, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, big ? MAX32 : size, true); cv.setUint32(24, big ? MAX32 : size, true);
    cv.setUint16(28, name.length, true); cv.setUint16(30, centralExtra, true);
    cv.setUint32(42, big ? MAX32 : offset, true);
    central.set(name, 46);
    if (big) {
      const x = 46 + name.length;
      cv.setUint16(x, 0x0001, true); cv.setUint16(x + 2, 24, true);
      cv.setBigUint64(x + 4, BigInt(size), true); cv.setBigUint64(x + 12, BigInt(size), true); cv.setBigUint64(x + 20, BigInt(offset), true);
    }
    parts.push(local, data);
    centrals.push(central);
    offset += local.length + size;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const count = centrals.length;
  const needs64 = always || count >= 0xffff || offset >= MAX32 || centralSize >= MAX32;
  const tail = [];
  if (needs64) {
    const end64 = new Uint8Array(56);
    const e6 = new DataView(end64.buffer);
    e6.setUint32(0, 0x06064b50, true); e6.setBigUint64(4, 44n, true); e6.setUint16(12, 45, true); e6.setUint16(14, 45, true);
    e6.setUint32(16, 0, true); e6.setUint32(20, 0, true);
    e6.setBigUint64(24, BigInt(count), true); e6.setBigUint64(32, BigInt(count), true);
    e6.setBigUint64(40, BigInt(centralSize), true); e6.setBigUint64(48, BigInt(offset), true);
    const locator = new Uint8Array(20);
    const lo = new DataView(locator.buffer);
    lo.setUint32(0, 0x07064b50, true); lo.setUint32(4, 0, true); lo.setBigUint64(8, BigInt(offset + centralSize), true); lo.setUint32(16, 1, true);
    tail.push(end64, locator);
  }
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, needs64 ? 0xffff : count, true); ev.setUint16(10, needs64 ? 0xffff : count, true);
  ev.setUint32(12, needs64 ? MAX32 : centralSize, true); ev.setUint32(16, needs64 ? MAX32 : offset, true);
  return new Blob([...parts, ...centrals, ...tail, end], { type: 'application/zip' });
}

// The central directory's { count, size, start }, from the end record or, for ZIP64, the
// ZIP64 end record its locator points at. readAt(offset, length) → bytes of the archive.
async function directoryInfo(tailView, eocd, readAt) {
  let count = tailView.getUint16(eocd + 10, true);
  let size = tailView.getUint32(eocd + 12, true);
  let start = tailView.getUint32(eocd + 16, true);
  const locatorAt = eocd - 20;
  if (locatorAt >= 0 && tailView.getUint32(locatorAt, true) === 0x07064b50) {
    const end64At = Number(tailView.getBigUint64(locatorAt + 8, true));
    const record = await readAt(end64At, 56);
    const rv = new DataView(record.buffer, record.byteOffset, record.byteLength);
    if (record.length < 56 || rv.getUint32(0, true) !== 0x06064b50) throw new Error('The ZIP64 directory is damaged.');
    count = Number(rv.getBigUint64(32, true));
    size = Number(rv.getBigUint64(40, true));
    start = Number(rv.getBigUint64(48, true));
  } else if (start === MAX32 || count === 0xffff) {
    throw new Error('The ZIP64 directory is missing; the archive is damaged.');
  }
  return { count, size, start };
}

function findEnd(view, length) {
  for (let i = length - 22; i >= Math.max(0, length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error('Not a ZIP archive.');
}

// Central directory records → [{ path, dir, flags, method, crc, compSize, size, localAt }].
function parseDirectory(bytes, start, count) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const out = [];
  let p = start;
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw new Error('The ZIP directory is damaged.');
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const rawName = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const entry = {
      path: safeEntryPath(rawName),
      dir: rawName.endsWith('/') || rawName.endsWith('\\'),
      flags: view.getUint16(p + 8, true),
      method: view.getUint16(p + 10, true),
      crc: view.getUint32(p + 16, true),
      compSize: view.getUint32(p + 20, true),
      size: view.getUint32(p + 24, true),
      localAt: view.getUint32(p + 42, true),
    };
    // ZIP64: values set to 0xFFFFFFFF are in the 0x0001 extra field, in this order.
    for (let x = p + 46 + nameLen; x + 4 <= p + 46 + nameLen + extraLen;) {
      const id = view.getUint16(x, true);
      const len = view.getUint16(x + 2, true);
      if (id === 0x0001) {
        let at = x + 4;
        for (const key of ['size', 'compSize', 'localAt']) {
          if (entry[key] === MAX32 && at + 8 <= x + 4 + len) { entry[key] = Number(view.getBigUint64(at, true)); at += 8; }
        }
      }
      x += 4 + len;
    }
    p += 46 + nameLen + extraLen + view.getUint16(p + 32, true);
    if (entry.path) out.push(entry);
  }
  return out;
}

async function unpack(packed, entry) {
  if (entry.flags & 1) throw new Error(`"${entry.path}" is encrypted; encrypted archives are not supported.`);
  let data;
  if (entry.method === 0) data = packed.slice();
  else if (entry.method === 8) {
    if (typeof DecompressionStream !== 'function') throw new Error('This system cannot inflate compressed ZIP entries.');
    data = await through(packed, new DecompressionStream('deflate-raw'));
  } else throw new Error(`"${entry.path}" uses an unsupported compression method (${entry.method}).`);
  if (data.length !== entry.size || crc32(data) !== entry.crc) throw new Error(`"${entry.path}" failed its checksum; the archive is corrupt.`);
  return data;
}

/**
 * ZIP bytes → [{ path, bytes, dir }]. Supports stored and deflated entries and ZIP64 (not
 * encryption). Entries whose path would climb out of the archive (`..`) are skipped.
 */
export async function readZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEnd(view, bytes.length);
  const { count, start } = await directoryInfo(view, eocd, async (at, len) => bytes.subarray(at, at + len));
  const out = [];
  for (const e of parseDirectory(bytes, start, count)) {
    if (e.dir) { out.push({ path: e.path, bytes: new Uint8Array(0), dir: true }); continue; }
    if (e.localAt + 30 > bytes.length || view.getUint32(e.localAt, true) !== 0x04034b50) throw new Error(`The ZIP entry "${e.path}" is damaged.`);
    const dataAt = e.localAt + 30 + view.getUint16(e.localAt + 26, true) + view.getUint16(e.localAt + 28, true);
    out.push({ path: e.path, bytes: await unpack(bytes.subarray(dataAt, dataAt + e.compSize), e), dir: false });
  }
  return out;
}

/**
 * The entries of a ZIP Blob or File, read from its end without loading the
 * rest, so archives larger than memory can be listed and read one entry at a
 * time: [{ path, dir, method, size, compSize, crc, localAt, flags }].
 */
export async function listZipEntries(blob) {
  const tailLen = Math.min(blob.size, 22 + 0xffff);
  const tail = new Uint8Array(await blob.slice(blob.size - tailLen).arrayBuffer());
  const tv = new DataView(tail.buffer);
  const eocd = findEnd(tv, tail.length);
  const { count, size, start } = await directoryInfo(tv, eocd, async (at, len) => new Uint8Array(await blob.slice(at, at + len).arrayBuffer()));
  if (start + size > blob.size) throw new Error('The ZIP directory is damaged.');
  return parseDirectory(new Uint8Array(await blob.slice(start, start + size).arrayBuffer()), 0, count);
}

/** One entry's bytes (checked against its CRC), read from the Blob on demand. */
export async function readZipEntry(blob, entry) {
  if (entry.dir) return new Uint8Array(0);
  const head = new DataView(await blob.slice(entry.localAt, entry.localAt + 30).arrayBuffer());
  if (head.byteLength < 30 || head.getUint32(0, true) !== 0x04034b50) throw new Error(`The ZIP entry "${entry.path}" is damaged.`);
  const dataAt = entry.localAt + 30 + head.getUint16(26, true) + head.getUint16(28, true);
  return unpack(new Uint8Array(await blob.slice(dataAt, dataAt + entry.compSize).arrayBuffer()), entry);
}
