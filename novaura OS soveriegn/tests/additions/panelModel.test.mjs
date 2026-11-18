import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeAddition, formatBytes, PERMISSION_LABELS, QUOTA_CHOICES } from '../../src/services/additions/panelModel.js';
import { localManifest } from '../../src/services/additions/manifest.js';

const base = (extra = {}) => ({
  id: 'user_notes', slug: 'notes', name: 'Notes',
  manifest: localManifest({ slug: 'notes', name: 'Notes' }),
  grants: { permissions: [], network: [] }, requested: { network: [] },
  legacy: false, legacyNotes: [], quotaBytes: 1024 ** 3,
  ...extra,
});

test('a moved app shows as added before permissions with no permissions', () => {
  const d = describeAddition(base({ legacy: true }), 0);
  assert.equal(d.title, 'Notes');
  assert.equal(d.version, '1.0.0');
  assert.equal(d.publisher, 'Made on this computer');
  assert.equal(d.legacy, true);
  assert.deepEqual(d.permissions, []);
  assert.deepEqual(d.network, []);
  assert.deepEqual(d.notes, []);
});

test('declared and blocked origins are both listed, with their grants', () => {
  const manifest = { ...localManifest({ slug: 'notes', name: 'Notes' }), permissions: ['ai', 'files'], network: ['https://api.weather.gov'] };
  const d = describeAddition(base({
    manifest,
    grants: { permissions: ['files'], network: ['https://maps.example.com'] },
    requested: { network: ['https://maps.example.com', 'https://api.weather.gov'] },
  }), 0);
  assert.deepEqual(d.network, [
    { origin: 'https://api.weather.gov', granted: false, declared: true },
    { origin: 'https://maps.example.com', granted: true, declared: false },
  ]);
  assert.deepEqual(d.permissions, [
    { id: 'ai', label: 'Use your AI model on this computer', granted: false },
    { id: 'files', label: 'Open and save files you choose', granted: true },
  ]);
  assert.equal(PERMISSION_LABELS.notifications, 'Send you notifications');
});

test('usage and quota read in plain units', () => {
  const d = describeAddition(base({ quotaBytes: 5 * 1024 ** 3 }), 1.5 * 1024 ** 2);
  assert.equal(d.usage, '1.5 MB');
  assert.equal(d.quota, '5 GB');
  assert.equal(d.usageBytes, 1.5 * 1024 ** 2);
  assert.equal(d.quotaBytes, 5 * 1024 ** 3);
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(20 * 1024 ** 2), '20 MB');
  assert.equal(formatBytes(1024 ** 3), '1 GB');
  assert.deepEqual(QUOTA_CHOICES, [1, 2, 5, 10, 50].map((g) => g * 1024 ** 3));
});

test('the browser-database note appears only when flagged', () => {
  assert.deepEqual(describeAddition(base({ legacy: true }), 0).notes, []);
  assert.deepEqual(describeAddition(base({ legacy: true, legacyNotes: ['browser-database'] }), 0).notes, [
    "This app used a browser database, which additions can't keep. Its saved data there was not moved.",
  ]);
});

test('a publisher is named, and an app with no manifest yet still describes', () => {
  const signed = { ...localManifest({ slug: 'x', name: 'X' }), publisher: { name: 'Ada', pub: 'ab'.repeat(32) }, version: '2.1.0' };
  const d = describeAddition(base({ manifest: signed }), 0);
  assert.equal(d.publisher, 'Ada');
  assert.equal(d.version, '2.1.0');
  const bare = describeAddition(base({ manifest: null }), 10);
  assert.equal(bare.version, '1.0.0');
  assert.deepEqual(bare.permissions, []);
});
