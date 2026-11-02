// SensoryFloatingBar.jsx — Sudowrite-Style 5-Senses Floating Toolbar & Metaphor Expander
import React, { useState } from 'react';
import {
  Eye, Ear, Wind, Sparkles, Wand2, CornerDownLeft, RefreshCw, X, Check
} from 'lucide-react';
import { describeSensory } from '../../../../services/literatureAiService.js';

export default function SensoryFloatingBar({
  selectedText,
  selectionPosition,
  contextText,
  onInsertProse,
  onReplaceSelection,
  onClose
}) {
  const [activeSense, setActiveSense] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sensoryResult, setSensoryResult] = useState(null);

  if (!selectedText || !selectionPosition) return null;

  const senses = [
    { id: 'sight', label: 'Sight', icon: '👁️' },
    { id: 'sound', label: 'Sound', icon: '👂' },
    { id: 'smell', label: 'Smell', icon: '👃' },
    { id: 'taste', label: 'Taste', icon: '👅' },
    { id: 'touch', label: 'Touch', icon: '🖐️' },
    { id: 'vibe', label: 'Atmosphere', icon: '🌫️' },
    { id: 'metaphor', label: 'Metaphor', icon: '🔮' },
  ];

  const handleFetchSensory = async (senseId) => {
    setActiveSense(senseId);
    setIsLoading(true);
    setSensoryResult(null);
    try {
      const res = await describeSensory({
        text: selectedText,
        sense: senseId,
        context: contextText
      });
      setSensoryResult(res);
    } catch (err) {
      alert('Sensory expander note: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: `${Math.max(10, selectionPosition.top - (sensoryResult ? 220 : 50))}px`,
        left: `${selectionPosition.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 99999,
        backgroundColor: '#0f172a',
        border: '1px solid rgba(0,240,255,0.3)',
        borderRadius: '10px',
        padding: '0.45rem 0.65rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)',
        minWidth: '320px',
        maxWidth: '460px',
        color: '#f8fafc',
        fontSize: '0.74rem'
      }}
    >
      {/* Senses Selection Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', overflowX: 'auto', paddingBottom: '2px' }}>
          {senses.map(s => {
            const isSel = activeSense === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleFetchSensory(s.id)}
                title={`Describe ${s.label}`}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: isSel ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: isSel ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: isSel ? '#00f0ff' : '#cbd5e1',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#00f0ff', padding: '0.4rem 0', fontSize: '0.72rem' }}>
          <RefreshCw size={12} className="animate-spin" />
          <span>Expanding sensory dimensions for "{selectedText.slice(0, 24)}..."</span>
        </div>
      )}

      {/* Sensory Output Result */}
      {sensoryResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', backgroundColor: '#090d16', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
            {sensoryResult}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem', marginTop: '0.2rem' }}>
            <button
              onClick={() => onReplaceSelection(sensoryResult)}
              style={{ padding: '2px 8px', backgroundColor: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '3px', color: '#c084fc', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Replace Highlight
            </button>
            <button
              onClick={() => onInsertProse(sensoryResult)}
              style={{ padding: '2px 8px', backgroundColor: 'rgba(0,240,255,0.2)', border: '1px solid rgba(0,240,255,0.4)', borderRadius: '3px', color: '#00f0ff', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Insert Below
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
