// founderLicense.js — Which authority a license grants.
//
// Founder and council authority is a NOVA1 license signed by the Novaura
// authority key (scripts/issue_license.js, run where that key lives; it is
// never in the app). Nothing else counts: no shared strings, no local
// defaults, and a stored record's own `tier` field is ignored in favour of the
// signature-checked token.

import { verifySovereignKey } from './sovereignAuth.js';

const FOUNDER_LICENSE_TIERS = new Set(['FOUNDER_SOVEREIGN', 'FOUNDER_GENESIS', 'FOUNDER']);
const COUNCIL_LICENSE_TIERS = new Set(['COUNCIL', 'COUNCIL_CUSTODIAN']);

export const ISSUE_KEY_INSTRUCTIONS =
  'Founder and council keys are licenses signed by your Novaura authority key, which never lives in the app. ' +
  'On the machine that holds it, run: node scripts/issue_license.js "<holder name>" <node id> COUNCIL ' +
  '(or FOUNDER_SOVEREIGN), then paste the NOVA1 token here on the other machine.';

/**
 * The authority a license token grants ({ tier: 'founder' | 'council' |
 * 'operator', license }), or null if its signature, expiry or binding fails.
 */
export function licenseAuthority(token, expectedNodeId = null, verify = verifySovereignKey) {
  const verified = verify(String(token || '').trim(), expectedNodeId);
  if (!verified?.valid) return null;
  const licenseTier = String(verified.tier || '').toUpperCase();
  const tier = FOUNDER_LICENSE_TIERS.has(licenseTier) ? 'founder' : COUNCIL_LICENSE_TIERS.has(licenseTier) ? 'council' : 'operator';
  return { tier, license: verified };
}
