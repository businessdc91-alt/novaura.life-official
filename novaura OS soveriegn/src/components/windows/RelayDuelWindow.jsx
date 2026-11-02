// RelayDuelWindow.jsx — Relay Duel: node operators lob signal orbs across a
// night skyline. Pick Nova or Aura (Cybeni unlocks after 10 wins against the
// Easy computer), set angle and power, read the interference, and knock your
// opponent off their roof. Modes: vs computer, hotseat, and duels over the mesh.
// Game rules are in games/relayDuel/engine.js; mesh packets in relayDuelMesh.js.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Swords, Users, Radio, Lock, Crosshair, Wind, ArrowLeft, Trophy } from 'lucide-react';
import {
  WORLD, ROUNDS_TO_WIN, CHARACTERS, DIFFICULTIES, EASY_WINS_TO_UNLOCK_CYBENI, createRound, interference,
  simulateShot, applyShot, chooseComputerShot, isCybeniUnlocked, recordMatch, rng,
} from '../../games/relayDuel/engine.js';
import { send as meshSend, newGameId, newSeed, getPendingInvites, dropInvite } from '../../games/relayDuel/relayDuelMesh.js';
import { getConnectedPeers } from '../../services/sovereignMesh.js';
import { db } from '../../database/sovereignDatabase.js';

const PROGRESS_KEY = 'relay_duel_progress';
const SHOT_MS_PER_POINT = 7;

function useProgress() {
  const [progress, setProgress] = useState({ easyWins: 0, wins: 0, losses: 0 });
  useEffect(() => {
    db.getSetting(PROGRESS_KEY, null).then(p => { if (p) setProgress(p); }).catch(() => {});
  }, []);
  const save = useCallback((next) => {
    setProgress(next);
    db.setSetting(PROGRESS_KEY, next).catch(() => {});
  }, []);
  return [progress, save];
}

// ── Drawing ────────────────────────────────────────────────────────────────

function towerIndexByColumn(state) {
  const cols = WORLD.width / WORLD.cell;
  const map = new Int16Array(cols);
  state.towers.forEach((t, i) => {
    for (let c = t.x / WORLD.cell; c < (t.x + t.w) / WORLD.cell; c++) map[c] = i;
  });
  return map;
}

function drawScene(ctx, match, anim, guide) {
  const { width, height, cell } = WORLD;
  const { state } = match;
  const cols = width / cell;
  const rows = height / cell;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#020617');
  sky.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const stars = rng(match.seed ^ 0xabcdef);
  ctx.fillStyle = 'rgba(226,232,240,0.7)';
  for (let i = 0; i < 90; i++) ctx.fillRect(stars() * width, stars() * height * 0.55, 1.5, 1.5);

  const byCol = match.byCol;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (!state.grid[cy * cols + cx]) continue;
      const t = state.towers[byCol[cx]];
      ctx.fillStyle = `hsl(${t.hue} 35% 13%)`;
      ctx.fillRect(cx * cell, cy * cell, cell, cell);
      // Lit windows: a fixed pattern per tower, so it doesn't flicker between frames.
      if (cx % 2 === 1 && cy % 2 === 1 && ((t.windowSeed >> ((cx * 7 + cy * 3) % 29)) & 3) === 0) {
        ctx.fillStyle = `hsl(${t.hue} 90% 68% / 0.85)`;
        ctx.fillRect(cx * cell + 2, cy * cell + 2, cell - 4, cell - 4);
      }
    }
  }

  for (const ant of state.antennas) {
    if (!ant.alive) continue;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ant.x, ant.base);
    ctx.lineTo(ant.x, ant.base - ant.h);
    ctx.stroke();
    ctx.fillStyle = (Math.floor(performance.now() / 600) % 2) ? '#f43f5e' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(ant.x, ant.base - ant.h, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Each operator's previous shot, faintly.
  match.trails.forEach((trail, i) => {
    if (!trail) return;
    ctx.fillStyle = `${CHARACTERS[state.players[i].character].color}55`;
    trail.forEach((p, k) => { if (k % 3 === 0) ctx.fillRect(p.x - 1, p.y - 1, 2, 2); });
  });

  if (guide) {
    ctx.fillStyle = `${guide.color}cc`;
    guide.points.forEach((p, k) => { if (k % 2 === 0) ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); });
  }

  state.players.forEach((p, i) => {
    if (!p.alive && !(anim && anim.done)) return;
    const c = CHARACTERS[p.character];
    const active = match.turn === i && !match.winner;
    ctx.save();
    ctx.shadowColor = c.color;
    ctx.shadowBlur = active ? 18 : 8;
    ctx.fillStyle = c.color;
    ctx.fillRect(p.x - 6, p.y - 16, 12, 16);
    ctx.beginPath();
    ctx.arc(p.x, p.y - 21, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = c.accent;
    ctx.fillRect(p.x - 5, p.y - 23, 10, 3);
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#f8fafc' : '#94a3b8';
    ctx.fillText(c.name, p.x, p.y - 34);
  });

  if (anim) {
    const upto = Math.min(anim.points.length - 1, Math.floor((performance.now() - anim.start) / SHOT_MS_PER_POINT));
    const color = CHARACTERS[state.players[anim.shooter].character].color;
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = Math.max(0, upto - 40); k <= upto; k++) {
      const pt = anim.points[k];
      if (k === Math.max(0, upto - 40)) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    if (!anim.done) {
      const pt = anim.points[upto];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (anim.explosion) {
      const t = Math.min(1, (performance.now() - anim.doneAt) / 380);
      ctx.strokeStyle = `rgba(251,191,36,${1 - t})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(anim.explosion.x, anim.explosion.y, anim.explosion.r * (0.5 + t), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // HUD
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = CHARACTERS[state.players[0].character].color;
  ctx.fillText(`${CHARACTERS[state.players[0].character].name}  ${match.scores[0]}`, 14, 22);
  ctx.textAlign = 'right';
  ctx.fillStyle = CHARACTERS[state.players[1].character].color;
  ctx.fillText(`${match.scores[1]}  ${CHARACTERS[state.players[1].character].name}`, width - 14, 22);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`Round ${match.round} · ${state.gravity.label}`, width / 2, 22);
  const w = match.wind;
  ctx.fillStyle = Math.abs(w) > 80 ? '#fbbf24' : '#94a3b8';
  const arrow = w === 0 ? 'calm' : `${w > 0 ? '' : '◀ '}${Math.abs(w)}${w > 0 ? ' ▶' : ''}`;
  ctx.fillText(`Interference ${arrow}`, width / 2, 40);
}

// ── The window ─────────────────────────────────────────────────────────────

export default function RelayDuelWindow() {
  const [screen, setScreen] = useState('menu'); // menu | select | lobby | game
  const [mode, setMode] = useState('computer'); // computer | hotseat | mesh
  const [difficulty, setDifficulty] = useState('easy');
  const [picks, setPicks] = useState(['nova', 'aura']);
  const [progress, saveProgress] = useProgress();
  const [match, setMatch] = useState(null);
  const [aim, setAim] = useState({ angle: 45, power: 60 });
  const [notice, setNotice] = useState('');
  const [peers, setPeers] = useState([]);
  const [invites, setInvites] = useState(getPendingInvites());
  const [waiting, setWaiting] = useState(null); // outgoing invite
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const matchRef = useRef(null);
  matchRef.current = match;

  const cybeniOpen = isCybeniUnlocked(progress);

  // ── Match flow ───────────────────────────────────────────────────────────

  const startMatch = useCallback(({ seed, characters, matchMode, mesh = null, level = difficulty }) => {
    const state = createRound(seed, 1, characters);
    setMatch({
      seed, characters, mode: matchMode, difficulty: level, mesh,
      round: 1, scores: [0, 0], starter: 0, turn: 0, moveIndex: 0, turnNumber: 0,
      state, byCol: towerIndexByColumn(state), wind: interference(seed, 1, 0),
      trails: [null, null], busy: false, winner: null, line: CHARACTERS[characters[0]].lines.turn,
    });
    setAim({ angle: 45, power: 60 });
    setNotice('');
    setScreen('game');
  }, [difficulty]);

  const finishShot = useCallback((m, shooter, outcome) => {
    const { state: after, loser } = applyShot(m.state, outcome);
    const trails = m.trails.slice();
    trails[shooter] = outcome.points;
    const base = { ...m, trails, moveIndex: m.moveIndex + 1, busy: false };

    if (loser === null) {
      const turnNumber = m.turnNumber + 1;
      const next = 1 - shooter;
      return { ...base, state: after, turn: next, turnNumber, wind: interference(m.seed, m.round, turnNumber), line: CHARACTERS[after.players[next].character].lines.turn };
    }
    const winnerSide = 1 - loser;
    const scores = m.scores.slice();
    scores[winnerSide] += 1;
    const winnerChar = CHARACTERS[m.state.players[winnerSide].character];
    if (scores[winnerSide] >= ROUNDS_TO_WIN) {
      return { ...base, state: after, scores, winner: { side: winnerSide }, line: winnerChar.lines.win };
    }
    const round = m.round + 1;
    const starter = 1 - m.starter;
    const fresh = createRound(m.seed, round, m.characters);
    return {
      ...base, scores, round, starter, turn: starter, turnNumber: 0, state: fresh, byCol: towerIndexByColumn(fresh),
      wind: interference(m.seed, round, 0), trails: [null, null], line: `${winnerChar.lines.hit} Round to ${winnerChar.name}.`,
    };
  }, []);

  const fire = useCallback((shot, { remote = false } = {}) => {
    const m = matchRef.current;
    if (!m || m.busy || m.winner) return;
    const shooter = m.turn;
    if (m.mode === 'mesh' && !remote) {
      if (shooter !== m.mesh.localSide) return;
      meshSend(m.mesh.peerId, { kind: 'shot', gameId: m.mesh.gameId, turn: m.moveIndex, angle: shot.angle, power: shot.power });
    }
    const outcome = simulateShot(m.state, shooter, shot, m.wind);
    animRef.current = { points: outcome.points, shooter, start: performance.now(), done: false, explosion: outcome.explosion };
    setMatch({ ...m, busy: true });
    const duration = outcome.points.length * SHOT_MS_PER_POINT + 60;
    setTimeout(() => {
      if (animRef.current) { animRef.current.done = true; animRef.current.doneAt = performance.now(); }
      setTimeout(() => {
        animRef.current = null;
        setMatch(cur => (cur && cur.seed === m.seed && cur.moveIndex === m.moveIndex ? finishShot(cur, shooter, outcome) : cur));
      }, 420);
    }, duration);
  }, [finishShot]);

  // The computer takes its turn (it plays the right side).
  useEffect(() => {
    if (!match || match.mode !== 'computer' || match.turn !== 1 || match.busy || match.winner) return undefined;
    const timer = setTimeout(() => {
      const m = matchRef.current;
      if (!m || m.turn !== 1 || m.busy) return;
      fire(chooseComputerShot(m.state, 1, m.wind, m.difficulty));
    }, 900);
    return () => clearTimeout(timer);
  }, [match, fire]);

  // Record finished matches against the computer; announce Cybeni.
  const recordedRef = useRef(null);
  useEffect(() => {
    if (!match?.winner || match.mode !== 'computer' || recordedRef.current === match.seed) return;
    recordedRef.current = match.seed;
    const wasOpen = isCybeniUnlocked(progress);
    const next = recordMatch(progress, { won: match.winner.side === 0, difficulty: match.difficulty });
    saveProgress(next);
    if (!wasOpen && isCybeniUnlocked(next)) {
      setNotice(`Cybeni unlocked! "${CHARACTERS.cybeni.lines.win}"`);
    }
  }, [match, progress, saveProgress]);

  // ── Mesh duels ───────────────────────────────────────────────────────────

  useEffect(() => {
    const refreshPeers = () => setPeers(getConnectedPeers());
    refreshPeers();
    const onPacket = (e) => {
      const d = e.detail;
      setInvites(getPendingInvites());
      const m = matchRef.current;
      if (d.kind === 'accept' && waitingRef.current?.gameId === d.gameId && d.from === waitingRef.current.peerId) {
        const w = waitingRef.current;
        setWaiting(null);
        startMatch({ seed: w.seed, characters: [w.character, d.character], matchMode: 'mesh', mesh: { gameId: d.gameId, peerId: d.from, did: d.did, localSide: 0, opponent: d.name } });
        return;
      }
      if (d.kind === 'decline' && waitingRef.current?.gameId === d.gameId) {
        setWaiting(null);
        setNotice(`${d.name || 'They'} declined the duel.`);
        return;
      }
      if (!m || m.mode !== 'mesh' || d.gameId !== m.mesh.gameId || d.did !== m.mesh.did) return;
      if (d.kind === 'shot' && m.turn !== m.mesh.localSide && d.turn === m.moveIndex && !m.busy) {
        fire({ angle: d.angle, power: d.power }, { remote: true });
      } else if (d.kind === 'leave') {
        setNotice(`${m.mesh.opponent} left the duel.`);
        setMatch(cur => (cur ? { ...cur, winner: cur.winner || { side: m.mesh.localSide, forfeit: true } } : cur));
      }
    };
    window.addEventListener('novaura:mesh_updated', refreshPeers);
    window.addEventListener('novaura:relay_duel_received', onPacket);
    return () => {
      window.removeEventListener('novaura:mesh_updated', refreshPeers);
      window.removeEventListener('novaura:relay_duel_received', onPacket);
    };
  }, [fire, startMatch]);

  const waitingRef = useRef(null);
  waitingRef.current = waiting;

  const challenge = (peer) => {
    const invite = { gameId: newGameId(), seed: newSeed(), character: picks[0], peerId: peer.id };
    setWaiting({ ...invite, peerName: peer.name || peer.hostname || peer.id });
    meshSend(peer.id, { kind: 'invite', gameId: invite.gameId, seed: invite.seed, character: invite.character });
  };

  const acceptInvite = (inv) => {
    dropInvite(inv.gameId);
    setInvites(getPendingInvites());
    meshSend(inv.from, { kind: 'accept', gameId: inv.gameId, character: picks[0] });
    startMatch({ seed: inv.seed, characters: [inv.character, picks[0]], matchMode: 'mesh', mesh: { gameId: inv.gameId, peerId: inv.from, did: inv.did, localSide: 1, opponent: inv.name } });
  };

  const declineInvite = (inv) => {
    dropInvite(inv.gameId);
    setInvites(getPendingInvites());
    meshSend(inv.from, { kind: 'decline', gameId: inv.gameId });
  };

  const leaveMatch = () => {
    const m = matchRef.current;
    if (m?.mode === 'mesh' && !m.winner) meshSend(m.mesh.peerId, { kind: 'leave', gameId: m.mesh.gameId });
    setMatch(null);
    setScreen('menu');
  };

  // ── Rendering loop ───────────────────────────────────────────────────────

  const myTurn = match && !match.busy && !match.winner && (
    match.mode === 'hotseat' || (match.mode === 'computer' && match.turn === 0) || (match.mode === 'mesh' && match.turn === match.mesh.localSide));

  const guide = useMemo(() => {
    if (!match || !myTurn) return null;
    const me = match.state.players[match.turn];
    if (me.character !== 'nova') return null;
    const out = simulateShot(match.state, match.turn, aim, match.wind);
    return { points: out.points.slice(0, 22), color: CHARACTERS.nova.color };
  }, [match, myTurn, aim]);

  useEffect(() => {
    if (screen !== 'game' || !match) return undefined;
    let frame;
    const loop = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawScene(ctx, matchRef.current, animRef.current, guide);
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [screen, match, guide]);

  const onKey = (e) => {
    if (!myTurn) return;
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') setAim(a => ({ ...a, angle: Math.min(90, a.angle + step) }));
    else if (e.key === 'ArrowRight') setAim(a => ({ ...a, angle: Math.max(0, a.angle - step) }));
    else if (e.key === 'ArrowUp') setAim(a => ({ ...a, power: Math.min(100, a.power + step) }));
    else if (e.key === 'ArrowDown') setAim(a => ({ ...a, power: Math.max(0, a.power - step) }));
    else if (e.key === ' ' || e.key === 'Enter') fire(aim);
    else return;
    e.preventDefault();
  };

  // ── Screens ──────────────────────────────────────────────────────────────

  const charCard = (id, slot) => {
    const c = CHARACTERS[id];
    const locked = id === 'cybeni' && !cybeniOpen;
    const selected = picks[slot] === id;
    return (
      <button
        key={`${slot}-${id}`}
        type="button"
        disabled={locked}
        onClick={() => setPicks(p => { const n = p.slice(); n[slot] = id; return n; })}
        className={`flex-1 min-w-[150px] text-left rounded-xl p-3 border transition-all ${selected ? 'bg-slate-800/80' : 'bg-slate-900/60 hover:bg-slate-800/60'} ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ borderColor: selected ? c.color : 'rgba(255,255,255,0.08)', boxShadow: selected ? `0 0 18px ${c.color}44` : 'none' }}
      >
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: c.color }}>{c.name}</span>
          {locked && <Lock className="w-3.5 h-3.5 text-slate-400" />}
        </div>
        <div className="text-[11px] text-slate-300 mt-1 font-semibold">{c.perk}</div>
        <div className="text-[11px] text-slate-400">{c.perkText}</div>
        {locked && (
          <div className="mt-2">
            <div className="text-[10px] text-slate-400">{c.unlock}</div>
            <div className="h-1.5 rounded bg-slate-800 mt-1 overflow-hidden">
              <div className="h-full" style={{ width: `${Math.min(100, (progress.easyWins / EASY_WINS_TO_UNLOCK_CYBENI) * 100)}%`, background: c.color }} />
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{progress.easyWins}/{EASY_WINS_TO_UNLOCK_CYBENI} Easy wins</div>
          </div>
        )}
      </button>
    );
  };

  const roster = ['nova', 'aura', 'cybeni'];

  if (screen === 'menu') {
    return (
      <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-5 p-6">
        <div className="text-center">
          <div className="text-3xl font-black tracking-wide bg-gradient-to-r from-cyan-300 via-violet-300 to-emerald-300 bg-clip-text text-transparent">RELAY DUEL</div>
          <div className="text-xs text-slate-400 mt-1">Lob signal orbs across the skyline. Read the interference. Knock them off their roof.</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
          {[
            { id: 'computer', icon: Swords, title: 'Vs Computer', text: 'Easy, Normal or Sharp.' },
            { id: 'hotseat', icon: Users, title: 'Hotseat', text: 'Two players, one keyboard.' },
            { id: 'mesh', icon: Radio, title: 'Mesh Duel', text: 'Challenge a node on the mesh.' },
          ].map(({ id, icon: Icon, title, text }) => (
            <button key={id} type="button" onClick={() => { setMode(id); setScreen(id === 'mesh' ? 'lobby' : 'select'); }}
              className="rounded-xl border border-white/10 bg-slate-900/70 hover:bg-slate-800/70 p-4 text-left cursor-pointer">
              <Icon className="w-5 h-5 text-cyan-300" />
              <div className="font-bold mt-2">{title}</div>
              <div className="text-xs text-slate-400">{text}</div>
            </button>
          ))}
        </div>
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> {progress.wins} wins · {progress.losses} losses
          {!cybeniOpen && ` · Cybeni: ${progress.easyWins}/${EASY_WINS_TO_UNLOCK_CYBENI} Easy wins`}
        </div>
        {notice && <div className="text-xs text-amber-300 max-w-xl text-center">{notice}</div>}
      </div>
    );
  }

  if (screen === 'select' || screen === 'lobby') {
    return (
      <div className="w-full h-full bg-slate-950 text-slate-100 overflow-auto p-5 flex flex-col gap-4">
        <button type="button" onClick={() => { setScreen('menu'); setWaiting(null); }} className="self-start text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div>
          <div className="text-sm font-bold mb-2">{mode === 'hotseat' ? 'Player 1' : 'Your operator'}</div>
          <div className="flex flex-wrap gap-2">{roster.map(id => charCard(id, 0))}</div>
        </div>
        {mode === 'hotseat' && (
          <div>
            <div className="text-sm font-bold mb-2">Player 2</div>
            <div className="flex flex-wrap gap-2">{roster.map(id => charCard(id, 1))}</div>
          </div>
        )}
        {mode === 'computer' && (
          <div>
            <div className="text-sm font-bold mb-2">Difficulty</div>
            <div className="flex gap-2">
              {Object.entries(DIFFICULTIES).map(([id, d]) => (
                <button key={id} type="button" onClick={() => setDifficulty(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${difficulty === id ? 'border-cyan-400 text-cyan-200 bg-cyan-500/10' : 'border-white/10 text-slate-300'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode !== 'mesh' ? (
          <button type="button"
            onClick={() => {
              const opponent = mode === 'computer'
                ? (roster.filter(id => id !== picks[0] && (id !== 'cybeni' || cybeniOpen))[Math.floor(Math.random() * (cybeniOpen ? 2 : 1))] || 'aura')
                : picks[1];
              startMatch({ seed: newSeed(), characters: [picks[0], opponent], matchMode: mode });
            }}
            className="self-start px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 font-bold text-sm cursor-pointer">
            Start match
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {invites.length > 0 && (
              <div className="rounded-xl border border-violet-500/40 bg-violet-950/30 p-3">
                <div className="text-xs font-bold text-violet-200 mb-2">Challenges for you</div>
                {invites.map(inv => (
                  <div key={inv.gameId} className="flex items-center justify-between text-xs py-1">
                    <span>{inv.name} as <span style={{ color: CHARACTERS[inv.character].color }}>{CHARACTERS[inv.character].name}</span></span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => acceptInvite(inv)} className="px-2 py-0.5 rounded bg-violet-600 cursor-pointer">Accept</button>
                      <button type="button" onClick={() => declineInvite(inv)} className="px-2 py-0.5 rounded border border-white/15 cursor-pointer">Decline</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-sm font-bold">Nodes on the mesh</div>
            {waiting ? (
              <div className="text-xs text-slate-300">Waiting for {waiting.peerName} to accept…</div>
            ) : peers.length === 0 ? (
              <div className="text-xs text-slate-500">No nodes connected right now. Connect to peers in Sovereign Network, or play a hotseat match.</div>
            ) : peers.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2">
                <span className="truncate">{p.name || p.hostname || p.id}</span>
                <button type="button" onClick={() => challenge(p)} className="px-2.5 py-1 rounded bg-cyan-700 cursor-pointer">Challenge</button>
              </div>
            ))}
            {notice && <div className="text-xs text-amber-300">{notice}</div>}
          </div>
        )}
      </div>
    );
  }

  // Game screen
  const turnChar = match ? CHARACTERS[match.state.players[match.turn].character] : null;
  const winnerChar = match?.winner ? CHARACTERS[match.state.players[match.winner.side].character] : null;
  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col outline-none" tabIndex={0} onKeyDown={onKey}>
      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
        <canvas ref={canvasRef} width={WORLD.width} height={WORLD.height} className="max-w-full max-h-full rounded-lg border border-white/10" style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }} />
      </div>
      <div className="shrink-0 border-t border-white/10 bg-slate-900/70 px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs">
        <button type="button" onClick={leaveMatch} className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /> Leave</button>
        {match?.winner ? (
          <div className="flex items-center gap-3">
            <span className="font-bold" style={{ color: winnerChar.color }}>{winnerChar.name} wins{match.winner.forfeit ? ' (forfeit)' : ''}!</span>
            <span className="text-slate-300 italic max-w-md">"{match.line}"</span>
            {match.mode !== 'mesh' && (
              <button type="button" onClick={() => startMatch({ seed: newSeed(), characters: match.characters, matchMode: match.mode, level: match.difficulty })}
                className="px-3 py-1 rounded bg-cyan-700 font-bold cursor-pointer">Rematch</button>
            )}
          </div>
        ) : (
          <>
            <span className="font-semibold" style={{ color: turnChar?.color }}>
              {myTurn ? `${turnChar.name}'s turn` : match?.mode === 'mesh' ? `Waiting for ${match.mesh.opponent}…` : `${turnChar?.name} is aiming…`}
            </span>
            <label className="flex items-center gap-2"><Crosshair className="w-3.5 h-3.5 text-slate-400" />Angle
              <input type="range" min={0} max={90} step={0.5} value={aim.angle} disabled={!myTurn} onChange={e => setAim(a => ({ ...a, angle: Number(e.target.value) }))} />
              <span className="w-10 tabular-nums">{aim.angle.toFixed(1)}°</span>
            </label>
            <label className="flex items-center gap-2"><Wind className="w-3.5 h-3.5 text-slate-400" />Power
              <input type="range" min={0} max={100} step={0.5} value={aim.power} disabled={!myTurn} onChange={e => setAim(a => ({ ...a, power: Number(e.target.value) }))} />
              <span className="w-10 tabular-nums">{aim.power.toFixed(1)}</span>
            </label>
            <button type="button" disabled={!myTurn} onClick={() => fire(aim)} className="px-4 py-1.5 rounded bg-gradient-to-r from-cyan-600 to-violet-600 font-bold disabled:opacity-40 cursor-pointer">Fire</button>
            <span className="text-slate-500 hidden lg:inline">Arrows aim (Shift = ×5) · Space fires</span>
            <span className="text-slate-400 italic truncate max-w-xs">{match?.line}</span>
          </>
        )}
      </div>
      {notice && <div className="shrink-0 px-4 py-1.5 text-xs text-amber-300 bg-amber-950/30 border-t border-amber-500/20">{notice}</div>}
    </div>
  );
}
