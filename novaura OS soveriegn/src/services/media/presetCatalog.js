// presetCatalog.js — Curated PixAI-class visual reference gallery & engineered prompt studio.
// Provides real SVG visual reference thumbnails, structured prompt templates, negative prompts,
// optimal aspect ratios, denoise ranges, and category-specific parameters (Action Figures,
// Anime Converters, Hand-Drawn Pencil/Caricature, Holo Cards, Badges, Avatars, Comics/Manga, I2V).

export const PRESET_CATEGORIES = [
  { id: 'all', label: 'All Presets' },
  { id: 'action_figure', label: 'Action Figures' },
  { id: 'anime', label: 'Anime Converter' },
  { id: 'sketch', label: 'Pencil & Caricature' },
  { id: 'cards_badges', label: 'Holo Cards & Badges' },
  { id: 'comic_manga', label: 'Comic & Manga' },
];

export const ASPECT_PRESETS = [
  { id: 'square', label: '1:1 Square / Avatar', width: 1024, height: 1024 },
  { id: 'tcg', label: '5:7 Trading Card', width: 768, height: 1088 },
  { id: 'portrait', label: '3:4 Action Figure / Portrait', width: 832, height: 1152 },
  { id: 'comic', label: '2:3 Comic / Manga Page', width: 832, height: 1216 },
  { id: 'landscape', label: '16:9 Cinema / Banner', width: 1280, height: 768 },
  { id: 'badge', label: '1:1 Emblem / Badge', width: 1024, height: 1024 },
];

export const VISUAL_PRESETS = [
  // ── ACTION FIGURE DESIGNER ─────────────────────────────────────────────────
  {
    id: 'action_figure_blister',
    category: 'action_figure',
    name: 'Collector Blister-Pack Figure',
    badge: 'Photo → Figure',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'portrait',
    width: 832,
    height: 1152,
    steps: 26,
    cfg: 6.5,
    denoise: 0.58,
    accent: ['#f59e0b', '#dc2626', '#1e1b4b'],
    glyph: 'blister',
    description: 'Transforms an uploaded portrait into a hyper-detailed 1:12 scale collector action figure sealed inside a molded clear plastic blister pack with custom header card and accessories.',
    promptTemplate:
      'Studio product photograph of a collectible 1:12 scale articulated action figure of {subject}, faithfully preserving facial likeness and expression, sealed inside a pristine crystal-clear molded plastic blister pack mounted on a vibrant {figureBoxColor} cardboard backing card, bold retro-modern header typography reading "{figureName}" with subtitle "{figureTagline}", molded plastic accessory trays neatly displaying {figureAccessories}, realistic ABS/PVC satin plastic sheen, subtle visible shoulder and elbow articulation joints, studio softbox lighting, crisp shadows, 8k commercial toy photography',
    negativePrompt:
      'blurry, deformed face, melted plastic, misspelled gibberish text, extra limbs, low resolution, flat 2d illustration, watermark, cropped packaging',
    defaults: {
      subject: 'the person in the reference photo wearing tactical streetwear jacket and boots',
      figureName: 'SOVEREIGN EDITION',
      figureTagline: 'LIMITED SERIES #01',
      figureAccessories: 'miniature glowing cyber-deck laptop, coffee tumbler, interchangeable hands, holographic energy blade',
      figureBoxColor: 'obsidian black and electric gold',
    },
  },
  {
    id: 'action_figure_diorama',
    category: 'action_figure',
    name: 'Deluxe Collector Statue & Base',
    badge: 'Photo → Statue',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'portrait',
    width: 832,
    height: 1152,
    steps: 28,
    cfg: 6.8,
    denoise: 0.6,
    accent: ['#38bdf8', '#6366f1', '#0f172a'],
    glyph: 'statue',
    description: 'Museum-grade 1:6 scale resin collector statue on an illuminated display plinth with dynamic heroic pose and miniature props.',
    promptTemplate:
      'Macro studio photograph of a high-end 1:6 scale hand-painted polyresin collector statue of {subject}, accurate facial likeness, dynamic heroic stance on an illuminated sculpted diorama base featuring {figureAccessories}, fine fabric micro-textures, subtle clear-coat highlights, engraved metallic nameplate reading "{figureName}", dramatic rim lighting against a dark museum cyclorama backdrop, shallow depth of field, 85mm lens',
    negativePrompt:
      'cartoon flat shading, blurry face, melted hands, watermark, cluttered bedroom background, low poly, jpeg artifacts',
    defaults: {
      subject: 'the person in the reference photo in sleek futuristic explorer armor',
      figureName: 'ARCHITECT PRIME',
      figureTagline: 'COLLECTOR STATUE',
      figureAccessories: 'glowing holographic map projection, rocky cyber-ruin plinth, translucent blue energy effects',
      figureBoxColor: 'deep cobalt and chrome',
    },
  },
  {
    id: 'action_figure_chibi_vinyl',
    category: 'action_figure',
    name: 'Stylized Vinyl Boxed Collectible',
    badge: 'Photo → Vinyl',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'square',
    width: 1024,
    height: 1024,
    steps: 24,
    cfg: 7.0,
    denoise: 0.62,
    accent: ['#ec4899', '#8b5cf6', '#18181b'],
    glyph: 'vinyl',
    description: 'Designer matte-vinyl collectible toy with stylized proportions, crisp display window box, and miniature desk props.',
    promptTemplate:
      'Commercial product photography of a designer matte-vinyl collectible figurine inspired by {subject}, distinctive recognizable hairstyle and outfit, oversized expressive stylized head with crisp glossy eyes, standing beside its open collector window box colored {figureBoxColor} labeled "{figureName}", accompanied by cute miniature vinyl props: {figureAccessories}, soft pastel studio bounce lighting, ultra-clean seamless backdrop',
    negativePrompt:
      'creepy uncanny realism, dirty surface, blurry, extra fingers, watermark, low quality, messy text',
    defaults: {
      subject: 'the person in the reference photo smiling with headphones around their neck',
      figureName: 'NOVA SERIES',
      figureTagline: 'VINYL EDITION',
      figureAccessories: 'tiny synthesizer keyboard, mini vinyl record, enamel star pin',
      figureBoxColor: 'magenta and midnight indigo',
    },
  },

  // ── ANIME CONVERTER ────────────────────────────────────────────────────────
  {
    id: 'anime_modern_keyvisual',
    category: 'anime',
    name: 'Modern Anime Key Visual',
    badge: 'Photo → Anime',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'portrait',
    width: 832,
    height: 1152,
    steps: 26,
    cfg: 7.0,
    denoise: 0.56,
    accent: ['#a855f7', '#06b6d4', '#090d16'],
    glyph: 'anime',
    description: 'High-budget theatrical anime conversion preserving hair, eye color, pose, and outfit with luminous cel lighting and crisp linework.',
    promptTemplate:
      'High-budget theatrical Japanese anime key visual portrait of {subject}, faithfully preserving facial structure, hairstyle, expression, and outfit from the reference, razor-sharp clean ink linework, luminous multi-tone cel shading, detailed sparkling anime eyes, dramatic cinematic rim lighting, subtle floating light particles, Makoto Shinkai and ufotable production polish, vibrant depth',
    negativePrompt:
      'photorealistic skin pores, 3d cgi render, western cartoon, blurry, messy sketch, extra fingers, distorted eyes, watermark, text',
    defaults: {
      subject: 'the person in the reference photo standing on a twilight rooftop overlooking glowing city lights',
    },
  },
  {
    id: 'anime_retro_90s_ova',
    category: 'anime',
    name: '90s Retro Cel-Shaded OVA',
    badge: 'Photo → 90s Cel',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'landscape',
    width: 1280,
    height: 768,
    steps: 25,
    cfg: 6.8,
    denoise: 0.58,
    accent: ['#f43f5e', '#fb923c', '#1c1917'],
    glyph: 'retro_anime',
    description: 'Authentic 1990s hand-painted animation cel look with analog 35mm film grain, rich shadow palettes, and nostalgic city-pop lighting.',
    promptTemplate:
      'Authentic 1994 Japanese OVA hand-painted animation cel screenshot of {subject}, classic 90s anime character design with expressive sharp eyes and flowing hair highlights, gouache painted background, warm tungsten neon glow, subtle 35mm analog film grain, gentle bloom halation, crisp hand-inked outlines, Cowboy Bebop and Evangelion era aesthetic',
    negativePrompt:
      'modern glossy 3d cgi, airbrushed plastic skin, photorealistic, blurry, low contrast, watermark, modern UI overlay',
    defaults: {
      subject: 'the person in the reference photo leaning against a neon-lit midnight cafe window',
    },
  },
  {
    id: 'anime_painterly_fantasy',
    category: 'anime',
    name: 'Painterly Fantasy Film Style',
    badge: 'Photo → Storybook',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'square',
    width: 1024,
    height: 1024,
    steps: 26,
    cfg: 6.5,
    denoise: 0.54,
    accent: ['#10b981', '#38bdf8', '#064e3b'],
    glyph: 'fantasy_anime',
    description: 'Warm hand-painted watercolor & gouache animated film aesthetic with sunlit skies and lush atmospheric depth.',
    promptTemplate:
      'Hand-painted theatrical animated fantasy film portrait of {subject}, warm expressive line art, lush watercolor and gouache background textures, billowing sunlit cumulus clouds and emerald hillside light, gentle golden hour rim glow, heartfelt nostalgic atmosphere, crisp clean character details',
    negativePrompt:
      'harsh neon cyberpunk, 3d cgi plastic, muddy dark colors, photorealistic photography, distorted anatomy, watermark, text',
    defaults: {
      subject: 'the person in the reference photo smiling in a sunlit meadow breeze',
    },
  },

  // ── PENCIL PORTRAIT & CARICATURE ───────────────────────────────────────────
  {
    id: 'sketch_graphite_portrait',
    category: 'sketch',
    name: 'Hand-Drawn Graphite Portrait',
    badge: 'Photo → Pencil',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'portrait',
    width: 832,
    height: 1152,
    steps: 25,
    cfg: 6.5,
    denoise: 0.52,
    accent: ['#e2e8f0', '#94a3b8', '#1e293b'],
    glyph: 'pencil',
    description: 'Fine-art hand-drawn 2B/6B graphite pencil portrait on textured cold-press cotton sketchbook paper with lifelike shading.',
    promptTemplate:
      'Masterpiece traditional hand-drawn graphite pencil portrait of {subject}, exact likeness, rendered with 2B and 6B mechanical and wooden pencils on warm cream cold-press cotton drawing paper, intricate directional crosshatching, soft tortillon blended skin shading, bright white eraser highlights in the eyes, delicate stray sketch construction lines at the collar fading naturally into blank paper',
    negativePrompt:
      'color photograph, neon colors, digital vector flat art, blurry, muddy smudges, deformed facial proportions, watermark, frame border',
    defaults: {
      subject: 'the person in the reference photo in a three-quarter classical portrait pose',
    },
  },
  {
    id: 'sketch_charcoal_dramatic',
    category: 'sketch',
    name: 'Charcoal & White Chalk Study',
    badge: 'Photo → Charcoal',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'portrait',
    width: 832,
    height: 1152,
    steps: 26,
    cfg: 6.8,
    denoise: 0.55,
    accent: ['#cbd5e1', '#64748b', '#0f172a'],
    glyph: 'charcoal',
    description: 'Expressive atelier charcoal & white chalk drawing on toned mid-gray archival paper with rich chiaroscuro lighting.',
    promptTemplate:
      'Fine art atelier portrait drawing of {subject} using compressed vine charcoal and white conte chalk on textured mid-tone warm gray archival paper, dramatic Rembrandt chiaroscuro lighting, bold expressive gestural strokes, luminous white chalk rim highlights along hair and cheekbones, rich velvety shadows, authentic hand-drawn gallery quality',
    negativePrompt:
      'full color, digital gloss, cartoon outlines, smooth airbrush, blurry, deformed eyes, watermark, text',
    defaults: {
      subject: 'the person in the reference photo with dramatic side lighting',
    },
  },
  {
    id: 'sketch_caricature',
    category: 'sketch',
    name: 'Hand-Drawn Editorial Caricature',
    badge: 'Photo → Caricature',
    mode: 'img2img',
    requiresPhotoRecommended: true,
    aspectId: 'portrait',
    width: 832,
    height: 1152,
    steps: 26,
    cfg: 7.2,
    denoise: 0.64,
    accent: ['#fbbf24', '#f97316', '#292524'],
    glyph: 'caricature',
    description: 'Playful, instantly recognizable boardwalk & editorial caricature exaggerating signature features with lively ink and colored-pencil wash.',
    promptTemplate:
      'Lively hand-drawn editorial caricature portrait of {subject}, affectionately exaggerating their most recognizable smile, hairstyle, and expression while keeping unmistakable likeness, dynamic expressive ink brush linework with warm Prismacolor colored-pencil and light watercolor wash shading on heavy off-white illustration bristol board, energetic playful personality, clean studio presentation',
    negativePrompt:
      'grotesque horror, unrecognizable face, photorealistic photo, 3d cgi render, blurry, muddy colors, watermark, text',
    defaults: {
      subject: 'the person in the reference photo laughing with expressive playful energy',
    },
  },

  // ── HOLO CARDS, BADGES & AVATARS ───────────────────────────────────────────
  {
    id: 'card_mythic_catalyst',
    category: 'cards_badges',
    name: 'Mythic Catalyst TCG Portrait Art',
    badge: 'Pantheon Art',
    mode: 'both',
    requiresPhotoRecommended: false,
    aspectId: 'tcg',
    width: 768,
    height: 1088,
    steps: 28,
    cfg: 7.0,
    denoise: 0.62,
    accent: ['#8b5cf6', '#38bdf8', '#0b1020'],
    glyph: 'holo_card',
    description: 'Luminous fantasy-sci-fi pantheon & elemental deity artwork framed cleanly for Card Forge’s 300 DPI sculpted borders — zero AI text glitches.',
    promptTemplate:
      'Epic collector trading card character illustration of {subject}, centered iconic heroic deity stance framed with generous breathing room at top and bottom for card overlays, luminous arcane elemental energy aura, intricate filigree armor or celestial robes, glowing eyes and floating runes, dramatic rim lighting, AAA painterly fantasy-scifi digital illustration, razor sharp detail, PURE FULL-BLEED ARTWORK ONLY, NO borders, NO card frame, NO text, NO numbers',
    negativePrompt:
      'card border, frame, text box, numbers, letters, typography, watermark, blurry, deformed face, extra fingers, cropped head',
    defaults: {
      subject: 'an ethereal twin-faced cosmic oracle woven from starlight and amethyst constellations between twin glowing moons',
    },
  },
  {
    id: 'card_holo_art',
    category: 'cards_badges',
    name: 'Holographic TCG Foil Illustration',
    badge: 'Card Art',
    mode: 'both',
    requiresPhotoRecommended: false,
    aspectId: 'tcg',
    width: 768,
    height: 1088,
    steps: 28,
    cfg: 7.0,
    denoise: 0.65,
    accent: ['#22d3ee', '#c084fc', '#0f172a'],
    glyph: 'holo_card',
    description: 'Full-bleed mythic trading card artwork engineered with dramatic focal composition, prismatic energy arcs, and zero distracting baked text.',
    promptTemplate:
      'Ultra-detailed full-bleed collectible trading card illustration of {subject}, epic centered heroic composition framed for a trading card art window, shimmering holographic rainbow prismatic energy arcs, dramatic volumetric rim lighting, crisp painterly fantasy-sci-fi brushwork, museum-grade Magic and Pokemon Secret Rare collector illustration quality, rich saturation, clean edges, NO text, NO borders, NO card frame',
    negativePrompt:
      'text, letters, card frame, border, watermark, signature, blurry, low contrast, muddy shadows, deformed hands, cropped head',
    defaults: {
      subject: 'a celestial crystalline dragon coiled around an ancient floating astrolabe above storm clouds',
    },
  },
  {
    id: 'badge_emblem_pro',
    category: 'cards_badges',
    name: 'Metallic Emblem & Esports Badge',
    badge: 'Badge / Logo',
    mode: 'both',
    requiresPhotoRecommended: false,
    aspectId: 'badge',
    width: 1024,
    height: 1024,
    steps: 24,
    cfg: 7.0,
    denoise: 0.6,
    accent: ['#eab308', '#06b6d4', '#111827'],
    glyph: 'badge',
    description: 'Symmetric vector-clean metallic crest, achievement badge, or channel emblem centered cleanly for crisp cropping or transparent export.',
    promptTemplate:
      'Symmetric luxury metallic crest emblem badge featuring {subject}, beveled brushed gold and obsidian enamel shield silhouette, crisp glowing cyan accent inlay, centered balanced composition with generous margin on a solid dark slate studio background, razor-sharp geometric vector precision, premium game rank medal and esports brand quality, no random gibberish text',
    negativePrompt:
      'cluttered background, asymmetrical mess, blurry, photorealistic room, low quality, misspelled words, watermark',
    defaults: {
      subject: 'a crowned cybernetic phoenix rising with geometric wings',
    },
  },
  {
    id: 'avatar_profile_luxury',
    category: 'cards_badges',
    name: 'Hero Profile Avatar (Circle-Safe)',
    badge: 'Profile Image',
    mode: 'both',
    requiresPhotoRecommended: false,
    aspectId: 'square',
    width: 1024,
    height: 1024,
    steps: 26,
    cfg: 6.8,
    denoise: 0.56,
    accent: ['#34d399', '#3b82f6', '#09090b'],
    glyph: 'avatar',
    description: 'Square profile portrait composed with a centered circular safe-zone, crisp rim light, and clean bokeh backdrop so it pops at 64px or 1024px.',
    promptTemplate:
      'High-impact square profile avatar portrait of {subject}, head and shoulders centered cleanly inside a circular avatar safe-zone, crisp studio rim lighting in electric teal and warm amber, ultra-sharp eyes and clean silhouette separation against a smooth atmospheric bokeh background, editorial digital painting polish, unmistakable readability even at small thumbnail sizes',
    negativePrompt:
      'off-center head, cropped forehead, busy distracting background, blurry eyes, watermark, text, frame circle',
    defaults: {
      subject: 'a visionary cyber-architect wearing subtle luminescent spectacles in futuristic streetwear',
    },
  },

  // ── COMIC BOOK & MANGA STYLES ──────────────────────────────────────────────
  {
    id: 'comic_american_ink',
    category: 'comic_manga',
    name: 'Modern American Comic Panel',
    badge: 'Comic Art',
    mode: 'both',
    requiresPhotoRecommended: false,
    aspectId: 'comic',
    width: 832,
    height: 1216,
    steps: 26,
    cfg: 7.2,
    denoise: 0.62,
    accent: ['#ef4444', '#3b82f6', '#111827'],
    glyph: 'comic',
    description: 'Dynamic Western comic book art with bold India-ink feathering, dramatic perspective, rich halftone color grading, and clean space for speech bubbles.',
    promptTemplate:
      'Dynamic modern American comic book panel illustration of {subject}, bold black India-ink linework with crisp feathering and deep spotted blacks, vibrant cinematic comic colorist palette with subtle Ben-Day halftone texture, dramatic low-angle foreshortening, clean negative space near upper corners for speech bubbles, Marvel and Image Comics master artist quality, NO speech bubbles, NO text',
    negativePrompt:
      'speech bubbles, text, captions, panel borders, blurry, photorealistic photography, muddy colors, watermark',
    defaults: {
      subject: 'a neon-armored vigilante leaping between rain-slicked Art Deco skyscrapers at midnight',
    },
  },
  {
    id: 'manga_bw_seinen',
    category: 'comic_manga',
    name: 'B&W Manga Screentone Panel',
    badge: 'Manga Art',
    mode: 'both',
    requiresPhotoRecommended: false,
    aspectId: 'comic',
    width: 832,
    height: 1216,
    steps: 26,
    cfg: 7.0,
    denoise: 0.6,
    accent: ['#f8fafc', '#94a3b8', '#09090b'],
    glyph: 'manga',
    description: 'High-contrast Japanese Seinen/Shonen black-and-white manga panel with G-pen ink lines, speedlines, and authentic screentone dot gradients.',
    promptTemplate:
      'Authentic Japanese black-and-white manga panel illustration of {subject}, razor-sharp G-pen ink linework, dramatic kinetic speedlines, genuine fine dot screentone shading gradients, pure crisp white paper highlights and deep rich black ink fills, intense cinematic framing, Seinen manga master quality, monochrome ink only, NO speech bubbles, NO Japanese or English text',
    negativePrompt:
      'color, full color, speech bubbles, text, kanji, panel border grid, blurry gray mud, 3d cgi, watermark',
    defaults: {
      subject: 'a lone cyber-samurai gripping a glowing katana hilt as wind whips past a shrine gate',
    },
  },
];

export const VIDEO_MOTION_PRESETS = [
  {
    id: 'holo_shimmer',
    name: 'Holo Card Shimmer & Micro-Orbit',
    cameraMotion: 'slow_orbit',
    motionStrength: 0.45,
    promptSuffix: 'subtle slow 3D orbital tilt, prismatic holographic foil shimmer sweeping smoothly across metallic edges, floating glowing dust motes, silky 24fps seamless motion',
  },
  {
    id: 'turntable_figure',
    name: 'Action Figure 360° Showcase',
    cameraMotion: 'turntable',
    motionStrength: 0.55,
    promptSuffix: 'smooth studio turntable rotation showcasing the collectible action figure and clear blister-pack reflections, steady studio softbox highlights, crisp commercial reveal',
  },
  {
    id: 'cinematic_dolly',
    name: 'Cinematic Slow Push-In',
    cameraMotion: 'dolly_in',
    motionStrength: 0.5,
    promptSuffix: 'cinematic slow camera push-in with gentle atmospheric depth parallax, subtle volumetric light rays drifting, filmic 24fps stabilization',
  },
  {
    id: 'anime_wind',
    name: 'Anime Wind & Living Atmosphere',
    cameraMotion: 'static_living',
    motionStrength: 0.6,
    promptSuffix: 'lively wind flowing through hair and clothing, drifting glowing petals and clouds, subtle eye blink and breathing motion, theatrical anime key-frame animation',
  },
  {
    id: 'comic_parallax',
    name: 'Comic Panel 2.5D Motion',
    cameraMotion: 'parallax',
    motionStrength: 0.5,
    promptSuffix: 'dramatic 2.5D comic motion parallax, crackling energy sparks, rain streaks moving in slow motion, bold graphic camera drift',
  },
];

/**
 * Compile a curated visual preset into final positive/negative prompts and generation params.
 */
export function compilePresetPrompt(preset, overrides = {}) {
  if (!preset) {
    return {
      prompt: String(overrides.subject || '').trim(),
      negativePrompt: String(overrides.negativePrompt || 'blurry, low quality, artifacts, watermark'),
      width: overrides.width || 1024,
      height: overrides.height || 1024,
      steps: overrides.steps || 25,
      cfg: overrides.cfg || 7.0,
      denoise: overrides.denoise ?? 0.6,
    };
  }
  const merged = { ...(preset.defaults || {}), ...overrides };
  const subject = String(merged.subject || preset.defaults?.subject || 'detailed subject').trim();
  const extraDetails = String(overrides.extraDetails || '').trim();

  let prompt = preset.promptTemplate
    .replaceAll('{subject}', subject)
    .replaceAll('{figureName}', String(merged.figureName || 'SOVEREIGN EDITION').trim())
    .replaceAll('{figureTagline}', String(merged.figureTagline || 'LIMITED SERIES').trim())
    .replaceAll('{figureAccessories}', String(merged.figureAccessories || 'collector accessories').trim())
    .replaceAll('{figureBoxColor}', String(merged.figureBoxColor || 'obsidian and gold').trim());

  if (extraDetails) {
    prompt = `${prompt}, ${extraDetails}`;
  }

  return {
    prompt,
    negativePrompt: overrides.negativePrompt || preset.negativePrompt,
    width: overrides.width || preset.width || 1024,
    height: overrides.height || preset.height || 1024,
    steps: overrides.steps || preset.steps || 25,
    cfg: overrides.cfg || preset.cfg || 7.0,
    denoise: overrides.denoise ?? preset.denoise ?? 0.6,
  };
}

/**
 * Generate a rich, crisp SVG data URI visual reference card for any preset so
 * the Reference Gallery works 100% offline with zero broken remote links.
 */
export function getPresetPreviewSvg(preset) {
  const [c1, c2, c3] = preset?.accent || ['#f59e0b', '#ec4899', '#0f172a'];
  const glyph = preset?.glyph || 'holo_card';
  const safeName = String(preset?.name || 'Preset').replace(/[<>&"]/g, '');

  const shapesByGlyph = {
    blister: `
      <rect x="46" y="14" width="128" height="172" rx="12" fill="${c3}" stroke="${c1}" stroke-width="2.5"/>
      <rect x="54" y="22" width="112" height="24" rx="5" fill="${c1}" opacity="0.9"/>
      <circle cx="110" cy="34" r="4" fill="${c3}"/>
      <rect x="58" y="54" width="68" height="122" rx="10" fill="url(#g1)" opacity="0.22" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.5"/>
      <circle cx="92" cy="84" r="14" fill="${c1}" opacity="0.95"/>
      <rect x="78" y="102" width="28" height="44" rx="8" fill="${c2}" opacity="0.9"/>
      <line x1="78" y1="112" x2="66" y2="132" stroke="${c1}" stroke-width="6" stroke-linecap="round"/>
      <line x1="106" y1="112" x2="118" y2="132" stroke="${c1}" stroke-width="6" stroke-linecap="round"/>
      <rect x="132" y="60" width="30" height="28" rx="6" fill="#ffffff" fill-opacity="0.16" stroke="${c2}" stroke-width="1.2"/>
      <rect x="132" y="96" width="30" height="28" rx="6" fill="#ffffff" fill-opacity="0.16" stroke="${c1}" stroke-width="1.2"/>
      <rect x="132" y="132" width="30" height="36" rx="6" fill="#ffffff" fill-opacity="0.16" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.2"/>
    `,
    statue: `
      <ellipse cx="110" cy="166" rx="56" ry="14" fill="${c1}" opacity="0.35" stroke="${c1}" stroke-width="2"/>
      <path d="M72 162 L84 140 L136 140 L148 162 Z" fill="${c3}" stroke="${c2}" stroke-width="2"/>
      <circle cx="110" cy="64" r="17" fill="${c1}"/>
      <path d="M84 138 L94 86 L126 86 L136 138 Z" fill="url(#g1)"/>
      <path d="M62 88 Q110 38 158 88" fill="none" stroke="${c1}" stroke-width="2" stroke-dasharray="4 4" opacity="0.7"/>
    `,
    vinyl: `
      <rect x="122" y="42" width="66" height="124" rx="10" fill="${c3}" stroke="${c2}" stroke-width="2"/>
      <rect x="130" y="58" width="50" height="82" rx="6" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.4"/>
      <rect x="44" y="46" width="68" height="62" rx="22" fill="url(#g1)" stroke="#ffffff" stroke-opacity="0.4"/>
      <circle cx="64" cy="76" r="7" fill="#09090b"/><circle cx="92" cy="76" r="7" fill="#09090b"/>
      <circle cx="66" cy="74" r="2" fill="#ffffff"/><circle cx="94" cy="74" r="2" fill="#ffffff"/>
      <rect x="58" y="112" width="40" height="46" rx="14" fill="${c1}" opacity="0.9"/>
    `,
    anime: `
      <circle cx="110" cy="96" r="58" fill="url(#g1)" opacity="0.25"/>
      <path d="M68 156 Q110 120 152 156 L152 186 L68 186 Z" fill="${c2}" opacity="0.8"/>
      <path d="M72 90 Q110 26 148 90 Q142 132 110 138 Q78 132 72 90 Z" fill="#fef3c7"/>
      <path d="M66 94 Q78 36 112 34 Q148 36 154 96 Q138 66 112 64 Q82 66 66 94 Z" fill="${c1}"/>
      <ellipse cx="94" cy="96" rx="8" ry="10" fill="${c2}"/><ellipse cx="126" cy="96" rx="8" ry="10" fill="${c2}"/>
      <circle cx="96" cy="93" r="3" fill="#fff"/><circle cx="128" cy="93" r="3" fill="#fff"/>
      <path d="M40 42 L48 50 M170 48 L180 38 M166 130 L178 124" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
    `,
    retro_anime: `
      <rect x="18" y="24" width="184" height="132" rx="8" fill="${c3}" stroke="${c1}" stroke-width="2"/>
      <circle cx="152" cy="64" r="24" fill="${c2}" opacity="0.85"/>
      <path d="M22 134 L64 90 L98 118 L138 82 L198 134 Z" fill="${c1}" opacity="0.5"/>
      <line x1="20" y1="42" x2="200" y2="42" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
      <line x1="20" y1="74" x2="200" y2="74" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
      <line x1="20" y1="106" x2="200" y2="106" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
    `,
    fantasy_anime: `
      <circle cx="156" cy="54" r="24" fill="#fef08a" opacity="0.85"/>
      <path d="M16 146 Q68 96 122 134 Q166 106 204 142 L204 188 L16 188 Z" fill="${c1}" opacity="0.7"/>
      <path d="M36 90 Q58 64 88 80 Q114 58 142 84 Q158 92 142 104 L42 104 Z" fill="#ffffff" opacity="0.75"/>
    `,
    pencil: `
      <rect x="26" y="16" width="168" height="168" rx="8" fill="#f8fafc" opacity="0.94"/>
      <ellipse cx="110" cy="86" rx="34" ry="42" fill="none" stroke="#334155" stroke-width="2.2"/>
      <path d="M84 78 Q96 72 104 78 M116 78 Q124 72 136 78" fill="none" stroke="#1e293b" stroke-width="2"/>
      <path d="M62 162 Q110 124 158 162" fill="none" stroke="#475569" stroke-width="2.5" stroke-dasharray="6 4"/>
      <path d="M40 34 L72 66 M44 44 L66 66 M150 38 L178 66 M146 50 L172 76" stroke="#94a3b8" stroke-width="1.2"/>
      <path d="M148 156 L186 118 L194 126 L156 164 Z" fill="#f59e0b" stroke="#1e293b" stroke-width="1.5"/>
    `,
    charcoal: `
      <rect x="26" y="16" width="168" height="168" rx="8" fill="#334155"/>
      <ellipse cx="110" cy="86" rx="36" ry="44" fill="#0f172a" opacity="0.65"/>
      <path d="M110 42 A36 44 0 0 1 146 86 A36 44 0 0 1 110 130" fill="none" stroke="#f8fafc" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M58 162 Q110 124 162 162" fill="none" stroke="#e2e8f0" stroke-width="3" opacity="0.8"/>
    `,
    caricature: `
      <rect x="24" y="16" width="172" height="168" rx="10" fill="#fefce8"/>
      <ellipse cx="110" cy="84" rx="44" ry="48" fill="#fed7aa" stroke="#1c1917" stroke-width="3"/>
      <circle cx="94" cy="76" r="10" fill="#ffffff" stroke="#1c1917" stroke-width="2.5"/>
      <circle cx="126" cy="74" r="12" fill="#ffffff" stroke="#1c1917" stroke-width="2.5"/>
      <circle cx="96" cy="76" r="4" fill="#1c1917"/><circle cx="124" cy="74" r="4.5" fill="#1c1917"/>
      <path d="M84 102 Q110 124 138 100 Z" fill="#ffffff" stroke="#1c1917" stroke-width="2.5"/>
      <path d="M74 44 Q110 16 148 44" fill="none" stroke="${c2}" stroke-width="8" stroke-linecap="round"/>
    `,
    holo_card: `
      <rect x="48" y="12" width="124" height="176" rx="12" fill="${c3}" stroke="url(#g1)" stroke-width="4"/>
      <rect x="58" y="24" width="104" height="92" rx="6" fill="url(#g1)" opacity="0.75"/>
      <polygon points="110,36 124,68 152,72 130,92 136,112 110,98 84,112 90,92 68,72 96,68" fill="#ffffff" fill-opacity="0.85"/>
      <rect x="58" y="124" width="104" height="52" rx="5" fill="#ffffff" fill-opacity="0.1" stroke="${c1}" stroke-opacity="0.5"/>
      <line x1="66" y1="138" x2="148" y2="138" stroke="#ffffff" stroke-opacity="0.65" stroke-width="3" stroke-linecap="round"/>
      <line x1="66" y1="152" x2="132" y2="152" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="66" y1="164" x2="114" y2="164" stroke="${c1}" stroke-width="2.5" stroke-linecap="round"/>
    `,
    badge: `
      <path d="M110 22 L166 44 L158 118 L110 174 L62 118 L54 44 Z" fill="${c3}" stroke="url(#g1)" stroke-width="5"/>
      <path d="M110 42 L148 56 L142 110 L110 150 L78 110 L72 56 Z" fill="url(#g1)" opacity="0.32"/>
      <polygon points="110,58 122,86 150,88 128,106 135,134 110,118 85,134 92,106 70,88 98,86" fill="${c1}"/>
    `,
    avatar: `
      <circle cx="110" cy="100" r="70" fill="url(#g1)" opacity="0.22" stroke="${c1}" stroke-width="2.5" stroke-dasharray="6 4"/>
      <circle cx="110" cy="100" r="58" fill="${c3}" stroke="url(#g1)" stroke-width="3.5"/>
      <circle cx="110" cy="82" r="20" fill="${c1}"/>
      <path d="M74 140 Q110 106 146 140" fill="${c2}" opacity="0.9"/>
    `,
    comic: `
      <rect x="20" y="16" width="180" height="168" rx="6" fill="#ffffff"/>
      <rect x="28" y="24" width="76" height="72" fill="${c1}" stroke="#09090b" stroke-width="3"/>
      <rect x="112" y="24" width="80" height="72" fill="${c2}" stroke="#09090b" stroke-width="3"/>
      <rect x="28" y="104" width="164" height="72" fill="${c3}" stroke="#09090b" stroke-width="3"/>
      <ellipse cx="144" cy="46" rx="26" ry="14" fill="#ffffff" stroke="#09090b" stroke-width="2"/>
      <polygon points="62,120 76,144 48,144" fill="#facc15"/>
    `,
    manga: `
      <rect x="20" y="16" width="180" height="168" rx="6" fill="#f8fafc"/>
      <polygon points="28,24 192,24 192,86 28,108" fill="#0f172a"/>
      <line x1="110" y1="60" x2="34" y2="30" stroke="#ffffff" stroke-width="2"/>
      <line x1="110" y1="60" x2="186" y2="32" stroke="#ffffff" stroke-width="2"/>
      <line x1="110" y1="60" x2="186" y2="76" stroke="#ffffff" stroke-width="1.5"/>
      <rect x="28" y="116" width="74" height="60" fill="#cbd5e1" stroke="#09090b" stroke-width="3"/>
      <rect x="110" y="104" width="82" height="72" fill="#e2e8f0" stroke="#09090b" stroke-width="3"/>
    `,
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200" width="220" height="200">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
      <radialGradient id="bg" cx="50%" cy="35%" r="75%">
        <stop offset="0%" stop-color="${c2}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${c3}" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="220" height="200" rx="14" fill="${c3}"/>
    <rect width="220" height="200" rx="14" fill="url(#bg)"/>
    ${shapesByGlyph[glyph] || shapesByGlyph.holo_card}
    <title>${safeName}</title>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
