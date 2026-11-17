// CanvasView.jsx — The Creative Studio canvas: the active document on a checkerboard,
// zoom (Ctrl+scroll, Fit, 100%), pan (Space+drag, middle button, scroll), and the
// pointer driving the current tool. The canvas backing store follows devicePixelRatio
// so the picture stays sharp on scaled Windows displays.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStudio } from './useStudio.js';
import { fitView, zoomAt, actualSize } from '../../../creative/view.js';
import { createPointerController } from '../../../creative/pointerController.js';
import { TOOLS } from '../../../creative/tools/index.js';
import { shouldHandleShortcut } from '../../../creative/shortcuts.js';
import { getLayer } from '../../../creative/document.js';
import { setLayerProps, setActiveLayer } from '../../../creative/edits.js';
import { fontCss, resolveFont, fontAvailable, textBox, layoutText, canvasMeasure } from '../../../creative/text.js';
import { screenToDoc } from '../../../creative/view.js';

let checkerTile = null;
function checker(ctx) {
  if (!checkerTile) {
    checkerTile = new OffscreenCanvas(16, 16);
    const c = checkerTile.getContext('2d');
    c.fillStyle = '#d4d4d8';
    c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#f4f4f5';
    c.fillRect(0, 0, 8, 8);
    c.fillRect(8, 8, 8, 8);
  }
  return ctx.createPattern(checkerTile, 'repeat');
}

export default function CanvasView({ store, rootRef, overlay = null, isActive = null, onZoom = null, onDropFiles = null }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const frame = useRef(0);
  const panRef = useRef(null);
  const fittedFor = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [viewState, setViewState] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const activeId = useStudio(store, s => s.activeId);
  const tool = useStudio(store, s => s.tool);
  const editingTextId = useStudio(store, s => s.editingTextId);
  const textFocus = useStudio(store, s => s.textFocus);
  const tab = useStudio(store, s => s.tab);
  const storeVersion = useStudio(store, s => s.version);
  const inlineRef = useRef(null);
  const inlineDragId = useRef(0);

  const draw = useCallback(() => {
    frame.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h, dpr } = sizeRef.current;
    const v = viewRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, w, h);
    const session = store.active();
    if (!session) return;
    const { width, height } = session.doc;
    const sw = width * v.zoom;
    const sh = height * v.zoom;
    ctx.fillStyle = checker(ctx);
    ctx.fillRect(v.panX, v.panY, sw, sh);
    ctx.save();
    ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.panX, dpr * v.panY);
    ctx.imageSmoothingEnabled = v.zoom < 2;
    const visible = {
      x: Math.floor(-v.panX / v.zoom) - 1, y: Math.floor(-v.panY / v.zoom) - 1,
      w: Math.ceil(w / v.zoom) + 3, h: Math.ceil(h / v.zoom) + 3,
    };
    session.compositor.render(ctx, visible);
    overlay?.(ctx, session, v);
    ctx.restore();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(v.panX) - 0.5, Math.round(v.panY) - 0.5, Math.round(sw) + 1, Math.round(sh) + 1);
  }, [store, overlay]);

  const requestRender = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  const setView = useCallback((next) => {
    viewRef.current = next;
    setZoom(next.zoom);
    setViewState(next);
    onZoom?.(next.zoom);
    requestRender();
  }, [requestRender, onZoom]);

  const fit = useCallback(() => {
    const session = store.active();
    const { w, h } = sizeRef.current;
    if (!session || !w || !h) return;
    setView(fitView(session.doc.width, session.doc.height, w, h));
    fittedFor.current = session.id;
  }, [store, setView]);

  const oneToOne = useCallback(() => {
    const session = store.active();
    const { w, h } = sizeRef.current;
    if (session) setView(actualSize(session.doc.width, session.doc.height, w, h));
  }, [store, setView]);

  // Keep the backing store matched to the element size and devicePixelRatio.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      if (fittedFor.current !== store.active()?.id) fit();
      requestRender();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    return () => observer.disconnect();
  }, [store, fit, requestRender]);

  // A different document becomes active: fit it.
  useEffect(() => { if (activeId && fittedFor.current !== activeId) fit(); }, [activeId, fit]);

  // Any change in the store (history, settings) redraws.
  useEffect(() => store.subscribe(() => requestRender()), [store, requestRender]);
  // Worker-backed live adjustments request a frame as soon as strips complete.
  useEffect(() => {
    const comp = store.active()?.compositor;
    return comp?.onAsyncReady?.(() => requestRender());
  }, [activeId, store, requestRender, storeVersion]);
  // Focus on-canvas text editor when activated.
  useEffect(() => {
    if (editingTextId && textFocus === editingTextId) {
      const el = inlineRef.current;
      if (el) {
        el.focus();
        el.select();
        store.update({ textFocus: null });
      }
    }
  }, [editingTextId, textFocus, store]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The pointer controller is made on first use, inside an event handler.
  const controllerRef = useRef(null);
  const renderRef = useRef(requestRender);
  useEffect(() => { renderRef.current = requestRender; }, [requestRender]);
  const pointer = () => {
    if (!controllerRef.current) {
      controllerRef.current = createPointerController({
        store,
        getView: () => viewRef.current,
        getRect: () => canvasRef.current.getBoundingClientRect(),
        requestRender: () => renderRef.current(),
      });
    }
    return controllerRef.current;
  };

  // Ctrl+scroll zooms at the pointer; plain scroll pans (Shift for sideways).
  useEffect(() => {
    const canvas = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        setView(zoomAt(v, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - rect.left, y: e.clientY - rect.top }));
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        setView({ ...v, panX: v.panX - dx, panY: v.panY - dy });
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [setView]);

  // Holding Space pans, while the studio is active and focus is not in a text box.
  useEffect(() => {
    const inStudio = () => (isActive ? isActive() : rootRef?.current?.contains(document.activeElement));
    const down = (e) => {
      if (e.code !== 'Space' || !inStudio() || !shouldHandleShortcut(e)) return;
      e.preventDefault();
      setSpaceDown(true);
    };
    const up = (e) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [rootRef, isActive]);

  const onPointerDown = (e) => {
    rootRef?.current?.focus({ preventScroll: true });
    canvasRef.current.setPointerCapture?.(e.pointerId);
    if (e.button === 1 || spaceDown) {
      const v = viewRef.current;
      panRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, panX: v.panX, panY: v.panY };
      e.preventDefault();
      return;
    }
    pointer().down(e.nativeEvent);
  };
  const onPointerMove = (e) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      setView({ ...viewRef.current, panX: pan.panX + e.clientX - pan.x, panY: pan.panY + e.clientY - pan.y });
      return;
    }
    pointer().move(e.nativeEvent);
  };
  const endPan = (e) => {
    if (panRef.current?.pointerId === e.pointerId) { panRef.current = null; return true; }
    return false;
  };
  const onPointerUp = (e) => { if (!endPan(e)) pointer().up(e.nativeEvent); };
  const onPointerCancel = (e) => { if (!endPan(e)) pointer().cancel(e.nativeEvent); };

  const cursor = spaceDown ? 'grab' : (TOOLS[tool]?.cursor || 'default');

  const onDoubleClick = (e) => {
    if (tool !== 'text' && tool !== 'move') return;
    const session = store.active();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!session || !rect) return;
    const p = screenToDoc(e, viewRef.current, rect);
    const hit = [...session.doc.layers].reverse().find((l) => {
      if (l.kind !== 'text' || !l.visible) return false;
      const b = textBox(l);
      return p.x >= b.x && p.y >= b.y && p.x <= b.x + Math.max(b.w, 24) && p.y <= b.y + Math.max(b.h, 24);
    });
    if (!hit) return;
    setActiveLayer(session, hit.id, 'layer');
    inlineDragId.current += 1;
    store.update({ editingTextId: hit.id, textFocus: hit.id });
  };

  const session = store.active();
  const editLayer = editingTextId && session ? getLayer(session.doc, editingTextId) : null;
  const editingText = editLayer?.kind === 'text' && !editLayer.locked ? editLayer : null;
  let inlineBox = null;
  if (editingText) {
    const family = resolveFont(editingText.fontFamily, fontAvailable).family;
    const lay = layoutText({ ...editingText, fontFamily: family }, canvasMeasure);
    const w = Math.max(120, Math.ceil(lay.width * viewState.zoom + 32));
    const h = Math.max(40, Math.ceil(lay.height * viewState.zoom + 18));
    inlineBox = {
      left: viewState.panX + editingText.x * viewState.zoom,
      top: viewState.panY + editingText.y * viewState.zoom,
      width: w,
      height: h,
      font: fontCss({ ...editingText, fontSize: editingText.fontSize * viewState.zoom }, family),
      lineHeight: editingText.lineHeight || 1.2,
    };
  }

  const onInlineTextChange = (e) => {
    if (!session || !editingText) return;
    const value = e.target.value;
    const patch = { text: value };
    const oldName = (editingText.text || 'Text').split('\n')[0].slice(0, 40) || 'Text';
    if (editingText.name === oldName) patch.name = value.split('\n')[0].slice(0, 40) || 'Text';
    const r = setLayerProps(session, editingText.id, patch, {
      tab, label: 'Edit text', mergeKey: `text-text:${editingText.id}:${inlineDragId.current}`, mergeWindowMs: 1000,
    });
    if (!r.ok) store.notify(r.reason);
  };

  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  return (
    <div
      ref={wrapRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-[#0b0f19]" data-drop-target="canvas"
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
      onDrop={(e) => { if (!hasFiles(e)) return; e.preventDefault(); onDropFiles?.('canvas', e.dataTransfer.files); }}
    >
      <canvas
        ref={canvasRef}
        data-creative-canvas=""
        className="block"
        style={{ cursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onDoubleClick={onDoubleClick}
        onContextMenu={e => e.preventDefault()}
      />
      {editingText && inlineBox && (
        <textarea
          ref={inlineRef}
          autoFocus
          data-text-input=""
          data-canvas-text-input=""
          aria-label="Edit text on canvas"
          value={editingText.text}
          onChange={onInlineTextChange}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
              e.preventDefault();
              store.update({ editingTextId: null });
            }
          }}
          onBlur={() => {
            if (store.getState().editingTextId === editingText.id) store.update({ editingTextId: null });
          }}
          style={{
            left: `${inlineBox.left}px`,
            top: `${inlineBox.top}px`,
            width: `${inlineBox.width}px`,
            height: `${inlineBox.height}px`,
            font: inlineBox.font,
            lineHeight: inlineBox.lineHeight,
            color: editingText.colour || '#000000',
            textAlign: editingText.align || 'left',
            textTransform: editingText.uppercase ? 'uppercase' : 'none',
            transform: editingText.rotation ? `rotate(${editingText.rotation}deg)` : undefined,
          }}
          className="absolute z-20 resize-both bg-slate-950/65 backdrop-blur-[1px] border border-cyan-400 rounded px-1 py-0.5 outline-none select-text shadow-lg overflow-hidden"
        />
      )}
      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-lg bg-slate-900/90 border border-slate-700/70 px-1.5 py-1 text-[11px] text-slate-300 shadow-lg">
        <span className="px-1.5 tabular-nums" aria-label="Zoom">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={fit} className="px-2 py-0.5 rounded-md hover:bg-slate-700/70" title="Fit the picture in the window">Fit</button>
        <button type="button" onClick={oneToOne} className="px-2 py-0.5 rounded-md hover:bg-slate-700/70" title="Actual pixels">100%</button>
      </div>
    </div>
  );
}
