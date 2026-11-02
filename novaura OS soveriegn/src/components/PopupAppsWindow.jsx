// PopupAppsWindow.jsx — Sovereign OS Bottom Popup Apps Studio
// Provides both a fast running/pinned dock and an expandable categorized apps grid with search and intent chips.

import React, { useState, useEffect, useMemo } from 'react';
import {
  Code2, FolderOpen, Terminal as TerminalIcon, Globe, Hammer,
  BookOpen, PhoneCall, Mail, Users, Bot, ShieldCheck,
  Palette, Settings, Layers, CreditCard, FileText, Network, HardDrive,
  Cpu, Flame, GitBranch, KeyRound, GitPullRequest, Sparkles,
  TrendingUp, Music, ShoppingBag, Gamepad2, Search, X, Grid,
  Maximize2, Minimize2, Check, ExternalLink
} from 'lucide-react';
import { APP_REGISTRY, APP_MAP } from '../config/appRegistry.js';

// Master apps available in toolbar dock
const TOOLBAR_APP_DEFS = {
  onboarding_guide: { id: 'onboarding_guide', label: 'Guide & Legal', icon: Sparkles, color: '#818cf8', category: 'system' },
  cybeni:          { id: 'cybeni',          label: 'Cybeni',       icon: Code2,        color: '#c084fc', category: 'engineering' },
  marketplace:     { id: 'marketplace',     label: 'Marketplace',  icon: ShoppingBag,  color: '#f59e0b', category: 'creator' },
  crypto_pulse:    { id: 'crypto_pulse',    label: 'CryptoPulse',  icon: TrendingUp,   color: '#10b981', category: 'finance' },
  media_deck:      { id: 'media_deck',      label: 'Media Deck',   icon: Music,        color: '#ec4899', category: 'media' },
  creative_studio: { id: 'creative_studio', label: 'Creative',     icon: Palette,      color: '#f43f5e', category: 'creator' },
  retro_arcade:    { id: 'retro_arcade',    label: 'Arcade',       icon: Gamepad2,     color: '#a855f7', category: 'games' },
  developer_gateway: { id: 'developer_gateway', label: 'Dev Gateway', icon: KeyRound,  color: '#06b6d4', category: 'engineering' },
  nova_hub:        { id: 'nova_hub',        label: 'Nova Hub',     icon: GitPullRequest, color: '#a855f7', category: 'engineering' },
  hypervisor:      { id: 'hypervisor',      label: 'Hypervisor',   icon: Cpu,          color: '#a855f7', category: 'engineering' },
  chain_weaver:    { id: 'chain_weaver',    label: 'Weaver',       icon: GitBranch,    color: '#c084fc', category: 'engineering' },
  media_foundry:   { id: 'media_foundry',   label: 'Media Foundry',icon: Flame,        color: '#f59e0b', category: 'creator' },
  files:           { id: 'files',           label: 'Files',        icon: FolderOpen,   color: '#38bdf8', category: 'system' },
  disk_architect:  { id: 'disk_architect',  label: 'Disks',        icon: HardDrive,    color: '#10b981', category: 'system' },
  terminal:        { id: 'terminal',        label: 'Terminal',     icon: TerminalIcon, color: '#34d399', category: 'engineering' },
  browser:         { id: 'browser',         label: 'Browser',      icon: Globe,        color: '#60a5fa', category: 'engineering' },
  platform_bridge: { id: 'platform_bridge', label: 'Bridge',       icon: Network,      color: '#38bdf8', category: 'engineering' },
  website_builder: { id: 'website_builder', label: 'Builder',      icon: Hammer,       color: '#06b6d4', category: 'engineering' },
  literature:      { id: 'literature',      label: 'Word Studio',  icon: BookOpen,     color: '#38bdf8', category: 'creator' },
  novaphone:       { id: 'novaphone',       label: 'NovaPhone',    icon: PhoneCall,    color: '#10b981', category: 'mesh' },
  novamail:        { id: 'novamail',        label: 'NovaMail',     icon: Mail,         color: '#7dd3fc', category: 'mesh' },
  novasocial:      { id: 'novasocial',      label: 'Social',       icon: Users,        color: '#a78bfa', category: 'mesh' },
  ailounge:        { id: 'ailounge',        label: 'AI Lounge',    icon: Bot,          color: '#34d399', category: 'mesh' },
  sentinel:        { id: 'sentinel',        label: 'Sentinel',     icon: ShieldCheck,  color: '#10b981', category: 'system' },
  credential_enclave: { id: 'credential_enclave', label: 'Enclave', icon: KeyRound,    color: '#10b981', category: 'system' },
  card_forge:      { id: 'card_forge',      label: 'TCG Forge',    icon: Layers,       color: '#f97316', category: 'creator' },
  card_creator:    { id: 'card_creator',    label: 'Biz Card',     icon: CreditCard,   color: '#f59e0b', category: 'creator' },
  resume_builder:  { id: 'resume_builder',  label: 'Resume',       icon: FileText,     color: '#10b981', category: 'creator' },
  personalization: { id: 'personalization', label: 'Themes',       icon: Palette,      color: '#ec4899', category: 'system' },
  encyclopedia:    { id: 'encyclopedia',    label: 'Codex',        icon: BookOpen,     color: '#06b6d4', category: 'creator' },
  settings:        { id: 'settings',        label: 'Settings',     icon: Settings,     color: '#94a3b8', category: 'system' },
};

const DEFAULT_TOOLBAR_APPS = [
  'cybeni',
  'literature',
  'media_foundry',
  'chain_weaver',
  'files',
  'terminal',
  'browser',
  'platform_bridge',
  'novaphone',
  'novamail',
  'credential_enclave',
  'hypervisor',
  'nova_hub',
  'marketplace',
  'settings'
];

const CATEGORIES = [
  { id: 'all', label: 'All Apps' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'creator', label: 'Creator Studio' },
  { id: 'mesh', label: 'Mesh & Comms' },
  { id: 'system', label: 'System & Security' },
];

export default function PopupAppsWindow({ onOpenWindow, openWindows = [], onClose }) {
  const [activeApps, setActiveApps] = useState(DEFAULT_TOOLBAR_APPS);
  const [viewMode, setViewMode] = useState('dock'); // 'dock' | 'grid'
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('novaura-taskbar-apps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setActiveApps(parsed);
      }
    } catch {}

    const onStorage = (e) => {
      if (e.key === 'novaura-taskbar-apps' && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated) && updated.length > 0) setActiveApps(updated);
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    const onCustom = (e) => {
      if (Array.isArray(e.detail) && e.detail.length > 0) setActiveApps(e.detail);
    };
    window.addEventListener('novaura-taskbar-update', onCustom);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('novaura-taskbar-update', onCustom);
    };
  }, []);

  // Combine pinned tools and any dynamically open windows
  const openAppIds = openWindows.map(w => w.type || w.appType).filter(Boolean);
  const combinedAppIds = Array.from(new Set([...activeApps, ...openAppIds]));

  const visibleTools = combinedAppIds
    .map(id => TOOLBAR_APP_DEFS[id] || (APP_MAP.get(id) ? {
      id,
      label: APP_MAP.get(id).label,
      icon: APP_MAP.get(id).icon,
      color: APP_MAP.get(id).color || 'var(--primary)',
      category: 'other'
    } : null))
    .filter(Boolean);

  // Filtered apps for grid mode
  const filteredGridApps = useMemo(() => {
    return APP_REGISTRY.filter(app => {
      const matchesCategory = activeCategory === 'all' || app.category === activeCategory;
      const matchesSearch = !search.trim() ||
        app.label.toLowerCase().includes(search.toLowerCase()) ||
        (app.title && app.title.toLowerCase().includes(search.toLowerCase())) ||
        (app.description && app.description.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  return (
    <div className="rgb-border rounded-2xl shadow-2xl backdrop-blur-2xl transition-all duration-300">
      <div className="rgb-flow-layer" />
      <div className="relative z-10 bg-black/92 rounded-2xl border border-white/10 flex flex-col overflow-hidden max-w-4xl mx-auto shadow-2xl">
        
        {/* Top Header Controls */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Sovereign Apps Dock
            </span>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
              <button
                onClick={() => setViewMode('dock')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  viewMode === 'dock' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-white/40 hover:text-white'
                }`}
              >
                Dock
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                  viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-white/40 hover:text-white'
                }`}
              >
                <Grid size={11} /> All Apps
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick intent count */}
            <span className="text-[9px] text-white/40 font-mono">
              {openWindows.length} Active {openWindows.length === 1 ? 'Window' : 'Windows'}
            </span>

            {onClose && (
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
                title="Close apps popup"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ── MODE 1: DOCK MODE (Horizontal Icon Strip) ── */}
        {viewMode === 'dock' ? (
          <div className="flex items-center gap-1 p-2 overflow-x-auto scrollbar-thin max-w-full">
            {visibleTools.map((tool, index) => {
              const Icon = tool.icon;
              const delay = `${(index * 0.21).toFixed(2)}s`;
              const matchingWins = openWindows.filter(w => (w.type || w.appType || w.id) === tool.id);
              const isRunning = matchingWins.length > 0;
              const isMinimized = isRunning && matchingWins.every(w => w.state === 'minimized');

              return (
                <button
                  key={tool.id}
                  onClick={() => onOpenWindow(tool.id)}
                  className="group flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl
                             hover:bg-white/10 transition-all duration-200 hover:scale-105 active:scale-95
                             touch-manipulation relative cursor-pointer flex-shrink-0"
                >
                  <Icon
                    size={18}
                    className="rgb-icon-glow transition-all duration-300"
                    style={{
                      color: isMinimized ? '#fbbf24' : isRunning ? tool.color : undefined,
                      animationDelay: delay
                    }}
                  />
                  <span className={`text-[9px] font-medium leading-none truncate max-w-[56px] transition-colors ${
                    isMinimized ? 'text-amber-300 italic' : isRunning ? 'text-cyan-200' : 'text-white/40 group-hover:text-white/90'
                  }`}>
                    {tool.label}
                  </span>

                  {/* Running / Minimized indicator pip */}
                  {isRunning && (
                    <div
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 transition-all ${
                        isMinimized ? 'bg-amber-400' : 'animate-pulse'
                      }`}
                      style={{
                        backgroundColor: isMinimized ? '#fbbf24' : tool.color,
                        boxShadow: isMinimized ? '0 0 8px #f59e0b' : `0 0 6px ${tool.color}`
                      }}
                    />
                  )}

                  {/* Tooltip */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/95 border border-white/15 rounded-lg text-[11px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl backdrop-blur-md">
                    {isMinimized ? `Restore ${tool.label}` : isRunning ? `Switch to ${tool.label}` : `Launch ${tool.label}`}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/95 border-r border-b border-white/15 rotate-45" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ── MODE 2: EXPANDED ALL APPS GRID ── */
          <div className="flex flex-col p-3 gap-2.5 max-h-[340px] overflow-hidden">
            {/* Search & Category Pills */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Filter sovereign tools..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
                      activeCategory === cat.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Apps Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 overflow-y-auto pr-1 max-h-[260px] scrollbar-thin">
              {filteredGridApps.map(app => {
                const Icon = app.icon;
                const isRunning = openWindows.some(w => (w.type || w.appType || w.id) === app.id);
                return (
                  <button
                    key={app.id}
                    onClick={() => {
                      onOpenWindow(app.id);
                      if (onClose) onClose();
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/30 transition-all text-center group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 group-hover:text-cyan-400 group-hover:border-cyan-500/40 group-hover:scale-105 transition-all">
                      <Icon size={16} />
                    </div>
                    <span className="text-[10px] font-medium text-white/80 group-hover:text-white truncate max-w-[80px]">
                      {app.label}
                    </span>
                    {isRunning && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00d9ff]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
