// SplitEditorView.jsx — Scrivener-Style Dual Pane Reference Editor
import React, { useState } from 'react';
import {
  Split, X, BookOpen, FileText, Clock, Users, ArrowRight
} from 'lucide-react';
import CodexPanel from './CodexPanel.jsx';
import TimelinePanel from './TimelinePanel.jsx';
import { sanitizeRichHtml } from '../../../../services/htmlSanitizer.js';

export default function SplitEditorView({
  files,
  onClose,
  activeDocId,
  onInsertReferenceProse
}) {
  const [splitMode, setSplitMode] = useState('doc'); // 'doc' | 'codex' | 'timeline'
  const [selectedReferenceDocId, setSelectedReferenceDocId] = useState(
    files.find(f => f.id !== activeDocId)?.id || files[0]?.id || null
  );

  const referenceDoc = files.find(f => f.id === selectedReferenceDocId);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '2px solid rgba(168,85,247,0.3)',
      backgroundColor: '#0f1422',
      minWidth: '320px',
      overflow: 'hidden'
    }}>
      {/* Split Pane Header */}
      <div style={{
        height: '35px',
        backgroundColor: '#090d16',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0.8rem',
        fontSize: '0.74rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Split size={14} color="#c084fc" />
          <span style={{ fontWeight: 700, color: '#f8fafc' }}>Reference Split Pane</span>
          <div style={{ display: 'flex', gap: '2px', backgroundColor: 'rgba(255,255,255,0.06)', padding: '2px', borderRadius: '4px' }}>
            <button
              onClick={() => setSplitMode('doc')}
              style={{
                padding: '2px 6px',
                borderRadius: '3px',
                border: 'none',
                backgroundColor: splitMode === 'doc' ? '#7e22ce' : 'transparent',
                color: splitMode === 'doc' ? '#fff' : '#94a3b8',
                fontSize: '0.66rem',
                cursor: 'pointer'
              }}
            >
              Document
            </button>
            <button
              onClick={() => setSplitMode('codex')}
              style={{
                padding: '2px 6px',
                borderRadius: '3px',
                border: 'none',
                backgroundColor: splitMode === 'codex' ? '#7e22ce' : 'transparent',
                color: splitMode === 'codex' ? '#fff' : '#94a3b8',
                fontSize: '0.66rem',
                cursor: 'pointer'
              }}
            >
              Codex
            </button>
            <button
              onClick={() => setSplitMode('timeline')}
              style={{
                padding: '2px 6px',
                borderRadius: '3px',
                border: 'none',
                backgroundColor: splitMode === 'timeline' ? '#7e22ce' : 'transparent',
                color: splitMode === 'timeline' ? '#fff' : '#94a3b8',
                fontSize: '0.66rem',
                cursor: 'pointer'
              }}
            >
              Timeline
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close Split View"
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Pane Content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {splitMode === 'doc' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Document Picker Dropdown */}
            <div style={{ padding: '0.5rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={13} color="#94a3b8" />
              <select
                value={selectedReferenceDocId || ''}
                onChange={e => setSelectedReferenceDocId(e.target.value)}
                style={{ flex: 1, padding: '0.25rem 0.4rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}
              >
                {files.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.wordCount || 0}w)</option>
                ))}
              </select>
            </div>

            {/* Read-Only Reference Viewer */}
            <div style={{ flex: 1, padding: '1.2rem', overflowY: 'auto', backgroundColor: '#0a0f1d', color: '#cbd5e1', fontSize: '0.84rem', lineHeight: '1.7', fontFamily: 'Georgia, serif' }}>
              {referenceDoc ? (
                <div
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(referenceDoc.content || '<p>Empty reference document.</p>', { allowRemoteImages: false }) }}
                />
              ) : (
                <div style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>No reference document selected.</div>
              )}
            </div>
          </div>
        )}

        {splitMode === 'codex' && (
          <CodexPanel />
        )}

        {splitMode === 'timeline' && (
          <TimelinePanel activeDocContent={referenceDoc?.content || ''} activeDocName={referenceDoc?.name || ''} />
        )}
      </div>
    </div>
  );
}
