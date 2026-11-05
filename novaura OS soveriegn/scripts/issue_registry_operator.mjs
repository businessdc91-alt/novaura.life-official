#!/usr/bin/env node
/**
 * issue_registry_operator.mjs — Make a node the registry operator for mesh TLDs.
 *
 * Signs an operator certificate with the authority key, binding the operator
 * node's public key to the TLDs it may run, for a number of days. Paste the
 * printed certificate into Nova Registry > Operator on that node.
 *
 *   node scripts/issue_registry_operator.mjs <node public key> [tlds] [days]
 *   node scripts/issue_registry_operator.mjs 0x1a2b... nova,aura,novaura,catalyst 365
 *
 * The authority private key comes from NOVAURA_AUTHORITY_PRIVKEY_HEX or
 * ~/.novaura/sovereign_authority_key.json. It is never printed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ed25519 } from '@noble/curves/ed25519.js';
import { TRUSTED_AUTHORITIES } from '../src/config/trustedAuthorities.js';
import { signOperatorCert, readOperatorCert, MESH_TLDS, bytesToHex, hexToBytes } from '../src/services/web/novaNames.js';

function authoritySecret() {
  const env = (process.env.NOVAURA_AUTHORITY_PRIVKEY_HEX || '').trim();
  if (/^[0-9a-f]{64}$/i.test(env)) return env.toLowerCase();
  const file = path.join(os.homedir(), '.novaura', 'sovereign_authority_key.json');
  if (fs.existsSync(file)) {
    const hex = JSON.parse(fs.readFileSync(file, 'utf8')).privateKeyHex;
    if (/^[0-9a-f]{64}$/i.test(hex || '')) return hex.toLowerCase();
  }
  throw new Error('No authority key: set NOVAURA_AUTHORITY_PRIVKEY_HEX or keep ~/.novaura/sovereign_authority_key.json on this machine.');
}

const [operatorArg, tldArg = MESH_TLDS.join(','), daysArg = '365'] = process.argv.slice(2);
if (!operatorArg) {
  console.log('Usage: node scripts/issue_registry_operator.mjs <node public key> [tlds] [days]');
  console.log(`TLDs: ${MESH_TLDS.join(', ')} (default all). The node public key is shown in Nova Registry > Operator.`);
  process.exit(1);
}

try {
  const secret = authoritySecret();
  const pub = bytesToHex(ed25519.getPublicKey(hexToBytes(secret)));
  const kid = Object.entries(TRUSTED_AUTHORITIES).find(([, a]) => a.pubkeyHex === pub && a.status === 'ACTIVE')?.[0];
  if (!kid) throw new Error('This authority key is not an active entry in src/config/trustedAuthorities.js.');

  const tlds = tldArg.split(',').map(t => t.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
  const days = Number(daysArg);
  if (!Number.isFinite(days) || days <= 0 || days > 3650) throw new Error('Days must be between 1 and 3650.');

  const token = signOperatorCert({ kid, operator: operatorArg, tlds, days }, secret);
  const check = readOperatorCert(token, TRUSTED_AUTHORITIES);
  if (!check.ok) throw new Error(`Self-check failed: ${check.reason}`);

  const p = check.payload;
  console.log('\n=============== NOVA REGISTRY OPERATOR CERTIFICATE ===============');
  console.log(`Authority: ${kid}`);
  console.log(`Operator:  ${p.operator}`);
  console.log(`TLDs:      ${p.tlds.map(t => '.' + t).join(' ')}`);
  console.log(`Valid:     ${new Date(p.issued * 1000).toISOString()} to ${new Date(p.expires * 1000).toISOString()}`);
  console.log(`Cert ID:   ${p.certId}`);
  console.log('\nCERTIFICATE (paste into Nova Registry > Operator):');
  console.log(token);
  console.log('==================================================================\n');
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
