/**
 * RemasterEngine.js — Sovereign Scene Remastering & Narrative Variation Engine
 * 
 * Features:
 * - 7 Specialized Remaster Modes
 * - Side-by-side Diff Analysis
 * - Scene divergence & alternate branch creation
 */

import { remasterScene } from '../../../../services/literatureAiService.js';

export const REMASTER_MODES = [
  { id: 'enhanced', label: 'Enhanced Edition', icon: '✨', description: 'Polishes dialogue, cadence, and sensory immersion.' },
  { id: 'branching_point', label: 'Branching Point', icon: '🔀', description: 'Diverges at a critical tipping point into an alternative reality.' },
  { id: 'genre_shift', label: 'Genre Shift', icon: '🎭', description: 'Transposes the scene into Cyberpunk, Noir, Eldritch, or Space Opera.' },
  { id: 'perspective_flip', label: 'Perspective / POV Flip', icon: '👁️', description: 'Retells the scene through the eyes of the antagonist or secondary character.' },
  { id: 'expanded', label: 'Expanded Edition', icon: '📖', description: 'Deepens lore, atmospheric resonance, and internal monologues.' },
  { id: 'condensed', label: 'Condensed / Fast-Paced', icon: '⚡', description: 'Strips filler for rapid, high-stakes cinematic momentum.' },
  { id: 'full_remaster', label: 'Full Structural Remaster', icon: '💎', description: 'Complete literary overhaul maximizing subtext and emotional punch.' }
];

export class RemasterEngine {
  constructor() {
    this.history = [];
  }

  async generateRemaster({ text, mode, instructions = '', storyBible = null }) {
    if (!text || !text.trim()) throw new Error('Scene text is required for remastering.');
    
    const result = await remasterScene({
      text,
      type: mode,
      instructions,
      storyBible
    });

    const record = {
      id: `rem_${Date.now()}`,
      mode,
      originalText: text,
      remasteredText: result,
      timestamp: new Date().toISOString()
    };

    this.history.unshift(record);
    if (this.history.length > 20) this.history.pop();

    return record;
  }

  /**
   * Simple word-level diff calculation for side-by-side comparison
   */
  computeDiff(original, remastered) {
    const origWords = (original || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean);
    const remWords = (remastered || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean);
    
    const origCount = origWords.length;
    const remCount = remWords.length;
    const diffCount = Math.abs(remCount - origCount);
    const changePercentage = Math.min(100, Math.round((diffCount / Math.max(1, origCount)) * 100));

    return {
      originalWordCount: origCount,
      remasteredWordCount: remCount,
      netDifference: remCount - origCount,
      estimatedChangePercent: changePercentage
    };
  }
}

export const remasterEngine = new RemasterEngine();
