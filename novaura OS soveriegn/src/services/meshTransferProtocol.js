// meshTransferProtocol.js — The rules of a file transfer between two nodes, with
// no I/O (meshTransfers.js does the sending and the disk), so they're unit tested.
//
//   sender                                  receiver
//   MESH_XFER_OFFER  (size, pieces, salt, session, name sealed when the key is known) ──▶
//                    ◀── MESH_XFER_ACCEPT (first piece it still needs)
//   MESH_XFER_CHUNK × n (AES-256-GCM, a few in flight) ──▶
//                    ◀── MESH_XFER_ACK (every piece below `next` is on disk)
//   MESH_XFER_DONE   (SHA-256 of the whole file) ──▶
//                    ◀── MESH_XFER_RESULT (the file checked out, or why not)
//   MESH_XFER_CANCEL either way, any time.
//
// The piece key comes from both identity keys (X25519), the transfer's salt and
// the offer's session through HKDF, so only the two nodes can read the pieces;
// relays see ciphertext. Every offer (a resume too) brings a new session, so a
// file that changed before a resume is never encrypted under a key and nonce
// already used for its old contents.
// There is no limit on the file size: pieces go out as acknowledgements come
// back, and a dropped connection resumes from the last acknowledged piece.

export const XFER_TYPES = ['MESH_XFER_OFFER', 'MESH_XFER_ACCEPT', 'MESH_XFER_CHUNK', 'MESH_XFER_ACK', 'MESH_XFER_DONE', 'MESH_XFER_RESULT', 'MESH_XFER_CANCEL'];

/** One piece of the file per packet (about 5.4 MB on the wire after encryption and base64). */
export const CHUNK_BYTES = 4 * 1024 * 1024;
/** Pieces sent ahead of the last acknowledgement. */
export const WINDOW = 4;
/** No acknowledgement for this long: send again from the last acknowledged piece. */
export const STALL_MS = 45_000;

const ID = /^xf_[0-9a-f]{24}$/;
const HEX = /^[0-9a-f]*$/;
const MAX_NAME = 255;

const bytesToHex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

export function newTransferId() {
  return `xf_${bytesToHex(crypto.getRandomValues(new Uint8Array(12)))}`;
}

export const isTransferId = (id) => ID.test(String(id || ''));

export function chunkCount(size, chunkBytes = CHUNK_BYTES) {
  return size > 0 ? Math.ceil(size / chunkBytes) : 0;
}

/** Plain bytes in piece `i` of a file of `size`. */
export function chunkLength(i, size, chunkBytes = CHUNK_BYTES) {
  return Math.max(0, Math.min(chunkBytes, size - i * chunkBytes));
}

/** AES-GCM nonce for piece `i`: 4 zero bytes, then `i` as a 64-bit big-endian number. Unique per session key. */
export function chunkIv(i) {
  const iv = new Uint8Array(12);
  new DataView(iv.buffer).setBigUint64(4, BigInt(i));
  return iv;
}

/** Binds a piece to its transfer and position, so pieces can't be swapped or replayed elsewhere. */
export const chunkAad = (id, i) => new TextEncoder().encode(`${id}:${i}`);

export function newSession() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * The piece key: HKDF-SHA256 over the X25519 shared secret of the two identity
 * keys, salted per transfer and bound to the offer's session. Returns a WebCrypto
 * AES-GCM key. (An offer from an older build has no session.)
 */
export async function deriveTransferKey(sharedSecret, saltHex, id, session = null) {
  const ikm = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const info = session ? `NOVA-XFER-v2|${id}|${session}` : `NOVA-XFER-v1|${id}`;
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(info) },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptChunk(key, id, i, plain) {
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: chunkIv(i), additionalData: chunkAad(id, i) }, key, plain));
}

/** Throws when the piece was altered, belongs elsewhere or the key is wrong. */
export async function decryptChunk(key, id, i, cipher) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: chunkIv(i), additionalData: chunkAad(id, i) }, key, cipher));
}

/** An offer from the network, normalized, or null when anything is off. */
export function admitOffer(raw) {
  if (!raw || typeof raw !== 'object' || !isTransferId(raw.id)) return null;
  const size = Number(raw.size);
  const chunkBytes = Number(raw.chunkBytes);
  if (!Number.isSafeInteger(size) || size < 0) return null;
  if (!Number.isInteger(chunkBytes) || chunkBytes < 64 * 1024 || chunkBytes > 8 * 1024 * 1024) return null;
  if (Number(raw.chunks) !== chunkCount(size, chunkBytes)) return null;
  if (typeof raw.salt !== 'string' || raw.salt.length !== 32 || !HEX.test(raw.salt)) return null;
  const replyTo = String(raw.replyTo || '');
  if (!replyTo || replyTo.length > 160) return null;
  if (raw.session !== undefined && (typeof raw.session !== 'string' || raw.session.length !== 32 || !HEX.test(raw.session))) return null;
  const offer = { id: raw.id, size, chunkBytes, chunks: chunkCount(size, chunkBytes), salt: raw.salt, replyTo, session: raw.session || null };
  const sealed = raw.sealedMeta;
  if (sealed && typeof sealed === 'object') {
    if (typeof sealed.iv !== 'string' || !HEX.test(sealed.iv) || typeof sealed.ciphertext !== 'string'
      || !HEX.test(sealed.ciphertext) || sealed.ciphertext.length > 8192) return null;
    offer.sealedMeta = { iv: sealed.iv, ciphertext: sealed.ciphertext };
  } else {
    Object.assign(offer, cleanMeta(raw));
  }
  return offer;
}

/** File name and type as the receiver shows them (the disk name is cleaned again natively). */
export function cleanMeta(meta) {
  const printable = [...String(meta?.name || '')].filter(c => c.charCodeAt(0) > 31).join('');
  const name = printable.trim().slice(0, MAX_NAME) || 'received-file';
  const mime = /^[\w.+-]+\/[\w.+-]+$/.test(String(meta?.mime || '')) ? meta.mime : 'application/octet-stream';
  return { name, mime };
}

/**
 * Records piece `i` as written and returns the new `next` (lowest piece not yet
 * on disk). `pending` holds pieces written ahead of `next`.
 */
export function advance(next, pending, i) {
  if (i >= next) pending.add(i);
  let n = next;
  while (pending.has(n)) {
    pending.delete(n);
    n++;
  }
  return n;
}

/** Which piece the sender should send next, or -1 to wait for an acknowledgement. */
export function nextToSend({ sendNext, acked, chunks }) {
  const from = Math.max(sendNext, acked);
  return from < chunks && from < acked + WINDOW ? from : -1;
}
