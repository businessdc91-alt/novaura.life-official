// Aura Core: Working-Memory vs. Permanent Engram Context Bridge & Local Embeddings
// (Port of Aura_ContextManager.py + Torch/Firebase-free local embeddings for Aura_RAGSystem.py).
// Budgets working conversation turns cleanly against permanent engrams and RAG hits so local
// models preserve recent dialogue intact without truncation or SHA-256 fake vector noise.

import { probeLocalAi, queryLocalAi } from '../nativeService.js';

const EMBED_CACHE = new Map();
const MAX_EMBED_CACHE = 240;
const OFFLINE_BACKOFF_MS = 45_000;

let cachedEmbedBackend = null; // { runtime, port, model, checkedAt }
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

function storeEmbedCache(key, vector) {
  if (EMBED_CACHE.size >= MAX_EMBED_CACHE) {
    const oldest = EMBED_CACHE.keys().next().value;
    if (oldest !== undefined) EMBED_CACHE.delete(oldest);
  }
  EMBED_CACHE.set(key, vector);
}

async function discoverEmbeddingEndpoint() {
  const now = Date.now();
  if (cachedEmbedBackend && (now - cachedEmbedBackend.checkedAt < 60_000)) {
    return cachedEmbedBackend;
  }
  if (lastOfflineAt && (now - lastOfflineAt < OFFLINE_BACKOFF_MS)) {
    return null;
  }

  // 1. Ollama dedicated embedding models
  try {
    const ol = await probeLocalAi(11434, '/api/tags');
    if (ol?.online && Array.isArray(ol.models)) {
      const embedModel = ol.models.find(m => /embed|bge|minilm|e5/i.test(m));
      if (embedModel) {
        cachedEmbedBackend = { runtime: 'ollama', port: 11434, model: embedModel, checkedAt: now };
        return cachedEmbedBackend;
      }
    }
  } catch {}

  // 2. LM Studio loaded embedding models
  try {
    const lm = await probeLocalAi(1234, '/v1/models');
    if (lm?.online && Array.isArray(lm.models)) {
      const embedModel = lm.models.find(m => /embed|bge|minilm|e5/i.test(m));
      if (embedModel) {
        cachedEmbedBackend = { runtime: 'lmstudio', port: 1234, model: embedModel, checkedAt: now };
        return cachedEmbedBackend;
      }
    }
  } catch {}

  lastOfflineAt = now;
  return null;
}

/**
 * Generate a real local semantic embedding when an embedding model is loaded on Ollama/LM Studio,
 * or return null cleanly (never fabricating SHA-256 hash vectors).
 */
export async function tryEmbedText(text = '', { allowProbe = false, embedFn = null } = {}) {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) return null;

  const key = hashCacheKey(clean);
  if (EMBED_CACHE.has(key)) {
    return EMBED_CACHE.get(key);
  }

  if (typeof embedFn === 'function') {
    const vec = await embedFn(clean).catch(() => null);
    if (Array.isArray(vec) && vec.length > 0) {
      storeEmbedCache(key, vec);
      return vec;
    }
    return null;
  }

  if (!allowProbe) return null;

  const backend = await discoverEmbeddingEndpoint();
  if (!backend) return null;

  try {
    if (backend.runtime === 'ollama') {
      const res = await queryLocalAi(backend.port, '/api/embeddings', 'POST', {
        model: backend.model,
        prompt: clean,
      });
      if (Array.isArray(res?.embedding) && res.embedding.length > 0) {
        storeEmbedCache(key, res.embedding);
        return res.embedding;
      }
    } else {
      const res = await queryLocalAi(backend.port, '/v1/embeddings', 'POST', {
        model: backend.model,
        input: clean,
      });
      const vec = res?.data?.[0]?.embedding;
      if (Array.isArray(vec) && vec.length > 0) {
        storeEmbedCache(key, vec);
        return vec;
      }
    }
  } catch {
    lastOfflineAt = Date.now();
    cachedEmbedBackend = null;
  }
  return null;
}

export function resetEmbeddingDiscovery() {
  EMBED_CACHE.clear();
  cachedEmbedBackend = null;
  lastOfflineAt = 0;
}

/**
 * Budget permanent memories (engrams), cognitive augmentations, and working conversation history
 * inside the model's context ceiling while keeping the latest user turns intact.
 */
export function budgetContextWindow({
  baseSystemPrompt = '',
  charter = '',
  augmentationBlock = '',
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

  const engramText = keptEngrams.length
    ? `\nAssociative continuity (recalled impressions):\n${keptEngrams.map(e => `- ${String(e.thought || e).slice(0, 220)}`).join('\n')}\n`
    : '';

  const systemPrompt = [fixedSections, ...selectedAug, engramText].filter(Boolean).join('\n\n').trim();
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
      historyKept: keptHistory.length,
      historyDropped: dropped,
    },
  };
}

export default {
  estimateTokens,
  cosineSimilarity,
  tryEmbedText,
  resetEmbeddingDiscovery,
  budgetContextWindow,
};

