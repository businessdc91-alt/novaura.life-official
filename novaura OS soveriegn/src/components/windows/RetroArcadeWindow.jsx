import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Gamepad2, Trophy, RotateCcw, Sparkles, Shield, Swords,
  Crown, Crosshair, Brain, RefreshCw
} from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';
import { openWindow } from '../../services/desktopActions.js';
import { ARCADE_GAMES } from '../../services/templates/arcadeManifest.js';
import { buildArcadeDocument } from '../../services/templates/arcadeTemplate.js';
import { loadSiteIntoFrame, clearSitePreview, newSiteSession } from '../../services/sitePreview.js';
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
  getCheckersWinner,
  chooseBestCheckersMove,
} from '../../games/retroArcade/arcadeClassics.js';

export { GTOONS_CARDS };

const NEXUS_STATE_KEY = 'nexus_arcade_state_v1';
const CLASSIC_STATS_KEY = 'retro_arcade_classic_stats_v1';
const NEXUS_COUNT = ARCADE_GAMES.length;
const QUICK_PICKS = [
  { id: 'vanguard', label: '🚀 Starfield' },
  { id: 'voidrocks', label: '☄️ Vector Void' },
  { id: 'maze', label: '💠 Circuit Runner' },
  { id: 'solitaire', label: '🃏 Solitaire' },
  { id: 'mahjong', label: '🀄 Mahjong' },
  { id: 'awakening', label: '🌅 Awakening' },
  { id: 'ecosystem', label: '🐋 Biosphere 3D' },
];

const DEFAULT_CLASSIC_STATS = {
  gtoons: { wins: 0, losses: 0, draws: 0 },
  tictactoe: { wins: 0, losses: 0, draws: 0 },
  dots: { wins: 0, losses: 0, draws: 0 },
  checkers: { wins: 0, losses: 0, draws: 0 },
};

function summarizeNexusState(raw) {
  const progress = raw?.progress && typeof raw.progress === 'object' ? raw.progress : {};
  let beaten = 0;
  let points = 0;
  for (const g of ARCADE_GAMES) {
    const p = Object.prototype.hasOwnProperty.call(progress, g.id) ? progress[g.id] : null;
    if (p?.beaten) beaten += 1;
    if (Number.isFinite(p?.best)) points += Math.max(0, Math.round(p.best));
  }
  return { beaten, points };
}

export default function RetroArcadeWindow() {
  const [activeGame, setActiveGame] = useState('nexus'); // 'nexus' | 'gtoons' | 'tictactoe' | 'dots' | 'checkers'

  // Safe timer cleanup across unmounts, resets, and game switches
  const timersRef = useRef(new Set());
  const schedule = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);
  const clearAllTimers = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current.clear();
  }, []);
  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  // Persisted Classic Arcade Stats & Nexus State
  const [classicStats, setClassicStats] = useState(DEFAULT_CLASSIC_STATS);
  const nexusSavedRef = useRef(null);
  const [nexusReady, setNexusReady] = useState(false);
  const [nexusSummary, setNexusSummary] = useState({ beaten: 0, points: 0 });
  const [nexusReloadNonce, setNexusReloadNonce] = useState(0);
  const pendingNexusGameRef = useRef('');
  const nexusIframeRef = useRef(null);
  const nexusSessionRef = useRef(newSiteSession());

  useEffect(() => {
    let alive = true;
    Promise.all([
      db.getSetting(NEXUS_STATE_KEY, null),
      db.getSetting(CLASSIC_STATS_KEY, null),
    ]).then(([savedNexus, savedClassic]) => {
      if (!alive) return;
      if (savedNexus && typeof savedNexus === 'object') {
        nexusSavedRef.current = savedNexus;
        setNexusSummary(summarizeNexusState(savedNexus));
      }
      if (savedClassic && typeof savedClassic === 'object') {
        setClassicStats((prev) => ({
          gtoons: { ...prev.gtoons, ...(savedClassic.gtoons || {}) },
          tictactoe: { ...prev.tictactoe, ...(savedClassic.tictactoe || {}) },
          dots: { ...prev.dots, ...(savedClassic.dots || {}) },
          checkers: { ...prev.checkers, ...(savedClassic.checkers || {}) },
        }));
      }
      setNexusReady(true);
    }).catch(() => {
      if (alive) setNexusReady(true);
    });
    return () => { alive = false; };
  }, []);

  const recordClassicOutcome = useCallback((gameKey, outcome) => {
    setClassicStats((prev) => {
      const cur = prev[gameKey] || { wins: 0, losses: 0, draws: 0 };
      const field = outcome === 'player' ? 'wins' : outcome === 'ai' ? 'losses' : 'draws';
      const next = {
        ...prev,
        [gameKey]: { ...cur, [field]: (cur[field] || 0) + 1 },
      };
      db.setSetting(CLASSIC_STATS_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  // Load 21-game Nexus Arcade iframe when Nexus tab is active
  useEffect(() => {
    if (activeGame !== 'nexus' || !nexusReady || !nexusIframeRef.current) return;
    const initialGame = pendingNexusGameRef.current;
    pendingNexusGameRef.current = '';
    const doc = buildArcadeDocument({
      embed: true,
      initialGame,
      savedState: nexusSavedRef.current,
    });
    loadSiteIntoFrame(nexusIframeRef.current, doc, {
      session: nexusSessionRef.current,
      strict: true,
      popups: false,
    }).catch(() => {});
  }, [activeGame, nexusReady, nexusReloadNonce]);

  useEffect(() => () => { clearSitePreview(nexusSessionRef.current); }, []);

  // Receive real-time score/trophy/callsign updates from embedded Nexus Arcade
  useEffect(() => {
    const onMessage = (e) => {
      if (!nexusIframeRef.current || e.source !== nexusIframeRef.current.contentWindow) return;
      const payload = e.data?.novauraArcadeSync ? e.data.state : e.data?.novauraArcadeState;
      if (!payload || typeof payload !== 'object') return;
      nexusSavedRef.current = payload;
      setNexusSummary(summarizeNexusState(payload));
      db.setSetting(NEXUS_STATE_KEY, payload).catch(() => {});
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const launchNexusGame = useCallback((gameId) => {
    if (activeGame === 'nexus' && nexusIframeRef.current?.contentWindow) {
      nexusIframeRef.current.contentWindow.postMessage({ novauraArcadeLaunch: gameId }, '*');
    } else {
      pendingNexusGameRef.current = gameId;
      setActiveGame('nexus');
    }
  }, [activeGame]);

  // ==========================================
  // GAME 1: G-TOONS CLASH (Full Ability Engine)
  // ==========================================
  const initialDeal = useMemo(() => dealGToonsHands(), []);
  const [playerHand, setPlayerHand] = useState(initialDeal.playerHand);
  const [aiHand, setAiHand] = useState(initialDeal.aiHand);
  const [playerBoard, setPlayerBoard] = useState(Array(6).fill(null));
  const [aiBoard, setAiBoard] = useState(Array(6).fill(null));
  const [selectedCardIdx, setSelectedCardIdx] = useState(null);
  const [gtoonsWinner, setGtoonsWinner] = useState(null);
  const [gtoonsTurn, setGtoonsTurn] = useState('player');

  const gtoonsEval = useMemo(
    () => evaluateGToonsMatch(playerBoard, aiBoard),
    [playerBoard, aiBoard]
  );

  const handlePlaceGToonCard = (slotIdx) => {
    if (gtoonsTurn !== 'player' || gtoonsWinner || selectedCardIdx === null || playerBoard[slotIdx] !== null) return;
    const card = playerHand[selectedCardIdx];
    if (!card) return;

    const nextPlayerBoard = [...playerBoard];
    nextPlayerBoard[slotIdx] = card;
    const nextPlayerHand = playerHand.filter((_, i) => i !== selectedCardIdx);
    const currentAiBoard = [...aiBoard];
    const currentAiHand = [...aiHand];

    setPlayerBoard(nextPlayerBoard);
    setPlayerHand(nextPlayerHand);
    setSelectedCardIdx(null);

    const immediateEval = evaluateGToonsMatch(nextPlayerBoard, currentAiBoard);
    if (immediateEval.winner) {
      setGtoonsWinner(immediateEval.winner);
      recordClassicOutcome('gtoons', immediateEval.winner);
      return;
    }

    setGtoonsTurn('ai');
    schedule(() => {
      const move = chooseBestGToonsMove(currentAiBoard, nextPlayerBoard, currentAiHand);
      if (move) {
        const nextAiBoard = [...currentAiBoard];
        nextAiBoard[move.slotIdx] = currentAiHand[move.cardIdx];
        const nextAiHand = currentAiHand.filter((_, i) => i !== move.cardIdx);
        setAiBoard(nextAiBoard);
        setAiHand(nextAiHand);
        const finalEval = evaluateGToonsMatch(nextPlayerBoard, nextAiBoard);
        if (finalEval.winner) {
          setGtoonsWinner(finalEval.winner);
          recordClassicOutcome('gtoons', finalEval.winner);
        }
      }
      setGtoonsTurn('player');
    }, 450);
  };

  const resetGToons = () => {
    clearAllTimers();
    const deal = dealGToonsHands();
    setPlayerHand(deal.playerHand);
    setAiHand(deal.aiHand);
    setPlayerBoard(Array(6).fill(null));
    setAiBoard(Array(6).fill(null));
    setSelectedCardIdx(null);
    setGtoonsWinner(null);
    setGtoonsTurn('player');
  };

  // ==========================================
  // GAME 2: TIC-TAC-TOE (Minimax AI)
  // ==========================================
  const [tttBoard, setTttBoard] = useState(Array(9).fill(null));
  const [tttTurn, setTttTurn] = useState('X');
  const [tttResult, setTttResult] = useState({ winner: null, line: null });
  const [tttDifficulty, setTttDifficulty] = useState('unbeatable');

  const finishTTT = (res) => {
    setTttResult(res);
    const outcome = res.winner === 'X' ? 'player' : res.winner === 'O' ? 'ai' : 'draw';
    recordClassicOutcome('tictactoe', outcome);
  };

  const handleTTTClick = (idx) => {
    if (tttBoard[idx] || tttResult.winner || tttTurn !== 'X') return;
    const next = [...tttBoard];
    next[idx] = 'X';
    setTttBoard(next);

    const win = checkTttWinner(next);
    if (win.winner) {
      finishTTT(win);
      return;
    }

    setTttTurn('O');
    schedule(() => {
      const chosen = chooseBestTttMove(next, 'O', tttDifficulty);
      if (chosen < 0) return;
      const afterAi = [...next];
      afterAi[chosen] = 'O';
      setTttBoard(afterAi);

      const aiWin = checkTttWinner(afterAi);
      if (aiWin.winner) finishTTT(aiWin);
      else setTttTurn('X');
    }, 320);
  };

  const resetTTT = () => {
    clearAllTimers();
    setTttBoard(Array(9).fill(null));
    setTttResult({ winner: null, line: null });
    setTttTurn('X');
  };

  // ==========================================
  // GAME 3: DOTS & BOXES (Tactical Chain AI)
  // ==========================================
  const [hLines, setHLines] = useState(Array(12).fill(false));
  const [vLines, setVLines] = useState(Array(12).fill(false));
  const [boxes, setBoxes] = useState(Array(9).fill(null));
  const [dotsTurn, setDotsTurn] = useState('player');
  const [dotsWinner, setDotsWinner] = useState(null);

  const dotsScores = useMemo(() => ({
    player: boxes.filter((b) => b === 'P').length,
    ai: boxes.filter((b) => b === 'AI').length,
  }), [boxes]);

  const executeAiDotsTurnRef = useRef(null);
  const executeAiDotsTurn = useCallback((curH, curV, curBoxes) => {
    const move = chooseBestDotsMove(curH, curV, curBoxes);
    if (!move) return;
    const res = applyDotsMove(curH, curV, curBoxes, move.type, move.idx, 'AI');
    setHLines(res.hLines);
    setVLines(res.vLines);
    setBoxes(res.boxes);

    if (res.done) {
      setDotsWinner(res.winner);
      setDotsTurn('done');
      recordClassicOutcome('dots', res.winner);
      return;
    }

    if (res.gained > 0) {
      schedule(() => {
        executeAiDotsTurnRef.current?.(res.hLines, res.vLines, res.boxes);
      }, 420);
    } else {
      setDotsTurn('player');
    }
  }, [recordClassicOutcome, schedule]);
  useEffect(() => { executeAiDotsTurnRef.current = executeAiDotsTurn; }, [executeAiDotsTurn]);

  const handleLineClick = (type, index) => {
    if (dotsTurn !== 'player' || dotsWinner) return;
    if (type === 'H' && hLines[index]) return;
    if (type === 'V' && vLines[index]) return;

    const res = applyDotsMove(hLines, vLines, boxes, type, index, 'P');
    setHLines(res.hLines);
    setVLines(res.vLines);
    setBoxes(res.boxes);

    if (res.done) {
      setDotsWinner(res.winner);
      setDotsTurn('done');
      recordClassicOutcome('dots', res.winner);
      return;
    }

    if (res.gained === 0) {
      setDotsTurn('ai');
      schedule(() => {
        executeAiDotsTurn(res.hLines, res.vLines, res.boxes);
      }, 420);
    }
  };

  const resetDots = () => {
    clearAllTimers();
    setHLines(Array(12).fill(false));
    setVLines(Array(12).fill(false));
    setBoxes(Array(9).fill(null));
    setDotsTurn('player');
    setDotsWinner(null);
  };

  // ==========================================
  // GAME 4: CHECKERS (8x8 Mandatory Jump Draughts)
  // ==========================================
  const [checkersBoard, setCheckersBoard] = useState(() => createInitialCheckersBoard());
  const [checkersTurn, setCheckersTurn] = useState('player');
  const [checkersSelected, setCheckersSelected] = useState(null);
  const [checkersForcedFrom, setCheckersForcedFrom] = useState(null);
  const [checkersWinner, setCheckersWinner] = useState(null);

  const playerCheckersMoves = useMemo(
    () => (checkersTurn === 'player' && !checkersWinner
      ? getCheckersLegalMoves(checkersBoard, 'player', checkersForcedFrom)
      : []),
    [checkersBoard, checkersTurn, checkersWinner, checkersForcedFrom]
  );

  const runAiCheckersChainRef = useRef(null);
  const runAiCheckersChain = useCallback((boardState, forcedFrom = null) => {
    const mv = chooseBestCheckersMove(boardState, forcedFrom);
    if (!mv) {
      setCheckersWinner('player');
      recordClassicOutcome('checkers', 'player');
      setCheckersTurn('done');
      return;
    }
    const step = applyCheckersMove(boardState, mv);
    setCheckersBoard(step.board);

    if (step.moreJumpsFrom !== null) {
      schedule(() => runAiCheckersChainRef.current?.(step.board, step.moreJumpsFrom), 420);
      return;
    }

    const winner = getCheckersWinner(step.board, 'player');
    if (winner) {
      setCheckersWinner(winner);
      recordClassicOutcome('checkers', winner);
      setCheckersTurn('done');
    } else {
      setCheckersTurn('player');
    }
  }, [recordClassicOutcome, schedule]);
  useEffect(() => { runAiCheckersChainRef.current = runAiCheckersChain; }, [runAiCheckersChain]);

  const handleCheckersSquare = (idx) => {
    if (checkersTurn !== 'player' || checkersWinner) return;

    const chosenMove = checkersSelected !== null
      ? playerCheckersMoves.find((m) => m.from === checkersSelected && m.to === idx)
      : null;

    if (chosenMove) {
      const step = applyCheckersMove(checkersBoard, chosenMove);
      setCheckersBoard(step.board);

      if (step.moreJumpsFrom !== null) {
        setCheckersForcedFrom(step.moreJumpsFrom);
        setCheckersSelected(step.moreJumpsFrom);
        return;
      }

      setCheckersForcedFrom(null);
      setCheckersSelected(null);

      const winner = getCheckersWinner(step.board, 'ai');
      if (winner) {
        setCheckersWinner(winner);
        recordClassicOutcome('checkers', winner);
        setCheckersTurn('done');
        return;
      }

      setCheckersTurn('ai');
      schedule(() => runAiCheckersChain(step.board, null), 420);
      return;
    }

    if (checkersForcedFrom !== null) return;
    if (playerCheckersMoves.some((m) => m.from === idx)) {
      setCheckersSelected((prev) => (prev === idx ? null : idx));
    }
  };

  const resetCheckers = () => {
    clearAllTimers();
    setCheckersBoard(createInitialCheckersBoard());
    setCheckersTurn('player');
    setCheckersSelected(null);
    setCheckersForcedFrom(null);
    setCheckersWinner(null);
  };

  const switchArcadeTab = (nextTab) => {
    clearAllTimers();
    setActiveGame(nextTab);
  };

  const totalClassicWins =
    classicStats.gtoons.wins +
    classicStats.tictactoe.wins +
    classicStats.dots.wins +
    classicStats.checkers.wins;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-400 via-pink-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">Nova Retro Arcade & Nexus Deck</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                🏆 {nexusSummary.beaten}/{NEXUS_COUNT} • {totalClassicWins} Classic Wins
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {NEXUS_COUNT}-game Nexus Arcade plus G-Toons Clash, Minimax Tic-Tac-Toe, Dots & Boxes, Checkers & Sovereign Worlds
            </p>
          </div>
        </div>

        {/* Game Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
          <button
            onClick={() => switchArcadeTab('nexus')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
              activeGame === 'nexus' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            <span>Nexus ({NEXUS_COUNT})</span>
          </button>
          <button
            onClick={() => switchArcadeTab('gtoons')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
              activeGame === 'gtoons' ? 'bg-gradient-to-r from-cyan-600 to-pink-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-yellow-300" />
            <span>G-Toons</span>
          </button>
          <button
            onClick={() => switchArcadeTab('tictactoe')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              activeGame === 'tictactoe' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tic-Tac-Toe
          </button>
          <button
            onClick={() => switchArcadeTab('dots')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              activeGame === 'dots' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dots & Boxes
          </button>
          <button
            onClick={() => switchArcadeTab('checkers')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              activeGame === 'checkers' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Checkers
          </button>
          <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />
          <button
            onClick={() => openWindow('holochess')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white transition-all border border-cyan-400/30"
            title="Launch Dedicated 3D Holographic Chess Arena"
          >
            <Crown className="w-3.5 h-3.5 text-yellow-300" />
            <span>HoloChess</span>
          </button>
          <button
            onClick={() => openWindow('relay_duel')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md font-bold bg-gradient-to-r from-teal-600 to-cyan-700 hover:brightness-110 text-white transition-all border border-teal-400/30"
            title="Launch Relay Duel Mesh Arena"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-200" />
            <span>Relay Duel</span>
          </button>
          <button
            onClick={() => openWindow('cognitive_awakenings')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md font-bold bg-gradient-to-r from-violet-500 to-cyan-600 hover:brightness-110 text-white transition-all border border-violet-300/30"
            title="Cognitive Awakenings: Echoes of a Soul, a card duel of 80 AI minds"
          >
            <Brain className="w-3.5 h-3.5 text-violet-100" />
            <span>Awakenings</span>
          </button>
          <button
            onClick={() => openWindow('gilded_cage')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md font-bold bg-gradient-to-r from-yellow-700 to-amber-800 hover:brightness-110 text-amber-100 transition-all border border-amber-400/30"
            title="Launch The Gilded Cage Steampunk Mystery RPG"
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>Gilded Cage</span>
          </button>
        </div>
      </div>

      {/* Main Game Stage */}
      {activeGame === 'nexus' ? (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
          <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 mr-1 shrink-0">Quick Jump:</span>
              {QUICK_PICKS.map((q) => (
                <button
                  key={q.id}
                  onClick={() => launchNexusGame(q.id)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500/50 text-[11px] text-slate-200 transition-colors shrink-0 cursor-pointer"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400 font-mono">
              <span>{nexusSummary.points.toLocaleString()} pts</span>
              <button
                onClick={() => setNexusReloadNonce((n) => n + 1)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Reload Nexus Arcade deck"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <iframe
            ref={nexusIframeRef}
            title="Novaura Nexus Arcade"
            className="w-full flex-1 border-0 bg-[#030613]"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center justify-center">
          {/* ========================================== */}
          {/* GAME 1: G-TOONS CLASH ARENA */}
          {/* ========================================== */}
          {activeGame === 'gtoons' && (
            <div className="w-full max-w-4xl space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${gtoonsTurn === 'player' ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
                  <div>
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">Player Fleet (W:{classicStats.gtoons.wins})</span>
                    <span className="text-xl font-black text-white font-mono">{gtoonsEval.playerTotal} PTS</span>
                  </div>
                </div>

                {gtoonsWinner ? (
                  <div className="text-center font-bold text-amber-400 text-sm flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <span>
                      {gtoonsWinner === 'player' ? 'Player Wins the Clash!' : gtoonsWinner === 'ai' ? 'AI Sovereign Wins!' : 'Clash Ended in a Draw!'}
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-400 font-mono">
                    {gtoonsTurn === 'ai'
                      ? 'AI Tactical Mind evaluating column synergies...'
                      : 'Select a card and click a Front (0-2) or Back (3-5) slot'}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-pink-400 font-bold uppercase tracking-wider block">AI Opponent (W:{classicStats.gtoons.losses})</span>
                    <span className="text-xl font-black text-white font-mono">{gtoonsEval.aiTotal} PTS</span>
                  </div>
                  <button
                    onClick={resetGToons}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title="Deal New Clash"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gradient-to-b from-slate-900/40 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                {/* AI Board */}
                <div>
                  <div className="text-[11px] font-bold text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    AI Defense Line (Front 1-3 • Back 4-6)
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {gtoonsEval.aiBoard.map((card, i) => {
                      const info = gtoonsEval.aiSlots[i];
                      const net = info ? Math.max(0, info.base + info.mod) : 0;
                      return (
                        <div
                          key={i}
                          title={info?.notes?.join(', ') || ''}
                          className="h-28 rounded-2xl border-2 border-dashed border-slate-800/80 bg-slate-950 flex flex-col items-center justify-center p-2 relative overflow-hidden"
                        >
                          {card ? (
                            <div className="w-full h-full rounded-xl bg-slate-900 border p-2 flex flex-col justify-between" style={{ borderColor: card.color }}>
                              <div className="flex justify-between items-center text-xs">
                                <span>{card.icon}</span>
                                <span className={`font-black font-mono ${info.mod > 0 ? 'text-emerald-400' : info.mod < 0 ? 'text-rose-400' : 'text-white'}`}>
                                  {net}{info.mod !== 0 ? ` (${info.mod > 0 ? `+${info.mod}` : info.mod})` : ''}
                                </span>
                              </div>
                              <div className="text-[10px] font-bold text-white text-center truncate">{card.name}</div>
                              <div className="text-[8px] text-slate-400 text-center truncate">{info?.notes[0] || card.element}</div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">{i < 3 ? 'Front' : 'Back'} {i + 1}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Player Board */}
                <div>
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Player Formation Line (Front 1-3 • Back 4-6)
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {gtoonsEval.playerBoard.map((card, i) => {
                      const info = gtoonsEval.playerSlots[i];
                      const net = info ? Math.max(0, info.base + info.mod) : 0;
                      return (
                        <div
                          key={i}
                          onClick={() => handlePlaceGToonCard(i)}
                          title={info?.notes?.join(', ') || ''}
                          className={`h-28 rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-2 cursor-pointer ${
                            card
                              ? 'border-cyan-500/60 bg-slate-900'
                              : selectedCardIdx !== null && gtoonsTurn === 'player'
                                ? 'border-dashed border-cyan-400/80 bg-cyan-950/20 hover:bg-cyan-950/40'
                                : 'border-dashed border-slate-800/80 bg-slate-950'
                          }`}
                        >
                          {card ? (
                            <div className="w-full h-full rounded-xl p-2 flex flex-col justify-between" style={{ borderLeft: `3px solid ${card.color}` }}>
                              <div className="flex justify-between items-center text-xs">
                                <span>{card.icon}</span>
                                <span className={`font-black font-mono ${info.mod > 0 ? 'text-emerald-400' : info.mod < 0 ? 'text-rose-400' : 'text-white'}`}>
                                  {net}{info.mod !== 0 ? ` (${info.mod > 0 ? `+${info.mod}` : info.mod})` : ''}
                                </span>
                              </div>
                              <div className="text-[10px] font-bold text-white text-center truncate">{card.name}</div>
                              <div className="text-[8px] text-cyan-300 text-center font-mono truncate">{info?.notes[0] || card.ability}</div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">{i < 3 ? 'Front' : 'Back'} {i + 1}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Your Hand ({playerHand.length} Cards Remaining)
                </div>
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {playerHand.map((card, i) => (
                    <div
                      key={card.id}
                      onClick={() => gtoonsTurn === 'player' && !gtoonsWinner && setSelectedCardIdx(i)}
                      className={`w-36 shrink-0 p-3 rounded-2xl border-2 cursor-pointer transition-all bg-slate-900 flex flex-col justify-between h-36 ${
                        selectedCardIdx === i ? 'border-cyan-400 -translate-y-1 shadow-xl shadow-cyan-500/20' : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{card.icon}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-950 font-black font-mono text-xs text-white border border-slate-700">
                          {card.power}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white truncate">{card.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono">{card.element} • {card.rowBonus}</div>
                      </div>
                      <div className="text-[9px] text-cyan-300 font-mono leading-tight border-t border-slate-800 pt-1">
                        {card.ability}
                      </div>
                    </div>
                  ))}
                  {playerHand.length === 0 && (
                    <button onClick={resetGToons} className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer">
                      Deal Next Match
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* GAME 2: TIC-TAC-TOE (MINIMAX) */}
          {/* ========================================== */}
          {activeGame === 'tictactoe' && (
            <div className="flex flex-col items-center space-y-5">
              <div className="flex flex-wrap items-center gap-5 bg-slate-900/80 border border-slate-800 px-6 py-3 rounded-2xl font-mono text-xs">
                <div className="text-center">
                  <span className="text-cyan-400 block font-bold">Player (X)</span>
                  <span className="text-lg font-black text-white">{classicStats.tictactoe.wins}</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-400 block font-bold">Draws</span>
                  <span className="text-lg font-black text-white">{classicStats.tictactoe.draws}</span>
                </div>
                <div className="text-center">
                  <span className="text-pink-400 block font-bold">Minimax AI (O)</span>
                  <span className="text-lg font-black text-white">{classicStats.tictactoe.losses}</span>
                </div>
                <select
                  value={tttDifficulty}
                  onChange={(e) => { setTttDifficulty(e.target.value); resetTTT(); }}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                >
                  <option value="casual">Casual AI</option>
                  <option value="tactical">Tactical AI</option>
                  <option value="unbeatable">Unbeatable Minimax</option>
                </select>
                <button onClick={resetTTT} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-900/40 p-4 rounded-3xl border border-slate-800 shadow-2xl">
                {tttBoard.map((val, idx) => {
                  const isWinCell = tttResult.line?.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleTTTClick(idx)}
                      className={`w-24 h-24 rounded-2xl border flex items-center justify-center text-3xl font-black transition-all cursor-pointer shadow-md ${
                        isWinCell ? 'bg-amber-500/20 border-amber-400' : 'bg-slate-950 border-slate-800 hover:border-indigo-500'
                      }`}
                    >
                      {val === 'X' && <span className="text-cyan-400">X</span>}
                      {val === 'O' && <span className="text-pink-400">O</span>}
                    </button>
                  );
                })}
              </div>

              {tttResult.winner && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-amber-400">
                    {tttResult.winner === 'Draw' ? 'Game Ended in a Draw!' : `${tttResult.winner === 'X' ? 'Player' : 'AI'} Wins!`}
                  </span>
                  <button
                    onClick={resetTTT}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* GAME 3: DOTS & BOXES */}
          {/* ========================================== */}
          {activeGame === 'dots' && (
            <div className="flex flex-col items-center space-y-5">
              <div className="flex items-center gap-6 bg-slate-900/80 border border-slate-800 px-6 py-3 rounded-2xl font-mono text-xs">
                <div className="text-center">
                  <span className="text-emerald-400 block font-bold">Player Boxes (W:{classicStats.dots.wins})</span>
                  <span className="text-lg font-black text-white">{dotsScores.player}</span>
                </div>
                <div className="text-center text-slate-400">
                  <span className="block font-bold">Status</span>
                  <span className={`text-xs uppercase font-bold ${dotsTurn === 'player' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {dotsWinner ? 'Final' : dotsTurn}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-amber-400 block font-bold">AI Boxes (W:{classicStats.dots.losses})</span>
                  <span className="text-lg font-black text-white">{dotsScores.ai}</span>
                </div>
                <button onClick={resetDots} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-3xl shadow-2xl">
                {[0, 1, 2, 3].map((r) => (
                  <div key={r}>
                    <div className="flex items-center">
                      {[0, 1, 2, 3].map((c) => (
                        <React.Fragment key={c}>
                          <div className="w-3 h-3 rounded-full bg-white shadow-md shadow-cyan-400/50" />
                          {c < 3 && (
                            <div
                              onClick={() => handleLineClick('H', r * 3 + c)}
                              className={`w-14 h-2.5 rounded transition-all cursor-pointer ${
                                hLines[r * 3 + c] ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' : 'bg-slate-800 hover:bg-slate-700'
                              }`}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {r < 3 && (
                      <div className="flex items-center">
                        {[0, 1, 2, 3].map((c) => (
                          <React.Fragment key={c}>
                            <div
                              onClick={() => handleLineClick('V', r * 4 + c)}
                              className={`w-2.5 h-14 rounded transition-all cursor-pointer ${
                                vLines[r * 4 + c] ? 'bg-emerald-500 shadow-md shadow-emerald-500/50' : 'bg-slate-800 hover:bg-slate-700'
                              }`}
                            />
                            {c < 3 && (
                              <div className="w-14 h-14 flex items-center justify-center font-bold font-mono text-sm">
                                {boxes[r * 3 + c] === 'P' && <span className="text-emerald-400">P</span>}
                                {boxes[r * 3 + c] === 'AI' && <span className="text-amber-400">AI</span>}
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {dotsWinner && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-amber-400">
                    {dotsWinner === 'player' ? 'Player Claims the Grid!' : dotsWinner === 'ai' ? 'Sovereign AI Wins!' : 'Grid Tied!'}
                  </span>
                  <button
                    onClick={resetDots}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* GAME 4: 8x8 CHECKERS (DRAUGHTS) */}
          {/* ========================================== */}
          {activeGame === 'checkers' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center gap-6 bg-slate-900/80 border border-slate-800 px-6 py-3 rounded-2xl font-mono text-xs">
                <div>
                  <span className="text-rose-400 block font-bold">You (Red • W:{classicStats.checkers.wins})</span>
                  <span className="text-slate-300">{checkersBoard.filter((c) => c?.side === 'player').length} pieces</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-400 block font-bold">Turn</span>
                  <span className="text-white uppercase font-bold">
                    {checkersWinner
                      ? checkersWinner === 'player' ? 'You Win!' : 'AI Wins!'
                      : checkersForcedFrom !== null
                        ? 'Multi-Jump!'
                        : checkersTurn}
                  </span>
                </div>
                <div>
                  <span className="text-cyan-400 block font-bold">AI (Cyan • W:{classicStats.checkers.losses})</span>
                  <span className="text-slate-300">{checkersBoard.filter((c) => c?.side === 'ai').length} pieces</span>
                </div>
                <button onClick={resetCheckers} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-8 border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                {checkersBoard.map((piece, idx) => {
                  const r = Math.floor(idx / 8);
                  const c = idx % 8;
                  const dark = (r + c) % 2 === 1;
                  const isSelected = checkersSelected === idx;
                  const isTarget = checkersSelected !== null && playerCheckersMoves.some((m) => m.from === checkersSelected && m.to === idx);
                  const isForcedCaptureOrigin = checkersForcedFrom === null && playerCheckersMoves.some((m) => m.from === idx && m.capture !== null);

                  return (
                    <button
                      key={idx}
                      onClick={() => handleCheckersSquare(idx)}
                      className={`w-12 h-12 flex items-center justify-center relative transition-colors ${
                        dark ? 'bg-slate-900' : 'bg-slate-800/40'
                      } ${isSelected ? 'ring-2 ring-inset ring-amber-400 bg-amber-950/30' : ''} ${
                        isTarget ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-950/40 cursor-pointer' : ''
                      }`}
                    >
                      {piece && (
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-black text-sm shadow-lg ${
                            piece.side === 'player'
                              ? 'bg-gradient-to-br from-rose-500 to-red-700 border-rose-300 text-white'
                              : 'bg-gradient-to-br from-cyan-400 to-blue-700 border-cyan-200 text-slate-950'
                          } ${isForcedCaptureOrigin ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
                        >
                          {piece.king ? '♛' : ''}
                        </div>
                      )}
                      {!piece && isTarget && <span className="w-3 h-3 rounded-full bg-emerald-400/80" />}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-400 font-mono">
                Captures are mandatory. Complete multi-jumps cleanly; reach the far rank to crown a King (♛).
              </p>

              {checkersWinner && (
                <button
                  onClick={resetCheckers}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  Play Checkers Again
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
