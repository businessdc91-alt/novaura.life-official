import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Music2, Sparkles, Library, Disc3, Globe, Scissors, Cpu, Settings2, X } from 'lucide-react';
import { listTracks, listAlbums, generateSong, getMusicSettings, setMusicSettings, pickMusicModel } from '../../services/music/musicStudio.js';
import { DEFAULT_SPEC } from '../../services/music/musicCatalog.js';
import { probeComfy, installedModels, MODEL_CATALOG, isModelInstalled } from '../../services/engines/comfyEngine.js';
import { listCybeniModels, describeModelKey } from '../../services/cybeni/models.js';
import CreatePanel from './music/CreatePanel.jsx';
import LibraryPanel from './music/LibraryPanel.jsx';
import AlbumsPanel from './music/AlbumsPanel.jsx';
import EditPanel from './music/EditPanel.jsx';
import EngineSetup from './engines/EngineSetup.jsx';
import { PlayerBar } from './music/shared.jsx';

const NAV = [
  ['create', 'Create', Sparkles],
  ['library', 'Library', Library],
  ['albums', 'Albums', Disc3],
  ['published', 'Published', Globe],
  ['edit', 'Edit', Scissors],
  ['engine', 'Engine', Cpu],
];

export default function MusicStudioWindow() {
  const [tab, setTab] = useState('create');
  const [spec, setSpec] = useState(DEFAULT_SPEC);
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [current, setCurrent] = useState(null);
  const [queue, setQueue] = useState([]);
  const [editTrack, setEditTrack] = useState(null);
  const [engineReady, setEngineReady] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);
  const [textModels, setTextModels] = useState([]);
  const running = useRef(false);
  const pending = useRef([]);

  const say = useCallback((text, tone = 'bad') => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(n => (n?.text === text ? null : n)), 6000);
  }, []);

  const refresh = useCallback(async () => {
    setTracks(await listTracks());
    setAlbums(await listAlbums());
  }, []);

  const checkEngine = useCallback(async () => {
    const up = Boolean(await probeComfy());
    const models = await installedModels();
    const hasMusic = MODEL_CATALOG.filter(m => m.purpose === 'music').some(m => isModelInstalled(m, models));
    setMusicReady(hasMusic);
    setEngineReady(hasMusic);
    return { up, hasMusic };
  }, []);

  useEffect(() => {
    refresh();
    checkEngine();
    getMusicSettings().then(setSettings);
    window.addEventListener('novaura:music_updated', refresh);
    return () => window.removeEventListener('novaura:music_updated', refresh);
  }, [refresh, checkEngine]);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (pending.current.length) {
      const job = pending.current.shift();
      const update = (patch) => setJobs(js => js.map(j => (j.id === job.id ? { ...j, ...patch } : j)));
      try {
        update({ status: 'Starting…' });
        const made = await generateSong(job.spec, {
          onProgress: (p) => update(p.status ? { status: p.status } : p.max ? { status: `Composing: step ${p.value} of ${p.max}`, value: p.value, max: p.max } : {}),
        });
        setJobs(js => js.filter(j => j.id !== job.id));
        await refresh();
        if (made[0]) { setCurrent(made[0]); setQueue(made); }
        say(`"${made[0]?.title}" is ready${made.length > 1 ? ` (${made.length} takes)` : ''}. Cover art is painting in the background.`, 'good');
      } catch (err) {
        update({ error: err.message });
        if (err.code === 'NO_MUSIC_MODEL') setTab('engine');
        setTimeout(() => setJobs(js => js.filter(j => j.id !== job.id)), 15000);
      }
    }
    running.current = false;
  }, [refresh, say]);

  const create = (s) => {
    const job = { id: `job_${Date.now()}`, title: s.title || `${s.era} ${s.genre}`, spec: s, status: 'Queued' };
    setJobs(js => [...js, job]);
    pending.current.push(job);
    pump();
  };

  const play = (track, list) => {
    setCurrent(track);
    setQueue(list || tracks);
  };

  const openSettings = async () => {
    setShowSettings(true);
    setTextModels(await listCybeniModels());
    const m = await pickMusicModel().catch(() => null);
    setSettings(s => ({ ...s, musicModel: m?.checkpoint || '' }));
  };

  const saveSetting = async (patch) => setSettings(await setMusicSettings(patch));

  const tones = { good: 'bg-emerald-600/90', bad: 'bg-rose-600/90', warn: 'bg-amber-600/90' };

  return (
    <div className="relative flex flex-col h-full bg-[radial-gradient(ellipse_at_top_left,_#2a0f3d,_#09090b_55%)] text-white font-sans overflow-hidden">
      <div className="flex-1 min-h-0 flex">
        <nav className="w-44 shrink-0 border-r border-white/10 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 pb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-orange-400 flex items-center justify-center"><Music2 className="w-4 h-4" /></div>
            <div className="font-black tracking-tight">Music Studio</div>
          </div>
          {NAV.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] ${tab === id ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white hover:bg-white/5'}`}>
              <Icon className="w-4 h-4" /> {label}
              {id === 'create' && jobs.length > 0 && <span className="ml-auto text-[10px] px-1.5 rounded-full bg-fuchsia-600">{jobs.length}</span>}
              {id === 'library' && tracks.length > 0 && <span className="ml-auto text-[10px] text-white/40">{tracks.length}</span>}
            </button>
          ))}
          <button onClick={openSettings} className="mt-auto flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-white/45 hover:text-white"><Settings2 className="w-4 h-4" /> Settings</button>
        </nav>
        <main className="flex-1 min-w-0 min-h-0">
          {tab === 'create' && <CreatePanel spec={spec} setSpec={setSpec} onCreate={create} jobs={jobs} engineReady={engineReady} goEngine={() => setTab('engine')} say={say} />}
          {tab === 'library' && <LibraryPanel tracks={tracks} albums={albums} current={current} onPlay={play} say={say} onEdit={(t) => { setEditTrack(t); setTab('edit'); }} />}
          {tab === 'published' && <LibraryPanel tracks={tracks} albums={albums} current={current} onPlay={play} say={say} onEdit={(t) => { setEditTrack(t); setTab('edit'); }} publishedOnly />}
          {tab === 'albums' && <AlbumsPanel albums={albums} tracks={tracks} onPlay={play} say={say} />}
          {tab === 'edit' && <EditPanel initialTrack={editTrack} musicReady={musicReady} say={say} onSaved={refresh} />}
          {tab === 'engine' && (
            <div className="h-full overflow-y-auto p-4 max-w-2xl">
              <div className="text-lg font-bold mb-1">Music engine</div>
              <div className="text-[12px] text-white/50 mb-3">Songs are made by ACE-Step running in ComfyUI on your own PC, and cover art by Stable Diffusion XL. Install once, then everything works offline.</div>
              <EngineSetup onReady={checkEngine} />
            </div>
          )}
        </main>
      </div>
      <PlayerBar track={current} queue={queue} onSelect={setCurrent} />

      {notice && <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-[12px] shadow-2xl z-50 ${tones[notice.tone] || tones.bad}`}>{notice.text}</div>}

      {showSettings && settings && (
        <div className="absolute inset-0 z-40 bg-black/60 flex items-center justify-center" onClick={() => setShowSettings(false)}>
          <div onClick={e => e.stopPropagation()} className="w-96 p-4 rounded-xl bg-zinc-900 border border-white/10 space-y-3 text-[12px]">
            <div className="flex items-center font-semibold text-sm">Music Studio settings<button onClick={() => setShowSettings(false)} className="ml-auto text-white/40"><X className="w-4 h-4" /></button></div>
            <label className="block text-white/60">Model for lyrics, ideas and cover concepts
              <select value={settings.textModel} onChange={e => saveSetting({ textModel: e.target.value })} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-white">
                <option value="">Automatic (same as Cybeni's architect)</option>
                {textModels.map(m => <option key={m.key} value={m.key}>{m.loaded ? '● ' : ''}{m.label} · {m.group}</option>)}
              </select>
              <span className="block text-[11px] text-white/40 mt-1">A model on the CPU (for example Ollama in CPU mode) leaves the GPU free for music generation.</span>
              {settings.textModel && <span className="block text-[11px] text-white/40">Using {describeModelKey(settings.textModel)}</span>}
            </label>
            <label className="block text-white/60">Takes per song
              <select value={settings.variations} onChange={e => saveSetting({ variations: Number(e.target.value) })} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-white">
                <option value={1}>1 (faster)</option><option value={2}>2 (choose the best)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-white/80"><input type="checkbox" checked={settings.autoCover} onChange={e => saveSetting({ autoCover: e.target.checked })} /> Paint cover art for every new song</label>
            <div className="text-[11px] text-white/40">Music model in use: {settings.musicModel || 'none installed'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
