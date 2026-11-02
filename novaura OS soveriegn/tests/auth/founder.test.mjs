// Founder authority comes only from a signed license with a founder tier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { licenseAuthority } from '../../src/services/founderLicense.js';

const stub = (result) => () => result;

test('only signed founder-tier licenses grant founder authority', () => {
  assert.equal(licenseAuthority('NOVA-FOUNDER-GENESIS-7777'), null, 'the old hard-coded key is not a license');
  assert.equal(licenseAuthority('FOUNDER-KEY-ABC123-XYZ'), null, 'old locally minted keys prove nothing');
  assert.equal(licenseAuthority('NOVA1.e30.AAAA'), null, 'a forged token fails the signature check');
  assert.equal(licenseAuthority('x', null, stub({ valid: true, tier: 'FOUNDER_SOVEREIGN' })).tier, 'founder');
  assert.equal(licenseAuthority('x', null, stub({ valid: true, tier: 'council' })).tier, 'council');
  assert.equal(licenseAuthority('x', null, stub({ valid: true, tier: 'PRO_SOVEREIGN' })).tier, 'operator');
  assert.equal(licenseAuthority('x', null, stub({ valid: false, tier: 'FOUNDER_SOVEREIGN' })), null);
});
