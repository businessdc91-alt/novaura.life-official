// Semantic memory: local embeddings (only from a model already loaded, never by asking
// LM Studio to load one), persona-scoped RAG, relevance before importance, and companion
// turns that budget RAG inside the context window instead of adding it on top.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockDb, installBrowserGlobals } from './helpers/mockDb.mjs';

installBrowserGlobals();
const { db, memoryRows, settings } = createMockDb();
mock.module('../../src/database/sovereignDatabase.js', { defaultExport: db, namedExports: { db } });

// Fake local runtimes. Embeddings map words to concepts so "sea" and "ocean" land together.
const runtime = { lmModels: [], ollamaOnline: false, posts: [] };
const CONCEPTS = [/\b(sea|ocean|waves|tide)/i, /\b(rust|compile|cargo)/i, /\b(lighthouse|keeper)/i];
const embedOf = (text) => CONCEPTS.map(re => (re.test(text) ? 1 : 0)).concat([0.05]);
mock.module('../../src/services/nativeService.js', {
  namedExports: {
    isTauriNative: () => false,
    probeLocalAi: async (port) => {
      if (port === 1234) return { online: true, models: runtime.lmModels.map(m => m.id) };
      if (port === 11434) return { online: runtime.ollamaOnline, models: runtime.ollamaOnline ? ['nomic-embed-text:latest'] : [] };
      return { online: false, models: [] };
    },
    queryLocalAi: async (port, path, method, body) => {
      if (port === 1234 && path === '/api/v0/models') return { data: runtime.lmModels };
      if (method === 'POST') {
        runtime.posts.push({ port, path, model: body?.model });
        if (path === '/v1/embeddings') return { data: [{ embedding: embedOf(body.input) }] };
        if (path === '/api/embeddings') return { embedding: embedOf(body.prompt) };
      }
      throw new Error(`unexpected ${method} ${path}`);
    },
  },
});

const bridge = await import('../../src/services/auraCore/contextBridge.js');
const rag = await import('../../src/services/sovereignRagService.js');
const { NovaAgent } = await import('../../src/kernel/subsystems/NovaAgent.js');

function resetAll() {
  memoryRows.length = 0;
  settings.clear();
  runtime.posts.length = 0;
  runtime.ollamaOnline = false;
  runtime.lmModels = [];
  bridge.resetEmbeddingDiscovery();
  bridge.setEmbeddingDiscovery(true);
}

test('embedding discovery is off until the app turns it on', async () => {
  resetAll();
  bridge.setEmbeddingDiscovery(false);
  runtime.lmModels = [{ id: 'text-embedding-nomic-embed-text-v1.5', type: 'embeddings', state: 'loaded' }];
  assert.equal(await bridge.embedText('the sea'), null);
  assert.equal(runtime.posts.length, 0);
});

test('only an LM Studio embedding model that is already loaded is used; LM Studio is never asked to load one', async () => {
  resetAll();
  runtime.lmModels = [
    { id: 'gemma-4-e4b', type: 'llm', state: 'loaded' },
    { id: 'text-embedding-nomic-embed-text-v1.5', type: 'embeddings', state: 'not-loaded' },
  ];
  assert.equal(await bridge.embedText('the sea'), null);
  assert.equal(runtime.posts.length, 0, 'no embedding request may trigger a load');

  resetAll();
  runtime.lmModels = [
    { id: 'gemma-4-e4b', type: 'llm', state: 'loaded' },
    { id: 'text-embedding-nomic-embed-text-v1.5', type: 'embeddings', state: 'loaded' },
  ];
  const out = await bridge.embedText('the sea');
  assert.deepEqual(out, { vector: embedOf('the sea'), model: 'lmstudio:text-embedding-nomic-embed-text-v1.5' });
  assert.equal(runtime.posts[0].model, 'text-embedding-nomic-embed-text-v1.5');
});

test('LM Studio comes before Ollama when both have an embedding model', async () => {
  resetAll();
  runtime.ollamaOnline = true;
  runtime.lmModels = [{ id: 'text-embedding-bge-small', type: 'embeddings', state: 'loaded' }];
  const out = await bridge.embedText('waves');
  assert.equal(out.model, 'lmstudio:text-embedding-bge-small');
});

test("Aura's own memories stay out of other companions' context", async () => {
  resetAll();
  bridge.setEmbeddingDiscovery(false);
  await db.memories.add({ category: 'aura_engram', title: 'Aura Engram', content: 'the lighthouse keeper story we wrote together', keywords: ['lighthouse', 'keeper', 'story'], importance: 5, metadata: { engramId: 'eng_1', persona: 'aura' }, updated_at: '2026-11-01' });
  await rag.rememberMemory({ category: 'fact', title: 'Paint', content: 'The lighthouse in the novel is painted blue' });

  const forNova = await rag.retrieveRelevantMemories('tell me about the lighthouse', { persona: 'nova' });
  assert.deepEqual(forNova.map(m => m.category), ['fact']);
  const forWriting = await rag.retrieveRelevantMemories('tell me about the lighthouse');
  assert.deepEqual(forWriting.map(m => m.category), ['fact']);
  const forAura = await rag.retrieveRelevantMemories('tell me about the lighthouse', { persona: 'aura' });
  assert.equal(forAura.length, 2);
  const deduped = await rag.retrieveRelevantMemories('tell me about the lighthouse', { persona: 'aura', excludeEngramIds: ['eng_1'] });
  assert.deepEqual(deduped.map(m => m.category), ['fact']);
});

test('an unrelated memory is not returned just because it is important', async () => {
  resetAll();
  bridge.setEmbeddingDiscovery(false);
  await rag.rememberMemory({ category: 'preference', content: 'Favorite color is teal', importance: 5 });
  assert.deepEqual(await rag.retrieveRelevantMemories('how do I compile the rust crate'), []);
});

test('without embeddings, a full lexical match scores at the original strength', async () => {
  resetAll();
  bridge.setEmbeddingDiscovery(false);
  await rag.rememberMemory({ category: 'workflow', content: 'rust compile flags for the release build', importance: 3 });
  const [hit] = await rag.retrieveRelevantMemories('rust compile');
  assert.ok(hit && hit.score >= 0.9, `score ${hit?.score}`);
});

test('with a local embedding model, a memory sharing no words with the question is still found', async () => {
  resetAll();
  runtime.lmModels = [{ id: 'text-embedding-nomic-embed-text-v1.5', type: 'embeddings', state: 'loaded' }];
  const saved = await rag.rememberMemory({ category: 'preference', content: 'I love the ocean at night' });
  await rag.flushMemoryEmbeddings();
  const stored = memoryRows.find(r => r.id === saved.id);
  assert.ok(Array.isArray(stored.embedding), 'the memory was embedded in the background');
  assert.equal(stored.embeddingModel, 'lmstudio:text-embedding-nomic-embed-text-v1.5');

  const hits = await rag.retrieveRelevantMemories('what do you think of the sea?');
  assert.equal(hits[0]?.id, saved.id);
});

test('memories saved before an embedding model was available are embedded later', async () => {
  resetAll();
  bridge.setEmbeddingDiscovery(false);
  await rag.rememberMemory({ category: 'lore', content: 'The tide clock in chapter three runs backwards' });
  await rag.flushMemoryEmbeddings();
  assert.equal(memoryRows[0].embedding, undefined);

  bridge.setEmbeddingDiscovery(true);
  runtime.lmModels = [{ id: 'text-embedding-nomic-embed-text-v1.5', type: 'embeddings', state: 'loaded' }];
  const result = await rag.backfillMemoryEmbeddings({ limit: 10 });
  assert.equal(result.embedded, 1);
  assert.ok(Array.isArray(memoryRows[0].embedding));
});

test('her engrams get vectors while idle, and are then recalled by meaning', async () => {
  resetAll();
  const engrams = await import('../../src/services/auraCore/engramMemory.js');
  bridge.setEmbeddingDiscovery(false);
  await engrams.encodeEngram({ persona: 'aura', userText: 'I walked along the ocean at dusk', reply: 'the waves sounded like breathing' });
  assert.equal((await engrams.listEngrams('aura'))[0].embedding, undefined);

  bridge.setEmbeddingDiscovery(true);
  runtime.lmModels = [{ id: 'text-embedding-nomic-embed-text-v1.5', type: 'embeddings', state: 'loaded' }];
  const result = await engrams.backfillEngramEmbeddings('aura', { limit: 5 });
  assert.equal(result.embedded, 1);
  const [stored] = await engrams.listEngrams('aura');
  assert.equal(stored.embeddingModel, 'lmstudio:text-embedding-nomic-embed-text-v1.5');

  const q = await bridge.embedText('the sea');
  const hits = await engrams.recallEngrams({ persona: 'aura', query: 'the sea', queryEmbedding: q.vector, queryEmbeddingModel: q.model, limit: 1 });
  assert.equal(hits[0]?.id, stored.id);
});

function makeKernel(calls, reply = 'Here with you.') {
  const handlers = new Map();
  return {
    ipc: { on: (n, fn) => handlers.set(n, fn), emit: () => {} },
    wm: { getOpenWindows: () => [] },
    ai: {
      getPersonaProviderChain: () => ['lmstudio'],
      async chat(messages, opts) {
        calls.push({ messages, opts });
        if (opts?.jsonSchema) return '{"pleasant":0.8,"novel":0.4,"progress":0.5,"conflict":0,"closeness":0.8,"effort":0.3}';
        return reply;
      },
    },
  };
}

test('a companion turn carries relevant RAG memories inside its budget and turns off the add-on RAG', async () => {
  resetAll();
  bridge.setEmbeddingDiscovery(false);
  await rag.rememberMemory({ category: 'fact', title: 'Pet', content: 'The operator has a cat named Biscuit' });
  await db.memories.add({ category: 'aura_engram', title: 'Aura Engram', content: 'we laughed about Biscuit knocking over the cat tree', keywords: ['biscuit', 'cat', 'tree'], importance: 5, metadata: { engramId: 'eng_x', persona: 'aura' }, updated_at: '2026-11-02' });

  const calls = [];
  const agent = new NovaAgent();
  agent.init(makeKernel(calls));
  await agent.sendMessage('how is my cat Biscuit doing?', 'nova');
  const novaCall = calls.find(c => !c.opts?.jsonSchema);
  assert.equal(novaCall.opts.useRag, false, 'RAG is already in the prompt; the AI layer must not add it again');
  const novaSystem = novaCall.messages[0].content;
  assert.match(novaSystem, /cat named Biscuit/);
  assert.doesNotMatch(novaSystem, /cat tree/, "Nova must not see Aura's memory");
});
