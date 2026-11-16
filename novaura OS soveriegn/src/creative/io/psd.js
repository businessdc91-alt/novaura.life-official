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

import { readPsd, initializeCanvas } from 'ag-psd';
import { MAX_SIDE, surfaceFromPixels, createSurface } from '../surface.js';
import { createDocument, createLayer, removeLayerAt } from '../document.js';
import { fromPsdBlend } from '../blendModes.js';
import { defaultParams } from '../adjustments.js';

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
