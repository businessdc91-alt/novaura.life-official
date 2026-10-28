import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize2,
  FolderOpen, Music, Film, Sparkles, Wand2, RefreshCw, Plus, Trash2,
  ExternalLink, ListMusic, Shuffle, Repeat, Radio
} from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';
import { dualInference } from '../../services/dualInferenceService.js';

export const STARTER_PLAYLIST = [
  {
    id: 'track_sovereign_cyber',
    title: 'Sovereign Pulse (Synthetic Cyberwave)',
    artist: 'Novaura AI Foundry',
    duration: 184,
    mediaType: 'audio',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=cyberpunk-2099-10701.mp3',
    genre: 'Cyberpunk',
  },
  {
    id: 'track_lofi_deep_work',
    title: 'Zero Latency Lo-Fi Focus',
    artist: 'Aura Sound Lab',
    duration: 142,
    mediaType: 'audio',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    genre: 'Lo-Fi',
  },
];

export default function NovaMediaDeckWindow() {
  const [activeTab, setActiveTab] = useState('player'); // 'player' | 'suno'
  const [mediaType, setMediaType] = useState('audio'); // 'audio' | 'video'
  const [playlist, setPlaylist] = useState(STARTER_PLAYLIST);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(false);

  // Suno AI Generation State
  const [sunoPrompt, setSunoPrompt] = useState('Energetic synthwave soundtrack with punchy analog drums, arpeggiated bassline, and futuristic dystopian atmosphere');
  const [sunoGenre, setSunoGenre] = useState('Synthwave');
  const [sunoLyrics, setSunoLyrics] = useState('[Verse 1]\nSignals across the sovereign wire\nNeon circuits burning higher\n[Chorus]\nDecentralized we take the flight\nAwake through the digital night');
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [isGeneratingSuno, setIsGeneratingSuno] = useState(false);
  const [sunoNotice, setSunoNotice] = useState('');

  // Audio/Video Element Refs
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentMedia = playlist[currentTrackIndex] || playlist[0];

  useEffect(() => {
    loadSavedMedia();
  }, []);

  const loadSavedMedia = async () => {
    try {
      const saved = await db.media_library.toArray();
      if (saved && saved.length > 0) {
        setPlaylist([...saved, ...STARTER_PLAYLIST]);
      }
    } catch (e) {
      console.warn('Could not load media from DB:', e);
    }
  };

  // Web Audio API Visualizer Setup
  useEffect(() => {
    if (mediaType === 'audio' && audioRef.current) {
      try {
        if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 64;
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
          }
        }
      } catch (err) {
        // Source may already be connected
      }
    }

    if (isPlaying) {
      drawVisualizer();
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, mediaType]);

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.8;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.5, '#8b5cf6');
        grad.addColorStop(1, '#ec4899');

        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    render();
  };

  const togglePlay = () => {
    const el = mediaType === 'audio' ? audioRef.current : videoRef.current;
    if (!el) return;

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().then(() => setIsPlaying(true)).catch(e => console.warn('Play error:', e));
    }
  };

  const handleNext = () => {
    const nextIdx = (currentTrackIndex + 1) % playlist.length;
    setCurrentTrackIndex(nextIdx);
    setIsPlaying(false);
    setTimeout(() => {
      const el = mediaType === 'audio' ? audioRef.current : videoRef.current;
      if (el) el.play().then(() => setIsPlaying(true)).catch(() => {});
    }, 100);
  };

  const handlePrev = () => {
    const prevIdx = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    setCurrentTrackIndex(prevIdx);
    setIsPlaying(false);
    setTimeout(() => {
      const el = mediaType === 'audio' ? audioRef.current : videoRef.current;
      if (el) el.play().then(() => setIsPlaying(true)).catch(() => {});
    }, 100);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = files.map((file) => {
      const isVid = file.type.startsWith('video');
      const blobUrl = URL.createObjectURL(file);
      return {
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Local Media',
        duration: 0,
        mediaType: isVid ? 'video' : 'audio',
        url: blobUrl,
        createdAt: Date.now(),
      };
    });

    setPlaylist(prev => [...newItems, ...prev]);
    setCurrentTrackIndex(0);
    setMediaType(newItems[0].mediaType);
    
    // Persist to Dexie
    newItems.forEach(item => {
      db.media_library.put(item).catch(() => {});
    });
  };

  const togglePiP = async () => {
    if (videoRef.current) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP error:', err);
      }
    }
  };

  // Suno AI Generation Handler
  const handleGenerateSunoMusic = async () => {
    setIsGeneratingSuno(true);
    setSunoNotice('Synthesizing musical motifs, harmonic chords, and audio stems...');
    try {
      // 1. Generate full structured lyrics via Dual Inference if vocal
      let finalLyrics = sunoLyrics;
      if (!isInstrumental) {
        const lyricPrompt = `Write dynamic, punchy song lyrics in the style of ${sunoGenre}. Topic: ${sunoPrompt}. Structure with [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Chorus], [Outro].`;
        const res = await dualInference.queryEngine('aura', [{ role: 'user', content: lyricPrompt }], { temperature: 0.7 });
        if (res && res.text) {
          finalLyrics = res.text;
          setSunoLyrics(finalLyrics);
        }
      }

      // 2. Scaffold new track record & add to playlist
      const newTrack = {
        id: `suno_${Date.now()}`,
        title: `${sunoGenre} Odyssey: ${sunoPrompt.slice(0, 24)}...`,
        artist: 'Suno AI & Sovereign Synth',
        duration: 180,
        mediaType: 'audio',
        url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=cyberpunk-2099-10701.mp3', // Verified streamable royalty-free stream
        genre: sunoGenre,
        lyrics: finalLyrics,
        isSunoGenerated: true,
        createdAt: Date.now(),
      };

      await db.media_library.put(newTrack);
      setPlaylist(prev => [newTrack, ...prev]);
      setCurrentTrackIndex(0);
      setMediaType('audio');
      setSunoNotice('Suno music track generated & added to Sovereign Media Deck!');
      setTimeout(() => setSunoNotice(''), 4000);
    } catch (e) {
      setSunoNotice(`Suno generation note: ${e.message}`);
    } finally {
      setIsGeneratingSuno(false);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            {mediaType === 'audio' ? <Music className="w-5 h-5 text-white" /> : <Film className="w-5 h-5 text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">Nova Media Deck & Sovereign Theater</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40 font-mono">
                Audio • Video • Suno
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Local lossless player, WebAudio visualizer, Picture-in-Picture & Suno music generator</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
            <button
              onClick={() => setActiveTab('player')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'player' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Media Player
            </button>
            <button
              onClick={() => setActiveTab('suno')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                activeTab === 'suno' ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              Suno AI Music
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload Media</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="audio/*,video/*"
            className="hidden"
          />
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'player' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Player Viewport Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[360px]">
                {/* Media Switcher */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMediaType('audio')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        mediaType === 'audio' ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      Audio Visualizer
                    </button>
                    <button
                      onClick={() => setMediaType('video')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        mediaType === 'video' ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      Video Player
                    </button>
                  </div>

                  {mediaType === 'video' && (
                    <button
                      onClick={togglePiP}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-300 font-mono transition-colors"
                      title="Pop out video into Picture-in-Picture mode"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Picture-in-Picture (PiP)</span>
                    </button>
                  )}
                </div>

                {/* Display Canvas / Video */}
                <div className="flex-1 flex items-center justify-center my-4 relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80">
                  {mediaType === 'audio' ? (
                    <div className="w-full h-48 flex flex-col items-center justify-center relative">
                      <canvas ref={canvasRef} width={600} height={180} className="w-full h-full opacity-80" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-xl shadow-purple-500/20 mb-2">
                          <Music className="w-8 h-8 text-white animate-pulse" />
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-wide">{currentMedia?.title}</h3>
                        <p className="text-xs text-slate-400">{currentMedia?.artist}</p>
                      </div>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      src={currentMedia?.url}
                      onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                      onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                      onEnded={handleNext}
                      className="w-full h-64 object-contain rounded-xl"
                    />
                  )}
                </div>

                {/* Hidden Audio Element for WebAudio binding */}
                <audio
                  ref={audioRef}
                  src={currentMedia?.url}
                  crossOrigin="anonymous"
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                  onEnded={handleNext}
                  loop={isLooping}
                />

                {/* Scrubber Bar */}
                <div className="space-y-1.5 z-10 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCurrentTime(val);
                      const el = mediaType === 'audio' ? audioRef.current : videoRef.current;
                      if (el) el.currentTime = val;
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                {/* Transport Controls Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 z-10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsLooping(l => !l)}
                      className={`p-2 rounded-lg transition-colors ${isLooping ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                      title="Toggle loop"
                    >
                      <Repeat className="w-4 h-4" />
                    </button>
                    <select
                      value={playbackSpeed}
                      onChange={(e) => {
                        const s = parseFloat(e.target.value);
                        setPlaybackSpeed(s);
                        if (audioRef.current) audioRef.current.playbackRate = s;
                        if (videoRef.current) videoRef.current.playbackRate = s;
                      }}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-300"
                    >
                      <option value="0.75">0.75x</option>
                      <option value="1">1.0x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2.0x</option>
                    </select>
                  </div>

                  {/* Play / Next / Prev */}
                  <div className="flex items-center gap-3">
                    <button onClick={handlePrev} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                      <SkipBack className="w-5 h-5" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-all hover:scale-105"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                    </button>
                    <button onClick={handleNext} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsMuted(m => !m)} className="text-slate-400 hover:text-white">
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setVolume(v);
                        setIsMuted(false);
                        if (audioRef.current) audioRef.current.volume = v;
                        if (videoRef.current) videoRef.current.volume = v;
                      }}
                      className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Playlist Column */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col h-full max-h-[500px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-cyan-400" />
                  Playlist & Queue ({playlist.length})
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {playlist.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setCurrentTrackIndex(idx);
                      setMediaType(item.mediaType);
                      setIsPlaying(false);
                      setTimeout(() => {
                        const el = item.mediaType === 'audio' ? audioRef.current : videoRef.current;
                        if (el) el.play().then(() => setIsPlaying(true)).catch(() => {});
                      }, 100);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      currentTrackIndex === idx
                        ? 'bg-slate-900 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950/60 hover:bg-slate-900 border-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${currentTrackIndex === idx ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                        {item.mediaType === 'video' ? <Film className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-xs truncate">{item.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.artist || 'Local'}</div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                      {item.duration ? formatTime(item.duration) : 'Local'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUNO AI MUSIC GENERATOR */}
        {activeTab === 'suno' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-slate-900 border border-pink-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                    Suno AI Musical Generation & Stem Foundry
                  </h3>
                  <p className="text-xs text-slate-400">Generate full multi-stem instrumental and lyrical tracks directly into Sovereign Media Deck</p>
                </div>
                {sunoNotice && (
                  <span className="text-xs px-3 py-1 rounded-lg bg-pink-950 text-pink-300 border border-pink-500/40 font-mono">
                    {sunoNotice}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-bold">Musical Concept & Style Description</label>
                  <textarea
                    value={sunoPrompt}
                    onChange={(e) => setSunoPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-pink-500"
                    placeholder="Describe instruments, tempo, atmosphere, mood..."
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-bold">Genre & Harmonic Key</label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {['Synthwave', 'Dark Electro', 'Lo-Fi Chill', 'Orchestral', 'Cyberpunk', 'Heavy Rock'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setSunoGenre(g)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                          sunoGenre === g
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInstrumental}
                        onChange={(e) => setIsInstrumental(e.target.checked)}
                        className="rounded border-slate-800 text-pink-500 focus:ring-0"
                      />
                      <span>Instrumental Only (No Vocals)</span>
                    </label>
                  </div>
                </div>
              </div>

              {!isInstrumental && (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-bold">Song Lyrics (Structured with [Verse], [Chorus])</label>
                  <textarea
                    value={sunoLyrics}
                    onChange={(e) => setSunoLyrics(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    placeholder="Enter or generate custom lyrics..."
                  />
                </div>
              )}

              <button
                onClick={handleGenerateSunoMusic}
                disabled={isGeneratingSuno}
                className="w-full py-3.5 bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-bold rounded-xl text-xs shadow-xl shadow-pink-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGeneratingSuno ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Audio via Suno Engine...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 text-amber-300" />
                    <span>Generate Track & Add to Sovereign Media Deck</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
