import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, GitPullRequest, RotateCcw, Play, 
  Terminal as TermIcon, Shield, Zap, Sparkles,
  Bot, Settings, CheckCircle2, AlertCircle, Clock,
  Github, Layers, Search, Code2, TestTube, UserCheck
} from 'lucide-react';

export default function CatalystCommandStation() {
  const [githubUrl, setGithubUrl] = useState('');
  const [activeProjects, setActiveProjects] = useState([
    { 
      id: 'proj-1', 
      name: 'NovAura Ecosystem', 
      status: 'Refining', 
      progress: 68, 
      models: ['Gemini', 'Kimi'],
      lastSync: '2 mins ago',
      logs: ['Pass 1: Complete', 'Pass 2: Analyzing branching logic...', 'Kimi Swarm: Initializing refinement...']
    },
    { 
      id: 'proj-2', 
      name: 'Agentic Node V8', 
      status: 'Testing', 
      progress: 92, 
      models: ['Claude', 'GPT-4'],
      lastSync: '1 hour ago',
      logs: ['Unit tests: Passed', 'Integration: Success', 'E2E: 14/15 complete']
    }
  ]);
  const [selectedModels, setSelectedModels] = useState(['Gemini', 'Kimi']);
  const [isDeploying, setIsDeploying] = useState(false);
  const logRef = useRef(null);

  const models = [
    { name: 'Gemini', icon: Sparkles, color: 'text-cyan-400' },
    { name: 'Kimi', icon: Bot, color: 'text-purple-400' },
    { name: 'Claude', icon: Shield, color: 'text-amber-500' },
    { name: 'GPT-4', icon: Zap, color: 'text-emerald-400' },
    { name: 'Qwen', icon: Code2, color: 'text-blue-500' },
    { name: 'Gemma 4', icon: Cpu, color: 'text-pink-500' }
  ];

  const handleDeploy = () => {
    if (!githubUrl) return;
    setIsDeploying(true);
    // Simulation of deployment logic
    setTimeout(() => {
      const newProj = {
        id: `proj-${Date.now()}`,
        name: githubUrl.split('/').pop() || 'New Project',
        status: 'Pulling',
        progress: 10,
        models: selectedModels,
        lastSync: 'Just now',
        logs: ['Cloning repository...', 'Setting up swarm environment...']
      };
      setActiveProjects([newProj, ...activeProjects]);
      setIsDeploying(false);
      setGithubUrl('');
    }, 2000);
  };

  return (
    <div className="h-full bg-[#050508] text-white flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <div className="p-6 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Catalyst Command Station</h1>
            <p className="text-[10px] text-cyan-400 font-mono tracking-[0.2em] uppercase">Multi-Agent Swarm Orchestrator</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">System Status</span>
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Swarms Active
            </span>
          </div>
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <Settings className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel: Control Center */}
        <div className="w-1/3 border-r border-white/5 p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
          
          {/* GitHub Input */}
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4 block">Initialization</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Github className="w-5 h-5 text-white/20 group-focus-within:text-cyan-400 transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder="Repository URL (e.g. user/repo)"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl text-sm focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all outline-none"
              />
            </div>
          </section>

          {/* Model Selection */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Swarm Intelligence</label>
              <span className="text-[10px] text-cyan-400 font-bold">{selectedModels.length} Models Selected</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {models.map((m) => (
                <button
                  key={m.name}
                  onClick={() => {
                    if (selectedModels.includes(m.name)) {
                      setSelectedModels(selectedModels.filter(sm => sm !== m.name));
                    } else {
                      setSelectedModels([...selectedModels, m.name]);
                    }
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    selectedModels.includes(m.name)
                      ? 'bg-white/10 border-white/20'
                      : 'bg-transparent border-white/5 opacity-40 hover:opacity-100 hover:bg-white/5'
                  }`}
                >
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                  <span className="text-xs font-bold">{m.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Build Strategy */}
          <section>
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4 block">Refinement Strategy</label>
            <div className="space-y-3">
              {[
                { label: '3-Pass Frontier Build', icon: Layers, desc: 'Gemini -> Claude -> GPT-4 sequentially.' },
                { label: 'Kimi Continuous Swarm', icon: Bot, desc: 'Real-time refinement and logic capping.' },
                { label: 'E2E Human Testing', icon: UserCheck, desc: 'Automated friendliness and UI validation.' }
              ].map((s, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-cyan-400">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{s.label}</div>
                    <div className="text-[10px] text-white/30">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Button 
            onClick={handleDeploy}
            disabled={!githubUrl || isDeploying}
            className="w-full py-6 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isDeploying ? 'Initializing Swarm...' : 'Activate Catalyst'}
          </Button>
        </div>

        {/* Right Panel: Active Streams */}
        <div className="flex-1 bg-black/40 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">Active Build Streams</h2>
            <div className="flex gap-2">
              <span className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-bold">2 PROJECTS</span>
              <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-[9px] font-bold">14 AGENTS</span>
            </div>
          </div>

          <div className="space-y-6">
            <AnimatePresence>
              {activeProjects.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 relative overflow-hidden group"
                >
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-cyan-500/30" />
                  
                  {/* Status Bar */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-black">{p.name}</div>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase tracking-widest border border-cyan-500/20">
                        {p.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/30 font-mono">ID: {p.id}</div>
                  </div>

                  {/* Progress */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Swarm Progress</span>
                      <span className="text-sm font-black text-cyan-400">{p.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${p.progress}%` }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                      />
                    </div>
                  </div>

                  {/* Log Excerpt */}
                  <div className="p-4 rounded-xl bg-black/60 font-mono text-[10px] text-cyan-400/70 border border-white/5 space-y-1">
                    {p.logs.map((log, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-white/20">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>
                        <span>{log}</span>
                      </div>
                    ))}
                    <div className="animate-pulse">_</div>
                  </div>

                  {/* Footer Stats */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-2">
                      {p.models.map(m => (
                        <span key={m} className="px-2 py-0.5 rounded bg-white/5 text-white/40 text-[9px] font-bold">{m}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-white/30 text-[10px]">
                      <Clock className="w-3 h-3" />
                      Updated {p.lastSync}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Button({ children, className, ...props }) {
  return (
    <button 
      className={`relative overflow-hidden group ${className}`}
      {...props}
    >
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}
