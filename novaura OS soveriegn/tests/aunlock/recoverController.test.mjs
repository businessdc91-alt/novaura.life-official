import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';
import { createCatalog } from '../../src/services/aunlock/catalog.js';
import { createController } from '../../src/services/aunlock/controller.js';

const FAKE_KEY = 'sk-' + 'proj-' + 'FAKEKEYFIXTUREONLY0123456789';
const vol = (driveLetter, over = {}) => ({ driveLetter, fsType: 'NTFS', label: '', sizeBytes: 1, encrypted: false, readable: true, ...over });
const entry = (path) => ({ path, size: 10, stagedRef: `ref_${path}`, sourceType: 'live', checksum: 'abc' });

function make({ lock = 'none', volumes = [vol('E')], recoverFiles, authorize = true, failListing = false, failResolve = false } = {}) {
  const calls = { recoverFiles: [], listDir: [] };
  const native = {
    async enumerate() { return [{ kind: 'drive', serial: 'S1', lock, systemDisk: false, sizeBytes: 99 }]; },
    async readHealth() {
      if (failListing) throw new Error(`health ${FAKE_KEY}`);
      return { status: 'ok' };
    },
    async resolveVolumes() {
      if (failResolve) throw new Error(`resolve ${FAKE_KEY}`);
      return volumes;
    },
    async listDir(l, s) {
      if (failListing) throw new Error(`list ${FAKE_KEY}`);
      calls.listDir.push([l, s]);
      return [{ name: 'a.txt', isDir: false, size: 1 }];
    },
    async recoverFiles(jobId, letter, sel) {
      calls.recoverFiles.push([jobId, letter, sel]);
      if (recoverFiles) return recoverFiles(letter);
      return { entries: [entry(`${letter}/a.jpg`)], skipped: [], complete: true, stopReason: null };
    },
    async wipe() { return { ok: true }; },
  };
  const catalog = createCatalog({
    jobs: createFakeTable('id'), devices: createFakeTable('id'), provenance: createFakeTable('jobId'),
    certs: createFakeTable('id'), recovered: createFakeTable(['jobId', 'path']),
  });
  const ctl = createController({ catalog, native, operator: 'op' });
  const setup = async () => {
    const j = await ctl.newJob();
    await ctl.intakeDevice(j.id);
    if (authorize) await ctl.authorize(j.id, { source: 'owner present', authorization: 'owner: Jane' });
    return j;
  };
  return { ctl, catalog, calls, setup };
}

test('encrypted device: recover, listVolumes, browse all refuse with a reclaim reason; native not called', async () => {
  const { ctl, calls, setup } = make({ lock: 'encrypted' });
  const j = await setup();
  for (const r of [await ctl.recover(j.id), await ctl.listVolumes(j.id), await ctl.browse(j.id, { driveLetter: 'E' })]) {
    assert.equal(r.ok, false);
    assert.match(r.reason, /reclaim/i);
  }
  assert.equal(calls.recoverFiles.length, 0);
  assert.equal(calls.listDir.length, 0);
});

test('without authorization recover and browse refuse; readHealth and listVolumes still work', async () => {
  const { ctl, calls, setup } = make({ authorize: false });
  const j = await setup();
  assert.equal((await ctl.recover(j.id)).ok, false);
  assert.equal((await ctl.browse(j.id, { driveLetter: 'E' })).ok, false);
  assert.equal(calls.recoverFiles.length, 0);
  assert.equal(calls.listDir.length, 0);
  const h = await ctl.readHealth(j.id);
  assert.equal(h.ok, true);
  assert.equal(h.health.status, 'ok');
  const v = await ctl.listVolumes(j.id);
  assert.equal(v.ok, true);
  assert.equal(v.volumes.length, 1);
});

test('no device on the job -> ok:false for every method', async () => {
  const { ctl } = make();
  const j = await ctl.newJob();
  await ctl.authorize(j.id, { authorization: 'owner present' });
  for (const r of [await ctl.recover(j.id), await ctl.readHealth(j.id), await ctl.listVolumes(j.id), await ctl.browse(j.id, { driveLetter: 'E' })]) {
    assert.equal(r.ok, false);
    assert.match(r.reason, /No device on this job/);
  }
});

test('browse lists a directory on an authorized clean device', async () => {
  const { ctl, calls, setup } = make();
  const j = await setup();
  const r = await ctl.browse(j.id, { driveLetter: 'E', subpath: 'docs' });
  assert.equal(r.ok, true);
  assert.equal(r.entries.length, 1);
  assert.deepEqual(calls.listDir[0], ['E', 'docs']);
});

test('native errors from readHealth and browse are redacted', async () => {
  const { ctl, setup } = make({ failListing: true });
  const j = await setup();
  for (const r of [await ctl.readHealth(j.id), await ctl.browse(j.id, { driveLetter: 'E' })]) {
    assert.equal(r.ok, false);
    assert.equal(r.reason.includes(FAKE_KEY), false);
  }
});

test('preset recover only touches the recoverable volume; rows carry stagedRef and sourceType live', async () => {
  const { ctl, catalog, calls, setup } = make({ volumes: [vol('E'), vol('F', { encrypted: true })] });
  const j = await setup();
  const r = await ctl.recover(j.id);
  assert.equal(r.ok, true);
  assert.deepEqual(calls.recoverFiles.map((c) => c[1]), ['E']);
  assert.deepEqual(calls.recoverFiles[0][2], { preset: true });
  const rows = await catalog.listRecovered(j.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stagedRef, 'ref_E/a.jpg');
  assert.equal(rows[0].sourceType, 'live');
  assert.equal((await catalog.getJob(j.id)).status, 'recovered');
  assert.equal(r.complete, true);
  assert.equal(r.stopReason, null);
  assert.deepEqual(r.skipped, []);
  assert.equal(r.manifest.length, 1);
});

test('explicit driveLetter recovers just that volume', async () => {
  const { ctl, calls, setup } = make({ volumes: [vol('E'), vol('F')] });
  const j = await setup();
  await ctl.recover(j.id, { driveLetter: 'F', selection: { paths: ['x'] } });
  assert.deepEqual(calls.recoverFiles.map((c) => [c[1], c[2]]), [['F', { paths: ['x'] }]]);
});

test('an incomplete outcome is surfaced and stored on the job', async () => {
  const { ctl, catalog, setup } = make({
    recoverFiles: async (l) => ({ entries: [entry(`${l}/a`)], skipped: [{ path: 'big', reason: 'too large' }], complete: false, stopReason: 'disk full' }),
  });
  const j = await setup();
  const r = await ctl.recover(j.id);
  assert.equal(r.ok, true);
  assert.equal(r.complete, false);
  assert.equal(r.stopReason, 'disk full');
  assert.equal(r.skipped.length, 1);
  const job = await catalog.getJob(j.id);
  assert.equal(job.recoverComplete, false);
  assert.equal(job.recoverSkippedCount, 1);
  assert.equal(job.recoverStopReason, 'disk full');
});

test('a rejecting volume is skipped with a redacted reason; others continue', async () => {
  const { ctl, setup } = make({
    volumes: [vol('E'), vol('F')],
    recoverFiles: async (l) => {
      if (l === 'E') throw new Error(`boom ${FAKE_KEY}`);
      return { entries: [entry('F/a')], skipped: [], complete: true, stopReason: null };
    },
  });
  const j = await setup();
  const r = await ctl.recover(j.id);
  assert.equal(r.ok, true);
  assert.equal(r.complete, false);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].path, 'E:\\');
  assert.equal(JSON.stringify(r).includes(FAKE_KEY), false);
});

test('every volume failing with no entries -> ok:false with a redacted reason', async () => {
  const { ctl, catalog, setup } = make({ recoverFiles: async () => { throw new Error(`boom ${FAKE_KEY}`); } });
  const j = await setup();
  const r = await ctl.recover(j.id);
  assert.equal(r.ok, false);
  assert.equal(r.reason.includes(FAKE_KEY), false);
  assert.notEqual((await catalog.getJob(j.id)).status, 'recovered');
});

test('recovered rows never carry contents or bytes', async () => {
  const { ctl, catalog, setup } = make({
    recoverFiles: async (l) => ({ entries: [{ ...entry(`${l}/a`), contents: 'SECRET', bytes: [1] }], skipped: [], complete: true, stopReason: null }),
  });
  const j = await setup();
  await ctl.recover(j.id);
  for (const row of await catalog.listRecovered(j.id)) {
    assert.equal('contents' in row, false);
    assert.equal('bytes' in row, false);
  }
});

test('no recoverable volume -> ok:false and recoverFiles not called', async () => {
  const { ctl, calls, setup } = make({ volumes: [vol('F', { encrypted: true })] });
  const j = await setup();
  const r = await ctl.recover(j.id);
  assert.equal(r.ok, false);
  assert.match(r.reason, /reclaim/i);
  assert.equal(calls.recoverFiles.length, 0);
});

test('explicit driveLetter of an encrypted volume on a lockState none device: recover and browse refuse', async () => {
  const { ctl, calls, setup } = make({ volumes: [vol('E'), vol('F', { encrypted: true })] });
  const j = await setup();
  for (const r of [await ctl.recover(j.id, { driveLetter: 'F' }), await ctl.browse(j.id, { driveLetter: 'f' })]) {
    assert.equal(r.ok, false);
    assert.match(r.reason, /reclaim/i);
  }
  assert.equal(calls.recoverFiles.length, 0);
  assert.equal(calls.listDir.length, 0);
});

test('explicit driveLetter that matches no resolved volume refuses', async () => {
  const { ctl, calls, setup } = make({ volumes: [vol('E')] });
  const j = await setup();
  assert.equal((await ctl.recover(j.id, { driveLetter: 'Z' })).ok, false);
  assert.equal((await ctl.browse(j.id, { driveLetter: 'Z' })).ok, false);
  assert.equal(calls.recoverFiles.length, 0);
  assert.equal(calls.listDir.length, 0);
});

test('explicit driveLetter of a recoverable volume still works (case-insensitive)', async () => {
  const { ctl, calls, setup } = make({ volumes: [vol('E')] });
  const j = await setup();
  assert.equal((await ctl.recover(j.id, { driveLetter: 'e' })).ok, true);
  assert.equal((await ctl.browse(j.id, { driveLetter: 'e' })).ok, true);
  assert.equal(calls.recoverFiles.length, 1);
  assert.equal(calls.listDir.length, 1);
});

test('resolveVolumes rejecting fails closed for explicit-letter recover and browse, redacted', async () => {
  const { ctl, calls, setup } = make({ failResolve: true });
  const j = await setup();
  for (const r of [await ctl.recover(j.id, { driveLetter: 'E' }), await ctl.browse(j.id, { driveLetter: 'E' })]) {
    assert.equal(r.ok, false);
    assert.equal(r.reason.includes(FAKE_KEY), false);
  }
  assert.equal(calls.recoverFiles.length, 0);
  assert.equal(calls.listDir.length, 0);
});

test('the returned manifest is sanitized: no contents field reaches the caller', async () => {
  const { ctl, setup } = make({
    recoverFiles: async (l) => ({ entries: [{ ...entry(`${l}/a`), contents: 'SECRET', bytes: [1] }], skipped: [], complete: true, stopReason: null }),
  });
  const j = await setup();
  const r = await ctl.recover(j.id);
  assert.deepEqual(Object.keys(r.manifest[0]).sort(), ['checksum', 'path', 'size', 'sourceType', 'stagedRef']);
});
