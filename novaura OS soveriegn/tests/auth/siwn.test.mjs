// Sign in with NovAura tokens: audience, issuer binding, nonce, lifetime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519.js';
import { signToken, verifySovereignToken, normalizeAudience, base64UrlEncode, bytesToHex } from '../../src/services/siwnToken.js';

const hex = (b) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
function key() {
  const secret = ed25519.utils.randomSecretKey();
  const pub = hex(ed25519.getPublicKey(secret));
  return { secretHex: hex(secret), pub, did: `did:nova:${pub}` };
}
const alice = key();
const mallory = key();
const now = Date.now();
const payloadFor = (k, extra = {}) => ({
  iss: k.did, aud: 'shop.nova', nonce: 'server-123', iat: now, exp: now + 3600000,
  scopes: ['identity:read'], operator: { handle: 'alice', publicKey: k.pub }, ...extra,
});

test('a token for the right site verifies; another site or no audience does not', () => {
  const token = signToken(payloadFor(alice), alice.secretHex);
  const ok = verifySovereignToken(token, { audience: 'nova://shop.nova/', nonce: 'server-123' });
  assert.equal(ok.valid, true);
  assert.equal(ok.did, alice.did);
  assert.equal(verifySovereignToken(token, { audience: 'bank.nova' }).valid, false);
  assert.equal(verifySovereignToken(token).valid, false, 'audience is required');
  assert.equal(verifySovereignToken(token, { audience: 'shop.nova', nonce: 'other' }).valid, false);
});

test('a token claiming someone else as issuer is rejected', () => {
  // Mallory signs with her key but names Alice as the issuer.
  const forged = signToken(payloadFor(alice, { operator: { handle: 'alice', publicKey: mallory.pub } }), mallory.secretHex);
  assert.equal(verifySovereignToken(forged, { audience: 'shop.nova' }).valid, false);
  const forged2 = signToken(payloadFor(alice, { operator: { handle: 'alice' } }), mallory.secretHex);
  assert.equal(verifySovereignToken(forged2, { audience: 'shop.nova' }).valid, false);
});

test('tampering, expiry, overlong lifetime and unprefixed signatures fail', () => {
  const token = signToken(payloadFor(alice), alice.secretHex);
  const [h, , s] = token.split('.');
  const tampered = `${h}.${base64UrlEncode(JSON.stringify(payloadFor(alice, { aud: 'shop.nova', scopes: ['vault:profile'] })))}.${s}`;
  assert.equal(verifySovereignToken(tampered, { audience: 'shop.nova' }).valid, false);
  assert.equal(verifySovereignToken(signToken(payloadFor(alice, { exp: now - 1 }), alice.secretHex), { audience: 'shop.nova' }).valid, false);
  assert.equal(verifySovereignToken(signToken(payloadFor(alice, { exp: now + 400 * 86400000 }), alice.secretHex), { audience: 'shop.nova' }).valid, false);
  // A signature over the bare header.payload (no SIWN-v1 prefix) is not accepted.
  const p = base64UrlEncode(JSON.stringify(payloadFor(alice)));
  const bare = bytesToHex(ed25519.sign(new TextEncoder().encode(`${h}.${p}`), Uint8Array.from(alice.secretHex.match(/.{2}/g).map(b => parseInt(b, 16)))));
  assert.equal(verifySovereignToken(`${h}.${p}.${bare}`, { audience: 'shop.nova' }).valid, false);
});

test('audience normalization', () => {
  assert.equal(normalizeAudience('nova://Shop.Nova/path'), 'shop.nova');
  assert.equal(normalizeAudience('https://example.com:8443/x'), 'example.com:8443');
});
