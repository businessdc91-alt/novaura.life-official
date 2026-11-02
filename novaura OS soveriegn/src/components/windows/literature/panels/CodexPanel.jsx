// CodexPanel.jsx — Novelcrafter-Grade Character & World Lore Codex
import React, { useState, useEffect } from 'react';
import {
  Users, MapPin, Shield, Sparkles, Plus, Trash2, Edit3,
  Search, Check, Copy, Tag, AlertCircle, ChevronDown, ChevronRight
} from 'lucide-react';
import { storyTimeline, CHARACTER_STATES } from '../engines/StoryTimeline.js';

export default function CodexPanel({ onSelectEntityForContext }) {
  const [tab, setTab] = useState('characters'); // 'characters' | 'lore'
  const [characters, setCharacters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);

  // New character form state
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [archetype, setArchetype] = useState('Protagonist');
  const [traits, setTraits] = useState('');
  const [goals, setGoals] = useState('');
  const [flaw, setFlaw] = useState('');
  const [secret, setSecret] = useState('');
  const [state, setState] = useState('Active');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadCharacters();
    const handleUpdate = () => loadCharacters();
    window.addEventListener('novaura:timeline_updated', handleUpdate);
    return () => window.removeEventListener('novaura:timeline_updated', handleUpdate);
  }, []);

  const loadCharacters = () => {
    storyTimeline.loadState();
    setCharacters([...storyTimeline.characters]);
  };

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

    resetForm();
    loadCharacters();
  };

  const handleEdit = (char) => {
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

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this character from Story Bible?')) {
      storyTimeline.deleteCharacter(id);
      loadCharacters();
      if (selectedChar?.id === id) resetForm();
    }
  };

  const resetForm = () => {
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

  const handleCopyMention = (char, e) => {
    e.stopPropagation();
    const tag = `@${char.name}`;
    navigator.clipboard.writeText(tag);
    setCopiedId(char.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = characters.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.aliases || []).some(a => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
    c.archetype.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.76rem' }}>
      {/* Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#38bdf8' }}>
          <Users size={15} />
          <span>STORY BIBLE & CODEX</span>
        </div>
        <button
          onClick={() => { resetForm(); setIsAddingChar(!isAddingChar); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={12} />
          <span>New Entry</span>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0.5rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#090d16', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search size={13} color="#64748b" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search characters or lore..."
            style={{ background: 'none', border: 'none', color: '#f1f5f9', fontSize: '0.74rem', outline: 'none', width: '100%' }}
          />
        </div>
      </div>

      {/* Editor or List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.8rem' }}>
        {isAddingChar ? (
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
              <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Fatal Flaw & Hidden Secret</label>
              <textarea rows={2} value={flaw} onChange={e => setFlaw(e.target.value)} placeholder="Blind spot or concealed vulnerability..."
                style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.4rem' }}>
              <button onClick={resetForm}
                style={{ padding: '0.3rem 0.6rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveCharacter}
                style={{ padding: '0.3rem 0.8rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '4px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save Character</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <Users size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0 }}>No characters recorded yet.</p>
                <p style={{ fontSize: '0.68rem', margin: '0.3rem 0 0' }}>Click "+ New Entry" to build your Story Bible.</p>
              </div>
            ) : (
              filtered.map(char => {
                const stateObj = CHARACTER_STATES.find(s => s.id === char.state) || CHARACTER_STATES[0];
                return (
                  <div
                    key={char.id}
                    onClick={() => handleEdit(char)}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '10px', backgroundColor: `${stateObj.color}20`, color: stateObj.color, fontWeight: 600 }}>
                          {stateObj.label}
                        </span>
                        <button
                          onClick={(e) => handleCopyMention(char, e)}
                          title="Copy @Mention Tag"
                          style={{ background: 'none', border: 'none', color: copiedId === char.id ? '#34d399' : '#64748b', cursor: 'pointer', padding: '2px' }}
                        >
                          {copiedId === char.id ? <Check size={12} /> : <Tag size={12} />}
                        </button>
                        <button
                          onClick={(e) => handleDelete(char.id, e)}
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
        )}
      </div>
    </div>
  );
}
