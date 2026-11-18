// scopeToken.js — a single-use, signed authorization that a probe run may touch one
// target in one mode. Minted by this node, signed with its ed25519 node key, and
// verified before the runner is started. Because verification requires the signature
// to be this node's own key AND the nonce to be unused, a bug in a caller cannot widen
// scope: it cannot forge a token for our key, reuse one, or point one at another target.
//
// The sandbox loopback the executor is pinned to is a constant, not part of the token.

import { ed25519 } from '@noble/curves/ed25519.js';
import { hexToBytes, bytesToHex, cleanPubHex } from '../web/novaNames.js';
import { getLocalIdentity } from '../sovereignMesh.js';

const enc = (s) => new TextEncoder().encode(s);
const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

/** Fixed field order, joined by '|'. The signed message. */
export function canonicalScope({ targetId, mode, nonce, exp }) {
  return [targetId, mode, nonce, exp].join('|');
}

function localKeys() {
  const id = getLocalIdentity() || {};
  const secret = String(id.secretKeyHex || '').replace(/^0x/i, '').toLowerCase();
  return { pub: cleanPubHex(id.publicKey), secret: HEX64.test(secret) ? secret : null };
}

/**
 * mintScopeToken(target, mode, { now = Date.now, ttlMs = 600000 }) -> token
 * token = { targetId, mode, nonce, exp, pub, sig }.
 */
export function mintScopeToken(target, mode, { now = Date.now, ttlMs = 600000 } = {}) {
  const { pub, secret } = localKeys();
  if (!pub || !secret) throw new Error('Create this node’s identity before probing (Peering).');
  const targetId = target?.id;
  if (!targetId) throw new Error('Cannot mint a scope token without a target id.');
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const exp = now() + ttlMs;
  const sig = bytesToHex(ed25519.sign(enc(canonicalScope({ targetId, mode, nonce, exp })), hexToBytes(secret)));
  return { targetId, mode, nonce, exp, pub, sig };
}

/**
 * verifyScopeToken(token, { now = Date.now, seenNonces }) -> { ok, targetId?, mode?, reason? }
 * Rejects a bad signature, a pub that is not this node's key, an expired token, or a
 * replayed nonce. On success the nonce is added to seenNonces so it cannot be reused.
 */
export function verifyScopeToken(token, { now = Date.now, seenNonces } = {}) {
  const { targetId, mode, nonce, exp, pub, sig } = token || {};
  if (typeof targetId !== 'string' || typeof mode !== 'string' || typeof nonce !== 'string'
      || typeof exp !== 'number' || typeof pub !== 'string' || typeof sig !== 'string') {
    return { ok: false, reason: 'Malformed scope token.' };
  }
  let sigOk = false;
  try {
    const p = cleanPubHex(pub);
    sigOk = HEX128.test(sig) && !!p && ed25519.verify(hexToBytes(sig), enc(canonicalScope({ targetId, mode, nonce, exp })), hexToBytes(p));
  } catch { sigOk = false; }
  if (!sigOk) return { ok: false, reason: 'Scope token signature does not verify.' };

  const local = localKeys().pub;
  if (!local || cleanPubHex(pub) !== local) return { ok: false, reason: 'Scope token is for another node key.' };
  if (!(exp > now())) return { ok: false, reason: 'Scope token has expired.' };
  if (seenNonces) {
    if (seenNonces.has(nonce)) return { ok: false, reason: 'Scope token has already been used.' };
    seenNonces.add(nonce);
  }
  return { ok: true, targetId, mode };
}
