// Text layers on a real canvas, and the text tool.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { addLayer, setLayerProps } from '../../../src/creative/edits.js';
import { composeLayers } from '../../../src/creative/compositor.js';
import { TEXT_DEFAULTS, textBox } from '../../../src/creative/text.js';
import { TOOLS, toolContext, toolForKey } from '../../../src/creative/tools/index.js';
import '../../../src/creative/tools/text.js';

setSurfaceFactory(null);

const PAINT = { tab: 'paint' };
const pt = (x, y) => ({ x, y, pressure: 1, coalesced: [] });

function setup(w = 240, h = 100) {
  const store = createStudioStore();
  const session = store.newDocument({ width: w, height: h, background: 'transparent' });
  const ctx = () => toolContext(store, { requestRender: () => {}, notify: m => { throw new Error(m); } });
  return { store, session, ctx };
}

function opaqueBounds(surface) {
  const { width: W, height: H, data } = surface.read(0, 0, surface.width, surface.height);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

test('T selects the text tool', () => {
  assert.equal(toolForKey({ key: 't', shiftKey: false }), 'text');
});

test('text renders inside its box', () => {
  const { session } = setup();
  const { layer } = addLayer(session, 'text', { ...TEXT_DEFAULTS, text: 'Hi there', x: 10, y: 10, fontSize: 40, colour: '#ff0000' }, PAINT);
  const box = textBox(layer);
  const b = opaqueBounds(composeLayers(session.doc, [layer]));
  assert.ok(b, 'something was drawn');
  assert.ok(b.x0 >= 9 && b.y0 >= 9 && b.x1 <= box.x + box.w + 2 && b.y1 <= box.y + box.h + 2, `${JSON.stringify(b)} inside ${JSON.stringify(box)}`);
});

test('outline draws behind fill', () => {
  const { session } = setup();
  const { layer } = addLayer(session, 'text', { ...TEXT_DEFAULTS, text: 'IIII', x: 20, y: 10, fontSize: 60, fontWeight: 900, colour: '#ffffff', strokeColour: '#000000', strokeWidth: 3 }, PAINT);
  const surface = composeLayers(session.doc, [layer]);
  const b = opaqueBounds(surface);
  const midY = Math.round((b.y0 + b.y1) / 2);
  const row = surface.read(0, midY, surface.width, 1).data;
  let first = -1;
  for (let x = 0; x < surface.width; x++) if (row[x * 4 + 3] > 200) { first = x; break; }
  assert.ok(row[first * 4] < 60, `the outer edge is the black outline (${[...row.slice(first * 4, first * 4 + 4)]})`);
  const inner = [...row.slice((first + 5) * 4, (first + 5) * 4 + 4)];
  assert.ok(inner[0] > 200, `inside the letter is the white fill (${inner})`);
});

test('typing three characters within 1 s is one step', () => {
  const { session } = setup();
  const { layer } = addLayer(session, 'text', { ...TEXT_DEFAULTS, text: '' }, PAINT);
  for (const text of ['T', 'Te', 'Tex']) setLayerProps(session, layer.id, { text }, { tab: 'paint', label: 'Edit text', mergeKey: `text:${layer.id}`, mergeWindowMs: 1000 });
  assert.equal(session.history.steps.length, 2);
  assert.equal(layer.text, 'Tex');
  session.history.undo();
  assert.equal(layer.text, '');
});

test('a click with the text tool adds a text layer there in the main colour', () => {
  const { store, session, ctx } = setup();
  store.update({ colours: { primary: '#123456' } });
  TOOLS.text.down(ctx(), pt(30, 40));
  TOOLS.text.up(ctx(), pt(30, 40));
  const layer = session.doc.layers.at(-1);
  assert.equal(layer.kind, 'text');
  assert.deepEqual([layer.x, layer.y, layer.text, layer.colour, layer.fontSize], [30, 40, 'Text', '#123456', 64]);
  assert.equal(session.history.steps.length, 1);
  assert.equal(store.getState().textFocus, layer.id, 'the text box gets focus');
});

test('dragging the selected text layer moves it', () => {
  const { session, ctx } = setup(400, 200);
  TOOLS.text.down(ctx(), pt(30, 40));
  TOOLS.text.up(ctx(), pt(30, 40));
  const layer = session.doc.layers.at(-1);
  TOOLS.text.down(ctx(), pt(40, 60));
  TOOLS.text.move(ctx(), pt(50, 65));
  TOOLS.text.up(ctx(), pt(50, 65));
  assert.deepEqual([layer.x, layer.y], [40, 45]);
  assert.equal(session.history.steps.length, 2);
});
