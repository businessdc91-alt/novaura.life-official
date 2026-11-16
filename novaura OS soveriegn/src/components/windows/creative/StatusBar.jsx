// StatusBar.jsx — Zoom, document size and memory in use, with a warning past the budget
// (work is never blocked), and the studio settings.

import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useStudio } from './useStudio.js';
import { usage, formatBytes, saveBudgets } from '../../../creative/memory.js';

function StudioSettings({ store, budgets, onBudgets, onClose }) {
  const brush = useStudio(store, s => s.brush);
  const eyedropper = useStudio(store, s => s.eyedropper);
  const GiB = 2 ** 30;
  const [history, setHistory] = useState(+(budgets.historyBytes / GiB).toFixed(1));
  const [warn, setWarn] = useState(+(budgets.warnBytes / GiB).toFixed(1));
  const field = 'w-20 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs text-white select-text';
  const save = async () => {
    const next = { ...budgets, historyBytes: Math.max(0.1, history) * GiB, warnBytes: Math.max(0.1, warn) * GiB };
    onBudgets(next);
    try { await saveBudgets(next); } catch { store.notify('Could not save the memory settings.'); }
    onClose();
  };
  return (
    <div role="dialog" aria-label="Studio settings" data-studio-settings=""
      className="absolute right-2 bottom-8 z-30 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 space-y-2.5 shadow-2xl text-xs">
      <h3 className="font-bold text-white">Studio settings</h3>
      <p className="text-[11px] text-slate-400">This PC has about {budgets.ramGB} GB of memory.</p>
      <label className="flex items-center justify-between gap-2 text-slate-300">Undo history may use (GB)
        <input type="number" min={0.1} step={0.5} value={history} onChange={e => setHistory(Number(e.target.value))} className={field} />
      </label>
      <label className="flex items-center justify-between gap-2 text-slate-300">Warn when the studio uses (GB)
        <input type="number" min={0.1} step={0.5} value={warn} onChange={e => setWarn(Number(e.target.value))} className={field} />
      </label>
      <label className="flex items-center gap-2 text-slate-300">
        <input type="checkbox" checked={brush.pressure} onChange={e => store.update({ brush: { pressure: e.target.checked } })} className="accent-cyan-500" />
        Pen pressure changes brush size
      </label>
      <label className="flex items-center justify-between gap-2 text-slate-300">Eyedropper picks from
        <select value={eyedropper.sample} onChange={e => store.update({ eyedropper: { sample: e.target.value } })}
          className="bg-slate-950 border border-slate-700 rounded-md px-1.5 py-1 text-xs">
          <option value="composite">the whole picture</option>
          <option value="layer">the current layer</option>
        </select>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700">Cancel</button>
        <button type="button" data-action="save-settings" onClick={save} className="px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">Save</button>
      </div>
    </div>
  );
}

export default function StatusBar({ store, zoom, budgets, onBudgets }) {
  useStudio(store, s => s.version);
  const [open, setOpen] = useState(false);
  const { sessions } = store.getState();
  const session = store.active();
  const used = usage(sessions).total;
  const high = budgets && used > budgets.warnBytes;
  return (
    <footer className="relative flex items-center gap-4 px-3 py-1 border-t border-slate-800 bg-slate-900/70 text-[11px] text-slate-400 shrink-0" aria-label="Status">
      <span className="tabular-nums" data-status-zoom="">{Math.round(zoom * 100)}%</span>
      {session && <span className="tabular-nums" data-status-size="">{session.doc.width} × {session.doc.height} px</span>}
      <span className={`tabular-nums ${high ? 'text-amber-300' : ''}`} data-memory="">
        Memory: {formatBytes(used)}{budgets ? ` of ${formatBytes(budgets.warnBytes)}` : ''}
      </span>
      {high && <span className="text-amber-300" data-memory-warning="">Memory is high — merge layers or close documents you don't need.</span>}
      <button type="button" aria-label="Studio settings" title="Studio settings" disabled={!budgets} onClick={() => setOpen(v => !v)}
        className="ml-auto p-1 rounded hover:bg-slate-800 hover:text-white disabled:opacity-40" data-action="studio-settings">
        <Settings className="w-3.5 h-3.5" />
      </button>
      {open && budgets && <StudioSettings store={store} budgets={budgets} onBudgets={onBudgets} onClose={() => setOpen(false)} />}
    </footer>
  );
}
