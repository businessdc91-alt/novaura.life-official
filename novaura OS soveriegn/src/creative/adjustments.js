// adjustments.js — The adjustment layers: what each one does, its settings, and the
// maths in three forms: a lookup table or per-pixel function (used live and in
// workers), a canvas filter string (sepia, blur), and an SVG filter (for SVG export).
//
// compute: 'lut' (each channel through a 256-entry table), 'pixel' (needs the whole
// pixel, or its position), 'filter' (drawn with ctx.filter). Alpha is never changed.

import { setAdjustmentLabeler } from './document.js';

const range = (min, max, def, step = 1) => ({ min, max, default: def, step });

export const ADJUSTMENTS = {
  brightnessContrast: { label: 'Brightness/Contrast', compute: 'lut', params: { brightness: range(-150, 150, 0), contrast: range(-50, 100, 0) } },
  hueSaturation: { label: 'Hue/Saturation', compute: 'pixel', params: { hue: range(-180, 180, 0), saturation: range(-100, 100, 0), lightness: range(-100, 100, 0) } },
  vibrance: { label: 'Vibrance', compute: 'pixel', params: { vibrance: range(-100, 100, 0), saturation: range(-100, 100, 0) } },
  levels: {
    label: 'Levels', compute: 'lut',
    params: { inBlack: range(0, 253, 0), inWhite: range(2, 255, 255), gamma: range(0.1, 9.99, 1, 0.01), outBlack: range(0, 255, 0), outWhite: range(0, 255, 255) },
  },
  curves: { label: 'Curves', compute: 'lut', params: { points: { kind: 'curves', default: { rgb: [[0, 0], [255, 255]] } } } },
  blackWhite: { label: 'Black & White', compute: 'pixel', params: { amount: range(0, 100, 100) } },
  invert: { label: 'Invert', compute: 'lut', params: {} },
  threshold: { label: 'Threshold', compute: 'pixel', params: { level: range(1, 255, 128) } },
  posterize: { label: 'Posterize', compute: 'lut', params: { levels: range(2, 255, 4) } },
  sepia: { label: 'Sepia', compute: 'filter', params: { amount: range(0, 100, 100) } },
  blur: { label: 'Blur', compute: 'filter', params: { radius: range(0, 250, 4) } },
  vignette: { label: 'Vignette', compute: 'pixel', params: { amount: range(-100, 100, -50), size: range(0, 100, 50), softness: range(0, 100, 50) } },
};

setAdjustmentLabeler(type => ADJUSTMENTS[type]?.label || type);

export function defaultParams(type) {
  const def = ADJUSTMENTS[type];
  if (!def) throw new Error(`Unknown adjustment "${type}".`);
  return Object.fromEntries(Object.entries(def.params).map(([k, p]) => [k, structuredClone(p.default)]));
}

const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v);
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const table = fn => Uint8ClampedArray.from({ length: 256 }, (_, v) => Math.round(clamp255(fn(v))));

/** A monotone cubic (Fritsch–Carlson) through the points, flat beyond the ends: 256 entries. */
export function curveTable(points) {
  const pts = [...(points?.length ? points : [[0, 0], [255, 255]])].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  if (n === 1) return table(() => pts[0][1]);
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const d = xs.slice(0, -1).map((x, k) => (ys[k + 1] - ys[k]) / Math.max(1e-9, xs[k + 1] - x));
  const m = xs.map((_, k) => {
    if (k === 0) return d[0];
    if (k === n - 1) return d[n - 2];
    return d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  });
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) { m[k] = 0; m[k + 1] = 0; continue; }
    const a = m[k] / d[k];
    const b = m[k + 1] / d[k];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
  }
  return table((v) => {
    if (v <= xs[0]) return ys[0];
    if (v >= xs[n - 1]) return ys[n - 1];
    let k = 0;
    while (v > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k];
    const t = (v - xs[k]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1];
  });
}

/** Per-channel tables { r, g, b } for 'lut' adjustments. */
export function buildLut(type, p) {
  let one;
  switch (type) {
    case 'brightnessContrast': one = table(v => (v - 127.5) * (1 + p.contrast / 100) + 127.5 + p.brightness); break;
    case 'levels': {
      const span = Math.max(1, p.inWhite - p.inBlack);
      one = table((v) => {
        const t = Math.min(1, Math.max(0, (v - p.inBlack) / span)) ** (1 / p.gamma);
        return p.outBlack + (p.outWhite - p.outBlack) * t;
      });
      break;
    }
    case 'invert': one = table(v => 255 - v); break;
    case 'posterize': {
      const n = Math.max(2, p.levels | 0);
      one = table(v => Math.round(Math.round((v * (n - 1)) / 255) * (255 / (n - 1))));
      break;
    }
    case 'curves': {
      const rgb = curveTable(p.points?.rgb);
      const channel = c => (p.points?.[c] ? curveTable(p.points[c]) : null);
      const compose = (c) => {
        const own = channel(c);
        return own ? Uint8ClampedArray.from(own, v => rgb[v]) : rgb;
      };
      return { r: compose('r'), g: compose('g'), b: compose('b') };
    }
    default: throw new Error(`"${type}" is not a lookup-table adjustment.`);
  }
  return { r: one, g: one, b: one };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hh = (((h % 360) + 360) % 360) / 360;
  return [hue(hh + 1 / 3) * 255, hue(hh) * 255, hue(hh - 1 / 3) * 255];
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / Math.max(1e-9, e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Apply a 'lut' or 'pixel' adjustment to pixels in place. geom gives the document size
 * and where these pixels sit in it (vignette depends on position).
 */
export function applyAdjustmentPixels(type, p, pixels, geom = { docWidth: pixels.width, docHeight: pixels.height, originX: 0, originY: 0 }) {
  const def = ADJUSTMENTS[type];
  if (!def) throw new Error(`Unknown adjustment "${type}".`);
  if (def.compute === 'filter') throw new Error(`"${type}" needs a canvas filter.`);
  const d = pixels.data;
  if (def.compute === 'lut') {
    const { r, g, b } = buildLut(type, p);
    for (let i = 0; i < d.length; i += 4) { d[i] = r[d[i]]; d[i + 1] = g[d[i + 1]]; d[i + 2] = b[d[i + 2]]; }
    return pixels;
  }
  if (type === 'hueSaturation') {
    for (let i = 0; i < d.length; i += 4) {
      let [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      h += p.hue;
      s = Math.min(1, Math.max(0, s * (1 + p.saturation / 100)));
      l = p.lightness > 0 ? l + (1 - l) * (p.lightness / 100) : l * (1 + p.lightness / 100);
      const [r, g, b] = hslToRgb(h, s, l);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  } else if (type === 'vibrance') {
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i]; let g = d[i + 1]; let b = d[i + 2];
      const avg = (r + g + b) / 3;
      const k = (p.vibrance / 100) * (1 - (Math.max(r, g, b) - Math.min(r, g, b)) / 255);
      r = avg + (r - avg) * (1 + k); g = avg + (g - avg) * (1 + k); b = avg + (b - avg) * (1 + k);
      const avg2 = (r + g + b) / 3;
      const s = 1 + p.saturation / 100;
      d[i] = avg2 + (r - avg2) * s; d[i + 1] = avg2 + (g - avg2) * s; d[i + 2] = avg2 + (b - avg2) * s;
    }
  } else if (type === 'blackWhite') {
    const a = p.amount / 100;
    for (let i = 0; i < d.length; i += 4) {
      const y = lum(d[i], d[i + 1], d[i + 2]);
      d[i] += (y - d[i]) * a; d[i + 1] += (y - d[i + 1]) * a; d[i + 2] += (y - d[i + 2]) * a;
    }
  } else if (type === 'threshold') {
    for (let i = 0; i < d.length; i += 4) {
      const v = lum(d[i], d[i + 1], d[i + 2]) >= p.level ? 255 : 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
  } else if (type === 'vignette') {
    const { docWidth: W, docHeight: H, originX = 0, originY = 0 } = geom;
    const start = 1 - p.size / 100;
    const end = start + (1 - start) * Math.max(0.05, p.softness / 100);
    const amount = p.amount / 100;
    for (let y = 0; y < pixels.height; y++) {
      const dy = (originY + y + 0.5 - H / 2) / (H / 2);
      for (let x = 0; x < pixels.width; x++) {
        const dx = (originX + x + 0.5 - W / 2) / (W / 2);
        const t = smoothstep(start, end, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2);
        if (!t) continue;
        const i = (y * pixels.width + x) * 4;
        for (let c = 0; c < 3; c++) d[i + c] = amount < 0 ? d[i + c] * (1 + amount * t) : d[i + c] + (255 - d[i + c]) * amount * t;
      }
    }
  }
  return pixels;
}

/** The ctx.filter string for 'filter' adjustments, else null. */
export function canvasFilter(type, p) {
  if (type === 'sepia') return `sepia(${p.amount}%)`;
  if (type === 'blur') return `blur(${p.radius}px)`;
  return null;
}

const tableValues = t => Array.from(t, v => +(v / 255).toFixed(4)).join(' ');
const transfer = ({ r, g, b }, kind = 'table') => `<feComponentTransfer><feFuncR type="${kind}" tableValues="${tableValues(r)}"/><feFuncG type="${kind}" tableValues="${tableValues(g)}"/><feFuncB type="${kind}" tableValues="${tableValues(b)}"/></feComponentTransfer>`;
const LUMA = '0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 1 0';

function sepiaMatrix(a) {
  const k = 1 - a;
  return [
    0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0, 0,
    0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0, 0,
    0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k, 0, 0,
    0, 0, 0, 1, 0,
  ].map(v => +v.toFixed(4)).join(' ');
}

/**
 * An SVG <filter> doing the adjustment, for SVG export; null when SVG can't express it
 * (vignette), in which case the export bakes it into an image. Hue/Saturation, Vibrance
 * and Black & White use SVG's colour matrices, which are close to, not exactly, the canvas maths.
 */
// Settings can come from a shared project file, so everything written into the SVG is a
// finite number or an escaped string, never the raw value.
const finite = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const attr = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function svgFilter(type, p, id) {
  let body;
  switch (type) {
    case 'brightnessContrast': case 'levels': case 'invert': case 'posterize': case 'curves':
      body = transfer(buildLut(type, p)); break;
    case 'hueSaturation': {
      const l = p.lightness / 100;
      const slope = l > 0 ? 1 - l : 1 + l;
      const intercept = l > 0 ? l : 0;
      const light = `<feComponentTransfer><feFuncR type="linear" slope="${slope}" intercept="${intercept}"/><feFuncG type="linear" slope="${slope}" intercept="${intercept}"/><feFuncB type="linear" slope="${slope}" intercept="${intercept}"/></feComponentTransfer>`;
      body = `<feColorMatrix type="hueRotate" values="${finite(p.hue)}"/><feColorMatrix type="saturate" values="${finite(Math.max(0, 1 + p.saturation / 100))}"/>${light}`;
      break;
    }
    case 'vibrance': body = `<feColorMatrix type="saturate" values="${Math.max(0, 1 + (p.vibrance + p.saturation) / 200)}"/>`; break;
    case 'blackWhite': body = `<feColorMatrix type="saturate" values="${1 - p.amount / 100}"/>`; break;
    case 'threshold': {
      const steps = Uint8ClampedArray.from({ length: 256 }, (_, v) => (v >= p.level ? 255 : 0));
      body = `<feColorMatrix type="matrix" values="${LUMA}"/>${transfer({ r: steps, g: steps, b: steps }, 'discrete')}`;
      break;
    }
    case 'sepia': body = `<feColorMatrix type="matrix" values="${sepiaMatrix(p.amount / 100)}"/>`; break;
    case 'blur': body = `<feGaussianBlur stdDeviation="${finite(p.radius)}"/>`; break;
    default: return null;
  }
  return `<filter id="${attr(id)}" color-interpolation-filters="sRGB">${body}</filter>`;
}

/** Settings that leave the picture unchanged (so the compositor can skip the layer). */
export function isIdentity(type, p) {
  switch (type) {
    case 'brightnessContrast': return !p.brightness && !p.contrast;
    case 'hueSaturation': return !p.hue && !p.saturation && !p.lightness;
    case 'vibrance': return !p.vibrance && !p.saturation;
    case 'levels': return p.inBlack === 0 && p.inWhite === 255 && p.gamma === 1 && p.outBlack === 0 && p.outWhite === 255;
    case 'curves': {
      const pts = p.points || {};
      const straight = c => !c || (c.length === 2 && c[0][0] === 0 && c[0][1] === 0 && c[1][0] === 255 && c[1][1] === 255);
      return straight(pts.rgb) && straight(pts.r) && straight(pts.g) && straight(pts.b);
    }
    case 'blackWhite': case 'sepia': return !p.amount;
    case 'blur': return !p.radius;
    case 'vignette': return !p.amount;
    default: return false;
  }
}
