import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe, ShieldCheck, ArrowLeft, ArrowRight, RotateCw, Plus, X,
  Upload, Download, FileText, FolderOpen, ArrowLeftRight, Check,
  Sparkles, ExternalLink, HardDrive, Cloud, AlertCircle, Copy,
  Layers, Lock, Wifi, WifiOff, FileCode, Image as ImageIcon,
  CheckCircle2, ChevronRight, ChevronLeft, Send, Search, RefreshCw
} from 'lucide-react';
import {
  listFiles, saveFile, uploadFiles, deleteItem,
  downloadFile, exportFilePayload
} from '../../services/fileStorageService.js';
import { db } from '../../database/sovereignDatabase.js';

const PLATFORM_PRESETS = [
  { id: 'home', label: 'Platform Home', url: 'https://novaura.life', desc: 'Main Portal & Cloud Ecosystem' },
  { id: 'creator', label: 'Creator Studio', url: 'https://novaura.life/creator', desc: 'Publish Assets & Content' },
  { id: 'browse', label: 'Ecosystem Directory', url: 'https://novaura.life/browse', desc: 'Explore Decentralized Marketplace' },
  { id: 'webmail', label: 'Webmail Portal', url: 'https://novaura.life/webmail', desc: 'Cloud Webmail Gateway' },
  { id: 'investor', label: 'Investor Portal', url: 'https://novaura.life/investor', desc: 'Company Deck & Roadmap' },
  { id: 'localdev', label: 'Local Host Dev', url: 'http://localhost:5173', desc: 'Local Platform Instance (Port 5173)' },
];

function getExtBadge(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'html', 'css', 'json'].includes(ext)) {
    return { icon: FileCode, color: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30' };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
    return { icon: ImageIcon, color: 'text-amber-400 bg-amber-950/60 border-amber-500/30' };
  }
  return { icon: FileText, color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30' };
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function PlatformBridgeWindow() {
  // Tabs State
  const [tabs, setTabs] = useState([
    {
      id: 'tab-platform-main',
      title: 'Novaura Platform',
      url: 'https://novaura.life',
      active: true,
      loading: false,
    },
    {
      id: 'tab-creator',
      title: 'Creator Studio',
      url: 'https://novaura.life/creator',
      active: false,
      loading: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-platform-main');
  const [urlInput, setUrlInput] = useState('https://novaura.life');

  // Environment Mode: 'live' (cloud connected) or 'private' (air-gapped local node)
  const [environmentMode, setEnvironmentMode] = useState('live');
  const [isBridgeDrawerOpen, setIsBridgeDrawerOpen] = useState(true);

  // Private Cloud Files State (Local Vault)
  const [privateFiles, setPrivateFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Drag-and-Drop Overlay State
  const [isDraggingOverViewport, setIsDraggingOverViewport] = useState(false);
  const dragCounter = useRef(0);

  // Notifications & Staging
  const [toast, setToast] = useState(null);
  const [stagedForPlatform, setStagedForPlatform] = useState(null);

  const iframeRefs = useRef({});
  const fileInputRef = useRef(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Show auto-dismissing toast notifications
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(prev => prev?.msg === msg ? null : prev), 4000);
  }, []);

  // Fetch local private files
  const refreshPrivateFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const allDocs = await listFiles('/');
      setPrivateFiles(allDocs.filter(d => d.type === 'file'));
    } catch (err) {
      console.warn('[PlatformBridge] Error loading private files:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    refreshPrivateFiles();
  }, [refreshPrivateFiles]);

  // Sync address bar input when active tab changes
  useEffect(() => {
    if (activeTab?.url) {
      setUrlInput(activeTab.url);
    }
  }, [activeTabId, activeTab?.url]);

  // Bi-Directional postMessage listener between Iframe and Sovereign OS
  useEffect(() => {
    const handlePlatformMessage = async (event) => {
      // Validate origin if desired, or allow platform communication
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // 1. Platform requests to export a file to Sovereign Private Vault
      if (data.type === 'PLATFORM_EXPORT_FILE' || data.type === 'NOVAURA_FILE_EXPORT') {
        const file = data.file;
        if (file?.name && (file.content || file.dataUrl)) {
          const content = file.content || file.dataUrl;
          await saveFile(`/${file.name}`, content, file.mimeType || 'text/plain');
          await refreshPrivateFiles();
          showToast(`Imported "${file.name}" from Live Platform into Private Vault!`, 'success');
        }
      }

      // 2. Platform requests available private file headers (with user permission handshake)
      if (data.type === 'REQUEST_SOVEREIGN_MANIFEST') {
        const manifest = privateFiles.map(f => ({ name: f.name, size: f.size, type: f.mimeType }));
        event.source?.postMessage({
          type: 'SOVEREIGN_MANIFEST_RESPONSE',
          files: manifest,
        }, event.origin || '*');
      }
    };

    window.addEventListener('message', handlePlatformMessage);
    return () => window.removeEventListener('message', handlePlatformMessage);
  }, [privateFiles, refreshPrivateFiles, showToast]);

  // Tab Management
  const handleSelectTab = (tabId) => {
    setActiveTabId(tabId);
    const target = tabs.find(t => t.id === tabId);
    if (target) setUrlInput(target.url);
  };

  const handleAddTab = (presetUrl = 'https://novaura.life', title = 'New Tab') => {
    const newId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newTab = {
      id: newId,
      title: title || 'New Tab',
      url: presetUrl,
      active: true,
      loading: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setUrlInput(presetUrl);
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation();
    if (tabs.length <= 1) return; // Keep at least 1 tab open
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      const fallback = newTabs[newTabs.length - 1];
      setActiveTabId(fallback.id);
      setUrlInput(fallback.url);
    }
  };

  const handleNavigate = (targetUrl) => {
    if (!targetUrl.trim()) return;
    let finalUrl = targetUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
        finalUrl = 'https://' + finalUrl;
      } else {
        finalUrl = `https://novaura.life/search?q=${encodeURIComponent(finalUrl)}`;
      }
    }
    setUrlInput(finalUrl);
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      url: finalUrl,
      title: finalUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'Live Tab',
    } : t));
  };

  const handleReload = () => {
    const iframe = iframeRefs.current[activeTabId];
    if (iframe) {
      iframe.src = activeTab.url;
    }
  };

  // Drag-and-Drop Ingestion Handlers (from Desktop or Web into Private Vault)
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOverViewport(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDraggingOverViewport(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverViewport(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      try {
        const saved = await uploadFiles(files, '/');
        await refreshPrivateFiles();
        showToast(`Successfully imported ${saved.length} file(s) into Private Vault!`, 'success');
      } catch (err) {
        showToast(`Import error: ${err.message}`, 'error');
      }
      return;
    }

    // Check for plain text or JSON payload dropped
    const jsonPayload = e.dataTransfer.getData('application/json');
    if (jsonPayload) {
      try {
        const parsed = JSON.parse(jsonPayload);
        if (parsed.name && parsed.content) {
          await saveFile(`/${parsed.name}`, parsed.content, parsed.mimeType || 'text/plain');
          await refreshPrivateFiles();
          showToast(`Imported "${parsed.name}" into Private Vault!`, 'success');
          return;
        }
      } catch {}
    }

    const textPayload = e.dataTransfer.getData('text/plain');
    if (textPayload && textPayload.trim()) {
      const filename = `snippet_${Date.now()}.txt`;
      await saveFile(`/${filename}`, textPayload, 'text/plain');
      await refreshPrivateFiles();
      showToast(`Saved text snippet as "${filename}" in Private Vault!`, 'success');
    }
  };

  // Push Local File to Live Platform
  const handlePushFileToPlatform = (file) => {
    setStagedForPlatform(file);
    const iframe = iframeRefs.current[activeTabId];
    if (iframe && iframe.contentWindow) {
      const payload = exportFilePayload(file);
      iframe.contentWindow.postMessage({
        type: 'SOVEREIGN_FILE_TRANSFER',
        file: payload,
      }, '*');
      showToast(`Pushed "${file.name}" to active platform tab!`, 'success');
    } else {
      showToast(`Staged "${file.name}" for platform upload.`, 'info');
    }
  };

  // Filtered Private Files
  const filteredPrivateFiles = privateFiles.filter(f =>
    !searchFilter || f.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div
      className="flex flex-col h-full w-full bg-slate-950 text-slate-100 select-none overflow-hidden relative font-sans"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 1. Top Window Control & Multi-Tab Bar */}
      <div className="h-10 px-2 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 backdrop-blur-xl">
        {/* Left: Tab Strip */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 mr-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x text-xs cursor-pointer transition-all duration-200 select-none min-w-[120px] max-w-[190px] ${
                  isActive
                    ? 'bg-slate-900 border-cyan-500/60 text-cyan-200 shadow-[0_-2px_8px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title={tab.url}
              >
                <Globe
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? 'text-cyan-400 animate-pulse' : 'text-slate-500'
                  }`}
                />
                <span className="truncate flex-1 font-medium text-[11px]">
                  {tab.title}
                </span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(e, tab.id)}
                    className="w-3.5 h-3.5 rounded hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                    title="Close tab"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* New Tab Button */}
          <button
            onClick={() => handleAddTab()}
            className="w-7 h-7 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="Open New Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Environment Mode & File Bridge Drawer Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Environment Mode Switcher */}
          <button
            onClick={() => setEnvironmentMode(prev => prev === 'live' ? 'private' : 'live')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
              environmentMode === 'live'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-amber-950/60 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
            }`}
            title="Click to toggle between Cloud Platform and Air-Gapped Private Node"
          >
            {environmentMode === 'live' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono">LIVE CLOUD</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-mono">AIR-GAPPED PRIVATE</span>
              </>
            )}
          </button>

          {/* Toggle Sovereign File Bridge Drawer */}
          <button
            onClick={() => setIsBridgeDrawerOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
              isBridgeDrawerOpen
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title="Toggle Sovereign File Bridge Drawer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">File Bridge</span>
            {privateFiles.length > 0 && (
              <span className="text-[10px] font-mono font-bold px-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                {privateFiles.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Navigation & URL Address Bar */}
      <div className="h-10 px-3 bg-slate-900/80 border-b border-slate-800/80 flex items-center gap-2 shrink-0 backdrop-blur-md">
        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const iframe = iframeRefs.current[activeTabId];
              if (iframe?.contentWindow?.history) iframe.contentWindow.history.back();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const iframe = iframeRefs.current[activeTabId];
              if (iframe?.contentWindow?.history) iframe.contentWindow.history.forward();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleReload}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Reload Platform"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* URL Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNavigate(urlInput);
          }}
          className="flex-1 relative flex items-center"
        >
          <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter Novaura Platform URL or path..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-24 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>TLS</span>
            </span>
          </div>
        </form>

        {/* Preset Shortcuts Dropdown Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 max-w-[380px]">
          {PLATFORM_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                handleNavigate(p.url);
                setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: p.label, url: p.url } : t));
              }}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer"
              title={p.desc}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Split View: Platform Viewport (Left) + Sovereign Data Bridge (Right) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Platform Viewport Container */}
        <div className="flex-1 h-full bg-slate-950 relative flex flex-col overflow-hidden">
          {environmentMode === 'live' ? (
            tabs.map((tab) => {
              const isCurrent = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  className={`w-full h-full flex flex-col ${isCurrent ? 'flex' : 'hidden'}`}
                >
                  <iframe
                    ref={el => { iframeRefs.current[tab.id] = el; }}
                    src={tab.url}
                    title={tab.title}
                    allow="camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                    className="w-full flex-1 border-none bg-slate-950"
                  />
                </div>
              );
            })
          ) : (
            /* Air-Gapped Private Mode Dashboard */
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-xl shadow-amber-500/10">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Air-Gapped Private Node Active
              </h2>
              <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                Zero network requests are sent outside your local machine. All editors, documents, manuscripts, and databases remain strictly isolated in host memory.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEnvironmentMode('live')}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/25 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Wifi className="w-4 h-4" />
                  <span>Connect to Live Platform (novaura.life)</span>
                </button>
              </div>
            </div>
          )}

          {/* Full Drag-and-Drop Overlay over the Viewport */}
          {isDraggingOverViewport && (
            <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-md border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center gap-3 pointer-events-none animate-in fade-in duration-150">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_30px_rgba(6,182,212,0.5)] animate-bounce">
                <Upload className="w-8 h-8" />
              </div>
              <div className="text-base font-bold text-white">
                Release to Import into Private Vault
              </div>
              <div className="text-xs text-cyan-300 max-w-sm text-center">
                Files dropped here are automatically encrypted and saved into your Sovereign Private Cloud Database.
              </div>
            </div>
          )}
        </div>

        {/* 4. Sovereign File Bridge Drawer (Bi-Directional Transfer Dock) */}
        {isBridgeDrawerOpen && (
          <div className="w-84 h-full bg-slate-950/95 border-l border-slate-800 flex flex-col shrink-0 relative z-30 shadow-2xl backdrop-blur-2xl">
            {/* Drawer Header */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white tracking-wide">
                  SOVEREIGN DATA BRIDGE
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={refreshPrivateFiles}
                  disabled={loadingFiles}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  title="Refresh Private Files"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setIsBridgeDrawerOpen(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Collapse Drawer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Drop Zone: "Import into Private Vault" */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-900/30">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-semibold text-white">
                  Drop files to Import into Private
                </div>
                <div className="text-[9px] text-slate-400">
                  Drag from PC, platform, or click to upload
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    await uploadFiles(e.target.files, '/');
                    await refreshPrivateFiles();
                    showToast(`Imported ${e.target.files.length} file(s) into Private Vault!`, 'success');
                  }
                }}
              />
            </div>

            {/* Search Filter for Private Files */}
            <div className="p-2 border-b border-slate-800/80 bg-slate-950">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5" />
                <input
                  type="text"
                  placeholder="Filter private vault files..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-[11px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500 transition-colors font-sans"
                />
              </div>
            </div>

            {/* Private Files List ("Drag to Platform") */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              <div className="px-1.5 py-1 text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider flex items-center justify-between">
                <span>Private Vault Files</span>
                <span className="text-cyan-400">{filteredPrivateFiles.length}</span>
              </div>

              {filteredPrivateFiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No private files found. Drop documents or code files to populate your private vault.
                </div>
              ) : (
                filteredPrivateFiles.map((file) => {
                  const badge = getExtBadge(file.name);
                  const Icon = badge.icon;
                  return (
                    <div
                      key={file.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify(file));
                        e.dataTransfer.setData('text/plain', file.content || file.name);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className="group p-2 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between gap-2 transition-all cursor-grab active:cursor-grabbing shadow-sm"
                      title="Drag to platform or click push button"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${badge.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-200 truncate group-hover:text-cyan-200">
                            {file.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {formatBytes(file.size)}
                          </div>
                        </div>
                      </div>

                      {/* Push to Live Platform Action */}
                      <button
                        onClick={() => handlePushFileToPlatform(file)}
                        className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 text-[10px] font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                        title="Push into Active Platform Tab"
                      >
                        <Send className="w-2.5 h-2.5" />
                        <span>Push</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer with Vault Metrics */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 text-[11px] text-slate-400 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Vault Encrypted</span>
              </span>
              <span>Local Dexie DB</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Floating Toast Feedback */}
      {toast && (
        <div className={`absolute bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl border shadow-2xl backdrop-blur-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
          toast.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            : toast.type === 'info'
            ? 'bg-blue-950/90 border-blue-500/50 text-blue-200'
            : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-500/20'
        }`}>
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
