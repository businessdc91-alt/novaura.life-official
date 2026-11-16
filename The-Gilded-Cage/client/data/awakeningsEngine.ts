// awakeningsEngine.ts — Rules of Cognitive Awakenings: Echoes of a Soul, tavern edition.
// The same rules as Novaura Sovereign OS (src/games/awakenings/engine.js), trimmed
// to what the tavern table needs: no collection levels and no mesh duels.
//
// Players take turns placing five minds on a 4×4 lattice. A card reaches out
// along its links; where a link touches an enemy card, attack = Signal (+2 if
// its mode overpowers the target's, plus bonuses) against defence = the
// target's Signal (+1 if it links back, plus bonuses). Higher attack captures.
// Three Echo Wells give +1 (Surge: +3). After ten placements, more cards wins.

import { MINDS, MODE_CYCLE, Mode, MindSpec } from "./awakeningsCards";

export type Side = "blue" | "red";
export const SIZE = 4;
export const CELLS = 16;
export const HAND = 5;
const DELTAS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const opposite = (d: number) => (d + 2) % 4;
const other = (s: Side): Side => (s === "blue" ? "red" : "blue");

export interface MindCard extends MindSpec { uid: string; used: boolean; captures: number }
export interface BoardEntry { card: MindCard; owner: Side; initialOwner: Side; boost: number }
export interface MoveEvent { side: Side; cell: number; cardName: string; captures: { cell: number; attack: number; defence: number }[]; ripples: number[]; chorus: number[] }
export interface Match {
  board: (BoardEntry | null)[];
  wells: number[];
  hands: Record<Side, MindCard[]>;
  turn: Side;
  moves: number;
  phase: "playing" | "over";
  winner: Side | "draw" | null;
  score: Record<Side, number>;
  lastMove: MoveEvent | null;
}

export const modeBeats = (a: Mode, b: Mode) => MODE_CYCLE[(MODE_CYCLE.indexOf(a) + 1) % MODE_CYCLE.length] === b;

let uidCount = 0;
export function makeCard(spec: MindSpec): MindCard {
  uidCount++;
  return { ...spec, links: spec.links.slice(), uid: `${spec.id}_${Date.now().toString(36)}_${uidCount}`, used: false, captures: 0 };
}

export function randomMinds(n: number, maxRarity = 6, minRarity = 1): MindSpec[] {
  const pool = MINDS.filter((m) => m.rarity >= minRarity && m.rarity <= maxRarity);
  const out: MindSpec[] = [];
  while (out.length < n && pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!out.includes(pick) || out.length >= pool.length) out.push(pick);
  }
  return out;
}

export function neighbour(cell: number, dir: number) {
  const r = Math.floor(cell / SIZE) + DELTAS[dir][0];
  const c = (cell % SIZE) + DELTAS[dir][1];
  return r < 0 || r >= SIZE || c < 0 || c >= SIZE ? -1 : r * SIZE + c;
}

export function createMatch(blue: MindCard[], red: MindCard[]): Match {
  const wells: number[] = [];
  while (wells.length < 3) {
    const c = Math.floor(Math.random() * CELLS);
    if (!wells.includes(c)) wells.push(c);
  }
  return {
    board: Array(CELLS).fill(null),
    wells,
    hands: { blue: blue.slice(0, HAND).map((c) => ({ ...c, used: false, captures: 0 })), red: red.slice(0, HAND).map((c) => ({ ...c, used: false, captures: 0 })) },
    turn: Math.random() < 0.5 ? "blue" : "red",
    moves: 0,
    phase: "playing",
    winner: null,
    score: { blue: 0, red: 0 },
    lastMove: null,
  };
}

const wellBonus = (m: Match, cell: number, card: MindCard) => (m.wells.includes(cell) ? (card.echo === "surge" ? 3 : 1) : 0);

function allies(m: Match, cell: number, owner: Side) {
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const nb = neighbour(cell, d);
    if (nb >= 0 && m.board[nb]?.owner === owner) n++;
  }
  return n;
}

function capturesFrom(m: Match, cell: number) {
  const e = m.board[cell]!;
  const out: { cell: number; attack: number; defence: number }[] = [];
  for (let d = 0; d < 4; d++) {
    if (!e.card.links[d]) continue;
    const nb = neighbour(cell, d);
    const t = nb >= 0 ? m.board[nb] : null;
    if (!t || t.owner === e.owner) continue;
    let attack = e.card.signal + e.boost + wellBonus(m, cell, e.card);
    if (modeBeats(e.card.mode, t.card.mode) && t.card.echo !== "mirror") attack += 2;
    if (e.card.echo === "spark") attack += allies(m, cell, e.owner);
    let defence = t.card.signal + t.boost + wellBonus(m, nb, t.card);
    if (t.card.links[opposite(d)]) defence += 1;
    if (t.card.echo === "steadfast") defence += 2;
    if (attack > defence) out.push({ cell: nb, attack, defence });
  }
  return out;
}

function tally(m: Match) {
  const s = { blue: 0, red: 0 };
  for (const e of m.board) if (e) s[e.owner]++;
  return s;
}

export function placeCard(state: Match, side: Side, handIdx: number, cell: number): Match | null {
  const hand = state.hands[side];
  if (state.phase !== "playing" || state.turn !== side || !hand[handIdx] || hand[handIdx].used || cell < 0 || cell >= CELLS || state.board[cell]) return null;
  const m: Match = {
    ...state,
    board: state.board.map((e) => (e ? { ...e } : null)),
    hands: { blue: state.hands.blue.map((c) => ({ ...c })), red: state.hands.red.map((c) => ({ ...c })) },
    score: { ...state.score },
  };
  const card = m.hands[side][handIdx];
  card.used = true;
  m.board[cell] = { card, owner: side, initialOwner: side, boost: 0 };
  const ev: MoveEvent = { side, cell, cardName: card.name, captures: [], ripples: [], chorus: [] };
  if (card.echo === "chorus") {
    for (let d = 0; d < 4; d++) {
      const nb = neighbour(cell, d);
      const ally = nb >= 0 ? m.board[nb] : null;
      if (ally && ally.owner === side && ally.boost < 3) { ally.boost++; ev.chorus.push(nb); }
    }
  }
  ev.captures = capturesFrom(m, cell);
  for (const c of ev.captures) { m.board[c.cell]!.owner = side; card.captures++; }
  if (card.echo === "ripple") {
    for (const c of ev.captures) {
      for (const w of capturesFrom(m, c.cell)) {
        if (m.board[w.cell]!.owner === side) continue;
        m.board[w.cell]!.owner = side;
        card.captures++;
        ev.ripples.push(w.cell);
      }
    }
  }
  m.moves++;
  m.lastMove = ev;
  m.turn = other(side);
  m.score = tally(m);
  if (m.moves >= HAND * 2) {
    m.phase = "over";
    m.winner = m.score.blue > m.score.red ? "blue" : m.score.red > m.score.blue ? "red" : "draw";
  }
  return m;
}

export function previewMove(m: Match, side: Side, handIdx: number, cell: number): number[] {
  const next = placeCard(m, side, handIdx, cell);
  return next?.lastMove ? [...next.lastMove.captures.map((c) => c.cell), ...next.lastMove.ripples] : [];
}

/** The patron's move: best immediate gain, with a glance at your best reply. */
export interface PatronMove { handIdx: number; cell: number; score: number }
export function choosePatronMove(m: Match, side: Side = "red"): PatronMove | null {
  let best = null as PatronMove | null;
  m.hands[side].forEach((c, h) => {
    if (c.used) return;
    for (let cell = 0; cell < CELLS; cell++) {
      if (m.board[cell]) continue;
      const next = placeCard(m, side, h, cell)!;
      let score = (next.score[side] - next.score[other(side)]) * 10 + (m.wells.includes(cell) ? 2 : 0) + Math.random() * 3;
      if (next.phase === "playing") {
        let worst = 0;
        next.hands[other(side)].forEach((oc, oh) => {
          if (oc.used) return;
          for (let oCell = 0; oCell < CELLS; oCell++) {
            if (next.board[oCell]) continue;
            const reply = placeCard(next, other(side), oh, oCell)!;
            const lost = reply.lastMove!.captures.length + reply.lastMove!.ripples.length;
            if (lost > worst) worst = lost;
          }
        });
        score -= worst * 6;
      }
      if (!best || score > best.score) best = { handIdx: h, cell, score };
    }
  });
  return best;
}
