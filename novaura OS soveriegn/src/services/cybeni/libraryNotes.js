// libraryNotes.js — Pinned versions and short API notes for common packages.
//
// Local models often write code for a different major version of a library than
// the one esm.sh serves as "latest", or forget a setup step. Pinning the major
// version the notes describe, and putting the note in front of the model only
// when the package is in play, removes most of that guesswork.

/** Package -> version range served in the preview. */
export const PINNED = {
  'react-router-dom': '6',
  'react-router': '6',
  'framer-motion': '11',
  zustand: '4',
  three: '0.160.0',
  'chart.js': '4',
  'react-chartjs-2': '5',
  recharts: '2',
  dexie: '4',
  howler: '2',
  tone: '14',
  'date-fns': '3',
  uuid: '9',
  phaser: '3',
  'matter-js': '0.19',
  marked: '12',
  dompurify: '3',
  '@tanstack/react-query': '5',
  'canvas-confetti': '1',
};

const NOTES = {
  'react-router-dom': 'react-router-dom v6: use HashRouter (the preview has no server routes, so BrowserRouter paths break on reload). <Routes><Route path="/x" element={<X />} /></Routes>, useNavigate(), <Link to="/x">.',
  three: 'three r160: import * as THREE from \'three\'; addons from \'three/examples/jsm/controls/OrbitControls.js\'. Size the renderer to its container, handle resize, use renderer.setAnimationLoop, and dispose geometries/renderer on unmount.',
  'chart.js': 'Chart.js v4: import { Chart, registerables } from \'chart.js\'; Chart.register(...registerables) once. Destroy an existing chart before creating another on the same canvas.',
  'react-chartjs-2': 'react-chartjs-2 v5 needs Chart.js parts registered first: import { Chart, registerables } from \'chart.js\'; Chart.register(...registerables).',
  recharts: 'recharts v2: wrap charts in <ResponsiveContainer width="100%" height={300}>; a parent with no height renders an empty chart.',
  'framer-motion': 'framer-motion v11: import { motion, AnimatePresence } from \'framer-motion\'.',
  zustand: 'zustand v4: import { create } from \'zustand\'; const useStore = create((set) => ({ items: [], add: (i) => set((s) => ({ items: [...s.items, i] })) })).',
  dexie: 'Dexie v4: const db = new Dexie(\'name\'); db.version(1).stores({ items: \'++id, createdAt\' }); every call is async.',
  howler: 'howler v2: new Howl({ src: [url] }).play(); browsers only start audio after a user gesture (a click or key press).',
  tone: 'Tone.js v14: call await Tone.start() inside a click handler before any sound; schedule with Tone.Transport.',
  phaser: 'Phaser 3: new Phaser.Game({ type: Phaser.AUTO, parent: \'game\', width, height, scene: { preload, create, update } }). There are no asset files: draw textures with this.add.graphics() and generateTexture, or use data URLs.',
  'matter-js': 'matter-js 0.19: const engine = Matter.Engine.create(); Matter.Render.create({ element, engine }); Matter.Runner.run(Matter.Runner.create(), engine).',
  marked: 'marked v12: marked.parse(text) returns HTML; sanitize it with DOMPurify.sanitize before using dangerouslySetInnerHTML.',
  dompurify: 'DOMPurify v3: import DOMPurify from \'dompurify\'; DOMPurify.sanitize(html).',
  '@tanstack/react-query': 'TanStack Query v5: wrap the app in <QueryClientProvider client={new QueryClient()}>; useQuery({ queryKey: [...], queryFn }).',
  uuid: 'uuid v9: import { v4 as uuidv4 } from \'uuid\'; or use crypto.randomUUID() with no package.',
  'date-fns': 'date-fns v3: named imports, e.g. import { format, addDays } from \'date-fns\'.',
  '@cybeni/backend': '@cybeni/backend (built-in): import { db, auth, storage, ai } from \'@cybeni/backend\'. db.collection(\'items\') supports list/get/insert/update/remove/seed/subscribe; auth supports currentUser/signUp/signIn/demoSignIn/signOut/onAuthChange; storage has get/set; ai.chat(prompt) uses Sovereign OS AI.',
  '@novaura/sdk': '@novaura/sdk (alias of @cybeni/backend / window.novaura): provides db, auth, storage, and ai APIs with zero configuration.',
};

/** Split "pkg/sub/path" or "@scope/pkg/sub" into [package, subpath]. */
export function splitSpecifier(spec) {
  const parts = String(spec).split('/');
  const n = spec.startsWith('@') ? 2 : 1;
  return [parts.slice(0, n).join('/'), parts.slice(n).join('/')];
}

/** The specifier with its pinned version, e.g. "three/examples/x.js" -> "three@0.160.0/examples/x.js". */
export function pinnedSpecifier(spec) {
  const [pkg, sub] = splitSpecifier(spec);
  if (/@\d/.test(pkg.replace(/^@/, '')) || !PINNED[pkg]) return spec;
  return `${pkg}@${PINNED[pkg]}${sub ? `/${sub}` : ''}`;
}

// Package names that are also ordinary words ("three columns", "a calm tone") only
// count when written as an import or as "name.js".
const COMMON_WORDS = new Set(['three', 'tone', 'marked', 'uuid']);
const ALIASES = { 'react router': 'react-router-dom', 'tanstack query': '@tanstack/react-query', 'react query': '@tanstack/react-query' };

/** Notes for the packages mentioned in any of the given texts (request, plan, code). */
export function libraryNotes(...texts) {
  const text = texts.join('\n');
  const found = new Set();
  for (const pkg of Object.keys(NOTES)) {
    const escaped = pkg.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const asImport = new RegExp(`['"\`]${escaped}(['"\`/])`).test(text);
    const asName = new RegExp(`\\b${escaped}\\.js\\b`, 'i').test(text)
      || (!COMMON_WORDS.has(pkg) && new RegExp(`(^|[^\\w-])${escaped}([^\\w-]|$)`, 'i').test(text));
    if (asImport || asName) found.add(pkg);
  }
  for (const [alias, pkg] of Object.entries(ALIASES)) if (text.toLowerCase().includes(alias)) found.add(pkg);
  return [...found].map(pkg => `- ${NOTES[pkg]}`).join('\n');
}
