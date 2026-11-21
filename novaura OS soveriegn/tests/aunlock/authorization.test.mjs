import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provenanceRecord, canProceed } from '../../src/services/aunlock/authorization.js';

test('a provenance record with an authorization proceeds', () => {
  const p = provenanceRecord({ jobId: 'j', source: 'decommission lot', authorization: 'manifest #12', who: 'ACME Corp', operator: 'op', now: () => 5 });
  assert.equal(p.jobId, 'j');
  assert.equal(p.source, 'decommission lot');
  assert.equal(p.authorization, 'manifest #12');
  assert.equal(p.who, 'ACME Corp');
  assert.equal(p.operator, 'op');
  assert.equal(p.at, 5);
  assert.deepEqual(canProceed(p), { ok: true });
});

test('no provenance is refused', () => {
  assert.equal(canProceed(null).ok, false);
  assert.equal(canProceed(undefined).ok, false);
  assert.match(canProceed(null).reason, /authorization/i);
});

test('an empty or whitespace authorization is refused', () => {
  assert.equal(canProceed({ jobId: 'j', authorization: '' }).ok, false);
  assert.equal(canProceed({ jobId: 'j', authorization: '   ' }).ok, false);
  assert.equal(canProceed({ jobId: 'j' }).ok, false);
});
