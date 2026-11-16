// RecoveryPrompt.jsx — Offered when the studio opens and unsaved work from last time was kept.

import React from 'react';

export default function RecoveryPrompt({ items, onRestore, onDiscard }) {
  const n = items.length;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60">
      <div role="alertdialog" aria-modal="true" aria-label="Restore unsaved work" data-recovery-prompt=""
        className="w-80 rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-2xl">
        <h2 className="text-sm font-bold text-white">Creative Studio closed with unsaved work.</h2>
        <p className="text-xs text-slate-400">Restore {n} document{n === 1 ? '' : 's'}?</p>
        <ul className="text-[11px] text-slate-300 space-y-0.5 max-h-28 overflow-y-auto">
          {items.map(r => <li key={r.id} className="truncate">• {r.name} <span className="text-slate-500">({new Date(r.updatedAt).toLocaleString()})</span></li>)}
        </ul>
        <div className="flex justify-end gap-2">
          <button type="button" data-action="discard-recovery" onClick={onDiscard} className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs">Discard</button>
          <button type="button" data-action="restore-recovery" autoFocus onClick={onRestore} className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold">Restore</button>
        </div>
      </div>
    </div>
  );
}
