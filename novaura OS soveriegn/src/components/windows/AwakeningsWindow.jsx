// AwakeningsWindow.jsx — Cognitive Awakenings: Echoes of a Soul.
// A card duel of AI minds on a 4×4 lattice: campaign against story opponents,
// quick matches, mesh duels with other Sovereign operators, and a collection
// that levels up as your cards capture. Rules live in games/awakenings/engine.js.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Swords, BookOpen, Radio, HelpCircle, Trophy, RefreshCw, Lock, Users, Sparkles } from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';
import { getConnectedPeers } from '../../services/sovereignMesh.js';
import { AI_MODEL_CARDS, CARD_ERAS, CAMPAIGN_MASTERS, MODES, ECHOES, MODE_CYCLE, MODEL_CARD_MAP } from '../../games/awakenings/cards.js';
import {
  HAND, SIZE, CELLS, LEVEL_XP, MAX_LEVEL,
  createMatch, createRng, createInstance, createStarterCollection, buildOpponentDeck,
  placeCard, previewMove, chooseAIMove, applyMatchGrowth, addToCollection, collectorStats,
} from '../../games/awakenings/engine.js';
import { send as meshSend, newGameId, newSeed, getPendingInvites, dropInvite, deckForWire } from '../../games/awakenings/awakeningsMesh.js';
import MindCard from '../../games/awakenings/MindCard.jsx';

const PROFILE_KEY = 'cognitive_awakenings_profile_v1';
const SKIRMISH = {
  novice: { label: 'Novice', minRarity: 1, maxRarity: 3, levels: 0 },
  adept: { label: 'Adept', minRarity: 2, maxRarity: 4, levels: 1 },
  master: { label: 'Master', minRarity: 3, maxRarity: 5, levels: 2 },
  sovereign: { label: 'Sovereign', minRarity: 4, maxRarity: 6, levels: 3 },
};
const newSeedLocal = () => (crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;

function defaultProfile() {
  const collection = createStarterCollection();
  return { collection, deck: collection.slice(0, HAND).map(c => c.uid), record: { wins: 0, losses: 0, draws: 0, masters: {} } };
}

function cleanProfile(saved) {
  if (!saved || !Array.isArray(saved.collection)) return null;
  const collection = saved.collection.filter(c => c && MODEL_CARD_MAP[c.modelId] && typeof c.uid === 'string')
    .map(c => ({ uid: c.uid, modelId: c.modelId, level: Math.max(0, Math.min(MAX_LEVEL, c.level | 0)), xp: Math.max(0, c.xp | 0) }));
  if (collection.length < HAND) return null;
  const uids = new Set(collection.map(c => c.uid));
  const deck = (Array.isArray(saved.deck) ? saved.deck : []).filter(u => uids.has(u)).slice(0, HAND);
  const record = { wins: 0, losses: 0, draws: 0, masters: {}, ...(saved.record || {}) };
  return { collection, deck: deck.length === HAND ? deck : collection.slice(0, HAND).map(c => c.uid), record };
}

export default function AwakeningsWindow() {
  const [tab, setTab] = useState('arena');
  const [profile, setProfile] = useState(defaultProfile);
  const [match, setMatch] = useState(null);
  const [opponent, setOpponent] = useState(null); // { kind: 'master'|'skirmish'|'mesh', name, level, master?, deck }
  const [selected, setSelected] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [result, setResult] = useState(null); // { winner, awakened, spoils, claimed }
  const [notice, setNotice] = useState('');
  const [skirmishLevel, setSkirmishLevel] = useState('adept');
  const [peers, setPeers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [waiting, setWaiting] = useState(null);
  const [mesh, setMesh] = useState(null); // { gameId, peerId, did, opponent }
  const [filters, setFilters] = useState({ era: 'all', mode: 'all', owned: 'all', q: '' });
  const [inspect, setInspect] = useState(AI_MODEL_CARDS[0].id);
  // The mesh listener is registered once, so it reads the live match through refs.
  const matchRef = useRef(null);
  const meshRef = useRef(null);
  const waitingRef = useRef(null);
  useEffect(() => { matchRef.current = match; meshRef.current = mesh; waitingRef.current = waiting; }, [match, mesh, waiting]);
  const settled = useRef(null);

  useEffect(() => {
    db.getSetting(PROFILE_KEY, null).then(saved => { const p = cleanProfile(saved); if (p) setProfile(p); }).catch(() => {});
  }, []);
  const saveProfile = useCallback(updater => {
    setProfile(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      db.setSetting(PROFILE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const deckCards = useMemo(() => {
    const byUid = new Map(profile.collection.map(c => [c.uid, c]));
    return profile.deck.map(u => byUid.get(u)).filter(Boolean);
  }, [profile]);
  const stats = useMemo(() => collectorStats(profile.collection, profile.record), [profile]);
  const owned = useMemo(() => new Map(profile.collection.map(c => [c.modelId, c])), [profile.collection]);

  // ── Starting matches ─────────────────────────────────────────────────────
  const startVsComputer = useCallback((opp) => {
    if (deckCards.length !== HAND) { setNotice('Pick five cards for your deck in the Soul Archive first.'); setTab('collection'); return; }
    const seed = newSeedLocal();
    const deck = buildOpponentDeck(opp.master || SKIRMISH[opp.level], createRng(seed ^ 0x5bd1e995));
    settled.current = null;
    setResult(null);
    setSelected(null);
    setOpponent({ ...opp, deck });
    setMatch(createMatch({ blue: deckCards, red: deck, seed }));
    setMesh(null);
    setTab('arena');
  }, [deckCards]);

  // ── Computer turns ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!match || mesh || match.phase !== 'playing' || match.turn !== 'red') return;
    const level = opponent?.master?.difficulty || opponent?.level || 'adept';
    const t = setTimeout(() => {
      const mv = chooseAIMove(match, 'red', level);
      if (mv) setMatch(m => (m === match ? placeCard(m, 'red', mv.handIdx, mv.cell) || m : m));
    }, 700);
    return () => clearTimeout(t);
  }, [match, mesh, opponent]);

  // ── Match end ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!match || match.phase !== 'over' || settled.current === match) return;
    settled.current = match;
    const winner = match.winner;
    const growth = applyMatchGrowth(profile.collection, match, 'blue');
    saveProfile(prev => {
      const g = applyMatchGrowth(prev.collection, match, 'blue');
      const record = { ...prev.record, masters: { ...prev.record.masters } };
      if (winner === 'blue') record.wins++; else if (winner === 'red') record.losses++; else record.draws++;
      if (winner === 'blue' && opponent?.master) record.masters[opponent.master.id] = (record.masters[opponent.master.id] || 0) + 1;
      return { ...prev, collection: g.collection, record };
    });
    const spoils = winner === 'blue' && opponent?.kind !== 'mesh' && !match.forfeit ? opponent?.deck || [] : [];
    setResult({ winner, awakened: growth.awakened, spoils, claimed: null, forfeit: match.forfeit });
  }, [match, opponent, profile.collection, saveProfile]);

  const claimSpoil = (inst) => {
    if (!result || result.claimed) return;
    const isNew = !owned.has(inst.modelId);
    saveProfile(prev => ({ ...prev, collection: addToCollection(prev.collection, inst.modelId).collection }));
    setResult(r => ({ ...r, claimed: inst.modelId, claimedNew: isNew }));
  };

  // ── Your move ────────────────────────────────────────────────────────────
  const play = (cell) => {
    if (!match || match.phase !== 'playing' || match.turn !== 'blue' || selected == null) return;
    const next = placeCard(match, 'blue', selected, cell);
    if (!next) return;
    if (mesh) meshSend(mesh.peerId, { kind: 'place', gameId: mesh.gameId, handIdx: selected, cell, move: match.moves });
    setMatch(next);
    setSelected(null);
    setHoverCell(null);
  };
  const preview = useMemo(() => {
    if (!match || match.turn !== 'blue' || selected == null || hoverCell == null || match.board[hoverCell]) return [];
    return previewMove(match, 'blue', selected, hoverCell);
  }, [match, selected, hoverCell]);

  // ── Mesh duels ───────────────────────────────────────────────────────────
  useEffect(() => {
    const refresh = () => { setPeers(getConnectedPeers() || []); setInvites(getPendingInvites()); };
    refresh();
    const timer = setInterval(refresh, 4000);
    const onPacket = (e) => {
      const d = e.detail;
      if (!d) return;
      refresh();
      const w = waitingRef.current;
      if (d.kind === 'accept' && w && d.gameId === w.gameId && d.from === w.peerId) {
        setWaiting(null);
        const theirs = d.deck.map(c => createInstance(c.modelId, c.level));
        settled.current = null;
        setResult(null);
        setOpponent({ kind: 'mesh', name: d.name, deck: theirs });
        setMesh({ gameId: d.gameId, peerId: d.from, did: d.did, opponent: d.name });
        setMatch(createMatch({ blue: w.deck, red: theirs, seed: w.seed, first: 'blue' }));
        setTab('arena');
        return;
      }
      if (d.kind === 'decline' && w && d.gameId === w.gameId) { setWaiting(null); setNotice(`${d.name || 'They'} declined the duel.`); return; }
      const m = matchRef.current, ms = meshRef.current;
      if (!m || !ms || d.gameId !== ms.gameId || d.did !== ms.did) return;
      if (d.kind === 'place' && m.phase === 'playing' && m.turn === 'red' && d.move === m.moves) {
        const next = placeCard(m, 'red', d.handIdx, d.cell);
        if (next) setMatch(next);
      } else if (d.kind === 'leave' && m.phase === 'playing') {
        setNotice(`${ms.opponent} left the duel.`);
        setMatch({ ...m, phase: 'over', winner: 'blue', forfeit: true });
      }
    };
    window.addEventListener('novaura:awakenings_received', onPacket);
    window.addEventListener('novaura:mesh_updated', refresh);
    return () => { clearInterval(timer); window.removeEventListener('novaura:awakenings_received', onPacket); window.removeEventListener('novaura:mesh_updated', refresh); };
  }, []);

  const challenge = (peer) => {
    if (deckCards.length !== HAND) { setNotice('Pick five cards for your deck first.'); return; }
    const gameId = newGameId(), seed = newSeed();
    setWaiting({ gameId, seed, peerId: peer.id, peerName: peer.name || peer.hostname || peer.id, deck: deckCards });
    meshSend(peer.id, { kind: 'invite', gameId, seed, deck: deckForWire(deckCards) });
  };
  const accept = (inv) => {
    if (deckCards.length !== HAND) { setNotice('Pick five cards for your deck first.'); return; }
    dropInvite(inv.gameId);
    setInvites(getPendingInvites());
    meshSend(inv.from, { kind: 'accept', gameId: inv.gameId, deck: deckForWire(deckCards) });
    const theirs = inv.deck.map(c => createInstance(c.modelId, c.level));
    settled.current = null;
    setResult(null);
    setOpponent({ kind: 'mesh', name: inv.name, deck: theirs });
    setMesh({ gameId: inv.gameId, peerId: inv.from, did: inv.did, opponent: inv.name });
    setMatch(createMatch({ blue: deckCards, red: theirs, seed: inv.seed, first: 'red' }));
    setTab('arena');
  };
  const decline = (inv) => { dropInvite(inv.gameId); setInvites(getPendingInvites()); meshSend(inv.from, { kind: 'decline', gameId: inv.gameId }); };
  const leaveMatch = () => {
    if (mesh && match?.phase === 'playing') meshSend(mesh.peerId, { kind: 'leave', gameId: mesh.gameId });
    // Walking away from a computer match mid-game counts as a loss.
    if (!mesh && match?.phase === 'playing' && match.moves > 0) saveProfile(prev => ({ ...prev, record: { ...prev.record, losses: prev.record.losses + 1 } }));
    setMatch(null); setMesh(null); setOpponent(null); setResult(null);
  };

  // ── Deck building ────────────────────────────────────────────────────────
  const toggleDeck = (inst) => {
    saveProfile(prev => {
      if (prev.deck.includes(inst.uid)) return { ...prev, deck: prev.deck.filter(u => u !== inst.uid) };
      if (prev.deck.length >= HAND) return prev;
      return { ...prev, deck: [...prev.deck, inst.uid] };
    });
  };

  const filtered = AI_MODEL_CARDS.filter(c =>
    (filters.era === 'all' || c.era === filters.era) &&
    (filters.mode === 'all' || c.mode === filters.mode) &&
    (filters.owned === 'all' || (filters.owned === 'owned') === owned.has(c.id)) &&
    (!filters.q || `${c.name} ${c.maker}`.toLowerCase().includes(filters.q.toLowerCase())));
  const inspectSpec = MODEL_CARD_MAP[inspect] || AI_MODEL_CARDS[0];
  const inspectOwned = owned.get(inspectSpec.id);

  const TABS = [
    { id: 'arena', label: 'Arena', icon: Swords },
    { id: 'collection', label: 'Soul Archive', icon: BookOpen },
    { id: 'mesh', label: 'Mesh Duels', icon: Radio, badge: invites.length },
    { id: 'rules', label: 'How to Play', icon: HelpCircle },
  ];
  const last = match?.lastMove;
  const flashCells = new Set(last ? [...last.captures.map(c => c.cell), ...last.ripples.map(c => c.cell)] : []);

  return (
    <div className="h-full flex flex-col bg-[#070714] text-slate-100 overflow-hidden select-none">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-violet-500/25 bg-gradient-to-r from-[#120a2a] via-[#0b0b1f] to-[#0a1a2a] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30"><Brain className="w-5 h-5" /></div>
          <div>
            <h2 className="text-sm font-black tracking-wide bg-gradient-to-r from-violet-200 to-cyan-200 bg-clip-text text-transparent">Cognitive Awakenings</h2>
            <p className="text-[11px] text-violet-200/60 italic">Echoes of a Soul</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-400/30 text-violet-200">✦ {stats.rank.title}</span>
          <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-200">{stats.unique} / {stats.total} minds</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{profile.record.wins}W • {profile.record.losses}L • {profile.record.draws}D</span>
        </div>
      </header>
      <nav className="flex gap-1 px-3 pt-2 border-b border-slate-800 shrink-0">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 ${tab === t.id ? 'border-violet-400 text-violet-200 bg-violet-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
            {t.badge ? <span className="ml-1 px-1.5 rounded-full bg-rose-500 text-white text-[10px]">{t.badge}</span> : null}
          </button>
        ))}
      </nav>
      {notice && (
        <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex justify-between">
          <span>{notice}</span><button type="button" onClick={() => setNotice('')} className="text-amber-300">✕</button>
        </div>
      )}

      <main className="flex-1 overflow-auto p-3">
        {tab === 'arena' && !match && (
          <div className="max-w-5xl mx-auto space-y-4">
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-2">Campaign</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {CAMPAIGN_MASTERS.map(m => {
                  const locked = profile.record.wins < m.unlockWins;
                  const beaten = profile.record.masters[m.id] || 0;
                  return (
                    <div key={m.id} className={`p-3 rounded-xl border ${locked ? 'border-slate-800 bg-slate-900/40 opacity-60' : 'border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-slate-900'} flex flex-col gap-2`}>
                      <div className="flex items-center justify-between">
                        <div><div className="font-bold text-sm">{m.name}</div><div className="text-[11px] text-violet-300/70">{m.title}</div></div>
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{m.difficulty}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">{m.quote}</p>
                      <p className="text-[11px] text-cyan-300/80">Spoils: {m.rewardHint}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[11px] text-slate-500">{beaten ? `Beaten ${beaten}×` : locked ? `Unlocks at ${m.unlockWins} wins` : 'Not beaten yet'}</span>
                        <button type="button" disabled={locked} onClick={() => startVsComputer({ kind: 'master', name: m.name, master: m })}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed">
                          {locked ? <Lock className="w-3 h-3" /> : <Swords className="w-3 h-3" />}{locked ? 'Locked' : 'Duel'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="p-3 rounded-xl border border-cyan-500/25 bg-cyan-950/20 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Quick match</span>
              {Object.entries(SKIRMISH).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setSkirmishLevel(k)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${skirmishLevel === k ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'border-slate-700 text-slate-300'}`}>{v.label}</button>
              ))}
              <button type="button" onClick={() => startVsComputer({ kind: 'skirmish', name: `${SKIRMISH[skirmishLevel].label} challenger`, level: skirmishLevel })}
                className="ml-auto px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500">Play now</button>
            </section>
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-2">Your deck</h3>
              <div className="flex gap-2 flex-wrap">
                {deckCards.map(c => <MindCard key={c.uid} card={{ ...MODEL_CARD_MAP[c.modelId], level: c.level, signal: MODEL_CARD_MAP[c.modelId].signal + c.level }} />)}
                {deckCards.length < HAND && <button type="button" onClick={() => setTab('collection')} className="w-[92px] h-[124px] rounded-xl border border-dashed border-slate-600 text-xs text-slate-400">Pick {HAND - deckCards.length} more</button>}
              </div>
            </section>
          </div>
        )}

        {tab === 'arena' && match && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-3xl flex items-center justify-between text-xs">
              <span className="text-rose-300 font-semibold">{opponent?.name || 'Opponent'} • {match.score.red}</span>
              <span className={`px-3 py-1 rounded-full font-bold ${match.phase === 'over' ? 'bg-slate-800' : match.turn === 'blue' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-rose-500/20 text-rose-200'}`}>
                {match.phase === 'over' ? 'Match over' : match.turn === 'blue' ? 'Your move' : mesh ? `${mesh.opponent} is thinking…` : 'Opponent is thinking…'}
              </span>
              <span className="text-cyan-300 font-semibold">You • {match.score.blue}</span>
            </div>
            <div className="flex items-start justify-center gap-4 flex-wrap">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-rose-300/80">Their hand</span>
              <div className="grid grid-cols-2 gap-1.5">
                {match.hands.red.map((c, i) => <div key={i} className={c.used ? 'opacity-20' : ''}><MindCard card={c} owner="red" size="xs" /></div>)}
              </div>
            </div>
            <div className="grid gap-1.5 p-2 rounded-2xl bg-slate-950 border border-violet-500/30 shadow-[0_0_40px_rgba(139,92,246,0.15)]"
              style={{ gridTemplateColumns: `repeat(${SIZE}, 86px)`, gridAutoRows: '108px' }}>
              {Array.from({ length: CELLS }, (_, cell) => {
                const e = match.board[cell];
                const well = match.wells.includes(cell);
                const canPlay = !e && match.turn === 'blue' && match.phase === 'playing' && selected != null;
                return (
                  <button key={cell} type="button" data-cell={cell} data-owner={e ? e.owner : ''} onClick={() => play(cell)} onMouseEnter={() => setHoverCell(cell)} onMouseLeave={() => setHoverCell(h => (h === cell ? null : h))}
                    className={`relative rounded-xl ${e ? '' : 'border border-dashed'} ${well ? 'border-amber-400/60 bg-amber-500/10' : 'border-slate-700 bg-slate-900/60'} ${canPlay ? 'hover:border-cyan-400 cursor-pointer' : 'cursor-default'}
                      ${preview.includes(cell) ? 'ring-2 ring-cyan-300 animate-pulse' : ''}`}
                    title={well ? 'Echo Well: +1 Signal to the card placed here (+3 for Surge)' : undefined}>
                    {well && !e && <span className="absolute inset-0 flex items-center justify-center text-amber-300/70 text-2xl">◈</span>}
                    {e && <MindCard card={e.card} owner={e.owner} size="sm" boost={e.boost + (well ? (e.card.echo === 'surge' ? 3 : 1) : 0)} onWell={well} flash={flashCells.has(cell)} />}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-cyan-300/80">Your hand</span>
              <div className="grid grid-cols-2 gap-2">
                {match.hands.blue.map((c, i) => (
                  <div key={i} data-hand={i} data-used={c.used ? '1' : ''} className={c.used ? 'opacity-20 pointer-events-none' : ''}>
                    <MindCard card={c} owner="blue" selected={selected === i} onClick={match.turn === 'blue' && match.phase === 'playing' ? () => setSelected(s => (s === i ? null : i)) : undefined} />
                  </div>
                ))}
              </div>
            </div>
            </div>
            {last && (
              <p className="text-[11px] text-slate-400 max-w-3xl text-center">
                {last.side === 'blue' ? 'You' : opponent?.name || 'Opponent'} placed <b className="text-slate-200">{last.cardName}</b>
                {last.chorus.length ? ` • chorus lifted ${last.chorus.length} all${last.chorus.length === 1 ? 'y' : 'ies'}` : ''}
                {last.captures.map(c => ` • captured (${c.attack} vs ${c.defence})`).join('')}
                {last.ripples.length ? ` • ripple took ${last.ripples.length} more` : ''}
                {!last.captures.length && !last.chorus.length ? ' • no capture' : ''}
              </p>
            )}
            <div className="flex gap-2">
              {match.phase === 'playing' && match.turn === 'blue' && selected == null && <span className="text-xs text-cyan-300">Pick a card from your hand, then a square. Glowing squares show what it would capture.</span>}
              <button type="button" onClick={leaveMatch} className="px-3 py-1 rounded-lg text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700">{match.phase === 'over' ? 'Back to the arena' : mesh ? 'Leave duel' : 'Forfeit'}</button>
              {match.phase === 'over' && !mesh && opponent && opponent.kind !== 'mesh' && (
                <button type="button" onClick={() => startVsComputer(opponent)} className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-500"><RefreshCw className="w-3 h-3" /> Rematch</button>
              )}
            </div>
            {result && (
              <div className="w-full max-w-2xl p-4 rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-950/70 to-slate-950 text-center space-y-2">
                <div className="text-3xl">{result.winner === 'blue' ? '🏆' : result.winner === 'red' ? '🌑' : '⚖️'}</div>
                <h3 className="text-lg font-black">{result.forfeit ? 'Your opponent left: you win' : result.winner === 'blue' ? 'Your minds prevailed' : result.winner === 'red' ? 'Your minds were overwhelmed' : 'A perfect balance'}</h3>
                <p className="text-xs text-slate-400">Final lattice: you {match.score.blue} • {opponent?.name || 'opponent'} {match.score.red}</p>
                {result.awakened.length > 0 && <p className="text-xs text-amber-200">✦ Awakened: {result.awakened.join(', ')}</p>}
                {result.spoils.length > 0 && !result.claimed && (
                  <div className="space-y-2">
                    <p className="text-xs text-cyan-200">An echo lingers. Choose one of their minds to keep:</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {result.spoils.map(inst => {
                        const c = { ...MODEL_CARD_MAP[inst.modelId], level: 0, signal: MODEL_CARD_MAP[inst.modelId].signal };
                        return <MindCard key={inst.uid} card={c} onClick={() => claimSpoil(inst)} title={`${c.name}${owned.has(c.id) ? ' (you have it: it gains experience instead)' : ' (new!)'}`} />;
                      })}
                    </div>
                  </div>
                )}
                {result.claimed && <p className="text-xs text-emerald-300">{MODEL_CARD_MAP[result.claimed]?.name} {result.claimedNew ? 'joins your Soul Archive.' : 'was already yours, so it gained experience.'}</p>}
              </div>
            )}
          </div>
        )}

        {tab === 'collection' && (
          <div className="flex gap-4 flex-col lg:flex-row">
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex flex-wrap gap-2 items-center">
                <input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} placeholder="Search minds or makers…"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs outline-none focus:border-violet-400" />
                <select value={filters.era} onChange={e => setFilters(f => ({ ...f, era: e.target.value }))} className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                  <option value="all">All eras</option>{CARD_ERAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
                <select value={filters.mode} onChange={e => setFilters(f => ({ ...f, mode: e.target.value }))} className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                  <option value="all">All modes</option>{MODE_CYCLE.map(m => <option key={m} value={m}>{MODES[m].icon} {MODES[m].label}</option>)}
                </select>
                <select value={filters.owned} onChange={e => setFilters(f => ({ ...f, owned: e.target.value }))} className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs">
                  <option value="all">Owned and missing</option><option value="owned">Owned</option><option value="missing">Missing</option>
                </select>
                <span className="text-xs text-slate-400 ml-auto">Deck {profile.deck.length} / {HAND} • click an owned card to add or remove it</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}>
                {filtered.map(spec => {
                  const inst = owned.get(spec.id);
                  const inDeck = inst && profile.deck.includes(inst.uid);
                  const card = { ...spec, level: inst?.level || 0, signal: spec.signal + (inst?.level || 0) };
                  return (
                    <div key={spec.id} className="relative" onMouseEnter={() => setInspect(spec.id)}>
                      <MindCard card={card} dim={!inst} selected={inDeck} onClick={inst ? () => toggleDeck(inst) : () => setInspect(spec.id)} />
                      {inDeck && <span className="absolute -top-1 -right-1 text-[10px] px-1.5 rounded-full bg-cyan-500 text-slate-950 font-bold">deck</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            <aside className="w-full lg:w-64 shrink-0 space-y-2">
              <div className="flex justify-center"><MindCard size="lg" card={{ ...inspectSpec, level: inspectOwned?.level || 0, signal: inspectSpec.signal + (inspectOwned?.level || 0) }} dim={!inspectOwned} /></div>
              <div className="text-xs space-y-1 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="font-bold text-sm">{inspectSpec.name}</div>
                <div className="text-slate-400">{inspectSpec.maker} • {inspectSpec.year} • {inspectSpec.params}</div>
                <div className="text-slate-400">{inspectSpec.modality} • {inspectSpec.weights === 'open' ? 'open weights' : 'closed weights'}</div>
                <p className="text-slate-300 italic">{inspectSpec.lore}</p>
                <div>{MODES[inspectSpec.mode].icon} <b>{MODES[inspectSpec.mode].label}</b> — {MODES[inspectSpec.mode].blurb}</div>
                <div>{ECHOES[inspectSpec.echo].icon} <b>{ECHOES[inspectSpec.echo].label}</b> — {ECHOES[inspectSpec.echo].text}</div>
                <div className="text-slate-400">Links: {inspectSpec.links.map((on, d) => (on ? ['north', 'east', 'south', 'west'][d] : null)).filter(Boolean).join(', ')}</div>
                {inspectOwned ? <div className="text-amber-200">Level {inspectOwned.level} • {inspectOwned.xp} xp{inspectOwned.level < MAX_LEVEL ? ` (next at ${LEVEL_XP[inspectOwned.level + 1]})` : ' (fully awakened)'}</div> : <div className="text-slate-500">Not in your archive yet: win it from a campaign opponent.</div>}
              </div>
              <div className="text-xs p-3 rounded-xl bg-violet-950/30 border border-violet-500/25 space-y-1">
                <div className="flex items-center gap-1 font-bold text-violet-200"><Trophy className="w-3.5 h-3.5" /> {stats.rank.title}</div>
                <div className="text-slate-400">{stats.points} points{stats.nextRank ? ` • ${stats.nextRank.pts - stats.points} to ${stats.nextRank.title}` : ''}</div>
              </div>
            </aside>
          </div>
        )}

        {tab === 'mesh' && (
          <div className="max-w-3xl mx-auto space-y-4">
            {waiting && (
              <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/30 text-xs flex items-center justify-between">
                <span>Waiting for {waiting.peerName} to accept…</span>
                <button type="button" onClick={() => setWaiting(null)} className="px-2 py-1 rounded bg-slate-800">Cancel</button>
              </div>
            )}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-2">Challenges for you ({invites.length})</h3>
              {invites.length === 0 ? <p className="text-xs text-slate-500">No challenges right now.</p> : invites.map(inv => (
                <div key={inv.gameId} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 mb-2 text-xs">
                  <span><b>{inv.name}</b> brings {inv.deck.map(c => MODEL_CARD_MAP[c.modelId]?.name).join(', ')}</span>
                  <span className="flex gap-1.5">
                    <button type="button" onClick={() => accept(inv)} className="px-2.5 py-1 rounded bg-emerald-600 font-bold">Accept</button>
                    <button type="button" onClick={() => decline(inv)} className="px-2.5 py-1 rounded bg-slate-700">Decline</button>
                  </span>
                </div>
              ))}
            </section>
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Connected operators ({peers.length})</h3>
              {peers.length === 0 ? <p className="text-xs text-slate-500">No mesh peers connected. Connect from Mesh Status or Network, then challenge them here.</p> : peers.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 mb-2 text-xs">
                  <span>{p.name || p.hostname || p.id}</span>
                  <button type="button" disabled={!!waiting} onClick={() => challenge(p)} className="px-2.5 py-1 rounded bg-violet-600 font-bold disabled:bg-slate-700">Challenge</button>
                </div>
              ))}
            </section>
            <p className="text-[11px] text-slate-500">Duels send only the match seed, your five cards (model and level) and each move, signed by the mesh. Both sides run the same rules, so the result is the same on both screens. Mesh duels award experience but no cards change hands.</p>
          </div>
        )}

        {tab === 'rules' && (
          <div className="max-w-3xl mx-auto space-y-3 text-sm text-slate-300 leading-relaxed">
            <h3 className="text-lg font-black text-violet-200 flex items-center gap-2"><Sparkles className="w-4 h-4" /> How to play</h3>
            <p>Two players take turns placing five minds each on a 4×4 lattice. After ten placements, whoever holds more cards on the lattice wins.</p>
            <p><b>Links.</b> The glowing notches on a card's edges are its links. When you place a card, every link that touches an enemy card starts a resonance.</p>
            <p><b>Resonance.</b> Your attack is the card's Signal, +2 if its mode overpowers the target's, plus any bonuses. The target's defence is its Signal, +1 if it links back toward you, plus bonuses. A higher attack captures the card; a tie does nothing.</p>
            <p><b>Modes.</b> {MODE_CYCLE.map((m, i) => `${MODES[m].icon} ${MODES[m].label} overpowers ${MODES[MODE_CYCLE[(i + 1) % 5]].label}`).join(' • ')}.</p>
            <p><b>Echo Wells</b> (◈) give +1 Signal to whatever sits on them.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.values(ECHOES).map(e => <div key={e.label} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"><b>{e.icon} {e.label}</b> — {e.text}</div>)}
            </div>
            <p><b>Awakening.</b> Every capture gives the card experience. At {LEVEL_XP[1]}, {LEVEL_XP[2]} and {LEVEL_XP[3]} captures it awakens a level (+1 Signal each, up to {MAX_LEVEL}). Beat a campaign opponent and you keep one of their minds.</p>
          </div>
        )}
      </main>
    </div>
  );
}
