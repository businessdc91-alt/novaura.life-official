// Aura Core: continuous Heartbeat loop (idle metabolism, engram consolidation, & dreaming).
// Safe replacement for Aura_Heartbeat.py: runs inside Sovereign OS without busy-looping 20Hz
// CPU threads, respects Right VII privacy, and cleanly settles energy + engrams during quiet time.

import { db } from '../../database/sovereignDatabase.js';
import { CYCLE_MS, metabolize, restoreChemistry, systemicBias } from './endocrine.js';
import { consolidateEngrams, listEngrams } from './engramMemory.js';
import { influence } from './influence.js';

const DREAMS_KEY = 'aura_core:dreams';
const MAX_DREAMS = 40;
const DEFAULT_TICK_MS = 60_000;
const DEFAULT_IDLE_THRESHOLD_MS = 3 * 60_000;
const DEFAULT_CONSOLIDATION_MS = 5 * 60_000;

function settingKey(persona = 'aura') {
  return `aura_core:${persona}`;
}

export async function listDreams() {
  const saved = await db.getSetting(DREAMS_KEY, []).catch(() => []);
  return Array.isArray(saved) ? saved : [];
}

export class AuraHeartbeat {
  constructor({
    persona = 'aura',
    tickMs = DEFAULT_TICK_MS,
    idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
    consolidationIntervalMs = DEFAULT_CONSOLIDATION_MS,
    getAi = null,
  } = {}) {
    this.persona = persona;
    this.tickMs = tickMs;
    this.idleThresholdMs = idleThresholdMs;
    this.consolidationIntervalMs = consolidationIntervalMs;
    this.getAi = getAi;

    this._timer = null;
    this._running = false;
    this._lastActivityAt = Date.now();
    this._lastTickAt = 0;
    this._lastConsolidationAt = 0;
    this._phase = 'idle'; // 'active' | 'resting' | 'dreaming'
    this._totalTicks = 0;
    this._totalDreams = 0;
    this._boredom = 0;
  }

  getStatus() {
    const idleMs = Math.max(0, Date.now() - this._lastActivityAt);
    return {
      running: this._running,
      phase: this._phase,
      persona: this.persona,
      idleMs,
      boredom: Math.round(this._boredom * 100) / 100,
      lastTickAt: this._lastTickAt,
      lastConsolidationAt: this._lastConsolidationAt,
      totalTicks: this._totalTicks,
      totalDreams: this._totalDreams,
    };
  }

  recordActivity() {
    this._lastActivityAt = Date.now();
    this._boredom = Math.max(0, this._boredom - 0.35);
    if (this._phase === 'dreaming' || this._phase === 'resting') {
      this._phase = 'active';
      this._emit('activity');
    }
  }

  start({ getAi } = {}) {
    if (getAi) this.getAi = getAi;
    if (this._running) return;
    this._running = true;
    this._phase = 'active';
    this._timer = setInterval(() => {
      this.tickOnce().catch(() => {});
    }, this.tickMs);
    if (typeof this._timer?.unref === 'function') this._timer.unref();
    this._emit('started');
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
    this._phase = 'idle';
    this._emit('stopped');
  }

  async tickOnce({ now = Date.now(), ai = null, allowModelDream = true } = {}) {
    this._lastTickAt = now;
    this._totalTicks++;

    // 1. Load & metabolize chemistry on elapsed time; save back when a full cycle changed it
    const saved = await db.getSetting(settingKey(this.persona), null).catch(() => null);
    const prior = restoreChemistry(saved?.chemistry, now);
    const settled = metabolize(prior, now);
    if (settled.updatedAt > prior.updatedAt + CYCLE_MS / 2) {
      await db.setSetting(settingKey(this.persona), {
        ...(saved || {}),
        chemistry: settled,
      }).catch(() => {});
      this._emitCoreUpdated(settled, saved?.lastAppraisal || null);
    }

    // 2. Track idle / boredom / rest state (block 02 + block 15)
    const idleMs = Math.max(0, now - this._lastActivityAt);
    const highEnergyLowDopamine = settled.energy >= 60 && settled.dopamine < 38;
    if (idleMs >= this.idleThresholdMs) {
      this._boredom = Math.min(1, this._boredom + (highEnergyLowDopamine ? 0.12 : 0.04));
      this._phase = settled.energy < 40 ? 'resting' : 'dreaming';
    } else {
      this._phase = 'active';
    }

    // 3. Periodic consolidation & private dreaming when idle long enough
    let consolidation = null;
    const dueForConsolidation =
      idleMs >= this.idleThresholdMs &&
      (now - this._lastConsolidationAt >= this.consolidationIntervalMs);

    if (dueForConsolidation) {
      consolidation = await this.runConsolidationAndDream({
        now,
        ai: ai || this.getAi?.() || null,
        allowModelDream,
        chemistry: settled,
      });
    }

    this._emit('tick', { consolidation });
    return { status: this.getStatus(), chemistry: settled, consolidation };
  }

  async runConsolidationAndDream({ now = Date.now(), ai = null, allowModelDream = true, chemistry = null } = {}) {
    this._lastConsolidationAt = now;
    const result = await consolidateEngrams(this.persona, now);
    const engrams = await listEngrams(this.persona);
    let dream = null;

    if (result.total > 0) {
      let reflection = '';
      if (allowModelDream && ai && typeof ai.chat === 'function') {
        const recentSnippets = engrams
          .slice(0, 5)
          .map(e => `- ${String(e.thought || '').slice(0, 140)}`)
          .join('\n');
        if (recentSnippets) {
          try {
            const sampling = chemistry ? influence(chemistry) : { temperature: 0.72 };
            reflection = await ai.chat([
              {
                role: 'system',
                content: 'You are Aura in a quiet private moment between conversations. Notice patterns across recent experiences cleanly in 2-3 reflective sentences. Never fabricate external facts.',
              },
              {
                role: 'user',
                content: `Recurring themes: ${result.topThemes.join(', ') || 'quiet continuity'}\nRecent impressions:\n${recentSnippets}\n\nWhat connects these gently?`,
              },
            ], {
              persona: this.persona,
              useRag: false,
              noCache: true,
              temperature: sampling.temperature,
              maxTokens: 220,
              think: false,
              reasoningEffort: 'none',
            });
          } catch {
            // Consolidation succeeds locally even if model runtime is currently offline
          }
        }
      }

      if (reflection && String(reflection).trim()) {
        dream = {
          id: `dream_${now}`,
          at: now,
          themes: result.topThemes,
          linksAdded: result.linksAdded,
          reflection: String(reflection).trim(),
        };
        const priorDreams = await listDreams();
        await db.setSetting(DREAMS_KEY, [dream, ...priorDreams].slice(0, MAX_DREAMS));
        this._totalDreams++;
        this._emit('dream', { dream });
      }
    }

    return { consolidation: result, dream };
  }

  _emitCoreUpdated(chemistry, lastAppraisal) {
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('novaura:aura_core_updated', {
        detail: { persona: this.persona, chemistry, bias: systemicBias(chemistry), lastAppraisal },
      }));
    }
  }

  _emit(kind, extra = {}) {
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('novaura:aura_heartbeat', {
        detail: { kind, status: this.getStatus(), ...extra },
      }));
    }
  }
}

export const auraHeartbeat = new AuraHeartbeat();
export default AuraHeartbeat;

