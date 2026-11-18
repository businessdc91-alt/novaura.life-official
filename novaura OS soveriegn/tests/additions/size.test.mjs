import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measure, sizeOf } from '../../src/services/additions/size.js';

const big = 'x'.repeat(20_000);

test('Map and Set contents are counted', () => {
  assert.ok(measure(new Map([['a', big], ['b', big]])) >= 40_000);
  assert.ok(measure(new Set([big])) >= 20_000);
  assert.ok(sizeOf(new Map([['a', big]])) >= 20_000);
});

test('binary and blobs inside objects count their bytes, not their JSON', () => {
  assert.equal(measure({ data: new Uint8Array(1000) }), 4 + 1000);
  assert.ok(measure({ b: new Blob(['y'.repeat(5000)]) }) >= 5000);
  const s = sizeOf({ id: 1, data: new Uint8Array(10_000) });
  assert.ok(s >= 10_000 && s < 10_100, `stored size ${s}`);
});

test('deep nesting is counted, and past the limit is refused, never zero', () => {
  let v = new Uint8Array(500);
  for (let i = 0; i < 10; i++) v = { v };
  assert.ok(measure(v) >= 500);
  let deep = 'leaf';
  for (let i = 0; i < 200; i++) deep = [deep];
  assert.throws(() => measure(deep), (e) => e.code === 'bad_request');
});

test('a value that refers to itself is refused', () => {
  const a = { name: 'loop' };
  a.self = a;
  assert.throws(() => sizeOf(a), (e) => e.code === 'bad_request');
});
