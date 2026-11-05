// authorityKey.mjs — The NovAura authority key for scripts that sign with it.
// It comes from NOVAURA_AUTHORITY_PRIVKEY_HEX or ~/.novaura/sovereign_authority_key.json,
// is checked against src/config/trustedAuthorities.js, and is never printed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ed25519 } from '@noble/curves/ed25519.js';
import { TRUSTED_AUTHORITIES } from '../../src/config/trustedAuthorities.js';
import { bytesToHex, hexToBytes } from '../../src/services/web/novaNames.js';

/** { secret, pub, kid } for the authority key on this machine, or throws. */
export function loadAuthorityKey() {
  let secret = (process.env.NOVAURA_AUTHORITY_PRIVKEY_HEX || '').trim();
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    secret = '';
    const file = path.join(os.homedir(), '.novaura', 'sovereign_authority_key.json');
    if (fs.existsSync(file)) {
      const hex = JSON.parse(fs.readFileSync(file, 'utf8')).privateKeyHex;
      if (/^[0-9a-f]{64}$/i.test(hex || '')) secret = hex;
    }
  }
  if (!secret) throw new Error('No authority key: set NOVAURA_AUTHORITY_PRIVKEY_HEX or keep ~/.novaura/sovereign_authority_key.json on this machine.');
  secret = secret.toLowerCase();
  const pub = bytesToHex(ed25519.getPublicKey(hexToBytes(secret)));
  const kid = Object.entries(TRUSTED_AUTHORITIES).find(([, a]) => a.pubkeyHex === pub && a.status === 'ACTIVE')?.[0];
  if (!kid) throw new Error('This authority key is not an active entry in src/config/trustedAuthorities.js.');
  return { secret, pub, kid };
}
