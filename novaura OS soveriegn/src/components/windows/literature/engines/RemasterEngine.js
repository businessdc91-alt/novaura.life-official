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
   * What changed between the original and the remaster: word counts, the share
   * of text kept, and the diff segments for the "show changes" view.
   */
  computeDiff(original, remastered) {
    const plain = (t) => (t || '').replace(/<[^>]+>/g, ' ');
    const origWords = plain(original).split(/\s+/).filter(Boolean);
    const remWords = plain(remastered).split(/\s+/).filter(Boolean);
    const diff = diffText(plain(original), plain(remastered));
    return {
      originalWordCount: origWords.length,
      remasteredWordCount: remWords.length,
      netDifference: remWords.length - origWords.length,
      changedPercent: diff ? diff.changedPercent : null,
      segments: diff ? diff.segments : null,
      granularity: diff ? diff.granularity : null,
    };
  }
}

// Longest-common-subsequence table size limit (cells); about 16 MB.
const MAX_DIFF_CELLS = 4_000_000;

/**
 * Diff of two texts as [{ op: 'same'|'add'|'del', text }], by words, or by
 * sentences when the texts are too long for a word diff. Null if even the
 * sentence diff would be too large. changedPercent: 0 = identical, 100 =
 * nothing kept.
 */
export function diffText(a, b) {
  const byWords = (t) => t.split(/\s+/).filter(Boolean);
  const bySentences = (t) => t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…]["”’]?)\s+/).filter(Boolean);
  for (const [granularity, split] of [['words', byWords], ['sentences', bySentences]]) {
    const x = split(a);
    const y = split(b);
    if ((x.length + 1) * (y.length + 1) > MAX_DIFF_CELLS) continue;
    const segments = lcsDiff(x, y);
    const kept = segments.filter(s => s.op === 'same').reduce((n, s) => n + s.count, 0);
    const total = x.length + y.length;
    const changedPercent = total ? Math.round(100 - (200 * kept) / total) : 0;
    return { granularity, changedPercent, segments: segments.map(({ op, text }) => ({ op, text })) };
  }
  return null;
}

function lcsDiff(x, y) {
  const n = x.length;
  const m = y.length;
  const w = m + 1;
  // table[i * w + j] = LCS length of x[i..] and y[j..]
  const table = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * w + j] = x[i] === y[j]
        ? table[(i + 1) * w + j + 1] + 1
        : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
    }
  }
  const segments = [];
  const push = (op, token) => {
    const last = segments[segments.length - 1];
    if (last && last.op === op) { last.text += ` ${token}`; last.count++; } else segments.push({ op, text: token, count: 1 });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { push('same', x[i]); i++; j++; }
    else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) push('del', x[i++]);
    else push('add', y[j++]);
  }
  while (i < n) push('del', x[i++]);
  while (j < m) push('add', y[j++]);
  return segments;
}

export const remasterEngine = new RemasterEngine();
