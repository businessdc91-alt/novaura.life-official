// NewDocumentDialog.jsx — Name, size (1–16384 px, or a preset) and background for a new document.

import React, { useState } from 'react';
import { NEW_DOCUMENT_PRESETS } from '../../../creative/presets.js';

const BACKGROUNDS = [['white', 'White'], ['black', 'Black'], ['transparent', 'Transparent'], ['custom', 'Colour']];
const validSide = v => Number.isInteger(v) && v >= 1 && v <= 16384;

export default function NewDocumentDialog({ onCreate, onCancel }) {
  const [name, setName] = useState('Untitled');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [background, setBackground] = useState('white');
  const [custom, setCustom] = useState('#1e293b');
  const ok = validSide(width) && validSide(height);
  const field = 'w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white select-text';

  const create = () => {
    if (!ok) return;
    onCreate({ name: name.trim() || 'Untitled', width, height, background: background === 'custom' ? custom : background });
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60" onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-label="New document" data-new-document-dialog=""
        className="w-[22rem] rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-2xl">
        <h2 className="text-sm font-bold text-white">New document</h2>
        <label className="block text-[11px] text-slate-400">Name
          <input autoFocus value={name} onChange={e => setName(e.target.value)} className={field} />
        </label>
        <div className="flex flex-wrap gap-1">
          {NEW_DOCUMENT_PRESETS.map(p => (
            <button key={p.label} type="button" data-preset={p.label}
              aria-pressed={width === p.width && height === p.height}
              onClick={() => { setWidth(p.width); setHeight(p.height); }}
              className={`px-2 py-1 rounded-md text-[10.5px] ${width === p.width && height === p.height ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="flex-1 block text-[11px] text-slate-400">Width (px)
            <input type="number" min={1} max={16384} value={width} onChange={e => setWidth(Number(e.target.value))} className={field} />
          </label>
          <label className="flex-1 block text-[11px] text-slate-400">Height (px)
            <input type="number" min={1} max={16384} value={height} onChange={e => setHeight(Number(e.target.value))} className={field} />
          </label>
        </div>
        {!ok && <p className="text-[11px] text-amber-300">Width and height must be whole numbers from 1 to 16384.</p>}
        <fieldset className="space-y-1">
          <legend className="text-[11px] text-slate-400 mb-1">Background</legend>
          <div className="flex items-center gap-2 flex-wrap">
            {BACKGROUNDS.map(([id, label]) => (
              <label key={id} className="flex items-center gap-1 text-[11px] text-slate-300">
                <input type="radio" name="background" checked={background === id} onChange={() => setBackground(id)} className="accent-cyan-500" />
                {label}
              </label>
            ))}
            {background === 'custom' && <input type="color" value={custom} onChange={e => setCustom(e.target.value)} aria-label="Background colour" className="w-7 h-6 rounded" />}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs">Cancel</button>
          <button type="button" data-action="create-document" disabled={!ok} onClick={create}
            className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-semibold">Create</button>
        </div>
      </div>
    </div>
  );
}
