// CausalityPanel.jsx — Narrative Dependency & Ripple Effect Network
// Ported & Enhanced from WebOS into Sovereign OS.
// Visualizes cause-and-effect plot connections and downstream ripples without external graphing dependencies.

import React, { useState, useMemo } from 'react';
import { GitCommit, Zap, AlertTriangle, Plus, RefreshCw, ArrowRight, Eye, ShieldAlert, Sparkles } from 'lucide-react';

export default function CausalityPanel({ activeDocContent = '', activeDocName = '' }) {
  const [nodes, setNodes] = useState([
    { id: 'beat-1', title: 'Stolen Artifact from Sanctuary', chapter: 'Chapter 1', type: 'trigger', x: 60, y: 80, consequences: ['beat-2', 'beat-3'] },
    { id: 'beat-2', title: 'Council Discovers the Breach', chapter: 'Chapter 2', type: 'reaction', x: 260, y: 50, consequences: ['beat-4'] },
    { id: 'beat-3', title: 'Assassin Dispatched on Trail', chapter: 'Chapter 2', type: 'threat', x: 260, y: 150, consequences: ['beat-4'] },
    { id: 'beat-4', title: 'Ambush at Obsidian Pass', chapter: 'Chapter 4', type: 'climax', x: 480, y: 100, consequences: ['beat-5'] },
    { id: 'beat-5', title: 'Secret Alliance Forged in Defeat', chapter: 'Chapter 6', type: 'resolution', x: 700, y: 100, consequences: [] },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState('beat-1');
  const [newTitle, setNewTitle] = useState('');
  const [newChapter, setNewChapter] = useState('Chapter 1');
  const [newType, setNewType] = useState('reaction');
  const [showAddForm, setShowAddForm] = useState(false);

  // Selected node & downstream consequences
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || nodes[0], [nodes, selectedNodeId]);

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

  // Color mapping
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
      chapter: newChapter,
      type: newType,
      x: 100 + (nodes.length * 90) % 500,
      y: 80 + (nodes.length % 3) * 60,
      consequences: []
    };
    setNodes(prev => [...prev, newNode]);
    setNewTitle('');
    setShowAddForm(false);
  };

  const handleToggleConsequence = (targetId) => {
    if (!selectedNode || targetId === selectedNode.id) return;
    setNodes(prev => prev.map(n => {
      if (n.id !== selectedNode.id) return n;
      const exists = (n.consequences || []).includes(targetId);
      const updated = exists ? n.consequences.filter(id => id !== targetId) : [...(n.consequences || []), targetId];
      return { ...n, consequences: updated };
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0f0f18', color: '#e2e8f0', fontSize: '0.76rem', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#131322', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={14} color="#00f0ff" />
          <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#f8fafc', textTransform: 'uppercase' }}>Causality & Plot Ripples</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '2px 8px', backgroundColor: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '4px', color: '#00f0ff', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={11} /> Beat
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{ padding: '0.8rem', backgroundColor: '#090d16', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Plot beat title (e.g. Discovery of the Letter)..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ width: '100%', padding: '0.4rem', backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Chapter (e.g. Chapter 3)"
              value={newChapter}
              onChange={(e) => setNewChapter(e.target.value)}
              style={{ flex: 1, padding: '0.35rem', backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={{ padding: '0.35rem', backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.72rem', outline: 'none' }}
            >
              <option value="trigger">Trigger</option>
              <option value="reaction">Reaction</option>
              <option value="threat">Threat</option>
              <option value="climax">Climax</option>
              <option value="resolution">Resolution</option>
            </select>
            <button
              onClick={handleAddNode}
              style={{ padding: '0.35rem 0.8rem', backgroundColor: '#00f0ff', color: '#090d16', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* SVG Dependency Graph Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'auto', backgroundColor: '#080812' }}>
        <svg style={{ width: '850px', height: '240px', display: 'block' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#00f0ff" opacity="0.8" />
            </marker>
            <marker id="arrow-downstream" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" opacity="0.9" />
            </marker>
          </defs>

          {/* Render Causal Connections */}
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

          {/* Render Plot Nodes */}
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
                  {node.chapter} • {node.type.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Beat Inspector & Ripple Impact */}
      {selectedNode && (
        <div style={{ height: '180px', padding: '0.8rem', backgroundColor: '#11111e', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#00f0ff' }}>{selectedNode.title}</span>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{selectedNode.chapter}</span>
          </div>

          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            <strong>Causal Ripples ({downstreamIds.size} downstream effects):</strong>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
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
                    fontSize: '0.68rem',
                    cursor: 'pointer'
                  }}
                >
                  {isLinked ? '✓ Causes: ' : '+ Link: '}{n.title.slice(0, 16)}…
                </button>
              );
            })}
          </div>

          {downstreamIds.size > 0 && (
            <div style={{ padding: '0.4rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', color: '#fbbf24', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={12} />
              <span>Modifying this plot beat will cause ripple revisions across {downstreamIds.size} future chapter beats.</span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
