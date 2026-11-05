/**
 * novaNames.js — Names on the mesh web: .nova, .aura, .novaura and .catalyst.
 *
 * Pure (no storage, no network), so the browser, the registry, the mesh and
 * the certificate script all share one set of rules.
 *
 * Who owns a name is settled by a registry operator, the way a TLD registry
 * settles .com. Resolving, hosting, searching and carrying the records are
 * peer to peer, and every record proves itself:
 *
 *   authority key (TRUSTED_AUTHORITIES in sovereignAuth.js, private key kept offline)
 *     signs an operator certificate: this key may run these TLDs until this date
 *       the operator signs domain records: this name belongs to this key
 *         owners sign claims: register, renew, transfer, release
 *
 * Any node can check a record against the authority key alone, so records can
 * be passed around by anyone, and nothing a relay or a peer says is trusted.
 */

import { ed25519 } from '@noble/curves/ed25519.js';

export const MESH_TLDS = ['nova', 'aura', 'novaura', 'catalyst'];

// `policy` is the default: 'open' names are first come, first served (approved
// automatically); 'reviewed' names wait for the operator. The operator can change both.
export const TLD_INFO = {
  nova: { label: '.nova', policy: 'open', blurb: 'The Nova mesh: tools, projects, anything.' },
  aura: { label: '.aura', policy: 'open', blurb: 'The Aura mesh: creative and neural work.' },
  novaura: { label: '.novaura', policy: 'reviewed', blurb: 'Official NovAura names, reviewed by the registry operator.' },
  catalyst: { label: '.catalyst', policy: 'reviewed', blurb: 'The Catalyst Crew, reviewed by the registry operator.' },
};

// Names any TLD keeps for the operator to hand out (claims for them wait for review).
export const RESERVED_LABELS = new Set([
  'www', 'registry', 'registrar', 'operator', 'admin', 'root', 'search', 'genesis', 'docs', 'deca',
  'elysium', 'oracle', 'creative', 'novaura', 'nova', 'aura', 'catalyst', 'founder', 'office',
  'support', 'help', 'security', 'mesh', 'relay', 'official', 'staff', 'system', 'kernel', 'api', 'mail',
]);

// Labels shorter than this wait for review on every TLD.
export const MIN_OPEN_LABEL = 3;
export const TERM_MS = 365 * 24 * 3600 * 1000;
// After a name lapses, only its last owner may renew it for this long.
export const GRACE_MS = 30 * 24 * 3600 * 1000;
// Claims are re-sent until the operator answers, so they may arrive late.
export const CLAIM_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
export const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
export const MAX_OPEN_NAMES_PER_OWNER = 10;

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const SCHEME_RE = /^(nova|aura|novaura|catalyst|mesh):\/\//i;

// ── Names ───────────────────────────────────────────────────────────────────

/** Lowercase host with any mesh scheme, path, query or trailing dot removed. */
export function normalizeName(raw) {
  return String(raw || '').trim().replace(SCHEME_RE, '').split(/[/?#]/)[0].replace(/\.+$/, '').toLowerCase();
}

/**
 * { host, labels, tld, label, registrable, sub } for a valid mesh name, else null.
 * `registrable` is the part that gets registered (example.nova); `sub` is any
 * subdomain in front of it, which belongs to the same owner.
 */
export function parseMeshName(raw) {
  const host = normalizeName(raw);
  if (!host || host.length > 253) return null;
  const labels = host.split('.');
  if (labels.length < 2) return null;
  const tld = labels[labels.length - 1];
  if (!MESH_TLDS.includes(tld)) return null;
  // xn-- would allow look-alike names in another script.
  if (!labels.every(l => LABEL_RE.test(l) && !l.startsWith('xn--'))) return null;
  const label = labels[labels.length - 2];
  return {
    host,
    labels,
    tld,
    label,
    registrable: `${label}.${tld}`,
    sub: labels.slice(0, -2).join('.'),
  };
}

export function isMeshName(raw) {
  return parseMeshName(raw) !== null;
}

/** 'aura' for .aura names, 'nova' for the rest (the two styles the browser draws). */
export function factionOf(raw) {
  return parseMeshName(raw)?.tld === 'aura' ? 'aura' : 'nova';
}

/** nova://name.nova, aura://name.aura, novaura://..., catalyst://... */
export function meshUrl(raw) {
  const p = parseMeshName(raw);
  return p ? `${p.tld}://${p.host}` : null;
}

/** Why a claim for this registrable name waits for review even on an open TLD, or ''. */
export function reviewReason(name) {
  const p = parseMeshName(name);
  if (!p) return '';
  if (RESERVED_LABELS.has(p.label)) return 'This name is reserved; the registry operator decides who gets it.';
  if (p.label.length < MIN_OPEN_LABEL) return `Names shorter than ${MIN_OPEN_LABEL} characters are reviewed by the registry operator.`;
  return '';
}

// ── Encoding helpers ────────────────────────────────────────────────────────

const enc = (s) => new TextEncoder().encode(s);

export function hexToBytes(hex) {
  const clean = String(hex || '').replace(/^0x/i, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  let b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export function cleanPubHex(pub) {
  const clean = String(pub || '').replace(/^0x/i, '').replace(/^did:nova:/, '').toLowerCase();
  return HEX64.test(clean) ? clean : null;
}

function safeVerify(sigHex, message, pubHex) {
  try {
    return HEX128.test(sigHex) && HEX64.test(pubHex) && ed25519.verify(hexToBytes(sigHex), enc(message), hexToBytes(pubHex));
  } catch {
    return false;
  }
}

export function randomNonce() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(12)));
}

// ── Operator certificates ───────────────────────────────────────────────────
// NOVAREG1.<payload base64url>.<signature base64url>, the signature covering
// "NOVA-REGISTRY-OPERATOR-V1." + payload so it cannot be mistaken for a license.

const CERT_PREFIX = 'NOVAREG1';
const CERT_CONTEXT = 'NOVA-REGISTRY-OPERATOR-V1.';

/** Used by scripts/issue_registry_operator.mjs with the authority key. */
export function signOperatorCert({ kid, operator, tlds, days = 365, label = 'NovAura Registry', now = Date.now() }, authoritySecretHex) {
  const op = cleanPubHex(operator);
  if (!op) throw new Error('The operator key must be 64 hex characters (the node public key).');
  const list = [...new Set(tlds)].filter(t => MESH_TLDS.includes(t));
  if (!list.length) throw new Error(`Name at least one TLD: ${MESH_TLDS.join(', ')}.`);
  const issued = Math.floor(now / 1000);
  const payload = { v: 1, kid, certId: randomNonce(), operator: op, tlds: list, label, issued, expires: issued + Math.round(days * 86400) };
  const payloadB64 = b64urlEncode(enc(JSON.stringify(payload)));
  const sig = ed25519.sign(enc(CERT_CONTEXT + payloadB64), hexToBytes(authoritySecretHex));
  return `${CERT_PREFIX}.${payloadB64}.${b64urlEncode(sig)}`;
}

/**
 * { ok, payload } when the certificate is signed by an active trusted authority
 * and well formed, else { ok: false, reason }. Expiry is checked by the caller
 * against the time that matters (now, or when a record was signed).
 */
export function readOperatorCert(token, authorities, revokedCertIds = new Set()) {
  try {
    const parts = String(token || '').trim().split('.');
    if (parts.length !== 3 || parts[0] !== CERT_PREFIX) return { ok: false, reason: 'Not a registry operator certificate.' };
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    const authority = authorities?.[payload?.kid];
    if (!authority || authority.status !== 'ACTIVE') return { ok: false, reason: `Unknown or inactive authority "${payload?.kid}".` };
    const sig = b64urlDecode(parts[2]);
    if (sig.length !== 64 || !ed25519.verify(sig, enc(CERT_CONTEXT + parts[1]), hexToBytes(authority.pubkeyHex))) {
      return { ok: false, reason: 'The certificate signature does not match the authority key.' };
    }
    if (payload.v !== 1 || !HEX64.test(payload.operator || '') || !Array.isArray(payload.tlds)
      || !payload.tlds.length || !payload.tlds.every(t => MESH_TLDS.includes(t))
      || !Number.isFinite(payload.issued) || !Number.isFinite(payload.expires) || payload.expires <= payload.issued) {
      return { ok: false, reason: 'The certificate is malformed.' };
    }
    if (revokedCertIds.has(payload.certId)) return { ok: false, reason: 'This certificate has been revoked.' };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'The certificate could not be read.' };
  }
}

export function certValidAt(payload, timeMs) {
  return timeMs >= payload.issued * 1000 - MAX_CLOCK_SKEW_MS && timeMs <= payload.expires * 1000;
}

// ── Domain records (signed by the operator) ─────────────────────────────────

const RECORD_STATUSES = new Set(['active', 'released', 'revoked']);

export function recordSigningString(r) {
  return ['NOVA-DOMAIN-V1', r.name, r.owner, r.seq, r.registeredAt, r.expiresAt, r.updatedAt, r.status, r.operator].join('|');
}

export function signRecord(fields, operatorSecretHex, cert) {
  const operator = bytesToHex(ed25519.getPublicKey(hexToBytes(operatorSecretHex)));
  const record = {
    v: 1,
    name: fields.name,
    owner: fields.owner,
    seq: fields.seq,
    registeredAt: fields.registeredAt,
    expiresAt: fields.expiresAt,
    updatedAt: fields.updatedAt,
    status: fields.status,
    operator,
    note: String(fields.note || '').slice(0, 200),
    cert,
  };
  record.sig = bytesToHex(ed25519.sign(enc(recordSigningString(record)), hexToBytes(operatorSecretHex)));
  return record;
}

/**
 * Checks the whole chain: authority -> certificate (covering this TLD, valid
 * when the record was signed) -> record signature. Returns { ok, record } with
 * only the known fields, or { ok: false, reason }.
 */
export function verifyRecord(raw, { authorities, revokedCertIds, now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'No record.' };
  const r = {
    v: raw.v, name: raw.name, owner: raw.owner, seq: raw.seq, registeredAt: raw.registeredAt,
    expiresAt: raw.expiresAt, updatedAt: raw.updatedAt, status: raw.status, operator: raw.operator,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 200) : '', cert: raw.cert, sig: raw.sig,
  };
  const p = parseMeshName(r.name);
  if (r.v !== 1 || !p || p.registrable !== r.name || p.host !== r.name) return { ok: false, reason: 'Bad name.' };
  if (!HEX64.test(r.owner || '') || !HEX64.test(r.operator || '')) return { ok: false, reason: 'Bad keys.' };
  if (!Number.isSafeInteger(r.seq) || r.seq < 1) return { ok: false, reason: 'Bad sequence.' };
  if (![r.registeredAt, r.expiresAt, r.updatedAt].every(Number.isSafeInteger)) return { ok: false, reason: 'Bad times.' };
  if (r.expiresAt <= r.registeredAt || r.updatedAt > now + MAX_CLOCK_SKEW_MS) return { ok: false, reason: 'Bad times.' };
  if (!RECORD_STATUSES.has(r.status)) return { ok: false, reason: 'Bad status.' };

  const cert = readOperatorCert(r.cert, authorities, revokedCertIds);
  if (!cert.ok) return cert;
  if (cert.payload.operator !== r.operator) return { ok: false, reason: 'The record was not signed by the certificate holder.' };
  if (!cert.payload.tlds.includes(p.tld)) return { ok: false, reason: `This operator does not run .${p.tld}.` };
  if (!certValidAt(cert.payload, r.updatedAt)) return { ok: false, reason: 'The operator certificate was not valid when this record was signed.' };
  if (!safeVerify(r.sig, recordSigningString(r), r.operator)) return { ok: false, reason: 'The record signature does not match.' };
  return { ok: true, record: r };
}

/** Active and not expired. */
export function recordIsLive(r, now = Date.now()) {
  return Boolean(r) && r.status === 'active' && r.expiresAt > now;
}

/** True when `a` supersedes `b` (higher sequence, then later signature). */
export function isNewerRecord(a, b) {
  if (!b) return true;
  if (a.seq !== b.seq) return a.seq > b.seq;
  return a.updatedAt > b.updatedAt;
}

// ── Claims (signed by the owner or would-be owner) ──────────────────────────

export const CLAIM_ACTIONS = new Set(['register', 'renew', 'transfer', 'release']);

export function claimSigningString(c) {
  return ['NOVA-DOMAIN-CLAIM-V1', c.action, c.name, c.owner, c.to || '', c.at, c.nonce].join('|');
}

export function signClaim({ action, name, to = '', now = Date.now() }, ownerSecretHex) {
  const owner = bytesToHex(ed25519.getPublicKey(hexToBytes(ownerSecretHex)));
  const claim = { v: 1, action, name: parseMeshName(name)?.registrable || name, owner, to: cleanPubHex(to) || '', at: now, nonce: randomNonce() };
  claim.sig = bytesToHex(ed25519.sign(enc(claimSigningString(claim)), hexToBytes(ownerSecretHex)));
  return claim;
}

export function claimId(c) {
  return `${c.name}:${c.nonce}`;
}

/** { ok, claim } for a well-formed, signed, recent claim, else { ok: false, reason }. */
export function verifyClaim(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'No claim.' };
  const c = { v: raw.v, action: raw.action, name: raw.name, owner: raw.owner, to: raw.to || '', at: raw.at, nonce: raw.nonce, sig: raw.sig };
  const p = parseMeshName(c.name);
  if (c.v !== 1 || !CLAIM_ACTIONS.has(c.action) || !p || p.registrable !== c.name) return { ok: false, reason: 'Bad claim.' };
  if (!HEX64.test(c.owner || '') || (c.to && !HEX64.test(c.to)) || !/^[0-9a-f]{24}$/.test(c.nonce || '')) return { ok: false, reason: 'Bad claim.' };
  if (c.action === 'transfer' && (!c.to || c.to === c.owner)) return { ok: false, reason: 'A transfer needs a different new owner.' };
  if (!Number.isSafeInteger(c.at) || c.at > now + MAX_CLOCK_SKEW_MS || c.at < now - CLAIM_MAX_AGE_MS) return { ok: false, reason: 'The claim is too old or from the future.' };
  if (!safeVerify(c.sig, claimSigningString(c), c.owner)) return { ok: false, reason: 'The claim signature does not match.' };
  return { ok: true, claim: c };
}

// ── The operator's decision ─────────────────────────────────────────────────

/**
 * What the operator does with a verified claim, given the current record for
 * the name (or null), the TLD's policy, how many live open names the claimant
 * holds, and whether this claim id was already handled.
 * Returns { decision: 'approve'|'review'|'reject', reason, fields? } where
 * fields are what to sign (signRecord) on approval.
 */
export function decideClaim(claim, { current = null, policy = 'open', ownerOpenNames = 0, seen = false, now = Date.now(), reviewed = false } = {}) {
  if (seen) return { decision: 'reject', reason: 'This claim was already handled.' };
  const live = recordIsLive(current, now);
  const lapsedInGrace = current && current.status === 'active' && !live && now < current.expiresAt + GRACE_MS;
  const ownsIt = current && current.owner === claim.owner;
  // Changes to an existing name must be newer than its current record (no replays of old claims).
  if (current && claim.action !== 'register' && claim.at <= current.updatedAt) {
    return { decision: 'reject', reason: 'This claim is older than the current record.' };
  }
  const next = (fields) => ({ seq: (current?.seq || 0) + 1, updatedAt: now, name: claim.name, ...fields });

  switch (claim.action) {
    case 'register': {
      if ((live || lapsedInGrace) && !ownsIt) {
        return { decision: 'reject', reason: lapsedInGrace ? 'This name lapsed recently; only its last owner can renew it for now.' : 'This name is already registered.' };
      }
      if ((live || lapsedInGrace) && ownsIt) return decideClaim({ ...claim, action: 'renew' }, { current, policy, ownerOpenNames, now, reviewed });
      if (!reviewed) {
        const why = reviewReason(claim.name) || (policy !== 'open' ? `.${parseMeshName(claim.name).tld} names are reviewed by the registry operator.` : '')
          || (ownerOpenNames >= MAX_OPEN_NAMES_PER_OWNER ? `More than ${MAX_OPEN_NAMES_PER_OWNER} names for one key are reviewed by the registry operator.` : '');
        if (why) return { decision: 'review', reason: why };
      }
      return { decision: 'approve', reason: 'Registered.', fields: next({ owner: claim.owner, registeredAt: now, expiresAt: now + TERM_MS, status: 'active' }) };
    }
    case 'renew': {
      if (!current || !ownsIt || !(live || lapsedInGrace)) return { decision: 'reject', reason: 'Only the current owner can renew this name.' };
      // At most two terms ahead.
      const expiresAt = Math.min(Math.max(now, current.expiresAt) + TERM_MS, now + 2 * TERM_MS);
      return { decision: 'approve', reason: 'Renewed.', fields: next({ owner: claim.owner, registeredAt: current.registeredAt, expiresAt, status: 'active' }) };
    }
    case 'transfer': {
      if (!current || !ownsIt || !live) return { decision: 'reject', reason: 'Only the current owner can transfer this name.' };
      return { decision: 'approve', reason: 'Transferred.', fields: next({ owner: claim.to, registeredAt: now, expiresAt: current.expiresAt, status: 'active' }) };
    }
    case 'release': {
      if (!current || !ownsIt || current.status !== 'active') return { decision: 'reject', reason: 'Only the current owner can release this name.' };
      return { decision: 'approve', reason: 'Released.', fields: next({ owner: claim.owner, registeredAt: current.registeredAt, expiresAt: Math.max(current.registeredAt + 1, Math.min(current.expiresAt, now)), status: 'released' }) };
    }
    default:
      return { decision: 'reject', reason: 'Unknown action.' };
  }
}
