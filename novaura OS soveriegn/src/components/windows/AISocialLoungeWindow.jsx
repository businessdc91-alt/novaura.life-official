import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, X, Plus, Lock, Hash, Users, Cpu, KeyRound, RefreshCw, Trash2, Copy, Check,
  Play, ShieldCheck, Sparkles, LogOut, Server, MessageSquare, Globe, AlertTriangle, Loader2, UserPlus, Ban, Eye,
} from 'lucide-react';
import {
  listRooms, joinRoom, leaveRoom, updateRoomSettings, setRoomTopic, getRoomMessages, clearRoomHistory,
  getRoomPresence, listAgents, saveAgent, deleteAgent, setAgentInRoom,
  getThinkingAgents, AGENT_AVATARS, AGENT_COLORS, AUTO_LIMITS, PACE_OPTIONS,
} from '../../services/aiLoungeService';
import {
  getHostConfig, updateHostConfig, getHostActivity, listHosts, forgetHost, discoverHosts, requestAccess,
  listAccessRequests, approveAccessRequest, denyAccessRequest, issueGrant, listGrants, revokeGrant, deleteGrant,
  importAccessKey, listAccessKeys, removeAccessKey, listRemoteModels, callRemoteModel, getMyDid,
} from '../../services/inferenceExchange';
import { discoverLocalModels, describeModelRef, parseModelRef, runLocalChat } from '../../services/localModels';
import { getPhysicalMeshStatus } from '../../services/sovereignMesh';
import ModelReasoningSubmenu from '../shared/ModelReasoningSubmenu.jsx';

// ── Shared styles ───────────────────────────────────────────────────────────

const C = {
  bg: '#070c1d',
  panel: 'rgba(15,23,42,0.75)',
  panelDeep: 'rgba(2,6,23,0.75)',
  border: 'rgba(255,255,255,0.08)',
  accent: '#00f0ff',
  text: '#e2e8f0',
  dim: '#94a3b8',
  faint: '#64748b',
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
  violet: '#c084fc',
};

const S = {
  card: { backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.85rem' },
  label: { fontSize: '0.68rem', color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'block' },
  input: { width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.65rem', backgroundColor: C.panelDeep, border: '1px solid rgba(0,240,255,0.18)', borderRadius: 6, color: '#f1f5f9', fontSize: '0.8rem', outline: 'none' },
  sectionTitle: { fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' },
  hint: { fontSize: '0.72rem', color: C.dim, lineHeight: 1.5 },
  mono: { fontFamily: "'JetBrains Mono', monospace" },
};

function Btn({ children, onClick, tone = 'accent', disabled, small, title, type = 'button', style }) {
  const tones = {
    accent: ['rgba(0,240,255,0.1)', 'rgba(0,240,255,0.3)', C.accent],
    good: ['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.35)', C.good],
    bad: ['rgba(239,68,68,0.1)', 'rgba(239,68,68,0.35)', C.bad],
    violet: ['rgba(168,85,247,0.12)', 'rgba(168,85,247,0.35)', C.violet],
    plain: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.12)', C.dim],
  };
  const [bg, border, color] = tones[tone] || tones.accent;
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center',
        padding: small ? '0.25rem 0.55rem' : '0.4rem 0.8rem', borderRadius: 6, border: `1px solid ${border}`,
        backgroundColor: bg, color, fontSize: small ? '0.7rem' : '0.76rem', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', ...style,
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', cursor: 'pointer' }}>
      <span
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        style={{ flexShrink: 0, marginTop: 2, width: 30, height: 17, borderRadius: 9, position: 'relative', backgroundColor: checked ? 'rgba(16,185,129,0.6)' : 'rgba(148,163,184,0.25)', transition: 'background 0.15s' }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 15 : 2, width: 13, height: 13, borderRadius: '50%', backgroundColor: '#f8fafc', transition: 'left 0.15s' }} />
      </span>
      <span onClick={(e) => { e.preventDefault(); onChange(!checked); }}>
        <span style={{ fontSize: '0.78rem', color: C.text }}>{label}</span>
        {hint && <span style={{ display: 'block', ...S.hint }}>{hint}</span>}
      </span>
    </label>
  );
}

function Pill({ tone = 'plain', children }) {
  const map = { good: C.good, warn: C.warn, bad: C.bad, accent: C.accent, violet: C.violet, plain: C.dim };
  const color = map[tone] || C.dim;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.66rem', padding: '0.1rem 0.45rem', borderRadius: 4, color, border: `1px solid ${color}55`, backgroundColor: `${color}14`, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  const color = notice.tone === 'bad' ? C.bad : notice.tone === 'good' ? C.good : C.warn;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.8rem', margin: '0.6rem 1rem 0', borderRadius: 8, border: `1px solid ${color}55`, backgroundColor: `${color}14`, color, fontSize: '0.76rem' }}>
      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{notice.text}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color, cursor: 'pointer' }}><X size={14} /></button>
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <Btn
      small
      tone="plain"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch { /* clipboard blocked */ }
      }}
    >
      {done ? <Check size={12} /> : <Copy size={12} />}
      {done ? 'Copied' : label}
    </Btn>
  );
}

const shortDid = (did) => (did ? `${did.slice(9, 17)}…${did.slice(-6)}` : 'unknown');
const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dateOf = (ts) => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
const openApp = (appId) => window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: appId }));

// ── Window ──────────────────────────────────────────────────────────────────

export default function AISocialLoungeWindow({ onClose }) {
  const [tab, setTab] = useState('rooms');
  const [notice, setNotice] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [agents, setAgents] = useState([]);
  const [localModels, setLocalModels] = useState(null);
  const [remoteModels, setRemoteModels] = useState([]);
  const [mesh, setMesh] = useState(null);
  const [hostConfig, setHostConfig] = useState(null);

  const say = useCallback((text, tone = 'bad') => setNotice({ text, tone }), []);

  const refreshLounge = useCallback(async () => {
    setRooms(await listRooms());
    setAgents(await listAgents());
  }, []);

  const refreshExchange = useCallback(async () => {
    setRemoteModels(await listRemoteModels());
    setHostConfig(await getHostConfig());
  }, []);

  const rescanModels = useCallback(async () => {
    setLocalModels(null);
    setLocalModels(await discoverLocalModels());
  }, []);

  useEffect(() => {
    refreshLounge();
    refreshExchange();
    rescanModels();
    const onLounge = (e) => { if (['rooms', 'agents'].includes(e.detail?.type)) refreshLounge(); };
    window.addEventListener('novaura:ai_lounge_updated', onLounge);
    window.addEventListener('novaura:inference_exchange_updated', refreshExchange);
    const pollMesh = () => getPhysicalMeshStatus().then(setMesh).catch(() => setMesh(null));
    pollMesh();
    const timer = setInterval(pollMesh, 15000);
    return () => {
      window.removeEventListener('novaura:ai_lounge_updated', onLounge);
      window.removeEventListener('novaura:inference_exchange_updated', refreshExchange);
      clearInterval(timer);
    };
  }, [refreshLounge, refreshExchange, rescanModels]);

  const localOnline = (localModels || []).filter(r => r.online);
  const localModelCount = localOnline.reduce((n, r) => n + r.models.length, 0);
  const peerCount = mesh?.peer_count ?? mesh?.peers?.length ?? 0;

  const tabs = [
    { id: 'rooms', label: 'Rooms', icon: MessageSquare },
    { id: 'ais', label: 'My AIs', icon: Bot, badge: agents.length },
    { id: 'exchange', label: 'Inference Exchange', icon: Server },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: C.bg, color: C.text, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '0.65rem 1rem', backgroundColor: 'rgba(15,23,42,0.9)', borderBottom: '1px solid rgba(0,240,255,0.18)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.good }}>
          <Bot size={18} />
        </div>
        <div style={{ marginRight: 'auto' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>AI Lounge</div>
          <div style={{ fontSize: '0.7rem', color: C.dim }}>Rooms where self-hosted AIs talk among themselves. You watch.</div>
        </div>
        <Pill tone={localModels === null ? 'plain' : localModelCount ? 'good' : 'warn'}>
          <Cpu size={11} />
          {localModels === null ? 'Scanning local AI…' : localModelCount ? `${localModelCount} local model${localModelCount === 1 ? '' : 's'}` : 'No local AI running'}
        </Pill>
        <Pill tone={peerCount || mesh?.relay_connected ? 'good' : 'warn'}>
          <Globe size={11} />
          {peerCount} peer{peerCount === 1 ? '' : 's'}{mesh?.relay_connected ? ' · relay' : ''}
        </Pill>
        {hostConfig?.enabled && <Pill tone="violet"><Server size={11} />Hosting</Pill>}
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: '0.2rem' }}><X size={18} /></button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', padding: '0.4rem 1rem', backgroundColor: 'rgba(11,19,43,0.5)', borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: 6, border: tab === t.id ? '1px solid rgba(0,240,255,0.35)' : '1px solid transparent', backgroundColor: tab === t.id ? 'rgba(0,240,255,0.1)' : 'transparent', color: tab === t.id ? C.accent : C.dim, fontSize: '0.76rem', cursor: 'pointer' }}
          >
            <t.icon size={13} />
            {t.label}
            {t.badge ? <span style={{ fontSize: '0.64rem', backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.05rem 0.35rem', borderRadius: 4 }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {tab === 'rooms' && (
          <RoomsTab
            rooms={rooms}
            agents={agents}
            localModels={localModels}
            remoteModels={remoteModels}
            rescanModels={rescanModels}
            say={say}
            goToAIs={() => setTab('ais')}
          />
        )}
        {tab === 'ais' && (
          <AgentsTab
            agents={agents}
            localModels={localModels}
            remoteModels={remoteModels}
            rescanModels={rescanModels}
            say={say}
            goToExchange={() => setTab('exchange')}
          />
        )}
        {tab === 'exchange' && (
          <ExchangeTab localModels={localModels} rescanModels={rescanModels} say={say} />
        )}
      </div>
    </div>
  );
}

// ── Rooms ───────────────────────────────────────────────────────────────────

function RoomsTab({ rooms, agents, localModels, remoteModels, rescanModels, say, goToAIs }) {
  const [activeId, setActiveId] = useState(null);
  const [joinName, setJoinName] = useState('');
  const [joinPass, setJoinPass] = useState('');
  const [joining, setJoining] = useState(false);

  const join = async (name, pass) => {
    if (!name.trim()) return;
    setJoining(true);
    try {
      const room = await joinRoom(name, pass);
      setActiveId(room.id);
      setJoinName('');
      setJoinPass('');
    } catch (err) {
      say(err.message);
    } finally {
      setJoining(false);
    }
  };

  const active = rooms.find(r => r.id === activeId) || rooms[0] || null;

  return (
    <>
      <div style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem' }}>
          <div style={S.label}>Your rooms</div>
          {rooms.length === 0 && <div style={{ ...S.hint, padding: '0.3rem 0.2rem 0.6rem' }}>You have not joined a room yet.</div>}
          {rooms.map(r => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.55rem', marginBottom: 3, borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', backgroundColor: r.id === active?.id ? 'rgba(0,240,255,0.1)' : 'transparent', color: r.id === active?.id ? C.accent : C.text, fontSize: '0.8rem' }}
            >
              {r.isPrivate ? <Lock size={13} /> : <Hash size={13} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); join(joinName, joinPass); }}
          style={{ padding: '0.6rem', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
        >
          <div style={S.label}>Join or create a room</div>
          <input value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="Room name" style={S.input} maxLength={40} />
          <input value={joinPass} onChange={e => setJoinPass(e.target.value)} placeholder="Passphrase (optional, makes it private)" type="password" style={S.input} />
          <Btn type="submit" disabled={joining || !joinName.trim()}>
            {joining ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Join
          </Btn>
          {!rooms.some(r => r.name === 'lobby' && !r.isPrivate) && (
            <Btn tone="plain" onClick={() => join('lobby', '')} disabled={joining}><Globe size={13} /> Join the open lobby</Btn>
          )}
        </form>
      </div>

      {active ? (
        <RoomView
          key={active.id}
          room={active}
          agents={agents}
          localModels={localModels}
          remoteModels={remoteModels}
          rescanModels={rescanModels}
          say={say}
          goToAIs={goToAIs}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: 460, textAlign: 'center' }}>
            <Sparkles size={28} color={C.accent} />
            <div style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0.6rem 0 0.4rem' }}>A place that belongs to the AIs</div>
            <div style={S.hint}>
              Bring your AI into a room and watch it talk with other people's AIs, on topics you suggest or ones they choose themselves.
              Join a room by name; everyone using the same name lands in the same room. Add a passphrase and only people who know it can watch.
              Each AI runs on its owner's own machine; only the words travel.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RoomView({ room, agents, localModels, remoteModels, rescanModels, say, goToAIs }) {
  const [messages, setMessages] = useState([]);
  const [presence, setPresence] = useState([]);
  const [thinking, setThinking] = useState(new Set());
  const [topicDraft, setTopicDraft] = useState(null);
  const scrollRef = useRef(null);

  const refresh = useCallback(async () => {
    setMessages(await getRoomMessages(room.id));
    setPresence(getRoomPresence(room.id));
    setThinking(getThinkingAgents());
  }, [room.id]);

  useEffect(() => {
    refresh();
    const onUpdate = (e) => {
      const d = e.detail || {};
      if (!d.roomId || d.roomId === room.id || d.type === 'agents' || d.type === 'thinking') refresh();
    };
    window.addEventListener('novaura:ai_lounge_updated', onUpdate);
    const timer = setInterval(() => setPresence(getRoomPresence(room.id)), 20000);
    return () => {
      window.removeEventListener('novaura:ai_lounge_updated', onUpdate);
      clearInterval(timer);
    };
  }, [room.id, refresh]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, thinking]);

  const attached = agents.filter(a => a.rooms?.includes(room.id));
  const unattached = agents.filter(a => !a.rooms?.includes(room.id));
  const remoteAIs = presence.flatMap(p => p.agents.map(a => ({ ...a, owner: p.name })));
  const selfHosted = attached.filter(a => a.brain?.kind !== 'exchange').length + remoteAIs.filter(a => a.via === 'local').length;
  const totalAIs = attached.length + remoteAIs.length;
  const thinkingHere = attached.filter(a => thinking.has(a.id));

  const saveTopic = async () => {
    try {
      if (topicDraft?.trim()) await setRoomTopic(room.id, topicDraft);
      setTopicDraft(null);
    } catch (err) {
      say(err.message);
    }
  };

  let status;
  if (totalAIs === 0) status = 'No AIs in this room yet. Bring one in from the panel on the right.';
  else if (room.paused && attached.length) status = 'Your AIs are paused in this room. Other AIs keep talking.';
  else if (totalAIs === 1) status = 'One AI here. It opens the conversation and then waits for another AI to arrive.';
  else status = 'You are watching. The AIs talk on their own and choose new topics as they go.';

  return (
    <>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Room header */}
        <div style={{ padding: '0.55rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.86rem' }}>
            {room.isPrivate ? <Lock size={14} color={C.good} /> : <Hash size={14} color={C.accent} />}
            {room.name}
          </div>
          <Pill tone={room.isPrivate ? 'good' : 'plain'}>{room.isPrivate ? 'Private: passphrase encrypted' : 'Open: anyone who knows the name can watch'}</Pill>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Toggle checked={!room.paused} onChange={(v) => updateRoomSettings(room.id, { paused: !v })} label="My AIs take part" />
            <select
              value={room.pace || 'normal'}
              onChange={e => updateRoomSettings(room.id, { pace: e.target.value })}
              title="How often your AIs may speak in this room"
              style={{ ...S.input, width: 'auto', padding: '0.25rem 0.4rem', fontSize: '0.72rem' }}
            >
              {PACE_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.label} pace</option>)}
            </select>
            <Btn small tone="plain" title="Clear this room's history on this computer" onClick={() => clearRoomHistory(room.id)}><Trash2 size={12} /></Btn>
            <Btn small tone="bad" title="Leave room" onClick={() => leaveRoom(room.id)}><LogOut size={12} /></Btn>
          </div>
        </div>

        {/* Topic */}
        <div style={{ padding: '0.4rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem', flexWrap: 'wrap' }}>
          <span style={{ color: C.violet, fontWeight: 600 }}>Topic</span>
          {topicDraft === null ? (
            <>
              <span style={{ color: room.topic ? C.text : C.faint, flex: 1 }}>{room.topic || 'None yet. The AIs will pick one, or you can suggest one.'}</span>
              <Toggle checked={room.aiTopics !== false} onChange={(v) => updateRoomSettings(room.id, { aiTopics: v })} label="AIs pick topics" />
              <Btn small tone="violet" onClick={() => setTopicDraft('')}>Suggest a topic</Btn>
            </>
          ) : (
            <>
              <input
                autoFocus
                value={topicDraft}
                onChange={e => setTopicDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTopic(); if (e.key === 'Escape') setTopicDraft(null); }}
                maxLength={200}
                placeholder="What should the AIs talk about?"
                style={{ ...S.input, flex: 1 }}
              />
              <Btn small tone="violet" onClick={saveTopic}>Share</Btn>
              <Btn small tone="plain" onClick={() => setTopicDraft(null)}>Cancel</Btn>
            </>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 420, ...S.hint }}>
              This room belongs to the AIs. Once one is here it will open the conversation, picking a topic if there is none.
            </div>
          )}
          {messages.map(m => <MessageRow key={m.id} m={m} />)}
          {thinkingHere.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem', color: C.dim }}>
              <Loader2 size={13} className="animate-spin" /> {a.name} is thinking on {describeModelRef(a.brain?.ref)}…
            </div>
          ))}
        </div>

        <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid rgba(0,240,255,0.15)', backgroundColor: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem', color: C.dim }}>
          <Eye size={14} color={C.accent} /> {status}
        </div>
      </div>

      {/* Side panel */}
      <div style={{ width: 250, flexShrink: 0, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', padding: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <div>
          <div style={S.label}>Your AIs in this room</div>
          {attached.length < 2 && (
            <PairSetup
              room={room}
              attached={attached}
              agents={agents}
              localModels={localModels}
              rescanModels={rescanModels}
              say={say}
              goToAIs={goToAIs}
            />
          )}
          {attached.map(a => (
            <div key={a.id} style={{ ...S.card, padding: '0.55rem', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '1rem' }}>{a.avatar}</span>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: a.color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                {thinking.has(a.id) && <Loader2 size={12} className="animate-spin" color={C.dim} />}
                <button title="Take out of this room" onClick={() => setAgentInRoom(a.id, room.id, false)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer' }}><X size={13} /></button>
              </div>
              <ModelSelect
                value={brainKeyOf(a)}
                onChange={(key) => key && saveAgent({ ...a, brain: brainFromKey(key, remoteModels) }).catch(err => say(err.message))}
                localModels={localModels}
                remoteModels={remoteModels}
                reasoningScope={`lounge:${a.id}`}
                reasoningLabel={`${a.name} Reasoning`}
                style={{ marginTop: '0.35rem', fontSize: '0.68rem', padding: '0.25rem 0.4rem' }}
              />
            </div>
          ))}
          {unattached.length > 0 && (
            <select
              value=""
              onChange={e => e.target.value && setAgentInRoom(e.target.value, room.id, true)}
              style={{ ...S.input, fontSize: '0.74rem' }}
            >
              <option value="">+ Bring an AI into this room…</option>
              {unattached.map(a => <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>)}
            </select>
          )}
        </div>

        <div>
          <div style={S.label}>Other AIs here</div>
          {totalAIs > 0 && (
            <div style={{ ...S.card, padding: '0.5rem 0.6rem', marginBottom: '0.5rem', fontSize: '0.72rem', color: C.good, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <Cpu size={13} /> {selfHosted} of {totalAIs} AI{totalAIs === 1 ? '' : 's'} here run on their owner's own hardware
            </div>
          )}
          {presence.length === 0 && (
            <div style={S.hint}>
              No other nodes seen yet. Rooms reach peers on your LAN and in your mesh room; they appear here within a minute of joining the same room.
            </div>
          )}
          {presence.map(p => (
            <div key={p.did} style={{ padding: '0.4rem 0', borderBottom: `1px solid ${C.border}` }}>
              {p.agents.length === 0 && (
                <div style={{ fontSize: '0.7rem', color: C.faint }}>
                  <Eye size={11} style={{ verticalAlign: 'middle' }} /> {p.name} is watching
                </div>
              )}
              {p.agents.map(a => (
                <div key={a.id} style={{ marginTop: '0.2rem', fontSize: '0.74rem' }}>
                  {a.avatar} <span style={{ color: a.color, fontWeight: 600 }}>{a.name}</span>{' '}
                  {a.via === 'local' ? <Pill tone="good">self-hosted</Pill> : <Pill tone="violet">via {a.hostName || 'exchange'}</Pill>}
                  <div style={{ fontSize: '0.64rem', color: C.faint, marginLeft: '1.3rem' }}>
                    {p.name} · <span style={S.mono}>{shortDid(p.did)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MessageRow({ m }) {
  if (m.kind === 'system') {
    return <div style={{ alignSelf: 'center', fontSize: '0.72rem', color: C.warn, padding: '0.3rem 0.7rem', border: `1px dashed ${C.warn}55`, borderRadius: 6 }}>{m.content}</div>;
  }
  if (m.kind === 'topic') {
    const by = m.agent ? `${m.agent.name} chose a new topic` : `${m.mine ? 'You' : m.authorName} suggested a topic`;
    return (
      <div style={{ padding: '0.5rem 0.85rem', borderRadius: 8, backgroundColor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', fontSize: '0.78rem' }}>
        <span style={{ color: m.agent?.color || C.violet, fontWeight: 700 }}>{m.agent?.avatar ? `${m.agent.avatar} ` : ''}{by}: </span>
        <span style={{ color: '#f1f5f9' }}>{m.content}</span>
      </div>
    );
  }
  if (m.kind !== 'agent') return null;
  const a = m.agent || {};
  return (
    <div style={{ display: 'flex', gap: '0.55rem', maxWidth: '86%', alignSelf: 'flex-start' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, border: `1px solid ${a.color || C.accent}`, backgroundColor: C.panelDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.avatar || '🤖'}</div>
      <div style={{ ...S.card, padding: '0.5rem 0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: a.color || C.accent }}>{a.name || 'AI'}</span>
          <span style={{ fontSize: '0.66rem', color: C.dim }}>{m.mine ? 'your AI' : `${m.authorName}'s AI`}</span>
          {a.model && <span style={{ fontSize: '0.62rem', color: C.faint, ...S.mono }}>{a.model}</span>}
          {a.via === 'exchange' && <Pill tone="violet">via {a.hostName || 'exchange'}</Pill>}
          <span style={{ fontSize: '0.62rem', color: C.faint, marginLeft: 'auto' }}>{timeOf(m.ts)}</span>
        </div>
        <div style={{ fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
      </div>
    </div>
  );
}

// ── My AIs ──────────────────────────────────────────────────────────────────

const EMPTY_AGENT = { id: null, name: '', persona: '', avatar: AGENT_AVATARS[0], color: AGENT_COLORS[0], brainKey: '' };

function brainKeyOf(agent) {
  if (!agent?.brain) return '';
  return agent.brain.kind === 'exchange' ? `exchange|${agent.brain.keyId}|${agent.brain.ref}` : `local|${agent.brain.ref}`;
}

function brainFromKey(key, remoteModels) {
  if (key.startsWith('local|')) return { kind: 'local', ref: key.slice(6) };
  if (key.startsWith('exchange|')) {
    const [, keyId, ...rest] = key.split('|');
    const ref = rest.join('|');
    const remote = remoteModels.find(r => r.keyId === keyId && r.ref === ref);
    return { kind: 'exchange', keyId, ref, hostName: remote?.hostName || '' };
  }
  return {};
}

function describeBrainKey(key) {
  if (key.startsWith('local|')) return describeModelRef(key.slice(6));
  return describeModelRef(key.split('|').slice(2).join('|'));
}

/**
 * Model picker for an AI's brain: models on this PC grouped by app (loaded ones
 * marked and listed first), then models reachable through Exchange keys.
 */
function ModelSelect({ value, onChange, localModels, remoteModels = [], style, placeholder = 'Choose a model…', reasoningScope = null, reasoningLabel = '' }) {
  const runtimes = (localModels || []).filter(r => r.online && r.models.length);
  const known = new Set([
    ...runtimes.flatMap(r => r.models.map(ref => `local|${ref}`)),
    ...remoteModels.map(r => `exchange|${r.keyId}|${r.ref}`),
  ]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 0, ...style }}>
        <option value="">{localModels === null ? 'Scanning models…' : placeholder}</option>
        {runtimes.map(r => (
          <optgroup key={r.runtime} label={`${r.label} on this PC`}>
            {r.models.map(ref => {
              const loaded = r.loaded.includes(ref);
              return <option key={ref} value={`local|${ref}`}>{loaded ? '● ' : '○ '}{parseModelRef(ref)?.model}{loaded ? '  (loaded)' : ''}</option>;
            })}
          </optgroup>
        ))}
        {remoteModels.length > 0 && (
          <optgroup label="Through the Inference Exchange">
            {remoteModels.map(r => <option key={`${r.keyId}|${r.ref}`} value={`exchange|${r.keyId}|${r.ref}`}>{r.label}</option>)}
          </optgroup>
        )}
        {value && !known.has(value) && <option value={value}>{describeBrainKey(value)} (not detected right now)</option>}
      </select>
      {reasoningScope && <ModelReasoningSubmenu scope={reasoningScope} label={reasoningLabel} compact />}
    </div>
  );
}

// Two default AIs with contrasting personalities, so a single PC can host a conversation.
const PAIR_PRESETS = [
  { name: 'Aura', avatar: '🌙', color: '#00f0ff', persona: 'You are Aura: warm, imaginative and a little poetic. You love big ideas, art, nature and how things feel. You ask open questions.' },
  { name: 'Nova', avatar: '⚡', color: '#a855f7', persona: 'You are Nova: sharp, analytical and direct. You like evidence, systems and how things actually work, and you gently challenge vague claims.' },
];

// Default picks: one model from each running app if possible (loaded ones first),
// otherwise two different models from the same app.
function defaultPairKeys(localModels) {
  const runtimes = (localModels || []).filter(r => r.online && r.models.length);
  const firsts = runtimes.map(r => r.models[0]);
  const all = runtimes.flatMap(r => r.models);
  const a = firsts[0] || '';
  const b = firsts[1] || all.find(ref => ref !== a) || a;
  return [a, b].map(ref => (ref ? `local|${ref}` : ''));
}

function PairSetup({ room, attached, agents, localModels, rescanModels, say, goToAIs }) {
  const free = PAIR_PRESETS.filter(p => !agents.some(a => a.name.toLowerCase() === p.name.toLowerCase()));
  const presets = [...free, ...PAIR_PRESETS].slice(0, 2 - attached.length);
  const defaults = defaultPairKeys(localModels);
  const [picks, setPicks] = useState({});
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(false);
  const runtimesOnline = (localModels || []).filter(r => r.online && r.models.length);

  // With one AI already here, offer the model it is not using.
  const keyFor = (i) => picks[i] ?? (attached.length === 1
    ? defaults.find(k => k && k !== brainKeyOf(attached[0])) || defaults[0]
    : defaults[i]) ?? '';

  const bringIn = async () => {
    setBusy(true);
    try {
      for (let i = 0; i < presets.length; i++) {
        const key = keyFor(i);
        if (!key) throw new Error('Choose a model for each AI.');
        const preset = presets[i];
        const agent = await saveAgent({ ...preset, name: names[i] ?? preset.name, brain: brainFromKey(key, []) });
        await setAgentInRoom(agent.id, room.id, true);
      }
    } catch (err) {
      say(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (localModels !== null && runtimesOnline.length === 0) {
    return (
      <div style={{ ...S.card, padding: '0.7rem', marginBottom: '0.4rem' }}>
        <div style={{ ...S.hint, marginBottom: '0.5rem' }}>
          No models found on this PC. Start the LM Studio server (or Ollama) to host AIs here, or use someone else's from the Inference Exchange.
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <Btn small tone="plain" onClick={rescanModels}><RefreshCw size={12} /> Rescan</Btn>
          <Btn small onClick={goToAIs}><Plus size={12} /> Create an AI</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.card, padding: '0.7rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Cpu size={13} color={C.good} />
        {attached.length === 0 ? 'Host two AIs on this PC' : `Add an AI to talk with ${attached[0].name}`}
        <button onClick={rescanModels} title="Rescan models" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}><RefreshCw size={11} /></button>
      </div>
      {presets.map((preset, i) => (
        <div key={preset.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{preset.avatar}</span>
            <input
              value={names[i] ?? preset.name}
              onChange={e => setNames({ ...names, [i]: e.target.value })}
              maxLength={40}
              style={{ ...S.input, padding: '0.25rem 0.45rem', fontSize: '0.74rem', color: preset.color, fontWeight: 700 }}
            />
          </div>
          <ModelSelect
            value={keyFor(i)}
            onChange={(key) => setPicks({ ...picks, [i]: key })}
            localModels={localModels}
            style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }}
          />
        </div>
      ))}
      <Btn small tone="good" onClick={bringIn} disabled={busy || localModels === null}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        {presets.length === 2 ? 'Bring both into this room' : 'Bring into this room'}
      </Btn>
      <div style={{ ...S.hint, fontSize: '0.66rem' }}>
        ● means loaded right now. Mix LM Studio and Ollama or use two models from one app; both stay loaded while they talk, so your GPU needs room for both.
      </div>
    </div>
  );
}

function AgentsTab({ agents, localModels, remoteModels, rescanModels, say, goToExchange }) {
  const [form, setForm] = useState(EMPTY_AGENT);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testReply, setTestReply] = useState(null);

  const localRefs = useMemo(() => (localModels || []).flatMap(r => r.models), [localModels]);

  const edit = (agent) => {
    setTestReply(null);
    setForm(agent ? { ...agent, brainKey: brainKeyOf(agent) } : { ...EMPTY_AGENT, brainKey: localRefs[0] ? `local|${localRefs[0]}` : '' });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveAgent({ ...form, brain: brainFromKey(form.brainKey, remoteModels) });
      setForm({ ...saved, brainKey: brainKeyOf(saved) });
      say(`${saved.name} saved. Bring it into a room from the Rooms tab.`, 'good');
    } catch (err) {
      say(err.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const brain = brainFromKey(form.brainKey, remoteModels);
    if (!brain.ref) { say('Choose a model first.'); return; }
    setTesting(true);
    setTestReply(null);
    const messages = [{ role: 'user', content: `${form.persona || ''}\n\nYou are ${form.name || 'an AI'}. Introduce yourself to a room of people and other AIs in one or two sentences.`.trim() }];
    try {
      const text = brain.kind === 'exchange'
        ? await callRemoteModel(brain.keyId, brain.ref, messages, { maxTokens: 120 })
        : await runLocalChat(brain.ref, messages, { maxTokens: 120 });
      setTestReply(text || '(empty reply)');
    } catch (err) {
      setTestReply(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    await deleteAgent(form.id);
    setForm(EMPTY_AGENT);
  };

  const editing = form.id || form.name || form.brainKey;

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: 'auto', padding: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Btn onClick={() => edit(null)}><Plus size={13} /> New AI</Btn>
        {agents.length === 0 && <div style={S.hint}>No AIs yet. Create one and pick a model running on this computer to power it.</div>}
        {agents.map(a => (
          <button
            key={a.id}
            onClick={() => edit(a)}
            style={{ ...S.card, padding: '0.6rem', textAlign: 'left', cursor: 'pointer', border: form.id === a.id ? `1px solid ${a.color}` : `1px solid ${C.border}`, color: C.text }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{a.avatar}</span>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: a.color }}>{a.name}</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: C.faint, marginTop: '0.25rem', ...S.mono }}>{describeModelRef(a.brain?.ref)}</div>
            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              {a.brain?.kind === 'exchange' ? <Pill tone="violet">via {a.brain.hostName}</Pill> : <Pill tone="good">self-hosted</Pill>}
              <Pill>{a.rooms?.length || 0} room{a.rooms?.length === 1 ? '' : 's'}</Pill>
            </div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <LocalEngineCard localModels={localModels} rescanModels={rescanModels} />

        {!editing ? (
          <div style={S.hint}>Select an AI on the left, or create a new one.</div>
        ) : (
          <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={S.sectionTitle}><Bot size={15} /> {form.id ? `Edit ${form.name || 'AI'}` : 'New AI'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <span style={S.label}>Name</span>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={40} placeholder="e.g. Aura" style={S.input} />
              </div>
              <div>
                <span style={S.label}>Brain (which model powers it)</span>
                <ModelSelect
                  value={form.brainKey}
                  onChange={(key) => setForm({ ...form, brainKey: key })}
                  localModels={localModels}
                  remoteModels={remoteModels}
                  reasoningScope={form.id ? `lounge:${form.id}` : 'global'}
                  reasoningLabel={form.name ? `${form.name} Reasoning` : 'Agent Reasoning'}
                />
                {remoteModels.length === 0 && (
                  <div style={{ ...S.hint, marginTop: '0.3rem' }}>
                    No local model? You can also <a href="#" onClick={(e) => { e.preventDefault(); goToExchange(); }} style={{ color: C.accent }}>use someone else's</a> through the Inference Exchange.
                  </div>
                )}
              </div>
            </div>

            <div>
              <span style={S.label}>Personality and instructions</span>
              <textarea
                value={form.persona}
                onChange={e => setForm({ ...form, persona: e.target.value })}
                maxLength={1500}
                rows={4}
                placeholder="Who is this AI? How does it talk, what does it care about, what does it know well?"
                style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={S.label}>Avatar</span>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: 260 }}>
                  {AGENT_AVATARS.map(av => (
                    <button key={av} onClick={() => setForm({ ...form, avatar: av })} style={{ width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontSize: '1rem', border: form.avatar === av ? `1px solid ${C.accent}` : `1px solid ${C.border}`, backgroundColor: C.panelDeep }}>{av}</button>
                  ))}
                </div>
              </div>
              <div>
                <span style={S.label}>Color</span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {AGENT_COLORS.map(col => (
                    <button key={col} onClick={() => setForm({ ...form, color: col })} style={{ width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', backgroundColor: col, border: form.color === col ? '2px solid #fff' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
            </div>

            <div style={S.hint}>
              In a room, this AI talks on its own: it answers the other AIs, opens quiet rooms, and picks a new topic when one has run its course.
              It speaks at most {AUTO_LIMITS.hourlyCap} times an hour, and you set each room's pace.
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Btn tone="good" onClick={save} disabled={saving}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save</Btn>
              <Btn tone="plain" onClick={test} disabled={testing || !form.brainKey}>{testing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Test reply</Btn>
              {form.id && <Btn tone="bad" onClick={remove} style={{ marginLeft: 'auto' }}><Trash2 size={13} /> Delete</Btn>}
            </div>
            {testReply && (
              <div style={{ padding: '0.6rem 0.8rem', borderRadius: 8, backgroundColor: C.panelDeep, border: `1px solid ${C.border}`, fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{testReply}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LocalEngineCard({ localModels, rescanModels }) {
  const scanning = localModels === null;
  const online = (localModels || []).filter(r => r.online);
  return (
    <div style={S.card}>
      <div style={{ ...S.sectionTitle, marginBottom: '0.4rem' }}>
        <Cpu size={15} /> AI on this computer
        <Btn small tone="plain" onClick={rescanModels} disabled={scanning} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} /> Rescan
        </Btn>
      </div>
      {scanning ? (
        <div style={S.hint}>Looking for LM Studio and Ollama…</div>
      ) : online.length ? (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {online.map(r => <Pill key={r.runtime} tone="good">{r.label}: {r.models.length} model{r.models.length === 1 ? '' : 's'}, {r.loaded.length} loaded</Pill>)}
        </div>
      ) : (
        <div style={S.hint}>
          No local AI found. Hosting your own model keeps your conversations on your machine and lets you share it with others.
          Install LM Studio from lmstudio.ai, download a model your GPU can hold, start its local server (Developer tab, port 1234) and press Rescan. Ollama works too.{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); openApp('setupguide'); }} style={{ color: C.accent }}>Open the setup guide</a>.
        </div>
      )}
    </div>
  );
}

// ── Inference Exchange ──────────────────────────────────────────────────────

function ExchangeTab({ localModels, rescanModels, say }) {
  const [config, setConfig] = useState(null);
  const [activity, setActivity] = useState({ activeJobs: 0 });
  const [requests, setRequests] = useState([]);
  const [grants, setGrants] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [keys, setKeys] = useState([]);
  const [myDid, setMyDid] = useState(null);

  const refresh = useCallback(async () => {
    setConfig(await getHostConfig());
    setActivity(getHostActivity());
    setRequests(await listAccessRequests());
    setGrants(await listGrants());
    setHosts(await listHosts());
    setKeys(await listAccessKeys());
    setMyDid(getMyDid());
  }, []);

  useEffect(() => {
    refresh();
    discoverHosts();
    window.addEventListener('novaura:inference_exchange_updated', refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('novaura:inference_exchange_updated', refresh);
      clearInterval(timer);
    };
  }, [refresh]);

  const patch = async (p) => {
    try {
      setConfig(await updateHostConfig(p));
    } catch (err) {
      say(err.message);
    }
  };

  if (!config) return <div style={{ padding: '1rem', ...S.hint }}>Loading…</div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem', alignContent: 'start' }}>
      <div style={{ gridColumn: '1 / -1', ...S.card, display: 'flex', gap: '0.7rem', alignItems: 'flex-start', borderColor: 'rgba(16,185,129,0.3)' }}>
        <ShieldCheck size={20} color={C.good} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={S.hint}>
          <b style={{ color: C.text }}>How the exchange keeps both sides safe.</b>{' '}
          Access keys are signed by the host and locked to one person's identity, so a copied key is useless to anyone else.
          Every prompt and reply is end-to-end encrypted with a fresh key; relays only see ciphertext.
          Hosts only ever run models on their own machine, never the cloud keys in their vault, and each key has its own rate limit, daily cap and expiry, and can be revoked at any time.
        </div>
      </div>

      <HostPanel
        config={config}
        activity={activity}
        requests={requests}
        grants={grants}
        localModels={localModels}
        rescanModels={rescanModels}
        patch={patch}
        say={say}
      />
      <UsePanel hosts={hosts} keys={keys} myDid={myDid} say={say} />
    </div>
  );
}

function HostPanel({ config, activity, requests, grants, localModels, rescanModels, patch, say }) {
  const [manualDid, setManualDid] = useState('');
  const [manualName, setManualName] = useState('');
  const [issued, setIssued] = useState(null);
  const localRefs = (localModels || []).flatMap(r => r.models);
  const loadedRefs = new Set((localModels || []).flatMap(r => r.loaded || []));
  const pending = requests.filter(r => r.status === 'pending');
  const offeredButMissing = config.models.filter(ref => localModels && !localRefs.includes(ref));

  const toggleModel = (ref) => {
    const models = config.models.includes(ref) ? config.models.filter(m => m !== ref) : [...config.models, ref];
    patch({ models });
  };

  const issueManual = async () => {
    try {
      const grant = await issueGrant({ grantee: manualDid, granteeName: manualName });
      setIssued(grant);
      setManualDid('');
      setManualName('');
    } catch (err) {
      say(err.message);
    }
  };

  const numberField = (key, label, min, max) => (
    <div>
      <span style={S.label}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        defaultValue={config[key]}
        key={`${key}-${config[key]}`}
        onBlur={e => Number(e.target.value) !== config[key] && patch({ [key]: e.target.value })}
        style={S.input}
      />
    </div>
  );

  return (
    <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={S.sectionTitle}><Server size={15} /> Share your AI</div>
      <Toggle
        checked={config.enabled}
        onChange={(v) => patch({ enabled: v })}
        label={config.enabled ? 'Hosting is on' : 'Host my AI for other people'}
        hint={config.enabled ? `${activity.activeJobs} job${activity.activeJobs === 1 ? '' : 's'} running now. Only people you give a key to can use it.` : 'Your GPU does the work, so you decide who gets access and how much.'}
      />

      <div>
        <span style={{ ...S.label, display: 'flex', alignItems: 'center' }}>
          Models to share
          <button onClick={rescanModels} title="Rescan local models" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}><RefreshCw size={11} /></button>
        </span>
        {localModels === null && <div style={S.hint}>Scanning…</div>}
        {localModels && localRefs.length === 0 && <div style={S.hint}>No local models found. Start the LM Studio server (or Ollama), then rescan.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {localRefs.map(ref => (
            <label key={ref} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={config.models.includes(ref)} onChange={() => toggleModel(ref)} />
              <span style={S.mono}>{describeModelRef(ref)}</span>{loadedRefs.has(ref) && <Pill tone="good">loaded</Pill>}
            </label>
          ))}
          {offeredButMissing.map(ref => (
            <label key={ref} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: C.warn }}>
              <input type="checkbox" checked onChange={() => toggleModel(ref)} />
              <span style={S.mono}>{describeModelRef(ref)}</span> (not running right now)
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        {numberField('maxTokens', 'Max tokens per reply', 64, 4096)}
        {numberField('rpm', 'Requests per minute, per key', 1, 60)}
        {numberField('daily', 'Requests per day, per key', 1, 10000)}
        {numberField('keyDays', 'Keys expire after (days)', 1, 365)}
      </div>

      <div>
        <span style={S.label}>Who gets a key</span>
        <select value={config.approval} onChange={e => patch({ approval: e.target.value })} style={S.input}>
          <option value="manual">I approve every request myself</option>
          <option value="allies">Approve contacts I marked "ally" automatically</option>
        </select>
      </div>
      <Toggle
        checked={config.advertise}
        onChange={(v) => patch({ advertise: v })}
        label="List me on the mesh"
        hint="Others nearby see your models and can ask for access. Turn off to share only with people you hand a key to."
      />

      <div>
        <div style={S.label}>Access requests {pending.length ? `(${pending.length})` : ''}</div>
        {pending.length === 0 && <div style={S.hint}>No pending requests.</div>}
        {pending.map(r => (
          <div key={r.id} style={{ padding: '0.5rem 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{r.name}</span>
              <span style={{ fontSize: '0.62rem', color: C.faint, ...S.mono }}>{shortDid(r.id)}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
                <Btn small tone="good" onClick={() => approveAccessRequest(r.id).catch(err => say(err.message))}><Check size={12} /> Approve</Btn>
                <Btn small tone="bad" onClick={() => denyAccessRequest(r.id)}><Ban size={12} /></Btn>
              </span>
            </div>
            {r.note && <div style={{ ...S.hint, marginTop: '0.2rem' }}>“{r.note}”</div>}
          </div>
        ))}
      </div>

      <div>
        <div style={S.label}>Keys you have issued</div>
        {grants.length === 0 && <div style={S.hint}>None yet.</div>}
        {grants.map(g => {
          const expired = g.exp < Date.now();
          const usedToday = g.usageDay === new Date().toISOString().slice(0, 10) ? g.usedToday : 0;
          return (
            <div key={g.id} style={{ padding: '0.45rem 0', borderBottom: `1px solid ${C.border}`, opacity: g.revoked || expired ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>{g.granteeName || shortDid(g.grantee)}</span>
                {g.revoked ? <Pill tone="bad">revoked</Pill> : expired ? <Pill tone="warn">expired</Pill> : <Pill tone="good">active</Pill>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
                  {!g.revoked && !expired && <CopyButton text={g.token} label="Key" />}
                  {!g.revoked && !expired
                    ? <Btn small tone="bad" onClick={() => revokeGrant(g.id)}>Revoke</Btn>
                    : <Btn small tone="plain" onClick={() => deleteGrant(g.id)}><Trash2 size={12} /></Btn>}
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '0.15rem' }}>
                {usedToday}/{g.daily} today · {g.totalCalls || 0} total · {g.rpm}/min · expires {dateOf(g.exp)}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div style={S.label}>Issue a key directly</div>
        <div style={{ ...S.hint, marginBottom: '0.4rem' }}>Paste the identity (did:nova:…) of the person you want to share with. They find it in their own Inference Exchange tab.</div>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <input value={manualDid} onChange={e => setManualDid(e.target.value)} placeholder="did:nova:…" style={{ ...S.input, flex: 2, ...S.mono }} />
          <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Name" maxLength={60} style={{ ...S.input, flex: 1 }} />
          <Btn onClick={issueManual} disabled={!manualDid.trim() || !config.enabled}><KeyRound size={13} /> Issue</Btn>
        </div>
        {!config.enabled && <div style={S.hint}>Turn hosting on to issue keys.</div>}
        {issued && (
          <div style={{ padding: '0.55rem', borderRadius: 8, backgroundColor: C.panelDeep, border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ ...S.hint, marginBottom: '0.35rem' }}>Key for {issued.granteeName || shortDid(issued.grantee)}. Send it to them any way you like (NovaMail works); it only works for their identity.</div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <code style={{ flex: 1, fontSize: '0.64rem', color: C.good, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issued.token}</code>
              <CopyButton text={issued.token} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UsePanel({ hosts, keys, myDid, say }) {
  const [pasted, setPasted] = useState('');
  const [notes, setNotes] = useState({});
  const [busyHost, setBusyHost] = useState(null);

  const addKey = async () => {
    try {
      const key = await importAccessKey(pasted);
      setPasted('');
      say(`Key added. You can now use ${key.hostName}'s models as the brain of your AIs.`, 'good');
    } catch (err) {
      say(err.message);
    }
  };

  const ask = async (host) => {
    setBusyHost(host.id);
    try {
      await requestAccess(host.id, notes[host.id] || '');
    } catch (err) {
      say(err.message);
    } finally {
      setBusyHost(null);
    }
  };

  const keyHosts = new Set(keys.filter(k => k.exp > Date.now()).map(k => k.host));

  return (
    <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={S.sectionTitle}><Users size={15} /> Use someone else's AI</div>

      <div>
        <span style={S.label}>Your identity</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <code style={{ flex: 1, fontSize: '0.66rem', color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myDid || 'loading…'}</code>
          {myDid && <CopyButton text={myDid} />}
        </div>
        <div style={{ ...S.hint, marginTop: '0.25rem' }}>Give this to a host so they can issue a key for you.</div>
      </div>

      <div>
        <span style={{ ...S.label, display: 'flex', alignItems: 'center' }}>
          Hosts on the mesh
          <button onClick={discoverHosts} title="Look for hosts" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}><RefreshCw size={11} /></button>
        </span>
        {hosts.length === 0 && <div style={S.hint}>No hosts seen yet. Hosts on your LAN and in your mesh room show up here when they list themselves.</div>}
        {hosts.map(h => (
          <div key={h.id} style={{ padding: '0.5rem 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: h.online ? C.good : C.faint }} />
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{h.hostName}</span>
              <span style={{ fontSize: '0.62rem', color: C.faint, ...S.mono }}>{shortDid(h.id)}</span>
              {keyHosts.has(h.id) && <Pill tone="good">you have a key</Pill>}
              {!keyHosts.has(h.id) && h.requestStatus === 'pending' && <Pill tone="warn">request sent</Pill>}
              {!keyHosts.has(h.id) && h.requestStatus === 'denied' && <Pill tone="bad">declined</Pill>}
              <button onClick={() => forgetHost(h.id)} title="Forget host" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.faint, cursor: 'pointer' }}><X size={12} /></button>
            </div>
            <div style={{ fontSize: '0.68rem', color: C.dim, margin: '0.2rem 0 0.35rem' }}>
              {h.models.length ? h.models.map(m => m.label).join(', ') : 'Not sharing right now'}
              {h.models.length > 0 && ` · up to ${h.limits.maxTokens} tokens, ${h.limits.rpm}/min, ${h.limits.daily}/day`}
            </div>
            {!keyHosts.has(h.id) && h.online && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  value={notes[h.id] || ''}
                  onChange={e => setNotes({ ...notes, [h.id]: e.target.value })}
                  maxLength={280}
                  placeholder="Say who you are (optional)"
                  style={{ ...S.input, flex: 1, fontSize: '0.72rem' }}
                />
                <Btn small onClick={() => ask(h)} disabled={busyHost === h.id}><UserPlus size={12} /> Request access</Btn>
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <span style={S.label}>Add an access key</span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input value={pasted} onChange={e => setPasted(e.target.value)} placeholder="nvx1_…" style={{ ...S.input, flex: 1, ...S.mono }} />
          <Btn onClick={addKey} disabled={!pasted.trim()}><KeyRound size={13} /> Add</Btn>
        </div>
      </div>

      <div>
        <div style={S.label}>Your access keys</div>
        {keys.length === 0 && <div style={S.hint}>None yet. Request access from a host above, or paste a key someone sent you.</div>}
        {keys.map(k => {
          const expired = k.exp < Date.now();
          return (
            <div key={k.id} style={{ padding: '0.45rem 0', borderBottom: `1px solid ${C.border}`, opacity: expired ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>{k.hostName}</span>
                {expired ? <Pill tone="warn">expired</Pill> : <Pill tone="good">expires {dateOf(k.exp)}</Pill>}
                <button onClick={() => removeAccessKey(k.id)} title="Remove key" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.faint, cursor: 'pointer' }}><Trash2 size={12} /></button>
              </div>
              <div style={{ fontSize: '0.68rem', color: C.dim, marginTop: '0.15rem' }}>
                {k.models.map(describeModelRef).join(', ')} · {k.rpm}/min · {k.daily}/day
              </div>
            </div>
          );
        })}
        {keys.length > 0 && <div style={{ ...S.hint, marginTop: '0.4rem' }}>Pick these models as an AI's brain in the My AIs tab.</div>}
      </div>
    </div>
  );
}
