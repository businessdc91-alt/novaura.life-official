// TextProperties.jsx — Edit the selected text layer: its words, font, size, weight, colour,
// alignment, line height, outline, uppercase, wrapping and rotation.

import React, { useEffect, useRef } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useStudio } from './useStudio.js';
import { getLayer } from '../../../creative/document.js';
import { setLayerProps } from '../../../creative/edits.js';
import { FONT_CHOICES, fontAvailable } from '../../../creative/text.js';

function Range({ label, value, min, max, step = 1, suffix = '', onStart, onChange }) {
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] text-slate-400 mb-1">
        <span>{label}</span><span className="tabular-nums text-slate-300">{value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onStart}
        onChange={e => onChange(Number(e.target.value))} className="w-full accent-cyan-500" />
    </label>
  );
}

export default function TextProperties({ store }) {
  useStudio(store, s => s.version);
  const focusId = useStudio(store, s => s.textFocus);
  const tab = useStudio(store, s => s.tab);
  const textRef = useRef(null);
  const dragId = useRef(0);
  const session = store.active();
  const layer = session ? getLayer(session.doc, session.doc.activeLayerId) : null;
  const text = layer?.kind === 'text' ? layer : null;

  useEffect(() => {
    if (text && focusId === text.id) {
      textRef.current?.focus();
      textRef.current?.select();
      store.update({ textFocus: null });
    }
  }, [focusId, text, store]);

  if (!text) return null;
  const set = (patch, key, windowMs = 1000) => {
    const r = setLayerProps(session, text.id, patch, {
      tab, label: key === 'text' ? 'Edit text' : 'Text properties', mergeKey: `text-${key}:${text.id}:${dragId.current}`, mergeWindowMs: windowMs,
    });
    if (!r.ok) store.notify(r.reason);
  };
  const startDrag = () => { dragId.current += 1; };
  const missing = !fontAvailable(text.fontFamily);

  const onText = (e) => {
    const value = e.target.value;
    const patch = { text: value };
    // A layer still named after its old words follows the new words, as in Photoshop.
    const oldName = (text.text || 'Text').split('\n')[0].slice(0, 40) || 'Text';
    if (text.name === oldName) patch.name = value.split('\n')[0].slice(0, 40) || 'Text';
    set(patch, 'text');
  };

  return (
    <section className="space-y-2" aria-label="Selected text">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Text</h3>
      <textarea
        ref={textRef} value={text.text} onChange={onText} rows={3} data-text-input="" aria-label="Text"
        className="w-full resize-y bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white select-text"
      />
      <select value={text.fontFamily} aria-label="Font" onChange={e => set({ fontFamily: e.target.value }, 'font', 0)}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs">
        {[...new Set([text.fontFamily, ...FONT_CHOICES])].map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      {missing && <p className="text-[10px] text-amber-300">{text.fontFamily} isn't installed, showing Inter.</p>}
      <div className="flex gap-1.5">
        <select value={text.fontWeight} aria-label="Weight" onChange={e => set({ fontWeight: Number(e.target.value) }, 'weight', 0)}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-1.5 py-1 text-xs">
          <option value={400}>Regular</option><option value={700}>Bold</option><option value={900}>Black</option>
        </select>
        <label className="flex items-center gap-1 text-[11px] text-slate-300">
          <input type="checkbox" checked={!!text.italic} onChange={e => set({ italic: e.target.checked }, 'italic', 0)} className="accent-cyan-500" /> Italic
        </label>
        <input type="color" value={text.colour} aria-label="Text colour" onChange={e => set({ colour: e.target.value }, 'colour')} className="w-7 h-6 rounded" />
      </div>
      <div className="flex gap-1">
        {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Icon]) => (
          <button key={a} type="button" aria-label={`Align ${a}`} aria-pressed={text.align === a} onClick={() => set({ align: a }, 'align', 0)}
            className={`flex-1 flex justify-center py-1 rounded-md ${text.align === a ? 'bg-cyan-700 text-white' : 'bg-slate-950 text-slate-400'}`}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
      <Range label="Size" value={Math.round(text.fontSize)} min={6} max={600} suffix=" px" onStart={startDrag} onChange={v => set({ fontSize: v }, 'size')} />
      <Range label="Line height" value={text.lineHeight} min={0.8} max={3} step={0.05} onStart={startDrag} onChange={v => set({ lineHeight: v }, 'line')} />
      <div className="flex items-center gap-2 text-[11px] text-slate-300">
        <span className="flex-1">Outline</span>
        <input type="color" value={text.strokeColour || '#000000'} aria-label="Outline colour" onChange={e => set({ strokeColour: e.target.value }, 'outline-colour')} className="w-7 h-6 rounded" />
      </div>
      <Range label="Outline width" value={text.strokeWidth} min={0} max={40} suffix=" px" onStart={startDrag} onChange={v => set({ strokeWidth: v }, 'outline')} />
      <Range label="Wrap width (0 = no wrapping)" value={Math.round(text.wrapWidth || 0)} min={0} max={Math.max(100, session.doc.width)} suffix=" px"
        onStart={startDrag} onChange={v => set({ wrapWidth: v || null }, 'wrap')} />
      <Range label="Rotation" value={Math.round(text.rotation || 0)} min={-180} max={180} suffix="°" onStart={startDrag} onChange={v => set({ rotation: v }, 'rotation')} />
      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        <input type="checkbox" checked={!!text.uppercase} onChange={e => set({ uppercase: e.target.checked }, 'upper', 0)} className="accent-cyan-500" /> All capitals
      </label>
    </section>
  );
}
