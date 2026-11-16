// CreativeStudioWindow.jsx — The Creative Studio: a layered image editor.
//
// Paint, Photo and Meme are three workspaces over the same layered document, with
// one undo history per document. The engine lives in src/creative/; the panels in
// ./creative/. Keyboard shortcuts act only while focus is inside this window and not
// in a text box.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Palette, Image as ImageIcon, Smile } from 'lucide-react';
import { createStudioStore } from '../../creative/studioStore.js';
import { shouldHandleShortcut, historyActionFor, studioActionFor, nextBrushSize } from '../../creative/shortcuts.js';
import { TOOLS, toolForKey, toolContext } from '../../creative/tools/index.js';
import { useStudio } from './creative/useStudio.js';
import CanvasView from './creative/CanvasView.jsx';
import PaintPanel from './creative/PaintPanel.jsx';
import LayersPanel from './creative/LayersPanel.jsx';
import HistoryPanel from './creative/HistoryPanel.jsx';
import { makeOverlay } from './creative/canvasOverlay.js';
import '../../creative/tools/shape.js';
import '../../creative/tools/gradient.js';
import '../../creative/tools/text.js';
import PhotoPanel from './creative/PhotoPanel.jsx';
import MemePanel from './creative/MemePanel.jsx';
import DocumentTabs from './creative/DocumentTabs.jsx';
import NewDocumentDialog from './creative/NewDocumentDialog.jsx';
import ConfirmCloseDialog from './creative/ConfirmCloseDialog.jsx';

const TABS = [
  { id: 'paint', label: 'Paint', icon: Palette, on: 'bg-cyan-600' },
  { id: 'photo', label: 'Photo', icon: ImageIcon, on: 'bg-purple-600' },
  { id: 'meme', label: 'Meme', icon: Smile, on: 'bg-pink-600' },
];

function runHistory(store, action) {
  const session = store.active();
  if (!session) return;
  if (action === 'undo') session.history.undo(); else session.history.redo();
  session.compositor.invalidate();
}

/** Studio keyboard shortcuts; returns true when the key was used. */
function handleKey(store, e) {
  if (!shouldHandleShortcut(e)) return false;
  const busy = store.getState().busy;
  if (busy) {
    if (e.key === 'Escape') { busy.cancel?.(); return true; }
    return false; // nothing else while a filter runs
  }
  const history = historyActionFor(e);
  if (history) { runHistory(store, history); return true; }
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const state = store.getState();
  const tool = TOOLS[state.tool];
  if (tool?.key && tool.key(toolContext(store), e)) return true;
  const action = studioActionFor(e);
  if (action === 'swapColours') {
    store.update({ colours: { primary: state.colours.secondary, secondary: state.colours.primary } });
    return true;
  }
  if (action === 'brushSmaller' || action === 'brushLarger') {
    store.update({ brush: { size: nextBrushSize(state.brush.size, action === 'brushLarger' ? 1 : -1) } });
    return true;
  }
  const next = toolForKey(e);
  if (next) { store.setTool(next); return true; }
  return false;
}

export default function CreativeStudioWindow() {
  const [store] = useState(() => {
    const s = createStudioStore();
    s.newDocument({ name: 'Untitled', width: 1920, height: 1080, background: 'white' });
    return s;
  });
  const rootRef = useRef(null);
  const [overlay] = useState(() => makeOverlay(store));
  const tab = useStudio(store, s => s.tab);
  const notice = useStudio(store, s => s.notice);
  const busy = useStudio(store, s => s.busy);
  const hasDocument = useStudio(store, s => s.activeId) !== null;
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [closing, setClosing] = useState(null);
  const [dismissedId, setDismissedId] = useState(null);

  const requestClose = (session) => {
    if (session.dirty) setClosing(session);
    else store.closeDocument(session.id);
  };
  // Saving arrives with the project file format; until then a document can be kept or discarded.
  const saveAndClose = () => {
    store.notify('Saving projects arrives with the project file format.');
    setClosing(null);
  };
  const shownNotice = notice && notice.id !== dismissedId ? notice.text : null;

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setDismissedId(notice.id), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const onKeyDown = (e) => {
    if (handleKey(store, e)) e.preventDefault();
  };

  // When a clicked button disables itself (Add mask, Delete layer), the browser drops focus
  // to the page body. While the studio was the last thing clicked, its keys still work.
  const lastClickInside = useRef(false);
  const studioActive = useCallback(() => {
    const focused = document.activeElement;
    return rootRef.current?.contains(focused) || ((!focused || focused === document.body) && lastClickInside.current);
  }, []);
  useEffect(() => {
    const onPointerDown = (e) => { lastClickInside.current = !!rootRef.current?.contains(e.target); };
    const onBodyKey = (e) => {
      const focused = document.activeElement;
      if (focused && focused !== document.body) return; // focused inside the studio (handled there) or elsewhere
      if (lastClickInside.current && handleKey(store, e)) e.preventDefault();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onBodyKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onBodyKey);
    };
  }, [store]);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-creative-studio=""
      className="relative h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden outline-none"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center shrink-0">
            <Palette className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white leading-tight">Creative Studio</h2>
            <p className="text-[11px] text-slate-400 truncate">Layered painting, photo editing and memes</p>
          </div>
        </div>
        <div role="tablist" aria-label="Workspace" className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
          {TABS.map(({ id, label, icon: Icon, on }) => (
            <button
              key={id} type="button" role="tab" aria-selected={tab === id} data-tab={id}
              onClick={() => store.setTab(id)}
              className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition-colors ${tab === id ? `${on} text-white` : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <DocumentTabs store={store} onNew={() => setNewDocOpen(true)} onClose={requestClose} />

      <div className="flex-1 min-h-0 flex">
        {tab === 'paint' && <PaintPanel store={store} />}
        {tab === 'photo' && <PhotoPanel store={store} />}
        {tab === 'meme' && <MemePanel store={store} />}
        {hasDocument ? (
          <CanvasView store={store} rootRef={rootRef} overlay={overlay} isActive={studioActive} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#0b0f19]">
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-400">No document open.</p>
              <button type="button" data-action="new-document-empty" onClick={() => setNewDocOpen(true)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold">New document</button>
            </div>
          </div>
        )}
        <aside className="w-64 shrink-0 border-l border-slate-800 bg-slate-900/50 flex flex-col min-h-0">
          <div className="flex-[3] min-h-0 flex flex-col"><LayersPanel store={store} /></div>
          <div className="flex-[2] min-h-0 flex flex-col border-t border-slate-800"><HistoryPanel store={store} /></div>
        </aside>
      </div>

      {newDocOpen && (
        <NewDocumentDialog
          onCancel={() => setNewDocOpen(false)}
          onCreate={(opts) => { store.newDocument(opts); setNewDocOpen(false); }}
        />
      )}
      {closing && (
        <ConfirmCloseDialog
          name={closing.doc.name}
          onCancel={() => setClosing(null)}
          onDiscard={() => { store.closeDocument(closing.id); setClosing(null); }}
          onSave={saveAndClose}
        />
      )}

      {busy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/50" data-busy="">
          <div role="status" className="w-72 rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-2xl">
            <p className="text-sm font-semibold text-white">Applying {busy.label}…</p>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-purple-500 transition-[width]" style={{ width: `${Math.round((busy.progress || 0) * 100)}%` }} />
            </div>
            <button type="button" data-action="cancel-busy" onClick={() => busy.cancel?.()}
              className="w-full py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs">Cancel (Esc)</button>
          </div>
        </div>
      )}

      {shownNotice && (
        <div role="status" className="absolute left-1/2 -translate-x-1/2 bottom-6 px-4 py-2 rounded-lg bg-slate-800/95 border border-slate-600 text-xs text-slate-100 shadow-xl">
          {shownNotice}
        </div>
      )}
    </div>
  );
}
