// sovereignRagService.js — Sovereign Persistent RAG Memory & Personalization Engine
// Features:
// 1. Air-gapped Dexie IndexedDB storage for long-term personalization, character lore, writing style & facts
// 2. Hybrid Retrieval: BM25/TF-IDF lexical scoring + Cosine similarity (via Ollama embeddings if available)
// 3. Automated Context Injection for LLM continuity across sessions
// 4. Memory management (CRUD, keyword indexing, importance weighting, usage tracking)

import { db } from '../database/sovereignDatabase.js';
import { cosineSimilarity, tryEmbedText } from './auraCore/contextBridge.js';

const OLLAMA_DEFAULT = 'http://localhost:11434';

/**
 * Tokenize text into normalized alphanumeric keywords
 */
export function extractKeywords(text = '') {
  if (!text) return [];
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'were', 'which',
    'what', 'when', 'where', 'there', 'their', 'about', 'would', 'could', 'should',
    'been', 'then', 'than', 'into', 'just', 'more', 'some', 'like', 'them', 'they'
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

  const patch = {
    ...updates,
    keywords,
    updated_at: new Date().toISOString(),
  };

  await db.memories.update(Number(id), patch);
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

/**
 * Hybrid Semantic & Lexical RAG Retrieval Engine
 * Finds the most relevant memories for a prompt to ensure personalization and continuity.
 */
export async function retrieveRelevantMemories(queryText, options = {}) {
  const {
    limit = 4,
    category = null,
    minScore = 0.12,
    allowEmbedProbe = false,
  } = options;

  if (!queryText || !queryText.trim()) return [];

  const allMemories = await getAllMemories(category);
  if (!allMemories || allMemories.length === 0) return [];

  const queryTokens = extractKeywords(queryText);
  if (queryTokens.length === 0) return [];
  const queryTf = computeTf(queryTokens);
  const queryVec = await tryEmbedText(queryText, { allowProbe: allowEmbedProbe }).catch(() => null);

  const scoredMemories = [];

  for (const mem of allMemories) {
    // 1. Lexical BM25/Overlap Score
    const memTokens = mem.keywords || extractKeywords(`${mem.title} ${mem.content}`);
    const memTf = computeTf(memTokens);

    let matchCount = 0;
    for (const t of queryTokens) {
      if (mem.keywords?.includes(t) || mem.content.toLowerCase().includes(t)) {
        matchCount++;
      }
    }
    const overlapScore = matchCount / Math.max(1, queryTokens.length);

    // 2. Vector Cosine Similarity (real local embeddings when present, plus TF fallback)
    const lexicalCosine = vectorCosine(queryTf, memTf);
    const embedCosine = (queryVec && Array.isArray(mem.embedding))
      ? Math.max(0, cosineSimilarity(queryVec, mem.embedding))
      : 0;

    // 3. Importance Weighting Boost (importance is 1-5)
    const importanceWeight = (mem.importance || 3) * 0.05;

    // Combined Hybrid Score
    const finalScore = (overlapScore * 0.45) + (lexicalCosine * 0.25) + (embedCosine * 0.45) + importanceWeight;

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
    lines.push(`• [${m.category.toUpperCase()}] ${m.title}: ${m.content}`);
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
  buildContinuityContext,
  detectPotentialMemories,
};

