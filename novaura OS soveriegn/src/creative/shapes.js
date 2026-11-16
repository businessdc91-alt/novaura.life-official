// shapes.js — Shape layers: their geometry, drawn on the canvas and written as SVG.
//
// A shape layer is one shape stored as numbers:
//   { shape: 'rect' | 'ellipse' | 'line' | 'polygon' | 'star', x, y, w, h, rotation (degrees),
//     radius, sides, innerRatio, x1, y1, x2, y2, fill, stroke, strokeWidth }
// Lines use x1..y2; the others a box rotated about its centre. The canvas and the SVG
// export both take their geometry from shapePathData, so they always match.

import { registerLayerRenderer } from './compositor.js';

export const SHAPE_KINDS = ['rect', 'ellipse', 'line', 'polygon', 'star'];

const fmt = n => String(Math.round(n * 1000) / 1000 + 0);
const rad = deg => (deg * Math.PI) / 180;
const centreOf = l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });

/** A new shape's fields: filled with the main colour, no outline. A line is an outline only. */
export function defaultShape(kind, rect, colours) {
  if (kind === 'line') {
    return { shape: 'line', x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: rect.y2, rotation: 0, fill: null, stroke: colours.primary, strokeWidth: 4 };
  }
  return {
    shape: kind, x: rect.x, y: rect.y, w: rect.w, h: rect.h, rotation: 0,
    radius: 0, sides: 5, innerRatio: 0.5, fill: colours.primary, stroke: null, strokeWidth: 0,
  };
}

function ringPoints(l, count, radiusAt) {
  const c = centreOf(l);
  return Array.from({ length: count }, (_, i) => {
    const a = rad(-90 + (i * 360) / count);
    const k = radiusAt(i);
    return { x: c.x + (l.w / 2) * k * Math.cos(a), y: c.y + (l.h / 2) * k * Math.sin(a) };
  });
}

const polyline = pts => `${pts.map((p, i) => `${i ? 'L' : 'M'} ${fmt(p.x)} ${fmt(p.y)}`).join(' ')} Z`;

/** SVG path data for the shape, unrotated, in document coordinates. */
export function shapePathData(l) {
  if (l.shape === 'line') return `M ${fmt(l.x1)} ${fmt(l.y1)} L ${fmt(l.x2)} ${fmt(l.y2)}`;
  if (l.shape === 'ellipse') {
    const rx = l.w / 2;
    const ry = l.h / 2;
    const cy = l.y + ry;
    return `M ${fmt(l.x)} ${fmt(cy)} A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(l.x + l.w)} ${fmt(cy)} A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(l.x)} ${fmt(cy)} Z`;
  }
  if (l.shape === 'polygon') return polyline(ringPoints(l, Math.max(3, l.sides | 0), () => 1));
  if (l.shape === 'star') {
    const points = Math.max(3, l.sides | 0);
    return polyline(ringPoints(l, points * 2, i => (i % 2 ? l.innerRatio : 1)));
  }
  const { x, y, w, h } = l;
  const r = Math.max(0, Math.min(l.radius || 0, w / 2, h / 2));
  if (!r) return `M ${fmt(x)} ${fmt(y)} H ${fmt(x + w)} V ${fmt(y + h)} H ${fmt(x)} Z`;
  const arc = (ex, ey) => `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(ex)} ${fmt(ey)}`;
  return [
    `M ${fmt(x + r)} ${fmt(y)}`, `H ${fmt(x + w - r)}`, arc(x + w, y + r),
    `V ${fmt(y + h - r)}`, arc(x + w - r, y + h),
    `H ${fmt(x + r)}`, arc(x, y + h - r),
    `V ${fmt(y + r)}`, arc(x + r, y), 'Z',
  ].join(' ');
}

const outline = l => (l.stroke && l.strokeWidth > 0 ? l.strokeWidth / 2 : 0);

/** The axis-aligned box the shape covers, rotation and outline included. */
export function shapeBounds(l) {
  const pad = outline(l);
  let xs;
  let ys;
  if (l.shape === 'line') {
    xs = [l.x1, l.x2];
    ys = [l.y1, l.y2];
  } else {
    const c = centreOf(l);
    const a = rad(l.rotation || 0);
    const corners = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([px, py]) => ({
      x: c.x + (px - c.x) * Math.cos(a) - (py - c.y) * Math.sin(a),
      y: c.y + (px - c.x) * Math.sin(a) + (py - c.y) * Math.cos(a),
    }));
    xs = corners.map(p => p.x);
    ys = corners.map(p => p.y);
  }
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 };
}

const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function paintAttrs(l) {
  const parts = [`fill="${escapeAttr(l.shape === 'line' ? 'none' : l.fill || 'none')}"`, `stroke="${escapeAttr(l.stroke || 'none')}"`];
  if (l.stroke && l.strokeWidth > 0) parts.push(`stroke-width="${fmt(l.strokeWidth)}"`, 'stroke-linejoin="round"', 'stroke-linecap="round"');
  return parts.join(' ');
}

/** The shape as one SVG element. */
export function shapeSvg(l) {
  if (l.shape === 'line') return `<line x1="${fmt(l.x1)}" y1="${fmt(l.y1)}" x2="${fmt(l.x2)}" y2="${fmt(l.y2)}" ${paintAttrs(l)} />`;
  const c = centreOf(l);
  const transform = l.rotation ? ` transform="rotate(${fmt(l.rotation)} ${fmt(c.x)} ${fmt(c.y)})"` : '';
  if (l.shape === 'rect') {
    const r = Math.max(0, Math.min(l.radius || 0, l.w / 2, l.h / 2));
    return `<rect x="${fmt(l.x)}" y="${fmt(l.y)}" width="${fmt(l.w)}" height="${fmt(l.h)}"${r ? ` rx="${fmt(r)}"` : ''} ${paintAttrs(l)}${transform} />`;
  }
  if (l.shape === 'ellipse') {
    return `<ellipse cx="${fmt(c.x)}" cy="${fmt(c.y)}" rx="${fmt(l.w / 2)}" ry="${fmt(l.h / 2)}" ${paintAttrs(l)}${transform} />`;
  }
  return `<path d="${shapePathData(l)}" ${paintAttrs(l)}${transform} />`;
}

/** Draw the shape on a canvas context that draws in document coordinates. */
export function renderShape(ctx, l) {
  ctx.save();
  if (l.shape !== 'line' && l.rotation) {
    const c = centreOf(l);
    ctx.translate(c.x, c.y);
    ctx.rotate(rad(l.rotation));
    ctx.translate(-c.x, -c.y);
  }
  const path = new Path2D(shapePathData(l));
  if (l.shape !== 'line' && l.fill) {
    ctx.fillStyle = l.fill;
    ctx.fill(path);
  }
  if (l.stroke && l.strokeWidth > 0) {
    ctx.strokeStyle = l.stroke;
    ctx.lineWidth = l.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(path);
  }
  ctx.restore();
}

registerLayerRenderer('shape', (ctx, doc, layer) => renderShape(ctx, layer));
