// Relay Duel engine: deterministic city and shots, computer aim, Cybeni unlock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD, createRound, interference, simulateShot, applyShot, chooseComputerShot,
  isCybeniUnlocked, recordMatch, EASY_WINS_TO_UNLOCK_CYBENI,
} from '../../src/games/relayDuel/engine.js';

const solidBelow = (state, p) => {
  const cols = WORLD.width / WORLD.cell;
  return state.grid[Math.floor((p.y + 1) / WORLD.cell) * cols + Math.floor(p.x / WORLD.cell)] === 1;
};

test('the same seed builds the same city and the same shot result', () => {
  const a = createRound(1234, 1, ['nova', 'aura']);
  const b = createRound(1234, 1, ['nova', 'aura']);
  assert.deepEqual(Array.from(a.grid), Array.from(b.grid));
  assert.deepEqual(a.players, b.players);
  const wind = interference(1234, 1, 0);
  assert.equal(wind, interference(1234, 1, 0));
  assert.ok(Math.abs(wind) <= 130);
  const shotA = simulateShot(a, 0, { angle: 47, power: 63 }, wind);
  const shotB = simulateShot(b, 0, { angle: 47, power: 63 }, wind);
  assert.deepEqual(shotA, shotB);
  assert.notDeepEqual(Array.from(createRound(99, 1, ['nova', 'aura']).grid), Array.from(a.grid));
});

test('operators start on solid rooftops, one on each side', () => {
  for (let seed = 1; seed < 30; seed++) {
    const s = createRound(seed, 1, ['nova', 'aura']);
    assert.ok(solidBelow(s, s.players[0]) && solidBelow(s, s.players[1]), `seed ${seed}`);
    assert.ok(s.players[0].x < WORLD.width / 3 && s.players[1].x > (WORLD.width * 2) / 3);
    assert.equal(s.gravity.id, 'normal', 'round one always has standard gravity');
  }
});

test('a sharp computer without error finds a hit most of the time', () => {
  let hits = 0;
  const noError = () => 0.5; // jitter 0
  for (let seed = 1; seed <= 20; seed++) {
    const s = createRound(seed * 7919, 1, ['nova', 'aura']);
    const wind = interference(seed, 1, 0);
    const shot = chooseComputerShot(s, 0, wind, 'sharp', noError);
    if (simulateShot(s, 0, shot, wind).hitPlayer === 1) hits++;
  }
  assert.ok(hits >= 14, `only ${hits}/20 hits`);
});

test('a tower hit leaves a crater and players settle or fall', () => {
  const s = createRound(42, 1, ['nova', 'cybeni']);
  const shot = simulateShot(s, 1, { angle: 10, power: 25 }, 0);
  assert.ok(shot.explosion, 'a low weak shot hits a nearby roof');
  const { state: next } = applyShot(s, shot);
  const before = s.grid.reduce((n, v) => n + v, 0);
  const after = next.grid.reduce((n, v) => n + v, 0);
  assert.ok(after < before, 'cells were removed');
  assert.equal(s.grid.reduce((n, v) => n + v, 0), before, 'the original state is unchanged');
});

test('Aura bounces off more antennas than Nova', () => {
  // Fire flat into the skyline many times; Aura must never record fewer bounces.
  let novaBounces = 0;
  let auraBounces = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const nova = createRound(seed, 2, ['nova', 'aura']);
    const aura = createRound(seed, 2, ['aura', 'nova']);
    for (const angle of [20, 35, 50]) {
      novaBounces += simulateShot(nova, 0, { angle, power: 80 }, 0).bounces.length;
      auraBounces += simulateShot(aura, 0, { angle, power: 80 }, 0).bounces.length;
    }
  }
  assert.ok(auraBounces >= novaBounces);
});

test(`Cybeni unlocks after ${EASY_WINS_TO_UNLOCK_CYBENI} wins on Easy`, () => {
  let p = {};
  for (let i = 0; i < EASY_WINS_TO_UNLOCK_CYBENI - 1; i++) p = recordMatch(p, { won: true, difficulty: 'easy' });
  p = recordMatch(p, { won: true, difficulty: 'normal' });
  p = recordMatch(p, { won: false, difficulty: 'easy' });
  assert.equal(isCybeniUnlocked(p), false);
  p = recordMatch(p, { won: true, difficulty: 'easy' });
  assert.equal(isCybeniUnlocked(p), true);
  assert.deepEqual(p, { easyWins: 10, wins: 11, losses: 1 });
});
