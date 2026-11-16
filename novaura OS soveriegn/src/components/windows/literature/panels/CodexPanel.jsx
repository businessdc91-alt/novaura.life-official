// CodexPanel.jsx — Novelcrafter-Grade Character, World Lore & Relationship Codex
import React, { useState, useEffect } from 'react';
import {
  Users, MapPin, Shield, Sparkles, Plus, Trash2, Edit3,
  Search, Check, Tag, GitMerge, Replace
} from 'lucide-react';
import {
  storyTimeline,
  CHARACTER_STATES,
  LORE_CATEGORIES,
  RELATIONSHIP_TYPES
} from '../engines/StoryTimeline.js';
import { replaceAcrossAllManuscripts } from '../../../../services/manuscriptStore.js';

export default function CodexPanel({ onSelectEntityForContext, onGlobalRenameComplete }) {
  const [tab, setTab] = useState('characters'); // 'characters' | 'lore' | 'relationships'
  const [characters, setCharacters] = useState([]);
  const [loreEntries, setLoreEntries] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Global Rename Bar state
  const [renameTarget, setRenameTarget] = useState(null); // { oldName }
  const [renameNewValue, setRenameNewValue] = useState('');
  const [renameFeedback, setRenameFeedback] = useState(null);

  // Character form state
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [archetype, setArchetype] = useState('Protagonist');
  const [traits, setTraits] = useState('');
  const [goals, setGoals] = useState('');
  const [flaw, setFlaw] = useState('');
  const [secret, setSecret] = useState('');
  const [state, setState] = useState('Active');

  // Lore form state
  const [isAddingLore, setIsAddingLore] = useState(false);
  const [selectedLore, setSelectedLore] = useState(null);
  const [loreName, setLoreName] = useState('');
  const [loreAliases, setLoreAliases] = useState('');
  const [loreCategory, setLoreCategory] = useState('location'); // LORE_CATEGORIES ids are lowercase
  const [loreDescription, setLoreDescription] = useState('');
  const [loreRules, setLoreRules] = useState('');

  // Relationship form state
  const [relSourceId, setRelSourceId] = useState('');
  const [relTargetId, setRelTargetId] = useState('');
  const [relType, setRelType] = useState('ally'); // RELATIONSHIP_TYPES ids
  const [relNotes, setRelNotes] = useState('');

  useEffect(() => {
    loadBible();
    const handleUpdate = () => loadBible();
    window.addEventListener('novaura:timeline_updated', handleUpdate);
    return () => window.removeEventListener('novaura:timeline_updated', handleUpdate);
  }, []);

  const loadBible = () => {
    storyTimeline.loadState();
    setCharacters([...storyTimeline.characters]);
    setLoreEntries([...storyTimeline.settings]);
    setRelationships([...storyTimeline.relationships]);
  };

  // ─── CHARACTER HANDLERS ────────────────────────────────────────────────────
  const handleSaveCharacter = () => {
    if (!name.trim()) return;
    const traitList = traits.split(',').map(t => t.trim()).filter(Boolean);
    const aliasList = aliases.split(',').map(a => a.trim()).filter(Boolean);

    if (selectedChar) {
      storyTimeline.updateCharacter(selectedChar.id, {
        name: name.trim(),
        aliases: aliasList,
        archetype,
        traits: traitList,
        goals,
        flaw,
        secret,
        state
      });
    } else {
      storyTimeline.addCharacter({
        name: name.trim(),
        aliases: aliasList,
        archetype,
        traits: traitList,
        goals,
        flaw,
        secret,
        state
      });
    }

    resetCharForm();
    loadBible();
  };

  const handleEditChar = (char) => {
    setSelectedChar(char);
    setName(char.name);
    setAliases((char.aliases || []).join(', '));
    setArchetype(char.archetype || 'Protagonist');
    setTraits((char.traits || []).join(', '));
    setGoals(char.goals || '');
    setFlaw(char.flaw || '');
    setSecret(char.secret || '');
    setState(char.state || 'Active');
    setIsAddingChar(true);
  };

  const handleDeleteChar = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this character from Story Bible?')) {
      storyTimeline.deleteCharacter(id);
      loadBible();
      if (selectedChar?.id === id) resetCharForm();
    }
  };

  const resetCharForm = () => {
    setName('');
    setAliases('');
    setArchetype('Protagonist');
    setTraits('');
    setGoals('');
    setFlaw('');
    setSecret('');
    setState('Active');
    setSelectedChar(null);
    setIsAddingChar(false);
  };

  // ─── LORE HANDLERS ─────────────────────────────────────────────────────────
  const handleSaveLore = () => {
    if (!loreName.trim()) return;
    const aliasList = loreAliases.split(',').map(a => a.trim()).filter(Boolean);

    if (selectedLore) {
      // StoryTimeline keeps the description as `summary` (what the AI context reads).
      storyTimeline.updateLoreEntry(selectedLore.id, {
        name: loreName.trim(),
        aliases: aliasList,
        category: loreCategory,
        summary: loreDescription,
        rules: loreRules
      });
    } else {
      storyTimeline.addLoreEntry({
        name: loreName.trim(),
        aliases: aliasList,
        category: loreCategory,
        summary: loreDescription,
        rules: loreRules
      });
    }
    resetLoreForm();
    loadBible();
  };

  const handleEditLore = (entry) => {
    setSelectedLore(entry);
    setLoreName(entry.name);
    setLoreAliases((entry.aliases || []).join(', '));
    setLoreCategory(String(entry.category || 'location').toLowerCase());
    setLoreDescription(entry.summary || entry.description || '');
    setLoreRules(entry.rules || '');
    setIsAddingLore(true);
  };

  const handleDeleteLore = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this lore entry from Story Bible?')) {
      storyTimeline.deleteLoreEntry(id);
      loadBible();
      if (selectedLore?.id === id) resetLoreForm();
    }
  };

  const resetLoreForm = () => {
    setLoreName('');
    setLoreAliases('');
    setLoreCategory('location');
    setLoreDescription('');
    setLoreRules('');
    setSelectedLore(null);
    setIsAddingLore(false);
  };

  // ─── RELATIONSHIP HANDLERS ─────────────────────────────────────────────────
  const handleAddRelationship = () => {
    if (!relSourceId || !relTargetId || relSourceId === relTargetId) return;
    storyTimeline.addRelationship({
      sourceId: relSourceId,
      targetId: relTargetId,
      type: relType,
      dynamic: relNotes.trim() // StoryTimeline's field (shown to the AI)
    });
    setRelNotes('');
    loadBible();
  };

  const handleDeleteRelationship = (id) => {
    storyTimeline.deleteRelationship(id);
    loadBible();
  };

  // ─── GLOBAL RENAME & MENTION ───────────────────────────────────────────────
  const handleCopyMention = (entity, e) => {
    e.stopPropagation();
    const tag = `@${entity.name}`;
    navigator.clipboard.writeText(tag);
    if (onSelectEntityForContext) onSelectEntityForContext(entity);
    setCopiedId(entity.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenRename = (entityName, e) => {
    e.stopPropagation();
    setRenameTarget({ oldName: entityName });
    setRenameNewValue(entityName);
  };

  const handleExecuteGlobalRename = async () => {
    if (!renameTarget || !renameNewValue.trim() || renameNewValue.trim() === renameTarget.oldName) {
      setRenameTarget(null);
      return;
    }
    const oldName = renameTarget.oldName;
    const newName = renameNewValue.trim();
    storyTimeline.renameEntityInBible(oldName, newName);
    const stats = await replaceAcrossAllManuscripts(oldName, newName, {
      matchCase: true,
      wholeWord: true
    });
    loadBible();
    setRenameTarget(null);
    setRenameFeedback(`Renamed "${oldName}" → "${newName}" (${stats.totalReplacements} occurrences across ${stats.docsModified} chapter${stats.docsModified === 1 ? '' : 's'})`);
    setTimeout(() => setRenameFeedback(null), 4000);
    if (onGlobalRenameComplete) onGlobalRenameComplete(stats);
  };

  const filteredChars = characters.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.aliases || []).some(a => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.archetype || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLore = loreEntries.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.aliases || []).some(a => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (l.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.summary || l.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.76rem' }}>
      {/* Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#38bdf8' }}>
          <Users size={15} />
          <span>STORY BIBLE & CODEX</span>
        </div>
        {tab !== 'relationships' && (
          <button
            onClick={() => {
              if (tab === 'characters') {
                resetCharForm();
                setIsAddingChar(!isAddingChar);
              } else {
                resetLoreForm();
                setIsAddingLore(!isAddingLore);
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={12} />
            <span>{tab === 'characters' ? 'New Character' : 'New Lore'}</span>
          </button>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#0c0f1a' }}>
        {[
          { id: 'characters', label: `Cast (${characters.length})`, icon: Users, color: '#38bdf8' },
          { id: 'lore', label: `World (${loreEntries.length})`, icon: MapPin, color: '#a855f7' },
          { id: 'relationships', label: `Bonds (${relationships.length})`, icon: GitMerge, color: '#f59e0b' },
        ].map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '0.4rem 0.25rem',
                border: 'none',
                borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent',
                backgroundColor: 'transparent',
                color: active ? t.color : '#64748b',
                fontSize: '0.68rem',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem'
              }}
            >
              <Icon size={11} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Global Rename Modal Bar */}
      {renameTarget && (
        <div style={{ padding: '0.5rem 0.8rem', backgroundColor: 'rgba(56,189,248,0.12)', borderBottom: '1px solid rgba(56,189,248,0.3)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.66rem', color: '#38bdf8', fontWeight: 700 }}>
            Global Manuscript & Codex Rename: "{renameTarget.oldName}"
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <input
              value={renameNewValue}
              onChange={e => setRenameNewValue(e.target.value)}
              placeholder="New canonical name..."
              style={{ flex: 1, padding: '0.25rem 0.45rem', backgroundColor: '#090d16', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}
            />
            <button
              onClick={handleExecuteGlobalRename}
              style={{ padding: '0.2rem 0.55rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Rename All
            </button>
            <button
              onClick={() => setRenameTarget(null)}
              style={{ padding: '0.2rem 0.45rem', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {renameFeedback && (
        <div style={{ padding: '0.35rem 0.8rem', backgroundColor: 'rgba(16,185,129,0.15)', borderBottom: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontSize: '0.66rem', fontWeight: 600 }}>
          {renameFeedback}
        </div>
      )}

      {/* Search (for Characters & Lore) */}
      {tab !== 'relationships' && (
        <div style={{ padding: '0.5rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#090d16', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Search size={13} color="#64748b" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={tab === 'characters' ? 'Search characters, aliases, archetypes...' : 'Search locations, factions, magic/tech...'}
              style={{ background: 'none', border: 'none', color: '#f1f5f9', fontSize: '0.74rem', outline: 'none', width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Body Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.8rem' }}>
        {/* ─── TAB 1: CHARACTERS ─────────────────────────────────────────── */}
        {tab === 'characters' && (
          isAddingChar ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'rgba(2,6,23,0.7)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.3)' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8' }}>
                {selectedChar ? 'Edit Character Sheet' : 'New Character Sheet'}
              </span>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Full Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Silas Vance"
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Aliases / Nicknames (comma separated)</label>
                <input value={aliases} onChange={e => setAliases(e.target.value)} placeholder="e.g. The Cipher, Silas, Agent 7"
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div>
                  <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Archetype / Role</label>
                  <select value={archetype} onChange={e => setArchetype(e.target.value)}
                    style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}>
                    <option value="Protagonist">Protagonist</option>
                    <option value="Antagonist">Antagonist</option>
                    <option value="Deuteragonist">Deuteragonist</option>
                    <option value="Mentor">Mentor</option>
                    <option value="Foil">Foil</option>
                    <option value="Ally">Ally / Companion</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Status</label>
                  <select value={state} onChange={e => setState(e.target.value)}
                    style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}>
                    {CHARACTER_STATES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Key Traits (comma separated)</label>
                <input value={traits} onChange={e => setTraits(e.target.value)} placeholder="e.g. Stoic, photographic memory, scarred jaw"
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Internal Goal & Motivation</label>
                <textarea rows={2} value={goals} onChange={e => setGoals(e.target.value)} placeholder="What does this character desperately want?"
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Fatal Flaw</label>
                <input value={flaw} onChange={e => setFlaw(e.target.value)} placeholder="Internal blind spot or psychological vulnerability..."
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Hidden Secret (Canon / Plot Twist)</label>
                <textarea rows={2} value={secret} onChange={e => setSecret(e.target.value)} placeholder="What is this character hiding from the rest of the cast?"
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button onClick={resetCharForm}
                  style={{ padding: '0.3rem 0.6rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveCharacter}
                  style={{ padding: '0.3rem 0.8rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '4px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save Character</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {filteredChars.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  <Users size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: 0 }}>No characters recorded yet.</p>
                  <p style={{ fontSize: '0.68rem', margin: '0.3rem 0 0' }}>Click "+ New Character" to build your Story Bible.</p>
                </div>
              ) : (
                filteredChars.map(char => {
                  const stateObj = CHARACTER_STATES.find(s => s.id === char.state) || CHARACTER_STATES[0];
                  return (
                    <div
                      key={char.id}
                      onClick={() => handleEditChar(char)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        backgroundColor: 'rgba(2,6,23,0.6)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                        transition: 'border-color 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{char.name}</span>
                          <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
                            {char.archetype}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '10px', backgroundColor: `${stateObj.color}20`, color: stateObj.color, fontWeight: 600 }}>
                            {stateObj.label}
                          </span>
                          <button
                            onClick={(e) => handleOpenRename(char.name, e)}
                            title="Rename across Story Bible & all Manuscript Chapters"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                          >
                            <Replace size={12} />
                          </button>
                          <button
                            onClick={(e) => handleCopyMention(char, e)}
                            title="Copy @Mention Tag"
                            style={{ background: 'none', border: 'none', color: copiedId === char.id ? '#34d399' : '#64748b', cursor: 'pointer', padding: '2px' }}
                          >
                            {copiedId === char.id ? <Check size={12} /> : <Tag size={12} />}
                          </button>
                          <button
                            onClick={(e) => handleDeleteChar(char.id, e)}
                            title="Delete Character"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {char.goals && (
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: '1.3' }}>
                          <span style={{ color: '#64748b' }}>Goal: </span>{char.goals}
                        </div>
                      )}
                      {char.secret && (
                        <div style={{ fontSize: '0.66rem', color: '#c084fc', lineHeight: '1.3' }}>
                          <span style={{ color: '#64748b' }}>Secret: </span>{char.secret}
                        </div>
                      )}

                      {char.traits && char.traits.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.1rem' }}>
                          {char.traits.map((t, idx) => (
                            <span key={idx} style={{ fontSize: '0.58rem', padding: '1px 4px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1', borderRadius: '2px' }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )
        )}

        {/* ─── TAB 2: WORLD LORE & SETTINGS ──────────────────────────────── */}
        {tab === 'lore' && (
          isAddingLore ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'rgba(2,6,23,0.7)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.35)' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#c084fc' }}>
                {selectedLore ? 'Edit World Lore Entry' : 'New World Lore Entry'}
              </span>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Name / Title *</label>
                <input value={loreName} onChange={e => setLoreName(e.target.value)} placeholder="e.g. New Aethelgard, The Monad Drive, House Vane"
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div>
                  <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Category</label>
                  <select value={loreCategory} onChange={e => setLoreCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}>
                    {LORE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Aliases (comma sep)</label>
                  <input value={loreAliases} onChange={e => setLoreAliases(e.target.value)} placeholder="e.g. Sector 9, The Spire"
                    style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Sensory Description & History</label>
                <textarea rows={3} value={loreDescription} onChange={e => setLoreDescription(e.target.value)} placeholder="Architecture, atmosphere, cultural significance..."
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Hard Canon Constraints / Rules</label>
                <textarea rows={2} value={loreRules} onChange={e => setLoreRules(e.target.value)} placeholder="e.g. Gravity is 0.88G; weapons cannot fire inside the perimeter..."
                  style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button onClick={resetLoreForm}
                  style={{ padding: '0.3rem 0.6rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSaveLore}
                  style={{ padding: '0.3rem 0.8rem', backgroundColor: '#7e22ce', border: 'none', borderRadius: '4px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save Lore Entry</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {filteredLore.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  <MapPin size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: 0 }}>No world lore entries recorded yet.</p>
                  <p style={{ fontSize: '0.68rem', margin: '0.3rem 0 0' }}>Add locations, factions, magic/tech rules, and artifacts.</p>
                </div>
              ) : (
                filteredLore.map(entry => {
                  const catObj = LORE_CATEGORIES.find(c => c.id === entry.category) || LORE_CATEGORIES[0];
                  return (
                    <div
                      key={entry.id}
                      onClick={() => handleEditLore(entry)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        backgroundColor: 'rgba(2,6,23,0.6)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{entry.name}</span>
                          <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: `${catObj.color}20`, color: catObj.color, fontWeight: 600 }}>
                            {catObj.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            onClick={(e) => handleOpenRename(entry.name, e)}
                            title="Rename across Story Bible & all Manuscript Chapters"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                          >
                            <Replace size={12} />
                          </button>
                          <button
                            onClick={(e) => handleCopyMention(entry, e)}
                            title="Copy @Mention Tag"
                            style={{ background: 'none', border: 'none', color: copiedId === entry.id ? '#34d399' : '#64748b', cursor: 'pointer', padding: '2px' }}
                          >
                            {copiedId === entry.id ? <Check size={12} /> : <Tag size={12} />}
                          </button>
                          <button
                            onClick={(e) => handleDeleteLore(entry.id, e)}
                            title="Delete Lore Entry"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {(entry.summary || entry.description) && (
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: '1.35' }}>
                          {entry.summary || entry.description}
                        </div>
                      )}
                      {entry.rules && (
                        <div style={{ fontSize: '0.65rem', color: '#fbbf24', lineHeight: '1.3' }}>
                          <strong>Canon Rule: </strong>{entry.rules}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )
        )}

        {/* ─── TAB 3: CHARACTER RELATIONSHIPS ────────────────────────────── */}
        {tab === 'relationships' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ padding: '0.65rem', backgroundColor: 'rgba(2,6,23,0.75)', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>Link Character Dynamic</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                <select value={relSourceId} onChange={e => setRelSourceId(e.target.value)}
                  style={{ padding: '0.3rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.7rem' }}>
                  <option value="">Character A...</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={relTargetId} onChange={e => setRelTargetId(e.target.value)}
                  style={{ padding: '0.3rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.7rem' }}>
                  <option value="">Character B...</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <select value={relType} onChange={e => setRelType(e.target.value)}
                  style={{ padding: '0.3rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fbbf24', fontSize: '0.7rem' }}>
                  {RELATIONSHIP_TYPES.map(rt => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
                </select>
                <input
                  value={relNotes}
                  onChange={e => setRelNotes(e.target.value)}
                  placeholder="Dynamic tension or history..."
                  style={{ flex: 1, padding: '0.3rem 0.45rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.7rem', outline: 'none' }}
                />
                <button
                  onClick={handleAddRelationship}
                  disabled={!relSourceId || !relTargetId || relSourceId === relTargetId}
                  style={{ padding: '0.3rem 0.6rem', backgroundColor: '#d97706', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Link
                </button>
              </div>
            </div>

            {relationships.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: '#64748b', fontSize: '0.7rem' }}>
                No character bonds mapped yet. Link two characters above so the AI Co-Author knows their interpersonal history.
              </div>
            ) : (
              relationships.map(rel => {
                const src = characters.find(c => c.id === rel.sourceId);
                const tgt = characters.find(c => c.id === rel.targetId);
                return (
                  <div key={rel.id} style={{ padding: '0.55rem 0.7rem', backgroundColor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#f1f5f9', fontSize: '0.72rem' }}>
                        <span>{src?.name || 'Unknown'}</span>
                        <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'rgba(245,158,11,0.18)', color: '#fbbf24' }}>{RELATIONSHIP_TYPES.find(rt => rt.id === rel.type)?.label || rel.type}</span>
                        <span>{tgt?.name || 'Unknown'}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteRelationship(rel.id)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {(rel.dynamic || rel.notes) && (
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{rel.dynamic || rel.notes}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
