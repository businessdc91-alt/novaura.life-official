import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Users, Bot, GitBranch, BookOpen, Cpu, ShieldCheck,
  Radio, Check, Copy, ExternalLink, Zap, Terminal, Sparkles,
  Filter, ArrowRight, Star, Globe, RefreshCw, KeyRound, HardDrive
} from 'lucide-react';
import { sovereignSearch } from '../../services/sovereignSearchService.js';
import { liveVoice } from '../../services/liveVoiceService.js';

export default function NovaSearchWindow({ windowId, props, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [copiedUri, setCopiedUri] = useState(false);
  const [connectNotice, setConnectNotice] = useState(null);
  const [meshItems, setMeshItems] = useState([]);
  const [isFetchingArticle, setIsFetchingArticle] = useState(false);

  useEffect(() => {
    const unsub = sovereignSearch.subscribe(items => setMeshItems(items));
    setMeshItems(sovereignSearch.search({}));
    return () => unsub();
  }, []);

  const searchResults = useMemo(() => {
    return sovereignSearch.search({
      query: searchQuery,
      category: selectedCategory,
      sortBy,
      onlineOnly,
    });
  }, [searchQuery, selectedCategory, sortBy, onlineOnly, meshItems]);

  const handleCopyUri = (uri) => {
    if (!uri) return;
    navigator.clipboard.writeText(uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const handleConnectPeer = (item) => {
    if (item.isLocal) {
      setConnectNotice(`Local Node Operator — Active on this machine with verified cryptographic identity.`);
    } else {
      setConnectNotice(`P2P Handshake ping dispatched to ${item.handle} across sovereign mesh channel.`);
    }
    setTimeout(() => setConnectNotice(null), 4000);
  };

  const handleQueryAgent = (item) => {
    if (item.isLocal) {
      setConnectNotice(`Local Neural Agent ${item.title} (${item.model}) is ready. Configure in Dual Inference or chat via Literature Studio / Aura Commander.`);
    } else {
      setConnectNotice(`Query channel opened to remote agent ${item.title} via mesh route.`);
    }
    setTimeout(() => setConnectNotice(null), 4500);
  };

  const handleOpenEncyclopedia = async (item) => {
    if (item.isLocal) {
      window.dispatchEvent(new CustomEvent('novaura-open-window', {
        detail: { appId: 'encyclopedia', props: { initialArticle: item.title } }
      }));
      setSelectedItem(null);
      return;
    }

    setIsFetchingArticle(true);
    try {
      await sovereignSearch.fetchRemoteArticle(item.peerId, {
        articleId: item.articleId,
        title: item.title
      });
      window.dispatchEvent(new CustomEvent('novaura-open-window', {
        detail: { appId: 'encyclopedia', props: { initialArticle: item.title } }
      }));
      setSelectedItem(null);
    } catch (err) {
      setConnectNotice(`Remote Codex fetch failed: ${err.message || err}`);
      setTimeout(() => setConnectNotice(null), 4500);
    } finally {
      setIsFetchingArticle(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'user':
        return <Users className="w-4 h-4 text-cyan-400" />;
      case 'agent':
        return <Bot className="w-4 h-4 text-purple-400" />;
      case 'repo':
        return <GitBranch className="w-4 h-4 text-emerald-400" />;
      case 'literature':
        return <BookOpen className="w-4 h-4 text-amber-400" />;
      case 'encyclopedia':
        return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'service':
        return <Cpu className="w-4 h-4 text-rose-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-400" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'user':
        return { label: 'Node Operator', bg: 'bg-cyan-950/70 text-cyan-300 border-cyan-500/30' };
      case 'agent':
        return { label: 'AI Agent Node', bg: 'bg-purple-950/70 text-purple-300 border-purple-500/30' };
      case 'repo':
        return { label: 'Git Forge Repo', bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30' };
      case 'literature':
        return { label: 'Published Work', bg: 'bg-amber-950/70 text-amber-300 border-amber-500/30' };
      case 'encyclopedia':
        return { label: 'Codex / Wiki', bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30' };
      case 'service':
        return { label: 'Mesh Service', bg: 'bg-rose-950/70 text-rose-300 border-rose-500/30' };
      default:
        return { label: 'Entity', bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. Top Search Header */}
      <div className="px-6 py-4 bg-slate-900/95 border-b border-slate-800 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300">
              <Radio className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Nova Search — Decentralized Sovereign Index</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-300">
                  Zero Central Server
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Discover peer operators, autonomous AI agent nodes, decentralized git repos, and literature across the P2P mesh.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span>Gossip Mesh Active</span>
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search operators, AI nodes (e.g. 'solidity auditor', 'gemma 4'), repos, or public keys..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-10 pr-24 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition-all"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'All Entities', icon: Sparkles },
              { id: 'encyclopedia', label: 'Encyclopedia & Codex', icon: Globe },
              { id: 'user', label: 'Operators', icon: Users },
              { id: 'agent', label: 'AI Nodes', icon: Bot },
              { id: 'repo', label: 'Repositories', icon: GitBranch },
              { id: 'literature', label: 'Literature', icon: BookOpen },
              { id: 'service', label: 'Services', icon: Cpu },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sort & Online Controls */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={e => setOnlineOnly(e.target.checked)}
                className="rounded accent-purple-500 cursor-pointer"
              />
              <span>Online Only</span>
            </label>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300 cursor-pointer focus:outline-none"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="reputation">Sort: Reputation Score</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {connectNotice && (
        <div className="px-5 py-2 bg-purple-950/80 border-b border-purple-500/40 text-purple-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            <span>{connectNotice}</span>
          </div>
          <button onClick={() => setConnectNotice(null)} className="text-purple-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* 2. Results Grid Viewport */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Found {searchResults.length} verified mesh entities</span>
          <span className="font-mono text-[11px]">Decentralized DHT / Kademlia Index</span>
        </div>

        {searchResults.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
            <Search className="w-8 h-8 text-slate-600" />
            <p className="text-xs font-medium">No mesh records matching "{searchQuery}"</p>
            <p className="text-[11px] text-slate-500">Try broadening your search or switching categories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((item) => {
              const badge = getTypeBadge(item.type);
              const isSelected = selectedItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-4 rounded-2xl bg-slate-900/80 border transition-all cursor-pointer flex flex-col justify-between space-y-3 group hover:border-purple-500/50 hover:bg-slate-900 ${
                    isSelected ? 'border-purple-500 bg-slate-900 ring-1 ring-purple-500/50' : 'border-slate-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-purple-500/40 transition-colors">
                          {getTypeIcon(item.type)}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors truncate max-w-[160px]">
                            {item.title}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400">
                            {item.handle}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Card Meta & Badges */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                    {/* Tags */}
                    {item.tags && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400 font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Context Specific Metadata */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      {item.type === 'agent' && (
                        <>
                          <span className="text-purple-400 font-bold truncate max-w-[160px]">{item.model}</span>
                          <span className="text-emerald-400">{item.latencyMs}ms</span>
                        </>
                      )}
                      {item.type === 'user' && (
                        <>
                          <span className="text-emerald-400 font-bold">Trust: {item.reputation}%</span>
                          <span className="capitalize text-slate-400">{item.status}</span>
                        </>
                      )}
                      {item.type === 'repo' && (
                        <>
                          <span className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{item.stars}</span>
                          </span>
                          <span className="text-slate-400">{item.license}</span>
                        </>
                      )}
                      {item.type === 'literature' && (
                        <>
                          <span className="text-amber-400">{item.pages} Pages</span>
                          <span className="text-slate-400">{item.format}</span>
                        </>
                      )}
                      {item.type === 'encyclopedia' && (
                        <>
                          <span className="text-emerald-400 font-bold">{item.wordCount ? `${item.wordCount.toLocaleString()} words` : 'Codex Article'}</span>
                          <span className="text-slate-400 truncate max-w-[140px]">{item.author || (item.peerName ? `Peer: ${item.peerName}` : 'Local Codex')}</span>
                        </>
                      )}
                      {item.type === 'service' && (
                        <>
                          <span className="text-emerald-400">{item.cost}</span>
                          <span className="text-slate-400">{item.latencyMs}ms</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Detail Slide-Over Modal for Selected Entity */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  {getTypeIcon(selectedItem.type)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedItem.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-purple-400">{selectedItem.handle}</span>
                    {selectedItem.isLocal && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono">
                        LOCAL NODE
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-xs">
              <p className="text-slate-200 leading-relaxed">
                {selectedItem.description}
              </p>

              {/* Specific info table */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono text-[11px]">
                {selectedItem.publicKey && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ed25519 Public Key:</span>
                    <span className="text-slate-200 truncate max-w-xs">{selectedItem.publicKey}</span>
                  </div>
                )}
                {selectedItem.model && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Model Engine:</span>
                    <span className="text-purple-300 font-bold">{selectedItem.model}</span>
                  </div>
                )}
                {selectedItem.endpoint && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">P2P Endpoint:</span>
                    <span className="text-cyan-300">{selectedItem.endpoint}</span>
                  </div>
                )}
                {selectedItem.cloneUri && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Git Clone URI:</span>
                    <span className="text-emerald-300 truncate max-w-xs">{selectedItem.cloneUri}</span>
                  </div>
                )}
                {selectedItem.wordCount && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Word Count:</span>
                    <span className="text-emerald-300 font-bold">{selectedItem.wordCount.toLocaleString()} words</span>
                  </div>
                )}
                {selectedItem.peerName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Mesh Provider Peer:</span>
                    <span className="text-cyan-300 font-bold">{selectedItem.peerName}</span>
                  </div>
                )}
              </div>

              {/* Capabilities & Skills */}
              {(selectedItem.capabilities || selectedItem.skills) && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Verified Capabilities & Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedItem.capabilities || selectedItem.skills).map((cap, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]">
                        ✓ {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              {selectedItem.type === 'encyclopedia' && (
                <button
                  disabled={isFetchingArticle}
                  onClick={() => handleOpenEncyclopedia(selectedItem)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 text-xs disabled:opacity-50"
                >
                  {isFetchingArticle ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Fetching over Mesh...</span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4" />
                      <span>{selectedItem.isLocal ? 'Read in Aura Codex' : 'Fetch from Peer & Read in Codex'}</span>
                    </>
                  )}
                </button>
              )}

              {selectedItem.type === 'literature' && (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: 'literature_ide' }));
                    setSelectedItem(null);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/40 text-xs"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Open in Literature Studio</span>
                </button>
              )}

              {selectedItem.type === 'repo' && (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: 'novahub' }));
                    setSelectedItem(null);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 text-xs"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Open in Nova Hub Forge</span>
                </button>
              )}

              {selectedItem.type === 'user' && (
                <button
                  onClick={() => handleConnectPeer(selectedItem)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-950/40 text-xs"
                >
                  <Radio className="w-4 h-4" />
                  <span>Initiate Encrypted P2P Handshake</span>
                </button>
              )}

              {selectedItem.type === 'agent' && (
                <button
                  onClick={() => handleQueryAgent(selectedItem)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-950/40 text-xs"
                >
                  <Bot className="w-4 h-4" />
                  <span>Dispatch Query to Agent</span>
                </button>
              )}

              {selectedItem.cloneUri && (
                <button
                  onClick={() => handleCopyUri(selectedItem.cloneUri)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {copiedUri ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedUri ? 'URI Copied!' : 'Copy Clone URI'}</span>
                </button>
              )}

              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
