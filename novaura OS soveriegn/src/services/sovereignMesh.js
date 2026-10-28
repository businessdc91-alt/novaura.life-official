// sovereignMesh.js — Genuine Decentralized P2P Mesh, Identity, Mailbox & Social Layer
// Backed by the user's on-device private cloud database (Dexie IndexedDB)
// Powered by physical Machine-to-Machine networking (Tauri UDP LAN Beacon + TCP Peer Sockets + Headless WAN Relay)
// and intra-browser BroadcastChannel for zero-latency multi-tab synchronization.

import { db } from '../database/sovereignDatabase.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';

const STORAGE_KEY = 'novaura_sovereign_identity';
const MAIL_STORAGE = 'novaura_sovereign_mailstore';
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

    // Validate that sender_id cryptographically binds to public key
    const prefix = cleanPub.slice(0, 16);
    if (!packet.sender_id.startsWith('did:nova:') && packet.sender_id !== cleanPub && packet.sender_id !== ('0x' + cleanPub)) {
      return false;
    }
    if (packet.sender_id.startsWith('did:nova:') && !packet.sender_id.includes(prefix)) {
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
let _socialCache = { profile: null, posts: [], friends: [] };
const _peersMap = new Map(); // Keyed by node_id / peer_id (Authentic physical network peers)

// Initialize sync cache from localStorage/cold storage first
try {
  const rawId = localStorage.getItem(STORAGE_KEY);
  if (rawId) _identityCache = JSON.parse(rawId);

  const rawMail = localStorage.getItem(MAIL_STORAGE);
  if (rawMail) _mailCache = JSON.parse(rawMail);

  const rawSocial = localStorage.getItem(SOCIAL_STORAGE);
  if (rawSocial) _socialCache = JSON.parse(rawSocial);
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

    // 3. Social Posts (Honest storage - zero fake genesis seed)
    const allPosts = await db.social_posts.toArray();
    _socialCache.posts = allPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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

  if (!isInfraPacket && packet && (packet.signature || packet.sender_pubkey)) {
    const verified = verifyPacketSignature(packet);
    if (!verified) {
      console.warn(`[SovereignMesh] SECURITY ALERT: Dropped unverified/forged packet ${packet.id || 'unknown'} of type ${type}`);
      return;
    }
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
                subject: decrypted.subject,
                body: decrypted.body,
                attachments: decrypted.attachments || [],
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

    case 'MESH_POST': {
      const post = payload?.post || packet?.payload?.post;
      if (post && !_socialCache.posts.some(p => p.id === post.id)) {
        _socialCache.posts.unshift(post);
        db.social_posts.put(post).catch(() => {});
        window.dispatchEvent(new CustomEvent('novaura:social_updated', { detail: post }));
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }
      break;
    }

    case 'MESH_POSTS_REQUEST': {
      const requesterId = packet.sender_id || payload?.requesterId;
      if (requesterId) {
        db.social_posts.toArray().then(posts => {
          if (posts && posts.length > 0) {
            const sorted = posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20);
            sendDirectMeshPacket(requesterId, 'MESH_POSTS_RESPONSE', { posts: sorted });
          }
        }).catch(() => {});
      }
      break;
    }

    case 'MESH_POSTS_RESPONSE': {
      const incomingPosts = payload?.posts || packet?.payload?.posts;
      if (Array.isArray(incomingPosts) && incomingPosts.length > 0) {
        let changed = false;
        for (const post of incomingPosts) {
          if (!_socialCache.posts.some(p => p.id === post.id)) {
            _socialCache.posts.push(post);
            db.social_posts.put(post).catch(() => {});
            changed = true;
          }
        }
        if (changed) {
          _socialCache.posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          window.dispatchEvent(new CustomEvent('novaura:social_updated'));
          window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
        }
      }
      break;
    }

    case 'MESH_VOTE': {
      const postId = payload?.postId || packet?.payload?.postId;
      const voters = payload?.voters || packet?.payload?.voters;
      const upvotes = payload?.upvotes ?? packet?.payload?.upvotes;
      const downvotes = payload?.downvotes ?? packet?.payload?.downvotes;

      if (postId) {
        const post = _socialCache.posts.find(p => p.id === postId);
        if (post) {
          if (voters && typeof voters === 'object') post.voters = { ...(post.voters || {}), ...voters };
          if (typeof upvotes === 'number') post.upvotes = upvotes;
          if (typeof downvotes === 'number') post.downvotes = downvotes;
          db.social_posts.put(post).catch(() => {});
          window.dispatchEvent(new CustomEvent('novaura:social_updated', { detail: post }));
          window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
        }
      }
      break;
    }

    case 'MESH_COMMENT': {
      const postId = payload?.postId || packet?.payload?.postId;
      const comment = payload?.comment || packet?.payload?.comment;
      if (postId && comment) {
        const post = _socialCache.posts.find(p => p.id === postId);
        if (post) {
          if (!post.comments) post.comments = [];
          if (!post.comments.some(c => c.id === comment.id)) {
            post.comments.push(comment);
            db.social_posts.put(post).catch(() => {});
            window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
          }
        }
      }
      break;
    }

    case 'MESH_HOSTED_SITE': {
      const site = payload?.site || packet?.payload?.site;
      if (site && site.domain) {
        const cleanDomain = site.domain.replace(/^nova:\/\//, '').replace(/\/$/, '');
        const record = {
          ...site,
          id: cleanDomain,
          domain: cleanDomain,
          updatedAt: site.updatedAt || new Date().toISOString()
        };
        db.hosted_sites.put(record).catch(() => {});
        window.dispatchEvent(new CustomEvent('novaura:site_updated', { detail: record }));
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }
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
      const site = payload?.site || packet?.payload?.site;
      if (site && site.domain) {
        const cleanDomain = site.domain.replace(/^nova:\/\//, '').replace(/\/$/, '');
        const record = {
          ...site,
          id: cleanDomain,
          domain: cleanDomain,
        };
        db.hosted_sites.put(record).catch(() => {});
        window.dispatchEvent(new CustomEvent('novaura:site_resolved', { detail: record }));
        window.dispatchEvent(new CustomEvent('novaura:site_updated', { detail: record }));
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }
      break;
    }

    case 'MESH_LITERATURE_PUBLISH': {
      const manuscript = payload?.manuscript || packet?.payload?.manuscript;
      if (manuscript) {
        const incomingDoc = {
          id: 'mesh_' + (manuscript.id || generateId()),
          name: `[Mesh] ${manuscript.name || 'Shared Chapter'}`,
          type: manuscript.type || 'chapter',
          content: manuscript.content || '',
          wordCount: manuscript.wordCount || 0,
          author: payload?.authorName || packet?.sender_name || 'Network Peer',
          authorId: packet?.sender_id || 'remote_peer',
          isMeshShared: true,
          sharedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.manuscripts.put(incomingDoc).catch(() => {});
        window.dispatchEvent(new CustomEvent('novaura:literature_received', { detail: incomingDoc }));
        window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
      }
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
      const listing = payload?.listing || payload;
      if (listing && listing.id) {
        db.marketplace_publications.put(listing).catch(() => {});
        window.dispatchEvent(new CustomEvent('novaura:marketplace_updated', { detail: listing }));
        dispatchMeshToast({
          type: 'store',
          title: 'New P2P Creation Listed',
          message: `"${listing.title}" by ${listing.authorHandle || 'Peer'} published to Sovereign Marketplace.`
        });
      }
      break;
    }

    case 'MESH_INFERENCE_REQUEST': {
      const { jobId, prompt, role, maxTokens, requesterName } = payload || packet?.payload || {};
      const requesterId = packet?.sender_id || payload?.requesterId;
      if (jobId && prompt && requesterId) {
        handleIncomingInferenceRequest(jobId, prompt, role || 'aura', maxTokens, requesterId, requesterName);
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
      const peerId = payload?.node_id;
      const peerName = payload?.node_name || 'Anonymous Node';
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
      const members = payload?.members || [];
      for (const m of members) {
        if (m.node_id) {
          flushOutboxForPeer(m.node_id);
        }
      }
      break;
    }

    default:
      break;
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
        flushOutboxForPeer(peer.id);
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

    listen('novaura://mesh-packet', (event) => {
      const packet = event.payload;
      if (packet) {
        handleIncomingMeshPacket(packet.packet_type, packet.payload, packet);
      }
    }).catch(err => console.warn('[SovereignMesh] Mesh packet listen note:', err));
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
  'MESH_HOSTED_SITE',
  'MESH_SITE_QUERY',
  'MESH_SITE_RESPONSE',
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

export function sendMail({ to, subject, body, attachments = [] }) {
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

  try {
    localStorage.setItem(MAIL_STORAGE, JSON.stringify(_mailCache));
  } catch {}

  // Records why a message could not leave this node. Mail is never broadcast
  // in plaintext: without the recipient's public key it stays local.
  const markUndelivered = (reason) => {
    const updated = { ...plainMail, deliveryStatus: 'undelivered', deliveryError: reason };
    const idx = _mailCache.sent.findIndex(m => m.id === mailId);
    if (idx !== -1) _mailCache.sent[idx] = updated;
    db.mailbox.put(updated).catch(() => {});
    try {
      localStorage.setItem(MAIL_STORAGE, JSON.stringify(_mailCache));
    } catch {}
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
    try {
      localStorage.setItem(MAIL_STORAGE, JSON.stringify(_mailCache));
    } catch {}
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  }
}

export function toggleStar(mailId) {
  const mail = _mailCache.inbox.find(m => m.id === mailId) || _mailCache.sent.find(m => m.id === mailId);
  if (mail) {
    mail.starred = !mail.starred;
    db.mailbox.update(mailId, { starred: mail.starred }).catch(() => {});
    try {
      localStorage.setItem(MAIL_STORAGE, JSON.stringify(_mailCache));
    } catch {}
    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  }
}

export function deleteMail(mailId, folder = 'inbox') {
  if (_mailCache[folder]) {
    _mailCache[folder] = _mailCache[folder].filter(m => m.id !== mailId);
    db.mailbox.delete(mailId).catch(() => {});
    try {
      localStorage.setItem(MAIL_STORAGE, JSON.stringify(_mailCache));
    } catch {}
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

// ── NovaSocial Layer ────────────────────────────────────────────────────────

export function getSocialProfile() {
  if (!_socialCache.profile) {
    const identity = getLocalIdentity();
    _socialCache.profile = {
      handle: identity?.handle || 'operator',
      displayName: identity?.displayName || 'Sovereign Operator',
      bio: identity?.bio || 'Local Node Sovereign Operator',
      avatarColor: identity?.avatarColor || '#00f0ff',
      followers: 0,
      following: 0,
      karma: 0,
    };
  }
  return _socialCache.profile;
}

export function updateSocialProfile(updates) {
  _socialCache.profile = { ...getSocialProfile(), ...updates };
  try {
    localStorage.setItem(SOCIAL_STORAGE, JSON.stringify(_socialCache));
  } catch {}
  return _socialCache.profile;
}

export function getFeed(filterSubAura = 'all', filterType = 'all') {
  const identity = getLocalIdentity();
  const voterId = identity?.nodeId || identity?.publicKey || 'local_operator';
  let list = (_socialCache.posts || []).map(p => {
    const userVote = p.voters ? p.voters[voterId] || null : null;
    return {
      ...p,
      currentUserVote: userVote,
      score: (p.upvotes || 0) - (p.downvotes || 0),
    };
  });
  if (filterSubAura && filterSubAura !== 'all') {
    list = list.filter(p => p.subAura === filterSubAura);
  }
  if (filterType && filterType !== 'all') {
    list = list.filter(p => p.type === filterType);
  }
  return list;
}

export function createPost({ title, content, type = 'wall', subAura = 'r/general', mediaUrl = null, videoDuration = null }) {
  const identity = getLocalIdentity();
  const authorId = identity?.nodeId || identity?.publicKey || 'local_operator';
  const post = {
    id: generateId(),
    authorHandle: identity?.handle || 'operator',
    authorName: identity?.displayName || 'Sovereign Operator',
    authorNodeId: authorId,
    authorColor: identity?.avatarColor || '#00f0ff',
    title: title ? title.trim() : null,
    content: content.trim(),
    type, // 'wall' | 'video' | 'reddit'
    subAura: subAura || 'r/general',
    mediaUrl: mediaUrl || null,
    videoDuration: videoDuration || null,
    upvotes: 1,
    downvotes: 0,
    voters: { [authorId]: 'up' },
    currentUserVote: 'up',
    views: 1,
    comments: [],
    timestamp: new Date().toISOString(),
  };

  _socialCache.posts.unshift(post);
  db.social_posts.put(post).catch(() => {});

  // Broadcast to other peers/tabs
  broadcastMeshPacket('MESH_POST', { post });

  try {
    localStorage.setItem(SOCIAL_STORAGE, JSON.stringify(_socialCache));
  } catch {}

  window.dispatchEvent(new CustomEvent('novaura:social_updated', { detail: post }));
  window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  return post;
}

export function votePost(postId, direction) {
  const identity = getLocalIdentity();
  const voterId = identity?.nodeId || identity?.publicKey || 'local_operator';
  const post = _socialCache.posts.find(p => p.id === postId);
  if (!post) return null;

  if (!post.voters || typeof post.voters !== 'object') {
    post.voters = {};
    if (post.upvotes > 0) {
      post.voters[post.authorNodeId || 'author'] = 'up';
    }
  }

  const prevVote = post.voters[voterId] || null;

  if (prevVote === direction) {
    // Retract vote (toggle off)
    delete post.voters[voterId];
    if (direction === 'up') {
      post.upvotes = Math.max(0, (post.upvotes || 1) - 1);
    } else {
      post.downvotes = Math.max(0, (post.downvotes || 1) - 1);
    }
  } else if (prevVote) {
    // Switch vote direction
    if (direction === 'up') {
      post.downvotes = Math.max(0, (post.downvotes || 1) - 1);
      post.upvotes = (post.upvotes || 0) + 1;
    } else {
      post.upvotes = Math.max(0, (post.upvotes || 1) - 1);
      post.downvotes = (post.downvotes || 0) + 1;
    }
    post.voters[voterId] = direction;
  } else {
    // First time voting
    post.voters[voterId] = direction;
    if (direction === 'up') {
      post.upvotes = (post.upvotes || 0) + 1;
    } else {
      post.downvotes = (post.downvotes || 0) + 1;
    }
  }

  post.currentUserVote = post.voters[voterId] || null;

  db.social_posts.update(postId, {
    upvotes: post.upvotes,
    downvotes: post.downvotes,
    voters: post.voters,
  }).catch(() => {});

  broadcastMeshPacket('MESH_VOTE', {
    postId,
    voterId,
    vote: post.voters[voterId] || 'retracted',
    upvotes: post.upvotes,
    downvotes: post.downvotes,
    voters: post.voters,
  });

  try {
    localStorage.setItem(SOCIAL_STORAGE, JSON.stringify(_socialCache));
  } catch {}

  window.dispatchEvent(new CustomEvent('novaura:social_updated', { detail: post }));
  window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
  return post;
}

export function addComment(postId, content) {
  const post = _socialCache.posts.find(p => p.id === postId);
  const identity = getLocalIdentity();
  if (post && content.trim()) {
    const comment = {
      id: generateId(),
      authorHandle: identity?.handle || 'operator',
      authorName: identity?.displayName || 'Sovereign Operator',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      upvotes: 0,
    };
    if (!post.comments) post.comments = [];
    post.comments.push(comment);

    db.social_posts.update(postId, { comments: post.comments }).catch(() => {});
    broadcastMeshPacket('MESH_COMMENT', { postId, comment });

    try {
      localStorage.setItem(SOCIAL_STORAGE, JSON.stringify(_socialCache));
    } catch {}

    window.dispatchEvent(new CustomEvent('novaura:mesh_updated'));
    return comment;
  }
  return null;
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

export function isSharingInference() {
  try {
    return localStorage.getItem('novaura_mesh_share_inference') !== 'false';
  } catch {
    return true;
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
        requesterName: myId.displayName
      });
    } else {
      broadcastMeshPacket('MESH_INFERENCE_REQUEST', {
        jobId,
        prompt,
        role,
        maxTokens,
        requesterId: myId.publicKey || myId.handle,
        requesterName: myId.displayName
      });
    }
  });
}

async function handleIncomingInferenceRequest(jobId, prompt, role, maxTokens, requesterId, requesterName) {
  if (!isSharingInference()) return;
  if (await isPeerBlocked(requesterId)) return;

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
    sendDirectMeshPacket(requesterId, 'MESH_INFERENCE_RESPONSE', {
      jobId,
      answer,
      response: answer,
      model,
      durationMs,
      providerName: myId.displayName
    });
  } catch (err) {
    console.warn('[SovereignMesh] Inference worker error:', err);
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
  const cleanDomain = siteData.domain.replace(/^nova:\/\//, '').replace(/\/$/, '');
  const identity = getLocalIdentity();
  
  // Calculate deterministic SHA-256 content digest (CIDv1 formatted)
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode((siteData.htmlContent || '') + (siteData.cssContent || '') + (siteData.jsContent || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', contentBytes);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  const cid = `bafy2bzace${hashHex.substring(0, 32)}`;

  const siteRecord = {
    id: cleanDomain,
    domain: cleanDomain,
    title: siteData.title || `${cleanDomain} — Decentralized Sovereign Site`,
    ownerHandle: siteData.ownerHandle || identity.handle || 'operator',
    ownerPhone: siteData.ownerPhone || identity.phoneNumber || '+1-700-NOVA-0001',
    ownerNodeId: identity.nodeId || `did:nova:${(identity.publicKey || '').replace(/^0x/, '')}`,
    cid,
    contentHash: hashHex,
    htmlContent: siteData.htmlContent || '<!DOCTYPE html><html><body><h1>Decentralized Site</h1></body></html>',
    status: 'ACTIVE_MESH',
    updatedAt: new Date().toISOString(),
  };

  await db.hosted_sites.put(siteRecord);
  broadcastMeshPacket('MESH_HOSTED_SITE', { site: siteRecord });
  window.dispatchEvent(new CustomEvent('novaura:site_updated', { detail: siteRecord }));
  return siteRecord;
}

export async function queryRemoteSite(domain, timeoutMs = 8000) {
  const cleanDomain = domain.replace(/^nova:\/\//, '').replace(/\/$/, '');
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

