// Media Deck import: ID3 tags, cover art and MP3 length.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readId3, mp3Duration, titleFromFileName } from '../../src/services/media/audioTags.js';

const latin1 = (s) => [...s].map(c => c.charCodeAt(0));
const utf16 = (s) => [0xff, 0xfe, ...[...s].flatMap(c => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8])];
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const syncsafe = (n) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];

function tag(version, frames) {
  const body = frames.flatMap(([id, payload]) => {
    if (version === 2) return [...latin1(id), (payload.length >> 16) & 255, (payload.length >> 8) & 255, payload.length & 255, ...payload];
    return [...latin1(id), ...(version === 4 ? syncsafe(payload.length) : be32(payload.length)), 0, 0, ...payload];
  });
  const padded = [...body, ...new Array(64).fill(0)];
  return new Uint8Array([...latin1('ID3'), version, 0, 0, ...syncsafe(padded.length), ...padded]);
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4];

test('reads ID3v2.3 text in Latin-1 and UTF-16, and the front cover', () => {
  const t = readId3(tag(3, [
    ['TIT2', [1, ...utf16('Neon Petals Riot')]],
    ['TPE1', [0, ...latin1('lostitonce420')]],
    ['TALB', [0, ...latin1('Clockwork')]],
    ['TCON', [0, ...latin1('(17)Rock')]],
    ['TRCK', [0, ...latin1('3/12')]],
    ['APIC', [0, ...latin1('image/png'), 0, 0, 0, 1, 2, 3]], // "other" picture first
    ['APIC', [0, ...latin1('image/jpeg'), 0, 3, ...latin1('cover'), 0, ...JPEG]],
  ]));
  assert.equal(t.title, 'Neon Petals Riot');
  assert.equal(t.artist, 'lostitonce420');
  assert.equal(t.album, 'Clockwork');
  assert.equal(t.genre, 'Rock');
  assert.equal(t.track, 3);
  assert.equal(t.picture.mime, 'image/jpeg');
  assert.deepEqual([...t.picture.data], JPEG);
});

test('reads ID3v2.4 (UTF-8, syncsafe sizes) and ID3v2.2', () => {
  const v4 = readId3(tag(4, [['TIT2', [3, ...new TextEncoder().encode('Café Sôlo')]], ['TDRC', [3, ...latin1('2026-02-09')]]]));
  assert.equal(v4.title, 'Café Sôlo');
  assert.equal(v4.year, '2026');
  const v2 = readId3(tag(2, [['TT2', [0, ...latin1('Old Tag')]], ['PIC', [0, ...latin1('PNG'), 3, 0, 9, 9]]]));
  assert.equal(v2.title, 'Old Tag');
  assert.equal(v2.picture.mime, 'image/png');
  assert.deepEqual([...v2.picture.data], [9, 9]);
});

test('files without a tag, or junk, give null instead of throwing', () => {
  assert.equal(readId3(new Uint8Array([0xff, 0xfb, 0x90, 0x00])), null);
  assert.equal(readId3(new Uint8Array(3)), null);
  const truncated = tag(3, [['TIT2', [0, ...latin1('Cut short')]]]).subarray(0, 18);
  assert.doesNotThrow(() => readId3(truncated));
});

test('MP3 length comes from walking the frames', () => {
  // 100 MPEG-1 Layer III frames, 128 kbps, 44.1 kHz: 417 bytes each without padding.
  const frame = new Uint8Array(417);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  const bytes = new Uint8Array(417 * 100 + 10);
  for (let i = 0; i < 100; i++) bytes.set(frame, i * 417);
  assert.ok(Math.abs(mp3Duration(bytes) - (100 * 1152) / 44100) < 1e-9);
  // After a tag, too.
  const withTag = new Uint8Array([...tag(3, [['TIT2', [0, 65]]]), ...bytes]);
  assert.ok(Math.abs(mp3Duration(withTag) - (100 * 1152) / 44100) < 1e-9);
  assert.equal(mp3Duration(new Uint8Array(100)), 0);
});

test('a bundled NovAura track: tags and length match what Windows reports', { skip: !existsSync('public/music/originals/vibe-in-the-static.mp3') }, () => {
  const bytes = new Uint8Array(readFileSync('public/music/originals/vibe-in-the-static.mp3'));
  const t = readId3(bytes);
  assert.equal(t.title, 'Vibe in the Static');
  assert.equal(t.picture.mime, 'image/jpeg');
  const secs = mp3Duration(bytes);
  assert.ok(secs > 244.5 && secs < 246, `got ${secs}`); // Explorer: 4:05
});

test('titles from file names', () => {
  assert.equal(titleFromFileName('03 - Neon_Petals_Riot.mp3'), 'Neon Petals Riot');
  assert.equal(titleFromFileName('Steam, Sparks, and Screens.mp3'), 'Steam, Sparks, and Screens');
  assert.equal(titleFromFileName('.mp3'), 'Untitled');
});
