import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';
import { createTargetStore } from '../../src/services/sentinel/targetStore.js';

function make() {
  const targets = createFakeTable('id');
  const runs = createFakeTable('id');
  const findings = createFakeTable(['runId', 'id']);
  return { store: createTargetStore({ targets, runs, findings }), targets, runs, findings };
}

test('a target round-trips by id', async () => {
  const { store } = make();
  const t = await store.registerTarget({ kind: 'project', ref: 'my-site', name: 'My Site' });
  assert.equal(t.id, 'tgt_project_my-site');
  assert.equal(t.kind, 'project');
  assert.equal(t.ref, 'my-site');
  assert.equal(t.name, 'My Site');
  assert.equal(t.isStaging, false);
  assert.equal(typeof t.updatedAt, 'number');
  assert.deepEqual(await store.getTarget('tgt_project_my-site'), t);
  assert.equal(await store.getTarget('tgt_project_nope'), null);
});

test('registering the same kind+ref twice updates rather than duplicates', async () => {
  const { store } = make();
  await store.registerTarget({ kind: 'mesh', ref: 'nova', name: 'Old Name' });
  await store.registerTarget({ kind: 'mesh', ref: 'nova', name: 'New Name', isStaging: true });
  const all = await store.listTargets();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, 'New Name');
  assert.equal(all[0].isStaging, true);
});

test('a run and its findings are stored and read back', async () => {
  const { store } = make();
  const run = { id: 'run_1', targetId: 'tgt_project_my-site', mode: 'safe', status: 'complete', startedAt: 1, finishedAt: 2 };
  await store.recordRun(run);
  await store.recordFindings('run_1', [
    { id: 'f1', severity: 'info', checkId: 'echo' },
    { id: 'f2', severity: 'low', checkId: 'echo' },
  ]);
  const runs = await store.listRuns();
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0], run);
  const found = await store.listFindings('run_1');
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((f) => f.id).sort(), ['f1', 'f2']);
  assert.equal(found.every((f) => f.runId === 'run_1'), true);
});
