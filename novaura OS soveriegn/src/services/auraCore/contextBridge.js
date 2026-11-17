// Aura Core: Working-Memory vs. Permanent Engram Context Bridge & Local Embeddings
// (Port of Aura_ContextManager.py + Torch/Firebase-free local embeddings for Aura_RAGSystem.py).
// Budgets working conversation turns cleanly against permanent engrams and RAG hits so local
// models preserve recent dialogue intact without truncation or SHA-256 fake vector noise.
//
// Embeddings come from a local model the person already runs, in this order:
//   1. LM Studio, only an embedding model that is already loaded. LM Studio can load a model
//      on request and may unload the chat model to make room, so we never ask it to.
//   2. Ollama, a model whose name marks it as an embedding model.
// The built-in llama.cpp server is skipped: it holds one model at a time, so an embedding
// request would swap out her chat model.
// Discovery is off until the app turns it on (NovaKernel does at boot), so tests and library
// use never reach a live local server.

import { probeLocalAi, queryLocalAi } from '../nativeService.js';

const EMBED_CACHE = new Map();
const MAX_EMBED_CACHE = 240;
const OFFLINE_BACKOFF_MS = 45_000;
const BACKEND_TTL_MS = 5 * 60_000;
const EMBED_NAME = /embed|(^|[-_/])bge|minilm|(^|[-_/])e5[-_]|(^|[-_/])gte[-_]|nomic/i;

let discoveryEnabled = false;
let cachedEmbedBackend = null; // { runtime, port, model, id, checkedAt }
let lastOfflineAt = 0;

export function estimateTokens(text = '') {
  const s = String(text || '');
  if (!s) return 0;
  return Math.max(1, Math.ceil(s.length / 3.8));
}

export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function hashCacheKey(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${text.length}:${h >>> 0}`;
}

function storeEmbedCache(key, value) {
  if (EMBED_CACHE.size >= MAX_EMBED_CACHE) {
    const oldest = EMBED_CACHE.keys().next().value;
    if (oldest !== undefined) EMBED_CACHE.delete(oldest);
  }
  EMBED_CACHE.set(key, value);
}

/** Turn local-embedding discovery on or off (the app turns it on at boot). */
export function setEmbeddingDiscovery(enabled) {
  discoveryEnabled = Boolean(enabled);
  if (!discoveryEnabled) cachedEmbedBackend = null;
}

export function isEmbeddingDiscoveryEnabled() {
  return discoveryEnabled;
}

async function findLmStudioEmbedder(now) {
  const lm = await probeLocalAi(1234, '/v1/models').catch(() => null);
  if (!lm?.online) return null;
  // The native endpoint says which models are embedding models and which are loaded.
  const res = await queryLocalAi(1234, '/api/v0/models', 'GET').catch(() => null);
  const rows = Array.isArray(res?.data) ? res.data : [];
  const loaded = rows.find(m => m?.id && (m.type === 'embeddings' || EMBED_NAME.test(m.id)) && m.state === 'loaded');
  if (!loaded) return null;
  return { runtime: 'lmstudio', port: 1234, model: loaded.id, id: `lmstudio:${loaded.id}`, checkedAt: now };
}

async function findOllamaEmbedder(now) {
  const ol = await probeLocalAi(11434, '/api/tags').catch(() => null);
  if (!ol?.online || !Array.isArray(ol.models)) return null;
  const model = ol.models.find(m => EMBED_NAME.test(String(m)));
  if (!model) return null;
  return { runtime: 'ollama', port: 11434, model, id: `ollama:${model}`, checkedAt: now };
}

async function discoverEmbeddingEndpoint() {
  const now = Date.now();
  if (cachedEmbedBackend && (now - cachedEmbedBackend.checkedAt < BACKEND_TTL_MS)) {
    return cachedEmbedBackend;
  }
  if (lastOfflineAt && (now - lastOfflineAt < OFFLINE_BACKOFF_MS)) {
    return null;
  }
  cachedEmbedBackend = await findLmStudioEmbedder(now) || await findOllamaEmbedder(now);
  if (!cachedEmbedBackend) lastOfflineAt = now;
  return cachedEmbedBackend;
}

/** The embedding model in use right now ("lmstudio:<id>" / "ollama:<id>"), or null. */
export function getActiveEmbeddingModel() {
  return cachedEmbedBackend?.id || null;
}

/**
 * A real local semantic embedding as { vector, model }, or null when no embedding model is
 * running (never a fabricated hash vector). Vectors from different models are not comparable,
 * so callers store `model` beside the vector.
 */
export async function embedText(text = '', { allowProbe = discoveryEnabled, embedFn = null, model = 'custom' } = {}) {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) return null;

  if (typeof embedFn === 'function') {
    const vec = await embedFn(clean).catch(() => null);
    return Array.isArray(vec) && vec.length > 0 ? { vector: vec, model } : null;
  }
  if (!allowProbe) return null;

  const backend = await discoverEmbeddingEndpoint();
  if (!backend) return null;

  const key = `${backend.id}|${hashCacheKey(clean)}`;
  if (EMBED_CACHE.has(key)) return EMBED_CACHE.get(key);

  try {
    let vec = null;
    if (backend.runtime === 'ollama') {
      const res = await queryLocalAi(backend.port, '/api/embeddings', 'POST', { model: backend.model, prompt: clean });
      vec = res?.embedding;
    } else {
      const res = await queryLocalAi(backend.port, '/v1/embeddings', 'POST', { model: backend.model, input: clean });
      vec = res?.data?.[0]?.embedding;
    }
    if (Array.isArray(vec) && vec.length > 0) {
      const out = { vector: vec, model: backend.id };
      storeEmbedCache(key, out);
      return out;
    }
  } catch {
    lastOfflineAt = Date.now();
    cachedEmbedBackend = null;
  }
  return null;
}

/** The vector alone (see embedText). */
export async function tryEmbedText(text = '', options = {}) {
  const out = await embedText(text, options);
  return out ? out.vector : null;
}

export function resetEmbeddingDiscovery() {
  EMBED_CACHE.clear();
  cachedEmbedBackend = null;
  lastOfflineAt = 0;
}

/**
 * Budget permanent memories (engrams), long-term RAG memories, cognitive augmentations, and
 * working conversation history inside the model's context ceiling while keeping the latest
 * user turns intact.
 */
export function budgetContextWindow({
  baseSystemPrompt = '',
  charter = '',
  augmentationBlock = '',
  continuityBlock = '',
  engrams = [],
  workingHistory = [],
  maxContextTokens = 6144,
  reserveReplyTokens = 1024,
} = {}) {
  const promptBudget = Math.max(512, Number(maxContextTokens || 6144) - Number(reserveReplyTokens || 1024));
  const fixedSections = [baseSystemPrompt, charter].filter(Boolean).join('\n\n');
  let usedTokens = estimateTokens(fixedSections);

  const selectedAug = [];
  if (augmentationBlock) {
    const augTok = estimateTokens(augmentationBlock);
    if (usedTokens + augTok < promptBudget * 0.65) {
      selectedAug.push(augmentationBlock);
      usedTokens += augTok;
    }
  }

  // Long-term RAG memories: up to ~20% of the budget, whole lines only, most relevant first.
  let continuityText = '';
  let continuityLines = 0;
  if (continuityBlock) {
    const cap = Math.floor(promptBudget * 0.2);
    const kept = [];
    let cost = 0;
    for (const line of String(continuityBlock).split('\n')) {
      const c = estimateTokens(line) + 1;
      if (cost + c > cap || usedTokens + cost + c >= promptBudget * 0.7) break;
      kept.push(line);
      cost += c;
      if (line.startsWith('•')) continuityLines++;
    }
    if (continuityLines > 0) {
      continuityText = kept.join('\n');
      usedTokens += cost;
    }
  }

  // Reserve up to ~25% of total prompt budget for permanent engram recall, greedy by relevance order
  const memoryCap = Math.max(120, Math.floor(promptBudget * 0.25));
  let memoryUsed = 0;
  const keptEngrams = [];
  for (const eng of (Array.isArray(engrams) ? engrams : [])) {
    const snippet = String(eng?.thought || eng || '').trim().slice(0, 220);
    if (!snippet) continue;
    const cost = estimateTokens(snippet) + 4;
    if (memoryUsed + cost <= memoryCap && usedTokens + cost < promptBudget * 0.72) {
      keptEngrams.push(eng);
      memoryUsed += cost;
      usedTokens += cost;
    }
  }

  const engramLine = (e) => {
    const text = String(e?.thought || e).slice(0, 220);
    return e?.kind === 'reflection' ? `- (your own earlier reflection) ${text}` : `- ${text}`;
  };
  const engramText = keptEngrams.length
    ? `\nAssociative continuity (recalled impressions):\n${keptEngrams.map(engramLine).join('\n')}\n`
    : '';

  const systemPrompt = [fixedSections, ...selectedAug, continuityText, engramText].filter(Boolean).join('\n\n').trim();
  const sysTokens = estimateTokens(systemPrompt);
  let remainingForHistory = Math.max(128, promptBudget - sysTokens);

  const history = Array.isArray(workingHistory) ? [...workingHistory] : [];
  const keptHistory = [];
  let dropped = 0;

  // Walk newest -> oldest so recent turns and especially the active user turn always fit first
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTok = estimateTokens(msg?.content || '') + 8;
    if (keptHistory.length === 0 || msgTok <= remainingForHistory) {
      keptHistory.unshift(msg);
      remainingForHistory -= msgTok;
      usedTokens += msgTok;
    } else {
      dropped = i + 1;
      break;
    }
  }

  // Keep strict alternating invariant (never begin sliced history with an assistant turn)
  while (keptHistory.length > 1 && keptHistory[0]?.role === 'assistant') {
    const removed = keptHistory.shift();
    usedTokens -= estimateTokens(removed?.content || '') + 8;
    dropped++;
  }

  return {
    systemPrompt,
    messages: keptHistory,
    stats: {
      estimatedTokens: usedTokens,
      budgetTokens: promptBudget,
      engramsIncluded: keptEngrams.length,
      memoriesIncluded: continuityLines,
      historyKept: keptHistory.length,
      historyDropped: dropped,
    },
  };
}

export default {
  estimateTokens,
  cosineSimilarity,
  embedText,
  tryEmbedText,
  setEmbeddingDiscovery,
  isEmbeddingDiscoveryEnabled,
  getActiveEmbeddingModel,
  resetEmbeddingDiscovery,
  budgetContextWindow,
};
