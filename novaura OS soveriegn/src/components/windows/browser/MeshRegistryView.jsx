import React, { useState, useEffect } from 'react';
import {
  Globe, Radio, Sparkles, Search, ExternalLink,
  ShieldCheck, Pin, PinOff, Filter, RefreshCw, Star, Layers, Shield
} from 'lucide-react';
import { getMeshSitesRegistry, setSitePinStatus } from '../../../services/sovereignMesh.js';
import { getFactionBalanceStats } from '../../../services/founderAuthService.js';

export default function MeshRegistryView({ onNavigateToUrl, isFounder = false }) {
  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedFaction, setSelectedFaction] = useState('all'); // 'all' | 'nova' | 'aura'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [registry, factionStats] = await Promise.all([
        getMeshSitesRegistry({ faction: selectedFaction, category: selectedCategory, search }),
        getFactionBalanceStats(),
      ]);
      setSites(registry || []);
      setStats(factionStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFaction, selectedCategory, search]);

  const handleTogglePin = async (domain, currentPinned) => {
    await setSitePinStatus(domain, !currentPinned);
    loadData();
  };

  const categories = [
    'all',
    'Infrastructure & Tools',
    'Creative & Neural',
    'Social & Media',
    'Genesis',
  ];

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Dual Faction Banner & War Telemetry */}
      <div className="px-6 py-5 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-purple-950/40 border-b border-slate-800 shrink-0">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <h1 className="text-base font-bold text-white tracking-wide">
                  Decentralized Web Registry & DNS Explorer
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Zero ICANN • Swarm Direct
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Explore uncensorable peer-to-peer portals across the <b>Nova (.nova)</b> and <b>Aura (.aura)</b> mesh networks.
              </p>
            </div>

            {/* Faction Switcher Pill */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setSelectedFaction('all')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                  selectedFaction === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Networks
              </button>
              <button
                onClick={() => setSelectedFaction('nova')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors font-medium ${
                  selectedFaction === 'nova' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60' : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nova Mesh (.nova)</span>
              </button>
              <button
                onClick={() => setSelectedFaction('aura')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors font-medium ${
                  selectedFaction === 'aura' ? 'bg-purple-950 text-purple-300 border border-purple-800/60' : 'text-slate-400 hover:text-purple-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Aura Mesh (.aura)</span>
              </button>
            </div>
          </div>

          {/* Faction Territory Balance Bar */}
          {stats && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Radio className="w-3 h-3" />
                  <span>Nova Mesh: {stats.novaSitesCount} sites ({stats.novaPercentage}%)</span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Territory Dominance: <b className="text-slate-300">{stats.territoryLeader}</b>
                </span>
                <span className="flex items-center gap-1.5 text-purple-400">
                  <span>Aura Mesh: {stats.auraSitesCount} sites ({stats.auraPercentage}%)</span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800/80">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${stats.novaPercentage}%` }}
                />
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 transition-all duration-500"
                  style={{ width: `${stats.auraPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domains (e.g. genesis.nova, elysium.aura), titles, handles..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] capitalize transition-colors ${
                selectedCategory === cat
                  ? 'bg-cyan-600 text-white font-medium'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
          <button
            onClick={loadData}
            className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800"
            title="Refresh Registry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sites Grid */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          {sites.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              No decentralized sites matching your filter. Deploy your own `.nova` or `.aura` site with 1 click from Website Builder!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sites.map((site) => {
                const isAura = (site.domain || '').endsWith('.aura') || site.faction === 'aura';
                const protocolPrefix = isAura ? 'aura://' : 'nova://';
                const fullUrl = `${protocolPrefix}${site.domain}`;

                return (
                  <div
                    key={site.id || site.domain}
                    className={`p-4 rounded-2xl bg-slate-900/60 border transition-all hover:scale-[1.01] flex flex-col justify-between group ${
                      isAura
                        ? 'border-purple-500/25 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-950/40'
                        : 'border-cyan-500/25 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-950/40'
                    }`}
                  >
                    <div>
                      {/* Top Row: Favicon, Faction Badge, Pin */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          {/* Favicon renderer (Emoji or custom string) */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-inner ${
                            isAura
                              ? 'bg-purple-950/80 border border-purple-500/40 text-amber-300'
                              : 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300'
                          }`}>
                            {site.favicon || (isAura ? '✨' : '🌐')}
                          </div>
                          <div>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              isAura
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            }`}>
                              {isAura ? 'Aura Faction' : 'Nova Faction'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {site.isPinned && (
                            <span className="p-1 text-amber-400" title="Pinned by Founders">
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                            </span>
                          )}
                          {isFounder && (
                            <button
                              onClick={() => handleTogglePin(site.domain, site.isPinned)}
                              className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                              title={site.isPinned ? 'Unpin Site' : 'Pin to Top of Registry'}
                            >
                              {site.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Site Title & Domain */}
                      <div className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors line-clamp-1 mb-1">
                        {site.title || site.domain}
                      </div>

                      <div className="text-xs font-mono text-cyan-400 truncate mb-2">
                        {fullUrl}
                      </div>

                      {/* Category & Owner */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                        <span>Category: <b className="text-slate-300">{site.category || 'General'}</b></span>
                        <span>by <b className="text-slate-300">@{site.ownerHandle || 'operator'}</b></span>
                      </div>
                    </div>

                    {/* Bottom Metadata & Launch Action */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        <span>P2P Signed</span>
                      </div>

                      <button
                        onClick={() => onNavigateToUrl(fullUrl)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md ${
                          isAura
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-950/50'
                            : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-950/50'
                        }`}
                      >
                        <span>Launch</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
