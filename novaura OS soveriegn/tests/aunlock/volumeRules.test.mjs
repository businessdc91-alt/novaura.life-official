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
