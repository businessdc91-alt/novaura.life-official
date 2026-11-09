/**
 * holoChessService.js — Full Sovereign Chess Rules Engine, AI Minimax, Procedural Audio & P2P Mesh Layer
 * 100% offline, zero-dependency chess rules with legal move generation, check/checkmate/stalemate,
 * heuristic evaluation, minimax alpha-beta pruning, Web Audio sound synthesis, and P2P mesh relay.
 * Pure (no mesh or DOM imports) so the rules can be tested in Node; holoChessMesh.js carries packets.
 */

// ── Types and Constants ─────────────────────────────────────────────────────

export const PIECE_TYPES = {
  PAWN: 'p',
  KNIGHT: 'n',
  BISHOP: 'b',
  ROOK: 'r',
  QUEEN: 'q',
  KING: 'k',
};

export const COLORS = {
  WHITE: 'w', // Nova Faction (Electric Cyan)
  BLACK: 'b', // Aura Faction (Radiant Violet)
};

export const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Positional Tables (PST) for midgame evaluation
// Tables are from White's perspective (row 0 = rank 8, row 7 = rank 1)
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_MIDGAME_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

// Initial board layout
export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ── Audio Synthesizer (Zero External Assets) ────────────────────────────────

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playChessSound(soundType) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (soundType === 'select') {
      // Gentle sine frequency sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1050, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (soundType === 'move') {
      // Resonant photon docking tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (soundType === 'capture') {
      // Plasma laser strike and noise burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);

      // White noise pop
      const bufferSize = ctx.sampleRate * 0.06;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      whiteNoise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start(now);
    } else if (soundType === 'check') {
      // Urgent holographic siren pulse
      [0, 0.09].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(idx === 0 ? 880 : 700, now + offset);
        gain.gain.setValueAtTime(0.1, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.08);
      });
    } else if (soundType === 'checkmate' || soundType === 'victory') {
      // Major triad arpeggio victory fanfare
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.12, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.5);
      });
    }
  } catch (err) {
    // Audio synthesis fallback (silent on restrictive browsers)
  }
}

// ── Board State & Legal Move Engine ─────────────────────────────────────────

export function createInitialBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));

  // Pawns
  for (let c = 0; c < 8; c++) {
    board[1][c] = { type: 'p', color: 'b', id: `b_p_${c}` };
    board[6][c] = { type: 'p', color: 'w', id: `w_p_${c}` };
  }

  // Major pieces
  const pieces = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: pieces[c], color: 'b', id: `b_${pieces[c]}_${c}` };
    board[7][c] = { type: pieces[c], color: 'w', id: `w_${pieces[c]}_${c}` };
  }

  return board;
}

export function parseFEN(fen = INITIAL_FEN) {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  const board = Array(8).fill(null).map(() => Array(8).fill(null));

  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r];
    let c = 0;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (/[1-8]/.test(char)) {
        c += parseInt(char, 10);
      } else {
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase();
        board[r][c] = { type, color, id: `${color}_${type}_${r}_${c}` };
        c++;
      }
    }
  }

  const turn = parts[1] || 'w';
  const castlingStr = parts[2] || 'KQkq';
  const castling = {
    wK: castlingStr.includes('K'),
    wQ: castlingStr.includes('Q'),
    bK: castlingStr.includes('k'),
    bQ: castlingStr.includes('q'),
  };

  const enPassantStr = parts[3] || '-';
  let enPassant = null;
  if (enPassantStr !== '-') {
    const col = enPassantStr.charCodeAt(0) - 97;
    const row = 8 - parseInt(enPassantStr[1], 10);
    enPassant = { row, col };
  }

  return {
    board,
    turn,
    activeColor: turn,
    castling,
    enPassant,
    halfmove: parseInt(parts[4] || '0', 10),
    fullmove: parseInt(parts[5] || '1', 10),
  };
}

export function generateFEN(state) {
  const { board, turn, castling, enPassant, halfmove = 0, fullmove = 1 } = state;
  const rows = [];

  for (let r = 0; r < 8; r++) {
    let rowStr = '';
    let emptyCount = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        const char = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
        rowStr += char;
      }
    }
    if (emptyCount > 0) rowStr += emptyCount;
    rows.push(rowStr);
  }

  let castlingStr = '';
  if (castling.wK) castlingStr += 'K';
  if (castling.wQ) castlingStr += 'Q';
  if (castling.bK) castlingStr += 'k';
  if (castling.bQ) castlingStr += 'q';
  if (!castlingStr) castlingStr = '-';

  const epStr = enPassant ? `${String.fromCharCode(97 + enPassant.col)}${8 - enPassant.row}` : '-';

  return `${rows.join('/')} ${turn} ${castlingStr} ${epStr} ${halfmove} ${fullmove}`;
}

export function cloneBoard(board) {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

export function isInsideBoard(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function squareToCoords(squareStr) {
  if (!squareStr || squareStr.length < 2) return null;
  const col = squareStr.charCodeAt(0) - 97;
  const row = 8 - parseInt(squareStr[1], 10);
  return { row, col };
}

export function coordsToSquare(row, col) {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

/**
 * Checks if a square (r, c) is attacked by pieces of byColor
 */
export function isSquareAttacked(board, targetRow, targetCol, byColor) {
  // 1. Pawn attacks
  const pawnPawnRow = byColor === 'w' ? targetRow + 1 : targetRow - 1;
  for (const cOffset of [-1, 1]) {
    const pc = targetCol + cOffset;
    if (isInsideBoard(pawnPawnRow, pc)) {
      const piece = board[pawnPawnRow][pc];
      if (piece && piece.color === byColor && piece.type === 'p') return true;
    }
  }

  // 2. Knight attacks
  const knightMoves = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of knightMoves) {
    const nr = targetRow + dr;
    const nc = targetCol + dc;
    if (isInsideBoard(nr, nc)) {
      const piece = board[nr][nc];
      if (piece && piece.color === byColor && piece.type === 'n') return true;
    }
  }

  // 3. Straight ray attacks (Rook & Queen)
  const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of straightDirs) {
    let nr = targetRow + dr;
    let nc = targetCol + dc;
    while (isInsideBoard(nr, nc)) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'r' || piece.type === 'q')) return true;
        break; // Obstacle hit
      }
      nr += dr;
      nc += dc;
    }
  }

  // 4. Diagonal ray attacks (Bishop & Queen)
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of diagDirs) {
    let nr = targetRow + dr;
    let nc = targetCol + dc;
    while (isInsideBoard(nr, nc)) {
      const piece = board[nr][nc];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'b' || piece.type === 'q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  // 5. King adjacent attack
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = targetRow + dr;
      const nc = targetCol + dc;
      if (isInsideBoard(nr, nc)) {
        const piece = board[nr][nc];
        if (piece && piece.color === byColor && piece.type === 'k') return true;
      }
    }
  }

  return false;
}

/**
 * Locate king of a given color
 */
export function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

export function isKingInCheck(boardOrState, color) {
  const board = boardOrState?.board ? boardOrState.board : boardOrState;
  const targetColor = color || boardOrState?.turn || boardOrState?.activeColor || 'w';
  const kingPos = findKing(board, targetColor);
  if (!kingPos) return false;
  const enemyColor = targetColor === 'w' ? 'b' : 'w';
  return isSquareAttacked(board, kingPos.row, kingPos.col, enemyColor);
}

/**
 * Generate all pseudo-legal moves for a piece at (r, c)
 */
export function getPseudoLegalMoves(board, r, c, castling, enPassant) {
  const piece = board[r][c];
  if (!piece) return [];
  const moves = [];
  const color = piece.color;
  const enemyColor = color === 'w' ? 'b' : 'w';

  if (piece.type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;

    // 1-step forward
    const nextRow = r + dir;
    if (isInsideBoard(nextRow, c) && !board[nextRow][c]) {
      if (nextRow === promoRow) {
        ['q', 'r', 'b', 'n'].forEach(promo => {
          moves.push({ from: { row: r, col: c }, to: { row: nextRow, col: c }, promotion: promo });
        });
      } else {
        moves.push({ from: { row: r, col: c }, to: { row: nextRow, col: c } });
      }

      // 2-step forward from starting row
      const twoRow = r + dir * 2;
      if (r === startRow && !board[twoRow][c]) {
        moves.push({ from: { row: r, col: c }, to: { row: twoRow, col: c }, isDoublePawn: true });
      }
    }

    // Diagonal captures
    for (const dc of [-1, 1]) {
      const targetCol = c + dc;
      if (isInsideBoard(nextRow, targetCol)) {
        const destPiece = board[nextRow][targetCol];
        if (destPiece && destPiece.color === enemyColor) {
          if (nextRow === promoRow) {
            ['q', 'r', 'b', 'n'].forEach(promo => {
              moves.push({ from: { row: r, col: c }, to: { row: nextRow, col: targetCol }, promotion: promo, isCapture: true });
            });
          } else {
            moves.push({ from: { row: r, col: c }, to: { row: nextRow, col: targetCol }, isCapture: true });
          }
        } else if (enPassant && enPassant.row === nextRow && enPassant.col === targetCol) {
          // En passant capture
          moves.push({ from: { row: r, col: c }, to: { row: nextRow, col: targetCol }, isCapture: true, isEnPassant: true });
        }
      }
    }
  } else if (piece.type === 'n') {
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (isInsideBoard(nr, nc)) {
        const destPiece = board[nr][nc];
        if (!destPiece || destPiece.color === enemyColor) {
          moves.push({ from: { row: r, col: c }, to: { row: nr, col: nc }, isCapture: Boolean(destPiece) });
        }
      }
    }
  } else if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
    const dirs = [];
    if (piece.type === 'b' || piece.type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    if (piece.type === 'r' || piece.type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (isInsideBoard(nr, nc)) {
        const destPiece = board[nr][nc];
        if (!destPiece) {
          moves.push({ from: { row: r, col: c }, to: { row: nr, col: nc } });
        } else {
          if (destPiece.color === enemyColor) {
            moves.push({ from: { row: r, col: c }, to: { row: nr, col: nc }, isCapture: true });
          }
          break; // Blocked by piece
        }
        nr += dr;
        nc += dc;
      }
    }
  } else if (piece.type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (isInsideBoard(nr, nc)) {
          const destPiece = board[nr][nc];
          if (!destPiece || destPiece.color === enemyColor) {
            moves.push({ from: { row: r, col: c }, to: { row: nr, col: nc }, isCapture: Boolean(destPiece) });
          }
        }
      }
    }

    // Castling
    const baseRow = color === 'w' ? 7 : 0;
    if (r === baseRow && c === 4 && !isSquareAttacked(board, baseRow, 4, enemyColor)) {
      // Kingside (O-O)
      const canKingside = color === 'w' ? castling.wK : castling.bK;
      if (canKingside && !board[baseRow][5] && !board[baseRow][6]) {
        if (!isSquareAttacked(board, baseRow, 5, enemyColor) && !isSquareAttacked(board, baseRow, 6, enemyColor)) {
          const rook = board[baseRow][7];
          if (rook && rook.type === 'r' && rook.color === color) {
            moves.push({ from: { row: r, col: c }, to: { row: baseRow, col: 6 }, isCastlingKingside: true });
          }
        }
      }

      // Queenside (O-O-O)
      const canQueenside = color === 'w' ? castling.wQ : castling.bQ;
      if (canQueenside && !board[baseRow][3] && !board[baseRow][2] && !board[baseRow][1]) {
        if (!isSquareAttacked(board, baseRow, 3, enemyColor) && !isSquareAttacked(board, baseRow, 2, enemyColor)) {
          const rook = board[baseRow][0];
          if (rook && rook.type === 'r' && rook.color === color) {
            moves.push({ from: { row: r, col: c }, to: { row: baseRow, col: 2 }, isCastlingQueenside: true });
          }
        }
      }
    }
  }

  return moves;
}

/**
 * Execute move on board and return new state representation
 */
export function simulateMove(board, move, castling, enPassant) {
  const newBoard = cloneBoard(board);
  const newCastling = { ...castling };
  let newEnPassant = null;

  const { from, to, promotion, isCastlingKingside, isCastlingQueenside, isEnPassant, isDoublePawn } = move;
  const movingPiece = { ...newBoard[from.row][from.col] };

  // Pawn promotion
  if (promotion) {
    movingPiece.type = promotion;
  }

  newBoard[to.row][to.col] = movingPiece;
  newBoard[from.row][from.col] = null;

  // Handle En Passant capture (remove the enemy pawn behind)
  if (isEnPassant) {
    const capturedPawnRow = movingPiece.color === 'w' ? to.row + 1 : to.row - 1;
    newBoard[capturedPawnRow][to.col] = null;
  }

  // Handle double pawn push (set en passant target)
  if (isDoublePawn) {
    const epRow = movingPiece.color === 'w' ? from.row - 1 : from.row + 1;
    newEnPassant = { row: epRow, col: from.col };
  }

  // Handle Castling (move the rook)
  if (isCastlingKingside) {
    const rook = newBoard[from.row][7];
    newBoard[from.row][5] = rook;
    newBoard[from.row][7] = null;
  } else if (isCastlingQueenside) {
    const rook = newBoard[from.row][0];
    newBoard[from.row][3] = rook;
    newBoard[from.row][0] = null;
  }

  // Update Castling rights
  if (movingPiece.type === 'k') {
    if (movingPiece.color === 'w') { newCastling.wK = false; newCastling.wQ = false; }
    else { newCastling.bK = false; newCastling.bQ = false; }
  } else if (movingPiece.type === 'r') {
    if (from.row === 7 && from.col === 7) newCastling.wK = false;
    if (from.row === 7 && from.col === 0) newCastling.wQ = false;
    if (from.row === 0 && from.col === 7) newCastling.bK = false;
    if (from.row === 0 && from.col === 0) newCastling.bQ = false;
  }

  // A rook captured on its home square takes that castling right with it.
  if (to.row === 7 && to.col === 7) newCastling.wK = false;
  if (to.row === 7 && to.col === 0) newCastling.wQ = false;
  if (to.row === 0 && to.col === 7) newCastling.bK = false;
  if (to.row === 0 && to.col === 0) newCastling.bQ = false;

  return { newBoard, newCastling, newEnPassant };
}

/**
 * Legal moves in board coordinates, without notation. The AI search calls this
 * thousands of times, so it skips the SAN work getLegalMoves does for the UI.
 */
function legalMovesRaw(state) {
  const { board, turn, castling, enPassant } = state;
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== turn) continue;
      for (const move of getPseudoLegalMoves(board, r, c, castling, enPassant)) {
        const { newBoard } = simulateMove(board, move, castling, enPassant);
        if (!isKingInCheck(newBoard, turn)) moves.push(move);
      }
    }
  }
  return moves;
}

/** The position after a coordinate move, for the search (no move counters). */
function searchChild(state, move) {
  const { newBoard, newCastling, newEnPassant } = simulateMove(state.board, move, state.castling, state.enPassant);
  return { board: newBoard, turn: state.turn === 'w' ? 'b' : 'w', castling: newCastling, enPassant: newEnPassant };
}

/**
 * Filter pseudo-legal moves into strictly legal moves (no leaving King in check)
 */
export function getLegalMoves(stateOrFen) {
  const state = typeof stateOrFen === 'string' ? parseFEN(stateOrFen) : stateOrFen;
  const { board } = state;

  return legalMovesRaw(state).map((move) => {
    const destPiece = board[move.to.row][move.to.col];
    const isCap = Boolean(destPiece) || Boolean(move.isEnPassant);
    const enhancedMove = {
      ...move,
      from: coordsToSquare(move.from.row, move.from.col),
      to: coordsToSquare(move.to.row, move.to.col),
      fromCoords: move.from,
      toCoords: move.to,
      piece: board[move.from.row][move.from.col].type,
      captured: isCap ? (destPiece?.type || 'p') : null,
      isCapture: isCap,
    };
    enhancedMove.san = moveToSAN(state, enhancedMove);
    return enhancedMove;
  });
}

/**
 * Why the position is a draw even though moves remain, or null: the fifty-move
 * rule, or too little material left for either side to mate.
 */
export function drawReason(stateOrFen) {
  const state = typeof stateOrFen === 'string' ? parseFEN(stateOrFen) : stateOrFen;
  if ((state.halfmove || 0) >= 100) return 'the fifty-move rule';
  const rest = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.type !== 'k') rest.push({ type: p.type, shade: (r + c) % 2 });
    }
  }
  const lone = rest.length === 1 && (rest[0].type === 'n' || rest[0].type === 'b');
  const sameShadeBishops = rest.length > 0 && rest.every(p => p.type === 'b') && new Set(rest.map(p => p.shade)).size === 1;
  return rest.length === 0 || lone || sameShadeBishops ? 'insufficient material' : null;
}

/**
 * Converts a move object into Standard Algebraic Notation (SAN)
 */
export function moveToSAN(state, move) {
  const { board } = state;
  const fromRow = move.fromCoords ? move.fromCoords.row : (typeof move.from === 'object' ? move.from.row : squareToCoords(move.from).row);
  const fromCol = move.fromCoords ? move.fromCoords.col : (typeof move.from === 'object' ? move.from.col : squareToCoords(move.from).col);
  const toRow = move.toCoords ? move.toCoords.row : (typeof move.to === 'object' ? move.to.row : squareToCoords(move.to).row);
  const toCol = move.toCoords ? move.toCoords.col : (typeof move.to === 'object' ? move.to.col : squareToCoords(move.to).col);

  const piece = board[fromRow][fromCol];
  if (!piece) return '';

  if (move.isCastlingKingside) return 'O-O';
  if (move.isCastlingQueenside) return 'O-O-O';

  const toSquare = coordsToSquare(toRow, toCol);
  const isCapture = Boolean(board[toRow][toCol]) || move.isEnPassant;

  let san = '';
  if (piece.type === 'p') {
    if (isCapture) {
      san = `${String.fromCharCode(97 + fromCol)}x${toSquare}`;
    } else {
      san = toSquare;
    }
    if (move.promotion) {
      san += `=${move.promotion.toUpperCase()}`;
    }
  } else {
    san = piece.type.toUpperCase();
    if (isCapture) san += 'x';
    san += toSquare;
  }

  // Check if this move delivers check or checkmate
  const rawMove = { ...move, from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
  const { newBoard, newCastling, newEnPassant } = simulateMove(board, rawMove, state.castling, state.enPassant);
  const enemyColor = piece.color === 'w' ? 'b' : 'w';
  if (isKingInCheck(newBoard, enemyColor)) {
    const enemyState = {
      board: newBoard,
      turn: enemyColor,
      castling: newCastling,
      enPassant: newEnPassant,
    };
    // Quick legal check
    let hasLegal = false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = newBoard[r][c];
        if (p && p.color === enemyColor) {
          const pm = getPseudoLegalMoves(newBoard, r, c, newCastling, newEnPassant);
          for (const m of pm) {
            const testSim = simulateMove(newBoard, m, newCastling, newEnPassant);
            if (!isKingInCheck(testSim.newBoard, enemyColor)) {
              hasLegal = true;
              break;
            }
          }
          if (hasLegal) break;
        }
      }
      if (hasLegal) break;
    }
    san += !hasLegal ? '#' : '+';
  }

  return san;
}

/**
 * Execute move on FEN or state and return updated FEN and flags
 */
export function makeMove(fenOrState, move) {
  const state = typeof fenOrState === 'string' ? parseFEN(fenOrState) : fenOrState;
  const fromRow = move.fromCoords ? move.fromCoords.row : (typeof move.from === 'object' ? move.from.row : squareToCoords(move.from).row);
  const fromCol = move.fromCoords ? move.fromCoords.col : (typeof move.from === 'object' ? move.from.col : squareToCoords(move.from).col);
  const toRow = move.toCoords ? move.toCoords.row : (typeof move.to === 'object' ? move.to.row : squareToCoords(move.to).row);
  const toCol = move.toCoords ? move.toCoords.col : (typeof move.to === 'object' ? move.to.col : squareToCoords(move.to).col);

  const rawMove = {
    ...move,
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
  };

  const san = moveToSAN(state, rawMove);
  const { newBoard, newCastling, newEnPassant } = simulateMove(state.board, rawMove, state.castling, state.enPassant);
  const nextTurn = state.turn === 'w' ? 'b' : 'w';
  const nextFullmove = state.turn === 'b' ? state.fullmove + 1 : state.fullmove;
  const destPiece = state.board[toRow][toCol];
  const isCap = Boolean(destPiece) || move.isEnPassant;
  const nextHalfmove = isCap || (state.board[fromRow][fromCol]?.type === 'p') ? 0 : state.halfmove + 1;

  const nextState = {
    board: newBoard,
    turn: nextTurn,
    activeColor: nextTurn,
    castling: newCastling,
    enPassant: newEnPassant,
    halfmove: nextHalfmove,
    fullmove: nextFullmove,
  };

  const newFen = generateFEN(nextState);
  const inCheck = isKingInCheck(newBoard, nextTurn);
  const nextLegalMoves = getLegalMoves(nextState);
  const isGameOver = nextLegalMoves.length === 0;
  const isCheckmate = isGameOver && inCheck;
  const isStalemate = isGameOver && !inCheck;

  return {
    state: nextState,
    fen: newFen,
    san,
    captured: move.captured || (destPiece ? destPiece.type : (move.isEnPassant ? 'p' : null)),
    inCheck,
    isCheckmate,
    isStalemate,
  };
}

// ── AI Engine: Minimax with Alpha-Beta Pruning ───────────────────────────────

function evaluateBoard(board, persona = 'nova') {
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const baseVal = PIECE_VALUES[piece.type] || 0;
      let posVal = 0;

      // PST lookup
      const pstRow = piece.color === 'w' ? r : 7 - r;
      if (piece.type === 'p') posVal = PAWN_PST[pstRow][c];
      else if (piece.type === 'n') posVal = KNIGHT_PST[pstRow][c];
      else if (piece.type === 'b') posVal = BISHOP_PST[pstRow][c];
      else if (piece.type === 'r') posVal = ROOK_PST[pstRow][c];
      else if (piece.type === 'q') posVal = QUEEN_PST[pstRow][c];
      else if (piece.type === 'k') posVal = KING_MIDGAME_PST[pstRow][c];

      // Persona bias
      if (persona === 'aura') {
        // Aura favors dynamic attacks and forward knight/queen positioning
        if (piece.type === 'n' || piece.type === 'q') posVal += 12;
      } else {
        // Nova favors solid center control and pawn cohesion
        if (piece.type === 'p' && (c === 3 || c === 4)) posVal += 8;
      }

      const totalVal = baseVal + posVal;
      score += piece.color === 'w' ? totalVal : -totalVal;
    }
  }

  return score;
}

const MATE_SCORE = 99999;

// Captures of valuable pieces and promotions first, so alpha-beta cuts early.
function moveOrderScore(board, move) {
  const victim = board[move.to.row][move.to.col];
  return (victim ? PIECE_VALUES[victim.type] : move.isEnPassant ? PIECE_VALUES.p : 0) + (move.promotion ? PIECE_VALUES[move.promotion] : 0);
}

// White maximises, Black minimises. `ply` counts moves from the root, so a
// nearer mate scores higher than a distant one.
function minimax(state, depth, alpha, beta, ply, persona) {
  if (depth === 0) {
    return evaluateBoard(state.board, persona);
  }

  const moves = legalMovesRaw(state);
  if (moves.length === 0) {
    if (isKingInCheck(state.board, state.turn)) {
      return state.turn === 'w' ? -MATE_SCORE + ply : MATE_SCORE - ply;
    }
    return 0; // Stalemate
  }

  moves.sort((a, b) => moveOrderScore(state.board, b) - moveOrderScore(state.board, a));

  if (state.turn === 'w') {
    let maxEval = -Infinity;
    for (const move of moves) {
      const evaluation = minimax(searchChild(state, move), depth - 1, alpha, beta, ply + 1, persona);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break; // Beta cut-off
    }
    return maxEval;
  }
  let minEval = Infinity;
  for (const move of moves) {
    const evaluation = minimax(searchChild(state, move), depth - 1, alpha, beta, ply + 1, persona);
    minEval = Math.min(minEval, evaluation);
    beta = Math.min(beta, evaluation);
    if (beta <= alpha) break; // Alpha cut-off
  }
  return minEval;
}

/**
 * Finds the optimal AI move based on depth and persona. Returns one of
 * getLegalMoves' moves (square names, SAN), or null when there is none.
 */
export function calculateBestMove(stateOrFen, depth = 3, persona = 'nova') {
  const state = typeof stateOrFen === 'string' ? parseFEN(stateOrFen) : stateOrFen;
  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) return null;

  // Shuffle first so equally good moves vary from game to game, then put
  // captures and promotions first (the sort is stable).
  for (let i = legalMoves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [legalMoves[i], legalMoves[j]] = [legalMoves[j], legalMoves[i]];
  }
  const raw = (move) => ({ ...move, from: move.fromCoords, to: move.toCoords });
  legalMoves.sort((a, b) => moveOrderScore(state.board, raw(b)) - moveOrderScore(state.board, raw(a)));

  const isMaximizing = state.turn === 'w';
  let bestMove = legalMoves[0];
  let bestEval = isMaximizing ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of legalMoves) {
    const evaluation = minimax(searchChild(state, raw(move)), depth - 1, alpha, beta, 1, persona);
    if (isMaximizing ? evaluation > bestEval : evaluation < bestEval) {
      bestEval = evaluation;
      bestMove = move;
    }
    if (isMaximizing) alpha = Math.max(alpha, evaluation);
    else beta = Math.min(beta, evaluation);
  }

  return bestMove;
}

export function getPieceEvaluationScore(board) {
  return evaluateBoard(board, 'nova');
}

// ── AI Commentary Generator ─────────────────────────────────────────────────

export function getMoveCommentary(moveSAN, pieceType, isCapture, isCheck, isCheckmate, persona = 'nova') {
  if (isCheckmate) {
    return persona === 'aura'
      ? `Checkmate! The quantum convergence has settled. A brilliant aesthetic conclusion to the holographic battle.`
      : `Checkmate. Mathematical inevitability verified. Zero legal branch exits remained for the opposing King.`;
  }

  if (isCheck) {
    return persona === 'aura'
      ? `Check! The adversary's sovereign King is enveloped in the plasma crosshairs.`
      : `Warning: King in check. Urgent evasive vector calculation required.`;
  }

  if (isCapture) {
    return persona === 'aura'
      ? `Material disintegration confirmed. The board dynamics shift toward entropy.`
      : `Exchange executed with precision. Recalculating positional advantages.`;
  }

  if (moveSAN === 'O-O' || moveSAN === 'O-O-O') {
    return persona === 'aura'
      ? `The monarch retreats into the celestial fortress while the heavy rooks connect.`
      : `Castling completed. King safety secured and rook development mobilized.`;
  }

  const standardQuotes = persona === 'aura' ? [
    `An inspired thrust on ${moveSAN}. The tension across the holographic board is palpable.`,
    `Aesthetic development. Controlling key diagonal lightways.`,
    `Probing the adversary's flank with elegant geometric pressure.`,
    `Harmonic piece coordination. The neural swarm approves.`
  ] : [
    `Move ${moveSAN} maintains structural equilibrium across the center files.`,
    `Calculating downstream branches... positional leverage remains intact.`,
    `Solid development. Pieces operating with maximum compute density.`,
    `Center squares locked. Preparing tactical multi-turn sequence.`
  ];

  return standardQuotes[Math.floor(Math.random() * standardQuotes.length)];
}

export function generateAiCommentary(historyEntry, fen, persona = 'nova') {
  const isCapture = Boolean(historyEntry?.captured);
  const isCheck = (historyEntry?.san || '').includes('+');
  const isCheckmate = (historyEntry?.san || '').includes('#');
  return getMoveCommentary(historyEntry?.san || '', historyEntry?.piece || 'p', isCapture, isCheck, isCheckmate, persona);
}

// ── Mesh match packets ──────────────────────────────────────────────────────
// Only moves travel ({ from, to, promotion } and the ply they were played at).
// The receiver replays each one through its own rules, so a peer can never
// push an illegal move or a made-up position.

const GAME_ID_RE = /^hc_[0-9a-f]{16}$/;
const SQUARE_RE = /^[a-h][1-8]$/;

export function newChessGameId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `hc_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** A received packet's data, cleaned, or null if it is malformed. */
export function cleanChessPacket(data) {
  if (!data || typeof data !== 'object' || !GAME_ID_RE.test(String(data.gameId || ''))) return null;
  const base = { kind: data.kind, gameId: data.gameId, name: String(data.name ?? '').slice(0, 40) || 'Mesh peer' };
  switch (data.kind) {
    case 'invite':
    case 'accept':
    case 'decline':
    case 'resign':
      return base;
    case 'move': {
      if (!SQUARE_RE.test(String(data.from)) || !SQUARE_RE.test(String(data.to))) return null;
      if (!Number.isInteger(data.ply) || data.ply < 0 || data.ply > 2000) return null;
      if (data.promotion != null && !['q', 'r', 'b', 'n'].includes(data.promotion)) return null;
      return { ...base, from: data.from, to: data.to, ply: data.ply, promotion: data.promotion || null };
    }
    default:
      return null;
  }
}

/**
 * Validate standard 6-field FEN syntax and legality
 */
export function validateFEN(fen) {
  if (typeof fen !== 'string') return { valid: false, error: 'FEN must be a string' };
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return { valid: false, error: 'FEN must contain at least 4 fields (board turn castling enPassant)' };
  const rows = parts[0].split('/');
  if (rows.length !== 8) return { valid: false, error: 'FEN board must have exactly 8 rows' };

  let whiteKings = 0;
  let blackKings = 0;

  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r];
    let colCount = 0;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (/[1-8]/.test(char)) {
        colCount += parseInt(char, 10);
      } else if (/[pnbrqkPNBRQK]/.test(char)) {
        if (char === 'K') whiteKings++;
        if (char === 'k') blackKings++;
        colCount++;
      } else {
        return { valid: false, error: `Invalid character '${char}' in row ${r + 1}` };
      }
    }
    if (colCount !== 8) {
      return { valid: false, error: `Row ${r + 1} has ${colCount} squares instead of 8` };
    }
  }

  if (whiteKings !== 1 || blackKings !== 1) {
    return { valid: false, error: `Each side must have exactly 1 king (found White:${whiteKings}, Black:${blackKings})` };
  }

  const turn = parts[1];
  if (turn !== 'w' && turn !== 'b') {
    return { valid: false, error: "Active turn must be 'w' or 'b'" };
  }

  const castling = parts[2];
  if (!/^[-KQkq]+$/.test(castling)) {
    return { valid: false, error: 'Invalid castling rights field' };
  }

  const enPassant = parts[3];
  if (enPassant !== '-' && !/^[a-h][36]$/.test(enPassant)) {
    return { valid: false, error: 'Invalid en-passant square' };
  }

  return { valid: true, error: null };
}

/**
 * Export game moves and metadata to official PGN (Portable Game Notation) format
 */
export function exportToPGN(moveHistory = [], meta = {}) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  // Tag values are quoted strings: a peer's name can't break out of its tag.
  const tag = (v) => String(v).replace(/[\\"]/g, '\\$&').replace(/[\r\n]/g, ' ');
  const headers = [
    `[Event "${tag(meta.event || 'NovAura Sovereign HoloChess Match')}"]`,
    `[Site "${tag(meta.site || 'Decentralized Sovereign Mesh')}"]`,
    `[Date "${tag(meta.date || dateStr)}"]`,
    `[Round "${tag(meta.round || '1')}"]`,
    `[White "${tag(meta.white || 'Nova Core')}"]`,
    `[Black "${tag(meta.black || 'Aura Core')}"]`,
    `[Result "${tag(meta.result || '*')}"]`,
  ];
  if (meta.initialFen && meta.initialFen !== INITIAL_FEN) {
    headers.push(`[SetUp "1"]`);
    headers.push(`[FEN "${tag(meta.initialFen)}"]`);
  }

  const movePairs = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const w = moveHistory[i]?.san || `${moveHistory[i]?.from}-${moveHistory[i]?.to}`;
    const b = moveHistory[i + 1] ? (moveHistory[i + 1].san || `${moveHistory[i + 1].from}-${moveHistory[i + 1].to}`) : '';
    movePairs.push(`${moveNum}. ${w}${b ? ' ' + b : ''}`);
  }

  const movesText = movePairs.join(' ') + (meta.result && meta.result !== '*' ? ` ${meta.result}` : '');
  return `${headers.join('\n')}\n\n${movesText}\n`;
}

