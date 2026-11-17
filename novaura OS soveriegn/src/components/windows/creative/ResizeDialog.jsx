// ResizeDialog.jsx — Modal for Image Size (resample artwork) and Canvas Size (extend/crop around 9-point anchor).

import React, { useState } from 'react';
import { Link2, Unlink2 } from 'lucide-react';
import { MAX_SIDE } from '../../../creative/surface.js';
import { resizeImage, resizeCanvas } from '../../../creative/edits.js';

const ANCHORS = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

export default function ResizeDialog({ store, mode, onClose }) {
  const session = store.active();
  const doc = session?.doc;
  const tab = store.getState().tab;
  const [width, setWidth] = useState(doc?.width || 1920);
  const [height, setHeight] = useState(doc?.height || 1080);
  const [keepAspect, setKeepAspect] = useState(true);
  const [anchor, setAnchor] = useState('middle-center');

  if (!doc) return null;
  const aspect = doc.width / Math.max(1, doc.height);

  const onWidth = (val) => {
    const w = Math.max(1, Math.min(MAX_SIDE, Math.round(Number(val) || 1)));
    setWidth(w);
    if (keepAspect) setHeight(Math.max(1, Math.min(MAX_SIDE, Math.round(w / aspect))));
  };

  const onHeight = (val) => {
    const h = Math.max(1, Math.min(MAX_SIDE, Math.round(Number(val) || 1)));
    setHeight(h);
    if (keepAspect) setWidth(Math.max(1, Math.min(MAX_SIDE, Math.round(h * aspect))));
  };

  const apply = (e) => {
    e.preventDefault();
    const r = mode === 'canvas'
      ? resizeCanvas(session, { width, height, anchor }, { tab })
      : resizeImage(session, { width, height }, { tab });
    if (!r.ok) {
      store.notify(r.reason);
      return;
    }
    session.compositor?.invalidate();
    store.bump();
    onClose();
  };

  const field = 'w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white select-text tabular-nums';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/65" role="dialog" aria-label={mode === 'canvas' ? 'Canvas Size' : 'Image Size'}>
      <form onSubmit={apply} className="w-80 rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4 shadow-2xl text-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{mode === 'canvas' ? 'Canvas Size' : 'Image Size'}</h3>
          <span className="text-[11px] text-slate-400 tabular-nums">Now: {doc.width} × {doc.height} px</span>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex-1 text-slate-400 space-y-1">
            <span>Width (px)</span>
            <input type="number" min={1} max={MAX_SIDE} value={width} onChange={e => onWidth(e.target.value)} data-resize-width="" className={field} />
          </label>
          <button
            type="button"
            onClick={() => setKeepAspect(v => !v)}
            title={keepAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
            aria-label="Lock aspect ratio"
            aria-pressed={keepAspect}
            className={`p-2 rounded-md border ${keepAspect ? 'border-cyan-600 bg-cyan-950/40 text-cyan-300' : 'border-slate-700 bg-slate-950 text-slate-400'}`}
          >
            {keepAspect ? <Link2 className="w-3.5 h-3.5" /> : <Unlink2 className="w-3.5 h-3.5" />}
          </button>
          <label className="flex-1 text-slate-400 space-y-1">
            <span>Height (px)</span>
            <input type="number" min={1} max={MAX_SIDE} value={height} onChange={e => onHeight(e.target.value)} data-resize-height="" className={field} />
          </label>
        </div>

        {mode === 'canvas' ? (
          <div className="space-y-1.5">
            <span className="block text-slate-400">Anchor</span>
            <div className="grid grid-cols-3 gap-1 w-28 mx-auto bg-slate-950 p-1.5 rounded-lg border border-slate-800">
              {ANCHORS.map(id => (
                <button
                  key={id}
                  type="button"
                  data-anchor={id}
                  aria-label={id}
                  aria-pressed={anchor === id}
                  onClick={() => setAnchor(id)}
                  className={`h-7 rounded text-[10px] font-bold transition-colors ${anchor === id ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
                >
                  {anchor === id ? '●' : '·'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">Resamples pixel layers and masks, and scales vectors and fonts cleanly.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200">Cancel</button>
          <button type="submit" data-action="apply-resize" className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">Apply</button>
        </div>
      </form>
    </div>
  );
}

