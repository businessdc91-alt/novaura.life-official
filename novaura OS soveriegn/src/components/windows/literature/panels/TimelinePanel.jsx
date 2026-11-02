// TimelinePanel.jsx — Visual Interactive Narrative Timeline
import React, { useState, useEffect } from 'react';
import {
  Clock, Plus, Trash2, Filter, AlertCircle, Sparkles, ChevronRight, Check
} from 'lucide-react';
import { storyTimeline, EVENT_TYPES } from '../engines/StoryTimeline.js';

export default function TimelinePanel({ activeDocContent, activeDocName }) {
  const [events, setEvents] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [detectedEvents, setDetectedEvents] = useState([]);

  // Form state
  const [type, setType] = useState('revelation');
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState(activeDocName || 'Chapter 1');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState('');

  useEffect(() => {
    loadEvents();
    const handleUpdate = () => loadEvents();
    window.addEventListener('novaura:timeline_updated', handleUpdate);
    return () => window.removeEventListener('novaura:timeline_updated', handleUpdate);
  }, []);

  const loadEvents = () => {
    storyTimeline.loadState();
    setEvents([...storyTimeline.timeline]);
  };

  const handleCreateEvent = () => {
    if (!title.trim()) return;
    storyTimeline.addEvent({
      type,
      title: title.trim(),
      chapter,
      description,
      impact,
      charactersInvolved: []
    });
    resetForm();
    loadEvents();
  };

  const handleDelete = (id) => {
    storyTimeline.deleteEvent(id);
    loadEvents();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImpact('');
    setIsAddingEvent(false);
  };

  const handleScanProseForEvents = () => {
    if (!activeDocContent) return;
    const detected = storyTimeline.detectEventsFromProse(activeDocContent, activeDocName);
    setDetectedEvents(detected);
  };

  const handleAcceptDetectedEvent = (evt) => {
    storyTimeline.addEvent(evt);
    setDetectedEvents(prev => prev.filter(e => e !== evt));
    loadEvents();
  };

  const filteredEvents = filterType === 'all'
    ? events
    : events.filter(e => e.type === filterType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.76rem' }}>
      {/* Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#a855f7' }}>
          <Clock size={15} />
          <span>STORY TIMELINE ({events.length})</span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button
            onClick={handleScanProseForEvents}
            title="Scan active chapter for narrative events"
            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc', fontSize: '0.68rem', cursor: 'pointer' }}
          >
            <Sparkles size={11} />
            <span>Scan Chapter</span>
          </button>
          <button
            onClick={() => setIsAddingEvent(!isAddingEvent)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#7e22ce', border: 'none', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={11} />
            <span>Add Beat</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ padding: '0.4rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Filter size={12} color="#64748b" />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ flex: 1, padding: '0.2rem 0.4rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.7rem' }}
        >
          <option value="all">All 15 Event Types</option>
          {Object.values(EVENT_TYPES).map(et => (
            <option key={et.id} value={et.id}>{et.icon} {et.label}</option>
          ))}
        </select>
      </div>

      {/* Detected Events Notification */}
      {detectedEvents.length > 0 && (
        <div style={{ margin: '0.5rem 0.8rem', padding: '0.5rem', backgroundColor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c084fc' }}>Detected from Chapter Prose:</span>
          {detectedEvents.map((de, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem' }}>
              <span>{de.title} ({de.type})</span>
              <button
                onClick={() => handleAcceptDetectedEvent(de)}
                style={{ padding: '1px 6px', backgroundColor: '#7e22ce', border: 'none', borderRadius: '3px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <Check size={10} /> Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Event List / Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.8rem' }}>
        {isAddingEvent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'rgba(2,6,23,0.7)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.3)' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#c084fc' }}>Record Narrative Beat</span>

            <div>
              <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Event Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}>
                {Object.values(EVENT_TYPES).map(et => (
                  <option key={et.id} value={et.id}>{et.icon} {et.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Event Headline *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Silas unlocks the subterranean lattice"
                style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Chapter / Scene Anchor</label>
              <input value={chapter} onChange={e => setChapter(e.target.value)} placeholder="e.g. Chapter 3, Scene 2"
                style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Description & Cause</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What triggered this event?"
                style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Downstream Narrative Impact</label>
              <textarea rows={2} value={impact} onChange={e => setImpact(e.target.value)} placeholder="How does this constrain future chapters?"
                style={{ width: '100%', padding: '0.35rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.3rem' }}>
              <button onClick={resetForm}
                style={{ padding: '0.3rem 0.6rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreateEvent}
                style={{ padding: '0.3rem 0.8rem', backgroundColor: '#7e22ce', border: 'none', borderRadius: '4px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save Beat</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
            {filteredEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <Clock size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
                <p style={{ margin: 0 }}>No timeline beats logged.</p>
                <p style={{ fontSize: '0.68rem', margin: '0.3rem 0 0' }}>Click "Add Beat" or "Scan Chapter" to index plot milestones.</p>
              </div>
            ) : (
              filteredEvents.map(evt => {
                const meta = EVENT_TYPES[evt.type?.toUpperCase()] || EVENT_TYPES.OTHER;
                return (
                  <div
                    key={evt.id}
                    style={{
                      padding: '0.65rem 0.8rem',
                      backgroundColor: 'rgba(2,6,23,0.6)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderLeft: `3px solid ${meta.color}`,
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{meta.icon}</span>
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{evt.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{evt.chapter}</span>
                        <button
                          onClick={() => handleDelete(evt.id)}
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {evt.description && (
                      <div style={{ fontSize: '0.7rem', color: '#cbd5e1', lineHeight: '1.3' }}>
                        {evt.description}
                      </div>
                    )}

                    {evt.impact && (
                      <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.1rem', display: 'flex', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 700 }}>Impact:</span> {evt.impact}
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
