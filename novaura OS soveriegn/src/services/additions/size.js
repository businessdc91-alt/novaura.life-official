// size.js — How many bytes a value takes, for quotas and message limits. Strings
// count their UTF-8 bytes, binary data its byte length, blobs their size, and
// containers (objects, arrays, Map, Set) everything inside them. A value nested too
// deeply, too large in parts, or referring to itself is refused rather than counted
// as nothing.

const MAX_DEPTH = 64;
const MAX_NODES = 1_000_000;

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

function refuse(message) {
  const err = new Error(message);
  err.code = 'bad_request';
  return err;
}

/**
 * Bytes a value carries, walking into objects, arrays, Map and Set. Stops counting
 * once past `stopAt`. Throws (code bad_request) for a value that refers to itself,
 * nests deeper than 64 levels, or has more than a million parts.
 */
export function measure(value, stopAt = Infinity) {
  const path = new Set();
  let nodes = 0;
  const walk = (v, depth) => {
    if (v == null) return 0;
    const t = typeof v;
    if (t === 'string') return utf8Length(v);
    if (t !== 'object') return 8;
    if (isArrayBuffer(v) || ArrayBuffer.isView(v)) return v.byteLength;
    if (isBlob(v)) return v.size;
    if (v instanceof Date) return 8;
    if (depth >= MAX_DEPTH) throw refuse('That value is nested too deeply to store.');
    if (path.has(v)) throw refuse('That value refers to itself, so it cannot be stored.');
    if (++nodes > MAX_NODES) throw refuse('That value has too many parts to store.');
    path.add(v);
    let n = 0;
    try {
      if (v instanceof Map) {
        for (const [k, x] of v) {
          n += walk(k, depth + 1) + walk(x, depth + 1);
          if (n > stopAt) return n;
        }
      } else if (v instanceof Set) {
        for (const x of v) {
          n += walk(x, depth + 1);
          if (n > stopAt) return n;
        }
      } else {
        for (const k of Object.keys(v)) {
          n += utf8Length(k) + walk(v[k], depth + 1);
          if (n > stopAt) return n;
        }
      }
    } finally {
      path.delete(v);
    }
    return n;
  };
  return walk(value, 0);
}

/** Bytes a stored value takes (see measure; it throws for the same values). */
export function sizeOf(value) {
  return measure(value);
}
