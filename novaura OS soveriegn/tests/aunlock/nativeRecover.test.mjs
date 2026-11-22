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

test('listDir passes driveLetter and subpath', async () => {
  const s = spy([]);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  await nr.listDir('E', 'docs');
  assert.deepEqual(s.calls[0], ['aunlock_list_dir', { driveLetter: 'E', subpath: 'docs' }]);
});

test('recoverFiles returns the RecoverOutcome unchanged', async () => {
  const outcome = { entries: [1], skipped: [], complete: true, stopReason: null };
  const s = spy(outcome);
  const nr = createNativeRecover({ invoke: s.invoke, isTauri: () => true });
  const sel = [{ path: 'a' }];
  assert.equal(await nr.recoverFiles('job_1', 'E', sel), outcome);
  assert.deepEqual(s.calls[0], ['aunlock_recover_files', { jobId: 'job_1', driveLetter: 'E', selection: sel }]);
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
  await assert.rejects(() => nr.listDir('E', ''), /desktop app/i);
  await assert.rejects(() => nr.recoverFiles('j', 'E', []), /desktop app/i);
  await assert.rejects(() => nr.purgeRecovered('j'), /desktop app/i);
  assert.equal(s.calls.length, 0);
});
