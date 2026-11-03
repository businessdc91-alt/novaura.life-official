// mediaLibrary.js — What the Media Deck plays: NovAura's built-in album
// (public/music/originals), the Music Studio library (songs made there and
// audio imported anywhere) and imported videos.
//
// Audio lands in music_tracks + media_blobs, the same records Music Studio
// writes, so both apps show one library. Videos go in media_library with their
// bytes in media_blobs.

import { db } from '../../database/sovereignDatabase.js';
import { mimeForName } from '../fileStorageService.js';
import { readId3, mp3Duration, titleFromFileName, TAG_READ_BYTES } from './audioTags.js';

export const AUDIO_EXT = /\.(mp3|wav|ogg|oga|opus|flac|m4a|aac|weba)$/i;
export const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv)$/i;

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const ORIGINALS_DIR = `${BASE}music/originals/`;

const newId = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const emit = () => window.dispatchEvent(new CustomEvent('novaura:music_updated'));

/** 'audio', 'video' or null for anything the Deck cannot play. */
export function mediaKind(file) {
  const type = file?.type || '';
  if (type.startsWith('audio/') || AUDIO_EXT.test(file?.name || '')) return 'audio';
  if (type.startsWith('video/') || VIDEO_EXT.test(file?.name || '')) return 'video';
  return null;
}

let originalsPromise = null;
/** The built-in album, read once from originals.json. */
export function loadOriginals() {
  originalsPromise ||= fetch(`${ORIGINALS_DIR}originals.json`)
    .then(r => (r.ok ? r.json() : { tracks: [] }))
    .then(({ album, tracks }) => (tracks || []).map(t => ({
      key: t.id,
      source: 'original',
      mediaType: 'audio',
      title: t.title,
      artist: t.artist,
      album: album || t.album,
      seconds: t.seconds,
      url: ORIGINALS_DIR + t.file,
      coverUrl: t.cover ? ORIGINALS_DIR + t.cover : null,
      sourceKey: t.sourceName ? `${t.sourceName}:${t.size}` : null,
    })))
    .catch(() => { originalsPromise = null; return []; });
  return originalsPromise;
}

const studioItem = (t) => ({
  key: t.id,
  source: 'studio',
  mediaType: 'audio',
  title: t.title,
  artist: t.artist || (t.imported ? '' : 'Music Studio'),
  album: t.album || '',
  seconds: t.seconds || 0,
  blobId: t.audioBlobId,
  coverBlobId: t.coverBlobId || null,
  imported: Boolean(t.imported),
  createdAt: t.createdAt || 0,
});

const videoItem = (v) => ({
  key: v.id,
  source: 'video',
  mediaType: 'video',
  title: v.title,
  artist: v.artist || '',
  album: '',
  seconds: v.duration || 0,
  blobId: v.blobId,
  coverBlobId: null,
  createdAt: v.createdAt || 0,
});

// Older Media Deck versions saved blob: links (dead after a restart) and
// "generated" songs that were a stock stream under a made-up title.
async function dropBrokenRows() {
  await db.media_library.filter(r => !r.blobId).delete().catch(() => {});
}

/** { originals, music, videos } — newest first within each group. */
export async function listLibrary() {
  await dropBrokenRows();
  const [originals, tracks, videos] = await Promise.all([
    loadOriginals(),
    db.music_tracks.toArray().catch(() => []),
    db.media_library.toArray().catch(() => []),
  ]);
  return {
    originals,
    music: tracks.filter(t => t.audioBlobId).sort((a, b) => b.createdAt - a.createdAt).map(studioItem),
    videos: videos.sort((a, b) => b.createdAt - a.createdAt).map(videoItem),
  };
}

/** The bytes to play for a library item. */
export async function mediaBlob(item) {
  if (item.blob) return item.blob;
  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`Could not load ${item.title}`);
    return res.blob();
  }
  const row = item.blobId ? await db.media_blobs.get(item.blobId) : null;
  if (!row?.blob) throw new Error(`${item.title} is missing its audio. Import the file again.`);
  return row.blob;
}

export async function coverBlob(blobId) {
  return blobId ? (await db.media_blobs.get(blobId))?.blob || null : null;
}

// Length from the media element when the format has no header we can read.
function probeDuration(blob, kind) {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    const url = URL.createObjectURL(blob);
    const done = (s) => { URL.revokeObjectURL(url); el.removeAttribute('src'); resolve(Number.isFinite(s) ? s : 0); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    el.src = url;
  });
}

// Files already in the library, built-in album included, as "name:size".
async function knownSources() {
  const [originals, tracks, videos] = await Promise.all([loadOriginals(), db.music_tracks.toArray().catch(() => []), db.media_library.toArray().catch(() => [])]);
  return new Set([...originals, ...tracks, ...videos].map(r => r.sourceKey).filter(Boolean));
}

async function importAudio(file, sourceKey) {
  const type = file.type || mimeForName(file.name);
  const blob = file.slice(0, file.size, type);
  const tags = readId3(new Uint8Array(await file.slice(0, TAG_READ_BYTES).arrayBuffer())) || {};
  let seconds = /mpeg|mp3/.test(type) ? mp3Duration(new Uint8Array(await file.arrayBuffer())) : 0;
  if (!seconds) seconds = await probeDuration(blob, 'audio');

  const audioBlobId = newId('audio');
  let coverBlobId = null;
  await db.media_blobs.put({ id: audioBlobId, kind: 'audio', blob, createdAt: Date.now() });
  if (tags.picture) {
    coverBlobId = newId('cover');
    await db.media_blobs.put({ id: coverBlobId, kind: 'cover', blob: new Blob([tags.picture.data], { type: tags.picture.mime }), createdAt: Date.now() });
  }
  const track = {
    id: newId('trk'),
    title: tags.title || titleFromFileName(file.name),
    artist: tags.artist || tags.albumArtist || '',
    album: tags.album || '',
    spec: { mode: 'song', genre: tags.genre || '', era: tags.year || '', moods: [] },
    tags: '', lyrics: '', model: 'imported', seed: 0,
    seconds: Math.round(seconds * 10) / 10,
    audioBlobId, audioMime: type, coverBlobId,
    albumId: null, liked: 0, published: 0, imported: true,
    sourceKey, createdAt: Date.now(),
  };
  await db.music_tracks.put(track);
  return studioItem(track);
}

async function importVideo(file, sourceKey) {
  const type = file.type || mimeForName(file.name);
  const blob = file.slice(0, file.size, type);
  const blobId = newId('video');
  await db.media_blobs.put({ id: blobId, kind: 'video', blob, createdAt: Date.now() });
  const row = {
    id: newId('vid'),
    title: titleFromFileName(file.name),
    artist: '',
    mediaType: 'video',
    duration: Math.round((await probeDuration(blob, 'video')) * 10) / 10,
    blobId, mime: type, size: file.size,
    sourceKey, createdAt: Date.now(),
  };
  await db.media_library.put(row);
  return videoItem(row);
}

/**
 * Copy files (File objects from a picker, a folder or a drop) into the library.
 * Files already imported (same name and size) and non-media files are skipped.
 * onProgress({ done, total, name })
 */
export async function importMediaFiles(files, { onProgress } = {}) {
  const list = Array.from(files || []);
  const known = await knownSources();
  const added = [];
  const skipped = [];
  const failed = [];
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    onProgress?.({ done: i, total: list.length, name: file.name });
    const kind = mediaKind(file);
    if (!kind) { skipped.push({ name: file.name, reason: 'not audio or video' }); continue; }
    const sourceKey = `${file.name}:${file.size}`;
    if (known.has(sourceKey)) { skipped.push({ name: file.name, reason: 'already in the library' }); continue; }
    try {
      added.push(kind === 'audio' ? await importAudio(file, sourceKey) : await importVideo(file, sourceKey));
      known.add(sourceKey);
    } catch (err) {
      failed.push({ name: file.name, reason: err?.name === 'QuotaExceededError' ? 'out of storage space' : (err?.message || 'could not be saved') });
    }
  }
  onProgress?.({ done: list.length, total: list.length, name: '' });
  if (added.length) emit();
  return { added, skipped, failed };
}

/** Remove one of the user's own items (built-in tracks cannot be removed). */
export async function deleteLibraryItem(item) {
  if (item.source === 'studio') {
    const t = await db.music_tracks.get(item.key);
    if (!t) return;
    const sharedCover = t.coverBlobId && (await db.music_tracks.filter(x => x.id !== t.id && x.coverBlobId === t.coverBlobId).count()) > 0;
    await db.media_blobs.bulkDelete([t.audioBlobId, sharedCover ? null : t.coverBlobId].filter(Boolean));
    await db.music_tracks.delete(t.id);
    if (t.albumId) {
      const album = await db.music_albums.get(t.albumId);
      if (album) await db.music_albums.update(album.id, { order: (album.order || []).filter(x => x !== t.id) });
    }
  } else if (item.source === 'video') {
    const v = await db.media_library.get(item.key);
    if (!v) return;
    if (v.blobId) await db.media_blobs.delete(v.blobId);
    await db.media_library.delete(v.id);
  } else {
    return;
  }
  emit();
}
