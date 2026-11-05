/**
 * meshWebSearch.js — Nova Search: search the mesh web, not a company's index.
 *
 * Each node indexes the mesh sites it holds (its own and those it received,
 * already signature-checked) and answers peers' searches from that index with
 * signed public sites only, never unsigned drafts. A search asks connected
 * peers too and merges their answers. Peer results are hints: opening one
 * fetches the site and checks its signature and registration like any other.
 */

import { db } from '../../database/sovereignDatabase.js';
import { broadcastMeshPacket, sendDirectMeshPacket, registerMeshHandler, verifiedSenderDid, getLocalIdentity } from '../sovereignMesh.js';
import { buildIndex, searchIndex } from './webIndex.js';
import { parseMeshName, randomNonce, cleanPubHex } from './novaNames.js';

const PEER_WAIT_MS = 2500;
const MAX_PEER_RESULTS = 10;

let _index = null;
let _dirty = true;
if (typeof window !== 'undefined') {
  for (const ev of ['novaura:site_updated', 'novaura:domain_updated', 'novaura:mesh_updated']) {
    window.addEventListener(ev, () => { _dirty = true; });
  }
}

/** Sites this node can stand behind: not flagged, not revoked, and by the registered owner when registered. */
async function localIndex() {
  if (_index && !_dirty) return _index;
  _dirty = false;
  const now = Date.now();
  const [sites, records] = await Promise.all([
    db.hosted_sites.toArray().catch(() => []),
    db.domain_records.toArray().catch(() => []),
  ]);
  const byName = new Map(records.map(r => [r.name, r]));
  const docs = [];
  for (const s of sites) {
    const p = parseMeshName(s.domain);
    if (!p || s.isFlagged || !s.htmlContent) continue;
    const r = byName.get(p.registrable);
    if (r?.status === 'revoked') continue;
    const registered = r && r.status === 'active' && r.expiresAt > now ? r : null;
    if (registered && s.publisherPubkey !== registered.owner) continue;
    docs.push({
      domain: p.host,
      title: s.title || p.host,
      html: s.htmlContent,
      favicon: s.favicon || '',
      publisherPubkey: s.publisherPubkey || '',
      signed: Boolean(s.publisherSig),
      registered: Boolean(registered),
      builtin: !s.publisherPubkey && !s.receivedFromMesh,
      updatedAt: s.updatedAt || '',
    });
  }
  _index = buildIndex(docs);
  return _index;
}

const _open = new Map(); // search id -> (results, fromDid) => void

/**
 * Search the sites on this node and, unless askPeers is false, on connected
 * peers. onUpdate gets the merged list as answers arrive. Resolves with the
 * final list: this node's results first (best match first), then peers'.
 */
export async function searchMeshWeb(query, { askPeers = true, waitMs = PEER_WAIT_MS, onUpdate } = {}) {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return [];
  const local = searchIndex(await localIndex(), q).map(r => ({ ...r, source: 'local' }));
  const merged = new Map(local.map(r => [r.domain, r]));
  const list = () => [...merged.values()];
  onUpdate?.(list());
  if (!askPeers) return list();

  const id = randomNonce();
  _open.set(id, (results, from) => {
    for (const r of results) if (!merged.has(r.domain)) merged.set(r.domain, { ...r, source: 'peer', via: from });
    onUpdate?.(list());
  });
  broadcastMeshPacket('MESH_WEB_SEARCH', { id, q });
  await new Promise(r => setTimeout(r, waitMs));
  _open.delete(id);
  return list();
}

function cleanPeerResult(raw, liveOwners, revoked) {
  if (!raw || typeof raw !== 'object') return null;
  const p = parseMeshName(raw.domain);
  if (!p) return null;
  const publisher = cleanPubHex(raw.publisherPubkey) || '';
  // A peer cannot vouch for an impostor: registered names list only their owner's site.
  const owner = liveOwners.get(p.registrable);
  if (revoked.has(p.registrable) || (owner && publisher !== owner)) return null;
  return {
    domain: p.host,
    title: String(raw.title || p.host).slice(0, 200),
    snippet: String(raw.snippet || '').slice(0, 300),
    publisherPubkey: publisher,
    registered: Boolean(owner),
    favicon: /^[^\s<>"'/\\]{1,4}$/u.test(String(raw.favicon || '')) ? raw.favicon : '',
  };
}

const _answered = new Map(); // sender -> last answer time

registerMeshHandler('MESH_WEB_SEARCH', async (payload, packet) => {
  const from = verifiedSenderDid(packet);
  const me = cleanPubHex(getLocalIdentity()?.publicKey);
  if (!from || from === `did:nova:${me}`) return;
  const now = Date.now();
  if (now - (_answered.get(from) || 0) < 1500) return;
  _answered.set(from, now);
  const q = String(payload?.q || '').slice(0, 200);
  const id = String(payload?.id || '');
  if (!q || !/^[0-9a-f]{24}$/.test(id)) return;
  // Signed, published sites only. Drafts and built-in pages stay on this node.
  const results = searchIndex(await localIndex(), q, { limit: 30 })
    .filter(r => r.signed)
    .slice(0, MAX_PEER_RESULTS)
    .map(r => ({ domain: r.domain, title: r.title, snippet: r.snippet.slice(0, 300), publisherPubkey: r.publisherPubkey, favicon: r.favicon }));
  if (results.length) sendDirectMeshPacket(from, 'MESH_WEB_RESULTS', { id, results }).catch(() => {});
});

registerMeshHandler('MESH_WEB_RESULTS', async (payload, packet) => {
  const from = verifiedSenderDid(packet);
  const deliver = _open.get(String(payload?.id || ''));
  if (!from || !deliver || !Array.isArray(payload?.results)) return;
  const now = Date.now();
  const records = await db.domain_records.toArray().catch(() => []);
  const liveOwners = new Map(records.filter(r => r.status === 'active' && r.expiresAt > now).map(r => [r.name, r.owner]));
  const revoked = new Set(records.filter(r => r.status === 'revoked').map(r => r.name));
  const results = payload.results.slice(0, MAX_PEER_RESULTS).map(r => cleanPeerResult(r, liveOwners, revoked)).filter(Boolean);
  if (results.length) deliver(results, from);
});
