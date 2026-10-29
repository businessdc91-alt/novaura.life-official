// starters.js — Known-good starting points for new Cybeni projects.
//
// Local models write much better code when they extend a working scaffold than
// when they start from a blank page: the entry point, mounting and game loop
// are already right, so every pass goes into the actual features.

const REACT = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.jsx',
    content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
`,
  },
  {
    path: 'src/App.jsx',
    content: `import React from 'react';

// Starter screen: replace with the real app.
export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-semibold">Starting…</h1>
    </main>
  );
}
`,
  },
];

const GAME = [
  {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Game</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0b0f1a; color: #e2e8f0; font-family: system-ui, sans-serif; overflow: hidden; }
      #game { display: block; width: 100vw; height: 100vh; }
      #hud { position: fixed; top: 12px; left: 16px; font-size: 18px; pointer-events: none; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <div id="hud">Score: <span id="score">0</span></div>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.js',
    content: `// Starter game loop: fixed canvas sizing, keyboard input and a delta-time loop.
// Replace update() and draw() with the real game.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const keys = new Set();

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * ratio);
  canvas.height = Math.floor(canvas.clientHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  keys.add(e.key);
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.key));
resize();

const state = { x: 100, y: 100, score: 0 };

function update(dt) {
  const speed = 240;
  if (keys.has('ArrowLeft')) state.x -= speed * dt;
  if (keys.has('ArrowRight')) state.x += speed * dt;
  if (keys.has('ArrowUp')) state.y -= speed * dt;
  if (keys.has('ArrowDown')) state.y += speed * dt;
}

function draw() {
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(state.x, state.y, 24, 24);
  document.getElementById('score').textContent = String(state.score);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
draw();
requestAnimationFrame(frame);
`,
  },
];

const GAME_RE = /\b(game|platformer|shooter|arcade|snake|tetris|pong|breakout|asteroids|flappy|runner|space invaders|canvas)\b/i;
// Apps about games (a game library, a tournament tracker) are ordinary apps.
const ABOUT_GAMES_RE = /\b(tracker|manager|catalog(ue)?|collection|database|store|shop|reviews?|blog|dashboard|library|wiki|planner|scheduler)\b/i;

/** Which starter fits a request: 'game' for canvas games, otherwise 'react'. */
export function pickStarter(request) {
  const text = String(request || '');
  if (!GAME_RE.test(text)) return 'react';
  if (/\b(react|tailwind)\b/i.test(text)) return 'react';
  if (ABOUT_GAMES_RE.test(text)) return 'react';
  return 'game';
}

export function starterFiles(kind) {
  return (kind === 'game' ? GAME : REACT).map(f => ({ ...f }));
}

export const STARTER_NOTE = {
  react: 'The project starts from a working React + Tailwind starter (index.html, src/main.jsx, src/App.jsx). Build the app on it; replace the starter screen.',
  game: 'The project starts from a working canvas game starter (index.html with a #game canvas and #hud, src/main.js with resizing, keyboard input and a delta-time loop). Build the game on it; replace update() and draw().',
};
