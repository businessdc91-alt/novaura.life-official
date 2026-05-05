import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bot, Send, X, Maximize2, Minimize2, ExternalLink,
  Trash2, FileCode, Copy, Check, Download, ChevronDown,
  Loader2, Sparkles, Cpu, Wifi, WifiOff, Eye,
  FolderOpen, Terminal, Image, Globe, Zap, MessageCircle, Minus,
  Search, RefreshCw
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useKernel } from '../../kernel/useKernel.js';
import { BACKEND_URL } from '../../services/aiService.js';

// ─── Code Block Component ────────────────────────────────────────────────────
function CodeBlock({ code, language, onSaveToIDE }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg bg-black/60 border border-white/10 overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
        <span className="text-[10px] text-white/30 font-mono">{language || 'code'}</span>
        <div className="flex items-center gap-1">
          {onSaveToIDE && (
            <button onClick={() => onSaveToIDE(code, language)} className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-primary transition-colors" title="Save to IDE">
              <FileCode className="w-3 h-3" />
            </button>
          )}
          <button onClick={handleCopy} className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors" title="Copy">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <pre className="p-3 text-[11px] text-emerald-300/90 font-mono overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed">{code}</pre>
    </div>
  );
}

// ─── Tool Result Badge ────────────────────────────────────────────────────────
function ToolResultBadge({ result }) {
  const icon = result.success
    ? <Check className="w-3 h-3 text-emerald-400" />
    : <X className="w-3 h-3 text-red-400" />;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono ${
      result.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
    }`}>
      {icon}
      <span>{result.tool}</span>
      {result.result?.path && <span className="text-white/30">→ {result.result.path}</span>}
    </div>
  );
}

// ─── Message Renderer ─────────────────────────────────────────────────────────
function MessageBubble({ message, onSaveToIDE, onRetry }) {
  const isUser = message.role === 'user';
  const content = message.content || '';
  const isError = message.isError;

  // Parse code blocks from content
  const parts = useMemo(() => {
    const segments = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      segments.push({ type: 'code', language: match[1], content: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      segments.push({ type: 'text', content: content.slice(lastIndex) });
    }
    return segments.length > 0 ? segments : [{ type: 'text', content }];
  }, [content]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : ''}`}>
        {/* Avatar */}
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <span className="text-[10px] text-primary/60 font-medium">Nova</span>
            {message.context?.activeWindow && (
              <span className="text-[9px] text-white/20">• watching {message.context.activeWindow}</span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed relative group ${
          isUser
            ? 'bg-primary/20 border border-primary/30 text-white/90'
            : isError 
              ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
              : 'bg-white/5 border border-white/10 text-white/80'
        }`}>
          {parts.map((part, i) =>
            part.type === 'code'
              ? <CodeBlock key={i} code={part.content} language={part.language} onSaveToIDE={onSaveToIDE} />
              : <p key={i} className="whitespace-pre-wrap">{part.content}</p>
          )}

          {isError && onRetry && (
            <button 
              onClick={onRetry}
              className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-[10px] text-red-400 hover:bg-red-500/30 transition-all"
            >
              <Zap className="w-3 h-3" />
              Retry Request
            </button>
          )}
        </div>

        {/* Tool call results */}
        {message.toolCalls?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.toolCalls.map((tc, i) => <ToolResultBadge key={i} result={tc} />)}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-[9px] text-white/20 mt-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ─── Context Bar ──────────────────────────────────────────────────────────────
function ContextBar({ context }) {
  if (!context) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-white/3 border-b border-white/5 text-[10px] text-white/30">
      {context.activeWindow && (
        <span className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {context.activeWindow.title || context.activeWindow.type}
        </span>
      )}
      {context.recentFiles?.length > 0 && (
        <span className="flex items-center gap-1">
          <FolderOpen className="w-3 h-3" />
          {context.recentFiles[0]}
        </span>
      )}
      <span className="flex items-center gap-1 ml-auto">
        <Zap className="w-3 h-3" />
        {context.ready ? 'Connected' : 'Connecting...'}
      </span>
    </div>
  );
}

// ─── Quick Actions ─────────────────────────────────────────────────────────────
function QuickActions({ onAction }) {
  const actions = [
    { icon: FileCode, label: 'New file', action: 'create_file' },
    { icon: Terminal, label: 'Terminal', action: 'open_terminal' },
    { icon: Globe, label: 'Browse', action: 'open_browser' },
    { icon: Image, label: 'PixAI', action: 'open_pixai' },
  ];

  return (
    <div className="flex items-center gap-1 px-3 py-1.5">
      {actions.map(a => (
        <button
          key={a.action}
          onClick={() => onAction(a.action)}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 hover:bg-primary/20 border border-white/5 hover:border-primary/30 text-[10px] text-white/40 hover:text-primary transition-all"
        >
          <a.icon className="w-3 h-3" />
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ─── Model Selector (Dynamic — live from OpenRouter catalog) ─────────────────
const CATEGORY_TABS = ['all', 'general', 'coding', 'reasoning', 'vision'];
const FALLBACK_MODELS = [
  { id: 'google/gemma-4-31b-it:free',                   name: 'Gemma 4 31B',        isFree: true,  categories: ['general'], contextLength: 131072 },
  { id: 'google/gemma-4-26b-a4b-it:free',               name: 'Gemma 4 26B A4B',    isFree: true,  categories: ['general'], contextLength: 131072 },
  { id: 'qwen/qwen3-coder-480b-a35b:free',              name: 'Qwen3 Coder 480B',   isFree: true,  categories: ['coding'],  contextLength: 131072 },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1:free',  name: 'Nemotron Super 49B', isFree: true,  categories: ['general'], contextLength: 131072 },
  { id: 'qwen/qwen3-80b-a3b:free',                      name: 'Qwen3 80B A3B',      isFree: true,  categories: ['general'], contextLength: 40960  },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free',    name: 'Hermes 3 405B',      isFree: true,  categories: ['general'], contextLength: 131072 },
  { id: 'google/gemini-2.0-flash-001',                  name: 'Gemini 2.0 Flash',   isFree: false, categories: ['general'], contextLength: 1048576 },
  { id: 'qwen/qwen-max',                                name: 'Qwen Max',            isFree: false, categories: ['reasoning'], contextLength: 131072 },
];

function ModelSelector({ currentModel, onSelect }) {
  const [isOpen, setIsOpen]         = useState(false);
  const [models, setModels]         = useState(FALLBACK_MODELS);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [activeTab, setActiveTab]   = useState('all');
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch live models when the picker opens for the first time
  const fetchModels = useCallback(async (force = false) => {
    if ((hasFetched && !force) || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/ai/models?free=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.models?.length) {
          // Sort: longer context first, then alphabetically
          data.models.sort((a, b) => (b.contextLength || 0) - (a.contextLength || 0) || a.name.localeCompare(b.name));
          setModels(data.models);
          setHasFetched(true);
        }
      }
    } catch {
      // silently keep fallback
    } finally {
      setLoading(false);
    }
  }, [hasFetched, loading]);

  const handleOpen = () => {
    setIsOpen(true);
    fetchModels();
  };

  const filtered = useMemo(() => {
    let list = models;
    if (activeTab !== 'all') list = list.filter(m => m.categories?.includes(activeTab));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(m => m.id.toLowerCase().includes(s) || m.name.toLowerCase().includes(s));
    }
    return list;
  }, [models, activeTab, search]);

  const activeModel = models.find(m => m.id === currentModel) || FALLBACK_MODELS[0];

  const formatCtx = (n) => {
    if (!n) return '';
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M ctx`;
    if (n >= 1_000) return `${Math.round(n/1_000)}K ctx`;
    return `${n} ctx`;
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all group"
      >
        <div className={`w-1 h-1 rounded-full ${activeModel.isFree ? 'bg-emerald-400' : 'bg-cyan-400'} animate-pulse`} />
        <span className="text-[9px] font-medium text-white/50 group-hover:text-cyan-400 max-w-[80px] truncate">{activeModel.name}</span>
        {loading
          ? <RefreshCw className="w-2.5 h-2.5 text-white/20 animate-spin" />
          : <ChevronDown className={`w-2.5 h-2.5 text-white/20 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        }
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full mt-1.5 right-0 w-72 rounded-xl bg-[#0a0a12] border border-cyan-500/20 shadow-2xl z-50 backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">OpenRouter Models</span>
              <button
                onClick={() => fetchModels(true)}
                className="p-1 rounded hover:bg-white/10 text-white/20 hover:text-cyan-400 transition-colors"
                title="Refresh model catalog"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search */}
            <div className="px-2 py-1.5 border-b border-white/5">
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
                <Search className="w-3 h-3 text-white/20" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search models..."
                  className="flex-1 bg-transparent text-[10px] text-white/70 placeholder-white/20 outline-none"
                />
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-white/5 overflow-x-auto">
              {CATEGORY_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 py-0.5 rounded text-[8px] font-medium capitalize transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Model list */}
            <div className="max-h-[260px] overflow-y-auto p-1">
              {loading && filtered.length === 0 ? (
                <div className="flex items-center justify-center py-4 gap-2 text-white/20">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[10px]">Loading catalog...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-4 text-[10px] text-white/20">No models found</div>
              ) : (
                filtered.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { onSelect(m.id); setIsOpen(false); setSearch(''); }}
                    className={`w-full text-left p-2 rounded-lg transition-colors flex items-start justify-between gap-2 ${
                      currentModel === m.id ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-white/70 truncate">{m.name}</span>
                        {m.isFree && (
                          <span className="shrink-0 text-[7px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">FREE</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-white/20 truncate">{m.id.split('/')[0]}</span>
                        {m.contextLength > 0 && (
                          <span className="text-[8px] text-cyan-400/50">{formatCtx(m.contextLength)}</span>
                        )}
                      </div>
                    </div>
                    {currentModel === m.id && <Check className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[8px] text-white/15">{filtered.length} models</span>
              <button onClick={() => setIsOpen(false)} className="text-[8px] text-white/20 hover:text-white/40">
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-outside dismiss */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

// ─── Main NovaChatWindow ──────────────────────────────────────────────────────
export default function NovaChatWindow({ kernel: kernelProp, isPopout = false, onClose }) {
  const kernelFromHook = useKernel();
  const kernel = kernelProp || kernelFromHook;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [model, setModel] = useState('openrouter:google/gemma-4-31b-it:free'); // Nova defaults to Gemma 4 31B via OpenRouter
  const [context, setContext] = useState(null);
  const [showContext, setShowContext] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Get NovaAgent from kernel
  const agent = kernel?.nova;

  useEffect(() => {
    if (!agent) return;

    // Initial load - filter for Nova persona or no persona
    setMessages(agent.getMessages().filter(m => m.persona === 'nova' || !m.persona));
    setContext(agent.getContext());
    setThinking(agent._thinking);

    // Subscribe to state changes
    const unsub = agent.onStateChange((event) => {
      if (event === 'messages') {
        const msgs = agent.getMessages();
        setMessages(msgs.filter(m => m.persona === 'nova' || !m.persona));
      }
      if (event === 'thinking') setThinking(agent._thinking);
      if (event === 'ready') setContext(agent.getContext());
    });

    // Context polling (lightweight)
    const contextInterval = setInterval(() => {
      setContext(agent.getContext());
    }, 5000);

    return () => {
      unsub();
      clearInterval(contextInterval);
    };
  }, [agent]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Focus input when opened (popout mode)
  useEffect(() => {
    if (isOpen && isPopout) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isPopout]);

  const handleSend = useCallback(async (textOverride) => {
    const text = (typeof textOverride === 'string' ? textOverride : input).trim();
    if (!text || !agent) return;

    if (!textOverride) setInput('');

    // If user manually selected an openrouter model, bypass persona routing and call directly
    if (model.startsWith('openrouter:')) {
      const orModel = model.replace('openrouter:', '');
      const result = await agent.chat(text, { persona: 'nova', model: orModel, provider: 'openrouter', overrideProvider: true });
      if (result.toolResults?.length > 0) {
        for (const tr of result.toolResults) {
          if (tr.success) toast.success(`Nova executed: ${tr.tool}`, { duration: 3000 });
          else toast.error(`Tool failed: ${tr.tool} — ${tr.error}`, { duration: 5000 });
        }
      }
      return;
    }

    const result = await agent.chat(text, { persona: 'nova', model });
    
    // If successful, result is { response, toolResults }
    // If failed, result is { response, toolResults, isError: true }

    // Show tool execution results as toasts
    if (result.toolResults?.length > 0) {
      for (const tr of result.toolResults) {
        if (tr.success) {
          toast.success(`Nova executed: ${tr.tool}`, { duration: 3000 });
        } else {
          toast.error(`Tool failed: ${tr.tool} — ${tr.error}`, { duration: 5000 });
        }
      }
    }
  }, [input, agent, model]);

  const handleRetry = useCallback(() => {
    // Find the last user message to retry
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      handleSend(lastUserMsg.content);
    }
  }, [messages, handleSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveToIDE = useCallback(async (code, language) => {
    if (!agent) return;
    const ext = { javascript: 'js', typescript: 'ts', python: 'py', html: 'html', css: 'css', json: 'json', jsx: 'jsx' }[language] || 'txt';
    const filename = `nova_snippet_${Date.now()}.${ext}`;
    await agent._executeTool('save_to_ide', { filename, content: code, language: language || 'plaintext' });
    toast.success(`Saved to IDE: ${filename}`);
  }, [agent]);

  const handleQuickAction = useCallback(async (action) => {
    if (!agent) return;
    switch (action) {
      case 'create_file':
        setInput('Create a new file for me called ');
        inputRef.current?.focus();
        break;
      case 'open_terminal':
        await agent._executeTool('open_window', { type: 'terminal', title: 'Terminal' });
        break;
      case 'open_browser':
        await agent._executeTool('open_window', { type: 'browser', title: 'Browser' });
        break;
      case 'open_pixai':
        await agent._executeTool('open_window', { type: 'pixai', title: 'PixAI Art Studio' });
        break;
    }
  }, [agent]);

  const handleClear = useCallback(async () => {
    if (!agent) return;
    if (!window.confirm('Clear all conversation history with Nova? This cannot be undone.')) return;
    await agent.clearConversation();
    toast.success('Conversation cleared');
  }, [agent]);

  // Greeting if no messages
  const showGreeting = messages.length === 0;

  // ─── Chat Panel Content ────────────────────────────────────────────────────
  const chatContent = (
    <div className={`flex flex-col h-full bg-gradient-to-b from-[#0c0c14] to-[#08080f] text-white ${isPopout ? 'rounded-2xl border border-white/10 shadow-[0_12px_60px_rgba(0,0,0,0.7),0_0_1px_rgba(0,240,255,0.08)]' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 flex items-center justify-center relative">
            <Bot className="w-4 h-4 text-white" />
            {thinking && (
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white/90">Nova</h3>
            <p className="text-[9px] text-white/30">
              {thinking ? 'Thinking...' : context?.ready ? 'Always here' : 'Connecting...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ModelSelector currentModel={model} onSelect={setModel} />
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <button
            onClick={() => setShowContext(!showContext)}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${showContext ? 'text-cyan-400' : 'text-white/30'}`}
            title="Toggle context awareness"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleClear} className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors" title="Clear history">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {isPopout && (
            <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors" title="Minimize">
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Context awareness bar */}
      {showContext && <ContextBar context={context} />}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3" style={isPopout ? { maxHeight: 340 } : {}}>
        {showGreeting && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/70 mb-1">Hey — I'm Nova</h3>
            <p className="text-[11px] text-white/30 max-w-[250px] leading-relaxed">
              I'm always here. I can see what you're working on, create files, open apps,
              remember things across sessions, and help you build.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || i}
            message={msg}
            onSaveToIDE={handleSaveToIDE}
            onRetry={i === messages.length - 1 ? handleRetry : undefined}
          />
        ))}

        {thinking && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
              <span className="text-[11px] text-white/40">Nova is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <QuickActions onAction={handleQuickAction} />

      {/* Input */}
      <div className="px-3 pb-3">
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-cyan-500/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to Nova..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white/90 placeholder-white/20 resize-none outline-none max-h-[120px]"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || thinking}
            className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {isPopout && (
          <p className="text-[9px] text-white/20 text-center mt-1.5 font-mono tracking-tight">
            continuous memory · tool calling · context aware
          </p>
        )}
      </div>
    </div>
  );

  // ─── Popout Mode: Floating Orb + Panel ────────────────────────────────────
  if (isPopout) {
    return (
      <>
        {/* Collapsed orb — bottom-right */}
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              key="nova-orb"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              onClick={() => setIsOpen(true)}
              className="fixed bottom-24 right-20 z-[860] w-12 h-12 rounded-full bg-black/80 border border-cyan-500/40 shadow-[0_0_20px_rgba(0,240,255,0.15)] flex items-center justify-center hover:border-cyan-400/70 hover:shadow-[0_0_30px_rgba(0,240,255,0.25)] transition-all group backdrop-blur-sm"
              title="Open Nova Chat"
            >
              <div className="relative">
                <Bot className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Expanded chat panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="nova-panel"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              className="fixed bottom-24 right-4 z-[860] w-[380px] overflow-hidden"
              style={{ maxHeight: 560 }}
            >
              {chatContent}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ─── Window Mode: Rendered inside WindowManager ────────────────────────────
  return chatContent;
}


