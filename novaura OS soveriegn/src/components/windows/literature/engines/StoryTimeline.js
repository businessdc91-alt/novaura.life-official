/**
 * StoryTimeline.js — Sovereign Story Bible, Event Timeline, World Lore & Continuity Engine
 * 
 * Features:
 * - 15 Event Types with custom icons & visual metadata
 * - Character State tracking (Active, Injured, Deceased, Captive, Missing)
 * - World Lore Codex (Locations, Factions, Magic/Tech Systems, Artifacts, Historical Eras)
 * - Dynamic Character Relationship Evolution mapping
 * - Scrivener/Novelcrafter Plot Threads & Beat Sheet Templates (Save the Cat!, Hero's Journey, 3-Act, 7-Point)
 * - Smart Entity-Aware Context Builder (prioritizes @mentioned and in-scene entities)
 * - Deterministic character state conflict detector & global entity rename
 */

import { db } from '../../../../database/sovereignDatabase.js';
import { htmlToPlainText, phraseRegex } from './SpellCheckEngine.js';

export const EVENT_TYPES = {
  DEATH: { id: 'death', label: 'Death', icon: '💀', color: '#ef4444' },
  INJURY: { id: 'injury', label: 'Injury', icon: '🩹', color: '#f97316' },
  PARTING: { id: 'parting', label: 'Parting', icon: '🚪', color: '#8b5cf6' },
  TRAUMA: { id: 'trauma', label: 'Trauma', icon: '💔', color: '#ec4899' },
  BIRTH: { id: 'birth', label: 'Birth', icon: '🌱', color: '#10b981' },
  REVELATION: { id: 'revelation', label: 'Revelation', icon: '💡', color: '#f59e0b' },
  RELATIONSHIP_CHANGE: { id: 'relationship_change', label: 'Relationship', icon: '💞', color: '#ec4899' },
  MAJOR_DECISION: { id: 'major_decision', label: 'Decision', icon: '🎯', color: '#3b82f6' },
  BATTLE: { id: 'battle', label: 'Battle / Conflict', icon: '⚔️', color: '#dc2626' },
  JOURNEY: { id: 'journey', label: 'Journey', icon: '🧭', color: '#06b6d4' },
  DISCOVERY: { id: 'discovery', label: 'Discovery', icon: '🔍', color: '#a855f7' },
  CORONATION: { id: 'coronation', label: 'Ascension / Rank', icon: '👑', color: '#fbbf24' },
  BETRAYAL: { id: 'betrayal', label: 'Betrayal', icon: '🗡️', color: '#991b1b' },
  RESCUE: { id: 'rescue', label: 'Rescue', icon: '🛡️', color: '#16a34a' },
  OTHER: { id: 'other', label: 'Plot Beat', icon: '📌', color: '#64748b' }
};

export const CHARACTER_STATES = [
  { id: 'Active', label: 'Active / Healthy', color: '#10b981' },
  { id: 'Injured', label: 'Injured / Incapacitated', color: '#f59e0b' },
  { id: 'Deceased', label: 'Deceased', color: '#ef4444' },
  { id: 'Captive', label: 'Captive / Detained', color: '#8b5cf6' },
  { id: 'Missing', label: 'Missing / Presumed Lost', color: '#64748b' }
];

export const LORE_CATEGORIES = [
  { id: 'location', label: 'Location / Realm', icon: '🏛️', color: '#38bdf8' },
  { id: 'faction', label: 'Faction / Organization', icon: '🛡️', color: '#f59e0b' },
  { id: 'magic_tech', label: 'Magic / Tech System', icon: '⚡', color: '#c084fc' },
  { id: 'artifact', label: 'Artifact / Item', icon: '🗡️', color: '#34d399' },
  { id: 'history', label: 'Historical Era / Myth', icon: '📜', color: '#fb7185' },
];

export const RELATIONSHIP_TYPES = [
  { id: 'ally', label: 'Trusted Ally', color: '#10b981' },
  { id: 'rival', label: 'Bitter Rival / Nemesis', color: '#ef4444' },
  { id: 'romantic', label: 'Romantic Bond', color: '#ec4899' },
  { id: 'family', label: 'Bloodline / Kin', color: '#38bdf8' },
  { id: 'mentor', label: 'Mentor / Protege', color: '#f59e0b' },
  { id: 'betrayed', label: 'Fractured / Betrayed', color: '#a855f7' },
];

export const BEAT_TEMPLATES = {
  save_the_cat: {
    id: 'save_the_cat',
    label: 'Save the Cat! (15 Beats)',
    beats: [
      { act: 'Act I', title: '1. Opening Image', synopsis: 'Establish the starting world, tone, and protagonist flaw before the catalyst.' },
      { act: 'Act I', title: '2. Theme Stated', synopsis: 'Someone poses the central thematic truth or question the hero does not yet grasp.' },
      { act: 'Act I', title: '3. Set-Up', synopsis: 'Show the protagonist in their status quo, introducing key allies and what is at stake.' },
      { act: 'Act I', title: '4. Catalyst (Inciting Incident)', synopsis: 'An irreversible event shatters the status quo and demands action.' },
      { act: 'Act I', title: '5. Debate', synopsis: 'The protagonist hesitates, weighs the cost, and faces the fear of stepping into the unknown.' },
      { act: 'Act II-A', title: '6. Break into Two', synopsis: 'The protagonist makes a proactive choice to cross into the upside-down world of Act II.' },
      { act: 'Act II-A', title: '7. B Story', synopsis: 'Introduce or deepen the relationship that carries the emotional/thematic heart of the story.' },
      { act: 'Act II-A', title: '8. Fun and Games', synopsis: 'Deliver the core promise of the premise—trials, world exploration, or escalating momentum.' },
      { act: 'Act II-B', title: '9. Midpoint', synopsis: 'False victory or false defeat; stakes double, time clocks start ticking, and secrets surface.' },
      { act: 'Act II-B', title: '10. Bad Guys Close In', synopsis: 'External antagonism tightens while internal team friction fractures trust.' },
      { act: 'Act II-B', title: '11. All Is Lost', synopsis: 'Crushing setback or mentor loss—a whiff of death where the old plan fails completely.' },
      { act: 'Act II-B', title: '12. Dark Night of the Soul', synopsis: 'The protagonist reckons with their fatal flaw at rock bottom.' },
      { act: 'Act III', title: '13. Break into Three', synopsis: 'A-Story and B-Story synthesize; the protagonist discovers the true solution.' },
      { act: 'Act III', title: '14. Finale', synopsis: 'Storming the castle, executing the new plan, and proving internal transformation under fire.' },
      { act: 'Act III', title: '15. Final Image', synopsis: 'Visual mirror of the Opening Image showing how the world and hero have changed.' },
    ]
  },
  heros_journey: {
    id: 'heros_journey',
    label: "Hero's Journey (12 Stages)",
    beats: [
      { act: 'Act I', title: '1. Ordinary World', synopsis: 'Establish the hero in their familiar surroundings and everyday limitations.' },
      { act: 'Act I', title: '2. Call to Adventure', synopsis: 'A disruption or summons challenges the hero to leave safety behind.' },
      { act: 'Act I', title: '3. Refusal of the Call', synopsis: 'Fear, obligation, or doubt causes the hero to resist the summons.' },
      { act: 'Act I', title: '4. Meeting the Mentor', synopsis: 'The hero gains crucial wisdom, training, or a talisman for the threshold ahead.' },
      { act: 'Act I', title: '5. Crossing the First Threshold', synopsis: 'Committed departure from the known world into the perilous special world.' },
      { act: 'Act II', title: '6. Tests, Allies, and Enemies', synopsis: 'Learning the rules of the new realm and forging alliances under pressure.' },
      { act: 'Act II', title: '7. Approach to the Inmost Cave', synopsis: 'Preparation and rising dread at the edge of the central stronghold.' },
      { act: 'Act II', title: '8. The Supreme Ordeal', synopsis: 'Life-or-death crisis confronting the shadow force and deepest fear.' },
      { act: 'Act II', title: '9. Reward (Seizing the Sword)', synopsis: 'Claiming the prize, revelation, or reconciliation earned through survival.' },
      { act: 'Act III', title: '10. The Road Back', synopsis: 'Retaliation and pursuit as the consequences of seizing the reward unfold.' },
      { act: 'Act III', title: '11. Resurrection', synopsis: 'Final purifying climax where the hero must sacrifice their old self to triumph.' },
      { act: 'Act III', title: '12. Return with the Elixir', synopsis: 'Homecoming bearing the boon or wisdom that heals or transforms the world.' },
    ]
  },
  seven_point: {
    id: 'seven_point',
    label: '7-Point Story Structure',
    beats: [
      { act: 'Act I', title: '1. The Hook', synopsis: 'Opposite state of the resolution—show the protagonist in their initial flaw and disequilibrium.' },
      { act: 'Act I', title: '2. Plot Turn 1', synopsis: 'Call to action or discovery that locks the protagonist into the central conflict.' },
      { act: 'Act II-A', title: '3. Pinch Point 1', synopsis: 'The antagonistic force applies direct pressure, forcing the protagonist on the defensive.' },
      { act: 'Act II', title: '4. Midpoint', synopsis: 'Pivot from reaction to proaction—the protagonist resolves to fight back.' },
      { act: 'Act II-B', title: '5. Pinch Point 2', synopsis: 'Jaws of defeat: the antagonist strikes hardest, stripping away safety nets and allies.' },
      { act: 'Act III', title: '6. Plot Turn 2', synopsis: 'The final piece of the puzzle: the protagonist realizes the key needed to prevail.' },
      { act: 'Act III', title: '7. Resolution', synopsis: 'Climax and aftermath completing the arc begun in the Hook.' },
    ]
  },
  three_act: {
    id: 'three_act',
    label: 'Classic 3-Act Structure (9 Beats)',
    beats: [
      { act: 'Act I', title: '1. Exposition & Hook', synopsis: 'Ground the reader in voice, setting, and immediate dramatic tension.' },
      { act: 'Act I', title: '2. Inciting Incident', synopsis: 'The spark that destabilizes the protagonist’s life.' },
      { act: 'Act I', title: '3. Plot Point I', synopsis: 'No turning back: the protagonist steps into the main conflict.' },
      { act: 'Act II', title: '4. Rising Action', synopsis: 'Escalating obstacles test the protagonist’s flawed methods.' },
      { act: 'Act II', title: '5. Midpoint Reversal', synopsis: 'A major revelation shifts the true nature of the conflict.' },
      { act: 'Act II', title: '6. Crisis / Lowest Ebb', synopsis: 'The antagonist gains the upper hand and all hope seems exhausted.' },
      { act: 'Act III', title: '7. Pre-Climax Synthesis', synopsis: 'The protagonist integrates their inner lesson and rallies for the final push.' },
      { act: 'Act III', title: '8. Climax', synopsis: 'Decisive confrontation resolving the central dramatic question.' },
      { act: 'Act III', title: '9. Denouement', synopsis: 'Settle loose threads and establish the new equilibrium.' },
    ]
  }
};

// The story bible lives in the backed-up settings table. Older versions kept it
// in localStorage, which is read once to migrate (the legacy copy is left).
const LEGACY_STORAGE_KEY = 'novaura_story_timeline_v2';
const SETTING_KEY = 'literature_story_bible';
const SAVE_DELAY_MS = 400;
const LIMITS = { characters: 500, settings: 300, timeline: 2000, relationships: 1000, plotThreads: 300, causality: 300 };
const FIELDS = Object.keys(LIMITS);
const BLOCKING_STATES = new Set(['Deceased', 'Missing', 'Captive']);
const STATE_AFTER_EVENT = { death: 'Deceased', injury: 'Injured', rescue: 'Active' };

/** 'up' / 'down' or -1 / +1 → -1 / +1 ('up' + 3 would be the string "3up"). */
export function moveStep(direction) {
  if (direction === 'up') return -1;
  if (direction === 'down') return 1;
  return Math.sign(Number(direction)) || -1;
}

export class StoryTimeline {
  constructor() {
    for (const f of FIELDS) this[f] = [];
    this.lastAudit = null;
    this.hydrated = false;
    this._saveTimer = null;
    this._pendingSave = false;
    this.ready = typeof window === 'undefined' ? Promise.resolve() : this._hydrate();
  }

  async _hydrate() {
    let data = null;
    let migrated = false;
    try {
      data = await db.getSetting(SETTING_KEY);
    } catch (err) {
      console.warn('[StoryTimeline] Load note:', err);
    }
    if (!data) {
      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) { data = JSON.parse(raw); migrated = true; }
      } catch { /* storage unavailable or corrupt */ }
    }
    if (data && typeof data === 'object') {
      for (const f of FIELDS) {
        const stored = Array.isArray(data[f]) ? data[f] : [];
        const ids = new Set(stored.map(x => x?.id));
        this[f] = [...stored, ...this[f].filter(x => !ids.has(x?.id))];
      }
      this.lastAudit = data.lastAudit || null;
    }
    this.hydrated = true;
    if (migrated || this._pendingSave) this._persist();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novaura:timeline_updated'));
    }
  }

  loadState() {
    return this.ready;
  }

  saveState() {
    for (const f of FIELDS) {
      if (this[f].length > LIMITS[f]) this[f] = this[f].slice(-LIMITS[f]);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novaura:timeline_updated'));
    }
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persist(), SAVE_DELAY_MS);
  }

  async _persist() {
    if (!this.hydrated) { this._pendingSave = true; return; }
    const data = { lastAudit: this.lastAudit };
    for (const f of FIELDS) data[f] = this[f];
    try {
      await db.setSetting(SETTING_KEY, data);
    } catch (err) {
      console.warn('[StoryTimeline] Save error:', err);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('novaura:timeline_save_failed', { detail: { message: err.message } }));
      }
    }
  }

  /** Cause-and-effect beats for the causality map. */
  setCausality(nodes) {
    this.causality = Array.isArray(nodes) ? nodes : [];
    this.saveState();
  }

  // ── Characters ────────────────────────────────────────────────────────────

  addCharacter(char) {
    const newChar = {
      id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: char.name || 'Unnamed Character',
      aliases: char.aliases || [],
      archetype: char.archetype || 'Protagonist',
      traits: char.traits || [],
      goals: char.goals || '',
      fears: char.fears || '',
      flaw: char.flaw || '',
      secret: char.secret || '',
      voiceNotes: char.voiceNotes || '',
      state: char.state || 'Active',
      updatedAt: new Date().toISOString()
    };
    this.characters.push(newChar);
    this.saveState();
    return newChar;
  }

  updateCharacter(id, updates) {
    const idx = this.characters.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.characters[idx] = { ...this.characters[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveState();
      return this.characters[idx];
    }
    return null;
  }

  deleteCharacter(id) {
    this.characters = this.characters.filter(c => c.id !== id);
    this.relationships = this.relationships.filter(r => r.sourceId !== id && r.targetId !== id);
    this.saveState();
  }

  // ── World Lore / Settings (`this.settings`) ───────────────────────────────

  addLoreEntry(entry) {
    const item = {
      id: `lore_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: (entry.name || 'Unnamed Lore Entry').trim(),
      aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
      category: entry.category || 'location',
      summary: entry.summary || '',
      rules: entry.rules || '',
      updatedAt: new Date().toISOString(),
    };
    this.settings.push(item);
    this.saveState();
    return item;
  }

  updateLoreEntry(id, updates) {
    const idx = this.settings.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.settings[idx] = { ...this.settings[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveState();
      return this.settings[idx];
    }
    return null;
  }

  deleteLoreEntry(id) {
    this.settings = this.settings.filter(s => s.id !== id);
    this.saveState();
  }

  // ── Character Relationships (`this.relationships`) ────────────────────────

  addRelationship(rel) {
    if (!rel.sourceId || !rel.targetId || rel.sourceId === rel.targetId) return null;
    const item = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      type: rel.type || 'ally',
      dynamic: rel.dynamic || '',
      chapter: rel.chapter || '',
      updatedAt: new Date().toISOString(),
    };
    this.relationships.push(item);
    this.saveState();
    return item;
  }

  deleteRelationship(id) {
    this.relationships = this.relationships.filter(r => r.id !== id);
    this.saveState();
  }

  // ── Plot Threads & Corkboard Beat Cards (`this.plotThreads`) ──────────────

  addPlotBeat(beat) {
    const item = {
      id: `beat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      act: beat.act || 'Act I',
      title: (beat.title || 'Untitled Scene Beat').trim(),
      synopsis: beat.synopsis || '',
      pov: beat.pov || '',
      status: beat.status || 'Draft', // 'Outline' | 'Draft' | 'Revised' | 'Final'
      targetWords: Number(beat.targetWords) || 1500,
      linkedDocId: beat.linkedDocId || null,
      updatedAt: new Date().toISOString(),
    };
    this.plotThreads.push(item);
    this.saveState();
    return item;
  }

  updatePlotBeat(id, updates) {
    const idx = this.plotThreads.findIndex(b => b.id === id);
    if (idx !== -1) {
      this.plotThreads[idx] = { ...this.plotThreads[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveState();
      return this.plotThreads[idx];
    }
    return null;
  }

  deletePlotBeat(id) {
    this.plotThreads = this.plotThreads.filter(b => b.id !== id);
    this.saveState();
  }

  movePlotBeat(id, direction = -1) {
    const idx = this.plotThreads.findIndex(b => b.id === id);
    if (idx === -1) return;
    const target = idx + moveStep(direction);
    if (target < 0 || target >= this.plotThreads.length) return;
    const copy = [...this.plotThreads];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    this.plotThreads = copy;
    this.saveState();
  }

  applyBeatTemplate(templateId, replaceExisting = false) {
    const tpl = BEAT_TEMPLATES[templateId];
    if (!tpl) return [];
    const created = tpl.beats.map((b, i) => ({
      id: `beat_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
      act: b.act,
      title: b.title,
      synopsis: b.synopsis,
      pov: '',
      status: 'Outline',
      targetWords: 1500,
      linkedDocId: null,
      updatedAt: new Date().toISOString(),
    }));
    this.plotThreads = replaceExisting ? created : [...this.plotThreads, ...created];
    this.saveState();
    return created;
  }

  // ── Timeline Events ───────────────────────────────────────────────────────

  addEvent(event) {
    const newEvt = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: event.type || 'other',
      chapter: event.chapter || 'Chapter 1',
      title: event.title || 'Untitled Event',
      description: event.description || '',
      impact: event.impact || '',
      charactersInvolved: event.charactersInvolved || [],
      timestamp: event.timestamp || new Date().toISOString()
    };

    // Chain reaction: some events change the state of the characters involved.
    const nextState = STATE_AFTER_EVENT[newEvt.type];
    if (nextState) {
      for (const charId of newEvt.charactersInvolved) {
        this.updateCharacter(charId, { state: nextState });
      }
    }

    this.timeline.push(newEvt);
    this.saveState();
    return newEvt;
  }

  deleteEvent(id) {
    this.timeline = this.timeline.filter(e => e.id !== id);
    this.saveState();
  }

  /** Ids of the characters with these names or aliases (case-insensitive). */
  characterIdsForNames(names = []) {
    const wanted = new Set(names.map(n => String(n).toLowerCase().trim()).filter(Boolean));
    return this.characters
      .filter(c => [c.name, ...(c.aliases || [])].some(n => wanted.has(String(n).toLowerCase().trim())))
      .map(c => c.id);
  }

  /**
   * Returns all Codex entities (characters and world lore) mentioned by name,
   * alias, or `@tag` inside `prose`. Used for zero-bloat context injection & UI badges.
   */
  getMatchedEntities(prose = '') {
    const text = htmlToPlainText(prose);
    if (!text.trim()) return { characters: [], lore: [] };

    const matchedChars = [];
    for (const c of this.characters) {
      const names = [c.name, ...(c.aliases || [])].filter(n => String(n || '').trim().length >= 2);
      if (names.some(n => phraseRegex(n).test(text))) {
        matchedChars.push(c);
      }
    }

    const matchedLore = [];
    for (const s of this.settings) {
      const names = [s.name, ...(s.aliases || [])].filter(n => String(n || '').trim().length >= 2);
      if (names.some(n => phraseRegex(n).test(text))) {
        matchedLore.push(s);
      }
    }

    return { characters: matchedChars, lore: matchedLore };
  }

  /**
   * All Codex entries flattened for `@mention` editor autocomplete.
   */
  getAllMentionables() {
    const chars = this.characters.map(c => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases || [],
      kind: 'character',
      badge: `${c.archetype}${c.state && c.state !== 'Active' ? ` • ${c.state}` : ''}`,
      summary: [c.goals, c.flaw].filter(Boolean).join(' — ') || (c.traits || []).join(', '),
    }));
    const lore = this.settings.map(s => {
      const cat = LORE_CATEGORIES.find(l => l.id === s.category)?.label || s.category;
      return {
        id: s.id,
        name: s.name,
        aliases: s.aliases || [],
        kind: 'lore',
        badge: cat,
        summary: s.summary || s.rules || '',
      };
    });
    return [...chars, ...lore];
  }

  /**
   * Global entity rename across the Story Bible (characters, lore, timeline, causality, plot beats).
   */
  renameEntityInBible(oldName, newName) {
    const from = String(oldName || '').trim();
    const to = String(newName || '').trim();
    if (!from || !to || from === to) return 0;
    const re = phraseRegex(from);
    let replacements = 0;
    const sub = (str) => {
      if (!str || typeof str !== 'string') return str;
      return str.replace(re, () => { replacements++; return to; });
    };

    this.characters = this.characters.map(c => ({
      ...c,
      name: c.name.toLowerCase() === from.toLowerCase() ? (replacements++, to) : sub(c.name),
      aliases: (c.aliases || []).map(a => a.toLowerCase() === from.toLowerCase() ? (replacements++, to) : a),
      goals: sub(c.goals),
      flaw: sub(c.flaw),
      secret: sub(c.secret),
    }));

    this.settings = this.settings.map(s => ({
      ...s,
      name: s.name.toLowerCase() === from.toLowerCase() ? (replacements++, to) : sub(s.name),
      summary: sub(s.summary),
      rules: sub(s.rules),
    }));

    this.timeline = this.timeline.map(e => ({
      ...e,
      title: sub(e.title),
      description: sub(e.description),
      impact: sub(e.impact),
    }));

    this.plotThreads = this.plotThreads.map(b => ({
      ...b,
      title: sub(b.title),
      synopsis: sub(b.synopsis),
      pov: sub(b.pov),
    }));

    this.causality = this.causality.map(n => ({
      ...n,
      title: sub(n.title),
    }));

    if (replacements > 0) this.saveState();
    return replacements;
  }

  /**
   * The story bible as compact text for AI prompts: characters (prioritizing those
   * in `focusText`), world lore (`settings`), relationships, and recent timeline events.
   */
  bibleContext(maxChars = 3500, focusText = '') {
    const lines = [];
    const matched = focusText ? this.getMatchedEntities(focusText) : { characters: [], lore: [] };
    const matchedCharIds = new Set(matched.characters.map(c => c.id));
    const matchedLoreIds = new Set(matched.lore.map(l => l.id));

    if (this.characters.length) {
      lines.push('CHARACTERS:');
      const orderedChars = [
        ...this.characters.filter(c => matchedCharIds.has(c.id)),
        ...this.characters.filter(c => !matchedCharIds.has(c.id)),
      ];
      for (const c of orderedChars) {
        const aka = c.aliases?.length ? ` (also ${c.aliases.join(', ')})` : '';
        const inScene = matchedCharIds.has(c.id) ? ' [ACTIVE IN SCENE]' : '';
        const facts = [
          c.archetype,
          c.state && c.state !== 'Active' ? `currently ${c.state.toUpperCase()}` : '',
          c.traits?.length ? `traits: ${c.traits.join(', ')}` : '',
          c.goals ? `wants: ${c.goals}` : '',
          c.flaw ? `flaw: ${c.flaw}` : '',
          c.secret ? `secret: ${c.secret}` : '',
        ].filter(Boolean).join('; ');
        lines.push(`- ${c.name}${aka}${inScene}: ${facts}`);
      }
    }

    if (this.settings.length) {
      lines.push('', 'WORLD LORE & CANON RULES:');
      const orderedLore = [
        ...this.settings.filter(s => matchedLoreIds.has(s.id)),
        ...this.settings.filter(s => !matchedLoreIds.has(s.id)),
      ];
      for (const s of orderedLore) {
        const inScene = matchedLoreIds.has(s.id) ? ' [ACTIVE IN SCENE]' : '';
        const details = [s.summary, s.rules ? `canon rule: ${s.rules}` : ''].filter(Boolean).join(' | ');
        lines.push(`- [${s.category.toUpperCase()}] ${s.name}${inScene}: ${details}`);
      }
    }

    if (this.relationships.length) {
      const nameOf = (id) => this.characters.find(c => c.id === id)?.name;
      const relLines = this.relationships.slice(-15).map(r => {
        const a = nameOf(r.sourceId);
        const b = nameOf(r.targetId);
        if (!a || !b) return null;
        return `- ${a} ↔ ${b} (${r.type}): ${r.dynamic || 'linked'}`;
      }).filter(Boolean);
      if (relLines.length) {
        lines.push('', 'CHARACTER RELATIONSHIPS:', ...relLines);
      }
    }

    const recent = this.timeline.slice(-15);
    if (recent.length) {
      lines.push('', 'RECENT EVENTS (oldest first):');
      const nameOf = (id) => this.characters.find(c => c.id === id)?.name;
      for (const e of recent) {
        const who = (e.charactersInvolved || []).map(nameOf).filter(Boolean);
        lines.push(`- [${e.chapter}] ${e.title}${who.length ? ` (${who.join(', ')})` : ''}${e.description ? `: ${e.description}` : ''}`);
      }
    }
    const text = lines.join('\n');
    return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
  }

  /**
   * Characters the story bible says cannot act in a scene (dead, missing,
   * captive) whose name or alias appears in this prose. Deterministic: no AI.
   */
  findStateConflicts(prose) {
    const text = htmlToPlainText(prose);
    const conflicts = [];
    for (const c of this.characters) {
      if (!BLOCKING_STATES.has(c.state)) continue;
      for (const name of [c.name, ...(c.aliases || [])].filter(n => String(n || '').trim().length >= 2)) {
        const m = phraseRegex(name).exec(text);
        if (m) {
          const start = Math.max(0, m.index - 60);
          conflicts.push({ characterId: c.id, name: c.name, state: c.state, excerpt: text.slice(start, m.index + m[0].length + 60).replace(/\s+/g, ' ').trim() });
          break;
        }
      }
    }
    return conflicts;
  }

  /**
   * Quick keyword scan for possible events (no AI). The Timeline panel uses
   * the AI extractor first and falls back to this.
   */
  detectEventsFromProse(prose, chapterName = 'Current Chapter') {
    const clean = prose.replace(/<[^>]+>/g, ' ');
    const detected = [];

    if (/\b(died|killed|slain|dead|perished|succumbed|murdered)\b/i.test(clean)) {
      detected.push({
        type: 'death',
        title: 'Fatality / Character Loss',
        chapter: chapterName,
        description: 'Text mentions fatality or life lost.',
        charactersInvolved: []
      });
    }

    if (/\b(discovered that|realized the truth|secret revealed|truth unmasked|confessed)\b/i.test(clean)) {
      detected.push({
        type: 'revelation',
        title: 'Major Revelation',
        chapter: chapterName,
        description: 'Crucial secret or plot revelation occurred.',
        charactersInvolved: []
      });
    }

    if (/\b(battle|clashed|opened fire|struck with|ambushed|skirmish)\b/i.test(clean)) {
      detected.push({
        type: 'battle',
        title: 'Conflict / Skirmish',
        chapter: chapterName,
        description: 'Violent or tactical confrontation.',
        charactersInvolved: []
      });
    }

    return detected;
  }
}

export const storyTimeline = new StoryTimeline();
