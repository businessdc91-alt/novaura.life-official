// siwnToken.js — Sign in with NovAura (SIWN-v1) tokens: format, signing and
// verification. No storage or identity access, so sites (and tests) can use it
// on its own; decentralizedAuthService.js issues tokens with the node key.

import { ed25519 } from '@noble/curves/ed25519.js';

export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, '');
  return new Uint8Array(clean.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

export function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return decodeURIComponent(escape(atob(b64)));
}

// Signed bytes start with this, so a token signature can never double as a
// mesh packet signature (both use the node identity key).
export const SIGNING_PREFIX = 'SIWN-v1\n';
export const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** "nova://shop.nova/" or "https://Shop.example:8443" → "shop.nova" / "shop.example:8443". */
export function normalizeAudience(domain) {
  return String(domain || '').trim().toLowerCase()
    .replace(/^(nova|aura|https?):\/\//, '').replace(/\/.*$/, '');
}

export const signingBytes = (headerB64, payloadB64) => new TextEncoder().encode(`${SIGNING_PREFIX}${headerB64}.${payloadB64}`);

/** Header and payload → signed token string. */
export function signToken(payload, secretHex) {
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'Ed25519', typ: 'SIWN-v1' }));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureHex = bytesToHex(ed25519.sign(signingBytes(headerB64, payloadB64), hexToBytes(secretHex)));
  return `${headerB64}.${payloadB64}.${signatureHex}`;
}

/**
 * Verify a SIWN-v1 token for a site.
 * verifySovereignToken(token, { audience, nonce }) — `audience` (the site's
 * own domain) is required; `nonce`, when the site issued one, must match.
 * The identity is `iss` (did:nova:<key>); the signature must be by that key.
 */
export function verifySovereignToken(token, options = {}) {
  const { audience, nonce = null } = typeof options === 'string' ? { audience: options } : (options || {});
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token missing or invalid format' };
    }
    if (!audience) {
      return { valid: false, error: 'An audience (your site\'s domain) is required to verify a token' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure (must have 3 parts)' };
    }

    const [headerB64, payloadB64, signatureHex] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64));
    const payload = JSON.parse(base64UrlDecode(payloadB64));

    if (header.alg !== 'Ed25519' || header.typ !== 'SIWN-v1') {
      return { valid: false, error: `Unsupported token algorithm/type: ${header.alg}/${header.typ}` };
    }

    const now = Date.now();
    if (!Number.isFinite(payload.exp) || now > payload.exp) {
      return { valid: false, error: 'Token has expired' };
    }
    if (!Number.isFinite(payload.iat) || payload.iat > now + CLOCK_SKEW_MS || payload.exp - payload.iat > TOKEN_LIFETIME_MS) {
      return { valid: false, error: 'Token issue time or lifetime is invalid' };
    }

    if (payload.aud !== normalizeAudience(audience)) {
      return { valid: false, error: `Audience mismatch: expected ${normalizeAudience(audience)}, got ${payload.aud}` };
    }
    if (nonce !== null && payload.nonce !== nonce) {
      return { valid: false, error: 'Nonce mismatch (token was not issued for this sign-in)' };
    }

    // The key comes only from `iss`; a differing self-described key is a forgery attempt.
    const issMatch = /^did:nova:([0-9a-f]{64})$/.exec(String(payload.iss || ''));
    if (!issMatch) {
      return { valid: false, error: 'Issuer is not a did:nova identity' };
    }
    const pubHex = issMatch[1];
    if (payload.operator?.publicKey && String(payload.operator.publicKey).replace(/^0x/, '').toLowerCase() !== pubHex) {
      return { valid: false, error: 'Token profile key does not match its issuer' };
    }
    if (!/^[0-9a-f]{128}$/.test(signatureHex)) {
      return { valid: false, error: 'Signature is malformed' };
    }

    const isValid = ed25519.verify(hexToBytes(signatureHex), signingBytes(headerB64, payloadB64), hexToBytes(pubHex));
    if (!isValid) {
      return { valid: false, error: 'Cryptographic signature verification failed' };
    }

    return {
      valid: true,
      did: payload.iss,
      payload,
      session: payload.operator,
      scopes: payload.scopes,
    };
  } catch (err) {
    return { valid: false, error: err.message || 'Verification exception' };
  }
}

