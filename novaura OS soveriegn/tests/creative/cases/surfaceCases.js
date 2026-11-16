// The surface contract, shared by the Node test (ArraySurface) and the browser test (CanvasSurface).
// `a` supplies equal, deepEqual and ok; `createSurface` is the module's own factory.

const px = (pixels, x, y) => {
  const i = (y * pixels.width + x) * 4;
  return [...pixels.data.slice(i, i + 4)];
};

function redPatch(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 3] = 255; }
  return { width: w, height: h, data };
}

export function surfaceCases(createSurface, a) {
  return [
    ['read clips to bounds and returns transparent outside', () => {
      const s = createSurface(4, 4);
      s.write(1, 1, redPatch(2, 2));
      const r = s.read(-1, -1, 3, 3);
      a.equal(r.width, 3);
      a.equal(r.height, 3);
      a.deepEqual(px(r, 2, 2), [255, 0, 0, 255]);
      a.deepEqual(px(r, 0, 0), [0, 0, 0, 0]);
      a.deepEqual(px(r, 1, 1), [0, 0, 0, 0]);
    }],
    ['resizeCanvas keeps content shifted by the offset', () => {
      const s = createSurface(4, 4);
      s.write(1, 1, redPatch(1, 1));
      s.resizeCanvas(6, 6, 2, 1);
      a.equal(s.width, 6);
      a.equal(s.height, 6);
      const all = s.read(0, 0, 6, 6);
      a.deepEqual(px(all, 3, 2), [255, 0, 0, 255]);
      a.deepEqual(px(all, 1, 1), [0, 0, 0, 0]);
    }],
    ['clone is independent', () => {
      const s = createSurface(3, 3);
      s.write(0, 0, redPatch(1, 1));
      const c = s.clone();
      c.clear();
      a.deepEqual(px(s.read(0, 0, 1, 1), 0, 0), [255, 0, 0, 255]);
      a.deepEqual(px(c.read(0, 0, 1, 1), 0, 0), [0, 0, 0, 0]);
    }],
    ['bytes is width × height × 4', () => {
      a.equal(createSurface(7, 5).bytes, 7 * 5 * 4);
    }],
    ['createSurface rejects 0 and 16385', () => {
      for (const [w, h] of [[0, 10], [10, 0], [16385, 1], [1, 16385]]) {
        let message = null;
        try { createSurface(w, h); } catch (err) { message = `${err.name}: ${err.message}`; }
        a.equal(message, 'RangeError: Canvas sides must be 1–16384 px.', `${w}×${h}`);
      }
    }],
  ];
}
