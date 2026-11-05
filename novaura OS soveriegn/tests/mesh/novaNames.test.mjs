// Mesh web names: .nova .aura .novaura .catalyst, the operator chain, claims and decisions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  parseMeshName, meshUrl, factionOf, reviewReason,
  signOperatorCert, readOperatorCert, signRecord, verifyRecord, recordIsLive, isNewerRecord,
  signClaim, verifyClaim, decideClaim, TERM_MS, GRACE_MS, bytesToHex,
} from '../../src/services/web/novaNames.js';

const key = () => {
  const secret = ed25519.utils.randomSecretKey();
  return { secret: bytesToHex(secret), pub: bytesToHex(ed25519.getPublicKey(secret)) };
};
const authority = key();
const operator = key();
const alice = key();
const bob = key();
const AUTH = { 'test-auth': { pubkeyHex: authority.pub, status: 'ACTIVE' } };
const NOW = Date.UTC(2026, 10, 4);
const cert = signOperatorCert({ kid: 'test-auth', operator: operator.pub, tlds: ['nova', 'aura', 'novaura', 'catalyst'], days: 365, now: NOW }, authority.secret);
const opts = { authorities: AUTH, now: NOW + 1000 };

function record(fields = {}) {
  return signRecord({ name: 'alice.nova', owner: alice.pub, seq: 1, registeredAt: NOW, expiresAt: NOW + TERM_MS, updatedAt: NOW, status: 'active', ...fields }, operator.secret, cert);
}

test('all four TLDs parse, subdomains belong to the registrable name', () => {
  for (const tld of ['nova', 'aura', 'novaura', 'catalyst']) {
    assert.equal(parseMeshName(`site.${tld}`).registrable, `site.${tld}`);
  }
  const p = parseMeshName('catalyst://Blog.Dillan.CATALYST/path?x=1');
  assert.deepEqual([p.host, p.registrable, p.sub, p.tld], ['blog.dillan.catalyst', 'dillan.catalyst', 'blog', 'catalyst']);
  assert.equal(meshUrl('shop.aura'), 'aura://shop.aura');
  assert.equal(factionOf('x.aura'), 'aura');
  assert.equal(factionOf('x.novaura'), 'nova');
});

test('rejects other TLDs, bad labels and look-alike punycode', () => {
  for (const bad of ['example.com', 'nova', '.nova', '-bad.nova', 'bad-.nova', 'a_b.nova', 'xn--80ak6aa92e.nova', 'a..nova', `${'a'.repeat(64)}.nova`]) {
    assert.equal(parseMeshName(bad), null, bad);
  }
});

test('reserved and very short names wait for review', () => {
  assert.match(reviewReason('genesis.nova'), /reserved/);
  assert.match(reviewReason('ab.aura'), /shorter/);
  assert.equal(reviewReason('lighthouse.nova'), '');
});

test('a certificate verifies only against its authority', () => {
  assert.equal(readOperatorCert(cert, AUTH).ok, true);
  assert.equal(readOperatorCert(cert, { 'test-auth': { pubkeyHex: key().pub, status: 'ACTIVE' } }).ok, false);
  assert.equal(readOperatorCert(cert, { 'test-auth': { pubkeyHex: authority.pub, status: 'REVOKED' } }).ok, false);
  const forged = signOperatorCert({ kid: 'test-auth', operator: bob.pub, tlds: ['nova'], now: NOW }, bob.secret);
  assert.equal(readOperatorCert(forged, AUTH).ok, false);
  const id = readOperatorCert(cert, AUTH).payload.certId;
  assert.equal(readOperatorCert(cert, AUTH, new Set([id])).ok, false);
});

test('a record verifies through the whole chain and any change breaks it', () => {
  const r = record();
  assert.equal(verifyRecord(r, opts).ok, true);
  for (const change of [{ owner: bob.pub }, { expiresAt: r.expiresAt + 1 }, { name: 'bob.nova' }, { status: 'revoked' }, { seq: 2 }]) {
    assert.equal(verifyRecord({ ...r, ...change }, opts).ok, false, JSON.stringify(change));
  }
});

test('a record outside the certificate TLDs or validity is rejected', () => {
  const narrow = signOperatorCert({ kid: 'test-auth', operator: operator.pub, tlds: ['nova'], now: NOW }, authority.secret);
  const r = signRecord({ name: 'x.catalyst', owner: alice.pub, seq: 1, registeredAt: NOW, expiresAt: NOW + TERM_MS, updatedAt: NOW, status: 'active' }, operator.secret, narrow);
  assert.match(verifyRecord(r, opts).reason, /does not run \.catalyst/);
  const late = record({ updatedAt: NOW + 400 * 86400 * 1000 });
  assert.equal(verifyRecord(late, { ...opts, now: NOW + 401 * 86400 * 1000 }).ok, false);
  const otherOperator = signRecord({ name: 'alice.nova', owner: alice.pub, seq: 1, registeredAt: NOW, expiresAt: NOW + TERM_MS, updatedAt: NOW, status: 'active' }, bob.secret, cert);
  assert.equal(verifyRecord(otherOperator, opts).ok, false);
});

test('liveness and ordering', () => {
  const r = record();
  assert.ok(recordIsLive(r, NOW + 1));
  assert.ok(!recordIsLive(r, NOW + TERM_MS + 1));
  assert.ok(isNewerRecord(record({ seq: 2 }), r));
  assert.ok(!isNewerRecord(r, record({ seq: 2 })));
});

test('claims are signed by their owner and expire', () => {
  const c = signClaim({ action: 'register', name: 'nova://Alice.nova', now: NOW }, alice.secret);
  assert.equal(c.name, 'alice.nova');
  assert.equal(verifyClaim(c, NOW).ok, true);
  assert.equal(verifyClaim({ ...c, owner: bob.pub }, NOW).ok, false);
  assert.equal(verifyClaim(c, NOW + 15 * 86400 * 1000).ok, false);
  assert.equal(verifyClaim(signClaim({ action: 'transfer', name: 'alice.nova', to: alice.pub, now: NOW }, alice.secret), NOW).ok, false);
});

test('open names are first come, first served', () => {
  const c = signClaim({ action: 'register', name: 'lighthouse.nova', now: NOW }, alice.secret);
  const d = decideClaim(c, { now: NOW });
  assert.equal(d.decision, 'approve');
  assert.equal(d.fields.owner, alice.pub);
  assert.equal(d.fields.expiresAt, NOW + TERM_MS);
  const taken = record({ name: 'lighthouse.nova' });
  assert.equal(decideClaim(signClaim({ action: 'register', name: 'lighthouse.nova', now: NOW }, bob.secret), { current: taken, now: NOW }).decision, 'reject');
});

test('reviewed TLDs, reserved names and big holders wait for the operator', () => {
  const now = NOW;
  assert.equal(decideClaim(signClaim({ action: 'register', name: 'crew.catalyst', now }, alice.secret), { policy: 'reviewed', now }).decision, 'review');
  assert.equal(decideClaim(signClaim({ action: 'register', name: 'genesis.nova', now }, alice.secret), { now }).decision, 'review');
  assert.equal(decideClaim(signClaim({ action: 'register', name: 'eleventh.nova', now }, alice.secret), { ownerOpenNames: 10, now }).decision, 'review');
  assert.equal(decideClaim(signClaim({ action: 'register', name: 'genesis.nova', now }, alice.secret), { now, reviewed: true }).decision, 'approve');
});

test('only the owner renews, transfers or releases, and old claims cannot be replayed', () => {
  const current = record();
  const later = NOW + 60_000;
  const renew = decideClaim(signClaim({ action: 'renew', name: 'alice.nova', now: later }, alice.secret), { current, now: later });
  assert.equal(renew.decision, 'approve');
  assert.equal(renew.fields.seq, 2);
  assert.equal(decideClaim(signClaim({ action: 'renew', name: 'alice.nova', now: later }, bob.secret), { current, now: later }).decision, 'reject');

  const transfer = decideClaim(signClaim({ action: 'transfer', name: 'alice.nova', to: bob.pub, now: later }, alice.secret), { current, now: later });
  assert.equal(transfer.fields.owner, bob.pub);

  const release = decideClaim(signClaim({ action: 'release', name: 'alice.nova', now: later }, alice.secret), { current, now: later });
  assert.equal(release.fields.status, 'released');
  const releasedRecord = record({ ...release.fields });
  assert.equal(verifyRecord(releasedRecord, { ...opts, now: later }).ok, true);

  const stale = signClaim({ action: 'release', name: 'alice.nova', now: NOW - 1000 }, alice.secret);
  assert.equal(decideClaim(stale, { current, now: later }).decision, 'reject');
  assert.equal(decideClaim(signClaim({ action: 'renew', name: 'alice.nova', now: later }, alice.secret), { current, now: later, seen: true }).decision, 'reject');
});

test('a lapsed name is held for its last owner during the grace period', () => {
  const lapsed = record();
  const inGrace = NOW + TERM_MS + 86400 * 1000;
  assert.equal(decideClaim(signClaim({ action: 'register', name: 'alice.nova', now: inGrace }, bob.secret), { current: lapsed, now: inGrace }).decision, 'reject');
  assert.equal(decideClaim(signClaim({ action: 'renew', name: 'alice.nova', now: inGrace }, alice.secret), { current: lapsed, now: inGrace }).decision, 'approve');
  const afterGrace = NOW + TERM_MS + GRACE_MS + 1000;
  assert.equal(decideClaim(signClaim({ action: 'register', name: 'alice.nova', now: afterGrace }, bob.secret), { current: lapsed, now: afterGrace }).decision, 'approve');
});
