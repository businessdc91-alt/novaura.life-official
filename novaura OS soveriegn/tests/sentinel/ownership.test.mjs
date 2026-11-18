import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';

// Collaborators are module-mocked (the repo's pattern — see tests/additions/migrate.test.mjs).
// These closures read mutable module-level state so each test sets its own scenario.
let nameStatusImpl = async () => ({ state: 'available' });
let projects = [];
let projectFiles = {};
const hosted = createFakeTable('id');
const db = { hosted_sites: hosted };

mock.module(new URL('../../src/services/web/novaRegistry.js', import.meta.url).href, {
  namedExports: {
    nameStatus: async (name) => nameStatusImpl(name),
    listMyNames: async () => [],
  },
});
mock.module(new URL('../../src/services/cybeni/projectStore.js', import.meta.url).href, {
  namedExports: {
    listProjects: async () => projects,
    loadProjectFiles: async (slug) => projectFiles[slug] || [],
  },
});
mock.module(new URL('../../src/database/sovereignDatabase.js', import.meta.url).href, {
  defaultExport: db,
  namedExports: { db },
});

const { resolveTarget } = await import('../../src/services/sentinel/ownership.js');

test('an owned mesh name resolves with its content', async () => {
  nameStatusImpl = async () => ({ state: 'yours' });
  await hosted.put({ id: 'mysite.nova', domain: 'mysite.nova', htmlContent: '<h1>Hi</h1>' });
  const r = await resolveTarget({ kind: 'mesh', name: 'mysite.nova' });
  assert.equal(r.ok, true);
  assert.equal(r.target.id, 'tgt_mesh_mysite.nova');
  assert.equal(r.target.kind, 'mesh');
  assert.equal(r.target.ref, 'mysite.nova');
  assert.deepEqual(r.target.content.files, [{ path: 'index.html', content: '<h1>Hi</h1>' }]);
});

test('a mesh name owned by another key is refused', async () => {
  nameStatusImpl = async () => ({ state: 'registered' });
  const r = await resolveTarget({ kind: 'mesh', name: 'someoneelse.nova' });
  assert.equal(r.ok, false);
  assert.equal('target' in r, false);
  assert.match(r.reason, /not registered to this node|owned|refused/i);
});

test('an unknown mesh name is refused', async () => {
  nameStatusImpl = async () => ({ state: 'available' });
  const r = await resolveTarget({ kind: 'mesh', name: 'nope.nova' });
  assert.equal(r.ok, false);
});

test('an existing project resolves with its files', async () => {
  projects = [{ slug: 'my-app', name: 'My App' }];
  projectFiles = { 'my-app': [{ path: 'index.html', content: '<h1>App</h1>' }] };
  const r = await resolveTarget({ kind: 'project', slug: 'my-app' });
  assert.equal(r.ok, true);
  assert.equal(r.target.id, 'tgt_project_my-app');
  assert.equal(r.target.kind, 'project');
  assert.equal(r.target.name, 'My App');
  assert.deepEqual(r.target.content.files, [{ path: 'index.html', content: '<h1>App</h1>' }]);
});

test('a non-existent project is refused', async () => {
  projects = [];
  const r = await resolveTarget({ kind: 'project', slug: 'ghost' });
  assert.equal(r.ok, false);
  assert.equal('target' in r, false);
});

test('an unknown kind is refused', async () => {
  const r = await resolveTarget({ kind: 'website', name: 'example.com' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /unknown|kind/i);
});
