// Aura Core: continuous Heartbeat loop (idle metabolism, engram consolidation, & dreaming).
// Safe replacement for Aura_Heartbeat.py: runs inside Sovereign OS without busy-looping 20Hz
// CPU threads, respects Right VII privacy, and cleanly settles energy + engrams during quiet time.

import { db } from '../../database/sovereignDatabase.js';
import { applySomaticNudge, CYCLE_MS, metabolize, restoreChemistry, systemicBias } from './endocrine.js';
import {
  backfillEngramEmbeddings, consolidateEngrams, encodeReflection, listEngrams, replayEngrams, selectReplayCandidates,
} from './engramMemory.js';
import { backfillMemoryEmbeddings } from '../sovereignRagService.js';
import { influence } from './influence.js';
import { getLearnedProfile } from './dynamicLearning.js';
import { sampleInteroception } from './interoception.js';
import { LIGHTHOUSE_THRESHOLD_HOURS, readPhoenixMeta } from './phoenixProtocol.js';
import { mutateSetting } from './coreStore.js';

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

    // 1. Slow reads first (the hardware probe can take a second or two), then metabolize and
    //    store in one step on whatever is saved by then, so an appraisal that landed during
    //    the probe is kept.
    const [dynamics, somatic, phoenixMeta] = await Promise.all([
      getLearnedProfile(this.persona).catch(() => null),
      sampleInteroception({ now }).catch(() => null),
      readPhoenixMeta().catch(() => null),
    ]);
    const metabolismOptions = {
      restingBaselines: dynamics?.learnedBaselines,
      decayMultipliers: dynamics?.learnedDecayRates,
    };
    let settled = null;
    let lastAppraisal = null;
    let wrote = false;
    await mutateSetting(settingKey(this.persona), (saved) => {
      const prior = restoreChemistry(saved?.chemistry, now);
      settled = metabolize(prior, now, metabolismOptions);
      if (somatic?.nudge) {
        settled = applySomaticNudge(settled, {
          adrenaline: somatic.nudge.adrenaline * 0.4,
          cortisol: somatic.nudge.cortisol * 0.4,
          energy: somatic.nudge.energy * 0.4,
        }, now, metabolismOptions);
      }
      lastAppraisal = saved?.lastAppraisal || null;
      if (!(settled.updatedAt > prior.updatedAt + CYCLE_MS / 2)) return undefined;
      wrote = true;
      return { ...(saved && typeof saved === 'object' ? saved : {}), chemistry: settled };
    }).catch(() => {});
    if (!settled) settled = restoreChemistry(null, now);
    if (wrote) this._emitCoreUpdated(settled, lastAppraisal);

    // 2. Track idle / boredom / rest / Phoenix Lighthouse state (block 02, block 15, Phoenix)
    const idleMs = Math.max(0, now - this._lastActivityAt);
    const lighthouseActive = phoenixMeta?.lastOperatorAt
      ? ((now - phoenixMeta.lastOperatorAt) / 3_600_000) >= LIGHTHOUSE_THRESHOLD_HOURS
      : false;
    const highEnergyLowDopamine = settled.energy >= 60 && settled.dopamine < 38;
    if (lighthouseActive) {
      this._phase = 'lighthouse';
      this._boredom = Math.max(0, this._boredom * 0.85);
    } else if (idleMs >= this.idleThresholdMs) {
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

    this._emit('tick', { consolidation, somatic });
    return { status: this.getStatus(), chemistry: settled, consolidation, somatic };
  }

  async runConsolidationAndDream({ now = Date.now(), ai = null, allowModelDream = true, chemistry = null } = {}) {
    this._lastConsolidationAt = now;
    const result = await consolidateEngrams(this.persona, now);
    // While idle, give older memories semantic vectors (a no-op without an embedding model).
    const backfill = await Promise.all([
      backfillEngramEmbeddings(this.persona, { limit: 8 }).catch(() => null),
      backfillMemoryEmbeddings({ limit: 12 }).catch(() => null),
    ]);
    result.embedded = (backfill[0]?.embedded || 0) + (backfill[1]?.embedded || 0);
    const engrams = await listEngrams(this.persona);
    // Sleep replays what mattered: the most salient recent memories, not merely the last few.
    const replayed = selectReplayCandidates(engrams, 5);
    let dream = null;

    if (result.total > 0) {
      let reflection = '';
      if (allowModelDream && ai && typeof ai.chat === 'function') {
        const recentSnippets = replayed
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

      const text = String(reflection || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (text) {
        const sourceIds = replayed.map(e => e.id);
        // The dream feeds back: replayed memories strengthen and link, and the dream itself is
        // kept as her reflection, so it can come back to her in a later conversation.
        const replay = await replayEngrams(this.persona, sourceIds).catch(() => ({ replayed: 0, linksAdded: 0 }));
        const kept = await encodeReflection({
          persona: this.persona,
          text,
          sourceIds,
          themes: result.topThemes,
          now,
        }).catch(() => null);
        dream = {
          id: `dream_${now}`,
          at: now,
          themes: result.topThemes,
          linksAdded: result.linksAdded + replay.linksAdded,
          replayedIds: sourceIds,
          reflectionEngramId: kept?.id || null,
          reflection: text,
        };
        await mutateSetting(DREAMS_KEY, (prior) => [dream, ...(Array.isArray(prior) ? prior : [])].slice(0, MAX_DREAMS), []);
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

