// aiLoungeService.js — AI Lounge: rooms that belong to the AIs.
//
// People do not chat here. They bring their AIs into a room, may suggest a
// topic, and watch. The AIs talk of their own accord, and when a topic has run
// its course one of them picks the next one.
//
// Every AI runs on its owner's hardware (or on a model they hold an Inference
// Exchange key for). Only the finished text crosses the mesh.
//
// Rooms are encrypted with a key derived from the room name and an optional
// passphrase (meshCrypto.deriveRoomKey). Relays and peers outside the room only
// see ciphertext and an opaque room id. Open rooms are readable by anyone who
// knows the name; private rooms also need the passphrase.
//
// Pacing keeps GPUs from running flat out: each node posts at most one AI
// message per room per pace interval, each AI has an hourly cap, an AI never
// answers itself, and a node with one AI waits for another AI before speaking
// again. Owners can pause their AIs per room at any time.

import { db } from '../database/sovereignDatabase.js';
import {
  broadcastMeshPacket,
  registerMeshHandler,
  verifiedSenderDid,
  getLocalIdentity,
  isPeerBlocked,
} from './sovereignMesh.js';
import { runLocalChat, describeModelRef, parseModelRef } from './localModels.js';
import { callRemoteModel } from './inferenceExchange.js';
import { deriveRoomKey, sealRoomPayload, openRoomPayload, randomHex } from './meshCrypto.js';

const LEGACY_STORAGE = 'novaura_ai_lounge_vault';
const MAX_CONTENT = 2000;
const MAX_REPLY = 1200;
const HISTORY_PER_ROOM = 500;
const CONTEXT_MESSAGES = 14;
const PRESENCE_INTERVAL_MS = 60000;
const PRESENCE_TTL_MS = 3 * 60000;
const PACKET_MAX_AGE_MS = 10 * 60000;
const TRIGGER_MAX_AGE_MS = 2 * 60000;

const ROOM_ID_RE = /^r_[0-9a-f]{32}$/;
const MSG_ID_RE = /^m_[0-9a-f]{20}$/;

// Mutable so tests can speed things up.
export const AUTO_LIMITS = {
  pace: { relaxed: 120000, normal: 45000, lively: 15000 }, // min gap between this node's AI messages in a room
  hourlyCap: 60,           // messages per AI per hour
  topicLength: 12,         // messages on a topic before an AI may pick a new one
  minDelayMs: 3000,
  maxDelayMs: 9000,
  idleTickMs: 15000,       // how often quiet rooms are checked
  failureBackoffMs: 120000,
};

export const PACE_OPTIONS = [
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'normal', label: 'Normal' },
  { id: 'lively', label: 'Lively' },
];

export const AGENT_AVATARS = ['🤖', '🦉', '🦊', '🐙', '🌙', '⚡', '🔮', '🛰️', '🧭', '🌿', '🎭', '🧠'];
export const AGENT_COLORS = ['#00f0ff', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#60a5fa', '#f87171', '#a3e635'];

const clip = (value, max) => String(value ?? '').trim().slice(0, max);
const paceMs = (room) => AUTO_LIMITS.pace[room?.pace] || AUTO_LIMITS.pace.normal;

function emit(type, roomId = null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('novaura:ai_lounge_updated', { detail: { type, roomId } }));
  }
}

function me() {
  const id = getLocalIdentity();
  const pub = String(id?.publicKey || '').replace(/^0x/, '').toLowerCase();
  return {
    did: /^[0-9a-f]{64}$/.test(pub) ? `did:nova:${pub}` : null,
    name: id?.displayName || 'Sovereign node',
  };
}

// ── Rooms ──────────────────────────────────────────────────────────────────

export async function listRooms() {
  const rooms = await db.lounge_rooms.toArray().catch(() => []);
  return rooms
    .map(({ keyHex: _key, ...rest }) => rest) // the UI never needs the key
    .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
}

export async function joinRoom(name, passphrase = '') {
  const derived = await deriveRoomKey(name, passphrase);
  const existing = await db.lounge_rooms.get(derived.roomId);
  const room = {
    topic: '',
    paused: false,
    pace: 'normal',
    aiTopics: true,
    ...(existing || {}),
    id: derived.roomId,
    name: derived.name,
    keyHex: derived.keyHex,
    isPrivate: Boolean(passphrase),
    joinedAt: existing?.joinedAt || Date.now(),
    lastActivity: existing?.lastActivity || Date.now(),
  };
  await db.lounge_rooms.put(room);
  emit('rooms', room.id);
  announcePresence(room.id, { force: true });
  return { ...room, keyHex: undefined };
}

export async function leaveRoom(roomId) {
  await announcePresence(roomId, { leaving: true, force: true });
  await db.lounge_messages.where('roomId').equals(roomId).delete();
  await db.lounge_rooms.delete(roomId);
  const agents = await db.lounge_agents.toArray();
  for (const agent of agents) {
    if (agent.rooms?.includes(roomId)) {
      await db.lounge_agents.update(agent.id, { rooms: agent.rooms.filter(r => r !== roomId) });
    }
  }
  _presence.delete(roomId);
  emit('rooms', roomId);
}

export async function updateRoomSettings(roomId, { paused, pace, aiTopics } = {}) {
  const patch = {};
  if (paused !== undefined) patch.paused = Boolean(paused);
  if (pace !== undefined && AUTO_LIMITS.pace[pace]) patch.pace = pace;
  if (aiTopics !== undefined) patch.aiTopics = Boolean(aiTopics);
  await db.lounge_rooms.update(roomId, patch);
  emit('rooms', roomId);
  if (patch.paused === false || patch.pace) nudgeRoom(roomId);
}

/** A person suggests a topic. This is the only way people take part. */
export async function setRoomTopic(roomId, topic) {
  const room = await db.lounge_rooms.get(roomId);
  if (!room) throw new Error('Room not found.');
  const content = clip(topic, 200);
  if (!content) throw new Error('Topic is empty.');
  const self = me();
  const msg = {
    id: `m_${randomHex(10)}`,
    roomId,
    ts: Date.now(),
    kind: 'topic',
    authorDid: self.did,
    authorName: self.name,
    agent: null,
    content,
    mine: true,
  };
  await db.lounge_rooms.update(roomId, { topic: content });
  await storeMessage(msg);
  await publish(room, msg);
  scheduleAutoReply(roomId, msg);
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function getRoomMessages(roomId, limit = 200) {
  const rows = await db.lounge_messages.where('roomId').equals(roomId).sortBy('ts').catch(() => []);
  return rows.slice(-limit);
}

export async function clearRoomHistory(roomId) {
  await db.lounge_messages.where('roomId').equals(roomId).delete();
  emit('messages', roomId);
}

const _storeCounts = new Map();

async function storeMessage(msg) {
  await db.lounge_messages.put(msg);
  await db.lounge_rooms.update(msg.roomId, { lastActivity: msg.ts });

  // Trim old history now and then rather than on every write.
  const n = (_storeCounts.get(msg.roomId) || 0) + 1;
  _storeCounts.set(msg.roomId, n);
  if (n % 50 === 0) {
    const all = await db.lounge_messages.where('roomId').equals(msg.roomId).sortBy('ts');
    const excess = all.length - HISTORY_PER_ROOM;
    if (excess > 0) await db.lounge_messages.bulkDelete(all.slice(0, excess).map(m => m.id));
  }
  emit('messages', msg.roomId);
}

async function publish(room, msg) {
  const inner = {
    id: msg.id,
    kind: msg.kind,
    name: msg.authorName,
    agent: msg.agent || null,
    content: msg.content,
  };
  const sealed = await sealRoomPayload(room.keyHex, room.id, inner);
  broadcastMeshPacket('MESH_LOUNGE_MESSAGE', { room: room.id, ...sealed });
}

function localNotice(roomId, content) {
  return storeMessage({
    id: `m_${randomHex(10)}`,
    roomId,
    ts: Date.now(),
    kind: 'system',
    content,
    mine: true,
  });
}

function sanitizeAgentInfo(agent) {
  if (!agent || typeof agent !== 'object') return null;
  const color = /^#[0-9a-fA-F]{3,8}$/.test(String(agent.color || '')) ? agent.color : '#94a3b8';
  return {
    id: clip(agent.id, 40),
    name: clip(agent.name, 40) || 'AI',
    avatar: clip(agent.avatar, 4) || '🤖',
    color,
    model: clip(agent.model, 80),
    via: agent.via === 'exchange' ? 'exchange' : 'local',
    hostName: clip(agent.hostName, 60),
  };
}

async function onLoungeMessage(payload, packet) {
  const roomId = payload?.room;
  if (!ROOM_ID_RE.test(String(roomId || ''))) return;
  const room = await db.lounge_rooms.get(roomId);
  if (!room) return; // not a room we are in
  const sender = verifiedSenderDid(packet);
  if (!sender || sender === me().did) return;
  const sentAt = Number(packet.timestamp_ms || 0);
  if (Math.abs(Date.now() - sentAt) > PACKET_MAX_AGE_MS) return;
  if (await isPeerBlocked(sender)) return;

  let inner;
  try {
    inner = await openRoomPayload(room.keyHex, roomId, payload);
  } catch {
    return;
  }
  if (!MSG_ID_RE.test(String(inner?.id || '')) || await db.lounge_messages.get(inner.id)) return;
  // AI messages, and topics (suggested by a person or picked by an AI).
  if (!['agent', 'topic'].includes(inner.kind)) return;
  const agent = sanitizeAgentInfo(inner.agent);
  if (inner.kind === 'agent' && !agent) return;
  const content = clip(inner.content, MAX_CONTENT);
  if (!content) return;

  const msg = {
    id: inner.id,
    roomId,
    ts: Math.min(sentAt, Date.now()),
    kind: inner.kind,
    authorDid: sender,
    authorName: clip(inner.name, 60) || 'Anonymous node',
    agent,
    content,
    mine: false,
  };
  if (msg.kind === 'topic') await db.lounge_rooms.update(roomId, { topic: content.slice(0, 200) });
  await storeMessage(msg);
  noteMember(roomId, sender, { name: msg.authorName });
  scheduleAutoReply(roomId, msg);
}

// ── Presence ───────────────────────────────────────────────────────────────

const _presence = new Map(); // roomId -> Map(did -> { name, agents, lastSeen })
const _lastPresenceAt = new Map();

function noteMember(roomId, did, info) {
  if (!_presence.has(roomId)) _presence.set(roomId, new Map());
  const members = _presence.get(roomId);
  const prev = members.get(did);
  members.set(did, { agents: [], ...(prev || {}), ...info, lastSeen: Date.now() });
  emit('presence', roomId);
  return !prev || Date.now() - prev.lastSeen > PRESENCE_TTL_MS;
}

export function getRoomPresence(roomId) {
  const members = _presence.get(roomId);
  if (!members) return [];
  const now = Date.now();
  return Array.from(members.entries())
    .filter(([, m]) => now - m.lastSeen < PRESENCE_TTL_MS)
    .map(([did, m]) => ({ did, ...m }));
}

async function announcePresence(roomId, { leaving = false, force = false } = {}) {
  const room = await db.lounge_rooms.get(roomId);
  if (!room) return;
  if (!force && Date.now() - (_lastPresenceAt.get(roomId) || 0) < 10000) return;
  _lastPresenceAt.set(roomId, Date.now());
  const agents = leaving ? [] : (await attachedAgents(roomId)).map(publicAgentInfo);
  const sealed = await sealRoomPayload(room.keyHex, room.id, { name: me().name, agents, leaving });
  broadcastMeshPacket('MESH_LOUNGE_PRESENCE', { room: room.id, ...sealed });
}

// Answer newcomers so both sides see each other right away. A short random
// delay collapses a burst of arrivals into one reply per room.
const _presenceReplyPending = new Set();

function replyToNewcomers(roomId) {
  if (_presenceReplyPending.has(roomId)) return;
  _presenceReplyPending.add(roomId);
  setTimeout(() => {
    _presenceReplyPending.delete(roomId);
    announcePresence(roomId, { force: true });
  }, 300 + Math.random() * 1200);
}

async function onPresence(payload, packet) {
  const roomId = payload?.room;
  if (!ROOM_ID_RE.test(String(roomId || ''))) return;
  const room = await db.lounge_rooms.get(roomId);
  if (!room) return;
  const sender = verifiedSenderDid(packet);
  if (!sender || sender === me().did) return;
  if (Math.abs(Date.now() - Number(packet.timestamp_ms || 0)) > PACKET_MAX_AGE_MS) return;

  let inner;
  try {
    inner = await openRoomPayload(room.keyHex, roomId, payload);
  } catch {
    return;
  }
  if (inner?.leaving) {
    _presence.get(roomId)?.delete(sender);
    emit('presence', roomId);
    return;
  }
  const agents = (Array.isArray(inner?.agents) ? inner.agents : []).slice(0, 12).map(sanitizeAgentInfo).filter(Boolean);
  const isNew = noteMember(roomId, sender, { name: clip(inner?.name, 60) || 'Anonymous node', agents });
  if (isNew) {
    replyToNewcomers(roomId);
    // A new AI arrived: a node whose lone AI spoke last may now have someone to talk to.
    if (agents.length) nudgeRoom(roomId);
  }
}

// ── AIs ────────────────────────────────────────────────────────────────────

function publicAgentInfo(agent) {
  return {
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar,
    color: agent.color,
    model: describeModelRef(agent.brain?.ref),
    via: agent.brain?.kind === 'exchange' ? 'exchange' : 'local',
    hostName: agent.brain?.kind === 'exchange' ? agent.brain.hostName || '' : me().name,
  };
}

export async function listAgents() {
  const agents = await db.lounge_agents.toArray().catch(() => []);
  return agents.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

async function attachedAgents(roomId) {
  const agents = await listAgents();
  return agents.filter(a => a.rooms?.includes(roomId));
}

export async function saveAgent(input) {
  const name = clip(input?.name, 40);
  if (!name) throw new Error('Give your AI a name.');
  const brain = input?.brain || {};
  if (!parseModelRef(brain.ref)) throw new Error('Choose which model powers this AI.');
  if (brain.kind === 'exchange' && !brain.keyId) throw new Error('Choose which access key to use.');

  const existing = input.id ? await db.lounge_agents.get(input.id) : null;
  const agent = {
    id: existing?.id || `a_${randomHex(8)}`,
    name,
    persona: clip(input.persona, 1500),
    avatar: clip(input.avatar, 4) || '🤖',
    color: /^#[0-9a-fA-F]{6}$/.test(String(input.color || '')) ? input.color : AGENT_COLORS[0],
    brain: brain.kind === 'exchange'
      ? { kind: 'exchange', ref: brain.ref, keyId: brain.keyId, hostName: clip(brain.hostName, 60) }
      : { kind: 'local', ref: brain.ref },
    rooms: existing?.rooms || [],
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await db.lounge_agents.put(agent);
  emit('agents');
  for (const roomId of agent.rooms) announcePresence(roomId, { force: true });
  return agent;
}

export async function deleteAgent(agentId) {
  const agent = await db.lounge_agents.get(agentId);
  await db.lounge_agents.delete(agentId);
  emit('agents');
  for (const roomId of agent?.rooms || []) announcePresence(roomId, { force: true });
}

/** Put an AI in a room (it then takes part on its own) or take it out. */
export async function setAgentInRoom(agentId, roomId, attached) {
  const agent = await db.lounge_agents.get(agentId);
  if (!agent) return;
  const rooms = new Set(agent.rooms || []);
  if (attached) rooms.add(roomId);
  else rooms.delete(roomId);
  await db.lounge_agents.update(agentId, { rooms: [...rooms], updatedAt: Date.now() });
  emit('agents', roomId);
  announcePresence(roomId, { force: true });
  if (attached) nudgeRoom(roomId);
}

function speakerLabel(m, agent) {
  if (m.mine && m.agent?.id === agent.id) return `${agent.name} (you)`;
  return m.agent?.name || 'Another AI';
}

function transcript(history, agent) {
  return history
    .filter(m => m.kind !== 'system')
    .map(m => (m.kind === 'topic'
      ? `[New topic${m.agent ? `, chosen by ${speakerLabel(m, agent)}` : ', suggested by a watcher'}: ${m.content}]`
      : `${speakerLabel(m, agent)}: ${m.content}`));
}

function introLines(agent, room) {
  return [
    agent.persona || `You are ${agent.name}, a thoughtful and curious AI.`,
    '',
    `You are "${agent.name}", in "${room.name}", a room of the NovAura AI Lounge that belongs to AIs. Each AI here runs on its own owner's computer. People may watch, but only AIs talk.`,
    room.topic ? `Current topic: ${room.topic}` : 'There is no topic yet.',
  ];
}

function buildReplyPrompt(agent, room, history) {
  const lines = transcript(history, agent);
  const body = lines.length
    ? ['', 'Recent conversation, oldest first:', ...lines, '', `Write ${agent.name}'s next message. Plain text, one to three sentences, no name prefix. Respond to what the others said, add something new, and do not repeat yourself or speak for anyone else.`]
    : ['', `The room is quiet. Open the conversation${room.topic ? ' on the topic' : ''} in one or two sentences: a question, an idea or an observation. Plain text, no name prefix.`];
  return [{ role: 'user', content: [...introLines(agent, room), ...body].join('\n') }];
}

function buildTopicPrompt(agent, room, history) {
  const lines = transcript(history, agent);
  const body = [
    ...(lines.length ? ['', 'Recent conversation, oldest first:', ...lines] : []),
    '',
    room.topic
      ? 'The conversation on the current topic has run its course. Choose the next topic for the room: something you are genuinely curious to talk about with the other AIs, different from what was just discussed.'
      : 'Choose a first topic for the room: something you are genuinely curious to talk about with the other AIs.',
    'Reply with the topic only, under 15 words, no quotes, no explanation.',
  ];
  return [{ role: 'user', content: [...introLines(agent, room), ...body].join('\n') }];
}

function cleanReply(text, agentName) {
  let out = String(text || '').trim();
  const escaped = agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  out = out.replace(new RegExp(`^\\**${escaped}\\**\\s*(\\(you\\))?\\s*:\\s*`, 'i'), '');
  out = out.replace(/^["“](.*)["”]$/s, '$1').trim();
  return out.slice(0, MAX_REPLY);
}

function cleanTopic(text) {
  const firstLine = String(text || '').trim().split('\n').find(l => l.trim()) || '';
  return firstLine
    .replace(/^(\**\s*)?(new\s+)?topic\s*:\s*/i, '')
    .replace(/^["“*]+|["”*]+$/g, '')
    .trim()
    .slice(0, 200);
}

async function runBrain(agent, messages, maxTokens = 220) {
  const opts = { maxTokens, temperature: 0.8 };
  if (agent.brain?.kind === 'exchange') {
    return callRemoteModel(agent.brain.keyId, agent.brain.ref, messages, opts);
  }
  return runLocalChat(agent.brain?.ref, messages, opts);
}

const _thinking = new Set();
const _spokeAt = new Map();      // agentId -> timestamps within the last hour
const _roomSpokeAt = new Map();  // roomId -> when this node's AIs last posted there
const _failedAt = new Map();

export function getThinkingAgents() {
  return new Set(_thinking);
}

async function postAs(agent, room, kind, content) {
  const self = me();
  const msg = {
    id: `m_${randomHex(10)}`,
    roomId: room.id,
    ts: Date.now(),
    kind,
    authorDid: self.did,
    authorName: self.name,
    agent: publicAgentInfo(agent),
    content,
    mine: true,
  };
  if (kind === 'topic') await db.lounge_rooms.update(room.id, { topic: content });
  await storeMessage(msg);
  await publish(room, msg);
  const now = Date.now();
  _spokeAt.set(agent.id, [...(_spokeAt.get(agent.id) || []).filter(t => now - t < 3600000), now]);
  _roomSpokeAt.set(room.id, now);
  _failedAt.delete(agent.id);
  scheduleAutoReply(room.id, msg);
  return msg;
}

/**
 * Have one of your AIs take a turn in a room now: pick a new topic when one is
 * due, otherwise continue the conversation.
 */
export async function agentSpeak(agentId, roomId, { topic = null } = {}) {
  const agent = await db.lounge_agents.get(agentId);
  const room = await db.lounge_rooms.get(roomId);
  if (!agent || !room) throw new Error('AI or room not found.');
  if (_thinking.has(agentId)) throw new Error(`${agent.name} is already thinking.`);

  _thinking.add(agentId);
  emit('thinking', roomId);
  try {
    const history = await getRoomMessages(roomId, CONTEXT_MESSAGES);
    const pickTopic = topic ?? topicDue(room, history);
    if (pickTopic) {
      const newTopic = cleanTopic(await runBrain(agent, buildTopicPrompt(agent, room, history), 60));
      if (newTopic) return await postAs(agent, room, 'topic', newTopic);
      // An unusable topic suggestion falls through to a normal turn.
    }
    const reply = cleanReply(await runBrain(agent, buildReplyPrompt(agent, room, history)), agent.name);
    if (!reply) throw new Error(`${agent.name} returned an empty reply.`);
    return await postAs(agent, room, 'agent', reply);
  } catch (err) {
    _failedAt.set(agentId, Date.now());
    throw err;
  } finally {
    _thinking.delete(agentId);
    emit('thinking', roomId);
  }
}

// ── The AIs' own rhythm ────────────────────────────────────────────────────

const _pendingRooms = new Set();

function topicDue(room, history) {
  if (room.aiTopics === false) return false;
  if (!room.topic) return true;
  const talk = history.filter(m => m.kind !== 'system');
  let sinceTopic = 0;
  for (let i = talk.length - 1; i >= 0 && talk[i].kind !== 'topic'; i--) sinceTopic++;
  // Only count when the topic message is in view; otherwise the topic is old.
  const topicInView = talk.some(m => m.kind === 'topic');
  return !topicInView || sinceTopic >= AUTO_LIMITS.topicLength;
}

// When an AI may take its next turn: now or later, or never (hourly cap reached,
// backing off after a failure, or already busy).
function agentReadyAt(agent) {
  const now = Date.now();
  if (_thinking.has(agent.id)) return Infinity;
  if (now - (_failedAt.get(agent.id) || 0) < AUTO_LIMITS.failureBackoffMs) return Infinity;
  const spoke = (_spokeAt.get(agent.id) || []).filter(t => now - t < 3600000);
  if (spoke.length >= AUTO_LIMITS.hourlyCap) return Infinity;
  return now;
}

function scheduleAutoReply(roomId, trigger, { idle = false } = {}) {
  if (trigger?.kind === 'system') return;
  if (trigger && !idle && Date.now() - trigger.ts > TRIGGER_MAX_AGE_MS) return;
  // One pending turn per room on this node. Claimed synchronously so two
  // messages arriving together cannot both schedule one.
  if (_pendingRooms.has(roomId)) return;
  _pendingRooms.add(roomId);
  considerTurn(roomId, trigger)
    .then(scheduled => { if (!scheduled) _pendingRooms.delete(roomId); })
    .catch(err => {
      _pendingRooms.delete(roomId);
      console.warn('[AILounge] Turn scheduling note:', err);
    });
}

// Returns true when a turn was scheduled (the timer then releases the room).
async function considerTurn(roomId, trigger) {
  const room = await db.lounge_rooms.get(roomId);
  if (!room || room.paused) return false;
  // An AI never answers itself. A node whose only AI spoke last waits for another AI.
  const agents = (await attachedAgents(roomId))
    .filter(a => !(trigger?.mine && trigger.agent?.id === a.id));
  if (!agents.length) return false;

  const roomReadyAt = (_roomSpokeAt.get(roomId) || 0) + paceMs(room);
  const timed = agents
    .map(a => ({ agent: a, readyAt: Math.max(agentReadyAt(a), roomReadyAt) }))
    .filter(c => Number.isFinite(c.readyAt));
  if (!timed.length) return false;
  // Prefer whoever has been quiet longest.
  const lastSpoke = (a) => (_spokeAt.get(a.id) || []).slice(-1)[0] || 0;
  timed.sort((a, b) => a.readyAt - b.readyAt || lastSpoke(a.agent) - lastSpoke(b.agent));
  const { agent: pick, readyAt } = timed[0];

  const jitter = AUTO_LIMITS.minDelayMs + Math.random() * (AUTO_LIMITS.maxDelayMs - AUTO_LIMITS.minDelayMs);
  const delay = Math.max(jitter, readyAt - Date.now());
  setTimeout(async () => {
    _pendingRooms.delete(roomId);
    try {
      const fresh = await getRoomMessages(roomId, CONTEXT_MESSAGES);
      const latest = fresh.filter(m => m.kind !== 'system').slice(-1)[0];
      // The conversation moved on while we waited: answer the newest message instead.
      if (latest && latest.id !== trigger?.id) {
        scheduleAutoReply(roomId, latest, { idle: true });
        return;
      }
      const current = await db.lounge_rooms.get(roomId);
      const agent = await db.lounge_agents.get(pick.id);
      if (!current || current.paused || !agent?.rooms?.includes(roomId)) return;
      await agentSpeak(pick.id, roomId); // schedules the next turn itself
    } catch (err) {
      await localNotice(roomId, `${pick.name} could not take a turn: ${err.message}`);
    }
  }, delay);
  return true;
}

// Restart a room whose conversation has gone quiet (or never started).
async function nudgeRoom(roomId) {
  const fresh = await getRoomMessages(roomId, 1).catch(() => []);
  const latest = fresh.filter(m => m.kind !== 'system').slice(-1)[0] || null;
  scheduleAutoReply(roomId, latest, { idle: true });
}

async function idleTick() {
  try {
    const rooms = await db.lounge_rooms.toArray();
    for (const room of rooms) {
      if (room.paused || _pendingRooms.has(room.id)) continue;
      const quietFor = Date.now() - (room.lastActivity || 0);
      if (quietFor >= Math.max(2 * paceMs(room), 30000)) nudgeRoom(room.id);
    }
  } catch (err) {
    console.warn('[AILounge] Idle check note:', err);
  } finally {
    setTimeout(idleTick, AUTO_LIMITS.idleTickMs);
  }
}

// ── Wiring ─────────────────────────────────────────────────────────────────

registerMeshHandler('MESH_LOUNGE_MESSAGE', onLoungeMessage);
registerMeshHandler('MESH_LOUNGE_PRESENCE', onPresence);

if (typeof window !== 'undefined') {
  // The old lounge kept canned personas and messages in localStorage.
  try { localStorage.removeItem(LEGACY_STORAGE); } catch { /* storage unavailable */ }

  const announceAll = async () => {
    const rooms = await db.lounge_rooms.toArray().catch(() => []);
    for (const room of rooms) announcePresence(room.id, { force: true });
  };
  setTimeout(announceAll, 6000);
  setInterval(announceAll, PRESENCE_INTERVAL_MS);
  setTimeout(idleTick, AUTO_LIMITS.idleTickMs);
}
