// blendModes.js — The 16 blend modes the canvas draws natively, and how they map to Photoshop.
//
// A layer's `blend` is a canvas globalCompositeOperation name. PSD files can use about
// ten modes the canvas lacks; those layers draw with the closest mode and keep the
// original in `psdBlend`, so exporting back to PSD loses nothing.

export const BLEND_MODES = [
  { id: 'source-over', label: 'Normal', psd: 'normal' },
  { id: 'multiply', label: 'Multiply', psd: 'multiply' },
  { id: 'screen', label: 'Screen', psd: 'screen' },
  { id: 'overlay', label: 'Overlay', psd: 'overlay' },
  { id: 'darken', label: 'Darken', psd: 'darken' },
  { id: 'lighten', label: 'Lighten', psd: 'lighten' },
  { id: 'color-dodge', label: 'Color Dodge', psd: 'color dodge' },
  { id: 'color-burn', label: 'Color Burn', psd: 'color burn' },
  { id: 'hard-light', label: 'Hard Light', psd: 'hard light' },
  { id: 'soft-light', label: 'Soft Light', psd: 'soft light' },
  { id: 'difference', label: 'Difference', psd: 'difference' },
  { id: 'exclusion', label: 'Exclusion', psd: 'exclusion' },
  { id: 'hue', label: 'Hue', psd: 'hue' },
  { id: 'saturation', label: 'Saturation', psd: 'saturation' },
  { id: 'color', label: 'Color', psd: 'color' },
  { id: 'luminosity', label: 'Luminosity', psd: 'luminosity' },
];

/** Photoshop modes the canvas can't draw, and the closest mode used to draw them. */
export const PSD_FALLBACKS = {
  dissolve: 'source-over',
  'linear burn': 'color-burn',
  'darker color': 'darken',
  'lighter color': 'lighten',
  'linear dodge': 'lighter',
  'vivid light': 'hard-light',
  'linear light': 'hard-light',
  'pin light': 'hard-light',
  'hard mix': 'hard-light',
  subtract: 'difference',
  divide: 'color-dodge',
};

const BY_ID = new Map(BLEND_MODES.map(m => [m.id, m]));
const BY_PSD = new Map(BLEND_MODES.map(m => [m.psd, m]));
const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());

export function blendLabel(layer) {
  if (layer.psdBlend) return `${titleCase(layer.psdBlend)} (PSD)`;
  if (layer.blend === 'pass-through') return 'Pass Through';
  return BY_ID.get(layer.blend)?.label || 'Normal';
}

export function toPsdBlend(layer) {
  if (layer.psdBlend) return layer.psdBlend;
  if (layer.blend === 'pass-through') return 'pass through';
  return BY_ID.get(layer.blend)?.psd || 'normal';
}

/** A PSD blend key → { blend, psdBlend }; psdBlend is null unless the mode is drawn with a fallback. */
export function fromPsdBlend(key) {
  if (BY_PSD.has(key)) return { blend: BY_PSD.get(key).id, psdBlend: null };
  if (key === 'pass through') return { blend: 'source-over', psdBlend: null };
  if (key in PSD_FALLBACKS) return { blend: PSD_FALLBACKS[key], psdBlend: key };
  return { blend: 'source-over', psdBlend: key };
}
