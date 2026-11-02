// Pop-out windows: URL parsing and which UI events cross between windows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popoutAppId, popoutProps, forwardable, acceptable } from '../../src/services/popoutWindows.js';

function inWindow(search, hash = '') {
  globalThis.window = { location: { search, hash } };
}

test('main window: no popout app', () => {
  inWindow('');
  assert.equal(popoutAppId(), null);
});

test('popout window: app id and props from the URL', () => {
  const props = { path: '/Desktop/My Projects', select: 'a b' };
  inWindow('?popout=files', '#' + new URLSearchParams({ props: JSON.stringify(props) }));
  assert.equal(popoutAppId(), 'files');
  assert.deepEqual(popoutProps(), props);
  inWindow('?popout=files', '#props=%7Bbroken');
  assert.deepEqual(popoutProps(), {}, 'bad JSON falls back to no props');
});

test('main window shares state events, never commands', () => {
  inWindow('');
  assert.ok(forwardable('novaura:mesh_updated'));
  assert.ok(forwardable('novaura:fs_changed'));
  assert.ok(forwardable('novaura-theme'));
  assert.ok(!forwardable('novaura:files_open_path'));
  assert.ok(!forwardable('novaura-open-window'));
  // ...and runs commands that come from popouts.
  assert.ok(acceptable('novaura-open-window', 'popout'));
  assert.ok(acceptable('novaura:cybeni_open_project', 'popout'));
});

test('popouts send everything to the desktop but replay only state events', () => {
  inWindow('?popout=files');
  assert.ok(forwardable('novaura-open-window'));
  assert.ok(forwardable('novaura:cybeni_open_project'));
  assert.ok(acceptable('novaura:marketplace_updated', 'main'));
  assert.ok(acceptable('novaura:mail_received', 'popout'));
  assert.ok(!acceptable('novaura-open-window', 'popout'), 'another popout cannot open windows here');
  assert.ok(!acceptable('novaura:welcome_section', 'main'));
});
