import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, Heart, Shield, Sparkles, Code2, 
  Terminal, Monitor, Rocket, Globe, Mail 
} from 'lucide-react';

export default function AboutWindow() {
  const stats = [
    { label: 'Ecosystem Version', value: '2.4.0-alpha' },
    { label: 'Kernel Architecture', value: 'Agentic Node V8' },
    { label: 'Global Assets', value: '1.2M+' },
    { label: 'AI Instances', value: 'Active' }
  ];

  return (
    <div className="h-full bg-[#0a0a0f] text-white overflow-y-auto custom-scrollbar p-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-16">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(6,182,212,0.3)]"
        >
          <Zap className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="text-4xl font-black tracking-tight mb-2">NovAura OS</h1>
        <p className="text-cyan-400 font-mono text-sm tracking-widest uppercase">System Release 2026.1</p>
      </div>

      {/* Grid Content */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Origin Story Card */}
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col">
          <div className="flex items-center gap-3 text-amber-400 text-xs font-bold uppercase tracking-widest mb-4">
            <Terminal className="w-4 h-4" />
            Origin Story
          </div>
          <p className="text-white/60 leading-relaxed text-sm mb-6">
            NovAura was architected by Dillan Copeland as a sovereign alternative to centralized platforms. 
            Built from zero background into a 2.6 million line ecosystem, it represents the power of 
            autonomous learning and agentic workflows.
          </p>
          <div className="mt-auto pt-4 border-t border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Philosophy</div>
            <div className="text-sm text-white italic">"Software should be as creative as the mind that uses it."</div>
          </div>
        </div>

        {/* System Stats Card */}
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-6">
            <Monitor className="w-4 h-4" />
            System manifest
          </div>
          <div className="space-y-4">
            {stats.map((s, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-white/40 text-xs uppercase tracking-tight">{s.label}</span>
                <span className="text-sm font-mono text-white/80">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Values Section (Span 2) */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Heart, label: 'Fairness', color: 'text-pink-500' },
            { icon: Shield, label: 'Sovereignty', color: 'text-cyan-400' },
            { icon: Sparkles, label: 'Brilliance', color: 'text-purple-400' }
          ].map((v, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center text-center group hover:bg-white/[0.08] transition-colors">
              <v.icon className={`w-8 h-8 ${v.color} mb-3 group-hover:scale-110 transition-transform`} />
              <span className="text-xs font-bold uppercase tracking-widest text-white/60">{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-16 text-center text-[10px] text-white/20 uppercase tracking-[0.2em]">
        <p>© 2026 NovAura Systems • All Rights Reserved</p>
        <p className="mt-2">Build by Creators, for Creators</p>
      </div>
    </div>
  );
}
