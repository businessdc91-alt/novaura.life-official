// edits.js — Every change a person makes to a document, as one undoable step.
//
// Each function takes a session { doc, history }, makes its change, pushes one step,
// and returns { ok: true, layer? } or { ok: false, reason } (a reason the UI can show).
// `meta` is { tab, label?, mergeKey?, mergeWindowMs? }.

import {
  getLayer, layerIndex, canEdit, insertLayer, removeLayerAt, moveLayer, assignLayer,
  createLayer, cloneLayer, takeBuffers, putBuffers, touchLayer, surfaceOf,
  collectDescendants, isDescendant,
} from './document.js';
import { compoundStep } from './history.js';
import { applyPatch, beginPixelEdit } from './pixelRecorder.js';
import { createMask, invertPixels } from './masks.js';
import { createSurface, MAX_SIDE, surfaceFromPixels, resampleSurface } from './surface.js';
import {
  cloneSelection, createSelection, invertSelectionMask, translateSelectionMask,
  resampleSelectionMask, featherMaskData, rectSelectionData, computeSelectionBounds,
} from './selection.js';

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

const kindLabel = { pixel: 'layer', shape: 'shape layer', text: 'text layer', adjust: 'adjustment layer', group: 'group' };

/** Add a new layer, by default just above the active layer (inheriting its group), and make it active. */
export function addLayer(s, kind, fields, meta, index) {
  const { doc } = s;
  const active = getLayer(doc, doc.activeLayerId);
  const parentId = fields?.parentId !== undefined
    ? fields.parentId
    : (active?.kind === 'group' ? active.id : (active?.parentId ?? null));
  const layer = createLayer(doc, kind, { parentId, ...(fields || {}) });
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
  const targets = layer.kind === 'group' ? [layer, ...collectDescendants(doc, id)] : [layer];
  for (const t of targets) {
    const ok = canEdit(t, 'delete');
    if (!ok.ok) return ok;
  }
  if (doc.layers.length - targets.length < 1) return refuse('A document needs at least one layer.');
  const targetIds = new Set(targets.map(t => t.id));
  const entries = doc.layers
    .map((l, idx) => (targetIds.has(l.id) ? { index: idx, layer: l } : null))
    .filter(Boolean);
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  let buffers = new Map();
  const apply = () => {
    buffers = new Map();
    for (let i = entries.length - 1; i >= 0; i--) {
      const removed = removeLayerAt(doc, entries[i].index);
      for (const [k, v] of takeBuffers(doc, removed)) buffers.set(k, v);
    }
    if (!getLayer(doc, doc.activeLayerId)) {
      const fallbackIdx = Math.max(0, Math.min(entries[0].index - 1, doc.layers.length - 1));
      restoreActive(doc, doc.layers[fallbackIdx]?.id ?? null, 'layer');
    }
  };
  const revert = () => {
    putBuffers(doc, buffers);
    for (const entry of entries) insertLayer(doc, entry.layer, entry.index);
    restoreActive(doc, before.id, before.target);
  };
  apply();
  push(s, { bytes: PROP_BYTES + bytesOf(buffers), apply, revert }, meta, layer.kind === 'group' ? 'Delete group' : 'Delete layer');
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

const KEY_ACTION = { visible: 'visibility', locked: 'unlock', name: 'rename', x: 'move', y: 'move', parentId: 'reorder', expanded: 'reorder' };

function propsLabel(patch) {
  const keys = Object.keys(patch);
  if (keys.length === 1) {
    const [k] = keys;
    if (k === 'opacity') return 'Opacity';
    if (k === 'blend') return 'Blend mode';
    if (k === 'visible') return patch.visible ? 'Show layer' : 'Hide layer';
    if (k === 'locked') return patch.locked ? 'Lock layer' : 'Unlock layer';
    if (k === 'name') return 'Rename layer';
    if (k === 'parentId') return 'Move into group';
    if (k === 'expanded') return patch.expanded ? 'Expand group' : 'Collapse group';
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

/** Atomically update multiple layers in one mergeable history step (e.g. moving a group). */
export function setBatchLayerProps(s, entries, meta) {
  const { doc } = s;
  const normalized = entries
    .map(({ id, patch }) => {
      const layer = getLayer(doc, id);
      if (!layer) return null;
      const changes = Object.fromEntries(Object.entries(patch).filter(([k, v]) => !Object.is(layer[k], v)));
      if (!Object.keys(changes).length) return null;
      return { id, changes, previous: assignLayer(doc, id, changes) };
    })
    .filter(Boolean);
  if (!normalized.length) return { ok: true };
  const makeStep = (list) => ({
    bytes: PROP_BYTES * list.length, list,
    apply: () => { for (const x of list) assignLayer(doc, x.id, x.changes); },
    revert: () => { for (const x of list) assignLayer(doc, x.id, x.previous); },
    mergeWith(newer) {
      const byId = new Map(list.map(x => [x.id, { ...x, changes: { ...x.changes }, previous: { ...x.previous } }]));
      for (const n of newer.list) {
        const cur = byId.get(n.id);
        if (cur) {
          Object.assign(cur.changes, n.changes);
          for (const [k, v] of Object.entries(n.previous)) if (!(k in cur.previous)) cur.previous[k] = v;
        } else {
          byId.set(n.id, n);
        }
      }
      const merged = makeStep([...byId.values()]);
      merged.label = meta?.label || 'Move group';
      merged.tab = meta?.tab;
      return merged;
    },
  });
  push(s, makeStep(normalized), meta, meta?.label || 'Move group');
  return { ok: true };
}

function cloneSubtree(fromDoc, layer, intoDoc = fromDoc) {
  const idMap = new Map();
  const list = layer.kind === 'group' ? [...collectDescendants(fromDoc, layer.id), layer] : [layer];
  const clones = list.map((src) => {
    const copy = cloneLayer(fromDoc, src, intoDoc);
    idMap.set(src.id, copy.id);
    return { src, copy };
  });
  for (const { src, copy } of clones) {
    copy.parentId = src.id === layer.id ? (src.parentId ?? null) : (idMap.get(src.parentId) ?? null);
  }
  return { root: clones.at(-1).copy, clones: clones.map(c => c.copy), idMap };
}

/** Copy a layer or group (descendants, pixels and masks included) just above itself. */
export function duplicateLayer(s, id, meta) {
  const { doc } = s;
  const layer = getLayer(doc, id);
  if (!layer) return GONE;
  const { root, clones } = cloneSubtree(doc, layer, doc);
  root.name = `${layer.name} copy`;
  const buffers = new Map();
  for (const c of clones) for (const [k, v] of takeBuffers(doc, c)) buffers.set(k, v);
  const insertAt = layerIndex(doc, id) + 1;
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  const apply = () => {
    putBuffers(doc, buffers);
    clones.forEach((c, i) => insertLayer(doc, c, insertAt + i));
    restoreActive(doc, root.id, 'layer');
  };
  const revert = () => {
    for (let i = clones.length - 1; i >= 0; i--) {
      const idx = layerIndex(doc, clones[i].id);
      if (idx >= 0) removeLayerAt(doc, idx);
      takeBuffers(doc, clones[i]);
    }
    restoreActive(doc, before.id, before.target);
  };
  apply();
  push(s, { bytes: PROP_BYTES * clones.length + bytesOf(buffers), apply, revert }, meta, layer.kind === 'group' ? 'Duplicate group' : 'Duplicate layer');
  return { ok: true, layer: root };
}

/** Put a layer inside a group (`parentId`), or move it out (`parentId = null`). */
export function setLayerParent(s, id, parentId, meta) {
  const { doc } = s;
  const layer = getLayer(doc, id);
  if (!layer) return GONE;
  if (parentId) {
    const target = getLayer(doc, parentId);
    if (!target || target.kind !== 'group') return refuse('Target is not a group.');
    if (isDescendant(doc, parentId, id)) return refuse("A group can't go inside itself.");
  }
  return setLayerProps(s, id, { parentId: parentId || null }, { ...meta, label: meta?.label || (parentId ? 'Move into group' : 'Move out of group') });
}

/** Wrap a layer (or layers) in a new folder group. One undoable step. */
export function groupLayer(s, id, meta) {
  const { doc } = s;
  const ids = Array.isArray(id) ? id : [id];
  const targets = ids.map(x => getLayer(doc, x)).filter(Boolean);
  if (!targets.length) return GONE;
  for (const t of targets) {
    const ok = canEdit(t, 'reorder');
    if (!ok.ok) return ok;
  }
  const top = targets.reduce((best, t) => (layerIndex(doc, t.id) > layerIndex(doc, best.id) ? t : best), targets[0]);
  const group = createLayer(doc, 'group', { parentId: top.parentId ?? null });
  const prevParents = new Map(targets.map(t => [t.id, t.parentId ?? null]));
  const at = layerIndex(doc, top.id) + 1;
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  const apply = () => {
    insertLayer(doc, group, at);
    for (const t of targets) assignLayer(doc, t.id, { parentId: group.id });
    restoreActive(doc, group.id, 'layer');
  };
  const revert = () => {
    for (const t of targets) assignLayer(doc, t.id, { parentId: prevParents.get(t.id) });
    const idx = layerIndex(doc, group.id);
    if (idx >= 0) removeLayerAt(doc, idx);
    restoreActive(doc, before.id, before.target);
  };
  apply();
  push(s, { bytes: PROP_BYTES, apply, revert }, meta, 'Group layers');
  return { ok: true, layer: group };
}

/** Dissolve a group folder, promoting its direct children up to its parent level. */
export function ungroupLayer(s, groupId, meta) {
  const { doc } = s;
  const group = getLayer(doc, groupId);
  if (!group) return GONE;
  if (group.kind !== 'group') return refuse('That layer is not a group.');
  const allowed = canEdit(group, 'delete');
  if (!allowed.ok) return allowed;
  const children = doc.layers.filter(l => l.parentId === groupId);
  const idx = layerIndex(doc, groupId);
  const before = { id: doc.activeLayerId, target: doc.activeTarget };
  let maskBuffers = new Map();
  const apply = () => {
    for (const c of children) assignLayer(doc, c.id, { parentId: group.parentId ?? null });
    removeLayerAt(doc, layerIndex(doc, groupId));
    maskBuffers = takeBuffers(doc, group);
    if (doc.activeLayerId === groupId) restoreActive(doc, children.at(-1)?.id ?? doc.layers.at(-1)?.id ?? null, 'layer');
  };
  const revert = () => {
    putBuffers(doc, maskBuffers);
    insertLayer(doc, group, idx);
    for (const c of children) assignLayer(doc, c.id, { parentId: groupId });
    restoreActive(doc, before.id, before.target);
  };
  apply();
  push(s, { bytes: PROP_BYTES + bytesOf(maskBuffers), apply, revert }, meta, 'Ungroup');
  return { ok: true };
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

const SCALE_X = new Set(['x', 'w', 'x1', 'x2', 'wrapWidth']);
const SCALE_Y = new Set(['y', 'h', 'y1', 'y2']);
const SCALE_UNIFORM = new Set(['radius', 'strokeWidth', 'fontSize']);

function resampleDocument(s, targetW, targetH, meta, label) {
  const { doc } = s;
  const W = Math.round(Number(targetW));
  const H = Math.round(Number(targetH));
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1) return refuse('Width and height must be at least 1 px.');
  if (W > MAX_SIDE || H > MAX_SIDE) return refuse(`${W}×${H} px would be larger than 16384 px.`);
  if (W === doc.width && H === doc.height) return { ok: true };
  const sx = W / doc.width;
  const sy = H / doc.height;
  const su = Math.min(sx, sy);
  const sizeX = n => Math.max(1, Math.round(n * sx));
  const sizeY = n => Math.max(1, Math.round(n * sy));
  const oldBuffers = new Map();
  const newBuffers = new Map();
  const changes = doc.layers.map((layer) => {
    const patch = {};
    if (layer.kind === 'pixel') {
      Object.assign(patch, { x: Math.round(layer.x * sx), y: Math.round(layer.y * sy), width: sizeX(layer.width), height: sizeY(layer.height) });
      const old = doc.buffers.get(layer.bufferId);
      oldBuffers.set(layer.bufferId, old);
      newBuffers.set(layer.bufferId, resampleSurface(old, patch.width, patch.height));
    }
    if (layer.kind === 'shape' || layer.kind === 'text') {
      for (const k of SCALE_X) if (typeof layer[k] === 'number') patch[k] = layer[k] * sx;
      for (const k of SCALE_Y) if (typeof layer[k] === 'number') patch[k] = layer[k] * sy;
      for (const k of SCALE_UNIFORM) if (typeof layer[k] === 'number') patch[k] = layer[k] * su;
    }
    if (layer.kind === 'adjust' && layer.adjust === 'blur') patch.params = { ...layer.params, radius: layer.params.radius * su };
    if (layer.mask) {
      const m = layer.mask;
      const old = doc.buffers.get(m.bufferId);
      patch.mask = { ...m, x: Math.round(m.x * sx), y: Math.round(m.y * sy), width: sizeX(m.width), height: sizeY(m.height) };
      oldBuffers.set(m.bufferId, old);
      newBuffers.set(m.bufferId, resampleSurface(old, patch.mask.width, patch.mask.height));
    }
    const previous = Object.fromEntries(Object.keys(patch).map(k => [k, layer[k]]));
    return { layer, patch, previous };
  });
  const before = { width: doc.width, height: doc.height, selection: doc.selection };
  const nextSel = resampleSelectionMask(doc.selection, W, H);
  const set = (dims, buffers, which, selection) => {
    doc.width = dims.width;
    doc.height = dims.height;
    doc.selection = selection;
    for (const [id, surface] of buffers) doc.buffers.set(id, surface);
    for (const c of changes) assignLayer(doc, c.layer.id, c[which]);
    touchLayer(doc, null);
  };
  const apply = () => set({ width: W, height: H }, newBuffers, 'patch', nextSel);
  const revert = () => set(before, oldBuffers, 'previous', before.selection);
  apply();
  push(s, { bytes: PROP_BYTES + bytesOf(oldBuffers), apply, revert }, meta, label);
  return { ok: true };
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
  return resampleDocument(s, W, H, meta, `${factor}× Upscale`);
}

/** Resample the entire document to exact dimensions `{ width, height }`. One step. */
export function resizeImage(s, { width, height }, meta) {
  return resampleDocument(s, width, height, meta, 'Image size');
}

function shiftLayerFields(layer, dx, dy) {
  const patch = {};
  if (layer.kind === 'pixel' || layer.kind === 'text') {
    patch.x = layer.x + dx;
    patch.y = layer.y + dy;
  } else if (layer.kind === 'shape') {
    if (layer.shape === 'line') {
      Object.assign(patch, { x1: layer.x1 + dx, y1: layer.y1 + dy, x2: layer.x2 + dx, y2: layer.y2 + dy });
    } else {
      Object.assign(patch, { x: layer.x + dx, y: layer.y + dy });
    }
  }
  if (layer.mask) patch.mask = { ...layer.mask, x: layer.mask.x + dx, y: layer.mask.y + dy };
  return patch;
}

const ANCHOR_X = { left: 0, center: 0.5, right: 1 };
const ANCHOR_Y = { top: 0, middle: 0.5, bottom: 1 };

/** Change canvas dimensions without scaling existing artwork, aligning via anchor (e.g. 'middle-center'). */
export function resizeCanvas(s, { width, height, anchor = 'middle-center' }, meta) {
  const { doc } = s;
  const W = Math.round(Number(width));
  const H = Math.round(Number(height));
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1) return refuse('Canvas width and height must be at least 1 px.');
  if (W > MAX_SIDE || H > MAX_SIDE) return refuse('Canvas sides must be 1–16384 px.');
  const [ayName = 'middle', axName = 'center'] = String(anchor).split('-');
  const dx = Math.round((W - doc.width) * (ANCHOR_X[axName] ?? 0.5));
  const dy = Math.round((H - doc.height) * (ANCHOR_Y[ayName] ?? 0.5));
  if (W === doc.width && H === doc.height && dx === 0 && dy === 0) return { ok: true };

  const changes = doc.layers.map((layer) => {
    const patch = shiftLayerFields(layer, dx, dy);
    const previous = Object.fromEntries(Object.keys(patch).map(k => [k, layer[k]]));
    return { layer, patch, previous };
  });
  const before = { width: doc.width, height: doc.height, selection: doc.selection };
  const nextSel = translateSelectionMask(doc.selection, dx, dy, W, H);
  const run = (dims, which, sel) => {
    doc.width = dims.width;
    doc.height = dims.height;
    doc.selection = sel;
    for (const c of changes) if (Object.keys(c[which]).length) assignLayer(doc, c.layer.id, c[which]);
    touchLayer(doc, null);
  };
  const apply = () => run({ width: W, height: H }, 'patch', nextSel);
  const revert = () => run(before, 'previous', before.selection);
  apply();
  push(s, { bytes: PROP_BYTES * changes.length, apply, revert }, meta, 'Canvas size');
  return { ok: true };
}

/** Crop the document to `{ x, y, w, h }` in document coordinates. One step. */
export function cropDocument(s, rect, meta, { deleteCropped = false } = {}) {
  const { doc } = s;
  const cx = Math.round(rect.x);
  const cy = Math.round(rect.y);
  const cw = Math.round(rect.w);
  const ch = Math.round(rect.h);
  if (cw < 1 || ch < 1 || cw > MAX_SIDE || ch > MAX_SIDE) return refuse('Crop size must be 1–16384 px.');
  if (cx === 0 && cy === 0 && cw === doc.width && ch === doc.height && !deleteCropped) return { ok: true };

  const oldBuffers = new Map();
  const newBuffers = new Map();
  const changes = doc.layers.map((layer) => {
    const patch = shiftLayerFields(layer, -cx, -cy);
    if (deleteCropped && layer.kind === 'pixel') {
      const old = doc.buffers.get(layer.bufferId);
      const ix0 = Math.max(layer.x, cx);
      const iy0 = Math.max(layer.y, cy);
      const ix1 = Math.min(layer.x + layer.width, cx + cw);
      const iy1 = Math.min(layer.y + layer.height, cy + ch);
      const trimmed = ix1 > ix0 && iy1 > iy0
        ? surfaceFromPixels(old.read(ix0 - layer.x, iy0 - layer.y, ix1 - ix0, iy1 - iy0))
        : createSurface(1, 1);
      patch.x = ix1 > ix0 ? ix0 - cx : 0;
      patch.y = iy1 > iy0 ? iy0 - cy : 0;
      patch.width = trimmed.width;
      patch.height = trimmed.height;
      oldBuffers.set(layer.bufferId, old);
      newBuffers.set(layer.bufferId, trimmed);
    }
    const previous = Object.fromEntries(Object.keys(patch).map(k => [k, layer[k]]));
    return { layer, patch, previous };
  });

  const before = { width: doc.width, height: doc.height, selection: doc.selection };
  const nextSel = translateSelectionMask(doc.selection, -cx, -cy, cw, ch);
  const run = (dims, buffers, which, sel) => {
    doc.width = dims.width;
    doc.height = dims.height;
    doc.selection = sel;
    for (const [id, surface] of buffers) doc.buffers.set(id, surface);
    for (const c of changes) if (Object.keys(c[which]).length) assignLayer(doc, c.layer.id, c[which]);
    touchLayer(doc, null);
  };
  const apply = () => run({ width: cw, height: ch }, newBuffers, 'patch', nextSel);
  const revert = () => run(before, oldBuffers, 'previous', before.selection);
  apply();
  push(s, { bytes: PROP_BYTES * changes.length + bytesOf(oldBuffers), apply, revert }, meta, 'Crop');
  return { ok: true };
}

// ── Selections ────────────────────────────────────────────────────────────────

export function setSelection(s, nextSelection, meta, label = 'Selection') {
  const { doc } = s;
  const before = cloneSelection(doc.selection);
  const after = nextSelection ? cloneSelection(nextSelection) : null;
  if (!before && !after) return { ok: true };
  const set = (sel) => {
    doc.selection = sel;
    touchLayer(doc, null);
  };
  set(after);
  const bytes = PROP_BYTES + (after?.data.byteLength || before?.data.byteLength || 0);
  push(s, { bytes, apply: () => set(after), revert: () => set(before) }, meta, label);
  return { ok: true, selection: doc.selection };
}

export function selectAll(s, meta) {
  const { doc } = s;
  const data = rectSelectionData(doc.width, doc.height, { x: 0, y: 0, w: doc.width, h: doc.height });
  return setSelection(s, createSelection(doc.width, doc.height, data), meta, 'Select all');
}

export function clearSelection(s, meta) {
  if (!s.doc.selection) return { ok: true };
  return setSelection(s, null, meta, 'Deselect');
}

export function invertSelection(s, meta) {
  const { doc } = s;
  return setSelection(s, invertSelectionMask(doc.selection, doc.width, doc.height), meta, 'Invert selection');
}

export function featherSelection(s, radius, meta) {
  const { doc } = s;
  if (!doc.selection) return refuse('Make a selection first.');
  const data = featherMaskData(doc.selection.data, doc.width, doc.height, radius);
  return setSelection(s, createSelection(doc.width, doc.height, data), meta, 'Feather selection');
}

/** Erase/clear the pixels inside doc.selection (or the whole layer) on the active pixel layer or mask. */
export function clearSelectedPixels(s, meta) {
  const { doc } = s;
  const layer = getLayer(doc, doc.activeLayerId);
  if (!layer) return GONE;
  const part = doc.activeTarget === 'mask' ? 'mask' : 'layer';
  const allowed = canEdit(layer, part === 'mask' ? 'mask' : 'paint');
  if (!allowed.ok) return allowed;
  const surface = surfaceOf(doc, layer, part);
  const o = part === 'mask' ? layer.mask : layer;
  const sel = doc.selection;
  const rect = sel
    ? {
        x0: Math.max(0, sel.bounds.x - o.x),
        y0: Math.max(0, sel.bounds.y - o.y),
        x1: Math.min(surface.width, sel.bounds.x + sel.bounds.w - o.x),
        y1: Math.min(surface.height, sel.bounds.y + sel.bounds.h - o.y),
      }
    : { x0: 0, y0: 0, x1: surface.width, y1: surface.height };
  if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return { ok: true };

  const rw = rect.x1 - rect.x0;
  const rh = rect.y1 - rect.y0;
  const recorder = beginPixelEdit(surface);
  recorder.touch(rect.x0, rect.y0, rw, rh);
  const px = surface.read(rect.x0, rect.y0, rw, rh);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const m = sel ? (sel.data[(o.y + rect.y0 + y) * sel.width + (o.x + rect.x0 + x)] / 255) : 1;
      if (m <= 0) continue;
      const i = (y * rw + x) * 4;
      if (part === 'mask') {
        const inv = 1 - m;
        px.data[i] = Math.round(px.data[i] * inv);
        px.data[i + 1] = Math.round(px.data[i + 1] * inv);
        px.data[i + 2] = Math.round(px.data[i + 2] * inv);
      } else {
        px.data[i + 3] = Math.round(px.data[i + 3] * (1 - m));
      }
    }
  }
  surface.write(rect.x0, rect.y0, px);
  commitPatch(s, layer.id, part, recorder.finish(), { ...meta, label: meta?.label || (sel ? 'Clear selection' : 'Clear layer') });
  return { ok: true };
}

/** Extract copied pixel data { width, height, x, y, data } from active pixel layer within selection. */
export function copySelectedPixels(doc) {
  const layer = getLayer(doc, doc.activeLayerId);
  if (!layer || layer.kind !== 'pixel') return { ok: false, reason: 'Choose a pixel layer to copy.' };
  const surface = surfaceOf(doc, layer);
  const sel = doc.selection;
  const x = sel ? Math.max(0, sel.bounds.x) : Math.max(0, layer.x);
  const y = sel ? Math.max(0, sel.bounds.y) : Math.max(0, layer.y);
  const x1 = sel ? Math.min(doc.width, sel.bounds.x + sel.bounds.w) : Math.min(doc.width, layer.x + layer.width);
  const y1 = sel ? Math.min(doc.height, sel.bounds.y + sel.bounds.h) : Math.min(doc.height, layer.y + layer.height);
  if (x1 <= x || y1 <= y) return { ok: false, reason: 'Nothing inside the canvas to copy.' };
  const w = x1 - x;
  const h = y1 - y;
  const pixels = surface.read(x - layer.x, y - layer.y, w, h);
  if (sel) {
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const m = sel.data[(y + py) * sel.width + (x + px)];
        const i = (py * w + px) * 4;
        pixels.data[i + 3] = Math.round((pixels.data[i + 3] * m) / 255);
      }
    }
  }
  return { ok: true, clipboard: { width: w, height: h, x, y, data: pixels.data } };
}

export function cutSelectedPixels(s, meta) {
  const res = copySelectedPixels(s.doc);
  if (!res.ok) return res;
  const cleared = clearSelectedPixels(s, { ...meta, label: 'Cut' });
  if (!cleared.ok) return cleared;
  return { ok: true, clipboard: res.clipboard };
}

export function pastePixels(s, clipboard, meta) {
  if (!clipboard?.data || !clipboard.width || !clipboard.height) return refuse('Clipboard is empty.');
  const { doc } = s;
  const w = Math.min(MAX_SIDE, clipboard.width);
  const h = Math.min(MAX_SIDE, clipboard.height);
  const surface = surfaceFromPixels({ width: w, height: h, data: clipboard.data.slice(0, w * h * 4) });
  const x = Math.max(0, Math.min(doc.width - w, clipboard.x ?? Math.round((doc.width - w) / 2)));
  const y = Math.max(0, Math.min(doc.height - h, clipboard.y ?? Math.round((doc.height - h) / 2)));
  return addLayer(s, 'pixel', { name: 'Pasted layer', surface, x, y }, { ...meta, label: 'Paste' });
}

/** Convert the active selection into a layer mask on the active layer (creating one if absent). */
export function selectionToMask(s, meta) {
  const { doc } = s;
  const sel = doc.selection;
  if (!sel || !computeSelectionBounds(sel.data, sel.width, sel.height)) return refuse('Make a selection first.');
  const { layer, error } = maskable(doc, doc.activeLayerId);
  if (error) return error;

  const surface = createSurface(doc.width, doc.height);
  const rgba = new Uint8ClampedArray(doc.width * doc.height * 4);
  for (let i = 0; i < sel.data.length; i++) {
    const v = sel.data[i];
    const p = i * 4;
    rgba[p] = v; rgba[p + 1] = v; rgba[p + 2] = v; rgba[p + 3] = 255;
  }
  surface.write(0, 0, { width: doc.width, height: doc.height, data: rgba });
  const newMask = { x: 0, y: 0, width: doc.width, height: doc.height, bufferId: globalThis.crypto.randomUUID(), defaultValue: 0, enabled: true };
  const oldMask = layer.mask;
  const oldSurface = oldMask ? doc.buffers.get(oldMask.bufferId) : null;
  const before = { id: doc.activeLayerId, target: doc.activeTarget };

  const apply = () => {
    if (oldMask) doc.buffers.delete(oldMask.bufferId);
    doc.buffers.set(newMask.bufferId, surface);
    assignLayer(doc, layer.id, { mask: newMask });
    restoreActive(doc, layer.id, 'mask');
  };
  const revert = () => {
    doc.buffers.delete(newMask.bufferId);
    if (oldMask && oldSurface) doc.buffers.set(oldMask.bufferId, oldSurface);
    assignLayer(doc, layer.id, { mask: oldMask });
    restoreActive(doc, before.id, before.target);
  };
  apply();
  push(s, { bytes: PROP_BYTES + surface.bytes + (oldSurface?.bytes || 0), apply, revert }, meta, 'Selection to mask');
  return { ok: true, layer };
}

// ── Between documents ─────────────────────────────────────────────────────────

/** Copy a layer or group (descendants and masks included) into another open document. One step there. */
export function copyLayerToDocument(from, layerId, to, meta) {
  const layer = getLayer(from.doc, layerId);
  if (!layer) return GONE;
  const { root, clones } = cloneSubtree(from.doc, layer, to.doc);
  root.parentId = null;
  const buffers = new Map();
  for (const c of clones) for (const [k, v] of takeBuffers(to.doc, c)) buffers.set(k, v);
  const index = layerIndex(to.doc, to.doc.activeLayerId) + 1 || to.doc.layers.length;
  const before = { id: to.doc.activeLayerId, target: to.doc.activeTarget };
  const apply = () => {
    putBuffers(to.doc, buffers);
    clones.forEach((c, i) => insertLayer(to.doc, c, index + i));
    restoreActive(to.doc, root.id, 'layer');
  };
  const revert = () => {
    for (let i = clones.length - 1; i >= 0; i--) {
      const idx = layerIndex(to.doc, clones[i].id);
      if (idx >= 0) removeLayerAt(to.doc, idx);
      takeBuffers(to.doc, clones[i]);
    }
    restoreActive(to.doc, before.id, before.target);
  };
  apply();
  push(to, { bytes: PROP_BYTES * clones.length + bytesOf(buffers), apply, revert }, meta, `Copy layer from ${from.doc.name}`);
  return { ok: true, layer: root };
}
