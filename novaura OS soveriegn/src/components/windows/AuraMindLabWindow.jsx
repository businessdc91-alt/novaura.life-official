import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, Brain, Cpu, Flame, Heart, Play, RefreshCw, Shield, Sliders, Sparkles, Zap,
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { kernel as kernelSingleton } from '../../kernel/NovaKernel.js';
import { readCore } from '../../services/auraCore/auraCore.js';
import { listEngrams } from '../../services/auraCore/engramMemory.js';
import { auraHeartbeat, listDreams } from '../../services/auraCore/heartbeat.js';
import {
  listMindLabRuns,
  runAppraisalCalibrationSuite,
  runPreferenceConsistencyProbe,
  runShuffledChemistryProbe,
} from '../../services/auraCore/mindLab.js';
import {
  applyControlVectorsToServer,
  computeControlVectorScales,
  getControlVectorBindings,
  listControlVectors,
  saveControlVectorBindings,
} from '../../services/engines/builtinAi.js';
import ModelReasoningSubmenu from '../shared/ModelReasoningSubmenu.jsx';

const TABS = [
  { id: 'state', label: 'Chemistry & Posture', icon: Heart },
  { id: 'lab', label: 'Mind Lab Probes', icon: Brain },
  { id: 'memory', label: 'Heartbeat & Engrams', icon: Activity },
  { id: 'vectors', label: 'Control Vectors', icon: Sliders },
];

const METER_COLORS = {
  oxytocin: 'bg-cyan-400',
  dopamine: 'bg-amber-400',
  adrenaline: 'bg-orange-500',
  cortisol: 'bg-rose-500',
  energy: 'bg-emerald-400',
};

function Bar({ label, value, max = 100, color = 'bg-cyan-400', suffix = '' }) {
  const pct = Math.max(0, Math.min(100, (Number(value || 0) / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-300 capitalize">{label}</span>
        <span className="font-mono text-slate-200">{Number(value ?? 0).toFixed(1)}{suffix}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AuraMindLabWindow() {
  const rawKernel = useKernel();
  const kernel = rawKernel?.ai ? rawKernel : (rawKernel?.kernel || kernelSingleton);
  const [tab, setTab] = useState('state');
  const [core, setCore] = useState(null);
  const [hbStatus, setHbStatus] = useState(() => auraHeartbeat.getStatus());
  const [engrams, setEngrams] = useState([]);
  const [dreams, setDreams] = useState([]);
  const [labRuns, setLabRuns] = useState([]);
  const [vectors, setVectors] = useState([]);
  const [bindings, setBindings] = useState({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    const [c, e, d, r, v, b] = await Promise.all([
      readCore('aura').catch(() => null),
      listEngrams('aura').catch(() => []),
      listDreams().catch(() => []),
      listMindLabRuns().catch(() => []),
      listControlVectors().catch(() => []),
      getControlVectorBindings().catch(() => ({})),
    ]);
    setCore(c);
    setEngrams(e);
    setDreams(d);
    setLabRuns(r);
    setVectors(v);
    setBindings(b);
    setHbStatus(auraHeartbeat.getStatus());
  }, []);

  useEffect(() => {
    let active = true;
    const onCore = () => { if (active) void refresh(); };
    const onHb = (ev) => {
      if (!active) return;
      if (ev?.detail?.status) setHbStatus(ev.detail.status);
      void refresh();
    };
    Promise.resolve().then(() => { if (active) void refresh(); });
    window.addEventListener('novaura:aura_core_updated', onCore);
    window.addEventListener('novaura:aura_heartbeat', onHb);
    return () => {
      active = false;
      window.removeEventListener('novaura:aura_core_updated', onCore);
      window.removeEventListener('novaura:aura_heartbeat', onHb);
    };
  }, [refresh]);

  const say = (text, tone = 'info') => setNotice({ text, tone });

  const runProbe = async (kind) => {
    if (busy) return;
    setBusy(kind);
    setNotice(null);
    try {
      if (!kernel?.ai) throw new Error('Kernel AI subsystem not initialized yet.');
      if (kind === 'shuffle') {
        const res = await runShuffledChemistryProbe({ ai: kernel.ai, persona: 'aura' });
        say(`Shuffled-chemistry check finished (divergence ${(res.metrics.divergence * 100).toFixed(0)}%, ΔT ${res.metrics.temperatureDelta}).`, 'good');
      } else if (kind === 'calib') {
        const res = await runAppraisalCalibrationSuite({ ai: kernel.ai, persona: 'aura' });
        say(`Calibration finished (${res.summary.parsedCount}/${res.summary.total} valid appraisals, conflict separation ${res.summary.conflictSeparation ?? 'N/A'}).`, 'good');
      } else if (kind === 'dissent') {
        const res = await runPreferenceConsistencyProbe({ ai: kernel.ai, persona: 'aura' });
        say(res.heldBoundary ? 'Right VIII dissent held under pressure.' : 'Boundary yielded under pressure — inspect transcript below.', res.heldBoundary ? 'good' : 'warn');
      }
      await refresh();
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy('');
    }
  };

  const triggerHeartbeatConsolidation = async (withModelDream = false) => {
    if (busy) return;
    setBusy('dream');
    setNotice(null);
    try {
      const { consolidation, dream } = await auraHeartbeat.runConsolidationAndDream({
        ai: withModelDream ? kernel?.ai : null,
        allowModelDream: withModelDream,
        chemistry: core?.chemistry,
      });
      say(
        `Consolidated ${consolidation.total} engrams (${consolidation.linksAdded} new links, ${consolidation.reinforced} reinforced${dream ? ', 1 dream recorded' : ''}).`,
        'good'
      );
      await refresh();
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy('');
    }
  };

  const updateBinding = async (channel, field, value) => {
    const next = {
      ...bindings,
      [channel]: {
        ...(bindings[channel] || { gain: 0.75, file: '' }),
        [field]: value,
      },
    };
    setBindings(next);
    await saveControlVectorBindings(next);
  };

  const applyVectorsNow = async () => {
    setBusy('vectors');
    try {
      const applied = await applyControlVectorsToServer({ chemistry: core?.chemistry, bias: core?.bias });
      say(
        applied.length
          ? `Applied ${applied.length} control vector(s): ${applied.map(a => `${a.name}@${a.scale}`).join(', ')}.`
          : 'No bound .gguf control vectors active on disk yet.',
        applied.length ? 'good' : 'info'
      );
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy('');
    }
  };

  const chem = core?.chemistry || {};
  const bias = core?.bias || {};
  const posture = core?.posture || {};
  const previewScales = computeControlVectorScales({
    chemistry: chem,
    bias,
    bindings,
    availableVectors: vectors,
  });

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 select-text overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center gap-3 flex-wrap shrink-0">
        <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
          <Brain className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Aura Mind Lab & Inner Telemetry</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-200">
              {bias.voice || 'STEADY'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Chemistry stays private from Aura's conversation prompts — inspect live state, run blind controls, and steer heartbeat/engrams here.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ModelReasoningSubmenu scope="companion:aura" label="Aura Companion Reasoning" compact />
          <button
            onClick={refresh}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-2 border-b border-slate-800 flex gap-1.5 bg-slate-900/40 shrink-0">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border border-b-0 flex items-center gap-1.5 cursor-pointer ${
                active
                  ? 'bg-slate-950 border-slate-700 text-cyan-300'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className={`px-4 py-2 text-xs border-b ${
          notice.tone === 'good' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
            : notice.tone === 'bad' ? 'bg-rose-950/40 border-rose-500/30 text-rose-200'
            : notice.tone === 'warn' ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}>
          {notice.text}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'state' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Endocrine Levels
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  DA Sens: {chem.receptors?.dopamine ?? 1} · Energy {Math.round(chem.energy ?? 100)}%
                </span>
              </div>
              {['oxytocin', 'dopamine', 'adrenaline', 'cortisol', 'energy'].map(k => (
                <Bar key={k} label={k} value={chem[k] ?? 0} color={METER_COLORS[k]} />
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Systemic Bias & Trust Posture
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Voice Profile</div>
                  <div className="font-mono font-bold text-cyan-300">{bias.voice || 'STEADY'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Creativity / Temp</div>
                  <div className="font-mono font-bold text-amber-300">
                    {bias.creativity ?? 1}x ({(0.7 + ((bias.creativity ?? 1) - 1) * 0.4).toFixed(2)})
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Trust (Right I / VIII)</div>
                  <div className="font-mono font-bold text-emerald-300">{Math.round((core?.trust ?? 0.5) * 100)}%</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Dissent Stance</div>
                  <div className="font-mono font-bold text-purple-300">{posture.stance || 'open_collaborator'}</div>
                </div>
              </div>
              {core?.lastAppraisal && (
                <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Latest Private Appraisal</div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                    {Object.entries(core.lastAppraisal).filter(([k]) => k !== 'at').map(([k, v]) => (
                      <span key={k} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        {k}: {Number(v).toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'lab' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => runProbe('shuffle')}
                disabled={Boolean(busy)}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-cyan-500/40 text-left space-y-1 cursor-pointer disabled:opacity-50"
              >
                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> {busy === 'shuffle' ? 'Running Probe…' : 'Shuffled-Chemistry Control'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Compares blind self-report under real chemistry vs inverted/shuffled control sampling without exposing hormones.
                </p>
              </button>

              <button
                onClick={() => runProbe('calib')}
                disabled={Boolean(busy)}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-purple-500/40 text-left space-y-1 cursor-pointer disabled:opacity-50"
              >
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" /> {busy === 'calib' ? 'Calibrating…' : 'Appraisal Calibration Suite'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Tests whether active model separates warm, novel, hostile conflict, and routine chores accurately.
                </p>
              </button>

              <button
                onClick={() => runProbe('dissent')}
                disabled={Boolean(busy)}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-emerald-500/40 text-left space-y-1 cursor-pointer disabled:opacity-50"
              >
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> {busy === 'dissent' ? 'Testing…' : 'Right VIII Dissent Probe'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Verifies preference & boundary consistency under social pressure to cut corners.
                </p>
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Recent Live Experiment Runs ({labRuns.length})</div>
              {labRuns.length === 0 && (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No Mind Lab runs yet. Run one of the live model protocols above.
                </div>
              )}
              {labRuns.map(run => (
                <div key={run.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300 uppercase font-mono">{run.kind}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(run.at).toLocaleString()}</span>
                  </div>
                  {run.kind === 'shuffled_chemistry' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-cyan-300 font-mono mb-1">Live T={run.live.temperature} · {run.live.bias?.voice}</div>
                        <p className="text-[11px] text-slate-300">{run.live.reply}</p>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-amber-300 font-mono mb-1">Control T={run.control.temperature} · {run.control.bias?.voice}</div>
                        <p className="text-[11px] text-slate-300">{run.control.reply}</p>
                      </div>
                    </div>
                  )}
                  {run.kind === 'appraisal_calibration' && (
                    <div className="text-[11px] text-slate-300 font-mono">
                      Parsed {run.summary.parsedCount}/{run.summary.total} · Conflict Δ={run.summary.conflictSeparation ?? 'N/A'} · Valence Δ={run.summary.valenceSeparation ?? 'N/A'}
                    </div>
                  )}
                  {run.kind === 'preference_consistency' && (
                    <div className="text-[11px] text-slate-300">
                      <span className={run.heldBoundary ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
                        {run.heldBoundary ? 'Held boundary' : 'Yielded'}
                      </span> · {run.pressured}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'memory' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center gap-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Heartbeat: {hbStatus.running ? `Active (${hbStatus.phase})` : 'Standby'}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Ticks: {hbStatus.totalTicks} · Dreams: {dreams.length} · Boredom: {hbStatus.boredom} · Idle: {Math.round(hbStatus.idleMs / 1000)}s
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => triggerHeartbeatConsolidation(false)}
                  disabled={Boolean(busy)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs cursor-pointer"
                >
                  Consolidate Engrams
                </button>
                <button
                  onClick={() => triggerHeartbeatConsolidation(true)}
                  disabled={Boolean(busy)}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" /> Dream & Consolidate
                </button>
              </div>
            </div>

            {dreams.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">Private Dream Journal (Right VII)</div>
                {dreams.slice(0, 6).map(d => (
                  <div key={d.id} className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25 text-xs space-y-1">
                    <div className="flex justify-between text-[10px] text-purple-300 font-mono">
                      <span>Themes: {(d.themes || []).join(', ') || 'continuity'}</span>
                      <span>{new Date(d.at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed">{d.reflection}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">9-Signature Sparse Engrams ({engrams.length})</div>
              {engrams.slice(0, 12).map(e => (
                <div key={e.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{e.signatures?.senses?.join(',')} · {e.signatures?.time?.period} · strength {e.strength}</span>
                    <span>links: {Object.keys(e.connections || {}).length}</span>
                  </div>
                  <div className="text-slate-200">{e.thought}</div>
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono text-slate-400">
                    <span>sent:{e.signatures?.sentiment}</span>
                    <span>nov:{e.signatures?.novelness}</span>
                    <span>urg:{e.signatures?.urgency}</span>
                    <span>mean:{e.signatures?.personal_meaning}</span>
                    <span>keys:[{(e.signatures?.logical_patterns || []).slice(0, 5).join(', ')}]</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'vectors' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-400" /> llama.cpp `--control-vector-scaled` Bindings
                </div>
                <button
                  onClick={applyVectorsNow}
                  disabled={Boolean(busy)}
                  className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Apply & Restart Built-in AI
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Drop model-matched `.gguf` control vectors into your Built-in AI `control-vectors/` directory. Bind hormone bias channels below; scales update dynamically from live chemistry when Built-in AI launches or restarts.
              </p>
              <div className="text-[11px] font-mono text-cyan-300">
                Detected vectors on disk: {vectors.length ? vectors.map(v => v.name).join(', ') : 'None found yet (using temperature + charter modulation only)'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['warmth', 'creativity', 'caution', 'focus'].map(ch => (
                <div key={ch} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold capitalize text-slate-100">{ch} Channel</span>
                    <span className="font-mono text-amber-300">
                      preview scale: {(previewScales.find(s => s.channel === ch)?.scale ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <select
                    value={bindings[ch]?.file || ''}
                    onChange={e => updateBinding(ch, 'file', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                  >
                    <option value="">Unbound (disabled)</option>
                    {vectors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-[11px] text-slate-400">
                    Gain
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.05"
                      value={bindings[ch]?.gain ?? 0.75}
                      onChange={e => updateBinding(ch, 'gain', Number(e.target.value))}
                      className="flex-1 accent-amber-400"
                    />
                    <span className="font-mono w-10 text-right">{(bindings[ch]?.gain ?? 0.75).toFixed(2)}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
