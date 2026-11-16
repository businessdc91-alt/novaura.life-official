// colour.js — Small colour conversions shared by the tools.

/** '#rrggbb' (or '#rgb') → [r, g, b, 255]. */
export function hexToRgba(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n) || h.length < 6) return [0, 0, 0, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** [r, g, b, ...] → '#rrggbb'. */
export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** A CSS rgba() string for a hex colour at the given alpha (0–1). */
export function rgbaCss(hex, alpha = 1) {
  const [r, g, b] = hexToRgba(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
