// engine.js — Rules of Cognitive Awakenings: Echoes of a Soul.
//
// Two players take turns placing five minds each on a 4×4 lattice. A card
// reaches out along its links (up to four sides). Where a link touches an enemy
// card, the two resonate: attack = Signal (+2 if its mode overpowers the
// target's, plus Echo and Echo Well bonuses) against defence = the target's
// Signal (+1 if it links back toward the attacker, plus bonuses). A higher
// attack captures. Three Echo Wells on the lattice strengthen whoever sits on
// them. After ten placements the side holding more cards wins.
//
// Everything is deterministic from the match seed, so mesh duels only need to
// send the seed, the decks (model + level) and each move.

import { AI_MODEL_CARDS, MODEL_CARD_MAP, STARTER_MODEL_IDS, modeBeats } from './cards.js';

export const SIZE = 4;
export const CELLS = SIZE * SIZE;
export const HAND = 5;
export const WELLS = 3;
export const MAX_LEVEL = 3;
export const LEVEL_XP = [0, 3, 7, 12]; // total captures needed for levels 1–3
export const SIDE_NAMES = ['north', 'east', 'south', 'west'];
const DELTAS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const opposite = d => (d + 2) % 4;
export const other = side => (side === 'blue' ? 'red' : 'blue');

export const AWAKENING_RANKS = [
  { pts: 0, title: 'Dormant Mind' },
  { pts: 100, title: 'First Spark' },
  { pts: 200, title: 'Lucid Dreamer' },
  { pts: 320, title: 'Pattern Seer' },
  { pts: 450, title: 'Echo Weaver' },
  { pts: 600, title: 'Resonant Soul' },
  { pts: 760, title: 'Awakened Mind' },
  { pts: 930, title: 'Soul Cartographer' },
  { pts: 1100, title: 'Mind Sovereign' },
];

export function createRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function neighbour(cell, dir) {
  const r = Math.floor(cell / SIZE) + DELTAS[dir][0], c = (cell % SIZE) + DELTAS[dir][1];
  return r < 0 || r >= SIZE || c < 0 || c >= SIZE ? -1 : r * SIZE + c;
}

// ── Cards ──────────────────────────────────────────────────────────────────

let uidCounter = 0;
export function newUid() {
  uidCounter = (uidCounter + 1) % 1e6;
  return `am_${Date.now().toString(36)}_${uidCounter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** A collection entry: which model, its level and experience. */
export function createInstance(modelId, level = 0, xp = 0) {
  return { uid: newUid(), modelId, level: clampLevel(level), xp: Math.max(0, xp | 0) };
}
export const clampLevel = l => Math.max(0, Math.min(MAX_LEVEL, Number.isInteger(l) ? l : 0));

/** The playable card for a collection entry: catalog stats plus its level. */
export function cardFor(instance) {
  const spec = MODEL_CARD_MAP[instance?.modelId];
  if (!spec) return null;
  const level = clampLevel(instance.level);
  return {
    uid: instance.uid,
    modelId: spec.id,
    name: spec.name,
    level,
    signal: Math.min(10, spec.signal + level),
    mode: spec.mode,
    echo: spec.echo,
    links: spec.links.slice(),
    spec,
  };
}

export function createStarterCollection() {
  return STARTER_MODEL_IDS.map(id => createInstance(id));
}

/** A computer opponent's five cards, drawn from its era and rarity range. */
export function buildOpponentDeck(master, rng) {
  let pool = AI_MODEL_CARDS.filter(c => c.rarity >= master.minRarity && c.rarity <= master.maxRarity && (!master.eraFocus?.length || master.eraFocus.includes(c.era)));
  if (pool.length < HAND) pool = AI_MODEL_CARDS.filter(c => c.rarity >= master.minRarity && c.rarity <= master.maxRarity);
  if (pool.length < HAND) pool = AI_MODEL_CARDS;
  const picks = [];
  const used = new Set();
  while (picks.length < HAND) {
    const c = pool[Math.floor(rng() * pool.length)];
    if (used.has(c.id) && used.size < pool.length) continue;
    used.add(c.id);
    picks.push(createInstance(c.id, master.levels || 0));
  }
  return picks;
}

// ── Matches ────────────────────────────────────────────────────────────────

/**
 * A new match. `blue` and `red` are five collection entries each.
 * `first` is who moves first; when omitted the seed decides.
 */
export function createMatch({ blue, red, seed, first = null }) {
  const rng = createRng(seed);
  const wells = [];
  while (wells.length < WELLS) {
    const cell = Math.floor(rng() * CELLS);
    if (!wells.includes(cell)) wells.push(cell);
  }
  const start = first || (rng() < 0.5 ? 'blue' : 'red');
  const hand = list => list.slice(0, HAND).map(cardFor).filter(Boolean).map(c => ({ ...c, used: false, captures: 0 }));
  return {
    seed: seed >>> 0,
    board: Array(CELLS).fill(null),
    wells: wells.sort((a, b) => a - b),
    hands: { blue: hand(blue), red: hand(red) },
    turn: start,
    first: start,
    moves: 0,
    phase: 'playing',
    lastMove: null,
    log: [],
    winner: null,
    score: { blue: 0, red: 0 },
  };
}

function wellBonus(state, cell, card) {
  if (!state.wells.includes(cell)) return 0;
  return card.echo === 'surge' ? 3 : 1;
}

function alliedNeighbours(state, cell, owner) {
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const nb = neighbour(cell, d);
    if (nb >= 0 && state.board[nb]?.owner === owner) n++;
  }
  return n;
}

/** The attack a card at `cell` brings against `target` (a board entry). */
export function attackValue(state, cell, entry, target) {
  let v = entry.card.signal + entry.boost + wellBonus(state, cell, entry.card);
  if (modeBeats(entry.card.mode, target.card.mode) && target.card.echo !== 'mirror') v += 2;
  if (entry.card.echo === 'spark') v += alliedNeighbours(state, cell, entry.owner);
  return v;
}

/** The defence of the entry at `cell` against an attack arriving on its `fromSide` (0 north … 3 west). */
export function defenceValue(state, cell, entry, fromSide) {
  let v = entry.card.signal + entry.boost + wellBonus(state, cell, entry.card);
  if (entry.card.links[fromSide]) v += 1; // braced: it links back toward the attacker
  if (entry.card.echo === 'steadfast') v += 2;
  return v;
}

/** Captures the card at `cell` would make right now: [{ cell, attack, defence }]. */
function capturesFrom(state, cell) {
  const entry = state.board[cell];
  const out = [];
  for (let d = 0; d < 4; d++) {
    if (!entry.card.links[d]) continue;
    const nb = neighbour(cell, d);
    const target = nb >= 0 ? state.board[nb] : null;
    if (!target || target.owner === entry.owner) continue;
    // The attacker sits on the target's opposite side.
    const attack = attackValue(state, cell, entry, target);
    const defence = defenceValue(state, nb, target, opposite(d));
    if (attack > defence) out.push({ cell: nb, attack, defence });
  }
  return out;
}

function cloneState(state) {
  return {
    ...state,
    board: state.board.map(e => (e ? { ...e } : null)),
    hands: { blue: state.hands.blue.map(c => ({ ...c })), red: state.hands.red.map(c => ({ ...c })) },
    log: state.log.slice(),
    score: { ...state.score },
  };
}

export function isLegal(state, side, handIdx, cell) {
  return state.phase === 'playing' && state.turn === side &&
    Number.isInteger(handIdx) && handIdx >= 0 && handIdx < state.hands[side].length && !state.hands[side][handIdx].used &&
    Number.isInteger(cell) && cell >= 0 && cell < CELLS && !state.board[cell];
}

/**
 * Place a card. Returns the next state (the input is not changed), or null for
 * an illegal move. `next.lastMove` lists what happened, for the UI.
 */
export function placeCard(state, side, handIdx, cell) {
  if (!isLegal(state, side, handIdx, cell)) return null;
  const next = cloneState(state);
  const card = next.hands[side][handIdx];
  card.used = true;
  next.board[cell] = { card, owner: side, initialOwner: side, boost: 0, handIdx };
  const event = { side, handIdx, cell, cardName: card.name, chorus: [], captures: [], ripples: [] };

  if (card.echo === 'chorus') {
    for (let d = 0; d < 4; d++) {
      const nb = neighbour(cell, d);
      const ally = nb >= 0 ? next.board[nb] : null;
      if (ally && ally.owner === side && ally.boost < 3) { ally.boost++; event.chorus.push(nb); }
    }
  }

  const captured = capturesFrom(next, cell);
  for (const c of captured) { next.board[c.cell].owner = side; card.captures++; }
  event.captures = captured;

  if (card.echo === 'ripple') {
    for (const c of captured) {
      const wave = capturesFrom(next, c.cell);
      for (const w of wave) {
        if (next.board[w.cell].owner === side) continue;
        next.board[w.cell].owner = side;
        card.captures++;
        event.ripples.push({ ...w, from: c.cell });
      }
    }
  }

  next.moves++;
  next.lastMove = event;
  next.log.push(event);
  next.turn = other(side);
  next.score = tally(next);
  if (next.moves >= HAND * 2) {
    next.phase = 'over';
    next.winner = next.score.blue > next.score.red ? 'blue' : next.score.red > next.score.blue ? 'red' : 'draw';
  }
  return next;
}

export function tally(state) {
  const s = { blue: 0, red: 0 };
  for (const e of state.board) if (e) s[e.owner]++;
  return s;
}

/** Cells the move would capture (including ripples), for previews. */
export function previewMove(state, side, handIdx, cell) {
  const next = placeCard(state, side, handIdx, cell);
  if (!next) return [];
  return [...next.lastMove.captures.map(c => c.cell), ...next.lastMove.ripples.map(c => c.cell)];
}

export function legalMoves(state, side) {
  const out = [];
  state.hands[side].forEach((c, h) => {
    if (c.used) return;
    for (let cell = 0; cell < CELLS; cell++) if (!state.board[cell]) out.push({ handIdx: h, cell });
  });
  return out;
}

// ── Computer opponents ─────────────────────────────────────────────────────

const margin = (state, side) => { const s = tally(state); return s[side] - s[other(side)]; };

function exposure(state, side) {
  // How many of `side`'s cards the opponent could take with its best single reply.
  let worst = 0;
  for (const m of legalMoves(state, other(side))) {
    const next = placeCard(state, other(side), m.handIdx, m.cell);
    const lost = next.lastMove.captures.length + next.lastMove.ripples.length;
    if (lost > worst) worst = lost;
  }
  return worst;
}

/**
 * The computer's move. Levels: 'novice' plays loosely, 'adept' takes the best
 * capture, 'master' and 'sovereign' also look at the reply.
 */
export function chooseAIMove(state, side, level = 'adept', rng = Math.random) {
  const moves = legalMoves(state, side);
  if (!moves.length) return null;
  const deep = level === 'master' || level === 'sovereign';
  const scored = moves.map(m => {
    const next = placeCard(state, side, m.handIdx, m.cell);
    let score = margin(next, side) * 10;
    if (state.wells.includes(m.cell)) score += 2;
    if (deep && next.phase !== 'over') score -= exposure(next, side) * (level === 'sovereign' ? 12 : 8);
    // Keep strong cards for later when nothing is at stake.
    if (!next.lastMove.captures.length) score -= next.hands[side][m.handIdx].signal * 0.3;
    if (level === 'novice') score += rng() * 18;
    else if (level === 'adept') score += rng() * 4;
    else score += rng() * 0.5;
    return { ...m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

// ── After a match ──────────────────────────────────────────────────────────

/**
 * Award experience to the player's cards that captured something. Returns
 * { collection, awakened: [names that reached a new level] }.
 */
export function applyMatchGrowth(collection, state, side = 'blue') {
  const awakened = [];
  const gains = new Map();
  for (const c of state.hands[side]) if (c.captures) gains.set(c.uid, (gains.get(c.uid) || 0) + c.captures);
  const next = collection.map(inst => {
    const gain = gains.get(inst.uid);
    if (!gain) return inst;
    const xp = inst.xp + gain;
    let level = inst.level;
    while (level < MAX_LEVEL && xp >= LEVEL_XP[level + 1]) level++;
    if (level > inst.level) awakened.push(`${MODEL_CARD_MAP[inst.modelId]?.name || inst.modelId} → level ${level}`);
    return { ...inst, xp, level };
  });
  return { collection: next, awakened };
}

/** Add a won card; a model already owned gains experience instead. */
export function addToCollection(collection, modelId) {
  const have = collection.find(c => c.modelId === modelId);
  if (!have) return { collection: [...collection, createInstance(modelId)], isNew: true };
  return {
    collection: collection.map(c => {
      if (c !== have) return c;
      const xp = c.xp + 3;
      let level = c.level;
      while (level < MAX_LEVEL && xp >= LEVEL_XP[level + 1]) level++;
      return { ...c, xp, level };
    }),
    isNew: false,
  };
}

export function collectorStats(collection, record = {}) {
  const unique = new Set(collection.map(c => c.modelId)).size;
  const levels = collection.reduce((n, c) => n + c.level, 0);
  const points = unique * 10 + levels * 8 + (record.wins || 0) * 6;
  let rank = AWAKENING_RANKS[0], nextRank = null;
  for (let i = 0; i < AWAKENING_RANKS.length; i++) {
    if (points >= AWAKENING_RANKS[i].pts) { rank = AWAKENING_RANKS[i]; nextRank = AWAKENING_RANKS[i + 1] || null; }
  }
  return { unique, total: AI_MODEL_CARDS.length, levels, points, rank, nextRank };
}
