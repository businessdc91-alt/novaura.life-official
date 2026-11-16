// HistoryPanel.jsx — Every step of the active document, newest last. Clicking a step goes
// back (or forward) to it and switches to the tab it came from.

import React, { useEffect, useRef } from 'react';
import { History, Palette, Image as ImageIcon, Smile, FilePlus } from 'lucide-react';
import { useStudio } from './useStudio.js';

const TAB = {
  paint: { label: 'Paint', icon: Palette },
  photo: { label: 'Photo', icon: ImageIcon },
  meme: { label: 'Meme', icon: Smile },
};

const stepTitle = step => `${TAB[step.tab]?.label || 'Edit'} · ${step.label}`;

export default function HistoryPanel({ store }) {
  useStudio(store, s => s.version);
  const session = store.active();
  const listRef = useRef(null);
  const steps = session?.history.steps || [];
  const cursor = session?.history.cursor ?? 0;

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor, steps.length]);

  const jump = (count, tab) => {
    if (!session) return;
    session.history.jumpTo(count);
    session.compositor.invalidate();
    if (tab) store.setTab(tab);
  };

  const row = (index, title, Icon, tab) => {
    const count = index + 1;
    const current = count === cursor;
    const undone = count > cursor;
    return (
      <li key={index}>
        <button
          type="button" data-step-index={index} aria-current={current ? 'step' : undefined}
          onClick={() => jump(count, tab)}
          className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-[11px] transition-colors ${
            current ? 'bg-cyan-900/50 text-cyan-100' : undone ? 'text-slate-600 hover:bg-slate-800/60' : 'text-slate-300 hover:bg-slate-800/60'}`}
        >
          <Icon className="w-3 h-3 shrink-0" />
          <span className="truncate">{title}</span>
        </button>
      </li>
    );
  };

  return (
    <section className="flex flex-col min-h-0" aria-label="History">
      <h3 className="flex items-center gap-1.5 px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <History className="w-3 h-3" /> History
      </h3>
      <ol ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
        {row(-1, 'New document', FilePlus, null)}
        {steps.map((step, i) => row(i, stepTitle(step), TAB[step.tab]?.icon || Palette, step.tab))}
      </ol>
    </section>
  );
}
