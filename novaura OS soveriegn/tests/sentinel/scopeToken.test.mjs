import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex } from '../../src/services/web/novaNames.js';

const keypair = () => {
  const sk = ed25519.utils.randomSecretKey();
  return { secretKeyHex: bytesToHex(sk), publicKey: bytesToHex(ed25519.getPublicKey(sk)) };
};

// The scope token signs with THIS node's identity; mock it so the test owns the keys.
let identity = keypair();
mock.module(new URL('../../src/services/sovereignMesh.js', import.meta.url).href, {
  namedExports: { getLocalIdentity: () => identity },
});

const { mintScopeToken, verifyScopeToken, canonicalScope } = await import('../../src/services/sentinel/scopeToken.js');

const target = { id: 'tgt_project_my-app' };

test('canonicalScope has a fixed field order and carries no loopback', () => {
  assert.equal(canonicalScope({ targetId: 'tgt_x', mode: 'safe', nonce: 'abc', exp: 42 }), 'tgt_x|safe|abc|42');
});

test('a freshly minted token verifies and carries its mode', async () => {
  const token = await mintScopeToken(target, 'deep', {});
  const r = await verifyScopeToken(token, { seenNonces: new Set() });
  assert.equal(r.ok, true);
  assert.equal(r.targetId, 'tgt_project_my-app');
  assert.equal(r.mode, 'deep');
});

test('a token with a flipped signature byte is rejected', async () => {
  const token = await mintScopeToken(target, 'safe', {});
  const bad = { ...token, sig: (token.sig[0] === 'a' ? 'b' : 'a') + token.sig.slice(1) };
  assert.equal((await verifyScopeToken(bad, { seenNonces: new Set() })).ok, false);
});

test('an expired token is rejected', async () => {
  const token = await mintScopeToken(target, 'safe', { now: () => 1000, ttlMs: 500 });
  const r = await verifyScopeToken(token, { now: () => 2000, seenNonces: new Set() });
  assert.equal(r.ok, false);
  assert.match(r.reason, /expire/i);
});

test('a token whose targetId was changed after signing is rejected', async () => {
  const token = await mintScopeToken(target, 'safe', {});
  const r = await verifyScopeToken({ ...token, targetId: 'tgt_project_other' }, { seenNonces: new Set() });
  assert.equal(r.ok, false);
});

test('a token signed by a different key is rejected', async () => {
  const mine = identity;
  identity = keypair(); // mint as another node
  const token = await mintScopeToken(target, 'safe', {});
  identity = mine; // verify as us
  assert.equal((await verifyScopeToken(token, { seenNonces: new Set() })).ok, false);
});

test('a nonce already seen is rejected the second time', async () => {
  const token = await mintScopeToken(target, 'safe', {});
  const seen = new Set();
  assert.equal((await verifyScopeToken(token, { seenNonces: seen })).ok, true);
  assert.equal((await verifyScopeToken(token, { seenNonces: seen })).ok, false);
});
