// size.js — How many bytes a value takes, for quotas and message limits. Strings
// count their UTF-8 bytes, binary data its byte length, blobs their size.

export function utf8Length(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

const tagOf = (v) => Object.prototype.toString.call(v);
export const isArrayBuffer = (v) => tagOf(v) === '[object ArrayBuffer]';
export const isBlob = (v) => tagOf(v) === '[object Blob]' || tagOf(v) === '[object File]';

/** Bytes a stored value takes: UTF-8 length for strings, byte length for binary, size for blobs. */
export function sizeOf(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return utf8Length(value);
  if (isArrayBuffer(value) || ArrayBuffer.isView(value)) return value.byteLength;
  if (isBlob(value)) return value.size;
  if (typeof value === 'number' || typeof value === 'boolean') return 8;
  try {
    return utf8Length(JSON.stringify(value) ?? '');
  } catch {
    return 0;
  }
}

/**
 * Bytes a message from an addition carries, walking objects and arrays (up to 8
 * levels). Stops counting once past `stopAt`.
 */
export function measure(value, stopAt = Infinity, depth = 0) {
  if (value == null) return 0;
  if (typeof value === 'string') return utf8Length(value);
  if (typeof value !== 'object') return 8;
  if (isArrayBuffer(value) || ArrayBuffer.isView(value)) return value.byteLength;
  if (isBlob(value)) return value.size;
  if (depth >= 8) return 0;
  let n = 0;
  for (const k of Object.keys(value)) {
    n += k.length + measure(value[k], stopAt, depth + 1);
    if (n > stopAt) return n;
  }
  return n;
}
