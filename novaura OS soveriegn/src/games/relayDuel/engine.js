// engine.js — Relay Duel: an artillery game between two node operators on a
// night skyline of server towers.
//
// Everything here is pure and deterministic: the city, the per-turn signal
// interference and every shot follow from the match seed and the moves, so two
// nodes playing over the mesh compute identical results from just
// { angle, power } per turn. Rendering and input live in RelayDuelWindow.jsx.

// Both dimensions must be multiples of the cell size (the destructible grid).
export const WORLD = { width: 960, height: 544, cell: 8 };
export const ROUNDS_TO_WIN = 3;
export const EASY_WINS_TO_UNLOCK_CYBENI = 10;

export const CHARACTERS = {
  nova: {
    id: 'nova', name: 'Nova', color: '#22d3ee', accent: '#a5f3fc',
    perk: 'Precision Sight', perkText: 'An aim guide shows the start of your arc.',
    lines: { turn: 'Running the numbers.', win: 'Calculated.', hit: 'Packet delivered.' },
  },
  aura: {
    id: 'aura', name: 'Aura', color: '#c084fc', accent: '#f0abfc',
    perk: 'Resonance', perkText: 'Your orbs can bounce off two antennas instead of one.',
    lines: { turn: 'Feel the frequency.', win: 'Told you I would find you.', hit: 'Right on the heartbeat.' },
  },
  cybeni: {
    id: 'cybeni', name: 'Cybeni', color: '#34d399', accent: '#fbbf24',
    perk: 'Architect', perkText: 'A bigger blast radius.',
    unlock: `Win ${EASY_WINS_TO_UNLOCK_CYBENI} matches against the Easy computer.`,
    lines: {
      turn: 'Drafting the blueprint.',
      win: 'I am Cybeni, the Sovereign Architect. The mouse is little but the frequency is strong. Cybeni out.',
      hit: 'Structural adjustment complete.',
    },
  },
};

export const DIFFICULTIES = {
  easy: { label: 'Easy', angleStep: 10, powerStep: 10, angleNoise: 9, powerNoise: 11 },
  normal: { label: 'Normal', angleStep: 5, powerStep: 5, angleNoise: 3.5, powerNoise: 4.5 },
  sharp: { label: 'Sharp', angleStep: 2.5, powerStep: 2.5, angleNoise: 1.2, powerNoise: 1.6 },
};

const GRAVITY = [
  { id: 'normal', label: 'Standard gravity', g: 420 },
  { id: 'moon', label: 'Moon round', g: 190 },
  { id: 'heavy', label: 'Heavy round', g: 640 },
];
const MAX_SPEED = 700;      // px/s at power 100
const MAX_WIND = 130;       // px/s² of signal interference
const DT = 1 / 120;
const MAX_STEPS = 120 * 20;
const ORB_RADIUS = 4;
const PLAYER_RADIUS = 13;
const BLAST = { base: 26, architect: 34 };

/** Small seeded PRNG (mulberry32); same seed, same sequence on every machine. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mix = (...n) => n.reduce((h, v) => (Math.imul(h ^ (v >>> 0), 2654435761) >>> 0), 0x9e3779b9);

// ── The city ───────────────────────────────────────────────────────────────

/**
 * A new round: skyline, antennas, both operators on their rooftops, gravity.
 * `characters` = [p1, p2] character ids.
 */
export function createRound(seed, round, characters) {
  const r = rng(mix(seed, round));
  const { width, height, cell } = WORLD;
  const cols = width / cell;
  const rows = height / cell;
  const grid = new Uint8Array(cols * rows);
  const towers = [];
  let x = 0;
  while (x < width) {
    let w = cell * (6 + Math.floor(r() * 7));
    if (width - x - w < cell * 6) w = width - x; // no sliver at the right edge
    const h = cell * (14 + Math.floor(r() * 32));
    towers.push({
      x, w, h,
      hue: [196, 268, 162, 220, 300][Math.floor(r() * 5)],
      windowSeed: Math.floor(r() * 1e9),
    });
    x += w;
  }
  const p1Tower = towers[1];
  const p2Tower = towers[towers.length - 2];
  // Operators stand above their neighbours, so neither starts in a well no arc can reach.
  for (const [t, i] of [[p1Tower, 1], [p2Tower, towers.length - 2]]) {
    const neighbours = Math.max(towers[i - 1].h, towers[i + 1]?.h || 0);
    t.h = Math.min(height - cell * 8, Math.max(t.h, neighbours + cell * 2));
  }
  for (const t of towers) {
    for (let cx = t.x / cell; cx < (t.x + t.w) / cell; cx++) {
      for (let cy = rows - t.h / cell; cy < rows; cy++) grid[cy * cols + cx] = 1;
    }
  }
  const antennas = [];
  towers.forEach((t, i) => {
    if (i < 2 || i > towers.length - 3 || r() > 0.4) return;
    antennas.push({ x: t.x + Math.floor(t.w / 2), base: height - t.h, h: 34 + Math.floor(r() * 46), alive: true });
  });
  const standOn = (t) => ({ x: t.x + Math.floor(t.w / 2), y: height - t.h });
  const gravity = round === 1 ? GRAVITY[0] : (() => {
    const roll = r();
    return roll < 0.6 ? GRAVITY[0] : roll < 0.8 ? GRAVITY[1] : GRAVITY[2];
  })();
  return {
    seed, round, grid, towers, antennas, gravity,
    players: [
      { ...standOn(p1Tower), character: characters[0], alive: true },
      { ...standOn(p2Tower), character: characters[1], alive: true },
    ],
  };
}

/** Signal interference for one turn (horizontal acceleration, + blows right). */
export function interference(seed, round, turnNumber) {
  const r = rng(mix(seed, round, turnNumber, 77));
  return Math.round((r() * 2 - 1) * MAX_WIND);
}

const solidAt = (state, px, py) => {
  const { width, height, cell } = WORLD;
  if (px < 0 || px >= width || py < 0 || py >= height) return false;
  return state.grid[Math.floor(py / cell) * (width / cell) + Math.floor(px / cell)] === 1;
};

// ── Shots ──────────────────────────────────────────────────────────────────

/**
 * Flies one shot without changing the state. angle 0–90 (degrees above the
 * horizontal, toward the opponent), power 0–100. Returns the path and what it
 * hit: { points, bounces, explosion: {x,y,r}|null, hitPlayer: index|null, result }.
 */
export function simulateShot(state, shooter, { angle, power }, wind) {
  const me = state.players[shooter];
  const perk = me.character;
  const dir = shooter === 0 ? 1 : -1;
  const rad = (Math.max(0, Math.min(90, angle)) * Math.PI) / 180;
  const speed = (Math.max(0, Math.min(100, power)) / 100) * MAX_SPEED;
  let x = me.x + dir * 8;
  let y = me.y - PLAYER_RADIUS * 2;
  let vx = Math.cos(rad) * speed * dir;
  let vy = -Math.sin(rad) * speed;
  let bouncesLeft = perk === 'aura' ? 2 : 1;
  const usedAntennas = new Set();
  const points = [{ x, y }];
  const bounces = [];
  const blastR = perk === 'cybeni' ? BLAST.architect : BLAST.base;
  const { width, height } = WORLD;

  for (let step = 0; step < MAX_STEPS; step++) {
    vx += wind * DT;
    vy += state.gravity.g * DT;
    x += vx * DT;
    y += vy * DT;
    if (step % 2 === 0) points.push({ x, y });

    if (x < -40 || x > width + 40 || y > height + 40) {
      return { points, bounces, explosion: null, hitPlayer: null, result: 'miss' };
    }
    // Operators (a direct hit, including on yourself).
    for (let i = 0; i < 2; i++) {
      const p = state.players[i];
      if (step > 6 || i !== shooter) {
        if (Math.hypot(x - p.x, y - (p.y - PLAYER_RADIUS)) < PLAYER_RADIUS + ORB_RADIUS) {
          points.push({ x, y });
          return { points, bounces, explosion: { x, y, r: blastR }, hitPlayer: i, result: 'hit-player' };
        }
      }
    }
    // Antenna masts: bounce off while bounces remain, else knock it down.
    for (let a = 0; a < state.antennas.length; a++) {
      const ant = state.antennas[a];
      if (!ant.alive || usedAntennas.has(a)) continue;
      if (Math.abs(x - ant.x) <= ORB_RADIUS + 1.5 && y >= ant.base - ant.h && y <= ant.base) {
        if (bouncesLeft > 0) {
          bouncesLeft--;
          usedAntennas.add(a);
          vx = -vx * 0.72;
          vy *= 0.85;
          x = ant.x + Math.sign(vx) * (ORB_RADIUS + 2);
          bounces.push({ x, y, antenna: a });
        } else {
          points.push({ x, y });
          return { points, bounces, explosion: { x, y, r: blastR * 0.7, antenna: a }, hitPlayer: null, result: 'hit-antenna' };
        }
      }
    }
    if (solidAt(state, x, y)) {
      points.push({ x, y });
      const explosion = { x, y, r: blastR };
      return { points, bounces, explosion, hitPlayer: playerInBlast(state, explosion, shooter), result: 'hit-tower' };
    }
  }
  return { points, bounces, explosion: null, hitPlayer: null, result: 'miss' };
}

// The opponent first: hitting them wins even if the blast also reaches you.
function playerInBlast(state, explosion, shooter) {
  const order = [1 - shooter, shooter];
  for (const i of order) {
    const p = state.players[i];
    if (Math.hypot(explosion.x - p.x, explosion.y - (p.y - PLAYER_RADIUS)) < explosion.r + PLAYER_RADIUS * 0.6) return i;
  }
  return null;
}

/**
 * Applies a shot's outcome to a copy of the state: blast crater, fallen
 * antenna, operators dropping to whatever is left under them. Returns
 * { state, loser } where loser is the index of the operator who lost the round
 * (hit, or fell off the bottom), or null.
 */
export function applyShot(state, outcome) {
  const next = {
    ...state,
    grid: state.grid.slice(),
    antennas: state.antennas.map(a => ({ ...a })),
    players: state.players.map(p => ({ ...p })),
  };
  let loser = outcome.hitPlayer;
  const ex = outcome.explosion;
  if (ex) {
    const { width, cell } = WORLD;
    const cols = width / cell;
    const r2 = ex.r * ex.r;
    for (let cy = Math.floor((ex.y - ex.r) / cell); cy <= Math.floor((ex.y + ex.r) / cell); cy++) {
      for (let cx = Math.floor((ex.x - ex.r) / cell); cx <= Math.floor((ex.x + ex.r) / cell); cx++) {
        if (cx < 0 || cx >= cols || cy < 0 || cy >= WORLD.height / cell) continue;
        const dx = cx * cell + cell / 2 - ex.x;
        const dy = cy * cell + cell / 2 - ex.y;
        if (dx * dx + dy * dy <= r2) next.grid[cy * cols + cx] = 0;
      }
    }
    if (ex.antenna !== undefined) next.antennas[ex.antenna].alive = false;
    // Antennas lose their footing when the roof under them is gone.
    for (const ant of next.antennas) {
      if (ant.alive && !solidAt(next, ant.x, ant.base + 2)) ant.alive = false;
    }
    // Operators settle onto whatever is left beneath them.
    next.players.forEach((p, i) => {
      if (loser === i) return;
      let y = p.y;
      while (y < WORLD.height && !solidAt(next, p.x, y + 1)) y += 1;
      if (y >= WORLD.height - 1) {
        p.alive = false;
        if (loser === null) loser = i;
      } else {
        p.y = y;
      }
    });
  }
  if (loser !== null) next.players[loser].alive = false;
  return { state: next, loser };
}

// ── The computer opponent ──────────────────────────────────────────────────

/**
 * Picks a shot by trying a grid of angles and powers (finer at higher
 * difficulty) and aiming for the one that lands closest to the opponent, then
 * adds human-like error. `random` keeps it deterministic in tests.
 */
export function chooseComputerShot(state, shooter, wind, difficulty = 'normal', random = Math.random) {
  const d = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const target = state.players[1 - shooter];
  let best = { angle: 45, power: 60, score: -Infinity };
  for (let angle = 15; angle <= 80; angle += d.angleStep) {
    for (let power = 30; power <= 100; power += d.powerStep) {
      const out = simulateShot(state, shooter, { angle, power }, wind);
      let score;
      if (out.hitPlayer === 1 - shooter) score = 10000;
      else if (out.hitPlayer === shooter) score = -10000;
      else {
        const end = out.explosion || out.points[out.points.length - 1];
        score = -Math.hypot(end.x - target.x, end.y - target.y);
      }
      if (score > best.score) best = { angle, power, score };
    }
  }
  const jitter = (n) => (random() * 2 - 1) * n;
  return {
    angle: Math.round(Math.max(5, Math.min(88, best.angle + jitter(d.angleNoise))) * 10) / 10,
    power: Math.round(Math.max(15, Math.min(100, best.power + jitter(d.powerNoise))) * 10) / 10,
  };
}

// ── Progress ───────────────────────────────────────────────────────────────

export function isCybeniUnlocked(progress) {
  return (progress?.easyWins || 0) >= EASY_WINS_TO_UNLOCK_CYBENI;
}

/** Progress after a finished match against the computer. */
export function recordMatch(progress, { won, difficulty }) {
  const p = { easyWins: 0, wins: 0, losses: 0, ...(progress || {}) };
  if (won) {
    p.wins += 1;
    if (difficulty === 'easy') p.easyWins += 1;
  } else {
    p.losses += 1;
  }
  return p;
}
