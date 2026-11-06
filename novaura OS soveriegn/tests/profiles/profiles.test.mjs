// Profiles: what "Skip sign in" opens, profile badges, and the form's rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skipTarget, initials, profileFormProblem } from '../../src/services/profiles.js';

const main = { id: 'main', name: 'Main', hasPassword: false };
const kid = { id: 'p0123456789ab', name: 'Kid', hasPassword: false };
const locked = { id: 'pabcdefabcdef', name: 'Locked', hasPassword: true };

test('skip opens the last profile used, or main', () => {
  assert.equal(skipTarget({ profiles: [main, kid], lastUsed: 'p0123456789ab' }), kid);
  assert.equal(skipTarget({ profiles: [main, kid], lastUsed: 'gone' }), main);
  assert.equal(skipTarget({ profiles: [main, kid] }), main);
});

test('skip never opens a profile that has a password', () => {
  assert.equal(skipTarget({ profiles: [main, locked], lastUsed: 'pabcdefabcdef' }), null);
  assert.equal(skipTarget({ profiles: [{ ...main, hasPassword: true }] }), null);
  assert.equal(skipTarget(null), null);
});

test('badges use one or two letters', () => {
  assert.equal(initials('Dillan Copeland'), 'DC');
  assert.equal(initials('aura'), 'AU');
  assert.equal(initials('Nova Prime Star'), 'NS');
  assert.equal(initials('  '), '?');
});

test('the form checks names and passwords like the native side', () => {
  assert.equal(profileFormProblem({ name: 'Kid' }), null);
  assert.match(profileFormProblem({ name: ' ' }), /1 to 32/);
  assert.match(profileFormProblem({ name: 'x'.repeat(33) }), /1 to 32/);
  assert.match(profileFormProblem({ name: 'Kid', password: 'abc', confirm: 'abc' }), /4 to 128/);
  assert.match(profileFormProblem({ name: 'Kid', password: 'abcd', confirm: 'abce' }), /match/);
  assert.equal(profileFormProblem({ name: 'Kid', password: 'abcd', confirm: 'abcd' }), null);
});
