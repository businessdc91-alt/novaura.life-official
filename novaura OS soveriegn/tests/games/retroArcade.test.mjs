// Tests for Retro Arcade unification (21-game Nexus Arcade deck bridge) and
// classic tabletop/card game engines (G-Toons abilities, Minimax Tic-Tac-Toe,
// Dots & Boxes tactical AI, and 8x8 Checkers with mandatory multi-jumps).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArcadeDocument } from '../../src/services/templates/arcadeTemplate.js';
import {
  GTOONS_CARDS,
  dealGToonsHands,
  evaluateGToonsMatch,
  chooseBestGToonsMove,
  checkTttWinner,
  chooseBestTttMove,
  applyDotsMove,
  chooseBestDotsMove,
  createInitialCheckersBoard,
  getCheckersLegalMoves,
  applyCheckersMove,
  chooseBestCheckersMove,
} from '../../src/games/retroArcade/arcadeClassics.js';

const byId = (id) => GTOONS_CARDS.find((c) => c.id === id);

test('buildArcadeDocument embeds 21-game Nexus Arcade safely with hydrated state', () => {
  const doc = buildArcadeDocument({
    embed: true,
    initialGame: 'vanguard',
    savedState: {
      profile: { name: '</script><script>alert(1)</script>', avatar: '🐉' },
      progress: { vanguard: { best: 4200, beaten: true, plays: 2 } },
      muted: true,
    },
  });
  assert.doesNotMatch(doc, /contenteditable="true"/);
  assert.doesNotMatch(doc, /<\/script><script>alert\(1\)/);
  assert.match(doc, /window\.__NEXUS_INITIAL_GAME__ = "vanguard"/);
  assert.match(doc, /window\.__NEXUS_INITIAL_STATE__ = /);
});

test('G-Toons evaluates all card abilities including Kraken swaps, Terra shield and Phoenix comeback', () => {
  const { playerHand, aiHand } = dealGToonsHands(() => 0.25);
  assert.equal(playerHand.length, 6);
  assert.equal(aiHand.length, 6);

  // Player: Terra Boulder (front 0, power 7), Cyber Dexter (back 3, power 7 +3 behind Earth = 10),
  // Blaze Samurai (front 1, power 8 +2 front = 10), Aqua Titan (front 2, power 6 + buffs Aqua).
  const pBoard = [byId('gt_5'), byId('gt_2'), byId('gt_3'), byId('gt_1'), null, null];
  // AI: Shadow Grim (front 0, power 9 +2 front - blocked on back 3 by Terra!). Notice Shadow Grim itself isn't Terra-shielded on front, wait: Grim affects opposing column!
  // On Player col 0: Terra Boulder shields Back Row (Cyber Dexter at slot 3) from Shadow Grim's -2, while Front slot 0 (Terra) takes -2 -> 5!
  const aBoard = [byId('gt_4'), null, null, null, null, null];

  const res = evaluateGToonsMatch(pBoard, aBoard);
  assert.equal(res.playerSlots[3].base + res.playerSlots[3].mod, 10, 'Cyber Dexter gets +3 behind Earth and is shielded from Grim');
  assert.equal(res.playerSlots[0].base + res.playerSlots[0].mod, 5, 'Front Terra Boulder takes -2 from opposing Shadow Grim');
  assert.equal(res.playerSlots[1].base + res.playerSlots[1].mod, 10, 'Blaze Samurai gets +2 in Front Row');

  // Test Vortex Kraken (front col 0) swapping opponent col 0 front <-> back before scoring, plus Solar Phoenix comeback.
  const krakenBoard = [byId('gt_7'), null, null, null, null, null];
  const oppBoard = [byId('gt_5'), null, null, byId('gt_8'), null, null];
  const swapRes = evaluateGToonsMatch(krakenBoard, oppBoard);
  assert.equal(swapRes.aiBoard[0].id, 'gt_8', 'Solar Phoenix swapped from back to front by Vortex Kraken');
  assert.equal(swapRes.aiBoard[3].id, 'gt_5', 'Terra Boulder swapped to back');
  assert.equal(swapRes.aiSlots[0].mod, 0, 'AI leads 9 vs 7 so Solar Phoenix does not gain comeback');

  const losingPhoenix = evaluateGToonsMatch(
    [byId('gt_2'), byId('gt_11'), null, null, null, null],
    [null, null, null, byId('gt_8'), null, null]
  );
  assert.equal(losingPhoenix.aiSlots[3].mod, 3, 'Solar Phoenix gains +3 when trailing');

  const move = chooseBestGToonsMove([null, null, null, null, null, null], pBoard, aiHand);
  assert.ok(move && move.slotIdx >= 0 && move.slotIdx < 6);
});

test('Tic-Tac-Toe Minimax takes wins, blocks threats and detects winning lines', () => {
  const board = ['X', 'X', null, null, 'O', null, null, null, null];
  assert.equal(chooseBestTttMove(board, 'O', 'unbeatable'), 2, 'Blocks immediate X win on top row');

  const winBoard = ['O', 'O', null, 'X', 'X', null, null, null, 'X'];
  assert.equal(chooseBestTttMove(winBoard, 'O', 'unbeatable'), 2, 'Takes immediate winning O cell');

  const won = checkTttWinner(['X', 'X', 'X', null, 'O', null, 'O', null, null]);
  assert.equal(won.winner, 'X');
  assert.deepEqual(won.line, [0, 1, 2]);
});

test('Dots & Boxes AI takes completing boxes and avoids handing free boxes when safe edges remain', () => {
  // Box (0,0) has 3 sides: top H[0], bottom H[3], left V[0] -> V[1] completes it!
  const h = Array(12).fill(false);
  const v = Array(12).fill(false);
  const b = Array(9).fill(null);
  h[0] = true; h[3] = true; v[0] = true;
  const pick = chooseBestDotsMove(h, v, b);
  assert.deepEqual(pick, { type: 'V', idx: 1 });
  const applied = applyDotsMove(h, v, b, pick.type, pick.idx, 'AI');
  assert.equal(applied.gained, 1);
  assert.equal(applied.boxes[0], 'AI');

  // If box (0,0) has 2 sides (H[0], H[3]), safe AI avoids V[0] / V[1] which would create a 3-sided giveaway!
  const h2 = Array(12).fill(false);
  const v2 = Array(12).fill(false);
  h2[0] = true; h2[3] = true;
  const safePick = chooseBestDotsMove(h2, v2, Array(9).fill(null), () => 0);
  assert.equal(
    (safePick.type === 'V' && (safePick.idx === 0 || safePick.idx === 1)),
    false,
    'AI avoids turning a 2-sided box into a 3-sided giveaway'
  );
});

test('Checkers enforces mandatory captures, multi-jumps and king promotion', () => {
  const empty = Array(64).fill(null);
  empty[5 * 8 + 0] = { side: 'player', king: false };
  empty[4 * 8 + 1] = { side: 'ai', king: false };
  empty[2 * 8 + 3] = { side: 'ai', king: false };
  // Player at (5,0) must jump (4,1)->(3,2), then must jump (2,3)->(1,4)!
  const firstMoves = getCheckersLegalMoves(empty, 'player');
  assert.equal(firstMoves.length, 1);
  assert.equal(firstMoves[0].to, 3 * 8 + 2);
  assert.equal(firstMoves[0].capture, 4 * 8 + 1);

  const step1 = applyCheckersMove(empty, firstMoves[0]);
  assert.equal(step1.moreJumpsFrom, 3 * 8 + 2);
  const secondMoves = getCheckersLegalMoves(step1.board, 'player', step1.moreJumpsFrom);
  assert.equal(secondMoves.length, 1);
  assert.equal(secondMoves[0].to, 1 * 8 + 4);

  // Promotion on top row (row 0)
  const promoBoard = Array(64).fill(null);
  promoBoard[1 * 8 + 2] = { side: 'player', king: false };
  const promoStep = applyCheckersMove(promoBoard, { from: 1 * 8 + 2, to: 3, capture: null });
  assert.equal(promoStep.justCrowned, true);
  assert.equal(promoStep.board[3].king, true);

  const aiStart = createInitialCheckersBoard();
  const aiMove = chooseBestCheckersMove(aiStart);
  assert.ok(aiMove && aiStart[aiMove.from]?.side === 'ai');
});
