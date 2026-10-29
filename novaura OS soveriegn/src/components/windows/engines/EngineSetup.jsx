import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, HardDrive, Download, Play, Square, CheckCircle2, Loader2, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck, X, RefreshCw } from 'lucide-react';
import {
  MODEL_CATALOG, getEngineConfig, setEngineConfig, recommendBackend, hardware, installComfy, installStatus,
  startComfy, stopComfy, probeComfy, comfyProcessStatus, installedModels, isModelInstalled, downloadModel, cancelDownload,
} from '../../../services/engines/comfyEngine.js';

const BACKENDS = {
  cu126: 'NVIDIA (CUDA 12.6, older cards and drivers)',
  cu128: 'NVIDIA (CUDA 12.8, RTX 20-series and newer)',
  directml: 'AMD / Intel (DirectML)',
  cpu: 'CPU only (slow, works everywhere)',
};

const gb = (bytes) => `${(bytes / 1e9).toFixed(1)} GB`;

/**
 * One-click local AI engine: install ComfyUI, start/stop it, install models.
 * purpose filters the model list ('music' | 'image' | undefined for all).
 */
export default function EngineSetup({ purpose, onReady }) {
  const [hw, setHw] = useState(null);
  const [config, setConfig] = useState(null);
  const [variant, setVariant] = useState('');
  const [drive, setDrive] = useState('');
  const [folder, setFolder] = useState('');
  const [install, setInstall] = useState(null);
  const [running, setRunning] = useState(false);
  const [models, setModels] = useState([]);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState('');

  const refresh = useCallback(async () => {
    const cfg = await getEngineConfig();
    setConfig(cfg);
    if (cfg.installDir) {
      const st = await installStatus(cfg.installDir).catch(() => null);
      setInstall(st);
      setModels(await installedModels());
    }
    const up = Boolean(await probeComfy());
    setRunning(up);
    if (up) onReady?.();
  }, [onReady]);

  useEffect(() => {
    (async () => {
      try {
        const h = await hardware();
        setHw(h);
        const rec = recommendBackend(h);
        const cfg = await getEngineConfig();
        setVariant(cfg.torchVariant || rec.variant);
        const best = [...(h.drives || [])].sort((a, b) => b.free_gb - a.free_gb)[0];
        const d = cfg.installDir ? cfg.installDir[0] : best?.letter || 'C';
        setDrive(d);
        setFolder(cfg.installDir || `${d}:\\NovauraAI`);
      } catch (err) {
        setError(err.message);
      }
      refresh();
    })();
  }, [refresh]);

  // Poll while installing.
  useEffect(() => {
    if (!install?.running) return undefined;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [install?.running, refresh]);

  const rec = hw ? recommendBackend(hw) : null;
  const installed = Boolean(install?.installed);
  const phase = install?.status?.phase;
  const driveInfo = hw?.drives?.find(d => d.letter === drive);

  const doInstall = async () => {
    setError('');
    try {
      await installComfy(folder.trim(), variant);
      setInstall({ running: true, status: { phase: 'preparing', message: 'Starting the installer…', percent: 1 } });
      setTimeout(refresh, 1500);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const doStart = async () => {
    setError('');
    setBusy('start');
    try {
      await startComfy();
      for (let i = 0; i < 90 && !(await probeComfy()); i++) await new Promise(r => setTimeout(r, 2000));
      const up = Boolean(await probeComfy());
      if (!up) {
        const st = await comfyProcessStatus();
        setError(`The engine did not come up. ${(st.log_tail || '').trim().split('\n').slice(-2).join(' ')}`);
      }
      await refresh();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy('');
    }
  };

  const doStop = async () => {
    setBusy('stop');
    await stopComfy().catch(() => {});
    setTimeout(() => { refresh(); setBusy(''); }, 1500);
  };

  const doModel = async (entry) => {
    setError('');
    setProgress(p => ({ ...p, [entry.id]: { fraction: 0, bytes: 0 } }));
    try {
      await downloadModel(entry, { onProgress: (pr) => setProgress(p => ({ ...p, [entry.id]: pr })) });
      setModels(await installedModels());
    } catch (err) {
      setError(`${entry.name}: ${err.message}`);
    } finally {
      setProgress(p => { const { [entry.id]: _done, ...rest } = p; return rest; });
    }
  };

  const catalog = MODEL_CATALOG.filter(m => !purpose || m.purpose === purpose);

  return (
    <div className="space-y-3 text-slate-200">
      {error && (
        <div className="flex gap-2 p-2.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-[12px] text-rose-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span className="flex-1">{error}</span>
          <button onClick={() => setError('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Engine */}
      <div className="p-3 rounded-xl border border-slate-700/80 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-300" />
          <span className="font-semibold text-sm">Local AI engine (ComfyUI)</span>
          <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border ${running ? 'border-emerald-500/50 text-emerald-300' : installed ? 'border-slate-600 text-slate-400' : 'border-amber-500/50 text-amber-300'}`}>
            {running ? 'Running' : installed ? 'Stopped' : install?.running ? 'Installing' : 'Not installed'}
          </span>
        </div>
        {rec && <div className="text-[11px] text-slate-400 mt-1">Detected: {rec.reason}{rec.warning && <span className="block text-amber-300">{rec.warning}</span>}</div>}

        {!installed && !install?.running && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-400">GPU backend
                <select value={variant} onChange={e => setVariant(e.target.value)} className="mt-0.5 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[12px]">
                  {Object.entries(BACKENDS).map(([k, v]) => <option key={k} value={k}>{v}{rec?.variant === k ? ' (recommended)' : ''}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-slate-400">Drive
                <select value={drive} onChange={e => { setDrive(e.target.value); setFolder(`${e.target.value}:\\NovauraAI`); }} className="mt-0.5 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[12px]">
                  {(hw?.drives || []).map(d => <option key={d.letter} value={d.letter}>{d.letter}: {d.free_gb} GB free of {d.total_gb} GB</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[11px] text-slate-400">Install folder
              <input value={folder} onChange={e => setFolder(e.target.value)} className="mt-0.5 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[12px] font-mono" />
            </label>
            {driveInfo && driveInfo.free_gb < 30 && <div className="text-[11px] text-amber-300">Only {driveInfo.free_gb} GB free here. The engine needs about 12 GB, and models add 7–10 GB each.</div>}
            <button onClick={doInstall} disabled={!folder.trim() || !variant} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-purple-600 text-white text-[13px] font-semibold disabled:opacity-40">
              <Download className="w-4 h-4" /> Install in one click
            </button>
            <div className="text-[10px] text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Installs into this folder only, with its own private Python. Nothing is changed elsewhere on your PC.</div>
          </div>
        )}

        {install?.running && (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-[12px]"><Loader2 className="w-4 h-4 animate-spin text-cyan-300" />{install.status?.message || 'Installing…'}</div>
            <div className="mt-2 h-1.5 bg-slate-800 rounded overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all" style={{ width: `${install.status?.percent || 2}%` }} /></div>
          </div>
        )}

        {phase === 'failed' && !install?.running && (
          <div className="mt-2 text-[12px] text-rose-300">Install failed: {install.status?.message}
            <button onClick={doInstall} className="ml-2 underline">Try again</button>
          </div>
        )}

        {installed && (
          <div className="mt-2 space-y-2">
            {install?.engine && <div className="text-[11px] text-slate-400">ComfyUI {install.engine.comfyui} · PyTorch {install.engine.torch} · {install.engine.device || 'CPU'} · <span className="font-mono">{config?.installDir}</span></div>}
            <div className="flex gap-2">
              {running ? (
                <button onClick={doStop} disabled={busy === 'stop'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/50 text-rose-200 text-[12px]"><Square className="w-3.5 h-3.5" /> Stop</button>
              ) : (
                <button onClick={doStart} disabled={busy === 'start'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold">
                  {busy === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} {busy === 'start' ? 'Starting…' : 'Start engine'}
                </button>
              )}
              <button onClick={refresh} title="Refresh" className="p-1.5 rounded-lg border border-slate-700 text-slate-400"><RefreshCw className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setEngineConfig({}); doInstall(); }} title="Update ComfyUI to the latest release" className="ml-auto text-[11px] text-slate-500 hover:text-slate-300">Update / reinstall</button>
            </div>
          </div>
        )}

        {install && (
          <button onClick={() => setShowLog(s => !s)} className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300">
            {showLog ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Install log
          </button>
        )}
        {showLog && <pre className="mt-1 max-h-40 overflow-auto bg-slate-950 border border-slate-800 rounded p-2 text-[10px] text-slate-400 whitespace-pre-wrap">{install?.log_tail || '(empty)'}</pre>}
      </div>

      {/* Models */}
      <div className="p-3 rounded-xl border border-slate-700/80 bg-slate-900/60">
        <div className="flex items-center gap-2 mb-2"><HardDrive className="w-4 h-4 text-purple-300" /><span className="font-semibold text-sm">Models</span></div>
        {!installed && <div className="text-[11px] text-slate-500 mb-2">Install the engine first; models go into its folder.</div>}
        <div className="space-y-2">
          {catalog.map(entry => {
            const have = isModelInstalled(entry, models);
            const pr = progress[entry.id];
            const size = entry.files.reduce((n, f) => n + (f.bytes || 0), 0);
            return (
              <div key={entry.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{entry.name}</span>
                  {entry.recommended && <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200">Recommended</span>}
                  <span className="ml-auto text-[11px] text-slate-400">{gb(size)} · ~{entry.vramGb} GB VRAM</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{entry.summary}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${entry.commercial ? 'border-emerald-600/50 text-emerald-300' : 'border-amber-600/50 text-amber-300'}`}>
                    {entry.license}{entry.commercial ? ' · commercial use OK' : ' · non-commercial'}
                  </span>
                  {entry.licenseNote && <span className="text-[10px] text-slate-500">{entry.licenseNote}</span>}
                  <span className="ml-auto">
                    {have ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> Installed</span>
                    ) : pr ? (
                      <span className="flex items-center gap-2 text-[11px] text-cyan-300">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {Math.round((pr.fraction || 0) * 100)}% · {gb(pr.bytes || 0)}
                        <button onClick={() => cancelDownload(entry)} className="text-slate-500 hover:text-rose-300"><X className="w-3.5 h-3.5" /></button>
                      </span>
                    ) : (
                      <button onClick={() => doModel(entry)} disabled={!installed} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-700/60 text-white text-[11px] font-semibold disabled:opacity-40"><Download className="w-3.5 h-3.5" /> Install</button>
                    )}
                  </span>
                </div>
                {pr && <div className="mt-1.5 h-1 bg-slate-800 rounded overflow-hidden"><div className="h-full bg-cyan-500 transition-all" style={{ width: `${(pr.fraction || 0) * 100}%` }} /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
