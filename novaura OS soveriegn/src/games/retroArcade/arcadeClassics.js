// Pure engines and AI logic for Desktop Retro Arcade classics:
// G-Toons Clash (with genuine card abilities), Minimax Tic-Tac-Toe,
// Tactical Dots & Boxes, and 8x8 Checkers with mandatory multi-jumps.

export const GTOONS_CARDS = [
  { id: 'gt_1', name: 'Cyber Dexter', power: 7, element: 'Cosmic', rowBonus: 'back', ability: '+3 if behind an Earth card', color: '#38bdf8', icon: '🧠' },
  { id: 'gt_2', name: 'Blaze Samurai', power: 8, element: 'Fire', rowBonus: 'front', ability: '+2 if played in Front Row', color: '#f97316', icon: '⚔️' },
  { id: 'gt_3', name: 'Aqua Titan', power: 6, element: 'Aqua', rowBonus: 'any', ability: '+2 to adjacent Aqua allies', color: '#06b6d4', icon: '🌊' },
  { id: 'gt_4', name: 'Shadow Grim', power: 9, element: 'Shadow', rowBonus: 'front', ability: '-2 to opposing card in column', color: '#a855f7', icon: '💀' },
  { id: 'gt_5', name: 'Terra Boulder', power: 7, element: 'Earth', rowBonus: 'front', ability: 'Shields back row from clash penalties', color: '#10b981', icon: '🛡️' },
  { id: 'gt_6', name: 'Cosmic Mojo', power: 8, element: 'Cosmic', rowBonus: 'back', ability: '+4 if opponent has a Fire card', color: '#eab308', icon: '🐒' },
  { id: 'gt_7', name: 'Vortex Kraken', power: 7, element: 'Aqua', rowBonus: 'front', ability: 'Swaps opposing column cards', color: '#0284c7', icon: '🐙' },
  { id: 'gt_8', name: 'Solar Phoenix', power: 9, element: 'Fire', rowBonus: 'any', ability: '+3 in clash if losing', color: '#ef4444', icon: '🔥' },
  { id: 'gt_9', name: 'Volt Mech', power: 7, element: 'Cosmic', rowBonus: 'front', ability: '+2 if beside another Cosmic ally', color: '#60a5fa', icon: '🤖' },
  { id: 'gt_10', name: 'Frost Siren', power: 6, element: 'Aqua', rowBonus: 'back', ability: '-1 to all opposing Front Row cards', color: '#67e8f9', icon: '❄️' },
  { id: 'gt_11', name: 'Obsidian Golem', power: 8, element: 'Earth', rowBonus: 'front', ability: '+3 if in Front Row with no allies beside it', color: '#34d399', icon: '🪨' },
  { id: 'gt_12', name: 'Starlight Valkyrie', power: 7, element: 'Cosmic', rowBonus: 'any', ability: '+2 for each opposing Shadow card', color: '#f472b6', icon: '🌟' },
];

export function shuffleCards(cards, rng = Math.random) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function dealGToonsHands(rng = Math.random) {
  const pool = shuffleCards(GTOONS_CARDS, rng);
  return {
    playerHand: pool.slice(0, 6),
    aiHand: pool.slice(6, 12),
  };
}

/**
 * Evaluate both 6-slot boards (0..2 Front Row, 3..5 Back Row) executing every
 * printed card ability truthfully.
 */
export function evaluateGToonsMatch(rawPlayerBoard, rawAiBoard) {
  const playerBoard = [...rawPlayerBoard];
  const aiBoard = [...rawAiBoard];

  // Phase 1: Vortex Kraken (gt_7 in Front Row) swaps opposing column front/back slots.
  const applyKrakenSwaps = (actorBoard, targetBoard) => {
    for (let col = 0; col < 3; col++) {
      if (actorBoard[col]?.id === 'gt_7') {
        const tmp = targetBoard[col];
        targetBoard[col] = targetBoard[col + 3];
        targetBoard[col + 3] = tmp;
      }
    }
  };
  applyKrakenSwaps(playerBoard, aiBoard);
  applyKrakenSwaps(aiBoard, playerBoard);

  const scoreSide = (board, oppBoard) => {
    const slots = board.map((card) => (card ? { base: card.power, mod: 0, notes: [] } : null));
    const oppHasFire = oppBoard.some((c) => c?.element === 'Fire');
    const oppShadowCount = oppBoard.filter((c) => c?.element === 'Shadow').length;
    const oppHasFrostBack = oppBoard.slice(3, 6).some((c) => c?.id === 'gt_10');

    for (let i = 0; i < 6; i++) {
      const card = board[i];
      if (!card) continue;
      const col = i % 3;
      const isFront = i < 3;
      const isBack = i >= 3;
      const rowStart = isFront ? 0 : 3;
      const leftIdx = col > 0 ? rowStart + col - 1 : -1;
      const rightIdx = col < 2 ? rowStart + col + 1 : -1;

      if (card.id === 'gt_1' && isBack && board[col]?.element === 'Earth') {
        slots[i].mod += 3;
        slots[i].notes.push('+3 behind Earth');
      }
      if (card.id === 'gt_2' && isFront) {
        slots[i].mod += 2;
        slots[i].notes.push('+2 Front Row');
      }
      if (card.id === 'gt_3') {
        [leftIdx, rightIdx].forEach((adj) => {
          if (adj >= 0 && board[adj]?.element === 'Aqua') {
            slots[adj].mod += 2;
            slots[adj].notes.push('+2 Aqua Titan');
          }
        });
      }
      if (card.id === 'gt_6' && isBack && oppHasFire) {
        slots[i].mod += 4;
        slots[i].notes.push('+4 vs Fire');
      }
      if (card.id === 'gt_9' && isFront) {
        const hasCosmicBeside =
          (leftIdx >= 0 && board[leftIdx]?.element === 'Cosmic') ||
          (rightIdx >= 0 && board[rightIdx]?.element === 'Cosmic');
        if (hasCosmicBeside) {
          slots[i].mod += 2;
          slots[i].notes.push('+2 Cosmic link');
        }
      }
      if (card.id === 'gt_11' && isFront) {
        const isolated = (leftIdx < 0 || !board[leftIdx]) && (rightIdx < 0 || !board[rightIdx]);
        if (isolated) {
          slots[i].mod += 3;
          slots[i].notes.push('+3 solo Front');
        }
      }
      if (card.id === 'gt_12' && oppShadowCount > 0) {
        const bonus = oppShadowCount * 2;
        slots[i].mod += bonus;
        slots[i].notes.push(`+${bonus} vs Shadow`);
      }

      // Opposing column Shadow Grim (-2), unless shielded in Back Row by Terra Boulder (gt_5 in Front Row)
      const isBackShielded = isBack && board[col]?.id === 'gt_5';
      const oppFrontGrim = oppBoard[col]?.id === 'gt_4';
      const oppBackGrim = oppBoard[col + 3]?.id === 'gt_4';
      if (oppFrontGrim || oppBackGrim) {
        if (isBackShielded) {
          slots[i].notes.push('Shielded by Terra');
        } else {
          slots[i].mod -= 2;
          slots[i].notes.push('-2 Shadow Grim');
        }
      }

      // Opposing Back Row Frost Siren (-1 to Front Row)
      if (isFront && oppHasFrostBack) {
        slots[i].mod -= 1;
        slots[i].notes.push('-1 Frost Siren');
      }
    }

    const total = slots.reduce((sum, s) => sum + (s ? Math.max(0, s.base + s.mod) : 0), 0);
    return { slots, total };
  };

  const pRes = scoreSide(playerBoard, aiBoard);
  const aRes = scoreSide(aiBoard, playerBoard);

  // Phase 3: Solar Phoenix (+3 in clash if losing pre-Phoenix)
  const applyPhoenix = (board, res, oppTotal) => {
    if (res.total < oppTotal) {
      for (let i = 0; i < 6; i++) {
        if (board[i]?.id === 'gt_8' && res.slots[i]) {
          res.slots[i].mod += 3;
          res.slots[i].notes.push('+3 Phoenix comeback');
          res.total += 3;
        }
      }
    }
  };
  const prePlayerTotal = pRes.total;
  const preAiTotal = aRes.total;
  applyPhoenix(playerBoard, pRes, preAiTotal);
  applyPhoenix(aiBoard, aRes, prePlayerTotal);

  const playerFull = rawPlayerBoard.every((s) => s !== null);
  const aiFull = rawAiBoard.every((s) => s !== null);
  let winner = null;
  if (playerFull && aiFull) {
    if (pRes.total > aRes.total) winner = 'player';
    else if (aRes.total > pRes.total) winner = 'ai';
    else winner = 'draw';
  }

  return {
    playerBoard,
    aiBoard,
    playerSlots: pRes.slots,
    aiSlots: aRes.slots,
    playerTotal: pRes.total,
    aiTotal: aRes.total,
    winner,
  };
}

export function chooseBestGToonsMove(aiBoard, playerBoard, aiHand) {
  const openSlots = [];
  for (let s = 0; s < 6; s++) if (!aiBoard[s]) openSlots.push(s);
  if (!openSlots.length || !aiHand.length) return null;

  let best = null;
  for (let ci = 0; ci < aiHand.length; ci++) {
    const card = aiHand[ci];
    for (const slotIdx of openSlots) {
      const nextAi = [...aiBoard];
      nextAi[slotIdx] = card;
      const evalRes = evaluateGToonsMatch(playerBoard, nextAi);
      const diff = evalRes.aiTotal - evalRes.playerTotal;
      // Prefer strong net gain and front Terra shield when slots are tied
      const positionalBias = (slotIdx < 3 && card.rowBonus === 'front') || (slotIdx >= 3 && card.rowBonus === 'back') ? 0.25 : 0;
      const score = diff + positionalBias;
      if (!best || score > best.score) {
        best = { cardIdx: ci, slotIdx, score };
      }
    }
  }
  return best;
}

// ── Tic-Tac-Toe Minimax ──────────────────────────────────────────────────

const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function checkTttWinner(squares) {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line };
    }
  }
  if (squares.every((s) => s !== null)) return { winner: 'Draw', line: null };
  return { winner: null, line: null };
}

function minimaxTtt(board, isAiTurn, aiMark, humanMark, depth) {
  const { winner } = checkTttWinner(board);
  if (winner === aiMark) return 10 - depth;
  if (winner === humanMark) return depth - 10;
  if (winner === 'Draw') return 0;

  let best = isAiTurn ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    board[i] = isAiTurn ? aiMark : humanMark;
    const score = minimaxTtt(board, !isAiTurn, aiMark, humanMark, depth + 1);
    board[i] = null;
    best = isAiTurn ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

export function chooseBestTttMove(board, aiMark = 'O', difficulty = 'unbeatable', rng = Math.random) {
  const empty = [];
  for (let i = 0; i < 9; i++) if (board[i] === null) empty.push(i);
  if (!empty.length) return -1;

  if (difficulty === 'casual') {
    return empty[Math.floor(rng() * empty.length)];
  }

  const humanMark = aiMark === 'O' ? 'X' : 'O';
  // Immediate winning or blocking move always wins/defends on tactical & unbeatable
  for (const idx of empty) {
    const copy = [...board];
    copy[idx] = aiMark;
    if (checkTttWinner(copy).winner === aiMark) return idx;
  }
  for (const idx of empty) {
    const copy = [...board];
    copy[idx] = humanMark;
    if (checkTttWinner(copy).winner === humanMark) return idx;
  }

  if (difficulty === 'tactical' && rng() < 0.35) {
    return empty[Math.floor(rng() * empty.length)];
  }

  let bestScore = -Infinity;
  let bestMoves = [];
  const work = [...board];
  for (const idx of empty) {
    work[idx] = aiMark;
    const score = minimaxTtt(work, false, aiMark, humanMark, 0);
    work[idx] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [idx];
    } else if (score === bestScore) {
      bestMoves.push(idx);
    }
  }
  return bestMoves.includes(4) ? 4 : bestMoves[Math.floor(rng() * bestMoves.length)];
}

// ── Dots & Boxes (4x4 dots = 3x3 boxes) ──────────────────────────────────

function boxSideCount(hLines, vLines, r, c) {
  return (hLines[r * 3 + c] ? 1 : 0) +
    (hLines[(r + 1) * 3 + c] ? 1 : 0) +
    (vLines[r * 4 + c] ? 1 : 0) +
    (vLines[r * 4 + c + 1] ? 1 : 0);
}

export function applyDotsMove(hLines, vLines, boxes, type, idx, owner) {
  const nextH = [...hLines];
  const nextV = [...vLines];
  if (type === 'H') nextH[idx] = true;
  else nextV[idx] = true;

  const nextBoxes = [...boxes];
  let gained = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const bi = r * 3 + c;
      if (nextBoxes[bi] === null && boxSideCount(nextH, nextV, r, c) === 4) {
        nextBoxes[bi] = owner;
        gained++;
      }
    }
  }
  const done = nextBoxes.every((b) => b !== null);
  let winner = null;
  if (done) {
    const p = nextBoxes.filter((b) => b === 'P').length;
    const a = nextBoxes.filter((b) => b === 'AI').length;
    winner = p > a ? 'player' : a > p ? 'ai' : 'draw';
  }
  return { hLines: nextH, vLines: nextV, boxes: nextBoxes, gained, done, winner };
}

export function chooseBestDotsMove(hLines, vLines, boxes, rng = Math.random) {
  const candidates = [];
  for (let i = 0; i < 12; i++) if (!hLines[i]) candidates.push({ type: 'H', idx: i });
  for (let i = 0; i < 12; i++) if (!vLines[i]) candidates.push({ type: 'V', idx: i });
  if (!candidates.length) return null;

  // 1. Complete any 3-sided box right away.
  const scoring = [];
  const safe = [];
  const risky = [];
  for (const move of candidates) {
    const res = applyDotsMove(hLines, vLines, boxes, move.type, move.idx, 'AI');
    if (res.gained > 0) {
      scoring.push({ move, gained: res.gained });
      continue;
    }
    let createsThree = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (res.boxes[r * 3 + c] === null && boxSideCount(res.hLines, res.vLines, r, c) === 3) {
          createsThree++;
        }
      }
    }
    if (createsThree === 0) safe.push(move);
    else risky.push({ move, createsThree });
  }

  if (scoring.length) {
    scoring.sort((a, b) => b.gained - a.gained);
    return scoring[0].move;
  }
  if (safe.length) {
    return safe[Math.floor(rng() * safe.length)];
  }
  risky.sort((a, b) => a.createsThree - b.createsThree);
  return risky[0].move;
}

// ── 8x8 Checkers (Draughts) with mandatory captures & multi-jumps ─────────

export function createInitialCheckersBoard() {
  const board = Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r * 8 + c] = { side: 'ai', king: false };
        else if (r > 4) board[r * 8 + c] = { side: 'player', king: false };
      }
    }
  }
  return board;
}

function pieceDirections(piece) {
  if (piece.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return piece.side === 'player' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

export function getPieceCheckersMoves(board, idx) {
  const piece = board[idx];
  if (!piece) return { captures: [], quiet: [] };
  const r = Math.floor(idx / 8);
  const c = idx % 8;
  const captures = [];
  const quiet = [];
  for (const [dr, dc] of pieceDirections(piece)) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
    const nIdx = nr * 8 + nc;
    if (!board[nIdx]) {
      quiet.push({ from: idx, to: nIdx, capture: null });
    } else if (board[nIdx].side !== piece.side) {
      const jr = nr + dr;
      const jc = nc + dc;
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8) {
        const jIdx = jr * 8 + jc;
        if (!board[jIdx]) captures.push({ from: idx, to: jIdx, capture: nIdx });
      }
    }
  }
  return { captures, quiet };
}

export function getCheckersLegalMoves(board, side, forcedFrom = null) {
  if (forcedFrom !== null) {
    const piece = board[forcedFrom];
    if (!piece || piece.side !== side) return [];
    return getPieceCheckersMoves(board, forcedFrom).captures;
  }
  const allCaptures = [];
  const allQuiet = [];
  for (let i = 0; i < 64; i++) {
    if (board[i]?.side !== side) continue;
    const { captures, quiet } = getPieceCheckersMoves(board, i);
    allCaptures.push(...captures);
    allQuiet.push(...quiet);
  }
  return allCaptures.length ? allCaptures : allQuiet;
}

export function applyCheckersMove(board, move) {
  const next = board.map((cell) => (cell ? { ...cell } : null));
  const piece = { ...next[move.from] };
  next[move.from] = null;
  if (move.capture !== null) next[move.capture] = null;

  const toRow = Math.floor(move.to / 8);
  const justCrowned = !piece.king && ((piece.side === 'player' && toRow === 0) || (piece.side === 'ai' && toRow === 7));
  if (justCrowned) piece.king = true;
  next[move.to] = piece;

  // Multi-jump continues from destination unless just promoted (standard American checkers rule).
  const furtherCaptures = move.capture !== null && !justCrowned
    ? getPieceCheckersMoves(next, move.to).captures
    : [];

  return {
    board: next,
    moreJumpsFrom: furtherCaptures.length ? move.to : null,
    justCrowned,
  };
}

export function getCheckersWinner(board, nextTurn) {
  let playerCount = 0;
  let aiCount = 0;
  for (const cell of board) {
    if (cell?.side === 'player') playerCount++;
    else if (cell?.side === 'ai') aiCount++;
  }
  if (aiCount === 0) return 'player';
  if (playerCount === 0) return 'ai';
  if (getCheckersLegalMoves(board, nextTurn).length === 0) {
    return nextTurn === 'player' ? 'ai' : 'player';
  }
  return null;
}

function scoreCheckersBoard(board) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const cell = board[i];
    if (!cell) continue;
    const row = Math.floor(i / 8);
    const col = i % 8;
    const centerBonus = (col >= 2 && col <= 5 ? 0.2 : 0) + (row >= 2 && row <= 5 ? 0.15 : 0);
    const val = (cell.king ? 5 : 2.5) + centerBonus;
    score += cell.side === 'ai' ? val : -val;
  }
  return score;
}

export function chooseBestCheckersMove(board, forcedFrom = null, rng = Math.random) {
  const moves = getCheckersLegalMoves(board, 'ai', forcedFrom);
  if (!moves.length) return null;

  let bestScore = -Infinity;
  let bestMoves = [];
  for (const mv of moves) {
    const step = applyCheckersMove(board, mv);
    let evalVal;
    if (step.moreJumpsFrom !== null) {
      const followUps = getCheckersLegalMoves(step.board, 'ai', step.moreJumpsFrom);
      evalVal = Math.max(...followUps.map((f) => scoreCheckersBoard(applyCheckersMove(step.board, f).board))) + 1.5;
    } else {
      const oppMoves = getCheckersLegalMoves(step.board, 'player');
      if (!oppMoves.length) {
        evalVal = 1000;
      } else {
        evalVal = Math.min(...oppMoves.map((om) => scoreCheckersBoard(applyCheckersMove(step.board, om).board)));
      }
    }
    if (step.justCrowned) evalVal += 2.0;
    if (evalVal > bestScore) {
      bestScore = evalVal;
      bestMoves = [mv];
    } else if (Math.abs(evalVal - bestScore) < 0.001) {
      bestMoves.push(mv);
    }
  }
  return bestMoves[Math.floor(rng() * bestMoves.length)];
}

