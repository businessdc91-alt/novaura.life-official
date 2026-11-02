// meshManuscripts.js — Chapters other nodes share with the Literature IDE.
//
// A shared chapter is cleaned and capped before it is stored: size limit,
// fields clipped, HTML sanitized with remote images off. Its id is bound to the
// signer's DID, so a peer can update its own shared chapters but never replace
// another peer's (or the author's own files). The store keeps a limited number
// per sender and overall (manuscriptStore.receiveSharedManuscript).

import { sanitizeRichHtml } from './htmlSanitizer.js';

export const SHARED_LIMITS = {
  maxContentChars: 300000, // about 40,000 words of chapter HTML
  maxPerSender: 30,
  maxTotal: 200,
};

const clip = (value, max) => String(value ?? '').trim().slice(0, max);

/** A stored shared-chapter record from a MESH_LITERATURE_PUBLISH payload, or null if unusable. */
export function sanitizeMeshManuscript(payload, senderDid, { now = new Date().toISOString(), sanitize = sanitizeRichHtml } = {}) {
  const m = payload?.manuscript;
  if (!m || typeof m !== 'object' || typeof m.content !== 'string') return null;
  if (m.content.length > SHARED_LIMITS.maxContentChars) return null;
  const senderKey = String(senderDid || '').replace(/^did:nova:/, '').slice(0, 16);
  if (!/^[0-9a-f]{16}$/.test(senderKey)) return null;
  const sourceId = String(m.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (!sourceId) return null;

  const content = sanitize(m.content, { allowRemoteImages: false });
  const plain = content.replace(/<[^>]+>/g, ' ').trim();
  return {
    id: `mesh_${senderKey}_${sourceId}`,
    name: clip(m.name, 120) || 'Shared chapter',
    type: 'shared',
    sourceType: m.type === 'bible' ? 'bible' : 'chapter',
    content,
    wordCount: plain ? plain.split(/\s+/).length : 0,
    author: clip(payload.authorName, 60) || 'Network peer',
    authorId: senderDid,
    note: clip(payload.note, 500),
    isMeshShared: true,
    sharedAt: now,
    updatedAt: now,
    lastModified: now,
  };
}

/** Validates and stores a shared chapter from a verified sender. Resolves to the record or null. */
export async function admitMeshManuscript(payload, senderDid) {
  const doc = sanitizeMeshManuscript(payload, senderDid);
  if (!doc) return null;
  const { receiveSharedManuscript } = await import('./manuscriptStore.js');
  const stored = await receiveSharedManuscript(doc, SHARED_LIMITS);
  return stored ? doc : null;
}
