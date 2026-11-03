// openWith.js — Which apps can open a vault file, and the handoff to each.
// Files and the desktop both use this, so a double-click does the same thing everywhere.

import { openWindow, openCybeniProject, openInFiles, parentOf } from './desktopActions.js';
import { downloadFile, extractZip } from './fileStorageService.js';

const AUDIO = /\.(mp3|wav|ogg|oga|opus|flac|m4a|aac|weba)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v|ogv|mkv)$/i;
const WRITING = /\.(md|markdown|txt|html?)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
const PROJECT_FILE = /^\/projects\/cybeni\/([^/]+)\//;

let openSeq = 0;
// Hand a file to an app: as window props when it opens, and as an event when it is already open.
// openId lets the app ignore the second copy when both arrive.
function handOff(appId, props) {
  const full = { ...props, openId: `${Date.now()}_${++openSeq}` };
  openWindow(appId, full);
  window.dispatchEvent(new CustomEvent('novaura:app_context', { detail: { appId, props: full } }));
}

export const fileKind = (doc) => {
  const name = doc?.name || '';
  const mime = doc?.mimeType || '';
  if (AUDIO.test(name) || mime.startsWith('audio/')) return 'audio';
  if (VIDEO.test(name) || mime.startsWith('video/')) return 'video';
  if (IMAGE.test(name) || mime.startsWith('image/')) return 'image';
  if (WRITING.test(name)) return 'writing';
  if (/\.zip$/i.test(name)) return 'zip';
  return 'other';
};

/**
 * Ways to open a vault file, best first: [{ id, label, run }].
 * `inFiles` leaves out "Show in Files" when already there.
 */
export function openWithOptions(doc, { inFiles = false } = {}) {
  if (!doc || doc.type !== 'file') return [];
  const kind = fileKind(doc);
  const opts = [];
  if (kind === 'audio' || kind === 'video') {
    opts.push({ id: 'media_deck', label: kind === 'audio' ? 'Play in Media Deck' : 'Watch in Media Deck', run: () => handOff('media_deck', { fileId: doc.id }) });
  }
  if (kind === 'writing') {
    opts.push({ id: 'literature', label: 'Open in Literature IDE', run: () => handOff('literature', { importFileId: doc.id }) });
  }
  const project = PROJECT_FILE.exec(doc.path || '');
  if (project) opts.push({ id: 'cybeni', label: 'Open project in Cybeni', run: () => openCybeniProject(project[1]) });
  if (kind === 'zip') opts.push({ id: 'extract', label: 'Extract here', run: () => extractZip(doc.id) });
  if (!inFiles) opts.push({ id: 'files', label: kind === 'image' ? 'View in Files' : 'Show in Files', run: () => openInFiles(doc.parentPath || parentOf(doc.path), doc.path) });
  opts.push({ id: 'download', label: 'Download a copy', run: () => downloadFile(doc) });
  return opts;
}

/** The double-click action, or null when the caller should just show the file. */
export function defaultOpen(doc, { inFiles = false } = {}) {
  const best = openWithOptions(doc, { inFiles })[0];
  return best && best.id !== 'download' && best.id !== 'extract' ? best : null;
}
