import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';
import { createCatalog } from '../../src/services/aunlock/catalog.js';
import { createController } from '../../src/services/aunlock/controller.js';

const baseNative = {
  async enumerate() { return [{ kind: 'laptop', serial: 'S1', lock: 'user', storage: '500GB HDD', systemDisk: false }]; },
  async resolveVolumes() { return [{ driveLetter: 'E', fsType: 'NTFS', label: '', sizeBytes: 1, encrypted: false, readable: true }]; },
  async recoverFiles() {
    return {
      entries: [
        { path: 'photos/a.jpg', size: 100, stagedRef: 's1', sourceType: 'live', checksum: 'c1' },
        { path: 'docs/b.pdf', size: 50, stagedRef: 's2', sourceType: 'live', checksum: 'c2' },
      ],
      skipped: [], complete: true, stopReason: null,
    };
  },
  async wipe() { return { ok: true, startedAt: 10, finishedAt: 20 }; },
  async purgeRecovered() { return true; }, // staged bytes deleted (Task 8: purge precedes the row cascade)
};

function make({ now = Date.now, native = baseNative } = {}) {
  const catalog = createCatalog({
    jobs: createFakeTable('id'),
    devices: createFakeTable('id'),
    provenance: createFakeTable('jobId'),
    certs: createFakeTable('id'),
    recovered: createFakeTable(['jobId', 'path']),
  });
  const ctl = createController({ catalog, native, now, operator: 'op' });
  return { ctl, catalog };
}

test('newJob past the cap purges the oldest job and its rows', async () => {
  let t = 1;
  const { ctl, catalog } = make({ now: () => t });
  const j1 = await ctl.newJob(); await ctl.intakeDevice(j1.id);
  t = 2; const j2 = await ctl.newJob(); await ctl.intakeDevice(j2.id);
  t = 3; const j3 = await ctl.newJob(); await ctl.intakeDevice(j3.id);
  t = 4; await ctl.newJob();
  const ids = (await ctl.listJobs()).map((j) => j.id);
  assert.equal(ids.length, 3);
  assert.equal(ids.includes(j1.id), false);
  assert.deepEqual(await catalog.listDevices(j1.id), []); // its device cascaded away
});

test('recover is refused on a job with no authorization and stores nothing', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  const r = await ctl.recover(j.id);
  assert.equal(r.ok, false);
  assert.match(r.reason, /authorization/i);
  assert.deepEqual(await catalog.listRecovered(j.id), []);
  assert.equal((await catalog.getJob(j.id)).status, 'intake');
});

test('an authorized job recovers and stores a manifest', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  await ctl.authorize(j.id, { source: 'owner present', authorization: 'owner: Jane' });
  const r = await ctl.recover(j.id);
  assert.equal(r.ok, true);
  assert.equal((await catalog.listRecovered(j.id)).length, 2);
  assert.equal((await catalog.getJob(j.id)).status, 'recovered');
});

test('listRecovered returns the staged rows for a job (metadata only)', async () => {
  const { ctl } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  await ctl.authorize(j.id, { authorization: 'owner present' });
  await ctl.recover(j.id);
  const rows = await ctl.listRecovered(j.id);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.path).sort(), ['docs/b.pdf', 'photos/a.jpg']);
  assert.equal(rows.every((r) => !('contents' in r)), true);
});

test('sanitize is refused without authorization', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  const r = await ctl.sanitize(j.id);
  assert.equal(r.ok, false);
  assert.deepEqual(await catalog.listCerts(j.id), []);
  assert.notEqual((await catalog.getJob(j.id)).status, 'done');
});

test('an authorized sanitize wipes, stores a signed-off cert, and sets the job done', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  await ctl.authorize(j.id, { authorization: 'manifest #9' });
  const r = await ctl.sanitize(j.id);
  assert.equal(r.ok, true);
  assert.equal(r.cert.method, 'clear'); // HDD -> clear
  assert.equal(r.cert.authorization, 'manifest #9');
  assert.match(r.cert.hash, /^[0-9a-f]{64}$/);
  assert.equal((await catalog.listCerts(j.id)).length, 1);
  assert.equal((await catalog.getJob(j.id)).status, 'done');
});

test('sweepRetention purges jobs past the 10-day TTL without creating a new job', async () => {
  let t = 1;
  const { ctl, catalog } = make({ now: () => t });
  const old = await ctl.newJob();
  await ctl.intakeDevice(old.id);
  t = 1 + 11 * 864e5; // 11 days later
  await ctl.sweepRetention();
  assert.equal((await ctl.listJobs()).some((j) => j.id === old.id), false);
  assert.deepEqual(await catalog.listDevices(old.id), []);
});

test('discardJob removes a job and its recovered data on demand', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  await ctl.authorize(j.id, { authorization: 'owner present' });
  await ctl.recover(j.id);
  assert.equal((await catalog.listRecovered(j.id)).length, 2);
  await ctl.discardJob(j.id);
  assert.equal(await catalog.getJob(j.id), null);
  assert.deepEqual(await catalog.listRecovered(j.id), []);
});

test('recover/sanitize on a locked device with no authorization are both refused', async () => {
  const lockedNative = { ...baseNative, async enumerate() { return [{ kind: 'laptop', serial: 'S', lock: 'bios', storage: '500GB HDD', systemDisk: false }]; } };
  const { ctl, catalog } = make({ native: lockedNative });
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  assert.equal((await ctl.recover(j.id)).ok, false);
  assert.equal((await ctl.sanitize(j.id)).ok, false);
  assert.deepEqual(await catalog.listRecovered(j.id), []);
  assert.deepEqual(await catalog.listCerts(j.id), []);
});

test('listConnectedDevices returns the native blob list without storing', async () => {
  const { ctl, catalog } = make({ native: { enumerate: async () => ([{ kind: 'drive', serial: 'S1', systemDisk: false }]) } });
  const j = await ctl.newJob();
  const list = await ctl.listConnectedDevices();
  assert.equal(list.length, 1);
  assert.deepEqual(await catalog.listDevices(j.id), []); // nothing written
});

test('intakeDevice refuses the host system disk', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  const r = await ctl.intakeDevice(j.id, { kind: 'drive', serial: 'OS', systemDisk: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /system disk/i);
  assert.deepEqual(await catalog.listDevices(j.id), []);
});

test('intakeDevice stores a chosen non-system device', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id, { kind: 'drive', serial: 'S9', systemDisk: false });
  const devs = await catalog.listDevices(j.id);
  assert.equal(devs[0].serial, 'S9');
  assert.equal(devs[0].systemDisk, false);
});

test('intakeDevice with no blob still intakes the first enumerated (Phase 1a path)', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  assert.equal((await catalog.listDevices(j.id)).length, 1);
});
