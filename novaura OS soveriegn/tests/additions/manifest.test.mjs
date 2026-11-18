import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, localManifest, FORMAT, API_VERSION, PERMISSIONS } from '../../src/services/additions/manifest.js';

const sample = () => ({
  format: 'novapp/1',
  id: '3fa9c1d2.habit-tracker',
  name: 'Habit Tracker',
  version: '1.2.0',
  apiVersion: 1,
  entry: 'index.html',
  icon: 'icon.png',
  description: 'Track habits.',
  permissions: ['ai', 'notifications'],
  network: ['https://api.weather.gov'],
  publisher: { name: 'Dillan', pub: 'ab'.repeat(32) },
  source: { kind: 'cybeni', url: '', license: 'MIT' },
  files: { 'index.html': 'cd'.repeat(32) },
});

const rejects = (patch, field) => {
  const r = validateManifest({ ...sample(), ...patch });
  assert.equal(r.ok, false, `${field} should be refused`);
  assert.ok(r.errors.some((e) => e.includes(field)), `no error names ${field}: ${r.errors.join('; ')}`);
};

test("the spec's sample manifest is valid", () => {
  const r = validateManifest(sample());
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.deepEqual(r.errors, []);
  assert.equal(r.manifest.name, 'Habit Tracker');
  assert.deepEqual(r.manifest.network, ['https://api.weather.gov']);
  assert.equal(FORMAT, 'novapp/1');
  assert.equal(API_VERSION, 1);
  assert.deepEqual(PERMISSIONS, ['ai', 'notifications', 'files']);
});

test('a manifest of another format is refused', () => rejects({ format: 'novapp-v1' }, 'format'));
test('a malformed id is refused', () => rejects({ id: 'Habit Tracker' }, 'id'));
test('a version that is not semver is refused', () => rejects({ version: '1.2' }, 'version'));
test('apiVersion 2 is refused', () => rejects({ apiVersion: 2 }, 'apiVersion'));
test('an unknown permission is refused', () => rejects({ permissions: ['ai', 'camera'] }, 'camera'));
test('an http: origin is refused', () => rejects({ network: ['http://api.weather.gov'] }, 'http://api.weather.gov'));
test('a localhost origin is refused', () => rejects({ network: ['https://localhost:1234'] }, 'https://localhost:1234'));
test('an entry containing .. is refused', () => rejects({ entry: '../index.html' }, 'entry'));

test('a local manifest has no permissions, no network and no publisher, and is valid', () => {
  const m = localManifest({ slug: 'habit-tracker', name: 'Habit Tracker' });
  assert.equal(m.id, 'local.habit-tracker');
  assert.equal(m.version, '1.0.0');
  assert.equal(m.apiVersion, 1);
  assert.equal(m.entry, 'index.html');
  assert.equal(m.publisher, null);
  assert.deepEqual(m.files, {});
  assert.deepEqual(m.permissions, []);
  assert.deepEqual(m.network, []);
  assert.equal(m.source.kind, 'cybeni');
  assert.equal(validateManifest(m).ok, true, validateManifest(m).errors.join('; '));
  assert.equal(localManifest({ slug: 'x-2', name: 'X', kind: 'forge' }).source.kind, 'forge');
});
