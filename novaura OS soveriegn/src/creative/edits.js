// edits.js — Every change a person makes to a document, as one undoable step.
//
// Each function takes a session { doc, history }, makes its change, pushes one step,
// and returns { ok: true, layer? } or { ok: false, reason } (a reason the UI can show).
// `meta` is { tab, label?, mergeKey?, mergeWindowMs? }.

import {
  getLayer, layerIndex, canEdit, insertLayer, removeLayerAt, moveLayer, assignLayer,
  createLayer, cloneLayer, takeBuffers, putBuffers, touchLayer, surfaceOf,
} from './document.js';
import { compoundStep } from './history.js';
import { applyPatch, beginPixelEdit } from './pixelRecorder.js';
import { createMask, invertPixels } from './masks.js';
import { createSurface, MAX_SIDE } from './surface.js';

const PROP_BYTES = 64;
const refuse = reason => ({ ok: false, reason });
const GONE = refuse('That layer no longer exists.');
const bytesOf = buffers => [...buffers.values()].reduce((sum, s) => sum + s.bytes, 0);

function push(s, step, meta, fallbackLabel) {
  step.label = meta.label || step.label || fallbackLabel;
  step.tab = meta.tab;
  if (meta.mergeKey != null) step.mergeKey = meta.mergeKey;
  if (meta.mergeWindowMs != null) step.mergeWindowMs = meta.mergeWindowMs;
  s.history.push(step);
  return step;
}

/** Not a history step: which layer, and whether its pixels or its mask, the tools act on. */
export function setActiveLayer(s, id, target = 'layer') {
  const layer = getLayer(s.doc, id);
  if (!layer) return GONE;
  if (target === 'mask' && !layer.mask) return refuse('This layer has no mask.');
  s.doc.activeLayerId = id;
  s.doc.activeTarget = target;
  return { ok: true, layer };
}

function restoreActive(doc, id, target) {
  doc.activeLayerId = id;
  doc.activeTarget = target;
}

// Put a layer (and its buffers) into the stack as an undoable step.
function insertStep(s, layer, index, buffers) {
  const { doc } = s;
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  const apply = () => {
    putBuffers(doc, buffers);
    insertLayer(doc, layer, index);
    restoreActive(doc, layer.id, 'layer');
  };
  const revert = () => {
    removeLayerAt(doc, layerIndex(doc, layer.id));
    takeBuffers(doc, layer);
    restoreActive(doc, before.id, before.target);
  };
  apply();
  return { bytes: PROP_BYTES, apply, revert };
}

const kindLabel = { pixel: 'layer', shape: 'shape layer', text: 'text layer', adjust: 'adjustment layer' };

/** Add a new layer, by default just above the active layer, and make it active. */
export function addLayer(s, kind, fields, meta, index) {
  const { doc } = s;
  const layer = createLayer(doc, kind, fields || {});
  const at = index ?? (layerIndex(doc, doc.activeLayerId) + 1 || doc.layers.length);
  const buffers = takeBuffers(doc, layer); // createLayer registered them; insertStep puts them back
  push(s, insertStep(s, layer, at, buffers), meta, `New ${kindLabel[kind] || 'layer'}`);
  return { ok: true, layer };
}

export function deleteLayer(s, id, meta) {
  const { doc } = s;
  const layer = getLayer(doc, id);
  if (!layer) return GONE;
  const allowed = canEdit(layer, 'delete');
  if (!allowed.ok) return allowed;
  if (doc.layers.length === 1) return refuse('A document needs at least one layer.');
  const index = layerIndex(doc, id);
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  let buffers = new Map();
  const apply = () => {
    removeLayerAt(doc, layerIndex(doc, id));
    buffers = takeBuffers(doc, layer);
    if (doc.activeLayerId === id) restoreActive(doc, doc.layers[Math.max(0, index - 1)].id, 'layer');
  };
  const revert = () => {
    putBuffers(doc, buffers);
    insertLayer(doc, layer, index);
    restoreActive(doc, before.id, before.target);
  };
  apply();
  push(s, { bytes: PROP_BYTES + bytesOf(buffers), apply, revert }, meta, 'Delete layer');
  return { ok: true, layer };
}

/** Change a layer's place in the stack. Allowed on locked layers. */
export function moveLayerTo(s, id, toIndex, meta) {
  const { doc } = s;
  const layer = getLayer(doc, id);
  if (!layer) return GONE;
  const from = layerIndex(doc, id);
  const to = Math.max(0, Math.min(toIndex, doc.layers.length - 1));
  if (from === to) return { ok: true, layer };
  const apply = () => moveLayer(doc, layerIndex(doc, id), to);
  const revert = () => moveLayer(doc, layerIndex(doc, id), from);
  apply();
  push(s, { bytes: PROP_BYTES, apply, revert }, meta, 'Move layer in stack');
  return { ok: true, layer };
}

const KEY_ACTION = { visible: 'visibility', locked: 'unlock', name: 'rename', x: 'move', y: 'move' };

function propsLabel(patch) {
  const keys = Object.keys(patch);
  if (keys.length === 1) {
    const [k] = keys;
    if (k === 'opacity') return 'Opacity';
    if (k === 'blend') return 'Blend mode';
    if (k === 'visible') return patch.visible ? 'Show layer' : 'Hide layer';
    if (k === 'locked') return patch.locked ? 'Lock layer' : 'Unlock layer';
    if (k === 'name') return 'Rename layer';
  }
  if (keys.every(k => k === 'x' || k === 'y')) return 'Move layer';
  return 'Edit layer';
}

function propsStep(doc, id, patch, previous) {
  const step = {
    bytes: PROP_BYTES, patch, previous,
    apply: () => { assignLayer(doc, id, patch); },
    revert: () => { assignLayer(doc, id, previous); },
    mergeWith(newer) {
      const mergedPatch = { ...patch, ...newer.patch };
      const mergedPrevious = { ...newer.previous, ...previous };
      const merged = propsStep(doc, id, mergedPatch, mergedPrevious);
      merged.label = step.label;
      merged.tab = step.tab;
      return merged;
    },
  };
  return step;
}

/** Set layer fields. Locked layers accept only visible, locked and name. */
export function setLayerProps(s, id, patch, meta) {
  const { doc } = s;
  const layer = getLayer(doc, id);
  if (!layer) return GONE;
  for (const key of Object.keys(patch)) {
    const allowed = canEdit(layer, KEY_ACTION[key] || 'edit');
    if (!allowed.ok) return allowed;
  }
  const changes = Object.fromEntries(Object.entries(patch).filter(([k, v]) => !Object.is(layer[k], v)));
  if (!Object.keys(changes).length) return { ok: true, layer };
  const previous = assignLayer(doc, id, changes);
  push(s, propsStep(doc, id, changes, previous), meta, propsLabel(changes));
  return { ok: true, layer };
}

/** Copy a layer (pixels and mask included) just above itself. */
export function duplicateLayer(s, id, meta) {
  const { doc } = s;
  const layer = getLayer(doc, id);
  if (!layer) return GONE;
  const copy = cloneLayer(doc, layer);
  copy.name = `${layer.name} copy`;
  const buffers = takeBuffers(doc, copy);
  push(s, insertStep(s, copy, layerIndex(doc, id) + 1, buffers), meta, 'Duplicate layer');
  return { ok: true, layer: copy };
}

/** Merge a layer into the one below it, giving one pixel layer. Needs the compositor (a canvas). */
export async function mergeDown(s, id, meta) {
  const { doc } = s;
  const upper = getLayer(doc, id);
  if (!upper) return GONE;
  const index = layerIndex(doc, id);
  const lower = doc.layers[index - 1];
  if (!lower) return refuse('There is no layer below to merge into.');
  for (const layer of [upper, lower]) {
    const allowed = canEdit(layer, 'edit');
    if (!allowed.ok) return allowed;
  }
  const { composeLayers } = await import('./compositor.js');
  const surface = composeLayers(doc, [lower, upper]);
  const merged = createLayer(doc, 'pixel', { name: lower.name, surface });
  const mergedBuffers = takeBuffers(doc, merged);
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  let upperBuffers = new Map();
  let lowerBuffers = new Map();
  const apply = () => {
    removeLayerAt(doc, layerIndex(doc, upper.id));
    removeLayerAt(doc, layerIndex(doc, lower.id));
    upperBuffers = takeBuffers(doc, upper);
    lowerBuffers = takeBuffers(doc, lower);
    putBuffers(doc, mergedBuffers);
    insertLayer(doc, merged, index - 1);
    restoreActive(doc, merged.id, 'layer');
  };
  const revert = () => {
    removeLayerAt(doc, layerIndex(doc, merged.id));
    takeBuffers(doc, merged);
    putBuffers(doc, lowerBuffers);
    putBuffers(doc, upperBuffers);
    insertLayer(doc, lower, index - 1);
    insertLayer(doc, upper, index);
    restoreActive(doc, before.id, before.target);
  };
  apply();
  push(s, { bytes: PROP_BYTES + bytesOf(upperBuffers) + bytesOf(lowerBuffers), apply, revert }, meta, 'Merge down');
  return { ok: true, layer: merged };
}

/** A step that re-applies or reverts a pixel patch on a layer (part 'layer') or its mask. Not pushed. */
export function patchStep(s, layer, part, patch) {
  const run = side => {
    applyPatch(surfaceOf(s.doc, layer, part), patch, side);
    touchLayer(s.doc, layer);
  };
  return { bytes: patch.bytes, apply: () => run('after'), revert: () => run('before') };
}

/** Push a finished pixel edit (already on the surface) as one step, after any extra steps. */
export function commitPatch(s, layerId, part, patch, meta, extraSteps = []) {
  const layer = getLayer(s.doc, layerId);
  touchLayer(s.doc, layer);
  const steps = [...extraSteps, ...(patch ? [patchStep(s, layer, part, patch)] : [])];
  const step = steps.length === 1 ? steps[0] : compoundStep(steps, { label: meta.label, tab: meta.tab });
  return push(s, step, meta, 'Paint');
}

// ── Masks ─────────────────────────────────────────────────────────────────────

function maskable(doc, id) {
  const layer = getLayer(doc, id);
  if (!layer) return { error: GONE };
  const allowed = canEdit(layer, 'mask');
  if (!allowed.ok) return { error: allowed };
  return { layer };
}

/** Add a mask: reveal all (white) or hide all (black). The mask becomes what tools paint. */
export function addMask(s, id, reveal, meta) {
  const { doc } = s;
  const { layer, error } = maskable(doc, id);
  if (error) return error;
  if (layer.mask) return refuse('This layer already has a mask.');
  const mask = createMask(doc, reveal);
  const buffers = new Map([[mask.bufferId, doc.buffers.get(mask.bufferId)]]);
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  const apply = () => {
    putBuffers(doc, buffers);
    assignLayer(doc, id, { mask });
    restoreActive(doc, id, 'mask');
  };
  const revert = () => {
    assignLayer(doc, id, { mask: null });
    for (const key of buffers.keys()) doc.buffers.delete(key);
    restoreActive(doc, before.id, before.target);
  };
  apply();
  push(s, { bytes: PROP_BYTES, apply, revert }, meta, reveal ? 'Add mask' : 'Add mask (hide all)');
  return { ok: true, layer };
}

// Remove a layer's mask now, as a step that is not yet pushed.
function maskRemoval(s, layer) {
  const { doc } = s;
  const mask = layer.mask;
  const buffers = new Map([[mask.bufferId, doc.buffers.get(mask.bufferId)]]);
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  const apply = () => {
    assignLayer(doc, layer.id, { mask: null });
    for (const key of buffers.keys()) doc.buffers.delete(key);
    if (doc.activeLayerId === layer.id && doc.activeTarget === 'mask') doc.activeTarget = 'layer';
  };
  const revert = () => {
    putBuffers(doc, buffers);
    assignLayer(doc, layer.id, { mask });
    restoreActive(doc, before.id, before.target);
  };
  apply();
  return { bytes: PROP_BYTES + bytesOf(buffers), apply, revert };
}

export function deleteMask(s, id, meta) {
  const { layer, error } = maskable(s.doc, id);
  if (error) return error;
  if (!layer.mask) return refuse('This layer has no mask.');
  push(s, maskRemoval(s, layer), meta, 'Delete mask');
  return { ok: true, layer };
}

/** Turn a mask off (ignored when drawing) or back on. */
export function setMaskEnabled(s, id, enabled, meta) {
  const layer = getLayer(s.doc, id);
  if (!layer) return GONE;
  if (!layer.mask) return refuse('This layer has no mask.');
  return setLayerProps(s, id, { mask: { ...layer.mask, enabled } }, { ...meta, label: meta.label || (enabled ? 'Turn mask on' : 'Turn mask off') });
}

/** Swap the mask's black and white (its default outside the mask too). */
export function invertMask(s, id, meta) {
  const { doc } = s;
  const { layer, error } = maskable(doc, id);
  if (error) return error;
  if (!layer.mask) return refuse('This layer has no mask.');
  const surface = surfaceOf(doc, layer, 'mask');
  const recorder = beginPixelEdit(surface);
  recorder.touch(0, 0, surface.width, surface.height);
  surface.write(0, 0, invertPixels(surface.read(0, 0, surface.width, surface.height)));
  const patch = recorder.finish();
  const previous = layer.mask;
  const next = { ...previous, defaultValue: 255 - previous.defaultValue };
  assignLayer(doc, id, { mask: next });
  const defaultStep = {
    bytes: PROP_BYTES,
    apply: () => { assignLayer(doc, id, { mask: next }); },
    revert: () => { assignLayer(doc, id, { mask: previous }); },
  };
  commitPatch(s, id, 'mask', patch, { ...meta, label: meta.label || 'Invert mask' }, [defaultStep]);
  return { ok: true, layer };
}

/** Bake the mask into a pixel layer's transparency and remove it. */
export function applyMask(s, id, meta) {
  const { doc } = s;
  const layer = getLayer(doc, id);
  if (!layer) return GONE;
  if (!layer.mask) return refuse('This layer has no mask.');
  if (layer.kind !== 'pixel') return refuse('Only pixel layers can have their mask applied.');
  const allowed = canEdit(layer, 'edit');
  if (!allowed.ok) return allowed;
  const surface = surfaceOf(doc, layer);
  const mask = layer.mask;
  const grey = surfaceOf(doc, layer, 'mask').read(layer.x - mask.x, layer.y - mask.y, surface.width, surface.height);
  const recorder = beginPixelEdit(surface);
  recorder.touch(0, 0, surface.width, surface.height);
  const pixels = surface.read(0, 0, surface.width, surface.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = grey.data[i + 3] ? grey.data[i] : mask.defaultValue; // outside the mask: its default
    pixels.data[i + 3] = Math.round((pixels.data[i + 3] * v) / 255);
  }
  surface.write(0, 0, pixels);
  const patch = recorder.finish();
  const removal = maskRemoval(s, layer);
  commitPatch(s, id, 'layer', patch, { ...meta, label: meta.label || 'Apply mask' }, [removal]);
  return { ok: true, layer };
}

// ── Resampling the whole document ─────────────────────────────────────────────

const SCALED = {
  shape: ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'radius', 'strokeWidth'],
  text: ['x', 'y', 'fontSize', 'strokeWidth', 'wrapWidth'],
};

function resampled(surface, w, h) {
  const out = createSurface(w, h);
  out.ctx.imageSmoothingEnabled = true;
  out.ctx.imageSmoothingQuality = 'high';
  out.ctx.drawImage(surface.canvas, 0, 0, w, h);
  return out;
}

/**
 * Scale the whole document by `factor`: pixel layers and masks are resampled at high
 * quality; shapes, text and blur radii scale exactly. One step.
 */
export function upscaleDocument(s, factor, meta) {
  const { doc } = s;
  const W = Math.round(doc.width * factor);
  const H = Math.round(doc.height * factor);
  if (W > MAX_SIDE || H > MAX_SIDE) return refuse(`${factor}× would make the image larger than 16384 px.`);
  const size = n => Math.max(1, Math.round(n * factor));
  const oldBuffers = new Map();
  const newBuffers = new Map();
  const changes = doc.layers.map((layer) => {
    const patch = {};
    if (layer.kind === 'pixel') {
      Object.assign(patch, { x: Math.round(layer.x * factor), y: Math.round(layer.y * factor), width: size(layer.width), height: size(layer.height) });
      const old = doc.buffers.get(layer.bufferId);
      oldBuffers.set(layer.bufferId, old);
      newBuffers.set(layer.bufferId, resampled(old, patch.width, patch.height));
    }
    for (const key of SCALED[layer.kind] || []) if (typeof layer[key] === 'number') patch[key] = layer[key] * factor;
    if (layer.kind === 'adjust' && layer.adjust === 'blur') patch.params = { ...layer.params, radius: layer.params.radius * factor };
    if (layer.mask) {
      const m = layer.mask;
      const old = doc.buffers.get(m.bufferId);
      patch.mask = { ...m, x: Math.round(m.x * factor), y: Math.round(m.y * factor), width: size(m.width), height: size(m.height) };
      oldBuffers.set(m.bufferId, old);
      newBuffers.set(m.bufferId, resampled(old, patch.mask.width, patch.mask.height));
    }
    const previous = Object.fromEntries(Object.keys(patch).map(k => [k, layer[k]]));
    return { layer, patch, previous };
  });
  const before = { width: doc.width, height: doc.height };
  const set = (dims, buffers, which) => {
    doc.width = dims.width;
    doc.height = dims.height;
    for (const [id, surface] of buffers) doc.buffers.set(id, surface);
    for (const c of changes) assignLayer(doc, c.layer.id, c[which]);
    touchLayer(doc, null);
  };
  const apply = () => set({ width: W, height: H }, newBuffers, 'patch');
  const revert = () => set(before, oldBuffers, 'previous');
  apply();
  push(s, { bytes: PROP_BYTES + bytesOf(oldBuffers), apply, revert }, meta, `${factor}× Upscale`);
  return { ok: true };
}
