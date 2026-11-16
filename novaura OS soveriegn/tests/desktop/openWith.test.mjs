// "Open with": which apps a vault file offers, and the Creative Studio handoff.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const opened = [];
mock.module(new URL('../../src/services/desktopActions.js', import.meta.url).href, {
  namedExports: {
    openWindow: (appId, props) => opened.push({ appId, props }),
    openCybeniProject: () => {},
    openInFiles: () => {},
    parentOf: p => p.split('/').slice(0, -1).join('/') || '/',
  },
});
mock.module(new URL('../../src/services/fileStorageService.js', import.meta.url).href, {
  namedExports: { downloadFile: () => {}, extractZip: () => {} },
});
globalThis.window = { dispatchEvent: () => true };

const { openWithOptions, defaultOpen, fileKind } = await import('../../src/services/openWith.js');

const file = (name, mimeType = '') => ({ id: `id-${name}`, type: 'file', name, path: `/Pictures/${name}`, parentPath: '/Pictures', mimeType });

test('PSD and .novaart files are design files, even with an image mime type', () => {
  assert.equal(fileKind(file('poster.psd', 'image/vnd.adobe.photoshop')), 'design');
  assert.equal(fileKind(file('poster.novaart', 'application/x-novaart')), 'design');
  assert.equal(fileKind(file('photo.png', 'image/png')), 'image');
});

test('openWithOptions(psd) first option is creative_studio', () => {
  for (const name of ['poster.psd', 'poster.novaart']) {
    const [first] = openWithOptions(file(name));
    assert.equal(first.id, 'creative_studio');
    assert.equal(first.label, 'Edit in Creative Studio');
    assert.equal(defaultOpen(file(name)).id, 'creative_studio', 'double-click opens the studio');
  }
});

test('images can be edited in the studio, but double-click still views them', () => {
  const opts = openWithOptions(file('photo.png'));
  assert.ok(opts.some(o => o.id === 'creative_studio'));
  assert.equal(defaultOpen(file('photo.png')).id, 'files');
  assert.equal(defaultOpen(file('photo.png'), { inFiles: true }), null);
});

test('Edit in Creative Studio hands the file over by id', () => {
  opened.length = 0;
  openWithOptions(file('poster.psd'))[0].run();
  assert.equal(opened[0].appId, 'creative_studio');
  assert.equal(opened[0].props.fileId, 'id-poster.psd');
  assert.ok(opened[0].props.openId);
});
