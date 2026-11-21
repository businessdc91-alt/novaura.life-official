// AnalyzeRevisePanel.jsx — Live Mic Recorder, Song Upload Analyzer, AI Music Producer Critique,
// and 2-Tier AI Song Revision & Mastering Engine (Offline DSP Master + ACE-Step 1.5 Re-Arrangement)
// with instant A/B Original vs Revised comparison.

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic, Square, Upload, Sparkles, Sliders, Download, Save, Activity,
  Wand2, CheckCircle2, AlertTriangle, Loader2, Volume2, ArrowLeftRight
} from 'lucide-react';
import { REVISION_GOALS } from '../../../services/music/songAnalyzer.js';
import {
  analyzeAndPlanTrack,
  reviseTrackAudio,
  saveAudioFile,
  getBlob,
} from '../../../services/music/musicStudio.js';
import { GENRES } from '../../../services/music/musicCatalog.js';
import { fmtTime } from './shared.jsx';

export default function AnalyzeRevisePanel({ initialTrack = null, tracks = [], musicReady = false, say, onSaved }) {
  // Input audio state
  const [sourceBlob, setSourceBlob] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [lyrics, setLyrics] = useState('');
  const [goal, setGoal] = useState('flow');
  const [userNotes, setUserNotes] = useState('');

  // Live microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [metronomeBpm, setMetronomeBpm] = useState(110);
  const mediaRecRef = useRef(null);
  const recChunksRef = useRef([]);
  const recStreamRef = useRef(null);
  const recTimerRef = useRef(null);
  const meterRafRef = useRef(null);
  const metroTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const fileInputRef = useRef(null);

  // Analysis & AI Producer Plan
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);

  // Editable DSP Master & ACE-Step Revision parameters
  const [dsp, setDsp] = useState({
    lowGainDb: 0,
    midGainDb: 0,
    highGainDb: 1.5,
    compressionRatio: 2.2,
    stereoWidth: 1.1,
    trimDeadAir: true,
    fadeInSec: 0.15,
    fadeOutSec: 0.6,
  });
  const [remixStrength, setRemixStrength] = useState(0.45);
  const [revisedTags, setRevisedTags] = useState('');

  // Revision Output & A/B Compare
  const [revising, setRevising] = useState(false);
  const [reviseStatus, setReviseStatus] = useState('');
  const [revisedResult, setRevisedResult] = useState(null);
  const [revisedUrl, setRevisedUrl] = useState('');
  const [abMode, setAbMode] = useState('revised'); // 'original' | 'revised'

  const loadSourceBlob = (blob, title, extra = {}) => {
    setSourceBlob(blob);
    setSourceUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setTrackTitle(title || 'My Track');
    if (extra.genre) setGenre(extra.genre);
    if (extra.lyrics !== undefined) setLyrics(extra.lyrics);
    setAnalysis(null);
    setPlan(null);
    setRevisedResult(null);
    setRevisedUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  };

  // Load track if navigated here via "Analyze & Revise" from Library
  useEffect(() => {
    let cancelled = false;
    if (!initialTrack?.audioBlobId) return () => { cancelled = true; };
    getBlob(initialTrack.audioBlobId).then((blob) => {
      if (cancelled || !blob) return;
      loadSourceBlob(blob, initialTrack.title, {
        genre: initialTrack.spec?.genre || 'Pop',
        lyrics: initialTrack.lyrics && initialTrack.lyrics !== '[Instrumental]' ? initialTrack.lyrics : '',
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [initialTrack]);

  // Cleanup recorder timers & URLs on unmount
  useEffect(() => {
    return () => {
      clearInterval(recTimerRef.current);
      clearInterval(metroTimerRef.current);
      cancelAnimationFrame(meterRafRef.current);
      recStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close?.().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is unavailable in this environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      recStreamRef.current = stream;

      // Live VU meter + optional BPM click metronome
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tickMeter = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
        setMicLevel(Math.min(1, peak * 1.8));
        meterRafRef.current = requestAnimationFrame(tickMeter);
      };
      tickMeter();

      if (metronomeOn) {
        const beatMs = Math.max(250, Math.round(60000 / Math.max(50, Math.min(220, metronomeBpm))));
        let beat = 0;
        const click = () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = beat % 4 === 0 ? 1100 : 760;
          gain.gain.setValueAtTime(0.14, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
          beat++;
        };
        click();
        metroTimerRef.current = setInterval(click, beatMs);
      }

      recChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        loadSourceBlob(blob, `Live Recording (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`);
        say?.('Live recording captured! Click "Analyze & Plan Revision" to inspect and polish it.', 'good');
      };
      mr.start();
      setRecordSec(0);
      setIsRecording(true);
      recTimerRef.current = setInterval(() => setRecordSec(s => s + 1), 1000);
    } catch (err) {
      say?.(err.message || 'Could not start microphone recording.');
    }
  };

  const stopRecording = () => {
    clearInterval(recTimerRef.current);
    clearInterval(metroTimerRef.current);
    cancelAnimationFrame(meterRafRef.current);
    setMicLevel(0);
    setIsRecording(false);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
    recStreamRef.current?.getTracks().forEach(t => t.stop());
    recStreamRef.current = null;
    audioCtxRef.current?.close?.().catch(() => {});
    audioCtxRef.current = null;
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    loadSourceBlob(file, file.name.replace(/\.[^.]+$/, ''));
    say?.(`Loaded "${file.name}". Ready to analyze!`, 'good');
  };

  const handleSelectLibraryTrack = async (trackId) => {
    const trk = tracks.find(t => t.id === trackId);
    if (!trk) return;
    const blob = await getBlob(trk.audioBlobId);
    if (!blob) { say?.('Audio blob missing for selected track.'); return; }
    loadSourceBlob(blob, trk.title, {
      genre: trk.spec?.genre || 'Pop',
      lyrics: trk.lyrics && trk.lyrics !== '[Instrumental]' ? trk.lyrics : '',
    });
  };

  const handleAnalyze = async () => {
    if (!sourceBlob) {
      say?.('Record live audio, upload a song, or choose a library track first.');
      return;
    }
    setAnalyzing(true);
    try {
      const res = await analyzeAndPlanTrack(sourceBlob, {
        title: trackTitle || 'User Track',
        genre,
        lyrics,
        goal,
        userNotes,
      });
      setAnalysis(res.analysis);
      setPlan(res.plan);
      setDsp(res.plan.dspParams);
      setRemixStrength(res.plan.recommendedRemixStrength);
      setRevisedTags(res.plan.revisedTags);
      say?.(`Analysis complete (${res.plan.source === 'ai-producer' ? 'DSP + AI Producer' : 'Acoustic DSP'}): Score ${res.plan.overallScore}/100.`, 'good');
    } catch (err) {
      say?.(err.message || 'Audio analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunRevision = async (mode) => {
    if (!sourceBlob) { say?.('Load or record a track first.'); return; }
    setRevising(true);
    setReviseStatus(mode === 'dsp' ? 'Mastering audio offline…' : 'Starting AI Song Revision…');
    try {
      const effectivePlan = plan ? { ...plan, revisedTags, dspParams: dsp } : { revisedTags, dspParams: dsp };
      const out = await reviseTrackAudio(sourceBlob, {
        title: trackTitle || 'Song',
        analysis,
        plan: effectivePlan,
        mode,
        remixStrength,
        dspParams: dsp,
        spec: { genre, bpm: analysis?.estimatedBpm || 115, key: analysis?.estimatedKey || 'C major', lyrics },
        onProgress: (p) => setReviseStatus(p.status || (p.max ? `Re-synthesizing step ${p.value}/${p.max}` : 'Processing…')),
      });
      setRevisedResult(out);
      setRevisedUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(out.blob);
      });
      setAbMode('revised');
      say?.(`Revision ready! Toggle A/B below to compare Original vs ${mode === 'dsp' ? 'DSP Master' : 'AI Revised'}.`, 'good');
    } catch (err) {
      say?.(err.message || 'Revision failed.');
    } finally {
      setRevising(false);
      setReviseStatus('');
    }
  };

  const handleSaveRevisedToLibrary = async () => {
    if (!revisedResult?.blob) return;
    await saveAudioFile(revisedResult.blob, {
      title: revisedResult.title,
      spec: {
        genre,
        bpm: revisedResult.analysisAfter?.estimatedBpm || analysis?.estimatedBpm || 115,
        key: revisedResult.analysisAfter?.estimatedKey || analysis?.estimatedKey || 'C major',
        lyrics: plan?.revisedLyrics || lyrics,
      },
    });
    onSaved?.();
    say?.(`Saved "${revisedResult.title}" to Music Studio Library!`, 'good');
  };

  const activePlayerUrl = abMode === 'revised' && revisedUrl ? revisedUrl : sourceUrl;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-fuchsia-400" />
            <span>Live Recording, Song Analyzer &amp; AI Producer Revision</span>
          </h2>
          <p className="text-[12px] text-white/55">
            Upload your song or record live via microphone. Sovereign measures real BPM, key, loudness, spectral balance, and energy flow — then revises it with offline studio DSP mastering or ACE-Step 1.5 AI re-arrangement.
          </p>
        </div>
      </div>

      {/* 1. INPUT SOURCES ROW: LIVE MIC | UPLOAD SONG | LIBRARY PICK */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Live Microphone Recorder */}
        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Mic className={`w-4 h-4 ${isRecording ? 'text-rose-400 animate-pulse' : 'text-fuchsia-400'}`} />
              Live Mic Recording
            </span>
            {isRecording && <span className="text-[11px] font-mono text-rose-400 font-bold">● REC {fmtTime(recordSec)}</span>}
          </div>

          {/* Real-time Mic Level Meter */}
          <div className="h-2.5 w-full rounded-full bg-black/50 overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-75"
              style={{ width: `${Math.round(micLevel * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-white/70">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={metronomeOn} onChange={(e) => setMetronomeOn(e.target.checked)} disabled={isRecording} className="accent-fuchsia-500" />
              Click Track
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={50}
                max={220}
                value={metronomeBpm}
                onChange={(e) => setMetronomeBpm(Number(e.target.value) || 110)}
                disabled={isRecording}
                className="w-14 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-mono"
              />
              <span>BPM</span>
            </div>
          </div>

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              isRecording ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
            }`}
          >
            {isRecording ? <><Square className="w-3.5 h-3.5 fill-current" /> Stop &amp; Capture Take</> : <><Mic className="w-3.5 h-3.5" /> Record Live Audio</>}
          </button>
        </div>

        {/* Upload Audio File */}
        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5 flex flex-col justify-between">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-cyan-400" /> Upload Your Song
          </div>
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-4 rounded-lg border border-dashed border-white/20 hover:border-cyan-400 bg-black/30 text-center text-xs text-white/75 cursor-pointer"
          >
            Drop or browse WAV, MP3, FLAC, OGG, M4A
            <span className="block text-[10px] text-white/40 mt-0.5">Supports full-length 5–10 min songs</span>
          </button>
        </div>

        {/* Pick from Library */}
        <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5 flex flex-col justify-between">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-amber-400" /> Active Source Track
          </div>
          <select
            value=""
            onChange={(e) => e.target.value && handleSelectLibraryTrack(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white"
          >
            <option value="">Load a track from Music Library ({tracks.length})…</option>
            {tracks.map(t => (
              <option key={t.id} value={t.id}>{t.title} ({fmtTime(t.seconds)})</option>
            ))}
          </select>
          {sourceUrl ? (
            <div className="space-y-1">
              <div className="text-[11px] text-emerald-300 font-semibold truncate">Loaded: {trackTitle}</div>
              <audio controls src={sourceUrl} className="w-full h-8" />
            </div>
          ) : (
            <div className="text-[11px] text-white/40">No track loaded yet. Record, upload, or pick one above.</div>
          )}
        </div>
      </div>

      {/* 2. PRODUCER GOAL & ANALYZE TRIGGER */}
      <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-white/60 block mb-1">Track Title</label>
            <input
              type="text"
              value={trackTitle}
              onChange={(e) => setTrackTitle(e.target.value)}
              placeholder="Song title..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/60 block mb-1">Target Genre</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white">
              {GENRES.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-white/60 block mb-1">AI Revision Goal</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white">
              {REVISION_GOALS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-white/60 block mb-1">Optional Lyrics (AI can tighten rhyme &amp; cadence)</label>
            <textarea
              rows={2}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste lyrics if this is a vocal song..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/60 block mb-1">Producer Notes (What feels off or what do you want improved?)</label>
            <textarea
              rows={2}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="e.g. The chorus feels flat compared to the verse, smooth out vocal volume spikes..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!sourceBlob || analyzing}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{analyzing ? 'Measuring PCM Spectrum, BPM, Energy Arc & Consulting AI Producer…' : 'Analyze Song & Generate AI Revision Plan'}</span>
        </button>
      </div>

      {/* 3. REAL ACOUSTIC TELEMETRY & AI PRODUCER SCORECARD */}
      {analysis && plan && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Measured DSP Telemetry (5 cols) */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-black/35 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Measured Acoustic Telemetry</span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-fuchsia-600 text-white">
                Score {plan.overallScore}/100
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Est. BPM', `${analysis.estimatedBpm}`],
                ['Est. Key', analysis.estimatedKey],
                ['Duration', fmtTime(analysis.durationSec)],
                ['Loudness', `${analysis.loudnessDb} dB`],
                ['Dyn Range', `${analysis.crestFactorDb} dB`],
                ['Clips', `${analysis.clippedSamples}`],
              ].map(([k, v]) => (
                <div key={k} className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-[10px] text-white/45 uppercase">{k}</div>
                  <div className="text-xs font-bold text-white font-mono mt-0.5 truncate">{v}</div>
                </div>
              ))}
            </div>

            {/* 3-Band Spectral Balance */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70 font-semibold">3-Band Spectral Balance</span>
                <span className="text-white/45 font-mono">Centroid {analysis.spectralBalance.centroidHz} Hz</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono">
                {[
                  ['Bass (20–250 Hz)', analysis.spectralBalance.bassPct, 'bg-amber-500'],
                  ['Mids (250–2.5k Hz)', analysis.spectralBalance.midPct, 'bg-fuchsia-500'],
                  ['Highs (2.5k–16k Hz)', analysis.spectralBalance.highPct, 'bg-cyan-400'],
                ].map(([label, pct, barCls]) => (
                  <div key={label} className="space-y-0.5">
                    <div className="flex justify-between text-white/70"><span>{label}</span><span>{pct}%</span></div>
                    <div className="h-1.5 rounded bg-white/10 overflow-hidden"><div className={`h-full ${barCls}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section Energy Arc */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70 font-semibold">Song Energy &amp; Flow Arc</span>
                <span className="text-white/45 font-mono">Flow contrast {analysis.flowContrastPct}%</span>
              </div>
              <div className="h-20 flex items-end gap-1 p-2 rounded-lg bg-black/40 border border-white/10">
                {analysis.energyArc.map(seg => (
                  <div
                    key={seg.index}
                    title={`${seg.startSec}s–${seg.endSec}s (Energy ${Math.round(seg.normalized * 100)}%)`}
                    className="flex-1 rounded-t bg-gradient-to-t from-fuchsia-600 to-cyan-400 min-h-[4px]"
                    style={{ height: `${Math.max(8, Math.round(seg.normalized * 100))}%` }}
                  />
                ))}
              </div>
              <div className="text-[10px] text-white/45 font-mono flex justify-between">
                <span>Dead-air intro: {analysis.leadingSilenceSec}s</span>
                <span>Dead-air outro: {analysis.trailingSilenceSec}s</span>
              </div>
            </div>
          </div>

          {/* AI Producer Review & 2-Tier Revision Controls (7 cols) */}
          <div className="lg:col-span-7 p-4 rounded-xl bg-black/35 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-fuchsia-400" />
                AI Producer Critique &amp; Revision Controls
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/70">
                {plan.source === 'ai-producer' ? 'LLM + DSP Verified' : 'Acoustic DSP Mode'}
              </span>
            </div>

            <p className="text-xs text-white/85 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/10">
              {plan.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Working Well</div>
                {plan.strengths.map((s, i) => <div key={i} className="text-white/75">• {s}</div>)}
              </div>
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/20 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Recommended Fixes</div>
                {plan.improvements.map((s, i) => <div key={i} className="text-white/75">• {s}</div>)}
              </div>
            </div>

            {/* Fine-Tunable Mastering EQ / Compression Sliders */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
              <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Offline Sovereign Mastering DSP Chain (Auto-Tuned by Analyzer)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px] text-white/70">
                <label>Bass 120Hz: {dsp.lowGainDb > 0 ? `+${dsp.lowGainDb}` : dsp.lowGainDb} dB
                  <input type="range" min={-6} max={6} step={0.5} value={dsp.lowGainDb} onChange={(e) => setDsp({ ...dsp, lowGainDb: Number(e.target.value) })} className="w-full accent-cyan-400" />
                </label>
                <label>Mids 1.2kHz: {dsp.midGainDb > 0 ? `+${dsp.midGainDb}` : dsp.midGainDb} dB
                  <input type="range" min={-6} max={6} step={0.5} value={dsp.midGainDb} onChange={(e) => setDsp({ ...dsp, midGainDb: Number(e.target.value) })} className="w-full accent-cyan-400" />
                </label>
                <label>Air 6.5kHz: {dsp.highGainDb > 0 ? `+${dsp.highGainDb}` : dsp.highGainDb} dB
                  <input type="range" min={-6} max={6} step={0.5} value={dsp.highGainDb} onChange={(e) => setDsp({ ...dsp, highGainDb: Number(e.target.value) })} className="w-full accent-cyan-400" />
                </label>
                <label>Glue Comp: {dsp.compressionRatio}:1
                  <input type="range" min={1} max={6} step={0.2} value={dsp.compressionRatio} onChange={(e) => setDsp({ ...dsp, compressionRatio: Number(e.target.value) })} className="w-full accent-fuchsia-400" />
                </label>
                <label>Stereo Width: {Math.round(dsp.stereoWidth * 100)}%
                  <input type="range" min={0.6} max={1.5} step={0.05} value={dsp.stereoWidth} onChange={(e) => setDsp({ ...dsp, stereoWidth: Number(e.target.value) })} className="w-full accent-fuchsia-400" />
                </label>
                <label className="flex items-center gap-2 pt-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(dsp.trimDeadAir)} onChange={(e) => setDsp({ ...dsp, trimDeadAir: e.target.checked })} className="accent-cyan-400" />
                  Auto-trim dead air
                </label>
              </div>
            </div>

            {/* ACE-Step 1.5 AI Re-Arrangement Tags & Fidelity Slider */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-fuchsia-300">ACE-Step 1.5 AI Flow &amp; Arrangement Tags</span>
                <span className="font-mono text-white/60">Re-Write Strength: {Math.round(remixStrength * 100)}%</span>
              </div>
              <input
                type="text"
                value={revisedTags}
                onChange={(e) => setRevisedTags(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
              />
              <input type="range" min={0.25} max={0.78} step={0.05} value={remixStrength} onChange={(e) => setRemixStrength(Number(e.target.value))} className="w-full accent-fuchsia-500" />
              <div className="flex justify-between text-[10px] text-white/40">
                <span>25% Subtle Polish (Keep Original Melody Tight)</span>
                <span>75% Deep Studio Re-Production</span>
              </div>
            </div>

            {/* 1-Click Revision Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={revising}
                onClick={() => handleRunRevision('dsp')}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {revising ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sliders className="w-3.5 h-3.5" />}
                Apply Instant DSP Master (Offline)
              </button>
              <button
                type="button"
                disabled={revising || !musicReady}
                onClick={() => handleRunRevision('ai_remix')}
                title={musicReady ? 'Re-arrange flow and instrumentation via ACE-Step 1.5' : 'Install ACE-Step 1.5 in the Engine tab to enable AI audio re-arrangement'}
                className="px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" /> AI Flow &amp; Arrangement Revision
              </button>
              <button
                type="button"
                disabled={revising || !musicReady}
                onClick={() => handleRunRevision('both')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Full AI Re-Arrange + Master
              </button>
            </div>
            {revising && <div className="text-xs text-fuchsia-300 font-mono">{reviseStatus}</div>}
          </div>
        </div>
      )}

      {/* 4. A/B COMPARE PLAYER & SAVE TO LIBRARY */}
      {revisedResult && revisedUrl && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-fuchsia-950/60 to-cyan-950/50 border border-fuchsia-500/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-fuchsia-300" />
              <span className="text-sm font-bold text-white">A/B Comparison: {revisedResult.title}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-lg border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setAbMode('original')}
                className={`px-3 py-1 rounded font-bold cursor-pointer ${abMode === 'original' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
              >
                A: Original
              </button>
              <button
                type="button"
                onClick={() => setAbMode('revised')}
                className={`px-3 py-1 rounded font-bold cursor-pointer ${abMode === 'revised' ? 'bg-fuchsia-600 text-white' : 'text-white/60 hover:text-white'}`}
              >
                B: AI Revised
              </button>
            </div>
          </div>

          <audio key={abMode} controls src={activePlayerUrl} className="w-full" />

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-white/75">
            <div>
              Loudness: {analysis?.loudnessDb} dB → <b className="text-emerald-300">{revisedResult.analysisAfter?.loudnessDb} dB</b>
              {'  •  '}
              Clips: {analysis?.clippedSamples} → <b className="text-emerald-300">{revisedResult.analysisAfter?.clippedSamples}</b>
              {'  •  '}
              Duration: {fmtTime(analysis?.durationSec)} → <b className="text-cyan-300">{fmtTime(revisedResult.analysisAfter?.durationSec)}</b>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveRevisedToLibrary}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save Revised to Library
              </button>
              <a
                href={revisedUrl}
                download={`${(trackTitle || 'revised').replace(/[^a-z0-9]+/gi, '_')}_revised.wav`}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-sans font-semibold text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download WAV
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

