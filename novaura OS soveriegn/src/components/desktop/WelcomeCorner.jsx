import React, { useState } from 'react';
import { Compass, Minus, LayoutGrid, Map as MapIcon, Cpu } from 'lucide-react';
import { openWindow } from '../../services/desktopActions.js';

const KEY = 'novaura-welcome-corner';
/** Space the welcome card takes in the desktop's top-left corner (icons and the tray stay clear of it). */
export const WELCOME_AREA = { width: 268, height: 92 };

function openGuide(section) {
  openWindow('welcome_guide', section ? { section } : {});
  if (section) window.dispatchEvent(new CustomEvent('novaura:welcome_section', { detail: section }));
}

const LINKS = [
  { section: 'features', label: 'Features', icon: LayoutGrid },
  { section: 'roadmap', label: 'Roadmap', icon: MapIcon },
  { section: 'network', label: 'AI network', icon: Cpu },
];

/** The welcome card pinned to the desktop's top-left corner; shrinks to a small pill. */
export default function WelcomeCorner() {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(KEY) === 'pill' ? 'pill' : 'card'; } catch { return 'card'; }
  });
  const set = (m) => {
    setMode(m);
    try { localStorage.setItem(KEY, m); } catch { /* storage unavailable */ }
  };

  if (mode === 'pill') {
    return (
      <button
        data-drop="welcome"
        onClick={(e) => { e.stopPropagation(); set('card'); }}
        title="Show the welcome card"
        className="absolute top-3 left-4 z-30 flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-slate-900/70 border border-cyan-500/40 backdrop-blur-xl text-[11px] font-medium text-cyan-100 hover:bg-slate-800/80 shadow-lg"
      >
        <Compass className="w-3.5 h-3.5 text-cyan-300" /> Welcome
      </button>
    );
  }

  return (
    <div
      data-drop="welcome"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      style={{ width: WELCOME_AREA.width - 16 }}
      className="absolute top-3 left-4 z-30 rounded-2xl border border-cyan-500/30 bg-slate-900/60 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.45)] overflow-hidden"
    >
      <div className="flex items-start gap-2.5 p-2.5 pb-2">
        <button
          onClick={() => openGuide()}
          className="flex-1 flex items-start gap-2.5 text-left group"
          title="Open the Welcome Guide"
        >
          <span className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center bg-cyan-500/15 border border-cyan-400/40 shadow-[0_0_14px_rgba(34,211,238,0.35)]">
            <Compass className="w-4.5 h-4.5 text-cyan-300 group-hover:rotate-45 transition-transform duration-300" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-white group-hover:text-cyan-200">Welcome to Sovereign</span>
            <span className="block text-[10.5px] text-slate-400 leading-snug">Features, roadmap and the vision behind it</span>
          </span>
        </button>
        <button
          onClick={() => set('pill')}
          title="Shrink"
          className="p-0.5 rounded text-slate-500 hover:text-white hover:bg-slate-700/60"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex border-t border-white/5">
        {LINKS.map(l => (
          <button
            key={l.section}
            onClick={() => openGuide(l.section)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10.5px] text-slate-300 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
          >
            <l.icon className="w-3 h-3" /> {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
