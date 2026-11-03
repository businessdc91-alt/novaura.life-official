// novaBackup.js — Encrypted full backups (.novabackup) of this node: the
// identity, keys, files, mail, music and videos, and settings.
//
// The 60-second disk mirror keeps a sealed copy for this Windows user only;
// a .novabackup is what moves a node to a new machine.

import { db, BACKUP_TABLES } from '../../database/sovereignDatabase.js';
import { packArchive, unpackArchive, encryptBackup, decryptBackup, readBackupHeader, BackupError } from './novaBackupFormat.js';

export { BackupError, readBackupHeader };

// On top of the mirror's tables: stored media and the user data too bulky to mirror every minute.
const EXTRA_TABLES = [
  'media_blobs', 'media_library', 'manuscript_versions', 'marketplace_publications',
  'developer_api_keys', 'retro_arcade_stats', 'crypto_predictions', 'cloud_connectors',
];
export const FULL_BACKUP_TABLES = [...new Set([...BACKUP_TABLES, ...EXTRA_TABLES])];

export const MIN_PASSPHRASE = 10;

function readLocalStorage() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) out[k] = localStorage.getItem(k);
    }
  } catch { /* storage blocked */ }
  return out;
}

/** What a backup would hold right now: row counts and stored-file bytes. */
export async function backupSummary() {
  let rows = 0;
  for (const name of FULL_BACKUP_TABLES) rows += await db.table(name).count().catch(() => 0);
  let mediaBytes = 0;
  await db.media_blobs.each(r => { mediaBytes += r.blob?.size || 0; }).catch(() => {});
  return {
    rows,
    mediaBytes,
    tracks: await db.music_tracks.count().catch(() => 0),
    files: await db.documents.where('type').equals('file').count().catch(() => 0),
  };
}

/**
 * Build an encrypted backup. Resolves with { blob, fileName, stats }.
 * onProgress({ stage: 'reading' | 'encrypting', done, total })
 */
export async function createEncryptedBackup(passphrase, { onProgress } = {}) {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE) throw new BackupError('PASSPHRASE', `Use a passphrase of at least ${MIN_PASSPHRASE} characters.`);
  const tables = {};
  const counts = {};
  for (let i = 0; i < FULL_BACKUP_TABLES.length; i++) {
    const name = FULL_BACKUP_TABLES[i];
    onProgress?.({ stage: 'reading', done: i, total: FULL_BACKUP_TABLES.length });
    tables[name] = await db.table(name).toArray().catch(() => []);
    counts[name] = tables[name].length;
  }
  const identity = tables.identities?.find(r => r.id === 'primary_operator') || tables.identities?.[0];
  const archive = packArchive({ tables, localStorage: readLocalStorage(), meta: { app: 'Novaura Sovereign OS' } });
  const blob = await encryptBackup(archive, passphrase, {
    onProgress: (p) => onProgress?.({ stage: 'encrypting', ...p }),
    // Readable before unlocking, so the restore screen can say whose backup it is.
    info: { app: 'Novaura Sovereign OS', node: identity?.handle || null, archiveBytes: archive.size },
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return { blob, fileName: `novaura-backup-${identity?.handle || 'node'}-${stamp}.novabackup`, stats: { counts, bytes: blob.size } };
}

/** Decrypt and unpack a backup without touching the database. */
export async function openEncryptedBackup(file, passphrase, { onProgress } = {}) {
  const { header, plain } = await decryptBackup(file, passphrase, { onProgress });
  const archive = await unpackArchive(plain);
  const counts = Object.fromEntries(Object.entries(archive.tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
  return { header, archive, counts };
}

/**
 * Replace this node's data with an opened backup. Tables the backup holds are
 * cleared and refilled; tables it does not know (made by a newer version) are left alone.
 * The caller reloads the app afterwards so every service reads the restored state.
 * onStage('database' | 'disk') says what it is doing; sealing the disk copy of a large node takes a while.
 */
export async function restoreArchive(archive, { onStage } = {}) {
  const names = Object.keys(archive.tables).filter(n => FULL_BACKUP_TABLES.includes(n) && db.tables.some(t => t.name === n));
  onStage?.('database');
  await db.transaction('rw', names.map(n => db.table(n)), async () => {
    for (const name of names) {
      const rows = archive.tables[name];
      if (!Array.isArray(rows)) continue;
      await db.table(name).clear();
      if (rows.length) await db.table(name).bulkPut(rows);
    }
  });
  try {
    // The identity's cached public copy must describe the restored identity, never this machine's old one.
    localStorage.removeItem('novaura_sovereign_identity');
    for (const [k, v] of Object.entries(archive.localStorage || {})) {
      if (typeof v === 'string') localStorage.setItem(k, v);
    }
  } catch { /* storage full or blocked: the database restore still stands */ }
  // Refresh the sealed disk mirror now, so a crash before the next minute cannot bring back the old data.
  onStage?.('disk');
  await db.mirrorToPhysicalDisk().catch(() => {});
  return { tables: names.length };
}

/** Older plaintext .json backups: merged into the database like before. */
export async function restoreLegacyJson(text) {
  await db.importSnapshot(text);
}
