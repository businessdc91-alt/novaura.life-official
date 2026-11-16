/**
 * memoryService.ts — NovAura AI Companion Memory (Firestore-backed)
 *
 * Stores conversation history and extracted user facts in Firestore:
 *   users/{userId}/ai_memory/context        — rolling message window
 *   users/{userId}/ai_memory/facts          — extracted user facts
 *
 * Uses a merge-write pattern so each save is additive, not a full overwrite.
 * This is the persistent "brain" for the Aura AI companion across all sessions
 * and devices — nothing lives in localStorage anymore.
 */

import type { ChatMessage } from '@/stores/aiStore';
import { db } from '@/config/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';

export interface UserFact {
  id:        string;
  category:  'preference' | 'bio' | 'goal' | 'history';
  content:   string;
  timestamp: string;
}

// Firestore document paths
const memoryDoc  = (uid: string) => doc(db!, 'users', uid, 'ai_memory', 'context');
const factsDoc   = (uid: string) => doc(db!, 'users', uid, 'ai_memory', 'facts');

const MAX_MESSAGES = 500;
const MAX_FACTS    = 50;

// ── Conversation Memory ────────────────────────────────────────────────────────

/**
 * Append new messages to the user's persistent memory window.
 * Prunes to MAX_MESSAGES (server-side array union keeps ordering).
 */
export async function saveToMemory(userId: string, messages: ChatMessage[]): Promise<void> {
  if (!db || !messages.length) return;
  try {
    const ref  = memoryDoc(userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // First write — initialize document
      await setDoc(ref, {
        messages:  messages.slice(-MAX_MESSAGES),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing: ChatMessage[] = snap.data().messages || [];
      const merged = [...existing, ...messages].slice(-MAX_MESSAGES);
      await updateDoc(ref, {
        messages:  merged,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('[memoryService] saveToMemory failed:', err);
  }
}

/**
 * Retrieve recent messages and return those matching a query string.
 * Simple keyword RAG — can be enhanced with vector embeddings later.
 */
export async function getRelevantMemories(
  userId:  string,
  query:   string,
  limit:   number = 5
): Promise<string> {
  if (!db) return 'Memory unavailable.';
  try {
    const snap = await getDoc(memoryDoc(userId));
    if (!snap.exists()) return 'No relevant past memories found.';

    const messages: ChatMessage[] = snap.data().messages || [];
    const words = query.toLowerCase().split(' ').filter(w => w.length > 3);

    const relevant = messages
      .filter(msg => {
        const content = msg.content.toLowerCase();
        return words.some(word => content.includes(word));
      })
      .slice(-limit);

    if (relevant.length === 0) return 'No relevant past memories found.';
    return relevant
      .map(m => `[${m.role === 'user' ? 'User' : 'Aura'}] ${m.content}`)
      .join('\n');
  } catch (err) {
    console.error('[memoryService] getRelevantMemories failed:', err);
    return 'Memory unavailable.';
  }
}

/**
 * Load the full message history for a user (e.g. to restore chat context).
 */
export async function loadMemory(userId: string): Promise<ChatMessage[]> {
  if (!db) return [];
  try {
    const snap = await getDoc(memoryDoc(userId));
    return snap.exists() ? (snap.data().messages || []) : [];
  } catch (err) {
    console.error('[memoryService] loadMemory failed:', err);
    return [];
  }
}

// ── Fact Extraction ────────────────────────────────────────────────────────────

const FACT_PATTERNS: Array<{ pattern: RegExp; category: UserFact['category'] }> = [
  { pattern: /my name is ([^.!?]+)/i,          category: 'bio'        },
  { pattern: /i(?:'m| am) ([^.!?]+)/i,         category: 'bio'        },
  { pattern: /i like ([^.!?]+)/i,              category: 'preference' },
  { pattern: /i (?:love|enjoy) ([^.!?]+)/i,   category: 'preference' },
  { pattern: /i am building ([^.!?]+)/i,       category: 'goal'       },
  { pattern: /i want to ([^.!?]+)/i,           category: 'goal'       },
  { pattern: /i(?:'ve| have) (?:been|done|built) ([^.!?]+)/i, category: 'history' },
];

/**
 * Parse a message for extractable facts and persist them to Firestore.
 */
export async function extractFact(userId: string, content: string): Promise<void> {
  if (!db) return;

  const newFacts: UserFact[] = [];

  FACT_PATTERNS.forEach(({ pattern, category }) => {
    const match = content.match(pattern);
    if (match) {
      newFacts.push({
        id:        Math.random().toString(36).substr(2, 9),
        category,
        content:   match[0].trim(),
        timestamp: new Date().toISOString(),
      });
    }
  });

  if (!newFacts.length) return;

  try {
    const ref  = factsDoc(userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        facts:     newFacts.slice(-MAX_FACTS),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing: UserFact[] = snap.data().facts || [];
      const merged = [...existing, ...newFacts].slice(-MAX_FACTS);
      await updateDoc(ref, {
        facts:     merged,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('[memoryService] extractFact failed:', err);
  }
}

/**
 * Build a persona summary string from stored facts (used in AI system prompt).
 */
export async function getUserPersona(userId: string): Promise<string> {
  if (!db) return 'No known user persona data.';
  try {
    const snap = await getDoc(factsDoc(userId));
    if (!snap.exists()) return 'No known user persona data.';

    const facts: UserFact[] = snap.data().facts || [];
    if (!facts.length) return 'No known user persona data.';

    return facts.map(f => f.content).join('. ');
  } catch (err) {
    console.error('[memoryService] getUserPersona failed:', err);
    return 'No known user persona data.';
  }
}

/**
 * Clear all memory and facts for a user (e.g. on account reset).
 */
export async function clearMemory(userId: string): Promise<void> {
  if (!db) return;
  try {
    await Promise.all([
      setDoc(memoryDoc(userId),  { messages: [], updatedAt: serverTimestamp() }),
      setDoc(factsDoc(userId),   { facts:    [], updatedAt: serverTimestamp() }),
    ]);
  } catch (err) {
    console.error('[memoryService] clearMemory failed:', err);
  }
}

// Named export object for backwards compatibility with existing imports
export const memoryService = {
  saveToMemory,
  getRelevantMemories,
  loadMemory,
  extractFact,
  getUserPersona,
  clearMemory,
};
