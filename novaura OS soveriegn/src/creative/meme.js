// meme.js — The Meme tab on layers.
//
// A template goes in as a locked pixel layer at the bottom, drawn to cover the canvas
// (picking another replaces it). Top and bottom text are ordinary text layers in the
// classic meme style: white Impact capitals with a black outline, centred, wrapping
// at 90% of the width. The bottom text stays anchored to the bottom as it wraps.

import { createSurface } from './surface.js';
import { assignLayer } from './document.js';
import { addLayer, setLayerProps } from './edits.js';
import { TEXT_DEFAULTS, textBox } from './text.js';

export function memeStyle(doc) {
  const fontSize = Math.round(doc.width * 0.09);
  return {
    fontFamily: 'Impact', fontSize, fontWeight: 400, colour: '#ffffff', strokeColour: '#000000',
    strokeWidth: Math.round(fontSize * 0.08), uppercase: true, align: 'center', lineHeight: 1.1,
    wrapWidth: Math.round(doc.width * 0.9), x: Math.round(doc.width * 0.05),
  };
}

async function coverCanvas(doc, url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const surface = createSurface(doc.width, doc.height);
  const scale = Math.max(doc.width / img.naturalWidth, doc.height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  surface.ctx.imageSmoothingQuality = 'high';
  surface.ctx.drawImage(img, (doc.width - w) / 2, (doc.height - h) / 2, w, h);
  return surface;
}

/** Put a template under everything as a locked layer, or swap the current one. One step. */
export async function applyMemeTemplate(s, template, meta) {
  const { doc } = s;
  const surface = await coverCanvas(doc, template.url);
  const name = `Template: ${template.name}`;
  const existing = doc.layers.find(l => l.role === 'memeTemplate');
  if (!existing) {
    // At the bottom, but above a new document's plain Background, which would otherwise hide it.
    const bottom = doc.layers[0];
    const index = bottom && bottom.kind === 'pixel' && bottom.name === 'Background' && !bottom.role ? 1 : 0;
    return addLayer(s, 'pixel', { name, surface, locked: true, role: 'memeTemplate' }, { ...meta, label: meta.label || 'Meme template' }, index);
  }
  const fields = l => ({ name: l.name, x: l.x, y: l.y, width: l.width, height: l.height });
  const before = { surface: doc.buffers.get(existing.bufferId), fields: fields(existing) };
  const after = { surface, fields: { name, x: 0, y: 0, width: doc.width, height: doc.height } };
  // The template layer is locked against people painting on it; swapping the template is the Meme tab's own job.
  const set = (state) => { doc.buffers.set(existing.bufferId, state.surface); assignLayer(doc, existing.id, state.fields); };
  set(after);
  s.history.push({ label: meta.label || 'Meme template', tab: meta.tab, bytes: before.surface.bytes, apply: () => set(after), revert: () => set(before) });
  return { ok: true, layer: existing };
}

/** Set the top or bottom caption, adding its text layer the first time. Typing merges into one step. */
export function setMemeText(s, which, text, meta) {
  const { doc } = s;
  const role = which === 'top' ? 'memeTop' : 'memeBottom';
  const yFor = fields => (which === 'top' ? Math.round(doc.height * 0.04) : Math.round(doc.height * 0.96 - textBox(fields).h));
  const layer = doc.layers.find(l => l.role === role);
  if (!layer) {
    const name = which === 'top' ? 'Top text' : 'Bottom text';
    const fields = { ...TEXT_DEFAULTS, ...memeStyle(doc), text, role, name };
    fields.y = yFor(fields);
    return addLayer(s, 'text', fields, { ...meta, label: name }, doc.layers.length);
  }
  const patch = { text };
  if (which === 'bottom') patch.y = yFor({ ...layer, text });
  return setLayerProps(s, layer.id, patch, { ...meta, label: 'Edit text', mergeKey: `memeText:${layer.id}`, mergeWindowMs: 1000 });
}

/** Another caption in the meme style, in the middle of the picture. */
export function addMemeText(s, meta) {
  const { doc } = s;
  const fields = { ...TEXT_DEFAULTS, ...memeStyle(doc), text: 'Text', name: 'Text' };
  fields.y = Math.round(doc.height / 2 - textBox(fields).h / 2);
  return addLayer(s, 'text', fields, { ...meta, label: 'Add text' }, doc.layers.length);
}
