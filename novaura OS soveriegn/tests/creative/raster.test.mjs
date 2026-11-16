// Raster export limits and where dropped files go.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { createDocument } from '../../src/creative/document.js';
import { classifyDrop, exportRaster } from '../../src/creative/io/raster.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const file = (name, type = '') => ({ name, type });

test('classifyDrop routes psd/novaart to open, images by target, others to reject', () => {
  const files = [file('a.psd'), file('b.novaart'), file('c.png', 'image/png'), file('d.JPG'), file('e.svg', 'image/svg+xml'), file('notes.txt', 'text/plain'), file('song.mp3', 'audio/mpeg')];
  assert.deepEqual(classifyDrop('canvas', files).map(d => [d.file.name, d.action]), [
    ['a.psd', 'open'], ['b.novaart', 'open'], ['c.png', 'place'], ['d.JPG', 'place'], ['e.svg', 'place'], ['notes.txt', 'reject'], ['song.mp3', 'reject'],
  ]);
  assert.deepEqual(classifyDrop('tabs', files).map(d => d.action), ['open', 'open', 'open', 'open', 'open', 'reject', 'reject']);
});

test('scale past the limit is refused', async () => {
  const doc = createDocument({ width: 9000, height: 10 });
  await assert.rejects(exportRaster(doc, { type: 'image/png', scale: 2 }), /That scale would make the image larger than 16384 px\./);
});
