import React, { useState, useEffect } from 'react';
import {
  Code2, FolderOpen, Terminal as TerminalIcon, Globe, Hammer,
  BookOpen, PhoneCall, Mail, Users, Bot, ShieldCheck,
  Palette, Settings, Layers, CreditCard, FileText, HardDrive,
  Cpu, Flame, GitBranch, KeyRound, GitPullRequest, Sparkles,
  TrendingUp, Music, ShoppingBag, Gamepad2, Store, Wrench
} from 'lucide-react';
import { APP_MAP } from '../config/appRegistry.js';

// Master sovereign apps available in toolbar
const TOOLBAR_APP_DEFS = {
  onboarding_guide: { id: 'onboarding_guide', label: 'Guide & Legal', icon: Sparkles, color: '#818cf8' },
  cybeni:          { id: 'cybeni',          label: 'Cybeni',       icon: Code2,        color: '#c084fc' },
  marketplace:     { id: 'marketplace',     label: 'Marketplace',  icon: ShoppingBag,  color: '#f59e0b' },
  crypto_pulse:    { id: 'crypto_pulse',    label: 'CryptoPulse',  icon: TrendingUp,   color: '#10b981' },
  media_deck:      { id: 'media_deck',      label: 'Media Deck',   icon: Music,        color: '#ec4899' },
  creative_studio: { id: 'creative_studio', label: 'Creative',     icon: Palette,      color: '#f43f5e' },
  retro_arcade:    { id: 'retro_arcade',    label: 'Arcade',       icon: Gamepad2,     color: '#a855f7' },
  developer_gateway: { id: 'developer_gateway', label: 'Dev Gateway', icon: KeyRound,  color: '#06b6d4' },
  nova_hub:        { id: 'nova_hub',        label: 'Nova Hub',     icon: GitPullRequest, color: '#a855f7' },
  hypervisor:      { id: 'hypervisor',      label: 'Hypervisor',   icon: Cpu,          color: '#a855f7' },
  chain_weaver:    { id: 'chain_weaver',    label: 'Weaver',       icon: GitBranch,    color: '#c084fc' },
  media_foundry:   { id: 'media_foundry',   label: 'Media Foundry',icon: Flame,        color: '#f59e0b' },
  files:           { id: 'files',           label: 'Files',        icon: FolderOpen,   color: '#38bdf8' },
  disk_architect:  { id: 'disk_architect',  label: 'Disks',        icon: HardDrive,    color: '#10b981' },
  terminal:        { id: 'terminal',        label: 'Terminal',     icon: TerminalIcon, color: '#34d399' },
  browser:         { id: 'browser',         label: 'Browser',      icon: Globe,        color: '#60a5fa' },
  website_builder: { id: 'website_builder', label: 'Builder',      icon: Hammer,       color: '#06b6d4' },
  commerce_studio: { id: 'commerce_studio', label: 'Commerce',     icon: Store,        color: '#10b981' },
  literature:      { id: 'literature',      label: 'Word Studio',  icon: BookOpen,     color: '#38bdf8' },
  novaphone:       { id: 'novaphone',       label: 'NovaPhone',    icon: PhoneCall,    color: '#10b981' },
  novamail:        { id: 'novamail',        label: 'NovaMail',     icon: Mail,         color: '#7dd3fc' },
  novasocial:      { id: 'novasocial',      label: 'Social',       icon: Users,        color: '#a78bfa' },
  ailounge:        { id: 'ailounge',        label: 'AI Lounge',    icon: Bot,          color: '#34d399' },
  sentinel:        { id: 'sentinel',        label: 'Sentinel',     icon: ShieldCheck,  color: '#10b981' },
  sovereign_repair:{ id: 'sovereign_repair',label: 'Auto-Repair',  icon: Wrench,       color: '#06b6d4' },
  credential_enclave: { id: 'credential_enclave', label: 'Enclave', icon: KeyRound,    color: '#10b981' },
  card_forge:      { id: 'card_forge',      label: 'TCG Forge',    icon: Layers,       color: '#f97316' },
  card_creator:    { id: 'card_creator',    label: 'Biz Card',     icon: CreditCard,   color: '#f59e0b' },
  resume_builder:  { id: 'resume_builder',  label: 'Resume',       icon: FileText,     color: '#10b981' },
  personalization: { id: 'personalization', label: 'Themes',       icon: Palette,      color: '#ec4899' },
  sovereign_peering: { id: 'sovereign_peering', label: 'Network', icon: Globe, color: '#06b6d4' },
  encyclopedia:    { id: 'encyclopedia',    label: 'Codex',        icon: BookOpen,     color: '#06b6d4' },
  settings:        { id: 'settings',        label: 'Settings',     icon: Settings,     color: '#94a3b8' },
};

const DEFAULT_TOOLBAR_APPS = [
  'onboarding_guide',
  'cybeni',
  'marketplace',
  'crypto_pulse',
  'media_deck',
  'creative_studio',
  'retro_arcade',
  'developer_gateway',
  'encyclopedia',
  'sovereign_peering',
  'cybeni',
  'nova_hub',
  'hypervisor',
  'chain_weaver',
  'media_foundry',
  'files',
  'disk_architect',
  'terminal',
  'browser',
  'website_builder',
  'commerce_studio',
  'literature',
  'novaphone',
  'novamail',
  'novasocial',
  'ailounge',
  'sentinel',
  'credential_enclave',
  'personalization',
  'settings'
];

export default function Toolbar({ onOpenWindow, openWindows = [] }) {
  const [activeApps, setActiveApps] = useState(DEFAULT_TOOLBAR_APPS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('novaura-taskbar-apps');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveApps(parsed);
        }
      }
    } catch {
      /* use defaults */
    }

    const onStorage = (e) => {
      if (e.key === 'novaura-taskbar-apps' && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          if (Array.isArray(updated) && updated.length > 0) setActiveApps(updated);
        } catch { /* ignore */ }
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

  // Combine pinned tools and any dynamically open windows so open apps are never hidden
  const openAppIds = openWindows.map(w => w.type || w.appType).filter(Boolean);
  const combinedAppIds = Array.from(new Set([...activeApps, ...openAppIds]));

  const visibleTools = combinedAppIds
    .map(id => TOOLBAR_APP_DEFS[id] || (APP_MAP.get(id) ? {
      id,
      label: APP_MAP.get(id).label,
      icon: APP_MAP.get(id).icon,
      color: APP_MAP.get(id).color || 'var(--primary)'
    } : null))
    .filter(Boolean);

  return (
    <div className="rgb-border rounded-2xl shadow-2xl backdrop-blur-xl">
      <div className="rgb-flow-layer" />
      <div className="flex items-center gap-1 bg-black/90 rounded-2xl p-1.5 relative z-10 border border-white/5">
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
                         touch-manipulation relative cursor-pointer"
            >
              <Icon
                size={18}
                className="rgb-icon-glow transition-all duration-300"
                style={{
                  color: isMinimized ? '#fbbf24' : isRunning ? tool.color : undefined,
                  animationDelay: delay
                }}
              />
              <span className={`text-[9px] font-medium leading-none truncate max-w-[52px] transition-colors ${
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
    </div>
  );
}
