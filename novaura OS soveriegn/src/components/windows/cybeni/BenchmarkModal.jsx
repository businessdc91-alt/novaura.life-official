import React, { useEffect, useRef, useState } from 'react';
import { Gauge, X, Play, Square, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { BENCHMARKS, runBenchmarks, benchmarkHistory } from '../../../services/cybeni/benchmarks.js';
import { MODES } from '../../../services/cybeni/pipeline.js';
import { runModel, describeModelKey } from '../../../services/cybeni/models.js';
import { verifyInHiddenFrame } from '../../../services/cybeni/previewHost.js';

// Runs Cybeni on a fixed suite of requests and scores every build with tests it
// never saw, so pipeline changes and model line-ups can be compared honestly.

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const secs = (ms) => `${Math.round(ms / 1000)}s`;
const rolesLine = (roles = {}) => ['architect', 'developer', 'reviewer'].map(r => `${r[0].toUpperCase()}: ${describeModelKey(roles[r]) || '—'}`).join(' · ');

export default function BenchmarkModal({ roles, onClose, onOpenBuild }) {
  const [selected, setSelected] = useState(() => new Set(BENCHMARKS.map(b => b.id)));
  const [mode, setMode] = useState('standard');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({});
  const [current, setCurrent] = useState(null);
  const [run, setRun] = useState(null);
  const [history, setHistory] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const cancel = useRef(false);

  useEffect(() => { benchmarkHistory().then(setHistory); }, []);

  const missingRoles = ['architect', 'developer', 'reviewer'].filter(r => !roles?.[r]);

  const start = async () => {
    cancel.current = false;
    setRunning(true);
    setRun(null);
    setProgress({});
    const result = await runBenchmarks({ ids: [...selected], mode, roles }, {
      runModel,
      verify: (files, opts) => verifyInHiddenFrame(files, opts),
      isCancelled: () => cancel.current,
      onProgress: (p) => {
        setCurrent(p);
        if (p.stage === 'done') setProgress(prev => ({ ...prev, [p.id]: p.result }));
      },
    });
    setRun(result);
    setCurrent(null);
    setRunning(false);
    setHistory(await benchmarkHistory());
  };

  const toggle = (id) => setSelected(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const shown = run?.results || Object.values(progress);
  const builds = new Map((run?.builds || []).map(b => [b.id, b.files]));

  return (
    <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={running ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-3xl max-h-full overflow-hidden flex flex-col bg-slate-900 border border-slate-700 rounded-xl text-[12px] text-slate-200">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <Gauge className="w-4 h-4 text-purple-300" />
          <div className="font-semibold text-sm">Benchmark Cybeni</div>
          <button onClick={onClose} disabled={running} className="ml-auto text-slate-400 hover:text-white disabled:opacity-30"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-slate-400">
            Cybeni builds each app from its request using your current model roles, writing its own tests as usual. Every build is then scored against
            hand-written tests it never saw. Compare runs after changing models or settings.
          </p>
          <div className="text-[11px] text-slate-400">{rolesLine(roles)}</div>
          {missingRoles.length > 0 && <div className="text-amber-300">Assign models to the {missingRoles.join(', ')} role(s) in Cybeni's settings first.</div>}

          <div className="flex flex-wrap gap-1.5">
            {BENCHMARKS.map(b => (
              <button key={b.id} disabled={running} onClick={() => toggle(b.id)} className={`px-2 py-1 rounded-full border text-[11px] ${selected.has(b.id) ? 'border-purple-500 bg-purple-900/40 text-white' : 'border-slate-700 text-slate-500'}`}>{b.title}</button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select value={mode} disabled={running} onChange={e => setMode(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5">
              {Object.entries(MODES).filter(([id]) => id !== 'quick').map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
            </select>
            {!running ? (
              <button onClick={start} disabled={!selected.size || missingRoles.length > 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium">
                <Play className="w-3.5 h-3.5" /> Run {selected.size} benchmark{selected.size === 1 ? '' : 's'}
              </button>
            ) : (
              <button onClick={() => { cancel.current = true; }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-600 text-rose-200"><Square className="w-3.5 h-3.5" /> Stop after this one</button>
            )}
            <span className="text-[11px] text-slate-500">Local models take several minutes per app.</span>
          </div>

          {running && current && (
            <div className="flex items-center gap-2 text-purple-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {current.index + 1}/{current.count} {current.title}: {current.stage === 'scoring' ? 'scoring with the hidden tests' : current.phase ? `${current.phase} (${current.status || 'running'})` : 'starting'}
            </div>
          )}

          {run && (
            <div className="p-3 rounded-lg border border-purple-700/50 bg-purple-950/30 flex gap-6">
              <div><div className="text-2xl font-bold">{pct(run.passed, run.total)}%</div><div className="text-[11px] text-slate-400">{run.passed}/{run.total} hidden tests pass</div></div>
              <div><div className="text-2xl font-bold">{run.solved}/{run.count}</div><div className="text-[11px] text-slate-400">apps fully working</div></div>
              <div><div className="text-2xl font-bold">{secs(run.ms)}</div><div className="text-[11px] text-slate-400">total time</div></div>
            </div>
          )}

          {shown.length > 0 && (
            <div className="border border-slate-800 rounded-lg divide-y divide-slate-800">
              {shown.map(r => (
                <div key={r.id}>
                  <button onClick={() => setExpanded(e => (e === r.id ? null : r.id))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/40 text-left">
                    {expanded === r.id ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                    {r.passed === r.total ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                    <span className="font-medium">{r.title}</span>
                    <span className="text-slate-400">{r.passed}/{r.total}</span>
                    <span className="ml-auto text-[11px] text-slate-500">{r.ownTests ? `own tests ${r.ownTests} · ` : ''}{r.modelCalls} calls · {secs(r.ms)}</span>
                  </button>
                  {expanded === r.id && (
                    <div className="px-8 pb-2 space-y-1 text-[11px]">
                      {r.status !== 'done' && <div className="text-rose-300">Build {r.status}.</div>}
                      {r.runtimeErrors > 0 && <div className="text-amber-300">{r.runtimeErrors} runtime error(s) in the preview.</div>}
                      {r.failures.map((f, i) => <div key={i} className="text-rose-200/90">{f}</div>)}
                      {builds.get(r.id)?.length > 0 && onOpenBuild && (
                        <button onClick={() => onOpenBuild(builds.get(r.id), `Benchmark ${r.title}`)} className="flex items-center gap-1 text-purple-300 hover:text-purple-200"><FolderOpen className="w-3 h-3" /> Open this build as a project</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Earlier runs</div>
              <div className="space-y-1">
                {history.map(h => (
                  <div key={h.at} className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="w-28">{new Date(h.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="w-14 text-slate-200 font-semibold">{pct(h.passed, h.total)}%</span>
                    <span className="w-16">{h.solved}/{h.count} apps</span>
                    <span className="w-16">{MODES[h.mode]?.label || h.mode}</span>
                    <span className="truncate">{rolesLine(h.roles)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
