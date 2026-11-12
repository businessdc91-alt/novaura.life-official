// Per-sender inbound budgets: request floods and mail floods are cut off per key,
// other senders are unaffected, budgets refill, transfers are never limited.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInboundLimiter, TYPE_LIMITS, GENERAL_LIMIT } from '../../src/services/meshInboundLimits.js';

const A = 'did:nova:' + 'a'.repeat(64);
const B = 'did:nova:' + 'b'.repeat(64);

test('a feed-sync flood gets two answers, then one a minute', () => {
  let t = 0;
  const lim = createInboundLimiter(() => t);
  const answered = Array.from({ length: 50 }, () => lim.allow(A, 'MESH_POSTS_REQUEST')).filter(Boolean).length;
  assert.equal(answered, TYPE_LIMITS.MESH_POSTS_REQUEST.burst);
  assert.equal(lim.allow(B, 'MESH_POSTS_REQUEST'), true, 'another sender keeps its own budget');
  t += 30_000;
  assert.equal(lim.allow(A, 'MESH_POSTS_REQUEST'), false);
  t += 30_000;
  assert.equal(lim.allow(A, 'MESH_POSTS_REQUEST'), true);
});

test('mail: 10 at once, then about 30 an hour', () => {
  let t = 0;
  const lim = createInboundLimiter(() => t);
  let got = 0;
  for (let i = 0; i < 100; i++) if (lim.allow(A, 'MESH_MAIL')) got++;
  assert.equal(got, 10);
  let later = 0;
  for (let m = 0; m < 60; m++) {
    t += 60_000;
    for (let i = 0; i < 5; i++) if (lim.allow(A, 'MESH_MAIL')) later++;
  }
  assert.ok(later >= 29 && later <= 31, `mail in the next hour: ${later}`);
});

test('the general ceiling stops a flood of any type; transfers and unknown senders pass', () => {
  let t = 0;
  const lim = createInboundLimiter(() => t);
  let ok = 0;
  for (let i = 0; i < 2000; i++) if (lim.allow(A, 'MESH_LOUNGE_MESSAGE')) ok++;
  assert.equal(ok, GENERAL_LIMIT.burst);
  for (let i = 0; i < 2000; i++) assert.equal(lim.allow(A, 'MESH_XFER_CHUNK'), true);
  assert.equal(lim.allow(null, 'MESH_LOUNGE_MESSAGE'), true);
  t += 60_000;
  assert.equal(lim.allow(A, 'MESH_LOUNGE_MESSAGE'), true, 'refills');
});

test('many senders: memory stays bounded', () => {
  let t = 0;
  const lim = createInboundLimiter(() => t);
  for (let i = 0; i < 30_000; i++) {
    lim.allow(`did:nova:${String(i).padStart(64, '0')}`, 'MESH_POST');
    t += 100;
  }
  assert.ok(lim.size() <= 20_000, `buckets ${lim.size()}`);
});
