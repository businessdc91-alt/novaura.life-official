// OpenReport.jsx — After opening a PSD: everything that was converted, approximated or dropped.

import React from 'react';

export default function OpenReport({ report, onClose }) {
  if (!report?.lines?.length) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="What changed when opening" data-open-report=""
        className="w-[26rem] rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-2xl">
        <h2 className="text-sm font-bold text-white">Opened “{report.name}” with these changes</h2>
        <ul className="max-h-60 overflow-y-auto space-y-1 text-xs text-slate-300 list-disc pl-4 select-text">
          {report.lines.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
        <div className="flex justify-end">
          <button type="button" data-action="close-open-report" autoFocus onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold">OK</button>
        </div>
      </div>
    </div>
  );
}
