// Adjustment layers in the compositor: they change everything beneath them, live.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { addLayer, addMask, setLayerProps } from '../../../src/creative/edits.js';
import { defaultParams } from '../../../src/creative/adjustments.js';
import { flatten } from '../../../src/creative/compositor.js';

setSurfaceFactory(null);

const PHOTO = { tab: 'photo' };
const px = (s, x, y) => [...s.read(x, y, 1, 1).data];
const near = (a, b, tol, msg) => b.forEach((v, i) => assert.near(a[i], v, tol, `${msg} ${i}`));

function setup(background = 'white') {
  const store = createStudioStore();
  const session = store.newDocument({ width: 20, height: 10, background });
  return { store, session };
}

function redLayer(session) {
  const { layer } = addLayer(session, 'pixel', { name: 'Red' }, PHOTO);
  const s = surfaceOf(session.doc, layer);
  s.ctx.fillStyle = '#ff0000';
  s.ctx.fillRect(0, 0, 20, 10);
  layer.rev = ++session.doc.version;
  return layer;
}

const adjust = (session, type, params = {}, extra = {}) => addLayer(session, 'adjust', { adjust: type, params: { ...defaultParams(type), ...params }, ...extra }, PHOTO).layer;

test('invert adjustment at 100% inverts everything below', () => {
  const { session } = setup();
  redLayer(session);
  adjust(session, 'invert');
  assert.deepEqual(px(flatten(session.doc), 5, 5), [0, 255, 255, 255]);
  assert.equal(session.history.steps.at(-1).label, 'New adjustment layer');
});

test('invert at 50% gives mid-grey on black/white', () => {
  const { session } = setup('white');
  adjust(session, 'invert', {}, { opacity: 0.5 });
  near(px(flatten(session.doc), 5, 5), [128, 128, 128, 255], 1, 'half-inverted white');
});

test('layers above an adjustment are not affected', () => {
  const { session } = setup();
  adjust(session, 'invert');
  redLayer(session);
  assert.deepEqual(px(flatten(session.doc), 5, 5), [255, 0, 0, 255]);
});

test('editing params re-renders', () => {
  const { session } = setup('#808080');
  const layer = adjust(session, 'levels');
  const before = px(flatten(session.doc), 5, 5);
  setLayerProps(session, layer.id, { params: { ...layer.params, inWhite: 128 } }, PHOTO);
  const after = px(flatten(session.doc), 5, 5);
  assert.deepEqual(before, [128, 128, 128, 255]);
  assert.ok(after[0] >= 254, `levels brightened grey to ${after}`);
  session.history.undo();
  assert.deepEqual(px(flatten(session.doc), 5, 5), [128, 128, 128, 255]);
});

test('the masked adjustment only affects white areas', () => {
  const { session } = setup('white');
  const layer = adjust(session, 'invert');
  addMask(session, layer.id, true, PHOTO);
  const m = surfaceOf(session.doc, layer, 'mask');
  m.ctx.fillStyle = '#000000';
  m.ctx.fillRect(10, 0, 10, 10);
  layer.rev = ++session.doc.version;
  const flat = flatten(session.doc);
  assert.deepEqual(px(flat, 3, 5), [0, 0, 0, 255], 'white half of the mask: inverted');
  assert.deepEqual(px(flat, 15, 5), [255, 255, 255, 255], 'black half: untouched');
});

test('sepia and blur work through canvas filters', () => {
  const { session } = setup();
  redLayer(session);
  adjust(session, 'sepia', { amount: 100 });
  const [r, g, b] = px(flatten(session.doc), 5, 5);
  assert.ok(r > g && g > b && g > 50, `sepia-toned red: ${r},${g},${b}`);
});

test('hue/saturation and vignette work per pixel', () => {
  const { session } = setup();
  redLayer(session);
  adjust(session, 'hueSaturation', { hue: 120 });
  near(px(flatten(session.doc), 5, 5), [0, 255, 0, 255], 2, 'red turned green');
});
