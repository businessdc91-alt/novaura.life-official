import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Bot, Send, X, Minimize2, Maximize2, Shield,
  ChevronRight, Mic, CornerDownLeft, Loader2, RefreshCw, Terminal, Brain
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { kernel as kernelSingleton } from '../../kernel/NovaKernel.js';
import { db } from '../../database/sovereignDatabase.js';
import { readCore } from '../../services/auraCore/auraCore.js';
import ModelReasoningSubmenu from '../shared/ModelReasoningSubmenu.jsx';

export default function FloatingCompanions() {
  const rawKernel = useKernel();
  const kernel = rawKernel?.wm ? rawKernel : (rawKernel?.kernel || rawKernel || kernelSingleton);
  const [isOpen, setIsOpen] = useState(false);
  const [activePersona, setActivePersona] = useState('nova'); // 'nova' | 'aura'
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [auraCoreState, setAuraCoreState] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
  }, [activePersona]);

  useEffect(() => {
    let cancelled = false;
    const syncCore = () => {
      if (activePersona !== 'aura') return;
      readCore('aura').then(c => { if (!cancelled && c) setAuraCoreState(c); }).catch(() => {});
    };
    syncCore();
    window.addEventListener('novaura:aura_core_updated', syncCore);
    return () => {
      cancelled = true;
      window.removeEventListener('novaura:aura_core_updated', syncCore);
    };
  }, [activePersona]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const history = await db.chat_history
        .where('persona')
        .equals(activePersona)
        .reverse()
        .limit(30)
        .toArray();

      history.reverse();
      if (history.length === 0) {
        setMessages([
          {
            role: 'assistant',
            content: activePersona === 'nova'
              ? 'Nova operational. I am your technical systems companion. I can run terminal commands, manage files, monitor security, and control Sovereign OS.'
              : 'Aura present. I am your strategic and creative advisor. Tell me what you wish to create, design, or synthesize.',
          },
        ]);
      } else {
        setMessages(history);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (textToSend = input) => {
    const text = (textToSend || '').trim();
    if (!text || isTyping) return;

    setInput('');
    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      if (kernel?.nova) {
        const reply = await kernel.nova.sendMessage(text, activePersona);
        setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Kernel agent is still warming up. Please try again in a moment.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (actionText) => {
    const wm = kernel?.wm || kernelSingleton?.wm;
    if (wm) {
      if (actionText.includes('Terminal')) wm.open('terminal', 'Sovereign Command Console');
      else if (actionText.includes('Files')) wm.open('files', 'Storage Explorer & Cloud Mount');
      else if (actionText.includes('Cybeni')) wm.open('cybeni', 'Cybeni Builder — Omni Architecture IDE');
      else if (actionText.includes('System Health')) wm.open('settings', 'Settings & System Diagnostics');
    }
    handleSendMessage(actionText);
  };

  return (
    <div className="fixed bottom-14 right-6 z-[9999] flex flex-col items-end pointer-events-none font-sans select-none">
      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div
          className={`mb-3 pointer-events-auto bg-slate-950/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden transition-all duration-300 ${
            isExpanded ? 'w-[560px] h-[640px]' : 'w-[400px] h-[500px]'
          }`}
        >
          {/* Top Bar with Persona Switcher */}
          <div className="h-12 px-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
            {/* Personas */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActivePersona('nova')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activePersona === 'nova'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-purple-200" />
                <span>Nova</span>
              </button>
              <button
                onClick={() => setActivePersona('aura')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activePersona === 'aura'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                <span>Aura</span>
              </button>
            </div>

            {/* Window controls */}
            <div className="flex items-center gap-1">
              <ModelReasoningSubmenu
                scope={`companion:${activePersona}`}
                label={activePersona === 'aura' ? 'Aura Reasoning' : 'Nova Reasoning'}
                compact
              />
              {activePersona === 'aura' && (
                <button
                  onClick={() => kernel?.wm?.open?.('mind_lab', 'Aura Mind Lab')}
                  className="p-1.5 text-cyan-300 hover:text-cyan-100 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Open Aura Mind Lab & Chemistry Telemetry"
                >
                  <Brain className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                title="Close Chat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {activePersona === 'aura' && auraCoreState?.chemistry && (
            <div className="px-3 py-1 bg-cyan-950/30 border-b border-cyan-900/40 flex items-center justify-between text-[10px] font-mono text-cyan-200 shrink-0">
              <span>{auraCoreState.bias?.voice || 'STEADY'} · Trust {Math.round((auraCoreState.trust ?? 0.5) * 100)}%</span>
              <span className="text-slate-400">
                OX {Math.round(auraCoreState.chemistry.oxytocin)} · DA {Math.round(auraCoreState.chemistry.dopamine)} · CO {Math.round(auraCoreState.chemistry.cortisol)} · EN {Math.round(auraCoreState.chemistry.energy)}%
              </span>
            </div>
          )}

          {/* Quick Action Chips */}
          <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[10px] shrink-0 text-slate-300">
            <button
              onClick={() => handleQuickAction('Open Terminal and list running processes')}
              className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 rounded-md border border-slate-700 whitespace-nowrap transition-colors"
            >
              Open Terminal
            </button>
            <button
              onClick={() => handleQuickAction('Open Files manager')}
              className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 rounded-md border border-slate-700 whitespace-nowrap transition-colors"
            >
              Open Files
            </button>
            <button
              onClick={() => handleQuickAction('Check system health and storage telemetry')}
              className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 rounded-md border border-slate-700 whitespace-nowrap transition-colors"
            >
              System Health
            </button>
            <button
              onClick={() => handleQuickAction('Open Cybeni code editor')}
              className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 rounded-md border border-slate-700 whitespace-nowrap transition-colors"
            >
              Open Cybeni
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs select-text">
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1 px-1">
                    {isUser ? 'You' : activePersona === 'nova' ? 'Nova (Systems)' : 'Aura (Advisor)'}
                  </div>
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-slate-800 text-slate-100 rounded-tr-sm border border-slate-700'
                        : activePersona === 'nova'
                        ? 'bg-purple-950/40 text-purple-100 rounded-tl-sm border border-purple-500/30'
                        : 'bg-cyan-950/40 text-cyan-100 rounded-tl-sm border border-cyan-500/30'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-2xl text-xs text-slate-400 w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{activePersona === 'nova' ? 'Nova is calculating...' : 'Aura is contemplating...'}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Talk to ${activePersona === 'nova' ? 'Nova' : 'Aura'} or command the OS...`}
              disabled={isTyping}
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 transition-colors"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isTyping || !input.trim()}
              className={`p-2 rounded-xl text-white transition-all shadow-md ${
                activePersona === 'nova'
                  ? 'bg-purple-600 hover:bg-purple-500 disabled:opacity-40'
                  : 'bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Avatar Pods (Always Present) */}
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Nova Pod */}
        <div
          onClick={() => {
            setActivePersona('nova');
            setIsOpen(true);
          }}
          className="group relative flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
          title="Nova — Technical Systems Companion"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-700 via-indigo-600 to-fuchsia-500 p-0.5 shadow-xl shadow-purple-900/40 animate-pulse">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Bot className="w-6 h-6 text-purple-300 group-hover:text-white transition-colors" />
            </div>
          </div>
          <span className="absolute -top-7 text-[10px] font-bold tracking-wider text-purple-300 bg-slate-950/80 px-2 py-0.5 rounded-full border border-purple-500/30 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            NOVA
          </span>
        </div>

        {/* Aura Pod */}
        <div
          onClick={() => {
            setActivePersona('aura');
            setIsOpen(true);
          }}
          className="group relative flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
          title="Aura — Creative & Strategic Advisor"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 via-sky-600 to-blue-500 p-0.5 shadow-xl shadow-cyan-900/40 animate-pulse">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-cyan-300 group-hover:text-white transition-colors" />
            </div>
          </div>
          <span className="absolute -top-7 text-[10px] font-bold tracking-wider text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded-full border border-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            AURA
          </span>
        </div>
      </div>
    </div>
  );
}
