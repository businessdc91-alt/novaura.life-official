// PaintPanel.jsx — The Paint tab's tools, colours and brush settings.

import React from 'react';
import { Brush, Pencil, Eraser, PaintBucket, Pipette, Move, Undo2, Redo2, ArrowLeftRight } from 'lucide-react';
import { useStudio } from './useStudio.js';

const TOOL_BUTTONS = [
  { id: 'brush', label: 'Brush', key: 'B', icon: Brush },
  { id: 'pencil', label: 'Pencil', key: 'N', icon: Pencil },
  { id: 'eraser', label: 'Eraser', key: 'E', icon: Eraser },
  { id: 'fill', label: 'Fill', key: 'G', icon: PaintBucket },
  { id: 'eyedropper', label: 'Eyedropper', key: 'I', icon: Pipette },
  { id: 'move', label: 'Move', key: 'V', icon: Move },
];

const SWATCHES = ['#000000', '#ffffff', '#06b6d4', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

function Slider({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] text-slate-400 mb-1">
        <span>{label}</span>
        <span className="tabular-nums text-slate-300">{value}{suffix}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-cyan-500"
      />
    </label>
  );
}

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    {children}
  </section>
);

export function HistoryButtons({ store }) {
  useStudio(store, s => s.version);
  const session = store.active();
  const run = (action) => {
    if (!session) return;
    if (action === 'undo') session.history.undo(); else session.history.redo();
    session.compositor.invalidate();
  };
  return (
    <div className="flex gap-1.5">
      <button type="button" onClick={() => run('undo')} disabled={!session?.history.canUndo()} title="Undo (Ctrl+Z)"
        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs">
        <Undo2 className="w-3.5 h-3.5" /> Undo
      </button>
      <button type="button" onClick={() => run('redo')} disabled={!session?.history.canRedo()} title="Redo (Ctrl+Shift+Z)"
        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs">
        <Redo2 className="w-3.5 h-3.5" /> Redo
      </button>
    </div>
  );
}

export default function PaintPanel({ store }) {
  const tool = useStudio(store, s => s.tool);
  const colours = useStudio(store, s => s.colours);
  const brush = useStudio(store, s => s.brush);
  const fill = useStudio(store, s => s.fill);
  const eyedropper = useStudio(store, s => s.eyedropper);
  const painting = tool === 'brush' || tool === 'pencil' || tool === 'eraser';

  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900/50 p-3 space-y-4 overflow-y-auto" aria-label="Paint tools">
      <Section title="Tools">
        <div className="grid grid-cols-3 gap-1.5">
          {TOOL_BUTTONS.map(({ id, label, key, icon: Icon }) => (
            <button
              key={id} type="button" data-tool={id} aria-pressed={tool === id} title={`${label} (${key})`}
              onClick={() => store.setTool(id)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-semibold transition-colors ${
                tool === id ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Colour">
        <div className="flex items-center gap-2">
          <label className="relative" title="Main colour">
            <span className="block w-9 h-9 rounded-lg border border-slate-600" style={{ background: colours.primary }} />
            <input type="color" value={colours.primary} onChange={e => store.update({ colours: { primary: e.target.value } })}
              className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Main colour" />
          </label>
          <button type="button" title="Swap colours (X)" aria-label="Swap colours"
            onClick={() => store.update({ colours: { primary: colours.secondary, secondary: colours.primary } })}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
          <label className="relative" title="Second colour">
            <span className="block w-7 h-7 rounded-md border border-slate-600" style={{ background: colours.secondary }} />
            <input type="color" value={colours.secondary} onChange={e => store.update({ colours: { secondary: e.target.value } })}
              className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Second colour" />
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {SWATCHES.map(c => (
            <button key={c} type="button" aria-label={`Use ${c}`} onClick={() => store.update({ colours: { primary: c } })}
              className="w-5 h-5 rounded-full border border-slate-700 hover:scale-110 transition-transform" style={{ background: c }} />
          ))}
        </div>
      </Section>

      {painting && (
        <Section title={tool === 'eraser' ? 'Eraser' : tool === 'pencil' ? 'Pencil' : 'Brush'}>
          <Slider label="Size" value={brush.size} min={1} max={500} suffix=" px" onChange={size => store.update({ brush: { size } })} />
          {tool !== 'pencil' && (
            <Slider label="Hardness" value={Math.round(brush.hardness * 100)} min={0} max={100} suffix="%"
              onChange={v => store.update({ brush: { hardness: v / 100 } })} />
          )}
          <Slider label="Opacity" value={Math.round(brush.opacity * 100)} min={1} max={100} suffix="%"
            onChange={v => store.update({ brush: { opacity: v / 100 } })} />
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={brush.pressure} onChange={e => store.update({ brush: { pressure: e.target.checked } })} className="accent-cyan-500" />
            Pen pressure changes size
          </label>
        </Section>
      )}

      {tool === 'fill' && (
        <Section title="Fill">
          <Slider label="Tolerance" value={fill.tolerance} min={0} max={255} onChange={tolerance => store.update({ fill: { tolerance } })} />
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={fill.contiguous} onChange={e => store.update({ fill: { contiguous: e.target.checked } })} className="accent-cyan-500" />
            Only the connected area
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={fill.sampleAll} onChange={e => store.update({ fill: { sampleAll: e.target.checked } })} className="accent-cyan-500" />
            Match the whole picture
          </label>
        </Section>
      )}

      {tool === 'eyedropper' && (
        <Section title="Eyedropper">
          <select value={eyedropper.sample} onChange={e => store.update({ eyedropper: { sample: e.target.value } })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
            <option value="composite">Pick from the whole picture</option>
            <option value="layer">Pick from the current layer</option>
          </select>
        </Section>
      )}

      <Section title="History">
        <HistoryButtons store={store} />
      </Section>
    </aside>
  );
}
