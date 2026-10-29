// meshCrypto.js — Pure crypto for AI Lounge rooms and the Inference Exchange.
// No database or window access, so it can be tested on its own.
//
// Inference access keys
//   A key is a grant signed by the host's Ed25519 identity and bound to the
//   grantee's DID. Hosts only honour it inside packets signed by that DID, so a
//   leaked key is useless to anyone else; there is no bearer secret to steal.
//
// Inference jobs
//   Each call uses a fresh X25519 key against the host's identity key. HKDF
//   derives separate AES-256-GCM keys for the request and the reply, and the
//   job id, host and caller are bound in as associated data.
//
// Lounge rooms
//   Room name + optional passphrase -> PBKDF2 -> room key and an unrelated room
//   id. Relays route on the id and only ever see ciphertext.

import { ed25519, x25519 } from '@noble/curves/ed25519.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

export const hexToBytes = (hex) => Uint8Array.from(String(hex).match(/.{2}/g) || [], b => parseInt(b, 16));
export const bytesToHex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const randomHex = (n) => bytesToHex(crypto.getRandomValues(new Uint8Array(n)));

const HEX64 = /^[0-9a-f]{64}$/;

export function didToPub(did) {
  const m = /^did:nova:([0-9a-f]{64})$/.exec(String(did || ''));
  return m ? m[1] : null;
}

// Deterministic JSON (sorted keys) so signatures survive re-serialisation.
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

function b64urlEncode(str) {
  let bin = '';
  for (const b of enc.encode(str)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const norm = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
  return dec.decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

// ── Access keys ────────────────────────────────────────────────────────────

export const ACCESS_KEY_PREFIX = 'nvx1_';
const GRANT_DOMAIN = 'novaura-inference-grant-v1:';

export function signGrant(body, secretHex) {
  return bytesToHex(ed25519.sign(enc.encode(GRANT_DOMAIN + canonical(body)), hexToBytes(secretHex)));
}

export function verifyGrant(body, sigHex) {
  const pub = didToPub(body?.host);
  if (!pub || !/^[0-9a-f]{128}$/.test(String(sigHex || ''))) return false;
  try {
    return ed25519.verify(hexToBytes(sigHex), enc.encode(GRANT_DOMAIN + canonical(body)), hexToBytes(pub));
  } catch {
    return false;
  }
}

export function encodeAccessKey(body, sigHex) {
  return ACCESS_KEY_PREFIX + b64urlEncode(JSON.stringify({ g: body, s: sigHex }));
}

/** Parse and verify an access key. Throws a readable error when it is not valid. */
export function decodeAccessKey(token) {
  const clean = String(token || '').replace(/\s+/g, '');
  if (!clean.startsWith(ACCESS_KEY_PREFIX)) {
    throw new Error('That is not a NovAura access key (they start with "nvx1_").');
  }
  let parsed;
  try {
    parsed = JSON.parse(b64urlDecode(clean.slice(ACCESS_KEY_PREFIX.length)));
  } catch {
    throw new Error('The access key is damaged or was not copied completely.');
  }
  if (!parsed?.g || !verifyGrant(parsed.g, parsed.s)) {
    throw new Error('The access key signature does not check out.');
  }
  return { body: parsed.g, sig: parsed.s, token: clean };
}

// ── Inference jobs ─────────────────────────────────────────────────────────

const jobAad = (jobId, hostDid, callerDid) => enc.encode(`nvx1|${jobId}|${hostDid}|${callerDid}`);

async function deriveJobKeys(shared, ephPub, jobId) {
  const base = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const derive = (info) => crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: ephPub, info: enc.encode(info) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { callKey: await derive(`nvx-call:${jobId}`), resultKey: await derive(`nvx-result:${jobId}`) };
}

async function sealWith(key, aad, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, enc.encode(JSON.stringify(obj)));
  return { iv: bytesToHex(iv), ct: bytesToHex(new Uint8Array(ct)) };
}

async function openWith(key, aad, { iv, ct } = {}) {
  if (!/^[0-9a-f]{24}$/.test(String(iv || '')) || !/^(?:[0-9a-f]{2})+$/.test(String(ct || ''))) {
    throw new Error('Malformed ciphertext');
  }
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(iv), additionalData: aad }, key, hexToBytes(ct));
  return JSON.parse(dec.decode(pt));
}

/**
 * Caller side. Encrypts a request to the host's identity key.
 * Returns the wire fields plus an `openResult` function for the reply.
 */
export async function sealInferenceCall({ jobId, hostDid, callerDid, request }) {
  const hostPub = didToPub(hostDid);
  if (!hostPub) throw new Error('Invalid host identity');
  const eph = x25519.utils.randomSecretKey();
  const ephPub = x25519.getPublicKey(eph);
  const shared = x25519.getSharedSecret(eph, ed25519.utils.toMontgomery(hexToBytes(hostPub)));
  eph.fill(0);
  const { callKey, resultKey } = await deriveJobKeys(shared, ephPub, jobId);
  shared.fill(0);
  const aad = jobAad(jobId, hostDid, callerDid);
  const wire = { eph: bytesToHex(ephPub), ...(await sealWith(callKey, aad, request)) };
  return { wire, openResult: (fields) => openWith(resultKey, aad, fields) };
}

/**
 * Host side. Decrypts a request with the host's identity secret.
 * Returns the request plus a `sealResult` function for the reply.
 */
export async function openInferenceCall({ jobId, hostDid, hostSecretHex, callerDid, wire }) {
  if (!HEX64.test(String(wire?.eph || ''))) throw new Error('Malformed ephemeral key');
  const ephPub = hexToBytes(wire.eph);
  const shared = x25519.getSharedSecret(ed25519.utils.toMontgomerySecret(hexToBytes(hostSecretHex)), ephPub);
  const { callKey, resultKey } = await deriveJobKeys(shared, ephPub, jobId);
  shared.fill(0);
  const aad = jobAad(jobId, hostDid, callerDid);
  const request = await openWith(callKey, aad, wire);
  return { request, sealResult: (obj) => sealWith(resultKey, aad, obj) };
}

// ── Lounge rooms ───────────────────────────────────────────────────────────

const ROOM_KDF_ITERATIONS = 210000;

export function normalizeRoomName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40);
}

/**
 * Derive a room's key and id. Everyone who knows the name (and passphrase, if
 * any) derives the same values. The id comes from separate output bits, so it
 * reveals nothing about the key.
 */
export async function deriveRoomKey(roomName, passphrase = '') {
  const name = normalizeRoomName(roomName);
  if (!name) throw new Error('Room name is required.');
  const base = await crypto.subtle.importKey('raw', enc.encode(`${name}\u0000${passphrase}`), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`novaura-lounge-room-v1:${name}`), iterations: ROOM_KDF_ITERATIONS },
    base,
    512,
  ));
  return { name, keyHex: bytesToHex(bits.slice(0, 32)), roomId: 'r_' + bytesToHex(bits.slice(32, 48)) };
}

const _roomKeys = new Map();

async function roomCryptoKey(keyHex) {
  if (!_roomKeys.has(keyHex)) {
    _roomKeys.set(keyHex, crypto.subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']));
  }
  return _roomKeys.get(keyHex);
}

export async function sealRoomPayload(keyHex, roomId, obj) {
  return sealWith(await roomCryptoKey(keyHex), enc.encode(`lounge|${roomId}`), obj);
}

export async function openRoomPayload(keyHex, roomId, fields) {
  return openWith(await roomCryptoKey(keyHex), enc.encode(`lounge|${roomId}`), fields);
}
