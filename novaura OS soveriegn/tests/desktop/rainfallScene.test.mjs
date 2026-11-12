// Stormy Rain scenery: runs many minutes of weather against a stub canvas and checks that
// everything stays bounded, the orbs stay above the water and rain actually reaches them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRainfall, resizeRainfall, placeOrbs, drawRainfall, hexRgb } from '../../src/components/backgrounds/rainfallScene.js';

// A 2D context that accepts every call and property
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get: (target, key) => (key in target ? target[key]
    : key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : () => {}),
  set: (target, key, value) => { target[key] = value; return true; },
});

const makeOrbs = (n, w, h) => Array.from({ length: n }, (_, i) => ({
  x: (i + 0.5) * (w / n), y: Math.random() * h, vx: 0, vy: 0, size: 3 + (i % 4), color: '#93c5fd', swirlOffset: i,
}));

// The particle loop's part: move the orbs, damp them, bounce off the screen edges
function moveOrbs(orbs, w, h) {
  for (const p of orbs) {
    p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.vy *= 0.99;
    if (p.x < 0) { p.x = 1; p.vx = Math.abs(p.vx); } else if (p.x > w) { p.x = w - 1; p.vx = -Math.abs(p.vx); }
    if (p.y < 0) { p.y = 1; p.vy = Math.abs(p.vy); } else if (p.y > h) { p.y = h - 1; p.vy = -Math.abs(p.vy); }
  }
}

test('ten minutes of rain stays bounded, the orbs stay up and get hit', () => {
  const w = 1600, h = 900;
  const s = createRainfall(w, h, { busy: 1 });
  const orbs = makeOrbs(20, w, h);
  placeOrbs(s, orbs);
  assert.ok(orbs.every(p => p.y < s.top - 30));

  const spells = new Set();
  let flares = 0, fishSeen = 0, maxDrops = 0, maxSplashes = 0, maxRipples = 0, curtains = 0;
  const mouse = { x: -1000, y: -1000 };
  for (let f = 0; f < 36000; f++) {
    if (f > 1000 && f < 1400) { mouse.x = 300 + (f % 200) * 4; mouse.y = s.top + 40; } // stir the water
    else { mouse.x = -1000; mouse.y = -1000; }
    drawRainfall(s, ctx, f / 60, mouse, orbs);
    moveOrbs(orbs, w, h);
    spells.add(s.spellName);
    if (s.curtain) curtains++;
    if (s.fish.length) fishSeen++;
    flares += orbs.filter(p => p.flare > 0.3).length;
    maxDrops = Math.max(maxDrops, s.drops.length);
    maxSplashes = Math.max(maxSplashes, s.splashes.length);
    maxRipples = Math.max(maxRipples, s.ripples.length);
    for (const p of orbs) assert.ok(p.y <= s.top - 4 + 1e-9 && Number.isFinite(p.x) && Number.isFinite(p.vy), `orb under the water at frame ${f}`);
  }
  // The rain bobs them but doesn't pin them to the water: they stay spread through the air
  const ys = orbs.map(p => p.y).sort((a, b) => a - b);
  assert.ok(ys[Math.floor(ys.length / 2)] < s.top - 120, `median orb height ${ys[Math.floor(ys.length / 2)]} vs water ${s.top}`);
  assert.ok(ys[ys.length - 1] - ys[0] > h * 0.3, 'orbs at many heights');
  assert.ok(spells.size >= 4, `weather spells seen: ${[...spells]}`);
  assert.ok(curtains > 0, 'a curtain of rain swept across');
  assert.ok(fishSeen > 0, 'a fish jumped');
  assert.ok(flares > 0, 'rain hit the orbs');
  assert.ok(maxDrops <= Math.ceil(s.maxDrops * 1.5) + 4, `drops ${maxDrops}`);
  assert.ok(maxSplashes <= 360 && maxRipples <= 160);
  assert.ok([...s.wave].every(Number.isFinite) && Math.max(...[...s.wave].map(Math.abs)) < 60, 'the wave line stays calm');
});

test('resizing keeps the scene working, and colours convert', () => {
  const s = createRainfall(800, 600, { busy: 0.6, reduceMotion: true });
  const orbs = makeOrbs(8, 800, 600);
  for (let f = 0; f < 600; f++) drawRainfall(s, ctx, f / 60, { x: -1000, y: -1000 }, orbs);
  resizeRainfall(s, 1920, 1080);
  assert.equal(s.top, Math.round(1080 * 0.8));
  for (let f = 0; f < 600; f++) drawRainfall(s, ctx, f / 60, { x: -1000, y: -1000 }, orbs);
  assert.ok(['drizzle', 'shower'].includes(s.spellName));
  assert.equal(hexRgb('#93c5fd'), '147, 197, 253');
  assert.equal(hexRgb('#fff'), '255, 255, 255');
});
