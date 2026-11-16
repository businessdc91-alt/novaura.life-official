// pixelRecorder.js — Record a pixel edit as the tiles it changed, before and after.
//
// Call touch(x, y, w, h) before changing that area of the surface; the first touch
// of each tile saves its original pixels. finish() reads the edited pixels, drops
// tiles that ended up unchanged, and returns a patch the history can undo and redo.
// A brush stroke across a 4000×3000 layer stores a few tiles, not 48 MB.

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Start recording edits to `surface`, in tiles of `tileSize` px aligned to (0, 0). */
export function beginPixelEdit(surface, tileSize = 256) {
  const saved = new Map(); // "tx,ty" → { x, y, w, h, before }

  function touch(x, y, w, h) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(surface.width, Math.ceil(x + w));
    const y1 = Math.min(surface.height, Math.ceil(y + h));
    if (x1 <= x0 || y1 <= y0) return;
    for (let ty = Math.floor(y0 / tileSize); ty * tileSize < y1; ty++) {
      for (let tx = Math.floor(x0 / tileSize); tx * tileSize < x1; tx++) {
        const key = `${tx},${ty}`;
        if (saved.has(key)) continue;
        const tx0 = tx * tileSize;
        const ty0 = ty * tileSize;
        const tw = Math.min(tileSize, surface.width - tx0);
        const th = Math.min(tileSize, surface.height - ty0);
        saved.set(key, { x: tx0, y: ty0, w: tw, h: th, before: surface.read(tx0, ty0, tw, th).data.slice() });
      }
    }
  }

  function finish() {
    const tiles = [];
    for (const t of saved.values()) {
      const after = surface.read(t.x, t.y, t.w, t.h).data.slice();
      if (!sameBytes(t.before, after)) tiles.push({ ...t, after });
    }
    saved.clear();
    if (!tiles.length) return null;
    const x0 = Math.min(...tiles.map(t => t.x));
    const y0 = Math.min(...tiles.map(t => t.y));
    const x1 = Math.max(...tiles.map(t => t.x + t.w));
    const y1 = Math.max(...tiles.map(t => t.y + t.h));
    const bytes = tiles.reduce((sum, t) => sum + t.before.byteLength + t.after.byteLength, 0);
    return { tiles, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, bytes };
  }

  return { touch, finish };
}

/** Put a patch's 'before' or 'after' pixels back on the surface. */
export function applyPatch(surface, patch, side) {
  for (const t of patch.tiles) {
    surface.write(t.x, t.y, { width: t.w, height: t.h, data: side === 'before' ? t.before : t.after });
  }
}
