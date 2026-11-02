// sovereignMesh.js — Genuine Decentralized P2P Mesh, Identity, Mailbox & Social Layer
// Backed by the user's on-device private cloud database (Dexie IndexedDB)
// Powered by physical Machine-to-Machine networking (Tauri UDP LAN Beacon + TCP Peer Sockets + Headless WAN Relay)
// and intra-browser BroadcastChannel for zero-latency multi-tab synchronization.

import { db } from '../database/sovereignDatabase.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { admitMeshListing } from './marketplaceListings.js';
import { admitMeshManuscript } from './meshManuscripts.js';
import {
  SOCIAL_LIMITS, signPost as signSocialPost, admitPost as admitSocialPost, signedPostCopy as signedSocialPostCopy,
  signComment as signSocialComment, admitComment as admitSocialComment, insertComment as insertSocialComment,
  flattenComments, signVote as signSocialVote, admitVote as admitSocialVote, applyVote as applySocialVote,
  deriveVotes as deriveSocialVotes, admitVoteMap as admitSocialVoteMap, signStory as signSocialStory,
  admitStory as admitSocialStory, overflowIds as socialOverflowIds, packetBatches as socialPacketBatches,
  wirePost as wireSocialPost,
} from './meshSocial.js';
import { isPopoutWindow } from './popoutWindows.js';
import {
  FEEDBACK_INBOX_PUBKEY,
  FEEDBACK_INBOX_VAULT_KEY,
  feedbackAckMessage,
} from '../config/betaFeedback.js';

const STORAGE_KEY = 'novaura_sovereign_identity';
const MAIL_STORAGE = 'novaura_sovereign_mailstore';
// Sealed mail is hex-encoded (twice its size) and must fit a 64 KB relay frame.
const MAX_MAIL_PACKET_CHARS = 60000;
export const MAX_MAIL_ATTACHMENT_BYTES = 20 * 1024;
const SOCIAL_STORAGE = 'novaura_sovereign_socialstore';

function generateId() {
  return 'id_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

function isTauri() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

// ── Canonical JSON & Cryptographic Packet Signing / Verification ──────────

export function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

export function canonicalPacketString(packetType, senderId, timestampMs, payload) {
  const payloadStr = canonicalJson(payload);
  return `${packetType}:${senderId}:${timestampMs}:${payloadStr}`;
}

export function signPacket(packetType, payload, timestampMs, identity = null) {
  const id = identity || getLocalIdentity();
  if (!id || !id.secretKeyHex) return { signature: null, senderPubkey: null, senderId: null, timestampMs };

  try {
    const cleanPub = (id.publicKey || '').replace(/^0x/, '');
    const senderId = id.nodeId || `did:nova:${cleanPub}`;
    const canonical = canonicalPacketString(packetType, senderId, timestampMs, payload);
    const secretBytes = new Uint8Array(id.secretKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const canonicalBytes = new TextEncoder().encode(canonical);
    const signatureBytes = ed25519.sign(canonicalBytes, secretBytes);
    const signatureHex = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      signature: signatureHex,
      senderPubkey: cleanPub,
      senderId,
      timestampMs,
    };
  } catch (err) {
    console.warn('[SovereignMesh] Packet signing error:', err);
    return { signature: null, senderPubkey: null, senderId: null, timestampMs };
  }
}

export function verifyPacketSignature(packet) {
  if (!packet || !packet.signature || !packet.sender_pubkey) return false;
  try {
    const cleanPub = packet.sender_pubkey.replace(/^0x/, '');
    if (cleanPub.length !== 64) return false;
    const pubBytes = new Uint8Array(cleanPub.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    // sender_id must name exactly this public key. A prefix match let a crafted
    // id such as did:nova:<victim><attacker prefix> pass with the attacker's key.
    const sid = String(packet.sender_id || '');
    if (sid !== `did:nova:${cleanPub}` && sid !== cleanPub && sid !== ('0x' + cleanPub)) {
      return false;
    }

    const canonical = canonicalPacketString(packet.packet_type, packet.sender_id, packet.timestamp_ms, packet.payload);
    const canonicalBytes = new TextEncoder().encode(canonical);
    const sigClean = packet.signature.trim();
    if (sigClean.length !== 128) return false;
    const sigBytes = new Uint8Array(sigClean.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    return ed25519.verify(sigBytes, canonicalBytes, pubBytes);
  } catch (err) {
    console.warn('[SovereignMesh] Packet signature verification error:', err);
    return false;
  }
}

// The sender DID of a packet that passed verification (handlers only ever see
// verified application packets, so this is the authenticated author).
export function verifiedSenderDid(packet) {
  const pub = String(packet?.sender_pubkey || '').replace(/^0x/, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(pub) ? `did:nova:${pub}` : null;
}

export function didToPubHex(did) {
  const m = /^did:nova:([0-9a-f]{64})$/.exec(String(did || ''));
  return m ? m[1] : null;
}

// ── End-to-End Encryption (E2EE) with X25519 Montgomery & AES-256-GCM ───────

export async function encryptMailPayload(recipientPubHex, senderSecretHex, dataObj) {
  const cleanRecipientPub = recipientPubHex.replace(/^0x/, '');
  const recipientPubBytes = new Uint8Array(cleanRecipientPub.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const senderSecretBytes = new Uint8Array(senderSecretHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));

  const recipientXPub = ed25519.utils.toMontgomery(recipientPubBytes);
  const senderXPriv = ed25519.utils.toMontgomerySecret(senderSecretBytes);
  const sharedSecret = x25519.getSharedSecret(senderXPriv, recipientXPub);

  const keyMaterial = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(dataObj));
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyMaterial, plaintext);

  return {
    encrypted: true,
    recipientPub: '0x' + cleanRecipientPub,
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    ciphertext: Array.from(new Uint8Array(ciphertextBuffer)).map(b => b.toString(16).padStart(2, '0')).join(''),
  };
}

export async function decryptMailPayload(encryptedEnvelope, recipientSecretHex) {
  const cleanSenderPub = encryptedEnvelope.senderPub.replace(/^0x/, '');
  const senderPubBytes = new Uint8Array(cleanSenderPub.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const recipientSecretBytes = new Uint8Array(recipientSecretHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));

  const senderXPub = ed25519.utils.toMontgomery(senderPubBytes);
  const recipientXPriv = ed25519.utils.toMontgomerySecret(recipientSecretBytes);
  const sharedSecret = x25519.getSharedSecret(recipientXPriv, senderXPub);

  const keyMaterial = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = new Uint8Array(encryptedEnvelope.iv.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const ciphertext = new Uint8Array(encryptedEnvelope.ciphertext.match(/.{1,2}/g).map(b => parseInt(b, 16)));

  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyMaterial, ciphertext);
  return JSON.parse(new TextDecoder().decode(decryptedBuffer));
}

export async function resolveRecipientPublicKey(recipientStr) {
  if (!recipientStr) return null;
  const clean = recipientStr.trim();
  if (clean.startsWith('did:nova:')) {
    const raw = clean.replace('did:nova:', '').replace(/^0x/, '');
    if (raw.length === 64) return raw;
  }
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(clean)) {
    return clean.replace(/^0x/, '').toLowerCase();
  }
  for (const peer of _peersMap.values()) {
    if (peer.id === clean || peer.name === clean) {
      if (peer.publicKey) return peer.publicKey.replace(/^0x/, '').toLowerCase();
      if (peer.id.startsWith('did:nova:')) return peer.id.replace('did:nova:', '').replace(/^0x/, '').toLowerCase();
      if (/^[0-9a-fA-F]{64}$/.test(peer.id)) return peer.id.toLowerCase();
    }
  }
  try {
    const contacts = await db.contacts.toArray();
    const match = contacts.find(c =>
      c.address?.toLowerCase() === clean.toLowerCase() ||
      c.handle?.toLowerCase() === clean.toLowerCase() ||
      c.id === clean
    );
    if (match && match.publicKey) {
      return match.publicKey.replace(/^0x/, '').toLowerCase();
    }
  } catch {}
  return null;
}

// In-Memory synchronous cache for fast, zero-flicker UI rendering
let _identityCache = null;
let _mailCache = { inbox: [], sent: [], drafts: [] };
let _socialCache = { profile: null, posts: [], stories: [], channels: [], friends: [], following: [] };
const _peersMap = new Map(); // Keyed by node_id / peer_id (Authentic physical network peers)

// Initialize sync cache from localStorage/cold storage first
try {
  const rawId = localStorage.getItem(STORAGE_KEY);
  if (rawId) _identityCache = JSON.parse(rawId);

  // Mail lives in IndexedDB. Older versions also kept a decrypted copy here.
  localStorage.removeItem(MAIL_STORAGE);

  // Only profile edits and follows are kept in localStorage (posts and stories
  // are in IndexedDB; older versions stored everything here).
  const rawSocial = localStorage.getItem(SOCIAL_STORAGE);
  if (rawSocial) {
    const saved = JSON.parse(rawSocial);
    _socialCache.profile = saved.profile || null;
    _socialCache.following = Array.isArray(saved.following) ? saved.following : [];
    _socialCache.followerDids = Array.isArray(saved.followerDids) ? saved.followerDids : [];
  }
} catch (e) {
  console.warn('[SovereignMesh] Cold cache init note:', e);
}

// Asynchronously hydrate and synchronize with Dexie Database
async function hydrateFromDatabase() {
  try {
    // 1. Identity
    let dbIdentity = await db.identities.get('primary_operator');
    if (!dbIdentity || !dbIdentity.secretKeyHex) {
      // Generate genuine Ed25519 identity keypair
      const secretKey = ed25519.utils.randomSecretKey();
      const pubKey = ed25519.getPublicKey(secretKey);
      const secretKeyHex = Array.from(secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
      const cleanPub = Array.from(pubKey).map(b => b.toString(16).padStart(2, '0')).join('');
      const pubKeyHex = '0x' + cleanPub;

      _identityCache = {
        ...(dbIdentity || {}),
        id: 'primary_operator',
        handle: dbIdentity?.handle || 'operator',
        displayName: dbIdentity?.displayName || 'Sovereign Node Operator',
        address: dbIdentity?.address || 'operator@nova.node',
        publicKey: pubKeyHex,
        secretKeyHex: secretKeyHex,
        nodeId: `did:nova:${cleanPub}`,
        bio: dbIdentity?.bio || 'Self-Sovereign Decentralized Node',
        avatarColor: dbIdentity?.avatarColor || '#00f0ff',
        isLocal: true,
        createdAt: dbIdentity?.createdAt || new Date().toISOString(),
      };
      await db.identities.put(_identityCache);
    } else {
      _identityCache = dbIdentity;
    }

    // 2. Mailbox (Honest storage - zero fake genesis seed)
    const allMails = await db.mailbox.toArray();
    _mailCache = {
      inbox: allMails.filter(m => (m.box || m.folder) === 'inbox' || !(m.box || m.folder)),
      sent: allMails.filter(m => (m.box || m.folder) === 'sent'),
      drafts: allMails.filter(m => (m.box || m.folder) === 'drafts'),
    };

    // 3. Social Posts & Stories (Honest storage - zero fake genesis seed)
    const allPosts = await db.social_posts.toArray();
    _socialCache.posts = allPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const nowIso = new Date().toISOString();
    const allStories = await db.social_stories.toArray();
    _socialCache.stories = (allStories || []).filter(s => s.expiresAt > nowIso);

    const allChannels = await db.social_channels.toArray();
    _socialCache.channels = allChannels || [];

    // 4. Contacts & Blocked List Cache
    const contacts = await db.contacts.toArray();
    _blockedPeersCache.clear();
    for (const c of contacts) {
      if (c.trustTier === 'blocked') {
        _blockedPeersCache.add(c.id);
        if (c.nodeId) _blockedPeersCache.add(c.nodeId);
      }
    }

    // Trigger local listeners
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  } catch (err) {
    console.warn('[SovereignMesh] Database hydration note:', err);
  }
}

const _incomingFileTransfers = new Map();
const _blockedPeersCache = new Set();

if (typeof window !== 'undefined') {
  hydrateFromDatabase();
}

// ── Pluggable packet handlers ───────────────────────────────────────────────
// Services such as the AI Lounge and the Inference Exchange register here
// instead of growing the switch below. Handlers receive verified packets only.

const _meshHandlers = new Map();

export function registerMeshHandler(type, handler) {
  if (!ALLOWED_MESH_PACKET_TYPES.has(type)) {
    throw new Error(`registerMeshHandler: ${type} is not an allowed mesh packet type`);
  }
  _meshHandlers.set(type, handler);
}

let _meshNodeIdPromise = null;

// The routable node id (NODE-...) that directed packets must be addressed to.
export function getMeshNodeId() {
  if (!_meshNodeIdPromise) {
    _meshNodeIdPromise = getPhysicalMeshStatus()
      .then(status => status?.node_id || null)
      .catch(() => null)
      .then(id => {
        if (!id) _meshNodeIdPromise = null;
        return id;
      });
  }
  return _meshNodeIdPromise;
}

// ── Inbound Packet Processor (Common to BroadcastChannel & Native TCP) ──────

function handleIncomingMeshPacket(type, payload, packet = {}) {
  if (!payload && !packet) return;

  const senderId = packet.sender_id || payload?.senderId || payload?.requesterId;
  if (senderId && _blockedPeersCache.has(senderId)) {
    console.warn(`[WebOfTrust] Dropped packet from blocked peer: ${senderId}`);
    return;
  }

  // Cryptographic Signature Verification for application packets
  const isInfraPacket = [
    'MESH_HEARTBEAT',
    'MESH_REGISTER',
    'MESH_ROOM_ROSTER',
    'MESH_PEER_JOINED_ROOM',
    'MESH_PEER_LEFT_ROOM',
    'MESH_JOIN_ROOM'
  ].includes(type);

  // Every application packet must carry a valid signature. Unsigned packets used
  // to skip this check entirely, which let anyone forge mail or inference jobs.
  if (!isInfraPacket && !verifyPacketSignature(packet)) {
    console.warn(`[SovereignMesh] SECURITY ALERT: Dropped unverified/forged packet ${packet?.id || 'unknown'} of type ${type}`);
    return;
  }

  switch (type) {
    case 'MESH_MAIL': {
      const mail = payload?.mail || packet?.payload?.mail;
      if (!mail) break;

      (async () => {
        let displayMail = mail;
        // Handle E2EE decryption
        if (mail.encrypted && mail.ciphertext) {
          const identity = getLocalIdentity();
          const myPub = (identity?.publicKey || '').replace(/^0x/, '').toLowerCase();
          const targetPub = (mail.recipientPub || '').replace(/^0x/, '').toLowerCase();

          if (targetPub && targetPub === myPub && identity?.secretKeyHex && mail.senderPub) {
            try {
              const decrypted = await decryptMailPayload(mail, identity.secretKeyHex);
              displayMail = {
                ...mail,
                subject: String(decrypted.subject || '').slice(0, 300),
                body: String(decrypted.body || '').slice(0, 50000),
                attachments: Array.isArray(decrypted.attachments) ? decrypted.attachments.slice(0, 10) : [],
                threadId: typeof decrypted.threadId === 'string' ? decrypted.threadId.slice(0, 64) : mail.id,
                inReplyTo: typeof decrypted.inReplyTo === 'string' ? decrypted.inReplyTo.slice(0, 64) : null,
                // The signed packet's key, not the address the sender typed.
                senderDid: verifiedSenderDid(packet),
                isEncryptedE2EE: true,
              };
            } catch (err) {
              console.warn('[SovereignMesh] Failed to decrypt E2EE mail envelope:', err);
              return;
            }
          } else {
            // Envelope is encrypted for another mesh node; do not ingest
            return;
          }
        }

        if (displayMail && !_mailCache.inbox.some(m => m.id === displayMail.id)) {
          _mailCache.inbox.unshift(displayMail);
          db.mailbox.put({ ...displayMail, box: 'inbox' }).catch(() => {});
          window.dispatchEvent(new CustomEvent('novaura:mail_received', { detail: displayMail }));
          window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
        }
      })();
      break;
    }

    case 'MESH_BETA_FEEDBACK': {
      const fb = payload?.feedback;
      if (!fb?.clientId || !fb.ciphertext || !fb.senderPub) break;
      receiveBetaFeedback(fb).catch(err => console.warn('[SovereignMesh] Beta feedback receive failed:', err));
      break;
    }

    case 'MESH_BETA_FEEDBACK_ACK': {
      confirmBetaFeedbackReceipt(payload).catch(() => {});
      break;
    }

    // NovaSocial: every item is signed by its author and checked in meshSocial.js.
    case 'MESH_POST':
    case 'MESH_REPOST': {
      if (admitIncomingPosts([payload?.post])) notifySocial();
      break;
    }

    case 'MESH_POSTS_REQUEST': {
      if (packet.sender_id) sendSocialBatches(packet.sender_id, 'MESH_POSTS_RESPONSE', 'posts', shareablePosts(40));
      break;
    }

    case 'MESH_POSTS_RESPONSE': {
      if (Array.isArray(payload?.posts) && admitIncomingPosts(payload.posts.slice(0, 60))) notifySocial();
      break;
    }

    case 'MESH_VOTE':
    case 'MESH_REACTION': {
      if (admitIncomingVote(payload?.vote)) notifySocial();
      break;
    }

    case 'MESH_COMMENT': {
      if (admitIncomingComment(payload?.comment)) notifySocial();
      break;
    }

    case 'MESH_STORY': {
      if (admitIncomingStories([payload?.story])) notifyStories();
      break;
    }

    case 'MESH_STORIES_REQUEST': {
      if (packet.sender_id) sendSocialBatches(packet.sender_id, 'MESH_STORIES_RESPONSE', 'stories', getStories().filter(st => st.sig).map(({ reactions: _r, myReaction: _m, viewed: _v, authorNodeId: _a, ...st }) => st));
      break;
    }

    case 'MESH_STORIES_RESPONSE': {
      if (Array.isArray(payload?.stories) && admitIncomingStories(payload.stories.slice(0, 100))) notifyStories();
      break;
    }

    case 'MESH_FOLLOW': {
      receiveFollow(payload, verifiedSenderDid(packet));
      break;
    }

    case 'MESH_HOSTED_SITE': {
      // Peer-supplied HTML is untrusted. It is stored only if it is signed by its
      // publisher, intact, size-bounded and not a takeover of an existing domain.
      const site = payload?.site || packet?.payload?.site;
      admitRemoteSite(site).then((record) => {
        if (!record) return;
        window.dispatchEvent(new CustomEvent('novaura:site_updated', { detail: record }));
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }).catch(() => {});
      break;
    }

    case 'MESH_SITE_QUERY': {
      const domain = payload?.domain || packet?.payload?.domain;
      const requesterId = packet?.sender_id || payload?.requesterId;
      if (domain && requesterId) {
        const cleanDomain = domain.replace(/^nova:\/\//, '').replace(/\/$/, '');
        (async () => {
          let found = await db.hosted_sites.where('domain').equals(cleanDomain).first();
          if (!found) found = await db.hosted_sites.get(cleanDomain);
          if (found) {
            sendDirectMeshPacket(requesterId, 'MESH_SITE_RESPONSE', { site: found });
          }
        })().catch(() => {});
      }
      break;
    }

    case 'MESH_SITE_RESPONSE': {
      // A relayed copy: the responder is not necessarily the publisher, so the
      // publisher's own signature inside the record is what gets verified.
      const site = payload?.site || packet?.payload?.site;
      admitRemoteSite(site).then((record) => {
        if (!record) return;
        window.dispatchEvent(new CustomEvent('novaura:site_resolved', { detail: record }));
        window.dispatchEvent(new CustomEvent('novaura:site_updated', { detail: record }));
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }).catch(() => {});
      break;
    }

    case 'MESH_LITERATURE_PUBLISH': {
      // Signed senders only; size caps, id binding and per-sender limits in meshManuscripts.js.
      const sender = verifiedSenderDid(packet);
      if (!sender) break;
      isPeerBlocked(sender)
        .then(blocked => (blocked ? null : admitMeshManuscript(payload, sender)))
        .then(incomingDoc => {
          if (!incomingDoc) return;
          window.dispatchEvent(new CustomEvent('novaura:literature_received', { detail: incomingDoc }));
          window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
        })
        .catch(err => console.warn('[SovereignMesh] Shared chapter not stored:', err));
      break;
    }

    case 'MESH_SEARCH_QUERY': {
      const query = payload?.query || packet?.payload?.query;
      const requesterId = packet?.sender_id || payload?.requesterId;
      if (query && requesterId) {
        handleLocalSearchQueryForPeer(query, requesterId);
      }
      break;
    }

    case 'MESH_SEARCH_RESPONSE': {
      const results = payload?.results || packet?.payload?.results;
      if (results) {
        window.dispatchEvent(new CustomEvent('novaura:mesh_search_results', { detail: payload }));
      }
      break;
    }

    case 'MESH_ARTICLE_REQUEST': {
      const { requestId, articleId, title } = payload || packet?.payload || {};
      const requesterId = packet?.sender_id || payload?.requesterId;
      if (requesterId && (articleId || title)) {
        handleIncomingArticleRequest(requestId, articleId, title, requesterId);
      }
      break;
    }

    case 'MESH_ARTICLE_RESPONSE': {
      const { requestId, article, providerName } = payload || packet?.payload || {};
      if (article) {
        handleIncomingArticleResponse(requestId, article, providerName);
      }
      break;
    }

    case 'MESH_MARKETPLACE_LISTING': {
      // Bound to the signing publisher; peers cannot overwrite local or others' listings.
      admitMeshListing(payload?.listing, verifiedSenderDid(packet)).then((admitted) => {
        if (!admitted) return;
        const { record, isNew } = admitted;
        window.dispatchEvent(new CustomEvent('novaura:marketplace_updated', { detail: record }));
        // Catch-up replays from the relay archive arrive in bulk: no toast for those.
        if (isNew && !packet._archive_replay) {
          dispatchMeshToast({
            type: 'store',
            title: 'New P2P Creation Listed',
            message: `"${record.title}" by ${record.authorHandle} published to Sovereign Marketplace.`
          });
        }
      }).catch(() => {});
      break;
    }

    case 'MESH_INFERENCE_REQUEST': {
      const { jobId, prompt, role, maxTokens, requesterName, replyNode } = payload || packet?.payload || {};
      const requesterId = verifiedSenderDid(packet);
      if (jobId && prompt && requesterId) {
        handleIncomingInferenceRequest(jobId, prompt, role || 'aura', maxTokens, requesterId, requesterName, replyNode);
      }
      break;
    }

    case 'MESH_INFERENCE_RESPONSE': {
      const { jobId, answer, model, durationMs, providerName } = payload || packet?.payload || {};
      if (jobId) {
        window.dispatchEvent(new CustomEvent('novaura:peer_inference_response', {
          detail: { jobId, answer, model, durationMs, providerName }
        }));
        dispatchMeshToast({
          type: 'ai',
          title: 'Swarm Inference Received',
          message: `Generated by ${providerName || 'Peer'} via ${model || 'Neural Core'}`
        });
      }
      break;
    }

    case 'MESH_FILE_OFFER': {
      const { fileId, fileName, size, mimeType, senderName, totalChunks } = payload || packet?.payload || {};
      if (fileId) {
        _incomingFileTransfers.set(fileId, {
          fileName, size, mimeType, senderName, totalChunks,
          chunks: new Array(totalChunks),
          receivedCount: 0,
          startedAt: Date.now()
        });
        dispatchMeshToast({
          type: 'transfer',
          title: 'Incoming P2P Transfer',
          message: `${senderName || 'Peer'} is transferring "${fileName}" (${Math.round((size || 0) / 1024)} KB)...`
        });
      }
      break;
    }

    case 'MESH_FILE_CHUNK': {
      const { fileId, chunkIndex, data } = payload || packet?.payload || {};
      const transfer = _incomingFileTransfers.get(fileId);
      if (transfer && transfer.chunks) {
        if (!transfer.chunks[chunkIndex]) {
          transfer.chunks[chunkIndex] = data;
          transfer.receivedCount++;
        }
      }
      break;
    }

    case 'MESH_FILE_COMPLETE': {
      const { fileId } = payload || packet?.payload || {};
      const transfer = _incomingFileTransfers.get(fileId);
      if (transfer) {
        const base64Data = (transfer.chunks || []).join('');
        const record = {
          id: fileId,
          fileId,
          direction: 'inbound',
          peerId: packet?.sender_id || 'remote_peer',
          fileName: transfer.fileName,
          mimeType: transfer.mimeType,
          size: transfer.size,
          dataBase64: base64Data,
          status: 'completed',
          createdAt: new Date().toISOString()
        };
        db.mesh_transfers.put(record).catch(() => {});
        _incomingFileTransfers.delete(fileId);
        window.dispatchEvent(new CustomEvent('novaura:file_received', { detail: record }));
        dispatchMeshToast({
          type: 'transfer',
          title: 'P2P File Transfer Complete',
          message: `Received "${transfer.fileName}" from ${transfer.senderName || 'Peer'}`
        });
      }
      break;
    }

    case 'MESH_PEER_JOINED_ROOM': {
      // The relay sends { peer: { id, name } }; older builds sent node_id/node_name.
      const peerId = payload?.node_id || payload?.peer?.id;
      const peerName = payload?.node_name || payload?.peer?.name || 'Anonymous Node';
      const room = payload?.room || '#general';
      if (peerId) {
        flushOutboxForPeer(peerId);
        dispatchMeshToast({
          type: 'peer',
          title: 'Peer Joined Swarm',
          message: `${peerName} connected to ${room}`
        });
      }
      break;
    }

    case 'MESH_ROOM_ROSTER': {
      const members = payload?.members || payload?.peers || [];
      for (const m of members) {
        const memberId = m.node_id || m.id;
        if (memberId) {
          flushOutboxForPeer(memberId);
        }
      }
      break;
    }

    default: {
      const handler = _meshHandlers.get(type);
      if (handler) {
        Promise.resolve()
          .then(() => handler(payload || packet?.payload || {}, packet))
          .catch(err => console.warn(`[SovereignMesh] ${type} handler error:`, err));
      }
      break;
    }
  }
}

// ── Beta feedback inbox (team node) and delivery receipts (tester node) ──────

const hexToBytes = (hex) => new Uint8Array(hex.replace(/^0x/, '').match(/.{1,2}/g).map(b => parseInt(b, 16)));
const bytesToHex = (bytes) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

// Runs on the node that holds the inbox secret. Other nodes ignore the packet.
async function receiveBetaFeedback(fb) {
  const inboxSecret = String((await db.getVaultKey(FEEDBACK_INBOX_VAULT_KEY)) || '').trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(inboxSecret)) {
    console.info('[SovereignMesh] Beta report arrived but this node has no feedback inbox key; ignoring.');
    return;
  }
  const inboxPub = bytesToHex(ed25519.getPublicKey(hexToBytes(inboxSecret)));
  if ((fb.recipientPub || '').replace(/^0x/, '').toLowerCase() !== inboxPub) return;

  const mailId = `beta_${fb.clientId}`;
  const known = _mailCache.inbox.some(m => m.id === mailId) || !!(await db.mailbox.get(mailId).catch(() => null));

  if (!known) {
    const report = await decryptMailPayload(fb, inboxSecret);
    const env = report.environment || {};
    const identity = getLocalIdentity();
    const mail = {
      id: mailId,
      sender: 'beta-feedback@nova.node',
      senderName: 'Beta tester',
      senderPub: fb.senderPub,
      recipient: identity?.address || 'operator@nova.node',
      subject: `[Beta · ${report.severity || 'n/a'} · ${report.category || 'other'}] ${report.title || 'Untitled report'}`,
      body: [
        report.description || '(no description)',
        '',
        '──────────',
        `Version: ${report.appVersion || 'unknown'}`,
        `OS: ${env.os || 'unknown'} ${env.arch || ''}`.trim(),
        `CPU cores: ${env.cpuCores ?? 'unknown'}`,
        `Reported: ${report.createdAt || 'unknown'}`,
        `Report ID: ${fb.clientId}`,
        fb.replyNode ? `Reply node: ${fb.replyNode}` : null,
      ].filter(line => line !== null).join('\n'),
      attachments: [],
      timestamp: report.createdAt || new Date().toISOString(),
      read: false,
      starred: false,
      box: 'inbox',
      isEncryptedE2EE: true,
      betaFeedback: { clientId: fb.clientId, category: report.category, severity: report.severity },
    };
    _mailCache.inbox.unshift(mail);
    await db.mailbox.put(mail).catch(() => {});
    window.dispatchEvent(new CustomEvent('novaura:mail_received', { detail: mail }));
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
    dispatchMeshToast({ type: 'info', title: 'Beta report received', message: report.title || 'New tester report in NovaMail' });
  }

  // Always confirm, including duplicates, so the tester stops re-sending.
  if (fb.replyNode) {
    const ackSig = bytesToHex(ed25519.sign(new TextEncoder().encode(feedbackAckMessage(fb.clientId)), hexToBytes(inboxSecret)));
    await sendDirectMeshPacket(fb.replyNode, 'MESH_BETA_FEEDBACK_ACK', { clientId: fb.clientId, ackSig });
  }
}

// Runs on the tester node. Only a receipt signed by the inbox key counts.
async function confirmBetaFeedbackReceipt(payload) {
  const { clientId, ackSig } = payload || {};
  if (!clientId || !/^[0-9a-fA-F]{128}$/.test(ackSig || '')) return;
  const valid = ed25519.verify(hexToBytes(ackSig), new TextEncoder().encode(feedbackAckMessage(clientId)), hexToBytes(FEEDBACK_INBOX_PUBKEY));
  if (!valid) {
    console.warn('[SovereignMesh] Ignored beta feedback receipt with an invalid signature.');
    return;
  }
  const records = await db.node_feedback.filter(r => r.clientId === clientId).toArray();
  for (const r of records) {
    if (r.outboxId) await db.mesh_outbox.update(r.outboxId, { status: 'delivered', deliveredAt: new Date().toISOString() }).catch(() => {});
    await db.node_feedback.update(r.id, { synced: true, deliveryStatus: 'delivered', syncedAt: new Date().toISOString(), lastError: null });
  }
  if (records.length) {
    window.dispatchEvent(new CustomEvent('novaura:beta_feedback_delivered', { detail: { clientId } }));
  }
}

// Responds to decentralized search queries from remote mesh peers
async function handleLocalSearchQueryForPeer(query, requesterId) {
  try {
    const q = query.toLowerCase().trim();
    const myId = getLocalIdentity();
    const myNodeId = myId?.publicKey || myId?.handle || 'node';
    const [manuscripts, repos, encyclopedia] = await Promise.all([
      db.manuscripts.toArray().catch(() => []),
      db.git_repositories.toArray().catch(() => []),
      db.encyclopedia_articles.toArray().catch(() => []),
    ]);

    const matchingManuscripts = manuscripts
      .filter(m => (m.name || '').toLowerCase().includes(q) || (m.content || '').toLowerCase().includes(q))
      .slice(0, 4)
      .map(m => ({
        id: m.id,
        type: 'literature',
        title: m.name,
        subtitle: `${m.wordCount || 0} words • by ${myId.displayName}`,
        nodeId: myNodeId,
        peerId: myNodeId,
        peerName: myId.displayName,
      }));

    const matchingRepos = repos
      .filter(r => (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q))
      .slice(0, 3)
      .map(r => ({
        id: r.id,
        type: 'repo',
        title: r.name,
        subtitle: r.description || 'Decentralized Repository',
        nodeId: myNodeId,
        peerId: myNodeId,
        peerName: myId.displayName,
      }));

    const matchingArticles = encyclopedia
      .filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.cleanText || '').toLowerCase().includes(q) ||
        (a.extract || '').toLowerCase().includes(q) ||
        (a.categories || []).some(cat => (cat || '').toLowerCase().includes(q))
      )
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        type: 'encyclopedia',
        title: a.title,
        subtitle: `${a.description || a.extract?.substring(0, 110) || 'Encyclopedic Entry'} • via ${myId.displayName}`,
        fullUrl: a.fullUrl,
        extract: a.extract,
        wordCount: a.wordcount || (a.cleanText || '').split(/\s+/).length,
        nodeId: myNodeId,
        peerId: myNodeId,
        peerName: myId.displayName,
      }));

    const combined = [...matchingArticles, ...matchingManuscripts, ...matchingRepos];
    if (combined.length > 0) {
      sendDirectMeshPacket(requesterId, 'MESH_SEARCH_RESPONSE', {
        results: combined,
        responderName: myId.displayName,
        responderId: myNodeId,
      });
    }
  } catch (err) {
    console.warn('[SovereignMesh] Peer search resolution error:', err);
  }
}

// ── Ecosystem: P2P Knowledge Grid Article Fetcher ─────────────────────────

async function handleIncomingArticleRequest(requestId, articleId, title, requesterId) {
  try {
    let article = null;
    if (articleId) {
      article = await db.encyclopedia_articles.get(articleId);
    }
    if (!article && title) {
      article = await db.encyclopedia_articles.where('title').equalsIgnoreCase(title).first();
    }
    if (article) {
      const myId = getLocalIdentity();
      sendDirectMeshPacket(requesterId, 'MESH_ARTICLE_RESPONSE', {
        requestId,
        article,
        providerName: myId.displayName,
        providerId: myId.publicKey || myId.handle
      });
    }
  } catch (err) {
    console.warn('[SovereignMesh] Article request resolution error:', err);
  }
}

async function handleIncomingArticleResponse(requestId, article, providerName) {
  try {
    if (!article || !article.title) return;
    const localRecord = {
      ...article,
      id: article.id || 'article_' + Date.now(),
      isMeshShared: true,
      sourcePeer: providerName || 'Swarm Peer',
      lastAccessed: new Date().toISOString()
    };
    await db.encyclopedia_articles.put(localRecord);
    window.dispatchEvent(new CustomEvent('novaura:article_received', { detail: { requestId, article: localRecord, providerName } }));
    dispatchMeshToast({
      type: 'encyclopedia',
      title: 'Encyclopedia Article Cached',
      message: `"${article.title}" retrieved from ${providerName || 'Peer'} via mesh.`
    });
  } catch (err) {
    console.warn('[SovereignMesh] Article response storage error:', err);
  }
}

export async function requestRemoteArticle(peerId, { articleId, title, timeoutMs = 15000 }) {
  if (!peerId) throw new Error('Missing target peer ID for remote article retrieval.');
  const requestId = 'art_req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const myId = getLocalIdentity();

  return new Promise((resolve, reject) => {
    let timer = null;

    const onResponse = (e) => {
      if (e.detail?.requestId === requestId) {
        cleanup();
        resolve(e.detail.article);
      }
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('novaura:article_received', onResponse);
    };

    window.addEventListener('novaura:article_received', onResponse);

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out fetching article "${title || articleId}" from peer.`));
    }, timeoutMs);

    sendDirectMeshPacket(peerId, 'MESH_ARTICLE_REQUEST', {
      requestId,
      articleId,
      title,
      requesterId: myId.publicKey || myId.handle
    });
  });
}

// ── Native Rust Mesh Engine Bridge (LAN UDP & TCP) ─────────────────────────

if (typeof window !== 'undefined' && isTauri()) {
  // Setup event listeners for physical peer discovery and incoming TCP frames
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('novaura://mesh-peer-discovered', (event) => {
      const peer = event.payload;
      if (peer && peer.id) {
        _peersMap.set(peer.id, peer);
        if (!isPopoutWindow()) flushOutboxForPeer(peer.id); // queued mail is sent once, by the desktop
        window.dispatchEvent(new CustomEvent('novaura:peer_discovered', { detail: peer }));
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }
    }).catch(err => console.warn('[SovereignMesh] Peer discovery listen note:', err));

    listen('novaura://mesh-peer-lost', (event) => {
      const peerId = event.payload;
      if (peerId) {
        _peersMap.delete(peerId);
        window.dispatchEvent(new CustomEvent('novaura:peer_lost', { detail: peerId }));
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }
    }).catch(err => console.warn('[SovereignMesh] Peer lost listen note:', err));

    // Only the main window handles incoming packets; pop-out windows get the
    // resulting UI events through the window bridge (popoutWindows.js), so
    // nothing (mail, inference jobs, file transfers) is processed twice.
    if (!isPopoutWindow()) {
      listen('novaura://mesh-packet', (event) => {
        const packet = event.payload;
        if (packet) {
          handleIncomingMeshPacket(packet.packet_type, packet.payload, packet);
        }
      }).catch(err => console.warn('[SovereignMesh] Mesh packet listen note:', err));
    }
  });

  // Pull initial network status from native Rust supervisor
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('mesh_get_status').then(status => {
      if (status && status.peers) {
        for (const p of status.peers) {
          _peersMap.set(p.id, p);
        }
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }
    }).catch(() => {});
  });
}

// ── BroadcastChannel P2P Local Mesh (Fallback & Multi-Tab Sync) ────────────

let meshChannel = null;
if (typeof window !== 'undefined' && window.BroadcastChannel) {
  try {
    meshChannel = new BroadcastChannel('novaura_mesh_bus');
    meshChannel.onmessage = (event) => {
      if (isPopoutWindow()) return; // the main window handles these (see above)
      const data = event.data;
      if (!data || (!data.type && !data.packet_type)) return;
      const pktType = data.packet_type || data.type;
      handleIncomingMeshPacket(pktType, data.payload || data, data);
    };
  } catch (e) {
    console.warn('[SovereignMesh] BroadcastChannel initialization note:', e);
  }
}

const ALLOWED_MESH_PACKET_TYPES = new Set([
  'MESH_MAIL',
  'MESH_POST',
  'MESH_POSTS_REQUEST',
  'MESH_POSTS_RESPONSE',
  'MESH_VOTE',
  'MESH_COMMENT',
  'MESH_PEER_PING',
  'MESH_PEER_PONG',
  'MESH_LITERATURE_PUBLISH',
  'MESH_LITERATURE_REQUEST',
  'MESH_LITERATURE_SYNC',
  'MESH_SEARCH_QUERY',
  'MESH_SEARCH_RESPONSE',
  'MESH_REPO_ANNOUNCE',
  'MESH_REPO_SYNC',
  'MESH_HANDSHAKE',
  'MESH_ROOM_ROSTER',
  'MESH_PEER_JOINED_ROOM',
  'MESH_PEER_LEFT_ROOM',
  'MESH_JOIN_ROOM',
  'MESH_INFERENCE_REQUEST',
  'MESH_INFERENCE_RESPONSE',
  'MESH_FILE_OFFER',
  'MESH_FILE_ACCEPT',
  'MESH_FILE_CHUNK',
  'MESH_FILE_COMPLETE',
  'MESH_MARKETPLACE_LISTING',
  'MESH_ARCHIVE_SYNC',
  'MESH_HOSTED_SITE',
  'MESH_SITE_QUERY',
  'MESH_SITE_RESPONSE',
  'MESH_BETA_FEEDBACK',
  'MESH_BETA_FEEDBACK_ACK',
  'MESH_LOUNGE_MESSAGE',
  'MESH_GAME_RELAY_DUEL',
  'MESH_LOUNGE_PRESENCE',
  'MESH_INFERENCE_OFFER',
  'MESH_INFERENCE_DISCOVER',
  'MESH_INFERENCE_ACCESS_REQUEST',
  'MESH_INFERENCE_ACCESS_REPLY',
  'MESH_INFERENCE_CALL',
  'MESH_INFERENCE_RESULT',
  'MESH_REACTION',
  'MESH_STORY',
  'MESH_STORIES_REQUEST',
  'MESH_STORIES_RESPONSE',
  'MESH_FOLLOW',
  'MESH_REPOST',
]);

export function broadcastMeshPacket(type, payload) {
  if (!ALLOWED_MESH_PACKET_TYPES.has(type)) {
    console.warn(`[ZeroLeakGuard] Blocked unauthorized decentralized mesh packet type: ${type}`);
    return;
  }

  // Deep inspection to guarantee zero credentials or internal documents leak over the mesh
  try {
    const rawPayload = JSON.stringify(payload);
    if (/api[_-]?key|vault|secret|private[_-]?key|bearer/i.test(rawPayload)) {
      console.warn('[ZeroLeakGuard] Blocked potential credential leak across P2P mesh bus.');
      return;
    }

    const timestampMs = Date.now();
    const identity = getLocalIdentity();
    const { signature, senderPubkey, senderId } = signPacket(type, payload, timestampMs, identity);

    // 1. Intra-browser / Multi-window broadcast
    if (meshChannel) {
      meshChannel.postMessage({
        type,
        packet_type: type,
        payload,
        sender_id: senderId,
        sender_name: identity?.displayName || 'Operator',
        sender_pubkey: senderPubkey,
        signature,
        timestamp_ms: timestampMs,
        _meshEnvelopeVerified: true,
      });
    }

    // 2. Physical Machine-to-Machine TCP socket broadcast via native Rust
    if (isTauri()) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('mesh_broadcast_packet', {
          packetType: type,
          payload,
          signature,
          senderPubkey,
          senderId,
          timestampMs,
        }).catch(err => {
          console.warn('[SovereignMesh] Native mesh broadcast note:', err);
        });
      });
    }
  } catch (e) {
    console.warn('[SovereignMesh] Mesh broadcast note:', e);
  }
}

export async function sendDirectMeshPacket(recipientId, type, payload) {
  if (!ALLOWED_MESH_PACKET_TYPES.has(type)) {
    console.warn(`[ZeroLeakGuard] Blocked unauthorized direct mesh packet type: ${type}`);
    return false;
  }

  try {
    const rawPayload = JSON.stringify(payload);
    if (/api[_-]?key|vault|secret|private[_-]?key|bearer/i.test(rawPayload)) {
      console.warn('[ZeroLeakGuard] Blocked potential credential leak across direct mesh packet.');
      return false;
    }

    const timestampMs = Date.now();
    const identity = getLocalIdentity();
    const { signature, senderPubkey, senderId } = signPacket(type, payload, timestampMs, identity);

    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('mesh_send_direct_packet', {
        recipientId,
        packetType: type,
        payload,
        signature,
        senderPubkey,
        senderId,
        timestampMs,
      });
    }

    // Fallback: broadcast with target recipientId
    broadcastMeshPacket(type, { ...payload, recipientId });
    return true;
  } catch (err) {
    console.warn('[SovereignMesh] Direct packet transmission error:', err);
    return false;
  }
}

// ── Identity Layer ──────────────────────────────────────────────────────────

export function getLocalIdentity() {
  if (_identityCache) return _identityCache;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      _identityCache = JSON.parse(raw);
      return _identityCache;
    } catch {}
  }
  return {
    handle: 'operator',
    displayName: 'Sovereign Operator',
    address: 'operator@nova.node',
    publicKey: '0x_nova_local_key',
    bio: 'Local Node Operator',
    avatarColor: '#00f0ff',
  };
}

export const getSovereignIdentity = getLocalIdentity;

export function createLocalIdentity(handle, displayName, bio = 'Sovereign Node Operator') {
  const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const secretKey = ed25519.utils.randomSecretKey();
  const pubKey = ed25519.getPublicKey(secretKey);
  const secretKeyHex = Array.from(secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
  const cleanPub = Array.from(pubKey).map(b => b.toString(16).padStart(2, '0')).join('');
  const pubKeyHex = '0x' + cleanPub;

  const idRecord = {
    id: 'primary_operator',
    handle: cleanHandle,
    displayName: displayName.trim(),
    address: `${cleanHandle}@nova.node`,
    publicKey: pubKeyHex,
    secretKeyHex: secretKeyHex,
    nodeId: `did:nova:${cleanPub}`,
    createdAt: new Date().toISOString(),
    bio,
    avatarColor: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    isLocal: true,
  };

  _identityCache = idRecord;
  try {
    const safeCold = { ...idRecord };
    delete safeCold.secretKeyHex;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeCold));
  } catch {}
  db.identities.put(idRecord).catch(err => console.warn('[SovereignMesh] Identity save err:', err));

  window.dispatchEvent(new CustomEvent('novaura:identity_updated', { detail: idRecord }));
  return idRecord;
}

// ── Physical Network Telemetry & Node Management ───────────────────────────

export function getPeerCount() {
  return _peersMap.size;
}

export function getConnectedPeers() {
  return Array.from(_peersMap.values());
}

export async function getPhysicalMeshStatus() {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('mesh_get_status');
    } catch (err) {
      console.warn('[SovereignMesh] get_status failed:', err);
    }
  }

  const identity = getLocalIdentity();
  return {
    node_id: identity.publicKey || 'local-node',
    node_name: identity.displayName,
    lan_ip: '127.0.0.1',
    udp_beacon_port: 43888,
    tcp_listen_port: 43889,
    peer_count: _peersMap.size,
    peers: Array.from(_peersMap.values()),
    relay_connected: false,
  };
}

export async function connectManualPeer(address) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('mesh_connect_peer', { address });
  }
  return false;
}

export async function configureMeshRelay(relayAddress) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('mesh_set_relay', { relayAddress: relayAddress || null });
  }
  return false;
}

export async function switchSwarmRoom(room) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke('mesh_switch_room', { room });
    // Request social feed sync for the newly entered room
    setTimeout(() => requestRoomSocialSync(), 1000);
    return res;
  }
  window.dispatchEvent(new CustomEvent('novaura:mesh_room_switched', { detail: room }));
  return true;
}

export function requestRoomSocialSync() {
  broadcastMeshPacket('MESH_POSTS_REQUEST', {
    requesterId: getLocalIdentity()?.publicKey || 'local-op',
    timestamp: Date.now(),
  });
  requestStoriesSync();
}

// Automatically sync social feed from the universe room on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    requestRoomSocialSync();
  }, 2500);
}

// ── Mail Layer ──────────────────────────────────────────────────────────────

export function getInbox() {
  return _mailCache.inbox || [];
}

export function getSentMail() {
  return _mailCache.sent || [];
}

export function getDrafts() {
  return _mailCache.drafts || [];
}

export function getUnreadCount() {
  return (_mailCache.inbox || []).filter(m => !m.read).length;
}

export function sendMail({ to, subject, body, attachments = [], threadId = null, inReplyTo = null }) {
  const identity = getLocalIdentity();
  const mailId = generateId();
  const senderAddress = identity ? identity.address : 'operator@nova.node';
  const senderName = identity ? identity.displayName : 'Sovereign Operator';
  const senderPub = identity?.publicKey || null;

  const plainMail = {
    id: mailId,
    sender: senderAddress,
    senderName,
    senderPub,
    recipient: to.trim().toLowerCase(),
    subject: subject.trim(),
    body: body.trim(),
    attachments,
    threadId: threadId || mailId,
    inReplyTo: inReplyTo || null,
    timestamp: new Date().toISOString(),
    read: false,
    starred: false,
    box: 'sent',
  };

  _mailCache.sent.unshift(plainMail);
  db.mailbox.put(plainMail).catch(() => {});

  // Local loopback or self delivery
  const isLoopback = plainMail.recipient === plainMail.sender ||
    plainMail.recipient === 'self' ||
    plainMail.recipient.startsWith('local') ||
    plainMail.recipient === 'operator@nova.node';

  if (isLoopback) {
    const inboxCopy = { ...plainMail, id: generateId(), box: 'inbox', read: false };
    _mailCache.inbox.unshift(inboxCopy);
    db.mailbox.put(inboxCopy).catch(() => {});
  }


  // Records why a message could not leave this node. Mail is never broadcast
  // in plaintext: without the recipient's public key it stays local.
  const markUndelivered = (reason) => {
    const updated = { ...plainMail, deliveryStatus: 'undelivered', deliveryError: reason };
    const idx = _mailCache.sent.findIndex(m => m.id === mailId);
    if (idx !== -1) _mailCache.sent[idx] = updated;
    db.mailbox.put(updated).catch(() => {});
    window.dispatchEvent(new CustomEvent('novaura:mail_delivery_failed', { detail: { id: mailId, reason } }));
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  };

  // Loopback mail is already in the local inbox; nothing goes on the wire.
  if (isLoopback) {
    plainMail.deliveryStatus = 'delivered_local';
  } else (async () => {
    try {
      const recipientPubHex = await resolveRecipientPublicKey(to);
      if (recipientPubHex && identity?.secretKeyHex) {
        const encryptedEnvelope = await encryptMailPayload(recipientPubHex, identity.secretKeyHex, {
          subject: plainMail.subject,
          body: plainMail.body,
          attachments: plainMail.attachments,
          threadId: plainMail.threadId,
          inReplyTo: plainMail.inReplyTo,
        });
        const meshMail = {
          id: mailId,
          sender: senderAddress,
          senderName,
          senderPub,
          recipient: plainMail.recipient,
          timestamp: plainMail.timestamp,
          ...encryptedEnvelope,
        };
        // Relays carry packets of at most 64 KB; a larger one would be dropped silently.
        if (JSON.stringify(meshMail).length > MAX_MAIL_PACKET_CHARS) {
          markUndelivered(`Too large to send over the mesh (attachments are limited to about ${Math.round(MAX_MAIL_ATTACHMENT_BYTES / 1024)} KB in total). Remove or shrink the attachments and resend.`);
          return;
        }
        broadcastMeshPacket('MESH_MAIL', { mail: meshMail });
      } else if (!identity?.secretKeyHex) {
        markUndelivered('Your node identity has no encryption key yet. Open Sovereign Network to initialize it, then resend.');
      } else {
        markUndelivered(`No public key known for "${to.trim()}". Add them as a contact or connect to their node, then resend.`);
      }
    } catch (err) {
      console.warn('[SovereignMesh] sendMail encryption failed:', err);
      markUndelivered(`Encryption failed: ${err?.message || 'unknown error'}. The message was not sent.`);
    }
  })();

  window.dispatchEvent(new CustomEvent('novaura:mail_sent', { detail: plainMail }));
  window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  return plainMail;
}

export function markAsRead(mailId) {
  const mail = _mailCache.inbox.find(m => m.id === mailId);
  if (mail) {
    mail.read = true;
    db.mailbox.update(mailId, { read: true }).catch(() => {});
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  }
}

export function toggleStar(mailId) {
  const mail = _mailCache.inbox.find(m => m.id === mailId) || _mailCache.sent.find(m => m.id === mailId);
  if (mail) {
    mail.starred = !mail.starred;
    db.mailbox.update(mailId, { starred: mail.starred }).catch(() => {});
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  }
}

export function deleteMail(mailId, folder = 'inbox') {
  if (_mailCache[folder]) {
    _mailCache[folder] = _mailCache[folder].filter(m => m.id !== mailId);
    db.mailbox.delete(mailId).catch(() => {});
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  }
}

// ── Literature Mesh Sharing Layer ──────────────────────────────────────────

export function publishManuscriptToMesh(manuscript, note = '') {
  if (!manuscript) return false;
  const identity = getLocalIdentity();

  const payload = {
    manuscript: {
      id: manuscript.id,
      name: manuscript.name,
      type: manuscript.type,
      content: manuscript.content,
      wordCount: manuscript.wordCount || 0,
    },
    authorName: identity.displayName,
    authorHandle: identity.handle,
    note: note.trim(),
    publishedAt: new Date().toISOString(),
  };

  broadcastMeshPacket('MESH_LITERATURE_PUBLISH', payload);
  return true;
}

// ── NovaSocial Layer (Facebook + Reddit + YouTube Hybrid on Sovereign Mesh) ──

// Content is signed by its author and checked on arrival (meshSocial.js), so
// relayed copies can be trusted and no peer can rewrite another's votes,
// reactions, posts or stories. Profile numbers are counted from real data.

function myDid() {
  const pub = String(getLocalIdentity()?.publicKey || '').replace(/^0x/, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(pub) ? `did:nova:${pub}` : null;
}

function signer() {
  const identity = getLocalIdentity();
  const did = myDid();
  if (!did || !identity?.secretKeyHex) throw new Error('Your node identity is still loading. Try again in a moment.');
  return { authorDid: did, voterDid: did, secretHex: identity.secretKeyHex };
}

function myAuthorFields() {
  const identity = getLocalIdentity();
  return {
    authorHandle: identity?.handle || 'operator',
    authorName: identity?.displayName || 'Sovereign Operator',
    authorColor: identity?.avatarColor || '#00f0ff',
  };
}

// Fields the UI reads that are derived, not signed.
function decoratePost(post) {
  post.authorNodeId = post.authorDid || post.authorNodeId;
  post.mediaUrl = post.mediaGallery?.[0] || post.mediaUrl || null;
  if (!post.comments) post.comments = [];
  deriveSocialVotes(post);
  for (const c of flattenComments(post.comments)) deriveSocialVotes(c);
  return post;
}

// Only the slim, non-derivable part of the social state lives in localStorage
// (posts and stories are in IndexedDB).
function persistSocialPrefs() {
  try {
    localStorage.setItem(SOCIAL_STORAGE, JSON.stringify({
      profile: _socialCache.profile,
      following: _socialCache.following || [],
      followerDids: _socialCache.followerDids || [],
    }));
  } catch { /* storage unavailable */ }
}

function notifySocial(detail = null) {
  window.dispatchEvent(new CustomEvent('novaura:social_updated', { detail }));
  window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
}

function notifyStories(detail = null) {
  window.dispatchEvent(new CustomEvent('novaura:stories_updated', { detail }));
  window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
}

function savePost(post) {
  db.social_posts.put(post).catch(() => {});
}

function enforcePostCaps() {
  const drop = socialOverflowIds(_socialCache.posts, { perAuthor: SOCIAL_LIMITS.postsPerAuthor, total: SOCIAL_LIMITS.postsTotal });
  const mine = myDid();
  for (const id of drop) {
    const p = _socialCache.posts.find(x => x.id === id);
    if (p && p.authorDid === mine) drop.delete(id); // never drop the user's own posts
  }
  if (!drop.size) return;
  _socialCache.posts = _socialCache.posts.filter(p => !drop.has(p.id));
  db.social_posts.bulkDelete([...drop]).catch(() => {});
}

/** Admits signed posts from the network. Returns true if the feed changed. */
function admitIncomingPosts(rawPosts) {
  let changed = false;
  const now = Date.now();
  for (const raw of rawPosts) {
    const post = admitSocialPost(raw, { now });
    if (!post) continue;
    const existing = _socialCache.posts.find(p => p.id === post.id);
    const target = existing || decoratePost({ ...post, comments: [], voteSigs: {}, reactionSigs: {} });
    // Votes, reactions and comments travel with a synced post; each is re-verified.
    let touched = !existing;
    for (const [kind, key] of [['vote', 'voteSigs'], ['reaction', 'reactionSigs']]) {
      for (const [did, rec] of Object.entries(admitSocialVoteMap(raw[key], kind, post.id, now))) {
        if (applySocialVote(target, { ...rec, voterDid: did, kind })) touched = true;
      }
    }
    for (const rawComment of flattenComments(raw.comments).slice(0, SOCIAL_LIMITS.commentsPerPost)) {
      const comment = admitSocialComment(rawComment, { now });
      if (comment && comment.postId === post.id && insertSocialComment(target, comment)) touched = true;
      const stored = comment && flattenComments(target.comments).find(c => c.id === comment.id);
      if (stored) {
        for (const [did, rec] of Object.entries(admitSocialVoteMap(rawComment.voteSigs, 'vote', `${post.id}/${comment.id}`, now))) {
          if (applySocialVote(stored, { ...rec, voterDid: did, kind: 'vote' })) touched = true;
        }
      }
    }
    if (!existing) _socialCache.posts.push(target);
    if (touched) { decoratePost(target); savePost(target); changed = true; }
  }
  if (changed) {
    _socialCache.posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    enforcePostCaps();
  }
  return changed;
}

function admitIncomingVote(raw) {
  const record = admitSocialVote(raw);
  if (!record) return false;
  const [postId, commentId] = record.target.split('/');
  const post = _socialCache.posts.find(p => p.id === postId);
  if (!post) return false;
  const item = commentId ? flattenComments(post.comments).find(c => c.id === commentId) : post;
  if (!item || !applySocialVote(item, record)) return false;
  savePost(post);
  return true;
}

function admitIncomingComment(raw) {
  const comment = admitSocialComment(raw);
  if (!comment) return false;
  const post = _socialCache.posts.find(p => p.id === comment.postId);
  if (!post || !insertSocialComment(post, comment)) return false;
  savePost(post);
  return true;
}

/** Signed posts this node can pass on (newest first): its own and verified ones from others. */
function shareablePosts(limit) {
  const mine = myDid();
  return _socialCache.posts
    .filter(p => p.sig && (p.authorDid === mine || admitSocialPost(p)))
    .slice(0, limit)
    .map(wireSocialPost);
}

// One feed/stories sync answer per requester every 30 s, in packets that fit the relay.
const _socialSyncServedAt = new Map();
function sendSocialBatches(requesterId, type, key, items) {
  const last = _socialSyncServedAt.get(`${type}:${requesterId}`) || 0;
  if (Date.now() - last < 30000 || !items.length) return;
  _socialSyncServedAt.set(`${type}:${requesterId}`, Date.now());
  for (const batch of socialPacketBatches(items).slice(0, 8)) {
    sendDirectMeshPacket(requesterId, type, { [key]: batch });
  }
}

export function getSocialProfile() {
  const identity = getLocalIdentity();
  const did = myDid();
  const base = _socialCache.profile || {};
  const myPosts = (_socialCache.posts || []).filter(p => p.authorDid && p.authorDid === did);
  const postKarma = myPosts.reduce((n, p) => n + (p.upvotes || 0) - (p.downvotes || 0), 0);
  const commentKarma = (_socialCache.posts || []).reduce((n, p) => n + flattenComments(p.comments)
    .filter(c => c.authorDid === did).reduce((m, c) => m + (c.upvotes || 0) - (c.downvotes || 0), 0), 0);
  _socialCache.profile = {
    handle: identity?.handle || 'operator',
    displayName: identity?.displayName || 'Sovereign Operator',
    bio: identity?.bio || '',
    avatarColor: identity?.avatarColor || '#00f0ff',
    bannerUrl: null,
    ...base,
    // Counted, never stored as free numbers.
    followers: (_socialCache.followerDids || []).length,
    following: (_socialCache.following || []).length,
    postKarma,
    commentKarma,
    karma: postKarma + commentKarma,
    verifiedNode: Boolean(did),
    nodeId: did || identity?.nodeId || null,
  };
  return _socialCache.profile;
}

export function updateSocialProfile(updates) {
  const { followers: _f, following: _g, karma: _k, postKarma: _p, commentKarma: _c, verifiedNode: _v, ...editable } = updates || {};
  _socialCache.profile = { ...(_socialCache.profile || {}), ...editable };
  persistSocialPrefs();
  const profile = getSocialProfile();
  window.dispatchEvent(new CustomEvent('novaura:social_profile_updated', { detail: profile }));
  return profile;
}

export function getFeed(filterSubAura = 'all', filterType = 'all', sortBy = 'hot', searchQuery = '') {
  const identity = getLocalIdentity();
  const voterId = myDid() || identity?.nodeId;

  let list = (_socialCache.posts || []).map(p => {
    const userVote = p.voters ? p.voters[voterId] || null : null;
    const userReaction = p.reactionUsers ? p.reactionUsers[voterId] || null : null;
    const score = (p.upvotes || 0) - (p.downvotes || 0);

    // Compute hot score with time decay
    const hoursOld = Math.max(0, (Date.now() - new Date(p.timestamp).getTime()) / (1000 * 60 * 60));
    const hotScore = (score + 1) / Math.pow(hoursOld + 2, 1.5);

    return {
      ...p,
      currentUserVote: userVote,
      currentUserReaction: userReaction,
      score,
      hotScore,
      reactions: p.reactions || { like: 0, love: 0, fire: 0, insight: 0, rocket: 0, mindblown: 0 },
      reactionUsers: p.reactionUsers || {},
      mediaGallery: p.mediaGallery || (p.mediaUrl ? [p.mediaUrl] : []),
      comments: p.comments || [],
    };
  });

  // Filter by Sub-Aura (Reddit)
  if (filterSubAura && filterSubAura !== 'all') {
    list = list.filter(p => p.subAura === filterSubAura);
  }

  // Filter by Type (FB Wall, YT Video, Reddit Discussion, Shorts)
  if (filterType && filterType !== 'all') {
    if (filterType === 'shorts') {
      list = list.filter(p => p.type === 'video' && (p.isShort || (p.videoDuration && p.videoDuration.startsWith('00:'))));
    } else {
      list = list.filter(p => p.type === filterType);
    }
  }

  // Search filter
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(p =>
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.content && p.content.toLowerCase().includes(q)) ||
      (p.authorHandle && p.authorHandle.toLowerCase().includes(q)) ||
      (p.authorName && p.authorName.toLowerCase().includes(q)) ||
      (p.flair && p.flair.toLowerCase().includes(q)) ||
      (p.subAura && p.subAura.toLowerCase().includes(q))
    );
  }

  // Sorting: Hot, New, Top, Rising
  if (sortBy === 'new') {
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else if (sortBy === 'top') {
    list.sort((a, b) => b.score - a.score);
  } else if (sortBy === 'rising') {
    list.sort((a, b) => {
      const aRecent = (a.score + (a.comments?.length || 0)) / Math.max(0.5, (Date.now() - new Date(a.timestamp).getTime()) / 3600000);
      const bRecent = (b.score + (b.comments?.length || 0)) / Math.max(0.5, (Date.now() - new Date(b.timestamp).getTime()) / 3600000);
      return bRecent - aRecent;
    });
  } else {
    // Default 'hot'
    list.sort((a, b) => b.hotScore - a.hotScore);
  }

  return list;
}

export function createPost({
  title = null,
  content = '',
  type = 'wall',
  subAura = 'r/general',
  mediaUrl = null,
  mediaGallery = [],
  videoDuration = null,
  videoChapters = [],
  feeling = null,
  flair = null,
  isShort = false,
}) {
  const keys = signer();
  const gallery = Array.isArray(mediaGallery) && mediaGallery.length > 0 ? mediaGallery : (mediaUrl ? [mediaUrl] : []);
  const signed = signSocialPost({
    ...myAuthorFields(), title, content: String(content || '').trim(), type, subAura, flair, feeling,
    mediaGallery: gallery, videoDuration, videoChapters, isShort,
  }, keys);
  if (JSON.stringify(signed).length > SOCIAL_LIMITS.packetBudget) {
    throw new Error('This post is too large to send over the mesh. Use smaller images or links.');
  }
  const post = decoratePost({ ...signed, comments: [], voteSigs: {}, reactionSigs: {}, views: 0 });
  // The author's own upvote, signed like any other vote.
  applySocialVote(post, signSocialVote({ target: post.id, value: 'up' }, keys));
  decoratePost(post);
  _socialCache.posts.unshift(post);
  savePost(post);
  broadcastMeshPacket('MESH_POST', { post: wireSocialPost(post) });
  notifySocial(post);
  return post;
}

function castVote(post, item, target, value, kind) {
  const record = signSocialVote({ target, value, kind }, signer());
  applySocialVote(item, record);
  decoratePost(post);
  savePost(post);
  broadcastMeshPacket(kind === 'reaction' ? 'MESH_REACTION' : 'MESH_VOTE', { vote: record });
  notifySocial(post);
}

export function votePost(postId, direction) {
  const post = _socialCache.posts.find(p => p.id === postId);
  if (!post) return null;
  const current = post.voters?.[myDid()] || null;
  castVote(post, post, post.id, current === direction ? null : direction, 'vote');
  post.currentUserVote = post.voters?.[myDid()] || null;
  return post;
}

export function reactToPost(postId, reactionType = 'like') {
  const post = _socialCache.posts.find(p => p.id === postId);
  if (!post) return null;
  const current = post.reactionUsers?.[myDid()] || null;
  castVote(post, post, post.id, current === reactionType ? null : reactionType, 'reaction');
  post.currentUserReaction = post.reactionUsers?.[myDid()] || null;
  return post;
}

export function addComment(postId, content, parentCommentId = null) {
  const post = _socialCache.posts.find(p => p.id === postId);
  const text = String(content || '').trim();
  if (!post || !text) return null;
  const keys = signer();
  const comment = signSocialComment({ ...myAuthorFields(), postId, parentId: parentCommentId, content: text }, keys);
  if (!insertSocialComment(post, comment)) return null;
  const stored = flattenComments(post.comments).find(c => c.id === comment.id);
  applySocialVote(stored, signSocialVote({ target: `${postId}/${comment.id}`, value: 'up' }, keys));
  decoratePost(post);
  savePost(post);
  broadcastMeshPacket('MESH_COMMENT', { comment });
  broadcastMeshPacket('MESH_VOTE', { vote: stored.voteSigs[keys.voterDid] && { ...stored.voteSigs[keys.voterDid], voterDid: keys.voterDid, kind: 'vote' } });
  notifySocial(post);
  return stored;
}

export function voteComment(postId, commentId, direction) {
  const post = _socialCache.posts.find(p => p.id === postId);
  const comment = post && flattenComments(post.comments).find(c => c.id === commentId);
  if (!comment) return false;
  const current = comment.voters?.[myDid()] || null;
  castVote(post, comment, `${postId}/${commentId}`, current === direction ? null : direction, 'vote');
  return true;
}

export function repostPost(postId, commentary = '') {
  const original = _socialCache.posts.find(p => p.id === postId);
  if (!original) return null;
  // Reposting a repost shares the original; it is embedded with its own
  // signature so other nodes can check who really wrote it.
  const source = original.repostOf || original;
  if (!source.sig) throw new Error('This post is not signed, so it cannot be reposted.');
  const embedded = signedSocialPostCopy(source);
  const keys = signer();
  const signed = signSocialPost({
    ...myAuthorFields(),
    title: null,
    content: String(commentary || '').trim(),
    type: source.type,
    subAura: source.subAura,
    repostOf: embedded,
  }, keys);
  if (JSON.stringify(signed).length > SOCIAL_LIMITS.packetBudget) {
    throw new Error('This post is too large to repost over the mesh.');
  }
  const post = decoratePost({ ...signed, comments: [], voteSigs: {}, reactionSigs: {}, views: 0 });
  _socialCache.posts.unshift(post);
  savePost(post);
  broadcastMeshPacket('MESH_REPOST', { post: wireSocialPost(post) });
  notifySocial(post);
  return post;
}

// ── Ephemeral 24h Peer Stories Layer ────────────────────────────────────────

export function getStories() {
  const now = new Date().toISOString();
  if (!_socialCache.stories) _socialCache.stories = [];
  return _socialCache.stories.filter(s => s.expiresAt > now);
}

function admitIncomingStories(rawStories) {
  let changed = false;
  const now = Date.now();
  for (const raw of rawStories) {
    const story = admitSocialStory(raw, { now });
    if (!story || _socialCache.stories.some(s => s.id === story.id)) continue;
    const stored = { ...story, authorNodeId: story.authorDid, reactions: {} };
    _socialCache.stories.push(stored);
    db.social_stories.put(stored).catch(() => {});
    changed = true;
  }
  if (changed) {
    const nowIso = new Date(now).toISOString();
    const expired = _socialCache.stories.filter(s => s.expiresAt <= nowIso).map(s => s.id);
    const over = socialOverflowIds(_socialCache.stories.filter(s => s.expiresAt > nowIso),
      { perAuthor: SOCIAL_LIMITS.storiesPerAuthor, total: SOCIAL_LIMITS.storiesTotal, timeKey: 'createdAt' });
    const drop = new Set([...expired, ...over]);
    _socialCache.stories = _socialCache.stories.filter(s => !drop.has(s.id));
    if (drop.size) db.social_stories.bulkDelete([...drop]).catch(() => {});
  }
  return changed;
}

export function createStory({ mediaUrl = null, caption = '', bgGradient = null, duration = 24 }) {
  const signed = signSocialStory({ ...myAuthorFields(), mediaUrl, caption, bgGradient, duration }, signer());
  if (JSON.stringify(signed).length > SOCIAL_LIMITS.packetBudget) {
    throw new Error('This story is too large to send over the mesh. Use a smaller image or a link.');
  }
  const story = { ...signed, authorNodeId: signed.authorDid, reactions: {}, viewed: true };
  if (!_socialCache.stories) _socialCache.stories = [];
  _socialCache.stories.unshift(story);
  db.social_stories.put(story).catch(() => {});
  broadcastMeshPacket('MESH_STORY', { story: signed });
  notifyStories(story);
  return story;
}

/** Your own reaction to a story (one per story, kept on this node). */
export function reactToStory(storyId, reaction = 'fire') {
  const story = (_socialCache.stories || []).find(s => s.id === storyId);
  if (!story) return null;
  story.myReaction = story.myReaction === reaction ? null : reaction;
  story.reactions = story.myReaction ? { [story.myReaction]: 1 } : {};
  db.social_stories.put(story).catch(() => {});
  notifyStories(story);
  return story;
}

export function requestStoriesSync() {
  broadcastMeshPacket('MESH_STORIES_REQUEST', { timestamp: Date.now() });
}

// ── Channels & Subscriptions Layer (YouTube style) ──────────────────────────

function receiveFollow(payload, senderDid) {
  if (!senderDid || payload?.targetDid !== myDid()) return;
  const set = new Set(_socialCache.followerDids || []);
  const isNew = !set.has(senderDid);
  if (payload.follow === false) set.delete(senderDid);
  else set.add(senderDid);
  _socialCache.followerDids = [...set].slice(-10000);
  persistSocialPrefs();
  window.dispatchEvent(new CustomEvent('novaura:social_profile_updated', { detail: getSocialProfile() }));
  if (payload.follow !== false && isNew) {
    const handle = String(payload.followerHandle || 'peer').replace(/[^\p{L}\p{N}_.-]/gu, '').slice(0, 40) || 'peer';
    dispatchMeshToast({ type: 'peer', title: 'New follower', message: `@${handle} started following you.` });
  }
}

export function toggleFollowUser(targetHandle, targetNodeId = null) {
  if (!_socialCache.following) _socialCache.following = [];
  const isFollowing = _socialCache.following.includes(targetHandle);
  _socialCache.following = isFollowing
    ? _socialCache.following.filter(h => h !== targetHandle)
    : [..._socialCache.following, targetHandle];
  // Only nodes with a key can be told; the packet is signed, so the follower is real.
  if (/^did:nova:[0-9a-f]{64}$/.test(String(targetNodeId || ''))) {
    broadcastMeshPacket('MESH_FOLLOW', { targetDid: targetNodeId, follow: !isFollowing, followerHandle: getLocalIdentity()?.handle || 'operator' });
  }
  persistSocialPrefs();
  window.dispatchEvent(new CustomEvent('novaura:social_profile_updated', { detail: getSocialProfile() }));
  return !isFollowing;
}

export function isFollowingUser(targetHandle) {
  if (!_socialCache.following) _socialCache.following = [];
  return _socialCache.following.includes(targetHandle);
}

export function getChannelVideos(authorHandle) {
  return (_socialCache.posts || []).filter(p => p.type === 'video' && p.authorHandle === authorHandle);
}

// ── Ecosystem: System Notification Toast Dispatcher ────────────────────────

export function dispatchMeshToast({ type = 'info', title, message, action = null }) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('novaura:mesh_toast', {
      detail: { type, title, message, action, timestamp: Date.now() }
    }));
  }
}

// ── Ecosystem: Durable Asynchronous Store-and-Forward Outbox ───────────────

export async function queueOutboxPacket(recipientId, packetType, payload) {
  const outboxId = 'out_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const record = {
    id: outboxId,
    recipientId,
    packetType,
    payload,
    status: 'queued',
    retries: 0,
    createdAt: new Date().toISOString(),
    deliveredAt: null,
  };
  await db.mesh_outbox.put(record);

  // If target peer is currently online, attempt immediate flush
  const targetPeer = Array.from(_peersMap.values()).find(
    p => p.id === recipientId || p.name === recipientId || (p.address && p.address === recipientId)
  );
  if (targetPeer && targetPeer.id) {
    flushOutboxForPeer(targetPeer.id);
  }

  return record;
}

export async function flushOutboxForPeer(peerId) {
  if (!peerId) return;
  try {
    const queuedItems = await db.mesh_outbox
      .where('status')
      .equals('queued')
      .toArray();

    const matching = queuedItems.filter(item => 
      item.recipientId === peerId ||
      item.recipientId === 'broadcast' ||
      item.payload?.mail?.recipient === peerId ||
      item.payload?.recipientId === peerId
    );

    for (const item of matching) {
      const ok = await sendDirectMeshPacket(peerId, item.packetType, item.payload);
      if (ok) {
        await db.mesh_outbox.update(item.id, {
          status: 'delivered',
          deliveredAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn('[SovereignMesh] Flush outbox note:', err);
  }
}

export async function getOutbox() {
  try {
    return await db.mesh_outbox.orderBy('createdAt').reverse().toArray();
  } catch {
    return [];
  }
}

// ── Ecosystem: Web-of-Trust Contacts & Cryptographic Permissioning ─────────

export async function saveContact(peer, trustTier = 'verified') {
  if (!peer) return null;
  const contactId = peer.id || peer.nodeId || peer.handle || generateId();
  const finalTier = (trustTier && trustTier !== 'verified') ? trustTier : (peer.trustTier || 'verified');
  const record = {
    id: contactId,
    handle: peer.handle || peer.name || 'peer',
    nodeId: peer.id || peer.nodeId || contactId,
    name: peer.displayName || peer.name || 'Sovereign Peer',
    publicKey: peer.publicKey || peer.key || '',
    address: peer.address || `${peer.handle || 'peer'}@nova.node`,
    trustTier: finalTier, // 'ally' | 'verified' | 'blocked'
    allowInferenceSharing: finalTier === 'ally',
    isFavorite: Boolean(peer.isFavorite),
    updatedAt: new Date().toISOString()
  };
  await db.contacts.put(record);

  if (finalTier === 'blocked') {
    _blockedPeersCache.add(contactId);
    if (record.nodeId) _blockedPeersCache.add(record.nodeId);
  } else {
    _blockedPeersCache.delete(contactId);
    if (record.nodeId) _blockedPeersCache.delete(record.nodeId);
  }

  window.dispatchEvent(new CustomEvent('novaura:contacts_updated', { detail: record }));
  window.dispatchEvent(new CustomEvent('novaura:contact_saved', { detail: record }));
  dispatchMeshToast({
    type: 'contact',
    title: 'Contact Saved',
    message: `${record.name} pinned to Web of Trust (${finalTier.toUpperCase()})`
  });
  return record;
}

export async function getContacts() {
  try {
    return await db.contacts.orderBy('updatedAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function updateContactTrust(contactId, trustTier) {
  try {
    await db.contacts.update(contactId, {
      trustTier,
      allowInferenceSharing: trustTier === 'ally',
      updatedAt: new Date().toISOString()
    });
    if (trustTier === 'blocked') {
      _blockedPeersCache.add(contactId);
    } else {
      _blockedPeersCache.delete(contactId);
    }
    window.dispatchEvent(new CustomEvent('novaura:contacts_updated'));
    window.dispatchEvent(new CustomEvent('novaura:contact_saved'));
    return true;
  } catch {
    return false;
  }
}

export async function deleteContact(contactId) {
  try {
    await db.contacts.delete(contactId);
    _blockedPeersCache.delete(contactId);
    window.dispatchEvent(new CustomEvent('novaura:contacts_updated'));
    window.dispatchEvent(new CustomEvent('novaura:contact_deleted'));
    return true;
  } catch {
    return false;
  }
}

export async function isPeerBlocked(peerId) {
  if (!peerId) return false;
  if (_blockedPeersCache.has(peerId)) return true;
  try {
    const contact = await db.contacts.get(peerId);
    return contact?.trustTier === 'blocked';
  } catch {
    return false;
  }
}

// ── Ecosystem: P2P Distributed AI Inference Sharing ────────────────────────

// Open GPU sharing is opt-in and limited to contacts marked "ally". Anyone else
// goes through the Inference Exchange (signed, identity-bound access keys).
export function isSharingInference() {
  try {
    return localStorage.getItem('novaura_mesh_share_inference') === 'true';
  } catch {
    return false;
  }
}

export function setInferenceSharing(enabled) {
  try {
    localStorage.setItem('novaura_mesh_share_inference', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  } catch {}
}

export async function requestPeerInference(targetOrPeerId = null, options = {}) {
  let peerId = null;
  let opts = {};

  if (typeof targetOrPeerId === 'string') {
    peerId = targetOrPeerId;
    opts = options || {};
  } else if (targetOrPeerId && typeof targetOrPeerId === 'object') {
    peerId = targetOrPeerId.targetPeerId || targetOrPeerId.peerId || null;
    opts = targetOrPeerId;
  } else {
    opts = options || {};
  }

  const { prompt, role = 'aura', maxTokens = 1024, timeoutMs = 45000 } = opts;
  const jobId = 'inf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const myId = getLocalIdentity();
  // Replies are directed packets, which route by node id, not by DID.
  const replyNode = await getMeshNodeId();

  return new Promise((resolve, reject) => {
    let timer = null;

    const onResponse = (e) => {
      if (e.detail?.jobId === jobId) {
        cleanup();
        const res = e.detail;
        resolve({
          ...res,
          response: res.response || res.answer || '',
        });
      }
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('novaura:peer_inference_response', onResponse);
    };

    window.addEventListener('novaura:peer_inference_response', onResponse);

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Swarm inference request timed out after ${timeoutMs / 1000}s. No peer completed the job.`));
    }, timeoutMs);

    // Send direct packet to peer or broadcast
    if (peerId) {
      sendDirectMeshPacket(peerId, 'MESH_INFERENCE_REQUEST', {
        jobId,
        prompt,
        role,
        maxTokens,
        requesterId: myId.publicKey || myId.handle,
        requesterName: myId.displayName,
        replyNode,
      });
    } else {
      broadcastMeshPacket('MESH_INFERENCE_REQUEST', {
        jobId,
        prompt,
        role,
        maxTokens,
        requesterId: myId.publicKey || myId.handle,
        requesterName: myId.displayName,
        replyNode,
      });
    }
  });
}

const LEGACY_INFERENCE_MAX_PROMPT = 16000;
const LEGACY_INFERENCE_MAX_TOKENS = 1024;
let _legacyInferenceBusy = false;

export async function isAllyContact(did) {
  try {
    const direct = await db.contacts.get(did);
    if (direct) return direct.trustTier === 'ally';
    const byNode = await db.contacts.where('nodeId').equals(did).first();
    return byNode?.trustTier === 'ally';
  } catch {
    return false;
  }
}

async function handleIncomingInferenceRequest(jobId, prompt, role, maxTokens, requesterId, requesterName, replyNode) {
  if (!isSharingInference()) return;
  if (await isPeerBlocked(requesterId)) return;
  if (!(await isAllyContact(requesterId))) return;
  if (typeof prompt !== 'string' || prompt.length > LEGACY_INFERENCE_MAX_PROMPT) return;
  if (typeof replyNode !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(replyNode)) return;
  if (_legacyInferenceBusy) return;
  _legacyInferenceBusy = true;
  maxTokens = Math.min(Number(maxTokens) || 512, LEGACY_INFERENCE_MAX_TOKENS);

  const startTime = Date.now();
  try {
    const { dualInference } = await import('./dualInferenceService.js');
    let answer = '';
    let model = 'Local Neural Engine';

    if (role === 'nova') {
      answer = await dualInference.queryNova(prompt, { max_tokens: maxTokens });
      model = dualInference.getState()?.nova?.model || 'Nova Fast MoE';
    } else {
      answer = await dualInference.queryAura(prompt, { max_tokens: maxTokens });
      model = dualInference.getState()?.aura?.model || 'Aura Creative Core';
    }

    const durationMs = Date.now() - startTime;
    const myId = getLocalIdentity();

    // Log the completed job in Dexie
    db.swarm_inference_jobs.put({
      id: jobId,
      requesterId,
      role,
      model,
      status: 'completed',
      durationMs,
      createdAt: new Date().toISOString()
    }).catch(() => {});

    // Respond back to requester
    sendDirectMeshPacket(replyNode, 'MESH_INFERENCE_RESPONSE', {
      jobId,
      answer,
      response: answer,
      model,
      durationMs,
      providerName: myId.displayName
    });
  } catch (err) {
    console.warn('[SovereignMesh] Inference worker error:', err);
  } finally {
    _legacyInferenceBusy = false;
  }
}

// ── Ecosystem: Direct P2P File Dropper (Chunked Binary Transfers) ──────────

export async function sendFileToPeer(peerId, fileOrData) {
  if (!peerId || !fileOrData) return false;

  let name = fileOrData.name || fileOrData.fileName || 'sovereign_file';
  let size = fileOrData.size || 0;
  let type = fileOrData.type || fileOrData.mimeType || 'application/octet-stream';
  let dataBase64 = fileOrData.dataBase64 || '';

  // If passed a browser File / Blob, convert to Base64
  if (!dataBase64 && typeof fileOrData.arrayBuffer === 'function') {
    const buffer = await fileOrData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    dataBase64 = btoa(binary);
  }

  if (!dataBase64) {
    throw new Error('Unable to extract Base64 data from file payload.');
  }

  const fileId = 'file_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const CHUNK_SIZE = 32 * 1024; // 32KB per chunk
  const totalChunks = Math.ceil(dataBase64.length / CHUNK_SIZE);
  const myId = getLocalIdentity();

  // 1. Send Offer
  await sendDirectMeshPacket(peerId, 'MESH_FILE_OFFER', {
    fileId,
    fileName: name,
    size: size || dataBase64.length,
    mimeType: type,
    senderName: myId.displayName,
    totalChunks
  });

  // 2. Stream chunks
  for (let i = 0; i < totalChunks; i++) {
    const chunkData = dataBase64.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await sendDirectMeshPacket(peerId, 'MESH_FILE_CHUNK', {
      fileId,
      chunkIndex: i,
      data: chunkData
    });
  }

  // 3. Send Complete
  await sendDirectMeshPacket(peerId, 'MESH_FILE_COMPLETE', {
    fileId,
    fileName: name,
    size: size || dataBase64.length
  });

  // Record outbound transfer
  const transferRecord = {
    id: fileId,
    fileId,
    direction: 'outbound',
    peerId,
    fileName: name,
    mimeType: type,
    size: size || dataBase64.length,
    dataBase64,
    status: 'completed',
    createdAt: new Date().toISOString()
  };
  await db.mesh_transfers.put(transferRecord);

  window.dispatchEvent(new CustomEvent('novaura:transfer_updated', { detail: transferRecord }));
  dispatchMeshToast({
    type: 'transfer',
    title: 'File Delivered',
    message: `"${name}" successfully transmitted to peer.`
  });

  return { transferId: fileId, fileName: name };
}

export async function getTransfers() {
  try {
    return await db.mesh_transfers.orderBy('createdAt').reverse().toArray();
  } catch {
    return [];
  }
}

// ── Decentralized Web Hosting & Domain Resolution Layer ─────────────────────

export async function publishHostedSite(siteData) {
  if (!siteData || !siteData.domain) throw new Error('Missing domain for decentralized site publishing.');
  const cleanDomain = cleanNovaDomain(siteData.domain);
  if (!NOVA_DOMAIN_RE.test(cleanDomain)) {
    throw new Error('Invalid domain. Use letters, numbers, dots and hyphens only (for example: mysite.nova).');
  }
  const identity = getLocalIdentity();
  const publisherPubkey = String(identity.publicKey || '').replace(/^0x/, '').toLowerCase();
  const priorRecord = (await db.hosted_sites.get(cleanDomain)) || (await db.hosted_sites.where('domain').equals(cleanDomain).first());
  if (priorRecord?.publisherPubkey && priorRecord.publisherPubkey !== publisherPubkey) {
    throw new Error(`${cleanDomain} is already published by another node and cannot be overwritten. Choose a different domain.`);
  }
  
  // Deterministic SHA-256 digest of the HTML that is actually stored and sent (CIDv1 formatted)
  const publishedHtml = siteData.htmlContent || '<!DOCTYPE html><html><body><h1>Decentralized Site</h1></body></html>';
  if (publishedHtml.length > MAX_SITE_HTML_CHARS) {
    throw new Error(`Site is too large: ${Math.round(publishedHtml.length / 1024)} KB (limit ${MAX_SITE_HTML_CHARS / 1024} KB of HTML).`);
  }
  const hashHex = await sha256Hex(publishedHtml);
  const cid = `bafy2bzace${hashHex.substring(0, 32)}`;
  const updatedAt = new Date().toISOString();
  // The publisher signs (domain, content, time) so any peer can verify a relayed copy.
  let publisherSig = null;
  if (identity.secretKeyHex && /^[0-9a-f]{64}$/.test(publisherPubkey)) {
    publisherSig = siteBytesToHex(ed25519.sign(
      new TextEncoder().encode(siteSigningString(cleanDomain, hashHex, updatedAt, publisherPubkey)),
      siteHexToBytes(identity.secretKeyHex)
    ));
  }

  const faction = cleanDomain.endsWith('.aura') ? 'aura' : 'nova';
  const siteRecord = {
    id: cleanDomain,
    domain: cleanDomain,
    title: siteData.title || `${cleanDomain} — Decentralized Sovereign Site`,
    favicon: siteData.favicon || (faction === 'aura' ? '✨' : '🌐'),
    faction,
    category: siteData.category || (faction === 'aura' ? 'Creative & Neural' : 'Infrastructure & Tools'),
    ownerHandle: siteData.ownerHandle || identity.handle || 'operator',
    ownerPhone: siteData.ownerPhone || identity.phoneNumber || '+1-700-NOVA-0001',
    ownerNodeId: identity.nodeId || `did:nova:${(identity.publicKey || '').replace(/^0x/, '')}`,
    cid,
    contentHash: hashHex,
    htmlContent: publishedHtml,
    status: 'ACTIVE_MESH',
    updatedAt,
    publisherPubkey,
    publisherSig,
    isPinned: Boolean(siteData.isPinned),
    isFlagged: false,
  };

  await db.hosted_sites.put(siteRecord);
  // Unsigned sites stay local: peers would (correctly) reject them.
  if (publisherSig) broadcastMeshPacket('MESH_HOSTED_SITE', { site: siteRecord });
  window.dispatchEvent(new CustomEvent('novaura:site_updated', { detail: siteRecord }));
  return siteRecord;
}

// Sites from peers contain HTML/JS. Nothing from the mesh is stored or shown
// unless it is signed by its publisher, matches its content hash, is bounded in
// size, and does not take over a domain that someone else already published.
const NOVA_DOMAIN_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.(nova|aura)$/i;
const MAX_SITE_HTML_CHARS = 512 * 1024;
const MAX_SITE_CLOCK_SKEW_MS = 10 * 60 * 1000;
// Portals shipped inside every node across both Nova and Aura factions.
const BUILTIN_NOVA_DOMAINS = new Set([
  'genesis.nova', 'docs.nova', 'deca.nova',
  'elysium.aura', 'oracle.aura', 'creative.aura'
]);

function cleanNovaDomain(raw) {
  return String(raw || '').trim().replace(/^(nova|aura):\/\//, '').replace(/\/+$/, '');
}

function siteHexToBytes(hex) {
  return new Uint8Array(String(hex).replace(/^0x/, '').match(/.{1,2}/g).map((b) => parseInt(b, 16)));
}

function siteBytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return siteBytesToHex(new Uint8Array(digest));
}

function siteSigningString(domain, contentHash, updatedAt, publisherPubkey) {
  return `NOVA-SITE-V1:${domain}:${contentHash}:${updatedAt}:${publisherPubkey}`;
}

async function isAllyPublisher(pubkeyHex) {
  try {
    const direct = await db.contacts.get(`did:nova:${pubkeyHex}`);
    const contact = direct || (await db.contacts.where('publicKey').anyOf([pubkeyHex, `0x${pubkeyHex}`]).first());
    return contact?.trustTier === 'ally';
  } catch {
    return false;
  }
}

/**
 * Validate a site received from the mesh and store it. Returns the stored record,
 * or null when the site is rejected (never throws on hostile input).
 */
export async function admitRemoteSite(site) {
  try {
    if (!site || typeof site !== 'object') return null;
    const domain = cleanNovaDomain(site.domain);
    if (!NOVA_DOMAIN_RE.test(domain)) return null;

    const pub = String(site.publisherPubkey || '').replace(/^0x/, '').toLowerCase();
    const sig = String(site.publisherSig || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(pub) || !/^[0-9a-f]{128}$/.test(sig)) return null;

    const html = typeof site.htmlContent === 'string' ? site.htmlContent : null;
    if (!html || html.length > MAX_SITE_HTML_CHARS) return null;
    const contentHash = await sha256Hex(html);
    if (String(site.contentHash || '').toLowerCase() !== contentHash) return null;

    const updatedAt = String(site.updatedAt || '');
    const updatedMs = Date.parse(updatedAt);
    if (updatedAt.length > 40 || !Number.isFinite(updatedMs) || updatedMs > Date.now() + MAX_SITE_CLOCK_SKEW_MS) return null;

    const signedOk = ed25519.verify(
      siteHexToBytes(sig),
      new TextEncoder().encode(siteSigningString(domain, contentHash, updatedAt, pub)),
      siteHexToBytes(pub)
    );
    if (!signedOk) return null;

    // Ownership: first valid publisher owns the domain (pinned). A built-in or
    // unsigned local copy only yields to an ally; a signed copy only to its owner.
    const existing = (await db.hosted_sites.get(domain)) || (await db.hosted_sites.where('domain').equals(domain).first());
    if (existing?.publisherPubkey) {
      if (existing.publisherPubkey !== pub) return null;
      if (updatedMs <= (Date.parse(existing.updatedAt || '') || 0)) return null; // replay / rollback
    } else if (existing || BUILTIN_NOVA_DOMAINS.has(domain.toLowerCase())) {
      if (!(await isAllyPublisher(pub))) return null;
    }

    // Whitelisted fields only; the owner identity comes from the verified key,
    // never from a self-asserted field.
    const faction = domain.endsWith('.aura') ? 'aura' : 'nova';
    const record = {
      id: domain,
      domain,
      title: String(site.title || domain).slice(0, 200),
      // A short emoji-style icon only (a URL here would load from the network).
      favicon: (/^[^\s<>"'/\\]{1,4}$/u.test(String(site.favicon || '')) ? site.favicon : null) || (faction === 'aura' ? '✨' : '🌐'),
      faction,
      category: String(site.category || (faction === 'aura' ? 'Creative & Neural' : 'Infrastructure & Tools')).slice(0, 60),
      ownerHandle: String(site.ownerHandle || 'peer').slice(0, 64),
      ownerPhone: String(site.ownerPhone || '').slice(0, 32),
      ownerNodeId: `did:nova:${pub}`,
      cid: `bafy2bzace${contentHash.substring(0, 32)}`,
      contentHash,
      htmlContent: html,
      status: 'ACTIVE_MESH',
      updatedAt,
      publisherPubkey: pub,
      publisherSig: sig,
      receivedFromMesh: true,
      // Pinning and flagging are this node's own choices, never the publisher's.
      isPinned: Boolean(existing?.isPinned),
      isFlagged: Boolean(existing?.isFlagged),
    };
    await db.hosted_sites.put(record);
    return record;
  } catch (err) {
    console.warn('[SovereignMesh] Rejected remote site:', err?.message || err);
    return null;
  }
}

export async function queryRemoteSite(domain, timeoutMs = 8000) {
  const cleanDomain = cleanNovaDomain(domain);
  const identity = getLocalIdentity();

  return new Promise((resolve) => {
    let timer = null;
    const onResolved = (e) => {
      if (e.detail?.domain === cleanDomain) {
        cleanup();
        resolve(e.detail);
      }
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('novaura:site_resolved', onResolved);
    };
    window.addEventListener('novaura:site_resolved', onResolved);
    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    broadcastMeshPacket('MESH_SITE_QUERY', {
      domain: cleanDomain,
      requesterId: identity.publicKey || identity.handle || 'local_operator'
    });
  });
}

// ── Decentralized Web Registry Explorer & Administration ────────────────────

export async function getMeshSitesRegistry({ faction = 'all', category = 'all', search = '' } = {}) {
  try {
    let list = await db.hosted_sites.toArray();
    if (faction && faction !== 'all') {
      list = list.filter(s => (s.faction || (s.domain?.endsWith('.aura') ? 'aura' : 'nova')) === faction);
    }
    if (category && category !== 'all') {
      list = list.filter(s => (s.category || '').toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(s =>
        (s.domain || '').toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.ownerHandle || '').toLowerCase().includes(q)
      );
    }
    // Sort: Pinned first, then newest update
    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
    return list;
  } catch (err) {
    console.warn('[SovereignMesh] getMeshSitesRegistry error:', err);
    return [];
  }
}

export async function setSitePinStatus(domain, isPinned) {
  const cleanDomain = cleanNovaDomain(domain);
  await db.hosted_sites.update(cleanDomain, { isPinned: Boolean(isPinned) }).catch(() => {});
  window.dispatchEvent(new CustomEvent('novaura:site_updated', { detail: { domain: cleanDomain, isPinned } }));
  return true;
}

export async function setSiteFlagStatus(domain, isFlagged, reason = '') {
  const cleanDomain = cleanNovaDomain(domain);
  await db.hosted_sites.update(cleanDomain, { isFlagged: Boolean(isFlagged), flagReason: reason }).catch(() => {});
  window.dispatchEvent(new CustomEvent('novaura:site_updated', { detail: { domain: cleanDomain, isFlagged, flagReason: reason } }));
  return true;
}


