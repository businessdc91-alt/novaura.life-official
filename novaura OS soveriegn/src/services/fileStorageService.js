/**
 * Sovereign OS — File Storage Service
 *
 * 100% local-first filesystem backed by the Sovereign Private Cloud Database (Dexie IndexedDB).
 * All documents, folders, and code files are persisted locally on the user's host PC.
 *
 * Optional cloud connectors (Google Drive, GitHub) connect strictly on explicit user demand
 * with zero background polling or external hosting overhead.
 */

import { db } from '../database/sovereignDatabase.js';
import { ipc } from '../kernel/IPCBus.js';
import { compressZip, readZip, safeEntryPath } from './zipService.js';

/** The vault folder shown on the desktop. */
export const DESKTOP_PATH = '/Desktop';
/** A shortcut file's mimeType; its content is JSON: { kind: 'folder'|'file'|'project', path, slug? }. */
export const SHORTCUT_MIME = 'application/x-novaura-shortcut';

const TEXT_EXT = /\.(js|jsx|mjs|cjs|ts|tsx|json|html?|css|scss|md|txt|sql|py|rs|go|sh|ps1|bat|csv|xml|ya?ml|toml|ini|env|svg|log)$/i;

const MIME_BY_EXT = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', jsx: 'text/javascript',
  json: 'application/json', md: 'text/markdown', txt: 'text/plain', csv: 'text/csv', xml: 'application/xml', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', mp4: 'video/mp4', webm: 'video/webm',
  pdf: 'application/pdf', zip: 'application/zip',
};

function normPath(p) {
  return ('/' + (p || '')).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function genId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parentOf(path) {
  const parts = normPath(path).split('/').filter(Boolean);
  return parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/';
}

function joinPath(parent, name) {
  return normPath(`${normPath(parent)}/${name}`);
}

export function mimeForName(name) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  return MIME_BY_EXT[ext] || (TEXT_EXT.test(name || '') ? 'text/plain' : 'application/octet-stream');
}

// Lets the desktop and open Files windows refresh after any change.
function notifyChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('novaura:fs_changed'));
}

// Writes to the same path are serialized, so two saves racing to create one file
// (or one folder) cannot both see "missing" and insert duplicate records.
const pathLocks = new Map();
async function withPathLock(path, fn) {
  const prev = pathLocks.get(path) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  pathLocks.set(path, tail);
  try {
    return await run;
  } finally {
    if (pathLocks.get(path) === tail) pathLocks.delete(path);
  }
}

// Folder creation for ancestors runs one call at a time for the same reason.
let parentsQueue = Promise.resolve();
function ensureParents(path) {
  const run = parentsQueue.then(() => ensureParentsNow(path));
  parentsQueue = run.catch(() => {});
  return run;
}

/** Create folder records for every missing ancestor of `path` (exclusive), so nested files show up in Files. */
async function ensureParentsNow(path) {
  const parts = normPath(path).split('/').filter(Boolean).slice(0, -1);
  const wanted = parts.map((_, i) => '/' + parts.slice(0, i + 1).join('/'));
  if (!wanted.length) return;
  const existing = new Set((await db.documents.where('path').anyOf(wanted).toArray().catch(() => [])).map(d => d.path));
  const now = new Date().toISOString();
  for (const p of wanted) {
    if (existing.has(p)) continue;
    await db.documents.put({
      id: genId(), parentPath: parentOf(p), path: p, name: p.split('/').pop(), type: 'folder',
      size: 0, updated_at: now, created_at: now, source: 'local',
    });
  }
}

// ─── Local Filesystem Operations ─────────────────────────────────────────────

export async function listFiles(parentPath = '/') {
  const normParent = normPath(parentPath);
  try {
    const candidates = normParent === '/'
      ? await db.documents.toArray()
      : await db.documents.where('path').startsWith(`${normParent}/`).toArray();
    const items = candidates.filter(item => normPath(item.parentPath || '/') === normParent);

    return items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  } catch (err) {
    console.error('[fileStorageService] listFiles error:', err);
    return [];
  }
}

export async function getFileByPath(path) {
  const normalized = normPath(path);
  try {
    return await db.documents.where('path').equals(normalized).first();
  } catch (err) {
    // Defensive fallback in case schema upgrade is mid-flight
    const all = await db.documents.toArray();
    return all.find(item => normPath(item.path) === normalized);
  }
}

/** `name` in `parentPath`, or "name (2)", "name (3)"… if taken. Extensions stay at the end. */
export async function uniqueChildPath(parentPath, name) {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let candidate = joinPath(parentPath, name);
  for (let i = 2; await getFileByPath(candidate); i++) candidate = joinPath(parentPath, `${stem} (${i})${ext}`);
  return candidate;
}

export async function createFolder(parentPath, name) {
  const normParent = normPath(parentPath);
  const cleanName = (name || 'New Folder').trim().replace(/[\\/]/g, '-');
  const fullPath = normPath(`${normParent}/${cleanName}`);

  await ensureParents(fullPath);
  return withPathLock(fullPath, async () => {
    const existing = await getFileByPath(fullPath);
    if (existing) throw new Error('A folder or file with this name already exists.');

    const folderRecord = {
      id: genId(),
      parentPath: normParent,
      path: fullPath,
      name: cleanName,
      type: 'folder',
      size: 0,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      source: 'local',
    };

    await db.documents.put(folderRecord);
    notifyChange();
    return folderRecord;
  });
}

/** Add folder records missing above any stored item (files saved before folders were tracked). */
export async function repairFolderTree() {
  const all = await db.documents.toArray();
  const have = new Set(all.filter(d => d.type === 'folder').map(d => d.path));
  const missing = new Set();
  for (const d of all) {
    for (let p = parentOf(d.path); p !== '/' && !have.has(p); p = parentOf(p)) missing.add(p);
  }
  if (!missing.size) return 0;
  const now = new Date().toISOString();
  await db.documents.bulkPut([...missing].map(p => ({
    id: genId(), parentPath: parentOf(p), path: p, name: p.split('/').pop(), type: 'folder',
    size: 0, updated_at: now, created_at: now, source: 'local',
  })));
  notifyChange();
  return missing.size;
}

/** The desktop folder record, created on first use. */
export async function ensureDesktopFolder() {
  try {
    return (await getFileByPath(DESKTOP_PATH)) || await createFolder('/', DESKTOP_PATH.slice(1));
  } catch {
    return getFileByPath(DESKTOP_PATH); // created by a concurrent caller
  }
}

export async function saveFile(path, content, mimeType = 'text/plain') {
  const normalized = normPath(path);
  const parts = normalized.split('/').filter(Boolean);
  const name = parts[parts.length - 1] || 'untitled.txt';
  const parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/';

  return withPathLock(normalized, async () => {
    const existing = await getFileByPath(normalized);
    if (!existing) await ensureParents(normalized);
    const size = typeof content === 'string' ? content.length : (content?.byteLength ?? content?.size ?? 0);

    const doc = {
      id: existing?.id || genId(),
      parentPath: normPath(parentPath),
      path: normalized,
      name,
      type: 'file',
      content,
      size,
      mimeType,
      updated_at: new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString(),
      source: existing?.source || 'local',
    };

    await db.documents.put(doc);
    notifyChange();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novaura:document_saved', {
        detail: {
          id: doc.id,
          name: doc.name,
          path: doc.path,
          content: typeof content === 'string' ? content : '',
          size,
          timestamp: Date.now(),
          source: 'file_storage',
        },
      }));
    }
    ipc.emit('document:saved', {
      id: doc.id,
      name: doc.name,
      path: doc.path,
      content: typeof content === 'string' ? content : '',
      size,
      timestamp: Date.now(),
      source: 'file_storage',
    });

    return doc;
  });
}

export async function uploadFiles(fileList, destPath = '/') {
  const dest = normPath(destPath);
  const results = [];

  for (const file of fileList) {
    const isText = (file.type && file.type.startsWith('text/')) ||
      (file.name && file.name.match(/\.(js|jsx|ts|tsx|json|html|css|md|txt|sql|py|rs|go|sh|csv|xml|yaml|yml)$/i));
    let content;
    if (isText) {
      try {
        content = await file.text();
      } catch {
        content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    } else {
      content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    const fullPath = normPath(`${dest}/${file.name}`);
    const saved = await saveFile(fullPath, content, file.type || (isText ? 'text/plain' : 'application/octet-stream'));
    results.push(saved);
  }

  return results;
}

export function exportFilePayload(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    name: doc.name,
    path: doc.path,
    type: doc.type,
    mimeType: doc.mimeType || 'text/plain',
    size: doc.size || 0,
    content: doc.content || '',
    updated_at: doc.updated_at || new Date().toISOString(),
  };
}

export async function deleteItem(id) {
  const item = await db.documents.get(id);
  if (!item) return;

  if (item.type === 'folder') {
    // Delete all children recursively
    const children = await db.documents.where('path').startsWith(`${item.path}/`).toArray();
    await db.documents.bulkDelete(children.map(c => c.id));
  }

  await db.documents.delete(id);
  notifyChange();
}

// Re-root `item` (and, for a folder, everything under it) at `newPath`.
async function relocate(item, newPath) {
  const oldPath = item.path;
  const children = item.type === 'folder'
    ? await db.documents.where('path').startsWith(`${oldPath}/`).toArray()
    : [];

  item.name = newPath.split('/').pop();
  item.path = newPath;
  item.parentPath = parentOf(newPath);
  item.updated_at = new Date().toISOString();
  await db.documents.put(item);

  for (const doc of children) {
    doc.path = newPath + doc.path.slice(oldPath.length);
    doc.parentPath = parentOf(doc.path);
    await db.documents.put(doc);
  }
  notifyChange();
  return item;
}

export async function renameItem(id, newName) {
  const item = await db.documents.get(id);
  if (!item) throw new Error('Item not found');
  const cleanName = String(newName || '').trim().replace(/[\\/]/g, '-');
  if (!cleanName) throw new Error('A name is required.');

  const newPath = joinPath(item.parentPath || '/', cleanName);
  if (newPath === item.path) return item;
  if (await getFileByPath(newPath)) throw new Error('A folder or file with this name already exists.');
  return relocate(item, newPath);
}

/** Move a file or folder into `destParentPath`; the name gets " (2)" if taken there. */
export async function moveItem(id, destParentPath) {
  const item = await db.documents.get(id);
  if (!item) throw new Error('Item not found');
  const dest = normPath(destParentPath);
  if (dest === normPath(item.parentPath || '/')) return item;
  if (dest === item.path || dest.startsWith(`${item.path}/`)) throw new Error('A folder cannot be moved inside itself.');
  await ensureParents(joinPath(dest, item.name));
  return relocate(item, await uniqueChildPath(dest, item.name));
}

export async function getStorageUsage() {
  const all = await db.documents.toArray();
  const totalBytes = all.reduce((acc, doc) => acc + (doc.size || 0), 0);
  return {
    totalBytes,
    fileCount: all.filter(d => d.type === 'file').length,
    folderCount: all.filter(d => d.type === 'folder').length,
    limitBytes: 50 * 1024 * 1024 * 1024, // 50 GB local quota reference
  };
}

/** Stored file content (text, data URL, bytes or Blob) → Uint8Array. */
export async function contentToBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (typeof Blob !== 'undefined' && content instanceof Blob) return new Uint8Array(await content.arrayBuffer());
  const text = String(content ?? '');
  const dataUrl = /^data:[^,]*;base64,/.exec(text);
  if (dataUrl) {
    const bin = atob(text.slice(dataUrl[0].length));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(text);
}

/** Save a Blob to the user's Downloads folder. The link outlives the click, or WebView2 drops the download. */
export function triggerDownload(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadFile(item) {
  if (item.type === 'folder') {
    const { name, bytes } = await zipFolderBytes(item);
    triggerDownload(name, new Blob([bytes], { type: 'application/zip' }));
    return;
  }
  triggerDownload(item.name, new Blob([await contentToBytes(item.content)], { type: item.mimeType || 'text/plain' }));
}

// ─── ZIP archives ────────────────────────────────────────────────────────────

async function zipFolderBytes(folder) {
  const docs = await db.documents.where('path').startsWith(`${folder.path}/`).toArray();
  const entries = [{ path: folder.name, dir: true }];
  for (const d of docs.sort((a, b) => a.path.localeCompare(b.path))) {
    const rel = `${folder.name}/${d.path.slice(folder.path.length + 1)}`;
    if (d.type === 'folder') entries.push({ path: rel, dir: true });
    else entries.push({ path: rel, bytes: await contentToBytes(d.content) });
  }
  return { name: `${folder.name}.zip`, bytes: await compressZip(entries) };
}

/** Compress a file or folder into "<name>.zip" next to it. Returns the new zip's record. */
export async function zipItem(id) {
  const item = await db.documents.get(id);
  if (!item) throw new Error('Item not found');
  const { name, bytes } = item.type === 'folder'
    ? await zipFolderBytes(item)
    : { name: `${item.name.replace(/\.[^.]+$/, '') || item.name}.zip`, bytes: await compressZip([{ path: item.name, bytes: await contentToBytes(item.content) }]) };
  return saveFile(await uniqueChildPath(item.parentPath || '/', name), bytes, 'application/zip');
}

/** Extract a .zip into a new folder beside it (named after the archive). Returns that folder's record. */
export async function extractZip(id) {
  const item = await db.documents.get(id);
  if (!item || item.type !== 'file') throw new Error('Archive not found');
  const entries = await readZip(await contentToBytes(item.content));
  const base = item.name.replace(/\.zip$/i, '') || 'archive';
  const target = await uniqueChildPath(item.parentPath || '/', base);
  const folder = await createFolder(parentOf(target), target.split('/').pop());
  for (const e of entries) {
    const rel = safeEntryPath(e.path);
    if (!rel) continue;
    const dest = joinPath(target, rel);
    if (e.dir) {
      if (!(await getFileByPath(dest))) await createFolder(parentOf(dest), dest.split('/').pop());
    } else {
      const content = TEXT_EXT.test(rel) ? new TextDecoder().decode(e.bytes) : e.bytes;
      await saveFile(dest, content, mimeForName(rel));
    }
  }
  return folder;
}

// ─── Shortcuts ───────────────────────────────────────────────────────────────

/** Place a shortcut to `target` ({ kind, path, slug? }) in `destParentPath`, named `label`. */
export async function createShortcut(destParentPath, label, target) {
  const path = await uniqueChildPath(destParentPath, String(label || 'Shortcut').replace(/[\\/]/g, '-'));
  return saveFile(path, JSON.stringify(target), SHORTCUT_MIME);
}

export function isShortcut(item) {
  return item?.type === 'file' && item.mimeType === SHORTCUT_MIME;
}

export function readShortcut(item) {
  try { return isShortcut(item) ? JSON.parse(item.content) : null; } catch { return null; }
}

// ─── Cloud Connectors (Strictly On-Demand / User-Prompted) ───────────────────

export async function getCloudConnectorStatus(provider = 'gdrive') {
  const record = await db.cloud_connectors.get(provider);
  return {
    connected: !!record?.access_token,
    account: record?.account_email || null,
    lastSync: record?.last_sync || null,
  };
}

export async function connectGoogleDrive(accessToken, accountEmail) {
  await db.cloud_connectors.put({
    provider: 'gdrive',
    access_token: accessToken,
    account_email: accountEmail,
    connected_at: new Date().toISOString(),
  });
  return { success: true };
}

export async function disconnectGoogleDrive() {
  await db.cloud_connectors.delete('gdrive');
  return { success: true };
}

export async function searchGoogleDriveFiles(query = '') {
  const conn = await db.cloud_connectors.get('gdrive');
  if (!conn?.access_token) {
    throw new Error('Google Drive is not connected. Prompt OS to connect when you wish to retrieve files.');
  }

  const q = encodeURIComponent(`name contains '${query}' and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,modifiedTime)`, {
    headers: { Authorization: `Bearer ${conn.access_token}` },
  });

  if (!res.ok) {
    throw new Error(`Google Drive search failed (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function importGoogleDriveFile(fileId, fileName, destPath = '/') {
  const conn = await db.cloud_connectors.get('gdrive');
  if (!conn?.access_token) throw new Error('Google Drive not connected.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${conn.access_token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch file contents from Google Drive.');

  const content = await res.text();
  const fullPath = normPath(`${destPath}/${fileName}`);
  return saveFile(fullPath, content);
}
