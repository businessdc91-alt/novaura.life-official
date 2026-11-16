// The studio store: open documents, the active one, the tab and tool, and shared settings.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { createDocument } from '../../src/creative/document.js';
import { setLayerProps } from '../../src/creative/edits.js';
import { createStudioStore } from '../../src/creative/studioStore.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

test('defaults', () => {
  const st = createStudioStore().getState();
  assert.equal(st.tab, 'paint');
  assert.equal(st.tool, 'brush');
  assert.deepEqual(st.colours, { primary: '#06b6d4', secondary: '#ffffff' });
  assert.deepEqual(st.brush, { size: 12, hardness: 0.8, opacity: 1, pressure: true });
  assert.deepEqual(st.fill, { tolerance: 32, contiguous: true, sampleAll: false });
  assert.deepEqual(st.gradient, { type: 'linear', mode: 'toSecondary' });
  assert.deepEqual(st.eyedropper, { sample: 'composite' });
  assert.equal(st.maskView, null);
  assert.equal(st.notice, null);
  assert.deepEqual(st.sessions, []);
});

test('newDocument makes it active', () => {
  const store = createStudioStore();
  const a = store.newDocument({ name: 'A', width: 8, height: 8 });
  const b = store.newDocument({ name: 'B', width: 8, height: 8 });
  assert.equal(store.getState().sessions.length, 2);
  assert.equal(store.getState().activeId, b.id);
  assert.equal(store.active(), b);
  store.setActive(a.id);
  assert.equal(store.active(), a);
  assert.equal(a.doc.name, 'A');
  assert.ok(a.history && a.compositor);
});

test('closeDocument picks a neighbour as active', () => {
  const store = createStudioStore();
  const a = store.newDocument({ width: 4, height: 4 });
  const b = store.newDocument({ width: 4, height: 4 });
  const c = store.newDocument({ width: 4, height: 4 });
  store.setActive(b.id);
  store.closeDocument(b.id);
  assert.equal(store.getState().activeId, c.id);
  store.closeDocument(c.id);
  assert.equal(store.getState().activeId, a.id);
  store.closeDocument(a.id);
  assert.equal(store.getState().activeId, null);
  assert.equal(store.active(), null);
});

test('a history push in a session bumps the store version', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 4, height: 4 });
  let heard = 0;
  store.subscribe(() => { heard++; });
  const v = store.getState().version;
  setLayerProps(s, s.doc.layers[0].id, { opacity: 0.5 }, { tab: 'paint' });
  assert.ok(store.getState().version > v);
  assert.ok(heard >= 1);
  s.history.undo();
  assert.ok(heard >= 2);
});

test('dirty follows doc.version vs savedVersion', () => {
  const store = createStudioStore();
  const s = store.newDocument({ width: 4, height: 4 });
  assert.equal(s.dirty, false);
  setLayerProps(s, s.doc.layers[0].id, { opacity: 0.5 }, { tab: 'paint' });
  assert.equal(s.dirty, true);
  s.savedVersion = s.doc.version;
  assert.equal(s.dirty, false);

  const opened = store.openDocument(createDocument({ width: 4, height: 4 }), { savedPath: '/Creative Studio/x.novaart' });
  assert.equal(opened.dirty, false);
  assert.equal(opened.savedPath, '/Creative Studio/x.novaart');
  assert.equal(store.getState().activeId, opened.id);
});

test('update merges nested settings without dropping keys', () => {
  const store = createStudioStore();
  store.update({ brush: { size: 40 }, tool: 'eraser' });
  const st = store.getState();
  assert.deepEqual(st.brush, { size: 40, hardness: 0.8, opacity: 1, pressure: true });
  assert.equal(st.tool, 'eraser');
  store.setTab('photo');
  store.setTool('fill');
  assert.equal(store.getState().tab, 'photo');
  assert.equal(store.getState().tool, 'fill');
});

test('notify sets a notice that changes even when the text repeats', () => {
  const store = createStudioStore();
  store.notify('"Sky" is locked.');
  const first = store.getState().notice;
  assert.equal(first.text, '"Sky" is locked.');
  store.notify('"Sky" is locked.');
  assert.notEqual(store.getState().notice.id, first.id);
});

test('history budget applies to every session', () => {
  const store = createStudioStore({ historyBytes: 1000 });
  const s = store.newDocument({ width: 4, height: 4 });
  for (let i = 0; i < 30; i++) setLayerProps(s, s.doc.layers[0].id, { opacity: i % 2 ? 0.5 : 0.25 }, { tab: 'paint' });
  assert.ok(s.history.totalBytes() <= 1000);
  store.setHistoryBudget(128);
  assert.ok(s.history.totalBytes() <= 128);
});
