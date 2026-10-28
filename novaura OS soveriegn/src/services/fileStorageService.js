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

function normPath(p) {
  return ('/' + (p || '')).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function genId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Local Filesystem Operations ─────────────────────────────────────────────

export async function listFiles(parentPath = '/') {
  const normParent = normPath(parentPath);
  try {
    const all = await db.documents.toArray();
    const items = all.filter(item => {
      const itemParent = normPath(item.parentPath || '/');
      return itemParent === normParent;
    });

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

export async function createFolder(parentPath, name) {
  const normParent = normPath(parentPath);
  const cleanName = (name || 'New Folder').trim();
  const fullPath = normPath(`${normParent}/${cleanName}`);

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
  return folderRecord;
}

export async function saveFile(path, content, mimeType = 'text/plain') {
  const normalized = normPath(path);
  const parts = normalized.split('/').filter(Boolean);
  const name = parts[parts.length - 1] || 'untitled.txt';
  const parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/';

  const existing = await getFileByPath(normalized);
  const size = typeof content === 'string' ? content.length : (content?.byteLength || 0);

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
  return doc;
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
    const all = await db.documents.toArray();
    const prefix = item.path.endsWith('/') ? item.path : item.path + '/';
    const children = all.filter(d => d.path.startsWith(prefix));
    for (const child of children) {
      await db.documents.delete(child.id);
    }
  }

  await db.documents.delete(id);
}

export async function renameItem(id, newName) {
  const item = await db.documents.get(id);
  if (!item) throw new Error('Item not found');

  const oldPath = item.path;
  const parentPath = normPath(item.parentPath || '/');
  const newPath = normPath(`${parentPath}/${newName}`);

  item.name = newName;
  item.path = newPath;
  item.updated_at = new Date().toISOString();
  await db.documents.put(item);

  if (item.type === 'folder') {
    const all = await db.documents.toArray();
    const oldPrefix = oldPath + '/';
    const newPrefix = newPath + '/';
    for (const doc of all) {
      if (doc.path.startsWith(oldPrefix)) {
        doc.path = doc.path.replace(oldPrefix, newPrefix);
        if (doc.parentPath.startsWith(oldPath)) {
          doc.parentPath = doc.parentPath.replace(oldPath, newPath);
        }
        await db.documents.put(doc);
      }
    }
  }

  return item;
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

export function downloadFile(item) {
  const blob = new Blob([item.content || ''], { type: item.mimeType || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.name;
  a.click();
  URL.revokeObjectURL(url);
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
