/**
 * ApiKeyService.ts — NovAura Platform-Generated Key Management
 *
 * Stores NovAura internal API keys (nv_xxxx) in Firestore under:
 *   users/{userId}/api_keys/{keyId}
 *
 * All key values are AES-256-GCM encrypted before write via vaultCrypto.ts.
 * The cloud never holds plaintext keys.
 *
 * NOTE: User BYOK keys (Gemini, Anthropic, Claude, ElevenLabs, etc.) are
 * handled by the Cloud Functions backend at /user/keys/{service} and stored
 * separately — UserKeyHubWindow.jsx already routes those correctly.
 */

import { db } from '@/config/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { encryptValue, decryptValue, maskKey } from './vaultCrypto';

export interface ApiKey {
  id:        string;
  name:      string;
  key:       string;       // plaintext — only in memory, never persisted raw
  maskedKey: string;       // safe for display
  tier:      'free' | 'middle' | 'sovereign';
  endpoint?: string;
  createdAt: string;
  lastUsed?: string;
}

interface StoredApiKey {
  id:           string;
  name:         string;
  encryptedKey: string;    // AES-256-GCM ciphertext
  maskedKey:    string;
  tier:         ApiKey['tier'];
  endpoint?:    string;
  createdAt:    any;
  lastUsed?:    string;
}

function keysCollection(userId: string) {
  return collection(db!, 'users', userId, 'api_keys');
}

class ApiKeyService {

  /** Fetch and decrypt all keys for a user. */
  async getKeys(userId: string): Promise<ApiKey[]> {
    if (!db) return [];
    try {
      const q = query(keysCollection(userId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const results: ApiKey[] = [];

      for (const docSnap of snap.docs) {
        const d = docSnap.data() as StoredApiKey;
        let plaintext = '';
        try {
          plaintext = await decryptValue(userId, d.encryptedKey);
        } catch {
          plaintext = '[decryption failed]';
        }
        results.push({
          id:        d.id,
          name:      d.name,
          key:       plaintext,
          maskedKey: d.maskedKey,
          tier:      d.tier,
          endpoint:  d.endpoint,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? d.createdAt,
          lastUsed:  d.lastUsed,
        });
      }
      return results;
    } catch (err) {
      console.error('[ApiKeyService] getKeys failed:', err);
      return [];
    }
  }

  /** Generate a new NovAura platform key, encrypt, and persist to Firestore. */
  async generateKey(userId: string, name: string, tier: ApiKey['tier']): Promise<ApiKey> {
    const rawKey = `nv_${Math.random().toString(36).substr(2, 12)}_${Math.random().toString(36).substr(2, 12)}`;
    const id     = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const encryptedKey = await encryptValue(userId, rawKey);
    const masked       = maskKey(rawKey);

    const stored: StoredApiKey = {
      id,
      name,
      encryptedKey,
      maskedKey: masked,
      tier,
      createdAt: serverTimestamp(),
    };

    if (db) {
      await setDoc(doc(keysCollection(userId), id), stored);
    }

    return {
      id,
      name,
      key:      rawKey,
      maskedKey: masked,
      tier,
      createdAt: new Date().toISOString(),
    };
  }

  /** Update the endpoint routing for a key. */
  async updateKeyEndpoint(userId: string, keyId: string, endpoint: string): Promise<boolean> {
    if (!db) return false;
    try {
      await updateDoc(doc(keysCollection(userId), keyId), { endpoint });
      return true;
    } catch (err) {
      console.error('[ApiKeyService] updateKeyEndpoint failed:', err);
      return false;
    }
  }

  /** Mark a key as last used (non-blocking). */
  touchKey(userId: string, keyId: string): void {
    if (!db) return;
    updateDoc(doc(keysCollection(userId), keyId), {
      lastUsed: new Date().toISOString(),
    }).catch(() => {});
  }

  /** Delete a key from Firestore. */
  async deleteKey(userId: string, keyId: string): Promise<void> {
    if (!db) return;
    try {
      await deleteDoc(doc(keysCollection(userId), keyId));
    } catch (err) {
      console.error('[ApiKeyService] deleteKey failed:', err);
    }
  }

  /**
   * Validate a raw key string against all stored keys for a user.
   * Decrypts each key to compare — only use for internal validation flows.
   */
  async validateKey(userId: string, keyString: string): Promise<ApiKey | null> {
    const keys = await this.getKeys(userId);
    return keys.find(k => k.key === keyString) || null;
  }

  /** Route a message through a key's configured endpoint. */
  async routeMessage(userId: string, keyString: string, message: Record<string, unknown>): Promise<Response> {
    const apiKey = await this.validateKey(userId, keyString);
    if (!apiKey || !apiKey.endpoint) {
      throw new Error('Invalid API key or missing endpoint redirection.');
    }

    this.touchKey(userId, apiKey.id);

    return fetch(apiKey.endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-NovAura-Key': keyString,
      },
      body: JSON.stringify({ ...message, timestamp: new Date().toISOString() }),
    });
  }
}

export const apiKeyService = new ApiKeyService();
