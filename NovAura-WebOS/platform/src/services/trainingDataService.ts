import { kernelStorage } from '@/kernel/kernelStorage.js';
/**
 * NovAura Training Data Service
 *
 * With user consent, captures interactions (conversations, code generations,
 * critiques) as structured training material for future model advancement.
 *
 * Data stays local (localStorage) until a backend pipeline endpoint is
 * configured — at which point it flushes automatically on consent.
 *
 * Consent version bumps when the policy materially changes — existing
 * consented users are not re-prompted unless the version mismatches.
 */

export const CONSENT_VERSION = '1.0';

const STORAGE_KEY = 'novaura-training-data';
const MAX_ENTRIES = 2000; // Rolling window — oldest pruned first

export type TrainingDataType =
  | 'conversation'       // Chat message exchange
  | 'code_generation'    // BuilderBot initial generation
  | 'code_critique'      // BuilderBot critique pass
  | 'code_improvement'   // BuilderBot improve pass
  | 'kimi_refinement';   // Studio Kimi sweep

export type TrainingPlatform =
  | 'ide_console'        // Aura in the IDE
  | 'nova_chat'          // /chat full-screen page
  | 'float_chat';        // Floating Nova widget

export interface TrainingEntry {
  id: string;
  userId: string;
  sessionId: string;
  dataType: TrainingDataType;
  platform: TrainingPlatform;
  provider: string;
  tier: string;
  content: {
    prompt?: string;
    response?: string;
    code?: string;
    context?: string;
  };
  timestamp: string;
  consentVersion: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function load(): TrainingEntry[] {
  try {
    const raw = kernelStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(entries: TrainingEntry[]) {
  // Keep rolling window
  const pruned = entries.length > MAX_ENTRIES
    ? entries.slice(entries.length - MAX_ENTRIES)
    : entries;
  kernelStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
}

function makeId(): string {
  return `td_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Session ID: one per page load
const SESSION_ID = `s_${Date.now().toString(36)}`;

// ── Public API ────────────────────────────────────────────────────────────────

export const trainingDataService = {
  /**
   * Check whether the given user has given consent at the current version.
   */
  hasConsent(user: { trainingConsentGiven?: boolean; trainingConsentVersion?: string } | null): boolean {
    if (!user) return false;
    return !!(user.trainingConsentGiven && user.trainingConsentVersion === CONSENT_VERSION);
  },

  /**
   * Log a conversation exchange (prompt + response).
   * No-ops silently if user hasn't consented.
   */
  logConversation(
    userId: string,
    platform: TrainingPlatform,
    provider: string,
    tier: string,
    prompt: string,
    response: string,
    context?: string
  ) {
    const entries = load();
    entries.push({
      id: makeId(),
      userId,
      sessionId: SESSION_ID,
      dataType: 'conversation',
      platform,
      provider,
      tier,
      content: { prompt, response, context },
      timestamp: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    });
    save(entries);
  },

  /**
   * Log a BuilderBot code pass (generation, critique, improvement, or Kimi sweep).
   */
  logCodePass(
    userId: string,
    dataType: TrainingDataType,
    provider: string,
    tier: string,
    prompt: string,
    code: string
  ) {
    const entries = load();
    entries.push({
      id: makeId(),
      userId,
      sessionId: SESSION_ID,
      dataType,
      platform: 'ide_console',
      provider,
      tier,
      content: { prompt, code },
      timestamp: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    });
    save(entries);
  },

  /**
   * Return all entries for the given user.
   */
  getEntries(userId: string): TrainingEntry[] {
    return load().filter(e => e.userId === userId);
  },

  /**
   * Return total entry count across all users (admin use).
   */
  getTotalCount(): number {
    return load().length;
  },

  /**
   * Export all entries as a JSON string (for piping to a backend endpoint).
   */
  exportAll(): string {
    return JSON.stringify(load(), null, 2);
  },

  /**
   * Clear all stored training data (owner/admin action).
   */
  clearAll() {
    kernelStorage.removeItem(STORAGE_KEY);
  },
};
