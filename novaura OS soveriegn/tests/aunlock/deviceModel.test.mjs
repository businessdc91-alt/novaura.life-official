import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceRecord } from '../../src/services/aunlock/deviceModel.js';

test('a laptop with a BIOS lock is classified laptop/bios', () => {
  const d = deviceRecord({ jobId: 'j', id: 'dev_1', raw: { kind: 'laptop', lock: 'bios', serial: 'ABC', model: 'Latitude E6420' } });
  assert.equal(d.id, 'dev_1');
  assert.equal(d.jobId, 'j');
  assert.equal(d.kind, 'laptop');
  assert.equal(d.lockState, 'bios');
  assert.equal(d.serial, 'ABC');
  assert.equal(d.model, 'Latitude E6420');
  assert.equal(typeof d.updatedAt, 'number');
});

test('an account-locked phone is phone/account', () => {
  const d = deviceRecord({ jobId: 'j', id: 'dev_2', raw: { kind: 'phone', lock: 'account' } });
  assert.equal(d.kind, 'phone');
  assert.equal(d.lockState, 'account');
});

test('an unrecognised kind or lock is recorded as unknown, not guessed', () => {
  const d = deviceRecord({ jobId: 'j', id: 'dev_3', raw: { kind: 'router', lock: 'fingerprint' } });
  assert.equal(d.kind, 'unknown');
  assert.equal(d.lockState, 'unknown');
  const e = deviceRecord({ jobId: 'j', id: 'dev_4', raw: {} });
  assert.equal(e.kind, 'unknown');
  assert.equal(e.lockState, 'unknown');
});

test('specs are carried through verbatim', () => {
  const d = deviceRecord({ jobId: 'j', id: 'dev_5', raw: { kind: 'laptop', ram: '8GB', cpu: 'i5-2520M', storage: '256GB SSD', battery: '72%' } });
  assert.equal(d.specs.ram, '8GB');
  assert.equal(d.specs.cpu, 'i5-2520M');
  assert.equal(d.specs.storage, '256GB SSD');
  assert.equal(d.specs.battery, '72%');
});

test('systemDisk, bus, removable and nativeId pass through (systemDisk not defaulted to false)', () => {
  const d = deviceRecord({ jobId: 'j', id: 'dev_6', raw: { kind: 'drive', systemDisk: false, bus: 'USB', removable: true, nativeId: 'n1' } });
  assert.equal(d.systemDisk, false);
  assert.equal(d.bus, 'USB');
  assert.equal(d.removable, true);
  assert.equal(d.nativeId, 'n1');
  // An unclassified device must NOT read as a safe (false) system disk — deny-by-default.
  const u = deviceRecord({ jobId: 'j', id: 'dev_7', raw: { kind: 'drive' } });
  assert.notEqual(u.systemDisk, false);
});
