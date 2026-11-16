// LayersPanel.jsx — The layer stack, top layer first: thumbnails, names (double-click to
// rename), visibility and lock, opacity and blend mode for the selected layer, and
// buttons to add, duplicate, delete, merge and reorder. Rows can be dragged to reorder.
// Every change is one history step; refusals (a locked layer) show their reason.
//
// Masks: click the mask thumbnail to paint the mask, Shift-click to turn it off or on,
// Alt-click to view it alone. Add mask reveals all; Alt+Add mask hides all.

import React, { useEffect, useRef, useState } from 'react';
import {
  Eye, EyeOff, Lock, LockOpen, Plus, Copy, Trash2, Merge, ChevronUp, ChevronDown, Layers,
  SquareDashed, FlipHorizontal2, Stamp, X,
} from 'lucide-react';
import { useStudio } from './useStudio.js';
import { BLEND_MODES, blendLabel } from '../../../creative/blendModes.js';
import { surfaceOf } from '../../../creative/document.js';
import { rasterizeLayer } from '../../../creative/compositor.js';
import {
  addLayer, deleteLayer, duplicateLayer, mergeDown, moveLayerTo, setLayerProps, setActiveLayer,
  addMask, deleteMask, invertMask, applyMask, setMaskEnabled,
} from '../../../creative/edits.js';

const THUMB_W = 44;
const THUMB_H = 32;

function Thumbnail({ doc, layer }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, THUMB_W, THUMB_H);
    const scale = Math.min(THUMB_W / doc.width, THUMB_H / doc.height);
    const w = doc.width * scale;
    const h = doc.height * scale;
    const ox = (THUMB_W - w) / 2;
    const oy = (THUMB_H - h) / 2;
    ctx.fillStyle = '#e4e4e7';
    ctx.fillRect(ox, oy, w, h);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    if (layer.kind === 'pixel') {
      const surface = surfaceOf(doc, layer);
      if (surface?.canvas) ctx.drawImage(surface.canvas, layer.x, layer.y);
    } else if (layer.kind !== 'adjust') {
      const { surface, x, y } = rasterizeLayer(doc, layer);
      if (surface.canvas) ctx.drawImage(surface.canvas, x, y);
    }
    ctx.restore();
  }, [doc, layer, layer.rev]);
  return <canvas ref={ref} width={THUMB_W} height={THUMB_H} className="rounded-sm border border-slate-700 shrink-0" aria-hidden="true" />;
}

function MaskThumbnail({ doc, layer, targeted, onClick }) {
  const ref = useRef(null);
  const mask = layer.mask;
  useEffect(() => {
    const canvas = ref.current;
    const grey = surfaceOf(doc, layer, 'mask');
    if (!canvas || !grey?.canvas) return;
    const ctx = canvas.getContext('2d');
    const scale = Math.min(THUMB_W / doc.width, THUMB_H / doc.height);
    const ox = (THUMB_W - doc.width * scale) / 2;
    const oy = (THUMB_H - doc.height * scale) / 2;
    const d = mask.defaultValue;
    ctx.clearRect(0, 0, THUMB_W, THUMB_H);
    ctx.fillStyle = `rgb(${d}, ${d}, ${d})`;
    ctx.fillRect(ox, oy, doc.width * scale, doc.height * scale);
    ctx.drawImage(grey.canvas, ox + mask.x * scale, oy + mask.y * scale, grey.width * scale, grey.height * scale);
  }, [doc, layer, mask, layer.rev]);
  return (
    <button
      type="button" data-action="mask-thumb" aria-pressed={targeted}
      title="Mask: click to paint it, Shift-click to turn it off or on, Alt-click to view it alone"
      onClick={onClick}
      className={`relative shrink-0 rounded-sm ${targeted ? 'ring-2 ring-amber-400' : ''}`}
    >
      <canvas ref={ref} width={THUMB_W} height={THUMB_H} className="block rounded-sm border border-slate-700" aria-hidden="true" />
      {mask.enabled === false && <X className="absolute inset-0 m-auto w-5 h-5 text-red-500" aria-label="Mask turned off" />}
    </button>
  );
}

function LayerName({ layer, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layer.name);
  if (!editing) {
    return (
      <span
        data-layer-name="" className="flex-1 min-w-0 truncate text-[12px]" title="Double-click to rename"
        onDoubleClick={(e) => { e.stopPropagation(); setDraft(layer.name); setEditing(true); }}
      >
        {layer.name}
      </span>
    );
  }
  const finish = (save) => {
    setEditing(false);
    if (save && draft.trim() && draft !== layer.name) onRename(draft.trim());
  };
  return (
    <input
      autoFocus value={draft} aria-label="Layer name"
      onFocus={e => e.target.select()}
      onChange={e => setDraft(e.target.value)}
      onClick={e => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
      className="flex-1 min-w-0 bg-slate-950 border border-cyan-600 rounded px-1 py-0.5 text-[12px] outline-none"
    />
  );
}

const IconButton = ({ action, label, onClick, disabled, children }) => (
  <button
    type="button" data-action={action} title={label} aria-label={label} disabled={disabled}
    onClick={onClick}
    className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {children}
  </button>
);

export default function LayersPanel({ store }) {
  useStudio(store, s => s.version);
  const tab = useStudio(store, s => s.tab);
  const session = store.active();
  const dragRef = useRef(null);
  const sliderDrag = useRef(0);
  if (!session) return null;
  const { doc } = session;
  const meta = extra => ({ tab, ...extra });
  const active = doc.layers.find(l => l.id === doc.activeLayerId) || null;
  const activeIndex = active ? doc.layers.indexOf(active) : -1;
  const report = (result) => { if (result && !result.ok) store.notify(result.reason); return result; };
  const select = (id, target = 'layer') => { setActiveLayer(session, id, target); store.bump(); };
  const maskView = store.getState().maskView;

  const onMaskThumb = (e, layer) => {
    e.stopPropagation();
    if (e.shiftKey) { report(setMaskEnabled(session, layer.id, layer.mask.enabled === false, meta({}))); return; }
    if (e.altKey) { store.update({ maskView: maskView === layer.id ? null : layer.id }); return; }
    select(layer.id, 'mask');
  };

  const onOpacity = (e) => {
    const value = Number(e.target.value) / 100;
    report(setLayerProps(session, active.id, { opacity: value }, meta({ mergeKey: `opacity:${active.id}:${sliderDrag.current}`, mergeWindowMs: sliderDrag.current ? undefined : 500 })));
  };

  const onBlend = (e) => {
    report(setLayerProps(session, active.id, { blend: e.target.value, psdBlend: null }, meta({ label: 'Blend mode' })));
  };

  const rows = [...doc.layers].reverse();

  return (
    <section className="flex flex-col min-h-0" aria-label="Layers">
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <Layers className="w-3 h-3" /> Layers
        </h3>
      </div>

      {active && (
        <div className="px-3 pb-2 space-y-2">
          <select
            data-blend-select="" aria-label="Blend mode" value={active.psdBlend ? '' : active.blend} onChange={onBlend}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px]"
          >
            {active.psdBlend && <option value="" disabled>{blendLabel(active)}</option>}
            {BLEND_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[11px] text-slate-400">
            Opacity
            <input
              type="range" min={0} max={100} value={Math.round(active.opacity * 100)}
              data-opacity-slider="" aria-label="Opacity"
              onPointerDown={() => { sliderDrag.current = Date.now(); }}
              onPointerUp={() => { sliderDrag.current = 0; }}
              onChange={onOpacity}
              className="flex-1 accent-cyan-500"
            />
            <span data-opacity-value="" className="w-9 text-right tabular-nums text-slate-300">{Math.round(active.opacity * 100)}%</span>
          </label>
        </div>
      )}

      {active?.mask && (
        <div className="mx-3 mb-2 flex items-center gap-1 rounded-md border border-amber-700/40 bg-amber-950/20 px-1.5 py-1 text-[10px] text-amber-200" aria-label="Mask">
          <span className="flex-1 truncate">{doc.activeTarget === 'mask' ? 'Painting the mask' : 'Mask'}</span>
          <IconButton action="toggle-mask" label={active.mask.enabled === false ? 'Turn mask on' : 'Turn mask off'}
            onClick={() => report(setMaskEnabled(session, active.id, active.mask.enabled === false, meta({})))}>
            {active.mask.enabled === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </IconButton>
          <IconButton action="view-mask" label={maskView === active.id ? 'Stop viewing the mask' : 'View the mask alone'}
            onClick={() => store.update({ maskView: maskView === active.id ? null : active.id })}>
            <SquareDashed className={`w-3.5 h-3.5 ${maskView === active.id ? 'text-amber-300' : ''}`} />
          </IconButton>
          <IconButton action="invert-mask" label="Invert mask" onClick={() => report(invertMask(session, active.id, meta({})))}>
            <FlipHorizontal2 className="w-3.5 h-3.5" />
          </IconButton>
          {active.kind === 'pixel' && (
            <IconButton action="apply-mask" label="Apply mask to the layer" onClick={() => report(applyMask(session, active.id, meta({})))}>
              <Stamp className="w-3.5 h-3.5" />
            </IconButton>
          )}
          <IconButton action="delete-mask" label="Delete mask" onClick={() => report(deleteMask(session, active.id, meta({})))}>
            <Trash2 className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      )}

      <ul className="flex-1 min-h-0 overflow-y-auto px-2 space-y-0.5" role="listbox" aria-label="Layer stack">
        {rows.map((layer) => {
          const index = doc.layers.indexOf(layer);
          const isActive = layer.id === doc.activeLayerId;
          return (
            <li
              key={layer.id} role="option" aria-selected={isActive}
              data-layer-id={layer.id} data-visible={String(layer.visible)} data-locked={String(layer.locked)}
              draggable
              onDragStart={(e) => { dragRef.current = layer.id; e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragRef.current;
                dragRef.current = null;
                if (from && from !== layer.id) report(moveLayerTo(session, from, index, meta({})));
              }}
              onClick={() => select(layer.id)}
              className={`flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer ${isActive ? 'bg-cyan-900/40 ring-1 ring-cyan-700/60' : 'hover:bg-slate-800/60'} ${layer.visible ? '' : 'opacity-50'}`}
            >
              <button
                type="button" data-action="toggle-visible" aria-pressed={layer.visible}
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                onClick={(e) => { e.stopPropagation(); report(setLayerProps(session, layer.id, { visible: !layer.visible }, meta({}))); }}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <span
                className={`shrink-0 rounded-sm ${isActive && doc.activeTarget === 'layer' && layer.mask ? 'ring-2 ring-cyan-400' : ''}`}
                onClick={(e) => { e.stopPropagation(); select(layer.id, 'layer'); }}
              >
                <Thumbnail doc={doc} layer={layer} />
              </span>
              {layer.mask && (
                <MaskThumbnail doc={doc} layer={layer} targeted={isActive && doc.activeTarget === 'mask'} onClick={e => onMaskThumb(e, layer)} />
              )}
              <LayerName layer={layer} onRename={name => report(setLayerProps(session, layer.id, { name }, meta({})))} />
              <button
                type="button" data-action="toggle-lock" aria-pressed={layer.locked}
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                onClick={(e) => { e.stopPropagation(); report(setLayerProps(session, layer.id, { locked: !layer.locked }, meta({}))); }}
                className={`p-0.5 ${layer.locked ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'}`}
              >
                {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between px-2 py-1.5 border-t border-slate-800">
        <IconButton action="new-layer" label="New layer" onClick={() => report(addLayer(session, 'pixel', {}, meta({})))}>
          <Plus className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton action="duplicate-layer" label="Duplicate layer" disabled={!active} onClick={() => report(duplicateLayer(session, active.id, meta({})))}>
          <Copy className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton action="merge-down" label="Merge down" disabled={activeIndex < 1}
          onClick={async () => report(await mergeDown(session, active.id, meta({})))}>
          <Merge className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton action="layer-up" label="Move layer up" disabled={!active || activeIndex >= doc.layers.length - 1}
          onClick={() => report(moveLayerTo(session, active.id, activeIndex + 1, meta({})))}>
          <ChevronUp className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton action="layer-down" label="Move layer down" disabled={!active || activeIndex < 1}
          onClick={() => report(moveLayerTo(session, active.id, activeIndex - 1, meta({})))}>
          <ChevronDown className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton action="add-mask" label="Add mask (Alt: hide all)" disabled={!active || !!active?.mask}
          onClick={e => report(addMask(session, active.id, !e.altKey, meta({})))}>
          <SquareDashed className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton action="delete-layer" label="Delete layer" disabled={!active || doc.layers.length < 2}
          onClick={() => report(deleteLayer(session, active.id, meta({})))}>
          <Trash2 className="w-3.5 h-3.5" />
        </IconButton>
      </div>
    </section>
  );
}
