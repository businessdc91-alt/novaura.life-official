import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRecoverableVolume } from '../../src/services/aunlock/volumeRules.js';

const ok = { driveLetter: 'E', fsType: 'NTFS', encrypted: false, readable: true };

test('readable unencrypted NTFS/exFAT/FAT32/FAT volumes are recoverable', () => {
  for (const fsType of ['NTFS', 'exFAT', 'FAT32', 'FAT', ' ntfs ']) {
    assert.equal(isRecoverableVolume({ ...ok, fsType }), true, fsType);
  }
});

test('encrypted, unreadable, unknown-fs and missing-field volumes are not (deny by default)', () => {
  assert.equal(isRecoverableVolume({ ...ok, encrypted: true }), false);
  assert.equal(isRecoverableVolume({ ...ok, readable: false }), false);
  assert.equal(isRecoverableVolume({ ...ok, fsType: 'ext4' }), false);
  assert.equal(isRecoverableVolume({ ...ok, fsType: null }), false);
  assert.equal(isRecoverableVolume({ driveLetter: 'E', fsType: 'NTFS' }), false);
});

test('missing or non-boolean encrypted/readable is NOT recoverable, and null volumes do not throw', () => {
  assert.equal(isRecoverableVolume({ driveLetter: 'E', fsType: 'NTFS', readable: true }), false);
  assert.equal(isRecoverableVolume({ ...ok, encrypted: null }), false);
  assert.equal(isRecoverableVolume({ ...ok, encrypted: 0 }), false);
  assert.equal(isRecoverableVolume({ driveLetter: 'E', fsType: 'NTFS', encrypted: false }), false);
  assert.equal(isRecoverableVolume({ ...ok, readable: 1 }), false);
  assert.equal(isRecoverableVolume(null), false);
  assert.equal(isRecoverableVolume(undefined), false);
});
