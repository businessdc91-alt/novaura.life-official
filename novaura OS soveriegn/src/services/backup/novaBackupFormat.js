// novaBackupFormat.js — The .novabackup file: an archive of database rows,
// stored files and settings, encrypted with a passphrase.
//
// File:     "NOVABAK1" | u32 header length | header JSON | chunks
// Chunk:    u32 ciphertext length | AES-256-GCM ciphertext (4 MiB of archive each)
// Key:      PBKDF2-SHA-256 over the passphrase with a random salt
// Nonce:    8 random bytes from the header + the chunk number
// AAD:      the header bytes, the chunk number and a last-chunk flag, so chunks
//           cannot be reordered, swapped between backups or cut off the end.
//
// Archive (the plaintext): "NBARCH01" | u32 manifest length | manifest JSON | binary parts.
// Blobs and byte arrays in rows are moved out of the JSON into the binary parts.
//
// Pure WebCrypto and Blob, so it runs the same in the app and in Node tests.

const FILE_MAGIC = 'NOVABAK1';
const ARCHIVE_MAGIC = 'NBARCH01';
const MARK = '__novabak';
export const DEFAULT_ITERATIONS = 600_000; // OWASP's figure for PBKDF2-SHA-256
const DEFAULT_CHUNK = 4 * 1024 * 1024;
const FOLD_EVERY = 16; // chunks gathered before folding into one Blob (keeps the JS heap small)

export class BackupError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
const readU32 = (bytes, at = 0) => new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0);
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const sliceBytes = async (blob, start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer());

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ── Archive ────────────────────────────────────────────────────────────────

function encodeValue(v, parts) {
  if (v === null || typeof v !== 'object') return v;
  if (typeof Blob !== 'undefined' && v instanceof Blob) {
    parts.push({ blob: v, kind: 'blob', type: v.type || '' });
    return { [MARK]: 'part', i: parts.length - 1 };
  }
  if (v instanceof ArrayBuffer) {
    parts.push({ blob: new Blob([v]), kind: 'ab', type: '' });
    return { [MARK]: 'part', i: parts.length - 1 };
  }
  if (ArrayBuffer.isView(v)) {
    parts.push({ blob: new Blob([new Uint8Array(v.buffer, v.byteOffset, v.byteLength)]), kind: 'view', type: v.constructor.name });
    return { [MARK]: 'part', i: parts.length - 1 };
  }
  if (v instanceof Date) return { [MARK]: 'date', t: v.toISOString() };
  if (Array.isArray(v)) return v.map(x => encodeValue(x, parts));
  const out = {};
  for (const k of Object.keys(v)) out[k] = encodeValue(v[k], parts);
  return out;
}

const VIEWS = ['Uint8Array', 'Int8Array', 'Uint8ClampedArray', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'];

function decodeValue(v, parts) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => decodeValue(x, parts));
  if (v[MARK] === 'date') return new Date(v.t);
  if (v[MARK] === 'part') {
    const p = parts[v.i];
    if (!p) throw new BackupError('CORRUPT', 'The backup refers to a stored file it does not contain.');
    if (p.kind === 'blob') return p.blob;
    if (p.kind === 'ab') return p.buffer;
    if (p.type === 'DataView') return new DataView(p.buffer);
    const Ctor = VIEWS.includes(p.type) ? globalThis[p.type] : Uint8Array;
    return new Ctor(p.buffer);
  }
  const out = {};
  for (const k of Object.keys(v)) out[k] = decodeValue(v[k], parts);
  return out;
}

/** Pack { tables: { name: rows[] }, localStorage: {k: v}, meta } into an archive Blob. */
export function packArchive({ tables = {}, localStorage = {}, meta = {} }) {
  const parts = [];
  const encodedTables = {};
  for (const [name, rows] of Object.entries(tables)) encodedTables[name] = encodeValue(rows, parts);
  const manifest = {
    format: 'novaura-archive',
    version: 1,
    createdAt: new Date().toISOString(),
    ...meta,
    tables: encodedTables,
    localStorage,
    parts: parts.map(p => ({ size: p.blob.size, kind: p.kind, type: p.type })),
  };
  const json = enc.encode(JSON.stringify(manifest));
  return new Blob([enc.encode(ARCHIVE_MAGIC), u32(json.length), json, ...parts.map(p => p.blob)]);
}

/** Unpack an archive Blob into { manifest, tables, localStorage }. */
export async function unpackArchive(blob) {
  const head = await sliceBytes(blob, 0, 12);
  if (dec.decode(head.subarray(0, 8)) !== ARCHIVE_MAGIC) throw new BackupError('CORRUPT', 'The backup contents are not a NovAura archive.');
  const len = readU32(head, 8);
  if (12 + len > blob.size) throw new BackupError('CORRUPT', 'The backup is cut short.');
  const manifest = JSON.parse(await blob.slice(12, 12 + len).text());
  if (manifest.format !== 'novaura-archive' || manifest.version !== 1) throw new BackupError('VERSION', 'This backup was made by a newer version of NovAura. Update, then restore.');
  let at = 12 + len;
  const parts = [];
  for (const p of manifest.parts || []) {
    if (at + p.size > blob.size) throw new BackupError('CORRUPT', 'The backup is cut short.');
    const piece = blob.slice(at, at + p.size, p.kind === 'blob' ? p.type : '');
    parts.push(p.kind === 'blob' ? { ...p, blob: piece } : { ...p, buffer: await piece.arrayBuffer() });
    at += p.size;
  }
  const tables = {};
  for (const [name, rows] of Object.entries(manifest.tables || {})) tables[name] = decodeValue(rows, parts);
  return { manifest, tables, localStorage: manifest.localStorage || {} };
}

// ── Encryption ─────────────────────────────────────────────────────────────

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const chunkIv = (prefix, index) => concat(prefix, u32(index));
const chunkAad = (headerBytes, index, last) => concat(headerBytes, u32(index), new Uint8Array([last ? 1 : 0]));

/**
 * Encrypt a Blob into a .novabackup Blob.
 * onProgress({ done, total }) in bytes of input.
 */
export async function encryptBackup(plain, passphrase, { iterations = DEFAULT_ITERATIONS, chunkSize = DEFAULT_CHUNK, onProgress, info = {} } = {}) {
  if (!passphrase) throw new BackupError('PASSPHRASE', 'A passphrase is required.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prefix = crypto.getRandomValues(new Uint8Array(8));
  const header = {
    v: 1,
    cipher: 'AES-256-GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: b64(salt) },
    nonce: b64(prefix),
    chunkSize,
    createdAt: new Date().toISOString(),
    ...info, // shown before the passphrase is asked for; never secret
  };
  const headerBytes = enc.encode(JSON.stringify(header));
  const key = await deriveKey(passphrase, salt, iterations);

  let out = new Blob([enc.encode(FILE_MAGIC), u32(headerBytes.length), headerBytes]);
  let pending = [];
  const count = Math.max(1, Math.ceil(plain.size / chunkSize));
  for (let i = 0; i < count; i++) {
    const data = await plain.slice(i * chunkSize, (i + 1) * chunkSize).arrayBuffer();
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: chunkIv(prefix, i), additionalData: chunkAad(headerBytes, i, i === count - 1) }, key, data));
    pending.push(u32(ct.length), ct);
    if (pending.length >= FOLD_EVERY * 2) { out = new Blob([out, ...pending]); pending = []; }
    onProgress?.({ done: Math.min(plain.size, (i + 1) * chunkSize), total: plain.size });
  }
  return new Blob([out, ...pending], { type: 'application/octet-stream' });
}

/** The readable header of a .novabackup (date, app version, sizes), or a BackupError. */
export async function readBackupHeader(file) {
  const head = await sliceBytes(file, 0, 12);
  if (head.length < 12 || dec.decode(head.subarray(0, 8)) !== FILE_MAGIC) throw new BackupError('NOT_BACKUP', 'This is not a NovAura backup file.');
  const len = readU32(head, 8);
  if (len > 64 * 1024 || 12 + len > file.size) throw new BackupError('CORRUPT', 'The backup header is damaged.');
  const headerBytes = await sliceBytes(file, 12, 12 + len);
  let header;
  try { header = JSON.parse(dec.decode(headerBytes)); } catch { throw new BackupError('CORRUPT', 'The backup header is damaged.'); }
  if (header.v !== 1 || header.cipher !== 'AES-256-GCM' || header.kdf?.name !== 'PBKDF2') throw new BackupError('VERSION', 'This backup was made by a newer version of NovAura. Update, then restore.');
  const it = header.kdf.iterations;
  if (!Number.isInteger(it) || it < 100_000 || it > 10_000_000) throw new BackupError('CORRUPT', 'The backup header is damaged.');
  if (!Number.isInteger(header.chunkSize) || header.chunkSize < 1024 || header.chunkSize > 64 * 1024 * 1024) throw new BackupError('CORRUPT', 'The backup header is damaged.');
  return { header, headerBytes, dataStart: 12 + len };
}

/**
 * Decrypt a .novabackup Blob back into the archive Blob.
 * Throws BackupError 'PASSPHRASE' for a wrong passphrase, 'CORRUPT' for damage.
 */
export async function decryptBackup(file, passphrase, { onProgress } = {}) {
  const { header, headerBytes, dataStart } = await readBackupHeader(file);
  const salt = unb64(header.kdf.salt);
  const prefix = unb64(header.nonce);
  if (salt.length !== 16 || prefix.length !== 8) throw new BackupError('CORRUPT', 'The backup header is damaged.');
  const key = await deriveKey(passphrase || '', salt, header.kdf.iterations);

  let out = new Blob([]);
  let pending = [];
  let at = dataStart;
  for (let i = 0; at < file.size; i++) {
    if (at + 4 > file.size) throw new BackupError('CORRUPT', 'The backup is cut short or damaged.');
    const len = readU32(await sliceBytes(file, at, at + 4));
    if (len < 16 || len > header.chunkSize + 16 || at + 4 + len > file.size) throw new BackupError('CORRUPT', 'The backup is cut short or damaged.');
    const ct = await file.slice(at + 4, at + 4 + len).arrayBuffer();
    at += 4 + len;
    let pt;
    try {
      pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: chunkIv(prefix, i), additionalData: chunkAad(headerBytes, i, at === file.size) }, key, ct);
    } catch {
      if (i === 0) throw new BackupError('PASSPHRASE', 'Wrong passphrase, or the backup is damaged.');
      throw new BackupError('CORRUPT', 'The backup is damaged or incomplete; it cannot be restored.');
    }
    pending.push(new Uint8Array(pt));
    if (pending.length >= FOLD_EVERY) { out = new Blob([out, ...pending]); pending = []; }
    onProgress?.({ done: at, total: file.size });
  }
  if (at === dataStart) throw new BackupError('CORRUPT', 'The backup is empty.');
  return { header, plain: new Blob([out, ...pending]) };
}
