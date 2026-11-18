import React, { useState } from 'react';
import { Search, X, Sparkles, Layers } from 'lucide-react';
import { APP_REGISTRY, useAppRegistryVersion } from '../config/appRegistry.js';

export const CATEGORIES = [
  { id: 'all', label: 'All Applications' },
  { id: 'additions', label: 'Additions' },
  { id: 'creator', label: 'Creator Studio' },
  { id: 'finance', label: 'Crypto & Assets' },
  { id: 'media', label: 'Media & Entertainment' },
  { id: 'games', label: 'Arcade & Mini-Games' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'ai', label: 'AI & Knowledge' },
  { id: 'mesh', label: 'Sovereign Mesh' },
  { id: 'core', label: 'Core OS' },
  { id: 'social', label: 'Social & Comms' },
  { id: 'system', label: 'System' },
];

export default function AppLauncherModal({ isOpen, onClose, onLaunchApp }) {
  useAppRegistryVersion(); // re-render when user apps are added or removed
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredApps = APP_REGISTRY.filter(app => {
    if (app.hidden) {
      const q = search.trim().toLowerCase();
      if (!q || (!q.includes('founder') && !q.includes('admin') && !q.includes('office') && !q.includes('enclave') && !app.label.toLowerCase().includes(q))) {
        return false;
      }
    }
    const matchesCategory = activeCategory === 'all' || app.category === activeCategory;
    const matchesSearch = app.label.toLowerCase().includes(search.toLowerCase()) ||
                          app.title.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 select-none font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col max-h-[80vh] overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Sovereign App Launcher</h2>
              <p className="text-[11px] text-slate-400">Omni-application ecosystem running local-first on your machine</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Tabs */}
        <div className="py-4 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Search apps by name, purpose, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* App Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-1">
            {filteredApps.map(app => {
              const Icon = app.icon;
              return (
                <div
                  key={app.id}
                  onClick={() => {
                    onLaunchApp(app.id);
                    onClose();
                  }}
                  className="group p-3.5 bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-850 rounded-2xl cursor-pointer transition-all flex flex-col items-center text-center hover:scale-[1.02]"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 transition-transform group-hover:scale-105 border"
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      borderColor: `${app.color}40`,
                    }}
                  >
                    <Icon className="w-6 h-6" style={{ color: app.color }} />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 truncate w-full">{app.label}</h4>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{app.title.split('—')[1] || app.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
