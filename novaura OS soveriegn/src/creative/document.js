// document.js — The Creative Studio document: its size, its layers, and their pixels.
//
// A document is a plain object. Pixel data lives in doc.buffers (id → surface) so
// the rest of the document can be saved as JSON. Everything here is a low-level
// change with no history; edits.js wraps these in undoable steps.
//
// Every change bumps doc.version, and every layer it touches gets layer.rev set to
// that version, so the compositor knows exactly which cached pictures are stale.

import { createSurface } from './surface.js';

const SHAPE_NAMES = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', polygon: 'Polygon', star: 'Star' };
let adjustmentLabel = type => type; // replaced by adjustments.js when it loads

/** adjustments.js registers its labels here, so new adjustment layers get readable names. */
export function setAdjustmentLabeler(fn) { adjustmentLabel = fn; }

const newId = () => globalThis.crypto.randomUUID();

function colourOf(background) {
  if (background === 'white') return [255, 255, 255, 255];
  if (background === 'black') return [0, 0, 0, 255];
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(background || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 255] : null;
}

function fillSurface(surface, [r, g, b, a]) {
  if (surface.ctx) {
    surface.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    surface.ctx.fillRect(0, 0, surface.width, surface.height);
    return;
  }
  const row = new Uint8ClampedArray(surface.width * 4);
  for (let i = 0; i < row.length; i += 4) { row[i] = r; row[i + 1] = g; row[i + 2] = b; row[i + 3] = a; }
  for (let y = 0; y < surface.height; y++) surface.write(0, y, { width: surface.width, height: 1, data: row });
}

export function touchLayer(doc, layer) {
  doc.version += 1;
  let cur = layer;
  while (cur) {
    cur.rev = doc.version;
    cur = cur.parentId ? doc.layers.find(l => l.id === cur.parentId) : null;
  }
}

/** background: 'white' | 'black' | 'transparent' | '#rrggbb'. */
export function createDocument({ name = 'Untitled', width, height, background = 'white' }) {
  createSurface(width, height); // validates the size before anything is built
  const doc = {
    id: newId(), name, width, height, layers: [], activeLayerId: null, activeTarget: 'layer',
    selection: null, buffers: new Map(), version: 0, nextLayerNumber: 1, nextGroupNumber: 1,
  };
  const colour = colourOf(background);
  const layer = createLayer(doc, 'pixel', colour ? { name: 'Background' } : {});
  if (colour) fillSurface(doc.buffers.get(layer.bufferId), colour);
  insertLayer(doc, layer, 0);
  doc.activeLayerId = layer.id;
  return doc;
}

function defaultName(doc, kind, fields) {
  if (kind === 'shape') return SHAPE_NAMES[fields.shape] || 'Shape';
  if (kind === 'text') return (fields.text || 'Text').split('\n')[0].slice(0, 40) || 'Text';
  if (kind === 'adjust') return adjustmentLabel(fields.adjust);
  if (kind === 'group') {
    const n = doc.nextGroupNumber || 1;
    doc.nextGroupNumber = n + 1;
    return `Group ${n}`;
  }
  return `Layer ${doc.nextLayerNumber++}`;
}

/**
 * A new layer of `kind` ('pixel' | 'shape' | 'text' | 'adjust' | 'group'), not yet in the stack.
 * A pixel layer gets a canvas-sized surface, or adopts `fields.surface` and its size.
 */
export function createLayer(doc, kind, fields = {}) {
  const { surface: given, ...rest } = fields;
  const layer = {
    id: newId(),
    name: rest.name ?? defaultName(doc, kind, rest),
    kind, visible: true, opacity: 1, blend: kind === 'group' ? 'pass-through' : 'source-over', locked: false,
    mask: null, psdBlend: null, role: null, parentId: null, rev: doc.version,
    ...(kind === 'group' ? { expanded: true } : {}),
    ...rest,
  };
  if (kind === 'pixel') {
    const surface = given || createSurface(doc.width, doc.height);
    layer.x = rest.x ?? 0;
    layer.y = rest.y ?? 0;
    layer.width = surface.width;
    layer.height = surface.height;
    layer.bufferId = newId();
    doc.buffers.set(layer.bufferId, surface);
  }
  return layer;
}

export const getLayer = (doc, id) => doc.layers.find(l => l.id === id);
export const layerIndex = (doc, id) => doc.layers.findIndex(l => l.id === id);

/** The layer's own pixels (part 'layer') or its mask's ('mask'). */
export function surfaceOf(doc, layer, part = 'layer') {
  if (part === 'mask') return layer.mask ? doc.buffers.get(layer.mask.bufferId) : undefined;
  return layer.bufferId ? doc.buffers.get(layer.bufferId) : undefined;
}

const LOCK_ALLOWED = new Set(['visibility', 'unlock', 'rename', 'reorder']);

/** Whether `action` is allowed on the layer: { ok: true } or { ok: false, reason }. */
export function canEdit(layer, action) {
  if (layer.locked && !LOCK_ALLOWED.has(action)) return { ok: false, reason: `"${layer.name}" is locked.` };
  if (action === 'paint' && layer.kind !== 'pixel') {
    return { ok: false, reason: 'Only pixel layers can be painted on. Paint its mask, or add a pixel layer.' };
  }
  return { ok: true };
}

export function insertLayer(doc, layer, index) {
  doc.layers.splice(Math.max(0, Math.min(index, doc.layers.length)), 0, layer);
  touchLayer(doc, layer);
}

export function removeLayerAt(doc, index) {
  const [layer] = doc.layers.splice(index, 1);
  const parent = layer?.parentId ? getLayer(doc, layer.parentId) : null;
  touchLayer(doc, parent);
  return layer;
}

export function moveLayer(doc, from, to) {
  const [layer] = doc.layers.splice(from, 1);
  doc.layers.splice(to, 0, layer);
  touchLayer(doc, layer);
}

/** Map<parentId | null, Layer[]> in bottom-to-top rendering order. */
export function buildLayerTree(layers) {
  const byParent = new Map();
  const ids = new Set(layers.map(l => l.id));
  for (const l of layers) {
    const pid = l.parentId && ids.has(l.parentId) ? l.parentId : null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(l);
  }
  return byParent;
}

/** True when `candidateId` equals `ancestorId` or is nested inside it. */
export function isDescendant(doc, candidateId, ancestorId) {
  let cur = getLayer(doc, candidateId);
  const seen = new Set();
  while (cur) {
    if (cur.id === ancestorId) return true;
    if (!cur.parentId || seen.has(cur.id)) break;
    seen.add(cur.id);
    cur = getLayer(doc, cur.parentId);
  }
  return false;
}

/** All nested child layers inside `groupId` (bottom-to-top subtree order). */
export function collectDescendants(doc, groupId) {
  const tree = buildLayerTree(doc.layers);
  const out = [];
  const walk = (pid) => {
    for (const child of tree.get(pid) || []) {
      out.push(child);
      if (child.kind === 'group') walk(child.id);
    }
  };
  walk(groupId);
  return out;
}

/** Nesting depth (0 for top-level layers). */
export function layerDepth(doc, layer) {
  let depth = 0;
  let cur = layer;
  const seen = new Set();
  while (cur?.parentId && !seen.has(cur.id)) {
    seen.add(cur.id);
    const parent = getLayer(doc, cur.parentId);
    if (!parent) break;
    depth += 1;
    cur = parent;
  }
  return depth;
}

/** Set fields on a layer; returns the values they had before. */
export function assignLayer(doc, id, patch) {
  const layer = getLayer(doc, id);
  if (!layer) return null;
  const previous = {};
  for (const key of Object.keys(patch)) previous[key] = layer[key];
  Object.assign(layer, patch);
  touchLayer(doc, layer);
  return previous;
}

/** A deep copy of `layer` with a new id and its own copies of its buffers, placed in `intoDoc`. */
export function cloneLayer(doc, layer, intoDoc = doc) {
  const copy = structuredClone({ ...layer, id: undefined, bufferId: undefined, mask: null });
  copy.id = newId();
  if (layer.kind === 'pixel') {
    copy.bufferId = newId();
    intoDoc.buffers.set(copy.bufferId, surfaceOf(doc, layer).clone());
  }
  if (layer.mask) {
    copy.mask = { ...layer.mask, bufferId: newId() };
    intoDoc.buffers.set(copy.mask.bufferId, surfaceOf(doc, layer, 'mask').clone());
  }
  copy.rev = intoDoc.version;
  return copy;
}

/** Remove a layer's buffers from the document and return them (for undoable deletes). */
export function takeBuffers(doc, layer) {
  const taken = new Map();
  for (const id of [layer.bufferId, layer.mask?.bufferId]) {
    if (id && doc.buffers.has(id)) { taken.set(id, doc.buffers.get(id)); doc.buffers.delete(id); }
  }
  return taken;
}

export function putBuffers(doc, buffers) {
  for (const [id, surface] of buffers) doc.buffers.set(id, surface);
}
