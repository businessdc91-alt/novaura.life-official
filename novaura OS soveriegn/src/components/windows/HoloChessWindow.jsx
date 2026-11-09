import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bot, Users, RotateCcw, Volume2, VolumeX, Sparkles, Flag,
  ShieldAlert, Crown, RefreshCw, Trophy, Radio, HelpCircle,
  Copy, Check, Download, FileText
} from 'lucide-react';
import HoloChessCanvas from './chess/HoloChessCanvas.jsx';
import {
  INITIAL_FEN,
  parseFEN,
  getLegalMoves,
  makeMove,
  isKingInCheck,
  findKing,
  drawReason,
  calculateBestMove,
  getPieceEvaluationScore,
  generateAiCommentary,
  playChessSound,
  newChessGameId,
  validateFEN,
  exportToPGN,
} from '../../services/holoChessService.js';
import { getConnectedPeers } from '../../services/sovereignMesh.js';
import { sendChessPacket, getPendingChessInvites, dropChessInvite } from '../../services/holoChessMesh.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const winnerTitle = (color) => (color === 'w' ? 'NOVA CORE VICTORIOUS!' : 'AURA CORE VICTORIOUS!');

export default function HoloChessWindow() {
  // Game State
  const [fen, setFen] = useState(INITIAL_FEN);
  const [moveHistory, setMoveHistory] = useState([]); // [{ from, to, piece, captured, san, fen, color }]
  const [gameMode, setGameMode] = useState('ai'); // 'ai' | 'mesh' | 'hotseat'
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMovesForSelected, setLegalMovesForSelected] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [viewMode, setViewMode] = useState('nova'); // 'nova' | 'aura' | 'top'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [result, setResult] = useState(null); // { title, detail } when a mesh match ends by resignation

  // AI Configuration
  const [aiPersonality, setAiPersonality] = useState('nova'); // 'nova' | 'aura'
  const [aiDifficulty, setAiDifficulty] = useState(3); // 2 = Novice, 3 = Adept, 4 = Master
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiCommentary, setAiCommentary] = useState(
    'Tactical Matrix initialized. Nova Core awaiting your opening maneuver.'
  );

  // Mesh P2P Multiplayer State
  const [peers, setPeers] = useState([]);
  const [invites, setInvites] = useState(getPendingChessInvites);
  const [waiting, setWaiting] = useState(null); // outgoing challenge { gameId, peerId, peerName }
  const [match, setMatch] = useState(null); // { gameId, peerId, did, myColor: 'w' | 'b', opponent }

  // FEN & PGN Tools State. startFenRef is where the game began: the standard
  // position, or a FEN the player loaded (undo goes back to it, PGN records it).
  const startFenRef = useRef(INITIAL_FEN);
  const [copiedFen, setCopiedFen] = useState(false);
  const [showFenPrompt, setShowFenPrompt] = useState(false);
  const [customFenInput, setCustomFenInput] = useState('');
  const [fenError, setFenError] = useState('');

  // Derived Board Info
  const parsed = useMemo(() => parseFEN(fen), [fen]);
  const activeColor = parsed.activeColor; // 'w' | 'b'
  const inCheck = useMemo(() => isKingInCheck(parsed, activeColor), [parsed, activeColor]);
  const allCurrentLegalMoves = useMemo(() => getLegalMoves(fen), [fen]);
  const noMoves = allCurrentLegalMoves.length === 0;
  const draw = useMemo(() => (noMoves ? null : drawReason(parsed)), [noMoves, parsed]);

  const ending = result
    || (noMoves && inCheck && { title: winnerTitle(activeColor === 'w' ? 'b' : 'w'), detail: `Decisive Checkmate delivered on Move ${Math.ceil(moveHistory.length / 2)}.` })
    || (noMoves && { title: 'STALEMATE DRAW', detail: 'No legal moves remaining. Matrix ended in mutual equilibrium.' })
    || (draw && { title: 'DRAW', detail: `Drawn by ${draw}.` })
    || null;
  const isGameOver = Boolean(ending);
  const liveMatch = gameMode === 'mesh' && Boolean(match) && !isGameOver;
  const myTurn = gameMode === 'hotseat'
    || (gameMode === 'ai' && activeColor === 'w')
    || (gameMode === 'mesh' && Boolean(match) && activeColor === match.myColor);

  // Mesh packets arrive in an event listener, so it reads the latest game through refs.
  const fenRef = useRef(fen);
  fenRef.current = fen;
  const plyRef = useRef(0);
  plyRef.current = moveHistory.length;
  const matchRef = useRef(match);
  matchRef.current = match;
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;
  const overRef = useRef(isGameOver);
  overRef.current = isGameOver;

  // Find King in check position for 3D red highlight
  const checkKingSquare = useMemo(() => {
    if (!inCheck) return null;
    const kingPos = findKing(parsed.board, activeColor);
    return kingPos ? `${FILES[kingPos.col]}${8 - kingPos.row}` : null;
  }, [inCheck, parsed, activeColor]);

  // Calculate Captured Pieces & Material Balance
  const capturedPieces = useMemo(() => {
    const startCounts = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts = { P: 0, N: 0, B: 0, R: 0, Q: 0, p: 0, n: 0, b: 0, r: 0, q: 0 };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = parsed.board[r][c];
        if (p) {
          const char = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
          if (currentCounts[char] !== undefined) {
            currentCounts[char]++;
          }
        }
      }
    }

    const whiteCaptured = []; // captured black pieces (by White)
    const blackCaptured = []; // captured white pieces (by Black)

    // A promoted pawn can leave more of a piece than the game started with.
    ['p', 'n', 'b', 'r', 'q'].forEach((code) => {
      const diff = startCounts[code] - currentCounts[code];
      for (let i = 0; i < diff; i++) whiteCaptured.push(code);
    });

    ['P', 'N', 'B', 'R', 'Q'].forEach((code) => {
      const diff = startCounts[code] - currentCounts[code];
      for (let i = 0; i < diff; i++) blackCaptured.push(code.toLowerCase());
    });

    const evalScore = getPieceEvaluationScore(parsed.board);
    return { whiteCaptured, blackCaptured, evalScore };
  }, [parsed.board]);

  // Handle Play Sound Wrapper
  const triggerSound = useCallback((type) => {
    if (soundEnabled) {
      playChessSound(type);
    }
  }, [soundEnabled]);

  const resetBoard = useCallback(() => {
    startFenRef.current = INITIAL_FEN;
    fenRef.current = INITIAL_FEN;
    plyRef.current = 0;
    setFen(INITIAL_FEN);
    setMoveHistory([]);
    setSelectedSquare(null);
    setLegalMovesForSelected([]);
    setLastMove(null);
    setResult(null);
  }, []);

  // Execute Move (a local click, the AI, or a mesh opponent's move with remote: true)
  const executeMove = useCallback((move, { remote = false } = {}) => {
    const outcome = makeMove(fenRef.current, move);
    const ply = plyRef.current;
    fenRef.current = outcome.fen;
    plyRef.current = ply + 1;

    setFen(outcome.fen);
    setLastMove({ from: move.from, to: move.to });
    setSelectedSquare(null);
    setLegalMovesForSelected([]);

    const historyEntry = {
      ...move,
      fen: outcome.fen,
      san: outcome.san,
      color: outcome.state.turn === 'w' ? 'b' : 'w',
    };
    setMoveHistory((prev) => [...prev, historyEntry]);

    triggerSound(outcome.captured ? 'capture' : 'move');

    // Send our own moves to the mesh opponent
    const m = matchRef.current;
    if (!remote && m) {
      sendChessPacket(m.peerId, { kind: 'move', gameId: m.gameId, ply, from: move.from, to: move.to, promotion: move.promotion || null })
        .then((ok) => { if (!ok) setAiCommentary(`That move did not reach ${m.opponent}. Check the mesh connection.`); });
    }

    setAiCommentary(generateAiCommentary(historyEntry, outcome.fen, aiPersonality));

    if (outcome.inCheck) {
      setTimeout(() => triggerSound('check'), 200);
    }
  }, [aiPersonality, triggerSound]);

  const startMeshMatch = useCallback((m) => {
    resetBoard();
    setMatch(m);
    setGameMode('mesh');
    setViewMode(m.myColor === 'w' ? 'nova' : 'aura');
    setAiCommentary(m.myColor === 'w'
      ? `${m.opponent} accepted. You command Nova Core (White) and move first.`
      : `Challenge accepted! Defending with Aura Core (Black). ${m.opponent} moves first.`);
    triggerSound('victory');
  }, [resetBoard, triggerSound]);

  // Mesh peers and match packets (see holoChessMesh.js)
  useEffect(() => {
    const refreshPeers = () => setPeers(getConnectedPeers());
    refreshPeers();

    const onPacket = (e) => {
      const d = e.detail;
      setInvites(getPendingChessInvites());
      if (d.kind === 'invite') {
        triggerSound('check');
        return;
      }

      const w = waitingRef.current;
      if (w && w.gameId === d.gameId && w.peerId === d.from) {
        if (d.kind === 'accept') {
          setWaiting(null);
          startMeshMatch({ gameId: d.gameId, peerId: d.from, did: d.did, myColor: 'w', opponent: d.name });
        } else if (d.kind === 'decline') {
          setWaiting(null);
          setAiCommentary(`${d.name} declined the match challenge.`);
        }
        return;
      }

      // Everything else belongs to the running match, from the opponent it was accepted with.
      const m = matchRef.current;
      if (!m || d.gameId !== m.gameId || d.did !== m.did || overRef.current) return;
      if (d.kind === 'move') {
        if (parseFEN(fenRef.current).turn === m.myColor || d.ply !== plyRef.current) return;
        const move = getLegalMoves(fenRef.current)
          .find((x) => x.from === d.from && x.to === d.to && (x.promotion || null) === d.promotion);
        if (move) executeMove(move, { remote: true });
      } else if (d.kind === 'resign') {
        setResult({ title: winnerTitle(m.myColor), detail: `${m.opponent} has resigned the match.` });
        triggerSound('victory');
      }
    };

    window.addEventListener('novaura:mesh_updated', refreshPeers);
    window.addEventListener('novaura:holochess_received', onPacket);
    return () => {
      window.removeEventListener('novaura:mesh_updated', refreshPeers);
      window.removeEventListener('novaura:holochess_received', onPacket);
    };
  }, [executeMove, startMeshMatch, triggerSound]);

  // Closing the window during a mesh match resigns it, so the opponent is not left waiting.
  useEffect(() => () => {
    const m = matchRef.current;
    if (m && !overRef.current) sendChessPacket(m.peerId, { kind: 'resign', gameId: m.gameId });
  }, []);

  // Trigger AI Turn
  useEffect(() => {
    if (gameMode !== 'ai' || isGameOver || activeColor !== 'b') return;

    setIsAiThinking(true);
    const timer = setTimeout(() => {
      try {
        const best = calculateBestMove(fen, aiDifficulty, aiPersonality);
        if (best) executeMove(best);
      } finally {
        setIsAiThinking(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      setIsAiThinking(false);
    };
  }, [gameMode, activeColor, fen, isGameOver, aiDifficulty, aiPersonality, executeMove]);

  // Square Click Raycasting Handler
  const handleSquareClick = (square) => {
    if (isGameOver || isAiThinking || !myTurn) return;

    // 1. If currently have a selected piece and clicked a legal destination
    //    (a pawn reaching the last rank becomes a queen)
    if (selectedSquare) {
      const move = legalMovesForSelected.find((m) => m.to === square);
      if (move) {
        executeMove(move);
        return;
      }
    }

    // 2. Otherwise, check if clicking one of active player's pieces
    const piece = parsed.board[8 - parseInt(square[1], 10)][FILES.indexOf(square[0])];
    if (piece && piece.color === activeColor) {
      setSelectedSquare(square);
      setLegalMovesForSelected(allCurrentLegalMoves.filter((m) => m.from === square));
      triggerSound('select');
      return;
    }

    // Deselect if clicked empty or invalid square
    setSelectedSquare(null);
    setLegalMovesForSelected([]);
  };

  // Tactical Hint Calculation
  const handleRequestHint = () => {
    if (isGameOver || isAiThinking || !myTurn) return;
    const hintMove = calculateBestMove(fen, 3, aiPersonality);
    if (hintMove) {
      setSelectedSquare(hintMove.from);
      const legal = allCurrentLegalMoves.filter((m) => m.from === hintMove.from);
      setLegalMovesForSelected(legal);
      setAiCommentary(
        `Tactical Recommendation: Move ${hintMove.piece.toUpperCase()} from ${hintMove.from.toUpperCase()} to ${hintMove.to.toUpperCase()} for optimal positional initiative.`
      );
      triggerSound('select');
    }
  };

  // Undo back to your last turn (Solo AI mode). After you mate the AI, only your move is taken back.
  const handleUndoMove = () => {
    const drop = moveHistory.length % 2 === 1 ? 1 : 2;
    if (gameMode !== 'ai' || moveHistory.length < drop || isAiThinking) return;
    const prevMoves = moveHistory.slice(0, -drop);
    const last = prevMoves[prevMoves.length - 1];
    setFen(last ? last.fen : startFenRef.current);
    setMoveHistory(prevMoves);
    setSelectedSquare(null);
    setLegalMovesForSelected([]);
    setLastMove(last ? { from: last.from, to: last.to } : null);
    setAiCommentary('Turn rewound. Temporal matrix restored.');
    triggerSound('select');
  };

  // Reset / New Match (a running mesh match has to be resigned first)
  const handleNewMatch = () => {
    if (liveMatch) return;
    setMatch(null);
    resetBoard();
    setAiCommentary(gameMode === 'mesh'
      ? 'Mesh lobby open. Challenge a peer to begin a new match.'
      : 'Tactical Matrix reset. New holographic match initiated.');
    triggerSound('select');
  };

  const switchMode = (mode) => {
    if (liveMatch || mode === gameMode) return;
    if (match) {
      setMatch(null);
      resetBoard();
    }
    setGameMode(mode);
  };

  const handleResign = () => {
    const m = matchRef.current;
    if (!m || isGameOver) return;
    sendChessPacket(m.peerId, { kind: 'resign', gameId: m.gameId });
    setResult({ title: winnerTitle(m.myColor === 'w' ? 'b' : 'w'), detail: 'You resigned the match.' });
  };

  // Mesh Challenge Dispatch
  const handleSendChallenge = async (peer) => {
    const gameId = newChessGameId();
    const peerName = peer.name || peer.hostname || peer.id;
    setWaiting({ gameId, peerId: peer.id, peerName });
    const ok = await sendChessPacket(peer.id, { kind: 'invite', gameId });
    if (!ok) {
      setWaiting((cur) => (cur?.gameId === gameId ? null : cur));
      setAiCommentary(`The challenge to ${peerName} could not be sent. Check the mesh connection.`);
      return;
    }
    setAiCommentary(`Holographic challenge dispatched to ${peerName}. Awaiting their answer...`);
  };

  const handleAcceptChallenge = (inv) => {
    dropChessInvite(inv.gameId);
    setInvites(getPendingChessInvites());
    setWaiting(null);
    sendChessPacket(inv.from, { kind: 'accept', gameId: inv.gameId });
    startMeshMatch({ gameId: inv.gameId, peerId: inv.from, did: inv.did, myColor: 'b', opponent: inv.name });
  };

  const handleDeclineChallenge = (inv) => {
    dropChessInvite(inv.gameId);
    setInvites(getPendingChessInvites());
    sendChessPacket(inv.from, { kind: 'decline', gameId: inv.gameId });
  };

  const handleCopyFen = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(fen);
      }
      setCopiedFen(true);
      setTimeout(() => setCopiedFen(false), 2000);
    } catch {
      setCopiedFen(true);
      setTimeout(() => setCopiedFen(false), 2000);
    }
  }, [fen]);

  const handleExportPgn = useCallback(() => {
    const pgnData = exportToPGN(moveHistory, {
      white: match ? (match.myColor === 'w' ? 'Operator (Local)' : match.opponent) : 'Nova Core',
      black: match ? (match.myColor === 'b' ? 'Operator (Local)' : match.opponent) : (gameMode === 'ai' ? 'Neural AI' : 'Opponent'),
      result: isGameOver ? (inCheckmate ? (activeColor === 'w' ? '0-1' : '1-0') : '1/2-1/2') : '*',
      initialFen: startFenRef.current,
    });
    const blob = new Blob([pgnData], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holochess_${Date.now()}.pgn`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [moveHistory, match, isGameOver, inCheckmate, activeColor, gameMode]);

  const handleLoadCustomFen = useCallback(() => {
    if (!customFenInput.trim()) return;
    const res = validateFEN(customFenInput.trim());
    if (!res.valid) {
      setFenError(res.error || 'Invalid FEN format');
      return;
    }
    const cleanFen = customFenInput.trim();
    startFenRef.current = cleanFen;
    fenRef.current = cleanFen;
    plyRef.current = 0;
    setFen(cleanFen);
    setMoveHistory([]);
    setSelectedSquare(null);
    setLegalMovesForSelected([]);
    setLastMove(null);
    setFenError('');
    setShowFenPrompt(false);
    setCustomFenInput('');
  }, [customFenInput]);

  const incomingChallenge = liveMatch ? null : invites[0];

  return (
    <div className="flex h-full w-full bg-[#050814] text-slate-100 font-sans select-none overflow-hidden">
      {/* 3D Holographic Canvas (Main Center Stage) */}
      <div className="relative flex-1 h-full min-w-0">
        <HoloChessCanvas
          fen={fen}
          boardState={parsed.board}
          selectedSquare={selectedSquare}
          legalMoves={legalMovesForSelected}
          lastMove={lastMove}
          isCheck={inCheck}
          checkSquare={checkKingSquare}
          onSquareClick={handleSquareClick}
          viewMode={viewMode}
          isAiThinking={isAiThinking}
        />

        {/* Top Floating Cyber HUD Bar */}
        <div className="absolute top-3 inset-x-4 flex items-center justify-between pointer-events-none">
          {/* Turn Indicator */}
          <div className="pointer-events-auto flex items-center space-x-3 px-4 py-2 rounded-xl bg-slate-900/80 border border-cyan-500/30 backdrop-blur-md shadow-lg shadow-cyan-950/40">
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full animate-ping ${activeColor === 'w' ? 'bg-cyan-400' : 'bg-fuchsia-500'}`} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Current Turn</span>
                <span className={`text-sm font-bold tracking-wide ${activeColor === 'w' ? 'text-cyan-300' : 'text-fuchsia-400'}`}>
                  {activeColor === 'w' ? 'NOVA CORE (WHITE)' : 'AURA CORE (BLACK)'}
                </span>
              </div>
            </div>

            {inCheck && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-500/60 animate-bounce">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span className="text-xs font-mono font-bold text-red-300">CHECK</span>
              </div>
            )}
          </div>

          {/* Quick Camera Presets & Audio */}
          <div className="pointer-events-auto flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/50 backdrop-blur-md">
            <button
              onClick={() => setViewMode('nova')}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all ${viewMode === 'nova' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
              title="Nova Faction View (White)"
            >
              Nova
            </button>
            <button
              onClick={() => setViewMode('aura')}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all ${viewMode === 'aura' ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40' : 'text-slate-400 hover:text-white'}`}
              title="Aura Faction View (Black)"
            >
              Aura
            </button>
            <button
              onClick={() => setViewMode('top')}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all ${viewMode === 'top' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Tactical Top-Down View"
            >
              Tactical
            </button>
            <div className="h-4 w-[1px] bg-slate-700 mx-1" />
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 text-slate-400 hover:text-cyan-300 transition-colors"
              title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Game Over Banner Overlay */}
        {ending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md z-30">
            <div className="flex flex-col items-center p-8 rounded-2xl bg-slate-900/90 border border-cyan-500/50 shadow-2xl shadow-cyan-500/20 text-center max-w-md">
              <Trophy className="w-16 h-16 text-amber-400 mb-3 animate-pulse" />
              <h2 className="text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
                {ending.title}
              </h2>
              <p className="mt-2 text-sm text-slate-300 font-mono">{ending.detail}</p>
              <div className="mt-6 flex items-center gap-2">
                {gameMode === 'ai' && moveHistory.length > 0 && (
                  <button
                    onClick={handleUndoMove}
                    className="px-4 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
                  >
                    Take Back
                  </button>
                )}
                <button
                  onClick={handleNewMatch}
                  className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/30 transition-all"
                >
                  Launch Next Match
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Incoming Challenge Modal */}
        {incomingChallenge && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-4 p-4 rounded-xl bg-slate-900/95 border border-fuchsia-500 shadow-2xl backdrop-blur-md">
            <Radio className="w-6 h-6 text-fuchsia-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs uppercase font-mono text-fuchsia-300">P2P Challenge Arrived!</span>
              <span className="text-sm font-bold text-white">
                {incomingChallenge.name} challenged you to HoloChess!
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleAcceptChallenge(incomingChallenge)}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950"
              >
                Accept
              </button>
              <button
                onClick={() => handleDeclineChallenge(incomingChallenge)}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Decline
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cyber Control Sidebar */}
      <div className="w-[21rem] shrink-0 border-l border-cyan-950/60 bg-[#090d1c] flex flex-col h-full z-10 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Crown className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-base font-black tracking-wider text-cyan-200 uppercase">HoloChess 3D</h1>
              <p className="text-[10px] font-mono text-slate-400">Sovereign Holographic Matrix</p>
            </div>
          </div>
          <button
            onClick={handleNewMatch}
            disabled={liveMatch}
            className="p-1.5 text-slate-400 hover:text-cyan-300 transition-colors rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:hover:text-slate-400"
            title={liveMatch ? 'Resign to leave the mesh match' : 'Reset Match'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/40">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => switchMode('ai')}
              disabled={liveMatch}
              className={`flex items-center justify-center space-x-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 ${gameMode === 'ai' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Vs AI</span>
            </button>
            <button
              onClick={() => switchMode('mesh')}
              disabled={liveMatch}
              className={`flex items-center justify-center space-x-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${gameMode === 'mesh' ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40' : 'text-slate-400 hover:text-white'}`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Mesh P2P</span>
            </button>
            <button
              onClick={() => switchMode('hotseat')}
              disabled={liveMatch}
              className={`flex items-center justify-center space-x-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 ${gameMode === 'hotseat' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-white'}`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Hotseat</span>
            </button>
          </div>

          {/* AI Settings Subpanel */}
          {gameMode === 'ai' && (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">AI Personality:</span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setAiPersonality('nova')}
                    className={`px-2 py-0.5 rounded text-[11px] ${aiPersonality === 'nova' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}
                  >
                    Tactical Core
                  </button>
                  <button
                    onClick={() => setAiPersonality('aura')}
                    className={`px-2 py-0.5 rounded text-[11px] ${aiPersonality === 'aura' ? 'bg-fuchsia-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}
                  >
                    Neural Intuition
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Calculation Depth:</span>
                <div className="flex space-x-1">
                  {[2, 3, 4].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setAiDifficulty(lvl)}
                      className={`px-2.5 py-0.5 rounded text-[11px] ${aiDifficulty === lvl ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {lvl === 2 ? 'Novice' : lvl === 3 ? 'Adept' : 'Master'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mesh P2P Lobby Subpanel */}
          {gameMode === 'mesh' && (
            <div className="mt-3 space-y-2">
              {match ? (
                <div className="p-2 rounded-lg bg-slate-950 border border-fuchsia-900/60 text-xs font-mono">
                  <div className="text-slate-400">Mesh match vs</div>
                  <div className="text-fuchsia-300 font-bold truncate">{match.opponent}</div>
                  <div className="mt-1 text-slate-400">
                    You play {match.myColor === 'w' ? 'Nova Core (White)' : 'Aura Core (Black)'}
                    {liveMatch && (myTurn ? ' · your move' : ' · their move')}
                  </div>
                </div>
              ) : waiting ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
                  <span className="text-slate-300 truncate">Waiting for {waiting.peerName}...</span>
                  <button
                    onClick={() => setWaiting(null)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Discovered Peers:</span>
                    <span className="text-fuchsia-400">{peers.length} Nodes</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {peers.length === 0 ? (
                      <div className="text-[11px] font-mono text-slate-500 py-1 text-center">
                        Scanning local mesh subnet...
                      </div>
                    ) : (
                      peers.map((peer) => (
                        <div
                          key={peer.id}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                        >
                          <span className="truncate max-w-[160px] font-mono text-slate-300">
                            {peer.name || peer.hostname || String(peer.id).slice(0, 10)}
                          </span>
                          <button
                            onClick={() => handleSendChallenge(peer)}
                            className="px-2 py-0.5 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-[10px]"
                          >
                            Challenge
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Captured Pieces & Score Bar */}
        <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/20">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-cyan-400 font-semibold">Nova Captures:</span>
            <span className="text-slate-400 font-bold">
              {capturedPieces.evalScore > 0 ? `+${(capturedPieces.evalScore / 100).toFixed(1)}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 min-h-[20px] items-center text-sm">
            {capturedPieces.whiteCaptured.map((p, i) => (
              <span key={i} className="text-fuchsia-400 font-mono">
                {p.toUpperCase()}
              </span>
            ))}
          </div>

          <div className="h-[1px] bg-slate-800/60 my-2" />

          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-fuchsia-400 font-semibold">Aura Captures:</span>
            <span className="text-slate-400 font-bold">
              {capturedPieces.evalScore < 0 ? `+${Math.abs(capturedPieces.evalScore / 100).toFixed(1)}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 min-h-[20px] items-center text-sm">
            {capturedPieces.blackCaptured.map((p, i) => (
              <span key={i} className="text-cyan-400 font-mono">
                {p.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* AI Tactical Commentary Box */}
        <div className="p-3 border-b border-slate-800/80 bg-cyan-950/20">
          <div className="flex items-center space-x-1.5 text-xs font-mono text-cyan-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider">Tactical Commentary</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-mono italic">
            "{aiCommentary}"
          </p>
        </div>

        {/* Move History Log */}
        <div className="flex-1 min-h-0 flex flex-col p-3">
          <div className="text-xs font-mono text-slate-400 mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-300">Move Ledger</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleCopyFen}
                title="Copy current position FEN to clipboard"
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-[10px] text-slate-300 hover:text-cyan-300 transition-colors"
              >
                {copiedFen ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                <span>FEN</span>
              </button>
              <button
                onClick={handleExportPgn}
                title="Export match to official PGN file"
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-[10px] text-slate-300 hover:text-cyan-300 transition-colors"
              >
                <Download className="w-2.5 h-2.5" />
                <span>PGN</span>
              </button>
              <button
                onClick={() => { setShowFenPrompt(!showFenPrompt); setFenError(''); }}
                disabled={liveMatch}
                title="Load custom FEN position or endgame study"
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-[10px] text-slate-300 hover:text-cyan-300 disabled:opacity-40 transition-colors"
              >
                <FileText className="w-2.5 h-2.5" />
                <span>Load</span>
              </button>
            </div>
          </div>

          {/* Custom FEN Setup Drawer */}
          {showFenPrompt && (
            <div className="mb-2 p-2 rounded-lg bg-slate-950 border border-cyan-500/40 text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-cyan-400">
                <span>Setup Custom FEN:</span>
                <button onClick={() => setShowFenPrompt(false)} className="text-slate-500 hover:text-white">✕</button>
              </div>
              <input
                type="text"
                value={customFenInput}
                onChange={(e) => setCustomFenInput(e.target.value)}
                placeholder="Paste FEN (e.g. 8/8/8/4k3/8/8/4K3/8 w - - 0 1)"
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
              />
              {fenError && <div className="text-[10px] text-rose-400">{fenError}</div>}
              <div className="flex justify-end space-x-1 pt-1">
                <button
                  onClick={handleLoadCustomFen}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] transition-colors"
                >
                  Set Board
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs pr-1">
            {moveHistory.length === 0 ? (
              <div className="text-slate-600 text-center py-6 text-xs">No moves logged yet</div>
            ) : (
              Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, idx) => {
                const whiteMove = moveHistory[idx * 2];
                const blackMove = moveHistory[idx * 2 + 1];
                return (
                  <div key={idx} className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/60 border border-slate-800/40">
                    <span className="text-slate-500 w-8">{idx + 1}.</span>
                    <span className="text-cyan-300 flex-1 text-center font-bold">
                      {whiteMove ? whiteMove.san || `${whiteMove.from}-${whiteMove.to}` : ''}
                    </span>
                    <span className="text-fuchsia-300 flex-1 text-center font-bold">
                      {blackMove ? blackMove.san || `${blackMove.from}-${blackMove.to}` : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 flex items-center space-x-2">
          {gameMode === 'ai' && (
            <button
              onClick={handleUndoMove}
              disabled={moveHistory.length < 2 || isAiThinking || isGameOver}
              className="flex-1 flex items-center justify-center space-x-1 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
              title="Undo last move"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}

          {liveMatch && (
            <button
              onClick={handleResign}
              className="flex-1 flex items-center justify-center space-x-1 py-2 text-xs font-semibold rounded-lg bg-red-950/70 hover:bg-red-900/70 border border-red-500/40 text-red-300 transition-colors"
              title="Resign the mesh match"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Resign</span>
            </button>
          )}

          <button
            onClick={handleRequestHint}
            disabled={isGameOver || isAiThinking || !myTurn}
            className="flex-1 flex items-center justify-center space-x-1 py-2 text-xs font-semibold rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 disabled:opacity-40 transition-colors"
            title="Calculate best tactical maneuver"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Hint</span>
          </button>
        </div>
      </div>
    </div>
  );
}
