// CausalityPanel.jsx — Narrative Dependency & Ripple Effect Network
// Visualizes cause-and-effect plot connections, AI causal extraction, and downstream ripples.

import React, { useState, useMemo, useEffect } from 'react';
import { storyTimeline } from '../engines/StoryTimeline.js';
import { extractCausalityGraph } from '../../../../services/literatureAiService.js';
import { Zap, AlertTriangle, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react';

export default function CausalityPanel({ activeDocContent = '', activeDocName = '' }) {
  const [nodes, setNodesState] = useState(() => [...storyTimeline.causality]);
  useEffect(() => {
    const sync = () => setNodesState([...storyTimeline.causality]);
    sync();
    window.addEventListener('novaura:timeline_updated', sync);
    return () => window.removeEventListener('novaura:timeline_updated', sync);
  }, []);

  const setNodes = (update) => {
    const next = typeof update === 'function' ? update(storyTimeline.causality) : update;
    storyTimeline.setCausality(next);
  };

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newChapter, setNewChapter] = useState(activeDocName || 'Chapter 1');
  const [newType, setNewType] = useState('reaction');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [aiError, setAiError] = useState(null);

  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedNodeId) || nodes[0],
    [nodes, selectedNodeId]
  );

  const downstreamIds = useMemo(() => {
    if (!selectedNode) return new Set();
    const set = new Set();
    const traverse = (id) => {
      const node = nodes.find(n => n.id === id);
      if (node && node.consequences) {
        node.consequences.forEach(cId => {
          if (!set.has(cId)) {
            set.add(cId);
            traverse(cId);
          }
        });
      }
    };
    traverse(selectedNode.id);
    return set;
  }, [nodes, selectedNode]);

  const getTypeColor = (type) => {
    switch (type) {
      case 'trigger': return '#00f0ff';
      case 'threat': return '#ef4444';
      case 'climax': return '#f59e0b';
      case 'resolution': return '#10b981';
      default: return '#a855f7';
    }
  };

  const handleAddNode = () => {
    if (!newTitle.trim()) return;
    const newId = `beat-${Date.now().toString(36)}`;
    const newNode = {
      id: newId,
      title: newTitle.trim(),
      chapter: newChapter || activeDocName || 'Chapter 1',
      type: newType,
      x: 40 + (nodes.length * 175) % 680,
      y: 40 + (nodes.length % 3) * 65,
      consequences: []
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newId);
    setNewTitle('');
    setShowAddForm(false);
  };

  const handleDeleteNode = (id) => {
    setNodes(prev =>
      prev
        .filter(n => n.id !== id)
        .map(n => ({
          ...n,
          consequences: (n.consequences || []).filter(cId => cId !== id)
        }))
    );
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleMoveNode = (id, dx, dy) => {
    setNodes(prev => prev.map(n => n.id === id ? {
      ...n,
      x: Math.max(10, Math.min(680, (n.x || 40) + dx)),
      y: Math.max(10, Math.min(200, (n.y || 40) + dy))
    } : n));
  };

  const handleToggleConsequence = (targetId) => {
    if (!selectedNode || targetId === selectedNode.id) return;
    setNodes(prev => prev.map(n => {
      if (n.id !== selectedNode.id) return n;
      const exists = (n.consequences || []).includes(targetId);
      const updated = exists
        ? n.consequences.filter(id => id !== targetId)
        : [...(n.consequences || []), targetId];
      return { ...n, consequences: updated };
    }));
  };

  const handleAiMapCausality = async () => {
    if (!activeDocContent || isExtractingAi) return;
    setIsExtractingAi(true);
    setAiError(null);
    try {
      const extracted = await extractCausalityGraph({
        text: activeDocContent,
        chapterName: activeDocName || 'Current Chapter'
      });
      if (extracted.length > 0) {
        // Lay the new beats out after the existing ones, like added beats.
        const base = storyTimeline.causality.length;
        const placed = extracted.map((n, i) => ({
          ...n,
          x: 40 + ((base + i) * 175) % 680,
          y: 40 + ((base + i) % 3) * 65,
        }));
        setNodes(prev => [...prev, ...placed]);
        setSelectedNodeId(placed[0].id);
      }
    } catch (err) {
      setAiError(err.message || 'AI causal mapping failed.');
    } finally {
      setIsExtractingAi(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0f0f18', color: '#e2e8f0', fontSize: '0.76rem', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '0.5rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#131322', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={14} color="#00f0ff" />
          <span style={{ fontWeight: 700, fontSize: '0.74rem', color: '#f8fafc', textTransform: 'uppercase' }}>Causality Ripples</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <button
            onClick={handleAiMapCausality}
            disabled={isExtractingAi || !activeDocContent}
            title="Extract Cause-and-Effect Chain from Active Chapter using AI"
            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 7px', backgroundColor: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: '4px', color: '#c084fc', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {isExtractingAi ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
            <span>{isExtractingAi ? 'Mapping...' : 'AI Map'}</span>
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 7px', backgroundColor: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={11} /> Beat
          </button>
        </div>
      </div>

      {aiError && (
        <div style={{ padding: '0.35rem 0.8rem', backgroundColor: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: '0.66rem' }}>
          {aiError}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div style={{ padding: '0.7rem', backgroundColor: '#090d16', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <input
            type="text"
            placeholder="Plot beat title (e.g. Discovery of the Cipher)..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ width: '100%', padding: '0.35rem', backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              placeholder="Chapter"
              value={newChapter}
              onChange={(e) => setNewChapter(e.target.value)}
              style={{ flex: 1, padding: '0.3rem', backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.7rem', outline: 'none' }}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={{ padding: '0.3rem', backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.7rem', outline: 'none' }}
            >
              <option value="trigger">Trigger</option>
              <option value="reaction">Reaction</option>
              <option value="threat">Threat</option>
              <option value="climax">Climax</option>
              <option value="resolution">Resolution</option>
            </select>
            <button
              onClick={handleAddNode}
              style={{ padding: '0.3rem 0.7rem', backgroundColor: '#00f0ff', color: '#090d16', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* SVG Dependency Graph Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'auto', backgroundColor: '#080812' }}>
        {nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.72rem' }}>
            No plot beats yet. Click "AI Map" to extract cause-and-effect beats from your active chapter, or "+ Beat" to add one manually.
          </div>
        )}
        <svg style={{ width: '860px', height: '260px', display: 'block' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#00f0ff" opacity="0.8" />
            </marker>
            <marker id="arrow-downstream" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" opacity="0.9" />
            </marker>
          </defs>

          {nodes.map(node => (node.consequences || []).map(targetId => {
            const target = nodes.find(n => n.id === targetId);
            if (!target) return null;
            const isHighlight = node.id === selectedNode?.id || downstreamIds.has(node.id);
            return (
              <line
                key={`line-${node.id}-${target.id}`}
                x1={node.x + 80}
                y1={node.y + 25}
                x2={target.x}
                y2={target.y + 25}
                stroke={isHighlight ? '#f59e0b' : 'rgba(255,255,255,0.18)'}
                strokeWidth={isHighlight ? 2 : 1}
                strokeDasharray={isHighlight ? 'none' : '4,4'}
                markerEnd={isHighlight ? 'url(#arrow-downstream)' : 'url(#arrow)'}
              />
            );
          }))}

          {nodes.map(node => {
            const isSelected = node.id === selectedNode?.id;
            const isDownstream = downstreamIds.has(node.id);
            const color = getTypeColor(node.type);

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNodeId(node.id)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  width="160"
                  height="50"
                  rx="6"
                  fill={isSelected ? 'rgba(0, 240, 255, 0.15)' : isDownstream ? 'rgba(245, 158, 11, 0.12)' : '#181825'}
                  stroke={isSelected ? '#00f0ff' : isDownstream ? '#f59e0b' : 'rgba(255,255,255,0.1)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <circle cx="12" cy="18" r="4" fill={color} />
                <text x="22" y="21" fill="#f8fafc" fontSize="9.5" fontWeight="600">
                  {node.title.length > 20 ? node.title.slice(0, 19) + '…' : node.title}
                </text>
                <text x="12" y="38" fill="#64748b" fontSize="8.5">
                  {node.chapter} • {(node.type || 'reaction').toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Beat Inspector & Ripple Impact */}
      {selectedNode && (
        <div style={{ height: '195px', padding: '0.75rem', backgroundColor: '#11111e', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.45rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#00f0ff' }}>{selectedNode.title}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button onClick={() => handleMoveNode(selectedNode.id, -40, 0)} title="Move Left" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#cbd5e1', borderRadius: '3px', padding: '1px 5px', fontSize: '0.62rem', cursor: 'pointer' }}>←</button>
              <button onClick={() => handleMoveNode(selectedNode.id, 40, 0)} title="Move Right" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#cbd5e1', borderRadius: '3px', padding: '1px 5px', fontSize: '0.62rem', cursor: 'pointer' }}>→</button>
              <button onClick={() => handleMoveNode(selectedNode.id, 0, -25)} title="Move Up" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#cbd5e1', borderRadius: '3px', padding: '1px 5px', fontSize: '0.62rem', cursor: 'pointer' }}>↑</button>
              <button onClick={() => handleMoveNode(selectedNode.id, 0, 25)} title="Move Down" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#cbd5e1', borderRadius: '3px', padding: '1px 5px', fontSize: '0.62rem', cursor: 'pointer' }}>↓</button>
              <button
                onClick={() => handleDeleteNode(selectedNode.id)}
                title="Delete Beat Node"
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            <strong>Causal Ripples ({downstreamIds.size} downstream effects):</strong>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {nodes.filter(n => n.id !== selectedNode.id).map(n => {
              const isLinked = (selectedNode.consequences || []).includes(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => handleToggleConsequence(n.id)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: isLinked ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: isLinked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                    color: isLinked ? '#34d399' : '#94a3b8',
                    fontSize: '0.66rem',
                    cursor: 'pointer'
                  }}
                >
                  {isLinked ? '✓ Causes: ' : '+ Link: '}{n.title.slice(0, 16)}…
                </button>
              );
            })}
          </div>

          {downstreamIds.size > 0 && (
            <div style={{ padding: '0.35rem 0.5rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', color: '#fbbf24', fontSize: '0.66rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={12} />
              <span>Modifying this plot beat will ripple across {downstreamIds.size} downstream chapter beat{downstreamIds.size === 1 ? '' : 's'}.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
