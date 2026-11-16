import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Brain, TrendingUp, Users, AlertTriangle } from 'lucide-react';

const AuraStrategistPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'valuator' | 'deck' | 'tcg'>('valuator');

  return (
    <div className="min-h-screen bg-void text-white p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <header className="mb-12 border-b border-white/10 pb-8 flex justify-between items-end">
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-neon-pink to-neon-lime bg-clip-text text-transparent">
              Aura Strategist Portal
            </h1>
            <p className="text-zinc-400 mt-2 text-lg">Recursive R&D • Strategic IP Valuation • Asset Optimization</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('valuator')}
              className={`px-6 py-2 rounded-full transition-all ${activeTab === 'valuator' ? 'bg-neon-pink text-void font-bold shadow-lg shadow-neon-pink/20' : 'bg-white/5 hover:bg-white/10'}`}
            >
              IP Valuator
            </button>
            <button 
              onClick={() => setActiveTab('deck')}
              className={`px-6 py-2 rounded-full transition-all ${activeTab === 'deck' ? 'bg-neon-lime text-void font-bold shadow-lg shadow-neon-lime/20' : 'bg-white/5 hover:bg-white/10'}`}
            >
              Pitch Deck Gen
            </button>
            <button 
              onClick={() => setActiveTab('tcg')}
              className={`px-6 py-2 rounded-full transition-all ${activeTab === 'tcg' ? 'bg-white text-void font-bold shadow-lg shadow-white/20' : 'bg-white/5 hover:bg-white/10'}`}
            >
              TCG Architect
            </button>
          </div>
        </header>

        <main>
          {activeTab === 'valuator' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-8">
                <section className="bg-white/5 border border-white/10 p-8 rounded-2xl glassmorphism">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <Shield className="text-neon-pink" /> 
                    "Brutally Honest" IP Valuation
                  </h2>
                  <div className="space-y-4">
                    <div className="p-6 bg-void border border-white/5 rounded-xl">
                      <p className="text-zinc-400">Upload your source code or project documentation for a triple-model triangulation analysis (Gemini + 2 Local Nodes).</p>
                    </div>
                    <button className="w-full py-4 bg-neon-pink text-void font-bold rounded-xl hover:scale-[1.02] transition-transform">
                      Initiate Valuation Cascade
                    </button>
                  </div>
                </section>
                
                <section className="grid grid-cols-2 gap-6">
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                    <h3 className="font-bold flex items-center gap-2 mb-4">
                      <TrendingUp className="text-neon-lime" size={18} />
                      Market Gaps Discovery
                    </h3>
                    <p className="text-sm text-zinc-500">Aura is currently monitoring 14 industry trends relevant to your stack.</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                    <h3 className="font-bold flex items-center gap-2 mb-4">
                      <Users className="text-neon-pink" size={18} />
                      Persona Targeting
                    </h3>
                    <p className="text-sm text-zinc-500">Recursive persona refinement based on current GitHub activity.</p>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-br from-neon-pink/20 to-neon-lime/20 border border-white/10 p-6 rounded-2xl">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Brain size={18} />
                    AI Sovereignty Status
                  </h3>
                  <div className="flex items-center gap-2 text-neon-lime">
                    <div className="w-2 h-2 rounded-full bg-neon-lime animate-pulse" />
                    <span className="text-xs font-mono uppercase tracking-widest">Local Fallback Active</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-4">All sensitive IP analysis is being routed through your local Ollama node.</p>
                </div>

                <div className="bg-white/5 border border-neon-pink p-6 rounded-2xl">
                  <h3 className="font-bold text-neon-pink mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    Valuation Gaps
                  </h3>
                  <ul className="text-xs space-y-3 text-zinc-400">
                    <li className="flex gap-2"><span>•</span> Lack of unified technical documentation</li>
                    <li className="flex gap-2"><span>•</span> High dependency on specific API versioning</li>
                    <li className="flex gap-2"><span>•</span> Undefined royalty distribution logic</li>
                  </ul>
                  <button className="w-full mt-6 py-2 text-xs border border-white/10 rounded-lg hover:bg-white/5">
                    Map to Repair Tasks
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tcg' && (
            <div className="bg-white/5 border border-white/10 p-8 rounded-2xl">
              <h2 className="text-2xl font-bold mb-8">Recursive TCG Architect</h2>
              <div className="grid grid-cols-4 gap-8">
                <div className="col-span-1 border border-white/5 p-4 rounded-xl space-y-4">
                  <div className="aspect-[3/4] bg-void border border-white/10 rounded-lg flex items-center justify-center text-zinc-600">
                    Image Placeholder
                  </div>
                  <input type="text" placeholder="Card Name" className="w-full bg-void border border-white/10 p-2 rounded text-sm" />
                  <textarea placeholder="Card Description" className="w-full bg-void border border-white/10 p-2 rounded text-sm h-32" />
                </div>
                <div className="col-span-3 space-y-6">
                  <div className="bg-void p-6 rounded-xl border border-white/5">
                    <h3 className="text-neon-lime font-bold mb-4">TCG Math Adherence Check</h3>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-neon-lime" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="py-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10">Run Balance Review</button>
                    <button className="py-4 bg-neon-lime text-void font-bold rounded-xl">Export Godot .tres</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </motion.div>
    </div>
  );
};

export default AuraStrategistPortal;
