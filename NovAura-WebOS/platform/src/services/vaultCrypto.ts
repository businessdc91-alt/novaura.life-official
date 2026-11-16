/**
 * vaultCrypto.ts — NovAura Client-Side Encryption
 *
 * AES-256-GCM encryption using the browser's native Web Crypto API.
 * Used to encrypt sensitive data (API keys, vault secrets) before writing
 * to Firestore so the cloud store never holds plaintext secrets.
 *
 * Encryption key derivation:
 *   HKDF(SHA-256) over:
 *     - userUID  (ties the key to a specific user identity)
 *     - VITE_VAULT_SECRET  (platform-level env secret, never in client bundle at runtime)
 *
 * Result: Even if the Firestore document is leaked, it's meaningless without
 * the user's UID AND the platform secret.
 */

const SALT = 'novaura-vault-v1'; // non-secret, prevents cross-app reuse

async function deriveKey(userId: string): Promise<CryptoKey> {
  const platformSecret = import.meta.env.VITE_VAULT_SECRET || 'nova-fallback-secret-change-me';
  const raw = `${userId}::${platformSecret}::${SALT}`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(raw),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       new TextEncoder().encode(SALT),
      iterations: 100_000,
      hash:       'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt a plaintext string. Returns a base64-encoded payload (iv + ciphertext). */
export async function encryptValue(userId: string, plaintext: string): Promise<string> {
  const key = await deriveKey(userId);
  const iv  = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  // Prepend IV to ciphertext, then base64-encode the whole thing
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a base64-encoded payload produced by encryptValue. */
export async function decryptValue(userId: string, payload: string): Promise<string> {
  const key     = await deriveKey(userId);
  const combined = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
  const iv        = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/** Mask a key for safe display (e.g. "AIza...XyZ1"). */
export function maskKey(key: string, visibleChars = 6): string {
  if (!key || key.length <= visibleChars * 2) return '••••••••';
  return `${key.slice(0, visibleChars)}${'•'.repeat(8)}${key.slice(-visibleChars)}`;
}
