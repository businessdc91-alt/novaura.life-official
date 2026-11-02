// RemasterPanel.jsx — Scene Remastering, Genre Shift & Perspective Flip UI
import React, { useState } from 'react';
import {
  GitFork, Sparkles, Wand2, Copy, Check, ArrowRight, CornerDownLeft, Eye, RefreshCw
} from 'lucide-react';
import { remasterEngine, REMASTER_MODES } from '../engines/RemasterEngine.js';
import { storyTimeline } from '../engines/StoryTimeline.js';

const DIFF_STYLE = {
  add: { backgroundColor: 'rgba(16,185,129,0.22)', color: '#a7f3d0' },
  del: { backgroundColor: 'rgba(244,63,94,0.18)', color: '#fda4af', textDecoration: 'line-through' },
  same: {},
};

export default function RemasterPanel({ activeDocContent, selectedText, onInsertProse, onCreateNewFileWithProse }) {
  const [selectedMode, setSelectedMode] = useState('enhanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [diffStats, setDiffStats] = useState(null);
  const [copied, setCopied] = useState(false);

  const [showChanges, setShowChanges] = useState(false);
  const [error, setError] = useState('');

  // The chapter is stored as HTML; the model gets the text with paragraph breaks.
  const textToRemaster = selectedText || (activeDocContent || '')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n').trim();

  const handleGenerateRemaster = async () => {
    if (!textToRemaster.trim()) return;
    setIsGenerating(true);
    setCurrentResult(null);
    setDiffStats(null);
    setError('');
    try {
      const record = await remasterEngine.generateRemaster({
        text: textToRemaster,
        mode: selectedMode,
        instructions: customInstructions,
        storyBible: storyTimeline.bibleContext(),
      });
      setCurrentResult(record);
      const diff = remasterEngine.computeDiff(record.originalText, record.remasteredText);
      setDiffStats(diff);
    } catch (err) {
      setError(err.message || 'The remaster failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!currentResult) return;
    navigator.clipboard.writeText(currentResult.remasteredText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.76rem' }}>
      {/* Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#ec4899' }}>
          <GitFork size={15} />
          <span>SCENE REMASTER & BRANCHING</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {/* Source Scope Info */}
        <div style={{ padding: '0.4rem 0.6rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', fontSize: '0.68rem', color: '#94a3b8' }}>
          <span>Targeting: </span>
          <span style={{ color: selectedText ? '#c084fc' : '#38bdf8', fontWeight: 600 }}>
            {selectedText ? `Selected text (${selectedText.split(/\s+/).filter(Boolean).length} words)` : 'Active chapter manuscript'}
          </span>
        </div>

        {/* Remaster Mode Grid */}
        <div>
          <label style={{ display: 'block', fontSize: '0.64rem', color: '#ec4899', marginBottom: '0.3rem', textTransform: 'uppercase', fontWeight: 700 }}>
            Remaster Directive
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.35rem' }}>
            {REMASTER_MODES.map(m => {
              const isSel = selectedMode === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMode(m.id)}
                  style={{
                    padding: '0.45rem 0.6rem',
                    backgroundColor: isSel ? 'rgba(236,72,153,0.15)' : 'rgba(2,6,23,0.5)',
                    border: isSel ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  <span style={{ fontSize: '0.9rem' }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: isSel ? '#f472b6' : '#f1f5f9', fontSize: '0.72rem' }}>{m.label}</div>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{m.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Instructions */}
        <div>
          <label style={{ display: 'block', fontSize: '0.64rem', color: '#ec4899', marginBottom: '0.3rem', textTransform: 'uppercase', fontWeight: 700 }}>
            Creative Instructions (Optional)
          </label>
          <input
            value={customInstructions}
            onChange={e => setCustomInstructions(e.target.value)}
            placeholder="e.g. Shift POV to Silas's mentor; elevate psychological tension..."
            style={{ width: '100%', padding: '0.4rem', backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerateRemaster}
          disabled={isGenerating || !textToRemaster.trim()}
          style={{
            padding: '0.55rem',
            backgroundColor: '#db2777',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.76rem',
            fontWeight: 700,
            cursor: isGenerating ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            opacity: isGenerating || !textToRemaster.trim() ? 0.5 : 1
          }}
        >
          <Wand2 size={14} />
          <span>{isGenerating ? 'Synthesizing Narrative Variation...' : 'Synthesize Remastered Scene'}</span>
        </button>

        {error && <div style={{ fontSize: '0.7rem', color: '#f87171' }}>{error}</div>}

        {/* Result & Diff Box */}
        {currentResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '8px', padding: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: '#f472b6', fontSize: '0.76rem' }}>Remastered Scene Draft</span>
              {diffStats && (
                <span style={{ fontSize: '0.62rem', color: '#34d399', backgroundColor: 'rgba(16,185,129,0.15)', padding: '1px 5px', borderRadius: '4px' }}
                  title={diffStats.granularity ? `Compared by ${diffStats.granularity}` : 'Too long to compare'}>
                  {diffStats.remasteredWordCount} words ({diffStats.netDifference >= 0 ? `+${diffStats.netDifference}` : diffStats.netDifference})
                  {diffStats.changedPercent !== null ? ` · ${diffStats.changedPercent}% changed` : ''}
                </span>
              )}
            </div>

            {diffStats?.segments && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.66rem', color: '#94a3b8', cursor: 'pointer' }}>
                <input type="checkbox" checked={showChanges} onChange={e => setShowChanges(e.target.checked)} />
                Show changes against the original
              </label>
            )}

            <div style={{ maxHeight: '260px', overflowY: 'auto', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: '1.5', whiteSpace: 'pre-wrap', backgroundColor: '#090d16', padding: '0.6rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
              {showChanges && diffStats?.segments
                ? diffStats.segments.map((seg, idx) => (
                  <span key={idx} style={DIFF_STYLE[seg.op]}>{seg.text}{' '}</span>
                ))
                : currentResult.remasteredText}
            </div>

            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
              <button
                onClick={handleCopy}
                style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '4px', color: '#cbd5e1', fontSize: '0.68rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                {copied ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {onInsertProse && (
                <button
                  onClick={() => onInsertProse(currentResult.remasteredText)}
                  style={{ padding: '0.25rem 0.6rem', backgroundColor: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <CornerDownLeft size={11} />
                  <span>Insert in Manuscript</span>
                </button>
              )}

              {onCreateNewFileWithProse && (
                <button
                  onClick={() => onCreateNewFileWithProse(`Remaster - ${selectedMode}`, currentResult.remasteredText)}
                  style={{ padding: '0.25rem 0.6rem', backgroundColor: '#db2777', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <ArrowRight size={11} />
                  <span>Branch into New File</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
