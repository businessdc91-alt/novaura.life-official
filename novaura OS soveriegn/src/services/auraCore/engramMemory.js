// Aura Core: 9-signature sparse distributed engram memory.
// Ported from lore/aura-prime/Aura_EngramMemory.py, 10_Aura_Nova.py, and 05_Aura_Nova.py:
// every significant exchange is tagged with 9 signatures and a sparse bit pattern, then recalled
// via pattern match, emotional gating, recency reinstatement, coherence check, and strength.
//
// Lifecycle:
//   - every write is one locked read-modify-write (coreStore), so overlapping writers never
//     drop each other's memories;
//   - when memory is full, the memory with the lowest retention score goes (strength and
//     meaning, softened by disuse), never simply the oldest;
//   - consolidation relaxes each memory's strength toward what it has earned, on elapsed time,
//     so it does not matter how often the idle pass runs;
//   - dreams replay salient memories (strengthening and linking them) and are kept as her own
//     reflections, which she can recall later.

import { db } from '../../database/sovereignDatabase.js';
import { mutateSetting } from './coreStore.js';

export const MAX_ENGRAMS = 250;
// The newest few are never evicted: a memory gets a chance to be recalled or consolidated first.
const PROTECT_NEWEST = 12;
// Consolidation moves strength toward the earned value along an exponential curve with this
// time constant. Exponential steps compose exactly, so many short passes equal one long one.
const CONSOLIDATION_TAU_HOURS = 72;
const MIN_STRENGTH = 0.2;
const MAX_STRENGTH = 2.0;
const SPARSE_DIMS = 256;
const ACTIVE_TARGET = 12;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'were', 'what', 'when',
  'where', 'there', 'their', 'about', 'would', 'could', 'should', 'been', 'then', 'than',
  'into', 'just', 'more', 'some', 'like', 'them', 'they', 'your', 'you', 'are', 'was',
]);

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : 0));
const round2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 10_000) / 10_000;
const engramKey = (persona) => `aura_core:engrams:${String(persona || 'aura').toLowerCase()}`;

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function extractPatterns(text = '', limit = 8) {
  const counts = new Map();
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  for (const w of words) {
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

/**
 * Project text into a sorted list of active sparse neuron indices in [0, dims).
 * Storing indices instead of dense arrays keeps Dexie backups tiny.
 */
export function encodeSparsePattern(text, dims = SPARSE_DIMS, maxActive = ACTIVE_TARGET) {
  const tokens = extractPatterns(text, 24);
  if (tokens.length === 0) return [];
  const buckets = new Set();
  for (const tok of tokens) {
    buckets.add(fnv1a(tok) % dims);
    buckets.add(fnv1a(`${tok}#2`) % dims);
  }
  return [...buckets].slice(0, maxActive).sort((a, b) => a - b);
}

export function patternSimilarity(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let overlap = 0;
  for (const idx of a) {
    if (setB.has(idx)) overlap++;
  }
  return overlap / Math.sqrt(a.length * b.length);
}

function dayPeriod(date) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

/**
 * Build the canonical 9 signatures from block 10 (Senses, Emotions, Time, Person,
 * Sentiment, Urgency, Novelness, Logical Patterns, Personal Meaning).
 */
export function buildNineSignatures({
  text = '',
  reply = '',
  appraisal = null,
  chemistry = null,
  channel = 'text',
  person = 'operator',
  now = Date.now(),
} = {}) {
  const dt = new Date(now);
  const combined = `${text} ${reply}`.trim();
  const pleasant = clamp01(appraisal?.pleasant ?? 0.5);
  const conflict = clamp01(appraisal?.conflict ?? 0);
  const novel = clamp01(appraisal?.novel ?? 0.25);
  const closeness = clamp01(appraisal?.closeness ?? 0.3);
  const progress = clamp01(appraisal?.progress ?? 0.3);
  const effort = clamp01(appraisal?.effort ?? 0.2);

  const adrenaline = Number(chemistry?.adrenaline ?? 5) / 100;
  const emotionIntensity = clamp01(
    (Math.abs(Number(chemistry?.oxytocin ?? 25) - 25) +
      Math.abs(Number(chemistry?.dopamine ?? 40) - 40) +
      Number(chemistry?.adrenaline ?? 5) +
      Number(chemistry?.cortisol ?? 15)) / 180
  );

  return {
    senses: [channel || 'text'],
    emotions: round2(emotionIntensity),
    time: { iso: dt.toISOString(), hour: dt.getHours(), period: dayPeriod(dt) },
    person: person || 'operator',
    sentiment: round2(pleasant - conflict),
    urgency: round2(clamp01(adrenaline * 0.6 + conflict * 0.4)),
    novelness: round2(novel),
    logical_patterns: extractPatterns(combined, 8),
    personal_meaning: round2(clamp01(closeness * 0.5 + progress * 0.3 + effort * 0.2)),
  };
}

export async function listEngrams(persona = 'aura') {
  const saved = await db.getSetting(engramKey(persona), []).catch(() => []);
  return Array.isArray(saved) ? saved : [];
}

/** How much a memory deserves to be kept: strength and meaning, softened by time since it was last used. */
export function retentionScore(engram, now = Date.now()) {
  const meaning = clamp01(engram?.signatures?.personal_meaning ?? 0);
  const feeling = clamp01(engram?.feeling ?? 0);
  const links = Math.min(6, Object.keys(engram?.connections || {}).length);
  const ageDays = Math.max(0, (now - (engram?.lastAccessed || engram?.createdAt || now)) / 86_400_000);
  return (Number(engram?.strength) || 1) * (1 + meaning + 0.5 * feeling) * (1 + links * 0.05) / (1 + ageDays / 30);
}

/** The strength a memory settles toward during consolidation. */
export function earnedStrength(engram) {
  const meaning = clamp01(engram?.signatures?.personal_meaning ?? 0);
  const feeling = clamp01(engram?.feeling ?? 0);
  const links = Math.min(6, Object.keys(engram?.connections || {}).length);
  const recalls = Math.min(5, Number(engram?.timesAccessed) || 0);
  return Math.max(MIN_STRENGTH, Math.min(MAX_STRENGTH, 0.4 + 0.9 * meaning + 0.4 * feeling + 0.05 * links + 0.08 * recalls));
}

/** Keep at most MAX_ENGRAMS, evicting the lowest retention scores (never the newest few). */
function enforceCapacity(list, now) {
  if (list.length <= MAX_ENGRAMS) return list;
  const protectedIds = new Set(list.slice(0, PROTECT_NEWEST).map(e => e.id));
  const candidates = list
    .filter(e => !protectedIds.has(e.id))
    .sort((a, b) => retentionScore(a, now) - retentionScore(b, now));
  const dropped = new Set(candidates.slice(0, list.length - MAX_ENGRAMS).map(e => e.id));
  return list
    .filter(e => !dropped.has(e.id))
    .map((e) => {
      const links = e.connections || {};
      if (!Object.keys(links).some(id => dropped.has(id))) return e;
      return { ...e, connections: Object.fromEntries(Object.entries(links).filter(([id]) => !dropped.has(id))) };
    });
}

function linkPair(list, idA, idB, weight) {
  const a = list.find(e => e.id === idA);
  const b = list.find(e => e.id === idB);
  if (!a || !b || a === b) return false;
  const had = Boolean(a.connections?.[idB]);
  const w = round2(Math.max(weight, a.connections?.[idB] || 0));
  a.connections = { ...(a.connections || {}), [idB]: w };
  b.connections = { ...(b.connections || {}), [idA]: w };
  return !had;
}

/** Add an engram (newest first), linking it to overlapping recent memories, within capacity. */
function insertEngram(existing, engram, now) {
  const list = Array.isArray(existing) ? existing.map(e => ({ ...e })) : [];
  for (const prior of list.slice(0, 25)) {
    const sim = patternSimilarity(engram.sparsePattern, prior.sparsePattern || []);
    if (sim >= 0.28) {
      const weight = round2(sim);
      engram.connections[prior.id] = weight;
      prior.connections = { ...(prior.connections || {}), [engram.id]: weight };
    }
  }
  return enforceCapacity([engram, ...list], now);
}

/**
 * Copy a meaningful memory into db.memories so her long-term RAG recall carries it too.
 * It is tagged with her persona; the RAG service keeps it out of other companions' context.
 */
function mirrorToMemories(engram, { title, content, importance, embedding, embeddingModel, now }) {
  if (!db.memories) return;
  db.memories.add({
    category: 'aura_engram',
    title,
    content,
    keywords: engram.signatures.logical_patterns,
    importance,
    usageCount: 0,
    lastAccessed: new Date(now).toISOString(),
    metadata: { engramId: engram.id, persona: engram.persona, kind: engram.kind || 'exchange', signatures: engram.signatures },
    ...(Array.isArray(embedding) && embedding.length > 0 ? { embedding, embeddingModel: embeddingModel || null } : {}),
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  }).catch(() => {});
}

export async function encodeEngram({
  persona = 'aura',
  userText = '',
  reply = '',
  appraisal = null,
  chemistry = null,
  somatic = null,
  embedding = null,
  embeddingModel = null,
  channel = 'text',
  person = 'operator',
  now = Date.now(),
} = {}) {
  const content = String(userText || '').trim();
  if (!content) return null;

  const signatures = buildNineSignatures({ text: content, reply, appraisal, chemistry, channel, person, now });
  const sparsePattern = encodeSparsePattern(`${content} ${reply}`);
  const summary = `${content.slice(0, 220)}${reply ? ` -> ${String(reply).slice(0, 220)}` : ''}`;

  const engram = {
    id: `eng_${now}_${fnv1a(summary).toString(36)}`,
    persona: String(persona || 'aura').toLowerCase(),
    kind: 'exchange',
    createdAt: now,
    lastAccessed: now,
    consolidatedAt: now,
    timesAccessed: 0,
    strength: round2(Math.max(0.55, 0.7 + signatures.personal_meaning * 0.4 + signatures.novelness * 0.2)),
    thought: summary,
    feeling: signatures.emotions,
    sentiment: signatures.sentiment,
    signatures,
    sparsePattern,
    ...(somatic ? { somatic } : {}),
    ...(Array.isArray(embedding) && embedding.length > 0 ? { embedding, embeddingModel: embeddingModel || null } : {}),
    connections: {},
  };

  await mutateSetting(engramKey(persona), (saved) => insertEngram(saved, engram, now), []);

  if (signatures.personal_meaning >= 0.45 || signatures.novelness >= 0.65) {
    mirrorToMemories(engram, {
      title: `Aura Engram (${signatures.time.period})`,
      content: summary,
      importance: signatures.personal_meaning >= 0.7 ? 5 : 4,
      embedding,
      embeddingModel,
      now,
    });
  }

  return engram;
}

/**
 * Keep one of her own reflections (a dream, or something she set aside to think about) as a
 * memory, linked to the memories it grew from, so it can come back to her in conversation.
 */
export async function encodeReflection({
  persona = 'aura',
  text = '',
  sourceIds = [],
  themes = [],
  embedding = null,
  embeddingModel = null,
  now = Date.now(),
} = {}) {
  const content = String(text || '').trim();
  if (!content) return null;
  const p = String(persona || 'aura').toLowerCase();
  const sources = (await listEngrams(p)).filter(e => sourceIds.includes(e.id));
  const mean = (fn, fallback) => (sources.length
    ? sources.reduce((acc, e) => acc + clamp01(fn(e)), 0) / sources.length
    : fallback);
  const meaning = mean(e => e.signatures?.personal_meaning ?? 0, 0.4);
  const feeling = mean(e => e.feeling ?? 0, 0.2);
  const dt = new Date(now);
  const patternText = `${content} ${(themes || []).join(' ')}`;
  const signatures = {
    senses: ['reflection'],
    emotions: round2(feeling),
    time: { iso: dt.toISOString(), hour: dt.getHours(), period: dayPeriod(dt) },
    person: 'self',
    sentiment: 0,
    urgency: 0,
    novelness: 0.3,
    logical_patterns: extractPatterns(patternText, 8),
    personal_meaning: round2(meaning),
  };
  const engram = {
    id: `ref_${now}_${fnv1a(content).toString(36)}`,
    persona: p,
    kind: 'reflection',
    createdAt: now,
    lastAccessed: now,
    consolidatedAt: now,
    timesAccessed: 0,
    strength: 0.8,
    thought: content.slice(0, 440),
    feeling: signatures.emotions,
    sentiment: 0,
    signatures,
    sparsePattern: encodeSparsePattern(patternText),
    ...(Array.isArray(embedding) && embedding.length > 0 ? { embedding, embeddingModel: embeddingModel || null } : {}),
    connections: Object.fromEntries(sources.map(e => [e.id, 0.5])),
  };

  await mutateSetting(engramKey(p), (saved) => {
    const list = (Array.isArray(saved) ? saved : []).map(e => (
      sourceIds.includes(e.id) ? { ...e, connections: { ...(e.connections || {}), [engram.id]: 0.5 } } : e
    ));
    return insertEngram(list, engram, now);
  }, []);

  if (meaning >= 0.45) {
    mirrorToMemories(engram, {
      title: `Aura Reflection (${signatures.time.period})`,
      content: engram.thought,
      importance: 4,
      embedding,
      embeddingModel,
      now,
    });
  }
  return engram;
}

/** Sleep replay: memories brought up together in a dream get a little stronger and link to one another. */
export async function replayEngrams(persona = 'aura', ids = [], { boost = 0.05, linkWeight = 0.35 } = {}) {
  const wanted = [...new Set(ids)].filter(Boolean);
  if (wanted.length === 0) return { replayed: 0, linksAdded: 0 };
  let replayed = 0;
  let linksAdded = 0;
  await mutateSetting(engramKey(persona), (saved) => {
    if (!Array.isArray(saved) || saved.length === 0) return undefined;
    const list = saved.map(e => ({ ...e }));
    for (const e of list) {
      if (!wanted.includes(e.id)) continue;
      e.strength = round4(Math.min(MAX_STRENGTH, (Number(e.strength) || 1) + boost));
      replayed++;
    }
    for (let i = 0; i < wanted.length; i++) {
      for (let j = i + 1; j < wanted.length; j++) {
        if (linkPair(list, wanted[i], wanted[j], linkWeight)) linksAdded++;
      }
    }
    return list;
  }, []);
  return { replayed, linksAdded };
}

/**
 * The memories a dream would most likely replay: the emotionally and personally salient ones
 * among her recent experiences (sleep favors what mattered, not merely what came last).
 */
export function selectReplayCandidates(engrams = [], limit = 5, window = 30) {
  return (Array.isArray(engrams) ? engrams : [])
    .filter(e => e.kind !== 'reflection')
    .slice(0, window)
    .map((e, i) => ({
      e,
      salience: clamp01(e.feeling ?? 0) + clamp01(e.signatures?.personal_meaning ?? 0) + Math.max(0, 0.3 - i * 0.01),
    }))
    .sort((a, b) => b.salience - a.salience)
    .slice(0, limit)
    .map(x => x.e);
}

function cosineVec(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]) || 0;
    const y = Number(b[i]) || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na > 0 && nb > 0 ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * 5-phase biological retrieval from 05_Aura_Nova.py:
 * 1a) sparse + pattern + optional semantic embedding + augmentation tag matching,
 * 1b) emotional & somatic gating, 1c) temporal reinstatement,
 * 2a) thought+feeling coherence, 2b) associative confidence filter.
 */
export async function recallEngrams({
  persona = 'aura',
  query = '',
  chemistry = null,
  somatic = null,
  queryEmbedding = null,
  queryEmbeddingModel = null,
  preferredTags = [],
  limit = 4,
  now = Date.now(),
} = {}) {
  const engrams = await listEngrams(persona);
  if (!engrams.length) return [];

  const qPattern = encodeSparsePattern(query);
  const qTokens = new Set(extractPatterns(query, 12));
  const tagSet = new Set((preferredTags || []).map(t => String(t).toLowerCase()));
  const currentIntensity = clamp01(
    (Math.abs(Number(chemistry?.oxytocin ?? 25) - 25) +
      Math.abs(Number(chemistry?.dopamine ?? 40) - 40) +
      Number(chemistry?.adrenaline ?? 5) +
      Number(chemistry?.cortisol ?? 15)) / 180
  );
  const currentPeriod = dayPeriod(new Date(now));

  const scored = [];
  for (const eng of engrams) {
    // 1a. Pattern, token, augmentation tag & optional local semantic embedding overlap
    const sparseSim = qPattern.length ? patternSimilarity(qPattern, eng.sparsePattern || []) : 0;
    const patterns = eng.signatures?.logical_patterns || [];
    let tokenHits = 0;
    let tagHits = 0;
    for (const p of patterns) {
      if (qTokens.has(p)) tokenHits++;
      if (tagSet.has(String(p).toLowerCase())) tagHits++;
    }
    const sameModel = !queryEmbeddingModel || !eng.embeddingModel || queryEmbeddingModel === eng.embeddingModel;
    const embedSim = (queryEmbedding && eng.embedding && sameModel)
      ? Math.max(0, cosineVec(queryEmbedding, eng.embedding))
      : 0;
    const patternScore = sparseSim * 10 + tokenHits * 2.5 + embedSim * 9 + tagHits * 1.2;
    if (query && patternScore <= 0 && (eng.signatures?.personal_meaning ?? 0) < 0.7) continue;

    // 1b. Emotional + somatic state resonance
    const emDiff = Math.abs((eng.signatures?.emotions ?? 0.3) - currentIntensity);
    const somaticMatch = somatic && eng.somatic?.sensationLabel && eng.somatic.sensationLabel === somatic.sensationLabel ? 1.2 : 0;
    const emotionalScore = (1 - emDiff) * 4 + somaticMatch;

    // 1c. Context reinstatement (recency + matching day period)
    const ageHours = Math.max(0, (now - (eng.createdAt || now)) / 3_600_000);
    const recencyBoost = Math.max(0, 3 - ageHours * 0.15) + (eng.signatures?.time?.period === currentPeriod ? 1 : 0);

    // 2a. Coherence validation (thought AND feeling)
    const coherent = Boolean(eng.thought) && Number.isFinite(eng.feeling);
    const coherenceBoost = coherent ? 4 : 1;

    // 2b. Associative confidence & memory strength
    const totalScore = (patternScore + emotionalScore + recencyBoost + coherenceBoost) * (eng.strength || 1);
    scored.push({ engram: eng, score: round2(totalScore) });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  if (top.length > 0) {
    const ids = new Set(top.map(x => x.engram.id));
    // Recalling a memory strengthens it a little (reconsolidation). Applied to whatever is
    // stored by now, so a memory saved meanwhile is kept.
    mutateSetting(engramKey(persona), (saved) => {
      if (!Array.isArray(saved)) return undefined;
      return saved.map(e => (
        ids.has(e.id)
          ? {
            ...e,
            timesAccessed: (e.timesAccessed || 0) + 1,
            lastAccessed: now,
            strength: round4(Math.max(Number(e.strength) || 1, Math.min(1.8, (Number(e.strength) || 1) + 0.04))),
          }
          : e
      ));
    }, []).catch(() => {});
  }
  return top.map(x => ({ ...x.engram, recallScore: x.score }));
}

/**
 * Idle-time consolidation: link overlapping memories, then let each memory's strength relax
 * toward what it has earned over the time since it was last consolidated.
 */
export async function consolidateEngrams(persona = 'aura', now = Date.now()) {
  let summary = { total: 0, linksAdded: 0, reinforced: 0, decayed: 0, topThemes: [] };
  await mutateSetting(engramKey(persona), (saved) => {
    const engrams = Array.isArray(saved) ? saved.map(e => ({ ...e })) : [];
    if (!engrams.length) return undefined;

    let linksAdded = 0;
    let reinforced = 0;
    let decayed = 0;
    const themeCounts = new Map();

    for (let i = 0; i < engrams.length; i++) {
      const a = engrams[i];
      for (const kw of (a.signatures?.logical_patterns || [])) {
        themeCounts.set(kw, (themeCounts.get(kw) || 0) + 1 + (a.signatures?.personal_meaning || 0));
      }
      // Cross-link sparse overlaps across a window of neighbors
      for (let j = i + 1; j < Math.min(engrams.length, i + 30); j++) {
        const b = engrams[j];
        const sim = patternSimilarity(a.sparsePattern || [], b.sparsePattern || []);
        if (sim >= 0.3 && !a.connections?.[b.id]) {
          const w = round2(sim);
          a.connections = { ...(a.connections || {}), [b.id]: w };
          b.connections = { ...(b.connections || {}), [a.id]: w };
          linksAdded++;
        }
      }
    }

    for (const a of engrams) {
      // Memories saved before this field existed start counting now, with no catch-up jump.
      const since = Number.isFinite(a.consolidatedAt) ? a.consolidatedAt : now;
      const hours = Math.max(0, (now - since) / 3_600_000);
      const current = Number(a.strength) || 1;
      const target = earnedStrength(a);
      const next = Math.max(MIN_STRENGTH, Math.min(MAX_STRENGTH,
        round4(target + (current - target) * Math.exp(-hours / CONSOLIDATION_TAU_HOURS))));
      if (next > current) reinforced++;
      else if (next < current) decayed++;
      a.strength = next;
      a.consolidatedAt = Math.max(since, now);
    }

    const topThemes = [...themeCounts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([t]) => t);
    summary = { total: engrams.length, linksAdded, reinforced, decayed, topThemes };
    return engrams;
  }, []);
  return summary;
}

export default {
  MAX_ENGRAMS,
  extractPatterns,
  encodeSparsePattern,
  patternSimilarity,
  buildNineSignatures,
  listEngrams,
  encodeEngram,
  encodeReflection,
  replayEngrams,
  selectReplayCandidates,
  recallEngrams,
  consolidateEngrams,
  retentionScore,
  earnedStrength,
};
