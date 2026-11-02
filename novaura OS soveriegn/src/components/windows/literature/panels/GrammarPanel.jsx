// GrammarPanel.jsx — Real-time Grammar, Passive Voice & Stylistic Linter Panel
import React, { useState, useEffect } from 'react';
import {
  SpellCheck, Check, X, AlertTriangle, AlertCircle, Info, RefreshCw, Plus, Book
} from 'lucide-react';
import { spellCheckEngine } from '../engines/SpellCheckEngine.js';

export default function GrammarPanel({ activeDocContent, onReplaceText, onAddToDictionary }) {
  const [issues, setIssues] = useState([]);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [customWordInput, setCustomWordInput] = useState('');
  const [ignoredList, setIgnoredList] = useState([]);

  useEffect(() => {
    runAnalysis();
  }, [activeDocContent]);

  const runAnalysis = () => {
    if (!activeDocContent) {
      setIssues([]);
      return;
    }
    const detected = spellCheckEngine.analyzeText(activeDocContent);
    setIssues(detected);
  };

  const handleApplyFix = (issue) => {
    if (onReplaceText && issue.replacement !== null) {
      onReplaceText(issue);
    }
    setIssues(prev => prev.filter(i => i.id !== issue.id));
  };

  const handleIgnore = (issue) => {
    spellCheckEngine.ignoreWord(issue.text);
    setIgnoredList(prev => [...prev, issue.text]);
    setIssues(prev => prev.filter(i => i.id !== issue.id));
  };

  const handleAddWordToDict = (word) => {
    if (!word || !word.trim()) return;
    spellCheckEngine.addToDictionary(word.trim());
    if (onAddToDictionary) onAddToDictionary(word.trim());
    setCustomWordInput('');
    runAnalysis();
  };

  const filteredIssues = filterSeverity === 'all'
    ? issues
    : issues.filter(i => i.severity === filterSeverity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.76rem' }}>
      {/* Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#10b981' }}>
          <SpellCheck size={15} />
          <span>GRAMMAR & PROSE LINTER ({issues.length})</span>
        </div>
        <button
          onClick={runAnalysis}
          title="Re-run Prose Analysis"
          style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Dictionary Quick Add */}
      <div style={{ padding: '0.4rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.3rem' }}>
        <input
          value={customWordInput}
          onChange={e => setCustomWordInput(e.target.value)}
          placeholder="Add story term to custom dictionary..."
          style={{ flex: 1, padding: '0.25rem 0.45rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f1f5f9', fontSize: '0.7rem', outline: 'none' }}
        />
        <button
          onClick={() => handleAddWordToDict(customWordInput)}
          disabled={!customWordInput.trim()}
          style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '4px', color: '#34d399', fontSize: '0.68rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
        >
          <Plus size={11} /> Dict
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.3rem', padding: '0.35rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.68rem' }}>
        {['all', 'warning', 'suggestion', 'info'].map(s => (
          <button
            key={s}
            onClick={() => setFilterSeverity(s)}
            style={{
              padding: '2px 6px',
              borderRadius: '3px',
              border: 'none',
              backgroundColor: filterSeverity === s ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: filterSeverity === s ? '#34d399' : '#64748b',
              fontWeight: filterSeverity === s ? 700 : 500,
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {s} ({s === 'all' ? issues.length : issues.filter(i => i.severity === s).length})
          </button>
        ))}
      </div>

      {/* Issues Stream */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {filteredIssues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#10b981' }}>
            <Check size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.8 }} />
            <p style={{ margin: 0, fontWeight: 700 }}>Prose Cadence Clean</p>
            <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '0.2rem 0 0' }}>No passive voice, filter words, or sluggish sentence structures detected.</p>
          </div>
        ) : (
          filteredIssues.map(issue => {
            const isWarning = issue.severity === 'warning';
            const isInfo = issue.severity === 'info';
            const borderCol = isWarning ? '#f59e0b' : isInfo ? '#38bdf8' : '#10b981';

            return (
              <div
                key={issue.id}
                style={{
                  padding: '0.6rem 0.75rem',
                  backgroundColor: 'rgba(2,6,23,0.65)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: `3px solid ${borderCol}`,
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {isWarning ? <AlertTriangle size={13} color="#f59e0b" /> : <Info size={13} color={borderCol} />}
                    <span style={{ fontWeight: 700, color: '#f1f5f9' }}>"{issue.text}"</span>
                  </div>
                  <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: `${borderCol}20`, color: borderCol, textTransform: 'uppercase' }}>
                    {issue.type.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.3' }}>
                  {issue.message}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem', marginTop: '0.1rem' }}>
                  <button
                    onClick={() => handleAddWordToDict(issue.text)}
                    title="Add to Custom Story Dictionary"
                    style={{ padding: '2px 6px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', color: '#94a3b8', fontSize: '0.64rem', cursor: 'pointer' }}
                  >
                    Add to Dict
                  </button>
                  <button
                    onClick={() => handleIgnore(issue)}
                    style={{ padding: '2px 6px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', color: '#94a3b8', fontSize: '0.64rem', cursor: 'pointer' }}
                  >
                    Ignore
                  </button>
                  {issue.replacement !== null && (
                    <button
                      onClick={() => handleApplyFix(issue)}
                      style={{ padding: '2px 8px', backgroundColor: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '3px', color: '#34d399', fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
