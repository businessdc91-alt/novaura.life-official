import { db } from '../../database/sovereignDatabase.js';

/**
 * NovAura Sovereign OS — File System Subsystem
 * Unified Filesystem handling user local files, virtual workspaces,
 * and user-mounted cloud directories (Google Drive, local storage, external drives).
 */

class FileSystem {
  constructor() {
    this._kernel = null;
    this._mountedRoots = new Map(); // name -> DirectoryHandle or virtual root
    this._virtualTree = new Map();  // path -> { content, type, size, modified }
  }

  init(kernel) {
    this._kernel = kernel;

    kernel.ipc.on('fs:read', async ({ path, _requestId }) => {
      try {
        const data = await this.readFile(path);
        kernel.ipc.reply('fs:read', _requestId, { ok: true, data });
      } catch (e) {
        kernel.ipc.reply('fs:read', _requestId, { ok: false, error: e.message });
      }
    });

    kernel.ipc.on('fs:write', async ({ path, content, _requestId }) => {
      try {
        await this.writeFile(path, content);
        kernel.ipc.reply('fs:write', _requestId, { ok: true });
      } catch (e) {
        kernel.ipc.reply('fs:write', _requestId, { ok: false, error: e.message });
      }
    });

    kernel.ipc.on('fs:list', async ({ path, _requestId }) => {
      try {
        const files = await this.listFiles(path);
        kernel.ipc.reply('fs:list', _requestId, { ok: true, files });
      } catch (e) {
        kernel.ipc.reply('fs:list', _requestId, { ok: false, error: e.message });
      }
    });
  }

  /**
   * Mount a local directory from the user's computer via File System Access API.
   */
  async mountLocalDirectory(customName = 'My Documents') {
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        const name = customName || handle.name;
        this._mountedRoots.set(name, handle);
        this._kernel.ipc.emit('fs:mounted', { name, type: 'native_folder' });
        return { success: true, name };
      } catch (err) {
        if (err.name === 'AbortError') return { success: false, cancelled: true };
        throw err;
      }
    }
    return { success: false, reason: 'Directory picker not supported in this environment' };
  }

  /**
   * Write file to virtual or mounted directory.
   */
  async writeFile(path, content) {
    this._virtualTree.set(path, {
      content,
      type: 'file',
      size: typeof content === 'string' ? content.length : (content.byteLength || 0),
      modified: Date.now(),
    });

    // Also persist into workspaces / documents table if relevant
    if (path.startsWith('/documents/') || path.endsWith('.docx') || path.endsWith('.md')) {
      const fileName = path.split('/').pop();
      await db.documents.put({
        id: `file_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: fileName,
        path,
        content,
        wordCount: typeof content === 'string' ? content.trim().split(/\s+/).length : 0,
        updatedAt: new Date().toISOString(),
      });
    }

    this._kernel.ipc.emit('fs:file_changed', { path, action: 'write' });
    return true;
  }

  /**
   * Read file from virtual or database.
   */
  async readFile(path) {
    if (this._virtualTree.has(path)) {
      return this._virtualTree.get(path).content;
    }

    // Try finding in documents table
    let doc = null;
    try {
      doc = await db.documents.where('path').equals(path).first();
    } catch {
      const all = await db.documents.toArray();
      doc = all.find(d => d.path === path);
    }
    if (doc) {
      return doc.content;
    }

    throw new Error(`File not found: ${path}`);
  }

  /**
   * List files in a virtual directory.
   */
  async listFiles(dirPath = '/') {
    const results = [];
    const normalized = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;

    // 1. Virtual tree entries
    for (const [filePath, meta] of this._virtualTree.entries()) {
      if (filePath.startsWith(normalized)) {
        const relative = filePath.slice(normalized.length);
        if (!relative.includes('/')) {
          results.push({ name: relative, path: filePath, ...meta });
        }
      }
    }

    // 2. Database documents
    const dbDocs = await db.documents.toArray();
    for (const d of dbDocs) {
      const p = d.path || `/documents/${d.name}`;
      if (p.startsWith(normalized) && !results.some(r => r.path === p)) {
        results.push({
          name: d.name,
          path: p,
          type: d.type || 'file',
          size: d.content ? d.content.length : 0,
          modified: new Date(d.updatedAt).getTime(),
        });
      }
    }

    // 3. Mounted roots
    if (dirPath === '/') {
      for (const name of this._mountedRoots.keys()) {
        results.push({
          name,
          path: `/${name}`,
          type: 'directory',
          mounted: true,
        });
      }
    }

    return results;
  }

  async deleteFile(path) {
    this._virtualTree.delete(path);
    try {
      await db.documents.where('path').equals(path).delete();
    } catch {
      const all = await db.documents.toArray();
      const match = all.find(d => d.path === path);
      if (match) await db.documents.delete(match.id);
    }
    this._kernel.ipc.emit('fs:file_changed', { path, action: 'delete' });
    return true;
  }
}

export default FileSystem;
