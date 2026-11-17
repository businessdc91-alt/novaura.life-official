// CreativeStudioWindow.jsx — The Creative Studio: a layered image editor.
//
// Paint, Photo and Meme are three workspaces over the same layered document, with
// one undo history per document. The engine lives in src/creative/; the panels in
// ./creative/. Keyboard shortcuts act only while focus is inside this window and not
// in a text box.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Palette, Image as ImageIcon, Smile } from 'lucide-react';
import { createStudioStore } from '../../creative/studioStore.js';
import { shouldHandleShortcut, historyActionFor, ctrlActionFor, studioActionFor, nextBrushSize } from '../../creative/shortcuts.js';
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
import '../../creative/tools/selection.js';
import '../../creative/tools/crop.js';
import PhotoPanel from './creative/PhotoPanel.jsx';
import MemePanel from './creative/MemePanel.jsx';
import DocumentTabs from './creative/DocumentTabs.jsx';
import NewDocumentDialog from './creative/NewDocumentDialog.jsx';
import ResizeDialog from './creative/ResizeDialog.jsx';
import ConfirmCloseDialog from './creative/ConfirmCloseDialog.jsx';
import StatusBar from './creative/StatusBar.jsx';
import { loadBudgets } from '../../creative/memory.js';
import FileMenu from './creative/FileMenu.jsx';
import ExportDialog from './creative/ExportDialog.jsx';
import {
  selectAll, clearSelection, invertSelection, clearSelectedPixels,
  copySelectedPixels, cutSelectedPixels, pastePixels, groupLayer, ungroupLayer,
} from '../../creative/edits.js';
import { openFileBlob, saveProject, downloadProject, openVaultFile } from '../../creative/io/projectFiles.js';
import { classifyDrop, openImageFile, placeImage, scaledNotice } from '../../creative/io/raster.js';
import { startRecovery, listRecovery, takeRecovery, clearRecovery } from '../../creative/io/recovery.js';
import RecoveryPrompt from './creative/RecoveryPrompt.jsx';
import OpenReport from './creative/OpenReport.jsx';

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

/** Studio keyboard shortcuts; returns true when the key was used. actions: { save }. */
function handleKey(store, e, actions = {}) {
  // Ctrl+S saves even while typing, so the browser's own "save page" never appears.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 's') { actions.save?.(); return true; }
  if (!shouldHandleShortcut(e)) return false;
  const busy = store.getState().busy;
  if (busy) {
    if (e.key === 'Escape') { busy.cancel?.(); return true; }
    return false; // nothing else while a filter runs
  }
  const history = historyActionFor(e);
  if (history) { runHistory(store, history); return true; }
  const state = store.getState();
  const session = store.active();
  const action = ctrlActionFor(e) || studioActionFor(e);
  if (action && session) {
    const meta = { tab: state.tab };
    const report = (r) => { if (r && !r.ok) store.notify(r.reason); session.compositor?.invalidate(); };
    if (action === 'selectAll') { report(selectAll(session, meta)); return true; }
    if (action === 'deselect') { report(clearSelection(session, meta)); return true; }
    if (action === 'invertSelection') { report(invertSelection(session, meta)); return true; }
    if (action === 'group') { if (session.doc.activeLayerId) report(groupLayer(session, session.doc.activeLayerId, meta)); return true; }
    if (action === 'ungroup') { if (session.doc.activeLayerId) report(ungroupLayer(session, session.doc.activeLayerId, meta)); return true; }
    if (action === 'copy') {
      const r = copySelectedPixels(session.doc);
      if (r.ok) store.update({ clipboard: r.clipboard }); else store.notify(r.reason);
      return true;
    }
    if (action === 'cut') {
      const r = cutSelectedPixels(session, meta);
      if (r.ok) store.update({ clipboard: r.clipboard }); else store.notify(r.reason);
      session.compositor?.invalidate();
      return true;
    }
    if (action === 'paste') {
      if (state.clipboard) report(pastePixels(session, state.clipboard, meta));
      return true;
    }
    if (action === 'clearSelection') {
      if (!session.doc.selection) return false;
      report(clearSelectedPixels(session, meta));
      return true;
    }
    if (action === 'swapColours') {
      store.update({ colours: { primary: state.colours.secondary, secondary: state.colours.primary } });
      return true;
    }
    if (action === 'brushSmaller' || action === 'brushLarger') {
      store.update({ brush: { size: nextBrushSize(state.brush.size, action === 'brushLarger' ? 1 : -1) } });
      return true;
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const tool = TOOLS[state.tool];
  if (tool?.key && tool.key(toolContext(store), e)) return true;
  const next = toolForKey(e);
  if (next) { store.setTool(next); return true; }
  return false;
}

export default function CreativeStudioWindow({ props: windowProps = null } = {}) {
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
  const openReport = useStudio(store, s => s.openReport);
  const hasDocument = useStudio(store, s => s.activeId) !== null;
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [resizeDialog, setResizeDialog] = useState(null);
  const [closing, setClosing] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [budgets, setBudgets] = useState(null);

  // Memory budgets sized to this PC (and any saved overrides).
  const applyBudgets = useCallback((next) => {
    setBudgets(next);
    store.setHistoryBudget(next.historyBytes);
  }, [store]);
  useEffect(() => {
    let live = true;
    loadBudgets().then(b => { if (live) applyBudgets(b); }).catch(() => {});
    return () => { live = false; };
  }, [applyBudgets]);
  const [dismissedId, setDismissedId] = useState(null);

  const requestClose = (session) => {
    if (session.dirty) setClosing(session);
    else store.closeDocument(session.id);
  };

  // ── Files ──
  const save = useCallback(async (session = store.active()) => {
    if (!session) return false;
    try {
      const path = await saveProject(store, session);
      store.notify(`Saved to Files: ${path}`);
      return true;
    } catch (err) {
      store.notify(`Couldn't save: ${err.message}`);
      return false;
    }
  }, [store]);
  const saveAndClose = async () => {
    const session = closing;
    setClosing(null);
    if (await save(session)) store.closeDocument(session.id);
  };
  const download = useCallback(async () => {
    const session = store.active();
    if (!session) return;
    try { await downloadProject(session); } catch (err) { store.notify(`Couldn't download: ${err.message}`); }
  }, [store]);
  // An untouched starting document is replaced when something is opened, rather than left behind.
  const replacePristine = useCallback((opened) => {
    for (const s of store.getState().sessions) {
      if (s !== opened && s.doc.name === 'Untitled' && !s.dirty && !s.savedPath && !s.history.steps.length) store.closeDocument(s.id);
    }
    if (opened) store.setActive(opened.id);
  }, [store]);
  const openFile = useCallback(async (file) => {
    try { replacePristine(await openFileBlob(store, file, file.name)); } catch (err) { store.notify(err.message); }
  }, [store, replacePristine]);
  // Files dropped on the tabs open; images dropped on the canvas are placed as layers.
  const dropFiles = useCallback(async (target, files) => {
    for (const { file, action } of classifyDrop(target, files)) {
      if (action === 'reject') { store.notify(`"${file.name}" isn't something Creative Studio can open.`); continue; }
      const session = store.active();
      if (action === 'open' || !session) { await openFile(file); continue; }
      try {
        const opened = await openImageFile(file, file.name);
        const r = placeImage(session, opened, file.name, { tab: store.getState().tab });
        if (!r.ok) store.notify(r.reason);
        const note = scaledNotice(opened);
        if (note) store.notify(note);
      } catch (err) {
        store.notify(err.message);
      }
    }
  }, [store, openFile]);
  const lastOpenId = useRef(null);
  const openFromFiles = useCallback(async (fileId, openId) => {
    if (openId && lastOpenId.current === openId) return; // the same handoff, arriving as props and as an event
    lastOpenId.current = openId || null;
    try { replacePristine(await openVaultFile(store, fileId)); } catch (err) { store.notify(err.message); }
  }, [store, replacePristine]);
  useEffect(() => {
    if (windowProps?.fileId) openFromFiles(windowProps.fileId, windowProps.openId);
  }, [windowProps?.fileId, windowProps?.openId, openFromFiles]);
  useEffect(() => {
    const onContext = (e) => {
      if (e.detail?.appId === 'creative_studio' && e.detail.props?.fileId) openFromFiles(e.detail.props.fileId, e.detail.props.openId);
    };
    window.addEventListener('novaura:app_context', onContext);
    return () => window.removeEventListener('novaura:app_context', onContext);
  }, [openFromFiles]);
  // ── Crash recovery: copies of unsaved work, written on a timer and when the studio closes ──
  const [recovered, setRecovered] = useState(null);
  useEffect(() => {
    let live = true;
    listRecovery().then((items) => { if (live && items.length) setRecovered(items); }).catch(() => {});
    const stop = startRecovery(store);
    return () => {
      live = false;
      store.dispose().finally(stop); // write copies of unsaved documents, then stop
    };
  }, [store]);
  const restoreRecovered = async () => {
    const items = recovered || [];
    setRecovered(null);
    let last = null;
    for (const r of items) {
      try {
        const session = store.openDocument(await takeRecovery(r.id));
        session.savedVersion = -1; // restored work is still unsaved
        last = session;
        await clearRecovery(r.id);
      } catch (err) {
        store.notify(err.message);
      }
    }
    if (last) replacePristine(last);
    store.bump();
  };
  const discardRecovered = async () => {
    const items = recovered || [];
    setRecovered(null);
    for (const r of items) await clearRecovery(r.id).catch(() => {});
  };

  const actions = useRef({});
  useEffect(() => { actions.current = { save: () => save() }; }, [save]);
  const shownNotice = notice && notice.id !== dismissedId ? notice.text : null;

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setDismissedId(notice.id), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const onKeyDown = (e) => {
    if (handleKey(store, e, actions.current)) e.preventDefault();
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
      if (lastClickInside.current && handleKey(store, e, actions.current)) e.preventDefault();
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
          <FileMenu store={store} onNew={() => setNewDocOpen(true)} onOpen={openFile} onSave={() => save()} onDownload={download} onExport={() => setExportOpen(true)} onResize={setResizeDialog} />
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

      <DocumentTabs store={store} onNew={() => setNewDocOpen(true)} onClose={requestClose} onDropFiles={dropFiles} />

      <div className="flex-1 min-h-0 flex">
        {tab === 'paint' && <PaintPanel store={store} />}
        {tab === 'photo' && <PhotoPanel store={store} onOpenResize={setResizeDialog} />}
        {tab === 'meme' && <MemePanel store={store} />}
        {hasDocument ? (
          <CanvasView store={store} rootRef={rootRef} overlay={overlay} isActive={studioActive} onZoom={setZoom} onDropFiles={dropFiles} />
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

      <StatusBar store={store} zoom={zoom} budgets={budgets} onBudgets={applyBudgets} />

      {exportOpen && <ExportDialog store={store} onClose={() => setExportOpen(false)} />}
      {resizeDialog && <ResizeDialog store={store} mode={resizeDialog} onClose={() => setResizeDialog(null)} />}
      {newDocOpen && (
        <NewDocumentDialog
          onCancel={() => setNewDocOpen(false)}
          onCreate={(opts) => { store.newDocument(opts); setNewDocOpen(false); }}
        />
      )}
      {recovered && <RecoveryPrompt items={recovered} onRestore={restoreRecovered} onDiscard={discardRecovered} />}
      <OpenReport report={openReport} onClose={() => store.update({ openReport: null })} />
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
