import React, { useState, useEffect, useRef } from 'react';
import {
  GitBranch, Play, Plus, CheckCircle2, AlertTriangle, Cpu, Mail,
  HardDrive, Bell, Database, RefreshCw, Zap, ArrowRight, Activity,
  Sliders, Trash2, Power, Terminal, Layers
} from 'lucide-react';
import { chainLogicWeaver } from '../../services/chainLogicWeaverService.js';
import { useKernel } from '../../kernel/useKernel.js';

export default function ChainLogicWeaverWindow() {
  const { kernel } = useKernel();
  const [chains, setChains] = useState(() => chainLogicWeaver.getChains());
  const [selectedChainId, setSelectedChainId] = useState(chains[0]?.id || 'chain_doc_ingest');
  const [executing, setExecuting] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [intentInput, setIntentInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const selectedChain = chains.find(c => c.id === selectedChainId) || chains[0];

  useEffect(() => {
    const unsub = chainLogicWeaver.subscribe(setChains);
    const unsubStep = kernel?.ipc?.on('chain:step_start', ({ nodeId }) => {
      setActiveNodeId(nodeId);
    });
    const unsubComplete = kernel?.ipc?.on('chain:execution_complete', ({ execution }) => {
      setActiveNodeId(null);
      setExecuting(false);
      if (execution?.stepLogs) {
        setExecutionLogs(execution.stepLogs);
      }
      setStatusMessage('Chain executed with 100% success.');
      setTimeout(() => setStatusMessage(''), 4000);
    });
    const unsubFail = kernel?.ipc?.on('chain:execution_failed', ({ error }) => {
      setActiveNodeId(null);
      setExecuting(false);
      setStatusMessage(`Execution error: ${error}`);
    });

    return () => {
      unsub();
      unsubStep?.();
      unsubComplete?.();
      unsubFail?.();
    };
  }, [kernel]);

  const handleRunChain = async () => {
    if (!selectedChain) return;
    setExecuting(true);
    setExecutionLogs([]);
    setStatusMessage(`Executing chain '${selectedChain.name}'...`);
    try {
      await chainLogicWeaver.executeChain(selectedChain.id, {
        content: 'Autonomous verification manuscript document payload.',
      });
    } catch (e) {
      console.warn('Execution error:', e);
    }
  };

  const handleRunIntent = async (e) => {
    e.preventDefault();
    if (!intentInput.trim()) return;
    setExecuting(true);
    setExecutionLogs([]);
    setStatusMessage(`Dispatching intent: "${intentInput}"...`);
    try {
      await chainLogicWeaver.dispatchIntent(intentInput);
      setIntentInput('');
    } catch (e) {
      console.warn('Intent error:', e);
    }
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'TRIGGER': return Zap;
      case 'CONDITION': return Sliders;
      case 'AI_INFERENCE': return Cpu;
      case 'RAG_COMMIT': return Database;
      case 'MAIL_DISPATCH': return Mail;
      case 'SYSTEM_CLEANUP': return HardDrive;
      case 'NOTIFICATION': return Bell;
      default: return Activity;
    }
  };

  const getNodeColor = (category) => {
    switch (category) {
      case 'trigger': return '#fbbf24'; // Amber
      case 'logic': return '#06b6d4'; // Cyan
      case 'ai': return '#c084fc'; // Purple
      case 'storage': return '#38bdf8'; // Blue
      case 'action': return '#34d399'; // Emerald
      default: return '#94a3b8';
    }
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Left Sidebar: Chains Catalog & Intent Bar */}
      <div className="w-80 bg-slate-900/60 border-r border-slate-800 p-3 flex flex-col shrink-0">
        <div className="flex items-center justify-between px-2 py-2 mb-3">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
            <GitBranch className="w-5 h-5" />
            <span>Autonomous Chains</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-semibold border border-purple-500/30">
            INTENT DAG
          </span>
        </div>

        {/* Intent Dispatch Input */}
        <form onSubmit={handleRunIntent} className="mb-4 space-y-1.5">
          <label className="text-[10px] text-slate-400 uppercase font-semibold block px-1">
            Intent Bar Dispatch
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="e.g. 'Ingest lore from document'..."
              value={intentInput}
              onChange={(e) => setIntentInput(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-purple-500 font-mono"
            />
            <button
              type="submit"
              disabled={executing}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Run</span>
            </button>
          </div>
        </form>

        {/* Chain List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block px-1">
            Active Chain Workflows ({chains.length})
          </span>

          {chains.map((chain) => (
            <div
              key={chain.id}
              onClick={() => setSelectedChainId(chain.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedChain?.id === chain.id
                  ? 'bg-purple-950/30 border-purple-500/50 ring-1 ring-purple-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 line-clamp-1">{chain.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    chainLogicWeaver.toggleChain(chain.id);
                  }}
                  className={`p-1 rounded ${chain.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-600 hover:bg-slate-800'}`}
                  title={chain.enabled ? 'Enabled' : 'Disabled'}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                {chain.description}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/60">
                <span>{chain.nodes.length} Nodes</span>
                <span>{chain.lastRun ? new Date(chain.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never Run'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Status */}
        <div className="mt-auto p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-0.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Zero-Cloud Execution</span>
          </div>
          <span>All chains evaluate locally via microkernel and local models.</span>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">{selectedChain?.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {selectedChain?.nodes.length} Steps
              </span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-1">{selectedChain?.description}</p>
          </div>

          <div className="flex items-center gap-2">
            {statusMessage && (
              <span className="text-xs text-purple-300 font-mono px-2 py-1 bg-purple-950/40 border border-purple-500/30 rounded-lg">
                {statusMessage}
              </span>
            )}
            <button
              onClick={handleRunChain}
              disabled={executing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-purple-950/50"
            >
              <Play className={`w-3.5 h-3.5 ${executing ? 'animate-spin' : 'fill-white'}`} />
              <span>{executing ? 'Executing...' : 'Run Chain'}</span>
            </button>
          </div>
        </div>

        {/* Nodal Canvas Area */}
        <div className="flex-1 relative bg-slate-950 overflow-auto p-8" style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.05) 0%, transparent 80%), radial-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 24px 24px',
        }}>
          {selectedChain && (
            <div className="relative min-w-[1100px] min-h-[400px]">
              {/* SVG Connecting Cables */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                <defs>
                  <linearGradient id="cableGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="cableBranchTrue" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="cableBranchFalse" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
                  </linearGradient>
                </defs>

                {selectedChain.edges.map((edge, idx) => {
                  const fromNode = selectedChain.nodes.find(n => n.id === edge.from);
                  const toNode = selectedChain.nodes.find(n => n.id === edge.to);
                  if (!fromNode || !toNode) return null;

                  const x1 = fromNode.x + 180;
                  const y1 = fromNode.y + 40;
                  const x2 = toNode.x;
                  const y2 = toNode.y + 40;
                  const dx = Math.abs(x2 - x1) * 0.5;

                  const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                  const isBranchTrue = edge.branch === 'true';
                  const isBranchFalse = edge.branch === 'false';

                  return (
                    <g key={idx}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isBranchTrue ? 'url(#cableBranchTrue)' : isBranchFalse ? 'url(#cableBranchFalse)' : 'url(#cableGrad)'}
                        strokeWidth="2.5"
                        strokeDasharray={isBranchFalse ? '4 4' : 'none'}
                      />
                      {edge.branch && (
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 8}
                          fill={isBranchTrue ? '#34d399' : '#f59e0b'}
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {edge.branch === 'true' ? 'IF TRUE' : 'IF FALSE'}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Nodal Cards */}
              {selectedChain.nodes.map((node) => {
                const Icon = getNodeIcon(node.type);
                const color = getNodeColor(node.category);
                const isActive = activeNodeId === node.id;

                return (
                  <div
                    key={node.id}
                    className={`absolute w-44 rounded-xl border p-3 select-none transition-all shadow-xl ${
                      isActive
                        ? 'bg-purple-950/80 border-purple-400 ring-2 ring-purple-400/50 scale-105'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                    style={{
                      left: node.x,
                      top: node.y,
                      zIndex: 2,
                      boxShadow: isActive ? '0 0 25px rgba(168, 85, 247, 0.4)' : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center border" style={{
                        backgroundColor: `${color}15`,
                        borderColor: `${color}40`,
                        color,
                      }}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold" style={{
                        backgroundColor: `${color}15`,
                        color,
                      }}>
                        {node.type.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{node.title}</h4>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">ID: {node.id}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Execution Telemetry Drawer */}
        <div className="h-44 bg-slate-900 border-t border-slate-800 p-3 flex flex-col shrink-0">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">Execution Telemetry & Audit Stream</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {executionLogs.length} Steps Recorded
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 font-mono text-xs">
            {executionLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                <span>Click 'Run Chain' or dispatch an intent to view step-by-step DAG execution logs.</span>
              </div>
            ) : (
              executionLogs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 bg-slate-950 rounded border border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-slate-300 font-bold">{log.title}:</span>
                    <span className="text-slate-400">{log.output}</span>
                  </div>
                  <span className="text-[10px] text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
