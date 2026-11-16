// The shape tool and shape layers on a real canvas.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { addLayer } from '../../../src/creative/edits.js';
import { composeLayers } from '../../../src/creative/compositor.js';
import { TOOLS, toolContext } from '../../../src/creative/tools/index.js';
import '../../../src/creative/tools/shape.js';

setSurfaceFactory(null);

const pt = (x, y, extra = {}) => ({ x, y, pressure: 1, coalesced: [], ...extra });

function setup() {
  const store = createStudioStore();
  const session = store.newDocument({ width: 80, height: 60, background: 'white' });
  store.update({ colours: { primary: '#0000ff' } });
  const ctx = () => toolContext(store, { requestRender: () => {}, notify: m => { throw new Error(`unexpected notice: ${m}`); }, view: { zoom: 1, panX: 0, panY: 0 } });
  return { store, session, ctx };
}

test('U selects the shape tool once it is registered', async () => {
  const { toolForKey } = await import('../../../src/creative/tools/index.js');
  assert.equal(toolForKey({ key: 'u', shiftKey: false }), 'shape');
});

test('drawing with the shape tool creates one shape layer and one step', () => {
  const { session, store, ctx } = setup();
  store.update({ shape: { kind: 'ellipse' } });
  TOOLS.shape.down(ctx(), pt(10, 10));
  TOOLS.shape.move(ctx(), pt(30, 20));
  TOOLS.shape.move(ctx(), pt(50, 40));
  TOOLS.shape.up(ctx(), pt(50, 40));
  assert.equal(session.history.steps.length, 1);
  const layer = session.doc.layers.at(-1);
  assert.equal(layer.kind, 'shape');
  assert.equal(layer.shape, 'ellipse');
  assert.deepEqual([layer.x, layer.y, layer.w, layer.h], [10, 10, 40, 30]);
  assert.equal(layer.fill, '#0000ff');
  assert.equal(session.doc.activeLayerId, layer.id);
});

test('a click without dragging draws nothing', () => {
  const { session, ctx } = setup();
  TOOLS.shape.down(ctx(), pt(10, 10));
  TOOLS.shape.up(ctx(), pt(11, 10));
  assert.equal(session.history.steps.length, 0);
});

test('Shift while drawing makes a square', () => {
  const { session, ctx } = setup();
  TOOLS.shape.down(ctx(), pt(10, 10));
  TOOLS.shape.up(ctx(), pt(50, 20, { shift: true }));
  const layer = session.doc.layers.at(-1);
  assert.equal(layer.w, layer.h);
});

test('dragging a handle of the selected shape resizes it as one step', () => {
  const { session, ctx } = setup();
  TOOLS.shape.down(ctx(), pt(10, 10));
  TOOLS.shape.up(ctx(), pt(40, 30));
  const layer = session.doc.layers.at(-1);
  TOOLS.shape.down(ctx(), pt(40, 30));
  TOOLS.shape.move(ctx(), pt(45, 35));
  TOOLS.shape.move(ctx(), pt(50, 40));
  TOOLS.shape.up(ctx(), pt(50, 40));
  assert.deepEqual([layer.w, layer.h], [40, 30]);
  assert.equal(session.history.steps.length, 2);
  session.history.undo();
  assert.deepEqual([layer.w, layer.h], [30, 20]);
});

test('dragging inside the selected shape moves it', () => {
  const { session, ctx } = setup();
  TOOLS.shape.down(ctx(), pt(10, 10));
  TOOLS.shape.up(ctx(), pt(40, 30));
  const layer = session.doc.layers.at(-1);
  TOOLS.shape.down(ctx(), pt(20, 20));
  TOOLS.shape.move(ctx(), pt(25, 22));
  TOOLS.shape.up(ctx(), pt(25, 22));
  assert.deepEqual([layer.x, layer.y], [15, 12]);
});

test('a shape layer at 50% opacity fades its outline too', () => {
  const { session } = setup();
  const { layer } = addLayer(session, 'shape', {
    shape: 'rect', x: 10, y: 10, w: 40, h: 30, rotation: 0, radius: 0, sides: 5, innerRatio: 0.5,
    fill: null, stroke: '#000000', strokeWidth: 6, opacity: 0.5,
  }, { tab: 'paint' });
  const alone = composeLayers(session.doc, [layer]);
  assert.near(alone.read(10, 25, 1, 1).data[3], 128, 2, 'outline alpha');
  assert.equal(alone.read(30, 25, 1, 1).data[3], 0, 'no fill inside');
});
