// musicStudio.js — Song generation, library, albums and publishing for Music Studio.
//
// Generation runs ACE-Step in the local ComfyUI engine. Lyrics, ideas and cover
// concepts come from a text model the user picks (by default the one Cybeni's
// auto-assign gives the architect, which on mixed setups runs on the CPU and so
// leaves the GPU to ComfyUI).

import { db } from '../../database/sovereignDatabase.js';
import { ensureComfyRunning, probeComfy, availableOptions, nodeInfo, requireNodes, runWorkflow, fetchOutput, uploadInput } from '../engines/comfyEngine.js';
import { warmModel } from '../engines/engineAutostart.js';
import { generateImage, coverPrompt } from '../engines/imageGen.js';
import { compose, offlineIdeas, DEFAULT_SPEC, GENRES, ERAS, MOODS, VOICES, LOOP_SCENES } from './musicCatalog.js';
import { decodeAudio, makeSeamlessLoop, wavBlob, durationOf } from './audioTools.js';
import { listCybeniModels, runModel, suggestRoles } from '../cybeni/models.js';
import { marketplacePublish } from '../marketplacePublishService.js';

const SETTINGS_KEY = 'music_studio_settings';
const id = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('novaura:music_updated'));
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function getMusicSettings() {
  const saved = await db.getSetting(SETTINGS_KEY, {}).catch(() => ({}));
  return { textModel: '', variations: 2, autoCover: true, ...saved };
}

export async function setMusicSettings(patch) {
  const next = { ...(await getMusicSettings()), ...patch };
  await db.setSetting(SETTINGS_KEY, next);
  return next;
}

async function textModel() {
  const s = await getMusicSettings();
  if (s.textModel) return s.textModel;
  const models = await listCybeniModels();
  return suggestRoles(models).architect || '';
}

async function askText(system, user, { maxTokens = 900, temperature = 0.9 } = {}) {
  const model = await textModel();
  if (!model) throw new Error('No text model is available. Start LM Studio or Ollama, or pick one in Music Studio settings.');
  return runModel(model, [{ role: 'system', content: system }, { role: 'user', content: user }], { maxTokens, temperature, scope: 'music' });
}

// ── AI helpers ─────────────────────────────────────────────────────────────

/** Write lyrics with [Verse]/[Chorus] section tags for a spec. */
export async function writeLyrics(spec, { sections, extra = '' } = {}) {
  const s = { ...DEFAULT_SPEC, ...spec };
  const text = await askText(
    'You are a professional songwriter. Write singable, original lyrics with vivid imagery and a memorable chorus. Use section tags in square brackets on their own lines, such as [Verse 1], [Chorus], [Bridge], [Outro]. Output only the lyrics.',
    [
      `Song: "${s.title || 'Untitled'}"`,
      `Genre: ${s.genre}, ${s.era}. Mood: ${s.moods.join(', ') || 'any'}.`,
      s.description ? `Theme: ${s.description}` : '',
      `Structure: ${(sections || []).join(', ') || s.structure}.`,
      `Language: ${s.language}.`,
      `Keep it to about ${Math.max(8, Math.round(s.seconds / 6))} lines so it fits ${Math.round(s.seconds)} seconds.`,
      extra,
    ].filter(Boolean).join('\n'),
  );
  return text.replace(/^```[a-z]*\n?|```$/g, '').trim();
}

function parseIdeas(text, mode) {
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  const list = JSON.parse(json);
  const genres = new Set(GENRES.map(g => g.name));
  return list.filter(x => x && x.title).map(x => ({
    pitch: String(x.pitch || '').slice(0, 200),
    cover: String(x.cover || '').slice(0, 300),
    spec: {
      ...DEFAULT_SPEC,
      mode,
      title: String(x.title).slice(0, 80),
      description: String(x.description || '').slice(0, 300),
      genre: genres.has(x.genre) ? x.genre : (GENRES.find(g => g.name.toLowerCase() === String(x.genre).toLowerCase())?.name || 'Pop'),
      era: ERAS.some(e => e.id === x.era) ? x.era : '2020s',
      moods: (Array.isArray(x.moods) ? x.moods : []).filter(m => MOODS.includes(m)).slice(0, 3),
      voice: VOICES.some(v => v.id === x.voice) ? x.voice : 'female',
      scene: LOOP_SCENES.includes(x.scene) ? x.scene : 'Exploration',
      bpm: Math.min(220, Math.max(50, Number(x.bpm) || 110)),
      seconds: mode === 'loop' ? 60 : 120,
    },
  }));
}

/**
 * Many complete directions to choose from, starting from a rough idea (or none).
 * Uses the text model; falls back to the offline generator so it always works.
 */
export async function inspire(roughIdea = '', { count = 8, mode = 'song', lockGenre = '' } = {}) {
  try {
    const text = await askText(
      'You are a creative director for a record label. You help people who cannot yet picture the finished song by offering many distinct, concrete directions. Reply with JSON only.',
      [
        roughIdea ? `The user's rough idea: ${roughIdea}` : 'The user has no idea yet; surprise them with range.',
        `Give ${count} clearly different song concepts${lockGenre ? ` in the ${lockGenre} genre` : ' across different genres and eras'}${mode === 'loop' ? ' as seamless video game background loops' : ''}.`,
        'Return a JSON array. Each item: {"title","pitch" (one sentence),"description" (the theme),"genre","era" (one of 1950s..2020s),"moods" (1-3 of: ' + MOODS.join(', ') + '),"voice" (female|male|duet|choir),"bpm","scene" (for loops),"cover" (a visual concept for the album art)}.',
        `Genres to choose from: ${GENRES.map(g => g.name).join(', ')}.`,
      ].join('\n'),
      { maxTokens: 1800, temperature: 1 },
    );
    const ideas = parseIdeas(text, mode);
    if (ideas.length >= Math.min(3, count)) return { ideas, source: 'ai' };
  } catch (err) {
    console.warn('[MusicStudio] AI ideas unavailable, using the offline generator:', err.message);
  }
  return { ideas: offlineIdeas(count, { mode, lockGenre }), source: 'offline' };
}

export async function coverConcept(track) {
  try {
    const text = await askText(
      'You are an album art director. Describe one striking cover image in a single sentence for an image model: subject, setting, style, colour palette, lighting. No text or letters in the image.',
      `Title: ${track.title}\nGenre: ${track.spec?.genre}, ${track.spec?.era}\nMood: ${(track.spec?.moods || []).join(', ')}\nTheme: ${track.spec?.description || ''}`,
      { maxTokens: 160, temperature: 0.9 },
    );
    return text.split('\n')[0].trim();
  } catch {
    return '';
  }
}

// ── Generation ─────────────────────────────────────────────────────────────

const MUSIC_MODELS = [
  { re: /ace_step_1\.5|acestep_v1\.5/i, version: '1.5' },
  { re: /ace_step_v1|ace_step/i, version: '1' },
];

export async function pickMusicModel() {
  const names = await availableOptions('CheckpointLoaderSimple', 'ckpt_name');
  for (const m of MUSIC_MODELS) {
    const hit = names.find(n => m.re.test(n));
    if (hit) return { checkpoint: hit, version: m.version };
  }
  return null;
}

// Dropdown choices for an input: older ComfyUI lists them as the type itself,
// newer ones as COMBO with an options list.
function comboOptions(spec) {
  if (Array.isArray(spec?.[0])) return spec[0];
  if (spec?.[0] === 'COMBO' && Array.isArray(spec?.[1]?.options)) return spec[1].options;
  return null;
}

// "B-flat major" -> "bb major", "F-sharp minor" -> "f# minor", so catalog names match node options.
const normalizeChoice = (v) => String(v).toLowerCase().replace(/[\s-]*flat\b/g, 'b').replace(/[\s-]*sharp\b/g, '#').replace(/\s+/g, ' ').trim();

/** The option matching a value, or null when the node does not offer it. */
export function matchOption(options, value) {
  if (value === undefined || value === null) return null;
  const exact = options.find(o => o === value || String(o) === String(value));
  if (exact !== undefined) return exact;
  const want = normalizeChoice(value);
  return options.find(o => normalizeChoice(o) === want) ?? null;
}

// Fill a node's inputs by meaning, using the names this ComfyUI actually reports.
export function fillInputs(info, values) {
  const inputs = {};
  const all = { ...(info.input?.required || {}), ...(info.input?.optional || {}) };
  for (const [name, spec] of Object.entries(all)) {
    const key = name.toLowerCase();
    const options = comboOptions(spec);
    const fallback = spec?.[1] && 'default' in spec[1] ? spec[1].default : options?.[0];
    // Exact names only: "lyrics" must not also fill "lyrics_strength".
    const match = Object.entries(values).find(([k]) => k.split('|').includes(key));
    let value = match ? match[1] : fallback;
    if (options) value = matchOption(options, value) ?? fallback;
    if (value !== undefined) inputs[name] = value;
  }
  return inputs;
}

async function buildSongWorkflow({ checkpoint, version, tags, lyrics, seconds, bpm, key, timeSignature, language, seed, batch, songPlan = true }) {
  if (version === '1.5') {
    await requireNodes(['TextEncodeAceStepAudio1.5', 'EmptyAceStep1.5LatentAudio', 'ModelSamplingAuraFlow', 'VAEDecodeAudio']);
    const enc = await nodeInfo('TextEncodeAceStepAudio1.5');
    const lat = await nodeInfo('EmptyAceStep1.5LatentAudio');
    const encInputs = fillInputs(enc, {
      'tags|caption|prompt|style': tags,
      lyrics,
      seed,
      bpm,
      'duration|seconds': seconds,
      'timesignature|time_signature': timeSignature,
      language,
      'keyscale|key': key,
      // ACE-Step 1.5 first plans a song (intro, sections, an ending). Loops skip the
      // plan so the music runs for the whole length instead of wrapping up early.
      generate_audio_codes: songPlan,
    });
    encInputs[Object.keys(encInputs).find(k => k === 'clip') || 'clip'] = ['1', 1];
    const latInputs = fillInputs(lat, { seconds, 'batch_size|batch': batch });
    return {
      1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
      2: { class_type: 'TextEncodeAceStepAudio1.5', inputs: encInputs },
      3: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['2', 0] } },
      4: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 3 } },
      5: { class_type: 'EmptyAceStep1.5LatentAudio', inputs: latInputs },
      6: { class_type: 'KSampler', inputs: { model: ['4', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['5', 0], seed, steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
      7: { class_type: 'VAEDecodeAudio', inputs: { samples: ['6', 0], vae: ['1', 2] } },
      8: { class_type: (await nodeInfo('SaveAudioAdvanced')) ? 'SaveAudioAdvanced' : 'SaveAudio', inputs: (await nodeInfo('SaveAudioAdvanced')) ? { audio: ['7', 0], filename_prefix: 'audio/Sovereign', format: 'flac' } : { audio: ['7', 0], filename_prefix: 'audio/Sovereign' } },
    };
  }
  await requireNodes(['TextEncodeAceStepAudio', 'EmptyAceStepLatentAudio', 'VAEDecodeAudio']);
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    2: { class_type: 'TextEncodeAceStepAudio', inputs: { clip: ['1', 1], tags, lyrics, lyrics_strength: 1 } },
    3: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['2', 0] } },
    4: { class_type: 'ModelSamplingSD3', inputs: { model: ['1', 0], shift: 5 } },
    5: { class_type: 'EmptyAceStepLatentAudio', inputs: { seconds, batch_size: batch } },
    6: { class_type: 'KSampler', inputs: { model: ['4', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['5', 0], seed, steps: 50, cfg: 5, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
    7: { class_type: 'VAEDecodeAudio', inputs: { samples: ['6', 0], vae: ['1', 2] } },
    8: { class_type: 'SaveAudio', inputs: { audio: ['7', 0], filename_prefix: 'audio/Sovereign' } },
  };
}

/**
 * Load the music model before the first song: Music Studio calls this when it
 * opens. Only when the engine is already running, and only into spare room (see
 * warmModel); the job is the song job cut to one step over a few seconds, and it
 * saves nothing. Calls made while one runs share it. Resolves with the
 * checkpoint once loaded, else null.
 */
let warming = null;
export function warmMusicModel() {
  warming ||= (async () => {
    if (!(await probeComfy())) return null;
    const model = await pickMusicModel();
    if (!model) return null;
    const wf = await buildSongWorkflow({ ...model, tags: 'instrumental', lyrics: '[Instrumental]', seconds: 4, bpm: DEFAULT_SPEC.bpm, key: DEFAULT_SPEC.key, timeSignature: DEFAULT_SPEC.timeSignature, language: DEFAULT_SPEC.language, seed: Math.floor(Math.random() * 2 ** 31), batch: 1, songPlan: false });
    wf[6].inputs.steps = 1;
    wf[8] = { class_type: 'PreviewAudio', inputs: { audio: ['7', 0] } };
    return (await warmModel(model.checkpoint, wf)) ? model.checkpoint : null;
  })().finally(() => { warming = null; });
  return warming;
}

async function putBlob(kind, blob) {
  const blobId = id(kind);
  await db.media_blobs.put({ id: blobId, kind, blob, createdAt: Date.now() });
  return blobId;
}

export async function getBlob(blobId) {
  return blobId ? (await db.media_blobs.get(blobId))?.blob || null : null;
}

/**
 * Generate songs from a spec. Saves each variation to the library and returns them.
 * onProgress({ status?, value?, max? })
 */
export async function generateSong(rawSpec, { onProgress } = {}) {
  const spec = { ...DEFAULT_SPEC, ...rawSpec };
  const settings = await getMusicSettings();
  await ensureComfyRunning({ onStatus: (status) => onProgress?.({ status }) });
  const model = await pickMusicModel();
  if (!model) {
    const err = new Error('No music model is installed. Install ACE-Step 1.5 from the Engine tab (one click, 10 GB).');
    err.code = 'NO_MUSIC_MODEL';
    throw err;
  }
  const { tags, lyrics } = compose(spec);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const batch = spec.mode === 'loop' ? 1 : Math.min(2, Math.max(1, settings.variations));
  onProgress?.({ status: `Composing with ${model.checkpoint}` });
  // Loops render longer than asked: the loop is cut from where the music plays.
  const renderSeconds = spec.mode === 'loop' ? Math.ceil(spec.seconds * 1.25) : spec.seconds;
  const workflow = await buildSongWorkflow({ ...model, tags, lyrics, seconds: renderSeconds, bpm: spec.bpm, key: spec.key, timeSignature: spec.timeSignature, language: spec.language, seed, batch, songPlan: spec.mode !== 'loop' });
  const outputs = (await runWorkflow(workflow, { onProgress })).filter(o => o.kind === 'audio');
  if (!outputs.length) throw new Error('The music model produced no audio.');

  const tracks = [];
  for (let i = 0; i < outputs.length; i++) {
    let blob = await fetchOutput(outputs[i]);
    let seconds = spec.seconds;
    let loopInfo = null;
    try {
      const audio = await decodeAudio(blob);
      seconds = durationOf(audio);
      if (spec.mode === 'loop') {
        const loop = makeSeamlessLoop(audio, { bpm: spec.bpm, beatsPerBar: Number(spec.timeSignature) || 4 });
        blob = wavBlob(loop.audio);
        seconds = loop.loopSec;
        loopInfo = { loopSec: loop.loopSec, crossfadeSec: loop.crossfadeSec };
      }
    } catch (err) {
      console.warn('[MusicStudio] Could not analyse audio:', err.message);
    }
    const track = {
      id: id('trk'),
      title: (spec.title || 'Untitled') + (outputs.length > 1 ? ` (take ${i + 1})` : ''),
      spec,
      tags,
      lyrics,
      model: model.checkpoint,
      seed,
      seconds,
      loop: loopInfo,
      audioBlobId: await putBlob('audio', blob),
      audioMime: blob.type || 'audio/flac',
      engineFile: outputs[i].filename,
      coverBlobId: null,
      albumId: null,
      liked: 0,
      published: 0,
      createdAt: Date.now(),
    };
    await db.music_tracks.put(track);
    tracks.push(track);
  }
  emit();
  if (settings.autoCover) {
    // Covers are a bonus: generate in the background, one per request.
    generateCover(tracks[0]).then(async (coverId) => {
      for (const t of tracks.slice(1)) await db.music_tracks.update(t.id, { coverBlobId: coverId });
      emit();
    }).catch(err => console.warn('[MusicStudio] Cover generation skipped:', err.message));
  }
  return tracks;
}

/** Generate and attach album art. Resolves with the cover blob id. */
export async function generateCover(track, { onProgress } = {}) {
  const concept = await coverConcept(track);
  const blob = await generateImage({ prompt: coverPrompt({ title: track.title, genre: track.spec?.genre, era: track.spec?.era, moods: track.spec?.moods, concept }), onProgress, prefix: 'covers/Sovereign' });
  const coverBlobId = await putBlob('cover', blob);
  await db.music_tracks.update(track.id, { coverBlobId, coverConcept: concept });
  emit();
  return coverBlobId;
}

/**
 * Remix an uploaded or existing audio file with a new style (audio-to-audio).
 * strength 0..1: how far the result may move from the original.
 */
export async function remixAudio(fileBlob, rawSpec, { strength = 0.6, onProgress } = {}) {
  const spec = { ...DEFAULT_SPEC, ...rawSpec };
  await ensureComfyRunning({ onStatus: (status) => onProgress?.({ status }) });
  const model = await pickMusicModel();
  if (!model) throw new Error('Install a music model first.');
  await requireNodes(['LoadAudio', 'VAEEncodeAudio']);
  const name = await uploadInput(fileBlob, `sovereign_remix_${Date.now()}.${(fileBlob.type.split('/')[1] || 'wav').replace('mpeg', 'mp3')}`);
  const { tags, lyrics } = compose(spec);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const wf = await buildSongWorkflow({ ...model, tags, lyrics, seconds: spec.seconds, bpm: spec.bpm, key: spec.key, timeSignature: spec.timeSignature, language: spec.language, seed, batch: 1 });
  wf[9] = { class_type: 'LoadAudio', inputs: { audio: name } };
  wf[10] = { class_type: 'VAEEncodeAudio', inputs: { audio: ['9', 0], vae: ['1', 2] } };
  wf[6].inputs.latent_image = ['10', 0];
  wf[6].inputs.denoise = Math.min(0.95, Math.max(0.2, strength));
  const out = (await runWorkflow(wf, { onProgress })).find(o => o.kind === 'audio');
  if (!out) throw new Error('The remix produced no audio.');
  const blob = await fetchOutput(out);
  const track = {
    id: id('trk'), title: `${spec.title || 'Remix'}`, spec, tags, lyrics, model: model.checkpoint, seed, seconds: spec.seconds,
    audioBlobId: await putBlob('audio', blob), audioMime: blob.type || 'audio/flac', engineFile: out.filename, remix: { strength },
    coverBlobId: null, albumId: null, liked: 0, published: 0, createdAt: Date.now(),
  };
  await db.music_tracks.put(track);
  emit();
  return track;
}

/** Save an uploaded or edited file into the library. */
export async function saveAudioFile(blob, { title, spec = {} } = {}) {
  let seconds = 0;
  try { seconds = durationOf(await decodeAudio(blob)); } catch { /* unknown format */ }
  const track = {
    id: id('trk'), title: title || 'Imported audio', spec: { ...DEFAULT_SPEC, ...spec }, tags: '', lyrics: '', model: 'imported', seed: 0, seconds,
    audioBlobId: await putBlob('audio', blob), audioMime: blob.type || 'audio/wav', coverBlobId: null, albumId: null, liked: 0, published: 0, imported: true, createdAt: Date.now(),
  };
  await db.music_tracks.put(track);
  emit();
  return track;
}

// ── Library ────────────────────────────────────────────────────────────────

export async function listTracks() {
  return (await db.music_tracks.toArray().catch(() => [])).sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateTrack(trackId, patch) {
  await db.music_tracks.update(trackId, patch);
  emit();
}

export async function deleteTrack(trackId) {
  const t = await db.music_tracks.get(trackId);
  if (!t) return;
  const sharedCover = t.coverBlobId && (await db.music_tracks.filter(x => x.id !== trackId && x.coverBlobId === t.coverBlobId).count()) > 0;
  await db.media_blobs.bulkDelete([t.audioBlobId, sharedCover ? null : t.coverBlobId].filter(Boolean));
  await db.music_tracks.delete(trackId);
  emit();
}

export async function listAlbums() {
  return (await db.music_albums.toArray().catch(() => [])).sort((a, b) => b.createdAt - a.createdAt);
}

export async function createAlbum({ title, description = '' }) {
  const album = { id: id('alb'), title: title.trim().slice(0, 80) || 'Untitled album', description: description.slice(0, 500), coverBlobId: null, published: 0, createdAt: Date.now(), order: [] };
  await db.music_albums.put(album);
  emit();
  return album;
}

export async function updateAlbum(albumId, patch) {
  await db.music_albums.update(albumId, patch);
  emit();
}

export async function deleteAlbum(albumId) {
  await db.music_tracks.where('albumId').equals(albumId).modify({ albumId: null });
  await db.music_albums.delete(albumId);
  emit();
}

export async function addToAlbum(trackId, albumId) {
  await db.music_tracks.update(trackId, { albumId });
  const album = await db.music_albums.get(albumId);
  if (album && !album.order.includes(trackId)) await db.music_albums.update(albumId, { order: [...album.order, trackId] });
  emit();
}

/** Album art: generated from the album's tracks. */
export async function generateAlbumCover(album, { onProgress } = {}) {
  const tracks = (await db.music_tracks.where('albumId').equals(album.id).toArray());
  const genres = [...new Set(tracks.map(t => t.spec?.genre).filter(Boolean))].slice(0, 2).join(' and ');
  const blob = await generateImage({ prompt: coverPrompt({ title: album.title, genre: genres, era: tracks[0]?.spec?.era, moods: tracks.flatMap(t => t.spec?.moods || []).slice(0, 2), concept: album.description }), onProgress, prefix: 'covers/Album' });
  const coverBlobId = await putBlob('cover', blob);
  await db.music_albums.update(album.id, { coverBlobId });
  emit();
  return coverBlobId;
}

// ── Publishing ─────────────────────────────────────────────────────────────

export async function publishTrack(track, { description = '' } = {}) {
  await marketplacePublish.publishCreation({
    title: track.title,
    category: 'music',
    description: description || `${track.spec?.genre || ''} ${track.spec?.mode === 'loop' ? 'game loop' : 'track'} made in Music Studio`.trim(),
    tags: ['music', track.spec?.genre, track.spec?.era, track.spec?.mode].filter(Boolean),
    content: JSON.stringify({ format: 'sovereign-track-v1', title: track.title, tags: track.tags, lyrics: track.lyrics, seconds: track.seconds }),
    license: 'All rights reserved by the creator',
  });
  await db.music_tracks.update(track.id, { published: 1, publishedAt: Date.now(), publishDescription: description });
  emit();
}

export async function unpublishTrack(track) {
  await db.music_tracks.update(track.id, { published: 0 });
  emit();
}

export async function publishAlbum(album) {
  const tracks = await db.music_tracks.where('albumId').equals(album.id).toArray();
  await marketplacePublish.publishCreation({
    title: album.title,
    category: 'music',
    description: album.description || `Album of ${tracks.length} tracks made in Music Studio`,
    tags: ['music', 'album'],
    content: JSON.stringify({ format: 'sovereign-album-v1', title: album.title, tracks: tracks.map(t => ({ title: t.title, seconds: t.seconds })) }),
    license: 'All rights reserved by the creator',
  });
  await db.music_albums.update(album.id, { published: 1, publishedAt: Date.now() });
  for (const t of tracks) await db.music_tracks.update(t.id, { published: 1, publishedAt: Date.now() });
  emit();
}
