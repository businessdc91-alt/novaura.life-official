import React, { useState, useMemo, useEffect } from 'react';
import { Search, Heart, Users, User, ArrowLeft, Eye, Grid, SortAsc, Loader2 } from 'lucide-react';
import { kernelStorage } from '../../kernel/kernelStorage.js';

// Avatar Gallery - Loads from backend API or local storage
// No demo data - only real uploaded avatars

const STYLES = ['All', 'Cyberpunk', 'Fantasy', 'Sci-Fi', 'Anime', 'Gothic', 'Casual'];
const BODY_TYPES = ['All', 'slim', 'average', 'athletic', 'muscular', 'petite'];

export default function AvatarGalleryWindow() {
  const [tab, setTab] = useState('community');
  const [search, setSearch] = useState('');
  const [styleFilter, setStyleFilter] = useState('All');
  const [bodyFilter, setBodyFilter] = useState('All');
  const [sortBy, setSortBy] = useState('popular');
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(kernelStorage.getItem('avatar_favorites') || '[]'); } catch { return []; }
  });
  const [selected, setSelected] = useState(null);
  const [communityAvatars, setCommunityAvatars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load community avatars from backend
  useEffect(() => {
    const loadAvatars = async () => {
      try {
        setIsLoading(true);
        const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-life.cloudfunctions.net/api').replace(/\/$/, '');
        const response = await fetch(`${BACKEND_URL}/avatars`);
        if (response.ok) {
          const data = await response.json();
          setCommunityAvatars(data.avatars || []);
        }
      } catch (err) {
        console.error('Failed to load avatars:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAvatars();
  }, []);

  const myAvatars = useMemo(() => {
    try { return JSON.parse(kernelStorage.getItem('saved_avatars') || '[]'); } catch { return []; }
  }, [tab]);

  const toggleFav = (id) => {
    const next = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(next);
    kernelStorage.setItem('avatar_favorites', JSON.stringify(next));
  };

  const filtered = useMemo(() => {
    let list = tab === 'community' ? communityAvatars : myAvatars.map((a, i) => ({
      id: a.id || `my-${i}`, name: a.name || 'Untitled', creator: 'You', style: 'Custom',
      emoji: a.expression === 'happy' ? '😊' : a.expression === 'cool' ? '😎' : '🙂',
      body: a.body || 'average', colors: [a.skinColor || '#f5d0a9', a.hairColor || '#333', a.eyeColor || '#3498db'],
      views: 0,
    }));
    if (search) list = list.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.creator.toLowerCase().includes(search.toLowerCase()));
    if (styleFilter !== 'All') list = list.filter(a => a.style === styleFilter);
    if (bodyFilter !== 'All') list = list.filter(a => a.body === bodyFilter);
    if (sortBy === 'popular') list.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'favorites') list = list.filter(a => favorites.includes(a.id));
    return list;
  }, [tab, search, styleFilter, bodyFilter, sortBy, favorites, myAvatars, communityAvatars]);

  // Detail view
  if (selected) {
    return (
      <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-900/30 to-slate-900 border-b border-slate-800 shrink-0">
          <button onClick={() => setSelected(null)} className="p-1 hover:bg-slate-800 rounded"><ArrowLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold">{selected.name}</span>
          <span className="text-[10px] text-slate-400 ml-auto">by {selected.creator}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-center py-6">
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl"
              style={{ background: `linear-gradient(135deg, ${selected.colors[0]}, ${selected.colors[1]}, ${selected.colors[2]})` }}>
              {selected.emoji}
            </div>
            <div className="text-lg font-bold mt-3">{selected.name}</div>
            <div className="text-xs text-slate-400">{selected.style} · {selected.body}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-slate-900/50 border border-slate-800 rounded-lg">
              <Eye className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
              <div className="text-xs font-medium">{selected.views}</div>
              <div className="text-[8px] text-slate-500">Views</div>
            </div>
            <div className="p-2 bg-slate-900/50 border border-slate-800 rounded-lg">
              <div className="text-[9px] text-slate-500 mb-1">Style</div>
              <div className="text-xs font-medium">{selected.style}</div>
            </div>
            <div className="p-2 bg-slate-900/50 border border-slate-800 rounded-lg">
              <div className="text-[9px] text-slate-500 mb-1">Body</div>
              <div className="text-xs font-medium capitalize">{selected.body}</div>
            </div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 uppercase mb-1.5">Colors</div>
            <div className="flex gap-2">
              {selected.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full border border-slate-700" style={{ background: c }} />
                  <span className="text-[9px] text-slate-400">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => toggleFav(selected.id)}
            className={`w-full py-2 rounded-lg text-xs font-medium border transition-all ${favorites.includes(selected.id) ? 'bg-pink-500/20 border-pink-600/50 text-pink-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>
            <Heart className="w-3 h-3 inline mr-1" />{favorites.includes(selected.id) ? 'Favorited' : 'Favorite'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-pink-900/30 to-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-semibold">Avatar Gallery</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 shrink-0">
        <button onClick={() => setTab('community')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium border-b-2 ${tab === 'community' ? 'border-pink-500 text-white' : 'border-transparent text-slate-500'}`}>
          <Users className="w-3 h-3" />Community
        </button>
        <button onClick={() => setTab('mine')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium border-b-2 ${tab === 'mine' ? 'border-pink-500 text-white' : 'border-transparent text-slate-500'}`}>
          <User className="w-3 h-3" />My Avatars ({myAvatars.length})
        </button>
      </div>

      {/* Filters */}
      <div className="px-3 py-1.5 space-y-1.5 border-b border-slate-800/50 shrink-0">
        <div className="relative">
          <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search avatars..."
            className="w-full pl-7 pr-2 py-1 bg-black/30 border border-slate-800 rounded text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-pink-600/50" />
        </div>
        <div className="flex gap-1.5 items-center overflow-x-auto">
          <select value={styleFilter} onChange={e => setStyleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-slate-400">
            {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={bodyFilter} onChange={e => setBodyFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-slate-400">
            {BODY_TYPES.map(b => <option key={b} value={b}>{b === 'All' ? 'All Bodies' : b}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-slate-400 ml-auto">
            <option value="popular">Popular</option>
            <option value="name">A-Z</option>
            <option value="favorites">Favorites</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading && tab === 'community' && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        )}
        
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="text-xs text-slate-500">{tab === 'mine' ? 'No saved avatars yet' : 'No avatars in gallery'}</div>
          </div>
        )}
        
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(a => (
              <button key={a.id} onClick={() => setSelected(a)}
                className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-pink-600/40 transition-all text-center group">
                <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-2xl mb-1"
                  style={{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})` }}>
                  {a.emoji}
                </div>
                <div className="text-[10px] font-medium truncate">{a.name}</div>
                <div className="text-[8px] text-slate-500 truncate">{a.creator}</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="text-[7px] px-1 py-0.5 bg-slate-800 text-slate-400 rounded">{a.style}</span>
                  {favorites.includes(a.id) && <Heart className="w-2 h-2 text-pink-400" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
