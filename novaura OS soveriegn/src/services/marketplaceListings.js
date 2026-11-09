/**
 * marketplaceListings.js — Admitting marketplace listings that arrive from peers.
 *
 * A peer listing is untrusted input. It is kept only when:
 * - its ID has the shape publishCreation() generates (so it cannot collide with
 *   starter items or other app data),
 * - it is bound to the publisher identity that signed the packet, and only that
 *   identity may replace it later,
 * - it never overwrites a listing created on this machine,
 * - it is newer than the copy already stored, so an older signed copy replayed
 *   from the relay archive (or within the five-minute window) changes nothing.
 * Text fields are trimmed to sane lengths; anything else in the packet is dropped.
 */

const LISTING_ID = /^pub_\d{10,16}_[a-z0-9]{1,8}$/;
const LIMITS = { title: 140, description: 2000, authorHandle: 64, version: 32, category: 40, tag: 32, tags: 12 };

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** The stored form of a peer listing, or null when it is not acceptable. */
export function sanitizeMeshListing(listing, senderDid) {
  if (!listing || typeof listing !== 'object' || !senderDid) return null;
  const id = String(listing.id || '');
  const title = clip(listing.title, LIMITS.title);
  const category = clip(listing.category, LIMITS.category);
  if (!LISTING_ID.test(id) || !title || !category) return null;

  const publishedAt = Number(listing.publishedAt);
  const tags = Array.isArray(listing.tags)
    ? listing.tags.map(t => clip(t, LIMITS.tag)).filter(Boolean).slice(0, LIMITS.tags)
    : [];

  return {
    id,
    title,
    category,
    description: clip(listing.description, LIMITS.description),
    authorHandle: clip(listing.authorHandle, LIMITS.authorHandle) || 'Peer',
    authorDid: senderDid,
    version: clip(listing.version, LIMITS.version) || '1.0.0',
    tags,
    isFreeSovereign: true,
    price: 0,
    publishedAt: Number.isFinite(publishedAt) && publishedAt > 0 ? Math.min(publishedAt, Date.now() + 5 * 60_000) : Date.now(),
    status: 'active',
    isMeshListing: true,
  };
}

/**
 * Stores a peer listing. Resolves to { record, isNew } when stored, or null
 * when it was rejected (bad shape, another publisher's ID, or a local listing).
 */
export async function admitMeshListing(listing, senderDid) {
  const record = sanitizeMeshListing(listing, senderDid);
  if (!record) return null;

  const { db } = await import('../database/sovereignDatabase.js');
  const existing = await db.marketplace_publications.get(record.id);
  // Local listings have no authorDid, so no peer can replace them.
  if (existing && existing.authorDid !== senderDid) return null;
  if (existing && !(record.publishedAt > Number(existing.publishedAt || 0))) return null;

  // No rating until someone actually rates it.
  await db.marketplace_publications.put({
    ...record,
    downloadCount: existing?.downloadCount || 0,
    rating: existing?.ratingCount ? existing.rating : null,
    ratingCount: existing?.ratingCount || 0,
  });
  return { record, isNew: !existing };
}
