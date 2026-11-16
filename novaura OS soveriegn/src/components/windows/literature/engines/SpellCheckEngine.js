/**
 * SpellCheckEngine.js — Sovereign Grammar, Spelling, Style & Readability Engine
 * 
 * Analyzes narrative prose for:
 * - High-frequency English spelling typos & homophone traps with 1-click auto-fix
 * - Passive voice detection
 * - Weak adverbs & filter words ("suddenly", "started to", "felt", "noticed")
 * - Literary clichés & purple prose idioms
 * - Overly complex / sluggish sentence length (rhythm analysis)
 * - Word repetition within rolling 25-word proximity (punctuation-aware with exact index & occurrence)
 * - Weak dialogue tags ("said loudly" vs action beats)
 * - Flesch-Kincaid readability grade, Flesch Reading Ease, and Lexical Diversity (TTR)
 * - Persistent Story-specific custom dictionary stored in Dexie (safe fallback in Node tests)
 */

import { db } from '../../../../database/sovereignDatabase.js';

const MAX_ISSUES = 300;
const DICT_SETTING_KEY = 'literature_custom_dictionary_v1';

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

/** Counts approximate English syllables in a word for Flesch-Kincaid formulas. */
export function countSyllables(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const vowelGroups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : 1);
}

/**
 * Computes Flesch Reading Ease, Flesch-Kincaid Grade Level, Lexical Diversity (TTR),
 * and estimated reading/speaking time from chapter HTML or plain text.
 */
export function computeReadabilityStats(rawHtmlOrText) {
  const plain = htmlToPlainText(rawHtmlOrText).trim();
  if (!plain) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      fleschReadingEase: 0,
      fleschKincaidGrade: 0,
      readingLevelLabel: 'No prose yet',
      lexicalDiversity: 0,
      readingTimeMinutes: 0,
    };
  }
  const words = plain.match(/\b[\w'-]+\b/g) || [];
  const sentences = plain.split(/[.!?…]+/).map(s => s.trim()).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  if (wordCount === 0) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      fleschReadingEase: 0,
      fleschKincaidGrade: 0,
      readingLevelLabel: 'No prose yet',
      lexicalDiversity: 0,
      readingTimeMinutes: 0,
    };
  }

  let syllableCount = 0;
  const uniqueSet = new Set();
  for (const w of words) {
    syllableCount += countSyllables(w);
    uniqueSet.add(w.toLowerCase());
  }

  const asl = wordCount / sentenceCount;
  const asw = syllableCount / wordCount;
  const rawEase = 206.835 - (1.015 * asl) - (84.6 * asw);
  const fleschReadingEase = Math.max(0, Math.min(100, Math.round(rawEase)));
  const rawGrade = (0.39 * asl) + (11.8 * asw) - 15.59;
  const fleschKincaidGrade = Math.max(1, Math.min(20, Math.round(rawGrade * 10) / 10));
  const lexicalDiversity = Math.round((uniqueSet.size / wordCount) * 100);
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 230));

  let readingLevelLabel = 'Literary / Accessible';
  if (fleschReadingEase >= 80) readingLevelLabel = 'Crisp & Fast-Paced';
  else if (fleschReadingEase >= 60) readingLevelLabel = 'Balanced Fiction Cadence';
  else if (fleschReadingEase >= 40) readingLevelLabel = 'Dense / Literary Prose';
  else readingLevelLabel = 'Complex / Academic Density';

  return {
    wordCount,
    sentenceCount,
    syllableCount,
    fleschReadingEase,
    fleschKincaidGrade,
    readingLevelLabel,
    lexicalDiversity,
    readingTimeMinutes,
  };
}

export class SpellCheckEngine {
  constructor(options = {}) {
    this.customDictionary = new Set(options.customDictionary || [
      'novaura', 'cybeni', 'sovereign', 'aethelgard', 'silas', 'vance', 'monad'
    ]);
    this.genre = options.genre || 'general';
    this.ignoredWords = new Set();
    this.cache = new Map();
    this.hydrated = false;
    if (typeof window !== 'undefined') {
      this._hydrateDictionary();
    }
  }

  async _hydrateDictionary() {
    try {
      const saved = await db.getSetting(DICT_SETTING_KEY);
      if (saved && typeof saved === 'object') {
        if (Array.isArray(saved.customWords)) {
          saved.customWords.forEach(w => this.customDictionary.add(String(w).toLowerCase().trim()));
        }
        if (Array.isArray(saved.ignoredWords)) {
          saved.ignoredWords.forEach(w => this.ignoredWords.add(String(w).toLowerCase().trim()));
        }
      }
      this.hydrated = true;
    } catch {
      this.hydrated = true;
    }
  }

  _persistDictionary() {
    if (typeof window === 'undefined') return;
    db.setSetting(DICT_SETTING_KEY, {
      customWords: [...this.customDictionary],
      ignoredWords: [...this.ignoredWords],
    }).catch(() => {});
  }

  static COMMON_MISSPELLINGS = {
    'accomodate': 'accommodate',
    'acheive': 'achieve',
    'arguement': 'argument',
    'beleive': 'believe',
    'calender': 'calendar',
    'camoflage': 'camouflage',
    'catagory': 'category',
    'cemetary': 'cemetery',
    'concious': 'conscious',
    'curiousity': 'curiosity',
    'definately': 'definitely',
    'desparate': 'desperate',
    'dilemna': 'dilemma',
    'dissapear': 'disappear',
    'embarass': 'embarrass',
    'enviroment': 'environment',
    'existance': 'existence',
    'familar': 'familiar',
    'finaly': 'finally',
    'foriegn': 'foreign',
    'fourty': 'forty',
    'freind': 'friend',
    'goverment': 'government',
    'gaurd': 'guard',
    'harrass': 'harass',
    'immediatly': 'immediately',
    'independant': 'independent',
    'interupt': 'interrupt',
    'knowlege': 'knowledge',
    'liason': 'liaison',
    'maintainance': 'maintenance',
    'millenium': 'millennium',
    'miniscule': 'minuscule',
    'mispell': 'misspell',
    'neccessary': 'necessary',
    'noticable': 'noticeable',
    'occassion': 'occasion',
    'occured': 'occurred',
    'occurence': 'occurrence',
    'parliment': 'parliament',
    'percieve': 'perceive',
    'persistant': 'persistent',
    'pharoah': 'pharaoh',
    'posession': 'possession',
    'priviledge': 'privilege',
    'recieve': 'receive',
    'recomend': 'recommend',
    'refered': 'referred',
    'religous': 'religious',
    'rember': 'remember',
    'resistence': 'resistance',
    'rythm': 'rhythm',
    'seige': 'siege',
    'seperate': 'separate',
    'succesful': 'successful',
    'enviromental': 'environmental',
    'supress': 'suppress',
    'suprise': 'surprise',
    'tatoo': 'tattoo',
    'tendancy': 'tendency',
    'therefor': 'therefore',
    'threshhold': 'threshold',
    'tommorow': 'tomorrow',
    'tounge': 'tongue',
    'truely': 'truly',
    'unforseen': 'unforeseen',
    'unfortunatly': 'unfortunately',
    'untill': 'until',
    'vengeence': 'vengeance',
    'wierd': 'weird',
  };

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
    cliches: {
      phrases: ['cold as ice', 'dead of night', 'sigh of relief', 'blood ran cold', 'heart skipped a beat', 'deafening silence', 'avoid like the plague', 'bated breath', 'in the nick of time', 'let out a breath'],
      message: 'Literary cliché: Consider a fresh sensory detail or original metaphor.',
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
    this._persistDictionary();
  }

  ignoreWord(word) {
    if (word) {
      this.ignoredWords.add(word.toLowerCase().trim());
      this._persistDictionary();
    }
  }

  getCustomDictionaryWords() {
    return [...this.customDictionary];
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
    const ignored = (text) => {
      const low = String(text).toLowerCase().trim();
      return this.ignoredWords.has(low) || this.customDictionary.has(low);
    };
    const push = (issue) => {
      if (suggestions.length < MAX_ISSUES && !ignored(issue.text)) suggestions.push(issue);
    };

    // 0. Spelling Typos Check (with 1-click replacement preserving capitalization)
    for (const [typo, fix] of Object.entries(SpellCheckEngine.COMMON_MISSPELLINGS)) {
      if (!fix) continue;
      const re = phraseRegex(typo);
      let occurrence = 0;
      let match;
      while ((match = re.exec(plainText)) !== null) {
        const matchedText = match[0];
        const isCapitalized = matchedText[0] === matchedText[0].toUpperCase() && matchedText[0] !== matchedText[0].toLowerCase();
        const casedFix = isCapitalized ? fix[0].toUpperCase() + fix.slice(1) : fix;
        push({
          id: `sp_${match.index}`,
          type: 'spelling',
          text: matchedText,
          index: match.index,
          occurrence,
          length: matchedText.length,
          message: `Possible misspelling: "${matchedText}" → "${casedFix}".`,
          severity: 'warning',
          replacement: casedFix,
        });
        occurrence++;
      }
    }

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

    // 2. Weak adverbs, filter words, clichés, and weak dialogue tags (single words and phrases).
    //    Single words can simply be cut; phrases need rewording, so they are only flagged.
    const phraseRules = [
      ...rules.weakAdverbs.words.map(w => ({ w, type: 'weak_adverb', prefix: 'wa' })),
      ...rules.filterWords.words.map(w => ({ w, type: 'filter_word', prefix: 'fw' })),
      ...rules.dialogueTags.weakTags.map(w => ({ w, type: 'dialogue_tag', prefix: 'dt' })),
      ...(rules.cliches?.phrases || []).map(w => ({ w, type: 'cliche', prefix: 'cl' })),
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
            : type === 'cliche'
              ? `Cliché phrase "${text}": ${rules.cliches.message}`
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
          replacement: single && type !== 'dialogue_tag' && type !== 'cliche' ? '' : null
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

    // 4. Repeated Words in Proximity Check (within 25 words, punctuation-safe with exact index & occurrence)
    const wordTokens = [];
    const tokenRe = /\b[\w'-]+\b/g;
    const seenCounts = new Map();
    while ((match = tokenRe.exec(plainText)) !== null) {
      const raw = match[0];
      const low = raw.toLowerCase();
      const occ = seenCounts.get(low) || 0;
      seenCounts.set(low, occ + 1);
      wordTokens.push({ raw, low, index: match.index, occurrence: occ });
    }

    const recentWords = [];
    for (let i = 0; i < wordTokens.length; i++) {
      const tok = wordTokens[i];
      if (tok.low.length > 5 && !this.customDictionary.has(tok.low) && !this.ignoredWords.has(tok.low)) {
        const dupIdx = recentWords.findIndex(item => item.word === tok.low);
        if (dupIdx !== -1 && (i - recentWords[dupIdx].pos) < 25) {
          push({
            id: `rep_${tok.index}`,
            type: 'repetition',
            text: tok.raw,
            index: tok.index,
            occurrence: tok.occurrence,
            length: tok.raw.length,
            message: `Echo word: "${tok.raw}" was used ${i - recentWords[dupIdx].pos} words ago.`,
            severity: 'suggestion',
            replacement: null
          });
        }
        recentWords.push({ word: tok.low, pos: i });
        if (recentWords.length > 35) recentWords.shift();
      }
    }

    return suggestions.sort((x, y) => x.index - y.index);
  }
}

export const spellCheckEngine = new SpellCheckEngine();
