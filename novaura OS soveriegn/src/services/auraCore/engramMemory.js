// Aura Core: 9-signature sparse distributed engram memory.
// Ported from lore/aura-prime/Aura_EngramMemory.py, 10_Aura_Nova.py, and 05_Aura_Nova.py:
// every significant exchange is tagged with 9 signatures and a sparse bit pattern, then recalled
// via pattern match, emotional gating, recency reinstatement, coherence check, and strength.

import { db } from '../../database/sovereignDatabase.js';

const MAX_ENGRAMS = 250;
const SPARSE_DIMS = 256;
const ACTIVE_TARGET = 12;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'were', 'what', 'when',
  'where', 'there', 'their', 'about', 'would', 'could', 'should', 'been', 'then', 'than',
  'into', 'just', 'more', 'some', 'like', 'them', 'they', 'your', 'you', 'are', 'was',
]);

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : 0));
const round2 = (v) => Math.round(v * 100) / 100;
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

async function saveEngrams(persona, engrams) {
  await db.setSetting(engramKey(persona), engrams.slice(0, MAX_ENGRAMS));
}

export async function encodeEngram({
  persona = 'aura',
  userText = '',
  reply = '',
  appraisal = null,
  chemistry = null,
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
    createdAt: now,
    lastAccessed: now,
    timesAccessed: 0,
    strength: round2(Math.max(0.55, 0.7 + signatures.personal_meaning * 0.4 + signatures.novelness * 0.2)),
    thought: summary,
    feeling: signatures.emotions,
    sentiment: signatures.sentiment,
    signatures,
    sparsePattern,
    connections: {},
  };

  const existing = await listEngrams(persona);
  // Link immediately to strongly overlapping recent engrams
  for (const prior of existing.slice(0, 25)) {
    const sim = patternSimilarity(engram.sparsePattern, prior.sparsePattern || []);
    if (sim >= 0.28) {
      const weight = round2(sim);
      engram.connections[prior.id] = weight;
      prior.connections = { ...(prior.connections || {}), [engram.id]: weight };
    }
  }

  const next = [engram, ...existing].slice(0, MAX_ENGRAMS);
  await saveEngrams(persona, next);

  // Mirror high-meaning engrams into db.memories so RAG searches carry relational context too
  if (db.memories && (signatures.personal_meaning >= 0.45 || signatures.novelness >= 0.65)) {
    db.memories.add({
      category: 'aura_engram',
      title: `Aura Engram (${signatures.time.period})`,
      content: summary,
      keywords: signatures.logical_patterns,
      importance: signatures.personal_meaning >= 0.7 ? 5 : 4,
      usageCount: 0,
      lastAccessed: new Date(now).toISOString(),
      metadata: { engramId: engram.id, persona: engram.persona, signatures },
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    }).catch(() => {});
  }

  return engram;
}

/**
 * 5-phase biological retrieval from 05_Aura_Nova.py:
 * 1a) sparse + pattern matching, 1b) emotional gating, 1c) temporal reinstatement,
 * 2a) thought+feeling coherence, 2b) associative confidence filter.
 */
export async function recallEngrams({
  persona = 'aura',
  query = '',
  chemistry = null,
  limit = 4,
  now = Date.now(),
} = {}) {
  const engrams = await listEngrams(persona);
  if (!engrams.length) return [];

  const qPattern = encodeSparsePattern(query);
  const qTokens = new Set(extractPatterns(query, 12));
  const currentIntensity = clamp01(
    (Math.abs(Number(chemistry?.oxytocin ?? 25) - 25) +
      Math.abs(Number(chemistry?.dopamine ?? 40) - 40) +
      Number(chemistry?.adrenaline ?? 5) +
      Number(chemistry?.cortisol ?? 15)) / 180
  );
  const currentPeriod = dayPeriod(new Date(now));

  const scored = [];
  for (const eng of engrams) {
    // 1a. Pattern & token overlap
    const sparseSim = qPattern.length ? patternSimilarity(qPattern, eng.sparsePattern || []) : 0;
    const patterns = eng.signatures?.logical_patterns || [];
    let tokenHits = 0;
    for (const p of patterns) if (qTokens.has(p)) tokenHits++;
    const patternScore = sparseSim * 10 + tokenHits * 2.5;
    if (query && patternScore <= 0 && (eng.signatures?.personal_meaning ?? 0) < 0.7) continue;

    // 1b. Emotional resonance with current chemistry
    const emDiff = Math.abs((eng.signatures?.emotions ?? 0.3) - currentIntensity);
    const emotionalScore = (1 - emDiff) * 4;

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
    const updated = engrams.map(e => (
      ids.has(e.id)
        ? { ...e, timesAccessed: (e.timesAccessed || 0) + 1, lastAccessed: now, strength: round2(Math.min(1.8, (e.strength || 1) + 0.04)) }
        : e
    ));
    saveEngrams(persona, updated).catch(() => {});
  }
  return top.map(x => ({ ...x.engram, recallScore: x.score }));
}

export async function consolidateEngrams(persona = 'aura', now = Date.now()) {
  const engrams = await listEngrams(persona);
  if (!engrams.length) {
    return { total: 0, linksAdded: 0, reinforced: 0, decayed: 0, topThemes: [] };
  }

  let linksAdded = 0;
  let reinforced = 0;
  let decayed = 0;
  const themeCounts = new Map();

  for (let i = 0; i < engrams.length; i++) {
    const a = engrams[i];
    for (const kw of (a.signatures?.logical_patterns || [])) {
      themeCounts.set(kw, (themeCounts.get(kw) || 0) + 1 + (a.signatures?.personal_meaning || 0));
    }
    // Cross-link sparse overlaps across history window
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
    const ageHours = Math.max(0, (now - (a.lastAccessed || a.createdAt || now)) / 3_600_000);
    const linkCount = Object.keys(a.connections || {}).length;
    if ((a.signatures?.personal_meaning ?? 0) >= 0.65 || linkCount >= 2) {
      const next = round2(Math.min(2.0, (a.strength || 1) + 0.03));
      if (next > (a.strength || 1)) reinforced++;
      a.strength = next;
    } else if (ageHours > 24 && (a.timesAccessed || 0) === 0) {
      a.strength = round2(Math.max(0.2, (a.strength || 1) * 0.94));
      decayed++;
    }
  }

  await saveEngrams(persona, engrams);
  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  return { total: engrams.length, linksAdded, reinforced, decayed, topThemes };
}

export default {
  extractPatterns,
  encodeSparsePattern,
  patternSimilarity,
  buildNineSignatures,
  listEngrams,
  encodeEngram,
  recallEngrams,
  consolidateEngrams,
};

