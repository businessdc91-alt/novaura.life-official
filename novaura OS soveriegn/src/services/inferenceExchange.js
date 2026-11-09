// inferenceExchange.js — Decentralized inference over the Sovereign Mesh.
//
// Hosts share models running on their own machine. Other people use them with
// an access key the host issued to their identity. No server is involved:
// offers, requests, keys and jobs all travel as signed mesh packets.
//
// What a host is protected by
//   - Keys are signed by the host and bound to one grantee DID (see meshCrypto).
//     Calls are only honoured from packets signed by that DID.
//   - Per-key requests/minute, daily cap, token cap, expiry and revocation.
//   - One job per key at a time, a global concurrency cap, request size limits,
//     replay protection (job ids are single use, packets older than 5 min dropped).
//   - Only local models on 127.0.0.1 are ever run. Cloud keys in the vault are
//     never used on anyone else's behalf.
//
// What a caller is protected by
//   - Prompts and replies are end-to-end encrypted per job; the relay and other
//     peers only see ciphertext.
//   - Replies are only accepted from the host the key names.

import { db } from '../database/sovereignDatabase.js';
import {
  broadcastMeshPacket,
  sendDirectMeshPacket,
  registerMeshHandler,
  verifiedSenderDid,
  getLocalIdentity,
  getMeshNodeId,
  dispatchMeshToast,
  isPeerBlocked,
  isAllyContact,
  senderNode,
  meshNodeIdFor,
} from './sovereignMesh.js';
import { runLocalChat, describeModelRef, parseModelRef } from './localModels.js';
import {
  didToPub,
  randomHex,
  signGrant,
  encodeAccessKey,
  decodeAccessKey,
  sealInferenceCall,
  openInferenceCall,
} from './meshCrypto.js';

const HOST_SETTINGS_KEY = 'inference_exchange_host';
const OFFER_INTERVAL_MS = 120000;
const HOST_ONLINE_WINDOW_MS = 6 * 60000;
const PACKET_MAX_AGE_MS = 5 * 60000;
const MAX_MESSAGES = 40;
const MAX_PROMPT_CHARS = 1_000_000; // long-context prompts; hosts cap tokens per key
const MAX_CONCURRENT_JOBS = 2;
const DEFAULT_CALL_TIMEOUT_MS = 120000;

// Answers go to the node of the key that signed the packet (a node's ID comes
// from its key), never to a node the packet names: nobody can aim offers,
// replies or results at someone else's node.
const JOB_ID_RE = /^job_[0-9a-f]{24}$/;
const GRANT_ID_RE = /^g_[0-9a-f]{24}$/;

export const DEFAULT_HOST_CONFIG = {
  enabled: false,
  advertise: true,
  models: [],          // model refs offered, e.g. "ollama:gemma3:12b"
  maxTokens: 800,
  rpm: 6,
  daily: 200,
  approval: 'manual',  // 'manual' | 'allies' (auto-approve contacts marked ally)
  keyDays: 30,
};

const HOST_ERRORS = {
  NOT_HOSTING: 'This host has stopped sharing their AI.',
  NO_ACCESS: 'This host does not recognise your access key.',
  REVOKED: 'The host revoked your access key.',
  EXPIRED: 'Your access key has expired.',
  RATE_LIMITED: 'Too many requests for this key. Wait a minute and try again.',
  DAILY_LIMIT: 'This key has used its daily allowance.',
  BUSY: 'The host is busy with other jobs. Try again shortly.',
  BAD_REQUEST: 'The host rejected the request as too large or malformed.',
  MODEL_UNAVAILABLE: 'The host no longer offers that model.',
  INFERENCE_FAILED: "The host's model failed to answer.",
};

const clampInt = (value, min, max) => Math.min(max, Math.max(min, Math.round(Number(value) || min)));
const isFresh = (packet) => Math.abs(Date.now() - Number(packet?.timestamp_ms || 0)) < PACKET_MAX_AGE_MS;
const today = () => new Date().toISOString().slice(0, 10);

function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('novaura:inference_exchange_updated'));
  }
}

function myIdentity() {
  const id = getLocalIdentity();
  const pub = String(id?.publicKey || '').replace(/^0x/, '').toLowerCase();
  if (!id?.secretKeyHex || !/^[0-9a-f]{64}$/.test(pub)) return null;
  return { did: `did:nova:${pub}`, secret: id.secretKeyHex, name: id.displayName || 'Sovereign node' };
}

export function getMyDid() {
  return myIdentity()?.did || null;
}

// ── Host configuration ─────────────────────────────────────────────────────

let _hostConfig = { ...DEFAULT_HOST_CONFIG };
let _hostLoaded = null;

function loadHost() {
  if (!_hostLoaded) {
    _hostLoaded = db.getSetting(HOST_SETTINGS_KEY, null)
      .then(saved => { if (saved) _hostConfig = { ...DEFAULT_HOST_CONFIG, ...saved }; })
      .catch(() => {});
  }
  return _hostLoaded;
}

export async function getHostConfig() {
  await loadHost();
  return { ..._hostConfig, models: [..._hostConfig.models] };
}

export async function updateHostConfig(patch) {
  await loadHost();
  const wasLive = _hostConfig.enabled && _hostConfig.advertise;
  const next = { ..._hostConfig, ...patch };
  next.enabled = Boolean(next.enabled);
  next.advertise = Boolean(next.advertise);
  next.models = [...new Set((next.models || []).filter(ref => parseModelRef(ref)))].slice(0, 12);
  next.maxTokens = clampInt(next.maxTokens, 64, 4096);
  next.rpm = clampInt(next.rpm, 1, 60);
  next.daily = clampInt(next.daily, 1, 10000);
  next.keyDays = clampInt(next.keyDays, 1, 365);
  next.approval = next.approval === 'allies' ? 'allies' : 'manual';
  _hostConfig = next;
  await db.setSetting(HOST_SETTINGS_KEY, next);
  emitChange();

  const isLive = next.enabled && next.advertise && next.models.length > 0;
  if (isLive || wasLive) announceOffer(true); // an offer with no models withdraws the listing
  return getHostConfig();
}

export function getHostActivity() {
  return { activeJobs: _activeJobs };
}

// ── Offers and discovery ───────────────────────────────────────────────────

let _lastOfferAt = 0;

export async function announceOffer(force = false) {
  await loadHost();
  const me = myIdentity();
  if (!me) return;
  if (!force && Date.now() - _lastOfferAt < 20000) return;
  const hostNode = await getMeshNodeId();
  if (!hostNode) return;
  _lastOfferAt = Date.now();

  const live = _hostConfig.enabled && _hostConfig.advertise;
  broadcastMeshPacket('MESH_INFERENCE_OFFER', {
    host: me.did,
    hostNode,
    hostName: me.name,
    models: live ? _hostConfig.models.map(ref => ({ ref, label: describeModelRef(ref) })) : [],
    limits: { maxTokens: _hostConfig.maxTokens, rpm: _hostConfig.rpm, daily: _hostConfig.daily },
    approval: _hostConfig.approval,
    ts: Date.now(),
  });
}

export function discoverHosts() {
  broadcastMeshPacket('MESH_INFERENCE_DISCOVER', { ts: Date.now() });
}

async function onOffer(payload, packet) {
  const sender = verifiedSenderDid(packet);
  if (!sender || sender !== payload?.host || sender === getMyDid()) return;
  const hostNode = senderNode(packet);
  if (!hostNode) return;

  const models = (Array.isArray(payload.models) ? payload.models : [])
    .slice(0, 12)
    .filter(m => parseModelRef(m?.ref))
    .map(m => ({ ref: m.ref, label: String(m.label || describeModelRef(m.ref)).slice(0, 80) }));
  const limits = payload.limits || {};
  const existing = await db.inference_hosts.get(sender);

  await db.inference_hosts.put({
    ...(existing || {}),
    id: sender,
    hostNode,
    hostName: String(payload.hostName || 'Sovereign node').slice(0, 60),
    models,
    limits: {
      maxTokens: clampInt(limits.maxTokens, 64, 4096),
      rpm: clampInt(limits.rpm, 1, 60),
      daily: clampInt(limits.daily, 1, 10000),
    },
    approval: payload.approval === 'allies' ? 'allies' : 'manual',
    lastSeen: Date.now(),
  });
  // Keep stored keys pointed at the host's current node.
  await db.inference_keys.where('host').equals(sender).modify({ hostNode }).catch(() => {});
  emitChange();
}

async function onDiscover() {
  await loadHost();
  if (_hostConfig.enabled && _hostConfig.advertise && _hostConfig.models.length) announceOffer();
}

export async function listHosts() {
  const me = getMyDid();
  const rows = await db.inference_hosts.toArray().catch(() => []);
  return rows
    .filter(h => h.id !== me)
    .map(h => ({ ...h, online: Date.now() - h.lastSeen < HOST_ONLINE_WINDOW_MS && h.models.length > 0 }))
    .sort((a, b) => Number(b.online) - Number(a.online) || b.lastSeen - a.lastSeen);
}

export async function forgetHost(hostDid) {
  await db.inference_hosts.delete(hostDid);
  emitChange();
}

// ── Access requests (caller asks, host decides) ────────────────────────────

export async function requestAccess(hostDid, note = '') {
  const me = myIdentity();
  if (!me) throw new Error('Your identity is still loading. Try again in a moment.');
  const host = await db.inference_hosts.get(hostDid);
  if (!host) throw new Error('Host not found. Refresh the host list.');
  const replyNode = await getMeshNodeId();
  if (!replyNode) throw new Error('The mesh is not running on this node.');

  const sent = await sendDirectMeshPacket(host.hostNode, 'MESH_INFERENCE_ACCESS_REQUEST', {
    host: hostDid,
    replyNode,
    name: me.name,
    note: String(note || '').slice(0, 280),
    ts: Date.now(),
  });
  if (!sent) throw new Error(`Could not reach ${host.hostName}. They need to be online on your LAN or in your mesh room.`);
  await db.inference_hosts.update(hostDid, { requestStatus: 'pending', requestedAt: Date.now() });
  emitChange();
}

async function sendAccessReply(request, status, token = null) {
  const me = myIdentity();
  if (!me) return false;
  return sendDirectMeshPacket(request.replyNode, 'MESH_INFERENCE_ACCESS_REPLY', {
    host: me.did,
    status,
    token,
    ts: Date.now(),
  });
}

async function activeGrantFor(grantee) {
  const grants = await db.inference_grants.where('grantee').equals(grantee).toArray().catch(() => []);
  return grants.find(g => !g.revoked && g.exp > Date.now()) || null;
}

async function onAccessRequest(payload, packet) {
  await loadHost();
  const me = myIdentity();
  const sender = verifiedSenderDid(packet);
  if (!me || !sender || sender === me.did || payload?.host !== me.did) return;
  const replyNode = senderNode(packet);
  if (!isFresh(packet) || !replyNode) return;
  if (await isPeerBlocked(sender)) return;

  const request = {
    id: sender,
    replyNode,
    name: String(payload.name || 'Unknown node').slice(0, 60),
    note: String(payload.note || '').slice(0, 280),
    status: 'pending',
    createdAt: Date.now(),
  };

  if (!_hostConfig.enabled || !_hostConfig.models.length) {
    await sendAccessReply(request, 'unavailable');
    return;
  }

  // They already hold a valid key (perhaps they lost it): send it again.
  const active = await activeGrantFor(sender);
  if (active) {
    await sendAccessReply(request, 'approved', active.token);
    return;
  }

  const existing = await db.inference_access_requests.get(sender);
  if (existing?.status === 'pending' && Date.now() - existing.createdAt < 60000) return;
  await db.inference_access_requests.put(request);

  if (_hostConfig.approval === 'allies' && await isAllyContact(sender)) {
    await approveAccessRequest(sender);
    return;
  }

  dispatchMeshToast({
    type: 'ai',
    title: 'AI access request',
    message: `${request.name} wants to use your hosted AI. Review it in AI Lounge → Inference Exchange.`,
  });
  emitChange();
}

export async function listAccessRequests() {
  return db.inference_access_requests.orderBy('createdAt').reverse().toArray().catch(() => []);
}

export async function approveAccessRequest(requestId, overrides = {}) {
  const request = await db.inference_access_requests.get(requestId);
  if (!request) throw new Error('Request not found.');
  const grant = await issueGrant({ grantee: request.id, granteeName: request.name, ...overrides });
  await db.inference_access_requests.update(requestId, { status: 'approved', decidedAt: Date.now() });
  await sendAccessReply(request, 'approved', grant.token);
  emitChange();
  return grant;
}

export async function denyAccessRequest(requestId) {
  const request = await db.inference_access_requests.get(requestId);
  if (!request) return;
  await db.inference_access_requests.update(requestId, { status: 'denied', decidedAt: Date.now() });
  await sendAccessReply(request, 'denied');
  emitChange();
}

async function onAccessReply(payload, packet) {
  const sender = verifiedSenderDid(packet);
  if (!sender || sender !== payload?.host) return;
  const host = await db.inference_hosts.get(sender);
  if (!host?.requestStatus) return; // we never asked this host

  if (payload.status === 'approved' && payload.token) {
    try {
      const key = await importAccessKey(payload.token);
      if (key.host !== sender) throw new Error('Key was not issued by this host.');
      await db.inference_hosts.update(sender, { requestStatus: 'approved' });
      dispatchMeshToast({ type: 'ai', title: 'AI access granted', message: `${host.hostName} gave you access to their AI.` });
    } catch (err) {
      console.warn('[InferenceExchange] Ignored invalid access key:', err.message);
    }
  } else {
    const status = payload.status === 'denied' ? 'denied' : 'unavailable';
    await db.inference_hosts.update(sender, { requestStatus: status });
    dispatchMeshToast({
      type: 'ai',
      title: status === 'denied' ? 'AI access declined' : 'Host not sharing',
      message: status === 'denied' ? `${host.hostName} declined your request.` : `${host.hostName} is not sharing their AI right now.`,
    });
  }
  emitChange();
}

// ── Grants (host side) ─────────────────────────────────────────────────────

/**
 * Issue an access key to one identity. Returns the stored grant, whose `token`
 * is the key to hand over. It only works for the identity it names.
 */
export async function issueGrant({ grantee, granteeName = '', models, maxTokens, rpm, daily, days } = {}) {
  await loadHost();
  const me = myIdentity();
  if (!me) throw new Error('Your identity is still loading. Try again in a moment.');
  const cleanGrantee = String(grantee || '').trim().toLowerCase();
  if (!didToPub(cleanGrantee)) throw new Error('That is not a NovAura identity. It should look like did:nova: followed by 64 characters.');
  if (cleanGrantee === me.did) throw new Error('You cannot issue a key to yourself.');
  const offered = _hostConfig.models;
  const chosen = (models?.length ? models : offered).filter(ref => offered.includes(ref));
  if (!chosen.length) throw new Error('Choose at least one model to share first.');
  const hostNode = await getMeshNodeId();
  if (!hostNode) throw new Error('The mesh is not running on this node.');

  const now = Date.now();
  const body = {
    v: 1,
    gid: `g_${randomHex(12)}`,
    host: me.did,
    hostNode,
    hostName: me.name,
    grantee: cleanGrantee,
    models: chosen,
    maxTokens: clampInt(maxTokens ?? _hostConfig.maxTokens, 64, _hostConfig.maxTokens),
    rpm: clampInt(rpm ?? _hostConfig.rpm, 1, 60),
    daily: clampInt(daily ?? _hostConfig.daily, 1, 10000),
    iat: now,
    exp: now + clampInt(days ?? _hostConfig.keyDays, 1, 365) * 86400000,
  };
  const token = encodeAccessKey(body, signGrant(body, me.secret));
  const grant = {
    id: body.gid,
    grantee: body.grantee,
    granteeName: String(granteeName || '').slice(0, 60),
    models: body.models,
    maxTokens: body.maxTokens,
    rpm: body.rpm,
    daily: body.daily,
    exp: body.exp,
    createdAt: now,
    revoked: 0, // 0/1 rather than a boolean so IndexedDB can index it
    token,
    usageDay: '',
    usedToday: 0,
    totalCalls: 0,
    lastUsedAt: null,
  };
  await db.inference_grants.put(grant);
  emitChange();
  return grant;
}

export async function listGrants() {
  return db.inference_grants.orderBy('createdAt').reverse().toArray().catch(() => []);
}

export async function revokeGrant(gid) {
  await db.inference_grants.update(gid, { revoked: 1, revokedAt: Date.now() });
  emitChange();
}

export async function deleteGrant(gid) {
  await db.inference_grants.delete(gid);
  emitChange();
}

// ── Access keys (caller side) ──────────────────────────────────────────────

export async function importAccessKey(token) {
  const me = myIdentity();
  if (!me) throw new Error('Your identity is still loading. Try again in a moment.');
  const { body, token: clean } = decodeAccessKey(token);
  if (body.host === me.did) throw new Error('That is a key you issued yourself.');
  if (body.grantee !== me.did) {
    throw new Error('This key was issued to a different identity, so it will not work here. Ask the host for a key made for your identity.');
  }
  // The host's node comes from its key, whatever node the key names.
  const hostNode = meshNodeIdFor(body.host);
  if (!GRANT_ID_RE.test(String(body.gid || '')) || !hostNode) {
    throw new Error('The access key is malformed.');
  }
  if (Number(body.exp) < Date.now()) throw new Error('This access key has expired.');

  const key = {
    id: body.gid,
    host: body.host,
    hostNode,
    hostName: String(body.hostName || 'Sovereign node').slice(0, 60),
    models: (Array.isArray(body.models) ? body.models : []).filter(ref => parseModelRef(ref)).slice(0, 12),
    maxTokens: clampInt(body.maxTokens, 64, 4096),
    rpm: clampInt(body.rpm, 1, 60),
    daily: clampInt(body.daily, 1, 10000),
    exp: Number(body.exp),
    token: clean,
    addedAt: Date.now(),
    lastUsedAt: null,
  };
  await db.inference_keys.put(key);
  emitChange();
  return key;
}

export async function listAccessKeys() {
  return db.inference_keys.orderBy('addedAt').reverse().toArray().catch(() => []);
}

export async function removeAccessKey(id) {
  await db.inference_keys.delete(id);
  emitChange();
}

/** Every remote model this node holds a valid key for: [{ keyId, ref, label, hostName }]. */
export async function listRemoteModels() {
  const keys = await listAccessKeys();
  return keys
    .filter(k => k.exp > Date.now())
    .flatMap(k => k.models.map(ref => ({ keyId: k.id, ref, hostName: k.hostName, label: `${describeModelRef(ref)} · ${k.hostName}` })));
}

// ── Jobs ───────────────────────────────────────────────────────────────────

const _pendingCalls = new Map();

/**
 * Run a chat completion on someone else's model with an access key.
 * Resolves with the reply text.
 */
export async function callRemoteModel(keyId, modelRef, messages, { maxTokens = 400, temperature = 0.7, timeoutMs = DEFAULT_CALL_TIMEOUT_MS } = {}) {
  const me = myIdentity();
  if (!me) throw new Error('Your identity is still loading. Try again in a moment.');
  const key = await db.inference_keys.get(keyId);
  if (!key) throw new Error('That access key is no longer on this node.');
  if (key.exp < Date.now()) throw new Error(`Your access key for ${key.hostName} has expired.`);
  if (!key.models.includes(modelRef)) throw new Error('That model is not covered by your access key.');
  const replyNode = await getMeshNodeId();
  if (!replyNode) throw new Error('The mesh is not running on this node.');

  const jobId = `job_${randomHex(12)}`;
  const request = { model: modelRef, messages, maxTokens: Math.min(maxTokens, key.maxTokens), temperature };
  const { wire, openResult } = await sealInferenceCall({ jobId, hostDid: key.host, callerDid: me.did, request });

  const reply = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendingCalls.delete(jobId);
      reject(new Error(`${key.hostName} did not answer within ${Math.round(timeoutMs / 1000)}s. They may be offline.`));
    }, timeoutMs);
    _pendingCalls.set(jobId, { resolve, reject, openResult, host: key.host, timer });
  });

  const sent = await sendDirectMeshPacket(key.hostNode, 'MESH_INFERENCE_CALL', { host: key.host, gid: key.id, jobId, replyNode, ...wire });
  if (!sent) {
    const pending = _pendingCalls.get(jobId);
    if (pending) clearTimeout(pending.timer);
    _pendingCalls.delete(jobId);
    reply.catch(() => {});
    throw new Error(`Could not reach ${key.hostName}. They need to be online on your LAN or in your mesh room.`);
  }

  const text = await reply;
  db.inference_keys.update(key.id, { lastUsedAt: Date.now() }).catch(() => {});
  return text;
}

async function onResult(payload, packet) {
  const pending = _pendingCalls.get(payload?.jobId);
  if (!pending || verifiedSenderDid(packet) !== pending.host) return;
  clearTimeout(pending.timer);
  _pendingCalls.delete(payload.jobId);

  if (payload.error) {
    pending.reject(new Error(HOST_ERRORS[payload.error] || 'The host could not run the job.'));
    return;
  }
  try {
    const result = await pending.openResult(payload);
    pending.resolve(String(result?.text || ''));
  } catch {
    pending.reject(new Error('The reply could not be decrypted.'));
  }
}

// Host side job handling
const _seenJobs = new Map();
const _rateWindows = new Map();
const _busyGrants = new Set();
let _activeJobs = 0;

function rememberJob(jobId) {
  const now = Date.now();
  _seenJobs.set(jobId, now);
  if (_seenJobs.size > 2000) {
    for (const [id, ts] of _seenJobs) {
      if (now - ts > 2 * PACKET_MAX_AGE_MS) _seenJobs.delete(id);
    }
  }
}

function sanitizeMessages(list) {
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_MESSAGES) return null;
  let total = 0;
  const out = [];
  for (const m of list) {
    if (!m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return null;
    total += m.content.length;
    if (total > MAX_PROMPT_CHARS) return null;
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

function logJob(jobId, caller, model, status, durationMs) {
  db.swarm_inference_jobs.put({
    id: jobId,
    requesterId: caller,
    role: 'exchange',
    model: model || 'unknown',
    status,
    durationMs,
    createdAt: new Date().toISOString(),
  }).catch(() => {});
}

async function onCall(payload, packet) {
  await loadHost();
  const me = myIdentity();
  const caller = verifiedSenderDid(packet);
  if (!me || !caller || caller === me.did || payload?.host !== me.did) return; // not for us
  const { gid, jobId } = payload;
  const replyNode = senderNode(packet);
  if (!JOB_ID_RE.test(String(jobId || '')) || !replyNode) return;
  if (!isFresh(packet) || _seenJobs.has(jobId)) return;
  rememberJob(jobId);

  const fail = (code) => sendDirectMeshPacket(replyNode, 'MESH_INFERENCE_RESULT', { jobId, error: code });

  if (!_hostConfig.enabled) return fail('NOT_HOSTING');
  const grant = GRANT_ID_RE.test(String(gid || '')) ? await db.inference_grants.get(gid) : null;
  if (!grant || grant.grantee !== caller || await isPeerBlocked(caller)) return fail('NO_ACCESS');
  if (grant.revoked) return fail('REVOKED');
  if (grant.exp < Date.now()) return fail('EXPIRED');

  const now = Date.now();
  const recent = (_rateWindows.get(gid) || []).filter(t => now - t < 60000);
  if (recent.length >= grant.rpm) return fail('RATE_LIMITED');
  const day = today();
  const usedToday = grant.usageDay === day ? grant.usedToday : 0;
  if (usedToday >= grant.daily) return fail('DAILY_LIMIT');
  if (_activeJobs >= MAX_CONCURRENT_JOBS || _busyGrants.has(gid)) return fail('BUSY');
  recent.push(now);
  _rateWindows.set(gid, recent);

  let opened;
  try {
    opened = await openInferenceCall({ jobId, hostDid: me.did, hostSecretHex: me.secret, callerDid: caller, wire: payload });
  } catch {
    return fail('BAD_REQUEST');
  }
  const { request, sealResult } = opened;
  const messages = sanitizeMessages(request?.messages);
  if (!messages) return fail('BAD_REQUEST');
  const model = request?.model;
  if (!grant.models.includes(model) || !_hostConfig.models.includes(model)) return fail('MODEL_UNAVAILABLE');
  const maxTokens = clampInt(request?.maxTokens ?? 400, 16, Math.min(grant.maxTokens, _hostConfig.maxTokens));
  const temperature = Math.min(1.5, Math.max(0, Number(request?.temperature ?? 0.7) || 0));

  _activeJobs++;
  _busyGrants.add(gid);
  emitChange();
  const started = Date.now();
  try {
    const text = await runLocalChat(model, messages, { maxTokens, temperature });
    const sealed = await sealResult({ text, model, durationMs: Date.now() - started });
    await sendDirectMeshPacket(replyNode, 'MESH_INFERENCE_RESULT', { jobId, ...sealed });
    await db.inference_grants.update(gid, {
      usageDay: day,
      usedToday: usedToday + 1,
      totalCalls: (grant.totalCalls || 0) + 1,
      lastUsedAt: Date.now(),
    });
    logJob(jobId, caller, model, 'completed', Date.now() - started);
  } catch (err) {
    console.warn('[InferenceExchange] Hosted job failed:', err);
    logJob(jobId, caller, model, 'failed', Date.now() - started);
    await fail('INFERENCE_FAILED');
  } finally {
    _activeJobs--;
    _busyGrants.delete(gid);
    emitChange();
  }
}

// ── Wiring ─────────────────────────────────────────────────────────────────

registerMeshHandler('MESH_INFERENCE_OFFER', onOffer);
registerMeshHandler('MESH_INFERENCE_DISCOVER', onDiscover);
registerMeshHandler('MESH_INFERENCE_ACCESS_REQUEST', onAccessRequest);
registerMeshHandler('MESH_INFERENCE_ACCESS_REPLY', onAccessReply);
registerMeshHandler('MESH_INFERENCE_CALL', onCall);
registerMeshHandler('MESH_INFERENCE_RESULT', onResult);

if (typeof window !== 'undefined') {
  loadHost().then(() => {
    setTimeout(() => {
      if (_hostConfig.enabled && _hostConfig.advertise && _hostConfig.models.length) announceOffer(true);
      discoverHosts();
    }, 5000);
  });
  setInterval(() => {
    if (_hostConfig.enabled && _hostConfig.advertise && _hostConfig.models.length) announceOffer(true);
  }, OFFER_INTERVAL_MS);
  window.addEventListener('novaura:peer_discovered', () => {
    if (_hostConfig.enabled && _hostConfig.advertise && _hostConfig.models.length) announceOffer();
  });
}
