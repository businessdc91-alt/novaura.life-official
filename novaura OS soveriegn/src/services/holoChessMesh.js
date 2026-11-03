// holoChessMesh.js — HoloChess matches over the Sovereign mesh.
//
// Packets are signed by the mesh layer; a match is bound to the opponent's DID
// when it is accepted, and the window ignores moves from anyone else or out of
// turn. cleanChessPacket (holoChessService.js) checks the shape of each one.
//
// Imported once by the desktop so challenges arrive while the game is closed.
// Incoming packets are re-dispatched as `novaura:holochess_received` (the
// window bridge forwards that name to popped-out windows).

import { registerMeshHandler, sendDirectMeshPacket, verifiedSenderDid, getLocalIdentity } from './sovereignMesh.js';
import { cleanChessPacket } from './holoChessService.js';

export const PACKET_TYPE = 'MESH_GAME_HOLOCHESS';
const INVITE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING = 10;

const pendingInvites = new Map(); // gameId -> invite

export function getPendingChessInvites() {
  const now = Date.now();
  for (const [id, inv] of pendingInvites) if (now - inv.receivedAt > INVITE_TTL_MS) pendingInvites.delete(id);
  return [...pendingInvites.values()];
}

export function dropChessInvite(gameId) {
  pendingInvites.delete(gameId);
}

/** Send one match packet; resolves false when the mesh did not take it. */
export function sendChessPacket(peerId, data) {
  return sendDirectMeshPacket(peerId, PACKET_TYPE, { ...data, name: data.name ?? getLocalIdentity()?.displayName ?? 'Sovereign operator' });
}

function onPacket(payload, packet) {
  const did = verifiedSenderDid(packet);
  const from = packet?.sender_id;
  const data = cleanChessPacket(payload);
  if (!did || !from || !data) return;

  if (data.kind === 'invite') {
    if (pendingInvites.size >= MAX_PENDING && !pendingInvites.has(data.gameId)) return;
    const isNew = !pendingInvites.has(data.gameId);
    pendingInvites.set(data.gameId, { ...data, from, did, receivedAt: Date.now() });
    if (isNew) {
      window.dispatchEvent(new CustomEvent('novaura:mesh_toast', { detail: { type: 'peer', title: 'HoloChess challenge', message: `${data.name} challenged you.`, appId: 'holochess' } }));
    }
  }
  window.dispatchEvent(new CustomEvent('novaura:holochess_received', { detail: { ...data, from, did } }));
}

registerMeshHandler(PACKET_TYPE, onPacket);
