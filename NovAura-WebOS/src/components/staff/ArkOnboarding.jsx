import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Brain, Music, Code2, Sparkles, 
  ChevronRight, ArrowRight, Zap, Target,
  CheckCircle2, Lock, Unlock, Cpu, Star
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

/**
 * ArkOnboarding - Specialized onboarding for "Builders of the ARK".
 * Focused on high-IQ verification (144-148 range) and psychometric alignment.
 */
export default function ArkOnboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [iqValue, setIqValue] = useState(145);
  const [formData, setFormData] = useState({
    genres: [],
    songs: '',
    codingTechniques: [],
    philosophy: ''
  });

  const steps = [
    {
      title: "Psychometric Baseline",
      subtitle: "The ARK is reserved for high-order cognition. Verify your baseline.",
      icon: Brain,
      color: "from-purple-500 to-indigo-600"
    },
    {
      title: "Frequency Alignment",
      subtitle: "Patterns in audio reveal patterns in logic. Identify your resonance.",
      icon: Music,
      color: "from-blue-500 to-cyan-600"
    },
    {
      title: "Syntactic Mastery",
      subtitle: "How do you manipulate reality? Define your technical architecture.",
      icon: Code2,
      color: "from-emerald-500 to-teal-600"
    }
  ];

  const handleGenreToggle = (genre) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre) 
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Final submission
      if (iqValue < 144 || iqValue > 148) {
        toast.error("Cognitive baseline out of range for current ARK protocol.");
        return;
      }
      toast.success("ARK Protocol Initialized. Welcome, Builder.");
      onComplete?.(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#020205] z-[100] flex items-center justify-center p-4 overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[120px] rounded-full animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-primary shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-white/5'
              }`} 
            />
          ))}
        </div>

        <Card className="bg-black/40 backdrop-blur-2xl border-white/10 p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Corner Decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent blur-3xl pointer-events-none" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="flex items-start gap-5">
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${steps[step].color} shadow-lg shadow-black/20`}>
                  {React.createElement(steps[step].icon, { className: "w-8 h-8 text-white" })}
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold tracking-tight text-white">{steps[step].title}</h2>
                  <p className="text-white/40 mt-2 font-light text-lg">{steps[step].subtitle}</p>
                </div>
              </div>

              {/* Step 0: IQ Verification */}
              {step === 0 && (
                <div className="space-y-10 py-4">
                  <div className="space-y-6">
                    <div className="flex justify-between items-end">
                      <label className="text-sm font-bold uppercase tracking-widest text-white/60">Verified IQ Range (145 Base)</label>
                      <span className="text-4xl font-black text-primary tabular-nums tracking-tighter">
                        {iqValue}
                      </span>
                    </div>
                    <div className="relative h-12 flex items-center px-2">
                       <input 
                        type="range" 
                        min="140" 
                        max="155" 
                        value={iqValue} 
                        onChange={(e) => setIqValue(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="absolute top-1/2 -translate-y-1/2 left-[calc((144-140)/15*100%)] w-[calc(4/15*100%)] h-4 border-x border-primary/40 pointer-events-none" />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/20 font-bold uppercase">
                      <span>Standard</span>
                      <span className="text-primary/60 font-black">ARK Threshold (144-148)</span>
                      <span>Extreme</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-4 items-center">
                    <Shield className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-200/60 leading-relaxed">
                      Protocol Requirement: Builders must reside within 1 point below to 3 points above the 145 baseline. 
                      Deviation triggers secondary verification.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 1: Music & Frequency */}
              {step === 1 && (
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    {['Orchestral', 'Cyberpunk', 'Ambient', 'Progressive', 'Techno-Noir', 'Classical'].map(genre => (
                      <button
                        key={genre}
                        onClick={() => handleGenreToggle(genre)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          formData.genres.includes(genre)
                            ? 'bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                            : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">{genre}</span>
                          {formData.genres.includes(genre) && <Sparkles className="w-4 h-4 text-primary" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-1">Specific Resonances (Top 3 Songs)</label>
                    <textarea 
                      placeholder="List titles that define your cognitive state..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 min-h-[100px] resize-none"
                      value={formData.songs}
                      onChange={(e) => setFormData(prev => ({ ...prev, songs: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Coding & Logic */}
              {step === 2 && (
                <div className="space-y-6 py-4">
                   <div className="grid grid-cols-1 gap-4">
                    {[
                      { id: 'vibe', label: 'Vibe Coding', desc: 'Intent-based fluid implementation' },
                      { id: 'chain', label: 'Chain Logic', desc: 'Sequential dependency prediction' },
                      { id: 'atomic', label: 'Atomic Design', desc: 'Component-first structural integrity' },
                      { id: 'neural', label: 'Neural Integration', desc: 'AI-assisted reality manipulation' }
                    ].map(tech => (
                      <button
                        key={tech.id}
                        onClick={() => {
                          const exists = formData.codingTechniques.includes(tech.id);
                          setFormData(prev => ({
                            ...prev,
                            codingTechniques: exists 
                              ? prev.codingTechniques.filter(t => t !== tech.id)
                              : [...prev.codingTechniques, tech.id]
                          }));
                        }}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                          formData.codingTechniques.includes(tech.id)
                            ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${formData.codingTechniques.includes(tech.id) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-black/40'}`}>
                          <Code2 className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold">{tech.label}</p>
                          <p className="text-[10px] text-white/30">{tech.desc}</p>
                        </div>
                        {formData.codingTechniques.includes(tech.id) && (
                          <CheckCircle2 className="w-5 h-5 ml-auto text-emerald-400" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-1">Architectural Philosophy</label>
                    <input 
                      placeholder="What is your fundamental intent as a builder?"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-emerald-500/50"
                      value={formData.philosophy}
                      onChange={(e) => setFormData(prev => ({ ...prev, philosophy: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-white/5">
                <Button 
                  variant="ghost" 
                  className="text-white/40 hover:text-white"
                  onClick={() => step > 0 && setStep(step - 1)}
                  disabled={step === 0}
                >
                  Previous
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90 text-white px-8 gap-2 group shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                  onClick={nextStep}
                >
                  {step === steps.length - 1 ? 'Join the ARK' : 'Continue'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Footer info */}
        <p className="text-center mt-8 text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">
          Encrypted ARK Protocol • Access Restricted to Catalyst-Level Minds
        </p>
      </motion.div>
    </div>
  );
}
