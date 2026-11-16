// projectFiles.js — Opening files into the studio and saving projects to Sovereign's Files.
//
// Open takes a .novaart project (fully editable), a PSD (with its layers), or an image.
// Save writes the project to /Creative Studio/<name>.novaart the first time and over
// that file afterwards. Download hands a copy to the PC.

import { packProject, unpackProject } from './novaart.js';
import { openImageFile, documentFromImage, scaledNotice } from './raster.js';

const PROJECT_MIME = 'application/x-novaart';
const fileService = () => import('../../services/fileStorageService.js');

export const kindOfFile = name => (/\.novaart$/i.test(name) ? 'project' : /\.psd$/i.test(name) ? 'psd' : 'image');
const safeName = name => String(name || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled';

/** Open a file's bytes as a new document tab. savedPath: where a .novaart came from in Files. */
export async function openFileBlob(store, blob, name, { savedPath = null } = {}) {
  const kind = kindOfFile(name);
  if (kind === 'project') return store.openDocument(await unpackProject(blob), { savedPath });
  if (kind === 'psd') {
    const { openPsdBlob } = await import('./psdOpen.js');
    return openPsdBlob(store, blob, name);
  }
  const opened = await openImageFile(blob, name);
  const session = store.openDocument(documentFromImage(opened, name));
  const note = scaledNotice(opened);
  if (note) store.notify(note);
  return session;
}

/** Save the project into Files; returns its path. */
export async function saveProject(store, session, { files } = {}) {
  const fs = files || await fileService();
  const version = session.doc.version;
  const blob = await packProject(session.doc);
  const path = session.savedPath || await fs.uniqueChildPath('/Creative Studio', `${safeName(session.doc.name)}.novaart`);
  await fs.saveFile(path, blob, PROJECT_MIME);
  session.savedPath = path;
  session.savedVersion = version;
  store.bump();
  return path;
}

/** Download the project file to the PC. */
export async function downloadProject(session, { files } = {}) {
  const fs = files || await fileService();
  fs.triggerDownload(`${safeName(session.doc.name)}.novaart`, await packProject(session.doc));
}

/** Open a file from Sovereign's Files (the "Edit in Creative Studio" handoff). */
export async function openVaultFile(store, fileId) {
  const [{ db }, fs] = await Promise.all([import('../../database/sovereignDatabase.js'), fileService()]);
  const record = await db.documents.get(fileId);
  if (!record) throw new Error('That file is no longer in Files.');
  const bytes = await fs.contentToBytes(record.content);
  const savedPath = kindOfFile(record.name) === 'project' ? record.path : null;
  return openFileBlob(store, new Blob([bytes]), record.name, { savedPath });
}
