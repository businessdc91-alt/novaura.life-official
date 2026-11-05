/**
 * novaTemplates.js — NovAura template bundles (.novatemplate): prototype
 * projects people can start from, the license they accept, and a signed record
 * that they accepted it.
 *
 * Pure (no storage, no network): the bundle builder (scripts/build_template.mjs),
 * the Template Library and the tests share it.
 *
 * A bundle is a ZIP:
 *   novatemplate.json   the manifest: what the template is and how far along, its
 *                       license and royalty, the parts that keep their own
 *                       licenses, and the SHA-256 of every file
 *   novatemplate.sig    Ed25519 signature (hex) of "NOVA-TEMPLATE-V1\n" + the
 *                       manifest's exact bytes, by the key in manifest.publisher.pub
 *   files/...           the project, with LICENSE-NOVAURA-TEMPLATE.md and
 *                       PROTOTYPE-NOTICE.md at its root
 *
 * A bundle signed by a TRUSTED_AUTHORITIES key is a NovAura Original. Anyone
 * else can sign one with their node key; it then shows as theirs.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { hexToBytes, bytesToHex, cleanPubHex, randomNonce } from '../web/novaNames.js';

export const BUNDLE_FORMAT = 'novatemplate/1';
export const BUNDLE_EXT = '.novatemplate';
export const MANIFEST_ENTRY = 'novatemplate.json';
export const SIGNATURE_ENTRY = 'novatemplate.sig';
export const FILES_PREFIX = 'files/';
export const LICENSE_FILE = 'LICENSE-NOVAURA-TEMPLATE.md';
export const NOTICE_FILE = 'PROTOTYPE-NOTICE.md';
export const LICENSE_ID = 'NovAura-Template-1.0';

export const KINDS = { code: 'Code project', 'game-content': 'Game content', assets: 'Asset pack' };
export const STAGES = ['pre-alpha prototype', 'alpha', 'beta', 'release'];
export const ACCEPT_USES = { personal: 'Learning, personal or non-commercial', commercial: 'Commercial (the royalty applies)' };

// No ZIP64: the archive stays under 4 GiB and 65,535 entries.
export const MAX_FILES = 60000;
export const MAX_TOTAL_BYTES = 3.9e9;

const MANIFEST_CONTEXT = 'NOVA-TEMPLATE-V1\n';
const ACCEPT_CONTEXT = 'NOVA-TEMPLATE-ACCEPT-V1';
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
const ID_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;
const VERSION_RE = /^[0-9A-Za-z.+-]{1,32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const DID_RE = /^did:nova:[0-9a-f]{64}$/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

const enc = (s) => new TextEncoder().encode(s);

export async function sha256Hex(bytes) {
  const data = typeof bytes === 'string' ? enc(bytes) : bytes;
  return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data)));
}

/**
 * A relative path that is safe to create on Windows, macOS and Linux:
 * forward slashes, no `.`/`..`, no drive or device names, no characters
 * Windows forbids, no trailing dots or spaces.
 */
export function isSafeTemplatePath(path) {
  const p = String(path ?? '');
  if (!p || p.length > 400 || p.startsWith('/') || p.includes('\\')) return false;
  return p.split('/').every(seg => seg.length > 0 && seg.length <= 200 && seg !== '.' && seg !== '..'
    // eslint-disable-next-line no-control-regex -- control characters are exactly what a path must not hold
    && !/[<>:"|?*\u0000-\u001f]/.test(seg) && !/[. ]$/.test(seg) && !WINDOWS_RESERVED.test(seg));
}

const str = (v, max) => typeof v === 'string' && v.length <= max;
const list = (v, maxItems = 40, maxLen = 400) => Array.isArray(v) && v.length <= maxItems && v.every(s => str(s, maxLen));

/** Structural checks on a parsed manifest. Returns '' when it is well formed, else the problem. */
export function manifestProblem(m) {
  if (!m || typeof m !== 'object') return 'The manifest is not an object.';
  if (m.format !== BUNDLE_FORMAT) return `Unknown bundle format "${String(m.format).slice(0, 40)}".`;
  if (!ID_RE.test(m.id || '')) return 'The template id is malformed.';
  if (!VERSION_RE.test(m.version || '')) return 'The version is malformed.';
  if (!str(m.title, 120) || !m.title.trim()) return 'The title is missing or too long.';
  if (!str(m.summary ?? '', 1500)) return 'The summary is too long.';
  if (!KINDS[m.kind]) return 'Unknown template kind.';
  if (!STAGES.includes(m.stage)) return 'Unknown stage.';
  for (const k of ['works', 'unfinished', 'notIncluded', 'requirements']) {
    if (!list(m[k] ?? [])) return `The ${k} list is malformed.`;
  }
  if (!str(m.openWith ?? '', 600)) return 'The opening instructions are too long.';
  if (!m.publisher || !str(m.publisher.name, 80) || !HEX64.test(m.publisher.pub || '')) return 'The publisher is malformed.';
  if (m.receiptsTo && !DID_RE.test(m.receiptsTo)) return 'The receipts address is malformed.';
  if (!str(m.createdAt, 40) || !Number.isFinite(Date.parse(m.createdAt))) return 'The creation date is malformed.';

  if (!Array.isArray(m.files) || !m.files.length || m.files.length > MAX_FILES) return 'The file list is missing or too long.';
  const seen = new Set();
  let total = 0;
  for (const f of m.files) {
    if (!f || !isSafeTemplatePath(f.path)) return `Unsafe file path "${String(f?.path).slice(0, 80)}".`;
    if (!Number.isSafeInteger(f.size) || f.size < 0 || !HEX64.test(f.sha256 || '')) return `"${f.path}" has a malformed size or hash.`;
    const key = f.path.toLowerCase(); // Windows and macOS do not tell case apart
    if (seen.has(key)) return `"${f.path}" is listed twice.`;
    seen.add(key);
    total += f.size;
  }
  if (total > MAX_TOTAL_BYTES) return 'The template is too large.';
  for (const f of m.files) {
    const parts = f.path.toLowerCase().split('/');
    for (let i = 1; i < parts.length; i++) {
      if (seen.has(parts.slice(0, i).join('/'))) return `"${f.path}" sits under a file of the same name.`;
    }
  }

  const doc = (d, name) => d && str(d.file, 400) && HEX64.test(d.sha256 || '') && m.files.some(f => f.path === d.file && f.sha256 === d.sha256)
    ? '' : `The ${name} file is missing or does not match the file list.`;
  const L = m.license;
  if (!L || !str(L.id, 60) || !L.royalty) return 'The license is malformed.';
  const r = L.royalty;
  if (!Number.isFinite(r.percent) || r.percent < 0 || r.percent > 100 || !str(r.basis, 80)
    || !Number.isFinite(r.thresholdUsd) || r.thresholdUsd < 0) return 'The royalty terms are malformed.';
  const licenseIssue = doc(L, 'license') || doc(m.notice, 'prototype notice');
  if (licenseIssue) return licenseIssue;

  if (!Array.isArray(m.parts) || m.parts.length > 500) return 'The parts list is malformed.';
  for (const p of m.parts) {
    if (!p || !isSafeTemplatePath(String(p.path || '').replace(/\/$/, '')) || !str(p.license, 60) || !str(p.note ?? '', 400)) return 'A part with its own license is malformed.';
  }
  return '';
}

// ── Signing ─────────────────────────────────────────────────────────────────

/** Sign the manifest's exact text. Returns the signature hex. */
export function signManifestText(manifestText, secretHex) {
  return bytesToHex(ed25519.sign(enc(MANIFEST_CONTEXT + manifestText), hexToBytes(secretHex)));
}

/**
 * Check a bundle's manifest text and signature. { ok, manifest, official,
 * authorityKid } or { ok: false, reason }. File hashes are checked separately
 * (verifyFileHash), since a bundle's files are read one at a time.
 */
export function verifyManifest(manifestText, sigHex, { authorities = {} } = {}) {
  let m;
  try {
    m = JSON.parse(manifestText);
  } catch {
    return { ok: false, reason: 'The manifest is not valid JSON.' };
  }
  const problem = manifestProblem(m);
  if (problem) return { ok: false, reason: problem };
  const sig = String(sigHex || '').trim().toLowerCase();
  let valid = false;
  try {
    valid = HEX128.test(sig) && ed25519.verify(hexToBytes(sig), enc(MANIFEST_CONTEXT + manifestText), hexToBytes(m.publisher.pub));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'The signature does not match: this bundle was changed after it was signed, or was never signed.' };
  const authorityKid = Object.entries(authorities).find(([, a]) => a.status === 'ACTIVE' && a.pubkeyHex === m.publisher.pub)?.[0] || null;
  return { ok: true, manifest: m, official: Boolean(authorityKid), authorityKid };
}

/** True when the bytes are the file the manifest lists. */
export async function verifyFileHash(entry, bytes) {
  return bytes.length === entry.size && (await sha256Hex(bytes)) === entry.sha256;
}

// ── What applies where ──────────────────────────────────────────────────────

/** The part (with its own license) a file belongs to, or null when the template license applies. */
export function partFor(manifest, path) {
  let best = null;
  for (const p of manifest.parts || []) {
    const hit = p.path.endsWith('/') ? path.startsWith(p.path) : path === p.path;
    if (hit && (!best || p.path.length > best.path.length)) best = p;
  }
  return best;
}

const usd = (n) => `$${Number(n).toLocaleString('en-US')}`;

/** "10% of gross revenue from commercial use" (plus the exempt amount, if any). */
export function royaltySummary(license) {
  const r = license?.royalty;
  if (!r || !r.percent) return 'No royalty.';
  const exempt = r.thresholdUsd > 0 ? `, after the first ${usd(r.thresholdUsd)} of gross revenue per product` : '';
  return `${r.percent}% of ${r.basis} from commercial use${exempt}. Free for learning, personal and non-commercial use.`;
}

/** "the 10% royalty on gross revenue from commercial use", for the acceptance checkbox. */
export function royaltyClause(license) {
  const r = license?.royalty;
  if (!r || !r.percent) return 'its terms';
  const exempt = r.thresholdUsd > 0 ? ` above the first ${usd(r.thresholdUsd)} per product` : '';
  return `the ${r.percent}% royalty on ${r.basis} from commercial use${exempt}`;
}

// ── Acceptance records ──────────────────────────────────────────────────────
// Signed by the person installing the template, kept on their PC and sent to
// the publisher (manifest.receiptsTo), so both sides hold the same record.

export function acceptanceSigningString(a) {
  return [ACCEPT_CONTEXT, a.templateId, a.version, a.manifestSha256, a.licenseSha256, a.publisher, a.receiptsTo, a.acceptor, a.use, a.at, a.nonce].join('|');
}

export function acceptanceId(a) {
  return `${a.templateId}@${a.version}:${a.nonce}`;
}

export function signAcceptance({ manifest, manifestSha256, use, now = Date.now() }, secretHex) {
  if (!ACCEPT_USES[use]) throw new Error('Choose how you will use the template.');
  const a = {
    v: 1,
    templateId: manifest.id,
    version: manifest.version,
    title: manifest.title.slice(0, 120),
    manifestSha256,
    licenseSha256: manifest.license.sha256,
    licenseId: manifest.license.id,
    publisher: manifest.publisher.pub,
    receiptsTo: manifest.receiptsTo || '',
    acceptor: bytesToHex(ed25519.getPublicKey(hexToBytes(secretHex))),
    use,
    at: now,
    nonce: randomNonce(),
  };
  a.sig = bytesToHex(ed25519.sign(enc(acceptanceSigningString(a)), hexToBytes(secretHex)));
  return a;
}

/** { ok, acceptance } with only the known fields, or { ok: false, reason }. */
export function verifyAcceptance(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Not an acceptance record.' };
  const a = {
    v: 1,
    templateId: String(raw.templateId || ''),
    version: String(raw.version || ''),
    title: String(raw.title || '').slice(0, 120),
    manifestSha256: String(raw.manifestSha256 || ''),
    licenseSha256: String(raw.licenseSha256 || ''),
    licenseId: String(raw.licenseId || '').slice(0, 60),
    publisher: cleanPubHex(raw.publisher) || '',
    receiptsTo: String(raw.receiptsTo || ''),
    acceptor: cleanPubHex(raw.acceptor) || '',
    use: String(raw.use || ''),
    at: Number(raw.at),
    nonce: String(raw.nonce || ''),
    sig: String(raw.sig || '').toLowerCase(),
  };
  if (raw.v !== 1 || !ID_RE.test(a.templateId) || !VERSION_RE.test(a.version) || !HEX64.test(a.manifestSha256)
    || !HEX64.test(a.licenseSha256) || !a.publisher || !a.acceptor || !ACCEPT_USES[a.use]
    || (a.receiptsTo && !DID_RE.test(a.receiptsTo)) || !/^[0-9a-f]{24}$/.test(a.nonce) || !Number.isFinite(a.at)) {
    return { ok: false, reason: 'The acceptance record is malformed.' };
  }
  if (a.at > now + MAX_CLOCK_SKEW_MS) return { ok: false, reason: 'The acceptance is dated in the future.' };
  let valid = false;
  try {
    valid = HEX128.test(a.sig) && ed25519.verify(hexToBytes(a.sig), enc(acceptanceSigningString(a)), hexToBytes(a.acceptor));
  } catch {
    valid = false;
  }
  return valid ? { ok: true, acceptance: a } : { ok: false, reason: 'The acceptance signature does not match.' };
}

// ── The notice every bundle carries ─────────────────────────────────────────

const bullets = (items, none) => (items?.length ? items.map(s => `- ${s}`).join('\n') : `- ${none}`);

/** PROTOTYPE-NOTICE.md for a template (the builder writes it into the bundle). */
export function renderPrototypeNotice(meta, { royalty, parts = [] }) {
  const stageLine = meta.stage === 'pre-alpha prototype'
    ? `**${meta.title} ${meta.version} is a pre-alpha prototype.** Parts of it work, parts of it don't, and some features are placeholders or unfinished. It has not been security-audited. It is shared as a reference and a starting point to build from, not as a finished product.`
    : `**${meta.title} ${meta.version}** is at the ${meta.stage} stage.`;
  const partLines = parts.length
    ? parts.map(p => `- \`${p.path}\` — ${p.license}${p.note ? `: ${p.note}` : ''}`).join('\n')
    : '- None found.';
  return `# Read this first: ${meta.stage.toUpperCase()}

${stageLine}

${meta.summary || ''}

## What works, as far as we have checked
${bullets(meta.works, 'Not checked yet.')}

## Unfinished or not working
${bullets(meta.unfinished, 'Not listed yet; expect rough edges.')}

## Not included
${bullets(meta.notIncluded, 'Nothing left out on purpose.')}

## You will need
${bullets(meta.requirements, 'Nothing special.')}

## How to open it
${meta.openWith || 'See the project files.'}

## License
${LICENSE_ID} (\`${LICENSE_FILE}\`). ${royaltySummary({ royalty })}

### Parts with their own licenses (the template license and royalty do not apply to them)
${partLines}

Keys, passwords and private files were removed before this bundle was made. Use your own keys wherever a placeholder such as YOUR_API_KEY appears.
`;
}
