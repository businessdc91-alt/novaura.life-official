/**
 * StoryTimeline.js — Sovereign Story Bible, Event Timeline & Character Continuity Engine
 * 
 * Features:
 * - 15 Event Types with custom icons & visual metadata
 * - Character State tracking (Active, Injured, Deceased, Captive, Missing)
 * - Dynamic Relationship Evolution mapping
 * - Keyword-based event detection from prose
 * - Saved in the backed-up settings table (see LIMITS for the caps)
 */

import { db } from '../../../../database/sovereignDatabase.js';

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

// The story bible lives in the backed-up settings table. Older versions kept it
// in localStorage, which is read once to migrate (the legacy copy is left).
const LEGACY_STORAGE_KEY = 'novaura_story_timeline_v2';
const SETTING_KEY = 'literature_story_bible';
const SAVE_DELAY_MS = 400;
const LIMITS = { characters: 500, settings: 300, timeline: 2000, relationships: 1000, plotThreads: 300, causality: 300 };
const FIELDS = Object.keys(LIMITS);

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
      // Keep anything added while loading.
      for (const f of FIELDS) {
        const stored = Array.isArray(data[f]) ? data[f] : [];
        const ids = new Set(stored.map(x => x?.id));
        this[f] = [...stored, ...this[f].filter(x => !ids.has(x?.id))];
      }
      this.lastAudit = data.lastAudit || null;
    }
    this.hydrated = true;
    if (migrated || this._pendingSave) this._persist();
    window.dispatchEvent(new CustomEvent('novaura:timeline_updated'));
  }

  /** Kept for callers; the data is in memory once loaded. */
  loadState() {
    return this.ready;
  }

  saveState() {
    for (const f of FIELDS) {
      if (this[f].length > LIMITS[f]) this[f] = this[f].slice(-LIMITS[f]);
    }
    window.dispatchEvent(new CustomEvent('novaura:timeline_updated'));
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persist(), SAVE_DELAY_MS);
  }

  async _persist() {
    if (!this.hydrated) { this._pendingSave = true; return; } // saved once loading finishes
    const data = { lastAudit: this.lastAudit };
    for (const f of FIELDS) data[f] = this[f];
    try {
      await db.setSetting(SETTING_KEY, data);
    } catch (err) {
      console.warn('[StoryTimeline] Save error:', err);
      window.dispatchEvent(new CustomEvent('novaura:timeline_save_failed', { detail: { message: err.message } }));
    }
  }

  /** Cause-and-effect beats for the causality map. */
  setCausality(nodes) {
    this.causality = Array.isArray(nodes) ? nodes : [];
    this.saveState();
  }

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
    this.saveState();
  }

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

    // Chain Reaction: if event is DEATH, update character state
    if (newEvt.type === 'death' && newEvt.charactersInvolved.length > 0) {
      for (const charId of newEvt.charactersInvolved) {
        this.updateCharacter(charId, { state: 'Deceased' });
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

  /**
   * Scan chapter prose for potential events and character appearances
   */
  detectEventsFromProse(prose, chapterName = 'Current Chapter') {
    const clean = prose.replace(/<[^>]+>/g, ' ');
    const detected = [];

    // Death triggers
    if (/\b(died|killed|slain|dead|perished|succumbed|murdered)\b/i.test(clean)) {
      detected.push({
        type: 'death',
        title: 'Fatality / Character Loss',
        chapter: chapterName,
        description: 'Text mentions fatality or life lost.',
        charactersInvolved: []
      });
    }

    // Revelation triggers
    if (/\b(discovered that|realized the truth|secret revealed|truth unmasked|confessed)\b/i.test(clean)) {
      detected.push({
        type: 'revelation',
        title: 'Major Revelation',
        chapter: chapterName,
        description: 'Crucial secret or plot revelation occurred.',
        charactersInvolved: []
      });
    }

    // Battle triggers
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
