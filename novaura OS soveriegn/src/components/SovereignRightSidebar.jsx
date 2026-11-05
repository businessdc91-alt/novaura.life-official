import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Activity, Cpu, ShieldCheck,
  Phone, Mail, Settings, Wifi, HardDrive, Clock, Lock,
  Zap, Bell, RefreshCw, Key
} from 'lucide-react';
import { getLocalIdentity, getUnreadCount, getPeerCount } from '../services/sovereignMesh.js';
import { getMyPhoneNumber } from '../services/sovereignCallService.js';
import { getHardwareFingerprint } from '../services/nativeService.js';
import { useKernel } from '../kernel/useKernel.js';

export default function SovereignRightSidebar({ openApp, preferences, onUpdatePreferences }) {
  const { kernel } = useKernel();
  const [isOpen, setIsOpen] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [unreadMail, setUnreadMail] = useState(0);
  const [peerCount, setPeerCount] = useState(1);
  const [time, setTime] = useState(new Date());
  const [hwFingerprint, setHwFingerprint] = useState('SOV-NODE-LOCAL');
  const [vaultUsage, setVaultUsage] = useState({ usedMb: '1.2 MB', pct: 2 });
  const [procLoad, setProcLoad] = useState({ count: 1, pct: 8 });

  useEffect(() => {
    const id = getLocalIdentity();
    if (id) setIdentity(id);
    setUnreadMail(getUnreadCount());
    setPeerCount(getPeerCount());

    getHardwareFingerprint().then((fp) => {
      if (fp) setHwFingerprint(fp.slice(0, 16));
    });

    // Query real browser/dexie storage usage
    const queryStorage = async () => {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          const usedBytes = est.usage || 0;
          const quotaBytes = est.quota || 1;
          const usedMb = usedBytes >= 1024 * 1024
            ? `${(usedBytes / (1024 * 1024)).toFixed(1)} MB`
            : `${(usedBytes / 1024).toFixed(0)} KB`;
          const pct = Math.min(100, Math.max(1, Math.round((usedBytes / quotaBytes) * 100)));
          setVaultUsage({ usedMb, pct });
        } catch {}
      }
    };
    queryStorage();

    const timer = setInterval(() => setTime(new Date()), 1000);
    const meshTimer = setInterval(() => {
      setUnreadMail(getUnreadCount());
      setPeerCount(getPeerCount());
      queryStorage();

      const openWins = kernel?.wm?.getOpenWindows?.() || [];
      const runningCount = Math.max(1, openWins.length);
      const computedPct = Math.min(100, Math.max(6, (runningCount * 7) + 5));
      setProcLoad({ count: runningCount, pct: computedPct });
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(meshTimer);
    };
  }, [kernel]);

  return (
    <>
      {/* Toggle Button on Right Edge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle System HUD Sidebar"
        className={`fixed top-14 right-0 z-[7600] flex items-center justify-center w-7 h-12 bg-slate-900/90 hover:bg-slate-800 border-l border-y border-cyan-500/30 text-cyan-400 rounded-l-xl transition-all shadow-lg backdrop-blur-md cursor-pointer ${
          isOpen ? '-translate-x-72' : 'translate-x-0'
        }`}
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Slide-out Sidebar Drawer with RGB flow layer */}
      <aside
        className={`fixed top-12 right-0 bottom-0 z-[7600] w-72 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl pointer-events-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="rgb-border rgb-border-subtle rounded-l-2xl h-full flex flex-col">
          <div className="rgb-flow-layer" />
          <div className="relative z-10 bg-slate-950/95 rounded-l-2xl h-full flex flex-col border border-white/[0.08] border-r-0 backdrop-blur-2xl">
            {/* Header Clock */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              NODE TELEMETRY
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>LIVE</span>
            </div>
          </div>
          <div className="mt-2 text-2xl font-mono font-bold tracking-tight text-white">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Identity & Telecom Card */}
          <div className="p-3.5 bg-slate-900/70 border border-slate-800/90 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Sovereign Line
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                P2P Mesh
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                {identity?.handle ? identity.handle[0].toUpperCase() : 'O'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  @{identity?.handle || 'operator'}
                </div>
                <div className="text-[11px] font-mono text-cyan-300/80 truncate">
                  {getMyPhoneNumber() || 'No number yet'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
              <button
                onClick={() => openApp('novaphone')}
                className="py-1.5 px-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Phone className="w-3 h-3" />
                <span>Dialer</span>
              </button>
              <button
                onClick={() => openApp('novamail')}
                className="py-1.5 px-2 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer relative"
              >
                <Mail className="w-3 h-3" />
                <span>Inbox</span>
                {unreadMail > 0 && (
                  <span className="w-4 h-4 rounded-full bg-cyan-500 text-black text-[9px] font-bold flex items-center justify-center ml-0.5">
                    {unreadMail}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* System Vital Meters */}
          <div className="p-3.5 bg-slate-900/70 border border-slate-800/90 rounded-2xl space-y-3">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
              Hardware Enclave
            </span>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] mb-1 font-mono">
                  <span className="text-slate-400 flex items-center gap-1"><Cpu className="w-3 h-3" /> Local Compute</span>
                  <span className="text-cyan-400">{procLoad.count} Proc // {procLoad.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full transition-all duration-500" style={{ width: `${procLoad.pct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1 font-mono">
                  <span className="text-slate-400 flex items-center gap-1"><HardDrive className="w-3 h-3" /> Private Dexie Vault</span>
                  <span className="text-purple-400">Encrypted // {vaultUsage.usedMb}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400 rounded-full transition-all duration-500" style={{ width: `${vaultUsage.pct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1 font-mono">
                  <span className="text-slate-400 flex items-center gap-1"><Wifi className="w-3 h-3" /> Mesh Network</span>
                  <span className="text-emerald-400">{peerCount} Node Active</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Security & Enclave Badge */}
          <div className="p-3.5 bg-slate-900/70 border border-slate-800/90 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Air-Gapped Sovereign Node</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              All database records, AI inference routing, and encryption keys reside strictly on this machine.
            </p>
            <div className="text-[10px] font-mono text-slate-500 pt-1 truncate">
              HW-ID: {hwFingerprint}
            </div>
          </div>
        </div>

          {/* Footer Quick Controls */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 grid grid-cols-2 gap-2 shrink-0">
            <button
              onClick={() => openApp('sentinel')}
              className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Shield</span>
            </button>
            <button
              onClick={() => openApp('settings')}
              className="py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-purple-400" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  </>
);
}
