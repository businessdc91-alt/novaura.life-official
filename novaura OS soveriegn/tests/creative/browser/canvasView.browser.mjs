// The pointer controller: pointer events become tool calls, and a lost pointer still commits the stroke.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { createPointerController } from '../../../src/creative/pointerController.js';

setSurfaceFactory(null);

function setup(view = { zoom: 1, panX: 0, panY: 0 }) {
  const store = createStudioStore();
  const session = store.newDocument({ width: 60, height: 60, background: 'transparent' });
  store.update({ colours: { primary: '#000000' }, brush: { size: 6, hardness: 1, opacity: 1, pressure: false } });
  const controller = createPointerController({ store, getView: () => view, getRect: () => ({ left: 0, top: 0 }) });
  return { store, session, controller };
}

const ev = (pointerId, x, y, extra = {}) => ({ pointerId, clientX: x, clientY: y, button: 0, pointerType: 'mouse', pressure: 0.5, ...extra });

test('pointercancel mid-stroke commits one step and the next pointerdown starts a new stroke', () => {
  const { session, controller } = setup();
  controller.down(ev(1, 10, 10));
  controller.move(ev(1, 30, 30));
  controller.cancel(ev(1, 30, 30));
  assert.equal(session.history.steps.length, 1);
  assert.equal(controller.busy, false);
  controller.move(ev(1, 50, 50));
  assert.equal(session.history.steps.length, 1, 'a stray move after the cancel does nothing');
  controller.down(ev(2, 40, 10));
  controller.move(ev(2, 50, 20));
  controller.up(ev(2, 50, 20));
  assert.equal(session.history.steps.length, 2);
});

test('mouse pressure counts as full pressure; pen pressure is used', () => {
  const { store, session, controller } = setup();
  store.update({ brush: { size: 20, pressure: true } });
  controller.down(ev(1, 30, 30, { pointerType: 'mouse', pressure: 0.5 }));
  controller.up(ev(1, 30, 30, { pointerType: 'mouse', pressure: 0 }));
  const s = session.doc.buffers.get(session.doc.layers[0].bufferId);
  assert.ok(s.read(30, 21, 1, 1).data[3] > 0, 'a mouse dab is the full 20 px');
});

test('strokes land under the pointer when zoomed and panned', () => {
  const { session, controller } = setup({ zoom: 2, panX: 20, panY: 10 });
  controller.down(ev(1, 20 + 2 * 25, 10 + 2 * 35));
  controller.up(ev(1, 20 + 2 * 25, 10 + 2 * 35));
  const s = session.doc.buffers.get(session.doc.layers[0].bufferId);
  assert.equal(s.read(25, 35, 1, 1).data[3], 255);
  assert.equal(s.read(5, 5, 1, 1).data[3], 0);
});

test('only the primary button starts a tool', () => {
  const { session, controller } = setup();
  controller.down(ev(1, 10, 10, { button: 2 }));
  controller.up(ev(1, 10, 10, { button: 2 }));
  assert.equal(session.history.steps.length, 0);
});
