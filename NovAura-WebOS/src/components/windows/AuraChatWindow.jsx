import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles, Send, X, Maximize2, Minimize2, ExternalLink,
  Trash2, FileCode, Copy, Check, Download, ChevronDown,
  Loader2, Bot, Cpu, Wifi, WifiOff, Eye,
  FolderOpen, Terminal, Image, Globe, Zap, MessageCircle, Minus,
  Shield, Star, Crown, Info
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useKernel } from '../../kernel/useKernel.js';

// ─── Code Block Component ────────────────────────────────────────────────────
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg bg-amber-950/20 border border-amber-500/10 overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/5 border-b border-amber-500/10">
        <span className="text-[10px] text-amber-500/50 font-mono">{language || 'code'}</span>
        <button onClick={handleCopy} className="p-1 rounded hover:bg-amber-500/10 text-amber-500/30 hover:text-amber-500/60 transition-colors">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className="p-3 text-[11px] text-amber-100/80 font-mono overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed">{code}</pre>
    </div>
  );
}

// ─── Message Renderer ─────────────────────────────────────────────────────────
function MessageBubble({ message, onRetry }) {
  const isUser = message.role === 'user';
  const content = message.content || '';
  const isError = message.isError;

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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : ''}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 flex items-center justify-center border border-amber-300/30">
              <Crown className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">Aura</span>
            <span className="text-[9px] text-amber-500/40 font-medium px-1.5 py-0.5 rounded bg-amber-500/5 border border-amber-500/10">Ambassador</span>
          </div>
        )}

        <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm relative group ${
          isUser
            ? 'bg-amber-500/10 border border-amber-500/20 text-white/90'
            : isError
              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
              : 'bg-[#1a1610] border border-amber-500/20 text-amber-50/90'
        }`}>
          {parts.map((part, i) =>
            part.type === 'code'
              ? <CodeBlock key={i} code={part.content} language={part.language} />
              : <p key={i} className="whitespace-pre-wrap">{part.content}</p>
          )}

          {isError && onRetry && (
            <button 
              onClick={onRetry}
              className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-400 hover:bg-amber-500/30 transition-all font-bold"
            >
              <Zap className="w-3 h-3" />
              RETRY REQUEST
            </button>
          )}
        </div>

        <div className={`text-[9px] text-amber-500/30 mt-1.5 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ─── Model Selector ───────────────────────────────────────────────────────────
function ModelSelector({ currentModel, onSelect }) {
  const models = [
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', desc: 'Deep Reasoning & Logic', color: 'text-amber-400' },
    { id: 'gemini-3.1-flash', name: 'Gemini 3.1 Flash', desc: 'Fast & Efficient', color: 'text-emerald-400' },
    { id: 'google/gemma-3-4b-it', name: 'Gemma 3 4B', desc: 'AIML API Fast', color: 'text-amber-400' },
    { id: 'webgpu-local', name: 'WebLLM (Local GPU)', desc: 'Privacy-First / Browser-Native', color: 'text-cyan-400' },
  ];

  const [isOpen, setIsOpen] = useState(false);
  const activeModel = models.find(m => m.id === currentModel) || models[0];

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all group"
      >
        <div className={`w-1.5 h-1.5 rounded-full ${activeModel.color} animate-pulse`} />
        <span className="text-[10px] font-medium text-white/60 group-hover:text-amber-400">{activeModel.name}</span>
        <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full mt-2 right-0 w-52 p-1 rounded-xl bg-[#1a1610] border border-amber-500/20 shadow-2xl z-50 backdrop-blur-xl"
          >
            {models.map(m => (
              <button
                key={m.id}
                onClick={() => { onSelect(m.id); setIsOpen(false); }}
                className={`w-full text-left p-2.5 rounded-lg transition-colors flex flex-col gap-0.5 ${
                  currentModel === m.id ? 'bg-amber-500/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${m.color}`}>{m.name}</span>
                  {currentModel === m.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <span className="text-[9px] text-white/30">{m.desc}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main AuraChatWindow ──────────────────────────────────────────────────────
export default function AuraChatWindow({ userTier, isPopout = false, onClose }) {
  const [isOpen, setIsOpen] = useState(!isPopout); // If popout, start closed; otherwise start open
  const kernel = useKernel();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [model, setModel] = useState('gemini-3.1-pro'); // Aura defaults to Pro
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const agent = kernel?.nova; // We use the same agent but with Aura persona

  useEffect(() => {
    if (!agent) return;
    setMessages(agent.getMessages().filter(m => m.persona === 'aura' || !m.persona));
    
    const unsub = agent.onStateChange((event) => {
      if (event === 'messages') {
        const msgs = agent.getMessages();
        setMessages(msgs.filter(m => m.persona === 'aura' || !m.persona));
      }
      if (event === 'thinking') setThinking(agent._thinking);
    });

    return () => unsub();
  }, [agent]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  const handleSend = useCallback(async (textOverride) => {
    const text = (typeof textOverride === 'string' ? textOverride : input).trim();
    if (!text || !agent) return;

    if (!textOverride) setInput('');
    // Use the persona 'aura' to route through Gemini Pro (cloud) and set the tone
    await agent.chat(text, { persona: 'aura', model });
  }, [input, agent, model]);

  const handleRetry = useCallback(() => {
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

  const chatContent = (
    <div className={`flex flex-col h-full bg-[#0d0d0d] text-white ${isPopout ? 'rounded-2xl border border-amber-500/20 shadow-2xl overflow-hidden' : ''}`}>
      {/* Premium Header */}
      <div className="px-6 py-5 bg-gradient-to-b from-amber-900/10 to-transparent border-b border-amber-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 p-[1px]">
              <div className="w-full h-full rounded-2xl bg-[#0d0d0d] flex items-center justify-center overflow-hidden">
                <div className="relative">
                  <Crown className="w-6 h-6 text-amber-500" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-amber-500 blur-xl rounded-full"
                  />
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
                Aura
              </h2>
              <p className="text-[10px] text-amber-500/50 font-medium">Ambassador</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector currentModel={model} onSelect={setModel} />
            {isPopout && (
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-2 scrollbar-custom">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
            <div className="w-20 h-20 rounded-full bg-amber-500/5 flex items-center justify-center mb-6 border border-amber-500/10">
              <Sparkles className="w-10 h-10 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-amber-100 mb-2">Welcome to the NovAura Ecosystem</h3>
            <p className="text-sm text-amber-500/40 leading-relaxed">
              I am Aura, your guide to this digital frontier. Whether you're building empires or seeking inspiration, 
              I am here to ensure your journey is seamless and powerful.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-8 w-full">
              {['Take a Tour', 'System Status', 'Account Upgrade', 'New Project'].map(t => (
                <button key={t} className="px-4 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all font-medium">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble 
            key={msg.id || i} 
            message={msg} 
            onRetry={i === messages.length - 1 ? handleRetry : undefined}
          />
        ))}

        {thinking && (
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
            </div>
            <span className="text-[11px] text-amber-500/40 font-medium italic">Aura is consulting the core...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 bg-gradient-to-t from-black/40 to-transparent">
        <div className="relative group">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Address the Ambassador..."
            rows={1}
            className="w-full pl-5 pr-14 py-4 bg-[#1a1610] border border-amber-500/20 rounded-2xl text-sm text-amber-50 placeholder-amber-500/20 resize-none outline-none focus:border-amber-500/40 transition-all shadow-2xl"
            style={{ minHeight: '56px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || thinking}
            className="absolute right-3 top-3 p-2.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-20 disabled:grayscale transition-all shadow-lg shadow-amber-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-3 px-2">
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1 text-[9px] uppercase tracking-tighter transition-colors ${window.isSecureContext ? 'text-amber-500/40' : 'text-red-500/50'}`}>
              <Shield className="w-3 h-3" /> {window.isSecureContext ? 'Secure Channel' : 'Insecure Connection'}
            </span>
            <span className="flex items-center gap-1 text-[9px] text-amber-500/40 uppercase tracking-tighter">
              <Zap className="w-3 h-3" /> {userTier?.toUpperCase() || 'FREE'} TIER ENABLED
            </span>
          </div>
          <p className="text-[9px] text-amber-500/20 font-mono italic">
            ver. 2.1 — aura_ambassador_node_{Math.random().toString(36).substring(7)}
          </p>
        </div>
      </div>
    </div>
  );

  if (isPopout) {
    return (
      <>
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              key="aura-orb"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              onClick={() => setIsOpen(true)}
              className="fixed bottom-24 right-6 z-[860] w-12 h-12 rounded-full bg-black/80 border border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.15)] flex items-center justify-center hover:border-amber-400/70 hover:shadow-[0_0_30px_rgba(251,191,36,0.25)] transition-all group backdrop-blur-sm"
              title="Aura Ambassador"
            >
              <div className="relative">
                <Crown className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="aura-panel"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              className="fixed bottom-24 right-[404px] z-[860] w-[380px] overflow-hidden"
              style={{ maxHeight: 560 }}
            >
              {chatContent}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return chatContent;
}
