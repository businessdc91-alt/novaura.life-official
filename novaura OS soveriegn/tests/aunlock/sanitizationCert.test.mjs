import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizationMethodFor, buildCert, certHash } from '../../src/services/aunlock/sanitizationCert.js';

const args = (extra = {}) => ({
  job: { id: 'job_1' },
  device: { serial: 'SN123', model: 'Latitude E6420', kind: 'laptop' },
  provenance: { authorization: 'manifest #7' },
  method: 'clear',
  startedAt: 1,
  finishedAt: 2,
  operator: 'Dillan',
  now: () => 9,
  ...extra,
});

test('an SSD gets purge and a hard drive gets clear', () => {
  assert.equal(sanitizationMethodFor({ specs: { storage: '256GB SSD' } }), 'purge');
  assert.equal(sanitizationMethodFor({ specs: { storage: '1TB NVMe' } }), 'purge');
  assert.equal(sanitizationMethodFor({ specs: { storage: '500GB HDD' } }), 'clear');
  assert.equal(sanitizationMethodFor({ specs: {} }), 'clear');
});

test('a cert names method, device serial, operator and the authorization', () => {
  const c = buildCert(args());
  assert.equal(c.jobId, 'job_1');
  assert.equal(c.method, 'clear');
  assert.equal(c.device.serial, 'SN123');
  assert.equal(c.operator, 'Dillan');
  assert.equal(c.authorization, 'manifest #7');
});

test('the hash covers the body so a changed field is detectable', () => {
  const c = buildCert(args());
  const { hash, ...body } = c;
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(certHash(body), hash);
  assert.notEqual(certHash({ ...body, method: 'purge' }), hash);
  assert.notEqual(certHash({ ...body, authorization: 'tampered' }), hash);
});

test('the standard line is NIST SP 800-88 Rev.1', () => {
  assert.equal(buildCert(args()).standard, 'NIST SP 800-88 Rev.1');
});
