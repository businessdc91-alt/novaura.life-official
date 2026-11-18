import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';

const settings = new Map();
const table = createFakeTable();
const db = {
  getSetting: async (key, fallback = null) => (settings.has(key) ? structuredClone(settings.get(key)) : fallback),
  setSetting: async (key, value) => { settings.set(key, structuredClone(value)); },
  addition_data: table,
};
mock.module(new URL('../../src/database/sovereignDatabase.js', import.meta.url).href, { defaultExport: db, namedExports: { db } });

const registry = await import('../../src/services/additions/registry.js');
const { getAdditionData } = await import('../../src/services/additions/dataStore.js');
const { attributeLegacyStorage, usesBrowserDatabase, migrateLegacyApps, copyOldDataAgain, awaitLegacyStorage } = await import('../../src/services/additions/migrate.js');

const SHARED = Object.freeze({
  theme: 'dark',
  __cybeni_probe__: '1',
  '__cybeni_db__:notes:todos': '[{"id":1}]',
  '__cybeni_kv__:notes:last:opened': '"today"',
  '__cybeni_auth_users__:notes:': '[{"email":"a@b.c"}]',
  '__cybeni_auth_session__:notes:': '{"user":1}',
  '__cybeni_db__:habits:days': '[]',
  '__cybeni_db__:neverinstalled:secrets': '["x"]',
  '__cybeni_db__:orphan': '[]',
  __cybeni_auth_users__: '[]',
});

const entry = (slug, extra = {}) => ({ id: `user_${slug}`, slug, name: slug[0].toUpperCase() + slug.slice(1), color: '#7c3aed', iconBlobId: null, addedAt: 1, ...extra });
const FILES = {
  notes: [{ path: 'index.html', content: '<script type="module" src="main.js"></script>' }, { path: 'main.js', content: "import { db } from '@cybeni/backend';" }],
  habits: [{ path: 'src/db.js', content: "import Dexie from 'dexie';\nexport const db = new Dexie('habits');" }],
};

function deps(extra = {}) {
  const reads = [];
  return {
    reads,
    registry,
    data: getAdditionData(),
    readSharedStorage: async () => { reads.push('read'); return SHARED; },
    loadFiles: async (slug) => FILES[slug] || [],
    isDesktop: true,
    ...extra,
  };
}

beforeEach(() => {
  settings.clear();
  table.rows.clear();
});

test("an app's own @cybeni/backend keys go only to it, without the name prefix", () => {
  const out = attributeLegacyStorage(SHARED, ['notes', 'habits']);
  const notes = out.get('notes');
  assert.equal(notes['__cybeni_db__:todos'], '[{"id":1}]');
  assert.equal(notes['__cybeni_kv__:last:opened'], '"today"');
  assert.equal(notes.__cybeni_auth_users__, '[{"email":"a@b.c"}]');
  assert.equal(notes.__cybeni_auth_session__, '{"user":1}');
  assert.equal(notes['__cybeni_db__:days'], undefined);
  assert.equal(out.get('habits')['__cybeni_db__:days'], '[]');
  assert.equal(out.get('habits')['__cybeni_db__:todos'], undefined);
});

test("another project's keys are left behind", () => {
  const out = attributeLegacyStorage(SHARED, ['notes', 'habits']);
  for (const kv of out.values()) {
    assert.ok(!Object.values(kv).includes('["x"]'), 'a never-installed project leaked');
    assert.ok(!Object.keys(kv).some((k) => k.includes('neverinstalled')));
    assert.equal(kv.__cybeni_probe__, undefined);
    // Backend keys saved with no app name came from previews, not from an installed app.
    assert.equal(kv['__cybeni_db__:orphan'], undefined);
  }
  assert.equal(out.get('notes').__cybeni_auth_users__, '[{"email":"a@b.c"}]');
});

test('plain keys are copied to every old app', () => {
  const out = attributeLegacyStorage(SHARED, ['notes', 'habits']);
  assert.equal(out.get('notes').theme, 'dark');
  assert.equal(out.get('habits').theme, 'dark');
  assert.deepEqual([...out.keys()].sort(), ['habits', 'notes']);
});

test('moved apps get a manifest with no permissions and no network, marked added before permissions', async () => {
  settings.set('user_apps', [entry('notes'), entry('habits')]);
  const d = deps();
  const { migrated } = await migrateLegacyApps(d);
  assert.deepEqual(migrated.sort(), ['user_habits', 'user_notes']);
  const notes = await registry.getAddition('user_notes');
  assert.equal(notes.manifest.id, 'local.notes');
  assert.deepEqual(notes.manifest.permissions, []);
  assert.deepEqual(notes.manifest.network, []);
  assert.deepEqual(notes.grants, { permissions: [], network: [] });
  assert.equal(notes.legacy, true);
  assert.ok(notes.migratedAt > 0);
  const snap = await getAdditionData().snapshotLocalStorage('user_notes');
  assert.equal(snap['__cybeni_db__:todos'], '[{"id":1}]');
  assert.equal(snap.theme, 'dark');
  assert.equal((await getAdditionData().snapshotLocalStorage('user_habits'))['__cybeni_db__:days'], '[]');
});

test('apps that already have a manifest are not touched, and a second run does nothing', async () => {
  const modern = entry('fresh', { manifest: { id: 'local.fresh' }, legacy: false });
  settings.set('user_apps', [entry('notes'), modern]);
  const first = await migrateLegacyApps(deps());
  assert.deepEqual(first.migrated, ['user_notes']);
  assert.deepEqual((await registry.getAddition('user_fresh')).manifest, { id: 'local.fresh' });
  assert.deepEqual(await getAdditionData().snapshotLocalStorage('user_fresh'), {});
  const d = deps();
  const second = await migrateLegacyApps(d);
  assert.deepEqual(second.migrated, []);
  assert.deepEqual(d.reads, [], 'nothing left to move, so the old storage is not even read');
});

test('the old shared data is only read', async () => {
  settings.set('user_apps', [entry('notes')]);
  const before = JSON.stringify(SHARED);
  const d = deps();
  await migrateLegacyApps(d);
  assert.equal(JSON.stringify(SHARED), before);
  assert.deepEqual(d.reads, ['read']);
});

test('outside the desktop the manifest is added without copying data', async () => {
  settings.set('user_apps', [entry('notes')]);
  const d = deps({ isDesktop: false });
  const { migrated } = await migrateLegacyApps(d);
  assert.deepEqual(migrated, ['user_notes']);
  assert.deepEqual(d.reads, []);
  assert.equal(table.rows.size, 0);
  assert.equal((await registry.getAddition('user_notes')).legacy, true);
});

test('an app that uses a browser database is flagged', async () => {
  assert.equal(usesBrowserDatabase(FILES.habits), true);
  assert.equal(usesBrowserDatabase([{ path: 'a.js', content: 'const req = indexedDB.open("x");' }]), true);
  assert.equal(usesBrowserDatabase([{ path: 'a.js', content: "import localforage from 'localforage';" }]), true);
  assert.equal(usesBrowserDatabase([{ path: 'a.js', content: "const { openDB } = await import('idb');" }]), true);
  assert.equal(usesBrowserDatabase(FILES.notes), false);
  settings.set('user_apps', [entry('notes'), entry('habits')]);
  await migrateLegacyApps(deps());
  assert.deepEqual((await registry.getAddition('user_habits')).legacyNotes, ['browser-database']);
  assert.deepEqual((await registry.getAddition('user_notes')).legacyNotes, []);
});

test('copying old data again brings back the old values for that app only', async () => {
  settings.set('user_apps', [entry('notes'), entry('habits')]);
  await migrateLegacyApps(deps());
  const data = getAdditionData();
  await data.writeLocalStorage('user_notes', [{ op: 'set', key: 'theme', value: 'light' }, { op: 'set', key: 'mine', value: 'kept' }]);
  await data.writeLocalStorage('user_habits', [{ op: 'set', key: 'theme', value: 'light' }]);
  const copied = await copyOldDataAgain('user_notes', deps());
  assert.ok(copied > 0);
  const snap = await data.snapshotLocalStorage('user_notes');
  assert.equal(snap.theme, 'dark');
  assert.equal(snap.mine, 'kept');
  assert.equal((await data.snapshotLocalStorage('user_habits')).theme, 'light');
});

test('reading the old storage gives up with an error, not an empty answer, so nothing is marked moved', async () => {
  const win = new EventTarget();
  const frame = { contentWindow: {} };
  await assert.rejects(awaitLegacyStorage(win, frame, 'tok', 20), /old app data/i);
  const answer = awaitLegacyStorage(win, frame, 'tok', 1000);
  win.dispatchEvent(Object.assign(new Event('message'), { source: {}, data: { __novauraLegacyStorage: 'tok', items: { a: 'stranger' } } }));
  win.dispatchEvent(Object.assign(new Event('message'), { source: frame.contentWindow, data: { __novauraLegacyStorage: 'wrong', items: { a: 'x' } } }));
  win.dispatchEvent(Object.assign(new Event('message'), { source: frame.contentWindow, data: { __novauraLegacyStorage: 'tok', items: { a: '1' } } }));
  assert.deepEqual(await answer, { a: '1' });
  settings.set('user_apps', [entry('notes')]);
  await assert.rejects(migrateLegacyApps(deps({ readSharedStorage: () => awaitLegacyStorage(win, frame, 'tok', 10) })));
  assert.equal((await registry.getAddition('user_notes')).manifest, null);
});
