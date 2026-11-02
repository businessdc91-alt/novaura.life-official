// Peer marketplace listings: shape, size limits and publisher binding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeMeshListing } from '../../src/services/marketplaceListings.js';

const DID = 'did:nova:' + 'ab'.repeat(32);
const good = {
  id: 'pub_1793592179000_x7k2',
  title: '  Space Miner  ',
  category: 'games',
  description: 'A small game.',
  authorHandle: '@pilot',
  tags: ['godot', 'space'],
  publishedAt: 1793592179000,
};

test('keeps a well-formed listing, bound to the signer', () => {
  const r = sanitizeMeshListing(good, DID);
  assert.equal(r.id, good.id);
  assert.equal(r.title, 'Space Miner');
  assert.equal(r.authorDid, DID);
  assert.equal(r.price, 0);
  assert.deepEqual(r.tags, ['godot', 'space']);
});

test('rejects IDs that could collide with starter items or other data', () => {
  for (const id of ['pub_fastapi_ollama_blueprint', 'settings', '', 'pub_1793592179000_X!', 'pub_12_ab']) {
    assert.equal(sanitizeMeshListing({ ...good, id }, DID), null, id);
  }
});

test('rejects unsigned or incomplete listings', () => {
  assert.equal(sanitizeMeshListing(good, null), null);
  assert.equal(sanitizeMeshListing({ ...good, title: '   ' }, DID), null);
  assert.equal(sanitizeMeshListing({ ...good, category: undefined }, DID), null);
  assert.equal(sanitizeMeshListing('nope', DID), null);
});

test('drops unknown fields and clips oversized ones', () => {
  const r = sanitizeMeshListing({
    ...good,
    title: 'x'.repeat(500),
    tags: Array.from({ length: 40 }, (_, i) => `t${i}`.repeat(20)),
    price: 999,
    payloadSnippet: '<script>alert(1)</script>',
    authorDid: 'did:nova:someone-else',
    publishedAt: Date.now() + 10 * 365 * 86_400_000,
  }, DID);
  assert.equal(r.title.length, 140);
  assert.equal(r.tags.length, 12);
  assert.ok(r.tags.every(t => t.length <= 32));
  assert.equal(r.price, 0);
  assert.equal(r.payloadSnippet, undefined);
  assert.equal(r.authorDid, DID);
  assert.ok(r.publishedAt <= Date.now() + 5 * 60_000, 'future dates are capped');
});
