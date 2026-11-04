import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles, Download, Loader2, Play, Square, X, AlertTriangle, ShieldCheck, Trash2, Send, Search,
  Image as ImageIcon, Check, FolderOpen, Lock,
} from 'lucide-react';
import {
  getBuiltinConfig, setBuiltinConfig, subscribeBuiltinAi, suggestInstallDir, catalog as loadCatalog,
  recommendModel, install, installProgress, cancelInstall, builtinStatus, listBuiltinModels,
  startBuiltinAi, stopBuiltinAi, selectBuiltinModel, removeBuiltinModel, builtinChat,
  searchHuggingFace, huggingFaceRepo, downloadFromHuggingFace, openModelsFolder, DEFAULT_MODEL,
} from '../../../services/engines/builtinAi.js';

const gb = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`);
const STATUS = { loaded: 'In memory', loading: 'Loading…', available: 'Ready', unloaded: 'Ready', downloading: 'Downloading', sleeping: 'Ready' };

/** Hugging Face: search, pick a quantization (and vision file), download into the models folder. */
function HuggingFacePanel({ disabled, onStarted, cfg, initialRepo, beforeDownload }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [repo, setRepo] = useState(null);
  const [quant, setQuant] = useState(null);
  const [vision, setVision] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function openRepo(id) {
    setBusy('repo');
    setError('');
    try {
      const r = await huggingFaceRepo(id);
      if (!r.quants.length) throw new Error(`${id} has no GGUF model files llama.cpp can run.`);
      setRepo(r);
      // A sensible default: the usual 4-bit file (Q4_K_M, or MXFP4 / Q4_0 where that is what the repo ships).
      setQuant(r.quants.find(q => q.quant === 'Q4_K_M') || r.quants.find(q => /^(MXFP4|Q4_0)/.test(q.quant)) || r.quants[Math.floor(r.quants.length / 2)]);
      setVision(r.vision.find(v => /Q8_0|F16/i.test(v.path)) || r.vision[0] || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  // Sent from elsewhere (AI Benchmarks' "Get it"): show that repo's files; nothing downloads until Download.
  useEffect(() => {
    if (!initialRepo?.repo) return;
    setQuery(initialRepo.repo);
    setResults(null);
    openRepo(initialRepo.repo);
  }, [initialRepo?.openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setError('');
    setRepo(null);
    // A full repo name ("owner/name") opens straight away.
    if (/^[\w.-]+\/[\w.-]+$/.test(q)) return openRepo(q);
    setBusy('search');
    try { setResults(await searchHuggingFace(q)); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const download = async () => {
    setError('');
    try {
      await beforeDownload?.();
      await downloadFromHuggingFace(repo.repo, quant, vision);
      onStarted();
      setRepo(null);
      setResults(null);
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }} placeholder="Search Hugging Face (e.g. qwen3 gguf) or paste owner/repo" className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[12px]" />
        <button onClick={search} disabled={disabled || !query.trim() || busy === 'search'} className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[12px] disabled:opacity-50">
          {busy === 'search' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Search
        </button>
      </div>
      {error && <div className="text-[11px] text-rose-300">{error}</div>}

      {results && !repo && (
        <div className="max-h-52 overflow-y-auto space-y-1">
          {results.length === 0 && <div className="text-[11px] text-slate-500">No GGUF repos match that search.</div>}
          {results.map(r => (
            <button key={r.id} onClick={() => openRepo(r.id)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded border border-slate-800 hover:border-slate-600 text-[12px]">
              <span className="truncate text-slate-200 flex-1">{r.id}</span>
              <span className="text-[10px] text-slate-500 shrink-0">{r.downloads.toLocaleString()} downloads</span>
            </button>
          ))}
        </div>
      )}
      {busy === 'repo' && <div className="text-[11px] text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading the repo…</div>}

      {repo && (
        <div className="p-2.5 rounded-lg border border-slate-700 bg-slate-950/50 space-y-2">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-semibold text-white truncate">{repo.repo}</span>
            {repo.license && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{repo.license}</span>}
            {repo.gated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-200 flex items-center gap-1"><Lock className="w-3 h-3" /> Gated</span>}
            <button onClick={() => setRepo(null)} className="ml-auto text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
          {repo.gated && !cfg?.hfToken && <div className="text-[11px] text-amber-300">This model needs you to accept its license on huggingface.co, then add a Hugging Face token below.</div>}
          <label className="block text-[11px] text-slate-400">File (smaller downloads run faster; bigger ones are a little smarter)
            <select value={quant?.quant || ''} onChange={e => setQuant(repo.quants.find(q => q.quant === e.target.value))} className="mt-0.5 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[12px]">
              {repo.quants.map(q => <option key={q.quant + q.files[0].path} value={q.quant}>{q.quant} · {gb(q.bytes)}{q.files.length > 1 ? ` · ${q.files.length} parts` : ''}</option>)}
            </select>
          </label>
          {repo.vision.length > 0 && (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <input type="checkbox" checked={Boolean(vision)} onChange={e => setVision(e.target.checked ? repo.vision[0] : null)} />
              <ImageIcon className="w-3.5 h-3.5 text-cyan-300" /> Image support ({gb(repo.vision[0].bytes)})
            </label>
          )}
          <button onClick={download} disabled={disabled || !quant} className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[12px] font-semibold disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Download {quant ? gb(quant.bytes + (vision?.bytes || 0)) : ''}
          </button>
          <div className="text-[10px] text-slate-500">Each file is checked against the fingerprint Hugging Face publishes for it. Models from Hugging Face are made by their authors, not NovAura; check the license before using one in your work.</div>
        </div>
      )}
    </div>
  );
}

/** The built-in AI: llama.cpp as a local model server, set up in one click. */
export default function BuiltinAiSetup({ request = null }) {
  const [cfg, setCfg] = useState(null);
  const [cat, setCat] = useState(null);
  const [models, setModels] = useState([]);
  const [folder, setFolder] = useState('');
  const [choice, setChoice] = useState(DEFAULT_MODEL);
  const [recommended, setRecommended] = useState(DEFAULT_MODEL);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('In one sentence, what can you help me with?');
  const [reply, setReply] = useState('');
  const [showHf, setShowHf] = useState(false);
  const pollRef = useRef(null);
  const folderRef = useRef('');

  const refresh = useCallback(async () => {
    const c = await getBuiltinConfig();
    setCfg(c);
    const dir = c.installDir || folderRef.current || await suggestInstallDir();
    if (!folderRef.current) { folderRef.current = dir; setFolder(dir); }
    setCat(await loadCatalog(dir).catch(() => null));
    setStatus(await builtinStatus().catch(() => null));
    setModels(await listBuiltinModels().catch(() => []));
  }, []);

  async function doStart() {
    setBusy('start');
    setError('');
    try {
      await startBuiltinAi();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
      refresh();
    }
  }

  function watch() {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const p = await installProgress().catch(() => null);
      if (!p) return;
      setProgress(p);
      if (!p.running) {
        clearInterval(pollRef.current);
        if (p.error && p.error !== 'Cancelled') setError(p.error);
        await refresh();
        // Ready to use straight away: start the server, or show the new model to a running one.
        if (p.done) doStart();
      }
    }, 700);
  }

  useEffect(() => {
    refresh();
    recommendModel().then((id) => { setRecommended(id); setChoice(id); }).catch(() => {});
    const off = subscribeBuiltinAi(() => refresh());
    // A download started earlier (this window was closed meanwhile) keeps reporting.
    installProgress().then((p) => { if (p?.running) { setProgress(p); watch(); } }).catch(() => {});
    return () => { off(); clearInterval(pollRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A model handed over from AI Benchmarks: pre-select it, or open its Hugging Face repo.
  const [hfRequest, setHfRequest] = useState(null);
  useEffect(() => {
    if (!request?.openId) return;
    if (request.builtinModel) setChoice(request.builtinModel);
    if (request.hfRepo) setHfRequest({ repo: request.hfRepo, openId: request.openId });
    setShowHf(true);
  }, [request?.openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const doInstall = async (modelId = choice) => {
    setError('');
    try {
      await install((cfg?.installDir || folder).trim(), modelId);
      setProgress({ running: true, stage: 'Starting', bytes: 0, total: 0 });
      watch();
    } catch (err) {
      setError(String(err?.message || err));
    }
  };

  const doStop = async () => {
    setBusy('stop');
    try { await stopBuiltinAi(); } finally { setBusy(''); refresh(); }
  };

  const doUse = async (id) => {
    setBusy(`use:${id}`);
    setError('');
    try { await selectBuiltinModel(id); } catch (err) { setError(err.message); } finally { setBusy(''); refresh(); }
  };

  const doRemove = async (m) => {
    if (!window.confirm(`Delete ${m.id} (${gb(m.bytes)}) from this PC? You can download it again later.`)) return;
    setError('');
    try { await removeBuiltinModel(m.id); } catch (err) { setError(err.message); } finally { refresh(); }
  };

  const tryIt = async () => {
    setBusy('chat');
    setReply('');
    try {
      setReply(await builtinChat([
        { role: 'system', content: 'You are the assistant built into NovAura Sovereign OS. Be brief and friendly.' },
        { role: 'user', content: prompt },
      ], { maxTokens: 300 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!cat) {
    return <div className="p-3 rounded-xl border border-slate-700/80 bg-slate-900/60 text-[12px] text-slate-400">Built-in AI is available in the desktop app.</div>;
  }

  const ready = models.filter(m => m.complete);
  const setUp = cat.runtime_installed && ready.length > 0;
  const running = Boolean(status?.running);
  const loaded = models.find(m => m.status === 'loaded');
  const defaultId = (ready.find(m => m.id === cfg?.modelId) || ready[0])?.id;
  const selected = cat.models.find(m => m.id === choice) || cat.models[0];
  const pct = progress?.total ? Math.min(100, (progress.bytes / progress.total) * 100) : 2;
  const downloading = Boolean(progress?.running);

  return (
    <div className="p-3 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/80 to-cyan-950/20 text-slate-200 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-cyan-300" />
        <span className="font-semibold text-sm">Built-in AI</span>
        <span className="text-[11px] text-slate-400">No other apps needed</span>
        <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border ${running ? 'border-emerald-500/50 text-emerald-300' : setUp ? 'border-slate-600 text-slate-400' : 'border-amber-500/50 text-amber-300'}`}>
          {busy === 'start' ? 'Starting' : running ? (loaded ? `Running ${loaded.id}` : 'Running') : setUp ? 'Stopped' : downloading ? 'Setting up' : 'Not set up'}
        </span>
      </div>

      {error && (
        <div className="flex gap-2 p-2.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-[12px] text-rose-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span className="flex-1 break-words">{error}</span>
          <button onClick={() => setError('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {downloading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[12px]">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
            <span className="flex-1">{progress.stage}{progress.total ? ` · ${gb(progress.bytes)} of ${gb(progress.total)}` : ''}</span>
            <button onClick={() => cancelInstall()} className="text-[11px] text-slate-400 hover:text-rose-300">Cancel</button>
          </div>
          <div className="h-1.5 bg-slate-800 rounded overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all" style={{ width: `${pct}%` }} /></div>
          <div className="text-[10px] text-slate-500">You can keep using the desktop. If the connection drops, start the download again and it picks up where it stopped.</div>
        </div>
      )}

      {!setUp && !downloading && (
        <div className="space-y-2">
          <div className="text-[12px] text-slate-300">
            Chat, writing help, code and image understanding that run entirely on this PC. One click downloads Google's open Gemma 4 model and the llama.cpp engine; after that it works offline.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cat.models.map((m) => (
              <button key={m.id} onClick={() => setChoice(m.id)} className={`text-left p-2.5 rounded-lg border ${choice === m.id ? 'border-cyan-400/70 bg-cyan-950/30' : 'border-slate-700 hover:border-slate-500'}`}>
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
                  {m.label}
                  {m.id === recommended && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-600/30 text-cyan-200 font-semibold">Best for this PC</span>}
                  <span className="ml-auto text-[10px] text-slate-400 font-normal">{gb(m.bytes)}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{m.blurb}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{m.min_ram_gb} GB of memory or more</div>
              </button>
            ))}
          </div>
          <label className="block text-[11px] text-slate-400">Folder
            <input value={folder} onChange={e => { folderRef.current = e.target.value; setFolder(e.target.value); }} disabled={Boolean(cfg?.installDir)} className="mt-0.5 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[12px] font-mono disabled:opacity-60" />
          </label>
          <button onClick={() => doInstall()} disabled={!folder.trim()} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-purple-600 text-white text-[13px] font-semibold disabled:opacity-40">
            <Download className="w-4 h-4" /> Set up {selected.label} ({gb(selected.bytes + (cat.runtime_installed ? 0 : cat.runtime_bytes))})
          </button>
          <div className="text-[10px] text-slate-500 flex items-start gap-1"><ShieldCheck className="w-3 h-3 shrink-0 mt-px" /> Official files from Google (Gemma 4, Apache 2.0) and llama.cpp, each checked against a known fingerprint. The AI only answers this OS: nothing else on your PC or network can use it.</div>
          {<button onClick={() => setShowHf(s => !s)} className="text-[11px] text-cyan-300 hover:text-cyan-200">{showHf ? 'Hide Hugging Face' : 'Or pick any model from Hugging Face'}</button>}
        </div>
      )}

      {setUp && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <button onClick={doStop} disabled={busy === 'stop'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/50 text-rose-200 text-[12px]"><Square className="w-3.5 h-3.5" /> Stop</button>
            ) : (
              <button onClick={doStart} disabled={busy === 'start'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold">
                {busy === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} {busy === 'start' ? 'Loading the model…' : 'Start'}
              </button>
            )}
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <input type="checkbox" checked={cfg?.autoStart !== false} onChange={e => setBuiltinConfig({ autoStart: e.target.checked })} /> Start with the desktop
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400" title="Use if your graphics card gives errors. Slower.">
              <input type="checkbox" checked={Boolean(cfg?.cpuOnly)} onChange={async e => { await setBuiltinConfig({ cpuOnly: e.target.checked }); if (running) { await stopBuiltinAi(); doStart(); } }} /> CPU only
            </label>
            <button onClick={() => openModelsFolder().catch(err => setError(String(err?.message || err)))} className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200" title="Models dropped into this folder show up here too"><FolderOpen className="w-3.5 h-3.5" /> Models folder</button>
          </div>

          <div className="space-y-1">
            {models.map(m => (
              <div key={m.id} className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[12px] ${m.id === defaultId ? 'border-cyan-500/40 bg-cyan-950/20' : 'border-slate-800'}`}>
                <span className="text-slate-100 truncate flex-1" title={m.id}>{m.id}</span>
                {m.vision && <ImageIcon className="w-3.5 h-3.5 text-cyan-300 shrink-0" title="Reads images" />}
                <span className="text-[10px] text-slate-500 w-14 text-right shrink-0">{gb(m.bytes)}</span>
                <span className={`text-[10px] w-20 shrink-0 ${m.status === 'loaded' ? 'text-emerald-300' : m.failed ? 'text-rose-300' : 'text-slate-400'}`}>{m.failed ? 'Failed to load' : STATUS[m.status] || m.status}</span>
                {m.complete && (m.id === defaultId
                  ? <span className="text-[10px] text-cyan-300 w-12 shrink-0 flex items-center gap-0.5"><Check className="w-3 h-3" /> Default</span>
                  : <button onClick={() => doUse(m.id)} disabled={busy.startsWith('use:')} className="text-[10px] text-cyan-300 hover:text-cyan-200 w-12 shrink-0 text-left">{busy === `use:${m.id}` ? 'Loading…' : 'Use'}</button>)}
                <button onClick={() => doRemove(m)} className="text-slate-500 hover:text-rose-300 shrink-0" title="Delete from this PC"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-400">
            Cybeni, Music Studio, the Literature IDE, website and card writers and every model picker use it when it is running. LM Studio and Ollama still come first if you run them.
          </div>

          {running && (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') tryIt(); }} className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[12px]" />
                <button onClick={tryIt} disabled={busy === 'chat' || !prompt.trim()} className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-700 text-white text-[12px] disabled:opacity-50">
                  {busy === 'chat' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Try it
                </button>
              </div>
              {reply && <div className="text-[12px] text-slate-200 bg-slate-950/70 border border-slate-800 rounded p-2 whitespace-pre-wrap">{reply}</div>}
            </div>
          )}

          <details className="text-[11px] text-slate-400" open={showHf} onToggle={e => setShowHf(e.currentTarget.open)}>
            <summary className="cursor-pointer hover:text-slate-200">Add a model</summary>
            <div className="mt-2 space-y-3">
              <div className="space-y-1">
                <div className="text-slate-300">Gemma 4 (checked by NovAura)</div>
                {cat.models.map(m => (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="text-slate-200 w-32">{m.label}</span>
                    <span className="w-16">{gb(m.bytes)}</span>
                    {m.installed ? <span className="flex items-center gap-1 text-emerald-300"><Check className="w-3 h-3" /> Downloaded</span>
                      : <button onClick={() => doInstall(m.id)} disabled={downloading} className="text-cyan-300 hover:text-cyan-200 disabled:opacity-40">Download</button>}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="text-slate-300">Any GGUF model from Hugging Face</div>
                <HuggingFacePanel disabled={downloading} cfg={cfg} initialRepo={hfRequest} onStarted={() => { setProgress({ running: true, stage: 'Starting', bytes: 0, total: 0 }); watch(); }} />
                <label className="block text-[10px] text-slate-500">Hugging Face token (only for gated models)
                  <input type="password" defaultValue={cfg?.hfToken || ''} onBlur={e => setBuiltinConfig({ hfToken: e.target.value.trim() })} placeholder="hf_…" autoComplete="off" className="mt-0.5 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono" />
                </label>
              </div>
              <div className="text-slate-500">llama.cpp {cat.runtime_build} · <span className="font-mono">{cat.models_dir}</span></div>
            </div>
          </details>
        </div>
      )}

      {!setUp && !downloading && showHf && (
        // First setup from Hugging Face: the folder chosen above is saved when Download is pressed.
        <HuggingFacePanel disabled={downloading || !folder.trim()} cfg={cfg} initialRepo={hfRequest} beforeDownload={() => setBuiltinConfig({ installDir: folder.trim() })} onStarted={() => { setProgress({ running: true, stage: 'Starting', bytes: 0, total: 0 }); watch(); }} />
      )}
    </div>
  );
}
