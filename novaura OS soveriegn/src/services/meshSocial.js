// meshSocial.js — Trust rules for NovaSocial content on the mesh.
//
// Posts, comments, stories, votes and reactions are each signed by their
// author's node key, so they can be relayed (feed sync, reposts) and still be
// checked against the original author, not whoever forwarded them. Vote and
// reaction totals are always recomputed from the signed per-voter records;
// counts from the wire are never trusted. Every field is clipped, media is
// limited to https links or small inline images, story lifetimes are capped,
// and an item's id starts with its author's key so no one can claim it first.
//
// No I/O here (sovereignMesh.js stores and sends), so the rules are unit tested.

import { ed25519 } from '@noble/curves/ed25519.js';

export const SOCIAL_LIMITS = {
  title: 300,
  content: 8000,
  comment: 4000,
  caption: 500,
  name: 60,
  handle: 40,
  mediaUrl: 2048,
  inlineImageChars: 40000,  // a data: image (packets over the relay are at most 64 KB)
  gallery: 6,
  chapters: 30,
  commentsPerPost: 300,
  commentDepth: 6,
  postsTotal: 2000,
  postsPerAuthor: 300,
  storiesTotal: 400,
  storiesPerAuthor: 20,
  storyLifetimeMs: 24 * 60 * 60 * 1000,
  clockSkewMs: 5 * 60 * 1000,
  packetBudget: 56000,      // serialized size kept under the relay's 64 KB frame
};

export const POST_TYPES = ['wall', 'reddit', 'video', 'image', 'link'];
export const REACTIONS = ['like', 'love', 'fire', 'insight', 'rocket', 'mindblown'];
// The only story backgrounds accepted (a peer-supplied CSS value could load a remote url()).
export const STORY_GRADIENTS = [
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #d946ef 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #3b82f6 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #9333ea 100%)',
  'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
];

const SIGN_PREFIX = 'NOVA-SOCIAL-v1';
const HEX64 = /^[0-9a-f]{64}$/;
const COLOR = /^#[0-9a-fA-F]{3,8}$/;

const clip = (v, n) => String(v ?? '').slice(0, n);
const clipTrim = (v, n) => String(v ?? '').trim().slice(0, n);

export function didToPub(did) {
  const m = /^did:nova:([0-9a-f]{64})$/.exec(String(did || ''));
  return m ? m[1] : null;
}

const hexToBytes = (hex) => new Uint8Array(String(hex).match(/.{2}/g).map(b => parseInt(b, 16)));
const bytesToHex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/** JSON with sorted keys at every level, so signer and verifier hash the same bytes. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter(k => value[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const messageBytes = (kind, fields) => new TextEncoder().encode(`${SIGN_PREFIX}\n${kind}\n${canonicalJson(fields)}`);

/** An id for a new item: starts with the author's key, so it can't be claimed by anyone else. */
export function newItemId(authorDid) {
  const pub = didToPub(authorDid) || '0'.repeat(64);
  const rand = new Uint8Array(8);
  (globalThis.crypto || {}).getRandomValues?.(rand);
  return `${pub.slice(0, 16)}_${bytesToHex(rand)}`;
}

const idBelongsTo = (id, did) => {
  const pub = didToPub(did);
  return Boolean(pub) && typeof id === 'string' && /^[0-9a-f]{16}_[0-9a-f]{8,32}$/.test(id) && id.startsWith(pub.slice(0, 16));
};

// ── Field rules ────────────────────────────────────────────────────────────

/** An https link or a small inline image; anything else (file:, javascript:, blob:, http:) is dropped. */
export function cleanMediaUrl(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) {
    return s.length <= SOCIAL_LIMITS.inlineImageChars ? s : null;
  }
  if (s.length > SOCIAL_LIMITS.mediaUrl) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function cleanAuthor(raw) {
  return {
    authorHandle: clipTrim(raw.authorHandle, SOCIAL_LIMITS.handle).replace(/[^\p{L}\p{N}_.-]/gu, '') || 'peer',
    authorName: clipTrim(raw.authorName, SOCIAL_LIMITS.name) || 'Mesh peer',
    authorColor: COLOR.test(String(raw.authorColor || '')) ? raw.authorColor : '#94a3b8',
  };
}

const isoOrNull = (v) => {
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** The signed part of a post. */
function postFields(p) {
  return {
    id: p.id,
    authorDid: p.authorDid,
    ...cleanAuthor(p),
    title: p.title ? clipTrim(p.title, SOCIAL_LIMITS.title) : null,
    content: clip(p.content, SOCIAL_LIMITS.content),
    type: POST_TYPES.includes(p.type) ? p.type : 'wall',
    subAura: clipTrim(p.subAura || 'r/general', 60),
    flair: p.flair ? clipTrim(p.flair, 40) : null,
    feeling: p.feeling && typeof p.feeling === 'object'
      ? { emoji: clipTrim(p.feeling.emoji, 8), label: clipTrim(p.feeling.label, 40) } : null,
    mediaGallery: (Array.isArray(p.mediaGallery) ? p.mediaGallery : []).map(cleanMediaUrl).filter(Boolean).slice(0, SOCIAL_LIMITS.gallery),
    videoDuration: p.videoDuration && /^\d{1,3}:\d{2}(:\d{2})?$/.test(String(p.videoDuration)) ? String(p.videoDuration) : null,
    videoChapters: (Array.isArray(p.videoChapters) ? p.videoChapters : []).slice(0, SOCIAL_LIMITS.chapters)
      .map(c => ({ time: Math.max(0, Math.min(86400, Math.round(Number(c?.time) || 0))), title: clipTrim(c?.title, 80) })),
    isShort: Boolean(p.isShort),
    repostOf: p.repostOf && typeof p.repostOf === 'object' ? p.repostOf : null,
    timestamp: isoOrNull(p.timestamp),
  };
}

function commentFields(c) {
  return {
    id: c.id,
    postId: clipTrim(c.postId, 64),
    parentId: c.parentId ? clipTrim(c.parentId, 64) : null,
    authorDid: c.authorDid,
    ...cleanAuthor(c),
    content: clip(c.content, SOCIAL_LIMITS.comment),
    timestamp: isoOrNull(c.timestamp),
  };
}

function storyFields(s) {
  return {
    id: s.id,
    authorDid: s.authorDid,
    ...cleanAuthor(s),
    mediaUrl: cleanMediaUrl(s.mediaUrl),
    caption: clipTrim(s.caption, SOCIAL_LIMITS.caption),
    bgGradient: STORY_GRADIENTS.includes(s.bgGradient) ? s.bgGradient : STORY_GRADIENTS[0],
    createdAt: isoOrNull(s.createdAt),
    expiresAt: isoOrNull(s.expiresAt),
  };
}

const voteFields = (v) => ({ target: clipTrim(v.target, 140), voterDid: v.voterDid, value: v.value ?? null, ts: Number(v.ts) || 0 });

// ── Signing ────────────────────────────────────────────────────────────────

function sign(kind, fields, secretHex) {
  return bytesToHex(ed25519.sign(messageBytes(kind, fields), hexToBytes(secretHex)));
}

function verify(kind, fields, sig, did) {
  const pub = didToPub(did);
  if (!pub || !HEX64.test(pub) || !/^[0-9a-f]{128}$/.test(String(sig || ''))) return false;
  try {
    return ed25519.verify(hexToBytes(sig), messageBytes(kind, fields), hexToBytes(pub));
  } catch {
    return false;
  }
}

const tooNew = (iso, now) => iso && Date.parse(iso) > now + SOCIAL_LIMITS.clockSkewMs;

// ── Posts ──────────────────────────────────────────────────────────────────

/** Signs a new post (own node). `raw` is the post as the composer builds it. */
export function signPost(raw, { authorDid, secretHex }) {
  const fields = postFields({ ...raw, authorDid, id: raw.id || newItemId(authorDid), timestamp: raw.timestamp || new Date().toISOString() });
  return { ...fields, sig: sign('post', fields, secretHex) };
}

/**
 * A post from the network, cleaned and checked, or null. A repost's embedded
 * original must carry its own valid signature or it is dropped from the repost.
 */
export function admitPost(raw, { now = Date.now(), depth = 0 } = {}) {
  if (!raw || typeof raw !== 'object' || !idBelongsTo(raw.id, raw.authorDid)) return null;
  const fields = postFields(raw);
  if (!fields.timestamp || tooNew(fields.timestamp, now)) return null;
  if (!verify('post', fields, raw.sig, raw.authorDid)) return null;
  // An embedded original must itself be a plain post (reposts embed originals).
  if (depth > 0 && fields.repostOf) return null;
  const post = { ...fields, sig: raw.sig };
  if (fields.repostOf) post.repostOf = admitPost(fields.repostOf, { now, depth: 1 });
  return post;
}

/**
 * Exactly the signed part of a post plus its signature: what a repost embeds,
 * so the repost's own signature and the original's both still verify later.
 */
export function signedPostCopy(post) {
  return { ...postFields(post), sig: post.sig };
}

// ── Comments ───────────────────────────────────────────────────────────────

export function signComment(raw, { authorDid, secretHex }) {
  const fields = commentFields({ ...raw, authorDid, id: raw.id || newItemId(authorDid), timestamp: raw.timestamp || new Date().toISOString() });
  return { ...fields, sig: sign('comment', fields, secretHex) };
}

export function admitComment(raw, { now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object' || !idBelongsTo(raw.id, raw.authorDid)) return null;
  const fields = commentFields(raw);
  if (!fields.postId || !fields.content.trim() || !fields.timestamp || tooNew(fields.timestamp, now)) return null;
  if (!verify('comment', fields, raw.sig, raw.authorDid)) return null;
  return { ...fields, sig: raw.sig };
}

/** All comments of a post as a flat list (the stored tree may be nested). */
export function flattenComments(list, out = [], depth = 0) {
  for (const c of Array.isArray(list) ? list : []) {
    if (!c || depth > SOCIAL_LIMITS.commentDepth) continue;
    out.push(c);
    if (c.replies?.length) flattenComments(c.replies, out, depth + 1);
  }
  return out;
}

/**
 * Inserts an admitted comment into a post's comment tree (nested under its
 * parent when that is known). Returns false if it was already there or a cap
 * was reached.
 */
export function insertComment(post, comment) {
  const all = flattenComments(post.comments);
  if (all.some(c => c.id === comment.id) || all.length >= SOCIAL_LIMITS.commentsPerPost) return false;
  const node = { ...comment, replies: [], voteSigs: {} };
  deriveVotes(node);
  if (!post.comments) post.comments = [];
  const place = (list, depth) => {
    for (const c of list) {
      if (c.id === comment.parentId) {
        if (depth >= SOCIAL_LIMITS.commentDepth) return false;
        (c.replies = c.replies || []).push(node);
        return true;
      }
      if (c.replies?.length && place(c.replies, depth + 1)) return true;
    }
    return false;
  };
  if (!comment.parentId || !place(post.comments, 1)) post.comments.push(node);
  return true;
}

// ── Votes and reactions ────────────────────────────────────────────────────

/** A signed vote ('up' | 'down' | null) or reaction (one of REACTIONS | null) by this node. */
export function signVote({ target, value, kind = 'vote' }, { voterDid, secretHex }) {
  const fields = voteFields({ target, voterDid, value, ts: Date.now() });
  return { ...fields, kind, sig: sign(kind, fields, secretHex) };
}

export function admitVote(raw, { now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind === 'reaction' ? 'reaction' : 'vote';
  const fields = voteFields(raw);
  const allowed = kind === 'vote' ? ['up', 'down', null] : [...REACTIONS, null];
  if (!fields.target || !allowed.includes(fields.value) || !fields.ts || fields.ts > now + SOCIAL_LIMITS.clockSkewMs) return null;
  if (!verify(kind, fields, raw.sig, fields.voterDid)) return null;
  return { ...fields, kind, sig: raw.sig };
}

/**
 * Records a signed vote/reaction on a post or comment (newest per voter wins)
 * and recomputes the totals. Returns true if anything changed.
 */
export function applyVote(item, record) {
  const map = record.kind === 'reaction' ? (item.reactionSigs = item.reactionSigs || {}) : (item.voteSigs = item.voteSigs || {});
  const prev = map[record.voterDid];
  if (prev && prev.ts >= record.ts) return false;
  map[record.voterDid] = { value: record.value, ts: record.ts, sig: record.sig, target: record.target };
  deriveVotes(item);
  return true;
}

/** Totals and per-voter maps (the shape the UI reads) from the signed records only. */
export function deriveVotes(item) {
  const votes = item.voteSigs || {};
  item.voters = {};
  item.upvotes = 0;
  item.downvotes = 0;
  for (const [did, rec] of Object.entries(votes)) {
    if (rec.value === 'up') { item.upvotes++; item.voters[did] = 'up'; }
    if (rec.value === 'down') { item.downvotes++; item.voters[did] = 'down'; }
  }
  const reactions = item.reactionSigs || {};
  item.reactions = Object.fromEntries(REACTIONS.map(r => [r, 0]));
  item.reactionUsers = {};
  for (const [did, rec] of Object.entries(reactions)) {
    if (REACTIONS.includes(rec.value)) { item.reactions[rec.value]++; item.reactionUsers[did] = rec.value; }
  }
  return item;
}

/** Re-checks relayed vote maps (from a feed sync) and keeps only valid records for this target. */
export function admitVoteMap(map, kind, target, now = Date.now()) {
  const out = {};
  for (const [did, rec] of Object.entries(map && typeof map === 'object' ? map : {}).slice(0, 5000)) {
    const ok = admitVote({ ...rec, kind, voterDid: did }, { now });
    if (ok && ok.target === target) out[did] = { value: ok.value, ts: ok.ts, sig: ok.sig, target };
  }
  return out;
}

// ── Stories ────────────────────────────────────────────────────────────────

export function signStory(raw, { authorDid, secretHex, now = Date.now() }) {
  const hours = Math.max(1, Math.min(24, Number(raw.duration) || 24));
  const fields = storyFields({
    ...raw, authorDid, id: raw.id || newItemId(authorDid),
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + hours * 3600000).toISOString(),
  });
  return { ...fields, sig: sign('story', fields, secretHex) };
}

export function admitStory(raw, { now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object' || !idBelongsTo(raw.id, raw.authorDid)) return null;
  const fields = storyFields(raw);
  const created = Date.parse(fields.createdAt);
  const expires = Date.parse(fields.expiresAt);
  if (!Number.isFinite(created) || !Number.isFinite(expires)) return null;
  if (created > now + SOCIAL_LIMITS.clockSkewMs || expires <= now || expires - created > SOCIAL_LIMITS.storyLifetimeMs) return null;
  if (!fields.mediaUrl && !fields.caption) return null;
  if (!verify('story', fields, raw.sig, raw.authorDid)) return null;
  return { ...fields, sig: raw.sig };
}

// ── Caps and batching ──────────────────────────────────────────────────────

/** Ids to drop so each author keeps at most `perAuthor` items and the total stays under `total` (oldest go first). */
export function overflowIds(items, { perAuthor, total, timeKey = 'timestamp' }) {
  const byAge = [...items].sort((a, b) => String(a[timeKey]).localeCompare(String(b[timeKey])));
  const drop = new Set();
  const perAuthorCount = new Map();
  for (const it of [...byAge].reverse()) {
    const n = (perAuthorCount.get(it.authorDid) || 0) + 1;
    perAuthorCount.set(it.authorDid, n);
    if (n > perAuthor) drop.add(it.id);
  }
  const kept = byAge.filter(it => !drop.has(it.id));
  kept.slice(0, Math.max(0, kept.length - total)).forEach(it => drop.add(it.id));
  return drop;
}

/** Splits items into batches whose JSON stays under the packet budget (oversized single items are skipped). */
export function packetBatches(items, budget = SOCIAL_LIMITS.packetBudget) {
  const batches = [];
  let current = [];
  let size = 0;
  for (const it of items) {
    const n = JSON.stringify(it).length + 1;
    if (n > budget) continue;
    if (size + n > budget && current.length) { batches.push(current); current = []; size = 0; }
    current.push(it);
    size += n;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** A post as it goes over the wire: signed fields, signed vote maps and comments (no local-only state). */
export function wirePost(post) {
  const { currentUserVote: _v, currentUserReaction: _r, hotScore: _h, score: _s, voters: _vo, reactionUsers: _ru,
    upvotes: _u, downvotes: _d, reactions: _re, views: _vw, ...rest } = post;
  return rest;
}
