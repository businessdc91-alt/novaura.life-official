// Cognitive Awakenings: Echoes of a Soul — cards, rules, computer play, growth and mesh packets.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { AI_MODEL_CARDS, MODEL_CARD_MAP, MODES, ECHOES, MODE_CYCLE, modeBeats } from '../../src/games/awakenings/cards.js';
import {
  CELLS, HAND, LEVEL_XP, createMatch, createInstance, placeCard, previewMove, chooseAIMove, legalMoves,
  applyMatchGrowth, addToCollection, collectorStats, createStarterCollection, buildOpponentDeck, createRng, neighbour,
} from '../../src/games/awakenings/engine.js';

const ids = (n, from = 0) => AI_MODEL_CARDS.slice(from, from + n).map(c => createInstance(c.id));
const freshMatch = (seed = 7, first = 'blue') => createMatch({ blue: ids(5), red: ids(5, 10), seed, first });
// Set a hand card's stats for a rules test.
function shape(state, side, i, props) { Object.assign(state.hands[side][i], props); return state; }
const noWells = s => { s.wells = []; return s; };

test('80 cards, each with its own Signal, mode, Echo and links, and nothing from another game', () => {
  assert.equal(AI_MODEL_CARDS.length, 80);
  for (const c of AI_MODEL_CARDS) {
    assert.ok(c.signal >= 1 && c.signal <= 9, c.id);
    assert.ok(MODES[c.mode], c.id);
    assert.ok(ECHOES[c.echo], c.id);
    assert.equal(c.links.length, 4);
    assert.ok(c.links.filter(Boolean).length >= 2, c.id);
    assert.equal(c.stat, undefined, c.id);
  }
  const dir = new URL('../../src/games/awakenings/', import.meta.url);
  const sources = readdirSync(dir).map(f => readFileSync(new URL(f, dir), 'utf8')).join('\n') +
    readFileSync(new URL('../../src/components/windows/AwakeningsWindow.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(sources, /final fantasy|ff9|ffix|tetra|square enix/i);
});

test('every mode overpowers exactly one other and is overpowered by exactly one', () => {
  for (const m of MODE_CYCLE) {
    assert.equal(MODE_CYCLE.filter(o => modeBeats(m, o)).length, 1, m);
    assert.equal(MODE_CYCLE.filter(o => modeBeats(o, m)).length, 1, m);
  }
  assert.ok(modeBeats('logic', 'language') && modeBeats('dream', 'logic'));
});

test('the same seed lays out the same lattice; three Echo Wells', () => {
  const a = createMatch({ blue: ids(5), red: ids(5, 5), seed: 42 });
  const b = createMatch({ blue: ids(5), red: ids(5, 5), seed: 42 });
  assert.deepEqual(a.wells, b.wells);
  assert.equal(a.first, b.first);
  assert.equal(new Set(a.wells).size, 3);
  assert.equal(neighbour(0, 0), -1);
  assert.equal(neighbour(5, 1), 6);
});

test('resonance: a higher attack captures, a tie does not, links back brace, Steadfast holds', () => {
  const base = () => {
    const s = noWells(freshMatch(7, 'red'));
    shape(s, 'red', 0, { signal: 5, mode: 'language', echo: 'chorus', links: [false, false, false, false] });
    return placeCard(s, 'red', 0, 5); // red card in the middle-left, linking nowhere
  };
  // Blue attacks from the east (cell 6 links west).
  let s = shape(base(), 'blue', 0, { signal: 6, mode: 'language', echo: 'chorus', links: [false, false, false, true] });
  let n = placeCard(s, 'blue', 0, 6);
  assert.equal(n.board[5].owner, 'blue', '6 beats 5');
  assert.deepEqual(n.lastMove.captures.map(c => [c.attack, c.defence]), [[6, 5]]);

  s = shape(base(), 'blue', 0, { signal: 5, mode: 'language', echo: 'chorus', links: [false, false, false, true] });
  assert.equal(placeCard(s, 'blue', 0, 6).board[5].owner, 'red', 'a tie does nothing');

  s = shape(base(), 'blue', 0, { signal: 4, mode: 'logic', echo: 'chorus', links: [false, false, false, true] });
  assert.equal(placeCard(s, 'blue', 0, 6).board[5].owner, 'blue', 'Logic overpowers Language: 4 + 2 beats 5');

  const braced = noWells(freshMatch(7, 'red'));
  shape(braced, 'red', 0, { signal: 5, mode: 'language', echo: 'chorus', links: [false, true, false, false] });
  let b = placeCard(braced, 'red', 0, 5);
  shape(b, 'blue', 0, { signal: 6, mode: 'language', echo: 'chorus', links: [false, false, false, true] });
  assert.equal(placeCard(b, 'blue', 0, 6).board[5].owner, 'red', 'linking back toward the attacker adds 1');

  const stead = noWells(freshMatch(7, 'red'));
  shape(stead, 'red', 0, { signal: 4, mode: 'language', echo: 'steadfast', links: [false, false, false, false] });
  b = placeCard(stead, 'red', 0, 5);
  shape(b, 'blue', 0, { signal: 6, mode: 'language', echo: 'chorus', links: [false, false, false, true] });
  assert.equal(placeCard(b, 'blue', 0, 6).board[5].owner, 'red', 'Steadfast adds 2');
});

test('Mirror cancels mode advantage; Chorus lifts allies; Surge loves a well; Ripple chains', () => {
  const mirror = noWells(freshMatch(7, 'red'));
  shape(mirror, 'red', 0, { signal: 5, mode: 'language', echo: 'mirror', links: [false, false, false, false] });
  let s = placeCard(mirror, 'red', 0, 5);
  shape(s, 'blue', 0, { signal: 4, mode: 'logic', echo: 'chorus', links: [false, false, false, true] });
  assert.equal(placeCard(s, 'blue', 0, 6).board[5].owner, 'red');

  const chorus = noWells(freshMatch(7, 'blue'));
  shape(chorus, 'blue', 0, { signal: 3, links: [false, false, false, false], echo: 'steadfast' });
  s = placeCard(chorus, 'blue', 0, 5);
  shape(s, 'red', 0, { signal: 1, links: [false, false, false, false], echo: 'chorus' });
  s = placeCard(s, 'red', 0, 15);
  shape(s, 'blue', 1, { signal: 2, links: [false, false, false, false], echo: 'chorus' });
  s = placeCard(s, 'blue', 1, 6);
  assert.equal(s.board[5].boost, 1);
  assert.deepEqual(s.lastMove.chorus, [5]);

  const surge = freshMatch(7, 'red');
  surge.wells = [6];
  shape(surge, 'red', 0, { signal: 7, mode: 'language', echo: 'chorus', links: [false, false, false, false] });
  s = placeCard(surge, 'red', 0, 5);
  shape(s, 'blue', 0, { signal: 5, mode: 'language', echo: 'surge', links: [false, false, false, true] });
  assert.equal(placeCard(s, 'blue', 0, 6).board[5].owner, 'blue', '5 + 3 from the well beats 7');

  // Ripple: blue captures cell 5, which then captures cell 4 with its own west link.
  const rip = noWells(freshMatch(7, 'red'));
  shape(rip, 'red', 0, { signal: 3, mode: 'language', echo: 'chorus', links: [false, false, false, true] });
  s = placeCard(rip, 'red', 0, 5);
  shape(s, 'blue', 0, { signal: 1, mode: 'language', echo: 'chorus', links: [false, false, false, false] });
  s = placeCard(s, 'blue', 0, 15);
  shape(s, 'red', 1, { signal: 1, mode: 'language', echo: 'chorus', links: [false, false, false, false] });
  s = placeCard(s, 'red', 1, 4);
  shape(s, 'blue', 1, { signal: 6, mode: 'language', echo: 'ripple', links: [false, false, false, true] });
  const r = placeCard(s, 'blue', 1, 6);
  assert.equal(r.board[5].owner, 'blue');
  assert.equal(r.board[4].owner, 'blue', 'the captured card resonated and took its neighbour');
  assert.equal(r.lastMove.ripples.length, 1);
  assert.deepEqual(previewMove(s, 'blue', 1, 6).sort((a, b) => a - b), [4, 5]);
});

test('illegal moves are refused and a match ends after ten placements', () => {
  const s = freshMatch(9, 'blue');
  assert.equal(placeCard(s, 'red', 0, 0), null, 'out of turn');
  const a = placeCard(s, 'blue', 0, 0);
  assert.equal(placeCard(a, 'red', 0, 0), null, 'occupied');
  assert.equal(placeCard(a, 'blue', 1, 1), null, 'not your turn');
  let m = createMatch({ blue: ids(5, 20), red: ids(5, 40), seed: 1234 });
  const rng = createRng(5);
  while (m.phase === 'playing') {
    const mv = chooseAIMove(m, m.turn, m.turn === 'blue' ? 'master' : 'novice', rng);
    m = placeCard(m, m.turn, mv.handIdx, mv.cell);
  }
  assert.equal(m.moves, HAND * 2);
  assert.equal(m.board.filter(Boolean).length, 10);
  assert.equal(m.score.blue + m.score.red, 10);
  assert.equal(m.winner, m.score.blue > m.score.red ? 'blue' : m.score.red > m.score.blue ? 'red' : 'draw');
  assert.equal(legalMoves(m, m.turn).length, 0, 'every card is used');
});

test('the stronger computer beats the loose one more often than not', () => {
  let masterWins = 0, noviceWins = 0;
  for (let g = 0; g < 30; g++) {
    const deck = ids(5, 25);
    let m = createMatch({ blue: deck, red: deck.map(c => createInstance(c.modelId)), seed: 1000 + g });
    const rng = createRng(g + 1);
    while (m.phase === 'playing') {
      const mv = chooseAIMove(m, m.turn, m.turn === 'blue' ? 'master' : 'novice', rng);
      m = placeCard(m, m.turn, mv.handIdx, mv.cell);
    }
    if (m.winner === 'blue') masterWins++; else if (m.winner === 'red') noviceWins++;
  }
  assert.ok(masterWins > noviceWins, `${masterWins} vs ${noviceWins}`);
});

test('captures awaken cards; spoils add a card or experience; ranks rise', () => {
  const collection = createStarterCollection();
  assert.equal(collection.length, 7);
  const deck = collection.slice(0, 5);
  const m = createMatch({ blue: deck, red: ids(5, 30), seed: 3 });
  m.hands.blue[0].captures = LEVEL_XP[1];
  const g = applyMatchGrowth(collection, m, 'blue');
  assert.equal(g.collection.find(c => c.uid === deck[0].uid).level, 1);
  assert.equal(g.awakened.length, 1);
  const added = addToCollection(g.collection, 'gpt4');
  assert.ok(added.isNew);
  const again = addToCollection(added.collection, 'gpt4');
  assert.equal(again.isNew, false);
  assert.equal(again.collection.find(c => c.modelId === 'gpt4').xp, 3);
  const before = collectorStats(collection), after = collectorStats(again.collection, { wins: 3 });
  assert.ok(after.points > before.points);
  const opp = buildOpponentDeck({ minRarity: 4, maxRarity: 6, eraFocus: ['frontier'], levels: 2 }, createRng(1));
  assert.equal(opp.length, 5);
  assert.ok(opp.every(c => MODEL_CARD_MAP[c.modelId].era === 'frontier' && c.level === 2));
});

test('mesh packets: only real cards at legal levels, sane moves; stale invites never block new ones', async () => {
  let handler = null;
  mock.module('../../src/services/sovereignMesh.js', {
    namedExports: {
      registerMeshHandler: (type, fn) => { handler = fn; },
      sendDirectMeshPacket: () => true,
      verifiedSenderDid: p => p.did,
      getLocalIdentity: () => ({ displayName: 'Me' }),
    },
  });
  const events = [];
  globalThis.window = { dispatchEvent: e => events.push(e) };
  const meshMod = await import('../../src/games/awakenings/awakeningsMesh.js');
  const { cleanPacket, getPendingInvites, newGameId, deckForWire } = meshMod;
  const deck = deckForWire(ids(5).map(c => ({ ...c, level: 1 })));
  const gid = newGameId();
  assert.ok(cleanPacket({ kind: 'invite', gameId: gid, seed: 5, deck }));
  assert.equal(cleanPacket({ kind: 'invite', gameId: gid, seed: 5, deck: deck.slice(0, 4) }), null);
  assert.equal(cleanPacket({ kind: 'invite', gameId: gid, seed: 5, deck: [...deck.slice(0, 4), { modelId: 'made_up', level: 0 }] }), null);
  assert.equal(cleanPacket({ kind: 'accept', gameId: gid, deck: [...deck.slice(0, 4), { modelId: deck[0].modelId, level: 9 }] }), null);
  assert.equal(cleanPacket({ kind: 'invite', gameId: 'tk_123', seed: 5, deck }), null);
  assert.deepEqual(cleanPacket({ kind: 'place', gameId: gid, handIdx: '2', cell: 15, move: 3 }), { kind: 'place', gameId: gid, handIdx: 2, cell: 15, move: 3 });
  assert.equal(cleanPacket({ kind: 'place', gameId: gid, handIdx: 5, cell: 0, move: 0 }), null);
  assert.equal(cleanPacket({ kind: 'place', gameId: gid, handIdx: 0, cell: CELLS, move: 0 }), null);
  // Fill the inbox with invites that have gone stale, then a new one still arrives.
  const realNow = Date.now;
  Date.now = () => realNow() - 11 * 60 * 1000;
  for (let i = 0; i < 10; i++) handler({ kind: 'invite', gameId: newGameId(), seed: 1, deck }, { did: 'did:x', sender_id: 'p' });
  Date.now = realNow;
  handler({ kind: 'invite', gameId: gid, seed: 1, deck }, { did: 'did:y', sender_id: 'q' });
  const pending = getPendingInvites();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].gameId, gid);
  assert.ok(events.some(e => e.type === 'novaura:awakenings_received'));
  assert.equal(handler({ kind: 'invite', gameId: gid, seed: 1, deck }, { did: null, sender_id: 'q' }), undefined);
});
