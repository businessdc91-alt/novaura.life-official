/**
 * phoneNumbers.js — Nova Phone numbers (+1-700-XXXX-XXXX).
 *
 * A number is only a label people dial. A call goes to the node key that
 * answers for the number over the mesh (sovereignCallService.js). Without a
 * chosen number, one is derived from the node's own public key, so two nodes
 * never share a default.
 */

// Defaults that older builds gave everyone; treated as "no number chosen".
// 1700NOVA1700 is what the old formatter made of any "+1-700-NOVA-XXXX" typed at activation.
const SHARED_PLACEHOLDERS = new Set(['1700NOVA0001', '1700NOVA8820', '1700NOVA8821', '1700NOVANOVA', '1700NOVA1700']);

/** Uppercase letters and digits only, for comparing numbers however they were typed. */
export function phoneKey(number) {
  return String(number || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function samePhoneNumber(a, b) {
  const ka = phoneKey(a);
  return ka.length >= 4 && ka === phoneKey(b);
}

export function isSharedPlaceholder(number) {
  return SHARED_PLACEHOLDERS.has(phoneKey(number));
}

/** +1-700-1234-5678 from the first 48 bits of an Ed25519 public key, or '' without one. */
export function derivePhoneNumber(pubHex) {
  const clean = String(pubHex || '').replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return '';
  const digits = String(parseInt(clean.slice(0, 12), 16) % 1e8).padStart(8, '0');
  return `+1-700-${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/** The first chosen number that is not an old shared default, else the derived one. */
export function chooseMyNumber({ chosen = [], pubHex = '' } = {}) {
  for (const n of chosen) {
    if (phoneKey(n).length >= 4 && !isSharedPlaceholder(n)) return n;
  }
  return derivePhoneNumber(pubHex);
}
