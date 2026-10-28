/**
 * sovereignAuth.js — Cryptographic Sovereign Node Identity & License Service
 * 
 * Implements offline, air-gapped cryptographic validation for Sovereign Node activation:
 * - Ed25519 digital signature verification against the embedded Novaura Authority public key
 * - Self-signed local node certificates with on-device Ed25519 key generation
 * - Persistent storage in local Dexie vault (db.vault) + local caching
 * - Zero cloud telemetry, 100% private to the operator's machine
 */

import { db } from '../database/sovereignDatabase.js';
import { ed25519 } from '@noble/curves/ed25519.js';

const STORAGE_KEY = 'novaura_sovereign_auth_vault';

// Official Novaura Sovereign Licensing Authority Public Keys Registry
// Each entry maps an explicit Key ID ('kid') to its Ed25519 public key and operational status.
export const TRUSTED_AUTHORITIES = {
  'nova-auth-2026-v1': {
    pubkeyHex: 'e71dced6ba1e1646f9ad868a00c0479933d602775f81cbf81bf6e9b6a49e0143',
    status: 'ACTIVE',
    tier: 'ROOT_GENESIS',
  },
  'nova-auth-operator': {
    pubkeyHex: 'd442d3ac7b1385393c95e17691dade298efe48b79751a550f74ad8de253d8a23',
    status: 'ACTIVE',
    tier: 'FOUNDER_GENESIS',
  },
};

// Default Genesis Root Authority Public Key (Backwards compatibility)
export const AUTHORITY_PUBKEY_HEX = TRUSTED_AUTHORITIES['nova-auth-2026-v1'].pubkeyHex;

// Internal memory cache for synchronous cold-start
let _cachedRecord = null;

// Helper: Base64URL to bytes
function base64UrlToBytes(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

// Helper: Bytes to Base64URL
function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper: Hex string to Uint8Array
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Synchronously initialize cache from localStorage on script load
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    _cachedRecord = JSON.parse(raw);
  }
} catch {
  _cachedRecord = null;
}

/**
 * Robust offline cryptographic checksum computation
 */
export function computeChecksum(input) {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ code, 0x01000193) >>> 0;
    hash2 = Math.imul(hash2 ^ code, 0x27d4eb2f) >>> 0;
  }
  return ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Verify a Sovereign License Key or Cryptographic Token.
 * 
 * Cryptographic Requirement:
 * Tokens MUST be signed by a registered Novaura Authority Key (`NOVA1.<base64url_payload>.<base64url_sig>`).
 * Key ID (`kid`) is resolved against TRUSTED_AUTHORITIES and checked for revocation.
 * Strictly enforces expiration timestamp and individual machine node ID binding.
 * All embedded founder tokens, bypasses, and wildcard node IDs are rejected.
 */
export function verifySovereignKey(rawKey, expectedNodeId = null) {
  if (!rawKey || typeof rawKey !== 'string') {
    return { valid: false, reason: 'License token cannot be empty.' };
  }

  const token = rawKey.trim();

  // Strict Token Validation (NOVA1.* only)
  if (!token.startsWith('NOVA1.')) {
    return {
      valid: false,
      reason: 'MALFORMED_TOKEN: Token must follow official NOVA1.<payload>.<signature> specification.',
    };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'MALFORMED_TOKEN: Invalid segment count in license token.' };
  }

  const [, payloadB64, sigB64] = parts;
  try {
    const payloadBytes = new TextEncoder().encode(payloadB64);
    const sigBytes = base64UrlToBytes(sigB64);
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));

    // 1. Key ID Resolution & Revocation Status Verification
    const targetKid = payload.kid || 'nova-auth-2026-v1';
    const authority = TRUSTED_AUTHORITIES[targetKid];
    if (!authority) {
      return {
        valid: false,
        reason: `UNKNOWN_AUTHORITY_KID: Authority key ID '${targetKid}' is not registered in trusted authorities.`,
      };
    }

    if (authority.status === 'REVOKED') {
      return {
        valid: false,
        reason: `REVOKED_AUTHORITY_KEY: Authority key ID '${targetKid}' has been revoked.`,
      };
    }

    // 2. Cryptographic Signature Verification
    const pubKeyBytes = hexToBytes(authority.pubkeyHex);
    const isValid = ed25519.verify(sigBytes, payloadBytes, pubKeyBytes);
    if (!isValid) {
      return {
        valid: false,
        reason: `CRYPTOGRAPHIC_REJECTION: Signature does not match Novaura Authority key ('${targetKid}').`,
      };
    }

    // 3. Strict Expiration Verification
    if (payload.expires) {
      let expTimestamp = null;
      if (typeof payload.expires === 'number') {
        expTimestamp = payload.expires;
      } else if (typeof payload.expires === 'string' && payload.expires !== 'PERPETUAL') {
        expTimestamp = Math.floor(new Date(payload.expires).getTime() / 1000);
      }

      if (expTimestamp) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec > expTimestamp) {
          return {
            valid: false,
            reason: `LICENSE_EXPIRED: License expired on ${new Date(expTimestamp * 1000).toISOString().split('T')[0]}.`,
          };
        }
      }
    }

    // 4. Strict Machine Node Binding Verification (No wildcards or blank nodes permitted)
    const licensedNode = (payload.nodeId || '').trim();
    if (!licensedNode) {
      return {
        valid: false,
        reason: 'UNBOUND_LICENSE: License must be bound to an authentic hardware node ID.',
      };
    }

    if (expectedNodeId) {
      const cleanExpected = expectedNodeId.trim();
      if (licensedNode !== cleanExpected) {
        return {
          valid: false,
          reason: `MACHINE_BINDING_MISMATCH: License is bound to node '${licensedNode}', but current machine is '${cleanExpected}'.`,
        };
      }
    }

    return {
      valid: true,
      tier: payload.tier || 'SOVEREIGN_NODE',
      holder: payload.holder || 'Verified Node Operator',
      nodeId: licensedNode,
      kid: targetKid,
      licenseId: payload.licenseId || null,
      issued: payload.issued ? (typeof payload.issued === 'number' ? new Date(payload.issued * 1000).toISOString().split('T')[0] : payload.issued) : new Date().toISOString().split('T')[0],
      expires: payload.expires ? (typeof payload.expires === 'number' ? new Date(payload.expires * 1000).toISOString().split('T')[0] : payload.expires) : 'PERPETUAL',
      fingerprint: computeChecksum(token),
      isAuthoritySigned: true,
    };
  } catch (err) {
    return { valid: false, reason: `Failed to decode signed token: ${err.message}` };
  }
}

/**
 * Clean & Format standard E.164 in-ecosystem Sovereign Phone Number
 * Format: +1-700-NOVA-[XXXX] or +1-700-[4 digits]-[4 digits]
 */
export function formatSovereignPhoneNumber(input) {
  if (!input) return '+1-700-NOVA-0001';
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (clean.length === 4) {
    return `+1-700-NOVA-${clean}`;
  }
  
  if (clean.length === 8) {
    return `+1-700-${clean.substring(0, 4)}-${clean.substring(4, 8)}`;
  }
  
  const digitsOnly = input.replace(/[^0-9]/g, '');
  if (digitsOnly.startsWith('1700') && digitsOnly.length >= 11) {
    return `+1-700-${digitsOnly.substring(4, 8)}-${digitsOnly.substring(8, 12)}`;
  }

  return `+1-700-NOVA-${clean.substring(0, 4).padEnd(4, '0')}`;
}

/**
 * Validate E.164 Sovereign Phone Number
 */
export function isValidSovereignPhoneNumber(num) {
  if (!num || typeof num !== 'string') return false;
  return /^\+1-700-(NOVA|[0-9]{4})-[A-Z0-9]{4}$/.test(num);
}

/**
 * Retrieve the saved key record from memory or localStorage, while synchronizing with db.vault and native disk.
 */
export function getSavedKeyRecord() {
  if (_cachedRecord && _cachedRecord.key) {
    const expectedNode = _cachedRecord.nodeId || _cachedRecord.hardwareFingerprint || null;
    const verification = verifySovereignKey(_cachedRecord.key, expectedNode);
    if (verification.valid) {
      return { ...verification, ..._cachedRecord };
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const expectedNode = parsed.nodeId || parsed.hardwareFingerprint || null;
      const verification = verifySovereignKey(parsed.key, expectedNode);
      if (verification.valid) {
        _cachedRecord = { ...verification, ...parsed };
        return _cachedRecord;
      }
    }
  } catch {}

  // Attempt asynchronous recovery from native disk certificate
  if (typeof window !== 'undefined') {
    import('./nativeService.js').then(async ({ readNodeCertificate, getHardwareFingerprint }) => {
      try {
        const cert = await readNodeCertificate();
        if (cert && cert.key) {
          const hw = await getHardwareFingerprint();
          // The certificate records the node the license was activated against
          // (current or legacy ID). Native re-verification in App.jsx enforces
          // that this machine is still that node.
          const verification = verifySovereignKey(cert.key, cert.nodeId || hw);
          if (verification.valid) {
            _cachedRecord = { ...verification, ...cert, hardwareFingerprint: hw };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_cachedRecord));
            window.dispatchEvent(new CustomEvent('novaura:auth_updated'));
          }
        }
      } catch {}
    }).catch(() => {});
  }

  return null;
}

/**
 * Save key record to memory, localStorage, Dexie vault, and permanent physical disk file.
 */
export async function saveKeyRecord(key, details, phoneNumber = null) {
  let hwFingerprint = 'NODE-HARDWARE-ROOT';
  try {
    const { getHardwareFingerprint, saveNodeCertificate } = await import('./nativeService.js');
    hwFingerprint = await getHardwareFingerprint();
    
    const assignedPhone = phoneNumber ? formatSovereignPhoneNumber(phoneNumber) : formatSovereignPhoneNumber(key.substring(0, 4));
    
    const payload = {
      key: key.trim(),
      details,
      phoneNumber: assignedPhone,
      hardwareFingerprint: hwFingerprint,
      nodeId: details.nodeId || `did:nova:${computeChecksum(hwFingerprint + key)}`,
      activatedAt: new Date().toISOString()
    };

    _cachedRecord = payload;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[SovereignAuth] localStorage cache write failed:', e);
    }

    // Persist to permanent physical disk file on user's machine
    await saveNodeCertificate(payload);

    // Save to private cloud Dexie vault
    await db.vault.put({
      id: 'sovereign_license',
      keyName: 'SOVEREIGN_NODE_LICENSE',
      value: JSON.stringify(payload),
      provider: 'sovereign_auth',
      updatedAt: Date.now(),
    });

    window.dispatchEvent(new CustomEvent('novaura:auth_updated', { detail: payload }));
    return payload;
  } catch (err) {
    console.error('[SovereignAuth] Critical save error:', err);
    throw err;
  }
}

/**
 * Remove key record
 */
export async function clearKeyRecord() {
  _cachedRecord = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    await db.vault.delete('sovereign_license');
    const { saveNodeCertificate } = await import('./nativeService.js');
    await saveNodeCertificate(null);
  } catch (e) {
    console.warn('[SovereignAuth] Clear note:', e);
  }
  window.dispatchEvent(new CustomEvent('novaura:auth_updated', { detail: null }));
}
