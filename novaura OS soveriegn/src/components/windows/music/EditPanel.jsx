import React, { useEffect, useRef, useState } from 'react';
import { Upload, Scissors, Repeat, Volume2, Save, Download, Wand2, Play, Square, Loader2, Undo2 } from 'lucide-react';
import { decodeAudio, durationOf, trim, fade, normalize, makeSeamlessLoop, waveformPeaks, wavBlob, encodeWav } from '../../../services/music/audioTools.js';
import { saveAudioFile, remixAudio, getBlob } from '../../../services/music/musicStudio.js';
import { GENRES, ERAS } from '../../../services/music/musicCatalog.js';
import { downloadBytes } from '../../../services/cybeni/projectStore.js';
import { fmtTime } from './shared.jsx';

function Waveform({ audio, start, end, playhead }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !audio) return;
    const w = c.width = c.clientWidth * devicePixelRatio;
    const h = c.height = c.clientHeight * devicePixelRatio;
    const ctx = c.getContext('2d');
    const peaks = waveformPeaks(audio, Math.floor(w / (2 * devicePixelRatio)));
    const total = durationOf(audio);
    ctx.clearRect(0, 0, w, h);
    const bw = w / peaks.length;
    peaks.forEach((p, i) => {
      const t = (i / peaks.length) * total;
      ctx.fillStyle = t >= start && t <= end ? '#e879f9' : 'rgba(255,255,255,0.25)';
      const bh = Math.max(1, p * h * 0.95);
      ctx.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 1), bh);
    });
    if (playhead != null) {
      ctx.fillStyle = '#fff';
      ctx.fillRect((playhead / total) * w, 0, 2 * devicePixelRatio, h);
    }
  }, [audio, start, end, playhead]);
  return <canvas ref={ref} className="w-full h-32 rounded-lg bg-black/40" />;
}

export default function EditPanel({ initialTrack, musicReady, say, onSaved }) {
  const [name, setName] = useState('');
  const [audio, setAudio] = useState(null);
  const [history, setHistory] = useState([]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [fadeIn, setFadeIn] = useState(0.5);
  const [fadeOut, setFadeOut] = useState(1.5);
  const [bpm, setBpm] = useState(120);
  const [busy, setBusy] = useState('');
  const [playhead, setPlayhead] = useState(null);
  const [remixGenre, setRemixGenre] = useState('Synthwave');
  const [remixEra, setRemixEra] = useState('1980s');
  const [strength, setStrength] = useState(0.55);
  const playRef = useRef(null);

  const load = async (blob, label) => {
    setBusy('Reading audio…');
    try {
      const a = await decodeAudio(blob);
      setAudio(a);
      setHistory([]);
      setName(label);
      setStart(0);
      setEnd(durationOf(a));
    } catch (err) {
      say(`Could not read that file: ${err.message}`);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    if (initialTrack) {
      getBlob(initialTrack.audioBlobId).then(b => b && load(b, initialTrack.title));
      if (initialTrack.spec?.bpm) setBpm(initialTrack.spec.bpm);
    }
  }, [initialTrack]); // load only when a different track is sent here

  const apply = (fn, label) => {
    setHistory(h => [...h.slice(-9), audio]);
    const next = fn(audio);
    setAudio(next);
    setStart(0);
    setEnd(durationOf(next));
    say(label, 'good');
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(h => h.slice(0, -1));
    setAudio(prev);
    setStart(0);
    setEnd(durationOf(prev));
  };

  const stop = () => {
    if (playRef.current) { playRef.current.stop(); playRef.current.ctx.close(); playRef.current = null; }
    setPlayhead(null);
  };

  const preview = () => {
    stop();
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(audio.channels.length, audio.channels[0].length, audio.sampleRate);
    audio.channels.forEach((ch, i) => buf.copyToChannel(ch, i));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0, start, Math.max(0.05, end - start));
    const t0 = ctx.currentTime;
    const tick = () => { if (playRef.current?.src === src) { setPlayhead(start + (ctx.currentTime - t0)); requestAnimationFrame(tick); } };
    playRef.current = { src, ctx, stop: () => src.stop() };
    src.onended = () => { if (playRef.current?.src === src) stop(); };
    requestAnimationFrame(tick);
  };

  useEffect(() => () => stop(), []);

  const total = audio ? durationOf(audio) : 0;

  const doRemix = async () => {
    setBusy('Remixing with AI…');
    try {
      const blob = new Blob([encodeWav(trim(audio, start, end))], { type: 'audio/wav' });
      const track = await remixAudio(blob, { title: `${name} (${remixGenre} remix)`, genre: remixGenre, era: remixEra, mode: 'instrumental', seconds: Math.round(end - start), bpm }, { strength, onProgress: (p) => p.status && setBusy(p.status) });
      say(`Saved "${track.title}" to your library.`, 'good');
      onSaved?.();
    } catch (err) {
      say(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="text-lg font-bold text-white">Edit</div>
      <label
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f, f.name.replace(/\.\w+$/, '')); }}
        className="flex flex-col items-center justify-center gap-1 p-6 rounded-xl border-2 border-dashed border-white/15 hover:border-fuchsia-400/50 cursor-pointer text-center"
      >
        <Upload className="w-6 h-6 text-white/50" />
        <span className="text-[13px] text-white/80">Drop an audio file here, or click to choose</span>
        <span className="text-[11px] text-white/40">WAV, MP3, FLAC, OGG. Or open a track from the Library with “Edit / make loop”.</span>
        <input type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) load(f, f.name.replace(/\.\w+$/, '')); }} />
      </label>

      {busy && <div className="flex items-center gap-2 text-[12px] text-fuchsia-200"><Loader2 className="w-4 h-4 animate-spin" />{busy}</div>}

      {audio && (
        <>
          <div className="flex items-center gap-2">
            <input value={name} onChange={e => setName(e.target.value)} className="flex-1 bg-transparent text-white font-semibold text-[15px] focus:outline-none" />
            <span className="text-[12px] text-white/40">{fmtTime(total)} · {audio.sampleRate} Hz · {audio.channels.length === 2 ? 'stereo' : 'mono'}</span>
          </div>
          <Waveform audio={audio} start={start} end={end} playhead={playhead} />
          <div className="grid grid-cols-2 gap-3 text-[11px] text-white/60">
            <label>Selection start {fmtTime(start)}<input type="range" min={0} max={total} step={0.05} value={start} onChange={e => setStart(Math.min(Number(e.target.value), end - 0.1))} className="w-full accent-fuchsia-500" /></label>
            <label>Selection end {fmtTime(end)}<input type="range" min={0} max={total} step={0.05} value={end} onChange={e => setEnd(Math.max(Number(e.target.value), start + 0.1))} className="w-full accent-fuchsia-500" /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            {playRef.current
              ? <button onClick={stop} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-[12px] font-semibold"><Square className="w-3.5 h-3.5" /> Stop</button>
              : <button onClick={preview} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-[12px] font-semibold"><Play className="w-3.5 h-3.5" /> Play selection</button>}
            <button onClick={() => apply(a => trim(a, start, end), 'Trimmed to the selection.')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-white text-[12px]"><Scissors className="w-3.5 h-3.5" /> Trim to selection</button>
            <button onClick={() => apply(a => normalize(a), 'Normalized.')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-white text-[12px]"><Volume2 className="w-3.5 h-3.5" /> Normalize</button>
            <button onClick={undo} disabled={!history.length} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-white text-[12px] disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
          </div>
          <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/60">
            <label>Fade in (s)<input type="number" min={0} max={10} step={0.1} value={fadeIn} onChange={e => setFadeIn(Number(e.target.value))} className="block w-20 mt-0.5 bg-black/40 border border-white/10 rounded px-2 py-1 text-white" /></label>
            <label>Fade out (s)<input type="number" min={0} max={20} step={0.1} value={fadeOut} onChange={e => setFadeOut(Number(e.target.value))} className="block w-20 mt-0.5 bg-black/40 border border-white/10 rounded px-2 py-1 text-white" /></label>
            <button onClick={() => apply(a => fade(a, fadeIn, fadeOut), 'Fades applied.')} className="px-3 py-1.5 rounded-lg border border-white/15 text-white text-[12px]">Apply fades</button>
            <div className="w-px self-stretch bg-white/10" />
            <label>BPM<input type="number" min={40} max={240} value={bpm} onChange={e => setBpm(Number(e.target.value))} className="block w-20 mt-0.5 bg-black/40 border border-white/10 rounded px-2 py-1 text-white" /></label>
            <button onClick={() => apply(a => makeSeamlessLoop(trim(a, start, end), { bpm }).audio, 'Made a seamless loop, snapped to whole bars.')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-[12px] font-semibold"><Repeat className="w-3.5 h-3.5" /> Make seamless loop</button>
          </div>
          {musicReady && (
            <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-gradient-to-br from-indigo-900/40 to-fuchsia-900/30 border border-white/10 text-[11px] text-white/60">
              <div className="w-full text-[12px] font-semibold text-white">Remix the selection with AI</div>
              <label>Into
                <select value={remixGenre} onChange={e => setRemixGenre(e.target.value)} className="block mt-0.5 bg-black/40 border border-white/10 rounded px-2 py-1 text-white">{GENRES.map(g => <option key={g.name}>{g.name}</option>)}</select>
              </label>
              <label>Era
                <select value={remixEra} onChange={e => setRemixEra(e.target.value)} className="block mt-0.5 bg-black/40 border border-white/10 rounded px-2 py-1 text-white">{ERAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
              </label>
              <label className="flex-1 min-w-40">How far from the original: {Math.round(strength * 100)}%
                <input type="range" min={0.2} max={0.9} step={0.05} value={strength} onChange={e => setStrength(Number(e.target.value))} className="w-full accent-fuchsia-500" />
              </label>
              <button onClick={doRemix} disabled={Boolean(busy)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold disabled:opacity-40"><Wand2 className="w-3.5 h-3.5" /> Remix</button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={async () => { await saveAudioFile(wavBlob(audio), { title: name }); say(`Saved "${name}" to your library.`, 'good'); onSaved?.(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black text-[12px] font-semibold"><Save className="w-3.5 h-3.5" /> Save to library</button>
            <button onClick={() => downloadBytes(`${name || 'audio'}.wav`, encodeWav(audio), 'audio/wav')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/15 text-white text-[12px]"><Download className="w-3.5 h-3.5" /> Export WAV</button>
          </div>
        </>
      )}
    </div>
  );
}
