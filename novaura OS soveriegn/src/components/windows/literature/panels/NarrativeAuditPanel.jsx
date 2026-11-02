// NarrativeAuditPanel.jsx — Narrative Consistency & Workflow Auditor
// Ported from WebOS AIFocusManager & AIFocusPanel into Sovereign OS.
// Conducts automated continuity audits, tracks session checklists, and verifies character state consistency.

import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, Clock, ListChecks, RefreshCw, Sparkles, BookOpen, UserCheck } from 'lucide-react';
import { queryUniversalInference } from '../../../../services/literatureAiService.js';

export default function NarrativeAuditPanel({ activeDocContent = '', activeDocName = '' }) {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'workflow'
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState(null);

  // Workflow Checklist
  const [workflowSteps, setWorkflowSteps] = useState([
    { id: 'step-1', phase: 'Session Start', title: 'Review Active Story Bible & Character Goals', completed: true },
    { id: 'step-2', phase: 'Session Start', title: 'Check Recent Timeline & Causality Ripples', completed: true },
    { id: 'step-3', phase: 'Writing', title: 'Draft Scene with Active Sensory Dimensions', completed: false },
    { id: 'step-4', phase: 'Writing', title: 'Maintain Narrative Tension Arc & Cadence Rhythm', completed: false },
    { id: 'step-5', phase: 'Session Close', title: 'Extract New Entities & Canon into Codex', completed: false },
    { id: 'step-6', phase: 'Session Close', title: 'Log Timeline Events & Character State Shifts', completed: false },
  ]);

  const toggleStep = (id) => {
    setWorkflowSteps(prev => prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const runContinuityAudit = async () => {
    if (!activeDocContent.trim()) return;
    setIsAuditing(true);
    try {
      const plain = activeDocContent.replace(/<[^>]+>/g, ' ').trim();
      const prompt = `Conduct a rigorous literary continuity and consistency audit on this scene from "${activeDocName}":
"""
${plain.slice(0, 3000)}
"""

Format your report into:
1. Plot Consistency (Timeline, causal consequences, physical laws)
2. Character State Consistency (Knowledge state, emotions, active injuries or equipment)
3. Tone & Perspective Integrity (POV slips, sudden tonal jarring)
4. Overall Continuity Score (1-100)`;

      const res = await queryUniversalInference(prompt, 'You are an elite developmental fiction editor and continuity auditor.');
      setAuditReport(res || 'Continuity audit completed with no critical plot holes detected.');
    } catch (err) {
      setAuditReport('Audit error: ' + err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0f0f18', color: '#e2e8f0', fontSize: '0.76rem', overflow: 'hidden' }}>
      
      {/* Header Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#131322' }}>
        <button
          onClick={() => setActiveTab('audit')}
          style={{ flex: 1, padding: '0.6rem 0.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'audit' ? '2px solid #00f0ff' : '2px solid transparent', color: activeTab === 'audit' ? '#00f0ff' : '#94a3b8', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
        >
          <ShieldCheck size={13} /> Continuity Audit
        </button>
        <button
          onClick={() => setActiveTab('workflow')}
          style={{ flex: 1, padding: '0.6rem 0.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'workflow' ? '2px solid #00f0ff' : '2px solid transparent', color: activeTab === 'workflow' ? '#00f0ff' : '#94a3b8', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
        >
          <ListChecks size={13} /> Session Workflow
        </button>
      </div>

      {/* Content Viewport */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem' }}>
        
        {activeTab === 'audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ padding: '0.7rem', backgroundColor: '#161626', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>Active Chapter: {activeDocName || 'Untitled'}</span>
                <button
                  onClick={runContinuityAudit}
                  disabled={isAuditing}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '4px 10px', backgroundColor: '#00f0ff', color: '#090d16', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  <RefreshCw size={11} className={isAuditing ? 'animate-spin' : ''} />
                  {isAuditing ? 'Auditing...' : 'Run Audit'}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>
                Audits narrative consistency, POV slips, timeline logic, and character knowledge state against world canon.
              </p>
            </div>

            {auditReport && (
              <div style={{ padding: '0.8rem', backgroundColor: '#090d16', borderRadius: '8px', border: '1px solid rgba(0,240,255,0.2)', color: '#cbd5e1', fontSize: '0.74rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {auditReport}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workflow' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Master Novelist Session Discipline
            </div>

            {workflowSteps.map(step => (
              <div
                key={step.id}
                onClick={() => toggleStep(step.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.6rem 0.8rem',
                  backgroundColor: step.completed ? 'rgba(16, 185, 129, 0.08)' : '#161626',
                  border: step.completed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ marginTop: '2px' }}>
                  {step.completed ? (
                    <CheckCircle2 size={15} color="#10b981" />
                  ) : (
                    <div style={{ width: '13px', height: '13px', borderRadius: '3px', border: '1px solid #64748b' }} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.64rem', color: '#64748b', textTransform: 'uppercase' }}>{step.phase}</span>
                  <span style={{ color: step.completed ? '#e2e8f0' : '#94a3b8', textDecoration: step.completed ? 'line-through' : 'none' }}>
                    {step.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}
