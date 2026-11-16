// Crash recovery: unsaved documents are copied aside, cleared when saved or closed, and restorable.
import { test, assert } from './harness.js';
import { setSurfaceFactory } from '../../../src/creative/surface.js';
import { surfaceOf } from '../../../src/creative/document.js';
import { createStudioStore } from '../../../src/creative/studioStore.js';
import { setLayerProps } from '../../../src/creative/edits.js';
import { startRecovery, listRecovery, takeRecovery, clearRecovery } from '../../../src/creative/io/recovery.js';
import { saveProject } from '../../../src/creative/io/projectFiles.js';

setSurfaceFactory(null);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAINT = { tab: 'paint' };
const fakeFiles = { uniqueChildPath: async (p, n) => `${p}/${n}`, saveFile: async () => {} };

async function clearAll() {
  for (const r of await listRecovery()) await clearRecovery(r.id);
}

function dirtyStore(name = 'Draft') {
  const store = createStudioStore();
  const session = store.newDocument({ name, width: 16, height: 12, background: '#336699' });
  setLayerProps(session, session.doc.layers[0].id, { opacity: 0.4 }, PAINT);
  return { store, session };
}

test('a dirty session is saved on the interval', async () => {
  await clearAll();
  const { store, session } = dirtyStore();
  const stop = startRecovery(store, 50);
  await sleep(400);
  const listed = await listRecovery();
  stop();
  assert.ok(listed.some(r => r.id === session.id && r.name === 'Draft'), JSON.stringify(listed));
  await clearAll();
});

test('a clean session is not copied', async () => {
  await clearAll();
  const store = createStudioStore();
  store.newDocument({ width: 8, height: 8 });
  const stop = startRecovery(store, 50);
  await sleep(250);
  stop();
  assert.equal((await listRecovery()).length, 0);
});

test('save and close clear the copy', async () => {
  await clearAll();
  const { store, session } = dirtyStore('Saved one');
  const other = store.newDocument({ name: 'Closed one', width: 8, height: 8 });
  setLayerProps(other, other.doc.layers[0].id, { opacity: 0.5 }, PAINT);
  const stop = startRecovery(store, 50);
  await sleep(400);
  assert.equal((await listRecovery()).length, 2);
  await saveProject(store, session, { files: fakeFiles });
  store.closeDocument(other.id);
  await sleep(400);
  stop();
  assert.deepEqual(await listRecovery(), []);
});

test('store.dispose() with unsaved documents writes their copies before resolving', async () => {
  await clearAll();
  const { store, session } = dirtyStore('Closing window');
  const stop = startRecovery(store, 60 * 60 * 1000); // the interval never fires in this test
  await store.dispose();
  stop();
  const listed = await listRecovery();
  assert.ok(listed.some(r => r.id === session.id), 'the copy was written on close');
  await clearAll();
});

test('takeRecovery restores the document exactly', async () => {
  await clearAll();
  const { store, session } = dirtyStore('Restore me');
  const stop = startRecovery(store, 60 * 60 * 1000);
  await store.dispose();
  stop();
  const doc = await takeRecovery(session.id);
  assert.equal(doc.name, 'Restore me');
  assert.equal(doc.layers[0].opacity, 0.4);
  assert.deepEqual([...surfaceOf(doc, doc.layers[0]).read(3, 3, 1, 1).data], [51, 102, 153, 255]);
  await clearAll();
});
