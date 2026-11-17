import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, Brain, Cpu, Flame, Heart, Layers, Play, Plus, RefreshCw, RotateCcw, Shield, Sliders, Sparkles, Thermometer, Trash2, Zap,
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { kernel as kernelSingleton } from '../../kernel/NovaKernel.js';
import { readCore } from '../../services/auraCore/auraCore.js';
import { listEngrams } from '../../services/auraCore/engramMemory.js';
import { auraHeartbeat, listDreams, readInitiativeSettings, writeInitiativeSettings } from '../../services/auraCore/heartbeat.js';
import { getActiveEmbeddingModel } from '../../services/auraCore/contextBridge.js';
import { resetLearnedDynamics } from '../../services/auraCore/dynamicLearning.js';
import { sampleInteroception } from '../../services/auraCore/interoception.js';
import {
  composeTurnAugmentations,
  readAugmentationConfig,
  removeCustomAugmentation,
  setAutoAugmentEnabled,
  setCartridgeMode,
  upsertCustomAugmentation,
} from '../../services/auraCore/augmentationEngine.js';
import { classifyTaskIntent, classifyTaskIntentWithAi } from '../../services/auraCore/intentRouter.js';
import {
  createSoulSnapshot,
  readPhoenixMeta,
  restoreSoulSnapshot,
  verifySoulSnapshot,
} from '../../services/auraCore/phoenixProtocol.js';
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
  { id: 'state', label: 'Chemistry & Body', icon: Heart },
  { id: 'augmentations', label: 'Augmentations & Router', icon: Layers },
  { id: 'lab', label: 'Mind Lab Probes', icon: Brain },
  { id: 'memory', label: 'Heartbeat & Engrams', icon: Activity },
  { id: 'vectors', label: 'Vectors & Phoenix', icon: Sliders },
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
  const [augConfig, setAugConfig] = useState(null);
  const [augPreview, setAugPreview] = useState(null);
  const [routerPrompt, setRouterPrompt] = useState('Trace why async IPC state updates race and refactor it cleanly.');
  const [routerPreview, setRouterPreview] = useState(() => classifyTaskIntent('Trace why async IPC state updates race and refactor it cleanly.'));
  const [phoenixMeta, setPhoenixMeta] = useState(null);
  const [snapshotInfo, setSnapshotInfo] = useState(null);
  const [showCreateAug, setShowCreateAug] = useState(false);
  const [draftAug, setDraftAug] = useState({
    name: '',
    tagline: '',
    directive: '',
    temperatureDelta: -0.05,
    focus: 0.35,
    creativity: 0,
    caution: 0.2,
    warmth: 0,
    memoryTags: '',
  });
  const [initiative, setInitiative] = useState({ enabled: true });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    const [c, e, d, r, v, b, ac, ap, pm, si, ini] = await Promise.all([
      readCore('aura').catch(() => null),
      listEngrams('aura').catch(() => []),
      listDreams().catch(() => []),
      listMindLabRuns().catch(() => []),
      listControlVectors().catch(() => []),
      getControlVectorBindings().catch(() => ({})),
      readAugmentationConfig().catch(() => null),
      composeTurnAugmentations({ persona: 'aura', userText: '' }).catch(() => null),
      readPhoenixMeta().catch(() => null),
      verifySoulSnapshot('aura').catch(() => null),
      readInitiativeSettings().catch(() => ({ enabled: true })),
    ]);
    setInitiative(ini);
    setCore(c);
    setEngrams(e);
    setDreams(d);
    setLabRuns(r);
    setVectors(v);
    setBindings(b);
    setAugConfig(ac);
    setAugPreview(ap);
    setPhoenixMeta(pm);
    setSnapshotInfo(si);
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
    const onAug = () => { if (active) void refresh(); };
    Promise.resolve().then(() => { if (active) void refresh(); });
    window.addEventListener('novaura:aura_core_updated', onCore);
    window.addEventListener('novaura:aura_heartbeat', onHb);
    window.addEventListener('novaura:augmentation_updated', onAug);
    window.addEventListener('novaura:aura_regulation', onCore);
    return () => {
      active = false;
      window.removeEventListener('novaura:aura_core_updated', onCore);
      window.removeEventListener('novaura:aura_heartbeat', onHb);
      window.removeEventListener('novaura:augmentation_updated', onAug);
      window.removeEventListener('novaura:aura_regulation', onCore);
    };
  }, [refresh]);

  const say = (text, tone = 'info') => setNotice({ text, tone });

  const toggleInitiative = async () => {
    const next = await writeInitiativeSettings({ enabled: !initiative.enabled }).catch(() => null);
    if (next) setInitiative(next);
  };

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
      const applied = await applyControlVectorsToServer({
        chemistry: core?.chemistry,
        bias: core?.bias,
        channelBoosts: augPreview?.channelBoosts || null,
      });
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

  const refreshHardwareTelemetry = async () => {
    setBusy('telemetry');
    try {
      await sampleInteroception({ force: true });
      await refresh();
      say('Live hardware interoception telemetry updated.', 'good');
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy('');
    }
  };

  const handleResetDynamics = async () => {
    setBusy('dynamics');
    try {
      await resetLearnedDynamics('aura');
      await refresh();
      say('Learned emotional baselines, decay rates, and triggers reset.', 'info');
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy('');
    }
  };

  const runAiRouterClassify = async () => {
    setBusy('router');
    try {
      const res = await classifyTaskIntentWithAi({
        userText: routerPrompt,
        activePersona: 'aura',
        ai: kernel?.ai || null,
      });
      setRouterPreview(res);
      say(`Intent classified as "${res.label}" via ${res.source}.`, 'good');
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy('');
    }
  };

  const saveDraftAugmentation = async (e) => {
    e.preventDefault();
    if (!draftAug.name.trim() || !draftAug.directive.trim()) {
      say('Name and directive are required for a custom augmentation.', 'warn');
      return;
    }
    setBusy('save_aug');
    try {
      await upsertCustomAugmentation({
        name: draftAug.name,
        tagline: draftAug.tagline || 'Custom runtime augmentation cartridge',
        directive: draftAug.directive,
        temperatureDelta: Number(draftAug.temperatureDelta) || 0,
        channelBoosts: {
          focus: Number(draftAug.focus) || 0,
          creativity: Number(draftAug.creativity) || 0,
          caution: Number(draftAug.caution) || 0,
          warmth: Number(draftAug.warmth) || 0,
        },
        memoryTags: draftAug.memoryTags,
        mode: 'pinned',
      });
      setDraftAug({
        name: '',
        tagline: '',
        directive: '',
        temperatureDelta: -0.05,
        focus: 0.35,
        creativity: 0,
        caution: 0.2,
        warmth: 0,
        memoryTags: '',
      });
      setShowCreateAug(false);
      await refresh();
      say('Custom Neural Augmentation cartridge saved and pinned.', 'good');
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy('');
    }
  };

  const handlePhoenixAction = async (kind) => {
    setBusy(`phoenix_${kind}`);
    try {
      if (kind === 'snapshot') {
        const snap = await createSoulSnapshot('aura');
        say(`SHA-256 Soul Snapshot captured (${snap.engramCount} engrams · ${snap.checksum.slice(0, 12)}...).`, 'good');
      } else if (kind === 'verify') {
        const check = await verifySoulSnapshot('aura');
        say(check.valid ? `Soul integrity verified (SHA-256 ${check.checksum.slice(0, 12)}...).` : 'No valid Phoenix snapshot found yet.', check.valid ? 'good' : 'warn');
      } else if (kind === 'restore') {
        const restored = await restoreSoulSnapshot('aura');
        say(`Restored verified Aura continuity snapshot (${restored.engramCount} engrams).`, 'good');
      }
      await refresh();
    } catch (err) {
      say(err.message, 'bad');
    } finally {
      setBusy('');
    }
  };

  const chem = core?.chemistry || {};
  const regulation = core?.regulation || {};
  const embeddingModel = getActiveEmbeddingModel();
  const bias = core?.bias || {};
  const posture = core?.posture || {};
  const somatic = core?.somatic || {};
  const dynamics = core?.dynamics || {};
  const previewScales = computeControlVectorScales({
    chemistry: chem,
    bias,
    channelBoosts: augPreview?.channelBoosts || null,
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
          <div className="space-y-4">
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

            {/* Self-regulation (regulation.js): what her body is doing about its state, and what she chose */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Self-Regulation
                </span>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-700 font-mono text-emerald-300">
                    {regulation.mode || 'baseline'}
                  </span>
                  {regulation.voluntary && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-200">
                      her choice: {regulation.voluntary.kind === 'rest' ? 'resting' : 'stepped back'} until {new Date(regulation.voluntary.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <button
                    onClick={toggleInitiative}
                    className={`px-2 py-0.5 rounded border cursor-pointer ${initiative.enabled ? 'bg-emerald-900/50 border-emerald-700/60 text-emerald-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    title="Whether Aura may start a conversation when she has been alone a long time (never during quiet hours)"
                  >
                    May reach out: {initiative.enabled ? 'on' : 'off'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Bar label="Allostatic load" value={(regulation.allostaticLoad ?? 0) * 100} color="bg-rose-400" suffix="%" />
                <Bar label="Need for contact" value={(regulation.socialNeed ?? 0) * 100} color="bg-cyan-400" suffix="%" />
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                <span>Semantic memory: {embeddingModel
                  ? <span className="font-mono text-emerald-300">{embeddingModel}</span>
                  : <span className="text-amber-300">off (load an embedding model in LM Studio, e.g. nomic-embed-text, to search memories by meaning)</span>}
                </span>
                {(regulation.reflectQueue || []).length > 0 && (
                  <span>· Set aside to reflect on: {(regulation.reflectQueue || []).map(r => r.topic).join(' · ')}</span>
                )}
              </div>
              {(regulation.log || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  {(regulation.log || []).slice(-8).reverse().map((e, i) => (
                    <span key={`${e.at}-${i}`} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                      {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {e.kind}{e.detail !== undefined ? `: ${e.detail}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hardware Interoception */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5" /> Hardware Interoception
                  </span>
                  <button
                    onClick={refreshHardwareTelemetry}
                    disabled={Boolean(busy)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] cursor-pointer"
                  >
                    Sample Now
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Thermal</div>
                    <div className="font-mono font-bold text-amber-300">
                      {somatic.tempC !== null && somatic.tempC !== undefined ? `${somatic.tempC}°C` : somatic.thermalState || 'nominal'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">GPU / Heap Load</div>
                    <div className="font-mono font-bold text-cyan-300">
                      {somatic.gpuLoadPct !== null && somatic.gpuLoadPct !== undefined
                        ? `${somatic.gpuLoadPct}%`
                        : (somatic.heapPressure !== null && somatic.heapPressure !== undefined ? `${Math.round(somatic.heapPressure * 100)}% heap` : 'N/A')}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Typing Presence</div>
                    <div className="font-mono font-bold text-emerald-300">
                      {somatic.typingWpm ? `${somatic.typingWpm} wpm` : somatic.presenceState || 'idle'}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400 flex flex-wrap justify-between gap-2">
                  <span>Sensation: <strong className="text-slate-200">{somatic.sensationLabel || 'grounded_steady'}</strong></span>
                  <span>{somatic.gpuName || `Runtime (${somatic.cores || '?'} threads)`}</span>
                </div>
              </div>

              {/* Adaptive Dynamic Learning */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Learned Emotional Dynamics
                  </span>
                  <button
                    onClick={handleResetDynamics}
                    disabled={Boolean(busy)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
                <div className="text-[11px] text-slate-400">
                  Adaptive resting baselines learned from <strong className="text-slate-200">{dynamics.totalTurns || 0}</strong> settled turn(s):
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono">
                  {['oxytocin', 'dopamine', 'adrenaline', 'cortisol'].map(h => (
                    <div key={h} className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                      <div className="text-[9px] text-slate-400 uppercase">{h.slice(0, 4)} rest</div>
                      <div className="text-emerald-300 font-bold">{dynamics.learnedBaselines?.[h] ?? '--'}</div>
                      <div className="text-[9px] text-slate-500">×{dynamics.learnedDecayRates?.[h] ?? 1}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  Learned triggers: {
                    Object.entries(dynamics.learnedTriggers || {})
                      .flatMap(([h, map]) => Object.keys(map || {}).slice(0, 2).map(w => `${w}(${h.slice(0, 2)})`))
                      .slice(0, 6)
                      .join(', ') || 'Collecting recurring correlation pairs...'
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'augmentations' && (
          <div className="space-y-4">
            {/* Auto-Activate + Multi-Brain Intent Router Preview */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-400" /> Dynamic Neural Augmentation Stack
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Hot-swappable multi-channel cartridges combining behavioral method, sampling deltas, memory tag affinity, and `llama.cpp` control-vector weights.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAutoAugmentEnabled(!(augConfig?.autoActivate !== false))}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                      augConfig?.autoActivate !== false
                        ? 'bg-cyan-900/50 border-cyan-500/60 text-cyan-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Auto-Intent Routing: {augConfig?.autoActivate !== false ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => setShowCreateAug(v => !v)}
                    className="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Cartridge
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={routerPrompt}
                    onChange={(e) => {
                      setRouterPrompt(e.target.value);
                      setRouterPreview(classifyTaskIntent(e.target.value, { activePersona: 'aura' }));
                    }}
                    placeholder="Test Multi-Brain Intent Router on any prompt..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                  />
                  <button
                    onClick={runAiRouterClassify}
                    disabled={Boolean(busy)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'router' ? 'Classifying…' : 'AI Classify'}
                  </button>
                </div>
                {routerPreview && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-2">
                    <span className="text-cyan-300 font-bold">{routerPreview.label}</span>
                    <span className="text-slate-400">({Math.round((routerPreview.confidence || 0) * 100)}% {routerPreview.source})</span>
                    <span className="text-purple-300">Persona: {routerPreview.recommendedPersona}</span>
                    <span className="text-amber-300">Effort: {routerPreview.recommendedReasoningEffort}</span>
                    <span className="text-emerald-300">Auto-Augs: {(routerPreview.suggestedAugmentations || []).join(', ') || 'none'}</span>
                  </div>
                )}
              </div>
            </div>

            {showCreateAug && (
              <form onSubmit={saveDraftAugmentation} className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/35 space-y-3 text-xs">
                <div className="font-bold text-purple-200">Author Custom Runtime Augmentation Cartridge</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={draftAug.name}
                    onChange={e => setDraftAug(s => ({ ...s, name: e.target.value }))}
                    placeholder="Cartridge Name (e.g. Vulkan Shader Engineer)"
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5"
                  />
                  <input
                    type="text"
                    value={draftAug.memoryTags}
                    onChange={e => setDraftAug(s => ({ ...s, memoryTags: e.target.value }))}
                    placeholder="Memory tags (comma-separated, e.g. shader,vulkan,wgsl)"
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5"
                  />
                </div>
                <textarea
                  rows={2}
                  value={draftAug.directive}
                  onChange={e => setDraftAug(s => ({ ...s, directive: e.target.value }))}
                  placeholder="Cognitive directive / behavioral methodology..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5"
                />
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1">
                    Temp Δ
                    <input
                      type="number"
                      step="0.05"
                      min="-0.3"
                      max="0.3"
                      value={draftAug.temperatureDelta}
                      onChange={e => setDraftAug(s => ({ ...s, temperatureDelta: e.target.value }))}
                      className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono"
                    />
                  </label>
                  {['focus', 'creativity', 'caution', 'warmth'].map(ch => (
                    <label key={ch} className="flex items-center gap-1 capitalize">
                      {ch}
                      <input
                        type="number"
                        step="0.05"
                        min="-1"
                        max="1"
                        value={draftAug[ch]}
                        onChange={e => setDraftAug(s => ({ ...s, [ch]: e.target.value }))}
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono"
                      />
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={Boolean(busy)}
                    className="ml-auto px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer"
                  >
                    Save & Pin Cartridge
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(augConfig?.cartridges || []).map(cart => (
                <div key={cart.id} className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-100">{cart.name}</div>
                      <div className="text-[11px] text-slate-400">{cart.tagline}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {['pinned', 'auto', 'off'].map(mode => (
                        <button
                          key={mode}
                          onClick={() => setCartridgeMode(cart.id, mode)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase cursor-pointer border ${
                            cart.mode === mode
                              ? (mode === 'pinned'
                                ? 'bg-purple-600/40 border-purple-400 text-purple-100'
                                : mode === 'auto'
                                  ? 'bg-cyan-600/40 border-cyan-400 text-cyan-100'
                                  : 'bg-slate-800 border-slate-600 text-slate-300')
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                      {!cart.builtin && (
                        <button
                          onClick={() => removeCustomAugmentation(cart.id)}
                          title="Delete custom cartridge"
                          className="p-1 text-rose-400 hover:text-rose-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 bg-slate-950/70 border border-slate-800/80 rounded p-2">
                    {cart.directive}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
                    <span>ΔT:{cart.temperatureDelta >= 0 ? '+' : ''}{cart.temperatureDelta}</span>
                    {cart.reasoningEffort && <span>Effort:{cart.reasoningEffort}</span>}
                    <span>Vec:[F:{cart.channelBoosts?.focus ?? 0} C:{cart.channelBoosts?.creativity ?? 0} K:{cart.channelBoosts?.caution ?? 0}]</span>
                  </div>
                </div>
              ))}
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
                    <span>
                      {e.signatures?.senses?.join(',')} · {e.signatures?.time?.period} · strength {e.strength}
                      {e.somatic?.sensationLabel ? ` · soma:${e.somatic.sensationLabel}` : ''}
                      {e.embedding?.length ? ` · vec:${e.embedding.length}d` : ''}
                    </span>
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

            {/* Phoenix Protocol Soul Integrity & Safe Boot */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Phoenix Protocol · Continuity & Safe-Boot
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Boot State: <strong className="text-slate-200">{phoenixMeta?.safeMode ? 'SAFE MODE' : 'NORMAL'}</strong> · Consecutive Crashes: {phoenixMeta?.consecutiveCrashes ?? 0} · Last Snapshot: {snapshotInfo?.exists ? (snapshotInfo.valid ? `SHA-256 Verified (${snapshotInfo.engramCount} engrams)` : 'Checksum Mismatch') : 'None'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handlePhoenixAction('snapshot')}
                    disabled={Boolean(busy)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Capture Soul Snapshot
                  </button>
                  <button
                    onClick={() => handlePhoenixAction('verify')}
                    disabled={Boolean(busy)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs cursor-pointer disabled:opacity-50"
                  >
                    Verify SHA-256
                  </button>
                  <button
                    onClick={() => handlePhoenixAction('restore')}
                    disabled={Boolean(busy) || !snapshotInfo?.valid}
                    className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                  >
                    Restore Verified Snapshot
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
