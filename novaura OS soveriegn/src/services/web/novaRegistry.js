/**
 * novaRegistry.js — The mesh name registry (Nova Registry), on every node.
 *
 * Every node:
 *   - keeps the domain records it has seen (each checked against the authority
 *     key, see novaNames.js) and hands them to peers who ask (MESH_DOMAIN_QUERY);
 *   - sends its owner's claims (register, renew, transfer, release) and re-sends
 *     them until the operator answers, because the operator may be offline.
 *
 * The operator's node (one holding an operator certificate for its own key)
 * also decides claims: open names automatically, reviewed ones by hand in
 * Nova Registry > Operator. It signs records with its node key and broadcasts
 * them; replies go straight back to the claimant.
 */

import { db } from '../../database/sovereignDatabase.js';
import {
  getLocalIdentity, broadcastMeshPacket, sendDirectMeshPacket, registerMeshHandler, verifiedSenderDid,
} from '../sovereignMesh.js';
import { TRUSTED_AUTHORITIES } from '../../config/trustedAuthorities.js';
import {
  parseMeshName, TLD_INFO, MESH_TLDS, readOperatorCert, certValidAt, verifyRecord, recordIsLive, isNewerRecord,
  signRecord, signClaim, verifyClaim, claimId, decideClaim, cleanPubHex, reviewReason, GRACE_MS, CLAIM_MAX_AGE_MS,
} from './novaNames.js';

// Operator certificates withdrawn by the authority (cert IDs).
export const REVOKED_OPERATOR_CERTS = new Set([]);

const OPERATOR_KEY = 'registry_operator';
const QUERY_WAIT_MS = 2500;
const RESEND_EVERY_MS = 10 * 60_000;
const MAX_QUERY_NAMES = 16;
const verifyOpts = () => ({ authorities: TRUSTED_AUTHORITIES, revokedCertIds: REVOKED_OPERATOR_CERTS, now: Date.now() });

const emit = (name, detail) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
};

export function getMyPub() {
  return cleanPubHex(getLocalIdentity()?.publicKey);
}

function mySecret() {
  const s = String(getLocalIdentity()?.secretKeyHex || '');
  return /^[0-9a-f]{64}$/i.test(s) ? s.toLowerCase() : null;
}

// ── Records ─────────────────────────────────────────────────────────────────

/** Verify and store a record if it is newer than the one held. Returns the stored record or null. */
export async function admitRecord(raw) {
  const check = verifyRecord(raw, verifyOpts());
  if (!check.ok) return null;
  const r = check.record;
  const held = await db.domain_records.get(r.name).catch(() => null);
  if (held && !isNewerRecord(r, held)) return held.seq === r.seq && held.updatedAt === r.updatedAt ? held : null;
  await db.domain_records.put(r);
  emit('novaura:domain_updated', { name: r.name, record: r });
  // An answer to one of our own claims.
  const mine = await db.domain_claims.where('name').equals(r.name).filter(c => c.direction === 'outgoing' && ['waiting', 'review'].includes(c.status)).toArray().catch(() => []);
  for (const c of mine) {
    if (r.updatedAt >= c.claim.at) {
      const ours = r.owner === c.claim.owner || r.owner === c.claim.to;
      await db.domain_claims.update(c.id, ours
        ? { status: 'done', reason: 'Done.', answeredAt: Date.now() }
        : { status: 'rejected', reason: 'The name went to someone else.', answeredAt: Date.now() });
    }
  }
  if (mine.length) emit('novaura:domain_claims_updated', {});
  return r;
}

/** The stored record for a registrable name (or any name under it), or null. */
export async function getRecord(name) {
  const p = parseMeshName(name);
  if (!p) return null;
  return (await db.domain_records.get(p.registrable).catch(() => null)) || null;
}

/** Ask peers for records we do not hold, waiting briefly for answers. */
export async function queryNames(names, waitMs = QUERY_WAIT_MS) {
  const wanted = [...new Set(names.map(n => parseMeshName(n)?.registrable).filter(Boolean))].slice(0, MAX_QUERY_NAMES);
  if (!wanted.length) return;
  broadcastMeshPacket('MESH_DOMAIN_QUERY', { names: wanted });
  if (waitMs <= 0) return;
  await new Promise((resolve) => {
    const pending = new Set(wanted);
    const timer = setTimeout(done, waitMs);
    function onUpdate(e) {
      pending.delete(e.detail?.name);
      if (!pending.size) done();
    }
    function done() {
      clearTimeout(timer);
      window.removeEventListener('novaura:domain_updated', onUpdate);
      resolve();
    }
    window.addEventListener('novaura:domain_updated', onUpdate);
  });
}

/**
 * Everything the browser and the registry window need to know about a name:
 * { parsed, record, state, reason, policy, owner }
 * state: 'invalid' | 'available' | 'registered' | 'yours' | 'grace' | 'released' | 'revoked'
 */
export async function nameStatus(raw, { ask = true } = {}) {
  const parsed = parseMeshName(raw);
  if (!parsed) return { parsed: null, state: 'invalid', reason: `Mesh names end in ${MESH_TLDS.map(t => '.' + t).join(', ')}.` };
  let record = await getRecord(parsed.registrable);
  if (!record && ask) {
    await queryNames([parsed.registrable]);
    record = await getRecord(parsed.registrable);
  }
  const policy = (await getPolicy())[parsed.tld] || TLD_INFO[parsed.tld].policy;
  const now = Date.now();
  const me = getMyPub();
  const base = { parsed, record, policy, owner: record?.owner || null, review: reviewReason(parsed.registrable) };
  if (!record || record.status === 'released' || (record.status === 'active' && now > record.expiresAt + GRACE_MS)) {
    return { ...base, state: 'available', reason: base.review || (policy === 'open' ? 'Available.' : `Available. .${parsed.tld} names are reviewed by the registry operator.`) };
  }
  if (record.status === 'revoked') return { ...base, state: 'revoked', reason: record.note || 'Revoked by the registry operator.' };
  if (!recordIsLive(record, now)) return { ...base, state: 'grace', reason: 'Lapsed; held for its last owner to renew.' };
  return { ...base, state: record.owner === me ? 'yours' : 'registered', reason: record.owner === me ? 'Registered to you.' : 'Registered.' };
}

export async function listMyNames() {
  const me = getMyPub();
  if (!me) return [];
  return db.domain_records.where('owner').equals(me).toArray().catch(() => []);
}

// ── Claims (this node's owner) ──────────────────────────────────────────────

/** Sign and send a claim. action: register | renew | transfer | release. */
export async function requestName(action, name, { to = '' } = {}) {
  const secret = mySecret();
  if (!secret) throw new Error('Create your node identity first (Peering): names are registered to its key.');
  const parsed = parseMeshName(name);
  if (!parsed) throw new Error(`Mesh names end in ${MESH_TLDS.map(t => '.' + t).join(', ')}.`);
  const toPub = action === 'transfer' ? cleanPubHex(to) : '';
  if (action === 'transfer' && !toPub) throw new Error('Give the new owner as a node key or did:nova: ID.');

  const claim = signClaim({ action, name: parsed.registrable, to: toPub }, secret);
  const id = claimId(claim);
  await db.domain_claims.put({ id, name: claim.name, owner: claim.owner, direction: 'outgoing', status: 'waiting', claim, receivedAt: Date.now(), sentAt: Date.now() });
  emit('novaura:domain_claims_updated', {});

  // This node may be the operator itself: decide here, nothing to send.
  if (await operatorFor(parsed.tld)) {
    await handleIncomingClaim(claim, null);
  } else {
    broadcastMeshPacket('MESH_DOMAIN_CLAIM', { claim });
  }
  return db.domain_claims.get(id);
}

export async function listMyClaims() {
  return db.domain_claims.where('direction').equals('outgoing').reverse().sortBy('receivedAt').catch(() => []);
}

/** Re-send claims the operator has not answered yet (it may have been offline). */
export async function resendWaitingClaims() {
  const now = Date.now();
  const waiting = await db.domain_claims.where('status').equals('waiting').filter(c => c.direction === 'outgoing').toArray().catch(() => []);
  for (const c of waiting) {
    if (now - c.claim.at > CLAIM_MAX_AGE_MS) {
      await db.domain_claims.update(c.id, { status: 'expired', reason: 'The registry operator did not answer in time. Try again.' });
      continue;
    }
    if (now - (c.sentAt || 0) < RESEND_EVERY_MS / 2) continue;
    broadcastMeshPacket('MESH_DOMAIN_CLAIM', { claim: c.claim });
    await db.domain_claims.update(c.id, { sentAt: now });
  }
}

// ── Operator ────────────────────────────────────────────────────────────────

async function readOperatorSettings() {
  return (await db.getSetting(OPERATOR_KEY, null).catch(() => null)) || {};
}

export async function getPolicy() {
  const saved = (await readOperatorSettings()).policy || {};
  return Object.fromEntries(MESH_TLDS.map(t => [t, saved[t] === 'open' || saved[t] === 'reviewed' ? saved[t] : TLD_INFO[t].policy]));
}

/**
 * { installed, ok, reason, cert (payload), myPub, tlds, policy }.
 * ok means the certificate is valid now and names this node's own key.
 */
export async function getOperatorState() {
  const settings = await readOperatorSettings();
  const myPub = getMyPub();
  const policy = await getPolicy();
  if (!settings.cert) return { installed: false, ok: false, myPub, tlds: [], policy };
  const read = readOperatorCert(settings.cert, TRUSTED_AUTHORITIES, REVOKED_OPERATOR_CERTS);
  if (!read.ok) return { installed: true, ok: false, reason: read.reason, myPub, tlds: [], policy };
  const p = read.payload;
  if (p.operator !== myPub) return { installed: true, ok: false, reason: 'This certificate is for another node key.', cert: p, myPub, tlds: [], policy };
  if (!certValidAt(p, Date.now())) return { installed: true, ok: false, reason: 'This certificate has expired.', cert: p, myPub, tlds: [], policy };
  return { installed: true, ok: true, cert: p, token: settings.cert, myPub, tlds: p.tlds, policy };
}

async function operatorFor(tld) {
  const s = await getOperatorState();
  return s.ok && s.tlds.includes(tld) && mySecret() ? s : null;
}

export async function installOperatorCert(token) {
  const read = readOperatorCert(token, TRUSTED_AUTHORITIES, REVOKED_OPERATOR_CERTS);
  if (!read.ok) throw new Error(read.reason);
  if (read.payload.operator !== getMyPub()) throw new Error('This certificate is for another node key. Issue one for the key shown here.');
  if (!certValidAt(read.payload, Date.now())) throw new Error('This certificate has expired.');
  const settings = await readOperatorSettings();
  await db.setSetting(OPERATOR_KEY, { ...settings, cert: String(token).trim() });
  emit('novaura:registry_operator_changed', {});
  return getOperatorState();
}

export async function removeOperatorCert() {
  const settings = await readOperatorSettings();
  await db.setSetting(OPERATOR_KEY, { ...settings, cert: null });
  emit('novaura:registry_operator_changed', {});
}

export async function setTldPolicy(tld, policy) {
  if (!MESH_TLDS.includes(tld) || !['open', 'reviewed'].includes(policy)) throw new Error('Unknown TLD or policy.');
  const settings = await readOperatorSettings();
  await db.setSetting(OPERATOR_KEY, { ...settings, policy: { ...(settings.policy || {}), [tld]: policy } });
  emit('novaura:registry_operator_changed', {});
}

export async function listIncomingClaims() {
  return db.domain_claims.where('direction').equals('incoming').reverse().sortBy('receivedAt').catch(() => []);
}

async function countOpenNames(ownerPub, policy) {
  const now = Date.now();
  const held = await db.domain_records.where('owner').equals(ownerPub).toArray().catch(() => []);
  return held.filter(r => recordIsLive(r, now) && policy[parseMeshName(r.name)?.tld] === 'open').length;
}

/** Sign, store and broadcast a record (operator only). */
async function issue(fields, op) {
  const record = signRecord(fields, mySecret(), op.token);
  const stored = await admitRecord(record);
  if (!stored) throw new Error('The signed record did not verify. Check the operator certificate.');
  broadcastMeshPacket('MESH_DOMAIN_RECORD', { record });
  return stored;
}

// The operator's copy of a claim is kept under its own ID, apart from the
// claimant's row (they are the same node when the operator registers a name).
const opRowId = (claim) => `op:${claimId(claim)}`;

async function reply(claim, decision, reason) {
  if (claim.owner === getMyPub()) {
    // Our own claim, decided on this node.
    const status = decision === 'approve' ? 'done' : decision === 'review' ? 'review' : 'rejected';
    await db.domain_claims.update(claimId(claim), { status, reason, answeredAt: Date.now() }).catch(() => {});
    emit('novaura:domain_claims_updated', {});
    return;
  }
  const op = await operatorFor(parseMeshName(claim.name).tld);
  // The certificate lets the claimant check this reply really is from the operator.
  sendDirectMeshPacket(`did:nova:${claim.owner}`, 'MESH_DOMAIN_REPLY', { claimId: claimId(claim), decision, reason, cert: op?.token || '' }).catch(() => {});
}

/** The operator's handling of a verified claim, from the mesh or from this node. */
async function handleIncomingClaim(rawClaim, senderDid) {
  const check = verifyClaim(rawClaim);
  if (!check.ok) return;
  const claim = check.claim;
  // From the mesh, only the claimant's own node may send its claim.
  if (senderDid && senderDid !== `did:nova:${claim.owner}`) return;
  const tld = parseMeshName(claim.name).tld;
  const op = await operatorFor(tld);
  if (!op) return;

  const rowId = opRowId(claim);
  const prior = await db.domain_claims.get(rowId).catch(() => null);
  if (prior) {
    // Seen before (the claimant re-sent it): repeat the answer.
    const again = prior.status === 'approved' ? 'approve' : prior.status === 'pending' ? 'review' : 'reject';
    await reply(claim, again, prior.reason || '');
    return;
  }

  const current = await db.domain_records.get(claim.name).catch(() => null);
  const policy = await getPolicy();
  const d = decideClaim(claim, { current, policy: policy[tld], ownerOpenNames: await countOpenNames(claim.owner, policy) });
  const row = { id: rowId, name: claim.name, owner: claim.owner, direction: 'incoming', claim, receivedAt: Date.now(), reason: d.reason };

  if (d.decision === 'approve') {
    try {
      await issue(d.fields, op);
    } catch (err) {
      await db.domain_claims.put({ ...row, status: 'rejected', reason: err.message });
      await reply(claim, 'reject', err.message);
      return;
    }
  }
  await db.domain_claims.put({ ...row, status: d.decision === 'approve' ? 'approved' : d.decision === 'review' ? 'pending' : 'rejected' });
  emit('novaura:domain_claims_updated', {});
  await reply(claim, d.decision, d.reason);
}

export async function approveClaim(id) {
  const row = await db.domain_claims.get(id);
  if (!row || row.direction !== 'incoming' || row.status !== 'pending') throw new Error('No pending claim with that ID.');
  const op = await operatorFor(parseMeshName(row.name).tld);
  if (!op) throw new Error('This node is not the registry operator for that TLD.');
  const current = await db.domain_records.get(row.name).catch(() => null);
  // A pending claim may be older than a record that changed since: judge it as of now.
  const d = decideClaim(row.claim, { current, reviewed: true });
  if (d.decision !== 'approve') {
    await db.domain_claims.update(id, { status: 'rejected', reason: d.reason });
    await reply(row.claim, 'reject', d.reason);
    emit('novaura:domain_claims_updated', {});
    throw new Error(d.reason);
  }
  const record = await issue(d.fields, op);
  await db.domain_claims.update(id, { status: 'approved', reason: 'Approved by the registry operator.' });
  await reply(row.claim, 'approve', 'Approved by the registry operator.');
  emit('novaura:domain_claims_updated', {});
  return record;
}

export async function denyClaim(id, reason = 'Declined by the registry operator.') {
  const row = await db.domain_claims.get(id);
  if (!row || row.direction !== 'incoming' || row.status !== 'pending') throw new Error('No pending claim with that ID.');
  await db.domain_claims.update(id, { status: 'rejected', reason });
  await reply(row.claim, 'reject', reason);
  emit('novaura:domain_claims_updated', {});
}

/** Operator: give a name straight to a key (reserved names, official sites). */
export async function grantName(name, ownerKey) {
  const p = parseMeshName(name);
  const owner = cleanPubHex(ownerKey);
  if (!p || p.host !== p.registrable) throw new Error('Give a name like example.nova.');
  if (!owner) throw new Error('Give the owner as a node key or did:nova: ID.');
  const op = await operatorFor(p.tld);
  if (!op) throw new Error(`This node is not the registry operator for .${p.tld}.`);
  const current = await db.domain_records.get(p.registrable).catch(() => null);
  if (recordIsLive(current) && current.owner !== owner) throw new Error('This name is registered to someone else. Revoke it first.');
  const now = Date.now();
  return issue({
    name: p.registrable, owner, seq: (current?.seq || 0) + 1, registeredAt: now,
    expiresAt: now + 365 * 24 * 3600 * 1000, updatedAt: now, status: 'active', note: 'Granted by the registry operator.',
  }, op);
}

/** Operator: take a name back (abuse, impersonation). */
export async function revokeName(name, reason = 'Revoked by the registry operator.') {
  const p = parseMeshName(name);
  const current = p && await db.domain_records.get(p.registrable).catch(() => null);
  if (!current) throw new Error('No record for that name.');
  const op = await operatorFor(p.tld);
  if (!op) throw new Error(`This node is not the registry operator for .${p.tld}.`);
  const now = Date.now();
  return issue({ ...current, seq: current.seq + 1, updatedAt: now, status: 'revoked', note: String(reason).slice(0, 200) }, op);
}

export async function listAllRecords() {
  return db.domain_records.orderBy('updatedAt').reverse().toArray().catch(() => []);
}

// ── Mesh handlers ───────────────────────────────────────────────────────────

const _queryTimes = new Map();

registerMeshHandler('MESH_DOMAIN_CLAIM', (payload, packet) => {
  handleIncomingClaim(payload?.claim, verifiedSenderDid(packet)).catch(err => console.warn('[NovaRegistry] Claim not handled:', err.message));
});

registerMeshHandler('MESH_DOMAIN_RECORD', (payload) => {
  admitRecord(payload?.record).catch(() => {});
});

registerMeshHandler('MESH_DOMAIN_QUERY', async (payload, packet) => {
  const from = verifiedSenderDid(packet);
  if (!from) return;
  // A few lookups a second per peer at most.
  const now = Date.now();
  const recent = (_queryTimes.get(from) || []).filter(t => now - t < 10_000);
  if (recent.length >= 10) return;
  _queryTimes.set(from, [...recent, now]);
  const names = Array.isArray(payload?.names) ? payload.names.slice(0, MAX_QUERY_NAMES) : [];
  for (const n of names) {
    const r = await getRecord(n);
    if (r) sendDirectMeshPacket(from, 'MESH_DOMAIN_RECORD', { record: r }).catch(() => {});
  }
});

registerMeshHandler('MESH_DOMAIN_REPLY', async (payload, packet) => {
  const from = verifiedSenderDid(packet);
  const id = String(payload?.claimId || '');
  const row = id && await db.domain_claims.get(id).catch(() => null);
  if (!from || !row || row.direction !== 'outgoing' || !['waiting', 'review'].includes(row.status)) return;
  // Only the operator for that TLD speaks for the registry: the reply carries
  // its certificate, which must cover the TLD and name the sending key.
  const cert = readOperatorCert(payload?.cert, TRUSTED_AUTHORITIES, REVOKED_OPERATOR_CERTS);
  const tld = parseMeshName(row.name)?.tld;
  if (!cert.ok || !cert.payload.tlds.includes(tld) || `did:nova:${cert.payload.operator}` !== from || !certValidAt(cert.payload, Date.now())) return;
  const reason = String(payload?.reason || '').slice(0, 300);
  if (payload?.decision === 'review') {
    await db.domain_claims.update(id, { status: 'review', reason });
  } else if (payload?.decision === 'reject') {
    await db.domain_claims.update(id, { status: 'rejected', reason, answeredAt: Date.now() });
  } else {
    return; // approvals arrive as signed records, handled by admitRecord
  }
  emit('novaura:domain_claims_updated', {});
});

// Keep trying unanswered claims while the app is open.
if (typeof window !== 'undefined') {
  setTimeout(() => resendWaitingClaims().catch(() => {}), 15_000);
  setInterval(() => resendWaitingClaims().catch(() => {}), RESEND_EVERY_MS);
}
