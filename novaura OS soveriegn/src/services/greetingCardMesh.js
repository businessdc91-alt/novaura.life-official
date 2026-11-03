// greetingCardMesh.js — Greeting cards arriving over the mesh. Imported once by
// the desktop so cards are kept and announced while the Greeting Studio is closed.
//
// A card is accepted only from a signed packet (the mesh checks the Ed25519
// signature before handlers run), cut down to known fields and sizes, and
// stored with the signer's DID, so a peer can choose any display name but
// cannot pose as another node.

import { registerMeshHandler, verifiedSenderDid } from './sovereignMesh.js';
import { cleanGreetingCard, storeReceivedGreetingCard } from './greetingCardService.js';

const PACKET_TYPE = 'MESH_GREETING_CARD';

function onPacket(payload, packet) {
  const did = verifiedSenderDid(packet);
  const card = cleanGreetingCard(payload);
  if (!did || !card) return;
  if (!storeReceivedGreetingCard(card, did)) return; // already have it
  const detail = { ...card, senderDid: did };
  window.dispatchEvent(new CustomEvent('novaura:greeting_card_received', { detail }));
  window.dispatchEvent(new CustomEvent('novaura:mesh_toast', {
    detail: { type: 'celebration', title: 'Greeting card received', message: `@${card.senderName} sent you "${card.title}".`, appId: 'greeting_cards' },
  }));
}

registerMeshHandler(PACKET_TYPE, onPacket);
