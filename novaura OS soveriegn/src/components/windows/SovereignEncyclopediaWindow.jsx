// SovereignEncyclopediaWindow.jsx — Sovereign Codex & Encyclopedic Reference Engine
// 1. Live & Cached Wikipedia Reader (6.8M+ articles, structured sections, clean typography)
// 2. AI Deep Research Grounding with interactive footnote citations [1], [2]
// 3. 100GB+ Offline Knowledge Packs & ZIM Archive Manager
// 4. 1-Click Export to Word Studio / Literature IDE

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Search, Sparkles, Download, ExternalLink, Copy, Check,
  Share2, FileText, Layers, Globe, HardDrive, Trash2,
  RefreshCw, Shuffle, ChevronRight, Info, List, ArrowUpRight,
  Database, BookmarkCheck, ArrowRight, ShieldCheck, Cpu
} from 'lucide-react';
import encyclopediaService, { KNOWLEDGE_PACKS_CATALOG } from '../../services/encyclopediaService.js';

export default function SovereignEncyclopediaWindow({ onClose, props }) {
  // Navigation tabs: 'reader' | 'research' | 'packs'
  const [activeTab, setActiveTab] = useState('reader');

  // Search & Article State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  // Cached Articles State
  const [storedArticles, setStoredArticles] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState(null);

  // AI Deep Research State
  const [researchTopic, setResearchTopic] = useState('');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState(null);
  const [researchError, setResearchError] = useState(null);
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [copiedBib, setCopiedBib] = useState(false);

  // Citation Copy State
  const [copiedCitationIdx, setCopiedCitationIdx] = useState(null);

  // Load default featured article on mount & hydrate local stored list
  useEffect(() => {
    loadInitialArticle();
    refreshStoredArticles();
  }, []);

  // Reactive listener if props.initialArticle changes dynamically
  useEffect(() => {
    if (props?.initialArticle) {
      encyclopediaService.getArticle(props.initialArticle).then(art => {
        if (art) {
          setCurrentArticle(art);
          setActiveTab('reader');
          setActiveSectionIdx(0);
        }
      }).catch(err => console.warn('[Encyclopedia] Error loading dynamic article prop:', err));
    }
  }, [props?.initialArticle]);

  const loadInitialArticle = async () => {
    setIsLoadingArticle(true);
    try {
      if (props?.initialArticle) {
        const art = await encyclopediaService.getArticle(props.initialArticle);
        if (art) {
          setCurrentArticle(art);
          return;
        }
      }
      // Look for any cached article or load 'Artificial intelligence'
      const cached = await encyclopediaService.getStoredArticles();
      if (cached && cached.length > 0) {
        setCurrentArticle(cached[0]);
      } else {
        const art = await encyclopediaService.getArticle('Artificial intelligence');
        setCurrentArticle(art);
      }
    } catch (err) {
      console.warn('[Encyclopedia] Initial article error:', err);
    } finally {
      setIsLoadingArticle(false);
    }
  };

  const refreshStoredArticles = async () => {
    try {
      const list = await encyclopediaService.getStoredArticles();
      setStoredArticles(list || []);
    } catch (err) {
      console.warn('[Encyclopedia] Stored list error:', err);
    }
  };

  // Perform instant debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const hits = await encyclopediaService.search(searchQuery, 8);
        setSearchResults(hits);
      } catch (err) {
        console.warn('[Encyclopedia] Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectArticle = async (title) => {
    setSearchResults([]);
    setSearchQuery('');
    setIsLoadingArticle(true);
    try {
      const art = await encyclopediaService.getArticle(title);
      setCurrentArticle(art);
      setActiveSectionIdx(0);
      refreshStoredArticles();
    } catch (err) {
      console.error('[Encyclopedia] Article load error:', err);
    } finally {
      setIsLoadingArticle(false);
    }
  };

  const handleRandomArticle = async () => {
    setIsLoadingArticle(true);
    try {
      const art = await encyclopediaService.getRandomArticle();
      setCurrentArticle(art);
      setActiveSectionIdx(0);
      refreshStoredArticles();
    } catch (err) {
      console.error('[Encyclopedia] Random article error:', err);
    } finally {
      setIsLoadingArticle(false);
    }
  };

  const handleDeleteCached = async (e, id) => {
    e.stopPropagation();
    await encyclopediaService.deleteArticle(id);
    if (currentArticle?.id === id) {
      // Reload a fresh article
      handleRandomArticle();
    }
    refreshStoredArticles();
  };

  const handleExportArticle = async () => {
    if (!currentArticle) return;
    setIsExporting(true);
    try {
      const doc = await encyclopediaService.exportArticleToManuscript(currentArticle);
      if (doc) {
        setExportNotice(`Exported "${doc.name}" to Word Studio!`);
        setTimeout(() => setExportNotice(null), 4500);
      }
    } catch (err) {
      setExportNotice('Export failed. Check logs.');
      setTimeout(() => setExportNotice(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRunDeepResearch = async (e) => {
    e?.preventDefault();
    const topic = (researchTopic || currentArticle?.title || '').trim();
    if (!topic || isResearching) return;

    setIsResearching(true);
    setResearchError(null);
    setResearchResult(null);
    setSelectedCitation(null);

    try {
      const result = await encyclopediaService.deepResearchWithCitations(topic, researchQuestion);
      setResearchResult(result);
    } catch (err) {
      setResearchError(err?.message || 'Deep research query failed.');
    } finally {
      setIsResearching(false);
    }
  };

  const handleExportResearch = async () => {
    if (!researchResult) return;
    setIsExporting(true);
    try {
      const doc = await encyclopediaService.exportResearchToManuscript(researchResult);
      if (doc) {
        setExportNotice(`Exported research notes to Word Studio!`);
        setTimeout(() => setExportNotice(null), 4500);
      }
    } catch (err) {
      setExportNotice('Export failed.');
      setTimeout(() => setExportNotice(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyBibliography = () => {
    if (!researchResult?.citations) return;
    const bibText = researchResult.citations
      .map(c => `[${c.index}] "${c.title}." ${c.publisher}. <${c.url}>\n    Summary: ${c.snippet}`)
      .join('\n\n');
    navigator.clipboard.writeText(bibText);
    setCopiedBib(true);
    setTimeout(() => setCopiedBib(false), 2500);
  };

  const handleCopyCitation = (ref, idx) => {
    const text = ref.text || `Wikipedia contributors. "${currentArticle?.title}." Wikipedia.`;
    navigator.clipboard.writeText(text);
    setCopiedCitationIdx(idx);
    setTimeout(() => setCopiedCitationIdx(null), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950/95 text-slate-100 font-sans select-none overflow-hidden border border-cyan-500/20 rounded-xl shadow-2xl backdrop-blur-2xl">
      {/* ── Top Header & Tab Ribbon ── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide text-white">Aura Codex</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-700/50">
                Sovereign Reference Library
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Wikipedia 6.8M+ Archive • Offline ZIMs • AI Grounded Citations</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('reader')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'reader'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <BookOpen size={13} />
            <span>Reader & Library</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('research');
              if (!researchTopic && currentArticle?.title) {
                setResearchTopic(currentArticle.title);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'research'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Sparkles size={13} />
            <span>AI Deep Research</span>
          </button>

          <button
            onClick={() => setActiveTab('packs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'packs'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <HardDrive size={13} />
            <span>Offline Packs (100GB+)</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {exportNotice && (
            <span className="text-[11px] text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-500/30 animate-pulse">
              {exportNotice}
            </span>
          )}
          {activeTab === 'reader' && currentArticle && (
            <button
              onClick={handleExportArticle}
              disabled={isExporting}
              title="Export article into Word Studio manuscript"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 text-xs transition-all"
            >
              <FileText size={13} className="text-cyan-400" />
              <span>To Manuscript</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Main Viewports ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================= */}
        {/* TAB 1: ARTICLE READER & LOCAL LIBRARY                     */}
        {/* ========================================================= */}
        {activeTab === 'reader' && (
          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* Sidebar: Search & Saved Articles / Table of Contents */}
            <aside className="w-72 bg-slate-900/60 border-r border-white/10 flex flex-col shrink-0">
              {/* Search Box */}
              <div className="p-3 border-b border-white/10 relative">
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 6.8M+ articles..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-950/80 border border-white/10 focus:border-cyan-500/50 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-slate-400 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Instant Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-3 right-3 top-12 z-50 bg-slate-900/95 border border-cyan-500/30 rounded-lg shadow-2xl overflow-hidden backdrop-blur-xl max-h-80 overflow-y-auto">
                    <div className="p-1.5 text-[10px] uppercase tracking-wider text-cyan-400 font-bold border-b border-white/5 flex items-center justify-between">
                      <span>Search Results</span>
                      {isSearching && <RefreshCw size={10} className="animate-spin" />}
                    </div>
                    {searchResults.map((hit) => (
                      <button
                        key={hit.pageid || hit.title}
                        onClick={() => handleSelectArticle(hit.title)}
                        className="w-full text-left p-2.5 hover:bg-cyan-500/10 border-b border-white/5 last:border-0 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white group-hover:text-cyan-300">
                            {hit.title}
                          </span>
                          {hit.isLocal && (
                            <span className="text-[9px] px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-600/40">
                              Offline
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{hit.snippet}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions (Random Article, Stored count) */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-white/5 bg-slate-950/40">
                <button
                  onClick={handleRandomArticle}
                  disabled={isLoadingArticle}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition-all"
                >
                  <Shuffle size={12} className={isLoadingArticle ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
                  <span>Random Entry</span>
                </button>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Database size={11} className="text-emerald-400" />
                  <span>{storedArticles.length} cached</span>
                </span>
              </div>

              {/* Article Table of Contents (if an article is loaded) */}
              {currentArticle?.sections && currentArticle.sections.length > 0 && (
                <div className="p-3 border-b border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1">
                    <List size={11} /> Table of Contents
                  </span>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {currentArticle.sections.map((sec, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveSectionIdx(idx)}
                        className={`w-full text-left px-2 py-1 rounded text-xs truncate transition-all ${
                          activeSectionIdx === idx
                            ? 'bg-cyan-500/20 text-cyan-300 font-medium border-l-2 border-cyan-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        {sec.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Local Cached Articles List */}
              <div className="flex-1 overflow-y-auto p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 flex items-center justify-between">
                  <span>Air-Gapped Cache</span>
                  <span className="text-[9px] text-slate-500 font-normal">Dexie DB</span>
                </span>
                {storedArticles.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No articles saved offline yet. Search or click any topic to cache it.</p>
                ) : (
                  <div className="space-y-1">
                    {storedArticles.map((art) => (
                      <div
                        key={art.id}
                        onClick={() => {
                          setCurrentArticle(art);
                          setActiveSectionIdx(0);
                        }}
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                          currentArticle?.id === art.id
                            ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-200'
                            : 'hover:bg-white/5 text-slate-300 hover:text-white'
                        }`}
                      >
                        <span className="truncate pr-2 font-medium">{art.title}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDeleteCached(e, art.id)}
                            title="Remove from offline cache"
                            className="p-1 text-slate-400 hover:text-red-400 rounded"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {/* Main Article Reading Pane */}
            <main className="flex-1 overflow-y-auto p-8 bg-slate-950 select-text flex flex-col">
              {isLoadingArticle ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw size={24} className="animate-spin text-cyan-400" />
                  <p className="text-sm">Fetching and indexing encyclopedic entry...</p>
                </div>
              ) : currentArticle ? (
                <div className="max-w-4xl mx-auto w-full space-y-6">
                  {/* Article Title & Metadata Header */}
                  <div className="border-b border-white/10 pb-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                          <span>{currentArticle.title}</span>
                          <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Cached Offline
                          </span>
                        </h1>
                        <p className="text-sm text-cyan-400/90 font-medium">{currentArticle.description}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setResearchTopic(currentArticle.title);
                            setActiveTab('research');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition-all"
                        >
                          <Sparkles size={13} />
                          <span>AI Research</span>
                        </button>

                        <a
                          href={currentArticle.fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open live Wikipedia article"
                          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-all"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>

                    {/* Meta stats bar */}
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-400 font-mono">
                      <span>{currentArticle.wordcount?.toLocaleString()} words</span>
                      <span>•</span>
                      <span>~{Math.ceil((currentArticle.wordcount || 600) / 220)} min read</span>
                      <span>•</span>
                      <span>{currentArticle.categories?.length || 0} categories</span>
                      <span>•</span>
                      <span className="text-slate-500">Source: Wikimedia Foundation</span>
                    </div>
                  </div>

                  {/* Optional Featured Thumbnail */}
                  {currentArticle.thumbnail && (
                    <div className="p-3 bg-slate-900/60 border border-white/10 rounded-xl flex items-center gap-4">
                      <img
                        src={currentArticle.thumbnail}
                        alt={currentArticle.title}
                        className="w-24 h-24 object-cover rounded-lg border border-white/10 shadow-lg"
                      />
                      <div className="text-xs text-slate-300">
                        <span className="font-semibold text-white block mb-1">Archived Visual Reference</span>
                        <p className="text-slate-400">{currentArticle.description || 'Encyclopedic thumbnail reference.'}</p>
                      </div>
                    </div>
                  )}

                  {/* Section Content Display */}
                  <div className="space-y-6 text-slate-200 leading-relaxed text-sm">
                    {currentArticle.sections && currentArticle.sections.length > 0 ? (
                      currentArticle.sections.map((section, idx) => (
                        <div
                          key={idx}
                          id={`sec-${idx}`}
                          className={`p-5 rounded-xl border transition-all ${
                            activeSectionIdx === idx
                              ? 'bg-slate-900/60 border-cyan-500/30 shadow-lg'
                              : 'bg-slate-900/20 border-white/5'
                          }`}
                        >
                          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2 border-b border-white/5 pb-2">
                            <span className="text-cyan-400 font-mono text-xs">§ {idx + 1}</span>
                            <span>{section.title}</span>
                          </h2>
                          <div className="space-y-3 font-normal text-slate-300">
                            {section.content.split('\n\n').map((para, pIdx) => (
                              <p key={pIdx} className="leading-7">{para}</p>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-300">{currentArticle.extract}</p>
                    )}
                  </div>

                  {/* Footnotes & References Section */}
                  {currentArticle.references && currentArticle.references.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <BookmarkCheck size={16} className="text-cyan-400" />
                          <span>Academic References & Citations ({currentArticle.references.length})</span>
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {currentArticle.references.slice(0, 16).map((ref, rIdx) => (
                          <div
                            key={rIdx}
                            className="p-2.5 rounded-lg bg-slate-900/50 border border-white/5 hover:border-cyan-500/30 transition-all flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-cyan-400 font-mono font-semibold text-[10px] mt-0.5">[{ref.index || rIdx + 1}]</span>
                              <span className="text-slate-300 line-clamp-2">{ref.text}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleCopyCitation(ref, rIdx)}
                                title="Copy citation text"
                                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                              >
                                {copiedCitationIdx === rIdx ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                              {ref.url && (
                                <a
                                  href={ref.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Visit original primary source"
                                  className="p-1 hover:bg-white/10 rounded text-cyan-400 hover:text-cyan-300"
                                >
                                  <ArrowUpRight size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <BookOpen size={32} className="text-slate-600" />
                  <p className="text-sm">No article selected. Search above or pick an offline entry.</p>
                </div>
              )}
            </main>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: AI DEEP RESEARCH & CITATION SYNTHESIS             */}
        {/* ========================================================= */}
        {activeTab === 'research' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Prompt & Inquiries Console */}
            <div className="w-80 bg-slate-900/60 border-r border-white/10 p-5 flex flex-col shrink-0 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Sparkles size={14} /> Grounded AI Scholar
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dual inference synthesizes verified Wikipedia reference texts with strict footnote citations.
                  </p>
                </div>

                <form onSubmit={handleRunDeepResearch} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Research Subject / Topic</label>
                    <input
                      type="text"
                      value={researchTopic}
                      onChange={(e) => setResearchTopic(e.target.value)}
                      placeholder="e.g. Quantum Computing, Zero-Knowledge Proofs..."
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 focus:border-purple-500/50 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Specific Research Question (Optional)</label>
                    <textarea
                      rows={3}
                      value={researchQuestion}
                      onChange={(e) => setResearchQuestion(e.target.value)}
                      placeholder="e.g. What are the key bottlenecks and mathematical proofs behind this?"
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 focus:border-purple-500/50 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isResearching || !researchTopic.trim()}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isResearching ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Synthesizing Grounded Citations...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>Execute Deep Research</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Preset Research Inquiry Chips */}
                <div className="pt-3 border-t border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Preset Inquiries</span>
                  <div className="space-y-1.5">
                    {[
                      'Fundamental architecture & historical origin',
                      'Mathematical proofs and algorithmic foundation',
                      'Modern enterprise and real-world deployment',
                      'Open controversies, security risks & limitations',
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => setResearchQuestion(chip)}
                        className="w-full text-left p-2 rounded bg-slate-950/60 hover:bg-purple-950/40 border border-white/5 hover:border-purple-500/30 text-[11px] text-slate-300 hover:text-purple-200 transition-all truncate"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-500/20 text-[11px] text-purple-300 space-y-1">
                  <div className="flex items-center gap-1 font-semibold">
                    <ShieldCheck size={13} className="text-purple-400" />
                    <span>Zero-Hallucination Grounding</span>
                  </div>
                  <p className="text-slate-400 leading-normal">
                    The dual neural core validates facts against Wikipedia REST extracts and appends verifiable bracketed citations.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Synthesis & Citations Display */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-950 select-text flex flex-col">
              {isResearching ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="relative">
                    <RefreshCw size={36} className="animate-spin text-purple-400" />
                    <Sparkles size={16} className="absolute inset-0 m-auto text-cyan-300 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium text-slate-200">Retrieving encyclopedic corpora & synthesizing verified footnotes...</p>
                  <p className="text-xs text-slate-500">Querying dual inference engine (Aura / Nova)...</p>
                </div>
              ) : researchResult ? (
                <div className="max-w-4xl mx-auto w-full space-y-6">
                  {/* Synthesis Title & Export Actions */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h2 className="text-2xl font-extrabold text-white">
                        Deep Research: <span className="text-purple-400">{researchResult.topic}</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">{researchResult.question}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyBibliography}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 hover:text-white border border-white/10 transition-all"
                      >
                        {copiedBib ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copiedBib ? 'Copied BibTeX' : 'Copy Bibliography'}</span>
                      </button>

                      <button
                        onClick={handleExportResearch}
                        disabled={isExporting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-semibold text-xs shadow-md shadow-cyan-500/20 transition-all"
                      >
                        <FileText size={13} />
                        <span>Export to Word Studio</span>
                      </button>
                    </div>
                  </div>

                  {/* AI Generated Prose */}
                  <div className="p-6 rounded-xl bg-slate-900/60 border border-purple-500/20 shadow-xl space-y-4 text-slate-200 text-sm leading-relaxed">
                    {researchResult.answer.split('\n\n').map((paragraph, pIdx) => {
                      if (paragraph.startsWith('### ') || paragraph.startsWith('## ') || paragraph.startsWith('# ')) {
                        const title = paragraph.replace(/^#+\s*/, '');
                        return <h3 key={pIdx} className="text-base font-bold text-white pt-2 border-b border-white/5 pb-1">{title}</h3>;
                      }

                      // Highlight bracketed citations like [1] or [2] as clickable pills
                      const parts = paragraph.split(/(\[\d+\])/g);
                      return (
                        <p key={pIdx} className="leading-7">
                          {parts.map((part, partIdx) => {
                            const match = part.match(/\[(\d+)\]/);
                            if (match) {
                              const citNum = parseInt(match[1], 10);
                              return (
                                <button
                                  key={partIdx}
                                  onClick={() => setSelectedCitation(citNum)}
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 text-[11px] font-mono font-bold rounded bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border border-purple-500/40 cursor-pointer transition-all"
                                >
                                  [{citNum}]
                                </button>
                              );
                            }
                            return part;
                          })}
                        </p>
                      );
                    })}
                  </div>

                  {/* Verified Citations Panel */}
                  <div className="pt-4 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                      <BookmarkCheck size={14} className="text-purple-400" />
                      <span>Verified Footnote Sources ({researchResult.citations.length})</span>
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {researchResult.citations.map((cit) => (
                        <div
                          key={cit.index}
                          className={`p-3.5 rounded-xl border transition-all ${
                            selectedCitation === cit.index
                              ? 'bg-purple-950/50 border-purple-400 ring-2 ring-purple-500/30'
                              : 'bg-slate-900/50 border-white/5 hover:border-purple-500/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span className="text-purple-400 font-mono">[{cit.index}]</span>
                              <span>{cit.title}</span>
                            </span>
                            <a
                              href={cit.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 p-1"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-3 leading-normal">{cit.snippet}</p>
                          <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                            <span>{cit.publisher}</span>
                            <span className="font-mono text-cyan-400">Ground-truth verified</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Sparkles size={32} className="text-purple-500/40" />
                  <p className="text-sm">Enter a topic on the left to generate cited encyclopedic research.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: OFFLINE KNOWLEDGE PACKS (100GB+ ARCHIVES)          */}
        {/* ========================================================= */}
        {activeTab === 'packs' && (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-950 space-y-8 select-text">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Header Info */}
              <div className="border-b border-white/10 pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <HardDrive size={22} className="text-amber-400" />
                      <span>Offline Knowledge Packs & ZIM Planetary Archives</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Download complete air-gapped snapshots of human knowledge ranging from compact 1.2GB starter packs to the full 102GB all-media encyclopedia.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg text-amber-300 text-xs">
                    <ShieldCheck size={14} className="text-amber-400" />
                    <span>100% Air-Gapped Survival Ready</span>
                  </div>
                </div>
              </div>

              {/* Architecture & Sizing Advisory Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2">
                  <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                    <Cpu size={14} /> Hybrid Zero-Wait Architecture
                  </span>
                  <p className="text-xs text-slate-400 leading-normal">
                    You do not need to download 100GB to use the encyclopedia. NovAura queries live Wikipedia seamlessly and stores read articles into local Dexie IndexedDB automatically.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <HardDrive size={14} /> Full 24GB Text vs 102GB Media
                  </span>
                  <p className="text-xs text-slate-400 leading-normal">
                    The entire written record of English Wikipedia fits in ~24GB compressed ZIM. The 102GB archive includes full photo illustrations, diagrams, and historical plates.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2">
                  <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Database size={14} /> BitTorrent & Direct Mirrors
                  </span>
                  <p className="text-xs text-slate-400 leading-normal">
                    Use high-speed direct downloads or BitTorrent magnet links to pull archives over decentralized swarms with resume support.
                  </p>
                </div>
              </div>

              {/* Catalog Cards */}
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Available Knowledge Pack Distributions
                </span>

                <div className="space-y-3">
                  {KNOWLEDGE_PACKS_CATALOG.map((pack) => (
                    <div
                      key={pack.id}
                      className="p-5 rounded-xl bg-slate-900/70 border border-white/10 hover:border-amber-500/30 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 max-w-2xl">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{pack.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-white/5">
                            {pack.size}
                          </span>
                          <span className="text-[10px] text-slate-400">{pack.articlesCount} articles</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-normal">{pack.description}</p>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="text-cyan-400 font-medium">Recommended for:</span>
                          <span>{pack.recommendedFor}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={pack.zimUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all"
                        >
                          <Download size={13} />
                          <span>Direct ZIM</span>
                        </a>

                        <a
                          href={pack.torrentMagnet}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs transition-all"
                        >
                          <Share2 size={13} className="text-cyan-400" />
                          <span>Magnet P2P</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Local Storage Metrics */}
              <div className="p-5 rounded-xl bg-slate-900/40 border border-white/5 space-y-3">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Database size={15} className="text-emerald-400" />
                  <span>Local Sovereign Disk Cache Status</span>
                </span>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Currently Indexed in Private Dexie DB: <strong className="text-white">{storedArticles.length} entries</strong></span>
                  <button
                    onClick={async () => {
                      for (const a of storedArticles) {
                        await encyclopediaService.deleteArticle(a.id);
                      }
                      refreshStoredArticles();
                    }}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    <span>Flush Local Cache</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
