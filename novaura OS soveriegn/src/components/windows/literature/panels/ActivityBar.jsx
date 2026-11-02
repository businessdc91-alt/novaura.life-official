import React from 'react';
import {
  Files, BookOpen, Clock, SpellCheck, CheckCircle2, GitFork,
  BarChart2, MessageSquare, Split, Eye, Layers, Settings, Sparkles,
  Zap, ShieldCheck, Palette
} from 'lucide-react';

export default function ActivityBar({
  activePanel,
  setActivePanel,
  isSidebarOpen,
  setIsSidebarOpen,
  isSplitView,
  setIsSplitView,
  isZenMode,
  setIsZenMode,
  isAiPanelOpen,
  setIsAiPanelOpen,
  grammarIssueCount = 0,
  factIssueCount = 0
}) {
  const activities = [
    { id: 'explorer', label: 'Manuscript Explorer', icon: Files, color: '#00f0ff' },
    { id: 'codex', label: 'Story Bible & Codex', icon: BookOpen, color: '#38bdf8' },
    { id: 'timeline', label: 'Visual Timeline', icon: Clock, color: '#a855f7' },
    { id: 'causality', label: 'Plot Causality & Ripples', icon: Zap, color: '#f59e0b' },
    { id: 'grammar', label: 'Grammar & Style Linter', icon: SpellCheck, color: '#10b981', badge: grammarIssueCount },
    { id: 'factcheck', label: 'Fact & Canon Verifier', icon: CheckCircle2, color: '#38bdf8', badge: factIssueCount },
    { id: 'audit', label: 'Continuity & Workflow Auditor', icon: ShieldCheck, color: '#8b5cf6' },
    { id: 'remaster', label: 'Scene Remaster & Branch', icon: GitFork, color: '#ec4899' },
    { id: 'pacing', label: 'Pacing & Cadence Analytics', icon: BarChart2, color: '#06b6d4' },
    { id: 'sketch', label: 'World Map & Scene Sketchpad', icon: Palette, color: '#f43f5e' },
  ];

  return (
    <div style={{
      width: '48px',
      backgroundColor: '#0d0d16',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0.6rem 0',
      gap: '0.5rem',
      flexShrink: 0,
      zIndex: 30
    }}>
      {activities.map(act => {
        const Icon = act.icon;
        const isActive = activePanel === act.id && isSidebarOpen;
        return (
          <button
            key={act.id}
            onClick={() => {
              if (activePanel === act.id && isSidebarOpen) {
                setIsSidebarOpen(false);
              } else {
                setActivePanel(act.id);
                setIsSidebarOpen(true);
              }
            }}
            title={act.label}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              border: 'none',
              background: isActive ? `${act.color}25` : 'none',
              color: isActive ? act.color : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon size={18} />
            {act.badge > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: act.color,
                boxShadow: `0 0 6px ${act.color}`
              }} />
            )}
          </button>
        );
      })}

      <div style={{ width: '28px', height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '0.2rem 0' }} />

      {/* AI Co-Author Toggle */}
      <button
        onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
        title="Toggle AI Co-Author Studio"
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '6px',
          border: 'none',
          background: isAiPanelOpen ? 'rgba(0,240,255,0.2)' : 'none',
          color: isAiPanelOpen ? '#00f0ff' : '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <Sparkles size={18} />
      </button>

      {/* Split View Toggle */}
      <button
        onClick={() => setIsSplitView(!isSplitView)}
        title={isSplitView ? 'Close Dual Pane Split Screen' : 'Open Dual Pane Split Screen'}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '6px',
          border: 'none',
          background: isSplitView ? 'rgba(168,85,247,0.2)' : 'none',
          color: isSplitView ? '#c084fc' : '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <Split size={18} />
      </button>

      {/* Bottom Controls */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          onClick={() => setIsZenMode(!isZenMode)}
          title="Distraction-Free Typewriter Zen Mode"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: 'none',
            background: isZenMode ? 'rgba(16,185,129,0.2)' : 'none',
            color: isZenMode ? '#34d399' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Eye size={18} />
        </button>

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title="Toggle Primary Sidebar"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: 'none',
            background: 'none',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Layers size={18} />
        </button>
      </div>
    </div>
  );
}
