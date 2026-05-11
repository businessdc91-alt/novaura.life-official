import React, { useState } from 'react';
import { BookOpen, Headphones, Play, Download, X, Music, RefreshCw, Sparkles } from 'lucide-react';
import { useLiterature } from './LiteratureContext';

export default function EbookPublisherModal({ isOpen, onClose }) {
  const { activeFile } = useLiterature();
  const [step, setStep] = useState('config'); // config, processing, ready
  const [options, setOptions] = useState({
    voice: 'nova',
    music: 'ambient_1',
    format: 'epub'
  });

  if (!isOpen) return null;

  const handleGenerate = () => {
    setStep('processing');
    setTimeout(() => {
      setStep('ready');
    }, 3000); // Mock processing time
  };

  const handleReset = () => {
    setStep('config');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f0f1a] border border-white/10 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#141425]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-gray-200">eBook & Audiobook Studio</h2>
          </div>
          <button onClick={handleReset} className="p-1 text-gray-500 hover:text-white rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex-1 text-gray-300">
          {step === 'config' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-400">Transform your manuscript into a fully immersive interactive eBook with text-to-speech and dynamic background music.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Narrator Voice (TTS)</label>
                  <select 
                    value={options.voice} 
                    onChange={e => setOptions({...options, voice: e.target.value})}
                    className="w-full bg-[#0a0a14] border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="nova">Aura (Female, Expressive)</option>
                    <option value="echo">Echo (Male, Deep)</option>
                    <option value="fable">Fable (British, Storyteller)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Background Music (Generated)</label>
                  <select 
                    value={options.music} 
                    onChange={e => setOptions({...options, music: e.target.value})}
                    className="w-full bg-[#0a0a14] border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ambient_1">Cinematic Ambient (Sci-Fi)</option>
                    <option value="fantasy_1">Tavern Strings (Fantasy)</option>
                    <option value="none">No Music</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <RefreshCw className="w-12 h-12 text-primary animate-spin" />
              <p className="text-sm font-bold text-gray-200">Synthesizing Audio & Compiling...</p>
              <p className="text-xs text-gray-500 max-w-[250px]">The AI is generating speech and mixing the background tracks for '{activeFile?.name || 'Untitled'}'.</p>
            </div>
          )}

          {step === 'ready' && (
            <div className="py-8 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Headphones className="w-10 h-10 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-400 mb-1">eBook Ready!</h3>
                <p className="text-sm text-gray-400">Your immersive experience is compiled.</p>
              </div>
              <div className="flex gap-4">
                <button className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-full font-bold hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                  <Play className="w-4 h-4" /> Listen Now
                </button>
                <button className="flex items-center gap-2 px-6 py-2 bg-white/5 border border-white/10 text-white rounded-full font-bold hover:bg-white/10 transition-all">
                  <Download className="w-4 h-4" /> Download .epub
                </button>
              </div>
            </div>
          )}
        </div>

        {step === 'config' && (
          <div className="p-4 border-t border-white/5 bg-[#141425] flex justify-end">
            <button 
              onClick={handleGenerate}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-full font-bold hover:bg-primary/90 transition-all"
            >
              <Sparkles className="w-4 h-4" /> Generate eBook
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
