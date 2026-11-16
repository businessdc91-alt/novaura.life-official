// PhotoPanel.jsx — The Photo tab: adjustment layers you can change or remove later.

import React, { useRef, useState } from 'react';
import { Move, Pipette, SlidersHorizontal, Wand2 } from 'lucide-react';
import { useStudio } from './useStudio.js';
import CurvesEditor from './CurvesEditor.jsx';
import { getLayer } from '../../../creative/document.js';
import { addLayer, setLayerProps } from '../../../creative/edits.js';
import { ADJUSTMENTS, defaultParams } from '../../../creative/adjustments.js';
import { FILTERS, defaultFilterParams } from '../../../creative/filters/kernels.js';
import { applyFilter } from '../../../creative/applyFilter.js';

const FILTER_PARAM_LABELS = { amount: 'Amount', radius: 'Radius', threshold: 'Threshold', angle: 'Angle', distance: 'Distance', cell: 'Cell size', height: 'Height' };

function FilterSection({ store, session }) {
  const [open, setOpen] = useState(null);
  const [params, setParams] = useState({});
  const choose = (id) => { setOpen(id); setParams(defaultFilterParams(id)); };

  const run = async () => {
    const id = open;
    const label = FILTERS[id].label;
    const controller = new AbortController();
    const busy = progress => store.update({ busy: { label, progress, cancel: () => controller.abort() } });
    busy(0);
    const p = id === 'addNoise' ? { ...params, seed: Math.floor(Math.random() * 2 ** 31) } : params;
    const r = await applyFilter(session, id, p, { onProgress: busy, signal: controller.signal });
    store.update({ busy: null });
    if (!r.ok && !r.cancelled) store.notify(r.reason);
  };

  return (
    <Section title="Filters">
      <div className="grid grid-cols-2 gap-1">
        {Object.entries(FILTERS).map(([id, def]) => (
          <button key={id} type="button" data-filter={id} aria-pressed={open === id} onClick={() => choose(id)}
            className={`flex items-center gap-1 px-1.5 py-1.5 rounded-md text-[10.5px] text-left ${open === id ? 'bg-purple-700 text-white' : 'bg-slate-950 hover:bg-slate-800 text-slate-300'}`}>
            <Wand2 className="w-3 h-3 shrink-0" /><span className="truncate">{def.label}</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="space-y-2 rounded-md border border-slate-700 p-2">
          {Object.entries(FILTERS[open].params).filter(([, spec]) => spec.kind !== 'seed').map(([key, spec]) => (
            spec.kind === 'bool' ? (
              <label key={key} className="flex items-center gap-2 text-[11px] text-slate-300">
                <input type="checkbox" checked={!!params[key]} onChange={e => setParams({ ...params, [key]: e.target.checked })} className="accent-purple-500" />
                Same noise on every colour (mono)
              </label>
            ) : (
              <label key={key} className="block">
                <span className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>{FILTER_PARAM_LABELS[key] || key}</span><span className="tabular-nums text-slate-300">{params[key]}</span>
                </span>
                <input type="range" min={spec.min} max={spec.max} step={spec.step} value={params[key]}
                  onChange={e => setParams({ ...params, [key]: Number(e.target.value) })} className="w-full accent-purple-500" />
              </label>
            )
          ))}
          <button type="button" data-action="apply-filter" onClick={run}
            className="w-full py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold">
            Apply {FILTERS[open].label}
          </button>
          <p className="text-[10px] text-slate-500">Changes the selected pixel layer (or its mask). Undo brings it back.</p>
        </div>
      )}
    </Section>
  );
}

const PARAM_LABELS = {
  brightness: 'Brightness', contrast: 'Contrast', hue: 'Hue', saturation: 'Saturation', lightness: 'Lightness',
  vibrance: 'Vibrance', inBlack: 'Input black', inWhite: 'Input white', gamma: 'Midtones (gamma)', outBlack: 'Output black',
  outWhite: 'Output white', amount: 'Amount', level: 'Level', levels: 'Levels', radius: 'Radius', size: 'Size', softness: 'Softness',
};

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    {children}
  </section>
);

function AdjustmentSettings({ store, session, layer }) {
  const dragId = useRef(0);
  const def = ADJUSTMENTS[layer.adjust];
  const set = (params, key) => {
    const r = setLayerProps(session, layer.id, { params }, {
      tab: 'photo', label: def.label, mergeKey: `adjust:${layer.id}:${key}:${dragId.current}`, mergeWindowMs: 800,
    });
    if (!r.ok) store.notify(r.reason);
  };
  const entries = Object.entries(def.params);
  return (
    <Section title={`${def.label} settings`}>
      {!entries.length && <p className="text-[11px] text-slate-400">Nothing to set: it inverts everything beneath it.</p>}
      {entries.map(([key, spec]) => {
        if (spec.kind === 'curves') {
          return <CurvesEditor key={key} points={layer.params.points} onDragStart={() => { dragId.current += 1; }} onChange={points => set({ ...layer.params, points }, 'points')} />;
        }
        const value = layer.params[key];
        return (
          <label key={key} className="block">
            <span className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>{PARAM_LABELS[key] || key}</span>
              <span className="tabular-nums text-slate-300">{spec.step < 1 ? value.toFixed(2) : value}</span>
            </span>
            <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value} data-param={key}
              onPointerDown={() => { dragId.current += 1; }}
              onChange={e => set({ ...layer.params, [key]: Number(e.target.value) }, key)}
              className="w-full accent-purple-500" />
          </label>
        );
      })}
      <button type="button" onClick={() => set(defaultParams(layer.adjust), 'reset')}
        className="w-full py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px]">Reset</button>
    </Section>
  );
}

export default function PhotoPanel({ store }) {
  useStudio(store, s => s.version);
  const tool = useStudio(store, s => s.tool);
  const session = store.active();
  const layer = session ? getLayer(session.doc, session.doc.activeLayerId) : null;

  const add = (type) => {
    const r = addLayer(session, 'adjust', { adjust: type, params: defaultParams(type) }, { tab: 'photo', label: `Add ${ADJUSTMENTS[type].label}` });
    if (!r.ok) store.notify(r.reason);
  };

  return (
    <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/50 p-3 space-y-4 overflow-y-auto" aria-label="Photo tools">
      <Section title="Tools">
        <div className="grid grid-cols-2 gap-1.5">
          {[['move', 'Move', Move], ['eyedropper', 'Eyedropper', Pipette]].map(([id, label, Icon]) => (
            <button key={id} type="button" data-tool={id} aria-pressed={tool === id} onClick={() => store.setTool(id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold ${tool === id ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Add an adjustment layer">
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(ADJUSTMENTS).map(([id, def]) => (
            <button key={id} type="button" data-add-adjustment={id} onClick={() => add(id)}
              className="flex items-center gap-1 px-1.5 py-1.5 rounded-md bg-slate-950 hover:bg-slate-800 text-[10.5px] text-slate-300 text-left">
              <SlidersHorizontal className="w-3 h-3 shrink-0 text-purple-400" />
              <span className="truncate">{def.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">Each one changes everything beneath it and can be edited, masked or removed later.</p>
      </Section>

      {layer?.kind === 'adjust' && <AdjustmentSettings store={store} session={session} layer={layer} />}

      {session && <FilterSection store={store} session={session} />}
    </aside>
  );
}
