import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';
import { createCatalog } from '../../src/services/aunlock/catalog.js';
import * as controllerMod from '../../src/services/aunlock/controller.js';

const { createController } = controllerMod;
const FAKE_KEY = 'sk-' + 'proj-' + 'FAKEKEYFIXTUREONLY0123456789';
const DAY = 864e5;

function make({ now = Date.now, purge } = {}) {
  const purged = [];
  const order = [];
  const catalog = createCatalog({
    jobs: createFakeTable('id'),
    devices: createFakeTable('id'),
    provenance: createFakeTable('jobId'),
    certs: createFakeTable('id'),
    recovered: createFakeTable(['jobId', 'path']),
  });
  const cascade = catalog.deleteJobCascade;
  catalog.deleteJobCascade = async (id) => {
    order.push(['cascade', id]);
    return cascade(id);
  };
  const native = {
    async enumerate() { return [{ kind: 'drive', serial: 'S1', lock: 'none', systemDisk: false }]; },
    async purgeRecovered(id) {
      order.push(['purge', id]);
      purged.push(id);
      return purge ? purge(id) : true;
    },
  };
  const ctl = createController({ catalog, native, now, operator: 'op' });
  const seedRow = (jobId) =>
    catalog.putRecovered({ jobId, path: 'Users/sam/a.txt', size: 1, stagedRef: 'r1', sourceType: 'live', checksum: 'c1' });
  return { ctl, catalog, purged, order, seedRow };
}

test('discardJob deletes the staged bytes first, then the job and its rows', async () => {
  const { ctl, catalog, purged, order, seedRow } = make();
  const j = await ctl.newJob();
  await seedRow(j.id);
  const r = await ctl.discardJob(j.id);
  assert.equal(r.ok, true);
  assert.deepEqual(purged, [j.id]);
  assert.deepEqual(order, [['purge', j.id], ['cascade', j.id]]);
  assert.equal(await catalog.getJob(j.id), null);
  assert.deepEqual(await catalog.listRecovered(j.id), []);
});

test('a failed byte purge keeps the job (purge-pending) and its rows, so nothing is orphaned', async () => {
  const { ctl, catalog, order, seedRow } = make({ purge: async () => { throw new Error(`file locked ${FAKE_KEY}`); } });
  const j = await ctl.newJob();
  await seedRow(j.id);
  const r = await ctl.discardJob(j.id);
  assert.equal(r.ok, false);
  assert.match(r.reason, /retr/i);
  assert.equal(r.reason.includes(FAKE_KEY), false);
  const job = await catalog.getJob(j.id);
  assert.equal(job.status, 'purge-pending');
  assert.equal(String(job.purgeError).includes(FAKE_KEY), false);
  assert.equal((await catalog.listRecovered(j.id)).length, 1);
  assert.equal(order.some(([op]) => op === 'cascade'), false);
});

test('a purge that does not confirm deletion (anything but true) is treated as a failure', async () => {
  const { ctl, catalog, seedRow } = make({ purge: async () => false });
  const j = await ctl.newJob();
  await seedRow(j.id);
  assert.equal((await ctl.discardJob(j.id)).ok, false);
  assert.equal((await catalog.getJob(j.id)).status, 'purge-pending');
});

test('the next sweep retries a purge-pending job and drops it once the bytes are gone', async () => {
  let fail = true;
  const { ctl, catalog, purged, seedRow } = make({
    purge: async () => {
      if (fail) throw new Error('busy');
      return true;
    },
  });
  const j = await ctl.newJob();
  await seedRow(j.id);
  await ctl.discardJob(j.id);
  assert.equal((await catalog.getJob(j.id)).status, 'purge-pending');
  fail = false;
  await ctl.sweepRetention();
  assert.equal(await catalog.getJob(j.id), null);
  assert.deepEqual(await catalog.listRecovered(j.id), []);
  assert.deepEqual(purged, [j.id, j.id]);
});

test('newJob past the 10-day window deletes the expired job bytes, then its rows', async () => {
  let t = 1;
  const { ctl, catalog, purged, order, seedRow } = make({ now: () => t });
  const old = await ctl.newJob();
  await seedRow(old.id);
  t = 1 + 11 * DAY;
  await ctl.newJob();
  assert.deepEqual(purged, [old.id]);
  assert.deepEqual(order.slice(0, 2), [['purge', old.id], ['cascade', old.id]]);
  assert.equal(await catalog.getJob(old.id), null);
  assert.deepEqual(await catalog.listRecovered(old.id), []);
});

test('an expired job whose byte purge fails stays as purge-pending instead of vanishing', async () => {
  let t = 1;
  const { ctl, catalog, seedRow } = make({ now: () => t, purge: async () => { throw new Error('busy'); } });
  const old = await ctl.newJob();
  await seedRow(old.id);
  t = 1 + 11 * DAY;
  await ctl.sweepRetention();
  assert.equal((await catalog.getJob(old.id)).status, 'purge-pending');
  assert.equal((await catalog.listRecovered(old.id)).length, 1);
});

test('a native layer with no purge function fails closed (job kept, not dropped)', async () => {
  const { ctl, catalog, seedRow } = make();
  const j = await ctl.newJob();
  await seedRow(j.id);
  const bare = createController({ catalog, native: { enumerate: async () => [] }, operator: 'op' });
  assert.equal((await bare.discardJob(j.id)).ok, false);
  assert.equal((await catalog.getJob(j.id)).status, 'purge-pending');
});

test('stagedBytesPurger: off the desktop nothing can be staged, so the purge is trivially complete', async () => {
  assert.equal(typeof controllerMod.stagedBytesPurger, 'function');
  const calls = [];
  const purgeRecovered = async (id) => { calls.push(id); return true; };
  const offDesktop = controllerMod.stagedBytesPurger({ purgeRecovered, isTauri: () => false });
  assert.equal(await offDesktop('job_x'), true);
  assert.deepEqual(calls, []);
  const missingProbe = controllerMod.stagedBytesPurger({ purgeRecovered });
  assert.equal(await missingProbe('job_y'), true);
  assert.deepEqual(calls, []);
});

test('stagedBytesPurger: in the desktop app it is the native delete', async () => {
  const calls = [];
  const purgeRecovered = async (id) => { calls.push(id); return 'native-result'; };
  const inApp = controllerMod.stagedBytesPurger({ purgeRecovered, isTauri: () => true });
  assert.equal(await inApp('job_z'), 'native-result');
  assert.deepEqual(calls, ['job_z']);
});
