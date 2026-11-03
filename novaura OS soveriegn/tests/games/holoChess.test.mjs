// HoloChess rules engine: legal moves (perft), the AI search, draws, mesh packets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_FEN, parseFEN, getLegalMoves, makeMove, calculateBestMove, drawReason,
  cleanChessPacket, newChessGameId,
} from '../../src/services/holoChessService.js';

// Leaf count of the legal move tree; the reference numbers are the standard ones.
function perft(state, depth) {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of getLegalMoves(state)) nodes += perft(makeMove(state, move).state, depth - 1);
  return nodes;
}

test('legal move generation matches the reference perft counts', () => {
  assert.equal(perft(parseFEN(INITIAL_FEN), 3), 8902);
  // "Kiwipete": castling both ways, en passant, promotions, pins.
  const kiwipete = parseFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(perft(kiwipete, 1), 48);
  assert.equal(perft(kiwipete, 2), 2039);
  // Rook and pawn endgame with en passant discovered checks.
  assert.equal(perft(parseFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 3), 2812);
});

test('the AI returns a legal move at every difficulty', () => {
  for (const depth of [2, 3, 4]) {
    const move = calculateBestMove(INITIAL_FEN, depth);
    assert.ok(getLegalMoves(INITIAL_FEN).some(m => m.from === move.from && m.to === move.to), `depth ${depth}`);
    assert.match(move.from, /^[a-h][1-8]$/);
  }
  // After a capture is on the board (the search used to crash here).
  const midgame = 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3';
  assert.ok(calculateBestMove(midgame, 3));
});

test('the AI finds mate in one for either side', () => {
  const whiteMates = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  assert.equal(calculateBestMove(whiteMates, 2).san, 'Qxf7#');
  const blackMates = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2';
  assert.equal(calculateBestMove(blackMates, 2).san, 'Qh4#');
  const after = makeMove(blackMates, calculateBestMove(blackMates, 3));
  assert.equal(after.isCheckmate, true);
});

test('a rook captured at home loses its castling right', () => {
  const fen = '4k3/8/8/8/8/8/6b1/4K2R b K - 0 1';
  const take = getLegalMoves(fen).find(m => m.from === 'g2' && m.to === 'h1');
  const after = makeMove(fen, take);
  assert.equal(after.fen.split(' ')[2], '-');
});

test('draws by material and by the fifty-move rule', () => {
  assert.equal(drawReason('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), 'insufficient material');
  assert.equal(drawReason('4k3/8/8/8/8/8/8/4KN2 w - - 0 1'), 'insufficient material');
  assert.equal(drawReason('4k3/8/8/8/8/8/8/4KB2 w - - 0 1'), 'insufficient material');
  // Bishops on the same colour of square cannot mate; on opposite colours they can.
  assert.equal(drawReason('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1'), 'insufficient material');
  assert.equal(drawReason('2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1'), null);
  assert.equal(drawReason('4k3/8/8/8/8/8/8/4K2R w - - 0 1'), null);
  assert.equal(drawReason('4k3/8/8/8/8/8/8/4K2R w - - 100 80'), 'the fifty-move rule');
  assert.equal(drawReason(INITIAL_FEN), null);
});

test('mesh packets are checked before the window sees them', () => {
  const gameId = newChessGameId();
  assert.match(gameId, /^hc_[0-9a-f]{16}$/);
  assert.deepEqual(cleanChessPacket({ kind: 'invite', gameId, name: 'Dillan' }), { kind: 'invite', gameId, name: 'Dillan' });
  assert.equal(cleanChessPacket({ kind: 'invite', gameId: 'chess_123' }), null);
  assert.equal(cleanChessPacket({ kind: 'teleport', gameId }), null);
  assert.equal(cleanChessPacket({ kind: 'invite', gameId, name: 'x'.repeat(200) }).name.length, 40);

  const move = { kind: 'move', gameId, ply: 0, from: 'e2', to: 'e4' };
  assert.deepEqual(cleanChessPacket(move), { ...move, name: 'Mesh peer', promotion: null });
  assert.equal(cleanChessPacket({ ...move, from: 'e9' }), null);
  assert.equal(cleanChessPacket({ ...move, to: 'z4' }), null);
  assert.equal(cleanChessPacket({ ...move, ply: 1.5 }), null);
  assert.equal(cleanChessPacket({ ...move, ply: -1 }), null);
  assert.equal(cleanChessPacket({ ...move, promotion: 'k' }), null);
  assert.equal(cleanChessPacket({ ...move, promotion: 'n' }).promotion, 'n');
  // A whole position is never accepted, only a move to replay.
  assert.equal('fen' in cleanChessPacket({ ...move, fen: '8/8/8/8/8/8/8/K6k w - - 0 1' }), false);
});
