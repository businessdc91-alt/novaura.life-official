/**
 * SecretService — reads secrets from process.env and handles vault encryption/decryption
 */
import * as crypto from 'crypto';

class SecretService {
  private cache: Record<string, string> = {};
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 12;
  private readonly KEY_LENGTH = 32;
  private readonly ITERATIONS = 100000;
  private readonly SALT = 'novaura-vault-v1';

  async getSecret(name: string): Promise<string | null> {
    if (this.cache[name]) return this.cache[name];
    const value = process.env[name] || null;
    if (value) {
      this.cache[name] = value;
      console.log(`[SecretService] Loaded: ${name}`);
    } else {
      console.warn(`[SecretService] Missing env var: ${name}`);
    }
    return value;
  }

  clearCache() {
    this.cache = {};
  }

  // ─── Vault Security (BYOK) ────────────────────────────────────────────────

  private getVaultKey(): Buffer {
    const secret = process.env.VAULT_ENCRYPTION_SECRET || 'novaura-default-vault-secret-do-not-use-in-prod';
    return crypto.pbkdf2Sync(secret, this.SALT, this.ITERATIONS, this.KEY_LENGTH, 'sha256');
  }

  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, this.getVaultKey(), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (err) {
      console.error('[Vault] Encryption failed:', err);
      throw new Error('Encryption failed');
    }
  }

  decrypt(encryptedData: string): string {
    try {
      if (!encryptedData.includes(':')) return this.decryptLegacy(encryptedData);
      const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.getVaultKey(), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('[Vault] Decryption failed:', err);
      return encryptedData; // Return as-is if it's not actually encrypted
    }
  }

  private decryptLegacy(encrypted: string): string {
    const xorKey = process.env.USER_KEY_ENCRYPTION_SECRET || 'novaura-user-secret';
    try {
      const buffer = Buffer.from(encrypted, 'base64');
      let result = '';
      for (let i = 0; i < buffer.length; i++) {
        result += String.fromCharCode(buffer[i] ^ xorKey.charCodeAt(i % xorKey.length));
      }
      return result;
    } catch {
      return encrypted;
    }
  }

  generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }
}

export const secretService = new SecretService();
