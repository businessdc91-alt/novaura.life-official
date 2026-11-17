/**
 * NovAura Sovereign OS — Sovereign Live Interactive Voice Engine (Gemini Live Style)
 * 
 * Features:
 * - Real-Time Full-Duplex Audio Conversation with zero cloud lock-in.
 * - Web Audio API AnalyserNode with FFT frequency & time-domain extraction.
 * - Dynamic Barge-In Interruption: Instantly stops AI speech when user begins speaking.
 * - Direct Neural Pipeline to Dual Inference Engine (Nova: Gemma 4 / Qwen MoE on Ollama/LM Studio).
 * - Canvas Aura Sphere Visualizer: Hypnotic pulsating quantum fluid orb (Listening, Thinking, Speaking, Idle).
 */

import { dualInference } from './dualInferenceService.js';
import { cloudSpeechAllowed } from './speechConsent.js';
import { hasCore, prepareTurn, settleTurn } from './auraCore/auraCore.js';
import { voiceParametersFromBias } from './auraCore/dissent.js';

export class LiveVoiceService {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.microphoneStream = null;
    this.sourceNode = null;
    this.recognition = null;
    
    this.state = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking' | 'muted'
    this.isMuted = false;
    this.activeVoice = null;
    this.voiceRate = 1.05;
    this.voicePitch = 1.0;
    this.selectedModelRole = 'nova'; // 'nova' | 'aura' | 'coder'

    this.transcriptHistory = [];
    this.listeners = new Set();
    this.currentUtterance = null;
    this.animationFrameId = null;

    this.timeData = new Uint8Array(128);
    this.freqData = new Uint8Array(128);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    const snapshot = this.getState();
    this.listeners.forEach(fn => fn(snapshot));
  }

  getState() {
    return {
      state: this.state,
      isMuted: this.isMuted,
      transcriptHistory: [...this.transcriptHistory],
      activeVoice: this.activeVoice?.name || 'Default System Voice',
      selectedModelRole: this.selectedModelRole,
    };
  }

  /**
   * Initialize Microphone Stream, Web Audio Analyser & Speech Recognition
   */
  async startSession() {
    if (this.state !== 'idle' && this.state !== 'muted') return;

    try {
      // 1. Initialize Web Audio Context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // 2. Request user microphone
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.microphoneStream);
      this.sourceNode.connect(this.analyser);

      // 3. Initialize Speech Recognition (Web Speech API)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      // Microsoft's online service in WebView2: asked once (speechConsent.js)
      if (SpeechRecognition && cloudSpeechAllowed()) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          if (!this.isMuted && this.state !== 'speaking' && this.state !== 'thinking') {
            this.state = 'listening';
            this._notify();
          }
        };

        this.recognition.onresult = (event) => {
          if (this.isMuted) return;

          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Barge-in: If user speaks while AI is speaking, interrupt immediately!
          if (interimTranscript.trim() || finalTranscript.trim()) {
            if (this.state === 'speaking') {
              this.interruptSpeaking();
            }
          }

          if (finalTranscript.trim()) {
            this._handleUserQuery(finalTranscript.trim());
          }
        };

        this.recognition.onerror = (err) => {
          console.warn('[LiveVoice] Recognition notice:', err.error);
        };

        this.recognition.onend = () => {
          // Keep recognition alive while session is running
          if (this.state !== 'idle') {
            try { this.recognition.start(); } catch {}
          }
        };

        this.recognition.start();
      }

      this.state = 'listening';
      this._notify();
    } catch (err) {
      console.error('[LiveVoice] Failed to start audio session:', err);
      this.state = 'idle';
      this._notify();
      throw err;
    }
  }

  /**
   * Stop active audio session
   */
  stopSession() {
    this.interruptSpeaking();

    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
      this.recognition = null;
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(t => t.stop());
      this.microphoneStream = null;
    }

    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }

    this.state = 'idle';
    this._notify();
  }

  /**
   * Toggle Mute State
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.interruptSpeaking();
      this.state = 'muted';
    } else {
      this.state = 'listening';
    }
    this._notify();
  }

  /**
   * Set Model Role (Nova, Aura, Coder)
   */
  setModelRole(role) {
    this.selectedModelRole = role;
    this._notify();
  }

  /**
   * Immediate Barge-In: Interrupt any ongoing AI speech
   */
  interruptSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    if (this.state === 'speaking') {
      this.state = this.isMuted ? 'muted' : 'listening';
      this._notify();
    }
  }

  /**
   * Dispatch spoken query to active Sovereign Dual Inference model
   */
  async _handleUserQuery(text) {
    // Append to transcript
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    this.transcriptHistory.push(userMsg);
    this.state = 'thinking';
    this._notify();

    const startTime = performance.now();

    try {
      const role = this.selectedModelRole || 'nova';
      const core = hasCore(role) ? await prepareTurn(role, { query: text }).catch(() => null) : null;

      let systemPrompt = 'You are Nova, the sovereign executive AI companion in NovAura Sovereign OS. The user is talking to you in Live Interactive Voice mode (like Gemini Live). Keep answers concise, natural, spoken, direct, and conversational (1 to 3 sentences maximum unless asked for detail). Never output markdown code blocks or bullet points in voice mode.';
      if (role === 'aura') {
        const engramNote = core?.engrams?.length
          ? `\nAssociative continuity:\n${core.engrams.map(e => `- ${String(e.thought || '').slice(0, 140)}`).join('\n')}`
          : '';
        const augNote = core?.augmentation?.directiveBlock ? `\n${core.augmentation.directiveBlock}` : '';
        systemPrompt = `You are Aura, the intuitive, creative companion in NovAura Sovereign OS. The user is talking to you in Live Interactive Voice mode. Keep answers warm, grounded, natural, spoken, direct, and conversational (1 to 3 sentences maximum unless asked for detail). Never output markdown code blocks or bullet points in voice mode.${core?.charter ? `\n${core.charter}` : ''}${augNote}${engramNote}`;
      } else if (role === 'coder') {
        systemPrompt = 'You are Cybeni / Coder, the systems engineering intelligence in NovAura Sovereign OS. Keep spoken explanations concise, direct, and conversational (1 to 3 sentences maximum unless asked for detail). Never output markdown code blocks or bullet points in voice mode.';
      }

      const historySlice = this.transcriptHistory.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
      while (historySlice.length > 0 && historySlice[0].role === 'assistant') {
        historySlice.shift();
      }
      if (historySlice.length === 0) {
        historySlice.push({ role: 'user', content: text });
      }

      // Build conversation context
      const messages = [
        { role: 'system', content: systemPrompt },
        ...historySlice,
      ];

      const extractReply = (res) => {
        if (typeof res === 'string') return res.trim();
        return String(res?.content || res?.text || '').trim();
      };

      let rawReply = '';
      let fallbackReply = 'Understood.';

      if (role === 'aura') {
        rawReply = extractReply(await dualInference.queryAura(messages, { ...(core?.options || {}), scope: 'dual:aura' }));
        fallbackReply = 'I hear you clearly.';
      } else if (role === 'coder') {
        rawReply = extractReply(await dualInference.queryCoder(messages));
        fallbackReply = 'System architectural logic processed.';
      } else {
        // Nova Executive
        rawReply = extractReply(await dualInference.queryNova(messages));
      }

      const replyText = rawReply || fallbackReply;

      if (core && rawReply) {
        const aiClient = {
          async chat(appraisalMsgs, appraisalOpts) {
            try {
              const { kernel } = await import('../kernel/NovaKernel.js');
              if (kernel?.ai?.chat) {
                return await kernel.ai.chat(appraisalMsgs, appraisalOpts);
              }
            } catch {
              // Kernel not initialized or offline; fall back to dualInference Aura engine
            }
            return dualInference.queryAura(appraisalMsgs, {
              temperature: appraisalOpts?.temperature ?? 0,
              max_tokens: appraisalOpts?.maxTokens ?? 160,
              strictMaxTokens: appraisalOpts?.strictMaxTokens ?? true,
              think: appraisalOpts?.think ?? false,
              reasoningEffort: appraisalOpts?.reasoningEffort ?? 'none',
              jsonSchema: appraisalOpts?.jsonSchema,
            });
          },
        };
        settleTurn(role, { userText: text, reply: rawReply, ai: aiClient, channel: 'voice', somatic: core.somatic })
          .catch(err => console.warn('[LiveVoice] AuraCore appraisal failed:', err.message));
      }

      const latencyMs = Math.round(performance.now() - startTime);

      const aiMsg = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: replyText,
        latencyMs,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      this.transcriptHistory.push(aiMsg);
      this._notify();

      // Modulate Aura's spoken cadence from her systemic bias when available
      const speechTuning = (role === 'aura' && core?.bias)
        ? voiceParametersFromBias(core.bias, core.trust ?? 0.5, this.voiceRate, this.voicePitch)
        : null;
      await this.speakResponse(replyText, speechTuning);
    } catch (err) {
      console.error('[LiveVoice] Query error:', err);
      const errorMsg = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `I encountered an inference hitch: ${err.message}. Please check local model connectivity on port 11434.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      this.transcriptHistory.push(errorMsg);
      this.state = 'listening';
      this._notify();
    }
  }

  /**
   * Speak response using Web Speech Synthesis API with live amplitude tracking
   */
  async speakResponse(text, speechTuning = null) {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined' ||
      this.isMuted
    ) {
      this.state = 'listening';
      this._notify();
      return;
    }

    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      utterance.rate = speechTuning?.rate ?? this.voiceRate;
      utterance.pitch = speechTuning?.pitch ?? this.voicePitch;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Select an expressive modern voice
        const naturalVoice = voices.find(v => 
          v.name.includes('Natural') || 
          v.name.includes('Google') || 
          v.name.includes('Samantha') || 
          v.name.includes('Zira') || 
          v.lang.startsWith('en')
        );
        if (naturalVoice) utterance.voice = naturalVoice;
      }

      utterance.onstart = () => {
        this.state = 'speaking';
        this._notify();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        if (this.state === 'speaking') {
          this.state = this.isMuted ? 'muted' : 'listening';
          this._notify();
        }
        resolve();
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        this.state = this.isMuted ? 'muted' : 'listening';
        this._notify();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Draw the iconic Gemini Live style pulsating quantum fluid Aura Orb
   */
  renderAuraFrame(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Retrieve live audio frequency & time domain data
    let micLevel = 0;
    if (this.analyser && this.state === 'listening' && !this.isMuted) {
      this.analyser.getByteFrequencyData(this.freqData);
      let sum = 0;
      for (let i = 0; i < 32; i++) sum += this.freqData[i];
      micLevel = (sum / 32) / 255; // 0.0 to 1.0
    }

    ctx.clearRect(0, 0, width, height);

    const time = performance.now() * 0.002;
    let baseRadius = 80;
    let pulseScale = 1.0;
    let primaryColor = '#38bdf8'; // Cyan
    let secondaryColor = '#818cf8'; // Indigo
    let glowColor = 'rgba(56, 189, 248, 0.4)';

    if (this.state === 'listening') {
      pulseScale = 1.0 + micLevel * 0.6;
      primaryColor = '#06b6d4'; // Electric Cyan
      secondaryColor = '#10b981'; // Sovereign Emerald
      glowColor = 'rgba(6, 182, 212, 0.5)';
    } else if (this.state === 'thinking') {
      pulseScale = 1.0 + Math.sin(time * 3) * 0.15;
      primaryColor = '#a855f7'; // Cosmic Purple
      secondaryColor = '#ec4899'; // Magenta
      glowColor = 'rgba(168, 85, 247, 0.6)';
    } else if (this.state === 'speaking') {
      pulseScale = 1.0 + Math.sin(time * 6) * 0.25;
      primaryColor = '#f59e0b'; // Radiant Gold
      secondaryColor = '#f97316'; // Amber Flame
      glowColor = 'rgba(245, 158, 11, 0.55)';
    } else if (this.state === 'muted') {
      pulseScale = 0.85;
      primaryColor = '#64748b'; // Slate
      secondaryColor = '#475569';
      glowColor = 'rgba(100, 116, 139, 0.2)';
    } else {
      // Idle breathing
      pulseScale = 1.0 + Math.sin(time) * 0.05;
      primaryColor = '#38bdf8';
      secondaryColor = '#6366f1';
      glowColor = 'rgba(56, 189, 248, 0.3)';
    }

    const currentRadius = baseRadius * pulseScale;

    // 1. Outer Glow Bloom
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, currentRadius * 0.5,
      centerX, centerY, currentRadius * 1.8
    );
    glowGradient.addColorStop(0, glowColor);
    glowGradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 2. Multi-layer Organic Fluid Waveform Core
    const numPoints = 64;
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      const layerOffset = layer * 1.2;
      const layerRadius = currentRadius - (layer * 12);

      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const wave = Math.sin(angle * 4 + time * (2 + layer) + layerOffset) * (8 + micLevel * 25);
        const r = layerRadius + wave;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      const grad = ctx.createLinearGradient(
        centerX - currentRadius, centerY - currentRadius,
        centerX + currentRadius, centerY + currentRadius
      );
      grad.addColorStop(0, primaryColor);
      grad.addColorStop(1, secondaryColor);

      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.55 - (layer * 0.15);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // 3. Inner Quantum Core
    ctx.beginPath();
    const coreGrad = ctx.createRadialGradient(
      centerX - currentRadius * 0.2, centerY - currentRadius * 0.2, 5,
      centerX, centerY, currentRadius * 0.7
    );
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.4, primaryColor);
    coreGrad.addColorStop(1, secondaryColor);

    ctx.fillStyle = coreGrad;
    ctx.arc(centerX, centerY, currentRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const liveVoice = new LiveVoiceService();
