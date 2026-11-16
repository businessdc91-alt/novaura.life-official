import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, X, Send, Settings, History, Zap, Loader2, Coins, UserCheck, Cpu } from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';
import type { AIProvider } from '@/stores/aiStore';
import { aiOrchestrator } from '@/services/aiOrchestrator';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { memoryService } from '@/services/memoryService';
import { economyService, type Transaction } from '@/services/economyService';
import { sendMessage } from '@/services/messageService';
import { usageService } from '@/services/usageService';
import { Input } from './input';
import { Button } from './button';
import { Switch } from './switch';
import { AuraAvatar, type AuraEmotion } from './AuraAvatar';

const AURA_CONTEXTS: Record<string, string> = {
  '/browse': 'The user is currently browsing assets. They might be looking for something specific or just exploring.',
  '/creator/assets/new': 'The user is uploading a new asset. Help them with pricing, license choice, or foundation linking.',
  '/upload': 'Legacy upload path in use. Guide them to continue with /creator/assets/new without losing flow.',
  '/reader': 'The user is in the Dev Aura Reader searching external platforms for free assets.',
  '/checkout': 'The user is about to pay. Reassure them about the Smart Royalty system and their fair stake.',
  'default': 'The user is on the NovAura platform. General helpfulness is key.'
};

const LOCAL_DEFAULTS = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
} as const;

const ensureHttpProtocol = (value: string): string => {
  if (/^https?:\/\//i.test(value)) return value;
  return `http://${value}`;
};

const normalizeLocalBaseUrl = (endpoint: string, provider: 'ollama' | 'lmstudio'): string => {
  const raw = endpoint.trim();
  const initial = raw ? ensureHttpProtocol(raw) : LOCAL_DEFAULTS[provider];

  return initial
    .replace(/[?#].*$/, '')
    .replace(/\/api\/(?:chat|generate|tags)$/i, '')
    .replace(/\/v1(?:\/chat\/completions|\/models)?$/i, '')
    .replace(/\/+$/g, '');
};

export const AuraGuide = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDismissed] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [ledger, setLedger] = useState<Transaction[]>([]);
  const [proxyStatus, setProxyStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [emotion, setEmotion] = useState<AuraEmotion>('neutral');
  
  const {
    messages, addMessage, provider, setProvider,
    geminiKey, setGeminiKey,
    claudeKey, setClaudeKey,
    openaiKey, setOpenaiKey,
    kimiKey, setKimiKey,
    localEndpoint, setLocalEndpoint, isThinking, setThinking, clearHistory,
    isPersistentPersona
  } = useAIStore();
  const { performanceMode, togglePerformanceMode, addToast } = useUIStore();
  const { user, claimDailyCoins } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Economy Logic
  const isClaimAvailable = () => {
    if (!user?.lastDailyClaim) return true;
    const lastClaim = new Date(user.lastDailyClaim);
    const now = new Date();
    return now.getUTCDate() !== lastClaim.getUTCDate() || 
           now.getUTCMonth() !== lastClaim.getUTCMonth() || 
           now.getUTCFullYear() !== lastClaim.getUTCFullYear();
  };

  const [canClaim, setCanClaim] = useState(isClaimAvailable());

  useEffect(() => {
    setCanClaim(isClaimAvailable());
    if (isSettingsOpen && user) {
      void economyService
        .getLedger(user.id)
        .then((entries) => setLedger(entries))
        .catch(() => setLedger([]));
    }
  }, [user?.lastDailyClaim, isSettingsOpen, user?.id]);

  useEffect(() => {
    if (provider !== 'gemini' && isOpen) {
      checkProxyStatus();
    }
  }, [provider, localEndpoint, isOpen]);

  const handleProviderChange = (nextProvider: AIProvider) => {
    setProvider(nextProvider);

    if (nextProvider === 'ollama') {
      if (!localEndpoint || /:1234(?:\/|$)/i.test(localEndpoint) || /\/v1(?:\/|$)/i.test(localEndpoint)) {
        setLocalEndpoint(LOCAL_DEFAULTS.ollama);
      }
    }

    if (nextProvider === 'lmstudio') {
      if (!localEndpoint || /:11434(?:\/|$)/i.test(localEndpoint) || /\/api(?:\/|$)/i.test(localEndpoint)) {
        setLocalEndpoint(LOCAL_DEFAULTS.lmstudio);
      }
    }
  };

  const checkProxyStatus = async () => {
    if (provider !== 'ollama' && provider !== 'lmstudio') {
      setProxyStatus('online');
      return;
    }

    setProxyStatus('checking');

    const baseUrl = normalizeLocalBaseUrl(localEndpoint, provider);
    const probeUrl = provider === 'ollama' ? `${baseUrl}/api/tags` : `${baseUrl}/v1/models`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(probeUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      setProxyStatus('online');
    } catch {
      setProxyStatus('offline');
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const handleDailyClaim = async () => {
    try {
      await claimDailyCoins();
      addToast({ type: 'success', title: 'Daily Bonus!', message: 'You received 50 Consciousness Coins.' });
      setCanClaim(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Claim Failed', message: err.message });
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentInput.trim() || isThinking) return;

    // AI Usage Logic: Free but limited by daily capacity
    if (!usageService.canUseAI()) {
      addToast({ 
        type: 'error', 
        title: 'Daily capacity reached', 
        message: 'Aura is focusing on other architectural nodes. Please try again tomorrow.' 
      });
      return;
    }

    // Increment usage record
    usageService.incrementUsage();

    const userMessage = currentInput.trim();
    setCurrentInput("");
    addMessage({ role: 'user', content: userMessage });
    setThinking(true);

    try {
      const context = AURA_CONTEXTS[location.pathname] || AURA_CONTEXTS['default'];
      const response = await aiOrchestrator.sendMessage(userMessage, context);

      if (response.error) {
        addToast({ type: 'error', title: 'Aura Connection Error', message: response.error });
        setEmotion('confused');
        setTimeout(() => setEmotion('neutral'), 3000);
      } else {
        executeIntents(response.content);
        const cleanContent = response.content.replace(/ACTION:\[.*?\]\(.*?\)/g, '').trim();
        addMessage({ role: 'assistant', content: cleanContent });
        setEmotion('happy');
        setTimeout(() => setEmotion('neutral'), 5000);

        if (user && isPersistentPersona) {
          memoryService.saveToMemory(user.id, [
            { id: Date.now().toString() + '-u', role: 'user', content: userMessage, timestamp: new Date().toISOString() },
            { id: (Date.now() + 1).toString() + '-a', role: 'assistant', content: cleanContent, timestamp: new Date().toISOString() }
          ]);
          memoryService.extractFact(user.id, userMessage);
        }
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Aura is having trouble thinking right now.' });
      setEmotion('alert');
    } finally {
      setThinking(false);
    }
  };

  const executeIntents = (content: string) => {
    const navigateMatch = content.match(/ACTION:\[NAVIGATE\]\((.*?)\)/);
    if (navigateMatch) {
      navigate(navigateMatch[1]);
      addToast({ type: 'info', title: 'Aura is taking you there...', message: `Navigating to ${navigateMatch[1]}` });
    }

    const searchMatch = content.match(/ACTION:\[SEARCH\]\((.*?)\)/);
    if (searchMatch) {
      navigate(`/browse?search=${encodeURIComponent(searchMatch[1])}`);
    }

    const notifyMatch = content.match(/ACTION:\[NOTIFY\]\((.*?)\)/);
    if (notifyMatch) {
      addToast({ type: 'info', title: 'Aura Says', message: notifyMatch[1] });
    }

    const escalateMatch = content.match(/ACTION:\[ESCALATE\]\((.*?)\)/);
    if (escalateMatch) {
      addToast({ 
        type: 'warning', 
        title: 'Management Escalation', 
        message: 'Aura has escalated your request to the management team and staff. We will reach out via email.' 
      });
      // In a real app, this would trigger a backend event/email
      console.log('ESCALATION TRIGGERED:', escalateMatch[1]);
    }

    const supportMatch = content.match(/ACTION:\[SUPPORT\]\((.*?)\)/);
    if (supportMatch) {
      const issue = supportMatch[1];
      const senderId = user?.id || 'anonymous';
      const senderName = user?.username || 'Guest Soul';
      
      // Notify the owner (The Catalyst)
      sendMessage(
        'system',
        'owner_dillan',
        `🚨 [SUPPORT TICKET] From: ${senderName} (${senderId})\n\nIssue Details: ${issue}`,
        'text'
      );

      addToast({ 
        type: 'success', 
        title: 'Ticket Lodged', 
        message: 'I have notified the Catalyst. Expect a response in your DMs soon.' 
      });
    }

    const domainMatch = content.match(/ACTION:\[DOMAIN\]\((.*?)\)/);
    if (domainMatch) {
      navigate(`/novalow?search=${encodeURIComponent(domainMatch[1])}`);
      addToast({ type: 'info', title: 'Registry Lookup', message: `Searching for ${domainMatch[1]}...` });
    }
  };

  if (isDismissed) return null;

  return (
    <div className="fixed bottom-6 right-52 z-[110] flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9, width: 320 }}
            animate={{ opacity: 1, y: 0, scale: 1, width: isChatMode ? 400 : 320 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`mb-4 bg-slate-950/80 border ${isChatMode ? 'border-neon-cyan/40 shadow-[0_0_30px_rgba(0,240,255,0.15)]' : 'border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.15)]'} rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col h-[520px] pointer-events-auto ring-1 ring-white/10`}
          >
            {/* Header */}
            <div className={`p-4 border-b ${isChatMode ? 'border-neon-cyan/20 bg-gradient-to-r from-neon-cyan/10 to-transparent' : 'border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-transparent'} flex items-center justify-between relative overflow-hidden`}>
              {/* Animated Accent */}
              <motion.div 
                animate={{ x: [-100, 400] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/5 to-transparent blur-xl pointer-events-none"
              />
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <AuraAvatar 
                    emotion={isThinking ? 'thinking' : emotion} 
                    isThinking={isThinking} 
                    size={36} 
                  />
                  {/* Persona Indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${isThinking ? 'bg-neon-lime' : emotion === 'happy' ? 'bg-neon-pink' : 'bg-neon-cyan'}`} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white tracking-widest uppercase italic">Aura Ambassador</h4>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-neon-lime animate-pulse' : 'bg-neon-cyan'}`} />
                    <p className="text-[9px] text-text-muted font-bold tracking-[0.2em] uppercase">{provider} ACTIVE</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-1.5 hover:bg-white/5 rounded-lg text-text-muted transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg text-text-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-grow relative overflow-hidden flex flex-col">
              {/* Settings Overlay */}
              <AnimatePresence>
                {isSettingsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -20 }} 
                    className="absolute inset-0 bg-slate-950 z-20 p-6 flex flex-col"
                  >
                    <h5 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Aura Brain Configuration</h5>
                    
                    <div className="space-y-4 flex-grow overflow-y-auto pr-1 scrollbar-hide">
                      {/* Economy & Stats */}
                      <div className="bg-void border border-white/5 rounded-xl p-3 shadow-inner">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20">
                              <Coins className="w-4 h-4 text-neon-cyan" />
                            </div>
                            <div>
                              <p className="text-[9px] text-text-muted uppercase tracking-tighter">Consciousness Coins</p>
                              <p className="text-sm font-bold text-white tracking-widest leading-none">{user?.consciousnessCoins || 0}</p>
                            </div>
                          </div>
                          <button className="text-[10px] text-neon-cyan font-black hover:text-white transition-colors">RECHARGE</button>
                        </div>
                        
                        {canClaim ? (
                          <Button 
                            onClick={handleDailyClaim}
                            className="w-full h-8 bg-neon-lime text-void text-[10px] font-black uppercase tracking-widest animate-pulse"
                          >
                            Claim Daily Bonus (+50)
                          </Button>
                        ) : (
                          <div className="w-full h-8 bg-white/5 border border-white/5 rounded-lg flex items-center justify-center">
                            <span className="text-[8px] text-text-muted uppercase tracking-widest">Bonus claimed for today</span>
                          </div>
                        )}
                      </div>

                      {/* Transaction Ledger */}
                      {ledger.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <History className="w-3 h-3 text-text-muted" />
                            <span className="text-[10px] text-text-muted uppercase tracking-widest">Recent Activity</span>
                          </div>
                          <div className="space-y-1.5">
                            {ledger.slice(0, 5).map(tx => (
                              <div key={tx.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                                <div className="min-w-0">
                                  <p className="text-[9px] text-white font-bold truncate">{tx.reason}</p>
                                  <p className="text-[7px] text-text-muted uppercase">{new Date(tx.timestamp).toLocaleDateString()}</p>
                                </div>
                                <span className={`text-[9px] font-black ${tx.amount > 0 ? 'text-neon-lime' : 'text-red-400'}`}>
                                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-neon-cyan" />
                          <div>
                            <p className="text-[10px] text-white font-bold uppercase tracking-wider leading-none">Performance Mode</p>
                            <p className="text-[8px] text-text-muted">Reduce animations and visual effects.</p>
                          </div>
                        </div>
                        <Switch 
                          checked={performanceMode} 
                          onCheckedChange={togglePerformanceMode}
                          className="data-[state=checked]:bg-neon-lime"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-text-muted uppercase mb-2 block tracking-widest">AI Engine Provider</label>
                        <div className="grid grid-cols-3 gap-1 mb-1">
                          {(['gemini', 'claude', 'openai'] as AIProvider[]).map(p => (
                            <button
                              key={p}
                              onClick={() => handleProviderChange(p)}
                              className={`py-2 rounded-lg text-[9px] font-black border transition-all ${provider === p ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan' : 'bg-void border-white/5 text-text-muted hover:border-white/20'}`}
                            >
                              {p.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(['kimi', 'ollama', 'lmstudio'] as AIProvider[]).map(p => (
                            <button
                              key={p}
                              onClick={() => handleProviderChange(p)}
                              className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[9px] font-black border transition-all relative ${provider === p ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan' : 'bg-void border-white/5 text-text-muted hover:border-white/20'}`}
                            >
                              {p.toUpperCase()}
                              {(p === 'ollama' || p === 'lmstudio') && provider === p && (
                                <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-void ${proxyStatus === 'online' ? 'bg-neon-lime shadow-[0_0_5px_#39FF14]' : proxyStatus === 'checking' ? 'bg-amber-400' : 'bg-red-500'}`} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {provider === 'gemini' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] text-text-muted uppercase block tracking-widest">Gemini API Key</label>
                            {geminiKey ? <div className="flex items-center gap-1"><span className="text-[8px] text-neon-lime uppercase font-bold">Personal</span><UserCheck className="w-3 h-3 text-neon-lime" /></div> : <span className="text-[9px] text-neon-cyan font-bold uppercase animate-pulse">System Key Active</span>}
                          </div>
                          <Input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="PASTE PERSONAL KEY" className="bg-void border-white/5 h-10 text-xs focus:border-neon-cyan/50 transition-colors" />
                        </div>
                      )}

                      {provider === 'claude' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] text-text-muted uppercase block tracking-widest">Claude API Key</label>
                            {claudeKey ? <div className="flex items-center gap-1"><span className="text-[8px] text-neon-lime uppercase font-bold">Personal</span><UserCheck className="w-3 h-3 text-neon-lime" /></div> : <span className="text-[9px] text-neon-cyan font-bold uppercase animate-pulse">System Key Active</span>}
                          </div>
                          <Input type="password" value={claudeKey} onChange={(e) => setClaudeKey(e.target.value)} placeholder="PASTE ANTHROPIC KEY" className="bg-void border-white/5 h-10 text-xs focus:border-neon-cyan/50 transition-colors" />
                        </div>
                      )}

                      {provider === 'openai' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] text-text-muted uppercase block tracking-widest">OpenAI API Key</label>
                            {openaiKey ? <div className="flex items-center gap-1"><span className="text-[8px] text-neon-lime uppercase font-bold">Personal</span><UserCheck className="w-3 h-3 text-neon-lime" /></div> : <span className="text-[9px] text-neon-cyan font-bold uppercase animate-pulse">System Key Active</span>}
                          </div>
                          <Input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="PASTE OPENAI KEY" className="bg-void border-white/5 h-10 text-xs focus:border-neon-cyan/50 transition-colors" />
                        </div>
                      )}

                      {provider === 'kimi' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] text-text-muted uppercase block tracking-widest">Kimi API Key</label>
                            {kimiKey ? <div className="flex items-center gap-1"><span className="text-[8px] text-neon-lime uppercase font-bold">Personal</span><UserCheck className="w-3 h-3 text-neon-lime" /></div> : <span className="text-[9px] text-neon-cyan font-bold uppercase animate-pulse">System Key Active</span>}
                          </div>
                          <Input type="password" value={kimiKey} onChange={(e) => setKimiKey(e.target.value)} placeholder="PASTE KIMI KEY" className="bg-void border-white/5 h-10 text-xs focus:border-neon-cyan/50 transition-colors" />
                        </div>
                      )}

                      {(provider === 'ollama' || provider === 'lmstudio') && (
                        <div className="space-y-2">
                          <label className="text-[10px] text-text-muted uppercase block tracking-widest">Local Inference Proxy</label>
                          <Input
                            value={localEndpoint}
                            onChange={(e) => setLocalEndpoint(e.target.value)}
                            placeholder={provider === 'lmstudio' ? 'http://localhost:1234 or http://localhost:1234/v1/chat/completions' : 'http://localhost:11434 or http://localhost:11434/api/chat'}
                            className="bg-void border-white/5 h-10 text-xs focus:border-neon-cyan/50 transition-colors"
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-6 border-t border-white/5 space-y-3">
                      <Button variant="ghost" size="sm" onClick={clearHistory} className="w-full text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-400/5 uppercase tracking-widest">
                        <History className="w-3 h-3 mr-2" />
                        Wipe Memories
                      </Button>
                      <Button onClick={() => setIsSettingsOpen(false)} className="w-full bg-neon-cyan text-void font-black shadow-[0_0_20px_rgba(0,255,249,0.3)] hover:scale-[1.02] transition-transform">
                        COMMIT CHANGES
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat Body */}
              <div ref={scrollRef} className="flex-grow p-4 overflow-y-auto space-y-4 scrollbar-hide">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-50">
                    <Bot className="w-10 h-10 text-neon-cyan" />
                    <p className="text-xs text-text-secondary leading-relaxed">
                      "I'm Aura, your AI architect. I can help search for assets, explain royalties, or just chat. Where shall we start?"
                    </p>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${m.role === 'user' ? 'bg-neon-cyan/10 border border-neon-cyan/20 text-white rounded-tr-none' : 'bg-void border border-white/5 text-slate-300 rounded-tl-none'}`}>
                      <p className="leading-relaxed">{m.content}</p>
                      <span className="text-[9px] opacity-30 mt-1 block">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-void border border-white/5 rounded-2xl rounded-tl-none p-3 flex gap-1 items-center">
                      <Loader2 className="w-3 h-3 animate-spin text-neon-cyan" />
                      <span className="text-xs italic text-text-muted lowercase tracking-tighter">Aura is thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-void/50 backdrop-blur-sm">
              <div className="relative group">
                <input
                  value={currentInput}
                  onChange={(e) => {
                    setCurrentInput(e.target.value);
                    if (!isChatMode) setIsChatMode(true);
                  }}
                  placeholder="Ask Aura anything..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-text-muted focus:border-neon-cyan/50 focus:outline-none transition-all shadow-inner"
                />
                <button 
                  type="submit" 
                  disabled={isThinking || !currentInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan hover:text-void transition-all disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 flex justify-between items-center px-1">
                <span className="text-[9px] text-text-muted uppercase tracking-tighter">Enter to send • ESC to close</span>
                <span className="flex items-center gap-1 text-[9px] text-neon-cyan font-bold uppercase tracking-widest animate-pulse">
                  <Zap className="w-2 h-2" /> Hybrid Inference
                </span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && !isChatMode) setIsChatMode(true);
        }}
        className={`w-16 h-16 rounded-full bg-slate-950 border ${isChatMode ? 'border-neon-cyan/50 shadow-[0_0_20px_rgba(0,240,255,0.3)]' : 'border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]'} flex items-center justify-center shadow-2xl pointer-events-auto relative overflow-hidden group transition-all duration-500`}
      >
        <div className={`absolute inset-0 bg-gradient-to-tr ${isChatMode ? 'from-neon-cyan/20 to-neon-pink/20' : 'from-purple-600/20 to-blue-600/20'} opacity-30 group-hover:opacity-60 transition-opacity`} />
        
        {/* Particle Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border border-white/5 border-dashed rounded-full"
        />

        <div className="relative z-10">
          <AuraAvatar 
            emotion={isThinking ? 'thinking' : (isOpen ? 'happy' : emotion)} 
            isThinking={isThinking} 
            size={28} 
          />
        </div>
        
        {!isOpen && !isDismissed && messages.length === 0 && (
          <span className="absolute inset-0 rounded-full border-2 border-neon-pink animate-ping opacity-20"></span>
        )}
      </motion.button>
    </div>
  );
};
