/**
 * FactChecker.js — Sovereign Narrative Fact & Worldbuilding Canon Verification Engine
 * 
 * Capabilities:
 * - Scans manuscript prose to extract verifiable claims (dates, geography, biology, physical laws, canon lore)
 * - Verifies claims against established Story Bible worldbuilding rules
 * - AI verification against real-world knowledge or custom world canon with citations
 * - Caches verification results in memory and local storage
 */

import { verifyFactualClaim } from '../../../../services/literatureAiService.js';

export class FactChecker {
  constructor(options = {}) {
    this.customFacts = options.customFacts || [];
    this.verificationCache = new Map();
  }

  addCustomCanonFact(fact) {
    if (!fact) return;
    this.customFacts.push({
      id: `canon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      claim: fact.claim || fact,
      category: fact.category || 'worldbuilding',
      canon: true,
      timestamp: Date.now()
    });
  }

  /**
   * Heuristic claim extractor: identifies statements asserting facts, distances, numbers, historical events
   */
  extractPotentialClaims(text) {
    if (!text) return [];
    const clean = text.replace(/<[^>]+>/g, ' ');
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 20);

    const claimPatterns = [
      /\b(is|was|are|were)\s+located\s+in\b/i,
      /\b(invented|discovered|founded|destroyed|built)\s+in\s+\d{3,4}\b/i,
      /\b\d+\s+(miles|kilometers|lightyears|parsecs|meters|feet)\s+(away|from|wide|deep)\b/i,
      /\b(cannot|always|never|must)\s+(survive|travel|exist|die|breathe)\b/i,
      /\b(temperature of|speed of|gravity on|chemical composition of)\b/i,
      /\b(rule of the|law of|decree of)\b/i,
    ];

    const detected = [];
    for (const s of sentences) {
      for (const pattern of claimPatterns) {
        if (pattern.test(s)) {
          detected.push({
            id: `claim_${Math.random().toString(36).substring(2, 8)}`,
            sentence: s.trim(),
            verified: false,
            status: 'unverified',
            confidence: null,
            sources: []
          });
          break;
        }
      }
    }

    return detected.slice(0, 15);
  }

  /**
   * Verify claim using local canon and AI verification
   */
  async verifyClaim(claimItem, worldCanonString = '', sceneContext = '') {
    const cacheKey = claimItem.sentence || claimItem;
    if (this.verificationCache.has(cacheKey)) {
      return this.verificationCache.get(cacheKey);
    }

    // Only a sentence that states a canon fact itself counts as verified by the
    // canon. Sharing a name or a few words with one proves nothing, so
    // everything else goes to the model, with the canon as context.
    const norm = (t) => String(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const canonMatch = this.customFacts.find(cf => norm(cf.claim) === norm(cacheKey));
    if (!canonMatch && this.customFacts.length) {
      const canonText = this.customFacts.map(cf => `- ${cf.claim}`).join('\n');
      worldCanonString = worldCanonString ? `${worldCanonString}\n${canonText}` : canonText;
    }

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

    try {
      const result = await verifyFactualClaim({
        claim: cacheKey,
        worldCanon: worldCanonString,
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
