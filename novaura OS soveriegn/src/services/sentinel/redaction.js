// redaction.js — the wall that keeps a probe's raw observations out of stored findings.
// It is FAIL-CLOSED: a value is kept only when it can be POSITIVELY classified as safe
// (a small integer, a boolean, or a short enum-like string such as a header name, HTTP
// method or status text). Everything else — secrets, long strings, large or opaque
// containers, anything unrecognised — is redacted, or collapsed to a non-sensitive shape
// descriptor that carries no data. The default for an unclassified value is to redact.

const SAFE_INT_MAX = 1_000_000;   // status codes, ports, counts — not timestamps/ids
const MAX_ENUM_LEN = 60;          // a safe enum-like string is short
const MAX_ARRAY = 64;             // header/served lists survive; huge arrays collapse
const MAX_OBJ_KEYS = 8;           // the planner's small structs recurse; data records collapse

const RE_HEX = /^[0-9a-f]{32,}$/i;                                   // keys, hashes, node keys
const RE_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;    // header.payload.sig
const RE_BEARER = /\bbearer\s+\S/i;
const RE_BASE64 = /^[A-Za-z0-9+/_-]{40,}={0,2}$/;                     // long base64 blob
const RE_EMAIL = /[^@\s]+@[^@\s]+\.[^@\s]+/;
const RE_ENUM = /^[A-Za-z0-9][A-Za-z0-9 _.:/+-]*$/;                  // words, header names, methods
const RE_LONGRUN = /[A-Za-z0-9]{24,}/;                               // an unbroken run that long is token-like

const isPlainObject = (v) => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const isSecret = (s) => RE_HEX.test(s) || RE_JWT.test(s) || RE_BEARER.test(s) || RE_BASE64.test(s) || RE_EMAIL.test(s);
const isSafeEnum = (s) => s.length <= MAX_ENUM_LEN && RE_ENUM.test(s) && !RE_LONGRUN.test(s);

/** A non-sensitive descriptor of a value's shape — no contents. */
export function shapeOf(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `array: ${value.length} items`;
  const t = typeof value;
  if (t === 'string') return `string: ${value.length} chars`;
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return isPlainObject(value) ? `object: ${Object.keys(value).length} fields` : (value.constructor?.name || 'object');
  return t; // function, bigint, symbol
}

const collapsed = (v) => `[redacted] ${shapeOf(v)}`;

/**
 * redactValue(value) -> a value safe to store: safe scalars kept, secrets '[redacted]',
 * large/opaque values collapsed to a shape descriptor, plain objects/arrays recursed.
 */
export function redactValue(value) {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'boolean') return value;
  if (t === 'number') return Number.isInteger(value) && Math.abs(value) <= SAFE_INT_MAX ? value : '[redacted]';
  if (t === 'string') {
    if (value.length === 0) return '';
    if (isSecret(value)) return '[redacted]';
    if (value.length > MAX_ENUM_LEN) return collapsed(value);
    return isSafeEnum(value) ? value : '[redacted]';
  }
  if (Array.isArray(value)) return value.length > MAX_ARRAY ? collapsed(value) : value.map(redactValue);
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length > MAX_OBJ_KEYS) return collapsed(value);
    const out = {};
    for (const k of keys) out[k] = redactValue(value[k]);
    return out;
  }
  // Map, Set, Date, class instances, functions, bigint, symbol — cannot be classified as safe.
  return collapsed(value);
}

/**
 * redactFinding(finding) -> finding with proof and where redacted. vector, severity,
 * checkId, fix and reproduce are authored by the planner (not copied from the target),
 * so they are left intact.
 */
export function redactFinding(finding) {
  const f = finding || {};
  const out = { ...f };
  if ('proof' in f) out.proof = redactValue(f.proof);
  if ('where' in f) out.where = redactValue(f.where);
  return out;
}
