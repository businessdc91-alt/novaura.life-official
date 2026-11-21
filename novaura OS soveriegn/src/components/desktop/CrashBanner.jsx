// CrashBanner.jsx — Non-intrusive global crash/glitch banner mounted on the Sovereign Desktop.
// Remains hidden until an unhandled error or React ErrorBoundary crash fires, offering 1-click
// detached Pop-Out Auto-Repair with Cybeni, Aura, and Nova.

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Wrench, ExternalLink, X } from 'lucide-react';
import { launchRepairPopout } from '../../services/repair/repairOrchestrator.js';

export default function CrashBanner() {
  const [crash, setCrash] = useState(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    const onCrash = (e) => {
      if (!e?.detail) return;
      setCrash(e.detail);
    };
    window.addEventListener('novaura:crash_banner', onCrash);
    return () => window.removeEventListener('novaura:crash_banner', onCrash);
  }, []);

  if (!crash) return null;

  const handlePopOutRepair = async () => {
    setLaunching(true);
    try {
      await launchRepairPopout({
        crash,
        targetApp: crash.appId || crash.windowType || 'desktop',
        autoAnalyze: true,
      });
      setCrash(null);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div
      role="alert"
      data-crash-banner="true"
      className="fixed top-11 left-1/2 -translate-x-1/2 z-[9800] w-[min(680px,92vw)] px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-rose-500/60 shadow-[0_18px_50px_rgba(244,63,94,0.28)] backdrop-blur-xl flex items-center justify-between gap-3 text-xs"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-200 truncate">
              Glitch Captured in {crash.windowType || 'Sovereign OS'}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/30">
              {crash.source || 'runtime'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 truncate mt-0.5">
            {crash.message || 'An unexpected runtime issue was detected.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handlePopOutRepair}
          disabled={launching}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold flex items-center gap-1.5 shadow cursor-pointer"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>{launching ? 'Opening…' : 'Pop-Out Auto-Repair'}</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </button>
        <button
          type="button"
          onClick={() => setCrash(null)}
          aria-label="Dismiss crash banner"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

