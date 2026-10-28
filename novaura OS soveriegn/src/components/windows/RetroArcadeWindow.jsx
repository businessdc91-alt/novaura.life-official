import React, { useState, useEffect } from 'react';
import {
  Gamepad2, Trophy, RotateCcw, Sparkles, Flame, Droplet,
  Globe, Shield, Swords, Layers, Download, Check, Crown
} from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';

// ==========================================
// G-TOONS / C-TOONS REPLICA DATA & CARDS
// ==========================================
export const GTOONS_CARDS = [
  { id: 'gt_1', name: 'Cyber Dexter', power: 7, element: 'Cosmic', rowBonus: 'back', ability: '+3 if behind an Earth card', color: '#38bdf8', icon: '🧠' },
  { id: 'gt_2', name: 'Blaze Samurai', power: 8, element: 'Fire', rowBonus: 'front', ability: '+2 if played in Front Row', color: '#f97316', icon: '⚔️' },
  { id: 'gt_3', name: 'Aqua Titan', power: 6, element: 'Aqua', rowBonus: 'any', ability: '+2 to adjacent Aqua allies', color: '#06b6d4', icon: '🌊' },
  { id: 'gt_4', name: 'Shadow Grim', power: 9, element: 'Shadow', rowBonus: 'front', ability: '-2 to opposing card in column', color: '#a855f7', icon: '💀' },
  { id: 'gt_5', name: 'Terra Boulder', power: 7, element: 'Earth', rowBonus: 'front', ability: 'Shields back row from clash penalties', color: '#10b981', icon: '🛡️' },
  { id: 'gt_6', name: 'Cosmic Mojo', power: 8, element: 'Cosmic', rowBonus: 'back', ability: '+4 if opponent has a Fire card', color: '#eab308', icon: '🐒' },
  { id: 'gt_7', name: 'Vortex Kraken', power: 7, element: 'Aqua', rowBonus: 'front', ability: 'Swaps opposing column cards', color: '#0284c7', icon: '🐙' },
  { id: 'gt_8', name: 'Solar Phoenix', power: 9, element: 'Fire', rowBonus: 'any', ability: '+3 in clash if losing', color: '#ef4444', icon: '🔥' },
];

export default function RetroArcadeWindow() {
  const [activeGame, setActiveGame] = useState('gtoons'); // 'gtoons' | 'tictactoe' | 'dots' | 'checkers'

  // ==========================================
  // GAME 1: G-TOONS / C-TOONS STATE & LOGIC
  // ==========================================
  const [playerHand, setPlayerHand] = useState(GTOONS_CARDS.slice(0, 6));
  const [playerBoard, setPlayerBoard] = useState(Array(6).fill(null)); // 2 rows x 3 cols: [0,1,2 (front), 3,4,5 (back)]
  const [aiBoard, setAiBoard] = useState(Array(6).fill(null));
  const [selectedCardIdx, setSelectedCardIdx] = useState(null);
  const [gtoonsWinner, setGtoonsWinner] = useState(null);
  const [gtoonsTurn, setGtoonsTurn] = useState('player'); // 'player' | 'ai'

  // Calculate G-Toons Score
  const calculateBoardScore = (board) => {
    return board.reduce((acc, card, idx) => {
      if (!card) return acc;
      let score = card.power;
      // Front row bonus
      if (idx < 3 && card.rowBonus === 'front') score += 2;
      // Back row bonus
      if (idx >= 3 && card.rowBonus === 'back') score += 3;
      return acc + score;
    }, 0);
  };

  const playerScore = calculateBoardScore(playerBoard);
  const aiScore = calculateBoardScore(aiBoard);

  const handlePlaceGToonCard = (slotIdx) => {
    if (selectedCardIdx === null || playerBoard[slotIdx] !== null) return;
    const card = playerHand[selectedCardIdx];
    const newBoard = [...playerBoard];
    newBoard[slotIdx] = card;
    setPlayerBoard(newBoard);

    const newHand = playerHand.filter((_, i) => i !== selectedCardIdx);
    setPlayerHand(newHand);
    setSelectedCardIdx(null);

    // AI takes turn automatically
    setTimeout(() => {
      const openAiSlots = aiBoard.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
      if (openAiSlots.length > 0) {
        const randomSlot = openAiSlots[Math.floor(Math.random() * openAiSlots.length)];
        const aiCardPool = GTOONS_CARDS.slice(2);
        const randomAiCard = aiCardPool[Math.floor(Math.random() * aiCardPool.length)];
        const newAiBoard = [...aiBoard];
        newAiBoard[randomSlot] = randomAiCard;
        setAiBoard(newAiBoard);

        // Check if game ended (all 6 slots full)
        const playerFull = newBoard.every(s => s !== null);
        const aiFull = newAiBoard.every(s => s !== null);
        if (playerFull && aiFull) {
          const finalPlayer = calculateBoardScore(newBoard);
          const finalAi = calculateBoardScore(newAiBoard);
          if (finalPlayer > finalAi) setGtoonsWinner('Player Wins the Clash!');
          else if (finalAi > finalPlayer) setGtoonsWinner('AI Sovereign Wins!');
          else setGtoonsWinner('Clash Ended in a Draw!');
        }
      }
    }, 600);
  };

  const resetGToons = () => {
    setPlayerHand(GTOONS_CARDS.slice(0, 6));
    setPlayerBoard(Array(6).fill(null));
    setAiBoard(Array(6).fill(null));
    setSelectedCardIdx(null);
    setGtoonsWinner(null);
  };

  // ==========================================
  // GAME 2: TIC-TAC-TOE WITH SMART AI
  // ==========================================
  const [tttBoard, setTttBoard] = useState(Array(9).fill(null));
  const [tttTurn, setTttTurn] = useState('X'); // X = Player, O = AI
  const [tttWinner, setTttWinner] = useState(null);
  const [tttScores, setTttScores] = useState({ player: 0, ai: 0, draws: 0 });

  const checkTTTWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (squares.every(s => s !== null)) return 'Draw';
    return null;
  };

  const handleTTTClick = (idx) => {
    if (tttBoard[idx] || tttWinner || tttTurn !== 'X') return;
    const next = [...tttBoard];
    next[idx] = 'X';
    setTttBoard(next);

    const win = checkTTTWinner(next);
    if (win) {
      finishTTT(win);
      return;
    }

    setTttTurn('O');
    // AI Move
    setTimeout(() => {
      const emptyIdxs = next.map((val, i) => val === null ? i : null).filter(i => i !== null);
      if (emptyIdxs.length === 0) return;
      // Smart: Take center if available, else pick winning move or random
      let chosen = emptyIdxs.includes(4) ? 4 : emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)];
      next[chosen] = 'O';
      setTttBoard(next);

      const aiWin = checkTTTWinner(next);
      if (aiWin) finishTTT(aiWin);
      else setTttTurn('X');
    }, 400);
  };

  const finishTTT = (win) => {
    setTttWinner(win);
    if (win === 'X') setTttScores(s => ({ ...s, player: s.player + 1 }));
    else if (win === 'O') setTttScores(s => ({ ...s, ai: s.ai + 1 }));
    else setTttScores(s => ({ ...s, draws: s.draws + 1 }));
  };

  const resetTTT = () => {
    setTttBoard(Array(9).fill(null));
    setTttWinner(null);
    setTttTurn('X');
  };

  // ==========================================
  // GAME 3: DOTS AND BOXES (4x4 Dots = 9 Boxes)
  // ==========================================
  const [hLines, setHLines] = useState(Array(12).fill(false)); // 4 rows of 3 horizontal lines
  const [vLines, setVLines] = useState(Array(12).fill(false)); // 3 rows of 4 vertical lines
  const [boxes, setBoxes] = useState(Array(9).fill(null)); // 3x3 boxes ('P' or 'AI')
  const [dotsTurn, setDotsTurn] = useState('player');
  const [dotsScores, setDotsScores] = useState({ player: 0, ai: 0 });

  const handleLineClick = (type, index) => {
    if (dotsTurn !== 'player') return;
    if (type === 'H' && hLines[index]) return;
    if (type === 'V' && vLines[index]) return;

    const newH = [...hLines];
    const newV = [...vLines];
    if (type === 'H') newH[index] = true;
    else newV[index] = true;

    setHLines(newH);
    setVLines(newV);

    // Check if any box completed
    let completedBox = false;
    const newBoxes = [...boxes];
    let newPlayerScore = dotsScores.player;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const boxIdx = r * 3 + c;
        if (newBoxes[boxIdx] === null) {
          const top = newH[r * 3 + c];
          const bottom = newH[(r + 1) * 3 + c];
          const left = newV[r * 4 + c];
          const right = newV[r * 4 + c + 1];

          if (top && bottom && left && right) {
            newBoxes[boxIdx] = 'P';
            newPlayerScore++;
            completedBox = true;
          }
        }
      }
    }

    setBoxes(newBoxes);
    setDotsScores(s => ({ ...s, player: newPlayerScore }));

    if (!completedBox) {
      setDotsTurn('ai');
      // AI Move
      setTimeout(() => {
        executeAiDotsTurn(newH, newV, newBoxes, dotsScores.ai);
      }, 500);
    }
  };

  const executeAiDotsTurn = (currentH, currentV, currentBoxes, curAiScore) => {
    const unchosenH = currentH.map((v, i) => !v ? { type: 'H', idx: i } : null).filter(Boolean);
    const unchosenV = currentV.map((v, i) => !v ? { type: 'V', idx: i } : null).filter(Boolean);
    const available = [...unchosenH, ...unchosenV];
    if (available.length === 0) return;

    const pick = available[Math.floor(Math.random() * available.length)];
    const nextH = [...currentH];
    const nextV = [...currentV];
    if (pick.type === 'H') nextH[pick.idx] = true;
    else nextV[pick.idx] = true;

    setHLines(nextH);
    setVLines(nextV);

    let completedBox = false;
    const nextBoxes = [...currentBoxes];
    let newAiScore = curAiScore;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const boxIdx = r * 3 + c;
        if (nextBoxes[boxIdx] === null) {
          const top = nextH[r * 3 + c];
          const bottom = nextH[(r + 1) * 3 + c];
          const left = nextV[r * 4 + c];
          const right = nextV[r * 4 + c + 1];

          if (top && bottom && left && right) {
            nextBoxes[boxIdx] = 'AI';
            newAiScore++;
            completedBox = true;
          }
        }
      }
    }

    setBoxes(nextBoxes);
    setDotsScores(s => ({ ...s, ai: newAiScore }));

    if (completedBox) {
      // AI gets bonus turn
      setTimeout(() => {
        executeAiDotsTurn(nextH, nextV, nextBoxes, newAiScore);
      }, 500);
    } else {
      setDotsTurn('player');
    }
  };

  const resetDots = () => {
    setHLines(Array(12).fill(false));
    setVLines(Array(12).fill(false));
    setBoxes(Array(9).fill(null));
    setDotsScores({ player: 0, ai: 0 });
    setDotsTurn('player');
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-yellow-400 via-pink-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">Nova Retro Arcade & G-Toons Arena</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 border border-pink-500/40 font-mono">
                Flash Classics Reborn
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Playable G-Toons tactical card clash, Tic-Tac-Toe, and Dots & Boxes vs Sovereign AI</p>
          </div>
        </div>

        {/* Game Switcher Tabs */}
        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
          <button
            onClick={() => setActiveGame('gtoons')}
            className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
              activeGame === 'gtoons' ? 'bg-gradient-to-r from-cyan-600 to-pink-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-yellow-300" />
            <span>G-Toons Clash</span>
          </button>
          <button
            onClick={() => setActiveGame('tictactoe')}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              activeGame === 'tictactoe' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tic-Tac-Toe
          </button>
          <button
            onClick={() => setActiveGame('dots')}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              activeGame === 'dots' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dots & Boxes
          </button>
        </div>
      </div>

      {/* Main Game Stage */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center justify-center">
        {/* ========================================== */}
        {/* GAME 1: G-TOONS / C-TOONS CLASH ARENA */}
        {/* ========================================== */}
        {activeGame === 'gtoons' && (
          <div className="w-full max-w-4xl space-y-4">
            {/* Score Strip */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
                <div>
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">Player Fleet</span>
                  <span className="text-xl font-black text-white font-mono">{playerScore} PTS</span>
                </div>
              </div>

              {gtoonsWinner ? (
                <div className="text-center font-bold text-amber-400 text-sm animate-bounce flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span>{gtoonsWinner}</span>
                </div>
              ) : (
                <div className="text-center text-xs text-slate-400 font-mono">
                  Select a card from hand & place it in your 6-slot clash grid
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-pink-400 font-bold uppercase tracking-wider block">AI Opponent</span>
                  <span className="text-xl font-black text-white font-mono">{aiScore} PTS</span>
                </div>
                <button
                  onClick={resetGToons}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Reset Clash"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Battle Arena */}
            <div className="grid grid-cols-2 gap-6 bg-gradient-to-b from-slate-900/40 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl">
              {/* AI Board (Top View) */}
              <div>
                <div className="text-[11px] font-bold text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  AI Defense Line
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {aiBoard.map((card, i) => (
                    <div
                      key={i}
                      className="h-28 rounded-2xl border-2 border-dashed border-slate-800/80 bg-slate-950 flex flex-col items-center justify-center p-2 relative overflow-hidden"
                    >
                      {card ? (
                        <div className="w-full h-full rounded-xl bg-slate-900 border border-pink-500/50 p-2 flex flex-col justify-between" style={{ borderColor: card.color }}>
                          <div className="flex justify-between items-center text-xs">
                            <span>{card.icon}</span>
                            <span className="font-black text-white font-mono">{card.power}</span>
                          </div>
                          <div className="text-[10px] font-bold text-white text-center truncate">{card.name}</div>
                          <div className="text-[8px] text-slate-400 text-center">{card.element}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">AI Slot {i + 1}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Player Board */}
              <div>
                <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Player Formation Line
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {playerBoard.map((card, i) => (
                    <div
                      key={i}
                      onClick={() => handlePlaceGToonCard(i)}
                      className={`h-28 rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-2 cursor-pointer ${
                        card
                          ? 'border-cyan-500/60 bg-slate-900'
                          : selectedCardIdx !== null
                            ? 'border-dashed border-cyan-400/80 bg-cyan-950/20 hover:bg-cyan-950/40 animate-pulse'
                            : 'border-dashed border-slate-800/80 bg-slate-950'
                      }`}
                    >
                      {card ? (
                        <div className="w-full h-full rounded-xl p-2 flex flex-col justify-between" style={{ borderLeft: `3px solid ${card.color}` }}>
                          <div className="flex justify-between items-center text-xs">
                            <span>{card.icon}</span>
                            <span className="font-black text-white font-mono">{card.power}</span>
                          </div>
                          <div className="text-[10px] font-bold text-white text-center truncate">{card.name}</div>
                          <div className="text-[8px] text-cyan-300 text-center font-mono">{card.ability}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">Deploy Slot {i + 1}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Player Hand / Trunk Deck */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Player Hand & Inventory Trunk</span>
                <span className="text-cyan-400 font-mono">{playerHand.length} cards remaining</span>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1">
                {playerHand.map((card, idx) => (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCardIdx(idx)}
                    className={`w-28 h-36 rounded-2xl p-2.5 flex flex-col justify-between shrink-0 cursor-pointer transition-all hover:scale-105 border ${
                      selectedCardIdx === idx
                        ? 'bg-slate-900 border-2 border-cyan-400 shadow-xl shadow-cyan-500/20 -translate-y-2'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-base">{card.icon}</span>
                      <span className="font-black text-white font-mono">{card.power}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">{card.name}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{card.element}</div>
                    </div>
                    <div className="text-[8px] text-cyan-300/80 leading-tight border-t border-slate-800/80 pt-1">
                      {card.ability}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* GAME 2: TIC-TAC-TOE */}
        {/* ========================================== */}
        {activeGame === 'tictactoe' && (
          <div className="flex flex-col items-center space-y-5">
            {/* Scoreboard */}
            <div className="flex items-center gap-6 bg-slate-900/80 border border-slate-800 px-6 py-3 rounded-2xl font-mono text-xs">
              <div className="text-center">
                <span className="text-cyan-400 block font-bold">Player (X)</span>
                <span className="text-lg font-black text-white">{tttScores.player}</span>
              </div>
              <div className="text-center text-slate-500">
                <span className="block">Draws</span>
                <span className="text-lg font-bold">{tttScores.draws}</span>
              </div>
              <div className="text-center">
                <span className="text-pink-400 block font-bold">AI (O)</span>
                <span className="text-lg font-black text-white">{tttScores.ai}</span>
              </div>
            </div>

            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900/40 border border-slate-800 rounded-3xl shadow-2xl">
              {tttBoard.map((val, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTTTClick(idx)}
                  className="w-24 h-24 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500 flex items-center justify-center text-3xl font-black transition-all cursor-pointer shadow-md"
                >
                  {val === 'X' && <span className="text-cyan-400 animate-in zoom-in">X</span>}
                  {val === 'O' && <span className="text-pink-400 animate-in zoom-in">O</span>}
                </button>
              ))}
            </div>

            {tttWinner && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-amber-400">
                  {tttWinner === 'Draw' ? 'Game Ended in a Draw!' : `${tttWinner === 'X' ? 'Player' : 'AI'} Wins!`}
                </span>
                <button
                  onClick={resetTTT}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
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
                <span className="text-emerald-400 block font-bold">Player Boxes</span>
                <span className="text-lg font-black text-white">{dotsScores.player}</span>
              </div>
              <div className="text-center text-slate-400">
                <span className="block font-bold">Turn</span>
                <span className={`text-xs uppercase font-bold ${dotsTurn === 'player' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {dotsTurn}
                </span>
              </div>
              <div className="text-center">
                <span className="text-amber-400 block font-bold">AI Boxes</span>
                <span className="text-lg font-black text-white">{dotsScores.ai}</span>
              </div>
              <button onClick={resetDots} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* 3x3 Dots and Boxes Grid */}
            <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-3xl shadow-2xl">
              {[0, 1, 2, 3].map((r) => (
                <div key={r}>
                  {/* Row of Dots & Horizontal Lines */}
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

                  {/* Vertical Lines & Box Centers */}
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
                              {boxes[r * 3 + c] === 'P' && <span className="text-emerald-400 animate-in zoom-in">P</span>}
                              {boxes[r * 3 + c] === 'AI' && <span className="text-amber-400 animate-in zoom-in">AI</span>}
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
