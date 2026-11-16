// awakeningsMesh.js — Cognitive Awakenings duels over the Sovereign mesh.
//
// An invite carries the match seed and the challenger's five cards as
// { modelId, level }; the stats always come from the local catalog, so a peer
// cannot send stronger cards than the game allows. Each turn sends
// { handIdx, cell, move }. Both nodes run the same deterministic engine.
// Packets are signed by the mesh layer; the window binds a match to the
// opponent's DID and ignores moves from anyone else or out of turn.
//
// Imported once by the desktop so invites arrive while the game is closed.
// Incoming packets are re-dispatched as `novaura:awakenings_received`.

import { registerMeshHandler, sendDirectMeshPacket, verifiedSenderDid, getLocalIdentity } from '../../services/sovereignMesh.js';
import { MODEL_CARD_MAP } from './cards.js';
import { HAND, CELLS, MAX_LEVEL } from './engine.js';

export const PACKET_TYPE = 'MESH_GAME_AWAKENINGS';
const GAME_ID_RE = /^aw_[0-9a-f]{16}$/;
const INVITE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING = 10;

const pendingInvites = new Map(); // gameId -> invite

const clip = (v, n) => String(v ?? '').slice(0, n);

function cleanDeck(deck) {
  if (!Array.isArray(deck) || deck.length !== HAND) return null;
  const out = [];
  for (const c of deck) {
    if (!c || typeof c !== 'object' || !Object.hasOwn(MODEL_CARD_MAP, c.modelId)) return null;
    const level = Number(c.level);
    if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) return null;
    out.push({ modelId: c.modelId, level });
  }
  return out;
}

/** A received packet's data, cleaned, or null if it is malformed. */
export function cleanPacket(data) {
  if (!data || typeof data !== 'object' || !GAME_ID_RE.test(String(data.gameId || ''))) return null;
  const base = { kind: data.kind, gameId: data.gameId };
  switch (data.kind) {
    case 'invite':
    case 'accept': {
      const deck = cleanDeck(data.deck);
      if (!deck) return null;
      const out = { ...base, deck, name: clip(data.name, 40) || 'Mesh peer' };
      if (data.kind === 'invite') {
        if (!Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff) return null;
        out.seed = data.seed;
      }
      return out;
    }
    case 'place': {
      const handIdx = Number(data.handIdx), cell = Number(data.cell), move = Number(data.move);
      if (!Number.isInteger(handIdx) || handIdx < 0 || handIdx >= HAND) return null;
      if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return null;
      if (!Number.isInteger(move) || move < 0 || move >= HAND * 2) return null;
      return { ...base, handIdx, cell, move };
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
  return `aw_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function pruneInvites() {
  const now = Date.now();
  for (const [id, inv] of pendingInvites) if (now - inv.receivedAt > INVITE_TTL_MS) pendingInvites.delete(id);
}

export function getPendingInvites() {
  pruneInvites();
  return [...pendingInvites.values()];
}

export function dropInvite(gameId) {
  pendingInvites.delete(gameId);
}

/** The deck as it travels: model and level only. */
export const deckForWire = cards => cards.slice(0, HAND).map(c => ({ modelId: c.modelId, level: c.level | 0 }));

export function send(peerId, data) {
  return sendDirectMeshPacket(peerId, PACKET_TYPE, { ...data, name: data.name ?? getLocalIdentity()?.displayName ?? 'Sovereign operator' });
}

function onPacket(payload, packet) {
  const did = verifiedSenderDid(packet);
  const from = packet?.sender_id;
  const data = cleanPacket(payload);
  if (!did || !from || !data) return;

  if (data.kind === 'invite') {
    pruneInvites();
    if (pendingInvites.size >= MAX_PENDING && !pendingInvites.has(data.gameId)) return;
    const isNew = !pendingInvites.has(data.gameId);
    pendingInvites.set(data.gameId, { ...data, from, did, receivedAt: Date.now() });
    if (isNew) {
      window.dispatchEvent(new CustomEvent('novaura:mesh_toast', {
        detail: { type: 'peer', title: 'Cognitive Awakenings', message: `${data.name} challenged you to a duel of minds.`, appId: 'cognitive_awakenings' },
      }));
    }
  }
  window.dispatchEvent(new CustomEvent('novaura:awakenings_received', { detail: { ...data, from, did } }));
}

registerMeshHandler(PACKET_TYPE, onPacket);
