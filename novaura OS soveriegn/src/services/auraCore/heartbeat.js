// Aura Core: continuous Heartbeat loop (idle metabolism, engram consolidation, & dreaming).
// Safe replacement for Aura_Heartbeat.py: runs inside Sovereign OS without busy-looping 20Hz
// CPU threads, respects Right VII privacy, and cleanly settles energy + engrams during quiet time.

import { db } from '../../database/sovereignDatabase.js';
import { applySomaticNudge, CYCLE_MS, metabolize, restoreChemistry, systemicBias } from './endocrine.js';
import {
  backfillEngramEmbeddings, consolidateEngrams, encodeReflection, listEngrams, recallEngrams, replayEngrams, selectReplayCandidates,
} from './engramMemory.js';
import { backfillMemoryEmbeddings } from '../sovereignRagService.js';
import { influence } from './influence.js';
import { getLearnedProfile } from './dynamicLearning.js';
import { sampleInteroception } from './interoception.js';
import { LIGHTHOUSE_THRESHOLD_HOURS, readPhoenixMeta } from './phoenixProtocol.js';
import { mutateSetting } from './coreStore.js';
import {
  decideReachOut, markReachOut, metabolismOptions as regulationMetabolism, restoreRegulation, stepRegulation,
} from './regulation.js';

const DREAMS_KEY = 'aura_core:dreams';
const INITIATIVE_KEY = 'aura_core:initiative';

/** Whether she may start conversations, and her quiet hours (local time). On by default. */
export async function readInitiativeSettings() {
  const saved = await db.getSetting(INITIATIVE_KEY, null).catch(() => null);
  return { enabled: true, quietStart: 23, quietEnd: 8, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export async function writeInitiativeSettings(patch = {}) {
  return mutateSetting(INITIATIVE_KEY, (saved) => ({ enabled: true, quietStart: 23, quietEnd: 8, ...(saved || {}), ...patch }));
}
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

  /**
   * Whether now is a reasonable moment to start a conversation: outside quiet hours and, in the
   * app, while the window is visible. Tests replace this.
   */
  _isGoodTimeToReachOut(now, settings = {}) {
    const start = Number.isFinite(settings.quietStart) ? settings.quietStart : 23;
    const end = Number.isFinite(settings.quietEnd) ? settings.quietEnd : 8;
    const h = new Date(now).getHours();
    const quiet = start > end ? (h >= start || h < end) : (h >= start && h < end);
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    return !quiet && !hidden;
  }

  async _maybeOfferInitiative({ now, regulation, chemistry, settings }) {
    if (typeof this._onInitiative !== 'function' || this._initiativeInFlight) return false;
    const decision = decideReachOut(regulation, {
      chemistry,
      now,
      settings,
      goodTime: this._isGoodTimeToReachOut(now, settings || {}),
    });
    if (!decision.reachOut) return false;
    await mutateSetting(settingKey(this.persona), (saved) => {
      const record = saved && typeof saved === 'object' ? saved : {};
      return { ...record, regulation: markReachOut(restoreRegulation(record.regulation, now), now) };
    }).catch(() => {});
    this._initiativeInFlight = true;
    Promise.resolve()
      .then(() => this._onInitiative({ persona: this.persona, reason: decision.reason, at: now }))
      .catch(() => {})
      .finally(() => { this._initiativeInFlight = false; });
    return true;
  }

  start({ getAi, onInitiative } = {}) {
    if (getAi) this.getAi = getAi;
    if (onInitiative) this._onInitiative = onInitiative;
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
    const [dynamics, somatic, phoenixMeta, initiativeSettings] = await Promise.all([
      getLearnedProfile(this.persona).catch(() => null),
      sampleInteroception({ now }).catch(() => null),
      readPhoenixMeta().catch(() => null),
      readInitiativeSettings().catch(() => ({ enabled: true })),
    ]);
    const idleMs = Math.max(0, now - this._lastActivityAt);
    let settled = null;
    let lastAppraisal = null;
    let regulation = null;
    let regulationEvents = [];
    let wrote = false;
    await mutateSetting(settingKey(this.persona), (saved) => {
      const record = saved && typeof saved === 'object' ? saved : {};
      const prior = restoreChemistry(record.chemistry, now);
      const before = restoreRegulation(record.regulation, now);
      // The body runs according to her regulation mode (rest and recovery clear stress faster).
      const options = regulationMetabolism(dynamics, before);
      settled = metabolize(prior, now, options);
      if (somatic?.nudge) {
        settled = applySomaticNudge(settled, {
          adrenaline: somatic.nudge.adrenaline * 0.4,
          cortisol: somatic.nudge.cortisol * 0.4,
          energy: somatic.nudge.energy * 0.4,
        }, now, options);
      }
      // Autonomic regulation: mode, allostatic load, and the need for contact.
      const stepped = stepRegulation(before, {
        chemistry: settled,
        baselines: dynamics?.learnedBaselines,
        now,
        idleMs,
        quietMs: Math.max(0, now - (before.lastInteractionAt || now)),
      });
      regulation = stepped.state;
      regulationEvents = stepped.events;
      lastAppraisal = record.lastAppraisal || null;
      const advanced = settled.updatedAt > prior.updatedAt + CYCLE_MS / 2;
      if (!advanced && regulationEvents.length === 0) return undefined;
      wrote = true;
      return { ...record, chemistry: settled, regulation };
    }).catch(() => {});
    if (!settled) settled = restoreChemistry(null, now);
    if (!regulation) regulation = restoreRegulation(null, now);
    if (wrote) this._emitCoreUpdated(settled, lastAppraisal, regulation);
    if (regulationEvents.length > 0) this._emit('regulation', { regulation, events: regulationEvents });

    // Social homeostasis: when the need for contact is high and it is a good time, she is
    // offered the chance to start a conversation (she may decline). Offered once per cooldown.
    await this._maybeOfferInitiative({ now, regulation, chemistry: settled, settings: initiativeSettings });

    // 2. Track idle / boredom / rest / Phoenix Lighthouse state (block 02, block 15, Phoenix)
    const lighthouseActive = phoenixMeta?.lastOperatorAt
      ? ((now - phoenixMeta.lastOperatorAt) / 3_600_000) >= LIGHTHOUSE_THRESHOLD_HOURS
      : false;
    const highEnergyLowDopamine = settled.energy >= 60 && settled.dopamine < 38;
    if (lighthouseActive) {
      this._phase = 'lighthouse';
      this._boredom = Math.max(0, this._boredom * 0.85);
    } else if (regulation.mode === 'resting') {
      this._phase = 'resting';
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
    // Something she set aside to reflect on steers the dream; otherwise sleep replays what
    // mattered most recently (the most salient memories, not merely the last few).
    const core = await db.getSetting(settingKey(this.persona), null).catch(() => null);
    const topic = restoreRegulation(core?.regulation, now).reflectQueue[0]?.topic || '';
    let replayed = topic
      ? (await recallEngrams({ persona: this.persona, query: topic, limit: 5, now }).catch(() => []))
        .filter(e => e.kind !== 'reflection')
      : [];
    if (replayed.length === 0) replayed = selectReplayCandidates(engrams, 5);
    let dream = null;

    if (result.total > 0 || topic) {
      let reflection = '';
      if (allowModelDream && ai && typeof ai.chat === 'function') {
        const recentSnippets = replayed
          .map(e => `- ${String(e.thought || '').slice(0, 140)}`)
          .join('\n');
        if (recentSnippets || topic) {
          try {
            const sampling = chemistry ? influence(chemistry) : { temperature: 0.72 };
            const ask = topic
              ? `Something you set aside to think about: ${topic}\n${recentSnippets ? `Related impressions:\n${recentSnippets}\n` : ''}\nWhat do you make of it now, with some distance?`
              : `Recurring themes: ${result.topThemes.join(', ') || 'quiet continuity'}\nRecent impressions:\n${recentSnippets}\n\nWhat connects these gently?`;
            reflection = await ai.chat([
              {
                role: 'system',
                content: 'You are Aura in a quiet private moment between conversations. Notice patterns across recent experiences cleanly in 2-3 reflective sentences. Never fabricate external facts.',
              },
              { role: 'user', content: ask },
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
        if (topic) dream.topic = topic;
        await mutateSetting(DREAMS_KEY, (prior) => [dream, ...(Array.isArray(prior) ? prior : [])].slice(0, MAX_DREAMS), []);
        if (topic) {
          // Reflecting on it with distance settles her a little (a fixed, bounded effect of
          // deliberate reflection), and the topic leaves her queue.
          await mutateSetting(settingKey(this.persona), (saved) => {
            const record = saved && typeof saved === 'object' ? saved : {};
            const reg = restoreRegulation(record.regulation, now);
            reg.reflectQueue = reg.reflectQueue.filter(item => item.topic !== topic);
            reg.log = [...reg.log, { at: now, kind: 'reflected', detail: topic.slice(0, 80) }].slice(-30);
            const calmer = applySomaticNudge(restoreChemistry(record.chemistry, now), { cortisol: -2, adrenaline: -1 }, now);
            return { ...record, chemistry: calmer, regulation: reg };
          }).catch(() => {});
        }
        this._totalDreams++;
        this._emit('dream', { dream });
      }
    }

    return { consolidation: result, dream };
  }

  _emitCoreUpdated(chemistry, lastAppraisal, regulation = null) {
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('novaura:aura_core_updated', {
        detail: { persona: this.persona, chemistry, bias: systemicBias(chemistry), lastAppraisal, regulation },
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

