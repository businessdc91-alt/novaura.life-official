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

globalThis.window = new EventTarget();
const events = [];
window.addEventListener('novaura:user_apps_changed', () => events.push('user_apps_changed'));
window.addEventListener('novaura:addition_changed', (e) => events.push(`addition_changed:${e.detail}`));

const registry = await import('../../src/services/additions/registry.js');
const { localManifest } = await import('../../src/services/additions/manifest.js');
const { getAdditionData } = await import('../../src/services/additions/dataStore.js');

const oldEntry = { id: 'user_notes', slug: 'notes', name: 'Notes', color: '#7c3aed', iconBlobId: null, addedAt: 1 };

beforeEach(() => {
  settings.clear();
  table.rows.clear();
  events.length = 0;
});

test('apps saved before this change are listed with no manifest yet', async () => {
  settings.set('user_apps', [oldEntry]);
  const [a] = await registry.listAdditions();
  assert.equal(a.id, 'user_notes');
  assert.equal(a.manifest, null);
  assert.deepEqual(a.grants, { permissions: [], network: [] });
  assert.deepEqual(a.requested, { network: [] });
  assert.equal(a.legacy, false);
  assert.deepEqual(a.legacyNotes, []);
  assert.equal(a.quotaBytes, 1024 ** 3);
  assert.equal((await registry.getAddition('user_notes')).name, 'Notes');
  assert.equal(await registry.getAddition('user_missing'), null);
});

test('a permission the app did not ask for cannot be granted', async () => {
  settings.set('user_apps', [{ ...oldEntry, manifest: { ...localManifest({ slug: 'notes', name: 'Notes' }), permissions: ['notifications'] } }]);
  const a = await registry.setGrants('user_notes', { permissions: ['notifications', 'ai', 'camera'] });
  assert.deepEqual(a.grants.permissions, ['notifications']);
  assert.deepEqual((await registry.getAddition('user_notes')).grants.permissions, ['notifications']);
  assert.ok(events.includes('addition_changed:user_notes'));
  assert.ok(events.includes('user_apps_changed'));
});

test('a network origin must be asked for and valid', async () => {
  settings.set('user_apps', [{ ...oldEntry, manifest: { ...localManifest({ slug: 'notes', name: 'Notes' }), network: ['https://api.weather.gov'] } }]);
  const a = await registry.setGrants('user_notes', { network: ['https://API.weather.gov/', 'https://not-asked.example', 'http://api.weather.gov'] });
  assert.deepEqual(a.grants.network, ['https://api.weather.gov']);
  assert.equal(await registry.noteBlockedOrigin('user_notes', 'https://maps.example.com'), true);
  const b = await registry.setGrants('user_notes', { network: ['https://api.weather.gov', 'https://maps.example.com'] });
  assert.deepEqual(b.grants.network, ['https://api.weather.gov', 'https://maps.example.com']);
});

test('a blocked local or IPC address is never offered', async () => {
  settings.set('user_apps', [oldEntry]);
  for (const origin of ['http://127.0.0.1:1234', 'http://localhost:1234', 'https://ipc.localhost', 'http://ipc.localhost', 'about:blank']) {
    assert.equal(await registry.noteBlockedOrigin('user_notes', origin), false, origin);
  }
  assert.deepEqual((await registry.getAddition('user_notes')).requested.network, []);
});

test('the same blocked origin is noted once', async () => {
  settings.set('user_apps', [oldEntry]);
  assert.equal(await registry.noteBlockedOrigin('user_notes', 'https://api.weather.gov'), true);
  assert.equal(await registry.noteBlockedOrigin('user_notes', 'https://API.weather.gov/'), false);
  assert.deepEqual((await registry.getAddition('user_notes')).requested.network, ['https://api.weather.gov']);
  assert.equal(await registry.noteBlockedOrigin('user_missing', 'https://api.weather.gov'), false);
});

test('adding an app again keeps what the person granted', async () => {
  settings.set('user_apps', [oldEntry]);
  await registry.noteBlockedOrigin('user_notes', 'https://api.weather.gov');
  await registry.setGrants('user_notes', { network: ['https://api.weather.gov'] });
  await registry.setQuota('user_notes', 5 * 1024 ** 3);
  const again = await registry.upsertLocalAddition({ slug: 'notes', name: 'Notes 2', color: '#123456', iconBlobId: 'icon_1', kind: 'cybeni' });
  assert.equal(again.name, 'Notes 2');
  assert.equal(again.manifest.id, 'local.notes');
  assert.deepEqual(again.grants.network, ['https://api.weather.gov']);
  assert.deepEqual(again.requested.network, ['https://api.weather.gov']);
  assert.equal(again.quotaBytes, 5 * 1024 ** 3);
  assert.equal((await registry.listAdditions()).length, 1);
  const fresh = await registry.upsertLocalAddition({ slug: 'other', name: 'Other', kind: 'forge' });
  assert.equal(fresh.id, 'user_other');
  assert.equal(fresh.manifest.source.kind, 'forge');
  assert.equal((await registry.listAdditions()).length, 2);
});

test('removing without keeping data clears it', async () => {
  settings.set('user_apps', [oldEntry, { ...oldEntry, id: 'user_b', slug: 'b' }]);
  const data = getAdditionData();
  await data.set('user_notes', 'k', 'v');
  await data.set('user_b', 'k', 'v');
  await registry.removeAddition('user_b', { keepData: true });
  assert.equal(await data.get('user_b', 'k'), 'v');
  await registry.removeAddition('user_notes', { keepData: false });
  assert.equal(await data.get('user_notes', 'k'), undefined);
  assert.deepEqual(await registry.listAdditions(), []);
});

test('the quota can be raised but not set to nonsense', async () => {
  settings.set('user_apps', [oldEntry]);
  assert.equal((await registry.setQuota('user_notes', 2 * 1024 ** 3)).quotaBytes, 2 * 1024 ** 3);
  await assert.rejects(registry.setQuota('user_notes', -5));
  await assert.rejects(registry.setQuota('user_notes', Number.NaN));
});
