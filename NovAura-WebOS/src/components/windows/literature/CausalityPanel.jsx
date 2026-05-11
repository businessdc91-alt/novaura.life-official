import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  MarkerType 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Brain, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import { kernel } from '../../../kernel/NovaKernel';

/**
 * CausalityPanel — Advanced Narrative Dependency Visualization
 * Powers the Literature IDE's Neural Narrative Suite.
 */

const nodeStyles = {
  beat: {
    background: '#1e1e2e',
    color: '#cdd6f4',
    border: '1px solid #cba6f7',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '12px',
    width: 180,
  },
  arc: {
    background: '#181825',
    color: '#fab387',
    border: '1px solid #fab387',
    borderRadius: '20px',
    padding: '10px',
    fontSize: '12px',
    width: 150,
    textAlign: 'center',
  }
};

export default function CausalityPanel() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncFromEngine = useCallback(() => {
    if (!kernel.narrative) return;
    setIsSyncing(true);
    
    const state = kernel.narrative.getState();
    const newNodes = [];
    const newEdges = [];

    state.graph.forEach(([id, data], index) => {
      newNodes.push({
        id,
        type: 'default',
        data: { label: data.title || id },
        position: { x: 50 + (index * 200), y: 100 + (index % 2 * 100) },
        style: nodeStyles.beat,
      });

      if (data.effects) {
        data.effects.forEach(targetId => {
          newEdges.push({
            id: `e-${id}-${targetId}`,
            source: id,
            target: targetId,
            animated: true,
            label: 'causes',
            labelStyle: { fill: '#a6adc8', fontSize: 10 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#cba6f7' },
            style: { stroke: '#cba6f7' },
          });
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
    setTimeout(() => setIsSyncing(false), 500);
  }, [setNodes, setEdges]);

  useEffect(() => {
    syncFromEngine();
    // Subscribe to narrative updates
    const unsubscribe = kernel.ipc.on('narrative:updated', syncFromEngine);
    return () => kernel.ipc.off('narrative:updated', syncFromEngine);
  }, [syncFromEngine]);

  return (
    <div className="flex flex-col h-full bg-[#0c0c16] text-[#cdd6f4]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#11111b]">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#cba6f7]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Causality Engine</span>
        </div>
        <button 
          onClick={syncFromEngine}
          className={`p-1 hover:bg-white/5 rounded transition-colors ${isSyncing ? 'animate-spin' : ''}`}
          title="Sync with Narrative Engine"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 relative">
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 opacity-50 p-6">
            <Zap className="w-12 h-12 mb-4" />
            <p className="text-sm text-center">No causal links detected yet.</p>
            <p className="text-[10px] text-center mt-2 max-w-[200px]">
              The engine will automatically map plot dependencies as you write or interact with Aura.
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            theme="dark"
          >
            <Background color="#1e1e2e" gap={16} />
            <Controls />
            <MiniMap 
              nodeColor={n => n.style?.background || '#181825'} 
              maskColor="rgba(0, 0, 0, 0.4)" 
              style={{ background: '#11111b' }}
            />
          </ReactFlow>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-white/5 bg-[#050508] flex items-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#cba6f7]" />
          <span>Plot Point</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#fab387]" />
          <span>Arc Stage</span>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[#a6adc8]">
          <AlertCircle className="w-3 h-3" />
          <span>Consistency Check: Passive</span>
        </div>
      </div>
    </div>
  );
}
