import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLauncherVisible } from '../../src/config/launcherVisibility.js';

const aunlock = { id: 'aunlock', label: 'Aunlock Nova', title: 'Aunlock Nova — Refurbisher Suite', category: 'system', hidden: true, terminalOnly: true };
const founder = { id: 'founder', label: "Founder's Office", title: "Founder's Office Suite", category: 'system', hidden: true };
const normal = { id: 'files', label: 'Files', title: 'Storage Explorer', category: 'core' };

test('a terminal-only app never appears in the launcher, even on an exact name search', () => {
  assert.equal(isLauncherVisible(aunlock, 'aunlock', 'all'), false);
  assert.equal(isLauncherVisible(aunlock, 'nova', 'all'), false);
  assert.equal(isLauncherVisible(aunlock, '', 'all'), false);
  assert.equal(isLauncherVisible(aunlock, '', 'system'), false);
});

test('a soft-hidden app is still findable by name search', () => {
  assert.equal(isLauncherVisible(founder, 'founder', 'all'), true);
  assert.equal(isLauncherVisible(founder, '', 'all'), false);
});

test('a normal app shows by category and search as before', () => {
  assert.equal(isLauncherVisible(normal, '', 'all'), true);
  assert.equal(isLauncherVisible(normal, 'files', 'all'), true);
  assert.equal(isLauncherVisible(normal, 'files', 'creator'), false);
  assert.equal(isLauncherVisible(normal, 'zzz', 'all'), false);
});
