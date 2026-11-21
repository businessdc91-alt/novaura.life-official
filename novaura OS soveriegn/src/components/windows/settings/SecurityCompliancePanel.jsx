import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, ShieldAlert, Lock, RefreshCw, Download, Trash2,
  CheckCircle2, AlertTriangle, XCircle, WifiOff, EyeOff, KeyRound,
  Globe, Activity
} from 'lucide-react';
import { credentialEnclave } from '../../../services/credentialEnclaveService.js';
import { isTauriNative, getNativeCloudAirGap } from '../../../services/nativeService.js';
import {
  KNOWN_EXTERNAL_ENDPOINTS,
  getSecurityPolicy,
  updateSecurityPolicy,
  evaluateSoc2Controls,
  executeCryptographicWipe,
} from '../../../services/security/complianceService.js';

function downloadTextFile(filename, mimeType, text) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SecurityCompliancePanel({ kernel }) {
  const [policy, setPolicy] = useState(() => getSecurityPolicy());
  const [nativeAirGapActive, setNativeAirGapActive] = useState(false);
  const [auditVerification, setAuditVerification] = useState({ valid: true, checked: 0, legacyUnchained: 0, tipHash: '' });
  const [recentEvents, setRecentEvents] = useState([]);
  const [enclaveStatus, setEnclaveStatus] = useState(() => credentialEnclave.getStatus());
  const [legacyPlaintext, setLegacyPlaintext] = useState(() => credentialEnclave.hasLegacyPlaintextSecrets());
  const [verifying, setVerifying] = useState(false);
  const [wipePhrase, setWipePhrase] = useState('');
  const [wiping, setWiping] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const tauriHost = isTauriNative();

  const refreshTelemetry = useCallback(async () => {
    setVerifying(true);
    try {
      const sentinel = kernel?.sentinel;
      const verification = sentinel?.verifyAuditChain
        ? await sentinel.verifyAuditChain()
        : { valid: true, checked: 0, legacyUnchained: 0, tipHash: '' };
      setAuditVerification(verification);
      setRecentEvents(sentinel?.getAuditLogs ? sentinel.getAuditLogs(10) : []);
      setEnclaveStatus(credentialEnclave.getStatus());
      setLegacyPlaintext(credentialEnclave.hasLegacyPlaintextSecrets());
      if (isTauriNative()) {
        setNativeAirGapActive(await getNativeCloudAirGap());
      }
    } finally {
      setVerifying(false);
    }
  }, [kernel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sentinel = kernel?.sentinel;
      const verification = sentinel?.verifyAuditChain
        ? await sentinel.verifyAuditChain()
        : { valid: true, checked: 0, legacyUnchained: 0, tipHash: '' };
      const airGap = isTauriNative() ? await getNativeCloudAirGap() : false;
      if (cancelled) return;
      setAuditVerification(verification);
      setRecentEvents(sentinel?.getAuditLogs ? sentinel.getAuditLogs(10) : []);
      setEnclaveStatus(credentialEnclave.getStatus());
      setLegacyPlaintext(credentialEnclave.hasLegacyPlaintextSecrets());
      setNativeAirGapActive(airGap);
    })();
    const unsub = credentialEnclave.subscribe(() => {
      setEnclaveStatus(credentialEnclave.getStatus());
      setLegacyPlaintext(credentialEnclave.hasLegacyPlaintextSecrets());
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [kernel]);

  const handlePolicyChange = async (patch) => {
    const next = await updateSecurityPolicy(patch, { kernel });
    setPolicy(next);
    await refreshTelemetry();
    setActionMessage('Security policy updated and synchronized with OS kernel.');
    setTimeout(() => setActionMessage(''), 3500);
  };

  const handleExportAudit = async (format) => {
    if (!kernel?.sentinel?.exportAuditLogs) return;
    const payload = await kernel.sentinel.exportAuditLogs(format);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'csv') {
      downloadTextFile(`novaura-sentinel-audit-${stamp}.csv`, 'text/csv;charset=utf-8', payload);
    } else {
      downloadTextFile(`novaura-sentinel-audit-${stamp}.json`, 'application/json;charset=utf-8', payload);
    }
  };

  const handleCryptographicWipe = async () => {
    if (wipePhrase.trim() !== 'WIPE SOVEREIGN') return;
    setWiping(true);
    try {
      await executeCryptographicWipe();
      window.location.reload();
    } catch (err) {
      setWiping(false);
      alert('Cryptographic wipe failed: ' + (err?.message || err));
    }
  };

  const posture = evaluateSoc2Controls({
    isTauri: tauriHost,
    policy,
    enclaveStatus,
    legacyPlaintext,
    auditVerification,
  });

  return (
    <div className="max-w-4xl space-y-6">
      {/* SOC 2 Readiness Header Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-100">Security & SOC 2 Trust Controls</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {posture.scorePercent}% POSTURE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live cryptographic verification of SOC 2 Security, Confidentiality, and Privacy controls on this Sovereign Node.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-mono">
            {posture.passed} PASS
          </span>
          {posture.warned > 0 && (
            <span className="text-[11px] px-2 py-1 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30 font-mono">
              {posture.warned} WARN
            </span>
          )}
          {posture.failed > 0 && (
            <span className="text-[11px] px-2 py-1 rounded bg-red-950/60 text-red-300 border border-red-500/30 font-mono">
              {posture.failed} FAIL
            </span>
          )}
          <button
            onClick={refreshTelemetry}
            disabled={verifying}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Re-Verify Controls</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* 6-Card SOC 2 Trust Services Criteria Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {posture.controls.map((ctrl) => {
          const isPass = ctrl.status === 'PASS';
          const isFail = ctrl.status === 'FAIL';
          return (
            <div
              key={ctrl.id}
              className={`p-3.5 rounded-xl border space-y-1.5 ${
                isFail
                  ? 'bg-red-950/20 border-red-500/40'
                  : isPass
                  ? 'bg-slate-900/80 border-slate-800'
                  : 'bg-amber-950/15 border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-700 font-bold">
                    {ctrl.id}
                  </span>
                  <span className="text-xs font-bold text-slate-100">{ctrl.title}</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    isFail
                      ? 'bg-red-500/20 text-red-300'
                      : isPass
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {isFail ? <XCircle className="w-3 h-3" /> : isPass ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  <span>{ctrl.status}</span>
                </span>
              </div>
              <div className="text-[10px] text-slate-500">{ctrl.criteria}</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{ctrl.summary}</p>
            </div>
          );
        })}
      </div>

      {/* Interactive Runtime Security Policies */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Runtime Security Boundaries</h3>
          </div>
          {tauriHost && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              RUST AIR-GAP: {nativeAirGapActive ? 'ARMED' : 'STANDBY'}
            </span>
          )}
        </div>

        <div className="space-y-3 text-xs">
          {/* Air-Gap Toggle */}
          <label className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <WifiOff className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-slate-100">Strict Air-Gapped Local-Only AI Lock</div>
                <div className="text-[11px] text-slate-400">
                  Physically blocks all outbound cloud LLM traffic in both JS and Rust (`cloud_ai_request`). Only Ollama, LM Studio, WebGPU, and Built-in AI run.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={policy.airGappedAiOnly}
              onChange={(e) => handlePolicyChange({ airGappedAiOnly: e.target.checked })}
              className="accent-cyan-500 w-4 h-4 shrink-0"
            />
          </label>

          {/* Prompt Secret Guard Toggle */}
          <label className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <EyeOff className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-slate-100">Outbound Cloud Prompt Secret Redaction</div>
                <div className="text-[11px] text-slate-400">
                  Automatically scrubs pasted private keys, Bearer JWTs, OpenAI/Anthropic/Gemini/GitHub/AWS/Stripe/NOVA1 tokens before cloud requests leave your device.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={policy.redactCloudSecrets}
              onChange={(e) => handlePolicyChange({ redactCloudSecrets: e.target.checked })}
              className="accent-cyan-500 w-4 h-4 shrink-0"
            />
          </label>

          {/* Fail-Closed Permission Gate Toggle */}
          <label className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-slate-100">Fail-Closed High-Risk Permission Gate</div>
                <div className="text-[11px] text-slate-400">
                  Requires explicit operator approval (or rejects when unprompted) for terminal execution, system deletions, cloud egress, and firmware reboot capabilities.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={policy.requireHighRiskApproval}
              onChange={(e) => handlePolicyChange({ requireHighRiskApproval: e.target.checked })}
              className="accent-cyan-500 w-4 h-4 shrink-0"
            />
          </label>

          {/* Enclave Idle Auto-Lock Timeout */}
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div className="flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-slate-100">Credential Enclave Idle Auto-Lock Timeout</div>
                <div className="text-[11px] text-slate-400">
                  Wipes volatile AES-256-GCM decryption keys from memory automatically after inactivity or window switch.
                </div>
              </div>
            </div>
            <select
              value={policy.enclaveIdleMinutes}
              onChange={(e) => handlePolicyChange({ enclaveIdleMinutes: Number(e.target.value) })}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500"
            >
              <option value={1}>1 minute</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes (Recommended)</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={0}>Manual lock only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sentinel Tamper-Evident Audit Chain */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Sentinel Tamper-Evident Audit Chain</h3>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                auditVerification.valid
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              }`}
            >
              {auditVerification.valid ? 'CHAIN INTACT' : 'TAMPER DETECTED'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshTelemetry}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] border border-slate-700 cursor-pointer"
            >
              Verify Chain
            </button>
            <button
              onClick={() => handleExportAudit('json')}
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-200 rounded-lg text-[11px] border border-cyan-500/30 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => handleExportAudit('csv')}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] border border-slate-700 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Verified Chained Events</span>
            <span className="text-slate-100 font-bold">{auditVerification.checked || 0}</span>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Legacy Unchained Events</span>
            <span className="text-slate-300 font-bold">{auditVerification.legacyUnchained || 0}</span>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Tip SHA-256 Digest</span>
            <span className="text-cyan-400 truncate block">{auditVerification.tipHash ? `${auditVerification.tipHash.slice(0, 18)}...` : 'GENESIS'}</span>
          </div>
        </div>

        {recentEvents.length > 0 && (
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800 px-3">
            {recentEvents.map((evt) => (
              <div key={evt.id} className="py-1.5 flex items-center justify-between gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase ${
                    evt.severity === 'warning' || evt.severity === 'critical'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {evt.severity}
                  </span>
                  <span className="text-cyan-300 truncate">{evt.eventType}</span>
                  <span className="text-slate-500 truncate">({evt.source})</span>
                </div>
                <span className="text-slate-500 shrink-0">
                  {evt.seq ? `#${evt.seq} ` : ''}
                  {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* External Endpoint Disclosure */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">External Network Endpoint Disclosure</h3>
        </div>
        <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800 px-3">
          {KNOWN_EXTERNAL_ENDPOINTS.map((ep) => {
            const blockedByAirGap = policy.airGappedAiOnly && ep.category.startsWith('Cloud AI');
            return (
              <div key={ep.host} className="py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-mono text-slate-200 text-[11px] truncate">{ep.host}</div>
                  <div className="text-[10px] text-slate-400">{ep.purpose}</div>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 border ${
                    blockedByAirGap
                      ? 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                      : ep.optIn
                      ? 'bg-slate-900 text-slate-300 border-slate-700'
                      : 'bg-cyan-950/50 text-cyan-300 border-cyan-500/30'
                  }`}
                >
                  {blockedByAirGap ? 'BLOCKED (AIR-GAP)' : ep.optIn ? 'OPT-IN ONLY' : 'SIGNED MANIFEST'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cryptographic Factory Wipe (SOC 2 P4.1) */}
      <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl space-y-3">
        <div className="flex items-start gap-2.5">
          <Trash2 className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-red-300 uppercase tracking-wider">Cryptographic Factory Wipe (SOC 2 P4.1)</h3>
            <p className="text-[11px] text-red-200/80 mt-0.5">
              Zero-fills and unlinks the DPAPI disk mirror snapshot (`sovereign_db_snapshot.json`), wipes IndexedDB, clears localStorage/sessionStorage, and locks all volatile enclave keys.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={wipePhrase}
            onChange={(e) => setWipePhrase(e.target.value)}
            placeholder="Type WIPE SOVEREIGN to arm"
            className="flex-1 min-w-[200px] px-3 py-1.5 bg-slate-950 border border-red-500/30 rounded-lg text-xs font-mono text-red-200 placeholder:text-slate-600 outline-none focus:border-red-400"
          />
          <button
            onClick={handleCryptographicWipe}
            disabled={wipePhrase.trim() !== 'WIPE SOVEREIGN' || wiping}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            {wiping ? 'Zeroing & Purging Vault...' : 'Execute Cryptographic Wipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
