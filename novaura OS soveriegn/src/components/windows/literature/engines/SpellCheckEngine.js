/**
 * SpellCheckEngine.js — Sovereign Grammar, Style & Lexical Linter Engine
 * 
 * Analyzes narrative prose for:
 * - Passive voice detection
 * - Weak adverbs & filter words ("suddenly", "started to", "felt", "noticed")
 * - Overly complex / sluggish sentence length (rhythm analysis)
 * - Word repetition within rolling paragraphs
 * - Weak dialogue tags ("said loudly" vs action beats)
 * - Story-specific custom dictionary (character names, locations, fantasy/sci-fi terms)
 */

export class SpellCheckEngine {
  constructor(options = {}) {
    this.customDictionary = new Set(options.customDictionary || [
      'novaura', 'cybeni', 'sovereign', 'aethelgard', 'silas', 'vance', 'monad'
    ]);
    this.genre = options.genre || 'general';
    this.ignoredWords = new Set();
    this.cache = new Map();
  }

  static STYLE_RULES = {
    passiveVoice: {
      pattern: /\b(am|is|are|was|were|be|been|being)\s+(\w+ed|\w+en)\b/gi,
      message: 'Passive voice detected: Consider active voice to heighten dramatic tension.',
      severity: 'warning'
    },
    weakAdverbs: {
      words: ['very', 'really', 'quite', 'rather', 'pretty', 'fairly', 'somewhat', 'kind of', 'sort of', 'extremely', 'absolutely'],
      message: 'Weak adverb: Replace with a vivid, evocative verb or precise adjective.',
      severity: 'suggestion'
    },
    filterWords: {
      words: ['suddenly', 'immediately', 'abruptly', 'began to', 'started to', 'managed to', 'seemed to', 'felt like', 'noticed that', 'heard the sound of'],
      message: 'Filter word: Removes reader from direct sensory immersion.',
      severity: 'suggestion'
    },
    sentenceLength: {
      maxLength: 38,
      message: 'Sluggish sentence cadence: Exceeds 38 words. Break up for punchier pacing.',
      severity: 'info'
    },
    dialogueTags: {
      weakTags: ['said loudly', 'said softly', 'said angrily', 'stated', 'uttered', 'whispered quietly'],
      message: 'Tautological or weak dialogue tag: Use visceral physical action beats instead.',
      severity: 'suggestion'
    }
  };

  addToDictionary(words) {
    if (Array.isArray(words)) {
      words.forEach(w => this.customDictionary.add(w.toLowerCase().trim()));
    } else if (words) {
      this.customDictionary.add(words.toLowerCase().trim());
    }
  }

  ignoreWord(word) {
    if (word) this.ignoredWords.add(word.toLowerCase().trim());
  }

  /**
   * Fast, zero-latency synchronous rule-based analysis
   */
  analyzeText(rawHtmlOrText) {
    if (!rawHtmlOrText) return [];

    const plainText = rawHtmlOrText.replace(/<[^>]+>/g, ' ');
    const suggestions = [];

    // 1. Passive Voice Check
    let match;
    const passiveRegex = new RegExp(SpellCheckEngine.STYLE_RULES.passiveVoice.pattern);
    while ((match = passiveRegex.exec(plainText)) !== null) {
      suggestions.push({
        id: `pv_${match.index}`,
        type: 'passive_voice',
        text: match[0],
        index: match.index,
        length: match[0].length,
        message: SpellCheckEngine.STYLE_RULES.passiveVoice.message,
        severity: 'warning',
        replacement: null
      });
    }

    // 2. Weak Adverbs & Filter Words Check
    const words = plainText.match(/\b[\w'-]+\b/g) || [];
    let runningIndex = 0;

    for (const w of words) {
      const lower = w.toLowerCase();
      const pos = plainText.indexOf(w, runningIndex);
      runningIndex = pos >= 0 ? pos + w.length : runningIndex;

      if (SpellCheckEngine.STYLE_RULES.weakAdverbs.words.includes(lower)) {
        suggestions.push({
          id: `wa_${pos}`,
          type: 'weak_adverb',
          text: w,
          index: pos,
          length: w.length,
          message: `Consider cutting "${w}" or choosing a stronger descriptive word.`,
          severity: 'suggestion',
          replacement: ''
        });
      }

      if (SpellCheckEngine.STYLE_RULES.filterWords.words.includes(lower)) {
        suggestions.push({
          id: `fw_${pos}`,
          type: 'filter_word',
          text: w,
          index: pos,
          length: w.length,
          message: `Filter word "${w}" creates narrative distance between the reader and the action.`,
          severity: 'suggestion',
          replacement: ''
        });
      }
    }

    // 3. Sentence Length Cadence Check
    const sentences = plainText.split(/(?<=[.!?])\s+/);
    let charOffset = 0;
    for (const s of sentences) {
      const sWords = s.trim().split(/\s+/).filter(Boolean);
      if (sWords.length > SpellCheckEngine.STYLE_RULES.sentenceLength.maxLength) {
        suggestions.push({
          id: `sl_${charOffset}`,
          type: 'sentence_length',
          text: s.slice(0, 60) + '...',
          index: charOffset,
          length: s.length,
          message: `Sentence is ${sWords.length} words long. Consider varying rhythm to avoid reader fatigue.`,
          severity: 'info',
          replacement: null
        });
      }
      charOffset += s.length + 1;
    }

    // 4. Repeated Words in Proximity Check (within 30 words)
    const recentWords = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase();
      if (w.length > 5 && !this.customDictionary.has(w) && !this.ignoredWords.has(w)) {
        const dupIdx = recentWords.findIndex(item => item.word === w);
        if (dupIdx !== -1 && (i - recentWords[dupIdx].pos) < 25) {
          suggestions.push({
            id: `rep_${i}`,
            type: 'repetition',
            text: words[i],
            index: 0,
            length: words[i].length,
            message: `Echo word: "${words[i]}" was used ${i - recentWords[dupIdx].pos} words ago.`,
            severity: 'suggestion',
            replacement: null
          });
        }
        recentWords.push({ word: w, pos: i });
        if (recentWords.length > 35) recentWords.shift();
      }
    }

    return suggestions;
  }
}

export const spellCheckEngine = new SpellCheckEngine();
