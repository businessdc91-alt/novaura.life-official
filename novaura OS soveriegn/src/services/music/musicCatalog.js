// musicCatalog.js — The palette for building a song without facing a blank page.
// Genres carry real tempo ranges and signature instruments; eras carry their
// production sound. compose() turns choices into an ACE-Step prompt, and
// blueprint() describes in plain words what will be made before anything runs.

export const GENRE_GROUPS = {
  'Pop & Dance': [
    ['Pop', 100, 125, 'bright synths, punchy drums, catchy hooks'],
    ['Synth-pop', 105, 125, 'analog synths, drum machines, shimmering pads'],
    ['K-pop', 100, 130, 'layered vocals, crisp production, genre-blending drops'],
    ['Dance-pop', 118, 128, 'four-on-the-floor kick, plucky synths, big chorus'],
    ['Electropop', 110, 128, 'glossy synth bass, vocal chops, sidechained pads'],
    ['Disco', 110, 125, 'funky bass, string stabs, hi-hat groove, four-on-the-floor'],
    ['City pop', 95, 120, 'jazzy chords, slap bass, glossy 80s keys'],
    ['Hyperpop', 140, 170, 'pitched vocals, distorted bass, glitchy maximal production'],
  ],
  'Electronic': [
    ['House', 120, 128, 'four-on-the-floor kick, offbeat hats, piano stabs, warm bass'],
    ['Deep house', 118, 124, 'smooth bass, soulful chords, laid-back groove'],
    ['Techno', 125, 140, 'driving kick, hypnotic loops, industrial textures'],
    ['Trance', 130, 140, 'supersaw leads, rolling bass, euphoric build-ups'],
    ['Drum and bass', 165, 178, 'fast breakbeats, deep sub bass, rolling energy'],
    ['Dubstep', 138, 142, 'half-time drums, wobble bass, heavy drops'],
    ['Synthwave', 80, 118, 'retro analog synths, gated reverb drums, neon nostalgia'],
    ['Lo-fi hip hop', 70, 90, 'dusty drums, vinyl crackle, mellow jazzy keys'],
    ['Ambient', 60, 90, 'evolving pads, field recordings, no drums'],
    ['Chillwave', 80, 110, 'hazy synths, washed-out vocals, dreamy reverb'],
    ['Future bass', 140, 160, 'lush supersaw chords, vocal chops, bouncy drops'],
    ['Breakbeat', 125, 140, 'chopped breaks, funky bass, big-beat energy'],
    ['Downtempo', 80, 100, 'trip-hop beats, moody textures, deep bass'],
    ['Chiptune', 120, 160, '8-bit square waves, arpeggios, retro game sound'],
  ],
  'Hip Hop & R&B': [
    ['Hip hop', 85, 100, 'boom bap drums, sampled loops, rap vocals'],
    ['Trap', 130, 160, 'rolling hi-hats, 808 bass, dark melodies'],
    ['Boom bap', 85, 95, 'dusty kicks and snares, vinyl samples, scratches'],
    ['Drill', 140, 145, 'sliding 808s, syncopated hats, menacing melodies'],
    ['R&B', 65, 95, 'smooth chords, silky vocals, tight drums'],
    ['Neo-soul', 70, 95, 'live drums with swing, Rhodes piano, warm bass'],
    ['Funk', 95, 120, 'slap bass, wah guitar, tight horns, syncopated groove'],
    ['Soul', 70, 110, 'gospel-tinged vocals, organ, horns, live band'],
    ['Gospel', 70, 120, 'choir, Hammond organ, hand claps, uplifting'],
  ],
  'Rock': [
    ['Rock', 100, 140, 'electric guitars, live drums, bass, energetic vocals'],
    ['Classic rock', 100, 140, 'overdriven guitars, big drums, bluesy riffs'],
    ['Indie rock', 100, 140, 'jangly guitars, raw drums, earnest vocals'],
    ['Alternative', 90, 140, 'textured guitars, dynamic verses and choruses'],
    ['Grunge', 90, 130, 'fuzzy distorted guitars, heavy drums, angsty vocals'],
    ['Punk', 160, 200, 'fast power chords, shouted vocals, raw energy'],
    ['Pop punk', 150, 190, 'bright power chords, fast drums, catchy choruses'],
    ['Post-rock', 80, 130, 'swelling guitars, crescendos, instrumental'],
    ['Shoegaze', 90, 130, 'walls of reverb guitar, dreamy buried vocals'],
    ['Psychedelic rock', 90, 130, 'phased guitars, organ, swirling effects'],
  ],
  'Metal': [
    ['Heavy metal', 110, 160, 'distorted riffs, double kick, powerful vocals'],
    ['Thrash metal', 160, 220, 'fast palm-muted riffs, aggressive drums'],
    ['Metalcore', 120, 180, 'breakdowns, screamed and clean vocals, drop tuning'],
    ['Symphonic metal', 100, 160, 'orchestra, choir, heavy guitars, operatic vocals'],
    ['Doom metal', 50, 80, 'slow crushing riffs, dark atmosphere'],
    ['Djent', 100, 150, 'polyrhythmic low riffs, tight production'],
  ],
  'Jazz, Blues & Soul': [
    ['Jazz', 80, 180, 'upright bass, brushed drums, piano, saxophone'],
    ['Smooth jazz', 80, 110, 'saxophone lead, mellow keys, soft groove'],
    ['Bebop', 180, 280, 'fast horn lines, walking bass, complex changes'],
    ['Bossa nova', 110, 140, 'nylon guitar, soft percussion, gentle vocals'],
    ['Swing', 120, 180, 'big band horns, walking bass, swing rhythm'],
    ['Blues', 60, 120, 'electric guitar bends, shuffle rhythm, harmonica'],
    ['Jazz fusion', 100, 160, 'electric piano, complex rhythms, virtuosic solos'],
  ],
  'Country & Folk': [
    ['Country', 80, 120, 'acoustic guitar, pedal steel, fiddle, storytelling vocals'],
    ['Bluegrass', 120, 180, 'banjo, mandolin, fiddle, upright bass, harmonies'],
    ['Folk', 80, 120, 'acoustic guitar, intimate vocals, simple arrangement'],
    ['Indie folk', 80, 120, 'acoustic guitar, warm harmonies, gentle percussion'],
    ['Americana', 80, 120, 'acoustic and electric guitar, roots feel, honest vocals'],
    ['Celtic', 90, 140, 'fiddle, tin whistle, bodhran, uplifting melodies'],
  ],
  'World': [
    ['Reggae', 60, 90, 'offbeat guitar skank, deep bass, one-drop drums'],
    ['Afrobeats', 100, 115, 'syncopated percussion, log drums, melodic vocals'],
    ['Amapiano', 108, 115, 'log drum bass, airy piano, shakers'],
    ['Reggaeton', 88, 100, 'dembow rhythm, heavy bass, Latin vocals'],
    ['Latin pop', 90, 120, 'Latin percussion, guitar, catchy Spanish vocals'],
    ['Salsa', 160, 220, 'piano montuno, brass, congas and timbales'],
    ['Flamenco', 100, 180, 'flamenco guitar, palmas, passionate vocals'],
    ['Bollywood', 90, 130, 'tabla, sitar, strings, lush vocals'],
    ['J-pop', 110, 150, 'bright melodies, energetic arrangement'],
    ['Anime opening', 140, 180, 'fast guitars, soaring vocals, dramatic energy'],
  ],
  'Cinematic & Classical': [
    ['Cinematic orchestral', 70, 130, 'full orchestra, brass swells, epic percussion'],
    ['Epic trailer', 80, 140, 'huge drums, choir, hybrid synths, braams'],
    ['Classical piano', 60, 120, 'solo piano, expressive dynamics'],
    ['String quartet', 60, 120, 'violins, viola, cello, intimate'],
    ['Baroque', 80, 130, 'harpsichord, strings, counterpoint'],
    ['Minimalist', 70, 120, 'repeating patterns, gradual change, piano and marimba'],
    ['Video game score', 80, 140, 'orchestral and synth hybrid, adventurous themes'],
    ['Horror score', 50, 90, 'dissonant strings, eerie textures, tension'],
  ],
};

export const GENRES = Object.values(GENRE_GROUPS).flat().map(([name, bpmMin, bpmMax, sound]) => ({ name, bpmMin, bpmMax, sound }));

export const ERAS = [
  { id: '1950s', label: '1950s', sound: 'mono warmth, tape echo, live room recording' },
  { id: '1960s', label: '1960s', sound: 'vintage tube warmth, spring reverb, analog tape' },
  { id: '1970s', label: '1970s', sound: 'warm analog tape, live band feel, plate reverb' },
  { id: '1980s', label: '1980s', sound: 'gated reverb drums, analog synths, big chorus effects' },
  { id: '1990s', label: '1990s', sound: 'crunchy samples, early digital production, raw energy' },
  { id: '2000s', label: '2000s', sound: 'polished digital production, bright compressed mix' },
  { id: '2010s', label: '2010s', sound: 'modern loudness, crisp low end, layered vocals' },
  { id: '2020s', label: '2020s', sound: 'contemporary streaming-era production, wide stereo' },
];

export const MOODS = ['Uplifting', 'Melancholic', 'Energetic', 'Dreamy', 'Dark', 'Romantic', 'Nostalgic', 'Aggressive', 'Peaceful', 'Mysterious', 'Triumphant', 'Playful', 'Bittersweet', 'Hopeful', 'Tense', 'Groovy', 'Ethereal', 'Gritty', 'Euphoric', 'Lonely', 'Confident', 'Whimsical', 'Epic', 'Intimate'];

export const INSTRUMENTS = ['Piano', 'Acoustic guitar', 'Electric guitar', 'Bass guitar', 'Synth bass', '808', 'Drum kit', 'Drum machine', 'Strings', 'Violin', 'Cello', 'Brass', 'Saxophone', 'Trumpet', 'Flute', 'Rhodes', 'Organ', 'Synth pads', 'Synth lead', 'Choir', 'Harp', 'Banjo', 'Mandolin', 'Pedal steel', 'Sitar', 'Tabla', 'Marimba', 'Music box', 'Bells', 'Orchestral percussion'];

export const VOICES = [
  { id: 'female', label: 'Female vocals', tag: 'female vocals' },
  { id: 'male', label: 'Male vocals', tag: 'male vocals' },
  { id: 'duet', label: 'Male & female duet', tag: 'male and female duet vocals' },
  { id: 'choir', label: 'Choir', tag: 'choir vocals' },
  { id: 'any', label: 'Let the AI choose', tag: '' },
];

export const VOCAL_STYLES = ['Soft', 'Powerful', 'Breathy', 'Raspy', 'Soulful', 'Falsetto', 'Rap', 'Spoken word', 'Operatic', 'Harmonies', 'Whispered', 'Belting'];

export const MODES = [
  { id: 'song', label: 'Song', description: 'Vocals and music, with lyrics' },
  { id: 'instrumental', label: 'Instrumental', description: 'Music only, no vocals' },
  { id: 'acapella', label: 'A cappella', description: 'Voices only, no instruments' },
  { id: 'loop', label: 'Game loop', description: 'Seamless background loop for games and apps' },
];

export const LOOP_SCENES = ['Main menu', 'Exploration', 'Battle', 'Boss fight', 'Town', 'Dungeon', 'Victory', 'Puzzle', 'Stealth', 'Racing', 'Space', 'Underwater', 'Shop', 'Credits', 'Cozy farm', 'Horror corridor'];

export const STRUCTURES = {
  'Classic (verse–chorus)': ['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
  'Short & catchy': ['Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'],
  'Story ballad': ['Intro', 'Verse 1', 'Verse 2', 'Chorus', 'Verse 3', 'Chorus', 'Outro'],
  'Build & drop': ['Intro', 'Verse', 'Pre-Chorus', 'Drop', 'Verse', 'Pre-Chorus', 'Drop', 'Outro'],
  'Rap': ['Intro', 'Verse 1', 'Hook', 'Verse 2', 'Hook', 'Verse 3', 'Hook', 'Outro'],
  'Epic 6-Minute Journey': ['Intro', 'Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2', 'Chorus', 'Instrumental Solo', 'Bridge', 'Final Chorus', 'Outro'],
  'Extended Club Mix (8m)': ['Extended Intro', 'Verse 1', 'Build', 'Drop 1', 'Breakdown', 'Verse 2', 'Build 2', 'Drop 2', 'Extended Outro'],
  'Progressive Suite (10m)': ['Overture', 'Movement I: Verse', 'Chorus', 'Interlude', 'Movement II: Verse', 'Instrumental Solo', 'Bridge', 'Climactic Finale', 'Coda'],
};

export const KEYS = ['C major', 'G major', 'D major', 'A major', 'E major', 'F major', 'B-flat major', 'E-flat major', 'A minor', 'E minor', 'B minor', 'D minor', 'G minor', 'C minor', 'F-sharp minor', 'C-sharp minor'];

export const LANGUAGES = [['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ru', 'Russian'], ['hi', 'Hindi']];

export function genreInfo(name) {
  return GENRES.find(g => g.name === name) || null;
}

export function suggestedBpm(genreName) {
  const g = genreInfo(genreName);
  return g ? Math.round((g.bpmMin + g.bpmMax) / 2) : 110;
}

export const DEFAULT_SPEC = {
  mode: 'song',
  title: '',
  description: '',
  genre: 'Pop',
  era: '2020s',
  moods: ['Uplifting'],
  instruments: [],
  voice: 'female',
  vocalStyles: [],
  scene: 'Exploration',
  bpm: 115,
  key: 'C major',
  timeSignature: '4',
  language: 'en',
  seconds: 120,
  lyrics: '',
  structure: 'Classic (verse–chorus)',
};

const join = (list) => list.filter(Boolean).join(', ');

/**
 * Turn a song spec into ACE-Step inputs.
 * Returns { tags, lyrics } where tags is the style caption.
 */
export function compose(spec) {
  const s = { ...DEFAULT_SPEC, ...spec };
  const genre = genreInfo(s.genre);
  const era = ERAS.find(e => e.id === s.era);
  const voice = VOICES.find(v => v.id === s.voice);
  const parts = [];

  parts.push(`${s.genre}${era ? `, ${era.label} style` : ''}`);
  if (s.description) parts.push(s.description.trim());
  if (s.moods.length) parts.push(join(s.moods.map(m => m.toLowerCase())));
  parts.push(s.instruments.length ? join(s.instruments.map(i => i.toLowerCase())) : genre?.sound);
  if (era) parts.push(era.sound);

  if (s.mode === 'instrumental') parts.push('instrumental, no vocals');
  if (s.mode === 'loop') parts.push(`instrumental video game background music, ${s.scene.toLowerCase()} theme, seamless loop, steady energy, no vocals, no intro or ending`);
  if (s.mode === 'acapella') parts.push('a cappella, unaccompanied voices only, no instruments, vocal harmonies');
  if ((s.mode === 'song' || s.mode === 'acapella') && voice?.tag) {
    parts.push(join([voice.tag, ...s.vocalStyles.map(v => `${v.toLowerCase()} vocals`)]));
  }
  parts.push(`${s.bpm} BPM, ${s.key}`);

  let lyrics = s.lyrics.trim();
  if (s.mode === 'instrumental' || s.mode === 'loop') lyrics = '[Instrumental]';
  else if (!lyrics) lyrics = '[Instrumental]';

  return { tags: join(parts), lyrics };
}

function duration(seconds) {
  const m = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Plain-language description of what will be generated. */
export function blueprint(spec) {
  const s = { ...DEFAULT_SPEC, ...spec };
  const voice = VOICES.find(v => v.id === s.voice);
  const what = {
    song: `a ${duration(s.seconds)} ${s.era} ${s.genre.toLowerCase()} song${voice?.tag ? ` with ${voice.label.toLowerCase()}` : ''}`,
    instrumental: `a ${duration(s.seconds)} ${s.era} ${s.genre.toLowerCase()} instrumental`,
    acapella: `a ${duration(s.seconds)} a cappella piece${voice?.tag ? ` for ${voice.label.toLowerCase()}` : ''} inspired by ${s.genre.toLowerCase()}`,
    loop: `a seamless ${duration(s.seconds)} ${s.genre.toLowerCase()} game loop for a ${s.scene.toLowerCase()} scene`,
  }[s.mode];
  const feel = s.moods.length ? `It will feel ${join(s.moods.map(m => m.toLowerCase()))}` : 'The AI will choose the mood';
  const sound = s.instruments.length ? `built on ${join(s.instruments.map(i => i.toLowerCase()))}` : `with ${genreInfo(s.genre)?.sound || 'genre-typical instruments'}`;
  const lyricsNote = s.mode === 'song' || s.mode === 'acapella'
    ? (s.lyrics.trim() ? `It sings your lyrics (${s.lyrics.trim().split('\n').filter(l => l.trim() && !l.startsWith('[')).length} lines).` : 'There are no lyrics yet, so it will be wordless; use Write lyrics to add some.')
    : '';
  return `You are about to make ${what} at ${s.bpm} BPM in ${s.key}. ${feel}, ${sound}. ${lyricsNote}`.replace(/\s+/g, ' ').trim();
}

// ── Offline idea generator ─────────────────────────────────────────────────

const TITLE_A = ['Neon', 'Velvet', 'Midnight', 'Golden', 'Paper', 'Electric', 'Silent', 'Wild', 'Glass', 'Crimson', 'Lunar', 'Broken', 'Silver', 'Endless', 'Hidden', 'Faded', 'Burning', 'Northern', 'Sugar', 'Cosmic'];
const TITLE_B = ['Hearts', 'Highway', 'Skyline', 'Echoes', 'Rain', 'Horizon', 'Static', 'Gardens', 'Signals', 'Summer', 'Shadows', 'Tides', 'Letters', 'Lights', 'Dreams', 'Machines', 'Rivers', 'Fire', 'Motel', 'Satellites'];
const THEMES = ['a late-night drive through an empty city', 'falling for someone you just met', 'leaving home for the first time', 'a summer that ended too soon', 'rebuilding after a hard year', 'a party that never wants to end', 'missing someone far away', 'standing up for yourself', 'a quiet morning by the sea', 'chasing a dream against the odds', 'a friendship that outlasted everything', 'the last night before a big change'];

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function seeded(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/**
 * Complete song concepts the user can pick from, generated without any model.
 * Each is a full spec plus a one-line pitch and a cover idea.
 */
export function offlineIdeas(count = 8, { mode = 'song', seed = Date.now(), lockGenre = '' } = {}) {
  const rng = seeded(seed);
  const ideas = [];
  const used = new Set();
  for (let i = 0; i < count * 4 && ideas.length < count; i++) {
    const genre = lockGenre ? genreInfo(lockGenre) : pick(GENRES, rng);
    if (!genre || (!lockGenre && used.has(genre.name))) continue;
    used.add(genre.name);
    const era = pick(ERAS, rng);
    const moods = [pick(MOODS, rng), pick(MOODS, rng)].filter((m, j, a) => a.indexOf(m) === j);
    const theme = pick(THEMES, rng);
    const title = `${pick(TITLE_A, rng)} ${pick(TITLE_B, rng)}`;
    const voice = pick(['female', 'male', 'duet', 'female', 'male'], rng);
    const bpm = Math.round(genre.bpmMin + rng() * (genre.bpmMax - genre.bpmMin));
    const scene = pick(LOOP_SCENES, rng);
    ideas.push({
      pitch: mode === 'loop'
        ? `${moods.join(' and ').toLowerCase()} ${genre.name.toLowerCase()} loop for a ${scene.toLowerCase()} scene`
        : `${era.label} ${genre.name.toLowerCase()} about ${theme}`,
      cover: `${moods[0].toLowerCase()} artwork evoking ${mode === 'loop' ? scene.toLowerCase() : theme}, ${era.label} aesthetic`,
      spec: {
        ...DEFAULT_SPEC,
        mode,
        title,
        description: mode === 'loop' ? '' : `A song about ${theme}`,
        genre: genre.name,
        era: era.id,
        moods,
        voice,
        scene,
        bpm,
        key: pick(KEYS, rng),
        seconds: mode === 'loop' ? 60 : 120,
      },
    });
  }
  return ideas;
}
