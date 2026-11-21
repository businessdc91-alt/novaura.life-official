import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeDevices } from '../../src/services/aunlock/nativeDevices.js';

test('enumerate maps native specs to deviceModel raw blobs', async () => {
  const invoke = async () => ([{
    id: 'n1', kind: 'drive', model: 'WD', serial: 'S1', storage: '500GB',
    lock: 'none', bus: 'USB', removable: true, systemDisk: false, sizeBytes: 500107862016,
  }]);
  const nd = createNativeDevices({ invoke, isTauri: () => true });
  const raw = await nd.enumerate();
  assert.equal(raw.length, 1);
  assert.equal(raw[0].kind, 'drive');
  assert.equal(raw[0].serial, 'S1');
  assert.equal(raw[0].systemDisk, false);
  assert.equal(raw[0].nativeId, 'n1');
});

test('no devices → empty array, not an error', async () => {
  const nd = createNativeDevices({ invoke: async () => [], isTauri: () => true });
  assert.deepEqual(await nd.enumerate(), []);
});

test('outside the desktop app it refuses with a clear message', async () => {
  const nd = createNativeDevices({ invoke: async () => [], isTauri: () => false });
  await assert.rejects(() => nd.enumerate(), /desktop app/i);
});

test('a native failure surfaces, distinct from empty', async () => {
  const nd = createNativeDevices({
    invoke: async () => { throw new Error('powershell not found'); },
    isTauri: () => true,
  });
  await assert.rejects(() => nd.enumerate(), /powershell/i);
});
