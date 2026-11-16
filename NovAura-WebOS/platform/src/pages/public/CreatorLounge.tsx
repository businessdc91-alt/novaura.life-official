import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, AlertCircle, Upload, FileVideo, FileImage } from 'lucide-react';
import { AuraSpriteMatrix } from '@/components/ui/AuraSpriteMatrix';

const CreatorLounge: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [view, setView] = useState<'hall' | 'submit'>('hall');
  const [auraMood, setAuraMood] = useState<'neutral' | 'curious' | 'playful' | 'stern' | 'analytical'>('stern');

  return (
    <div className="min-h-screen bg-void text-white">
      <div className="max-w-7xl mx-auto p-8">
        <header className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white">
              CREATOR LOUNGE
            </h1>
            <p className="text-neon-pink font-mono text-sm uppercase tracking-[0.3em]">GeekFans • HackerTemptations</p>
          </div>
          <div className="flex gap-4">
            {!isVerified && (
              <button 
                onClick={() => setIsVerified(true)}
                className="flex items-center gap-2 px-6 py-2 bg-white text-void font-bold rounded-sm border-b-4 border-zinc-400 active:border-b-0 active:translate-y-1 transition-all"
              >
                <Camera size={18} /> VERIFY ID
              </button>
            )}
            <button 
              onClick={() => setView('submit')}
              className="flex items-center gap-2 px-6 py-2 bg-neon-pink text-void font-bold rounded-sm border-b-4 border-pink-700 active:border-b-0 active:translate-y-1 transition-all"
            >
              <Upload size={18} /> SUBMIT ASSETS
            </button>
          </div>
        </header>

        {!isVerified ? (
          <div className="bg-neon-pink/5 border border-neon-pink/20 p-12 rounded-2xl text-center space-y-6 flex flex-col items-center">
            <AuraSpriteMatrix mood={auraMood} size={160} />
            <div className="flex gap-2">
              {(['stern', 'curious', 'analytical'] as const).map(m => (
                <button 
                  key={m} 
                  onClick={() => setAuraMood(m)}
                  className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold border transition-all ${auraMood === m ? 'bg-neon-pink text-void border-neon-pink' : 'bg-void border-white/10 text-zinc-500 hover:border-neon-pink/50'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <h2 className="text-2xl font-bold">Age Verification Required</h2>
            <p className="max-w-md mx-auto text-zinc-400">
              Access to the Creator Lounge and HackerTemptations sub-areas requires 1-time photo ID verification to ensure platform safety and legal compliance.
            </p>
            <div className="max-w-lg mx-auto p-4 bg-void border border-white/5 rounded-lg text-xs text-zinc-500 text-left">
              <strong>Sovereign Shield Advisory:</strong> 
              - No minors or depictions of minors.
              - No non-consensual acts or extreme violence.
              - Violations trigger our recursive 4-strike protocol, leading to permanent erasure and authority reporting.
            </div>
            <button onClick={() => setIsVerified(true)} className="px-12 py-4 bg-white text-void font-black">START VERIFICATION</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <aside className="space-y-4">
              <nav className="space-y-1">
                {['Hentai', 'Doujinshi', 'X-Rated Games', 'Furry', 'Family Matters'].map((cat) => (
                  <button key={cat} className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors flex justify-between items-center group">
                    {cat}
                    <span className="text-zinc-600 group-hover:text-neon-pink">→</span>
                  </button>
                ))}
              </nav>
              <div className="p-4 bg-void border border-neon-pink/20 rounded-xl">
                <h3 className="text-xs font-bold text-neon-pink uppercase mb-2">Strike Status</h3>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="w-full h-1 bg-white/10 rounded-full" />
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">Zero active violations detected.</p>
              </div>
            </aside>

            <main className="md:col-span-3">
              <AnimatePresence mode="wait">
                {view === 'hall' ? (
                  <motion.div 
                    key="hall"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-2 md:grid-cols-3 gap-4"
                  >
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="aspect-square bg-white/5 rounded-xl border border-white/10 flex flex-col justify-end p-4 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-void to-transparent opacity-60" />
                        <div className="relative z-10">
                          <p className="text-xs font-bold">Concept Art #{i}</p>
                          <p className="text-[10px] text-zinc-500">Premium Gallery</p>
                        </div>
                        <div className="absolute top-2 right-2 p-2 bg-void/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileImage size={14} />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="submit"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/5 border border-white/10 p-8 rounded-2xl"
                  >
                    <div className="flex justify-between items-center mb-8">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Upload /> Asset Submission
                      </h2>
                      <button onClick={() => setView('hall')} className="text-xs text-zinc-500 hover:text-white">Cancel</button>
                    </div>
                    <div className="border-2 border-dashed border-white/10 p-12 rounded-xl text-center space-y-4 hover:border-neon-pink transition-colors cursor-pointer group">
                      <div className="w-16 h-16 bg-white/5 rounded-full mx-auto flex items-center justify-center text-zinc-500 group-hover:text-neon-pink">
                        <FileVideo size={32} />
                      </div>
                      <p className="text-sm font-medium">Drag & drop image or video batches</p>
                      <p className="text-xs text-zinc-500">MP4, PNG, JPG up to 500MB per file</p>
                    </div>
                    <div className="mt-8 space-y-4">
                      <div className="p-4 bg-void border border-white/5 rounded-xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-neon-pink">
                          <AlertCircle size={20} />
                        </div>
                        <div className="text-xs flex-1">
                          <p className="font-bold">Aura-Vision Consistency Scan</p>
                          <p className="text-zinc-500">Assets will be scanned for legal safety and character theme accuracy.</p>
                        </div>
                        <div className="w-4 h-4 rounded-full border-2 border-neon-lime" />
                      </div>
                      <button className="w-full py-4 bg-neon-pink text-void font-bold rounded-sm">INITIATE UPLOAD & SCAN</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorLounge;
