import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Brain, BookOpen, Clock, Target, 
  MessageSquare, RefreshCw, Wand2, ArrowDownToLine,
  Eye, Scissors, Zap, Shield, ChevronRight, Bot, User, Send
} from 'lucide-react';
import { useLiterature } from './LiteratureContext';
import { ScrollArea } from '../../ui/scroll-area';
import axios from 'axios';
import { smartChat } from '../../../services/aiService';
import { kernelStorage } from '../../../kernel/kernelStorage.js';

const MODES = [
  { id: 'oracle', label: 'Oracle', icon: Brain, color: 'text-purple-400', desc: 'Story Bible & Lore' },
  { id: 'draft', label: 'Draft', icon: Wand2, color: 'text-cyan-400', desc: 'Writing Assistant' },
  { id: 'reflect', label: 'Reflect', icon: Eye, color: 'text-indigo-400', desc: 'Find Weaknesses & Alternate Paths' },
  { id: 'audit', label: 'Audit', icon: Shield, color: 'text-emerald-400', desc: 'Consistency & Style' },
  { id: 'timeline', label: 'Chronos', icon: Clock, color: 'text-amber-400', desc: 'Story Timeline' },
];

export default function MuseSidebar() {
  const { bible, setBible, activeFile, selectedText, updateFileContent } = useLiterature();
  const [activeMode, setActiveMode] = useState('draft');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendToAI = async (prompt, modeOverride = null) => {
    setLoading(true);
    const mode = modeOverride || activeMode;
    const userMsg = { role: 'user', text: prompt, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
      let systemCtx = `You are the Muse, a world-class literary AI assistant. Current Mode: ${mode.toUpperCase()}.`;
      
      // Inject Story Bible
      if (bible) {
        const chars = bible.characters?.map(c => `${c.name}: ${c.description}`).join('\n') || '';
        const lore = bible.lore?.map(l => `${l.name}: ${l.description}`).join('\n') || '';
        systemCtx += `\n\nSTORY CONTEXT:\nCharacters:\n${chars}\n\nLore/Settings:\n${lore}`;
      }

      const aiResponse = await smartChat(`${systemCtx}\n\nUSER REQUEST:\n${prompt}`, 'literature');
      const aiText = aiResponse.response || 'The Muse is silent...';
      setMessages(prev => [...prev, { role: 'assistant', text: aiText, ts: Date.now(), mode }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection lost to the Aether...', isError: true, ts: Date.now() }]);
    }
    setLoading(false);
  };

  const handleQuickAction = (action, label) => {
    let prompt = '';
    if (action === 'describe') prompt = `Describe this in vivid detail: "${selectedText}"`;
    if (action === 'rewrite') prompt = `Rewrite this for better flow and emotional resonance: "${selectedText}"`;
    if (action === 'expand') prompt = `Expand this into a full scene: "${selectedText}"`;
    if (action === 'audit') prompt = `Check this text for consistency with the Story Bible: "${activeFile?.content?.replace(/<[^>]+>/g, '')}"`;
    
    // Reflection Actions
    if (action === 'analyze_gaps') prompt = `Analyze this chapter for any weaknesses, plot holes, missing context, or overlapping/contradicting pieces. Find the blind spots. Story: "${activeFile?.content?.replace(/<[^>]+>/g, '')}"`;
    if (action === 'alternate_paths') prompt = `I have writer's block. Based on the story so far, give me 3 unexpected alternative paths the story could take next. Story: "${activeFile?.content?.replace(/<[^>]+>/g, '')}"`;
    if (action === 'critique') prompt = `Act as a harsh but fair literary agent. Critique this chapter's pacing, dialogue, and emotional resonance. Story: "${activeFile?.content?.replace(/<[^>]+>/g, '')}"`;

    sendToAI(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a] border-l border-white/5 shadow-2xl">
      {/* Mode Selector */}
      <div className="p-3 grid grid-cols-4 gap-1 border-b border-white/5 bg-[#141425]">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setActiveMode(m.id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
              activeMode === m.id ? 'bg-primary/20 text-white shadow-inner' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
            title={m.desc}
          >
            <m.icon className={`w-4 h-4 ${activeMode === m.id ? m.color : ''}`} />
            <span className="text-[9px] uppercase font-bold tracking-tighter">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Quick Actions Bar */}
      {activeMode === 'draft' && selectedText && (
        <div className="px-3 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-[10px] text-primary/60 font-bold whitespace-nowrap">SELECTION:</span>
          <button onClick={() => handleQuickAction('describe')} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-full whitespace-nowrap">Describe</button>
          <button onClick={() => handleQuickAction('rewrite')} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-full whitespace-nowrap">Rewrite</button>
          <button onClick={() => handleQuickAction('expand')} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-full whitespace-nowrap">Expand</button>
        </div>
      )}

      {activeMode === 'reflect' && activeFile && (
        <div className="px-3 py-2 bg-indigo-500/5 border-b border-indigo-500/10 flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-[10px] text-indigo-400 font-bold whitespace-nowrap">REFLECTION:</span>
          <button onClick={() => handleQuickAction('analyze_gaps')} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-full whitespace-nowrap">Find Plot Holes</button>
          <button onClick={() => handleQuickAction('alternate_paths')} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-full whitespace-nowrap">Alternate Paths</button>
          <button onClick={() => handleQuickAction('critique')} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-full whitespace-nowrap">Deep Critique</button>
        </div>
      )}

      {/* Chat Area */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center animate-pulse">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">The Muse is Listening</h3>
                <p className="text-[11px] text-gray-400 mt-1 max-w-[180px]">Ask about your characters, request a rewrite, or start a new scene.</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1.5 px-1">
                {msg.role === 'assistant' ? (
                  <>
                    <Bot className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Muse • {msg.mode || activeMode}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Author</span>
                    <User className="w-3 h-3 text-accent" />
                  </>
                )}
              </div>
              <div className={`group relative max-w-[95%] p-3 rounded-2xl text-[12px] leading-relaxed transition-all ${
                msg.role === 'user'
                  ? 'bg-accent/10 border border-accent/20 rounded-tr-none text-gray-200'
                  : 'bg-[#1a1a2e] border border-white/5 rounded-tl-none text-gray-300'
              }`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.role === 'assistant' && (
                  <button 
                    onClick={() => updateFileContent(activeFile?.id, activeFile?.content + `<p>${msg.text.replace(/\n/g, '</p><p>')}</p>`)}
                    className="mt-3 flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowDownToLine className="w-3 h-3" /> Insert to Manuscript
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-primary animate-pulse">
              <Sparkles className="w-4 h-4" />
              <span className="text-[11px] font-bold tracking-widest uppercase">Consulting the Aether...</span>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 bg-[#141425] border-t border-white/5">
        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) { sendToAI(input); setInput(''); }
              }
            }}
            placeholder={`Whisper to the Muse (${activeMode})...`}
            className="w-full bg-[#0a0a14] text-white text-[12px] rounded-xl pl-4 pr-12 py-3 border border-white/5 outline-none focus:border-primary/50 transition-all resize-none min-h-[45px] max-h-[150px] scrollbar-none"
            rows={1}
          />
          <button
            onClick={() => { if (input.trim()) { sendToAI(input); setInput(''); } }}
            disabled={loading || !input.trim()}
            className="absolute right-2 bottom-2 p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-gray-600 mt-2 text-center uppercase tracking-widest">Powered by Emergent AI • NovAura Core</p>
      </div>
    </div>
  );
}
