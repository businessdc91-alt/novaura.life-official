import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Search, Code2, Globe, Terminal,
  CreditCard, FileText, Layers, BookOpen, PhoneCall, Mail,
  Users, Bot, ShieldCheck, Settings, FolderOpen, Sparkles,
  MonitorCog, Cpu, Zap, Palette, Hammer, HardDrive, Flame,
  GitBranch, KeyRound, GitPullRequest, Store, Wrench
} from 'lucide-react';
import { APP_REGISTRY, getAppById } from '../config/appRegistry.js';
import { SIDEBAR_Z_LEFT, SIDEBAR_Z_DEMOTED } from './desktop/windowLayering.js';

// Sovereign App Categories
const CATEGORIES = [
  {
    id: 'engineering',
    label: 'Engineering & Dev',
    color: 'text-cyan-400',
    apps: [
      { id: 'cybeni', label: 'Cybeni Builder', icon: Code2, desc: 'Omni Architecture IDE' },
      { id: 'nova_hub', label: 'Nova Hub', icon: GitPullRequest, desc: 'Decentralized Git Forge & Repository Vault' },
      { id: 'hypervisor', label: 'Neural Hypervisor', icon: Cpu, desc: 'Local Model Deck & Speedometer' },
      { id: 'chain_weaver', label: 'Chain Logic Weaver', icon: GitBranch, desc: 'Visual Nodal DAG Automation Studio' },
      { id: 'terminal', label: 'Terminal', icon: Terminal, desc: 'Sovereign Command Console' },
      { id: 'browser', label: 'Browser', icon: Globe, desc: 'Decentralized Gateway' },
      { id: 'website_builder', label: 'Website Studio', icon: Hammer, desc: 'Visual Website Canvas' },
    ],
  },
  {
    id: 'creator',
    label: 'Creator Studio',
    color: 'text-amber-400',
    apps: [
      { id: 'commerce_studio', label: 'Commerce Studio', icon: Store, desc: 'AI Dropshipping & Storefronts' },
      { id: 'media_foundry', label: 'Media Foundry', icon: Flame, desc: 'ComfyUI Forge & Visual Lab' },
      { id: 'literature', label: 'Word Studio', icon: BookOpen, desc: 'Literature IDE & Ghostwriter' },
      { id: 'card_forge', label: 'Card Forge', icon: Layers, desc: 'TCG Deck Studio' },
      { id: 'card_creator', label: 'Biz Cards', icon: CreditCard, desc: '3D Card Architect' },
      { id: 'resume_builder', label: 'Resume', icon: FileText, desc: 'Executive Resume Studio' },
    ],
  },
  {
    id: 'mesh',
    label: 'Mesh & Comms',
    color: 'text-emerald-400',
    apps: [
      { id: 'novaphone', label: 'NovaPhone', icon: PhoneCall, desc: 'Sovereign Telecom & P2P Video' },
      { id: 'novamail', label: 'NovaMail', icon: Mail, desc: 'Encrypted P2P Mailbox' },
      { id: 'novasocial', label: 'NovaSocial', icon: Users, desc: 'Sovereign Feed & Stories' },
      { id: 'ailounge', label: 'AI Lounge', icon: Bot, desc: 'AI rooms & shared inference' },
    ],
  },
  {
    id: 'system',
    label: 'System & Security',
    color: 'text-purple-400',
    apps: [
      { id: 'onboarding_guide', label: 'Guide & Legal', icon: Sparkles, desc: 'Dual Neural Core, File Bridge & Legal Covenant' },
      { id: 'disk_architect', label: 'Disk Architect', icon: HardDrive, desc: 'AI Storage Cleaner & Boot Manager' },
      { id: 'credential_enclave', label: 'Credential Enclave', icon: KeyRound, desc: 'Hardware-Bound Zero-Knowledge Vault & 2FA' },
      { id: 'files', label: 'Storage', icon: FolderOpen, desc: 'Files Explorer & Vault' },
      { id: 'sentinel', label: 'Sentinel', icon: ShieldCheck, desc: 'Hardware Identity Governance' },
      { id: 'sovereign_repair', label: 'Auto-Repair', icon: Wrench, desc: 'Pop-Out Self-Healing & Main Distro Proposals' },
      { id: 'personalization', label: 'Themes & Visuals', icon: Palette, desc: 'Themes, Fonts & Engine' },
      { id: 'settings', label: 'Settings', icon: Settings, desc: 'Node Diagnostics & Keys' },
    ],
  },
];

// Pinned rail apps shown in collapsed mode
const PINNED_RAIL_APPS = [
  { id: 'cybeni', label: 'Cybeni', icon: Code2 },
  { id: 'nova_hub', label: 'Hub', icon: GitPullRequest },
  { id: 'hypervisor', label: 'Neural', icon: Cpu },
  { id: 'chain_weaver', label: 'Weaver', icon: GitBranch },
  { id: 'media_foundry', label: 'Foundry', icon: Flame },
  { id: 'credential_enclave', label: 'Enclave', icon: KeyRound },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'literature', label: 'Word Studio', icon: BookOpen },
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'novaphone', label: 'Phone', icon: PhoneCall },
  { id: 'personalization', label: 'Themes', icon: Palette },
];

function RailDropButton({ icon: Icon, label, isOpen, onToggle, onOpen }) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-label={label}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-all group cursor-pointer"
        style={{
          background: isOpen ? 'rgba(57,255,20,0.1)' : 'transparent',
          boxShadow: isOpen ? '0 0 10px rgba(57,255,20,0.2)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = 'transparent';
        }}
      >
        <Icon
          className="w-4 h-4 transition-all duration-200"
          style={{
            color: isOpen ? '#39ff14' : 'rgba(255,255,255,0.45)',
            filter: isOpen ? 'drop-shadow(0 0 8px #39ff14)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (!isOpen) {
              e.currentTarget.style.color = '#39ff14';
              e.currentTarget.style.filter = 'drop-shadow(0 0 6px #39ff14)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
              e.currentTarget.style.filter = 'none';
            }
          }}
        />
      </button>

      {/* Flyout Quick Actions Menu */}
      {isOpen && (
        <div
          className="absolute left-full ml-2.5 top-0 z-[950] min-w-[160px] overflow-hidden"
          style={{
            background: 'rgba(5, 5, 10, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(57,255,20,0.25)',
            borderRadius: '12px',
            boxShadow: '0 0 20px rgba(57,255,20,0.15), 0 8px 32px rgba(0,0,0,0.7)',
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.08]">
            <Icon className="w-3.5 h-3.5" style={{ color: '#39ff14', filter: 'drop-shadow(0 0 4px #39ff14)' }} />
            <span className="text-[12px] text-white/90 font-semibold">{label}</span>
          </div>
          <div className="p-1.5">
            <button
              onClick={onOpen}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.08] transition-colors text-left group cursor-pointer"
            >
              <div
                className="w-1.5 h-1.5 rounded-full bg-[#39ff14]/70 group-hover:bg-[#39ff14]"
                style={{ boxShadow: '0 0 4px #39ff14' }}
              />
              <span className="text-[11px] text-white/70 group-hover:text-white">Open Application</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SovereignLeftSidebar({ openApp, openWindows = [], demoted = false }) {
  // Drop beneath the window layer while a window is maximized so the menu never
  // overlaps the window's wording; ride on top otherwise.
  const zIndex = demoted ? SIDEBAR_Z_DEMOTED : SIDEBAR_Z_LEFT;
  const [collapsed, setCollapsed] = useState(true);
  const [time, setTime] = useState(new Date());
  const [search, setSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.map(cat => ({
      ...cat,
      apps: cat.apps.filter(a =>
        a.label.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      )
    })).filter(cat => cat.apps.length > 0);
  }, [search]);

  // Collapsed vertical icon rail (mirroring WebOS)
  if (collapsed) {
    return (
      <>
        {openDropdown && (
          <div className="fixed inset-0 z-[7450]" onClick={() => setOpenDropdown(null)} />
        )}
        <div style={{ zIndex }} className="fixed left-0 top-1/2 -translate-y-1/2 pointer-events-auto select-none">
          <div className="flex flex-col items-center gap-1.5 py-3 px-1.5 bg-black/70 backdrop-blur-md border border-white/[0.08] border-l-0 rounded-r-2xl shadow-2xl">
            {/* Expand drawer button */}
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Expand App Drawer"
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
              title="Expand All Apps"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="w-5 h-px bg-white/[0.08] my-0.5" />

            {/* Pinned App Icons */}
            <div className="flex flex-col items-center gap-1">
              {PINNED_RAIL_APPS.map(app => (
                <RailDropButton
                  key={app.id}
                  icon={app.icon}
                  label={app.label}
                  isOpen={openDropdown === app.id}
                  onToggle={() => setOpenDropdown(openDropdown === app.id ? null : app.id)}
                  onOpen={() => {
                    openApp(app.id);
                    setOpenDropdown(null);
                  }}
                />
              ))}
            </div>

            <div className="w-5 h-px bg-white/[0.08] my-0.5" />

            {/* Vertical Time Indicator */}
            <span className="text-[8px] text-white/30 font-mono [writing-mode:vertical-lr] rotate-180 leading-none py-1 tracking-wider">
              {timeStr}
            </span>
          </div>
        </div>
      </>
    );
  }

  // Expanded categorized drawer with RGB flow borders
  return (
    <div style={{ zIndex }} className="fixed left-0 top-1/2 -translate-y-1/2 pointer-events-auto select-none">
      <div className="rgb-border rgb-border-subtle rounded-r-2xl shadow-2xl">
        <div className="rgb-flow-layer" />
        <div className="relative z-10 bg-black/95 rounded-r-2xl w-64 max-h-[85vh] flex flex-col border border-white/[0.08] border-l-0 backdrop-blur-2xl">
          {/* Header */}
          <div className="px-3 py-2.5 shrink-0 border-b border-white/[0.08]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider font-mono">
                Sovereign Apps
              </span>
              <button
                onClick={() => setCollapsed(true)}
                className="text-white/30 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Clock display */}
            <div className="text-center py-1 mb-2 border-b border-white/[0.06]">
              <p className="text-lg font-bold text-white tabular-nums leading-tight font-mono">{timeStr}</p>
              <p className="text-[9px] text-white/40">{dateStr}</p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search sovereign tools..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors font-sans"
              />
            </div>
          </div>

          {/* App Categories */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 scrollbar-thin">
            {filteredCategories.map(cat => (
              <div key={cat.id} className="space-y-1">
                <div className={`px-2 text-[10px] font-bold uppercase tracking-wider ${cat.color} font-mono`}>
                  {cat.label}
                </div>
                <div className="space-y-0.5">
                  {cat.apps.map(app => {
                    const Icon = app.icon;
                    const isRunning = openWindows.some(w => (w.type || w.appType || w.id) === app.id);
                    return (
                      <button
                        key={app.id}
                        onClick={() => {
                          openApp(app.id);
                          setCollapsed(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-left group cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 group-hover:text-cyan-400 group-hover:border-cyan-500/40 transition-colors shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-white/85 group-hover:text-white truncate">
                              {app.label}
                            </span>
                            {isRunning && (
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00d9ff]" />
                            )}
                          </div>
                          <span className="text-[9px] text-white/40 group-hover:text-white/60 truncate block leading-tight">
                            {app.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
