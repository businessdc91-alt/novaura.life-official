import React, { useState, useEffect, useRef } from 'react';
import {
  Heart, Sparkles, Send, Download, Music, VolumeX, Eye, RotateCw,
  Gift, Users, Check, Radio, Copy, Clock, Inbox, ShieldCheck, ChevronRight
} from 'lucide-react';
import {
  CARD_OCCASIONS, CARD_THEMES, PARTICLE_EFFECTS, AUDIO_MELODIES,
  playProceduralMelody, stopMelody, initializeParticleCanvas,
  sendGreetingCardOverMesh, getSentGreetingCards, getReceivedGreetingCards,
  generateStandaloneCardHtml
} from '../../services/greetingCardService.js';
import { getConnectedPeers, getLocalIdentity } from '../../services/sovereignMesh.js';
import { useKernel } from '../../kernel/useKernel.js';
import { triggerDownload } from '../../services/fileStorageService.js';

export default function GreetingCardWindow() {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState('design'); // 'design' | 'inbox' | 'sent'
  
  // Card Design State
  const [occasion, setOccasion] = useState(CARD_OCCASIONS[0].id);
  const [themeId, setThemeId] = useState('gold_luxury');
  const [particleEffect, setParticleEffect] = useState('confetti');
  const [audioMelody, setAudioMelody] = useState('birthday');
  const [coverEmoji, setCoverEmoji] = useState('🎂');
  const [title, setTitle] = useState('Happy Birthday!');
  const [message, setMessage] = useState(
    'Wishing you radiant joy, peak cognitive clarity, and unstoppable momentum in the year ahead. May your sovereign node thrive!'
  );
  const [recipientName, setRecipientName] = useState('Sarah');
  const [recipientPeerId, setRecipientPeerId] = useState('');
  
  // Interactive 3D Preview State
  const [isOpen, setIsOpen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  // Mesh & History State
  const [onlinePeers, setOnlinePeers] = useState([]);
  const [receivedCards, setReceivedCards] = useState([]);
  const [sentCards, setSentCards] = useState([]);
  const [selectedInboxCard, setSelectedInboxCard] = useState(null);

  const canvasRef = useRef(null);
  const localId = getLocalIdentity();
  const activeTheme = CARD_THEMES[themeId] || CARD_THEMES.gold_luxury;

  // Sync mesh peers and card history
  useEffect(() => {
    setOnlinePeers(getConnectedPeers());
    setReceivedCards(getReceivedGreetingCards());
    setSentCards(getSentGreetingCards());

    const onPeerUpdate = () => setOnlinePeers(getConnectedPeers());
    const onCardReceived = (e) => {
      setReceivedCards(getReceivedGreetingCards());
      setSendSuccess(`New card arrived from ${e.detail?.senderName || 'Peer'}!`);
      setTimeout(() => setSendSuccess(''), 4000);
    };

    window.addEventListener('novaura:mesh_updated', onPeerUpdate);
    window.addEventListener('novaura:greeting_card_received', onCardReceived);

    return () => {
      window.removeEventListener('novaura:mesh_updated', onPeerUpdate);
      window.removeEventListener('novaura:greeting_card_received', onCardReceived);
      stopMelody();
    };
  }, []);

  // Update canvas particle effect whenever effect or theme changes
  useEffect(() => {
    if (canvasRef.current) {
      const cleanup = initializeParticleCanvas(
        canvasRef.current,
        particleEffect,
        activeTheme.primary,
        activeTheme.accent
      );
      return () => cleanup();
    }
  }, [particleEffect, activeTheme, activeTab]);

  // Handle Occasion Preset Changes
  const handleSelectOccasion = (occId) => {
    const occ = CARD_OCCASIONS.find(o => o.id === occId);
    if (!occ) return;
    setOccasion(occ.id);
    setCoverEmoji(occ.defaultEmoji);
    setTitle(occ.defaultTitle);
    if (occId === 'birthday') {
      setThemeId('gold_luxury');
      setParticleEffect('confetti');
      setAudioMelody('birthday');
      setMessage('Wishing you boundless joy, peak hardware efficiency, and unstoppable sovereign growth in your new year!');
    } else if (occId === 'friendship') {
      setThemeId('cyber_neon');
      setParticleEffect('fireworks');
      setAudioMelody('chimes');
      setMessage('Grateful to share the decentralized frontier with an unyielding mind. Here is to unbreakably encrypted camaraderie.');
    } else if (occId === 'gratitude') {
      setThemeId('emerald_spring');
      setParticleEffect('sparkles');
      setAudioMelody('harp');
      setMessage('Thank you for your generous wisdom, unwavering reliability, and dedicated support across our mission.');
    } else if (occId === 'milestone') {
      setThemeId('gold_luxury');
      setParticleEffect('fireworks');
      setAudioMelody('fanfare');
      setMessage('Trophy unlocked! Congratulations on attaining this major milestone in autonomous computing and craftsmanship.');
    } else if (occId === 'holiday') {
      setThemeId('celestial_silver');
      setParticleEffect('sparkles');
      setAudioMelody('chimes');
      setMessage('Warmest season greetings across the subnets. May your hearth be warm and your local inference sub-millisecond.');
    } else if (occId === 'cyber') {
      setThemeId('cyber_neon');
      setParticleEffect('confetti');
      setAudioMelody('fanfare');
      setMessage('Decentralized consensus validated. Victory attained on all telemetry channels. Well fought, operator.');
    }
  };

  // Audio preview toggle
  const toggleAudio = () => {
    if (isPlayingAudio) {
      stopMelody();
      setIsPlayingAudio(false);
    } else {
      playProceduralMelody(audioMelody);
      setIsPlayingAudio(true);
      setTimeout(() => setIsPlayingAudio(false), 9000);
    }
  };

  // AI Poem / Message Generator
  const handleGenerateAiMessage = async () => {
    setGeneratingAi(true);
    try {
      const occLabel = CARD_OCCASIONS.find(o => o.id === occasion)?.label || 'Celebration';
      const prompt = `Write a short, beautiful, heartfelt, 2-to-3 sentence greeting card message for a ${occLabel} dedicated to "${recipientName}". Tone should be warm, inspiring, and subtly poetic with sovereign modern undertones. Do not use quotation marks.`;
      
      const reply = await kernel?.ai?.chat([
        { role: 'user', content: prompt }
      ], { persona: 'aura' });

      if (reply) {
        setMessage(reply.trim());
      }
    } catch (err) {
      console.warn('AI card message note:', err);
    } finally {
      setGeneratingAi(false);
    }
  };

  // Send Card Across Mesh
  const handleSendMesh = async () => {
    setSending(true);
    try {
      const cardPayload = {
        occasion,
        occasionLabel: CARD_OCCASIONS.find(o => o.id === occasion)?.label,
        themeId,
        particleEffect,
        audioMelody,
        coverEmoji,
        title,
        message,
        recipientName,
        recipientPeerId: recipientPeerId || null,
        senderName: localId?.handle || 'operator'
      };

      await sendGreetingCardOverMesh(cardPayload);
      setSentCards(getSentGreetingCards());
      setSendSuccess(`Card sent to ${recipientName || 'your peer'} over the mesh.`);
      setTimeout(() => setSendSuccess(''), 4000);

      // Play celebration sound when sending
      if (audioMelody !== 'mute') {
        playProceduralMelody(audioMelody);
        setIsPlayingAudio(true);
        setTimeout(() => setIsPlayingAudio(false), 8000);
      }
    } catch (err) {
      alert(`Send note: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // Export Standalone HTML
  const handleExportHtml = () => {
    const cardData = {
      occasionLabel: CARD_OCCASIONS.find(o => o.id === occasion)?.label,
      themeId,
      particleEffect,
      audioMelody,
      coverEmoji,
      title,
      message,
      recipientName,
      senderName: localId?.handle || 'operator'
    };
    const html = generateStandaloneCardHtml(cardData);
    const name = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'card'}_greeting.html`;
    triggerDownload(name, new Blob([html], { type: 'text/html' }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="h-12 px-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/40 flex items-center justify-center text-pink-400">
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Sovereign Greeting Studio</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-950 text-pink-400 font-mono font-normal">
                P2P Mesh
              </span>
            </h1>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => { setActiveTab('design'); setSelectedInboxCard(null); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === 'design' ? 'bg-pink-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create Card</span>
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === 'inbox' ? 'bg-pink-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Received ({receivedCards.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
              activeTab === 'sent' ? 'bg-pink-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatched ({sentCards.length})</span>
          </button>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isPlayingAudio
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Preview Procedural Web Audio Synth"
          >
            {isPlayingAudio ? <Music className="w-3.5 h-3.5 animate-bounce text-amber-400" /> : <Music className="w-3.5 h-3.5" />}
            <span>{isPlayingAudio ? 'Playing Synth...' : 'Test Melody'}</span>
          </button>
          <button
            onClick={handleExportHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export HTML</span>
          </button>
        </div>
      </div>

      {sendSuccess && (
        <div className="px-5 py-2 bg-emerald-950/80 border-b border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{sendSuccess}</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400/80">Signed with your node key</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'design' && (
          <>
            {/* Left Column: Creator Studio Controls */}
            <div className="w-[380px] border-r border-slate-800/80 bg-slate-900/60 p-5 overflow-y-auto space-y-5 shrink-0">
              {/* Occasion Presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Celebration Occasion</label>
                <div className="grid grid-cols-2 gap-2">
                  {CARD_OCCASIONS.map(occ => (
                    <button
                      key={occ.id}
                      onClick={() => handleSelectOccasion(occ.id)}
                      className={`p-2 rounded-xl text-left text-xs transition-all flex items-center gap-2 cursor-pointer border ${
                        occasion === occ.id
                          ? 'bg-pink-500/20 border-pink-500/60 text-white font-bold shadow-md shadow-pink-500/10'
                          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-base">{occ.defaultEmoji}</span>
                      <span className="truncate">{occ.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme & Palette */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Atmosphere & Palette</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.values(CARD_THEMES).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between border cursor-pointer ${
                        themeId === t.id
                          ? 'border-cyan-400 bg-slate-950 shadow-md shadow-cyan-500/10'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ background: t.primary }}
                        />
                        <span className={`font-semibold ${themeId === t.id ? 'text-white' : 'text-slate-300'}`}>
                          {t.name}
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 font-mono">
                        {t.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Particle Animation & Audio Melody */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Living Particles</label>
                  <select
                    value={particleEffect}
                    onChange={(e) => setParticleEffect(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-pink-500 cursor-pointer"
                  >
                    {PARTICLE_EFFECTS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.label.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Procedural Synth</label>
                  <select
                    value={audioMelody}
                    onChange={(e) => setAudioMelody(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-pink-500 cursor-pointer"
                  >
                    {AUDIO_MELODIES.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label.split(' ')[0]} ({m.duration})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cover Emoji / Stamp Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Cover Seal / Icon</label>
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {['🎂', '🎁', '🎆', '✨', '🥂', '💌', '👑', '🪐', '⚡', '🌹', '🚀', '💎'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setCoverEmoji(emoji)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-transform cursor-pointer shrink-0 ${
                        coverEmoji === emoji
                          ? 'bg-pink-500/20 border border-pink-500 scale-110'
                          : 'bg-slate-950 border border-slate-800/80 hover:bg-slate-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Details & Quick Peer Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Recipient Name / Node</label>
                  {onlinePeers.length > 0 && (
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {onlinePeers.length} Peers Online
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient Name (e.g., Sarah or @handle)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-pink-500"
                />

                {onlinePeers.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                    <span className="text-[10px] text-slate-500 shrink-0">Mesh Peers:</span>
                    {onlinePeers.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setRecipientName(p.name || p.id.slice(0, 8));
                          setRecipientPeerId(p.id);
                        }}
                        className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-cyan-300 hover:border-cyan-500 shrink-0 cursor-pointer"
                      >
                        @{p.name || p.id.slice(0, 6)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Message */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Card Headline</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-pink-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Personal Inside Message</label>
                  <button
                    onClick={handleGenerateAiMessage}
                    disabled={generatingAi}
                    className="flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{generatingAi ? 'Composing...' : 'Ask Aura to Compose'}</span>
                  </button>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-pink-500 leading-relaxed font-sans"
                />
              </div>

              {/* Send Button */}
              <div className="pt-2">
                <button
                  onClick={handleSendMesh}
                  disabled={sending || !recipientPeerId}
                  className="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 shadow-xl shadow-pink-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{sending ? 'Sending...' : recipientPeerId ? 'Send Across Sovereign Mesh' : 'Pick a mesh peer to send to'}</span>
                </button>
                <p className="text-[10px] text-center text-slate-500 mt-2">
                  Sends a signed card to the one peer you picked. Export HTML to share it any other way.
                </p>
              </div>
            </div>

            {/* Right Column: 3D Interactive Folding Card Stage */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-8 overflow-hidden bg-slate-950">
              {/* Particle Canvas */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none z-0"
              />

              {/* Stage Controls */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="flex items-center gap-1.5 text-slate-200 hover:text-pink-400 font-semibold cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{isOpen ? 'Fold Cover Closed' : 'Open Inside Card'}</span>
                </button>
              </div>

              {/* 3D Folding Card Container */}
              <div
                onClick={() => setIsOpen(!isOpen)}
                style={{ perspective: 1200 }}
                className="relative z-10 w-[360px] h-[490px] cursor-pointer group"
              >
                <div
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isOpen ? 'rotateY(-180deg)' : 'rotateY(0deg)',
                    transition: 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                  className="w-full h-full relative"
                >
                  {/* FRONT COVER */}
                  <div
                    style={{
                      background: activeTheme.bg,
                      backgroundImage: activeTheme.coverPattern,
                      borderColor: activeTheme.border,
                      boxShadow: `0 25px 50px -12px rgba(0,0,0,0.8), 0 0 35px ${activeTheme.border}`
                    }}
                    className="absolute inset-0 rounded-3xl p-8 border-2 flex flex-col justify-between items-center text-center backface-hidden"
                  >
                    <span
                      style={{ color: activeTheme.primary, borderColor: activeTheme.border }}
                      className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-white/5 border"
                    >
                      {CARD_OCCASIONS.find(o => o.id === occasion)?.label || 'Celebration'}
                    </span>

                    <div className="my-auto space-y-4">
                      <div
                        style={{ filter: `drop-shadow(0 0 20px ${activeTheme.primary})` }}
                        className="text-7xl animate-bounce"
                      >
                        {coverEmoji}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white leading-tight">
                          {title}
                        </h2>
                        <div
                          style={{ color: activeTheme.primary }}
                          className="text-sm font-semibold mt-2"
                        >
                          For: {recipientName || 'Valued Peer'}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] uppercase tracking-wider text-slate-400 animate-pulse">
                      ✦ Click to Open Card ✦
                    </div>
                  </div>

                  {/* INSIDE CARD */}
                  <div
                    style={{
                      background: activeTheme.innerBg,
                      borderColor: activeTheme.border,
                      transform: 'rotateY(180deg)',
                      boxShadow: `0 25px 50px -12px rgba(0,0,0,0.8), 0 0 35px ${activeTheme.border}`
                    }}
                    className="absolute inset-0 rounded-3xl p-8 border-2 flex flex-col justify-between text-left backface-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                        <span
                          style={{ color: activeTheme.primary }}
                          className="font-bold text-sm tracking-wide"
                        >
                          {title}
                        </span>
                        <span className="text-xl">{coverEmoji}</span>
                      </div>

                      <div className="text-sm text-slate-200 leading-relaxed italic font-serif space-y-2 max-h-[260px] overflow-y-auto">
                        <p>{message}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex items-end justify-between text-xs">
                      <div>
                        <div className="text-[11px] text-slate-400">Sent with warmth by:</div>
                        <div style={{ color: activeTheme.primary }} className="font-bold text-sm">
                          @{localId?.handle || 'operator'}
                        </div>
                      </div>
                      <div className="text-right font-mono text-[10px] text-slate-500">
                        <div className="flex items-center gap-1 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>ED25519</span>
                        </div>
                        <div>SOVEREIGN MESH</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Hint */}
              <div className="mt-6 text-xs text-slate-500 flex items-center gap-2">
                <span>Tip: Click card to fold open or closed. The recipient gets this exact 3D physics animation!</span>
              </div>
            </div>
          </>
        )}

        {/* Received Cards Tab */}
        {activeTab === 'inbox' && (
          <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-pink-400" />
                <span>Received Greeting Cards</span>
              </h2>
              <p className="text-xs text-slate-400">
                Cards dispatched directly to your node address across the sovereign P2P mesh network.
              </p>
            </div>

            {receivedCards.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-2xl">
                  💌
                </div>
                <h3 className="text-sm font-semibold text-slate-300">No Cards Received Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When peers on your local network or Starlink mesh transmit greetings, they appear here instantly with full audio and particle animations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {receivedCards.map((card, idx) => {
                  const theme = CARD_THEMES[card.themeId] || CARD_THEMES.gold_luxury;
                  return (
                    <div
                      key={card.id || idx}
                      className="p-5 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-pink-500/50 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-3xl">{card.coverEmoji || '🎂'}</span>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                          {new Date(card.timestamp || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{card.title}</h4>
                        <p className="text-xs text-slate-300 italic mt-1 line-clamp-3">
                          "{card.message}"
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-pink-400 font-semibold" title={card.senderDid ? `Signed by ${card.senderDid}` : undefined}>From @{card.senderName || 'peer'}{card.senderDid ? <span className="text-slate-500 font-mono font-normal"> · {card.senderDid.slice(9, 17)}…</span> : null}</span>
                        <button
                          onClick={() => {
                            setTitle(card.title);
                            setMessage(card.message);
                            setCoverEmoji(card.coverEmoji || '🎂');
                            if (card.themeId) setThemeId(card.themeId);
                            if (card.particleEffect) setParticleEffect(card.particleEffect);
                            if (card.audioMelody) setAudioMelody(card.audioMelody);
                            setActiveTab('design');
                            setIsOpen(true);
                            if (card.audioMelody) playProceduralMelody(card.audioMelody);
                          }}
                          className="px-3 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View & Play 3D Card</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sent Cards Tab */}
        {activeTab === 'sent' && (
          <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-pink-400" />
                <span>Dispatched Greeting Cards</span>
              </h2>
              <p className="text-xs text-slate-400">
                Log of cryptographic greeting cards transmitted from your sovereign identity key.
              </p>
            </div>

            {sentCards.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                <p className="text-xs text-slate-500">You haven't dispatched any greeting cards yet. Create one today!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentCards.map((card, idx) => (
                  <div
                    key={card.id || idx}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{card.coverEmoji}</span>
                      <div>
                        <div className="text-xs font-bold text-white">{card.title}</div>
                        <div className="text-[11px] text-slate-400">
                          To: <b className="text-pink-300">{card.recipientName}</b> • {new Date(card.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-mono border border-emerald-500/30">
                      Delivered
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
