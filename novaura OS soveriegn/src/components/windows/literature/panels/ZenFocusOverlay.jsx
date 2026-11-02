// ZenFocusOverlay.jsx — Distraction-Free Typewriter Canvas with Generative Soundscapes & Sprint Station
import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2, Minimize2, Volume2, VolumeX, Play, Pause, RotateCcw,
  Sparkles, X, Activity, Target
} from 'lucide-react';
import { sanitizeRichHtml } from '../../../../services/htmlSanitizer.js';

export default function ZenFocusOverlay({
  activeDoc,
  activeDocContent,
  onUpdateContent,
  onClose,
  initialWordCount = 0
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [soundscape, setSoundscape] = useState('rain'); // 'rain' | 'fireplace' | 'space' | 'cyberpunk'
  const [volume, setVolume] = useState(0.35);

  // Sprint Station
  const [sprintMinutes, setSprintMinutes] = useState(20);
  const [secondsRemaining, setSecondsRemaining] = useState(20 * 60);
  const [isSprintActive, setIsSprintActive] = useState(false);
  const [sprintWordsStart, setSprintWordsStart] = useState(initialWordCount);
  const [currentWordCount, setCurrentWordCount] = useState(initialWordCount);

  const editorRef = useRef(null);
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const noiseSourceRef = useRef(null);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && activeDocContent) {
      if (editorRef.current.innerHTML !== activeDocContent) {
        editorRef.current.innerHTML = sanitizeRichHtml(activeDocContent);
      }
    }
  }, []);

  // The soundscape stops however the overlay closes (exit button, the activity
  // bar toggle, closing the window).
  useEffect(() => () => stopAudio(), []);

  // Sprint Timer Loop
  useEffect(() => {
    let interval = null;
    if (isSprintActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining(prev => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isSprintActive) {
      setIsSprintActive(false);
      alert(`Sprint Complete! You wrote ${Math.max(0, currentWordCount - sprintWordsStart)} words!`);
    }
    return () => clearInterval(interval);
  }, [isSprintActive, secondsRemaining, currentWordCount, sprintWordsStart]);

  // Handle Input
  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const plain = editorRef.current.innerText || '';
    const words = plain.trim() ? plain.trim().split(/\s+/).filter(Boolean).length : 0;
    setCurrentWordCount(words);
    if (onUpdateContent && activeDoc) {
      onUpdateContent(activeDoc.id, html);
    }
  };

  // Generative Web Audio API Synthesizer (Zero asset dependencies!)
  const toggleSoundscape = () => {
    if (isPlayingAudio) {
      stopAudio();
      setIsPlayingAudio(false);
    } else {
      startAudio(soundscape, volume);
      setIsPlayingAudio(true);
    }
  };

  const startAudio = (type, vol) => {
    stopAudio();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate Brown/Pink Noise for organic soundscapes
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'rain') {
          // Brown noise filter for gentle rainfall
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
        } else if (type === 'fireplace') {
          // Crackling fire with occasional random pops
          data[i] = (lastOut + (0.05 * white)) / 1.05;
          if (Math.random() < 0.0008) data[i] += (Math.random() * 0.8 - 0.4);
          lastOut = data[i];
        } else {
          // Deep space drone
          data[i] = Math.sin(2 * Math.PI * 55 * (i / ctx.sampleRate)) * 0.3 + (white * 0.02);
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
      filter.frequency.value = type === 'rain' ? 800 : 400;

      const gain = ctx.createGain();
      gain.gain.value = vol;
      gainNodeRef.current = gain;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noiseSourceRef.current = noise;
    } catch (e) {
      console.warn('[ZenAudio] Web Audio error:', e);
    }
  };

  const stopAudio = () => {
    try {
      if (noiseSourceRef.current) {
        noiseSourceRef.current.stop();
        noiseSourceRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    } catch {}
    noiseSourceRef.current = null;
    audioCtxRef.current = null;
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(newVol, audioCtxRef.current.currentTime);
    }
  };

  const handleStartSprint = () => {
    setSprintWordsStart(currentWordCount);
    setSecondsRemaining(sprintMinutes * 60);
    setIsSprintActive(true);
  };

  const wordsWrittenInSprint = Math.max(0, currentWordCount - sprintWordsStart);
  const minutesElapsed = sprintMinutes - (secondsRemaining / 60);
  const currentWpm = minutesElapsed > 0.3 ? Math.round(wordsWrittenInSprint / minutesElapsed) : 0;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#070a12',
      color: '#e2e8f0',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Georgia, serif'
    }}>
      {/* Floating Header HUD */}
      <div style={{
        height: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        backgroundColor: 'rgba(7,10,18,0.85)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        fontFamily: "'Inter', sans-serif",
        fontSize: '0.74rem'
      }}>
        {/* Left: Sprint Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isSprintActive ? '#34d399' : '#94a3b8' }}>
            <Target size={14} />
            <span style={{ fontWeight: 700 }}>
              {isSprintActive ? `Sprint: ${formatTime(secondsRemaining)}` : 'Sprint Station'}
            </span>
          </div>

          {!isSprintActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <select
                value={sprintMinutes}
                onChange={e => setSprintMinutes(Number(e.target.value))}
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', fontSize: '0.68rem', padding: '1px 4px' }}
              >
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
              </select>
              <button
                onClick={handleStartSprint}
                style={{ padding: '2px 8px', backgroundColor: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '4px', color: '#34d399', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Start Sprint
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.7rem' }}>
              <span style={{ color: '#00f0ff', fontWeight: 600 }}>+{wordsWrittenInSprint} words</span>
              <span style={{ color: '#c084fc' }}>{currentWpm} WPM</span>
              <button
                onClick={() => setIsSprintActive(false)}
                style={{ padding: '1px 6px', backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '3px', color: '#fca5a5', cursor: 'pointer', fontSize: '0.65rem' }}
              >
                End
              </button>
            </div>
          )}
        </div>

        {/* Center: Active Chapter Info */}
        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
          {activeDoc?.name || 'Manuscript'} • {currentWordCount} words
        </div>

        {/* Right: Ambient Soundscape Controls & Exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <select
              value={soundscape}
              onChange={e => {
                setSoundscape(e.target.value);
                if (isPlayingAudio) startAudio(e.target.value, volume);
              }}
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#cbd5e1', fontSize: '0.68rem', padding: '1px 4px' }}
            >
              <option value="rain">🌧️ Rain on Window</option>
              <option value="fireplace">🔥 Hearth Fireplace</option>
              <option value="space">🌌 Deep Space Hum</option>
            </select>
            <button
              onClick={toggleSoundscape}
              title={isPlayingAudio ? 'Mute ambient soundscape' : 'Play ambient soundscape'}
              style={{ background: 'none', border: 'none', color: isPlayingAudio ? '#00f0ff' : '#64748b', cursor: 'pointer' }}
            >
              {isPlayingAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={volume}
              onChange={e => handleVolumeChange(Number(e.target.value))}
              style={{ width: '50px', accentColor: '#00f0ff' }}
            />
          </div>

          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            title="Exit Zen Focus Mode"
            style={{ padding: '3px 8px', backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '4px', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
          >
            <X size={13} />
            <span>Exit Zen</span>
          </button>
        </div>
      </div>

      {/* Main Focus Center Page */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        justifyContent: 'center',
        padding: '4rem 1.5rem',
        backgroundColor: '#070a12'
      }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          spellCheck="true"
          style={{
            width: '100%',
            maxWidth: '760px',
            minHeight: '80vh',
            outline: 'none',
            fontSize: '1.25rem',
            lineHeight: '1.9',
            color: '#f1f5f9',
            letterSpacing: '0.01em',
            wordBreak: 'break-word',
            paddingBottom: '20vh'
          }}
        />
      </div>
    </div>
  );
}
