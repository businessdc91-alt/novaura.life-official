/**
 * NovAura Sovereign OS — Native File Sync Bridge
 * 
 * Bridges local Dexie IndexedDB documents/projects directly to the host machine's
 * physical filesystem (e.g. C:\Users\<Username>\Documents\NovauraSovereign).
 * 
 * Enables developers and writers to edit files using external desktop apps
 * (VS Code, Notepad++, Word, Git CLI) and synchronize changes back into
 * Sovereign OS without cloud telemetry.
 */

import { isTauriNative } from './nativeService.js';
import { db } from '../database/sovereignDatabase.js';

class NativeFileSyncBridge {
  constructor() {
    this._defaultDir = 'Documents/NovauraSovereign';
    this._lastSyncTimestamp = null;
    this._syncStats = {
      exportedCount: 0,
      importedCount: 0,
      lastError: null,
    };
  }

  async getDefaultSyncDirectory() {
    if (isTauriNative()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const dir = await invoke('get_default_sync_directory');
        this._defaultDir = dir;
        return dir;
      } catch (err) {
        console.warn('[FileSyncBridge] get_default_sync_directory note:', err);
      }
    }
    return this._defaultDir;
  }

  /**
   * Export all Dexie documents matching prefix (e.g., /projects/ or /documents/)
   * directly to the host filesystem.
   */
  async syncToDisk(targetDir = null) {
    const allDocs = await db.documents.toArray();
    const exportable = allDocs.filter(d => (d.path || '').startsWith('/projects') || (d.path || '').startsWith('/documents'));

    const payload = exportable.map(d => ({
      path: d.path,
      content: typeof d.content === 'string' ? d.content : JSON.stringify(d.content || ''),
    }));

    if (isTauriNative()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('sync_native_project_files', {
          targetDir: targetDir || null,
          filesJson: JSON.stringify(payload),
        });

        this._lastSyncTimestamp = new Date().toISOString();
        this._syncStats.exportedCount = result.count;
        this._syncStats.lastError = result.errors.length ? result.errors.join('; ') : null;

        return {
          success: result.success,
          count: result.count,
          rootPath: result.root_path,
          errors: result.errors,
          timestamp: this._lastSyncTimestamp,
        };
      } catch (err) {
        this._syncStats.lastError = err.message;
        throw new Error(`Native sync failed: ${err.message}`);
      }
    }

    // Browser Fallback (Emulated Local Sync Storage)
    localStorage.setItem('novaura_native_synced_files', JSON.stringify(payload));
    this._lastSyncTimestamp = new Date().toISOString();
    this._syncStats.exportedCount = payload.length;

    return {
      success: true,
      count: payload.length,
      rootPath: 'Browser Virtual Disk Cache',
      errors: [],
      timestamp: this._lastSyncTimestamp,
    };
  }

  /**
   * Read physical files from the host sync directory and update Dexie store.
   */
  async syncFromDisk(targetDir = null) {
    if (isTauriNative()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const filesJson = await invoke('read_native_project_files', {
          targetDir: targetDir || null,
        });

        const files = JSON.parse(filesJson || '[]');
        let imported = 0;

        for (const f of files) {
          let existing = null;
          try {
            existing = await db.documents.where('path').equals(f.path).first();
          } catch {
            const all = await db.documents.toArray();
            existing = all.find(d => d.path === f.path);
          }
          if (existing) {
            await db.documents.update(existing.id, {
              content: f.content,
              size: f.size,
              updatedAt: new Date().toISOString(),
            });
          } else {
            await db.documents.add({
              path: f.path,
              name: f.path.split('/').pop(),
              content: f.content,
              size: f.size,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          imported++;
        }

        this._lastSyncTimestamp = new Date().toISOString();
        this._syncStats.importedCount = imported;

        return {
          success: true,
          count: imported,
          timestamp: this._lastSyncTimestamp,
        };
      } catch (err) {
        this._syncStats.lastError = err.message;
        throw new Error(`Sync from disk failed: ${err.message}`);
      }
    }

    // Browser Fallback
    const cached = localStorage.getItem('novaura_native_synced_files');
    const files = cached ? JSON.parse(cached) : [];
    return {
      success: true,
      count: files.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Launch Windows File Explorer or native OS folder viewer directly to the sync directory.
   */
  async openFolder(path = null) {
    if (isTauriNative()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke('open_native_sync_folder', { path: path || null });
      } catch (err) {
        console.warn('[FileSyncBridge] open_native_sync_folder note:', err);
      }
    }
    return false;
  }

  getStats() {
    return {
      defaultDir: this._defaultDir,
      lastSyncTimestamp: this._lastSyncTimestamp,
      ...this._syncStats,
    };
  }
}

export const nativeFileSync = new NativeFileSyncBridge();
