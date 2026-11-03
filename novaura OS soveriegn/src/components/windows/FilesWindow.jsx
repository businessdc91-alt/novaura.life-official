import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen, FileText, FileCode, Image as ImageIcon, Film, Music, File, Archive,
  Upload, FolderPlus, Trash2, Download, RefreshCw, Search, ChevronRight,
  HardDrive, Cloud, MoreVertical, Pencil, X, Check, Loader2, Home, Link2, Unlink,
  FileArchive, PackageOpen, MonitorUp, CornerUpRight
} from 'lucide-react';
import {
  listFiles, uploadFiles, createFolder, deleteItem,
  downloadFile, renameItem, getStorageUsage, saveFile,
  getCloudConnectorStatus, connectGoogleDrive, disconnectGoogleDrive,
  searchGoogleDriveFiles, importGoogleDriveFile,
  zipItem, extractZip, createShortcut, isShortcut, readShortcut, DESKTOP_PATH, contentToBytes
} from '../../services/fileStorageService.js';
import { openShortcutTarget, shortcutTargetFor } from '../../services/desktopActions.js';
import { openWithOptions, defaultOpen, fileKind } from '../../services/openWith.js';

function getFileIcon(name) {
  const ext = (name || '').split('.').pop()?.toLowerCase();
  if (['js','jsx','ts','tsx','py','java','go','rs','c','cpp','json','html','css','sql'].includes(ext)) return FileCode;
  if (['jpg','jpeg','png','gif','svg','webp','avif'].includes(ext)) return ImageIcon;
  if (['mp4','webm','mov','mkv'].includes(ext)) return Film;
  if (['mp3','wav','flac','ogg'].includes(ext)) return Music;
  if (['zip','tar','gz','rar'].includes(ext)) return Archive;
  return FileText;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

const OPEN_WITH_ICONS = { media_deck: Music, literature: FileText, cybeni: FileCode, extract: PackageOpen, download: Download };

// Uploaded images are stored as data: URLs or raw bytes; either can be shown.
function ImagePreview({ doc }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (typeof doc.content === 'string' && doc.content.startsWith('data:image/')) { setUrl(doc.content); return undefined; }
    let made = null;
    let live = true;
    contentToBytes(doc.content).then((bytes) => {
      if (!live) return;
      made = URL.createObjectURL(new Blob([bytes], { type: doc.mimeType || 'image/png' }));
      setUrl(made);
    }).catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [doc.id, doc.content, doc.mimeType]);
  if (!url) return null;
  return <img src={url} alt="" className="mt-4 w-full max-h-48 object-contain rounded border border-slate-800 bg-slate-950" draggable={false} />;
}

export default function FilesWindow({ props: windowProps } = {}) {
  const [currentPath, setCurrentPath] = useState(windowProps?.path || '/');
  const [pendingSelect, setPendingSelect] = useState(windowProps?.select || null);
  const [notice, setNotice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [usage, setUsage] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [dropActive, setDropActive] = useState(false);

  // Cloud connector state
  const [activeTab, setActiveTab] = useState('local'); // 'local' | 'gdrive'
  const [driveStatus, setDriveStatus] = useState({ connected: false });
  const [driveTokenInput, setDriveTokenInput] = useState('');
  const [driveSearch, setDriveSearch] = useState('');
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);

  const fileInputRef = useRef(null);

  const refreshFiles = useCallback(async (path = currentPath) => {
    setLoading(true);
    try {
      const data = await listFiles(path);
      setItems(data);
      const u = await getStorageUsage();
      setUsage(u);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    refreshFiles(currentPath);
    getCloudConnectorStatus('gdrive').then(setDriveStatus);
  }, [currentPath, refreshFiles]);

  // Opened from the desktop (or a shortcut) at a specific folder / file.
  useEffect(() => {
    const onOpenPath = (e) => {
      const { path, select } = e.detail || {};
      if (!path) return;
      setActiveTab('local');
      setCurrentPath(path);
      setPendingSelect(select || null);
    };
    window.addEventListener('novaura:files_open_path', onOpenPath);
    return () => window.removeEventListener('novaura:files_open_path', onOpenPath);
  }, []);

  useEffect(() => {
    if (!pendingSelect) return;
    const hit = items.find(i => i.path === pendingSelect);
    if (hit) {
      setSelectedItem(hit);
      setFilePreview(hit.type === 'file' ? hit : null);
      setPendingSelect(null);
    }
  }, [items, pendingSelect]);

  // Stay current when files change elsewhere (desktop, Cybeni, extraction…).
  useEffect(() => {
    let timer = null;
    const onChange = () => { clearTimeout(timer); timer = setTimeout(() => refreshFiles(), 300); };
    window.addEventListener('novaura:fs_changed', onChange);
    return () => { clearTimeout(timer); window.removeEventListener('novaura:fs_changed', onChange); };
  }, [refreshFiles]);

  const flashNotice = (text, tone = 'ok') => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(n => (n?.text === text ? null : n)), 3500);
  };

  const runAction = async (fn, okText) => {
    try {
      await fn();
      if (okText) flashNotice(okText);
      refreshFiles();
    } catch (err) {
      flashNotice(err?.message || String(err), 'error');
    }
  };

  const handleOpen = (item) => {
    if (item.type === 'folder') handleFolderClick(item);
    else if (isShortcut(item)) {
      const target = readShortcut(item);
      if (target?.kind === 'folder') { setCurrentPath(target.path); setSelectedItem(null); setFilePreview(null); }
      else openShortcutTarget(target);
    } else {
      // Double-click opens the file in the app made for it; anything else is shown in the inspector.
      const action = defaultOpen(item, { inFiles: true });
      if (action) runAction(action.run);
      else handleItemSelect(item);
    }
  };

  const handleFolderClick = (folder) => {
    setCurrentPath(folder.path);
    setSelectedItem(null);
    setFilePreview(null);
  };

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    if (item.type === 'file') {
      setFilePreview(item);
    } else {
      setFilePreview(null);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await createFolder(currentPath, newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
      refreshFiles();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      await uploadFiles(files, currentPath);
      refreshFiles();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this item? This action is permanent.')) {
      await deleteItem(id);
      if (selectedItem?.id === id) {
        setSelectedItem(null);
        setFilePreview(null);
      }
      refreshFiles();
    }
  };

  const handleRenameSubmit = async (id) => {
    if (!renameValue.trim()) return;
    await renameItem(id, renameValue.trim());
    setRenamingId(null);
    refreshFiles();
  };

  // Google Drive user actions
  const handleConnectDrive = async () => {
    if (!driveTokenInput.trim()) return;
    await connectGoogleDrive(driveTokenInput.trim(), 'user@google.com');
    setDriveTokenInput('');
    const status = await getCloudConnectorStatus('gdrive');
    setDriveStatus(status);
  };

  const handleDisconnectDrive = async () => {
    await disconnectGoogleDrive();
    setDriveStatus({ connected: false });
    setDriveFiles([]);
  };

  const handleDriveSearch = async () => {
    setDriveLoading(true);
    try {
      const results = await searchGoogleDriveFiles(driveSearch);
      setDriveFiles(results);
    } catch (err) {
      alert(err.message);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDriveImport = async (file) => {
    try {
      await importGoogleDriveFile(file.id, file.name, currentPath);
      alert(`Imported "${file.name}" to Sovereign local storage.`);
      refreshFiles();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };

  const filteredItems = items.filter(item =>
    (item.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-56 bg-slate-900/60 border-r border-slate-800 flex flex-col p-3 shrink-0">
        <div className="flex items-center gap-2 px-2 py-2 text-cyan-400 font-semibold text-sm mb-4">
          <HardDrive className="w-5 h-5" />
          <span>Storage Explorer</span>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => { setActiveTab('local'); setCurrentPath('/'); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'local' && currentPath === '/'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Root Storage</span>
          </button>

          <button
            onClick={() => setActiveTab('gdrive')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'gdrive'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Cloud className="w-4 h-4 text-blue-400" />
              <span>Google Drive</span>
            </div>
            {driveStatus.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>
        </nav>

        {/* Local Storage Quota Info */}
        <div className="mt-auto pt-4 border-t border-slate-800/80 px-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Local Vault</span>
            <span>{formatBytes(usage?.totalBytes || 0)}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, ((usage?.totalBytes || 0) / (usage?.limitBytes || 1)) * 100)}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {usage?.fileCount || 0} files · {usage?.folderCount || 0} folders
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation & Action Bar */}
        <div className="h-12 px-4 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto py-1">
            <button
              onClick={() => setCurrentPath('/')}
              className="hover:text-cyan-400 flex items-center gap-1"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>root</span>
            </button>
            {pathParts.map((part, index) => {
              const subPath = '/' + pathParts.slice(0, index + 1).join('/');
              return (
                <React.Fragment key={subPath}>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <button
                    onClick={() => setCurrentPath(subPath)}
                    className="hover:text-cyan-400 truncate max-w-[120px]"
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Action buttons & Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 pl-8 pr-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs text-slate-200 transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>New</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 rounded-md text-xs text-white font-medium transition-colors shadow-sm"
              title="Upload Files"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleUpload}
              className="hidden"
            />

            <button
              onClick={() => refreshFiles()}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {notice && (
          <div className={`px-4 py-1.5 text-[11px] border-b ${
            notice.tone === 'error' ? 'bg-rose-950/60 border-rose-500/30 text-rose-200' : 'bg-cyan-950/40 border-cyan-500/20 text-cyan-200'
          }`}>
            {notice.text}
          </div>
        )}

        {/* View Switcher: Local Files vs Google Drive Connector */}
        {activeTab === 'local' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* File List Grid / Table. Files dragged in from Windows are copied into this folder. */}
            <div
              className={`flex-1 overflow-y-auto p-4 ${dropActive ? 'ring-2 ring-inset ring-cyan-500/70 bg-cyan-950/20' : ''}`}
              onDragOver={(e) => {
                const types = [...(e.dataTransfer?.types || [])];
                if (types.includes('Files') && !types.includes('application/x-novaura-doc')) { e.preventDefault(); setDropActive(true); }
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false); }}
              onDrop={(e) => {
                const files = [...(e.dataTransfer?.files || [])].filter(f => f.size > 0 || f.type);
                if (!files.length) return;
                e.preventDefault();
                setDropActive(false);
                runAction(() => uploadFiles(files, currentPath), `Copied ${files.length} ${files.length === 1 ? 'file' : 'files'} here`);
              }}
            >
              {showNewFolder && (
                <form onSubmit={handleCreateFolder} className="mb-4 flex items-center gap-2 p-2 bg-slate-900 border border-cyan-500/50 rounded-lg max-w-sm">
                  <FolderPlus className="w-4 h-4 text-amber-400 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-slate-100 outline-none"
                  />
                  <button type="submit" className="p-1 hover:bg-slate-800 text-cyan-400 rounded">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setShowNewFolder(false)} className="p-1 hover:bg-slate-800 text-slate-400 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {filteredItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                  <FolderOpen className="w-12 h-12 stroke-[1.2] mb-2 text-slate-600" />
                  <p className="text-sm">This folder is empty</p>
                  <p className="text-xs text-slate-600 mt-1">Upload files or create a new folder</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredItems.map(item => {
                    const isFolder = item.type === 'folder';
                    const Icon = isFolder ? FolderOpen : getFileIcon(item.name);
                    const isSelected = selectedItem?.id === item.id;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-novaura-doc', JSON.stringify({
                            id: item.id, path: item.path, name: item.name, type: item.type, parentPath: item.parentPath || '/',
                          }));
                          e.dataTransfer.effectAllowed = 'copyLink';
                        }}
                        onClick={() => handleItemSelect(item)}
                        onDoubleClick={() => handleOpen(item)}
                        className={`group relative flex flex-col items-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30'
                            : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                        }`}
                      >
                        <div className="relative w-12 h-12 flex items-center justify-center mb-2">
                          <Icon className={`w-8 h-8 ${isFolder ? 'text-amber-400 fill-amber-400/20' : 'text-cyan-400'}`} />
                          {isShortcut(item) && (
                            <CornerUpRight className="absolute bottom-0 left-0 w-3.5 h-3.5 p-0.5 rounded bg-slate-950 border border-slate-600 text-slate-200" />
                          )}
                        </div>

                        {renamingId === item.id ? (
                          <div className="w-full flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              autoFocus
                              className="w-full bg-slate-800 text-xs text-white px-1 py-0.5 rounded border border-cyan-500 outline-none"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameSubmit(item.id);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                            />
                            <button onClick={() => handleRenameSubmit(item.id)} className="text-cyan-400 p-0.5">
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-200 font-medium truncate w-full px-1" title={item.name}>
                            {item.name}
                          </span>
                        )}

                        <span className="text-[10px] text-slate-500 mt-1">
                          {isFolder ? 'Folder' : formatBytes(item.size)}
                        </span>

                        {/* Quick Action Overlay */}
                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/90 rounded-md p-1 border border-slate-700/80">
                          {!isShortcut(item) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); runAction(() => downloadFile(item)); }}
                              className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
                              title={isFolder ? 'Download as .zip' : 'Download'}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                          {/\.zip$/i.test(item.name) && !isFolder ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); runAction(() => extractZip(item.id), 'Extracted into a new folder'); }}
                              className="p-1 hover:text-violet-300 text-slate-400 transition-colors"
                              title="Extract here"
                            >
                              <PackageOpen className="w-3 h-3" />
                            </button>
                          ) : !isShortcut(item) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); runAction(() => zipItem(item.id), 'Compressed to .zip'); }}
                              className="p-1 hover:text-violet-300 text-slate-400 transition-colors"
                              title="Compress to .zip"
                            >
                              <FileArchive className="w-3 h-3" />
                            </button>
                          )}
                          {currentPath !== DESKTOP_PATH && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runAction(() => createShortcut(DESKTOP_PATH, item.name, isShortcut(item) ? readShortcut(item) : shortcutTargetFor(item)), `${item.name} added to the desktop`);
                              }}
                              className="p-1 hover:text-emerald-300 text-slate-400 transition-colors"
                              title="Add to desktop"
                            >
                              <MonitorUp className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(item.id);
                              setRenameValue(item.name);
                            }}
                            className="p-1 hover:text-amber-400 text-slate-400 transition-colors"
                            title="Rename"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="p-1 hover:text-red-400 text-slate-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: File Inspector. It stays in place when nothing is selected, so the
                first click of a double-click never reflows the grid under the second. */}
            <div className="w-72 bg-slate-900/50 border-l border-slate-800 p-4 flex flex-col shrink-0">
              {filePreview ? (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-semibold text-slate-300">File Inspector</span>
                    <button onClick={() => setFilePreview(null)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="my-4 text-center">
                    <div className="w-16 h-16 mx-auto bg-slate-800/80 rounded-xl flex items-center justify-center mb-2 border border-slate-700">
                      {React.createElement(getFileIcon(filePreview.name), { className: "w-8 h-8 text-cyan-400" })}
                    </div>
                    <h4 className="text-xs font-medium text-slate-100 truncate px-2">{filePreview.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{formatBytes(filePreview.size)}</p>
                  </div>

                  <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
                    <div className="flex justify-between text-slate-400">
                      <span>Path</span>
                      <span className="text-slate-200 truncate max-w-[140px]">{filePreview.path}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Type</span>
                      <span className="text-slate-200">{filePreview.mimeType || 'text/plain'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Updated</span>
                      <span className="text-slate-200">{new Date(filePreview.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {fileKind(filePreview) === 'image' && <ImagePreview doc={filePreview} />}

                  {/* Content preview for text (binary uploads are stored as data: URLs) */}
                  {typeof filePreview.content === 'string' && !filePreview.content.startsWith('data:') && (
                    <div className="mt-4 flex-1 flex flex-col overflow-hidden">
                      <span className="text-[11px] text-slate-400 mb-1">Preview</span>
                      <div className="flex-1 bg-slate-950 p-2 rounded border border-slate-800 overflow-y-auto font-mono text-[11px] text-slate-300">
                        {filePreview.content.slice(0, 1500)}
                        {filePreview.content.length > 1500 && '... [truncated]'}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-1.5">
                    {openWithOptions(filePreview, { inFiles: true }).map((opt, i) => (
                      <button
                        key={opt.id}
                        onClick={() => runAction(opt.run, opt.id === 'extract' ? 'Extracted into a new folder' : null)}
                        className={`w-full flex items-center justify-center gap-2 py-2 border rounded-lg text-xs font-medium transition-colors ${i === 0 && opt.id !== 'download'
                          ? 'bg-cyan-700 hover:bg-cyan-600 border-cyan-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'}`}
                      >
                        {React.createElement(opt.id === 'media_deck' && fileKind(filePreview) === 'video' ? Film : OPEN_WITH_ICONS[opt.id] || FolderOpen, { className: 'w-3.5 h-3.5' })}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 text-xs px-4">
                  <File className="w-8 h-8 mb-2 text-slate-600" />
                  Select a file to see its details and the apps that can open it.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Google Drive On-Demand Connector Tab */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Cloud className="w-6 h-6 text-blue-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Google Drive On-Demand Connector</h3>
                    <p className="text-xs text-slate-400">
                      Connect your Google Drive strictly when you need to search or import files. Zero background overhead.
                    </p>
                  </div>
                </div>

                {driveStatus.connected ? (
                  <div className="mt-4 flex items-center justify-between p-3 bg-blue-950/30 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-blue-300">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Connected as <strong>{driveStatus.account || 'Google User'}</strong></span>
                    </div>
                    <button
                      onClick={handleDisconnectDrive}
                      className="flex items-center gap-1.5 px-3 py-1 bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs rounded-md transition-colors"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-slate-400">
                      Enter your Google OAuth access token to query your Drive files directly:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Google Drive OAuth access token..."
                        value={driveTokenInput}
                        onChange={(e) => setDriveTokenInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-xs text-slate-200 outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={handleConnectDrive}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Connect</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {driveStatus.connected && (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search files in your Google Drive..."
                      value={driveSearch}
                      onChange={(e) => setDriveSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDriveSearch()}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleDriveSearch}
                      disabled={driveLoading}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
                    >
                      {driveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Search</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {driveFiles.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="text-xs text-slate-200 font-medium truncate">{file.name}</span>
                        </div>
                        <button
                          onClick={() => handleDriveImport(file)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 rounded border border-slate-700 transition-colors shrink-0"
                        >
                          <Download className="w-3 h-3" />
                          <span>Import to Sovereign</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
