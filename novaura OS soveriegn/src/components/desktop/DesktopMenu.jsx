import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

/**
 * Glass context menu. entries: { label, icon?, onClick, danger?, checked?, disabled? }
 * | { section: 'Title' } | { divider: true }. Clamped to the viewport.
 */
export function DesktopMenu({ x, y, title, color, entries, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
  }, [x, y, entries.length]);

  return (
    <div
      ref={ref}
      style={{ top: pos.y, left: pos.x }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="fixed z-[9999] w-56 max-h-[80vh] overflow-y-auto bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 shadow-2xl shadow-black/80 rounded-xl p-1.5 flex flex-col gap-0.5 text-xs text-slate-200 animate-in fade-in duration-100"
    >
      {title && (
        <div className="px-2.5 py-1.5 mb-0.5 border-b border-slate-800 flex items-center gap-2">
          {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />}
          <span className="font-semibold text-white truncate">{title}</span>
        </div>
      )}
      {entries.map((e, i) => {
        if (e.divider) return <div key={i} className="my-1 border-t border-slate-800" />;
        if (e.section) return <div key={i} className="px-2.5 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{e.section}</div>;
        const Icon = e.icon;
        return (
          <button
            key={i}
            disabled={e.disabled}
            onClick={() => { onClose(); e.onClick(); }}
            className={`w-full px-2.5 py-1.5 text-left rounded-lg flex items-center gap-2 transition-colors disabled:opacity-40 disabled:pointer-events-none ${
              e.danger ? 'text-rose-300 hover:bg-rose-500/20' : 'hover:bg-cyan-500/15 hover:text-cyan-200'
            }`}
          >
            {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" style={e.color ? { color: e.color } : undefined} /> : <span className="w-3.5" />}
            <span className="flex-1 truncate">{e.label}</span>
            {e.checked && <Check className="w-3.5 h-3.5 text-cyan-300" />}
          </button>
        );
      })}
    </div>
  );
}

/** Small centered prompt for a name (new folder, new bubble, rename). */
export function NameDialog({ title, initial = '', confirmLabel = 'Save', onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.select(); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30" onMouseDown={onCancel} onClick={(e) => e.stopPropagation()}>
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-80 p-4 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-2xl space-y-3"
      >
        <div className="text-sm font-semibold text-white">{title}</div>
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 outline-none focus:border-cyan-500"
        />
        <div className="flex justify-end gap-2 text-xs">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium">{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}
