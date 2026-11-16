import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Cpu,
  Settings2,
  Network,
  Braces,
  Play,
  Square,
  Zap
} from 'lucide-react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAIStore } from '../../stores/aiStore';
import { useIDEStore } from '../../stores/ideStore';
import { aiOrchestrator } from '../../services/aiOrchestrator';
import { runPipeline } from '../../services/builderBotService';
import { checkAndSpendBuilderBot, getCreditSnapshot, getCreditSnapshotSync } from '../../services/creditService';
import { builderBotCost, providerCostLabel } from '../../config/tierConfig';
import type { MembershipTier } from '../../config/tierConfig';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import CreditHUD from '../ui/CreditHUD';

const ALL_PROVIDERS = [
  { id: 'gemini',        label: 'Gemini',       minTier: 'free'  as MembershipTier },
  // Claude/OpenAI require upfront payment - hide for now
  // { id: 'claude',        label: 'Claude',       minTier: 'spark' as MembershipTier },
  // { id: 'openai',        label: 'OpenAI',       minTier: 'free'  as MembershipTier },
  { id: 'kimi',          label: 'Kimi',         minTier: 'spark' as MembershipTier },
  { id: 'vertex',        label: 'Vertex AI',    minTier: 'free'  as MembershipTier },
  { id: 'huggingface',   label: 'Hugging Face', minTier: 'free'  as MembershipTier },
  { id: 'ollama',        label: 'Ollama',       minTier: 'free'  as MembershipTier },
  { id: 'lmstudio',      label: 'LM Studio',    minTier: 'free'  as MembershipTier },
];

const TIER_RANK: Record<MembershipTier, number> = { 
  free: 0, 
  spark: 1, 
  emergent: 2, 
  catalyst: 3,
  nova: 4,
  'catalytic-crew': 5
};

const AuraIDEConsole: React.FC = () => {
  const {
    provider,
    setProvider,
    geminiKey,
    claudeKey,
    openaiKey,
    kimiKey,
    vertexKey,
    huggingfaceKey,
    messages,
    addMessage,
    isThinking,
    setThinking,
  } = useAIStore();

  const {
    editorCode,
    setEditorCode,
    pipelineStatus,
    setPipelineStatus,
    pipelineIteration,
    setPipelineIteration,
    builderBotActive,
    setBuilderBotActive,
    addTerminalLine,
    clearTerminal,
  } = useIDEStore();

  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  const userTier: MembershipTier = user?.membershipTier ?? 'free';

  // Own-key free inference unlocks at Studio ($17) and above
  const userHasOwnKey = (() => {
    if (TIER_RANK[userTier] < TIER_RANK['emergent']) return false;
    if (provider === 'gemini') return geminiKey.trim().length > 0;
    if (provider === 'claude') return claudeKey.trim().length > 0;
    if (provider === 'openai') return openaiKey.trim().length > 0;
    if (provider === 'kimi')   return kimiKey.trim().length > 0;
    if (provider === 'vertex') return vertexKey.trim().length > 0;
    if (provider === 'huggingface') return huggingfaceKey.trim().length > 0;
    return false; // ollama / lmstudio / huggingface free tier handled by cost===0
  })();
  const visibleProviders = ALL_PROVIDERS.filter(p => TIER_RANK[p.minTier] <= TIER_RANK[userTier]);
  const creditCost = builderBotCost(provider, userTier === 'catalyst' ? 0.5 : 1.0);
  
  // Load credit snapshot from database
  useEffect(() => {
    if (!user) {
      setSnapshot(null);
      return;
    }
    
    let cancelled = false;
    setIsLoadingCredits(true);
    
    getCreditSnapshot(user.id, userTier)
      .then(data => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(err => {
        console.error('Failed to load credits:', err);
        // Fallback to sync version
        if (!cancelled) setSnapshot(getCreditSnapshotSync(user.id, userTier));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCredits(false);
      });
    
    return () => { cancelled = true; };
  }, [user, userTier]);

  // If current provider is no longer accessible for this tier, reset to gemini
  useEffect(() => {
    const accessible = visibleProviders.find(p => p.id === provider);
    if (!accessible) setProvider('gemini');
  }, [userTier]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Seed greeting once
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        role: 'assistant',
        content: "Hello. I am Aura. I can refactor your code, generate Genesis blueprints, or fire up BuilderBot to run a full generation pipeline. What shall we build?"
      });
    }
  }, []);

  // ── Regular Aura Chat ───────────────────────────────────────────────────
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isThinking || pipelineStatus === 'running') return;

    const userMsg = prompt.trim();
    addMessage({ role: 'user', content: userMsg });
    setPrompt('');
    setThinking(true);

    try {
      const response = await aiOrchestrator.sendMessage(userMsg, 'Nova Neural IDE — active editor session');
      addMessage({ role: 'assistant', content: response.content || 'Connection lost. Check your Genesis Node.' });
    } catch {
      addMessage({ role: 'assistant', content: 'Neural link failure. Genesis Node unresponsive.' });
    } finally {
      setThinking(false);
    }
  };

  // ── BuilderBot Pipeline ─────────────────────────────────────────────────
  const handleRunPipeline = async () => {
    if (!prompt.trim() || pipelineStatus === 'running') return;

    // Credit gate — local AI (cost=0) and own-key users are always free
    if (user && creditCost > 0 && !userHasOwnKey) {
      const check = await checkAndSpendBuilderBot(user.id, userTier, provider, false);
      if (!check.allowed) {
        addMessage({
          role: 'assistant',
          content: `⚠️ ${check.reason}\n\nUpgrade your plan at /pricing for more BuilderBot runs.`,
        });
        return;
      }
      // Deduct credits
      await checkAndSpendBuilderBot(user.id, userTier, provider, true);
      
      // Refresh credit snapshot after spending
      const newSnapshot = await getCreditSnapshot(user.id, userTier);
      setSnapshot(newSnapshot);
    }

    const buildPrompt = prompt.trim();
    setPrompt('');
    abortRef.current = false;
    clearTerminal();
    setPipelineStatus('running');
    setPipelineIteration(0);

    addMessage({ role: 'user', content: `[BuilderBot] ${buildPrompt}` });
    addTerminalLine({ type: 'system', text: `[PIPELINE] Request: "${buildPrompt}"` });

    let iteration = 0;
    const onLog = (type: any, text: string) => {
      if (text.includes('iteration')) {
        iteration++;
        setPipelineIteration(iteration);
      }
      addTerminalLine({ type, text });
    };

    const isStudioPlus = TIER_RANK[userTier] >= TIER_RANK['emergent'];

    try {
      const result = await runPipeline(buildPrompt, editorCode, onLog, {
        tier: userTier,
      });
      if (!abortRef.current) {
        setEditorCode(result);
        setPipelineStatus('complete');
        const kimiNote = isStudioPlus ? ' Kimi refinement sweep applied.' : '';
        addMessage({
          role: 'assistant',
          content: `BuilderBot pipeline complete.${kimiNote} Your code has been updated in the editor after ${Math.max(1, iteration)} iteration${iteration !== 1 ? 's' : ''}. Switch to Preview to see the result.`
        });
      }
    } catch (err: any) {
      setPipelineStatus('error');
      addTerminalLine({ type: 'error', text: `[PIPELINE] Fatal error: ${err?.message || err}` });
      addMessage({ role: 'assistant', content: 'BuilderBot pipeline encountered a fatal error. Check the terminal.' });
    }
  };

  const handleStopPipeline = () => {
    abortRef.current = true;
    setPipelineStatus('idle');
    addTerminalLine({ type: 'error', text: '[PIPELINE] Stopped by user.' });
  };

  const isRunning = pipelineStatus === 'running';

  return (
    <div className="flex flex-col h-full bg-void-light border-l border-white/5 select-none">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-void-lighter space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-neon-cyan" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Aura Assistant</span>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && pipelineIteration > 0 && (
              <Badge variant="outline" className="text-[9px] border-neon-cyan/30 text-neon-cyan px-1.5 h-4 uppercase animate-pulse">
                iter {pipelineIteration}
              </Badge>
            )}
            {isRunning && TIER_RANK[userTier] >= TIER_RANK['emergent'] && (
              <Badge variant="outline" className="text-[9px] border-neon-violet/40 text-neon-violet px-1.5 h-4 uppercase animate-pulse">
                kimi sweep
              </Badge>
            )}
            <Badge variant="outline" className="text-[9px] border-neon-cyan/30 text-neon-cyan px-1.5 h-4 uppercase">
              {provider}
            </Badge>
          </div>
        </div>

        {/* Provider Grid */}
        <div className="grid grid-cols-3 gap-1">
          {visibleProviders.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id as any)}
              className={`py-1 text-[9px] font-bold uppercase rounded border transition-all ${provider === p.id ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan' : 'border-white/5 text-text-muted hover:border-white/10'}`}
            >
              {p.label}
            </button>
          ))}
          {/* Locked slot hint for free tier */}
          {userTier === 'free' && (
            <button
              onClick={() => navigate('/pricing')}
              className="py-1 text-[9px] font-bold uppercase rounded border border-white/5 text-white/20 hover:border-neon-cyan/20 hover:text-neon-cyan/40 transition-all col-span-1"
              title="Claude & Kimi require Creator tier"
            >
              + More
            </button>
          )}
        </div>

        {/* BuilderBot Toggle */}
        <button
          onClick={() => setBuilderBotActive(!builderBotActive)}
          className={`w-full py-1.5 rounded border text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${builderBotActive ? 'bg-neon-violet/10 border-neon-violet/30 text-neon-violet' : 'border-white/5 text-text-muted hover:border-white/10'}`}
        >
          <Zap className="w-3 h-3" />
          {builderBotActive ? 'BuilderBot Active' : 'Enable BuilderBot'}
        </button>

        {/* Credit HUD */}
        {snapshot && (
          <CreditHUD
            dailyCredits={snapshot.dailyCredits}
            dailyMax={snapshot.dailyMax}
            builderBotMonthlyRemaining={snapshot.builderBotMonthlyRemaining}
            builderBotMonthlyLimit={snapshot.builderBotMonthlyLimit}
            tier={userTier}
            creditCost={userHasOwnKey ? 0 : creditCost}
          />
        )}
      </div>

      {/* Chat History */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed ${msg.role === 'user' ? 'bg-neon-cyan/10 border border-neon-cyan/20 text-white rounded-tr-none' : 'bg-void-lighter border border-white/5 text-text-secondary rounded-tl-none'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isThinking && !isRunning && (
          <div className="flex items-center gap-2 text-neon-cyan/60 animate-pulse">
            <Cpu className="w-3 h-3 animate-spin" />
            <span className="text-[10px] font-mono tracking-tighter uppercase">Aura is thinking...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-void-lighter shrink-0">
        <form onSubmit={builderBotActive ? (e) => { e.preventDefault(); handleRunPipeline(); } : handleSend} className="relative group">
          <Input
            placeholder={builderBotActive ? 'Describe what to build...' : 'Ask Aura or type /command...'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isThinking || isRunning}
            className="pr-12 bg-void-light border-white/10 focus-visible:ring-neon-cyan/50 text-[11px]"
          />
          {isRunning ? (
            <button
              type="button"
              onClick={handleStopPipeline}
              className="absolute right-2 top-1.5 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
              title="Stop pipeline"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isThinking || !prompt.trim()}
              className="absolute right-2 top-1.5 p-1.5 rounded-lg text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              {builderBotActive ? <Play className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          )}
        </form>

        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex gap-2">
            <button className="text-text-muted hover:text-white transition-colors" title="Suggestions">
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button className="text-text-muted hover:text-white transition-colors" title="Swarm Network">
              <Network className="w-3.5 h-3.5" />
            </button>
            <button className="text-text-muted hover:text-white transition-colors" title="Inject code snippet">
              <Braces className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-[9px] text-text-muted hover:text-white uppercase tracking-tighter flex items-center gap-1 transition-colors"
          >
            <Settings2 className="w-2.5 h-2.5" /> Swarm Settings
          </button>
        </div>

        {/* Pipeline status hint */}
        {builderBotActive && !isRunning && (
          <div className="mt-2 text-center space-y-1">
            <p className="text-[9px] text-neon-violet/60">
              {creditCost === 0
                ? 'Local AI — unlimited free pipeline runs.'
                : userHasOwnKey
                ? 'Own API key detected — FREE inference · unlimited runs'
                : <>
                    {providerCostLabel(provider)} per run ·{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/api-keys')}
                      className="underline underline-offset-2 hover:text-neon-violet transition-colors"
                    >
                      use own key for free
                    </button>
                  </>}
            </p>
            {TIER_RANK[userTier] >= TIER_RANK['emergent'] ? (
              <p className="text-[9px] text-neon-violet/80 font-mono">
                ✦ Kimi creative sweep enabled — gaps filled, logic sound, visuals elevated
              </p>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/pricing')}
                className="text-[9px] text-white/20 hover:text-neon-violet/60 transition-colors"
              >
                Studio tier adds Kimi refinement sweep after every pipeline run →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuraIDEConsole;
