// FileMenu.jsx — New, Open, Place, Save, Download project (and Export, from the export dialog).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { openImageFile, placeImage, scaledNotice } from '../../../creative/io/raster.js';

const OPEN_TYPES = '.novaart,.psd,image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.svg';
const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,.svg';

function MenuItem({ action, label, hint = '', disabled = false, onRun, onDone }) {
  return (
    <button type="button" role="menuitem" data-action={action} disabled={disabled}
      onClick={() => { onDone(); onRun(); }}
      className="w-full flex items-center justify-between gap-4 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent">
      <span>{label}</span>{hint && <span className="text-[10px] text-slate-500">{hint}</span>}
    </button>
  );
}

export default function FileMenu({ store, onNew, onOpen, onSave, onDownload, onExport }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(null);
  const placeRef = useRef(null);
  const menuRef = useRef(null);
  const hasDoc = !!store.active();
  const chooseOpen = useCallback(() => openRef.current?.click(), []);
  const choosePlace = useCallback(() => placeRef.current?.click(), []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [open]);

  const place = async (file) => {
    const session = store.active();
    if (!file || !session) return;
    try {
      const opened = await openImageFile(file, file.name);
      const r = placeImage(session, opened, file.name, { tab: store.getState().tab });
      if (!r.ok) store.notify(r.reason);
      const note = scaledNotice(opened);
      if (note) store.notify(note);
    } catch (err) {
      store.notify(err.message);
    }
  };

  const close = () => setOpen(false);

  return (
    <div ref={menuRef} className="relative">
      <button type="button" data-menu="file" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-200 hover:bg-slate-800">
        File <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-1 z-40 w-56 py-1 rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
          <MenuItem action="file-new" label="New document…" onRun={onNew} onDone={close} />
          <MenuItem action="file-open" label="Open…" hint=".novaart, PSD, images" onRun={chooseOpen} onDone={close} />
          <MenuItem action="file-place" label="Place image as a layer…" disabled={!hasDoc} onRun={choosePlace} onDone={close} />
          <div className="my-1 border-t border-slate-800" />
          <MenuItem action="file-save" label="Save to Files" hint="Ctrl+S" disabled={!hasDoc} onRun={onSave} onDone={close} />
          <MenuItem action="file-download" label="Download project (.novaart)" disabled={!hasDoc} onRun={onDownload} onDone={close} />
          {onExport && <MenuItem action="file-export" label="Export…" hint="PNG, JPG, WebP, SVG, PSD" disabled={!hasDoc} onRun={onExport} onDone={close} />}
        </div>
      )}
      <input ref={openRef} type="file" accept={OPEN_TYPES} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onOpen(f); }} />
      <input ref={placeRef} type="file" accept={IMAGE_TYPES} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; place(f); }} />
    </div>
  );
}
