// DocumentTabs.jsx — One tab per open document: its name, ● for unsaved changes, and ×.

import React from 'react';
import { Plus, X } from 'lucide-react';
import { useStudio } from './useStudio.js';

export default function DocumentTabs({ store, onNew, onClose, onDropFiles = null }) {
  useStudio(store, s => s.version);
  const { sessions, activeId } = store.getState();
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  return (
    <div
      className="flex items-end gap-0.5 px-2 pt-1.5 border-b border-slate-800 bg-slate-900/40 overflow-x-auto shrink-0" data-drop-target="tabs"
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
      onDrop={(e) => { if (!hasFiles(e)) return; e.preventDefault(); onDropFiles?.('tabs', e.dataTransfer.files); }}
    >
      <div role="tablist" aria-label="Open documents" className="flex items-end gap-0.5">
        {sessions.map(s => (
          <div
            key={s.id} role="tab" data-doc-tab="" aria-selected={s.id === activeId} tabIndex={0}
            onClick={() => store.setActive(s.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') store.setActive(s.id); }}
            className={`group flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-t-md text-[11px] cursor-pointer border border-b-0 ${
              s.id === activeId ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-900/60 border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <span className="truncate max-w-[11rem]" title={s.savedPath || s.doc.name}>{s.doc.name}</span>
            {s.dirty && <span aria-label="Unsaved changes" title="Unsaved changes" className="text-amber-300 text-[10px]">●</span>}
            <button
              type="button" data-action="close-document" aria-label={`Close ${s.doc.name}`}
              onClick={(e) => { e.stopPropagation(); onClose(s); }}
              className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" data-action="new-document" aria-label="New document" title="New document" onClick={onNew}
        className="mb-0.5 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
