// transformHandles.js — The handles on a selected shape: eight to resize, one to rotate,
// or one at each end of a line. Pure maths: given the shape as it was when the drag
// began and where the pointer started and is now, return the fields to set.

const rad = deg => (deg * Math.PI) / 180;
const centreOf = l => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 });

function rotateAbout(p, c, deg) {
  const a = rad(deg);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

const BOX = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };

/** [{ id, x, y }] in document coordinates. The rotate handle sits rotateOffset above the top edge. */
export function handlesFor(layer, { rotateOffset = 24 } = {}) {
  if (layer.shape === 'line') return [{ id: 'p1', x: layer.x1, y: layer.y1 }, { id: 'p2', x: layer.x2, y: layer.y2 }];
  const c = centreOf(layer);
  const r = layer.rotation || 0;
  const handles = Object.entries(BOX).map(([id, [fx, fy]]) => ({ id, ...rotateAbout({ x: layer.x + fx * layer.w, y: layer.y + fy * layer.h }, c, r) }));
  handles.push({ id: 'rotate', ...rotateAbout({ x: c.x, y: layer.y - rotateOffset }, c, r) });
  return handles;
}

/** The handle within `radius` of (x, y), closest first, or null. */
export function hitHandle(layer, x, y, radius, options) {
  let best = null;
  let bestDistance = radius;
  for (const h of handlesFor(layer, options)) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d <= bestDistance) { best = h.id; bestDistance = d; }
  }
  return best;
}

/** Whether (x, y) is inside the shape's (rotated) box. */
export function insideShape(layer, x, y, tolerance = 0) {
  if (layer.shape === 'line') {
    const { x1, y1, x2, y2 } = layer;
    const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / len2));
    return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1))) <= Math.max(tolerance, (layer.strokeWidth || 0) / 2);
  }
  const local = rotateAbout({ x, y }, centreOf(layer), -(layer.rotation || 0));
  return local.x >= layer.x - tolerance && local.x <= layer.x + layer.w + tolerance
    && local.y >= layer.y - tolerance && local.y <= layer.y + layer.h + tolerance;
}

/**
 * Fields to set when handle `id` is dragged from `start` to `now` (document coordinates).
 * `layer` is the shape as it was when the drag began. Shift keeps the aspect ratio on a
 * corner, or snaps rotation to 15°.
 */
export function dragHandle(layer, id, start, now, { shift = false } = {}) {
  const dx = now.x - start.x;
  const dy = now.y - start.y;
  if (id === 'p1') return { x1: layer.x1 + dx, y1: layer.y1 + dy };
  if (id === 'p2') return { x2: layer.x2 + dx, y2: layer.y2 + dy };

  const c = centreOf(layer);
  const r = layer.rotation || 0;
  if (id === 'rotate') {
    const a0 = Math.atan2(start.y - c.y, start.x - c.x);
    const a1 = Math.atan2(now.y - c.y, now.x - c.x);
    let deg = r + ((a1 - a0) * 180) / Math.PI;
    deg = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (shift) deg = Math.round(deg / 15) * 15;
    return { rotation: deg };
  }

  // The pointer's movement in the shape's own (unrotated) frame.
  const local = rotateAbout({ x: dx, y: dy }, { x: 0, y: 0 }, -r);
  let x0 = layer.x;
  let y0 = layer.y;
  let x1 = layer.x + layer.w;
  let y1 = layer.y + layer.h;
  const movesW = id.includes('w');
  const movesE = id.includes('e');
  const movesN = id.includes('n');
  const movesS = id.includes('s');
  if (movesW) x0 += local.x;
  if (movesE) x1 += local.x;
  if (movesN) y0 += local.y;
  if (movesS) y1 += local.y;

  if (shift && id.length === 2 && layer.w && layer.h) {
    const fx = (x1 - x0) / layer.w;
    const fy = (y1 - y0) / layer.h;
    const f = Math.abs(fx) >= Math.abs(fy) ? fx : fy;
    const width = Math.sign(x1 - x0 || 1) * Math.abs(layer.w * f);
    const height = Math.sign(y1 - y0 || 1) * Math.abs(layer.h * f);
    if (movesE) x1 = x0 + width; else x0 = x1 - width;
    if (movesS) y1 = y0 + height; else y0 = y1 - height;
  }

  const nx = Math.min(x0, x1);
  const ny = Math.min(y0, y1);
  const nw = Math.max(1, Math.abs(x1 - x0));
  const nh = Math.max(1, Math.abs(y1 - y0));

  // Keep the opposite corner or edge where it was on screen, even when rotated.
  const [fx, fy] = BOX[id];
  const anchor = { x: layer.x + (1 - fx) * layer.w, y: layer.y + (1 - fy) * layer.h };
  const before = rotateAbout(anchor, c, r);
  const after = rotateAbout(anchor, { x: nx + nw / 2, y: ny + nh / 2 }, r);
  return { x: nx + (before.x - after.x), y: ny + (before.y - after.y), w: nw, h: nh };
}
