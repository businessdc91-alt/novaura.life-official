/**
 * decentralizedAuthService.js — "Sign In with NovAura" (SIWN)
 * 100% Decentralized Cryptographic Authentication Protocol for .nova Websites,
 * Cybeni Builds, and Custom Ecosystem Projects without ICANN WHOIS or centralized OAuth.
 *
 * Token Standard: SIWN-v1 (Sovereign Ed25519 Signed Challenge-Response Tokens)
 */

import { db } from '../database/sovereignDatabase.js';
import { getLocalIdentity } from './sovereignMesh.js';
import { TOKEN_LIFETIME_MS, bytesToHex, normalizeAudience, signToken, verifySovereignToken } from './siwnToken.js';

export { normalizeAudience, verifySovereignToken };

// Standard scopes supported by the NovAura Sovereign Auth system
export const STANDARD_AUTH_SCOPES = {
  'identity:read': {
    name: 'Sovereign Identity',
    description: 'Read your decentralized handle, display name, and avatar color',
    riskLevel: 'low',
    defaultGranted: true,
  },
  'node:verify': {
    name: 'Cryptographic Node Verification',
    description: 'Verify your hardware node DID and public key signature',
    riskLevel: 'low',
    defaultGranted: true,
  },
  'mesh:read': {
    name: 'Mesh Network Telemetry',
    description: 'Read connected peer counters and sovereign room presence',
    riskLevel: 'medium',
    defaultGranted: false,
  },
  'vault:profile': {
    name: 'Extended Public Profile',
    description: 'Access your public bio, social karma, and joined channels',
    riskLevel: 'medium',
    defaultGranted: false,
  },
};

/**
 * Generate a cryptographically signed SIWN-v1 token.
 * `domain` must come from the host (the site the tab really shows), never
 * from the requesting page. `nonce` may be the site's own server challenge,
 * which the site then checks with verifySovereignToken(token, { nonce }).
 */
export async function authorizeApp({ domain, appName, scopes = ['identity:read', 'node:verify'], nonce = null }) {
  const identity = getLocalIdentity();
  if (!identity || !identity.secretKeyHex) {
    throw new Error('Sovereign node operator identity keypair is not initialized.');
  }

  const cleanDomain = normalizeAudience(domain);
  if (!cleanDomain) throw new Error('The site requesting sign-in could not be identified.');
  const cleanPub = String(identity.publicKey || '').replace(/^0x/, '').toLowerCase();
  const grantedScopes = (Array.isArray(scopes) ? scopes : []).filter(s => Object.hasOwn(STANDARD_AUTH_SCOPES, s));
  if (!grantedScopes.length) grantedScopes.push('identity:read', 'node:verify');

  const now = Date.now();
  const payload = {
    iss: `did:nova:${cleanPub}`,
    sub: identity.handle || 'operator',
    aud: cleanDomain,
    appName: String(appName || cleanDomain).slice(0, 80),
    scopes: grantedScopes,
    nonce: typeof nonce === 'string' && nonce.length <= 200 ? nonce : `n_${bytesToHex(crypto.getRandomValues(new Uint8Array(12)))}`,
    iat: now,
    exp: now + TOKEN_LIFETIME_MS,
    // Self-described profile; only `iss` is proven by the signature.
    operator: {
      handle: identity.handle || 'operator',
      displayName: identity.displayName || 'Sovereign Operator',
      nodeId: `did:nova:${cleanPub}`,
      publicKey: cleanPub,
      avatarColor: identity.avatarColor || '#00f0ff',
    },
  };

  const token = signToken(payload, identity.secretKeyHex);

  // Record authorization in local private cloud database
  const authRecord = {
    id: cleanDomain,
    domain: cleanDomain,
    appName: payload.appName,
    scopes: payload.scopes,
    operatorNodeId: payload.iss,
    authorizedAt: new Date(now).toISOString(),
    lastUsedAt: new Date(now).toISOString(),
    expiresAt: new Date(payload.exp).toISOString(),
  };

  await db.authorized_apps.put(authRecord).catch(err => {
    console.warn('[DecentralizedAuth] Failed to cache authorized app in DB:', err);
  });

  window.dispatchEvent(new CustomEvent('novaura:app_authorized', { detail: authRecord }));

  return {
    success: true,
    token,
    session: payload.operator,
    scopes: payload.scopes,
    expiresAt: payload.exp,
    domain: cleanDomain,
  };
}

/**
 * Get all authorized apps recorded on this sovereign node
 */
export async function getAuthorizedApps() {
  try {
    return await db.authorized_apps.toArray();
  } catch (e) {
    console.warn('[DecentralizedAuth] getAuthorizedApps error:', e);
    return [];
  }
}

/**
 * Revoke authorization for a specific domain
 */
export async function revokeAppAccess(domain) {
  try {
    const cleanDomain = normalizeAudience(domain);
    await db.authorized_apps.delete(cleanDomain);
    window.dispatchEvent(new CustomEvent('novaura:app_revoked', { detail: { domain: cleanDomain } }));
    return true;
  } catch (e) {
    console.warn('[DecentralizedAuth] revokeAppAccess error:', e);
    return false;
  }
}

/**
 * Record app access timestamp
 */
export async function touchAppAccess(domain) {
  try {
    const cleanDomain = normalizeAudience(domain);
    const app = await db.authorized_apps.get(cleanDomain);
    if (app) {
      await db.authorized_apps.update(cleanDomain, { lastUsedAt: new Date().toISOString() });
    }
  } catch {}
}
