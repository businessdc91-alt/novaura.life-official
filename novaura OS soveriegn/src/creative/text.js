// text.js — Text layers: layout (wrapping, line height, uppercase), fonts, and drawing.
//
// A text layer's box has its top-left at (x, y). Its width is wrapWidth when set
// (lines wrap on spaces, and a word longer than the box breaks by characters), or
// the widest line. Lines are aligned within the box. Rotation turns the box about
// its centre. The outline is drawn first and the fill on top, so it sits behind.

import { registerLayerRenderer } from './compositor.js';

export const FONT_CHOICES = [
  'Inter', 'Impact', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Segoe UI', 'Comic Sans MS', 'JetBrains Mono',
];

export const TEXT_DEFAULTS = {
  text: 'Text', fontFamily: 'Inter', fontSize: 64, fontWeight: 400, italic: false, colour: '#000000', align: 'left',
  lineHeight: 1.2, strokeColour: '#000000', strokeWidth: 0, uppercase: false, x: 0, y: 0, rotation: 0, wrapWidth: null,
};

/** The CSS font for a text layer, falling back to Inter. */
export function fontCss(layer, family = layer.fontFamily) {
  return `${layer.italic ? 'italic ' : ''}${layer.fontWeight || 400} ${layer.fontSize}px "${family}", "Inter", sans-serif`;
}

export function resolveFont(family, isAvailable) {
  return isAvailable(family) ? { family, fallback: false } : { family: 'Inter', fallback: true };
}

function wrapParagraph(paragraph, wrapWidth, measure, font) {
  if (!wrapWidth) return [paragraph];
  const fits = s => measure(s, font) <= wrapWidth;
  const lines = [];
  let current = '';
  for (const word of paragraph.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) { current = candidate; continue; }
    if (current) { lines.push(current); current = ''; }
    if (fits(word)) { current = word; continue; }
    let piece = '';
    for (const ch of word) {
      if (!piece || fits(piece + ch)) piece += ch;
      else { lines.push(piece); piece = ch; }
    }
    current = piece;
  }
  lines.push(current);
  return lines;
}

/** Lay out a text layer: { lines: [{ text, width, y }], width, height, lineHeightPx }. measure(text, font) → px. */
export function layoutText(layer, measure) {
  const font = fontCss(layer);
  const text = layer.uppercase ? String(layer.text ?? '').toUpperCase() : String(layer.text ?? '');
  const lineHeightPx = layer.fontSize * (layer.lineHeight || 1.2);
  const wrapWidth = layer.wrapWidth > 0 ? layer.wrapWidth : null;
  const lines = text.split('\n').flatMap(p => wrapParagraph(p, wrapWidth, measure, font))
    .map((t, i) => ({ text: t, width: measure(t, font), y: i * lineHeightPx }));
  const width = wrapWidth || Math.max(0, ...lines.map(l => l.width));
  return { lines, width, height: lines.length * lineHeightPx, lineHeightPx };
}

// One small canvas for measuring text and checking fonts.
let measurer = null;
function measuringContext() {
  if (!measurer) measurer = new OffscreenCanvas(8, 8).getContext('2d');
  return measurer;
}

export function canvasMeasure(text, font) {
  const ctx = measuringContext();
  ctx.font = font;
  return ctx.measureText(text).width;
}

const fontCache = new Map();
/** Whether a font family is installed: its text measures differently from the generic fallbacks. */
export function fontAvailable(family) {
  if (fontCache.has(family)) return fontCache.get(family);
  const ctx = measuringContext();
  const sample = 'mmmmmmmmmmlli1WQ@#';
  const width = font => { ctx.font = font; return ctx.measureText(sample).width; };
  const found = ['monospace', 'serif', 'sans-serif'].some(base => width(`72px "${family}", ${base}`) !== width(`72px ${base}`));
  const ok = found || family === 'Inter';
  fontCache.set(family, ok);
  return ok;
}

/** The box a text layer covers, unrotated: { x, y, w, h }. */
export function textBox(layer, measure = canvasMeasure) {
  const l = layoutText({ ...layer, fontFamily: resolveFont(layer.fontFamily, fontAvailable).family }, measure);
  return { x: layer.x, y: layer.y, w: l.width, h: l.height };
}

/** Draw a text layer on a context that draws in document coordinates. */
export function renderText(ctx, layer) {
  const family = resolveFont(layer.fontFamily, fontAvailable).family;
  const font = fontCss(layer, family);
  const measure = (text) => { ctx.font = font; return ctx.measureText(text).width; };
  const lay = layoutText({ ...layer, fontFamily: family }, measure);
  ctx.save();
  if (layer.rotation) {
    const cx = layer.x + lay.width / 2;
    const cy = layer.y + lay.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.textAlign = layer.align === 'center' ? 'center' : layer.align === 'right' ? 'right' : 'left';
  const ax = layer.align === 'center' ? layer.x + lay.width / 2 : layer.align === 'right' ? layer.x + lay.width : layer.x;
  const lead = (lay.lineHeightPx - layer.fontSize) / 2;
  if (layer.strokeWidth > 0) {
    ctx.strokeStyle = layer.strokeColour || '#000000';
    ctx.lineWidth = layer.strokeWidth * 2; // the fill covers the inner half
    ctx.lineJoin = 'round';
    for (const line of lay.lines) ctx.strokeText(line.text, ax, layer.y + line.y + lead);
  }
  ctx.fillStyle = layer.colour || '#000000';
  for (const line of lay.lines) ctx.fillText(line.text, ax, layer.y + line.y + lead);
  ctx.restore();
}

registerLayerRenderer('text', (ctx, doc, layer) => renderText(ctx, layer));
