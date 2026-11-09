// meshNodeIds.js — The routing ID of an identity key.
//
// A node's mesh ID is NODE- and the first 128 bits of SHA-256 of its raw Ed25519
// public key, in upper-case hex (src-tauri/src/mesh.rs and the relay compute the
// same). Anyone can work out which node a DID lives on, and only the key's holder
// can register that ID with a relay or sign a LAN beacon for it, so an address
// can't be taken over by someone who merely knows it.

import { sha256 } from '@noble/hashes/sha2.js';

const NODE_ID = /^NODE-[0-9A-F]{32}$/;

export function meshNodeIdForPub(pubHex) {
  const clean = String(pubHex || '').trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return null;
  const bytes = new Uint8Array(clean.match(/.{2}/g).map(b => parseInt(b, 16)));
  const digest = sha256(bytes).slice(0, 16);
  return 'NODE-' + Array.from(digest, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** The node ID for a node ID, a did:nova: DID or a bare public key; null for anything else. */
export function meshNodeIdFor(id) {
  const s = String(id || '').trim();
  if (NODE_ID.test(s)) return s;
  const did = /^did:nova:(?:0x)?([0-9a-fA-F]{64})$/.exec(s);
  if (did) return meshNodeIdForPub(did[1]);
  return /^(?:0x)?[0-9a-fA-F]{64}$/.test(s) ? meshNodeIdForPub(s) : null;
}

export const isMeshNodeId = (id) => NODE_ID.test(String(id || ''));
