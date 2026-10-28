import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Sparkles, Radio, RefreshCw,
  Terminal, ShieldCheck, ChevronRight, Zap, Play, Square,
  Layers, MessageSquare, Bot, User, Clock, Cpu
} from 'lucide-react';
import { liveVoice } from '../../services/liveVoiceService.js';
import { dualInference } from '../../services/dualInferenceService.js';

export default function LiveVoiceWindow({ windowId, props, onClose }) {
  const [voiceState, setVoiceState] = useState(liveVoice.getState());
  const [dualState, setDualState] = useState(dualInference.getState());
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const transcriptBottomRef = useRef(null);

  // Sync with live voice service state
  useEffect(() => {
    const unsubVoice = liveVoice.subscribe((st) => setVoiceState(st));
    const unsubDual = dualInference.subscribe((st) => setDualState(st));

    return () => {
      unsubVoice();
      unsubDual();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // 60 FPS Canvas Aura Sphere Renderer
  useEffect(() => {
    let active = true;

    const renderLoop = () => {
      if (!active) return;
      if (canvasRef.current) {
        liveVoice.renderAuraFrame(canvasRef.current);
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [voiceState.transcriptHistory]);

  const handleToggleSession = async () => {
    if (isSessionActive) {
      liveVoice.stopSession();
      setIsSessionActive(false);
    } else {
      setErrorMsg(null);
      try {
        await liveVoice.startSession();
        setIsSessionActive(true);
      } catch (err) {
        setErrorMsg('Microphone access was denied or audio context failed to initialize.');
        setIsSessionActive(false);
      }
    }
  };

  const handleToggleMute = () => {
    liveVoice.toggleMute();
  };

  const handleInterrupt = () => {
    liveVoice.interruptSpeaking();
  };

  const getStatusBadge = () => {
    switch (voiceState.state) {
      case 'listening':
        return { label: 'LIVE LISTENING', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', dot: 'bg-cyan-400 animate-pulse' };
      case 'thinking':
        return { label: 'NEURAL REASONING', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40', dot: 'bg-purple-400 animate-ping' };
      case 'speaking':
        return { label: 'AURA SPEAKING', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40', dot: 'bg-amber-400 animate-bounce' };
      case 'muted':
        return { label: 'MIC MUTED', bg: 'bg-slate-700/50 text-slate-400 border-slate-600', dot: 'bg-slate-500' };
      default:
        return { label: 'STANDBY', bg: 'bg-slate-800 text-slate-400 border-slate-700', dot: 'bg-slate-500' };
    }
  };

  const statusInfo = getStatusBadge();

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. Header Toolbar */}
      <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
            <Radio className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">Novaura Live Voice</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${statusInfo.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                <span>{statusInfo.label}</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Dual Neural Pipeline</span>
              <span>•</span>
              <span className="text-cyan-400 font-mono">
                {voiceState.selectedModelRole.toUpperCase()}: {dualState[voiceState.selectedModelRole]?.model || 'Gemma 4 12B'}
              </span>
            </div>
          </div>
        </div>

        {/* Model Role Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            {['nova', 'aura', 'coder'].map(role => (
              <button
                key={role}
                onClick={() => liveVoice.setModelRole(role)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  voiceState.selectedModelRole === role
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {role.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono px-3 py-1 bg-slate-900 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Air-Gapped Speech</span>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {errorMsg && (
        <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* 2. Central Split: Aura Sphere & Live Transcript */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Hypnotic Aura Sphere Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950">
          
          {/* Subtle Ambient Rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-96 h-96 rounded-full border border-cyan-500/30 animate-pulse" />
            <div className="absolute w-[480px] h-[480px] rounded-full border border-purple-500/20" />
          </div>

          {/* Canvas Orb */}
          <div className="relative z-10 flex flex-col items-center">
            <canvas
              ref={canvasRef}
              width={380}
              height={380}
              className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] rounded-full drop-shadow-[0_0_50px_rgba(56,189,248,0.25)]"
            />

            {/* Real-time speech prompt helper */}
            <div className="mt-4 text-center space-y-1">
              <p className="text-xs text-slate-400 font-medium">
                {voiceState.state === 'listening' ? 'Speak naturally — Nova will respond aloud in real time' :
                 voiceState.state === 'thinking' ? 'Reasoning over sovereign intent...' :
                 voiceState.state === 'speaking' ? 'Speaking. Say anything to interrupt instantly (Barge-In).' :
                 isSessionActive ? 'Listening active...' : 'Press the central microphone to activate Live Voice Mode'}
              </p>
            </div>
          </div>

          {/* Bottom Floating Control Dock */}
          <div className="mt-6 flex items-center gap-3 z-10 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-2 rounded-2xl shadow-2xl">
            {/* Main Mic Button */}
            <button
              onClick={handleToggleSession}
              className={`p-4 rounded-xl transition-all cursor-pointer shadow-lg ${
                isSessionActive
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-950/50'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950/50'
              }`}
              title={isSessionActive ? 'Stop Live Voice' : 'Start Live Voice'}
            >
              {isSessionActive ? <Square className="w-6 h-6 fill-white" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* Mute Toggle */}
            <button
              onClick={handleToggleMute}
              disabled={!isSessionActive}
              className={`p-3 rounded-xl border transition-all cursor-pointer disabled:opacity-40 ${
                voiceState.isMuted
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={voiceState.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {voiceState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Interrupt AI Button */}
            <button
              onClick={handleInterrupt}
              disabled={voiceState.state !== 'speaking'}
              className="px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-30"
              title="Interrupt AI Speech Immediately"
            >
              <VolumeX className="w-4 h-4" />
              <span>Barge-In</span>
            </button>
          </div>
        </div>

        {/* Right Side: Live Dialogue Transcript */}
        <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0">
          
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Voice Transcript Stream</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {voiceState.transcriptHistory.length} Exchanges
            </span>
          </div>

          {/* Transcript Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
            {voiceState.transcriptHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-3 p-4">
                <Radio className="w-8 h-8 text-slate-600 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-400">No voice utterances yet</p>
                  <p className="text-[11px] text-slate-400">Start the session and speak naturally to converse with Nova.</p>
                </div>

                <div className="pt-3 w-full space-y-1.5 text-left">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Suggested Inquiries</span>
                  {[
                    "Give me a status report on our local neural cores",
                    "What integrations do we have configured in Cybeni?",
                    "How does the decentralized search engine find peers?",
                  ].map((tip, i) => (
                    <button
                      key={i}
                      onClick={() => liveVoice._handleUserQuery(tip)}
                      className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-slate-800 text-[11px] text-slate-300 transition-colors cursor-pointer"
                    >
                      "{tip}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              voiceState.transcriptHistory.map((item) => {
                const isUser = item.role === 'user';
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col space-y-1 ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono px-1">
                      {isUser ? (
                        <>
                          <span>Operator</span>
                          <User className="w-3 h-3 text-cyan-400" />
                        </>
                      ) : (
                        <>
                          <Bot className="w-3 h-3 text-purple-400" />
                          <span className="text-purple-300 font-bold">Nova Executive</span>
                          {item.latencyMs && (
                            <span className="text-emerald-400">({item.latencyMs}ms)</span>
                          )}
                        </>
                      )}
                      <span>•</span>
                      <span>{item.timestamp}</span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[90%] ${
                        isUser
                          ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-100 rounded-tr-none'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                      }`}
                    >
                      {item.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={transcriptBottomRef} />
          </div>

        </div>

      </div>

    </div>
  );
}
