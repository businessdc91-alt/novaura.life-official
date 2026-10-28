import React, { useState, useEffect } from 'react';
import {
  Settings, Key, Cpu, HardDrive, ShieldCheck, Download, Upload,
  RefreshCw, Check, Sparkles, Database, Palette, AlertCircle,
  Gauge, Network, Lock, Layers, Zap, CheckCircle2, AlertTriangle, Server,
  Bug, LifeBuoy, ClipboardCopy, RotateCcw, FileText, Send, MessageSquare
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { db, exportDatabaseBackup, importDatabaseBackup, resetDatabaseToFactory } from '../../database/sovereignDatabase.js';
import { getNativeSystemInfo, probeLocalAi } from '../../services/nativeService.js';
import { submitBetaFeedback, syncPendingFeedback, countPendingFeedback } from '../../services/betaFeedbackService.js';
import { evaluateHostHardware, HARDWARE_TIERS } from '../../services/hardwareSpecService.js';
import { interAppSecurityBroker } from '../../kernel/InterAppSecurityBroker.js';

export default function SettingsDiagnosticsWindow({ defaultTab = 'specs' }) {
  const { kernel } = useKernel();
  const [activeTab, setActiveTab] = useState(defaultTab); // 'specs' | 'ai' | 'diagnostics' | 'backup' | 'beta'

  // Sync tab with external events or props
  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
    const handleTabSwitch = (e) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('novaura:open_settings_tab', handleTabSwitch);
    return () => window.removeEventListener('novaura:open_settings_tab', handleTabSwitch);
  }, [defaultTab]);

  // Auto-probe local AI engines when switching to beta or ai tabs
  useEffect(() => {
    if (activeTab === 'beta' || activeTab === 'ai') {
      probeAiEngines();
    }
  }, [activeTab]);

  // AI & Vault Keys
  const [vaultKeys, setVaultKeys] = useState({
    gemini: '',
    vertex: '',
    openrouter: '',
    claude: '',
    openai: '',
  });
  const [savedKeyNotice, setSavedKeyNotice] = useState('');
  const [localStatus, setLocalStatus] = useState(null);
  const [probingLocal, setProbingLocal] = useState(false);

  // Database stats & Native System Telemetry
  const [dbStats, setDbStats] = useState({});
  const [nativeSys, setNativeSys] = useState(null);
  const [hardwareAudit, setHardwareAudit] = useState(null);
  const [securityTelemetry, setSecurityTelemetry] = useState(null);
  const [loadingHardware, setLoadingHardware] = useState(true);

  // Beta Feedback & Testing State
  const [betaForm, setBetaForm] = useState({
    title: '',
    category: 'ui',
    severity: 'moderate',
    description: '',
  });
  const [betaSubmitted, setBetaSubmitted] = useState(false);
  // null | { kind: 'sent' | 'queued' | 'error', text: string }
  const [betaStatus, setBetaStatus] = useState(null);
  const [betaPending, setBetaPending] = useState(0);
  const [betaSending, setBetaSending] = useState(false);

  // Retry any reports that failed to send earlier.
  useEffect(() => {
    let active = true;
    syncPendingFeedback()
      .catch(() => null)
      .finally(async () => {
        const pending = await countPendingFeedback();
        if (active) setBetaPending(pending);
      });
    return () => { active = false; };
  }, []);
  const [betaCopied, setBetaCopied] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [inferenceProbe, setInferenceProbe] = useState({
    lmStudio: { online: false, latency: null, model: null },
    ollama: { online: false, latency: null, model: null },
    probing: false,
  });

  useEffect(() => {
    loadKeys();
    loadDbStats();
    loadNativeInfo();
    loadHardwareTelemetry();
    probeAiEngines();
    if (kernel?.localModel) {
      setLocalStatus(kernel.localModel.getStatus());
    }
  }, [kernel]);

  const loadHardwareTelemetry = async () => {
    setLoadingHardware(true);
    try {
      const evalResult = await evaluateHostHardware();
      setHardwareAudit(evalResult);
      setSecurityTelemetry(interAppSecurityBroker.getSecurityTelemetry());
    } catch (e) {
      console.warn('[Settings] Hardware evaluation note:', e);
    } finally {
      setLoadingHardware(false);
    }
  };

  const loadNativeInfo = async () => {
    try {
      const info = await getNativeSystemInfo();
      setNativeSys(info);
    } catch (e) {
      console.warn(e);
    }
  };


  const loadKeys = async () => {
    try {
      const records = await db.vault.toArray();
      const loaded = {};
      records.forEach(r => {
        if (r.key) loaded[r.key.toLowerCase()] = r.value || '';
      });
      setVaultKeys(prev => ({ ...prev, ...loaded }));
    } catch (err) {
      console.error(err);
    }
  };

  const loadDbStats = async () => {
    try {
      const docsCount = await db.documents.count();
      const vaultCount = await db.vault.count();
      const chatCount = await db.chat_history.count();
      const mailCount = await db.mailbox.count();
      const postCount = await db.social_posts.count();
      const deckCount = await db.card_decks.count();
      const auditCount = await db.sentinel_audit.count();

      setDbStats({
        documents: docsCount,
        vault: vaultCount,
        chat_history: chatCount,
        mailbox: mailCount,
        social_posts: postCount,
        card_decks: deckCount,
        sentinel_audit: auditCount,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveKey = async (provider) => {
    const val = vaultKeys[provider];
    await db.vault.put({
      key: provider.toLowerCase(),
      value: val,
      category: 'api_key',
      updated_at: new Date().toISOString(),
    });
    kernel?.ipc.emit('vault:keys_updated');
    setSavedKeyNotice(`Saved ${provider.toUpperCase()} key securely.`);
    setTimeout(() => setSavedKeyNotice(''), 3000);
  };

  const handleProbeLocalAI = async () => {
    setProbingLocal(true);
    try {
      const status = await kernel?.localModel?.probeAll();
      const ol = await probeLocalAi(11434, '/api/tags');
      if (ol && ol.online) {
        setLocalStatus(prev => ({
          ...(prev || {}),
          backend: 'ollama',
          isReady: true,
          models: (ol.models && ol.models.length > 0)
            ? ol.models.map(m => ({ id: m, name: m, backend: 'ollama' }))
            : (prev?.models || [{ id: 'gemma4:12b', name: 'gemma4:12b', backend: 'ollama' }]),
          selectedModel: ol.model || ol.models?.[0] || 'gemma4:12b',
          ...status,
        }));
      } else {
        setLocalStatus(status);
      }
      await probeAiEngines();
    } catch (err) {
      console.error(err);
    } finally {
      setProbingLocal(false);
    }
  };

  const handleExportBackup = async () => {
    const jsonStr = await exportDatabaseBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sovereign_db_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importDatabaseBackup(text);
      alert('Database restored successfully! Refreshing telemetry...');
      loadDbStats();
      loadKeys();
    } catch (err) {
      alert('Restore failed: ' + err.message);
    }
  };

  const probeAiEngines = async () => {
    setInferenceProbe(prev => ({ ...prev, probing: true }));
    try {
      const lm = await probeLocalAi(1234, '/v1/models');
      const ol = await probeLocalAi(11434, '/api/tags');

      const newProbe = {
        lmStudio: {
          online: Boolean(lm.online),
          latency: lm.latency_ms,
          model: lm.model || (lm.online ? (lm.models?.[0] || 'LM Studio active') : null),
        },
        ollama: {
          online: Boolean(ol.online),
          latency: ol.latency_ms,
          model: ol.model || (ol.online ? (ol.models?.[0] || 'Ollama active') : null),
        },
        probing: false,
      };

      setInferenceProbe(newProbe);

      if (ol.online) {
        setLocalStatus(prev => ({
          ...(prev || {}),
          backend: 'ollama',
          isReady: true,
          models: (ol.models && ol.models.length > 0)
            ? ol.models.map(m => ({ id: m, name: m, backend: 'ollama' }))
            : (prev?.models || [{ id: 'gemma4:12b', name: 'gemma4:12b', backend: 'ollama' }]),
          selectedModel: ol.model || ol.models?.[0] || prev?.selectedModel || 'gemma4:12b',
        }));
      }
    } catch (err) {
      console.warn('[Settings] probeAiEngines error:', err);
      setInferenceProbe(prev => ({ ...prev, probing: false }));
    }
  };

  const handleExportDiagnosticBundle = async () => {
    try {
      const windowsSnapshot = kernel?.wm?.getAll?.()?.map(w => ({
        id: w.id,
        type: w.type || w.appType,
        title: w.title,
        state: w.state,
      })) || [];

      const crashLogs = kernel?.crash?.getLog?.(50) || [];
      const auditLogs = await db.sentinel_audit.limit(50).reverse().toArray().catch(() => []);

      const bundle = {
        app: 'NovAura Sovereign OS',
        version: '1.0.0-BETA',
        exportedAt: new Date().toISOString(),
        hostSystem: nativeSys || { os: 'windows', arch: 'x86_64' },
        hardwareAudit: hardwareAudit || null,
        inferenceEndpoints: inferenceProbe,
        privateCloudDatabase: {
          stats: dbStats,
          tableNames: db.tables.map(t => t.name),
        },
        desktopState: {
          activeTheme: localStorage.getItem('novaura-theme') || 'cosmic',
          openWindowsCount: windowsSnapshot.length,
          windows: windowsSnapshot,
        },
        recentErrorsAndIntercepts: crashLogs.length > 0 ? crashLogs : auditLogs,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novaura-beta-diagnostics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate diagnostic bundle: ' + err.message);
    }
  };

  const handleCopyBugReportMarkdown = () => {
    const md = `### NovAura Sovereign OS — Beta v1.0 Bug Report
**Title:** ${betaForm.title || 'Untitled issue'}
**Category:** ${betaForm.category}
**Severity:** ${betaForm.severity}

**Description & Steps to Reproduce:**
${betaForm.description || 'No steps provided.'}

---
### Environment & Telemetry Snapshot
- **OS Platform:** ${nativeSys?.os || navigator.platform} (${nativeSys?.arch || 'x86_64'})
- **User Agent:** ${navigator.userAgent}
- **CPU Logical Cores:** ${navigator.hardwareConcurrency || 'N/A'}
- **LM Studio (:1234):** ${inferenceProbe.lmStudio.online ? `Online (${inferenceProbe.lmStudio.latency}ms, ${inferenceProbe.lmStudio.model})` : 'Offline'}
- **Ollama (:11434):** ${inferenceProbe.ollama.online ? `Online (${inferenceProbe.ollama.latency}ms, ${inferenceProbe.ollama.model})` : 'Offline'}
- **Database Tables:** ${Object.entries(dbStats).map(([k, v]) => `${k}: ${v}`).join(', ')}
- **Timestamp:** ${new Date().toISOString()}
`;
    navigator.clipboard.writeText(md);
    setBetaCopied(true);
    setTimeout(() => setBetaCopied(false), 3000);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!betaForm.title.trim() || betaSending) return;
    setBetaSending(true);
    try {
      const result = await submitBetaFeedback({
        title: betaForm.title,
        description: betaForm.description,
        category: betaForm.category,
        severity: betaForm.severity,
        systemInfo: {
          os: nativeSys?.os || 'windows',
          arch: nativeSys?.arch,
          cpu: navigator.hardwareConcurrency,
          userAgent: navigator.userAgent,
        },
      });
      setBetaStatus(result.sent
        ? { kind: 'sent', text: 'Report sent to the NovAura team. Thank you!' }
        : { kind: 'queued', text: `Saved locally. It will send automatically when you're back online (${result.error}).` });
      setBetaSubmitted(true);
      setTimeout(() => setBetaSubmitted(false), 6000);
      setBetaForm({ title: '', category: 'ui', severity: 'moderate', description: '' });
      setBetaPending(await countPendingFeedback());
    } catch (err) {
      setBetaStatus({ kind: 'error', text: 'Failed to record feedback: ' + (err?.message || 'unknown error') });
      setBetaSubmitted(true);
      setTimeout(() => setBetaSubmitted(false), 6000);
    } finally {
      setBetaSending(false);
    }
  };

  const handleRetryPendingFeedback = async () => {
    setBetaSending(true);
    try {
      const { sent, pending } = await syncPendingFeedback();
      setBetaPending(pending);
      setBetaStatus(pending === 0
        ? { kind: 'sent', text: `Sent ${sent} queued report${sent === 1 ? '' : 's'}.` }
        : { kind: 'queued', text: `${pending} report${pending === 1 ? '' : 's'} still waiting for a connection.` });
      setBetaSubmitted(true);
      setTimeout(() => setBetaSubmitted(false), 6000);
    } finally {
      setBetaSending(false);
    }
  };

  const handleFactoryReset = async () => {
    if (!confirm('CAUTION: This will purge all private cloud database records, clear credentials, and reset NovAura OS to factory default state. Are you sure?')) {
      return;
    }
    setIsResetting(true);
    try {
      await resetDatabaseToFactory();
      window.location.reload();
    } catch (err) {
      alert('Factory reset failed: ' + err.message);
      setIsResetting(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-52 bg-slate-900/60 border-r border-slate-800 p-3 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-2 py-2 text-cyan-400 font-semibold text-sm mb-4">
          <Settings className="w-5 h-5" />
          <span>System Settings</span>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('specs')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'specs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>Specs & Node Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'ai'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4 text-cyan-400" />
            <span>AI Keys & Models</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'diagnostics'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>Diagnostics & DB</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'backup'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>Vault Backup</span>
          </button>

          <button
            onClick={() => setActiveTab('beta')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'beta'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bug className="w-4 h-4 text-cyan-400" />
              <span>Beta & Diagnostics</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40">
              v1.0
            </span>
          </button>
        </nav>

        <div className="mt-auto p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Cloud Privacy</span>
          </div>
          <span>All keys and database entries remain on your local storage.</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'specs' && (
          <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Hardware Specifications & Node Profile</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                    DECENTRALIZED SELF-HOSTED
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Since each user self-hosts their private cloud database, local models, and server node, review minimum vs recommended hardware specs and verified inter-app zero-leakage security.
                </p>
              </div>
              <button
                onClick={loadHardwareTelemetry}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHardware ? 'animate-spin' : ''}`} />
                <span>Re-Audit Host</span>
              </button>
            </div>

            {/* Live Detected Host Telemetry Banner */}
            {hardwareAudit && (
              <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Detected Host Configuration</span>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border"
                    style={{
                      backgroundColor: `${hardwareAudit.activeTier.color}20`,
                      borderColor: `${hardwareAudit.activeTier.color}50`,
                      color: hardwareAudit.activeTier.color,
                    }}
                  >
                    {hardwareAudit.activeTier.badge}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Processor (CPU)</span>
                    <span className="font-bold text-slate-200 mt-0.5 block truncate" title={hardwareAudit.detected.cpuName}>
                      {hardwareAudit.detected.cpuName.replace(/CPU\s*@.*$/, '').trim()}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {hardwareAudit.detected.physicalCores ? `${hardwareAudit.detected.physicalCores}C / ` : ''}{hardwareAudit.detected.logicalCores} Threads
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Physical System RAM</span>
                    <span className="font-bold text-slate-200 mt-0.5 block">{hardwareAudit.detected.ramGB} GB RAM</span>
                    <span className="text-[10px] text-cyan-400 font-mono">High-Capacity Topology</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Primary Neural Accelerator</span>
                    <span className="font-bold text-slate-200 mt-0.5 block truncate" title={hardwareAudit.detected.gpuInfo.renderer}>
                      {hardwareAudit.detected.gpuInfo.renderer}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {hardwareAudit.detected.gpuInfo.estimatedVramGB} GB Dedicated VRAM
                      {hardwareAudit.detected.gpus?.length > 1 ? ` (+${hardwareAudit.detected.gpus.length - 1} secondary GPU)` : ''}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Local Storage Quota</span>
                    <span className="font-bold text-slate-200 mt-0.5 block">{hardwareAudit.detected.storageEst.quotaGB} GB Available</span>
                    <span className="text-[10px] text-purple-400 font-mono">{hardwareAudit.detected.physicalDrivesCount} Storage Mounts</span>
                  </div>
                </div>

                {/* Multi-GPU Topology Details if more than 1 GPU installed */}
                {hardwareAudit.detected.gpus?.length > 1 && (
                  <div className="p-2.5 bg-slate-950/90 rounded-lg border border-slate-800/80 text-[11px] space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block flex items-center justify-between">
                      <span>Detected Multi-GPU Array</span>
                      <span className="text-emerald-400 font-mono font-bold">{hardwareAudit.detected.totalVramGB} GB Total VRAM Combined</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                      {hardwareAudit.detected.gpus.map((gpu, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-slate-800">
                          <span className="font-mono text-slate-200 truncate max-w-[200px]" title={gpu.name}>{gpu.name}</span>
                          <span className="text-cyan-300 font-bold font-mono text-[10px] shrink-0 pl-2">{gpu.vram_gb} GB VRAM</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workload Recommendations */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300 block">Host Performance Tuning Advice:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {hardwareAudit.recommendations.map((rec, i) => (
                      <div key={i} className="p-2 bg-slate-950/60 rounded border border-slate-800/60 text-[11px] flex items-start gap-2">
                        {rec.type === 'optimal' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : rec.type === 'warning' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-semibold text-slate-200">{rec.subsystem}: </span>
                          <span className="text-slate-400">{rec.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Hardware Tier Comparison Matrix */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Hardware Specification Tiers Matrix</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.values(HARDWARE_TIERS).map((tier) => {
                  const isCurrent = hardwareAudit?.tierScore === tier.id;
                  return (
                    <div
                      key={tier.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        isCurrent
                          ? 'bg-slate-900 border-cyan-500/50 ring-1 ring-cyan-500/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-100">{tier.name}</span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                              YOUR MATCH
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mb-3">{tier.targetWorkload}</p>

                        <div className="space-y-2 text-xs">
                          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 block uppercase font-medium">Processor (CPU)</span>
                            <span className="font-semibold text-slate-200">{tier.cpu.cores} Cores / {tier.cpu.threads} Threads</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{tier.cpu.recommended}</span>
                          </div>

                          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 block uppercase font-medium">RAM Memory</span>
                            <span className="font-semibold text-slate-200">{tier.ram.capacityGB} GB RAM</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{tier.ram.description}</span>
                          </div>

                          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 block uppercase font-medium">Graphics (GPU & VRAM)</span>
                            <span className="font-semibold text-slate-200">{tier.gpu.vramGB} GB+ VRAM</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{tier.gpu.models}</span>
                          </div>

                          <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                            <span className="text-[10px] text-slate-500 block uppercase font-medium">Storage Requirement</span>
                            <span className="font-semibold text-slate-200">{tier.storage.freeSpaceGB} GB Free ({tier.storage.type})</span>
                          </div>

                          <div className="p-2 bg-slate-950/40 rounded border border-slate-800/60">
                            <span className="text-[10px] text-slate-500 block uppercase font-medium mb-1">Supported AI Workloads</span>
                            <ul className="space-y-0.5 text-[10px] text-slate-300">
                              {tier.aiWorkloadSupport.map((w, idx) => (
                                <li key={idx} className="flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                                  <span>{w}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>ComfyUI Launch:</span>
                        <code className="text-cyan-300 font-mono text-[9px] bg-slate-950 px-1 py-0.5 rounded border border-slate-800">{tier.comfyRecommendedFlags}</code>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inter-App Privacy & Zero-Leakage Architecture */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                      Inter-App Privacy & Zero-Leakage Guard
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Decentralized capability sandboxing prevents unauthorized cross-namespace data access between apps.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  ARMED & VERIFIED
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Inspected Messages</span>
                  <span className="text-xl font-bold text-cyan-300 mt-1 block">
                    {securityTelemetry?.stats.inspectedMessages || 0}
                  </span>
                  <span className="text-[10px] text-slate-400">Zero-leak sanitization</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Blocked Leak Attempts</span>
                  <span className="text-xl font-bold text-emerald-400 mt-1 block">
                    {securityTelemetry?.stats.blockedLeakAttempts || 0}
                  </span>
                  <span className="text-[10px] text-emerald-400/80">Cross-domain violations intercepted</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Active App Envelopes</span>
                  <span className="text-xl font-bold text-purple-400 mt-1 block">
                    {securityTelemetry?.stats.activeSandboxes || 13}
                  </span>
                  <span className="text-[10px] text-slate-400">Capability isolation active</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-xs space-y-1.5 text-emerald-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Decentralized Node Attestation</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your PC functions as an independent sovereign server and decentralized peer. All documents, private keys, card decks, and chats persist exclusively in your on-device Dexie database. Vault credentials and private keys are cryptographically scrubbed from generic inter-app payloads to prevent leakage across processes.
                </p>
              </div>
            </div>

            {/* Subscription Freedom Matrix: 12 SaaS Subscriptions Replaced */}
            <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">💎</span>
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                      Single-Time Purchase — Cloud Subscription Escape Hatch
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Novaura Sovereign is not a SaaS subscription. You buy it once and own your compute forever—liberating your workflow from recurring cloud fees.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Estimated Annual Savings</span>
                  <span className="text-base font-extrabold text-emerald-400 font-mono">+$3,456 / year</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {[
                  { saas: 'ChatGPT Plus / Claude Pro', cost: '$240/yr', app: 'Neural Hypervisor', note: 'Ollama & LM Studio local LLMs' },
                  { saas: 'Midjourney / Firefly', cost: '$360/yr', app: 'Media Foundry', note: 'Flux.1 Schnell & SDXL Turbo' },
                  { saas: 'Runway / Sora / Luma', cost: '$420/yr', app: 'ComfyUI Video Forge', note: 'Wan 2.1 Video 1.3B Diffusion' },
                  { saas: 'Microsoft 365 / Word', cost: '$100/yr', app: 'Literature IDE', note: 'WYSIWYG & Monaco Word Studio' },
                  { saas: 'Scrivener / NovelCrafter', cost: '$240/yr', app: 'Ghostwriter Studio', note: 'AI Co-Author & Persistent RAG' },
                  { saas: 'Canva Pro / Adobe Spark', cost: '$120/yr', app: 'Card Forge & 3D Card', note: 'Decentralized Deck Architect' },
                  { saas: 'Resume.io / Zety ATS', cost: '$300/yr', app: 'ATS Resume Builder', note: 'Executive career design suite' },
                  { saas: 'Wix / Squarespace / Webflow', cost: '$300/yr', app: 'Cybeni Omni Builder', note: 'Visual website architecture' },
                  { saas: 'Dropbox / Google Drive 2TB', cost: '$120/yr', app: 'On-Device Private DB', note: 'Dexie IndexedDB + Local Mounts' },
                  { saas: 'ProtonMail / Fastmail', cost: '$96/yr', app: 'NovaMail P2P', note: 'Encrypted mesh mailbox' },
                  { saas: 'Otter.ai / Descript', cost: '$300/yr', app: 'Whisper Large Turbo', note: 'Local speech-to-text transcription' },
                  { saas: 'Acronis / Drive Partition Pro', cost: '$60/yr', app: 'NovADrive Architect', note: 'AI Disk telemetry & UEFI boot' },
                ].map((item, idx) => (
                  <div key={idx} className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200 text-[11px]">{item.app}</span>
                        <span className="text-[10px] text-slate-500">replaces</span>
                        <span className="text-[11px] text-amber-300 line-through">{item.saas}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">{item.note}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 font-mono pl-2 shrink-0">{item.cost}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (

          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-100 mb-1">Local & Cloud AI Inference</h2>
              <p className="text-xs text-slate-400">
                Configure your local AI runners (Ollama / LM Studio) or provide your own API keys (BYOK) for cloud intelligence.
              </p>
            </div>

            {savedKeyNotice && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{savedKeyNotice}</span>
              </div>
            )}

            {/* Local Model Status */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200">Local AI Server (Ollama / LM Studio)</span>
                </div>
                <button
                  onClick={handleProbeLocalAI}
                  disabled={probingLocal}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-xs transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${probingLocal ? 'animate-spin' : ''}`} />
                  <span>Probe Local Models</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Active Backend</span>
                  <span className="font-semibold text-cyan-300 capitalize">{localStatus?.backend || 'Checking...'}</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Status</span>
                  <span className={`font-semibold ${localStatus?.isReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {localStatus?.isReady ? 'Ready & Available' : 'Offline / Standby'}
                  </span>
                </div>
              </div>

              {localStatus?.models?.length > 0 && (
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Detected Local Models:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {localStatus.models.map(m => (
                      <span key={m.id} className="text-[11px] px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">
                        {m.name} ({m.backend})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* BYOK Cloud Keys */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-slate-200">Bring Your Own Key (BYOK) Vault</span>
              </div>

              {['gemini', 'openrouter', 'claude', 'openai'].map(provider => (
                <div key={provider} className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-medium">{provider} API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder={`Enter your ${provider} API key...`}
                      value={vaultKeys[provider] || ''}
                      onChange={(e) => setVaultKeys({ ...vaultKeys, [provider]: e.target.value })}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      onClick={() => handleSaveKey(provider)}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-100 mb-1">Diagnostics & Telemetry</h2>
              <p className="text-xs text-slate-400">
                Live statistics from your Sovereign on-device database and kernel memory map.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(dbStats).map(([table, count]) => (
                <div key={table} className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">{table}</span>
                  <span className="text-xl font-bold text-cyan-300 mt-1 block">{count}</span>
                  <span className="text-[10px] text-slate-400">records stored</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-xs font-semibold text-slate-200">Subsystem Diagnostics</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Kernel Boot State</span>
                  <span className="text-emerald-400 font-mono">{kernel?.bootPhase || 'ready'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Sentinel Shield Status</span>
                  <span className="text-emerald-400 font-mono">Armed (Local Governance)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Crash Guard</span>
                  <span className="text-emerald-400 font-mono">Zero-Loss Failover Active</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>Operator Identity</span>
                  <span className="text-cyan-300 font-mono">{kernel?.auth?.currentUser?.name || 'Local Sovereign'}</span>
                </div>
                {nativeSys && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                      <span>Native Host Machine</span>
                      <span className="text-slate-200 font-mono">{nativeSys.hostname} ({nativeSys.os} {nativeSys.arch})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                      <span>Physical Vault Path</span>
                      <span className="text-amber-400 font-mono text-[10px] truncate max-w-[280px]">{nativeSys.sovereign_root}</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-400">
                      <span>Air-Gap Security Posture</span>
                      <span className="text-emerald-400 font-mono">{nativeSys.status}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-100 mb-1">Local Database Backup & Restore</h2>
              <p className="text-xs text-slate-400">
                Export your full private database (files, chat history, mail, social feed, and saved API keys) as a single portable JSON file. The backup is not encrypted and contains your API keys and node identity, so store it somewhere private.
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Export Snapshot</h4>
                  <p className="text-[11px] text-slate-400">Save a complete local backup of all Sovereign OS data.</p>
                </div>
                <button
                  onClick={handleExportBackup}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Database</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Restore Snapshot</h4>
                  <p className="text-[11px] text-slate-400">Restore a previously saved database backup file.</p>
                </div>
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium cursor-pointer transition-colors border border-slate-700">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Backup</span>
                  <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'beta' && (
          <div className="max-w-4xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-cyan-400" />
                  <span>Beta Testing & Diagnostic Command Deck</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                    v1.0 BETA
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time host telemetry, local AI port latency meters, 1-click diagnostic bundles, and state hygiene tools for external beta testers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={probeAiEngines}
                  disabled={inferenceProbe.probing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${inferenceProbe.probing ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>Probe Local AI Ports</span>
                </button>
              </div>
            </div>

            {/* 3 Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Export Bundle */}
              <div className="p-3.5 bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-xl flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs mb-1">
                    <Download className="w-4 h-4" />
                    <span>Diagnostic Bundle</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Downloads an anonymized JSON snapshot containing OS specs, port latencies, Dexie table counts, and recent error traces.
                  </p>
                </div>
                <button
                  onClick={handleExportDiagnosticBundle}
                  className="mt-3 w-full py-1.5 px-2.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .json Bundle</span>
                </button>
              </div>

              {/* Copy Markdown Bug Report */}
              <div className="p-3.5 bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-xl flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1">
                    <ClipboardCopy className="w-4 h-4" />
                    <span>Copy Bug Markdown</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Generates a pre-formatted GitHub/Discord bug report with your current system telemetry and form notes ready to paste.
                  </p>
                </div>
                <button
                  onClick={handleCopyBugReportMarkdown}
                  className="mt-3 w-full py-1.5 px-2.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {betaCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                  <span>{betaCopied ? 'Copied to Clipboard!' : 'Copy Formatted Markdown'}</span>
                </button>
              </div>

              {/* Factory Reset */}
              <div className="p-3.5 bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 rounded-xl flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs mb-1">
                    <RotateCcw className="w-4 h-4" />
                    <span>Factory State Reset</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Purges private cloud storage and reboots the OS so you can re-test the fresh onboarding odyssey from scratch.
                  </p>
                </div>
                <button
                  onClick={handleFactoryReset}
                  disabled={isResetting}
                  className="mt-3 w-full py-1.5 px-2.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'Resetting OS...' : 'Reset to Factory Defaults'}</span>
                </button>
              </div>
            </div>

            {/* Neural Inference Port Telemetry */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Neural Inference Port Connectivity</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Ollama (:11434) &bull; LM Studio (:1234)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* LM Studio */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${inferenceProbe.lmStudio.online ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
                      <span>LM Studio</span>
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      inferenceProbe.lmStudio.online 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {inferenceProbe.lmStudio.online ? `${inferenceProbe.lmStudio.latency}ms LATENCY` : 'OFFLINE (:1234)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Model: <span className="text-slate-200 font-mono">{inferenceProbe.lmStudio.model || 'No model loaded or port not active'}</span>
                  </div>
                </div>

                {/* Ollama */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${inferenceProbe.ollama.online ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
                      <span>Ollama</span>
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      inferenceProbe.ollama.online 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {inferenceProbe.ollama.online ? `${inferenceProbe.ollama.latency}ms LATENCY` : 'OFFLINE (:11434)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Model: <span className="text-slate-200 font-mono">{inferenceProbe.ollama.model || 'No model loaded or port not active'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bug & Feedback Submission Form */}
            <form onSubmit={handleSubmitFeedback} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span>In-App Beta Feedback & Bug Logging</span>
                </span>
                {betaSubmitted && betaStatus && (
                  <span className={`text-xs font-medium flex items-center gap-1 ${
                    betaStatus.kind === 'sent' ? 'text-emerald-400' : betaStatus.kind === 'queued' ? 'text-amber-300' : 'text-red-400'
                  }`}>
                    <Check className="w-3.5 h-3.5" />
                    <span>{betaStatus.text}</span>
                  </span>
                )}
                {!betaSubmitted && betaPending > 0 && (
                  <button
                    type="button"
                    onClick={handleRetryPendingFeedback}
                    disabled={betaSending}
                    className="text-[11px] text-amber-300 hover:text-amber-200 underline disabled:opacity-50"
                  >
                    {betaPending} unsent report{betaPending === 1 ? '' : 's'} · retry now
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Issue / Feedback Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Window resize flicker, Audio latency on PiP..."
                    value={betaForm.title}
                    onChange={(e) => setBetaForm({ ...betaForm, title: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Category</label>
                    <select
                      value={betaForm.category}
                      onChange={(e) => setBetaForm({ ...betaForm, category: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ui">UI & Window Manager</option>
                      <option value="ai">Local AI & Dual Inference</option>
                      <option value="mesh">P2P Mesh & Peering</option>
                      <option value="storage">Storage & File Explorer</option>
                      <option value="crypto_media">Crypto / Media / Arcade</option>
                      <option value="feature">Feature Request / Idea</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Severity</label>
                    <select
                      value={betaForm.severity}
                      onChange={(e) => setBetaForm({ ...betaForm, severity: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="low">Low (Cosmetic)</option>
                      <option value="moderate">Moderate (Friction)</option>
                      <option value="high">High (Feature Glitch)</option>
                      <option value="blocker">Blocker (Crash/Lock)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Steps to Reproduce / Detailed Notes</label>
                <textarea
                  rows={3}
                  placeholder="Describe what occurred, what was expected, and exact steps to reproduce..."
                  value={betaForm.description}
                  onChange={(e) => setBetaForm({ ...betaForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyBugReportMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  <span>Copy for Discord/GitHub</span>
                </button>
                <button
                  type="submit"
                  disabled={betaSending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-lg shadow-cyan-900/30 disabled:opacity-60 disabled:cursor-wait"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{betaSending ? 'Sending…' : 'Send Report to NovAura Team'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
