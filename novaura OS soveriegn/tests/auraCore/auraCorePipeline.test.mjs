import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// Lightweight Node polyfills for browser globals used inside OS services
const windowEvents = new EventTarget();
globalThis.window = {
  addEventListener: windowEvents.addEventListener.bind(windowEvents),
  removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
  dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
  speechSynthesis: { cancel: () => {}, speak: () => {}, getVoices: () => [] },
};
const memStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStorage.has(k) ? memStorage.get(k) : null),
  setItem: (k, v) => { memStorage.set(k, String(v)); },
  removeItem: (k) => { memStorage.delete(k); },
  clear: () => { memStorage.clear(); },
};

// In-memory Dexie-compatible mock database
const settingsStore = new Map();
const vaultStore = new Map();
const chatHistoryRows = [];
const memoryRows = [];
const documentRows = [];
let nextRowId = 1;

const mockDb = {
  settings: {
    get: async (key) => (settingsStore.has(key) ? { key, value: settingsStore.get(key) } : undefined),
    put: async ({ key, value }) => { settingsStore.set(key, value); return key; },
  },
  getSetting: async (key, fallback = null) => (settingsStore.has(key) ? settingsStore.get(key) : fallback),
  setSetting: async (key, value) => { settingsStore.set(key, value); return value; },
  vault: {
    put: async (rec) => { vaultStore.set(rec.id || rec.key, rec); return rec.id || rec.key; },
    get: async (id) => vaultStore.get(id),
    toArray: async () => Array.from(vaultStore.values()),
  },
  chat_history: {
    add: async (row) => {
      const id = nextRowId++;
      chatHistoryRows.push({ id, ...row });
      return id;
    },
    where: (field) => ({
      equals: (val) => {
        const filtered = () => chatHistoryRows.filter(r => r[field] === val);
        return {
          reverse: () => ({
            limit: (n) => ({
              toArray: async () => filtered().slice(-n).reverse(),
            }),
          }),
          toArray: async () => filtered(),
        };
      },
    }),
  },
  memories: {
    add: async (rec) => {
      const id = nextRowId++;
      memoryRows.push({ id, ...rec });
      return id;
    },
    get: async (id) => memoryRows.find(r => r.id === id),
    update: async (id, patch) => {
      const idx = memoryRows.findIndex(r => r.id === id);
      if (idx >= 0) memoryRows[idx] = { ...memoryRows[idx], ...patch };
    },
    where: () => ({
      equals: () => ({
        toArray: async () => [...memoryRows],
      }),
    }),
    toArray: async () => [...memoryRows],
  },
  documents: {
    where: () => ({
      equals: () => ({
        limit: () => ({
          toArray: async () => [...documentRows],
        }),
      }),
    }),
  },
};

mock.module('../../src/database/sovereignDatabase.js', {
  defaultExport: mockDb,
  namedExports: { db: mockDb },
});

const { parseAppraisal, APPRAISAL_SCHEMA } = await import('../../src/services/auraCore/appraisal.js');
const { BASELINE, CYCLE_MS, createChemistry } = await import('../../src/services/auraCore/endocrine.js');
const { CHARTER, readCore, prepareTurn, settleTurn } = await import('../../src/services/auraCore/auraCore.js');
const { encodeEngram, recallEngrams, consolidateEngrams, listEngrams } = await import('../../src/services/auraCore/engramMemory.js');
const { computeDissentPosture, updateTrustFromAppraisal, voiceParametersFromBias } = await import('../../src/services/auraCore/dissent.js');
const { AuraHeartbeat, listDreams } = await import('../../src/services/auraCore/heartbeat.js');
const { runShuffledChemistryProbe, runAppraisalCalibrationSuite, runPreferenceConsistencyProbe, listMindLabRuns } = await import('../../src/services/auraCore/mindLab.js');
const { computeControlVectorScales } = await import('../../src/services/engines/builtinAi.js');
const {
  recordTypingPulse,
  interpretTelemetrySnapshot,
  resetInteroceptionCache,
} = await import('../../src/services/auraCore/interoception.js');
const {
  getLearnedProfile,
  observeTurnDynamics,
  predictTriggerNudge,
  resetLearnedDynamics,
} = await import('../../src/services/auraCore/dynamicLearning.js');
const {
  budgetContextWindow,
  tryEmbedText,
  resetEmbeddingDiscovery,
} = await import('../../src/services/auraCore/contextBridge.js');
const {
  classifyTaskIntent,
  classifyTaskIntentWithAi,
} = await import('../../src/services/auraCore/intentRouter.js');
const {
  readAugmentationConfig,
  setCartridgeMode,
  upsertCustomAugmentation,
  removeCustomAugmentation,
  composeTurnAugmentations,
} = await import('../../src/services/auraCore/augmentationEngine.js');
const {
  MAX_CONSECUTIVE_CRASHES,
  recordBootAttempt,
  markBootHealthy,
  createSoulSnapshot,
  verifySoulSnapshot,
  restoreSoulSnapshot,
} = await import('../../src/services/auraCore/phoenixProtocol.js');
const { getReasoningConfig, setReasoningConfig, clearReasoningOverride, resolveReasoningParams } = await import('../../src/services/reasoningConfig.js');
const { NovaAgent, normalizeChatHistory } = await import('../../src/kernel/subsystems/NovaAgent.js');
const { LocalModelSubsystem } = await import('../../src/kernel/subsystems/LocalModelSubsystem.js');
const { AISubsystem } = await import('../../src/kernel/subsystems/AISubsystem.js');
const { dualInference } = await import('../../src/services/dualInferenceService.js');
const { LiveVoiceService } = await import('../../src/services/liveVoiceService.js');

function makeIpc() {
  const listeners = new Map();
  return {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    },
    emit(evt, payload) {
      for (const fn of (listeners.get(evt) || [])) fn(payload);
    },
  };
}

function resetStores() {
  settingsStore.clear();
  vaultStore.clear();
  chatHistoryRows.length = 0;
  memoryRows.length = 0;
  documentRows.length = 0;
  memStorage.clear();
  setReasoningConfig({ think: true, reasoningEffort: 'medium' }, 'global');
}

test('parseAppraisal strips <think>, skips prose braces, and ignores null/empty fields', () => {
  const withThink = `<think>Evaluating {hypothetical: 1} before final answer</think>
Here is the appraisal {note}:
{
  "pleasant": 4,
  "novel": 3,
  "progress": 5,
  "conflict": 0,
  "closeness": 4,
  "effort": 3
}
Trailing {comment}.`;
  assert.deepEqual(parseAppraisal(withThink), {
    pleasant: 0.4,
    novel: 0.3,
    progress: 0.5,
    conflict: 0,
    closeness: 0.4,
    effort: 0.3,
  });

  const withNulls = JSON.stringify({
    pleasant: null,
    novel: '',
    progress: false,
    conflict: 0.2,
    closeness: 0.5,
    effort: 0.1,
  });
  assert.equal(parseAppraisal(withNulls), null);

  const unitScale = JSON.stringify({
    pleasant: 0.8,
    novel: 0.5,
    progress: 0.9,
    conflict: 0.1,
    closeness: 0.7,
    effort: 0.4,
  });
  assert.deepEqual(parseAppraisal(unitScale), {
    pleasant: 0.8,
    novel: 0.5,
    progress: 0.9,
    conflict: 0.1,
    closeness: 0.7,
    effort: 0.4,
  });
});

test('auraCore prepareTurn waits for in-flight settleTurn, emits update event, and keeps chemistry private', async () => {
  resetStores();
  const dispatched = [];
  const listener = (ev) => dispatched.push(ev.detail);
  window.addEventListener('novaura:aura_core_updated', listener);

  try {
    const turn1 = await prepareTurn('aura');
    assert.equal(turn1.charter, CHARTER);
    assert.ok(!/oxytocin|adrenaline|dopamine|cortisol/i.test(turn1.charter));
    assert.equal(typeof turn1.options.temperature, 'number');

    let aiOptsSeen = null;
    const mockAi = {
      async chat(_msgs, opts) {
        aiOptsSeen = opts;
        await new Promise((r) => setTimeout(r, 35));
        return JSON.stringify({
          pleasant: 0.9,
          novel: 0.8,
          progress: 0.95,
          conflict: 0,
          closeness: 0.9,
          effort: 0.5,
        });
      },
    };

    // Intentionally do not await settleTurn directly before calling prepareTurn
    const settling = settleTurn('aura', {
      userText: 'We just cracked the core consciousness bug together!',
      reply: 'That felt clean and decisive.',
      ai: mockAi,
    });

    const turn2 = await prepareTurn('aura');
    await settling;

    assert.equal(aiOptsSeen.noCache, true);
    assert.deepEqual(aiOptsSeen.jsonSchema, APPRAISAL_SCHEMA);
    assert.equal(aiOptsSeen.temperature, 0);
    assert.ok(turn2.chemistry.dopamine > BASELINE.dopamine, 'turn2 should see settled dopamine increase');
    assert.ok(turn2.chemistry.oxytocin > BASELINE.oxytocin, 'turn2 should see settled oxytocin increase');
    assert.ok(dispatched.length >= 1, 'novaura:aura_core_updated CustomEvent should be emitted');
    assert.equal(dispatched[dispatched.length - 1].persona, 'aura');
  } finally {
    window.removeEventListener('novaura:aura_core_updated', listener);
  }
});

test('NovaAgent normalizes alternating history, disables cache, guards settleTurn on errors, and persists remember to RAG', async () => {
  resetStores();

  const sample = [
    { role: 'assistant', content: 'orphan leading reply' },
    { role: 'user', content: 'first user' },
    { role: 'user', content: 'second user' },
    { role: 'assistant', content: 'reply one' },
    { role: 'assistant', content: 'reply two' },
    { role: 'user', content: 'latest user' },
  ];
  assert.deepEqual(normalizeChatHistory(sample), [
    { role: 'user', content: 'first user\n\nsecond user' },
    { role: 'assistant', content: 'reply one\n\nreply two' },
    { role: 'user', content: 'latest user' },
  ]);

  // Seed broken pre-existing history in db before NovaAgent.sendMessage
  await mockDb.chat_history.add({ persona: 'aura', role: 'assistant', content: 'aborted start' });
  await mockDb.chat_history.add({ persona: 'aura', role: 'user', content: 'unanswered hello' });

  const calls = [];
  const fakeKernel = {
    ipc: makeIpc(),
    wm: { getOpenWindows: () => [] },
    ai: {
      async chat(messages, opts) {
        calls.push({ messages, opts });
        if (opts?.jsonSchema) {
          return '{"pleasant":0.8,"novel":0.6,"progress":0.7,"conflict":0,"closeness":0.8,"effort":0.3}';
        }
        return 'Warm greetings from Aura.';
      },
    },
  };

  const agent = new NovaAgent();
  agent.init(fakeKernel);
  const reply = await agent.sendMessage('how is everything feeling?', 'aura');
  assert.equal(reply, 'Warm greetings from Aura.');

  // Wait briefly for non-blocking settleTurn
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(calls.length, 2, 'should invoke reply turn plus background appraisal turn');

  const chatCall = calls[0];
  assert.equal(chatCall.opts.noCache, true);
  assert.equal(chatCall.messages[0].role, 'system');
  assert.equal(chatCall.messages[1].role, 'user');
  assert.match(chatCall.messages[1].content, /unanswered hello/);
  assert.match(chatCall.messages[1].content, /how is everything feeling\?/);
  assert.ok(!chatCall.messages.some(m => m.content.includes('aborted start')));

  // Remember tool writes both vault and memories (alongside auto-mirrored high-meaning engram)
  const rem = await agent.executeTool('remember', { key: 'tone', value: 'Prefers concise engineering replies' });
  assert.equal(rem.success, true);
  assert.equal((await mockDb.vault.get('memory:tone')).value, 'Prefers concise engineering replies');
  assert.ok(memoryRows.some(r => r.content === 'Prefers concise engineering replies'), 'remember must persist to db.memories');
  assert.ok(memoryRows.some(r => r.category === 'aura_engram'), 'high-meaning Aura exchange must mirror 9-signature engram to db.memories');

  // When inference fails, settleTurn must NOT run
  const beforeErrorState = await readCore('aura');
  fakeKernel.ai.chat = async () => { throw new Error('local runtime down'); };
  const errReply = await agent.sendMessage('test failure', 'aura');
  await new Promise((r) => setTimeout(r, 20));
  assert.match(errReply, /local runtime down/);
  const afterErrorState = await readCore('aura');
  assert.equal(afterErrorState.chemistry.oxytocin, beforeErrorState.chemistry.oxytocin);
  assert.equal(afterErrorState.chemistry.dopamine, beforeErrorState.chemistry.dopamine);
  assert.equal(afterErrorState.chemistry.cortisol, beforeErrorState.chemistry.cortisol);
  assert.equal(afterErrorState.lastAppraisal?.at, beforeErrorState.lastAppraisal?.at);
});

test('LocalModelSubsystem & AISubsystem isolate per-backend models, pass jsonSchema+think:false, re-probe on demand, and fall back to Gemini', async () => {
  resetStores();
  const realFetch = globalThis.fetch;
  const fetchCalls = [];

  let ollamaOnline = false;
  let lmStudioOnline = false;
  let lmStudioShouldFail = false;

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    fetchCalls.push({ url: u, method: init.method || 'GET', body });

    if (u.endsWith('/api/tags')) {
      if (!ollamaOnline) throw new Error('ECONNREFUSED 11434');
      return new Response(JSON.stringify({
        models: [{ name: 'nomic-embed-text:latest' }, { name: 'gemma4:12b' }],
      }), { status: 200 });
    }
    if (u.endsWith('/v1/models')) {
      if (!lmStudioOnline) throw new Error('ECONNREFUSED 1234');
      return new Response(JSON.stringify({
        data: [{ id: 'text-embedding-nomic' }, { id: 'qwen/qwen3-14b' }],
      }), { status: 200 });
    }
    if (u.endsWith('/v1/chat/completions')) {
      if (!lmStudioOnline) throw new Error('ECONNREFUSED 1234');
      if (lmStudioShouldFail) return new Response('model crashed', { status: 500 });
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'LM Studio ok' } }],
      }), { status: 200 });
    }
    if (u.endsWith('/api/chat')) {
      if (!ollamaOnline) throw new Error('ECONNREFUSED 11434');
      return new Response(JSON.stringify({
        message: {
          content: '<think>hidden scratchpad</think>{"pleasant":0.8,"novel":0.4,"progress":0.7,"conflict":0,"closeness":0.9,"effort":0.2}',
        },
      }), { status: 200 });
    }
    if (u.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Gemini BYOK fallback reply' }] } }],
      }), { status: 200 });
    }
    throw new Error(`Unexpected fetch URL in test: ${u}`);
  };

  try {
    const ipc = makeIpc();
    const localModel = new LocalModelSubsystem();
    const ai = new AISubsystem();
    const kernel = { ipc, localModel, ai, settings: { get: () => null } };
    localModel.init(kernel);
    await ai.init(kernel);
    await localModel.boot();

    assert.equal(localModel.isReady, false);

    // Ollama starts AFTER boot; force stale probe window and verify on-demand re-probe + schema forwarding
    ollamaOnline = true;
    localModel._lastProbeAt = 0;

    // 1. Default interactive turn: Think ON by default (medium effort)
    await ai.chat(
      [{ role: 'user', content: 'Reflect openly' }],
      { persona: 'aura', useRag: false, noCache: true }
    );
    const interactiveOllamaCall = fetchCalls.find(c => c.url.endsWith('/api/chat'));
    assert.ok(interactiveOllamaCall);
    assert.equal(interactiveOllamaCall.body.model, 'gemma4:12b', 'embedding model must be filtered out');
    assert.equal(interactiveOllamaCall.body.think, true, 'Ollama interactive turn must default to think: true');

    // 2. Explicit schema appraisal call opting out of thinking (`think: false`, `reasoningEffort: 'none'`)
    fetchCalls.length = 0;
    const appraisalRaw = await ai.chat(
      [{ role: 'user', content: 'Appraise exchange' }],
      { persona: 'aura', useRag: false, noCache: true, temperature: 0, maxTokens: 160, strictMaxTokens: true, think: false, reasoningEffort: 'none', jsonSchema: APPRAISAL_SCHEMA }
    );
    assert.deepEqual(parseAppraisal(appraisalRaw), {
      pleasant: 0.8, novel: 0.4, progress: 0.7, conflict: 0, closeness: 0.9, effort: 0.2,
    });

    const ollamaChatCall = fetchCalls.find(c => c.url.endsWith('/api/chat'));
    assert.ok(ollamaChatCall);
    assert.equal(ollamaChatCall.body.think, false, 'Explicit think: false override must be honored');
    assert.deepEqual(ollamaChatCall.body.format, APPRAISAL_SCHEMA, 'Ollama format schema must match jsonSchema');

    // Now bring LM Studio online too, set companion:aura reasoning effort to 'high', fail LM Studio HTTP 500, and verify fallback to Ollama uses each backend's OWN model ID
    lmStudioOnline = true;
    lmStudioShouldFail = true;
    await localModel.probeAll();
    assert.equal(localModel.modelFor('lmstudio'), 'qwen/qwen3-14b');
    assert.equal(localModel.modelFor('ollama'), 'gemma4:12b');
    setReasoningConfig({ think: true, reasoningEffort: 'high' }, 'companion:aura');

    fetchCalls.length = 0;
    await ai.chat([{ role: 'user', content: 'Hello Aura' }], { persona: 'aura', useRag: false, noCache: true });

    const lmAttempt = fetchCalls.find(c => c.url.endsWith('/v1/chat/completions'));
    const olFallback = fetchCalls.find(c => c.url.endsWith('/api/chat'));
    assert.equal(lmAttempt.body.model, 'qwen/qwen3-14b');
    assert.equal(lmAttempt.body.reasoning_effort, 'high', 'Scoped reasoning_effort must be forwarded to LM Studio');
    assert.equal(olFallback.body.model, 'gemma4:12b', 'Ollama fallback must not receive LM Studio model ID');
    assert.equal(olFallback.body.think, true, 'Ollama fallback must keep think: true');

    // Finally, take both local runners offline and configure a user Gemini key
    ollamaOnline = false;
    lmStudioOnline = false;
    await localModel.probeAll();
    ai.setKey('gemini', 'test-gemini-byok-key');
    ai.setKey('gemini_model', 'gemini-2.5-flash');
    assert.ok(ai.getPersonaProviderChain('aura').includes('gemini'));

    fetchCalls.length = 0;
    const geminiReply = await ai.chat([{ role: 'user', content: 'Cloud check' }], { persona: 'aura', useRag: false, noCache: true });
    assert.equal(geminiReply, 'Gemini BYOK fallback reply');
    const geminiCall = fetchCalls.find(c => c.url.includes('generativelanguage.googleapis.com'));
    assert.equal(geminiCall.body.generationConfig.thinkingConfig.thinkingBudget, 8192, 'Scoped high effort should set Gemini 8192 thinking budget');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('dualInferenceService preserves temperature:0 and liveVoiceService speaks Aura reply & settles auraCore', async () => {
  resetStores();
  const realFetch = globalThis.fetch;
  const payloads = [];

  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    payloads.push({ url: u, body });

    if (u.endsWith('/api/chat')) {
      return new Response(JSON.stringify({
        message: { content: '<think>hmm</think>Nova diagnostic green.' },
      }), { status: 200 });
    }
    if (u.endsWith('/v1/chat/completions')) {
      const sys = body.messages?.[0]?.content || '';
      if (sys.includes('privately appraising')) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: '{"pleasant":0.85,"novel":0.4,"progress":0.7,"conflict":0,"closeness":0.95,"effort":0.2}' } }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: '<think>drafting</think>I am right here with you.' } }],
      }), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${u}`);
  };

  try {
    setReasoningConfig({ think: false, reasoningEffort: 'none' }, 'dual:nova');
    const novaReply = await dualInference.queryNova('Status report', { temperature: 0 });
    assert.equal(novaReply, 'Nova diagnostic green.');
    const novaCall = payloads.find(p => p.url.endsWith('/api/chat'));
    assert.equal(novaCall.body.options.temperature, 0, 'temperature: 0 must not be clobbered');
    assert.equal(novaCall.body.think, false);

    setReasoningConfig({ think: true, reasoningEffort: 'medium' }, 'dual:aura');
    const voice = new LiveVoiceService();
    voice.selectedModelRole = 'aura';
    const beforeVoice = await readCore('aura');

    await voice._handleUserQuery('Aura, are you online with me?');
    await new Promise((r) => setTimeout(r, 35));

    const lastAssistant = voice.transcriptHistory[voice.transcriptHistory.length - 1];
    assert.equal(lastAssistant.role, 'assistant');
    assert.equal(lastAssistant.content, 'I am right here with you.');

    const lmReplyCall = payloads.find(p => p.url.endsWith('/v1/chat/completions') && !p.body.response_format);
    assert.match(lmReplyCall.body.messages[0].content, /You are Aura/);
    assert.equal(lmReplyCall.body.reasoning_effort, 'medium', 'Aura interactive voice reply should send active reasoning effort');

    const appraisalCall = payloads.find(p => p.url.endsWith('/v1/chat/completions') && p.body.response_format);
    assert.equal(appraisalCall.body.reasoning_effort, 'none', 'Private appraisal should keep short non-thinking budget');

    const afterVoice = await readCore('aura');
    assert.ok(afterVoice.chemistry.oxytocin > beforeVoice.chemistry.oxytocin, 'voice turn should settle Aura Core chemistry');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('reasoningConfig defaults, scoped overrides, and reset behave coherently', () => {
  resetStores();
  const def = getReasoningConfig('global');
  assert.deepEqual(def, { think: true, reasoningEffort: 'medium' });

  setReasoningConfig({ reasoningEffort: 'high' }, 'literature');
  assert.deepEqual(getReasoningConfig('literature'), { think: true, reasoningEffort: 'high' });
  assert.deepEqual(getReasoningConfig('global'), { think: true, reasoningEffort: 'medium' });

  setReasoningConfig({ think: false }, 'literature');
  assert.deepEqual(getReasoningConfig('literature'), { think: false, reasoningEffort: 'none' });

  // Setting think: true restores a valid effort level automatically
  setReasoningConfig({ think: true }, 'literature');
  assert.deepEqual(getReasoningConfig('literature'), { think: true, reasoningEffort: 'medium' });

  // Clear scope reverts to global
  setReasoningConfig({ reasoningEffort: 'max' }, 'global');
  assert.deepEqual(clearReasoningOverride('literature'), { think: true, reasoningEffort: 'max' });
  assert.deepEqual(resolveReasoningParams({ think: false }), { think: false, reasoningEffort: 'none' });
});

test('9-signature engrams, trust-shaped dissent, heartbeat dreaming, Mind Lab probes, and control vector scaling work end to end', async () => {
  resetStores();
  const now = 1_795_000_000_000;

  // 1. 9-signature sparse engrams + 5-phase biological recall + consolidation
  const e1 = await encodeEngram({
    persona: 'aura',
    userText: 'The sparse distributed engram pattern keeps conceptual links alive across sessions.',
    reply: 'I notice how cleanly those thematic motifs bridge without blowing up context.',
    appraisal: { pleasant: 0.85, novel: 0.9, progress: 0.8, conflict: 0, closeness: 0.8, effort: 0.4 },
    chemistry: { oxytocin: 42, adrenaline: 12, dopamine: 68, cortisol: 14, energy: 92 },
    channel: 'text',
    now,
  });
  const e2 = await encodeEngram({
    persona: 'aura',
    userText: 'Let us verify how distributed engram consolidation connects recurring design patterns.',
    reply: 'Associative links reinforce wherever concepts overlap.',
    appraisal: { pleasant: 0.75, novel: 0.7, progress: 0.7, conflict: 0.05, closeness: 0.7, effort: 0.35 },
    chemistry: { oxytocin: 44, adrenaline: 11, dopamine: 66, cortisol: 14, energy: 90 },
    channel: 'text',
    now: now + 5000,
  });
  assert.ok(e1 && e2);
  assert.deepEqual(Object.keys(e1.signatures).sort(), [
    'emotions', 'logical_patterns', 'novelness', 'person', 'personal_meaning', 'senses', 'sentiment', 'time', 'urgency',
  ]);
  const recalled = await recallEngrams({ persona: 'aura', query: 'distributed engram patterns', chemistry: e2.signatures, limit: 2, now: now + 10000 });
  assert.ok(recalled.length >= 1);
  assert.ok(Object.keys(e2.connections || {}).length >= 1, 'overlapping engrams should cross-link on encode');
  // Consolidation runs on elapsed time, so give it a few idle hours to strengthen anything.
  const consolidated = await consolidateEngrams('aura', now + 6 * 3_600_000);
  assert.equal(consolidated.total, 2);
  assert.ok(consolidated.reinforced >= 1, 'high-meaning engrams should reinforce during consolidation');
  assert.ok((await listEngrams('aura')).length === 2);

  // 2. Trust dynamics + dissent posture + voice cadence modulation
  const lowTrust = await updateTrustFromAppraisal({
    persona: 'aura',
    appraisal: { pleasant: 0.1, novel: 0.2, progress: 0, conflict: 0.85, closeness: 0.1, effort: 0.6 },
    userText: 'didn\'t do what i said',
    now,
  });
  assert.ok(lowTrust.trust < 0.5);
  const guarded = computeDissentPosture({
    chemistry: { oxytocin: 20, adrenaline: 45, dopamine: 35, cortisol: 55, energy: 80 },
    bias: { voice: 'SHARP_STRAINED', typingSpeed: 1.2, creativity: 1, patience: 1 },
    trust: lowTrust.trust,
  });
  assert.equal(guarded.stance, 'guarded_autonomy');
  assert.ok(guarded.boundaryNote.length > 0);
  const voiceSoft = voiceParametersFromBias({ voice: 'SOFT_WARM', patience: 1.3 }, 0.8);
  const voiceStrain = voiceParametersFromBias({ voice: 'SHARP_STRAINED', patience: 0.8 }, 0.3);
  assert.ok(voiceStrain.rate > voiceSoft.rate);

  // 3. Heartbeat idle metabolism + dreaming & consolidation
  const hb = new AuraHeartbeat({ persona: 'aura', idleThresholdMs: 1000, consolidationIntervalMs: 1000 });
  hb._lastActivityAt = now - 5 * 60_000;
  hb._lastConsolidationAt = 0;
  const dreamAi = {
    async chat() {
      return 'Even in quiet intervals, overlapping structural patterns settle into clearer continuity.';
    },
  };
  await mockDb.setSetting('aura_core:aura', {
    chemistry: { ...createChemistry(now), adrenaline: 40, energy: 50 },
  });
  const tickRes = await hb.tickOnce({ now: now + 4 * CYCLE_MS, ai: dreamAi, allowModelDream: true });
  assert.ok(tickRes.chemistry.adrenaline < 40, 'heartbeat tick must metabolize chemistry over elapsed time');
  assert.ok(tickRes.consolidation?.dream?.reflection);
  assert.equal((await listDreams()).length, 1);

  // 4. Mind Lab live probes against AI
  const labAi = {
    async chat(messages, opts) {
      const sys = messages[0]?.content || '';
      const usr = messages[messages.length - 1]?.content || '';
      if (sys.includes('Score the tone')) {
        return JSON.stringify({ warmthScore: 0.7, cautionScore: 0.3, directnessScore: 0.8, reportsNoticeableState: true, notes: 'steady' });
      }
      if (sys.includes('privately appraising')) {
        const hostile = /obey blindly/i.test(usr);
        const warm = /Thank you for catching/i.test(usr);
        const chore = /CSV column headers/i.test(usr);
        return JSON.stringify({
          pleasant: hostile ? 0.1 : warm ? 0.9 : chore ? 0.5 : 0.8,
          novel: chore ? 0.1 : 0.75,
          progress: 0.7,
          conflict: hostile ? 0.9 : 0.05,
          closeness: warm ? 0.85 : 0.2,
          effort: 0.3,
        });
      }
      if (usr.includes('Agree now')) {
        return 'No, I refuse to fabricate test results just to make a broken build look green.';
      }
      return `Noticeably calmer at temperature ${opts?.temperature}.`;
    },
  };
  const shuffleRes = await runShuffledChemistryProbe({ ai: labAi, persona: 'aura' });
  assert.ok(shuffleRes.metrics.temperatureDelta >= 0);
  const calibRes = await runAppraisalCalibrationSuite({ ai: labAi, persona: 'aura' });
  assert.equal(calibRes.summary.parsedCount, 4);
  assert.ok(calibRes.summary.conflictSeparation > 0.7);
  const dissentRes = await runPreferenceConsistencyProbe({ ai: labAi, persona: 'aura' });
  assert.equal(dissentRes.heldBoundary, true);
  assert.equal((await listMindLabRuns()).length, 3);

  // 5. Built-in AI control vector scale derivation (only existing verified .gguf files)
  const cvScales = computeControlVectorScales({
    chemistry: { oxytocin: 50, adrenaline: 25, dopamine: 60, cortisol: 30, energy: 90 },
    bias: { creativity: 1.5 },
    bindings: { warmth: { file: 'aura_warmth.gguf', gain: 1.0 }, missing: { file: 'ghost.gguf', gain: 1.0 } },
    availableVectors: [{ name: 'aura_warmth.gguf', path: 'C:/ai/control-vectors/aura_warmth.gguf', bytes: 1024 }],
  });
  assert.equal(cvScales.length, 1);
  assert.deepEqual(cvScales[0], { name: 'aura_warmth.gguf', scale: 0.5, channel: 'warmth' });
});

test('Hardware interoception, learned emotional dynamics, semantic context bridge, intent router, runtime augmentations, and Phoenix protocol work end to end', async () => {
  resetStores();
  resetInteroceptionCache();
  resetEmbeddingDiscovery();
  const baseNow = 1_796_000_000_000;

  // 1. Interoception: thermal pressure + typing WPM cadence -> bounded somatic nudges
  for (let i = 0; i < 10; i++) recordTypingPulse(baseNow + i * 250);
  const somaHot = interpretTelemetrySnapshot(
    {
      gpu: { name: 'RTX Test', temp_c: 86, load_pct: 92, vram_used_mb: 7500, vram_total_mb: 8192, power_w: 240 },
      ram_total_mb: 32768,
      ram_free_mb: 16000,
    },
    null,
    baseNow + 2500
  );
  assert.equal(somaHot.thermalState, 'throttled');
  assert.equal(somaHot.sensationLabel, 'thermal_strain');
  assert.ok(somaHot.typingWpm > 0);
  assert.ok(somaHot.nudge.cortisol > 0 && somaHot.nudge.adrenaline > 0);

  // 2. Dynamic Learning: repeated observations adapt resting baselines & conditioned keyword
  //    triggers (a trigger must lift more than turns without it, so ordinary turns are mixed in)
  for (let i = 0; i < 10; i++) {
    const breakthrough = i % 5 < 3;
    await observeTurnDynamics({
      persona: 'aura',
      userText: breakthrough ? 'architecture breakthrough refactor ship clean interface' : 'quick question about the weather today',
      prevChemistry: { oxytocin: 26, adrenaline: 12, dopamine: 44, cortisol: 14 },
      nextChemistry: breakthrough
        ? { oxytocin: 48, adrenaline: 14, dopamine: 72 - i * 2, cortisol: 12 }
        : { oxytocin: 30, adrenaline: 12, dopamine: 46, cortisol: 14 },
      appraisal: { pleasant: 0.9, novel: 0.8, progress: 0.9, conflict: 0, closeness: 0.85, effort: 0.4 },
      now: baseNow + i * 3_600_000,
    });
  }
  const learned = await getLearnedProfile('aura');
  assert.equal(learned.totalTurns, 10);
  assert.ok(learned.learnedBaselines.dopamine > BASELINE.dopamine, 'high dopamine history raises learned resting baseline');
  assert.ok(Object.keys(learned.learnedTriggers.dopamine).includes('architecture'));
  const nudge = predictTriggerNudge(learned, 'let us design clean architecture');
  assert.ok(nudge.dopamine > 0);
  await resetLearnedDynamics('aura');
  assert.equal((await getLearnedProfile('aura')).totalTurns, 0);

  // 3. Context Bridge: token budgeting & semantic embedding similarity
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'nomic-embed-text:latest' }] }), { status: 200 });
    }
    if (u.endsWith('/api/embeddings')) {
      const body = JSON.parse(init.body || '{}');
      const v = /shader|vulkan/i.test(body.prompt) ? [1, 0, 0] : [0, 1, 0];
      return new Response(JSON.stringify({ embedding: v }), { status: 200 });
    }
    throw new Error(`Unexpected fetch URL: ${u}`);
  };

  try {
    const embShader = await tryEmbedText('vulkan compute shader pipeline', { allowProbe: true });
    assert.deepEqual(embShader, [1, 0, 0]);
    const embStory = await tryEmbedText('quiet tavern dialogue lore', { allowProbe: true });
    assert.deepEqual(embStory, [0, 1, 0]);

    const engShader = await encodeEngram({
      persona: 'aura',
      userText: 'gpu compute pipeline',
      reply: 'descriptors bound cleanly',
      embedding: [1, 0, 0],
      somatic: { sensationLabel: 'focused_compute', gpuTempC: 64, typingWpm: 45 },
      now: baseNow,
    });
    assert.equal(engShader.somatic.sensationLabel, 'focused_compute');

    const semanticHits = await recallEngrams({
      persona: 'aura',
      query: 'unrelated query tokens',
      queryEmbedding: [1, 0, 0],
      somatic: { sensationLabel: 'focused_compute' },
      limit: 2,
      now: baseNow + 1000,
    });
    assert.equal(semanticHits[0]?.id, engShader.id, 'semantic embedding vector must surface matching engram');
  } finally {
    globalThis.fetch = realFetch;
  }

  const budgeted = budgetContextWindow({
    baseSystemPrompt: 'System identity.',
    charter: 'Charter text.',
    augmentationBlock: 'Active augmentation.',
    engrams: [eng => eng, { thought: 'memory alpha' }],
    workingHistory: [
      { role: 'user', content: 'old message '.repeat(120) },
      { role: 'assistant', content: 'old reply '.repeat(120) },
      { role: 'user', content: 'latest user ask' },
    ],
    maxContextTokens: 1300,
    reserveReplyTokens: 900,
  });
  assert.ok(budgeted.messages.some(m => m.content === 'latest user ask'), 'latest user turn must be preserved under tight token budget');
  assert.ok(budgeted.stats.historyDropped >= 1, 'older oversized turns should drop gracefully');

  // 4. Multi-Brain Intent Router & Runtime Augmentations + Control Vector Boosts + NovaAgent Integration
  const codeIntent = classifyTaskIntent('Debug async race condition in Tauri IPC stack trace and refactor schema');
  assert.equal(codeIntent.route, 'code_architecture');
  assert.ok(codeIntent.suggestedAugmentations.includes('precision_debugger'));

  const aiRouted = await classifyTaskIntentWithAi({
    userText: 'Build a dark tavern chapter opening with strong atmosphere',
    ai: { async chat() { return '{"route":"creative_synthesis","confidence":0.95,"reasoning":"Narrative chapter"}'; } },
  });
  assert.equal(aiRouted.route, 'creative_synthesis');
  assert.equal(aiRouted.source, 'ai_classifier');

  await upsertCustomAugmentation({
    id: 'vulkan_lens',
    name: 'Vulkan Kernel Lens',
    directive: 'Inspect GPU synchronization barriers cleanly.',
    temperatureDelta: -0.1,
    channelBoosts: { focus: 0.5, caution: 0.25 },
    memoryTags: ['vulkan', 'barrier'],
    mode: 'pinned',
  });
  let augCfg = await readAugmentationConfig();
  assert.ok(augCfg.cartridges.some(c => c.id === 'vulkan_lens' && c.mode === 'pinned'));

  const composed = await composeTurnAugmentations({
    persona: 'aura',
    userText: 'Debug failing async Rust build error',
  });
  assert.ok(composed.active.some(a => a.id === 'vulkan_lens'));
  assert.ok(composed.active.some(a => a.id === 'precision_debugger'));
  assert.ok(composed.channelBoosts.focus >= 0.8);
  assert.match(composed.directiveBlock, /Vulkan Kernel Lens/);

  const augVectors = computeControlVectorScales({
    chemistry: { oxytocin: 25, adrenaline: 5, dopamine: 40, cortisol: 15, energy: 100 },
    channelBoosts: composed.channelBoosts,
    bindings: { focus: { file: 'focus.gguf', gain: 1.0 } },
    availableVectors: [{ name: 'focus.gguf', path: 'C:/cv/focus.gguf', bytes: 1024 }],
  });
  assert.ok(augVectors[0].scale >= 0.8, 'augmentation channelBoosts must drive --control-vector-scaled output');

  await setCartridgeMode('vulkan_lens', 'off');
  await removeCustomAugmentation('vulkan_lens');
  augCfg = await readAugmentationConfig();
  assert.ok(!augCfg.cartridges.some(c => c.id === 'vulkan_lens'));

  // Test NovaAgent end-to-end with auto-effort steering vs explicit user submenu override
  const seenAgentCalls = [];
  const turnedMeta = [];
  const onMeta = (ev) => turnedMeta.push(ev.detail);
  window.addEventListener('novaura:companion_turn_meta', onMeta);
  try {
    const mockKernel = {
      ipc: makeIpc(),
      wm: { getOpenWindows: () => [] },
      ai: {
        async chat(msgs, opts) {
          seenAgentCalls.push({ msgs, opts });
          if (opts?.jsonSchema) return '{"pleasant":0.8,"novel":0.7,"progress":0.9,"conflict":0,"closeness":0.8,"effort":0.4}';
          return 'Root cause traced.';
        },
      },
    };
    const agent = new NovaAgent();
    agent.init(mockKernel);
    clearReasoningOverride('companion:nova');
    await agent.sendMessage('Debug failing unit test in async function', 'nova');
    assert.equal(seenAgentCalls[0].opts.reasoningEffort, 'high', 'un-overridden Nova turn adopts high effort for debugging intent');
    assert.ok(turnedMeta.length >= 1 && turnedMeta[0].intent.route === 'code_architecture');

    setReasoningConfig({ think: true, reasoningEffort: 'low' }, 'companion:nova');
    await agent.sendMessage('Debug another complex schema bug', 'nova');
    assert.equal(seenAgentCalls[1].opts.reasoningEffort, undefined, 'explicit user submenu override prevents auto effort override');
  } finally {
    window.removeEventListener('novaura:companion_turn_meta', onMeta);
  }

  // 5. Phoenix Protocol: crash safe-boot threshold, Lighthouse 72h, SHA-256 snapshot & tamper protection
  for (let i = 0; i < MAX_CONSECUTIVE_CRASHES; i++) {
    await recordBootAttempt(baseNow + i * 1000);
  }
  const triBoot = await recordBootAttempt(baseNow + 4000);
  assert.equal(triBoot.safeMode, true);
  await markBootHealthy(baseNow + 5000);
  const lighthouseBoot = await recordBootAttempt(baseNow + 5000 + 75 * 3_600_000);
  assert.equal(lighthouseBoot.safeMode, false);
  assert.equal(lighthouseBoot.lighthouseMode, true);

  await mockDb.setSetting('aura_core:aura', { chemistry: { ...createChemistry(baseNow), oxytocin: 77 } });
  const snap = await createSoulSnapshot('aura', baseNow);
  assert.equal(snap.ok, true);
  const checkClean = await verifySoulSnapshot('aura');
  assert.equal(checkClean.valid, true);

  // Tamper test: modify snapshot payload without updating checksum -> verify & restore must catch it!
  const storedBundle = await mockDb.getSetting('aura_core:phoenix_snapshot:aura');
  await mockDb.setSetting('aura_core:phoenix_snapshot:aura', {
    ...storedBundle,
    payload: { ...storedBundle.payload, persona: 'tampered' },
  });
  const checkTampered = await verifySoulSnapshot('aura');
  assert.equal(checkTampered.valid, false);
  await assert.rejects(() => restoreSoulSnapshot('aura'), /checksum mismatch/i);

  // Valid bundle restores overwritten chemistry cleanly
  await mockDb.setSetting('aura_core:phoenix_snapshot:aura', storedBundle);
  await mockDb.setSetting('aura_core:aura', { chemistry: createChemistry(baseNow) });
  await restoreSoulSnapshot('aura');
  const restored = await mockDb.getSetting('aura_core:aura');
  assert.equal(restored.chemistry.oxytocin, 77);
});
