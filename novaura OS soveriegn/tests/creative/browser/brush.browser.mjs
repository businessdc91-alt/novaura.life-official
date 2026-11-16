// Brush, pencil and eraser on a real canvas.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { TOOLS, toolContext } from '../../../src/creative/tools/index.js';

setSurfaceFactory(null);

function setup(background, settings = {}) {
  const store = createStudioStore();
  const session = store.newDocument({ width: 40, height: 40, background });
  store.update({ colours: { primary: '#000000' }, ...settings });
  const ctx = () => toolContext(store, { requestRender: () => {}, notify: m => { throw new Error(`unexpected notice: ${m}`); } });
  return { store, session, ctx, layer: session.doc.layers[0] };
}

const pt = (x, y) => ({ x, y, pressure: 1, coalesced: [] });

function drag(tool, ctx, from, to, steps = 10) {
  tool.down(ctx(), pt(from[0], from[1]));
  for (let i = 1; i <= steps; i++) tool.move(ctx(), pt(from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps));
  tool.up(ctx(), pt(to[0], to[1]));
}

const alphas = surface => {
  const { data } = surface.read(0, 0, surface.width, surface.height);
  const out = [];
  for (let i = 3; i < data.length; i += 4) out.push(data[i]);
  return out;
};

test('a brush stroke at opacity 0.5 never builds past 0.5 alpha where dabs overlap', () => {
  const { session, ctx, layer } = setup('transparent', { brush: { size: 10, hardness: 1, opacity: 0.5, pressure: false } });
  drag(TOOLS.brush, ctx, [8, 20], [32, 20], 24);
  const a = alphas(surfaceOf(session.doc, layer));
  const max = Math.max(...a);
  assert.ok(max >= 120, `the stroke painted (max alpha ${max})`);
  assert.ok(max <= 129, `no build-up past half (max alpha ${max})`);
});

test('the eraser makes pixels transparent', () => {
  const { session, ctx, layer } = setup('white', { brush: { size: 8, hardness: 1, opacity: 1, pressure: false } });
  drag(TOOLS.eraser, ctx, [10, 10], [30, 10]);
  const s = surfaceOf(session.doc, layer);
  assert.equal(s.read(20, 10, 1, 1).data[3], 0);
  assert.equal(s.read(20, 30, 1, 1).data[3], 255);
});

test('the pencil draws with no anti-aliasing', () => {
  const { session, ctx, layer } = setup('transparent', { brush: { size: 5, hardness: 1, opacity: 1, pressure: false } });
  drag(TOOLS.pencil, ctx, [5, 5], [35, 28], 30);
  const a = alphas(surfaceOf(session.doc, layer));
  assert.ok(a.some(v => v === 255), 'it drew');
  assert.ok(a.every(v => v === 0 || v === 255), `only 0 or 255 alpha (saw ${[...new Set(a)].slice(0, 6)})`);
});

test('one stroke = one history step labelled "Paint · Brush stroke"', () => {
  const { session, ctx, layer } = setup('transparent', { brush: { size: 6, hardness: 0.8, opacity: 1, pressure: false } });
  drag(TOOLS.brush, ctx, [5, 5], [30, 30]);
  assert.equal(session.history.steps.length, 1);
  assert.equal(session.history.steps[0].label, 'Brush stroke');
  assert.equal(session.history.steps[0].tab, 'paint');
  const painted = alphas(surfaceOf(session.doc, layer)).filter(v => v > 0).length;
  assert.ok(painted > 0);
  session.history.undo();
  assert.equal(alphas(surfaceOf(session.doc, layer)).filter(v => v > 0).length, 0);
});

test('cancel (the pointer was lost) still commits the stroke', () => {
  const { session, ctx } = setup('transparent', { brush: { size: 6, hardness: 1, opacity: 1, pressure: false } });
  TOOLS.brush.down(ctx(), pt(5, 5));
  TOOLS.brush.move(ctx(), pt(20, 20));
  TOOLS.brush.cancel(ctx());
  assert.equal(session.history.steps.length, 1);
});

test('the fill bucket fills the clicked area as one step', () => {
  const { session, ctx, layer } = setup('white');
  TOOLS.fill.down(ctx(), pt(3, 3));
  TOOLS.fill.up(ctx(), pt(3, 3));
  assert.deepEqual([...surfaceOf(session.doc, layer).read(39, 39, 1, 1).data], [0, 0, 0, 255]);
  assert.equal(session.history.steps.length, 1);
  assert.equal(session.history.steps[0].label, 'Fill');
});

test('the eyedropper picks the composite colour', () => {
  const { store, ctx } = setup('#336699');
  TOOLS.eyedropper.down(ctx(), pt(4, 4));
  assert.equal(store.getState().colours.primary, '#336699');
});
