// sovereignRagService.js — Sovereign Persistent RAG Memory & Personalization Engine
// Features:
// 1. Air-gapped Dexie IndexedDB storage for long-term personalization, character lore, writing style & facts
// 2. Hybrid Retrieval: keyword overlap + TF cosine, plus local semantic embeddings when an
//    embedding model is running (LM Studio or Ollama; see auraCore/contextBridge.js)
// 3. Automated Context Injection for LLM continuity across sessions
// 4. Memory management (CRUD, keyword indexing, importance weighting, usage tracking)
//
// Rules the retrieval keeps:
//   - A memory must be relevant to the question before importance counts; importance ranks
//     relevant memories, it never makes an unrelated one relevant.
//   - A companion's own engram memories (category `aura_engram`) are returned only for that
//     companion, never to another companion or a writing tool.
//   - Vectors from different embedding models are never compared.

import { db } from '../database/sovereignDatabase.js';
import { cosineSimilarity, embedText, getActiveEmbeddingModel } from './auraCore/contextBridge.js';

const ENGRAM_CATEGORY = 'aura_engram';
const MIN_RELEVANCE = 0.08;
const pendingEmbeds = new Set();

/**
 * Tokenize text into normalized alphanumeric keywords
 */
export function extractKeywords(text = '') {
  if (!text) return [];
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'were', 'which',
    'what', 'when', 'where', 'there', 'their', 'about', 'would', 'could', 'should',
    'been', 'then', 'than', 'into', 'just', 'more', 'some', 'like', 'them', 'they',
    'you', 'your', 'are', 'was', 'how', 'tell', 'think', 'does', 'doing',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Compute Term Frequency vector for text
 */
function computeTf(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  const total = tokens.length || 1;
  for (const t in tf) {
    tf[t] = tf[t] / total;
  }
  return tf;
}

/**
 * Cosine similarity between two frequency vectors
 */
function vectorCosine(v1, v2) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const k in v1) {
    normA += v1[k] * v1[k];
    if (v2[k]) {
      dot += v1[k] * v2[k];
    }
  }
  for (const k in v2) {
    normB += v2[k] * v2[k];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const memoryText = (m) => `${m?.title || ''} ${m?.content || ''}`.trim();

/** Embed one stored memory (when an embedding model is running) and save the vector beside it. */
async function embedStoredMemory(id, text) {
  const out = await embedText(text).catch(() => null);
  if (!out) return false;
  await db.memories.update(Number(id), { embedding: out.vector, embeddingModel: out.model });
  return true;
}

function embedInBackground(id, text) {
  const job = embedStoredMemory(id, text).catch(() => false);
  pendingEmbeds.add(job);
  job.finally(() => pendingEmbeds.delete(job));
  return job;
}

/** Wait for background embedding of recently saved memories (used by tests and shutdown). */
export async function flushMemoryEmbeddings() {
  await Promise.all([...pendingEmbeds]);
}

/**
 * Store a new persistent memory into the Sovereign Vault
 */
export async function rememberMemory({
  category = 'preference', // 'preference' | 'style' | 'character' | 'lore' | 'fact' | 'workflow'
  title,
  content,
  importance = 3, // 1 to 5
  metadata = {},
}) {
  if (!content?.trim()) {
    throw new Error('Memory content cannot be empty.');
  }

  const generatedTitle = title || content.slice(0, 48).trim() + '...';
  const keywords = Array.from(new Set(extractKeywords(`${generatedTitle} ${content}`)));

  const record = {
    category,
    title: generatedTitle,
    content: content.trim(),
    keywords,
    importance: Math.max(1, Math.min(5, Number(importance) || 3)),
    usageCount: 0,
    lastAccessed: new Date().toISOString(),
    metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const id = await db.memories.add(record);
    // Semantic vector in the background: saving never waits on a local model.
    embedInBackground(id, `${generatedTitle} ${record.content}`);
    return { id, ...record };
  } catch (err) {
    console.error('[SovereignRAG] Failed to write memory:', err);
    throw err;
  }
}

/**
 * Update an existing memory
 */
export async function updateMemory(id, updates) {
  const existing = await db.memories.get(Number(id));
  if (!existing) throw new Error(`Memory with ID ${id} not found.`);

  const content = updates.content !== undefined ? updates.content : existing.content;
  const title = updates.title !== undefined ? updates.title : existing.title;
  const keywords = Array.from(new Set(extractKeywords(`${title} ${content}`)));
  const textChanged = content !== existing.content || title !== existing.title;

  const patch = {
    ...updates,
    keywords,
    // The old vector described the old text.
    ...(textChanged ? { embedding: null, embeddingModel: null } : {}),
    updated_at: new Date().toISOString(),
  };

  await db.memories.update(Number(id), patch);
  if (textChanged) embedInBackground(id, `${title} ${content}`);
  return { ...existing, ...patch };
}

/**
 * Delete a memory from local vault
 */
export async function deleteMemory(id) {
  return await db.memories.delete(Number(id));
}

/**
 * Retrieve all stored memories, optionally filtered by category
 */
export async function getAllMemories(category = null) {
  try {
    let query = db.memories;
    if (category && category !== 'all') {
      return await query.where('category').equals(category).reverse().sortBy('updated_at');
    }
    return await query.reverse().sortBy('updated_at');
  } catch (err) {
    console.warn('[SovereignRAG] Read failed:', err);
    return [];
  }
}

/** Whether a memory may be shown in this persona's context. */
function visibleTo(mem, persona, excludeEngramIds) {
  if (mem?.category !== ENGRAM_CATEGORY) return true;
  const owner = String(mem?.metadata?.persona || '').toLowerCase();
  if (!persona || owner !== String(persona).toLowerCase()) return false;
  return !excludeEngramIds.has(mem?.metadata?.engramId);
}

/**
 * Hybrid Semantic & Lexical RAG Retrieval Engine
 * Finds the most relevant memories for a prompt to ensure personalization and continuity.
 */
export async function retrieveRelevantMemories(queryText, options = {}) {
  const {
    limit = 4,
    category = null,
    minScore = 0.12,
    persona = null,
    excludeEngramIds = [],
  } = options;

  if (!queryText || !queryText.trim()) return [];

  const allMemories = await getAllMemories(category);
  if (!allMemories || allMemories.length === 0) return [];
  const excluded = new Set(excludeEngramIds || []);
  const candidates = allMemories.filter(m => visibleTo(m, persona, excluded));
  if (candidates.length === 0) return [];

  const queryTokens = extractKeywords(queryText);
  const queryTf = computeTf(queryTokens);
  const queryEmbedding = await embedText(queryText).catch(() => null);

  const scoredMemories = [];

  for (const mem of candidates) {
    // 1. Keyword overlap and TF cosine
    const memTokens = mem.keywords || extractKeywords(memoryText(mem));
    const memTf = computeTf(memTokens);
    const lowerContent = String(mem.content || '').toLowerCase();

    let matchCount = 0;
    for (const t of queryTokens) {
      if (mem.keywords?.includes(t) || lowerContent.includes(t)) {
        matchCount++;
      }
    }
    const overlapScore = queryTokens.length ? matchCount / queryTokens.length : 0;
    const lexicalCosine = queryTokens.length ? vectorCosine(queryTf, memTf) : 0;

    // 2. Semantic similarity, only between vectors from the same embedding model
    const comparable = queryEmbedding && Array.isArray(mem.embedding) && mem.embedding.length > 0
      && (!mem.embeddingModel || mem.embeddingModel === queryEmbedding.model);
    const embedCosine = comparable ? Math.max(0, cosineSimilarity(queryEmbedding.vector, mem.embedding)) : 0;

    // 3. Relevance first. With a semantic vector on both sides, meaning carries the most
    //    weight; without one, the original lexical weights apply unchanged.
    const relevance = comparable
      ? (overlapScore * 0.35) + (lexicalCosine * 0.2) + (embedCosine * 0.45)
      : (overlapScore * 0.55) + (lexicalCosine * 0.35);
    if (relevance < MIN_RELEVANCE) continue;

    // 4. Importance (1-5) ranks relevant memories; it cannot make an unrelated one relevant.
    const importanceWeight = (mem.importance || 3) * 0.05;
    const finalScore = relevance + importanceWeight;

    if (finalScore >= minScore) {
      scoredMemories.push({
        ...mem,
        score: finalScore,
      });
    }
  }

  // Sort descending by score
  scoredMemories.sort((a, b) => b.score - a.score);
  const topMemories = scoredMemories.slice(0, limit);

  // Update access stats asynchronously for top hits
  for (const hit of topMemories) {
    db.memories.update(hit.id, {
      usageCount: (hit.usageCount || 0) + 1,
      lastAccessed: new Date().toISOString(),
    }).catch(() => {});
  }

  return topMemories;
}

/**
 * Embed stored memories that have no vector yet (or one from a different model), a few at a
 * time. The heartbeat calls this while she is idle, so memories saved before an embedding
 * model was running become searchable by meaning.
 */
export async function backfillMemoryEmbeddings({ limit = 12 } = {}) {
  const probe = await embedText('memory').catch(() => null);
  if (!probe) return { embedded: 0, pending: 0, model: null };
  const model = probe.model || getActiveEmbeddingModel();
  const all = await getAllMemories();
  const missing = all.filter(m => !Array.isArray(m.embedding) || !m.embedding.length || (m.embeddingModel && m.embeddingModel !== model));
  let embedded = 0;
  for (const mem of missing.slice(0, Math.max(0, limit))) {
    if (await embedStoredMemory(mem.id, memoryText(mem)).catch(() => false)) embedded++;
  }
  return { embedded, pending: Math.max(0, missing.length - embedded), model };
}

const CATEGORY_LABEL = { [ENGRAM_CATEGORY]: 'YOUR MEMORY' };

/**
 * Formats retrieved memories into a prompt context block ready for LLM consumption
 */
export async function buildContinuityContext(queryText, options = {}) {
  const relevant = await retrieveRelevantMemories(queryText, options);
  if (!relevant || relevant.length === 0) {
    return {
      memories: [],
      contextString: '',
    };
  }

  const lines = [
    '=== [SOVEREIGN CONTINUITY & PERSONALIZATION MEMORY (RAG)] ===',
    'The following established memories were retrieved from the user\'s private sovereign vault.',
    'Always preserve continuity with these characters, world lore, rules, and user preferences:',
  ];

  for (const m of relevant) {
    const label = CATEGORY_LABEL[m.category] || String(m.category || 'memory').toUpperCase();
    lines.push(`• [${label}] ${m.title}: ${m.content}`);
  }
  lines.push('============================================================\n');

  return {
    memories: relevant,
    contextString: lines.join('\n'),
  };
}

/**
 * Heuristic auto-extractor: scans user messages for recurring rules or facts to remember
 */
export function detectPotentialMemories(text = '') {
  const triggers = [
    { regex: /(?:always remember|remember that|keep in mind that)\s+([^.!?\n]+)/i, category: 'preference' },
    { regex: /(?:my character is named|character named|protagonist is)\s+([^.!?\n]+)/i, category: 'character' },
    { regex: /(?:in this world|in this story|lore is|universe rule is)\s+([^.!?\n]+)/i, category: 'lore' },
    { regex: /(?:my writing style is|write in the style of|prefer tone of)\s+([^.!?\n]+)/i, category: 'style' },
  ];

  const found = [];
  for (const t of triggers) {
    const match = text.match(t.regex);
    if (match && match[1]) {
      found.push({
        category: t.category,
        content: match[1].trim(),
        title: match[1].slice(0, 36).trim() + '...',
      });
    }
  }
  return found;
}

export const sovereignRag = {
  remember: rememberMemory,
  rememberMemory,
  updateMemory,
  deleteMemory,
  getAllMemories,
  retrieveRelevantMemories,
  backfillMemoryEmbeddings,
  flushMemoryEmbeddings,
  buildContinuityContext,
  detectPotentialMemories,
};
