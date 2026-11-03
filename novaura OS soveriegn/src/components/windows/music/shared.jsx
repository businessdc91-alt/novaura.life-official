import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, Music2 } from 'lucide-react';
import { getBlob } from '../../../services/music/musicStudio.js';

// Object URLs for stored blobs, cached and revoked when no component uses them.
const cache = new Map(); // blobId -> { url, refs }

export function useBlobUrl(blobId) {
  const [url, setUrl] = useState(() => cache.get(blobId)?.url || null);
  useEffect(() => {
    if (!blobId) { setUrl(null); return undefined; }
    let cancelled = false;
    const entry = cache.get(blobId);
    if (entry) {
      entry.refs++;
      setUrl(entry.url);
    } else {
      getBlob(blobId).then(blob => {
        if (cancelled || !blob) return;
        const existing = cache.get(blobId);
        if (existing) { existing.refs++; setUrl(existing.url); return; }
        const u = URL.createObjectURL(blob);
        cache.set(blobId, { url: u, refs: 1 });
        setUrl(u);
      });
    }
    return () => {
      cancelled = true;
      const e = cache.get(blobId);
      if (e && --e.refs <= 0) {
        URL.revokeObjectURL(e.url);
        cache.delete(blobId);
      }
    };
  }, [blobId]);
  return url;
}

const GRADIENTS = ['from-fuchsia-600 to-indigo-700', 'from-amber-500 to-rose-600', 'from-cyan-500 to-blue-700', 'from-emerald-500 to-teal-700', 'from-violet-600 to-pink-600', 'from-orange-500 to-red-700'];

export function Cover({ blobId, title = '', className = '' }) {
  const url = useBlobUrl(blobId);
  const g = GRADIENTS[[...title].reduce((n, c) => n + c.charCodeAt(0), 0) % GRADIENTS.length];
  if (url) return <img src={url} alt="" className={`object-cover ${className}`} draggable={false} />;
  return (
    <div className={`bg-gradient-to-br ${g} flex items-center justify-center ${className}`}>
      <Music2 className="w-1/3 h-1/3 text-white/70" />
    </div>
  );
}

export const fmtTime = (s) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export function PlayerBar({ track, queue, onSelect }) {
  const url = useBlobUrl(track?.audioBlobId);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [repeat, setRepeat] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !url) return;
    a.src = url;
    a.loop = repeat || track?.spec?.mode === 'loop';
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [url]); // only when the source changes; loop/volume have their own effects

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => { if (audioRef.current) audioRef.current.loop = repeat || track?.spec?.mode === 'loop'; }, [repeat, track]);

  const idx = queue.findIndex(t => t.id === track?.id);
  const step = (d) => { const next = queue[idx + d]; if (next) onSelect(next); };

  return (
    <div className="h-16 shrink-0 border-t border-white/10 bg-black/60 backdrop-blur flex items-center gap-3 px-3">
      <audio
        ref={audioRef}
        onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDur(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => step(1)}
      />
      {track ? (
        <>
          <Cover blobId={track.coverBlobId} title={track.title} className="w-11 h-11 rounded-md shrink-0" />
          <div className="w-44 min-w-0">
            <div className="text-[13px] font-semibold text-white truncate">{track.title}</div>
            <div className="text-[11px] text-white/50 truncate">{track.imported ? ([track.artist, track.album].filter(Boolean).join(' · ') || 'Imported') : `${track.spec?.genre} · ${track.spec?.era}`}{track.spec?.mode === 'loop' ? ' · loop' : ''}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => step(-1)} className="text-white/60 hover:text-white"><SkipBack className="w-4 h-4" /></button>
            <button onClick={() => (playing ? audioRef.current.pause() : audioRef.current.play())} className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button onClick={() => step(1)} className="text-white/60 hover:text-white"><SkipForward className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 flex items-center gap-2 text-[11px] text-white/50">
            <span>{fmtTime(time)}</span>
            <input type="range" min={0} max={dur || 0} step={0.1} value={time} onChange={e => { audioRef.current.currentTime = Number(e.target.value); }} className="flex-1 accent-fuchsia-500" />
            <span>{fmtTime(dur)}</span>
          </div>
          <button onClick={() => setRepeat(r => !r)} title="Repeat" className={repeat || track.spec?.mode === 'loop' ? 'text-fuchsia-400' : 'text-white/50'}><Repeat className="w-4 h-4" /></button>
          <Volume2 className="w-4 h-4 text-white/50" />
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-20 accent-fuchsia-500" />
        </>
      ) : (
        <div className="text-[12px] text-white/40">Pick a track to play.</div>
      )}
    </div>
  );
}

export function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[12px] border transition-colors ${active ? 'bg-fuchsia-600/30 border-fuchsia-400/70 text-white' : 'border-white/10 text-white/70 hover:border-white/30 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

/** Voice dictation with the browser's speech recognition, appended to text. */
export function useDictation(onText) {
  const [listening, setListening] = useState(false);
  const Rec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const start = () => {
    if (!Rec || listening) return;
    const rec = new Rec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };
  return { supported: Boolean(Rec), listening, start };
}
