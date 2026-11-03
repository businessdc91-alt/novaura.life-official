// Copy NovAura's own tracks into the app as the Media Deck's built-in album.
//
//   node scripts/import-originals.mjs [source folder]
//
// Writes public/music/originals/<slug>.mp3, the cover art pulled from each
// track's tag (<slug>.jpg) and originals.json. Edit TRACKS to change the album;
// every track adds its size to the installer.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { readId3, mp3Duration, titleFromFileName } = await import(pathToFileURL(join(root, 'src/services/media/audioTags.js')).href);

const SOURCE = process.argv[2] || 'Z:/Aetherium_Master/Aetherium_Project/assets/audio/music';
const OUT = join(root, 'public/music/originals');
const ALBUM = 'NovAura Originals';
const TRACKS = [
  'Anthem for the Catalyst.mp3',
  'Clockwork Constellations.mp3',
  'Copper Sparks & Quantum Hearts.mp3',
  'Crimson Circuit Carnival.mp3',
  'Gypsy Crown of Glass.mp3',
  'Neon Petals superflow.mp3',
  'Steam, Sparks, and Screens.mp3',
  'Vibe in the Static.mp3',
];

const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const list = [];
let total = 0;
for (const name of TRACKS) {
  const bytes = new Uint8Array(readFileSync(join(SOURCE, name)));
  const tags = readId3(bytes) || {};
  const id = slug(name);
  copyFileSync(join(SOURCE, name), join(OUT, `${id}.mp3`));
  let cover = null;
  if (tags.picture) {
    cover = `${id}.${tags.picture.mime === 'image/png' ? 'png' : 'jpg'}`;
    writeFileSync(join(OUT, cover), tags.picture.data);
  }
  list.push({
    id: `original_${id}`,
    file: `${id}.mp3`,
    cover,
    title: tags.title || titleFromFileName(name),
    artist: tags.artist || 'NovAura',
    album: ALBUM,
    seconds: Math.round(mp3Duration(bytes) * 10) / 10,
    size: bytes.length,
    sourceName: name, // so importing the same file later is recognised as a duplicate
  });
  total += bytes.length;
}
writeFileSync(join(OUT, 'originals.json'), JSON.stringify({ album: ALBUM, tracks: list }, null, 2) + '\n');
console.log(`${list.length} tracks, ${(total / 1048576).toFixed(1)} MB -> ${OUT}`);
console.log(readdirSync(OUT).length, 'files written');
