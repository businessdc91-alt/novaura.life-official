// ShapeProperties.jsx — Settings for new shapes (when the shape tool is chosen), and the
// fill, outline, corners, sides and rotation of the selected shape layer.

import React, { useRef } from 'react';
import { Square, Circle, Minus, Hexagon, Star } from 'lucide-react';
import { useStudio } from './useStudio.js';
import { getLayer } from '../../../creative/document.js';
import { setLayerProps } from '../../../creative/edits.js';

const KINDS = [
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'polygon', label: 'Polygon', icon: Hexagon },
  { id: 'star', label: 'Star', icon: Star },
];

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

function Colour({ label, value, enabled, onToggle, onChange }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-300">
      <label className="flex items-center gap-1.5 flex-1">
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} className="accent-cyan-500" />
        {label}
      </label>
      <input type="color" value={value || '#000000'} disabled={!enabled} onChange={e => onChange(e.target.value)}
        aria-label={`${label} colour`} className="w-7 h-6 rounded disabled:opacity-30" />
    </div>
  );
}

export default function ShapeProperties({ store }) {
  useStudio(store, s => s.version);
  const tool = useStudio(store, s => s.tool);
  const settings = useStudio(store, s => s.shape);
  const colours = useStudio(store, s => s.colours);
  const dragId = useRef(0);
  const session = store.active();
  const layer = session ? getLayer(session.doc, session.doc.activeLayerId) : null;
  const shape = layer?.kind === 'shape' ? layer : null;
  if (tool !== 'shape' && !shape) return null;

  const set = (patch, key) => {
    const r = setLayerProps(session, shape.id, patch, {
      tab: store.getState().tab, label: 'Shape properties',
      mergeKey: `shapeprop:${shape.id}:${key}:${dragId.current}`, mergeWindowMs: 1000,
    });
    if (!r.ok) store.notify(r.reason);
  };
  const startDrag = () => { dragId.current += 1; };

  return (
    <div className="space-y-4">
      {tool === 'shape' && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">New shape</h3>
          <div className="grid grid-cols-5 gap-1">
            {KINDS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" title={label} aria-label={label} aria-pressed={settings.kind === id} data-shape-kind={id}
                onClick={() => store.update({ shape: { kind: id } })}
                className={`flex items-center justify-center py-1.5 rounded-md ${settings.kind === id ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={settings.stroke} onChange={e => store.update({ shape: { stroke: e.target.checked } })} className="accent-cyan-500" />
            Outline in the second colour
          </label>
          <p className="text-[10px] text-slate-500">Drag to draw; hold Shift for a square or circle. Fill uses the main colour ({colours.primary}).</p>
        </section>
      )}

      {shape && (
        <section className="space-y-2" aria-label="Selected shape">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selected shape</h3>
          {shape.shape !== 'line' && (
            <Colour label="Fill" value={shape.fill} enabled={!!shape.fill}
              onToggle={on => set({ fill: on ? colours.primary : null }, 'fill-on')} onChange={v => set({ fill: v }, 'fill')} />
          )}
          <Colour label="Outline" value={shape.stroke} enabled={!!shape.stroke}
            onToggle={on => set({ stroke: on ? colours.secondary : null, strokeWidth: on ? Math.max(1, shape.strokeWidth || 4) : shape.strokeWidth }, 'stroke-on')}
            onChange={v => set({ stroke: v }, 'stroke')} />
          {shape.stroke && (
            <Range label="Outline width" value={shape.strokeWidth} min={1} max={200} suffix=" px" onStart={startDrag} onChange={v => set({ strokeWidth: v }, 'width')} />
          )}
          {shape.shape === 'rect' && (
            <Range label="Corner radius" value={Math.round(shape.radius || 0)} min={0} max={Math.max(1, Math.floor(Math.min(shape.w, shape.h) / 2))}
              suffix=" px" onStart={startDrag} onChange={v => set({ radius: v }, 'radius')} />
          )}
          {(shape.shape === 'polygon' || shape.shape === 'star') && (
            <Range label={shape.shape === 'star' ? 'Points' : 'Sides'} value={shape.sides} min={3} max={64} onStart={startDrag} onChange={v => set({ sides: v }, 'sides')} />
          )}
          {shape.shape === 'star' && (
            <Range label="Inner size" value={Math.round(shape.innerRatio * 100)} min={10} max={95} suffix="%" onStart={startDrag}
              onChange={v => set({ innerRatio: v / 100 }, 'inner')} />
          )}
          {shape.shape !== 'line' && (
            <Range label="Rotation" value={Math.round(shape.rotation || 0)} min={-180} max={180} suffix="°" onStart={startDrag}
              onChange={v => set({ rotation: v }, 'rotation')} />
          )}
        </section>
      )}
    </div>
  );
}
