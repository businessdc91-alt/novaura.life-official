// meshTransfers.js — Sending and receiving files of any size between nodes.
//
// The sender reads its file in 4 MB pieces straight from disk (File.slice), so
// nothing close to the whole file is held in memory, and the receiver's pieces go
// straight to disk natively (src-tauri/src/transfers.rs). A few pieces travel
// ahead of the acknowledgements; when they stop coming, the sender goes back to
// the last acknowledged piece, and a transfer cut off by a restart resumes from
// there when the sender picks the same file again. The receiver accepts each
// file first. Protocol, keys and checks: meshTransferProtocol.js.
//
// Who gets the key: a node's ID is derived from its identity key, so only the
// identity whose node was offered the file can accept it, wherever the offer
// travelled. When the recipient's key is already known (a contact or a did:nova
// address) the file name is sealed too. Only a peer added by bare IP address,
// whose node ID isn't known yet, is trusted on first accept.

import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { db } from '../database/sovereignDatabase.js';
import {
  registerMeshHandler, sendDirectMeshPacket, getMeshNodeId, getLocalIdentity, resolveRecipientPublicKey,
  encryptMailPayload, decryptMailPayload, didToPubHex, getConnectedPeers, resolveMeshNode,
} from './sovereignMesh.js';
import {
  CHUNK_BYTES, STALL_MS, WINDOW, newTransferId, isTransferId, chunkCount, chunkLength, deriveTransferKey,
  encryptChunk, decryptChunk, admitOffer, cleanMeta, advance, nextToSend, newSession,
} from './meshTransferProtocol.js';
import { isMeshNodeId, meshNodeIdForPub } from './meshNodeIds.js';
import { isPopoutWindow } from './popoutWindows.js';
import { formatBytes } from '../config/meshLimits.js';

const EVENT = 'novaura:transfer_updated';
// Statuses: out = waiting → sending → verifying → completed; in = offered → receiving → verifying → completed.
// Either can end failed, declined or cancelled, or be interrupted by a restart.
const ACTIVE = new Set(['waiting', 'sending', 'receiving', 'verifying']);
const MAX_PENDING_OFFERS_PER_PEER = 20;
// New identities cost nothing, so offers waiting for an answer are capped across
// every sender too.
const MAX_PENDING_OFFERS = 100;
const MAX_BAD_PIECES = 6;
const DONE_RETRY_MS = 60_000;

const _out = new Map(); // id → live sending state (holds the File)
const _in = new Map();  // id → live receiving state

const hexToBytes = (hex) => new Uint8Array(String(hex).match(/.{2}/g).map(b => parseInt(b, 16)));
const bytesToHex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString();

/** The node a packet's signer lives on (its ID comes from the signing key). */
const senderNode = (packet) => meshNodeIdForPub(packet?.sender_pubkey);

async function native(cmd, args, options) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(cmd, args, options);
}

function emit(rec) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...rec } }));
}

async function save(rec) {
  rec.updatedAt = now();
  await db.mesh_transfers.put({ ...rec }).catch(err => console.warn('[Transfers] save failed:', err));
  emit(rec);
}

function toast(title, message, type = 'transfer') {
  window.dispatchEvent(new CustomEvent('novaura:mesh_toast', {
    detail: { type, title, message, appId: 'sovereign_peering', props: { initialTab: 'transfers' }, timestamp: Date.now() },
  }));
}

function peerLabel(peerId) {
  const p = getConnectedPeers().find(x => x.id === peerId);
  return p?.name || p?.node_name || String(peerId || 'peer').slice(0, 24);
}

/** X25519 secret shared between this node's identity and a peer's (both Ed25519 keys). */
function sharedSecretWith(peerPubHex) {
  const mine = hexToBytes(getLocalIdentity().secretKeyHex);
  return x25519.getSharedSecret(ed25519.utils.toMontgomerySecret(mine), ed25519.utils.toMontgomery(hexToBytes(peerPubHex)));
}

async function toBase64(bytes) {
  if (typeof bytes.toBase64 === 'function') return bytes.toBase64();
  const url = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(new Blob([bytes]));
  });
  return url.slice(url.indexOf(',') + 1);
}

function fromBase64(text) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(text);
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Listing and local actions ──────────────────────────────────────────────

/** Transfers newest first (records from the old one-packet transfer format are left out). */
export async function listTransfers() {
  try {
    const all = await db.mesh_transfers.orderBy('createdAt').reverse().toArray();
    return all.filter(r => r.direction === 'in' || r.direction === 'out');
  } catch {
    return [];
  }
}

export function subscribeTransfers(fn) {
  const handler = (e) => fn(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export const revealTransfer = (rec) => native('transfer_reveal', { path: rec?.path || null });

// ── Sending ────────────────────────────────────────────────────────────────

/**
 * Offers `file` (a File or Blob) to a peer and sends it once they accept. With
 * `resumeId`, continues an interrupted transfer of the same file.
 * Resolves with { transferId, fileName } once the offer is out.
 */
export async function sendFileToPeer(peerId, file, { resumeId } = {}) {
  if (!(file instanceof Blob)) throw new Error('Choose a file to send.');
  if (isPopoutWindow()) throw new Error('Send files from the main Sovereign window (pop this window back in first).');
  const identity = getLocalIdentity();
  if (!identity?.secretKeyHex) throw new Error('Your node identity has no key yet. Open Sovereign Network to set it up.');
  const replyTo = await getMeshNodeId();
  if (!replyTo) throw new Error('The mesh is not running, so there is no way to reach the peer.');

  const name = file.name || 'file';
  const mime = file.type || 'application/octet-stream';
  let rec = resumeId ? await db.mesh_transfers.get(resumeId) : null;
  if (resumeId && (!rec || rec.direction !== 'out')) throw new Error('That transfer no longer exists.');
  if (rec && rec.size !== file.size) throw new Error(`That is not the same file: it should be ${formatBytes(rec.size)}.`);
  if (!rec) {
    rec = {
      id: newTransferId(), direction: 'out', peerId: await resolveMeshNode(peerId), peerDid: null, peerName: peerLabel(peerId),
      fileName: name, mimeType: mime, size: file.size, chunkBytes: CHUNK_BYTES, chunks: chunkCount(file.size),
      salt: bytesToHex(crypto.getRandomValues(new Uint8Array(16))), next: 0, createdAt: now(),
    };
  } else {
    rec.peerId = await resolveMeshNode(rec.peerId);
  }
  _out.get(rec.id)?.stop?.();
  Object.assign(rec, { status: 'waiting', error: null, rateBps: 0 });
  // A new session, and so a new key, for every offer: a resume never encrypts a
  // piece again under the key and nonce it went out with before.
  const session = newSession();
  // `cipher` keeps each piece in flight as sent, so a resend within the session
  // repeats those bytes instead of encrypting the piece again.
  const live = { rec, file, session, cipher: new Map(), key: null, sendNext: rec.next || 0, acked: rec.next || 0, dupAcks: 0, hashedUpTo: 0, hasher: sha256.create(), waiter: null, pumping: false, failures: 0, lastAckAt: Date.now() };
  live.stop = () => { live.stopped = true; live.waiter?.(); };
  _out.set(rec.id, live);
  await save(rec);

  const offer = { id: rec.id, size: rec.size, chunkBytes: rec.chunkBytes, chunks: rec.chunks, salt: rec.salt, session, replyTo };
  const recipientPub = rec.peerDid ? didToPubHex(rec.peerDid) : await resolveRecipientPublicKey(peerId).catch(() => null);
  if (recipientPub) {
    // The name stays private too when the recipient's key is known.
    const sealed = await encryptMailPayload(recipientPub, identity.secretKeyHex, { name: rec.fileName, mime: rec.mimeType });
    offer.sealedMeta = { iv: sealed.iv, ciphertext: sealed.ciphertext };
    live.expectedPub = recipientPub;
  } else {
    Object.assign(offer, { name: rec.fileName, mime: rec.mimeType });
  }
  if (!(await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_OFFER', offer))) {
    Object.assign(rec, { status: 'failed', error: 'Could not reach this peer. Check that they are online and try again.' });
    _out.delete(rec.id);
    await save(rec);
  }
  return { transferId: rec.id, fileName: rec.fileName };
}

async function readPiece(live, i) {
  const { rec, file } = live;
  const start = i * rec.chunkBytes;
  return new Uint8Array(await file.slice(start, start + chunkLength(i, rec.size, rec.chunkBytes)).arrayBuffer());
}

/** Keeps the whole-file hash in order: hashes pieces up to `i` that haven't been (a resume skips sending them). */
async function hashUpTo(live, i) {
  const long = i - live.hashedUpTo > WINDOW;
  if (long) {
    live.rec.error = 'Re-reading the part already sent…';
    emit(live.rec);
  }
  while (live.hashedUpTo < i && !live.stopped) {
    live.hasher.update(await readPiece(live, live.hashedUpTo));
    live.hashedUpTo++;
  }
  if (long) {
    live.rec.error = null;
    emit(live.rec);
  }
}

function waitForAck(live) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      live.waiter = null;
      // Nothing came back for a while: send again from the last acknowledged piece.
      if (Date.now() - live.lastAckAt >= STALL_MS) live.sendNext = live.acked;
      resolve();
    }, STALL_MS);
    live.waiter = () => { clearTimeout(timer); live.waiter = null; resolve(); };
  });
}

async function pump(live) {
  if (live.pumping) return;
  live.pumping = true;
  const { rec } = live;
  try {
    while (!live.stopped && rec.status === 'sending') {
      if (live.acked >= rec.chunks) {
        await finishSending(live);
        return;
      }
      const i = nextToSend({ sendNext: live.sendNext, acked: live.acked, chunks: rec.chunks });
      if (i < 0) {
        await waitForAck(live);
        continue;
      }
      // Claimed before any await, so a resend requested meanwhile (onAck lowers
      // sendNext) is never overwritten when this piece goes out.
      live.sendNext = i + 1;
      await hashUpTo(live, i);
      let data = live.cipher.get(i);
      if (!data) {
        const plain = await readPiece(live, i);
        if (i === live.hashedUpTo) {
          live.hasher.update(plain);
          live.hashedUpTo++;
        }
        data = await toBase64(await encryptChunk(live.key, rec.id, i, plain));
        live.cipher.set(i, data);
      }
      if (live.stopped) return;
      if (await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_CHUNK', { id: rec.id, i, data })) {
        if (live.failures) { live.failures = 0; rec.error = null; emit(rec); }
      } else {
        live.sendNext = Math.min(live.sendNext, i);
        live.failures++;
        rec.error = 'Peer unreachable. Retrying…';
        emit(rec);
        await sleep(Math.min(30_000, 2000 * live.failures));
      }
    }
  } catch (err) {
    Object.assign(rec, { status: 'failed', error: `Could not read or send the file: ${err.message || err}` });
    _out.delete(rec.id);
    await save(rec);
  } finally {
    live.pumping = false;
  }
}

async function finishSending(live) {
  const { rec } = live;
  await hashUpTo(live, rec.chunks);
  live.sha256 = bytesToHex(live.hasher.digest());
  Object.assign(rec, { status: 'verifying', error: null });
  await save(rec);
  for (let attempt = 0; attempt < 5 && !live.stopped && rec.status === 'verifying'; attempt++) {
    await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_DONE', { id: rec.id, sha256: live.sha256 });
    // The answer (onResult) or a cancel ends the wait early.
    await new Promise(resolve => {
      const timer = setTimeout(resolve, DONE_RETRY_MS);
      live.waiter = () => { clearTimeout(timer); live.waiter = null; resolve(); };
    });
  }
  if (!live.stopped && rec.status === 'verifying') {
    Object.assign(rec, { status: 'failed', error: 'The peer never confirmed the file. It may still have arrived; ask them.' });
    _out.delete(rec.id);
    await save(rec);
  }
}

async function onAccept(payload, packet) {
  const live = _out.get(payload?.id);
  if (!live || !['waiting', 'sending'].includes(live.rec.status)) return;
  const did = String(packet?.sender_id || '');
  const pub = didToPubHex(did);
  if (!pub || (live.expectedPub && live.expectedPub !== pub) || (live.rec.peerDid && live.rec.peerDid !== did)) return;
  // An accept of an earlier offer would mean the other side holds another key.
  if (payload.session !== live.session) return;
  // Only the identity whose node was offered the file: its node ID comes from its key.
  const node = senderNode(packet);
  if (!node || (isMeshNodeId(live.rec.peerId) && node !== live.rec.peerId)) return;
  const next = Number(payload.next);
  if (!Number.isInteger(next) || next < 0 || next > live.rec.chunks) return;
  const { rec } = live;
  rec.peerDid = did;
  rec.peerId = node;
  live.key = await deriveTransferKey(sharedSecretWith(pub), rec.salt, rec.id, live.session);
  Object.assign(live, { acked: next, sendNext: next, lastAckAt: Date.now(), rateFrom: { t: Date.now(), n: next } });
  Object.assign(rec, { next, status: 'sending', error: null });
  await save(rec);
  pump(live);
}

function onAck(payload, packet) {
  const live = _out.get(payload?.id);
  if (!live || packet?.sender_id !== live.rec.peerDid) return;
  const next = Number(payload.next);
  if (!Number.isInteger(next) || next < live.acked || next > live.rec.chunks) return;
  if (next === live.acked) {
    // Pieces after a missing one keep arriving: send again from the gap now
    // rather than waiting out the stall timer.
    if (++live.dupAcks >= 2 && live.sendNext > live.acked) {
      live.dupAcks = 0;
      live.sendNext = live.acked;
      live.waiter?.();
    }
    return;
  }
  const { rec } = live;
  live.dupAcks = 0;
  live.acked = next;
  for (const i of live.cipher.keys()) if (i < next) live.cipher.delete(i);
  live.lastAckAt = Date.now();
  rec.next = next;
  const dt = (Date.now() - live.rateFrom.t) / 1000;
  if (dt >= 2) {
    rec.rateBps = Math.round(((next - live.rateFrom.n) * rec.chunkBytes) / dt);
    live.rateFrom = { t: Date.now(), n: next };
  }
  save(rec);
  live.waiter?.();
}

async function onResult(payload, packet) {
  const live = _out.get(payload?.id);
  if (!live || packet?.sender_id !== live.rec.peerDid || live.rec.status !== 'verifying') return;
  const { rec } = live;
  _out.delete(rec.id);
  live.stop();
  if (payload.ok === true) {
    Object.assign(rec, { status: 'completed', next: rec.chunks, error: null });
    toast('File delivered', `${rec.peerName || 'The peer'} received "${rec.fileName}" (${formatBytes(rec.size)}).`);
  } else {
    Object.assign(rec, { status: 'failed', error: String(payload.reason || 'The peer could not save the file.').slice(0, 300) });
  }
  await save(rec);
}

// ── Receiving ──────────────────────────────────────────────────────────────

async function onOffer(payload, packet) {
  const offer = admitOffer(payload);
  const did = String(packet?.sender_id || '');
  const pub = didToPubHex(did);
  const identity = getLocalIdentity();
  if (!offer || !pub || !identity?.secretKeyHex) return;

  const node = senderNode(packet);
  if (!node) return;
  const existing = await db.mesh_transfers.get(offer.id);
  if (existing) {
    // The same transfer offered again (the sender reconnected or restarted): resume
    // it, under the new offer's session key.
    if (existing.direction !== 'in' || existing.peerDid !== did || existing.size !== offer.size || existing.salt !== offer.salt) return;
    Object.assign(existing, { peerId: node, session: offer.session });
    _in.delete(existing.id);
    if (['receiving', 'interrupted'].includes(existing.status)) await startReceiving(existing);
    else await save(existing);
    return;
  }
  const waiting = (await listTransfers()).filter(r => r.direction === 'in' && r.status === 'offered');
  if (waiting.length >= MAX_PENDING_OFFERS) return;
  if (waiting.filter(r => r.peerDid === did).length >= MAX_PENDING_OFFERS_PER_PEER) return;

  let meta = offer;
  if (offer.sealedMeta) {
    meta = await decryptMailPayload({ senderPub: pub, ...offer.sealedMeta }, identity.secretKeyHex).catch(() => null);
    if (!meta) return;
  }
  const { name, mime } = cleanMeta(meta);
  const rec = {
    id: offer.id, direction: 'in', peerId: node, peerDid: did, session: offer.session,
    peerName: String(packet?.sender_name || '').slice(0, 60) || `${did.slice(9, 17)}…`,
    fileName: name, mimeType: mime, size: offer.size, chunkBytes: offer.chunkBytes, chunks: offer.chunks,
    salt: offer.salt, next: 0, status: 'offered', error: null, createdAt: now(),
  };
  await save(rec);
  toast('Incoming file', `${rec.peerName} wants to send you "${name}" (${formatBytes(rec.size)}). Open Transfers to accept.`);
}

async function startReceiving(rec) {
  await native('transfer_recv_open', { id: rec.id, name: rec.fileName, size: rec.size });
  const key = await deriveTransferKey(sharedSecretWith(didToPubHex(rec.peerDid)), rec.salt, rec.id, rec.session || null);
  _in.set(rec.id, { rec, key, pending: new Set(), queue: Promise.resolve(), bad: 0, rateFrom: { t: Date.now(), n: rec.next || 0 } });
  Object.assign(rec, { status: 'receiving', error: null, next: rec.next || 0 });
  await save(rec);
  const replyTo = await getMeshNodeId();
  if (!(await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_ACCEPT', { id: rec.id, next: rec.next, replyTo, session: rec.session || null }))) {
    rec.error = 'Could not reach the sender. It resumes when they send it again.';
    emit(rec);
  }
}

export async function acceptTransfer(id) {
  const rec = await db.mesh_transfers.get(id);
  if (!rec || rec.direction !== 'in' || !['offered', 'interrupted'].includes(rec.status)) return;
  try {
    await startReceiving(rec);
  } catch (err) {
    Object.assign(rec, { status: 'failed', error: String(err?.message || err) });
    await save(rec);
  }
}

async function receivePiece(live, i, data) {
  const { rec } = live;
  if (rec.status !== 'receiving') return;
  if (i >= rec.next && !live.pending.has(i)) {
    const expected = chunkLength(i, rec.size, rec.chunkBytes);
    if (typeof data !== 'string' || data.length > Math.ceil((expected + 16) / 3) * 4 + 4) return;
    let plain;
    try {
      plain = await decryptChunk(live.key, rec.id, i, fromBase64(data));
    } catch {
      plain = null;
    }
    if (!plain || plain.length !== expected) {
      // Altered or not from this sender: not acknowledged, so it is sent again.
      if (++live.bad >= MAX_BAD_PIECES) throw new Error('Too many damaged pieces arrived. Ask the sender to try again.');
      return;
    }
    await native('transfer_recv_write', plain, { headers: { 'x-transfer-id': rec.id, 'x-offset': String(i * rec.chunkBytes) } });
    rec.next = advance(rec.next, live.pending, i);
    const dt = (Date.now() - live.rateFrom.t) / 1000;
    if (dt >= 2) {
      rec.rateBps = Math.round(((rec.next - live.rateFrom.n) * rec.chunkBytes) / dt);
      live.rateFrom = { t: Date.now(), n: rec.next };
    }
    await save(rec);
  }
  await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_ACK', { id: rec.id, next: rec.next });
}

function onChunk(payload, packet) {
  const live = _in.get(payload?.id);
  const i = Number(payload?.i);
  if (!live || packet?.sender_id !== live.rec.peerDid || !Number.isInteger(i) || i < 0 || i >= live.rec.chunks) return;
  // One piece at a time per transfer, in arrival order.
  live.queue = live.queue.then(() => receivePiece(live, i, payload.data)).catch(err => failIncoming(live, err));
}

async function failIncoming(live, err) {
  const { rec } = live;
  _in.delete(rec.id);
  // A failed file is never left half-written on disk; sending it again starts over.
  await native('transfer_recv_cancel', { id: rec.id }).catch(() => {});
  Object.assign(rec, { status: 'failed', next: 0, error: String(err?.message || err).slice(0, 300) });
  await save(rec);
  await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_RESULT', { id: rec.id, ok: false, reason: rec.error });
}

async function onDone(payload, packet) {
  const id = payload?.id;
  const sha = String(payload?.sha256 || '');
  if (!isTransferId(id) || !/^[0-9a-f]{64}$/i.test(sha)) return;
  const live = _in.get(id);
  if (!live) {
    // Our confirmation got lost: say it again.
    const rec = await db.mesh_transfers.get(id);
    if (rec?.direction === 'in' && rec.status === 'completed' && packet?.sender_id === rec.peerDid) {
      await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_RESULT', { id, ok: true });
    }
    return;
  }
  if (packet?.sender_id !== live.rec.peerDid) return;
  live.queue = live.queue.then(async () => {
    const { rec } = live;
    if (rec.status !== 'receiving' || rec.next !== rec.chunks) return;
    Object.assign(rec, { status: 'verifying', error: null });
    await save(rec);
    try {
      rec.path = await native('transfer_recv_finish', { id, sha256: sha });
    } catch (err) {
      await failIncoming(live, err);
      return;
    }
    _in.delete(id);
    Object.assign(rec, { status: 'completed', error: null });
    await save(rec);
    await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_RESULT', { id, ok: true });
    toast('File received', `"${rec.fileName}" (${formatBytes(rec.size)}) from ${rec.peerName} is in Documents\\NovauraSovereign\\Received.`);
  }).catch(err => failIncoming(live, err));
}

// ── Declining and cancelling ───────────────────────────────────────────────

async function endLocally(rec, status, error = null) {
  if (rec.direction === 'in') {
    _in.delete(rec.id);
    await native('transfer_recv_cancel', { id: rec.id }).catch(() => {});
  } else {
    _out.get(rec.id)?.stop();
    _out.delete(rec.id);
  }
  Object.assign(rec, { status, error });
  await save(rec);
}

/** Stops a transfer (either side) and tells the peer. Declining an offer is the same with `declined`. */
export async function cancelTransfer(id, { decline = false } = {}) {
  const rec = await db.mesh_transfers.get(id);
  if (!rec) return;
  await endLocally(rec, decline ? 'declined' : 'cancelled');
  if (rec.peerId) await sendDirectMeshPacket(rec.peerId, 'MESH_XFER_CANCEL', { id, reason: decline ? 'declined' : 'cancelled' });
}

export const declineTransfer = (id) => cancelTransfer(id, { decline: true });

/** Removes a finished transfer from the list (a received file stays on disk). */
export async function forgetTransfer(id) {
  const rec = await db.mesh_transfers.get(id);
  if (!rec || ACTIVE.has(rec.status) || rec.status === 'offered') return;
  await db.mesh_transfers.delete(id);
  emit({ ...rec, removed: true });
}

async function onCancel(payload, packet) {
  const rec = isTransferId(payload?.id) ? await db.mesh_transfers.get(payload.id) : null;
  if (!rec || ['completed', 'cancelled', 'declined'].includes(rec.status)) return;
  const did = String(packet?.sender_id || '');
  // Before an outgoing offer is accepted, only a decline from the offered node can arrive.
  const fromPeer = rec.peerDid ? did === rec.peerDid : rec.direction === 'out' && rec.status === 'waiting';
  if (!fromPeer) return;
  const declined = payload.reason === 'declined';
  await endLocally(rec, declined ? 'declined' : 'cancelled', declined ? 'The peer declined the file.' : 'The peer cancelled the transfer.');
}

/**
 * Stops this window's running transfers without telling peers, as closing
 * Sovereign does. They show as interrupted after the next start and resume
 * from there (tests use this to simulate a restart).
 */
export function stopLocalTransfers() {
  for (const live of _out.values()) live.stop();
  _out.clear();
  _in.clear();
}

// ── Startup ────────────────────────────────────────────────────────────────

// Transfers that were running when Sovereign closed: a receiver waits for the
// sender to offer again; a sender resumes by picking the same file.
async function markInterrupted() {
  for (const rec of await listTransfers()) {
    if (!ACTIVE.has(rec.status)) continue;
    rec.status = 'interrupted';
    rec.error = rec.direction === 'out' ? 'Sovereign was closed. Choose the same file again to resume.' : 'Waiting for the sender to resume.';
    await db.mesh_transfers.put(rec).catch(() => {});
  }
}

if (typeof window !== 'undefined' && !isPopoutWindow()) {
  markInterrupted();
  registerMeshHandler('MESH_XFER_OFFER', onOffer);
  registerMeshHandler('MESH_XFER_ACCEPT', onAccept);
  registerMeshHandler('MESH_XFER_CHUNK', onChunk);
  registerMeshHandler('MESH_XFER_ACK', onAck);
  registerMeshHandler('MESH_XFER_DONE', onDone);
  registerMeshHandler('MESH_XFER_RESULT', onResult);
  registerMeshHandler('MESH_XFER_CANCEL', onCancel);
}
