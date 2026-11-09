// scripts/issue_license.js — Sovereign Node Ed25519 License Issuer (Hardened)
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ed25519 } from '@noble/curves/ed25519.js';

// Authority Key ID Registry
export const AUTHORITY_REGISTRY = {
  'nova-auth-2026-v1': {
    pubkeyHex: 'e71dced6ba1e1646f9ad868a00c0479933d602775f81cbf81bf6e9b6a49e0143',
    tier: 'ROOT_GENESIS',
    status: 'ACTIVE',
  },
};

const NOVAURA_DIR = path.join(os.homedir(), '.novaura');

/**
 * Retrieve private key securely from environment or encrypted vault
 */
function resolvePrivateKey(kid = 'nova-auth-2026-v1') {
  // 1. Environment variable (preferred in CI / Air-gapped signing station)
  const envKey = process.env.NOVAURA_AUTHORITY_PRIVKEY_HEX;
  if (envKey && envKey.trim().length === 64) {
    return Buffer.from(envKey.trim(), 'hex');
  }

  // 2. Check offline encrypted key file if present
  const encKeyFile = path.join(NOVAURA_DIR, `sovereign_authority_${kid}.enc`);
  if (fs.existsSync(encKeyFile)) {
    const passphrase = process.env.NOVAURA_KEY_PASSPHRASE;
    if (!passphrase) {
      throw new Error(`Encrypted authority key file found at ${encKeyFile}, but NOVAURA_KEY_PASSPHRASE is not set.`);
    }
    const encData = JSON.parse(fs.readFileSync(encKeyFile, 'utf8'));
    const key = crypto.scryptSync(passphrase, Buffer.from(encData.salt, 'hex'), 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encData.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encData.tag, 'hex'));
    let decrypted = decipher.update(encData.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return Buffer.from(decrypted, 'hex');
  }

  throw new Error(
    'Authority private key is not loaded. Please set NOVAURA_AUTHORITY_PRIVKEY_HEX in your air-gapped terminal session.'
  );
}

/**
 * Issue cryptographically signed Sovereign License Token
 */
export function issueLicenseToken({
  tier = 'PRO_SOVEREIGN',
  holder,
  nodeId,
  daysValid = 3650,
  kid = 'nova-auth-2026-v1',
  privateKeyBytes = null,
}) {
  if (!holder || !holder.trim()) {
    throw new Error('Mandatory field "holder" missing.');
  }

  if (!nodeId || nodeId.trim() === '*' || !nodeId.trim()) {
    throw new Error('Strict Node Binding Enforced: "nodeId" cannot be blank or wildcard "*".');
  }

  const authority = AUTHORITY_REGISTRY[kid];
  if (!authority) {
    throw new Error(`Unknown authority kid "${kid}". Registered: ${Object.keys(AUTHORITY_REGISTRY).join(', ')}`);
  }

  const privKey = privateKeyBytes || resolvePrivateKey(kid);

  // Cryptographically secure license identifier & timestamps
  const licenseId = crypto.randomBytes(16).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const expires = now + (daysValid * 86400);

  const payload = {
    v: 1,
    kid,
    licenseId,
    tier: tier.trim(),
    holder: holder.trim(),
    nodeId: nodeId.trim(),
    // Bound to the Windows installation ID only (not the old PC-name ID)
    bind: 'machine',
    issued: now,
    expires,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString('base64url');

  const signatureBytes = ed25519.sign(Buffer.from(payloadB64, 'utf8'), privKey);
  const signatureB64 = Buffer.from(signatureBytes).toString('base64url');

  const token = `NOVA1.${payloadB64}.${signatureB64}`;
  return { token, payload };
}

// CLI Execution Helper
if (process.argv[1] && process.argv[1].endsWith('issue_license.js')) {
  const args = process.argv.slice(2);
  const holder = args[0] || process.env.LICENSE_HOLDER;
  const nodeId = args[1] || process.env.LICENSE_NODE_ID;
  const tier = args[2] || process.env.LICENSE_TIER || 'FOUNDER_SOVEREIGN';

  if (!holder || !nodeId) {
    console.log('Usage: node scripts/issue_license.js <holder_name> <node_id> [tier]');
    console.log('Example: node scripts/issue_license.js "Dillan Copeland" "NODE-WIN-C87B2A91" FOUNDER_SOVEREIGN');
    process.exit(1);
  }

  try {
    const result = issueLicenseToken({ holder, nodeId, tier });
    console.log('\n================ NOVAURA SOVEREIGN LICENSE ISSUED ================');
    console.log(`Key ID:     ${result.payload.kid}`);
    console.log(`License ID: ${result.payload.licenseId}`);
    console.log(`Holder:     ${result.payload.holder}`);
    console.log(`Tier:       ${result.payload.tier}`);
    console.log(`Bound Node: ${result.payload.nodeId}`);
    console.log(`Expires:    ${new Date(result.payload.expires * 1000).toISOString()}`);
    console.log('\nTOKEN:');
    console.log(result.token);
    console.log('==================================================================\n');
  } catch (err) {
    console.error(`[LicenseIssuer Error] ${err.message}`);
    process.exit(1);
  }
}
