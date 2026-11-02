// PacingAnalyticsPanel.jsx — ProWritingAid-Style Narrative Cadence & Tension Heatmap
import React, { useState, useEffect } from 'react';
import {
  BarChart2, RefreshCw, Activity, MessageSquare, Zap, AlertCircle
} from 'lucide-react';
import { analyzePacingAndTension } from '../../../../services/literatureAiService.js';

export default function PacingAnalyticsPanel({ activeDocContent }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    runAnalysis();
  }, [activeDocContent]);

  const runAnalysis = async () => {
    if (!activeDocContent || activeDocContent.trim().length < 40) {
      setStats(null);
      return;
    }
    setIsLoading(true);
    try {
      const result = await analyzePacingAndTension({ text: activeDocContent });
      setStats(result);
    } catch (err) {
      console.warn('[Pacing] Analysis note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#12121e', color: '#e2e8f0', fontSize: '0.76rem' }}>
      {/* Header */}
      <div style={{ height: '36px', padding: '0 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#06b6d4' }}>
          <BarChart2 size={15} />
          <span>PACING & CADENCE ANALYTICS</span>
        </div>
        <button
          onClick={runAnalysis}
          title="Refresh Pacing Heatmap"
          style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', padding: '2px' }}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {!stats ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
            <Activity size={24} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
            <p style={{ margin: 0 }}>Add prose to analyze narrative cadence.</p>
            <p style={{ fontSize: '0.68rem', margin: '0.2rem 0 0' }}>Measures sentence length variation, dialogue ratio, and emotional arc.</p>
          </div>
        ) : (
          <>
            {/* Quick Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ padding: '0.6rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Avg Sentence Length</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                  {stats.averageSentenceLength} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>words</span>
                </div>
                <div style={{ fontSize: '0.62rem', color: stats.averageSentenceLength > 24 ? '#f59e0b' : '#34d399', marginTop: '0.1rem' }}>
                  {stats.averageSentenceLength > 24 ? 'Dense / Exposition heavy' : 'Lively narrative rhythm'}
                </div>
              </div>

              <div style={{ padding: '0.6rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Dialogue vs Narrative</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c084fc', marginTop: '0.2rem' }}>
                  {stats.dialogueRatio}% <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>dialogue</span>
                </div>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  {100 - stats.dialogueRatio}% narration / scene beats
                </div>
              </div>
            </div>

            {/* Pacing Speed Indicator */}
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.64rem', color: '#94a3b8', textTransform: 'uppercase' }}>Current Scene Tempo:</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#06b6d4', marginTop: '0.1rem' }}>
                  {stats.pacingScore}
                </div>
              </div>
              <Zap size={22} color="#06b6d4" />
            </div>

            {/* Tension Arc Curve Visualization */}
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f1f5f9' }}>Dramatic Tension Curve</span>
                <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Beginning → Climax → Resolution</span>
              </div>

              {/* Sparkline / Bar Graph */}
              <div style={{ height: '70px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '0 4px', backgroundColor: '#090d16', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)' }}>
                {(stats.tensionCurve || [30, 50, 75, 90, 60]).map((val, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.55rem', color: '#64748b', marginBottom: '2px' }}>{val}%</span>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(10, Math.min(100, val))}%`,
                        backgroundColor: val > 75 ? '#ec4899' : val > 50 ? '#06b6d4' : '#3b82f6',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Editor Suggestions */}
            {stats.suggestions && stats.suggestions.length > 0 && (
              <div style={{ padding: '0.65rem 0.75rem', backgroundColor: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#22d3ee' }}>Cadence Recommendations:</span>
                {stats.suggestions.map((sug, idx) => (
                  <div key={idx} style={{ fontSize: '0.68rem', color: '#cbd5e1', lineHeight: '1.3', display: 'flex', gap: '0.3rem' }}>
                    <span style={{ color: '#06b6d4' }}>•</span>
                    <span>{sug}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
