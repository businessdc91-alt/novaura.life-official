import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactValue, shapeOf, redactFinding } from '../../src/services/sentinel/redaction.js';

test('a hex key, a bearer token, a JWT and a long base64 blob are all redacted', () => {
  const secrets = [
    'deadbeef'.repeat(8), // 64 hex
    'Bearer sk-abc123xyz789',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpMeJf36P',
    'TWFu'.repeat(20), // 80-char base64-ish blob
  ];
  for (const s of secrets) assert.equal(redactValue(s), '[redacted]', s);
});

test('an email and a record body are redacted', () => {
  assert.equal(redactValue('jane.doe@example.com'), '[redacted]');
  const record = { id: 1, email: 'a@b.com', name: 'Jane', phone: '555', addr: 'x', city: 'y', zip: 'z', country: 'q', createdAt: 123 };
  const r = redactValue(record);
  assert.equal(typeof r, 'string');
  assert.ok(r.startsWith('[redacted]'));
  assert.ok(!r.includes('a@b.com') && !r.includes('Jane'));
});

test('a response body nested in proof is replaced with its shape', () => {
  const body = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`f${i}`, `secret-value-${i}`]));
  const proof = { status: 200, headerNames: ['content-type'], body };
  const r = redactValue(proof);
  assert.equal(r.status, 200);
  assert.deepEqual(r.headerNames, ['content-type']);
  assert.equal(typeof r.body, 'string');
  assert.ok(r.body.includes('object: 14 fields'));
  assert.ok(!r.body.includes('secret-value'));
});

test('an object of unknown shape is redacted, not passed through', () => {
  const unknown = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, `sensitive-${i}`]));
  const r = redactValue(unknown);
  assert.equal(typeof r, 'string');
  assert.ok(r.startsWith('[redacted]'));
  assert.ok(!r.includes('sensitive-'));
  assert.equal(shapeOf(unknown), 'object: 12 fields');
});

test('status codes, header names and the fix text survive', () => {
  const v = { status: 404, headerNames: ['content-security-policy', 'x-frame-options'], method: 'GET', statusText: 'Not Found' };
  assert.deepEqual(redactValue(v), v);
  const f = redactFinding({ checkId: 'x', fix: 'Add a Content-Security-Policy header.', proof: {} });
  assert.equal(f.fix, 'Add a Content-Security-Policy header.');
});

test('redactFinding leaves vector and fix but strips proof', () => {
  const finding = {
    checkId: 'echo', severity: 'info', vector: 'GET /', fix: 'do x', reproduce: 'curl /',
    proof: { body: 'deadbeef'.repeat(8) }, where: { email: 'a@b.com' },
  };
  const r = redactFinding(finding);
  assert.equal(r.vector, 'GET /');
  assert.equal(r.fix, 'do x');
  assert.equal(r.severity, 'info');
  assert.equal(r.checkId, 'echo');
  assert.equal(r.reproduce, 'curl /');
  assert.equal(r.proof.body, '[redacted]');
  assert.equal(r.where.email, '[redacted]');
});

test('short high-entropy secrets and PII are redacted (deny-by-default)', () => {
  const secrets = [
    'AKIAIOSFODNN7EXAMPLE',                   // AWS access key id (20 chars, no separators)
    '4111-1111-1111-1111',                    // credit-card number
    '555-867-5309',                           // phone number
    '550e8400-e29b-41d4-a716-446655440000',   // UUID (token/session shape)
    'Password123',
    'abc123def456',
    'ABCD-1234-EFGH-5678-IJKL-9012',          // segmented license / API key
  ];
  for (const s of secrets) assert.equal(redactValue(s), '[redacted]', s);
});

test('legitimate safe tokens still survive the stricter classifier', () => {
  for (const s of ['content-type', 'x-frame-options', 'content-security-policy', 'strict-transport-security',
                   'GET', 'POST', 'OK', 'Not Found', 'Internal Server Error', 'index.html', 'app.js',
                   'assets/logo.png', 'date', 'etag', 'server']) {
    assert.equal(redactValue(s), s, s);
  }
});
