/**
 * templateLibrary.js — The Template Library: open a .novatemplate bundle, check
 * it, show what it is and its license, record the user's signed acceptance, and
 * unpack it into Documents\NovauraSovereign\Templates\<id>-<version>.
 *
 * Nothing is written until the signature and every file's SHA-256 check out.
 * The acceptance record goes to the publisher's node (manifest.receiptsTo)
 * over the mesh and is re-sent until that node confirms it. A publisher's node
 * keeps the acceptances it receives: who accepted which template, when, and
 * for what use, which is the start of its royalty ledger.
 */

import { db } from '../../database/sovereignDatabase.js';
import { getLocalIdentity, sendDirectMeshPacket, registerMeshHandler, verifiedSenderDid } from '../sovereignMesh.js';
import { isTauriNative } from '../nativeService.js';
import { TRUSTED_AUTHORITIES } from '../../config/trustedAuthorities.js';
import { listZipEntries, readZipEntry } from '../zipService.js';
import { cleanPubHex } from '../web/novaNames.js';
import {
  MANIFEST_ENTRY, SIGNATURE_ENTRY, FILES_PREFIX, verifyManifest, verifyFileHash, sha256Hex,
  signAcceptance, verifyAcceptance, acceptanceId,
} from './novaTemplates.js';

const RESEND_EVERY_MS = 10 * 60_000;
const RESEND_FOR_MS = 30 * 24 * 3600_000;
const MAX_RECEIVED = 20000;
const MAX_TEXT_ENTRY = 2_000_000;

const emit = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('novaura:templates_changed'));
};

const myPub = () => cleanPubHex(getLocalIdentity()?.publicKey);

function mySecret() {
  const s = String(getLocalIdentity()?.secretKeyHex || '');
  return /^[0-9a-f]{64}$/i.test(s) ? s.toLowerCase() : null;
}

async function readChecked(file, byPath, listed) {
  const entry = byPath.get(FILES_PREFIX + listed.path);
  const bytes = entry ? await readZipEntry(file, entry) : null;
  if (!bytes || !(await verifyFileHash(listed, bytes))) throw new Error(`"${listed.path}" does not match the signed file list; the bundle was changed or is damaged.`);
  return bytes;
}

/**
 * Open and check a bundle (a File or Blob). Returns everything the review
 * screen shows: { file, manifest, manifestSha256, official, licenseText,
 * noticeText, installed } or throws with the reason it cannot be trusted.
 */
export async function openBundle(file) {
  const byPath = new Map();
  for (const e of await listZipEntries(file)) {
    if (byPath.has(e.path)) throw new Error(`The bundle holds "${e.path}" twice.`);
    byPath.set(e.path, e);
  }
  const text = async (p) => {
    const e = byPath.get(p);
    if (!e || e.dir || e.size > MAX_TEXT_ENTRY) throw new Error(`The bundle has no ${p}; it is not a NovAura template.`);
    return new TextDecoder().decode(await readZipEntry(file, e));
  };
  const manifestText = await text(MANIFEST_ENTRY);
  const check = verifyManifest(manifestText, await text(SIGNATURE_ENTRY), { authorities: TRUSTED_AUTHORITIES });
  if (!check.ok) throw new Error(check.reason);
  const m = check.manifest;
  for (const f of m.files) {
    const e = byPath.get(FILES_PREFIX + f.path);
    if (!e || e.dir || e.size !== f.size) throw new Error(`"${f.path}" is missing from the bundle or is the wrong size.`);
  }
  const doc = async (d) => new TextDecoder().decode(await readChecked(file, byPath, m.files.find(f => f.path === d.file)));
  return {
    file,
    byPath,
    manifest: m,
    manifestSha256: await sha256Hex(manifestText),
    official: check.official,
    authorityKid: check.authorityKid,
    licenseText: await doc(m.license),
    noticeText: await doc(m.notice),
    installed: await db.template_installs.where('templateId').equals(m.id).toArray().catch(() => []),
  };
}

/**
 * Accept the license and unpack the template. `use` is 'personal' or
 * 'commercial'. onProgress({ phase: 'checking' | 'writing', done, total }).
 * Returns the install record.
 */
export async function installTemplate(opened, { use, onProgress = () => {} }) {
  if (!isTauriNative()) throw new Error('Installing a template needs the NovAura Sovereign desktop app.');
  const secret = mySecret();
  if (!secret) throw new Error('This PC has no node key yet. Finish setting up your identity, then try again.');
  const { file, byPath, manifest: m } = opened;
  const total = m.files.length;

  // Every file is checked before any is written, so a damaged bundle leaves nothing behind.
  for (let i = 0; i < total; i++) {
    await readChecked(file, byPath, m.files[i]);
    if (i % 25 === 0 || i === total - 1) onProgress({ phase: 'checking', done: i + 1, total });
  }

  const acceptance = signAcceptance({ manifest: m, manifestSha256: opened.manifestSha256, use }, secret);
  const accId = acceptanceId(acceptance);
  await db.template_acceptances.put({
    id: accId, templateId: m.id, direction: 'given', status: acceptance.receiptsTo ? 'sending' : 'kept', at: acceptance.at, sentAt: 0, acceptance,
  });

  const { invoke } = await import('@tauri-apps/api/core');
  // Folder names keep to letters, digits, . _ and - (a version may hold a +).
  const base = `${m.id}-${m.version}`.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80).replace(/\.+$/, '');
  const { folder, path } = await invoke('template_prepare_dir', { base });
  for (let i = 0; i < total; i++) {
    const f = m.files[i];
    const bytes = await readChecked(file, byPath, f);
    await invoke('template_write_file', bytes, { headers: { 'x-template-folder': folder, 'x-template-path': encodeURIComponent(f.path) } });
    if (i % 10 === 0 || i === total - 1) onProgress({ phase: 'writing', done: i + 1, total });
  }

  const { files, ...about } = m;
  const install = {
    id: `${m.id}@${m.version}:${folder}`,
    templateId: m.id,
    version: m.version,
    folder,
    path,
    installedAt: Date.now(),
    acceptanceId: accId,
    use,
    official: opened.official,
    manifestSha256: opened.manifestSha256,
    manifest: about,
    fileCount: files.length,
    totalBytes: files.reduce((n, f) => n + f.size, 0),
    licenseText: opened.licenseText,
    noticeText: opened.noticeText,
  };
  await db.template_installs.put(install);
  if (acceptance.receiptsTo) await sendAcceptance(accId);
  emit();
  return install;
}

export async function listInstalls() {
  return (await db.template_installs.toArray().catch(() => [])).sort((a, b) => b.installedAt - a.installedAt);
}

/** Remove an install from the list. Its folder and files stay where they are. */
export async function forgetInstall(id) {
  await db.template_installs.delete(id);
  emit();
}

export async function openInstallFolder(install) {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('template_open_dir', { folder: install.folder });
}

export async function listAcceptances(direction) {
  return (await db.template_acceptances.where('direction').equals(direction).toArray().catch(() => [])).sort((a, b) => b.at - a.at);
}

/** Received acceptances as CSV, for keeping a royalty ledger outside the app. */
export async function receivedAcceptancesCsv() {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = await listAcceptances('received');
  const head = ['accepted_at', 'template', 'version', 'title', 'use', 'acceptor_key', 'license', 'license_sha256', 'manifest_sha256', 'signature'];
  const lines = rows.map(r => {
    const a = r.acceptance;
    return [new Date(a.at).toISOString(), a.templateId, a.version, a.title, a.use, a.acceptor, a.licenseId, a.licenseSha256, a.manifestSha256, a.sig].map(cell).join(',');
  });
  return [head.join(','), ...lines].join('\r\n');
}

// ── Sending acceptances to the publisher ────────────────────────────────────

async function sendAcceptance(id) {
  const row = await db.template_acceptances.get(id);
  if (!row || row.direction !== 'given' || row.status !== 'sending') return;
  await sendDirectMeshPacket(row.acceptance.receiptsTo, 'MESH_TEMPLATE_ACCEPTANCE', { acceptance: row.acceptance }).catch(() => false);
  await db.template_acceptances.update(id, { sentAt: Date.now() });
}

/** Re-send acceptances the publisher has not confirmed (it may have been offline). */
export async function resendAcceptances() {
  const now = Date.now();
  const waiting = await db.template_acceptances.where('status').equals('sending').toArray().catch(() => []);
  for (const row of waiting) {
    if (now - row.at > RESEND_FOR_MS) {
      await db.template_acceptances.update(row.id, { status: 'unconfirmed' });
      continue;
    }
    if (now - (row.sentAt || 0) >= RESEND_EVERY_MS / 2) await sendAcceptance(row.id);
  }
}

const _acceptRate = new Map();

registerMeshHandler('MESH_TEMPLATE_ACCEPTANCE', async (payload, packet) => {
  const from = verifiedSenderDid(packet);
  const me = myPub();
  if (!from || !me) return;
  const now = Date.now();
  const recent = (_acceptRate.get(from) || []).filter(t => now - t < 3600_000);
  if (recent.length >= 30) return;
  _acceptRate.set(from, [...recent, now]);

  const check = verifyAcceptance(payload?.acceptance, now);
  if (!check.ok) return;
  const a = check.acceptance;
  // Only the person who accepted can send it, and only to the node it names.
  if (from !== `did:nova:${a.acceptor}` || a.receiptsTo !== `did:nova:${me}`) return;
  const id = `rx:${acceptanceId(a)}`;
  if (!(await db.template_acceptances.get(id).catch(() => null))) {
    if ((await db.template_acceptances.where('direction').equals('received').count().catch(() => 0)) >= MAX_RECEIVED) return;
    await db.template_acceptances.put({ id, templateId: a.templateId, direction: 'received', status: 'received', at: a.at, receivedAt: now, acceptance: a });
    emit();
  }
  sendDirectMeshPacket(from, 'MESH_TEMPLATE_RECEIPT', { id: acceptanceId(a) }).catch(() => {});
});

registerMeshHandler('MESH_TEMPLATE_RECEIPT', async (payload, packet) => {
  const from = verifiedSenderDid(packet);
  const id = String(payload?.id || '');
  const row = id && await db.template_acceptances.get(id).catch(() => null);
  if (!from || !row || row.direction !== 'given' || row.status !== 'sending' || row.acceptance.receiptsTo !== from) return;
  await db.template_acceptances.update(id, { status: 'confirmed', confirmedAt: Date.now() });
  emit();
});

if (typeof window !== 'undefined') {
  setTimeout(() => resendAcceptances().catch(() => {}), 20_000);
  setInterval(() => resendAcceptances().catch(() => {}), RESEND_EVERY_MS);
}
