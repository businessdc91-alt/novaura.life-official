import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, Search, Sparkles, Gamepad2, BookOpen, Code2, Music,
  Layers, Download, Plus, Star, ShieldCheck, Check, Globe, Crown,
  UploadCloud, ExternalLink
} from 'lucide-react';
import {
  marketplacePublish,
  MARKETPLACE_CATEGORIES
} from '../../services/marketplacePublishService.js';

export default function MarketplaceWindow() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState([]);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState('');

  // Publish Form State
  const [pubTitle, setPubTitle] = useState('');
  const [pubCategory, setPubCategory] = useState('games');
  const [pubDesc, setPubDesc] = useState('');
  const [pubTags, setPubTags] = useState('godot4, rpg, indie');
  const [pubLicense, setPubLicense] = useState('Sovereign Open License');
  const [pubContent, setPubContent] = useState('# My Sovereign Creation\nAsset details and code payloads...');
  const [isPublishing, setIsPublishing] = useState(false);

  // Pro Subscription State
  const [proState, setProState] = useState(marketplacePublish.getProSubscriptionState());

  useEffect(() => {
    loadListings();
    const unsub = marketplacePublish.subscribe(() => {
      loadListings();
      setProState(marketplacePublish.getProSubscriptionState());
    });
    return () => unsub();
  }, [activeCategory, searchQuery]);

  const loadListings = async () => {
    const items = await marketplacePublish.getAllListings(activeCategory, searchQuery);
    setListings(items);
  };

  const handlePublishSubmit = async (e) => {
    e.preventDefault();
    if (!pubTitle || !pubDesc) return;
    setIsPublishing(true);
    try {
      await marketplacePublish.publishCreation({
        title: pubTitle,
        category: pubCategory,
        description: pubDesc,
        tags: pubTags,
        content: pubContent,
        license: pubLicense,
      });
      setIsPublishModalOpen(false);
      setPubTitle('');
      setPubDesc('');
      setDownloadNotice('Successfully published to Sovereign Marketplace & Mesh Swarm!');
      setTimeout(() => setDownloadNotice(''), 4000);
    } catch (err) {
      alert(`Publish error: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDownload = async (item) => {
    await marketplacePublish.downloadItem(item.id);
    setDownloadNotice(`Imported "${item.title}" into local Sovereign Workspace!`);
    setTimeout(() => setDownloadNotice(''), 3500);
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'games': return <Gamepad2 className="w-4 h-4 text-emerald-400" />;
      case 'books': return <BookOpen className="w-4 h-4 text-cyan-400" />;
      case 'blueprints': return <Code2 className="w-4 h-4 text-purple-400" />;
      case 'media': return <Music className="w-4 h-4 text-pink-400" />;
      default: return <Layers className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">Novaura Assets Marketplace & Publishing Engine</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
                100% Free Sovereign Node Access
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Discover and 1-click publish games, books, Cybeni blueprints, and audio over the P2P mesh</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pro Subscription Toggle */}
          <button
            onClick={() => setIsProModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>{proState.isSubscribed ? 'Pro Cloud Active' : 'Subscribe to Pro'}</span>
          </button>

          <button
            onClick={() => setIsPublishModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Publish Creation</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {downloadNotice && (
        <div className="px-5 py-2 bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between font-mono">
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Filter Strip */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {MARKETPLACE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets, games, tags..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map(item => (
            <div
              key={item.id}
              className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all hover:scale-[1.01] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <span className="text-[10px] text-cyan-400 font-mono block">{item.authorHandle}</span>
                      <span className="text-[10px] text-slate-500 font-mono">v{item.version}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{item.rating || '5.0'}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-3">
                  {item.description}
                </p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {(item.tags || []).map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 text-[10px] font-mono border border-slate-800">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block font-mono">
                    {item.isFreeSovereign ? 'FREE SOVEREIGN' : `$${item.price}`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{item.downloadCount} downloads</span>
                </div>

                <button
                  onClick={() => handleDownload(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PUBLISH CREATION MODAL */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Publish Creation to Sovereign Marketplace</h3>
              </div>
              <button onClick={() => setIsPublishModalOpen(false)} className="text-slate-400 hover:text-white text-xs">
                Close
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Creation Title</label>
                <input
                  type="text"
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="e.g. CyberCity 3D Asset Pack / Godot Boss Controller"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Category</label>
                  <select
                    value={pubCategory}
                    onChange={(e) => setPubCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="games">Games & Engines (Godot/Unity)</option>
                    <option value="books">Books & Manuscripts</option>
                    <option value="blueprints">Cybeni Code Blueprints</option>
                    <option value="media">Audio & Music Stems</option>
                    <option value="assets">3D Models & UI Tokens</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">License</label>
                  <input
                    type="text"
                    value={pubLicense}
                    onChange={(e) => setPubLicense(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={pubTags}
                  onChange={(e) => setPubTags(e.target.value)}
                  placeholder="godot, 3d, cyberpunk, modular"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Description & Overview</label>
                <textarea
                  value={pubDesc}
                  onChange={(e) => setPubDesc(e.target.value)}
                  rows={3}
                  placeholder="Explain features, dependencies, instructions for peers..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-mono">Payload Code / Asset Reference</label>
                <textarea
                  value={pubContent}
                  onChange={(e) => setPubContent(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300">
                This item will be saved in your local Dexie database and broadcast to Sovereign Mesh peers across room #general for free 100% decentralized sharing!
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-cyan-600/30 cursor-pointer"
                >
                  {isPublishing ? 'Publishing...' : 'Publish to Mesh Marketplace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRO CLOUD SUBSCRIPTION MODAL */}
      {isProModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-950 border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Novaura Cloud Pro Ecosystem</h3>
              </div>
              <button onClick={() => setIsProModalOpen(false)} className="text-slate-400 hover:text-white text-xs">
                Close
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-2xl">
                <div className="font-bold text-amber-300 text-sm mb-1">Sovereign Freedom First</div>
                <p className="text-slate-300 leading-relaxed">
                  As a Sovereign OS user, you always have **100% free lifetime access** to P2P decentralized mesh publishing, local AI engines, Word Studio, and Cybeni. Subscribing to Cloud Pro unlocks managed multi-cloud acceleration for enterprise distribution.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2 uppercase text-[10px] tracking-wider text-slate-400">Included in Cloud Pro</h4>
                <div className="space-y-2">
                  {proState.cloudProFeatures.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-mono">License Status:</div>
                  <div className="text-sm font-bold text-white">{proState.tier}</div>
                  {proState.licenseHolder && (
                    <div className="text-[11px] text-amber-400/90 font-mono">
                      Verified: {proState.licenseHolder} ({proState.nodeId})
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    const newState = marketplacePublish.toggleProSubscription();
                    setProState(newState);
                    setIsProModalOpen(false);
                  }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer ${
                    proState.isSubscribed
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900'
                      : 'bg-gradient-to-r from-amber-500 to-purple-600 text-slate-950 font-black shadow-amber-500/20 hover:scale-105'
                  }`}
                >
                  {proState.isSubscribed ? 'Verified Active License' : 'Activate Pro Node License'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
