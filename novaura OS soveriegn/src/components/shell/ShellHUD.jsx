import React, { useState, useEffect, useRef } from 'react';
import { 
  Command, 
  Mic,
  MicOff,
  Send,
  Sparkles, 
  Terminal, 
  Volume2, 
  VolumeX, 
  Command as CommandIcon,
  Cpu,
  Zap,
  Activity,
  ShieldCheck,
  MessageSquare,
  User,
  FileText,
  Layers,
  Search,
  Settings,
  X
} from 'lucide-react';
import { executeAuraAction } from '../../services/sovereignCommandService';
import { queryAuraCommander } from '../../services/sovereignCommandService';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function ShellHUD({ openApp }) {
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(true);
  const [statusMsg, setStatusMsg] = useState('System Ready');

  const inputRef = useRef(null);

  const handleCommand = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isProcessing) return;

    setInputValue('');
    setIsProcessing(true);
    setStatusMsg('Aura is thinking...');

    try {
      const response = await queryAuraCommander(trimmed);
      
      if (response.action) {
        const result = await executeAuraAction(response.action, openApp);
        if (result.pendingApproval) {
          toast((t) => (
            <div className="flex flex-col gap-2 p-1">
              <span className="font-semibold text-amber-400 text-xs tracking-wider uppercase">Sovereign Authorization Required</span>
              <p className="text-xs text-slate-200">{result.message}</p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={async () => {
                    toast.dismiss(t);
                    const res = await executeAuraAction(response.action, openApp, { confirmed: true });
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
          toast.success(result.message || 'Command executed');
        }
      } else {
        toast.info(response.text);
      }
      setStatusMsg('Command Processed');
    } catch (error) {
      console.error('HUD Command Error:', error);
      toast.error('Command execution failed');
      setStatusMsg('Error occurred');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMsg('System Ready'), 3000);
    }
  };

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported');
      return;
    }
    
    if (isListening) {
      window.speechSynthesis.cancel();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error('Voice recognition error');
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      handleCommand(transcript);
    };

    recognition.start();
  };

  return (
    <AnimatePresence>
      {isHudOpen && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            zIndex: 1000,
            height: '60px',
            backgroundColor: 'rgba(7, 11, 25, 0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            gap: '1rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}
        >
          {/* Aura Branding & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
            <div style={{ position: 'relative' }}>
              <Sparkles size={20} color="#00f0ff" />
              {isProcessing && (
                <div style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#00f0ff',
                  animation: 'pulse 1s infinite'
                }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00f0ff', letterSpacing: '0.05em' }}>AURA COMMAND</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isProcessing ? '#ef4444' : '#10b981' }} />
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>{statusMsg}</span>
              </div>
            </div>
          </div>

          {/* Main Command Input */}
          <div style={{ flex: 1, position: 'relative', maxWidth: '600px' }}>
            <form 
              onSubmit={(e) => { e.preventDefault(); handleCommand(); }}
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            >
              <CommandIcon size={16} style={{ position: 'absolute', left: '12px', color: '#475569' }} />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
                placeholder="Execute directive (e.g. 'Post to social', 'Open Mail', 'Write chapter 2')"
                style={{
                  width: '100%',
                  padding: '0.6rem 2.5rem 0.6rem 2.8rem',
                  backgroundColor: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '20px',
                  color: '#f1f5f9',
                  fontSize: '0.85rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                }}
              />
              <button
                typethought="button"
                onClick={toggleVoice}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: isListening ? '#ef4444' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="submit"
                disabled={!inputValue.trim() || isProcessing}
                style={{
                  position: 'absolute',
                  right: '-45px',
                  background: 'rgba(0, 240, 255, 0.1)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#00f0ff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>

          {/* OS Quick Access / Utilities */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'flex-end' }}>
             <button 
               onClick={() => setIsHudOpen(false)}
               style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '4px' }}
             >
               <X size={18} />
             </button>
             <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }} />
             <button title="Open Launcher" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
               <Layers size={18} />
             </button>
             <button title="Settings" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
               <Settings size={18} />
             </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
