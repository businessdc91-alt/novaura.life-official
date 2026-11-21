import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeConnectedDevices } from '../../src/services/aunlock/connectedPanel.js';

test('describeConnectedDevices marks the system disk unselectable', () => {
  const { rows } = describeConnectedDevices([
    { model: 'WD', serial: 'S1', kind: 'drive', systemDisk: false },
    { model: 'OS', serial: 'OS', kind: 'drive', systemDisk: true },
  ]);
  assert.equal(rows[0].selectable, true);
  assert.equal(rows[1].selectable, false);
});

test('a device that never classified its system-disk flag is not selectable (deny-by-default)', () => {
  const { rows } = describeConnectedDevices([{ model: 'Mystery', kind: 'drive' }]); // systemDisk undefined
  assert.equal(rows[0].selectable, false);
});

test('an empty list yields no rows (empty state)', () => {
  assert.deepEqual(describeConnectedDevices([]).rows, []);
  assert.deepEqual(describeConnectedDevices().rows, []);
});
