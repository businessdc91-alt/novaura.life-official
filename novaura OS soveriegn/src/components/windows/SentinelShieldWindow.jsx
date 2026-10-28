import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, Lock, Unlock, Eye, Activity,
  RefreshCw, Trash2, CheckCircle2, AlertTriangle, FileCode,
  Layers, Database, Cpu
} from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { db } from '../../database/sovereignDatabase.js';
import { interAppSecurityBroker, APP_CAPABILITY_PROFILES } from '../../kernel/InterAppSecurityBroker.js';

export default function SentinelShieldWindow() {
  const { kernel } = useKernel();
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeSecTab, setActiveSecTab] = useState('audit'); // 'audit' | 'sandboxes'
  const [brokerStats, setBrokerStats] = useState(() => interAppSecurityBroker.getSecurityTelemetry().stats);
  const [permissions, setPermissions] = useState({
    aiTerminalExec: true,
    aiFileWrite: true,
    cloudSyncPrompt: true,
    webgpuSandbox: true,
    interAppIsolation: true,
    vaultSecretScrub: true,
  });

  useEffect(() => {
    loadAuditLogs();
    setBrokerStats(interAppSecurityBroker.getSecurityTelemetry().stats);
    const unsub1 = kernel?.ipc.on('sentinel:violation', () => {
      loadAuditLogs();
      setBrokerStats(interAppSecurityBroker.getSecurityTelemetry().stats);
    });
    const unsub2 = kernel?.ipc.on('security:event', () => {
      loadAuditLogs();
      setBrokerStats(interAppSecurityBroker.getSecurityTelemetry().stats);
    });
    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, [kernel]);


  const loadAuditLogs = async () => {
    try {
      const logs = await db.sentinel_audit.reverse().limit(50).toArray();
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  const clearLogs = async () => {
    await db.sentinel_audit.clear();
    setAuditLogs([]);
  };

  const togglePermission = (key) => {
    setPermissions(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      kernel?.ipc.emit('sentinel:permission_changed', updated);
      return updated;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border-b border-emerald-500/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Sentinel Shield Governance</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                ACTIVE
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Autonomous on-device privacy protection, zero cloud surveillance, and process isolation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setActiveSecTab('audit')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeSecTab === 'audit'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveSecTab('sandboxes')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeSecTab === 'sandboxes'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inter-App Sandboxes ({Object.keys(APP_CAPABILITY_PROFILES).length})
            </button>
          </div>

          <button
            onClick={loadAuditLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Permission Matrix & Broker Metrics */}
        <div className="w-80 border-r border-slate-800 p-4 space-y-4 overflow-y-auto shrink-0">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Leak Telemetry</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block uppercase">Inspected</span>
                <span className="font-bold text-cyan-300 text-sm">{brokerStats.inspectedMessages || 0}</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block uppercase">Blocked Leaks</span>
                <span className="font-bold text-emerald-400 text-sm">{brokerStats.blockedLeakAttempts || 0}</span>
              </div>
            </div>
          </div>

          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Subsystem Policies</h3>

          <div className="space-y-2">
            {[
              { key: 'interAppIsolation', title: 'Inter-App Sandbox Isolation', desc: 'Strict capability envelopes preventing cross-app data leakage' },
              { key: 'vaultSecretScrub', title: 'Vault Credential Scrubbing', desc: 'Auto-redact API keys and private tokens from generic IPC payloads' },
              { key: 'aiFileWrite', title: 'AI File System Write', desc: 'Permit NovaAgent to write/edit local files' },
              { key: 'aiTerminalExec', title: 'Terminal Execution', desc: 'Allow AI agent to run local shell commands' },
              { key: 'cloudSyncPrompt', title: 'On-Demand Cloud Gating', desc: 'Require explicit user approval for cloud connections' },
            ].map(item => (
              <div
                key={item.key}
                onClick={() => togglePermission(item.key)}
                className="p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-200">{item.title}</span>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${permissions[item.key] ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${permissions[item.key] ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs space-y-1.5 text-emerald-300">
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Decentralized Isolation</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every application runs in an isolated process envelope. Apps cannot query unauthorized database namespaces or eavesdrop on other apps.
            </p>
          </div>
        </div>

        {/* Right Pane: Audit Trail OR Inter-App Sandboxes */}
        {activeSecTab === 'sandboxes' ? (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">Active App Capability Envelopes</span>
              </div>
              <span className="text-[10px] text-slate-400">Strict zero-leak boundaries active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.values(APP_CAPABILITY_PROFILES).map((profile) => (
                <div key={profile.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{profile.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 font-mono text-cyan-400 border border-slate-800">
                      app:{profile.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80">
                      <span className="text-slate-500 block">Vault Secrets:</span>
                      <span className={`font-semibold ${profile.canAccessVaultSecrets ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {profile.canAccessVaultSecrets ? 'ALLOWED' : 'BLOCKED (ZERO-LEAK)'}
                      </span>
                    </div>
                    <div className="p-1.5 bg-slate-950 rounded border border-slate-800/80">
                      <span className="text-slate-500 block">Raw Disk Access:</span>
                      <span className={`font-semibold ${profile.canAccessRawDisk ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {profile.canAccessRawDisk ? 'GATED BY OPERATOR' : 'BLOCKED'}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] space-y-1">
                    <div>
                      <span className="text-slate-500 block">Allowed Publishing:</span>
                      <span className="font-mono text-slate-300 text-[9px] truncate block">{profile.allowedPublish.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Database Scopes:</span>
                      <span className="font-mono text-purple-400 text-[9px] truncate block">{profile.dataScope.join(', ')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">Security Audit Trail ({auditLogs.length})</span>
              </div>
              {auditLogs.length > 0 && (
                <button
                  onClick={clearLogs}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Log</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pt-3">
              {auditLogs.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mb-2" />
                  <span>All systems nominal. Zero security violations recorded.</span>
                </div>
              ) : (
                auditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-900 border border-slate-800/80 rounded-lg text-xs flex items-start gap-3"
                  >
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${log.level === 'block' ? 'text-red-400' : 'text-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{log.action || 'System Check'}</span>
                        <span className="text-[10px] text-slate-500">{new Date(log.timestamp || Date.now()).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{log.details || log.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

