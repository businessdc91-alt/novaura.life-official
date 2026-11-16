// The gradient tool on a real canvas.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { TOOLS, toolContext } from '../../../src/creative/tools/index.js';
import '../../../src/creative/tools/gradient.js';

setSurfaceFactory(null);

const pt = (x, y) => ({ x, y, pressure: 1, coalesced: [] });

function setup(type) {
  const store = createStudioStore();
  const session = store.newDocument({ width: 256, height: 10, background: 'transparent' });
  store.update({ colours: { primary: '#ff0000', secondary: '#0000ff' }, gradient: { type, mode: 'toSecondary' } });
  const ctx = () => toolContext(store, { requestRender: () => {}, notify: m => { throw new Error(m); } });
  return { session, ctx, layer: session.doc.layers[0] };
}

const px = (s, x, y) => [...s.read(x, y, 1, 1).data];
const near = (a, b, tol, msg) => b.forEach((v, i) => assert.near(a[i], v, tol, `${msg} ${i}`));

test('linear gradient left→right on a 256-wide layer: pixel 0 = primary, pixel 255 = secondary', () => {
  const { session, ctx, layer } = setup('linear');
  TOOLS.gradient.down(ctx(), pt(0, 5));
  TOOLS.gradient.move(ctx(), pt(128, 5));
  TOOLS.gradient.up(ctx(), pt(255, 5));
  const s = surfaceOf(session.doc, layer);
  near(px(s, 0, 5), [255, 0, 0, 255], 2, 'left');
  near(px(s, 255, 5), [0, 0, 255, 255], 2, 'right');
  assert.equal(session.history.steps.length, 1);
  assert.equal(session.history.steps[0].label, 'Gradient');
});

test('radial gradient: the centre is primary', () => {
  const { session, ctx, layer } = setup('radial');
  TOOLS.gradient.down(ctx(), pt(128, 5));
  TOOLS.gradient.up(ctx(), pt(200, 5));
  const s = surfaceOf(session.doc, layer);
  near(px(s, 128, 5), [255, 0, 0, 255], 3, 'centre');
  near(px(s, 250, 5), [0, 0, 255, 255], 2, 'beyond the end');
});

test('a click without dragging draws nothing', () => {
  const { session, ctx } = setup('linear');
  TOOLS.gradient.down(ctx(), pt(10, 5));
  TOOLS.gradient.up(ctx(), pt(10, 5));
  assert.equal(session.history.steps.length, 0);
});
