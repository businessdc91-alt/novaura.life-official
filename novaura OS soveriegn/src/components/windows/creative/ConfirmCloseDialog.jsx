// ConfirmCloseDialog.jsx — Closing a document with unsaved changes: Save, Don't save, or Cancel.

import React from 'react';

export default function ConfirmCloseDialog({ name, onSave, onDiscard, onCancel }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60" onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-label="Unsaved changes" data-confirm-close=""
        className="w-80 rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-2xl">
        <h2 className="text-sm font-bold text-white">Save changes to “{name}”?</h2>
        <p className="text-xs text-slate-400">If you don't save, your changes to this document will be lost.</p>
        <div className="flex justify-end gap-2">
          <button type="button" data-action="cancel-close" autoFocus onClick={onCancel} className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs">Cancel</button>
          <button type="button" data-action="discard-close" onClick={onDiscard} className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-red-900 text-xs">Don't save</button>
          <button type="button" data-action="save-close" onClick={onSave} className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold">Save</button>
        </div>
      </div>
    </div>
  );
}
