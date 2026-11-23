import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeRecover } from '../../src/services/aunlock/nativeRecover.js';

function spy(result) {
  const calls = [];
  const invoke = async (cmd, args) => { calls.push([cmd, args]); return result; };
  return { invoke, calls };
}

test('readHealth maps device serial/sizeBytes', async () => {
  const s = spy({ ok: true });
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  assert.deepEqual(await nr.readHealth({ serial: 'S1', sizeBytes: 5 }), { ok: true });
  assert.deepEqual(s.calls[0], ['aunlock_read_health', { serial: 'S1', sizeBytes: 5 }]);
});

test('resolveVolumes defaults missing sizeBytes to null', async () => {
  const s = spy([]);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  await nr.resolveVolumes({ serial: 'WD-ABC123' });
  assert.deepEqual(s.calls[0], ['aunlock_resolve_volumes', { serial: 'WD-ABC123', sizeBytes: null }]);
});

test('listDir binds the letter to the device: passes serial/sizeBytes, driveLetter and subpath', async () => {
  const s = spy([]);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  await nr.listDir({ serial: 'S1', sizeBytes: 9 }, 'E', 'docs');
  assert.deepEqual(s.calls[0], ['aunlock_list_dir', { serial: 'S1', sizeBytes: 9, driveLetter: 'E', subpath: 'docs' }]);
});

test('recoverFiles binds to the device and returns the RecoverOutcome unchanged', async () => {
  const outcome = { entries: [1], skipped: [], links: [], complete: true, stopReason: null };
  const s = spy(outcome);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  const sel = { preset: true, paths: [] };
  assert.equal(await nr.recoverFiles('job_1', { serial: 'S1' }, 'E', sel), outcome);
  assert.deepEqual(s.calls[0], [
    'aunlock_recover_files',
    { jobId: 'job_1', serial: 'S1', sizeBytes: null, driveLetter: 'E', selection: sel },
  ]);
});

test('verifyRecovered passes only the staged row metadata', async () => {
  const s = spy(true);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  const row = { path: 'E:\\a.txt', size: 4, stagedRef: 'E/a.txt', checksum: 'ab', contents: 'NOPE' };
  assert.equal(await nr.verifyRecovered('job_1', row), true);
  assert.deepEqual(s.calls[0], ['aunlock_verify_recovered', { jobId: 'job_1', stagedRef: 'E/a.txt', size: 4, checksum: 'ab' }]);
});

test('listStagedJobs takes no arguments', async () => {
  const s = spy(['job_1']);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  assert.deepEqual(await nr.listStagedJobs(), ['job_1']);
  assert.deepEqual(s.calls[0], ['aunlock_list_staged_jobs', {}]);
});

test('purgeRecovered passes jobId', async () => {
  const s = spy(true);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  assert.equal(await nr.purgeRecovered('job_1'), true);
  assert.deepEqual(s.calls[0], ['aunlock_purge_recovered', { jobId: 'job_1' }]);
});

test('off-desktop every method rejects and never invokes', async () => {
  const s = spy(null);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => false });
  await assert.rejects(() => nr.readHealth({}), /desktop app/i);
  await assert.rejects(() => nr.resolveVolumes({}), /desktop app/i);
  await assert.rejects(() => nr.listDir({}, 'E', ''), /desktop app/i);
  await assert.rejects(() => nr.recoverFiles('j', {}, 'E', {}), /desktop app/i);
  await assert.rejects(() => nr.purgeRecovered('j'), /desktop app/i);
  await assert.rejects(() => nr.verifyRecovered('j', {}), /desktop app/i);
  await assert.rejects(() => nr.listStagedJobs(), /desktop app/i);
  assert.equal(s.calls.length, 0);
});
