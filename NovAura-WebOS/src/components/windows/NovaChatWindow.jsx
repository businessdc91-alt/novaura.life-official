import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bot, Send, X, Maximize2, Minimize2, ExternalLink,
  Trash2, FileCode, Copy, Check, Download, ChevronDown,
  Loader2, Sparkles, Cpu, Wifi, WifiOff, Eye,
  FolderOpen, Terminal, Image, Globe, Zap, MessageCircle, Minus
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useKernel } from '../../kernel/useKernel.js';

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
function MessageBubble({ message, onSaveToIDE }) {
  const isUser = message.role === 'user';
  const content = message.content || '';

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
        <div className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-primary/20 border border-primary/30 text-white/90'
            : 'bg-white/5 border border-white/10 text-white/80'
        }`}>
          {parts.map((part, i) =>
            part.type === 'code'
              ? <CodeBlock key={i} code={part.content} language={part.language} onSaveToIDE={onSaveToIDE} />
              : <p key={i} className="whitespace-pre-wrap">{part.content}</p>
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

// ─── Main NovaChatWindow ──────────────────────────────────────────────────────
export default function NovaChatWindow({ kernel: kernelProp, isPopout = false, onClose }) {
  const kernelFromHook = useKernel();
  const kernel = kernelProp || kernelFromHook;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [context, setContext] = useState(null);
  const [showContext, setShowContext] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Get NovaAgent from kernel
  const agent = kernel?.nova;

  useEffect(() => {
    if (!agent) return;

    // Initial load
    setMessages(agent.getMessages());
    setContext(agent.getContext());
    setThinking(agent._thinking);

    // Subscribe to state changes
    const unsub = agent.onStateChange((event) => {
      if (event === 'messages') setMessages([...agent.getMessages()]);
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

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !agent) return;

    setInput('');
    const { response, toolResults } = await agent.chat(text);

    // Show tool execution results as toasts
    if (toolResults?.length > 0) {
      for (const tr of toolResults) {
        if (tr.success) {
          toast.success(`Nova executed: ${tr.tool}`, { duration: 3000 });
        } else {
          toast.error(`Tool failed: ${tr.tool} — ${tr.error}`, { duration: 5000 });
        }
      }
    }
  }, [input, agent]);

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
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center relative">
            <Bot className="w-4 h-4 text-white" />
            {thinking && (
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white/90">Nova</h3>
            <p className="text-[9px] text-white/30">
              {thinking ? 'Thinking...' : context?.ready ? 'Always here' : 'Connecting...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowContext(!showContext)}
            className={`p-1.5 rounded hover:bg-white/10 transition-colors ${showContext ? 'text-primary' : 'text-white/30'}`}
            title="Toggle context awareness"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleClear} className="p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors" title="Clear history">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {isPopout && (
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors" title="Minimize">
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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 via-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-white/70 mb-1">Hey — I'm Nova</h3>
            <p className="text-[11px] text-white/30 max-w-[250px] leading-relaxed">
              I'm always here. I can see what you're working on, create files, open apps,
              remember things across sessions, and help you build. Just talk to me.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || i}
            message={msg}
            onSaveToIDE={handleSaveToIDE}
          />
        ))}

        {thinking && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <Loader2 className="w-3 h-3 text-primary animate-spin" />
              <span className="text-[11px] text-white/40">Nova is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <QuickActions onAction={handleQuickAction} />

      {/* Input */}
      <div className="px-3 pb-3">
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-primary/40 transition-colors">
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
            className="p-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

