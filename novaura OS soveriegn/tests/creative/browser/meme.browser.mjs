// The Meme tab on layers: a locked template layer, and top/bottom text as real text layers.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { beginStroke } from '../../../src/creative/stroke.js';
import { applyMemeTemplate, setMemeText, addMemeText } from '../../../src/creative/meme.js';
import { MEME_TEMPLATES } from '../../../src/components/windows/creative/memeTemplates.js';

setSurfaceFactory(null);

const MEME = { tab: 'meme' };

function setup() {
  const store = createStudioStore();
  const session = store.newDocument({ width: 540, height: 420, background: 'white' });
  return { store, session };
}

const templates = doc => doc.layers.filter(l => l.role === 'memeTemplate');

test('picking a template adds one locked bottom layer and one step', async () => {
  const { session } = setup();
  const r = await applyMemeTemplate(session, MEME_TEMPLATES[0], MEME);
  assert.equal(r.ok, true);
  const [t] = templates(session.doc);
  assert.equal(session.doc.layers[0].name, 'Background');
  assert.equal(session.doc.layers[1], t, 'just above the plain background, so it is not hidden behind it');
  assert.equal(t.locked, true);
  assert.equal(t.name, `Template: ${MEME_TEMPLATES[0].name}`);
  assert.equal(session.history.steps.length, 1);
  assert.equal(session.history.steps[0].label, 'Meme template');
  assert.equal(surfaceOf(session.doc, t).read(270, 210, 1, 1).data[3], 255, 'the template covers the canvas');
});

test('picking another replaces it', async () => {
  const { session } = setup();
  await applyMemeTemplate(session, MEME_TEMPLATES[0], MEME);
  const t = templates(session.doc)[0];
  const first = [...surfaceOf(session.doc, t).read(0, 0, 540, 420).data];
  await applyMemeTemplate(session, MEME_TEMPLATES[2], MEME);
  assert.equal(templates(session.doc).length, 1);
  assert.equal(templates(session.doc)[0].name, `Template: ${MEME_TEMPLATES[2].name}`);
  assert.ok([...surfaceOf(session.doc, templates(session.doc)[0]).read(0, 0, 540, 420).data].join() !== first.join(), 'the new template is drawn');
  assert.equal(session.history.steps.length, 2);
  session.history.undo();
  assert.equal(templates(session.doc)[0].name, `Template: ${MEME_TEMPLATES[0].name}`);
  assert.deepEqual([...surfaceOf(session.doc, templates(session.doc)[0]).read(0, 0, 540, 420).data], first);
});

test('top and bottom text create text layers with the meme style', () => {
  const { session } = setup();
  setMemeText(session, 'top', 'when the code works', MEME);
  setMemeText(session, 'bottom', 'first try', MEME);
  const top = session.doc.layers.find(l => l.role === 'memeTop');
  const bottom = session.doc.layers.find(l => l.role === 'memeBottom');
  for (const l of [top, bottom]) {
    assert.equal(l.kind, 'text');
    assert.equal(l.fontFamily, 'Impact');
    assert.equal(l.fontSize, 49); // round(540 × 0.09)
    assert.equal(l.colour, '#ffffff');
    assert.equal(l.strokeColour, '#000000');
    assert.equal(l.strokeWidth, 4); // round(49 × 0.08)
    assert.equal(l.uppercase, true);
    assert.equal(l.align, 'center');
    assert.equal(l.wrapWidth, 486);
    assert.equal(l.x, 27);
  }
  assert.equal(top.name, 'Top text');
  assert.equal(top.y, Math.round(420 * 0.04));
  assert.ok(bottom.y > 300 && bottom.y < 380, `bottom text sits at the bottom (${bottom.y})`);
});

test('typing updates the same layer', () => {
  const { session } = setup();
  setMemeText(session, 'top', 'a', MEME);
  setMemeText(session, 'top', 'ab', MEME);
  setMemeText(session, 'top', 'abc', MEME);
  assert.equal(session.doc.layers.filter(l => l.role === 'memeTop').length, 1);
  assert.equal(session.doc.layers.find(l => l.role === 'memeTop').text, 'abc');
  assert.equal(session.history.steps.length, 2, 'one step to add it, one for the typing');
});

test('the bottom text moves up as it wraps onto more lines', () => {
  const { session } = setup();
  setMemeText(session, 'bottom', 'short', MEME);
  const bottom = session.doc.layers.find(l => l.role === 'memeBottom');
  const oneLine = bottom.y;
  setMemeText(session, 'bottom', 'a much much longer caption that needs two lines at least', MEME);
  assert.ok(bottom.y < oneLine - 30, `${oneLine} → ${bottom.y}`);
});

test('Add text adds a centred meme-style text layer', () => {
  const { session } = setup();
  const r = addMemeText(session, MEME);
  assert.equal(r.ok, true);
  assert.equal(r.layer.fontFamily, 'Impact');
  assert.equal(r.layer.align, 'center');
});

test('the template layer refuses painting with the lock reason', async () => {
  const { session } = setup();
  await applyMemeTemplate(session, MEME_TEMPLATES[1], MEME);
  const t = templates(session.doc)[0];
  assert.deepEqual(beginStroke(session, { layerId: t.id }, MEME), { ok: false, reason: `"Template: ${MEME_TEMPLATES[1].name}" is locked.` });
});

test('with no plain background, the template goes to the very bottom', async () => {
  const store = createStudioStore();
  const session = store.newDocument({ width: 300, height: 200, background: 'transparent' });
  await applyMemeTemplate(session, MEME_TEMPLATES[0], MEME);
  assert.equal(session.doc.layers[0].role, 'memeTemplate');
});
