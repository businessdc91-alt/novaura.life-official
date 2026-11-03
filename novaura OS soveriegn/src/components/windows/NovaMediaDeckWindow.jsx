import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, FilePlus2, FolderPlus,
  Music, Film, Wand2, Trash2, ExternalLink, ListMusic, Shuffle, Repeat, Repeat1,
  Search, Loader2, X, Save,
} from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';
import { contentToBytes, mimeForName } from '../../services/fileStorageService.js';
import {
  listLibrary, importMediaFiles, deleteLibraryItem, mediaBlob, coverBlob, mediaKind,
} from '../../services/media/mediaLibrary.js';

const SETTINGS_KEY = 'media_deck';
const FILTERS = [['all', 'All'], ['originals', 'NovAura Originals'], ['music', 'My music'], ['videos', 'Videos']];
const NEXT_REPEAT = { off: 'all', all: 'one', one: 'off' };

const formatTime = (secs) => {
  if (!Number.isFinite(secs) || secs <= 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

function CoverArt({ item, className = '' }) {
  const [blobUrl, setBlobUrl] = useState(null);
  useEffect(() => {
    setBlobUrl(null);
    if (item?.coverUrl || !item?.coverBlobId) return undefined;
    let live = true;
    let made = null;
    coverBlob(item.coverBlobId).then((b) => {
      if (live && b) { made = URL.createObjectURL(b); setBlobUrl(made); }
    });
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [item?.coverUrl, item?.coverBlobId]);
  const url = item?.coverUrl || blobUrl;
  if (url) return <img src={url} alt="" draggable={false} className={`object-cover ${className}`} />;
  const Icon = item?.mediaType === 'video' ? Film : Music;
  return (
    <div className={`bg-gradient-to-br from-cyan-600 to-purple-700 flex items-center justify-center ${className}`}>
      <Icon className="w-1/3 h-1/3 text-white/80" />
    </div>
  );
}

// Every file under a dropped folder (drag and drop hands over directory entries).
async function filesFromDrop(dataTransfer) {
  const entries = [...(dataTransfer.items || [])].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...(dataTransfer.files || [])];
  const out = [];
  const walk = async (entry) => {
    if (entry.isFile) {
      out.push(await new Promise((res, rej) => entry.file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

export default function NovaMediaDeckWindow({ props: windowProps } = {}) {
  const [library, setLibrary] = useState({ originals: [], music: [], videos: [] });
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('all');
  const [speed, setSpeed] = useState(1);
  const [importing, setImporting] = useState(null); // { done, total, name }
  const [notice, setNotice] = useState(null); // { text, tone }
  const [playError, setPlayError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const urlRef = useRef(null);
  const autoplayRef = useRef(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const settingsLoaded = useRef(false);

  const say = useCallback((text, tone = 'ok') => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(n => (n?.text === text ? null : n)), 7000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLibrary(await listLibrary());
    } catch (e) {
      console.warn('[MediaDeck] Library load failed:', e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('novaura:music_updated', refresh);
    return () => window.removeEventListener('novaura:music_updated', refresh);
  }, [refresh]);

  // Volume, shuffle and repeat are remembered between sessions.
  useEffect(() => {
    db.getSetting(SETTINGS_KEY, {}).then((s) => {
      if (typeof s?.volume === 'number') setVolume(s.volume);
      if (typeof s?.muted === 'boolean') setIsMuted(s.muted);
      if (typeof s?.shuffle === 'boolean') setShuffle(s.shuffle);
      if (s?.repeat in NEXT_REPEAT) setRepeat(s.repeat);
    }).catch(() => {}).finally(() => { settingsLoaded.current = true; });
  }, []);
  useEffect(() => {
    if (settingsLoaded.current) db.setSetting(SETTINGS_KEY, { volume, muted: isMuted, shuffle, repeat }).catch(() => {});
  }, [volume, isMuted, shuffle, repeat]);

  const allItems = useMemo(() => [...library.originals, ...library.music, ...library.videos], [library]);
  const visible = useMemo(() => {
    const groups = { all: allItems, originals: library.originals, music: library.music, videos: library.videos };
    const q = query.trim().toLowerCase();
    const list = groups[filter] || allItems;
    return q ? list.filter(i => `${i.title} ${i.artist} ${i.album}`.toLowerCase().includes(q)) : list;
  }, [allItems, library, filter, query]);

  const mediaEl = (item = current) => (item?.mediaType === 'video' ? videoRef.current : audioRef.current);

  const startPlayback = useCallback((el) => {
    if (!el) return;
    if (el === audioRef.current) {
      // The visualizer taps the audio element once; after that its sound runs through the context.
      try {
        if (!audioCtxRef.current) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 128;
            ctx.createMediaElementSource(el).connect(analyser);
            analyser.connect(ctx.destination);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;
          }
        }
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      } catch (e) {
        console.warn('[MediaDeck] Visualizer unavailable:', e.message);
      }
    }
    el.play().catch((e) => {
      if (e.name !== 'AbortError') setPlayError(`Could not start playback: ${e.message}`);
    });
  }, []);

  const playItem = useCallback((item, list) => {
    if (!item) return;
    if (list) setQueue(list);
    autoplayRef.current = true;
    if (current?.key === item.key) {
      const el = mediaEl(item);
      if (el) { el.currentTime = 0; startPlayback(el); }
      return;
    }
    setCurrent(item);
  }, [current, startPlayback]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the bytes for whatever is current into the right element.
  useEffect(() => {
    if (!current) return undefined;
    let cancelled = false;
    const el = mediaEl(current);
    const other = current.mediaType === 'video' ? audioRef.current : videoRef.current;
    if (other) { other.pause(); other.removeAttribute('src'); other.load(); }
    setCurrentTime(0);
    setDuration(current.seconds || 0);
    setPlayError('');
    mediaBlob(current).then((blob) => {
      if (cancelled || !el) return;
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      el.src = url;
      el.playbackRate = speed;
      if (autoplayRef.current) startPlayback(el);
    }).catch((e) => { if (!cancelled) setPlayError(e.message); });
    return () => { cancelled = true; };
  }, [current?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    audioCtxRef.current?.close().catch(() => {});
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    for (const el of [audioRef.current, videoRef.current]) {
      if (!el) continue;
      el.volume = volume;
      el.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repeat === 'one';
    if (videoRef.current) videoRef.current.loop = repeat === 'one';
  }, [repeat]);

  const step = useCallback((dir, { auto = false } = {}) => {
    const items = queue.length ? queue : visible;
    if (!items.length) return;
    const idx = items.findIndex(i => i.key === current?.key);
    if (dir < 0 && (mediaEl()?.currentTime || 0) > 3) {
      mediaEl().currentTime = 0;
      return;
    }
    let next;
    if (shuffle && items.length > 1) {
      do { next = Math.floor(Math.random() * items.length); } while (next === idx);
    } else {
      next = idx + dir;
      if (next >= items.length || next < 0) {
        if (auto && repeat === 'off') { setIsPlaying(false); return; }
        next = (next + items.length) % items.length;
      }
    }
    playItem(items[next]);
  }, [queue, visible, current, shuffle, repeat, playItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    if (!current) {
      playItem(visible[0], visible);
      return;
    }
    const el = mediaEl();
    if (!el) return;
    if (el.paused) { autoplayRef.current = true; startPlayback(el); } else el.pause();
  };

  // Windows media keys and the volume flyout show the current track.
  const stepRef = useRef(step);
  const toggleRef = useRef(togglePlay);
  useEffect(() => {
    stepRef.current = step;
    toggleRef.current = togglePlay;
  });
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return undefined;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: current.title,
        artist: current.artist || '',
        album: current.album || '',
        artwork: current.coverUrl ? [{ src: new URL(current.coverUrl, window.location.href).href }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => toggleRef.current());
      navigator.mediaSession.setActionHandler('pause', () => toggleRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => stepRef.current(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => stepRef.current(1));
    } catch { /* not supported */ }
    return undefined;
  }, [current]);
  useEffect(() => () => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      for (const a of ['play', 'pause', 'previoustrack', 'nexttrack']) navigator.mediaSession.setActionHandler(a, null);
    } catch { /* not supported */ }
  }, []);

  // Spectrum bars while audio plays.
  useEffect(() => {
    if (!isPlaying || current?.mediaType !== 'audio') return undefined;
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return undefined;
    const ctx = canvas.getContext('2d');
    const data = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      const bars = Math.floor(data.length * 0.75);
      const bw = w / bars;
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#06b6d4');
      grad.addColorStop(0.5, '#8b5cf6');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      for (let i = 0; i < bars; i++) {
        const bh = (data[i] / 255) * h;
        ctx.fillRect(i * bw, h - bh, Math.max(1, bw - 2), bh);
      }
    };
    render();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, current?.mediaType]);

  // ── Importing ───────────────────────────────────────────────────────────

  const runImport = async (files) => {
    const media = files.filter(f => mediaKind(f));
    if (!media.length) {
      say(files.length ? 'No audio or video files in that selection.' : 'Nothing was selected.', 'bad');
      return;
    }
    setImporting({ done: 0, total: media.length, name: '' });
    try {
      const { added, skipped, failed } = await importMediaFiles(media, { onProgress: setImporting });
      await refresh();
      const parts = [`Added ${added.length} ${added.length === 1 ? 'item' : 'items'}`];
      const dupes = skipped.filter(s => s.reason === 'already in the library').length;
      if (dupes) parts.push(`${dupes} already in your library`);
      if (failed.length) parts.push(`${failed.length} failed (${failed[0].name}: ${failed[0].reason})`);
      say(parts.join(', ') + '.', failed.length && !added.length ? 'bad' : 'ok');
      if (added.length) {
        setFilter(added[0].mediaType === 'video' ? 'videos' : 'music');
        if (!current) { autoplayRef.current = false; setCurrent(added[0]); }
      }
    } catch (e) {
      say(`Import failed: ${e.message}`, 'bad');
    } finally {
      setImporting(null);
    }
  };

  const onPickFiles = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    runImport(files);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    if (importing) return;
    runImport(await filesFromDrop(e.dataTransfer));
  };

  // A file opened from the Files app plays right away; it joins the library only if saved.
  const lastOpenRef = useRef(null);
  const openVaultFile = useCallback(async (fileId, openId) => {
    if (openId && lastOpenRef.current === openId) return; // the same handoff, arriving as props and as an event
    lastOpenRef.current = openId || null;
    try {
      const doc = await db.documents.get(fileId);
      if (!doc || doc.type !== 'file') throw new Error('That file is no longer in your vault.');
      const type = doc.mimeType && doc.mimeType !== 'application/octet-stream' ? doc.mimeType : mimeForName(doc.name);
      const blob = new Blob([await contentToBytes(doc.content)], { type });
      const kind = mediaKind({ name: doc.name, type });
      if (!kind) throw new Error(`${doc.name} is not an audio or video file.`);
      const item = { key: `file_${doc.id}_${Date.now()}`, source: 'file', mediaType: kind, title: doc.name.replace(/\.[^.]+$/, ''), artist: 'From Files', album: '', seconds: 0, blob, fileName: doc.name };
      setQueue([item]);
      autoplayRef.current = true;
      setCurrent(item);
    } catch (e) {
      say(e.message, 'bad');
    }
  }, [say]);

  useEffect(() => {
    if (windowProps?.fileId) openVaultFile(windowProps.fileId, windowProps.openId);
  }, [windowProps?.fileId, windowProps?.openId, openVaultFile]);
  useEffect(() => {
    const onContext = (e) => {
      if (e.detail?.appId === 'media_deck' && e.detail.props?.fileId) openVaultFile(e.detail.props.fileId, e.detail.props.openId);
    };
    window.addEventListener('novaura:app_context', onContext);
    return () => window.removeEventListener('novaura:app_context', onContext);
  }, [openVaultFile]);

  const saveCurrentToLibrary = async () => {
    if (current?.source !== 'file') return;
    const file = new File([current.blob], current.fileName, { type: current.blob.type });
    await runImport([file]);
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Remove "${item.title}" from your library? This deletes its stored copy.`)) return;
    if (current?.key === item.key) {
      mediaEl()?.pause();
      setCurrent(null);
      setIsPlaying(false);
    }
    setQueue(q => q.filter(i => i.key !== item.key));
    await deleteLibraryItem(item);
    await refresh();
  };

  const openMusicStudio = () => {
    window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'music_studio', toggle: false } }));
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.current?.requestPictureInPicture();
    } catch (e) {
      say(`Picture-in-picture: ${e.message}`, 'bad');
    }
  };

  const mediaEvents = (kind) => ({
    onPlay: () => { if (current?.mediaType === kind) setIsPlaying(true); },
    onPause: () => { if (current?.mediaType === kind) setIsPlaying(false); },
    onTimeUpdate: (e) => { if (current?.mediaType === kind) setCurrentTime(e.currentTarget.currentTime); },
    onLoadedMetadata: (e) => { if (current?.mediaType === kind && Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); },
    onEnded: () => { if (current?.mediaType === kind) step(1, { auto: true }); },
    onError: (e) => {
      if (current?.mediaType !== kind || !e.currentTarget.getAttribute('src')) return;
      setIsPlaying(false);
      setPlayError(`"${current.title}" can't be played here; its format may not be supported.`);
    },
  });

  const isVideo = current?.mediaType === 'video';
  const counts = { all: allItems.length, originals: library.originals.length, music: library.music.length, videos: library.videos.length };
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <div
      className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden relative"
      onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
            {isVideo ? <Film className="w-5 h-5 text-white" /> : <Music className="w-5 h-5 text-white" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-wide text-white">Nova Media Deck</h2>
            <p className="text-[11px] text-slate-400 truncate">Your music and videos, stored on this machine. Drop files or a folder anywhere here.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => fileInputRef.current?.click()} disabled={!!importing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold border border-slate-700">
            <FilePlus2 className="w-3.5 h-3.5 text-cyan-400" /> Add files
          </button>
          <button onClick={() => folderInputRef.current?.click()} disabled={!!importing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold border border-slate-700">
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" /> Add folder
          </button>
          <button onClick={openMusicStudio} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-semibold" title="Make songs with the local music model">
            <Wand2 className="w-3.5 h-3.5" /> Make a song
          </button>
          <input ref={fileInputRef} type="file" multiple accept="audio/*,video/*,.mp3,.flac,.m4a,.ogg,.opus,.wav,.mkv,.mov" onChange={onPickFiles} className="hidden" />
          <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple onChange={onPickFiles} className="hidden" />
        </div>
      </div>

      {(importing || notice) && (
        <div className={`px-5 py-2 text-xs border-b shrink-0 flex items-center gap-2 ${notice?.tone === 'bad' && !importing ? 'bg-rose-950/50 border-rose-900 text-rose-200' : 'bg-cyan-950/40 border-cyan-900 text-cyan-100'}`}>
          {importing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="shrink-0">Importing {Math.min(importing.done + 1, importing.total)} of {importing.total}</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all" style={{ width: `${(importing.done / importing.total) * 100}%` }} /></div>
              <span className="truncate max-w-[16rem] text-cyan-300/80">{importing.name}</span>
            </>
          ) : (
            <>
              <span className="flex-1">{notice.text}</span>
              <button onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 overflow-y-auto lg:overflow-hidden">
        {/* Now playing */}
        <div className="lg:col-span-3 flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-5 min-h-[380px]">
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80">
            <video
              ref={videoRef}
              playsInline
              className={isVideo ? 'w-full h-full object-contain bg-black' : 'hidden'}
              {...mediaEvents('video')}
            />
            {!isVideo && (
              <>
                <canvas ref={canvasRef} className="absolute inset-x-0 bottom-0 w-full h-1/2 opacity-60 pointer-events-none" />
                {current ? (
                  <div className="relative flex flex-col items-center text-center px-6">
                    <CoverArt item={current} className="w-40 h-40 rounded-2xl shadow-2xl shadow-purple-900/40 mb-4" />
                    <h3 className="text-base font-bold text-white">{current.title}</h3>
                    <p className="text-xs text-slate-400">{[current.artist, current.album].filter(Boolean).join(' · ') || ' '}</p>
                  </div>
                ) : (
                  <div className="relative text-center text-slate-500 text-sm px-6">
                    <ListMusic className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                    {loaded ? 'Pick something from the library, or press play.' : 'Loading your library...'}
                  </div>
                )}
              </>
            )}
          </div>
          <audio ref={audioRef} {...mediaEvents('audio')} />

          {playError && <div className="mt-3 text-xs text-rose-300 bg-rose-950/40 border border-rose-900 rounded-lg px-3 py-2">{playError}</div>}
          {current?.source === 'file' && (
            <button onClick={saveCurrentToLibrary} disabled={!!importing} className="mt-3 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">
              <Save className="w-3.5 h-3.5 text-cyan-400" /> Save to library
            </button>
          )}

          {/* Scrubber */}
          <div className="mt-4 space-y-1 font-mono">
            <input
              type="range" min={0} max={duration || 0} step={0.1} value={Math.min(currentTime, duration || 0)}
              disabled={!current}
              onChange={(e) => { const el = mediaEl(); if (el) el.currentTime = Number(e.target.value); setCurrentTime(Number(e.target.value)); }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              aria-label="Seek"
            />
            <div className="flex justify-between text-[11px] text-slate-400"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          </div>

          {/* Transport */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1">
              <button onClick={() => setShuffle(s => !s)} title={shuffle ? 'Shuffle on' : 'Shuffle off'} className={`p-2 rounded-lg ${shuffle ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-white'}`}><Shuffle className="w-4 h-4" /></button>
              <button onClick={() => setRepeat(r => NEXT_REPEAT[r])} title={{ off: 'Repeat off', all: 'Repeat all', one: 'Repeat this one' }[repeat]} className={`p-2 rounded-lg ${repeat !== 'off' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-white'}`}><RepeatIcon className="w-4 h-4" /></button>
              <select
                value={speed}
                onChange={(e) => { const s = Number(e.target.value); setSpeed(s); for (const el of [audioRef.current, videoRef.current]) if (el) el.playbackRate = s; }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-[11px] font-mono text-slate-300"
                title="Playback speed"
              >
                {[0.75, 1, 1.25, 1.5, 2].map(s => <option key={s} value={s}>{s}x</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => step(-1)} disabled={!current} className="p-2 text-slate-400 hover:text-white disabled:opacity-40" title="Previous"><SkipBack className="w-5 h-5" /></button>
              <button onClick={togglePlay} disabled={!allItems.length && !current} className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-40 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30" title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>
              <button onClick={() => step(1)} disabled={!current} className="p-2 text-slate-400 hover:text-white disabled:opacity-40" title="Next"><SkipForward className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-2">
              {isVideo && (
                <button onClick={togglePiP} className="p-2 text-slate-400 hover:text-white" title="Picture-in-picture"><ExternalLink className="w-4 h-4" /></button>
              )}
              <button onClick={() => setIsMuted(m => !m)} className="text-slate-400 hover:text-white" title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.02} value={isMuted ? 0 : volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }}
                className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>

        {/* Library */}
        <div className="lg:col-span-2 flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-4 min-h-[320px] lg:min-h-0">
          <div className="flex flex-wrap gap-1 mb-3">
            {FILTERS.map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${filter === id ? 'bg-cyan-600/30 border-cyan-500/60 text-white' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                {label} <span className="opacity-60">{counts[id]}</span>
              </button>
            ))}
          </div>
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, artist or album" className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-600 select-text" />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {visible.map((item) => {
              const active = current?.key === item.key;
              return (
                <div
                  key={item.key}
                  onClick={() => playItem(item, visible)}
                  className={`group p-2 rounded-xl border cursor-pointer flex items-center gap-2.5 ${active ? 'bg-slate-900 border-cyan-500/60' : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800/60'}`}
                >
                  <CoverArt item={item} className="w-9 h-9 rounded-lg shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold truncate ${active ? 'text-cyan-300' : 'text-white'}`}>{item.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{[item.artist, item.album].filter(Boolean).join(' · ') || (item.mediaType === 'video' ? 'Video' : 'Audio')}</div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">{item.seconds ? formatTime(item.seconds) : ''}</span>
                  {item.source !== 'original' && (
                    <button onClick={(e) => { e.stopPropagation(); removeItem(item); }} className="p-1 rounded text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Remove from library">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {loaded && !visible.length && (
              <div className="text-center text-xs text-slate-500 py-10 px-4">
                {query ? 'Nothing matches that search.' : filter === 'videos' ? 'No videos yet. Add files or drop them here.' : 'Nothing here yet. Add files, add a folder, or drop music onto this window.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {dragOver && (
        <div className="absolute inset-0 z-20 bg-cyan-950/70 border-2 border-dashed border-cyan-400 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <FolderPlus className="w-10 h-10 text-cyan-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-white">Drop to add to your library</div>
            <div className="text-xs text-cyan-200/80">Audio and video files, or whole folders</div>
          </div>
        </div>
      )}
    </div>
  );
}
