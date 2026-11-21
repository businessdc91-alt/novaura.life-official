// SovereignRepairWindow.jsx — Standalone Pop-Out Self-Repair & Auto-Healing Studio.
// Powered by Cybeni (Code/Stack), Aura (UX/Intent), and Nova (Security/Blast-Radius).
// Runs detached via Sovereign's native popout bridge (surviving app crashes), performs live
// DOM/storage/engine introspection, applies reversible Tier-1 runtime hotfixes, executes
// opt-in Source-Attached staged patching with hard oxlint/test/build verification & auto-rollback,
// enforces Human Confirmation before finalizing or rebuilding the installer, and dispatches
// secret-redacted E2E-encrypted upstream repair proposals straight to the Founder profile.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Wrench, ShieldCheck, Sparkles, ExternalLink, RefreshCw, CheckCircle2,
  AlertTriangle, RotateCcw, Send, Terminal, Layers, Inbox, FileCode2,
  Hammer, Loader2, Bot, Activity, Plus
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { APP_REGISTRY } from '../../config/appRegistry.js';
import { isPopoutWindow, isTauriApp, popOutApp } from '../../services/popoutWindows.js';
import {
  runLiveEnvironmentIntrospection,
  getFlightLog,
  clearFlightLog,
  listRuntimeHotfixes,
  applyRuntimeHotfix,
  rollbackRuntimeHotfix,
} from '../../services/repair/flightRecorder.js';
import {
  REPAIR_AGENTS,
  analyzeAndPlanRepair,
  readSourceFileNative,
  executeSourcePatchWithGate,
  rollbackSourcePatch,
  triggerInstallerRebuild,
  saveRepairSession,
  listRepairSessions,
  applyPlannedRuntimeActions,
  rollbackSessionHotfixes,
  dispatchUpstreamRepairProposal,
  loadUpstreamProposals,
} from '../../services/repair/repairOrchestrator.js';

const REPO_ROOT_KEY = 'novaura_repair_source_repo_root';

export default function SovereignRepairWindow({ props: windowProps } = {}) {
  const { kernel } = useKernel();
  const poppedOut = isPopoutWindow();

  const [activeTab, setActiveTab] = useState('repair'); // 'repair' | 'source' | 'hotfixes' | 'founder'
  const [agent, setAgent] = useState('council');
  const [targetApp, setTargetApp] = useState(() => windowProps?.targetApp || windowProps?.crash?.appId || 'desktop');
  const [description, setDescription] = useState(() =>
    windowProps?.crash?.message
      ? `App crashed in ${windowProps.crash.windowType || 'window'}: ${windowProps.crash.message}`
      : ''
  );
  const [crashEvent, setCrashEvent] = useState(() => windowProps?.crash || null);

  // Live Introspection & Flight Log
  const [probing, setProbing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [flightLog, setFlightLog] = useState(() => getFlightLog());

  // Active Repair Plan & Session
  const [diagnosing, setDiagnosing] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [plan, setPlan] = useState(null);
  const [appliedHotfixIds, setAppliedHotfixIds] = useState([]);
  const [humanNotes, setHumanNotes] = useState('');
  const [humanStatus, setHumanStatus] = useState('idle'); // 'idle' | 'awaiting' | 'confirmed' | 'rolled_back'
  const [dispatchingUpstream, setDispatchingUpstream] = useState(false);

  // Opt-In Source Mode (Developer / Founder PC)
  const [repoRoot, setRepoRoot] = useState(() => {
    try { return localStorage.getItem(REPO_ROOT_KEY) || ''; } catch { return ''; }
  });
  const [sourceFilePath, setSourceFilePath] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [verifyBuildToo, setVerifyBuildToo] = useState(false);
  const [stagingSource, setStagingSource] = useState(false);
  const [stageStatus, setStageStatus] = useState('');
  const [sourceResult, setSourceResult] = useState(null);
  const [rebuildingInstaller, setRebuildingInstaller] = useState(false);

  // Hotfixes, Sessions & Founder Inbox
  const [hotfixes, setHotfixes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [manualKind, setManualKind] = useState('link_redirect');
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [manualCss, setManualCss] = useState('');

  const [notice, setNotice] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const flashNotice = useCallback((text) => {
    setNotice(text);
    setTimeout(() => setNotice(prev => (prev === text ? null : prev)), 5000);
  }, []);

  const refreshHistory = useCallback(async () => {
    const [hf, sess, propsList] = await Promise.all([
      listRuntimeHotfixes(),
      listRepairSessions(),
      loadUpstreamProposals(),
    ]);
    setHotfixes(hf);
    setSessions(sess);
    setProposals(propsList);
    setFlightLog(getFlightLog());
  }, []);

  // Trigger Live Introspection (if popped out in Tauri, asks the main desktop over BroadcastChannel!)
  const runProbe = useCallback(async () => {
    setProbing(true);
    setErrorMsg(null);
    try {
      if (poppedOut && isTauriApp()) {
        const requestId = `prb_${Date.now().toString(36)}`;
        const remote = await new Promise((resolve) => {
          const timer = setTimeout(() => {
            window.removeEventListener('novaura:repair_probe_results', onRes);
            resolve(null);
          }, 2600);
          const onRes = (e) => {
            if (e?.detail?.requestId !== requestId) return;
            clearTimeout(timer);
            window.removeEventListener('novaura:repair_probe_results', onRes);
            resolve(e.detail.snapshot);
          };
          window.addEventListener('novaura:repair_probe_results', onRes);
          window.dispatchEvent(new CustomEvent('novaura:repair_probe_request', { detail: { requestId, probeEngines: true } }));
        });
        if (remote) {
          setSnapshot(remote);
          setFlightLog(remote.flightErrors || getFlightLog());
          return remote;
        }
      }
      const local = await runLiveEnvironmentIntrospection({ probeEngines: true });
      setSnapshot(local);
      setFlightLog(local.flightErrors || getFlightLog());
      return local;
    } catch (err) {
      setErrorMsg(err.message || 'Introspection probe failed.');
      return null;
    } finally {
      setProbing(false);
    }
  }, [poppedOut]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      refreshHistory();
      runProbe();
    });
    const onContext = (e) => {
      if (e.detail?.appId !== 'sovereign_repair') return;
      const p = e.detail.props || {};
      if (p.crash) {
        setCrashEvent(p.crash);
        setTargetApp(p.targetApp || p.crash.appId || 'desktop');
        setDescription(`App crashed in ${p.crash.windowType || 'window'}: ${p.crash.message}`);
        setActiveTab('repair');
      }
    };
    const onFlight = () => setFlightLog(getFlightLog());
    window.addEventListener('novaura:app_context', onContext);
    window.addEventListener('novaura:repair_flight_updated', onFlight);
    return () => {
      cancelled = true;
      window.removeEventListener('novaura:app_context', onContext);
      window.removeEventListener('novaura:repair_flight_updated', onFlight);
    };
  }, [refreshHistory, runProbe]);

  const handlePopOutStandalone = async () => {
    if (!isTauriApp()) {
      flashNotice('Running in browser preview: native multi-monitor pop-out windows activate automatically in the Tauri desktop app.');
      return;
    }
    try {
      await popOutApp('sovereign_repair', {
        title: 'Sovereign Auto-Repair Studio (Cybeni · Aura · Nova)',
        props: { targetApp, crash: crashEvent },
        size: { width: 1080, height: 720 },
      });
      flashNotice('Detached standalone Auto-Repair window opened!');
    } catch (err) {
      setErrorMsg(`Could not pop out window: ${err.message}`);
    }
  };

  const handleDiagnose = async () => {
    if (!description.trim() && !crashEvent) {
      setErrorMsg('Describe the broken button, link, or glitch — or select a captured crash from the Flight Log.');
      return;
    }
    setDiagnosing(true);
    setErrorMsg(null);
    setHumanStatus('idle');
    setSourceResult(null);
    try {
      const freshSnap = snapshot || (await runProbe());
      const chatFn = kernel?.ai?.chat
        ? (msgs) => kernel.ai.chat(msgs, { persona: agent === 'council' ? 'cybeni' : agent })
        : null;

      const builtPlan = await analyzeAndPlanRepair({
        description: description.trim() || crashEvent?.message || 'Captured runtime issue',
        agent,
        targetApp,
        crashEvent,
        diagnosticSnapshot: freshSnap,
        sourceFilePath: sourceFilePath.trim(),
        sourceContent,
        chatFn,
      });

      setPlan(builtPlan);
      const saved = await saveRepairSession({
        status: 'diagnosed',
        agent,
        targetKind: builtPlan.strategy,
        targetRef: targetApp,
        description: description.trim() || crashEvent?.message || '',
        plan: builtPlan,
      });
      setActiveSession(saved);
      refreshHistory();
      flashNotice(`Diagnosis ready (${builtPlan.source === 'ai-council' ? '3-Agent AI Council' : 'Live Introspector'}). Review plan before applying.`);
    } catch (err) {
      setErrorMsg(err.message || 'Diagnosis failed.');
    } finally {
      setDiagnosing(false);
    }
  };

  const handleApplyRuntimeFixes = async () => {
    if (!plan?.runtimeActions?.length) {
      flashNotice('No Tier-1 runtime hotfixes needed — you can confirm or dispatch a main-distro code proposal.');
      setHumanStatus('awaiting');
      return;
    }
    setErrorMsg(null);
    try {
      const applied = await applyPlannedRuntimeActions(plan.runtimeActions);
      const ids = applied.map(a => a.id);
      setAppliedHotfixIds(ids);
      setHumanStatus('awaiting');
      if (activeSession) {
        const updated = await saveRepairSession({
          ...activeSession,
          status: 'awaiting_human_confirmation',
          appliedHotfixIds: ids,
        });
        setActiveSession(updated);
      }
      await refreshHistory();
      await runProbe();
      flashNotice(`Applied ${applied.length} reversible runtime fix(es). Test the app and confirm below!`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to apply runtime fix.');
    }
  };

  const handleReadSource = async () => {
    if (!isTauriApp()) {
      setErrorMsg('Source-Attached file reading requires the Tauri desktop app on your developer workstation.');
      return;
    }
    if (!repoRoot.trim() || !sourceFilePath.trim()) {
      setErrorMsg('Enter both your local Sovereign repository root and a relative src/ file path.');
      return;
    }
    setErrorMsg(null);
    try {
      const text = await readSourceFileNative(repoRoot.trim(), sourceFilePath.trim());
      setSourceContent(text);
      flashNotice(`Loaded ${sourceFilePath.trim()} (${text.length} chars) into 3-Agent Council context.`);
    } catch (err) {
      setErrorMsg(err.message || 'Could not read source file.');
    }
  };

  const handleStageAndVerifySourcePatch = async () => {
    if (!isTauriApp()) {
      setErrorMsg('Source-Attached code patching and test/build gates run in the Tauri desktop app.');
      return;
    }
    if (!repoRoot.trim()) {
      setErrorMsg('Set your local Sovereign repository path first.');
      return;
    }
    if (!plan?.codeEdits?.length) {
      setErrorMsg('No staged code edits in current plan. Load a source file and run Diagnosis first.');
      return;
    }
    setStagingSource(true);
    setErrorMsg(null);
    setSourceResult(null);
    try {
      const verifySteps = verifyBuildToo ? ['oxlint', 'npm_test', 'vite_build'] : ['oxlint', 'npm_test'];
      const res = await executeSourcePatchWithGate({
        repoRoot: repoRoot.trim(),
        sessionId: activeSession?.id || `rep_${Date.now().toString(36)}`,
        edits: plan.codeEdits,
        verifySteps,
        onStatus: setStageStatus,
      });
      setSourceResult(res);
      if (res.ok) {
        setHumanStatus('awaiting');
        if (activeSession) {
          const updated = await saveRepairSession({
            ...activeSession,
            status: 'awaiting_human_confirmation',
            snapshotId: res.snapshotId,
            verification: res.verification,
          });
          setActiveSession(updated);
        }
        flashNotice('Source patch passed ALL automated verification gates! Test live and confirm below.');
      } else {
        setErrorMsg('Automated verification gate failed — pre-patch snapshot was automatically restored safely.');
      }
      refreshHistory();
    } catch (err) {
      setErrorMsg(err.message || 'Staged source patch aborted.');
    } finally {
      setStagingSource(false);
      setStageStatus('');
    }
  };

  const handleHumanConfirm = async (worked) => {
    setErrorMsg(null);
    if (!worked) {
      try {
        if (appliedHotfixIds.length) {
          await rollbackSessionHotfixes(appliedHotfixIds);
        }
        if (sourceResult?.snapshotId && repoRoot.trim() && isTauriApp()) {
          await rollbackSourcePatch({ repoRoot: repoRoot.trim(), snapshotId: sourceResult.snapshotId });
        }
        setHumanStatus('rolled_back');
        if (activeSession) {
          const updated = await saveRepairSession({
            ...activeSession,
            status: 'rolled_back',
            humanConfirmed: false,
            humanNotes,
          });
          setActiveSession(updated);
        }
        await refreshHistory();
        await runProbe();
        flashNotice('Rolled back cleanly to pre-repair snapshot! Add notes on what still happened and re-run Diagnosis.');
      } catch (err) {
        setErrorMsg(`Rollback error: ${err.message}`);
      }
      return;
    }

    // Human confirmed fix worked! Save & dispatch secret-redacted upstream report to Founder Profile
    setHumanStatus('confirmed');
    setDispatchingUpstream(true);
    try {
      const confirmedSession = await saveRepairSession({
        ...(activeSession || { agent, targetRef: targetApp, description, plan }),
        status: 'confirmed_working',
        appliedHotfixIds,
        snapshotId: sourceResult?.snapshotId || null,
        humanConfirmed: true,
        humanNotes,
      });
      setActiveSession(confirmedSession);

      const { proposal, redactedCount } = await dispatchUpstreamRepairProposal(confirmedSession, {
        humanConfirmed: true,
        humanNotes,
      });
      await saveRepairSession({ ...confirmedSession, upstreamClientId: proposal.clientId });
      await refreshHistory();
      flashNotice(
        `Fix confirmed! E2E-encrypted upstream distro proposal queued to Founder profile${redactedCount > 0 ? ` (${redactedCount} secret(s) auto-redacted)` : ''}.`
      );
    } catch (err) {
      setErrorMsg(`Confirmed locally, but upstream queue note: ${err.message}`);
    } finally {
      setDispatchingUpstream(false);
    }
  };

  const handleRebuildInstaller = async () => {
    if (!isTauriApp() || !repoRoot.trim()) return;
    setRebuildingInstaller(true);
    setErrorMsg(null);
    try {
      const report = await triggerInstallerRebuild({
        repoRoot: repoRoot.trim(),
        humanConfirmed: humanStatus === 'confirmed',
      });
      if (report.passed) {
        flashNotice('Desktop installer rebuilt cleanly (`npm run tauri:build` exit 0)! Ready to reinstall from src-tauri/target/release/bundle.');
      } else {
        setErrorMsg(`Installer build failed: ${report.steps?.[0]?.stderr?.slice(0, 260) || 'check logs'}`);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setRebuildingInstaller(false);
    }
  };

  const handleCreateManualHotfix = async () => {
    setErrorMsg(null);
    try {
      if (manualKind === 'link_redirect') {
        await applyRuntimeHotfix({
          kind: 'link_redirect',
          title: `Redirect "${manualFrom}" → ${manualTo}`,
          targetApp,
          payload: { fromPattern: manualFrom.trim(), toUrl: manualTo.trim() },
        });
        setManualFrom('');
        setManualTo('');
      } else {
        await applyRuntimeHotfix({
          kind: 'css_hotfix',
          title: `Scoped CSS fix for ${targetApp}`,
          targetApp,
          payload: { css: manualCss },
        });
        setManualCss('');
      }
      await refreshHistory();
      flashNotice('Applied reversible Tier-1 runtime hotfix!');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate">Sovereign Auto-Repair Studio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                Cybeni · Aura · Nova
              </span>
              {poppedOut && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  Standalone Pop-Out Linked
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {[
              ['repair', 'Report & Auto-Repair', Sparkles],
              ['source', 'Source Patch & Build', FileCode2],
              ['hotfixes', `Hotfixes (${hotfixes.filter(h => h.enabled).length})`, Layers],
              ['founder', `Founder Distro Inbox (${proposals.length})`, Inbox],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  activeTab === id ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>

          {!poppedOut && (
            <button
              type="button"
              onClick={handlePopOutStandalone}
              className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
              title="Detach into a standalone native window linked to Sovereign OS"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Pop Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Notices */}
      {errorMsg && (
        <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-500/40 text-xs text-rose-200 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-300 hover:text-white cursor-pointer">✕</button>
        </div>
      )}
      {notice && (
        <div className="px-4 py-2 bg-emerald-950/80 border-b border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-300 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: REPORT & 3-AGENT AUTO-REPAIR */}
        {activeTab === 'repair' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Report Form + Live Environment Introspection (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-cyan-400" /> Report Glitch to AI Repair Council
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">Lead AI Agent</label>
                    <select value={agent} onChange={(e) => setAgent(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                      {REPAIR_AGENTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">Affected App / Window</label>
                    <select value={targetApp} onChange={(e) => setTargetApp(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                      <option value="desktop">Sovereign Desktop / Shell</option>
                      {APP_REGISTRY.filter(a => !a.hidden).map(a => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">What broke or didn&apos;t do what you intended?</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Clicking Export PNG in Card Forge does nothing, or a link in the browser is dead, or a window froze..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>

                {crashEvent && (
                  <div className="p-2.5 rounded-xl bg-rose-950/35 border border-rose-500/30 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-rose-300 font-bold">
                      <span>Attached Crash Trace ({crashEvent.source})</span>
                      <button type="button" onClick={() => setCrashEvent(null)} className="text-[10px] underline cursor-pointer">Clear</button>
                    </div>
                    <div className="font-mono text-rose-200 truncate">{crashEvent.message}</div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDiagnose}
                  disabled={diagnosing}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  {diagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{diagnosing ? 'Running Cybeni · Aura · Nova Reasoning…' : 'Diagnose & Plan Safe Repair'}</span>
                </button>
              </div>

              {/* Live Environment Introspection Panel */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" /> Live OS Introspection
                  </span>
                  <button
                    type="button"
                    onClick={runProbe}
                    disabled={probing}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${probing ? 'animate-spin' : ''}`} /> Rescan
                  </button>
                </div>

                {snapshot && (
                  <>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase">Health</div>
                        <div className={`text-sm font-black font-mono ${snapshot.healthScore >= 85 ? 'text-emerald-400' : snapshot.healthScore >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {snapshot.healthScore}%
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase">Links/Imgs</div>
                        <div className="text-sm font-bold font-mono text-white">{snapshot.stats.deadLinks + snapshot.stats.brokenImages}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase">Crashes</div>
                        <div className="text-sm font-bold font-mono text-rose-300">{snapshot.stats.crashedBoundaries}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[9px] text-slate-400 uppercase">Bad JSON</div>
                        <div className="text-sm font-bold font-mono text-amber-300">{snapshot.stats.corruptedStorageKeys}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                      {Object.entries(snapshot.engines || {}).map(([name, st]) => (
                        <span
                          key={name}
                          className={`px-2 py-0.5 rounded-full border ${
                            st === 'online'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}
                        >
                          {name}: {st}
                        </span>
                      ))}
                    </div>

                    {snapshot.issues.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {snapshot.issues.map(iss => (
                          <div key={iss.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                            <span className={`font-mono text-[10px] uppercase mr-1.5 ${iss.severity === 'error' ? 'text-rose-400' : 'text-amber-400'}`}>
                              [{iss.kind}]
                            </span>
                            {iss.detail}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-400">All live DOM, storage, and window boundaries healthy.</div>
                    )}
                  </>
                )}

                {/* Recent Flight Log Crashes */}
                {flightLog.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>FLIGHT RECORDER ({flightLog.length} captured)</span>
                      <button type="button" onClick={() => { clearFlightLog(); setFlightLog([]); }} className="hover:text-white cursor-pointer">Clear</button>
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {flightLog.slice(0, 6).map(err => (
                        <button
                          key={err.id}
                          type="button"
                          onClick={() => {
                            setCrashEvent(err);
                            setTargetApp(err.appId || 'desktop');
                            setDescription(`Captured ${err.source}: ${err.message}`);
                          }}
                          className="w-full text-left px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-rose-200 truncate cursor-pointer"
                        >
                          [{err.windowType}] {err.message}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: 3-Agent Reasoning Plan + Apply + Mandatory Human Confirmation Gate (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              {plan ? (
                <>
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">3-Agent Council Root-Cause &amp; Plan</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                        Confidence {Math.round((plan.confidence || 0.7) * 100)}% · {plan.strategy}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30 text-xs text-slate-100 leading-relaxed">
                      <b className="text-cyan-300">Root Cause:</b> {plan.rootCause}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-violet-950/30 border border-violet-500/30 space-y-1">
                        <div className="font-bold text-violet-300">Cybeni (Code)</div>
                        <p className="text-slate-300 leading-snug">{plan.agentReviews?.cybeni}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-pink-950/30 border border-pink-500/30 space-y-1">
                        <div className="font-bold text-pink-300">Aura (Intent &amp; UX)</div>
                        <p className="text-slate-300 leading-snug">{plan.agentReviews?.aura}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                        <div className="font-bold text-emerald-300 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Nova (Security)</div>
                        <p className="text-slate-300 leading-snug">{plan.agentReviews?.nova}</p>
                      </div>
                    </div>

                    {/* Planned Actions */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-300">
                        Planned Safe Runtime Actions ({plan.runtimeActions?.length || 0}) &amp; Source Edits ({plan.codeEdits?.length || 0})
                      </div>
                      {plan.runtimeActions?.map((act, i) => (
                        <div key={i} className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                          <span><b className="text-cyan-400 font-mono text-[10px] mr-1.5">[{act.kind}]</b> {act.title}</span>
                          <span className="text-[10px] text-emerald-400 font-mono">Reversible</span>
                        </div>
                      ))}
                      {plan.rejectedEdits?.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-200">
                          Nova Security Gate blocked {plan.rejectedEdits.length} protected-module edit(s): {plan.rejectedEdits.map(r => r.reason).join(' | ')}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleApplyRuntimeFixes}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" /> Apply Safe Tier-1 Repair &amp; Test
                      </button>
                      {plan.codeEdits?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('source')}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileCode2 className="w-3.5 h-3.5" /> Inspect &amp; Stage {plan.codeEdits.length} Source Patch(es)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* MANDATORY HUMAN-IN-THE-LOOP CONFIRMATION GATE */}
                  <div className={`p-4 rounded-2xl border space-y-3 ${
                    humanStatus === 'confirmed'
                      ? 'bg-emerald-950/30 border-emerald-500/50'
                      : humanStatus === 'awaiting'
                        ? 'bg-amber-950/30 border-amber-500/50'
                        : 'bg-slate-900/70 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Human Verification Gate &amp; Main Distro Report
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 text-amber-300">
                        Status: {humanStatus}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-200">
                      {(plan.humanCheckSteps || []).map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="font-mono text-cyan-400 font-bold">{i + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={humanNotes}
                      onChange={(e) => setHumanNotes(e.target.value)}
                      placeholder="Optional human verification note (e.g. 'Confirmed Export button now works cleanly')..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={dispatchingUpstream}
                        onClick={() => handleHumanConfirm(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{dispatchingUpstream ? 'Encrypting & Sending…' : 'Yes — Confirmed Working & Send Proposal to Founder Distro'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHumanConfirm(false)}
                        className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> No — Roll Back Immediately
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      All upstream reports are automatically scrubbed by Sovereign&apos;s secret redactor and E2E-encrypted over the Sovereign Mesh straight to the Founder profile.
                    </p>
                  </div>
                </>
              ) : (
                <div className="h-full min-h-[420px] p-8 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                  <Wrench className="w-10 h-10 text-cyan-500/60" />
                  <div className="text-sm font-bold text-white">Standalone Attached Self-Repair Ready</div>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    Describe any broken link, stuck button, or crash on the left (or click any entry in the Flight Recorder). <strong>Cybeni, Aura, and Nova</strong> will inspect live OS telemetry, apply reversible hotfixes or gated source patches, ask you to verify the result, and suggest permanent fixes back to the main Sovereign distro.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: OPT-IN SOURCE PATCHING, AUTOMATED TEST GATE & INSTALLER REBUILD */}
        {activeTab === 'source' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-violet-400" />
                    <span>Opt-In Source-Attached Auto-Patch &amp; Installer Gate (Developer / Founder Mode)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Path-jailed to <code>src/</code>, <code>tests/</code>, and <code>public/</code>. Protected security modules (Sentinel, Auth, Enclave, Aunlock, Cloud egress) are hard-blocked in Rust. Every patch snapshots originals first and auto-rolls back if <code>oxlint</code> or <code>npm test</code> fails.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Local Sovereign Repository Root</label>
                  <input
                    type="text"
                    value={repoRoot}
                    onChange={(e) => {
                      setRepoRoot(e.target.value);
                      try { localStorage.setItem(REPO_ROOT_KEY, e.target.value); } catch {}
                    }}
                    placeholder="Z:\Novaura platform\novaura OS soveriegn"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Target Relative Source File (src/...)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sourceFilePath}
                      onChange={(e) => setSourceFilePath(e.target.value)}
                      placeholder="src/components/windows/CardForgeWindow.jsx"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleReadSource}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold cursor-pointer"
                    >
                      Load File
                    </button>
                  </div>
                </div>
              </div>

              {sourceContent && (
                <div className="text-[11px] font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 px-3 py-2 rounded-lg">
                  Loaded {sourceFilePath} ({sourceContent.split('\n').length} lines) — switch to Report &amp; Auto-Repair and click Diagnose to generate surgical code edits for this file.
                </div>
              )}
            </div>

            {/* Staged Diff Preview & Hard Verification Gate */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Staged Code Patch ({plan?.codeEdits?.length || 0} edit(s))</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={verifyBuildToo} onChange={(e) => setVerifyBuildToo(e.target.checked)} className="accent-violet-500" />
                  Include full <code>vite build</code> in gate
                </label>
              </div>

              {plan?.codeEdits?.length ? (
                <div className="space-y-2">
                  {plan.codeEdits.map((e, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] font-mono">
                      <div className="text-cyan-300 font-bold">{e.relPath} — {e.rationale}</div>
                      <pre className="text-rose-300 bg-rose-950/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">- {e.target}</pre>
                      <pre className="text-emerald-300 bg-emerald-950/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">+ {e.replacement}</pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400">No source edits staged yet.</div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={stagingSource || !plan?.codeEdits?.length}
                  onClick={handleStageAndVerifySourcePatch}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {stagingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                  <span>{stagingSource ? stageStatus || 'Verifying…' : 'Snapshot, Apply Patch & Run Hard Verification Gate'}</span>
                </button>

                {sourceResult?.snapshotId && !sourceResult.autoRolledBack && (
                  <button
                    type="button"
                    onClick={() => handleHumanConfirm(false)}
                    className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Roll Back Snapshot ({sourceResult.snapshotId})
                  </button>
                )}

                <button
                  type="button"
                  disabled={rebuildingInstaller || humanStatus !== 'confirmed' || !repoRoot.trim()}
                  onClick={handleRebuildInstaller}
                  title={humanStatus !== 'confirmed' ? 'Human confirmation required before rebuilding installer' : 'Rebuild Tauri desktop installer'}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {rebuildingInstaller ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}
                  <span>{rebuildingInstaller ? 'Building Installer…' : 'Rebuild Desktop Installer (Post-Confirm)'}</span>
                </button>
              </div>

              {sourceResult?.verification && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {sourceResult.verification.steps.map(st => (
                    <div key={st.step} className={`p-2.5 rounded-lg border text-xs font-mono ${st.ok ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/30 border-rose-500/40 text-rose-200'}`}>
                      <div>{st.ok ? '✓' : '✗'} {st.step} (exit {st.exit_code}, {st.duration_ms}ms)</div>
                      {!st.ok && (st.stderr || st.stdout) && (
                        <pre className="mt-1 text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto">{st.stderr || st.stdout}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ACTIVE TIER-1 RUNTIME HOTFIXES & AUDIT HISTORY */}
        {activeTab === 'hotfixes' && (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Reversible Runtime Hotfixes ({hotfixes.length})</h3>
              {hotfixes.length === 0 ? (
                <p className="text-xs text-slate-400">No runtime hotfixes applied yet.</p>
              ) : (
                <div className="space-y-2">
                  {hotfixes.map(h => (
                    <div key={h.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{h.title}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {h.kind} · {h.targetApp} · {h.enabled ? 'ACTIVE' : 'ROLLED BACK'}
                        </div>
                      </div>
                      {h.enabled && (
                        <button
                          type="button"
                          onClick={async () => {
                            await rollbackRuntimeHotfix(h.id);
                            refreshHistory();
                            flashNotice(`Rolled back hotfix "${h.title}".`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" /> Roll Back
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Manual Quick Hotfix Builder */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Manual Reversible Hotfix</div>
                <select value={manualKind} onChange={(e) => setManualKind(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
                  <option value="link_redirect">Fix Broken Link (Safe Redirect)</option>
                  <option value="css_hotfix">Fix UI Layout Overlap (Scoped CSS)</option>
                </select>
                {manualKind === 'link_redirect' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={manualFrom} onChange={(e) => setManualFrom(e.target.value)} placeholder="Broken href substring..." className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                    <input value={manualTo} onChange={(e) => setManualTo(e.target.value)} placeholder="https://... or nova://..." className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                  </div>
                ) : (
                  <textarea rows={2} value={manualCss} onChange={(e) => setManualCss(e.target.value)} placeholder=".broken-selector { overflow: auto; }" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono" />
                )}
                <button type="button" onClick={handleCreateManualHotfix} className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer">
                  Apply Hotfix
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Repair Session Audit Log ({sessions.length})</h3>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {sessions.map(s => (
                  <div key={s.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{s.targetRef} · {s.agent}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">{s.status}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2">{s.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FOUNDER UPSTREAM DISTRO TRIAGE INBOX */}
        {activeTab === 'founder' && (
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-cyan-400" />
                  <span>Encrypted Main-Distro Repair Proposals (Founder Triage Inbox)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Confirmed user fixes &amp; root-cause proposals arrive E2E-encrypted over the Sovereign Mesh to your founder key (`FEEDBACK_INBOX_PUBKEY`) with zero secrets leaked.
                </p>
              </div>
              <button type="button" onClick={refreshHistory} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white flex items-center gap-1 cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {proposals.length === 0 ? (
              <div className="p-10 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                No upstream repair proposals yet. Confirm a repair in Tab 1 to encrypt &amp; dispatch a proposal to the Founder profile.
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map(p => (
                  <div key={p.id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{p.title}</span>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">{p.direction}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">{p.status}</span>
                      </div>
                    </div>
                    <pre className="text-[11px] text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                      {p.summary}
                    </pre>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetApp(p.targetApp || 'desktop');
                          setDescription(p.title);
                          if (p.codeEdits?.length) {
                            setPlan(prev => ({ ...(prev || {}), rootCause: p.title, codeEdits: p.codeEdits }));
                          }
                          setActiveTab('source');
                          flashNotice('Loaded proposal into Source Patch & Build tab for main-distro integration.');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Load into Source Auto-Patch Pipeline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

