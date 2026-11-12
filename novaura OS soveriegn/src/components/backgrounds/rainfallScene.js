/**
 * The Stormy Rain theme's scenery (ParticleBackground, theme `stormy`).
 *
 * - Rain comes in spells: drizzle, showers, downpours, gusty spells, and a heavy curtain
 *   that sweeps across the screen. Within a spell the rain swells and eases.
 * - Drops come in three sizes. Each one rings the water where it lands, and big ones splash.
 * - The water across the bottom is a plane seen at a low angle. Far drops land near its back
 *   edge, a wave line that rain, fish and the cursor disturb; near ones land lower down and
 *   are drawn bigger. Light streaks with running droplets drift across it with the current,
 *   and the orbs above shine in it.
 * - Now and then a fish leaps out and dives back in.
 * - The theme's particles are a few glowing orbs drifting above the water. A drop that hits
 *   one makes it flare, rings it and throws off a spray in its colour. The water keeps them up.
 *
 * The orbs are the canvas's main particles. This module moves them only by nudging their
 * velocity, and sets `flare` (0 to about 1.3), which the particle drawing uses.
 */

// The water's back edge, as a share of the screen's height
const WATER_TOP = 0.8;
// Pixels between the points of the wave line along that edge
const COL = 6;
const RAIN_RGB = '178, 198, 238';
const SPRAY_RGB = '196, 214, 248';
const RIPPLE_RGB = '170, 200, 245';

// Spells of weather. rain: share of the drop budget falling; big: share of large drops;
// wind: how far the rain can slant; frames: how long the spell lasts (60 a second)
const SPELLS = {
  drizzle: { rain: 0.25, big: 0.02, wind: 0.08, frames: [600, 1100] },
  shower: { rain: 0.55, big: 0.08, wind: 0.14, frames: [500, 1000] },
  downpour: { rain: 1, big: 0.16, wind: 0.2, frames: [420, 800] },
  gusts: { rain: 0.6, big: 0.08, wind: 0.42, frames: [450, 900], gusty: true },
  curtain: { rain: 0.3, big: 0.1, wind: 0.12, frames: [500, 900], curtain: true },
};
// With reduced motion asked for, the rain keeps to these
const CALM_SPELLS = ['drizzle', 'shower'];

// Drop sizes: fall speed (px a frame) and streak length before depth scaling, line width,
// opacity, and how wide the ring it leaves grows
const DROPS = [
  { speed: [10, 13], len: [10, 16], width: 0.9, alpha: 0.38, ring: 16 },
  { speed: [13, 16], len: [16, 26], width: 1.3, alpha: 0.55, ring: 28 },
  { speed: [16, 19], len: [24, 34], width: 2, alpha: 0.75, ring: 46 },
];
const BIG = 2;

// Rim colours of the jumping fish
const FISH_RIMS = ['103, 232, 249', '167, 139, 250', '96, 165, 250', '251, 191, 36'];

const MAX_RIPPLES = 160;
const MAX_SPLASHES = 360;
const MAX_RINGS = 60;

const rand = ([a, b]) => a + Math.random() * (b - a);

function removeAt(list, i) {
  list[i] = list[list.length - 1];
  list.pop();
}

const rgbCache = new Map();
// '#93c5fd' -> '147, 197, 253'
export function hexRgb(hex) {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16) || 0;
    rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    rgbCache.set(hex, rgb);
  }
  return rgb;
}

// Depth z on the water runs from its back edge (0) to the bottom of the screen (1);
// things nearer the viewer are drawn bigger
const planeY = (s, z) => s.top + 6 + z * (s.h - s.top - 10);
const depthScale = (z) => 0.45 + 0.8 * z;
const depthAt = (s, y) => Math.max(0, Math.min(1, (y - s.top - 6) / Math.max(1, s.h - s.top - 10)));

const newStreak = (x) => {
  const z = Math.random();
  return {
    x,
    z,
    len: (40 + Math.random() * 120) * depthScale(z),
    speed: 0.15 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
  };
};

/**
 * New scenery for a w x h canvas. `busy` is the graphics preset's weight next to Medium
 * (it scales the amount of rain).
 */
export function createRainfall(w, h, { busy = 1, reduceMotion = false } = {}) {
  const s = {
    reduceMotion,
    busy,
    maxDrops: Math.round(320 * busy * (reduceMotion ? 0.5 : 1)),
    drops: [],
    ripples: [],
    splashes: [],
    rings: [],
    fish: [],
    streaks: [],
    spellName: '',
    spell: null,
    spellTimer: 0,
    rain: 0.3,
    big: 0.05,
    wind: 0,
    windTarget: 0,
    windTimer: 0,
    curtain: null,
    nextFish: rand([180, 480]),
    frame: 0,
    mx: -1000,
    my: -1000,
  };
  resizeRainfall(s, w, h);
  pickSpell(s, 'shower');
  return s;
}

export function resizeRainfall(s, w, h) {
  s.w = w;
  s.h = h;
  s.top = Math.round(h * WATER_TOP);
  // Points sit at x = (i - 1) * COL, with a spare one at each end
  const n = Math.ceil(w / COL) + 3;
  s.wave = new Float32Array(n);
  s.waveVel = new Float32Array(n);
  s.surf = new Float32Array(n);
  s.fill = null; // gradients are made again for the new size
  s.mist = null;
  s.sky = null;
  s.ripples.length = 0;
  s.streaks = Array.from({ length: Math.round(8 + w / 140) }, () => newStreak(Math.random() * w));
}

/** Move orbs that start in the water up into the air. */
export function placeOrbs(s, orbs) {
  for (const p of orbs) {
    if (p.y > s.top - 30) p.y = 20 + Math.random() * (s.top - 60);
  }
}

function pickSpell(s, name) {
  const pool = (s.reduceMotion ? CALM_SPELLS : Object.keys(SPELLS)).filter((n) => n !== s.spellName);
  s.spellName = name || pool[Math.floor(Math.random() * pool.length)];
  s.spell = SPELLS[s.spellName];
  s.spellTimer = rand(s.spell.frames);
  s.windTimer = 0;
  if (s.spell.curtain) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    // It crosses the screen over the spell
    s.curtain = {
      x: dir > 0 ? -s.w * 0.15 : s.w * 1.15,
      dir,
      width: s.w * (0.16 + Math.random() * 0.12),
      speed: (s.w * 1.3) / s.spellTimer,
    };
  } else {
    s.curtain = null;
  }
}

function spawnDrop(s, x, bigShare) {
  const kind = Math.random() < bigShare ? BIG : Math.random() < 0.35 ? 1 : 0;
  const d = DROPS[kind];
  const z = Math.pow(Math.random(), 1.3);
  const k = depthScale(z);
  const land = planeY(s, z);
  const len = rand(d.len) * k;
  // Far drops fall a little slower (less than they shrink, or the rain looks slow-motion).
  // Start upwind, so the slant brings it down over x.
  s.drops.push({ x: x - s.wind * land, y: -len - Math.random() * 40, kind, z, k, len, vy: rand(d.speed) * (0.75 + 0.3 * z), land });
}

function weather(s) {
  if (--s.spellTimer <= 0) pickSpell(s);
  const sp = s.spell;
  // Within a spell the rain swells and eases
  const swell = 0.7 + 0.3 * Math.sin(s.frame * 0.011) * Math.sin(s.frame * 0.0037 + 1);
  s.rain += (sp.rain * swell - s.rain) * 0.01;
  s.big += (sp.big - s.big) * 0.01;
  if (--s.windTimer <= 0) {
    s.windTarget = (Math.random() * 2 - 1) * sp.wind;
    s.windTimer = sp.gusty ? rand([40, 120]) : rand([200, 500]);
  }
  s.wind += (s.windTarget - s.wind) * (sp.gusty ? 0.03 : 0.008);

  const want = s.maxDrops * s.rain;
  let budget = Math.ceil(s.maxDrops / 40);
  while (s.drops.length < want && budget-- > 0) spawnDrop(s, Math.random() * (s.w + 120) - 60, s.big);

  const c = s.curtain;
  if (c) {
    c.x += c.dir * c.speed;
    const rate = Math.max(2, Math.round(4 * s.busy));
    for (let i = 0; i < rate && s.drops.length < s.maxDrops * 1.5; i++) {
      spawnDrop(s, c.x + (Math.random() - 0.5) * c.width, 0.22);
    }
    if ((c.dir > 0 && c.x > s.w * 1.2) || (c.dir < 0 && c.x < -s.w * 0.2)) s.curtain = null;
  }
}

// Each orb floats back toward its own height, which slowly rises and falls, and drifts
// sideways on a slow current and the wind. The water holds up any that get pushed down.
function tendOrbs(s, orbs, time) {
  const high = s.h * 0.1;
  const low = s.top - 80;
  for (const p of orbs) {
    p.flare = (p.flare || 0) * 0.92;
    if (p.homeAt === undefined) p.homeAt = Math.random();
    const off = p.swirlOffset || 0;
    const home = high + p.homeAt * (low - high) + Math.sin(time * 0.04 + off) * s.h * 0.08;
    p.vy += (home - p.y) * 0.0008;
    p.vx += Math.sin(time * 0.05 + off * 1.7) * 0.004;
    // Eased back from the sides, so the current and the wind don't pile them against one
    if (p.x < 60) p.vx += (60 - p.x) * 0.0006;
    else if (p.x > s.w - 60) p.vx -= (p.x - s.w + 60) * 0.0006;
    const floor = s.top - 18 - p.size * 2;
    if (p.y > floor) {
      p.vy -= 0.06 + (p.y - floor) * 0.01;
      if (p.y > s.top - 4) {
        p.y = s.top - 4;
        if (p.vy > 0) p.vy *= -0.4;
      }
    }
    p.vx += s.wind * 0.004;
  }
}

// Last in the frame, after rain hits: the particle loop moves the orbs next, so none may
// be heading far enough down to sink past the surface
function keepAboveWater(s, orbs) {
  for (const p of orbs) p.vy = Math.min(p.vy, s.top - 4 - p.y);
}

function disturb(s, x, push) {
  const i = Math.round(x / COL) + 1;
  for (let j = -1; j <= 1; j++) {
    const n = i + j;
    if (n > 0 && n < s.wave.length - 1) s.waveVel[n] += push * (j === 0 ? 1 : 0.5);
  }
}

function addRipple(s, x, y, size, strong) {
  if (s.ripples.length >= MAX_RIPPLES) return;
  const z = depthAt(s, y);
  s.ripples.push({ x, y, r: 1, max: size, flat: 0.22 + 0.12 * z, strong, k: depthScale(z) });
}

function splash(s, x, y, { k = 1, count = 6, power = 1, rgb = SPRAY_RGB, floor = y, decay = 0.02 } = {}) {
  for (let i = 0; i < count && s.splashes.length < MAX_SPLASHES; i++) {
    s.splashes.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3.2 * k * power,
      vy: -(1.4 + Math.random() * 2.6) * k * power,
      g: 0.22 * k,
      floor,
      life: 1,
      decay,
      size: (0.7 + Math.random() * 0.9) * k,
      rgb,
    });
  }
}

// The cursor stirs the water: ripples where it moves over the plane, waves at the back edge
function stirByCursor(s, mouse) {
  const moved = Math.hypot(mouse.x - s.mx, mouse.y - s.my);
  if (mouse.x > 0 && moved > 2 && moved < 200) {
    if (mouse.y > s.top + 4 && s.frame % 4 === 0) {
      addRipple(s, mouse.x, mouse.y, (18 + Math.min(moved, 30)) * depthScale(depthAt(s, mouse.y)), false);
    }
    if (Math.abs(mouse.y - s.top) < 24) disturb(s, mouse.x, Math.min(moved, 20) * 0.12);
  }
  s.mx = mouse.x;
  s.my = mouse.y;
}

function updateWave(s, time) {
  const { wave, waveVel, surf } = s;
  const n = wave.length;
  for (let i = 1; i < n - 1; i++) {
    waveVel[i] += (wave[i - 1] + wave[i + 1] - 2 * wave[i]) * 0.2 - wave[i] * 0.01;
    waveVel[i] *= 0.985;
  }
  for (let i = 1; i < n - 1; i++) {
    wave[i] += waveVel[i];
    const x = (i - 1) * COL;
    // A slow swell runs under the ripples
    surf[i] = s.top + wave[i] + Math.sin(x * 0.011 + time * 0.7) * 1.6 + Math.sin(x * 0.027 - time * 1.1) * 0.7;
  }
}

function leap(s) {
  // Nearer the front than the back, where they'd be too small to see
  const z = 0.3 + Math.random() * 0.6;
  const k = depthScale(z);
  const base = planeY(s, z);
  const x = s.w * (0.08 + Math.random() * 0.84);
  const dir = Math.random() < 0.5 ? -1 : 1;
  s.fish.push({
    x,
    y: base,
    base,
    k,
    vx: dir * (1.6 + Math.random() * 2) * k,
    vy: -(7.5 + Math.random() * 4) * k,
    g: 0.3 * k,
    len: (24 + Math.random() * 22) * k,
    rim: FISH_RIMS[Math.floor(Math.random() * FISH_RIMS.length)],
    flap: Math.random() * 6,
  });
  addRipple(s, x, base, 34 * k, true);
  splash(s, x, base, { k, count: 6, power: 0.9 });
}

function land(s, d) {
  addRipple(s, d.x, d.land, DROPS[d.kind].ring * d.k, d.kind === BIG);
  if (d.z < 0.08) disturb(s, d.x, 0.5 + d.kind * 0.6);
  if (d.kind === BIG) splash(s, d.x, d.land, { k: d.k, count: 5 + Math.floor(Math.random() * 4) });
  else if (d.kind === 1 && Math.random() < 0.35) splash(s, d.x, d.land, { k: d.k, count: 2, power: 0.6 });
}

// The drop's head, or halfway back along this frame's fall (fast drops could skip a small orb)
function hitOrb(d, orbs) {
  for (let j = 0; j < orbs.length; j++) {
    const p = orbs[j];
    const r = p.size * 2.4 + 2;
    const dx = d.x - p.x;
    const dy = d.y - p.y;
    const dy2 = dy - d.vy * 0.5;
    if (dx * dx + dy * dy < r * r || dx * dx + dy2 * dy2 < r * r) return p;
  }
  return null;
}

function strikeOrb(s, d, p, vx) {
  const power = [0.35, 0.6, 1][d.kind];
  p.flare = Math.min(1.3, (p.flare || 0) + power);
  // A small bob; it floats back to its height
  p.vx += vx * 0.04;
  p.vy += d.vy * 0.008 * (1 + d.kind);
  const rgb = hexRgb(p.drawnColor || p.color);
  splash(s, d.x, d.y, {
    k: 0.8 + power * 0.5,
    count: 3 + d.kind * 2,
    power: 0.7 + power,
    rgb,
    floor: planeY(s, Math.random() * 0.4),
    decay: 0.035,
  });
  if (s.rings.length < MAX_RINGS) s.rings.push({ x: p.x, y: p.y, r: p.size * 1.4, grow: 0.6 + power * 0.8, life: 1, rgb });
}

// A faint glow of storm light high in the sky
function drawSky(s, ctx) {
  if (!s.sky) {
    s.sky = ctx.createLinearGradient(0, 0, 0, s.h * 0.5);
    s.sky.addColorStop(0, 'rgba(48, 62, 92, 0.32)');
    s.sky.addColorStop(1, 'rgba(48, 62, 92, 0)');
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = s.sky;
  ctx.fillRect(0, 0, s.w, s.h * 0.5);
}

function drawMist(s, ctx) {
  if (!s.mist) {
    s.mist = ctx.createLinearGradient(0, s.top - 90, 0, s.top + 4);
    s.mist.addColorStop(0, 'rgba(70, 92, 140, 0)');
    s.mist.addColorStop(1, 'rgba(70, 92, 140, 0.14)');
  }
  ctx.globalAlpha = Math.min(1, 0.6 + s.rain * 0.6);
  ctx.fillStyle = s.mist;
  ctx.fillRect(0, s.top - 90, s.w, 94);
}

function drawWater(s, ctx) {
  const { w, h, surf } = s;
  if (!s.fill) {
    s.fill = ctx.createLinearGradient(0, s.top - 6, 0, h);
    s.fill.addColorStop(0, 'rgba(46, 70, 112, 0.96)');
    s.fill.addColorStop(0.08, 'rgba(20, 33, 58, 0.97)');
    s.fill.addColorStop(1, 'rgba(5, 9, 18, 1)');
  }
  const last = surf.length - 2;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 1; i <= last; i++) ctx.lineTo((i - 1) * COL, surf[i]);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = s.fill;
  ctx.fill();

  // The back edge catches the light
  ctx.beginPath();
  ctx.moveTo(0, surf[1]);
  for (let i = 2; i <= last; i++) ctx.lineTo((i - 1) * COL, surf[i]);
  ctx.strokeStyle = 'rgba(150, 186, 242, 0.08)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(165, 198, 250, 0.42)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

// Light streaks drifting with the current, each with a droplet running along it
function drawStreaks(s, ctx, time) {
  ctx.lineCap = 'round';
  for (const st of s.streaks) {
    const k = depthScale(st.z);
    st.x += (st.speed + s.wind * 1.5) * k;
    if (st.x > s.w + 20) {
      Object.assign(st, newStreak(0));
      st.x = -st.len;
    } else if (st.x + st.len < -20) {
      Object.assign(st, newStreak(0));
      st.x = s.w;
    }
    const y = planeY(s, st.z);
    const bend = Math.sin(time * 1.3 + st.phase) * 2.2 * k;
    const glint = 0.5 + 0.5 * Math.sin(time * 0.6 + st.phase);
    ctx.globalAlpha = (0.05 + 0.12 * glint) * (0.6 + 0.4 * k);
    ctx.strokeStyle = 'rgb(150, 182, 236)';
    ctx.lineWidth = 0.9 * k;
    ctx.beginPath();
    ctx.moveTo(st.x, y);
    ctx.quadraticCurveTo(st.x + st.len / 2, y + bend, st.x + st.len, y);
    ctx.stroke();

    const t = (time * st.speed * 0.9 + st.phase) % 1;
    ctx.globalAlpha = (0.15 + 0.3 * glint) * k;
    ctx.fillStyle = 'rgb(205, 225, 255)';
    ctx.beginPath();
    ctx.arc(st.x + st.len * t, y + 2 * t * (1 - t) * bend, 1.1 * k, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Each orb above the water shines in it as a column of short, shimmering strokes that
// thin out downward, each wavering on its own
function drawReflections(s, ctx, orbs, time) {
  const reach = s.h * 0.75;
  ctx.globalCompositeOperation = 'lighter';
  for (const p of orbs) {
    const dist = s.top - p.y;
    if (dist < 0 || dist > reach) continue;
    const near = 1 - dist / reach;
    const flare = p.flare || 0;
    const off = p.swirlOffset || 0;
    let y = s.top + 3 + dist * 0.06;
    ctx.fillStyle = p.drawnColor || p.color;
    for (let j = 0; j < 7; j++) {
      const wob = Math.sin(time * (2.1 + j * 0.37) + j * 2.3 + off);
      const half = p.size * (1.9 - j * 0.2) * (0.75 + 0.35 * Math.sin(time * 1.7 + j * 1.1 + off * 2)) * (1 + flare * 0.5);
      ctx.globalAlpha = Math.min(1, near * (0.34 - j * 0.04) * (1 + flare));
      ctx.fillRect(p.x - half + wob * 2.4, y, half * 2, 1.1);
      y += 2 + j * 0.9;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawRipples(s, ctx) {
  ctx.strokeStyle = `rgb(${RIPPLE_RGB})`;
  for (let i = s.ripples.length - 1; i >= 0; i--) {
    const r = s.ripples[i];
    r.r += (r.max - r.r) * 0.055 + 0.18;
    const life = 1 - r.r / r.max;
    if (life <= 0.02) {
      removeAt(s.ripples, i);
      continue;
    }
    ctx.globalAlpha = life * (r.strong ? 0.75 : 0.55) * (0.55 + 0.45 * r.k);
    ctx.lineWidth = (r.strong ? 1.3 : 0.9) * r.k;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.r, r.r * r.flat, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (r.strong && r.r > 6) {
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r * 0.55, r.r * 0.55 * r.flat, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawFish(s, ctx, time) {
  for (let i = s.fish.length - 1; i >= 0; i--) {
    const f = s.fish[i];
    f.x += f.vx;
    f.y += f.vy;
    f.vy += f.g;
    if (f.vy > 0 && f.y >= f.base) {
      // Back in, with a bigger splash than on the way out
      addRipple(s, f.x, f.base, 46 * f.k, true);
      addRipple(s, f.x, f.base, 26 * f.k, false);
      splash(s, f.x, f.base, { k: f.k, count: 10, power: 1.1 });
      s.fish.splice(i, 1);
      continue;
    }
    const angle = Math.atan2(f.vy, f.vx);
    // Water drips off the tail
    if (s.frame % 5 === 0 && s.splashes.length < MAX_SPLASHES) {
      s.splashes.push({
        x: f.x - Math.cos(angle) * f.len * 0.45,
        y: f.y - Math.sin(angle) * f.len * 0.45,
        vx: f.vx * 0.2,
        vy: 0.5,
        g: 0.2 * f.k,
        floor: f.base,
        life: 1,
        decay: 0.02,
        size: 0.8 * f.k,
        rgb: SPRAY_RGB,
      });
    }

    const sc = f.len / 30;
    const flap = Math.sin(time * 18 + f.flap) * 2.2;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(angle);
    // A fish heading left is flipped, so its belly stays down
    ctx.scale(sc, f.vx < 0 ? -sc : sc);
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.quadraticCurveTo(5, -7.5, -8, -2.2);
    ctx.lineTo(-15, -7 + flap);
    ctx.lineTo(-11.5, flap * 0.3);
    ctx.lineTo(-15, 7 + flap);
    ctx.lineTo(-8, 2.2);
    ctx.quadraticCurveTo(5, 6.5, 15, 0);
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a1322';
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(${f.rim}, 0.9)`;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${f.rim}, 0.9)`;
    ctx.lineWidth = 1.2 / sc;
    ctx.stroke();
    // Dorsal fin and eye
    ctx.beginPath();
    ctx.moveTo(3, -5.6);
    ctx.lineTo(-2, -10);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fillStyle = `rgba(${f.rim}, 0.55)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9.5, -1.4, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${f.rim})`;
    ctx.fill();
    ctx.restore();
  }
}

// A soft halo under each orb, wider while it flares
function drawHalos(ctx, orbs) {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of orbs) {
    const flare = p.flare || 0;
    const r = p.size * (4.2 + flare * 3);
    const rgb = hexRgb(p.drawnColor || p.color);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, `rgba(${rgb}, ${0.22 + flare * 0.25})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.globalAlpha = p.fade ?? 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function rainDown(s, ctx, mouse, orbs) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgb(${RAIN_RGB})`;
  ctx.fillStyle = `rgb(${RAIN_RGB})`;
  const drops = s.drops;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    const vx = s.wind * d.vy;
    d.x += vx;
    d.y += d.vy;
    // The cursor keeps the rain off like an umbrella
    const mdx = d.x - mouse.x;
    const mdy = d.y - mouse.y;
    const md2 = mdx * mdx + mdy * mdy;
    if (md2 < 19600 && md2 > 1) d.x += (mdx / Math.sqrt(md2)) * 2.5;

    if (d.y >= d.land) {
      land(s, d);
      removeAt(drops, i);
      continue;
    }
    const orb = hitOrb(d, orbs);
    if (orb) {
      strikeOrb(s, d, orb, vx);
      removeAt(drops, i);
      continue;
    }

    const cls = DROPS[d.kind];
    const tail = d.len / d.vy;
    ctx.globalAlpha = cls.alpha * (0.55 + 0.45 * d.k);
    ctx.lineWidth = cls.width * d.k;
    ctx.beginPath();
    ctx.moveTo(d.x - vx * tail, d.y - d.len);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
    if (d.kind === BIG) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.3 * d.k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSplashes(s, ctx) {
  for (let i = s.splashes.length - 1; i >= 0; i--) {
    const p = s.splashes[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.g;
    p.life -= p.decay;
    if (p.life <= 0 || (p.vy > 0 && p.y >= p.floor)) {
      removeAt(s.splashes, i);
      continue;
    }
    ctx.globalAlpha = Math.min(1, p.life * 0.85);
    ctx.fillStyle = `rgb(${p.rgb})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRings(s, ctx) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.2;
  for (let i = s.rings.length - 1; i >= 0; i--) {
    const r = s.rings[i];
    r.r += r.grow;
    r.life -= 0.05;
    if (r.life <= 0) {
      removeAt(s.rings, i);
      continue;
    }
    ctx.globalAlpha = r.life * 0.55;
    ctx.strokeStyle = `rgb(${r.rgb})`;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * One frame: moves the weather, rain, water and fish, nudges the orbs, and draws
 * everything except the orbs themselves (the particle loop draws those on top).
 * `mouse` is { x, y } (negative when the cursor is away).
 */
export function drawRainfall(s, ctx, time, mouse, orbs) {
  s.frame++;
  weather(s);
  tendOrbs(s, orbs, time);
  stirByCursor(s, mouse);
  if (--s.nextFish <= 0) {
    if (s.fish.length < 2) leap(s);
    s.nextFish = s.reduceMotion ? rand([720, 1500]) : rand([300, 840]);
  }
  updateWave(s, time);

  drawSky(s, ctx);
  drawMist(s, ctx);
  drawWater(s, ctx);
  drawStreaks(s, ctx, time);
  drawReflections(s, ctx, orbs, time);
  drawRipples(s, ctx);
  drawFish(s, ctx, time);
  drawHalos(ctx, orbs);
  rainDown(s, ctx, mouse, orbs);
  drawSplashes(s, ctx);
  drawRings(s, ctx);
  keepAboveWater(s, orbs);
  ctx.globalAlpha = 1;
}
