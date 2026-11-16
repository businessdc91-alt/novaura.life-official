// view.js — Zoom and pan maths for the canvas view.
// A view is { zoom, panX, panY } in CSS pixels: document point (x, y) appears at
// (panX + x·zoom, panY + y·zoom) inside the canvas element. devicePixelRatio only
// changes the canvas backing store, never these numbers.

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 32;

const clampZoom = z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/** A pointer position (clientX, clientY) → document coordinates. rect is the canvas element's box. */
export function screenToDoc({ clientX, clientY }, view, rect) {
  return { x: (clientX - rect.left - view.panX) / view.zoom, y: (clientY - rect.top - view.panY) / view.zoom };
}

/** The view that fits the whole document in viewW × viewH with a margin, centred. */
export function fitView(docW, docH, viewW, viewH, margin = 24) {
  const zoom = clampZoom(Math.min((viewW - margin * 2) / docW, (viewH - margin * 2) / docH));
  return { zoom, panX: (viewW - docW * zoom) / 2, panY: (viewH - docH * zoom) / 2 };
}

/** Zoom by `factor` keeping the document point under `anchor` (canvas CSS px) in place. */
export function zoomAt(view, factor, anchor) {
  const zoom = clampZoom(view.zoom * factor);
  const docX = (anchor.x - view.panX) / view.zoom;
  const docY = (anchor.y - view.panY) / view.zoom;
  return { zoom, panX: anchor.x - docX * zoom, panY: anchor.y - docY * zoom };
}

/** 100% zoom, centred. */
export function actualSize(docW, docH, viewW, viewH) {
  return { zoom: 1, panX: (viewW - docW) / 2, panY: (viewH - docH) / 2 };
}
