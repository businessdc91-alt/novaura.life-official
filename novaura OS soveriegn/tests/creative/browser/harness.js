// harness.js — A tiny test runner for code that needs a real browser (canvas, workers).
// Test files call test(name, fn); scripts/browser-test.mjs loads them in headless
// Edge or Chrome, calls run(), and reads window.__results.

const tests = [];
let loadError = null;

export function test(name, fn) {
  tests.push({ name, fn });
}

function plain(v) {
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, plain(v[k])]));
  return v;
}

const show = v => {
  const s = JSON.stringify(plain(v));
  return s && s.length > 200 ? `${s.slice(0, 200)}…` : s;
};

function fail(message, extra) {
  throw new Error(extra ? `${message}: ${extra}` : message);
}

export const assert = {
  equal(actual, expected, message = 'not equal') {
    if (!Object.is(actual, expected)) fail(message, `expected ${show(expected)}, got ${show(actual)}`);
  },
  deepEqual(actual, expected, message = 'not deep-equal') {
    if (JSON.stringify(plain(actual)) !== JSON.stringify(plain(expected))) fail(message, `expected ${show(expected)}, got ${show(actual)}`);
  },
  ok(value, message = 'expected a truthy value') {
    if (!value) fail(message, `got ${show(value)}`);
  },
  near(actual, expected, tolerance, message = 'not near') {
    if (!(Math.abs(actual - expected) <= tolerance)) fail(message, `expected ${expected} ±${tolerance}, got ${actual}`);
  },
  async throws(fn, pattern, message = 'expected an error') {
    try {
      await fn();
    } catch (err) {
      if (pattern && !pattern.test(String(err?.message ?? err))) fail(message, `wrong error: ${err?.message ?? err}`);
      return;
    }
    fail(message);
  },
};

export function reportLoadError(err) {
  loadError = err;
}

export async function run() {
  const results = [];
  if (loadError) results.push({ name: 'load test file', ok: false, message: String(loadError?.stack || loadError) });
  for (const t of tests) {
    try {
      await t.fn();
      results.push({ name: t.name, ok: true });
    } catch (err) {
      results.push({ name: t.name, ok: false, message: String(err?.message ?? err) });
    }
  }
  window.__results = results;
  window.__done = true;
  return results;
}
