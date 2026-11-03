// relayDuelMesh.js — Relay Duel over the Sovereign mesh.
//
// Only moves travel: an invite carries the match seed, then each turn is
// { angle, power }. Both nodes run the same deterministic engine, so they see
// the same shots. Packets are signed by the mesh layer; a match is bound to the
// opponent's DID when it is accepted, and moves from anyone else, or out of
// turn, are ignored.
//
// Imported once by the desktop so invites arrive even while the game is
// closed. Incoming packets are re-dispatched as `novaura:relay_duel_received`
// (the window bridge forwards that name to popped-out windows).

import { registerMeshHandler, sendDirectMeshPacket, verifiedSenderDid, getLocalIdentity } from '../../services/sovereignMesh.js';
import { CHARACTERS } from './engine.js';

export const PACKET_TYPE = 'MESH_GAME_RELAY_DUEL';
const GAME_ID_RE = /^rd_[0-9a-f]{16}$/;
const INVITE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING = 10;

const pendingInvites = new Map(); // gameId -> invite

const clip = (v, n) => String(v ?? '').slice(0, n);

/** A received packet's data, cleaned, or null if it is malformed. */
export function cleanPacket(data) {
  if (!data || typeof data !== 'object' || !GAME_ID_RE.test(String(data.gameId || ''))) return null;
  const base = { kind: data.kind, gameId: data.gameId };
  switch (data.kind) {
    case 'invite':
    case 'accept': {
      const character = Object.hasOwn(CHARACTERS, data.character) ? data.character : 'nova';
      const out = { ...base, character, name: clip(data.name, 40) || 'Mesh peer' };
      if (data.kind === 'invite') {
        if (!Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff) return null;
        out.seed = data.seed;
      }
      return out;
    }
    case 'shot': {
      const angle = Number(data.angle);
      const power = Number(data.power);
      const turn = Number(data.turn);
      if (!Number.isFinite(angle) || angle < 0 || angle > 90) return null;
      if (!Number.isFinite(power) || power < 0 || power > 100) return null;
      if (!Number.isInteger(turn) || turn < 0 || turn > 10000) return null;
      return { ...base, angle, power, turn };
    }
    case 'decline':
    case 'leave':
      return base;
    default:
      return null;
  }
}

export function newGameId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `rd_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function getPendingInvites() {
  const now = Date.now();
  for (const [id, inv] of pendingInvites) if (now - inv.receivedAt > INVITE_TTL_MS) pendingInvites.delete(id);
  return [...pendingInvites.values()];
}

export function dropInvite(gameId) {
  pendingInvites.delete(gameId);
}

export function send(peerId, data) {
  return sendDirectMeshPacket(peerId, PACKET_TYPE, { ...data, name: data.name ?? getLocalIdentity()?.displayName ?? 'Sovereign operator' });
}

function onPacket(payload, packet) {
  const did = verifiedSenderDid(packet);
  const from = packet?.sender_id;
  const data = cleanPacket(payload);
  if (!did || !from || !data) return;

  if (data.kind === 'invite') {
    if (pendingInvites.size >= MAX_PENDING && !pendingInvites.has(data.gameId)) return;
    const isNew = !pendingInvites.has(data.gameId);
    pendingInvites.set(data.gameId, { ...data, from, did, receivedAt: Date.now() });
    if (isNew) {
      window.dispatchEvent(new CustomEvent('novaura:mesh_toast', { detail: { type: 'peer', title: 'Relay Duel challenge', message: `${data.name} challenged you.`, appId: 'relay_duel' } }));
    }
  }
  window.dispatchEvent(new CustomEvent('novaura:relay_duel_received', { detail: { ...data, from, did } }));
}

registerMeshHandler(PACKET_TYPE, onPacket);
