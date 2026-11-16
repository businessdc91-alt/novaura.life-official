import React, { useMemo, useState } from 'react';
import {
  Send, Square, Mic, MicOff, Settings2, Loader2, CheckCircle2, XCircle, Circle, MinusCircle,
  ChevronDown, ChevronRight, RotateCcw, Wand2, ShieldCheck, Cpu, MessageCircleQuestion, ScrollText,
} from 'lucide-react';
import { MODES, SECURITY_LEVELS, QUALITY_LEVELS } from '../../../services/cybeni/pipeline.js';
import { describeModelKey } from '../../../services/cybeni/models.js';
import { DESIGN_SYSTEMS } from '../../../services/cybeniStudioEngine.js';
import { ollamaCpuOnly, setOllamaCpuOnly } from '../../../services/localModels.js';
import { cloudSpeechAllowed } from '../../../services/speechConsent.js';
import ModelReasoningSubmenu from '../../shared/ModelReasoningSubmenu.jsx';

const ROLE_LABELS = {
  architect: ['Architect & orchestrator', 'Plans, oversees each checkpoint, can redirect or take over, signs off'],
  developer: ['Developer', 'Writes and repairs the code'],
  reviewer: ['Reviewer (cross-check)', 'Checks the developer independently; pick a different model'],
  designer: ['Designer', 'Visual polish'],
};

const ROLE_COLORS = { architect: 'text-amber-300', developer: 'text-cyan-300', reviewer: 'text-fuchsia-300', designer: 'text-emerald-300', tool: 'text-slate-300' };

// Each requirement with the outcome of its acceptance tests from the last preview run.
function RequirementsCheck({ result }) {
  const [open, setOpen] = useState(false);
  const tests = result.tests || [];
  const outcomes = result.testResults;
  if (!tests.length) return null;
  if (!outcomes) return <div className="mt-1 text-slate-400">{tests.length} acceptance tests written; they run when the preview check is on.</div>;
  const byId = new Map(outcomes.map(r => [r.id, r]));
  const passed = outcomes.filter(r => r.passed).length;
  const rows = (result.requirements || []).map(r => {
    const own = tests.filter(t => t.requirement === r.id);
    const ok = own.length ? own.every(t => byId.get(t.id)?.passed) : null;
    return { ...r, ok, own };
  });
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 font-medium">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Acceptance tests: {passed}/{tests.length} pass
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 pl-4">
          {rows.map(r => (
            <li key={r.id} className="flex items-start gap-1.5">
              {r.ok === null ? <MinusCircle className="w-3 h-3 mt-0.5 shrink-0 text-slate-500" /> : r.ok ? <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" /> : <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-rose-400" />}
              <span><span className="text-slate-400">{r.id}</span> {r.text}
                {r.ok === false && r.own.map(t => byId.get(t.id)).filter(x => x && !x.passed).map(x => (
                  <span key={x.id} className="block text-[10px] text-rose-300/80">{x.id}: {x.message.slice(0, 160)}</span>
                ))}
              </span>
            </li>
          ))}
          {(result.droppedTests || []).map(d => (
            <li key={d.id} className="flex items-start gap-1.5 text-slate-400">
              <MinusCircle className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
              <span>Dropped test {d.id} "{d.name}": judged wrong by the reviewer ({d.reason})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModelPicker({ value, onChange, models, scope, label }) {
  const groups = useMemo(() => {
    const g = new Map();
    for (const m of models) {
      if (!g.has(m.group)) g.set(m.group, []);
      g.get(m.group).push(m);
    }
    return [...g.entries()];
  }, [models]);
  const known = models.some(m => m.key === value);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">Choose a model…</option>
          {groups.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map(m => <option key={m.key} value={m.key}>{m.loaded ? '● ' : ''}{m.label}</option>)}
            </optgroup>
          ))}
          {value && !known && <option value={value}>{describeModelKey(value)} (not available now)</option>}
        </select>
        {scope && <ModelReasoningSubmenu scope={scope} label={label} compact />}
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />;
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
  if (status === 'skipped') return <MinusCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  return <Circle className="w-3.5 h-3.5 text-slate-700 shrink-0" />;
}

function Timeline({ phases, roles }) {
  const done = phases.filter(p => ['done', 'skipped', 'failed'].includes(p.status)).length;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
        <span>{done}/{phases.length} passes</span>
        <div className="h-1 flex-1 mx-2 bg-slate-800 rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all" style={{ width: `${(done / Math.max(1, phases.length)) * 100}%` }} />
        </div>
      </div>
      {phases.map(p => (
        <div key={p.id} className={`flex gap-2 px-1.5 py-1 rounded ${p.status === 'running' ? 'bg-cyan-950/40' : ''}`}>
          <StatusIcon status={p.status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className={p.status === 'pending' ? 'text-slate-500' : 'text-slate-200'}>{p.label}</span>
              <span className={`text-[9px] uppercase tracking-wide ${ROLE_COLORS[p.role] || 'text-slate-400'}`}>{p.role}</span>
              {p.ms ? <span className="text-[9px] text-slate-500 ml-auto">{(p.ms / 1000).toFixed(0)}s</span> : null}
            </div>
            {p.status === 'running' && p.role !== 'tool' && roles[p.role] && (
              <div className="text-[10px] text-slate-500 truncate">{describeModelKey(roles[p.role])}</div>
            )}
            {p.note && p.status !== 'pending' && (
              <div className={`text-[10px] leading-snug ${p.status === 'failed' ? 'text-rose-300' : 'text-slate-400'}`}>{p.note}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AgentPanel({
  settings, setSettings, models, onSuggestRoles, onRescanModels,
  running, phases, logs, question, onAnswer, onRun, onStop,
  previewErrorCount, onFixErrors, runs, onRestoreCheckpoint, lastResult,
}) {
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const [openRun, setOpenRun] = useState(null);
  const [ollamaCpu, setOllamaCpu] = useState(ollamaCpuOnly);

  const roles = settings.roles || {};
  const missingRoles = Object.keys(ROLE_LABELS).filter(r => !roles[r]);
  const sameReviewer = roles.reviewer && roles.reviewer === roles.developer;

  const submit = (e) => {
    e?.preventDefault();
    if (!prompt.trim() || running) return;
    onRun(settings.mode, prompt.trim());
    setPrompt('');
  };

  const dictate = () => {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec || !cloudSpeechAllowed()) return;
    const rec = new Rec();
    rec.onresult = (e) => setPrompt(p => `${p ? `${p} ` : ''}${e.results[0][0].transcript}`);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const set = (patch) => setSettings({ ...settings, ...patch });

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900/60 border-r border-slate-800">
      {/* Mode + settings toggle */}
      <div className="p-2 border-b border-slate-800 flex items-center gap-1.5">
        {Object.entries(MODES).map(([id, m]) => (
          <button
            key={id}
            onClick={() => set({ mode: id })}
            title={m.description}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${settings.mode === id ? 'bg-purple-600/30 border-purple-500/60 text-purple-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
            {m.label}
          </button>
        ))}
        <button onClick={() => setShowSettings(s => !s)} title="Models & standards" className={`ml-auto p-1.5 rounded-md border ${showSettings ? 'border-cyan-500/60 text-cyan-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {showSettings && (
        <div className="p-2.5 border-b border-slate-800 space-y-2.5 max-h-[55%] overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1"><Cpu className="w-3 h-3" /> Models per role</span>
            <div className="flex gap-1">
              <button onClick={onRescanModels} className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 border border-slate-700 rounded">Rescan</button>
              <button onClick={onSuggestRoles} className="text-[10px] text-cyan-300 hover:text-white px-1.5 py-0.5 border border-cyan-700/60 rounded">Auto-assign</button>
            </div>
          </div>
          {models.length === 0 && (
            <div className="text-[11px] text-amber-300">No models found. Start the LM Studio server (or Ollama), add an Exchange key in the AI Lounge, or add a cloud key in Settings.</div>
          )}
          {Object.entries(ROLE_LABELS).map(([role, [label, hint]]) => (
            <div key={role}>
              <div className={`text-[11px] font-semibold ${ROLE_COLORS[role]}`}>{label}</div>
              <div className="text-[10px] text-slate-500 mb-0.5">{hint}</div>
              <ModelPicker
                value={roles[role]}
                onChange={(v) => set({ roles: { ...roles, [role]: v } })}
                models={models}
                scope={`cybeni:${role}`}
                label={`${label} Reasoning`}
              />
            </div>
          ))}
          {sameReviewer && <div className="text-[10px] text-amber-300">The reviewer uses the same model as the developer, so reviews are self-checks rather than a true cross-check.</div>}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-slate-400">Security
              <select value={settings.security} onChange={e => set({ security: e.target.value })} className="w-full mt-0.5 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200">
                {Object.keys(SECURITY_LEVELS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="text-[10px] text-slate-400">Code quality
              <select value={settings.quality} onChange={e => set({ quality: e.target.value })} className="w-full mt-0.5 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200">
                {Object.keys(QUALITY_LEVELS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-[10px] text-slate-400">Design direction
            <select value={settings.design} onChange={e => set({ design: e.target.value })} className="w-full mt-0.5 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200">
              <option value="">Let the designer decide</option>
              {DESIGN_SYSTEMS.map(d => <option key={d.id} value={`${d.name}: ${d.description}`}>{d.name}</option>)}
            </select>
          </label>
          <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
            <input type="checkbox" checked={ollamaCpu} onChange={e => { setOllamaCpuOnly(e.target.checked); setOllamaCpu(e.target.checked); }} className="mt-0.5" />
            <span>Run Ollama models on the CPU (system RAM)<span className="block text-[10px] text-slate-500">Keeps the GPU free for LM Studio. Turned on automatically if Ollama's GPU build crashes on your card.</span></span>
          </label>
          <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
            <input type="checkbox" checked={settings.autoVerify} onChange={e => set({ autoVerify: e.target.checked })} className="mt-0.5" />
            <span>Run the app during the build and repair runtime errors automatically<span className="block text-[10px] text-slate-500">Up to {settings.maxFixRounds} repair rounds per check.</span></span>
          </label>
        </div>
      )}

      {/* Activity */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3">
        {question && (
          <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-950/30">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-200"><MessageCircleQuestion className="w-3.5 h-3.5" /> Cybeni needs your input</div>
            <div className="text-[12px] text-slate-100 mt-1">{question.text}</div>
            <form onSubmit={(e) => { e.preventDefault(); onAnswer(answer || 'Use your best judgement.'); setAnswer(''); }} className="flex gap-1.5 mt-2">
              <input autoFocus value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Your answer" className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[12px] text-white" />
              <button className="px-2 py-1 rounded bg-amber-600 text-white text-[11px] font-semibold">Answer</button>
            </form>
          </div>
        )}

        {phases.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> {running ? 'Pipeline running' : 'Last pipeline'}
            </div>
            <Timeline phases={phases} roles={roles} />
            {lastResult && !running && (
              <div className={`mt-2 p-2 rounded-md border text-[11px] ${lastResult.status === 'done' ? (lastResult.approved === false ? 'border-amber-600/40 bg-amber-950/20 text-amber-100' : 'border-emerald-600/40 bg-emerald-950/20 text-emerald-100') : 'border-rose-600/40 bg-rose-950/20 text-rose-100'}`}>
                <div className="font-semibold">
                  {lastResult.status === 'done' ? (lastResult.approved === false ? 'Finished with open issues' : 'Finished') : lastResult.status === 'cancelled' ? 'Stopped' : `Failed: ${lastResult.error}`}
                  <span className="font-normal text-slate-400"> · {lastResult.stats?.modelCalls || 0} model calls · {Math.round((lastResult.stats?.ms || 0) / 1000)}s · {lastResult.changed?.length || 0} files changed</span>
                </div>
                {lastResult.unreviewed?.length > 0 && (
                  <div className="mt-1 text-amber-200">Not fully checked: these steps could not run ({lastResult.unreviewed.join(', ')}), so the build is not approved. See the failed steps above.</div>
                )}
                <RequirementsCheck result={lastResult} />
                {lastResult.summary && <div className="mt-1 whitespace-pre-wrap text-slate-200">{lastResult.summary}</div>}
              </div>
            )}
            <button onClick={() => setShowLogs(s => !s)} className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200">
              {showLogs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} <ScrollText className="w-3 h-3" /> Log ({logs.length})
            </button>
            {showLogs && (
              <div className="mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded p-1.5 font-mono text-[10px] text-slate-400 space-y-0.5">
                {logs.map((l, i) => <div key={i}>{l.text}</div>)}
              </div>
            )}
          </div>
        )}

        {phases.length === 0 && !question && (
          <div className="text-[11px] text-slate-400 leading-relaxed">
            Describe what to build or change. Cybeni plans it, builds it, has a second model review it, runs it in the preview and repairs what breaks.
            <ul className="mt-2 space-y-1 text-slate-500">
              <li><b className="text-slate-300">Quick</b>: fast edits (5 passes)</li>
              <li><b className="text-slate-300">Standard</b>: plan, build, cross-review, runtime repair (12)</li>
              <li><b className="text-slate-300">Full 27-pass</b>: double self-checks, three orchestrator checkpoints, dependency tracing, limit validation</li>
            </ul>
          </div>
        )}

        {runs?.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">History</div>
            {runs.map(run => (
              <div key={run.id} className="border-b border-slate-800/80 py-1.5">
                <button onClick={() => setOpenRun(openRun === run.id ? null : run.id)} className="w-full text-left flex items-start gap-1.5">
                  {run.status === 'done' ? <CheckCircle2 className={`w-3 h-3 mt-0.5 shrink-0 ${run.approved === false ? 'text-amber-400' : 'text-emerald-400'}`} /> : <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-rose-400" />}
                  <span className="text-[11px] text-slate-300 line-clamp-2">{run.prompt}</span>
                </button>
                {openRun === run.id && (
                  <div className="ml-4 mt-1 space-y-1">
                    <div className="text-[10px] text-slate-500">{MODES[run.mode]?.label || run.mode} · {new Date(run.at).toLocaleString()} · {run.changed?.length || 0} files</div>
                    {run.summary && <div className="text-[10px] text-slate-400 whitespace-pre-wrap">{run.summary}</div>}
                    {run.checkpointId && (
                      <button onClick={() => onRestoreCheckpoint(run.checkpointId)} disabled={running} className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white disabled:opacity-40">
                        <RotateCcw className="w-3 h-3" /> Restore the project to before this run
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-2 border-t border-slate-800 space-y-1.5">
        {previewErrorCount > 0 && !running && (
          <button onClick={onFixErrors} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-rose-600/20 border border-rose-500/50 text-rose-200 text-[11px] font-semibold hover:bg-rose-600/30">
            <Wand2 className="w-3.5 h-3.5" /> Fix {previewErrorCount} preview error{previewErrorCount === 1 ? '' : 's'}
          </button>
        )}
        {missingRoles.length > 0 && <div className="text-[10px] text-amber-300">Assign a model to: {missingRoles.join(', ')} (gear icon).</div>}
        <form onSubmit={submit} className="space-y-1.5">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e); }}
            rows={3}
            placeholder={running ? 'Pipeline running…' : 'What should Cybeni build or change? (Ctrl+Enter)'}
            disabled={running}
            className="w-full resize-none bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-[12px] text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-60"
          />
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={dictate} disabled={running} title="Dictate" className={`p-1.5 rounded-md border ${listening ? 'border-rose-500 text-rose-300' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
              {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[10px] text-slate-500 truncate">{MODES[settings.mode]?.description}</span>
            {running ? (
              <button type="button" onClick={onStop} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-md bg-rose-600 text-white text-[11px] font-semibold"><Square className="w-3 h-3" /> Stop</button>
            ) : (
              <button type="submit" disabled={!prompt.trim() || missingRoles.length > 0} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-[11px] font-semibold disabled:opacity-40"><Send className="w-3 h-3" /> Build</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
