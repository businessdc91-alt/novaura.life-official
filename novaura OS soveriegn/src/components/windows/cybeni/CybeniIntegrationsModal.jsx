import React, { useState } from 'react';
import {
  X, Search, Sparkles, Flame, Globe, Cpu, Layers, HardDrive,
  Terminal, Mail, Bot, Copy, Check, ArrowRight, BookOpen,
  Code2, ExternalLink, HelpCircle, ShieldAlert, Zap,
  Database, Video, Share2, Key, Radio, Music,
  ShoppingBag, Gamepad2, Mic, Palette, Server, Cloud
} from 'lucide-react';
import {
  INTEGRATION_CATEGORIES,
  INTEGRATIONS_LIBRARY,
  filterIntegrations
} from '../../../services/cybeniIntegrationsLibrary.js';

const ICON_MAP = {
  Sparkles,
  Flame,
  Globe,
  Cpu,
  Layers,
  HardDrive,
  Terminal,
  Mail,
  Bot,
  Zap,
  Database,
  Video,
  Share2,
  Key,
  Radio,
  Music,
  ShoppingBag,
  Gamepad2,
  Mic,
  Palette,
  Server,
  Cloud,
  Code2,
  ShieldCheck: Globe,
  FolderOpen: HardDrive,
};

export default function CybeniIntegrationsModal({
  isOpen,
  onClose,
  onApplyIntegration,
  onAskAiToIntegrate,
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState(INTEGRATIONS_LIBRARY[0]);
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'faqs' | 'prompt'
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const filteredItems = filterIntegrations(selectedCategory, searchQuery);

  const handleCopyCode = () => {
    if (!selectedIntegration?.code) return;
    navigator.clipboard.writeText(selectedIntegration.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-6xl h-[88vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Cybeni Omni Studio — Production Integrations & Architecture Library
                </h2>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                  Emergent AI Studio v2.6
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Battle-tested cloud environments, databases, servers, email engines & AI SDKs with proven FAQs and 1-click AI scaffolding.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-800/80 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {INTEGRATION_CATEGORIES.map((cat) => {
              const IconComponent = ICON_MAP[cat.icon] || Sparkles;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Firebase, AWS, SQL, cPanel..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Two-Column Workspace: Left List + Right Detail/Studio */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Column: Integrations List */}
          <div className="w-80 md:w-96 border-r border-slate-800/80 bg-slate-950 flex flex-col overflow-y-auto p-3 space-y-2 shrink-0">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Available Architectures ({filteredItems.length})
            </div>

            {filteredItems.map((item) => {
              const isSelected = selectedIntegration?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedIntegration(item);
                    setActiveTab('code');
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-purple-950/40 border-purple-500/60 shadow-md shadow-purple-950/50'
                      : 'bg-slate-900/60 border-slate-800/70 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {item.vendor}
                    </span>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${item.color}15`,
                        color: item.color,
                        border: `1px solid ${item.color}30`,
                      }}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                    {item.description}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-800/50 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="truncate max-w-[180px]">{item.suggestedPath}</span>
                    <span className="text-slate-400 group-hover:text-cyan-300 flex items-center gap-1">
                      Inspect <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs">
                No matching integrations found for "{searchQuery}".
              </div>
            )}
          </div>

          {/* Right Column: Integration Studio Details */}
          {selectedIntegration ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/20">
              
              {/* Detail Header & Action Buttons */}
              <div className="p-4 bg-slate-900/70 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedIntegration.color }}
                    />
                    <h2 className="text-sm font-bold text-white">
                      {selectedIntegration.title}
                    </h2>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                    Suggested Destination: <span className="text-cyan-400">{selectedIntegration.suggestedPath}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={() => onApplyIntegration(selectedIntegration)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-purple-950 text-purple-300 border border-purple-500/40 text-xs font-semibold transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Scaffold into Project</span>
                  </button>

                  <button
                    onClick={() => onAskAiToIntegrate(selectedIntegration)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span>Integrate with Cybeni AI</span>
                  </button>
                </div>
              </div>

              {/* Detail Navigation Tabs */}
              <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center gap-4 text-xs font-medium shrink-0">
                <button
                  onClick={() => setActiveTab('code')}
                  className={`pb-1.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'code'
                      ? 'border-purple-500 text-purple-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Verified Implementation</span>
                </button>

                <button
                  onClick={() => setActiveTab('faqs')}
                  className={`pb-1.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'faqs'
                      ? 'border-purple-500 text-purple-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Architectural FAQs & Gotchas ({selectedIntegration.faqs?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('prompt')}
                  className={`pb-1.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'prompt'
                      ? 'border-purple-500 text-purple-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>AI Agent Execution Plan</span>
                </button>
              </div>

              {/* Tab Content Display */}
              <div className="flex-1 p-4 overflow-y-auto font-mono text-xs">
                {activeTab === 'code' && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner overflow-x-auto text-slate-200 leading-relaxed">
                    <pre>{selectedIntegration.code}</pre>
                  </div>
                )}

                {activeTab === 'faqs' && (
                  <div className="space-y-3 font-sans">
                    <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-purple-200 flex items-center gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>These FAQs address verified production gotchas, rate limits, and common multi-cloud integration traps.</span>
                    </div>

                    {selectedIntegration.faqs?.map((faq, i) => (
                      <div key={i} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                        <div className="text-xs font-bold text-cyan-300 flex items-start gap-2">
                          <span className="text-slate-500 font-mono">Q{i + 1}.</span>
                          <span>{faq.question}</span>
                        </div>
                        <div className="text-xs text-slate-300 pl-6 leading-relaxed">
                          {faq.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'prompt' && (
                  <div className="font-sans space-y-3">
                    <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-xs text-cyan-200 flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>When you click "Integrate with Cybeni AI", this exact architectural instruction is sent to the Cybeni Agent with your current workspace context.</span>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedIntegration.aiPrompt}
                      {'\n\nTarget File: ' + selectedIntegration.suggestedPath}
                      {'\nArchitecture Vendor: ' + selectedIntegration.vendor}
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Select an architecture from the left panel to inspect blueprints.
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
