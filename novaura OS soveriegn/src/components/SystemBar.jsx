import React, { useState, useEffect } from 'react';
import {
  Wifi, ShieldCheck, Mail, Bell, Search, Sparkles, User,
  Power, Layers, Clock, Cpu, Palette, X, Minus, Globe, Loader2
} from 'lucide-react';
import logoImg from '../assets/novaura-logo.png';
import { useKernel } from '../kernel/useKernel.js';
import { getAppById } from '../config/appRegistry.js';
import { getPeerCount } from '../services/sovereignMesh.js';
import { getEngineStatus, subscribeEngineStatus } from '../services/engines/comfyEngine.js';
import NotificationBell from './NotificationBell.jsx';
import { APP_VERSION, buildDateLabel } from '../config/buildInfo.js';

const ENGINE_LABELS = { starting: 'AI STARTING', loading: 'AI LOADING', ready: 'AI READY', error: 'AI ENGINE' };

export default function SystemBar({
  identity,
  openApp,
  unreadMail = 0,
  onOpenLauncher,
  windows = [],
  focusedId = null,
  onFocusWindow,
  onMinimizeWindow,
  onRestoreWindow,
  onCloseWindow,
}) {
  const { kernel } = useKernel();
  const [time, setTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [engine, setEngine] = useState(getEngineStatus);

  useEffect(() => subscribeEngineStatus(setEngine), []);

  useEffect(() => {
    const updatePeers = () => setPeerCount(getPeerCount());
    updatePeers();
    window.addEventListener('novaura:mesh_updated', updatePeers);
    return () => window.removeEventListener('novaura:mesh_updated', updatePeers);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    kernel?.semantics?.executeIntent(searchQuery.trim());
    setSearchQuery('');
    setSearchActive(false);
  };

  return (
    <div className="h-9 px-3 bg-slate-950/85 border-b border-slate-800/80 backdrop-blur-xl flex items-center justify-between select-none z-[9000] text-xs text-slate-200 font-sans">
      {/* Left: Brand + Quick Command */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenLauncher}
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="App Launcher (Ctrl+K)"
        >
          <img src={logoImg} alt="Logo" className="w-4 h-4 object-contain" />
          <span className="font-bold tracking-wider text-xs text-cyan-400">SOVEREIGN</span>
        </button>

        {/* Beta Status & Diagnostic Launch Badge */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('novaura:open_settings_tab', { detail: 'beta' }));
            openApp?.('settings');
          }}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold tracking-wider transition-colors cursor-pointer"
          title={`NovAura Sovereign OS — Beta v${APP_VERSION}, built ${buildDateLabel()} (Click to open Beta Diagnostics & Feedback)`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>BETA v{APP_VERSION}</span>
        </button>

        {/* Global Quick Command Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5" />
          <input
            type="text"
            placeholder="Command OS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-44 pl-8 pr-2.5 py-1 text-[11px] bg-slate-900/80 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/80 focus:w-56 transition-all"
          />
        </form>
      </div>

      {/* Center: Running & Minimized Windows Taskbar Tray */}
      <div className="flex-1 flex items-center justify-center gap-1.5 px-3 overflow-x-auto no-scrollbar max-w-[50vw]">
        {windows.map((win) => {
          const appDef = getAppById(win.type || win.appType);
          const Icon = appDef?.icon || Layers;
          const isMinimized = win.state === 'minimized';
          const isFocused = focusedId === win.id && !isMinimized;

          return (
            <div
              key={win.id}
              onClick={() => {
                if (isMinimized) {
                  onRestoreWindow?.(win.id);
                } else if (isFocused) {
                  onMinimizeWindow?.(win.id);
                } else {
                  onFocusWindow?.(win.id);
                }
              }}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all duration-200 select-none ${
                isFocused
                  ? 'bg-cyan-500/20 border-cyan-400/80 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-500/40'
                  : isMinimized
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/40 hover:text-amber-200'
                  : 'bg-slate-900/70 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title={`${win.title || appDef?.title || 'Window'} (${
                isMinimized
                  ? 'Minimized — click to restore'
                  : isFocused
                  ? 'Active — click to minimize'
                  : 'Click to bring to front'
              })`}
            >
              {/* Status indicator dot */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                  isMinimized
                    ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                    : isFocused
                    ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse'
                    : 'bg-slate-500'
                }`}
              />

              {/* App Icon */}
              <Icon
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: isMinimized ? '#fbbf24' : appDef?.color || '#22d3ee' }}
              />

              {/* Window Title */}
              <span className={`truncate max-w-[130px] text-[11px] ${isMinimized ? 'italic text-amber-200/90' : 'font-medium'}`}>
                {win.title || appDef?.label || 'Window'}
              </span>

              {/* Minimized Pill Badge */}
              {isMinimized && (
                <span className="text-[9px] uppercase font-mono px-1 py-0.5 rounded bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40">
                  MIN
                </span>
              )}

              {/* Close Button on Hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseWindow?.(win.id);
                }}
                className="w-3.5 h-3.5 rounded hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-rose-400 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Close Window"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right: Status Indicators & Identity */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Sentinel Shield Badge */}
        <button
          onClick={() => openApp('sentinel')}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-800 text-emerald-400 text-[11px] transition-colors"
          title="Sentinel Shield Active"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono">ENFORCED</span>
        </button>

        {/* Notification history (the bell) */}
        <NotificationBell openApp={openApp} />

        {/* Unread Mail */}
        <button
          onClick={() => openApp('novamail')}
          className="relative p-1 text-slate-400 hover:text-slate-200 transition-colors"
          title="NovaMail"
        >
          <Mail className="w-4 h-4" />
          {unreadMail > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-cyan-500 text-[9px] font-bold text-white flex items-center justify-center">
              {unreadMail}
            </span>
          )}
        </button>

        {/* Local AI engine (ComfyUI): starting, loading the default model, ready */}
        {engine.phase !== 'idle' && (
          <button
            onClick={() => openApp('ai_engines')}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-800 text-[11px] font-mono transition-colors cursor-pointer"
            title={engine.message || 'Local AI engine'}
          >
            {engine.phase === 'starting' || engine.phase === 'loading'
              ? <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              : <Cpu className={`w-3.5 h-3.5 ${engine.phase === 'error' ? 'text-amber-400' : 'text-emerald-400'}`} />}
            <span className={engine.phase === 'error' ? 'text-amber-300' : engine.phase === 'ready' ? 'text-emerald-300' : 'text-cyan-300'}>
              {ENGINE_LABELS[engine.phase]}
            </span>
          </button>
        )}

        {/* Sovereign Mesh Network Tray Indicator */}
        <button
          onClick={() => openApp('sovereign_peering')}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-800 text-[11px] font-mono transition-colors cursor-pointer"
          title={`Sovereign WAN & LAN Network: ${peerCount} peer${peerCount === 1 ? '' : 's'} connected (Click to open Peering & Connect Manager)`}
        >
          <Globe className={`w-3.5 h-3.5 ${peerCount > 0 ? 'text-emerald-400' : 'text-cyan-400'}`} />
          <span className={peerCount > 0 ? 'text-emerald-300 font-bold' : 'text-cyan-300'}>
            {peerCount > 0 ? `${peerCount} MESH` : 'SOVEREIGN'}
          </span>
        </button>

        {/* Clock */}
        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] px-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {/* Personalization & Themes */}
        <button
          onClick={() => openApp('personalization')}
          className="p-1 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
          title="Themes & Visuals"
        >
          <Palette className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
