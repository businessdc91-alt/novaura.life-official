// shortcuts.js — Which key presses the studio acts on.
// Nothing fires while someone is typing in a text box, so Ctrl+Z there edits the text.

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function shouldHandleShortcut(event) {
  const t = event.target;
  if (!t) return true;
  return !(TYPING.has(t.tagName) || t.isContentEditable);
}

export function historyActionFor(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const k = String(event.key).toLowerCase();
  if (k === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (k === 'y') return 'redo';
  return null;
}

export function ctrlActionFor(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const k = String(event.key || '').toLowerCase();
  if (k === 'a') return 'selectAll';
  if (k === 'd') return 'deselect';
  if (k === 'i' && event.shiftKey) return 'invertSelection';
  if (k === 'g') return event.shiftKey ? 'ungroup' : 'group';
  if (k === 'c') return 'copy';
  if (k === 'x') return 'cut';
  if (k === 'v') return 'paste';
  return null;
}

export function studioActionFor(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const k = String(event.key || '').toLowerCase();
  if (k === 'x') return 'swapColours';
  if (k === '[') return 'brushSmaller';
  if (k === ']') return 'brushLarger';
  if (k === 'delete' || k === 'backspace') return 'clearSelection';
  return null;
}

/** [ and ] change the brush by 10%, by at least 1 px, within 1–500. */
export function nextBrushSize(size, direction) {
  const delta = Math.max(1, Math.round(size * 0.1));
  return Math.max(1, Math.min(500, size + direction * delta));
}
