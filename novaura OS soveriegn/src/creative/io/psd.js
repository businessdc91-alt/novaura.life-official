// psd.js — Photoshop files in and out, through ag-psd (MIT, pinned 34.1.0).
//
// Opening keeps each layer's name, position, opacity, blend mode, visibility, lock and
// mask. Groups become their layers (a hidden group hides them; its opacity multiplies
// in). Text, vector shapes and smart objects come in as their pixels. Photoshop
// adjustment layers we also have come in live; others come in switched off. Anything
// that can't be kept is listed in a report, so nothing changes silently.
//
// ag-psd only makes canvases by itself when `document` exists; elsewhere (Node tests,
// workers) it is given plain RGBA arrays.

import { readPsd, writePsd, initializeCanvas } from 'ag-psd';
import { MAX_SIDE, surfaceFromPixels, createSurface } from '../surface.js';
import { createDocument, createLayer, removeLayerAt } from '../document.js';
import { fromPsdBlend, toPsdBlend } from '../blendModes.js';
import { defaultParams } from '../adjustments.js';
import { rasterizeLayer, flatten as flattenDocument, compositeBelow as compositeBeneath } from '../compositor.js';
import { adjustBelow as adjustBeneath } from '../adjustmentLayers.js';

if (typeof document === 'undefined') {
  initializeCanvas(
    (w, h) => {
      if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
      throw new Error('No canvas here.');
    },
    (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  );
}

const MODES = { 0: 'Bitmap', 1: 'Greyscale', 2: 'Indexed', 3: 'RGB', 4: 'CMYK', 7: 'Multichannel', 8: 'Duotone', 9: 'Lab' };
const UNREADABLE = new Set([7, 8, 9]);

/** ag-psd pixel data (8-, 16- or 32-bit) → 8-bit RGBA. */
export function toRgba8({ width, height, data }) {
  if (data instanceof Uint8ClampedArray) return { width, height, data };
  if (data instanceof Uint8Array) return { width, height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
  const out = new Uint8ClampedArray(width * height * 4);
  if (data instanceof Uint16Array) for (let i = 0; i < out.length; i++) out[i] = Math.round(data[i] / 257);
  else for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, data[i])) * 255);
  return { width, height, data: out };
}

function readHeader(bytes) {
  if (bytes.length < 26 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== '8BPS') {
    throw new Error("This file isn't a Photoshop file.");
  }
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { height: v.getUint32(14), width: v.getUint32(18), depth: v.getUint16(22), mode: v.getUint16(24) };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
const words = key => key.replace(/([A-Z])/g, ' $1').toLowerCase();
const quantise = o => Math.round(clamp(o, 0, 1) * 255) / 255;

function curvePoints(channel) {
  return channel?.length ? channel.map(p => [clamp(p.input, 0, 255), clamp(p.output, 0, 255)]) : null;
}

/** A PSD adjustment → { adjust, params } we can draw, or null. */
function adjustmentFrom(a, report, name) {
  switch (a.type) {
    case 'brightness/contrast':
      return { adjust: 'brightnessContrast', params: { brightness: clamp(a.brightness, -150, 150), contrast: clamp(a.contrast, -50, 100) } };
    case 'hue/saturation': {
      if (a.colorize) report.push(`"${name}": Colorize can't be kept; the hue, saturation and lightness were.`);
      const m = a.master || {};
      return { adjust: 'hueSaturation', params: { hue: clamp(m.hue, -180, 180), saturation: clamp(m.saturation, -100, 100), lightness: clamp(m.lightness, -100, 100) } };
    }
    case 'levels': {
      const c = a.channels?.[0] || {};
      return { adjust: 'levels', params: {
        inBlack: clamp(c.shadowInput ?? 0, 0, 253), inWhite: clamp(c.highlightInput ?? 255, 2, 255), gamma: clamp(c.midtoneInput ?? 1, 0.1, 9.99),
        outBlack: clamp(c.shadowOutput ?? 0, 0, 255), outWhite: clamp(c.highlightOutput ?? 255, 0, 255),
      } };
    }
    case 'curves': {
      const ch = a.channels || [];
      const points = { rgb: curvePoints(ch[0]) || [[0, 0], [255, 255]] };
      ['r', 'g', 'b'].forEach((k, i) => { const p = curvePoints(ch[i + 1]); if (p) points[k] = p; });
      return { adjust: 'curves', params: { points } };
    }
    case 'vibrance':
      return { adjust: 'vibrance', params: { vibrance: clamp(a.vibrance, -100, 100), saturation: clamp(a.saturation, -100, 100) } };
    case 'invert': return { adjust: 'invert', params: {} };
    case 'posterize': return { adjust: 'posterize', params: { levels: clamp(a.levels ?? 4, 2, 255) } };
    case 'threshold': return { adjust: 'threshold', params: { level: clamp(a.level ?? 128, 1, 255) } };
    case 'black & white': return { adjust: 'blackWhite', params: { ...defaultParams('blackWhite'), amount: 100 } };
    default: return null;
  }
}

function effectNames(effects) {
  if (!effects || effects.disabled) return [];
  return Object.entries(effects)
    .filter(([k, v]) => k !== 'disabled' && k !== 'scale' && v && (Array.isArray(v) ? v.some(e => e.enabled !== false) : v.enabled !== false))
    .map(([k]) => words(k));
}

/** PSD bytes → { doc, report: string[] }. */
export function readPsdFile(bytes, name = 'Photoshop file') {
  const header = readHeader(bytes);
  if (UNREADABLE.has(header.mode)) throw new Error(`This PSD uses ${MODES[header.mode]} colour, which Creative Studio can't open yet.`);
  if (header.width > MAX_SIDE || header.height > MAX_SIDE) {
    throw new Error(`This PSD is ${header.width}×${header.height} px; Creative Studio opens up to 16384 px per side.`);
  }
  const psd = readPsd(bytes, { useImageData: true, skipThumbnail: true, skipLinkedFilesData: true });
  const report = [];
  if (header.mode !== 3 || header.depth !== 8) report.push(`Converted from ${MODES[header.mode] || 'its colour mode'} ${header.depth}-bit to 8-bit RGB.`);

  const doc = createDocument({ name, width: psd.width, height: psd.height, background: 'transparent' });
  removeLayerAt(doc, 0);
  doc.buffers.clear();

  const add = (layer) => { doc.layers.push(layer); };

  const walk = (children, inherited) => {
    for (const l of children || []) {
      const lname = l.name || 'Layer';
      if (l.children) {
        if (l.blendMode && l.blendMode !== 'pass through') {
          report.push(`Group "${lname}": blend mode "${l.blendMode}" can't be kept; its layers use their own modes.`);
        }
        walk(l.children, { hidden: inherited.hidden || !!l.hidden, opacity: inherited.opacity * (l.opacity ?? 1) });
        continue;
      }
      const p = l.protected || {};
      const common = {
        name: lname,
        visible: !(inherited.hidden || l.hidden),
        opacity: quantise(inherited.opacity * (l.opacity ?? 1)),
        locked: !!(p.transparency && p.composite && p.position),
        ...fromPsdBlend(l.blendMode || 'normal'),
      };
      const effects = effectNames(l.effects);
      if (effects.length) report.push(`"${lname}": layer effects (${effects.join(', ')}) were dropped.`);
      if (l.vectorMask) report.push(`"${lname}": its vector mask was dropped.`);

      let layer;
      if (l.adjustment) {
        const adj = adjustmentFrom(l.adjustment, report, lname);
        if (adj) {
          layer = createLayer(doc, 'adjust', { ...common, ...adj });
        } else {
          report.push(`"${lname}": the ${l.adjustment.type} adjustment can't be shown here, so it was switched off.`);
          layer = createLayer(doc, 'pixel', { ...common, visible: false, surface: createSurface(1, 1), x: 0, y: 0 });
        }
      } else {
        const image = l.imageData && l.imageData.width && l.imageData.height ? toRgba8(l.imageData) : null;
        const surface = image ? surfaceFromPixels(image) : createSurface(1, 1);
        if (l.text?.text && !lname.includes(l.text.text)) common.name = `${lname} — "${l.text.text.slice(0, 40)}"`;
        layer = createLayer(doc, 'pixel', { ...common, surface, x: l.left ?? 0, y: l.top ?? 0 });
      }
      if (l.mask?.imageData?.width && l.mask.imageData.height) {
        const grey = toRgba8(l.mask.imageData);
        const opaque = new Uint8ClampedArray(grey.data);
        for (let i = 3; i < opaque.length; i += 4) opaque[i] = 255;
        const surface = surfaceFromPixels({ width: grey.width, height: grey.height, data: opaque });
        const bufferId = globalThis.crypto.randomUUID();
        doc.buffers.set(bufferId, surface);
        layer.mask = {
          x: l.mask.left ?? 0, y: l.mask.top ?? 0, width: grey.width, height: grey.height, bufferId,
          defaultValue: l.mask.defaultColor === 0 ? 0 : 255, enabled: !l.mask.disabled,
        };
      }
      add(layer);
    }
  };
  walk(psd.children, { hidden: false, opacity: 1 });
  if (!doc.layers.length && psd.imageData) {
    add(createLayer(doc, 'pixel', { name: 'Background', surface: surfaceFromPixels(toRgba8(psd.imageData)) }));
  }
  doc.activeLayerId = doc.layers.at(-1)?.id ?? null;
  doc.version = 0;
  for (const l of doc.layers) l.rev = 0;
  return { doc, report };
}

// ── Exporting ─────────────────────────────────────────────────────────────────

const LOCK_ALL = { transparency: true, composite: true, position: true };
const IDENTITY_CURVE = [[0, 0], [255, 255]];
const curveOut = points => (points || IDENTITY_CURVE).map(([input, output]) => ({ input, output }));

// Our adjustments that Photoshop also has, as PSD adjustment layers (null: bake it instead).
const TO_PSD = {
  brightnessContrast: p => ({ type: 'brightness/contrast', brightness: p.brightness, contrast: p.contrast, useLegacy: false }),
  hueSaturation: p => ({ type: 'hue/saturation', master: { hue: p.hue, saturation: p.saturation, lightness: p.lightness } }),
  vibrance: p => ({ type: 'vibrance', vibrance: p.vibrance, saturation: p.saturation }),
  levels: p => ({ type: 'levels', channels: [{ shadowInput: p.inBlack, highlightInput: p.inWhite, midtoneInput: p.gamma, shadowOutput: p.outBlack, highlightOutput: p.outWhite }] }),
  curves: (p) => {
    const pts = p.points || {};
    const channels = [curveOut(pts.rgb)];
    if (pts.r || pts.g || pts.b) channels.push(curveOut(pts.r), curveOut(pts.g), curveOut(pts.b));
    return { type: 'curves', channels };
  },
  blackWhite: p => (p.amount === 100 ? { type: 'black & white' } : null),
  invert: () => ({ type: 'invert' }),
  threshold: p => ({ type: 'threshold', level: p.level }),
  posterize: p => ({ type: 'posterize', levels: p.levels }),
};

const pixelsOf = surface => surface.read(0, 0, surface.width, surface.height);

/**
 * The document as PSD bytes (ArrayBuffer). Pixel layers go out as they are; shapes and
 * text as their pixels; adjustments Photoshop has as live adjustment layers, the rest
 * (and all of them with exactLook) baked: a pixel layer holding the adjusted picture
 * beneath, with the same opacity and mask, which looks identical. The drawing
 * functions can be swapped (tests run without a canvas).
 */
export function writePsdFile(doc, {
  exactLook = false, rasterize = rasterizeLayer, flatten = flattenDocument,
  compositeBelow = compositeBeneath, adjustBelow = adjustBeneath,
} = {}) {
  const children = doc.layers.map((layer) => {
    const out = { name: layer.name, opacity: layer.opacity, hidden: !layer.visible, blendMode: toPsdBlend(layer) };
    if (layer.locked) out.protected = { ...LOCK_ALL };
    if (layer.mask) {
      const m = layer.mask;
      out.mask = {
        left: m.x, top: m.y, right: m.x + m.width, bottom: m.y + m.height,
        defaultColor: m.defaultValue, disabled: m.enabled === false, imageData: pixelsOf(doc.buffers.get(m.bufferId)),
      };
    }
    if (layer.kind === 'adjust') {
      const live = !exactLook && TO_PSD[layer.adjust]?.(layer.params);
      if (live) return { ...out, adjustment: live };
      const beneath = compositeBelow(doc, layer.id);
      const adjusted = adjustBelow(doc, layer, beneath, { x: 0, y: 0, w: doc.width, h: doc.height }) || beneath;
      return { ...out, name: `${layer.name} (baked)`, blendMode: 'normal', left: 0, top: 0, imageData: pixelsOf(adjusted) };
    }
    if (layer.kind === 'pixel') return { ...out, left: layer.x, top: layer.y, imageData: pixelsOf(doc.buffers.get(layer.bufferId)) };
    const { surface, x, y } = rasterize(doc, layer);
    return { ...out, left: x, top: y, imageData: pixelsOf(surface) };
  });
  return writePsd({ width: doc.width, height: doc.height, children, imageData: pixelsOf(flatten(doc)) }, { generateThumbnail: false, noBackground: true });
}
