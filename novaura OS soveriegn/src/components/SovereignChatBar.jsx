import React, { useState, useRef, useCallback } from 'react';
import { Send, Mic, Sparkles, Loader2, LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react';
import { queryAuraCommander, executeAuraAction } from '../services/sovereignCommandService.js';
import { chainLogicWeaver } from '../services/chainLogicWeaverService.js';
import { toast } from 'sonner';

export default function SovereignChatBar({
  openApp,
  isDockOpen = true,
  onToggleDock,
  isPromptBarHidden = false,
  onTogglePromptBar,
}) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const query = input.trim();
    if (!query || isProcessing) return;

    setInput('');
    setIsProcessing(true);

    try {
      // 1. Direct App Name match quick shortcut
      const lower = query.toLowerCase();
      if (lower.startsWith('open ') || lower.startsWith('launch ') || lower.startsWith('start ')) {
        const target = lower.replace(/^(open|launch|start)\s+/i, '').trim();
        if (target.includes('beta') || target.includes('bug') || target.includes('diagnostic') || target.includes('report')) {
          openApp('beta_hub');
          toast.success('Opened Beta Diagnostics & Bug Report Deck');
          setIsProcessing(false);
          return;
        }
        if (target.includes('onboarding') || target.includes('guide') || target.includes('legal') || target.includes('terms') || target.includes('privacy') || target.includes('docs') || target.includes('feedback')) {
          openApp('onboarding_guide');
          toast.success('Opened Sovereign Onboarding & Legal Guide');
          setIsProcessing(false);
          return;
        }
        if (target.includes('hub') || target.includes('git') || target.includes('repo') || target.includes('pull request')) {
          openApp('nova_hub');
          toast.success('Opened Nova Hub (Decentralized Git Forge)');
          setIsProcessing(false);
          return;
        }
        if (target.includes('weaver') || target.includes('dag') || target.includes('chain') || target.includes('workflow')) {
          openApp('chain_weaver');
          toast.success('Opened Chain Logic Weaver Studio');
          setIsProcessing(false);
          return;
        }
        if (target.includes('enclave') || target.includes('vault') || target.includes('keyring') || target.includes('credential') || target.includes('2fa') || target.includes('totp') || target.includes('ssh')) {
          openApp('credential_enclave');
          toast.success('Opened Credential Enclave & Keyring');
          setIsProcessing(false);
          return;
        }
        if (target.includes('hypervisor') || target.includes('speedometer') || target.includes('local model')) {
          openApp('hypervisor');
          toast.success('Opened Neural Hypervisor');
          setIsProcessing(false);
          return;
        }
        if (target.includes('foundry') || target.includes('comfy') || target.includes('forge')) {
          openApp('media_foundry');
          toast.success('Opened Media Foundry & ComfyUI Forge');
          setIsProcessing(false);
          return;
        }
        if (target.includes('cybeni') || target.includes('code') || target.includes('ide')) {
          openApp('cybeni');
          toast.success('Launched Cybeni Builder');
          setIsProcessing(false);
          return;
        }
        if (target.includes('file') || target.includes('folder') || target.includes('storage')) {
          openApp('files');
          toast.success('Opened Storage Explorer');
          setIsProcessing(false);
          return;
        }
        if (target.includes('term') || target.includes('cmd') || target.includes('console')) {
          openApp('terminal');
          toast.success('Opened Sovereign Terminal');
          setIsProcessing(false);
          return;
        }
        if (target.includes('phone') || target.includes('call') || target.includes('dial')) {
          openApp('novaphone');
          toast.success('Opened NovaPhone Telecom');
          setIsProcessing(false);
          return;
        }
        if (target.includes('browser') || target.includes('web') || target.includes('gateway')) {
          openApp('browser');
          toast.success('Opened Decentralized Browser');
          setIsProcessing(false);
          return;
        }
        if (target.includes('lit') || target.includes('write') || target.includes('word') || target.includes('manuscript')) {
          openApp('literature');
          toast.success('Opened Word Studio (Literature IDE)');
          setIsProcessing(false);
          return;
        }
        if (target.includes('theme') || target.includes('personal') || target.includes('graphic')) {
          openApp('personalization');
          toast.success('Opened Personalization & Themes');
          setIsProcessing(false);
          return;
        }
        if (target.includes('shield') || target.includes('sentinel') || target.includes('security')) {
          openApp('sentinel');
          toast.success('Opened Sentinel Shield');
          setIsProcessing(false);
          return;
        }
        if (target.includes('platform') || target.includes('bridge') || target.includes('cloud portal') || target.includes('gateway')) {
          openApp('platform_bridge');
          toast.success('Opened Novaura Platform Bridge');
          setIsProcessing(false);
          return;
        }
        if (target.includes('disk') || target.includes('drive') || target.includes('clean') || target.includes('boot')) {
          openApp('disk_architect');
          toast.success('Opened NovADrive AI (Disk Architect)');
          setIsProcessing(false);
          return;
        }
        if (target.includes('setting')) {
          openApp('settings');
          toast.success('Opened System Settings');
          setIsProcessing(false);
          return;
        }
      }

      // 2. Autonomous Chain Logic Weaver Intent Matching
      try {
        const intentResult = await chainLogicWeaver.dispatchIntent(query);
        if (intentResult && intentResult.matched) {
          toast.success(`Intent Activated: Executing "${intentResult.chainName}"`);
          openApp('chain_weaver');
          setIsProcessing(false);
          return;
        }
      } catch (intentErr) {
        console.warn('[ChatBar] Chain Weaver intent dispatch note:', intentErr);
      }

      // 3. Query Central AI Commander (local LLM or mesh)
      const result = await queryAuraCommander(query);
      if (result.action) {
        const actionResult = await executeAuraAction(result.action, openApp);
        if (actionResult.pendingApproval) {
          toast((t) => (
            <div className="flex flex-col gap-2 p-1">
              <span className="font-semibold text-amber-400 text-xs tracking-wider uppercase">Sovereign Authorization Required</span>
              <p className="text-xs text-slate-200">{actionResult.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={async () => {
                    toast.dismiss(t);
                    const res = await executeAuraAction(result.action, openApp, { confirmed: true });
                    toast.success(res.message);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Authorize Execution
                </button>
                <button
                  onClick={() => toast.dismiss(t)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded cursor-pointer transition-colors"
                >
                  Deny
                </button>
              </div>
            </div>
          ), { duration: 15000 });
        } else {
          toast.success(actionResult.message || 'Action executed successfully');
        }
      } else if (result.text) {
        toast.info(result.text, { duration: 6000 });
      }
    } catch (err) {
      console.warn('[ChatBar] Commander execution error:', err);
      toast.error('Command failed to execute');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice recognition not supported in this environment');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => {
      setIsListening(false);
      toast.error('Voice recognition error');
    };

    rec.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setInput(transcript);

      if (event.results[0]?.isFinal && transcript.trim()) {
        setIsListening(false);
        setInput(transcript.trim());
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [isListening]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
      <div className="relative">
        {/* Centered slide-up tabs on top of chat bar */}
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {onToggleDock && (
            <button
              onClick={onToggleDock}
              type="button"
              aria-label="Toggle Apps Dock"
              title={isDockOpen ? "Close Apps Window" : "Open Apps Window"}
              className={`px-3 py-0.5 border rounded-t-lg transition-all backdrop-blur-sm cursor-pointer flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider ${
                isDockOpen
                  ? 'bg-slate-950 border-cyan-500/40 text-cyan-300 shadow-[0_-2px_10px_rgba(0,240,255,0.2)]'
                  : 'bg-black/85 border-white/10 text-white/50 hover:text-white hover:border-white/25'
              }`}
            >
              <LayoutGrid size={11} className={isDockOpen ? "text-cyan-400" : ""} />
              <span>Apps</span>
              <ChevronDown
                size={11}
                className={`transition-transform duration-300 ${isDockOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}

          {onTogglePromptBar && (
            <button
              onClick={onTogglePromptBar}
              type="button"
              aria-label="Drop prompt bar down out of sight"
              title="Drop prompt bar down out of sight"
              className="px-2.5 py-0.5 bg-black/85 border border-white/10 hover:border-cyan-500/30 rounded-t-lg text-white/40 hover:text-cyan-400 transition-all backdrop-blur-sm cursor-pointer flex items-center justify-center text-[9px] font-mono"
            >
              <ChevronDown size={12} />
            </button>
          )}
        </div>

        {/* RGB liquid light flowing border */}
        <div className="rgb-border rounded-2xl shadow-2xl backdrop-blur-xl">
          <div className="rgb-flow-layer" />
          <div className="relative z-10 bg-black rounded-2xl overflow-hidden border border-white/5">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2">
              {/* Sovereign AI Status Indicator */}
              <div className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:py-2 rounded-lg border border-primary/30 bg-primary/10 transition-all flex-shrink-0">
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary animate-pulse" />
                )}
                <div className="flex flex-col">
                  <span className="text-[10px] md:text-xs font-bold leading-none text-primary font-mono tracking-wider">
                    LOCAL + SOVEREIGN
                  </span>
                  <span className="text-[8px] md:text-[9px] text-white/50 leading-none mt-0.5">
                    {isProcessing ? 'Processing intent...' : 'Mesh Ready (0ms)'}
                  </span>
                </div>
              </div>

              {/* Apps Window Quick Toggle Button */}
              {onToggleDock && (
                <button
                  type="button"
                  onClick={onToggleDock}
                  title={isDockOpen ? "Close Apps Window" : "Open Apps Window"}
                  className={`rounded-lg transition-all px-2.5 py-1.5 flex items-center gap-1.5 flex-shrink-0 cursor-pointer border ${
                    isDockOpen
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(0,217,255,0.25)]'
                      : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider hidden sm:inline">Apps</span>
                </button>
              )}

              {/* Command / Chat Input */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? 'Listening to speech...'
                    : 'Ask AI to build, browse, code, dial, or write manuscript...'
                }
                className="flex-1 bg-transparent border-none text-white placeholder:text-white/35 focus:outline-none focus:ring-0 text-xs md:text-sm touch-manipulation font-sans"
              />

              {/* Voice Mic Button */}
              <button
                type="button"
                onClick={toggleVoice}
                aria-label="Voice input"
                className={`rounded-lg transition-all w-9 h-9 md:w-10 md:h-10 flex items-center justify-center flex-shrink-0 cursor-pointer ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                <Mic className="w-4 h-4 md:w-5 md:h-5" />
              </button>

              {/* Send Submit Button */}
              <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                aria-label="Send command"
                className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(0,217,255,0.3)] transition-all disabled:opacity-40 disabled:shadow-none w-9 h-9 md:w-10 md:h-10 flex items-center justify-center flex-shrink-0 cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5 text-black" />
              </button>

              {/* Drop-Down Out of Sight Button */}
              {onTogglePromptBar && (
                <button
                  type="button"
                  onClick={onTogglePromptBar}
                  title="Drop prompt bar down out of sight"
                  className="rounded-lg transition-all w-8 h-8 md:w-9 md:h-9 flex items-center justify-center flex-shrink-0 cursor-pointer text-white/40 hover:text-cyan-400 hover:bg-white/5"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
