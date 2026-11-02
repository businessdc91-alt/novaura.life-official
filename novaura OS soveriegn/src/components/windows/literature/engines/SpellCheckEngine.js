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

const MAX_ISSUES = 300;

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };

/** Chapter HTML as the text a reader sees (tags removed, common entities decoded). */
export function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (_, e) => ENTITIES[e]);
}

/** Case-insensitive whole-word matcher for a word or phrase (any whitespace between words). */
export function phraseRegex(phrase) {
  const body = String(phrase).trim().split(/\s+/).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  return new RegExp(`(?<![\\w'-])${body}(?![\\w'-])`, 'gi');
}

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
   * Fast, zero-latency synchronous rule-based analysis.
   *
   * Each word or phrase issue carries `occurrence`: which match of `text` in
   * the chapter it is (0 = first, case-insensitive, whole words), so a fix can
   * change exactly that one (see findPhrase). At most MAX_ISSUES are returned.
   */
  analyzeText(rawHtmlOrText) {
    if (!rawHtmlOrText) return [];

    const plainText = htmlToPlainText(rawHtmlOrText);
    const rules = SpellCheckEngine.STYLE_RULES;
    const suggestions = [];
    const ignored = (text) => this.ignoredWords.has(String(text).toLowerCase().trim());
    const push = (issue) => {
      if (suggestions.length < MAX_ISSUES && !ignored(issue.text)) suggestions.push(issue);
    };

    // 1. Passive Voice Check
    let match;
    const passiveRegex = new RegExp(rules.passiveVoice.pattern);
    while ((match = passiveRegex.exec(plainText)) !== null) {
      push({
        id: `pv_${match.index}`,
        type: 'passive_voice',
        text: match[0],
        index: match.index,
        length: match[0].length,
        message: rules.passiveVoice.message,
        severity: 'warning',
        replacement: null
      });
    }

    // 2. Weak adverbs, filter words and weak dialogue tags (single words and phrases).
    //    Single words can simply be cut; phrases need rewording, so they are only flagged.
    const phraseRules = [
      ...rules.weakAdverbs.words.map(w => ({ w, type: 'weak_adverb', prefix: 'wa' })),
      ...rules.filterWords.words.map(w => ({ w, type: 'filter_word', prefix: 'fw' })),
      ...rules.dialogueTags.weakTags.map(w => ({ w, type: 'dialogue_tag', prefix: 'dt' })),
    ];
    for (const { w, type, prefix } of phraseRules) {
      const re = phraseRegex(w);
      let occurrence = 0;
      while ((match = re.exec(plainText)) !== null) {
        const text = match[0];
        const single = !/\s/.test(w);
        const message = type === 'weak_adverb'
          ? `Consider cutting "${text}" or choosing a stronger descriptive word.`
          : type === 'filter_word'
            ? `Filter word "${text}" creates narrative distance between the reader and the action.`
            : rules.dialogueTags.message;
        push({
          id: `${prefix}_${match.index}`,
          type,
          text,
          index: match.index,
          occurrence,
          length: text.length,
          message,
          severity: 'suggestion',
          replacement: single && type !== 'dialogue_tag' ? '' : null
        });
        occurrence++;
      }
    }

    // 3. Sentence Length Cadence Check
    const sentences = plainText.split(/(?<=[.!?])\s+/);
    let charOffset = 0;
    for (const s of sentences) {
      const sWords = s.trim().split(/\s+/).filter(Boolean);
      if (sWords.length > rules.sentenceLength.maxLength) {
        push({
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

    // 4. Repeated Words in Proximity Check (within 25 words)
    const words = plainText.match(/[\w'-]+/g) || [];
    const recentWords = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i].toLowerCase();
      if (w.length > 5 && !this.customDictionary.has(w) && !this.ignoredWords.has(w)) {
        const dupIdx = recentWords.findIndex(item => item.word === w);
        if (dupIdx !== -1 && (i - recentWords[dupIdx].pos) < 25) {
          push({
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

    return suggestions.sort((x, y) => x.index - y.index);
  }
}

export const spellCheckEngine = new SpellCheckEngine();
