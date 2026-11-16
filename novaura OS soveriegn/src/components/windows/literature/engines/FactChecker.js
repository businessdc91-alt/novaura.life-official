/**
 * FactChecker.js — Sovereign Narrative Fact & Worldbuilding Canon Verification Engine
 * 
 * Capabilities:
 * - Scans manuscript prose to extract verifiable claims (dates, geography, biology, physical laws, canon lore, character/faction assertions)
 * - Automatically cross-references the Story Bible Codex (characters, states, world lore, relationships, timeline)
 * - Persists custom worldbuilding canon facts in Dexie (`literature_canon_facts_v1`) so rules survive reloads
 * - AI verification against real-world knowledge and Story Bible canon with citations
 */

import { db } from '../../../../database/sovereignDatabase.js';
import { verifyFactualClaim } from '../../../../services/literatureAiService.js';
import { storyTimeline } from './StoryTimeline.js';
import { phraseRegex } from './SpellCheckEngine.js';

const CANON_SETTING_KEY = 'literature_canon_facts_v1';

export class FactChecker {
  constructor(options = {}) {
    this.customFacts = options.customFacts || [];
    this.verificationCache = new Map();
    this.hydrated = false;
    if (typeof window !== 'undefined') {
      this._hydrate();
    }
  }

  async _hydrate() {
    try {
      const saved = await db.getSetting(CANON_SETTING_KEY);
      if (Array.isArray(saved)) {
        const existingClaims = new Set(this.customFacts.map(f => f.claim));
        for (const item of saved) {
          if (item?.claim && !existingClaims.has(item.claim)) {
            this.customFacts.push(item);
          }
        }
      }
      this.hydrated = true;
      window.dispatchEvent(new CustomEvent('novaura:canon_updated'));
    } catch {
      this.hydrated = true;
    }
  }

  _persist() {
    if (typeof window === 'undefined') return;
    db.setSetting(CANON_SETTING_KEY, this.customFacts.slice(-200)).catch(() => {});
    window.dispatchEvent(new CustomEvent('novaura:canon_updated'));
  }

  addCustomCanonFact(fact) {
    if (!fact) return null;
    const item = {
      id: `canon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      claim: typeof fact === 'string' ? fact.trim() : String(fact.claim || '').trim(),
      category: fact.category || 'worldbuilding',
      canon: true,
      timestamp: Date.now()
    };
    if (!item.claim) return null;
    this.customFacts.push(item);
    this.verificationCache.clear();
    this._persist();
    return item;
  }

  deleteCustomCanonFact(id) {
    this.customFacts = this.customFacts.filter(f => f.id !== id);
    this.verificationCache.clear();
    this._persist();
  }

  /**
   * Claim extractor: identifies statements asserting facts, distances, numbers, historical events,
   * physical laws, or sentences making factual assertions about registered Codex characters/lore.
   */
  extractPotentialClaims(text) {
    if (!text) return [];
    const clean = text.replace(/<[^>]+>/g, ' ');
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 18);

    const claimPatterns = [
      /\b(is|was|are|were)\s+(located|born|forged|sealed|buried|stationed|ruled|governed)\s+(in|at|by|under|on)\b/i,
      /\b(invented|discovered|founded|destroyed|built|signed|collapsed|fought)\s+(in|during|over)\s+(\d{2,4}|\w+\s+(years|centuries|decades))\b/i,
      /\b\d+(\.\d+)?\s+(miles|kilometers|km|lightyears|parsecs|meters|feet|leagues|hours|days|years|centuries|generations|degrees|percent|%)\b/i,
      // Rules of the world, not everyday "never looked back" / "only a moment".
      /\b(cannot|can never|always|never|must|impossible to|forbidden to)\s+(survive|travel|exist|die|breathe|age|cross|enter|leave|wield|return|heal|lie|be killed)\b/i,
      /\b(temperature of|speed of|gravity|orbit|population of|capital of|chemical|law of|decree of|treaty of|bloodline of)\b/i,
      /\b(known as|nicknamed|commander of|heir to|leader of|founder of|capital is)\b/i,
    ];

    const codexNames = [
      ...storyTimeline.characters.map(c => c.name),
      ...storyTimeline.settings.map(s => s.name),
    ].filter(n => n && n.trim().length >= 3);

    // Statements of record about a Codex entry (not "Mara was tired").
    const assertionVerbs = /\b(died|dies|killed|ruled|rules|owned|owns|betrayed|built|destroyed|founded|married|born|(?:is|was) the|heir|leader|commander|has never|had never)\b/i;

    const detected = [];
    for (const s of sentences) {
      const trimmed = s.trim();
      let matchedReason = null;

      for (const pattern of claimPatterns) {
        if (pattern.test(trimmed)) {
          matchedReason = 'Factual / Quantitative Assertion';
          break;
        }
      }

      if (!matchedReason && codexNames.length && assertionVerbs.test(trimmed)) {
        const hit = codexNames.find(name => phraseRegex(name).test(trimmed));
        if (hit) matchedReason = `Codex Entity Claim (${hit})`;
      }

      if (matchedReason) {
        detected.push({
          id: `claim_${detected.length}_${Math.random().toString(36).substring(2, 7)}`,
          sentence: trimmed,
          category: matchedReason,
          verified: false,
          status: 'unverified',
          confidence: null,
          sources: []
        });
      }
      if (detected.length >= 20) break;
    }

    return detected;
  }

  /**
   * Verify claim using local canon, Story Bible Codex, and AI verification
   */
  async verifyClaim(claimItem, worldCanonString = '', sceneContext = '') {
    const cacheKey = claimItem.sentence || claimItem;
    if (this.verificationCache.has(cacheKey)) {
      return this.verificationCache.get(cacheKey);
    }

    const norm = (t) => String(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const canonMatch = this.customFacts.find(cf => norm(cf.claim) === norm(cacheKey));

    // Only a sentence that states a canon fact itself counts as verified by the
    // canon. Naming a Deceased/Missing/Captive character is not a contradiction
    // by itself ("Kael was buried beneath the oaks" fits Kael being dead), so
    // those states go to the model as explicit context instead of a verdict.
    const stateConflicts = storyTimeline.findStateConflicts(cacheKey);
    const stateText = stateConflicts.length
      ? `STATE OF CHARACTERS NAMED IN THIS CLAIM (Story Bible):\n${stateConflicts.map(c => `- ${c.name} is currently ${c.state}`).join('\n')}`
      : '';

    if (canonMatch) {
      const result = {
        status: 'VERIFIED',
        confidence: 100,
        explanation: 'Directly verified by author-defined Worldbuilding Canon rule.',
        sources: [`Canon Rule: ${canonMatch.claim}`]
      };
      this.verificationCache.set(cacheKey, result);
      return result;
    }

    // Automatically combine custom canon facts + Story Bible context (characters, lore, timeline)
    const customRulesText = this.customFacts.map(cf => `- ${cf.claim}`).join('\n');
    const bibleText = storyTimeline.bibleContext(2500, cacheKey);
    const fullCanon = [stateText, worldCanonString, customRulesText, bibleText].filter(Boolean).join('\n\n');

    try {
      const result = await verifyFactualClaim({
        claim: cacheKey,
        worldCanon: fullCanon,
        context: sceneContext
      });
      this.verificationCache.set(cacheKey, result);
      return result;
    } catch (err) {
      return {
        status: 'UNVERIFIED',
        confidence: 0,
        explanation: err.message || 'Verification engine unavailable.',
        sources: []
      };
    }
  }
}

export const factChecker = new FactChecker();
