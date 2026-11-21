import React, { useMemo, useState } from 'react';
import { Sparkles, Wand2, Shuffle, PenLine, ChevronDown, ChevronRight, Loader2, Mic2, Mic, Search, Lock, Unlock, Eye } from 'lucide-react';
import {
  GENRE_GROUPS, ERAS, MOODS, INSTRUMENTS, VOICES, VOCAL_STYLES, MODES, LOOP_SCENES, STRUCTURES, KEYS, LANGUAGES,
  DEFAULT_SPEC, suggestedBpm, compose, blueprint, offlineIdeas,
} from '../../../services/music/musicCatalog.js';
import { inspire, writeLyrics } from '../../../services/music/musicStudio.js';
import { Chip, useDictation } from './shared.jsx';

const toggle = (list, item, max = 99) => (list.includes(item) ? list.filter(x => x !== item) : [...list, item].slice(-max));

function Section({ title, hint, children, open: initial = true }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="border-t border-white/5 pt-3">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-1.5 text-left">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
        <span className="text-[12px] font-semibold text-white/90 uppercase tracking-wide">{title}</span>
        {hint && <span className="text-[11px] text-white/40 normal-case tracking-normal ml-1">{hint}</span>}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export default function CreatePanel({ spec, setSpec, onCreate, jobs, engineReady, goEngine, say }) {
  const [ideas, setIdeas] = useState([]);
  const [ideaSource, setIdeaSource] = useState('');
  const [inspiring, setInspiring] = useState(false);
  const [writing, setWriting] = useState(false);
  const [genreQuery, setGenreQuery] = useState('');
  const [lockGenre, setLockGenre] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const set = (patch) => setSpec({ ...spec, ...patch });
  const speakIdea = useDictation((t) => setSpec(s => ({ ...s, description: s.description ? `${s.description} ${t}` : t })));
  const speakLyrics = useDictation((t) => setSpec(s => ({ ...s, lyrics: s.lyrics ? `${s.lyrics}
${t}` : t })));
  const vocal = spec.mode === 'song' || spec.mode === 'acapella';
  const prompt = useMemo(() => compose(spec), [spec]);
  const plan = useMemo(() => blueprint(spec), [spec]);

  const doInspire = async () => {
    setInspiring(true);
    try {
      const { ideas: list, source } = await inspire(spec.description, { count: 8, mode: spec.mode, lockGenre: lockGenre ? spec.genre : '' });
      setIdeas(list);
      setIdeaSource(source);
    } catch (err) {
      say(err.message);
    } finally {
      setInspiring(false);
    }
  };

  const surprise = () => {
    setIdeas(offlineIdeas(8, { mode: spec.mode, lockGenre: lockGenre ? spec.genre : '' }));
    setIdeaSource('offline');
  };

  const applyIdea = (idea) => {
    setSpec({ ...idea.spec, mode: spec.mode, lyrics: spec.lyrics, language: spec.language });
    setIdeas([]);
  };

  const doLyrics = async (extra = '') => {
    setWriting(true);
    try {
      const lyrics = await writeLyrics(spec, { sections: STRUCTURES[spec.structure], extra });
      set({ lyrics });
    } catch (err) {
      say(err.message);
    } finally {
      setWriting(false);
    }
  };

  const groups = Object.entries(GENRE_GROUPS).map(([group, list]) => [group, list.filter(([name]) => !genreQuery || name.toLowerCase().includes(genreQuery.toLowerCase()))]).filter(([, l]) => l.length);
  const maxSeconds = spec.mode === 'loop' ? 120 : 600;
  const fmtLen = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex h-full min-h-0">
      {/* Builder */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-3">
        {/* Modes */}
        <div className="grid grid-cols-4 gap-2">
          {MODES.map(m => (
            <button key={m.id} onClick={() => set({ mode: m.id, seconds: m.id === 'loop' ? 60 : (spec.mode === 'loop' ? 120 : spec.seconds) })}
              className={`p-2.5 rounded-xl border text-left transition-colors ${spec.mode === m.id ? 'border-fuchsia-400/70 bg-fuchsia-600/20' : 'border-white/10 hover:border-white/25'}`}>
              <div className="text-[13px] font-semibold text-white">{m.label}</div>
              <div className="text-[11px] text-white/50 leading-tight">{m.description}</div>
            </button>
          ))}
        </div>

        {/* Idea */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-900/40 to-indigo-900/40 border border-white/10">
          <div className="flex items-center text-[12px] font-semibold text-white/90 mb-1.5">What is it about?
            {speakIdea.supported && <button type="button" onClick={speakIdea.start} title="Say it instead of typing" className={`ml-auto flex items-center gap-1 text-[11px] font-normal ${speakIdea.listening ? 'text-rose-300' : 'text-white/50 hover:text-white'}`}><Mic className="w-3.5 h-3.5" />{speakIdea.listening ? 'Listening…' : 'Speak'}</button>}
          </div>
          <textarea value={spec.description} onChange={e => set({ description: e.target.value })} rows={2}
            placeholder={spec.mode === 'loop' ? 'e.g. a mysterious forest level with hidden ruins' : 'e.g. a late-night drive after a breakup, but hopeful'}
            className="w-full resize-none bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/60" />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button onClick={doInspire} disabled={inspiring} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-[12px] font-semibold disabled:opacity-50">
              {inspiring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Inspire me with 8 directions
            </button>
            <button onClick={surprise} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-white/80 text-[12px]"><Shuffle className="w-3.5 h-3.5" /> Surprise me (instant)</button>
            <button onClick={() => setLockGenre(l => !l)} title="Keep ideas in the selected genre" className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] ${lockGenre ? 'text-fuchsia-300' : 'text-white/40'}`}>
              {lockGenre ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />} {lockGenre ? `Only ${spec.genre}` : 'Any genre'}
            </button>
          </div>
          {ideas.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] text-white/50 mb-1.5">Pick one to fill in everything below{ideaSource === 'offline' ? ' (offline ideas: start a text model for AI ideas)' : ''}:</div>
              <div className="grid grid-cols-2 gap-2">
                {ideas.map((idea, i) => (
                  <button key={i} onClick={() => applyIdea(idea)} className="text-left p-2.5 rounded-lg bg-black/30 border border-white/10 hover:border-fuchsia-400/60">
                    <div className="text-[13px] font-semibold text-white">{idea.spec.title}</div>
                    <div className="text-[11px] text-white/60 leading-snug">{idea.pitch}</div>
                    <div className="text-[10px] text-fuchsia-300/80 mt-1">{idea.spec.genre} · {idea.spec.era} · {idea.spec.bpm} BPM{idea.spec.moods?.length ? ` · ${idea.spec.moods.join(', ')}` : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <input value={spec.title} onChange={e => set({ title: e.target.value })} placeholder="Title (optional)"
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/60" />

        {vocal && (
          <Section title="Voice">
            <div className="flex flex-wrap gap-1.5">
              {VOICES.map(v => <Chip key={v.id} active={spec.voice === v.id} onClick={() => set({ voice: v.id })}>{v.label}</Chip>)}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {VOCAL_STYLES.map(v => <Chip key={v} active={spec.vocalStyles.includes(v)} onClick={() => set({ vocalStyles: toggle(spec.vocalStyles, v, 3) })}>{v}</Chip>)}
            </div>
          </Section>
        )}

        {spec.mode === 'loop' && (
          <Section title="Game scene" hint="what the player is doing">
            <div className="flex flex-wrap gap-1.5">
              {LOOP_SCENES.map(s => <Chip key={s} active={spec.scene === s} onClick={() => set({ scene: s })}>{s}</Chip>)}
            </div>
          </Section>
        )}

        <Section title="Genre" hint={spec.genre}>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-2" />
            <input value={genreQuery} onChange={e => setGenreQuery(e.target.value)} placeholder="Search 78 genres" className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-white placeholder:text-white/30" />
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {groups.map(([group, list]) => (
              <div key={group}>
                <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1">{group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map(([name, min, max, sound]) => (
                    <Chip key={name} title={`${min}–${max} BPM · ${sound}`} active={spec.genre === name} onClick={() => set({ genre: name, bpm: suggestedBpm(name) })}>{name}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Sounds like the" hint="era of similar music">
          <div className="flex flex-wrap gap-1.5">
            {ERAS.map(e => <Chip key={e.id} title={e.sound} active={spec.era === e.id} onClick={() => set({ era: e.id })}>{e.label}</Chip>)}
          </div>
        </Section>

        <Section title="Mood" hint="up to 3">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map(m => <Chip key={m} active={spec.moods.includes(m)} onClick={() => set({ moods: toggle(spec.moods, m, 3) })}>{m}</Chip>)}
          </div>
        </Section>

        {spec.mode !== 'acapella' && (
          <Section title="Instruments" hint="optional; the genre's usual sound is used otherwise" open={false}>
            <div className="flex flex-wrap gap-1.5">
              {INSTRUMENTS.map(i => <Chip key={i} active={spec.instruments.includes(i)} onClick={() => set({ instruments: toggle(spec.instruments, i, 5) })}>{i}</Chip>)}
            </div>
          </Section>
        )}

        <Section title="Tempo, key & length" hint={`${spec.bpm} BPM · ${spec.key} · ${fmtLen(spec.seconds)}${spec.seconds > 210 && spec.mode !== 'loop' ? ' (Extended Multi-Section)' : ''}`} open={false}>
          <div className="grid grid-cols-2 gap-3 text-[11px] text-white/60">
            <label>BPM {spec.bpm}
              <input type="range" min={50} max={220} value={spec.bpm} onChange={e => set({ bpm: Number(e.target.value) })} className="w-full accent-fuchsia-500" />
            </label>
            <label>Length {fmtLen(spec.seconds)} ({spec.seconds}s)
              <input type="range" min={spec.mode === 'loop' ? 15 : 30} max={maxSeconds} step={15} value={spec.seconds} onChange={e => set({ seconds: Number(e.target.value) })} className="w-full accent-fuchsia-500" />
              {spec.mode !== 'loop' && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {[
                    [90, '1:30'],
                    [180, '3:00'],
                    [300, '5:00'],
                    [450, '7:30'],
                    [600, '10:00'],
                  ].map(([sec, lbl]) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => set({ seconds: sec })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${spec.seconds === sec ? 'bg-fuchsia-600 text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}
              {spec.seconds > 210 && spec.mode !== 'loop' && (
                <span className="block text-[10px] text-fuchsia-300 mt-1">
                  Auto-chains {Math.min(4, Math.ceil((spec.seconds + 6) / 180))} structured sections with beat-locked crossfades.
                </span>
              )}
            </label>
            <label>Key
              <select value={spec.key} onChange={e => set({ key: e.target.value })} className="w-full mt-0.5 bg-black/40 border border-white/10 rounded px-2 py-1 text-white">{KEYS.map(k => <option key={k}>{k}</option>)}</select>
            </label>
            <label>Time signature
              <select value={spec.timeSignature} onChange={e => set({ timeSignature: e.target.value })} className="w-full mt-0.5 bg-black/40 border border-white/10 rounded px-2 py-1 text-white">
                <option value="4">4/4</option><option value="3">3/4 (waltz)</option><option value="6">6/8</option><option value="2">2/4</option>
              </select>
            </label>
            {vocal && (
              <label>Language
                <select value={spec.language} onChange={e => set({ language: e.target.value })} className="w-full mt-0.5 bg-black/40 border border-white/10 rounded px-2 py-1 text-white">{LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
              </label>
            )}
          </div>
        </Section>

        {vocal && (
          <Section title="Lyrics" hint={spec.lyrics ? `${spec.lyrics.split('\n').filter(l => l.trim() && !l.startsWith('[')).length} lines` : 'none yet'}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <select value={spec.structure} onChange={e => set({ structure: e.target.value })} className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[12px] text-white">
                {Object.keys(STRUCTURES).map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={() => doLyrics()} disabled={writing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold disabled:opacity-50">
                {writing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />} {spec.lyrics ? 'Rewrite lyrics' : 'Write lyrics with AI'}
              </button>
              {spec.lyrics && <button onClick={() => doLyrics('Keep the theme but make the chorus catchier and more singable.')} disabled={writing} className="text-[11px] text-white/50 hover:text-white">Punch up the chorus</button>}
              {speakLyrics.supported && <button type="button" onClick={speakLyrics.start} className={`ml-auto flex items-center gap-1 text-[11px] ${speakLyrics.listening ? 'text-rose-300' : 'text-white/50 hover:text-white'}`}><Mic className="w-3.5 h-3.5" />{speakLyrics.listening ? 'Listening…' : 'Dictate a line'}</button>}
            </div>
            <textarea value={spec.lyrics} onChange={e => set({ lyrics: e.target.value })} rows={8}
              placeholder={'[Verse 1]\nYour words here…\n\n[Chorus]\n…'}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[12.5px] text-white font-mono placeholder:text-white/25 focus:outline-none focus:border-fuchsia-400/60" />
          </Section>
        )}
      </div>

      {/* Blueprint + queue */}
      <div className="w-[300px] shrink-0 border-l border-white/10 flex flex-col min-h-0">
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fuchsia-300 font-semibold"><Eye className="w-3.5 h-3.5" /> The finished picture</div>
            <p className="text-[13px] text-white/85 leading-relaxed mt-1.5">{plan}</p>
            <button onClick={() => setShowPrompt(s => !s)} className="mt-2 text-[11px] text-white/40 hover:text-white/70">{showPrompt ? 'Hide' : 'Show'} the exact prompt</button>
            {showPrompt && (
              <div className="mt-1.5 text-[11px] text-white/60 font-mono bg-black/40 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">{prompt.tags}{'\n\n'}{prompt.lyrics}</div>
            )}
          </div>

          {!engineReady && (
            <button onClick={goEngine} className="w-full p-3 rounded-xl border border-amber-500/40 bg-amber-950/20 text-left">
              <div className="text-[13px] font-semibold text-amber-200">Set up the music engine</div>
              <div className="text-[11px] text-amber-200/70">One-click install of the local engine and ACE-Step. Everything runs on your PC.</div>
            </button>
          )}

          {jobs.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-white/40">Generating</div>
              {jobs.map(j => (
                <div key={j.id} className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-[12px] text-white"><Loader2 className={`w-3.5 h-3.5 ${j.error ? 'hidden' : 'animate-spin text-fuchsia-300'}`} /><span className="truncate">{j.title}</span></div>
                  <div className={`text-[11px] mt-0.5 ${j.error ? 'text-rose-300' : 'text-white/50'}`}>{j.error || j.status}</div>
                  {!j.error && j.max ? <div className="mt-1.5 h-1 bg-white/10 rounded overflow-hidden"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${(j.value / j.max) * 100}%` }} /></div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => onCreate(spec)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-orange-500 text-white font-bold text-[14px] shadow-lg shadow-fuchsia-900/40">
            {spec.mode === 'song' ? <Mic2 className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />} Create
          </button>
          <div className="text-[10px] text-white/35 text-center mt-1.5">{spec.mode === 'loop' ? 'Makes one seamless loop' : 'Makes two takes to choose from'} · runs on your PC</div>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_SPEC };
