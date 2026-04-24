import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  User, Sparkles, Wand2, Scissors, Play, Pause, 
  Download, Save, RefreshCw, Layers, Monitor, 
  ChevronRight, Trash2, Loader2, Image as ImageIcon,
  Ghost, Wind, Zap, Smile
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { toast } from 'sonner';
import axios from 'axios';
import { generateImage, BACKEND_URL, getAuthHeaders } from '../../services/aiService';
import { saveAvatar as dbSaveAvatar, getUserAvatars, deleteAvatar as dbDeleteAvatar } from '../../services/assetService';
import { kernel } from '../../kernel/NovaKernel.js';

/**
 * AURA AVATAR STUDIO
 * A high-end production environment for generating, processing, and animating AI avatars.
 */

const STAGES = [
  { id: 'void', name: 'The Void', bg: 'bg-slate-950' },
  { id: 'neon', name: 'Cyberpunk Alley', bg: 'bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900' },
  { id: 'zen', name: 'Zen Garden', bg: 'bg-gradient-to-br from-emerald-900 to-teal-900' },
  { id: 'plasma', name: 'Neural Plasma', bg: 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900 via-slate-950 to-black' }
];

const BEHAVIORS = {
  serene: { name: 'Serene', float: 2, breathe: 0.02, blinkRate: 0.05 },
  curious: { name: 'Curious', float: 5, breathe: 0.05, blinkRate: 0.1 },
  energetic: { name: 'Energetic', float: 12, breathe: 0.1, blinkRate: 0.2 },
  phantom: { name: 'Phantom', float: 20, breathe: 0.15, blinkRate: 0.01 }
};

export default function AuraAvatarStudio() {
  // --- State ---
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState(null); // The raw generated image
  const [processedImage, setProcessedImage] = useState(null); // Transparent PNG
  const [isAutoRemove, setIsAutoRemove] = useState(true);
  
  const [behavior, setBehavior] = useState('serene');
  const [stage, setStage] = useState('void');
  const [isAnimating, setIsAnimating] = useState(true);
  const [zoom, setZoom] = useState(1);
  
  const [savedAvatars, setSavedAvatars] = useState([]);
  const [isVaultLoading, setIsVaultLoading] = useState(false);

  // Load avatars from permanent storage on mount
  useEffect(() => {
    const loadVault = async () => {
      const uid = kernel.auth?.uid;
      if (!uid) return;
      setIsVaultLoading(true);
      const avatars = await getUserAvatars(uid);
      setSavedAvatars(avatars);
      setIsVaultLoading(false);
    };
    loadVault();
  }, []);

  // --- Animation Loop ---
  const [animState, setAnimState] = useState({ y: 0, scale: 1, opacity: 1 });
  const requestRef = useRef();
  
  const animate = useCallback((time) => {
    if (isAnimating) {
      const b = BEHAVIORS[behavior];
      const floatY = Math.sin(time / 1000) * b.float;
      const breatheScale = 1 + Math.sin(time / 2000) * b.breathe;
      
      setAnimState({
        y: floatY,
        scale: breatheScale,
        opacity: 1
      });
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isAnimating, behavior]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  // --- Core Actions ---

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt for your avatar');
      return;
    }

    setIsGenerating(true);
    setCurrentImage(null);
    setProcessedImage(null);

    try {
      // Enhance prompt for better avatar quality
      const enhancedPrompt = `High quality professional character portrait, ${prompt}, centered, solid background, highly detailed, 8k resolution, cinematic lighting`;
      
      const { imageUrl } = await generateImage(enhancedPrompt, '1:1');
      setCurrentImage(imageUrl);
      toast.success('Avatar generated successfully!');

      if (isAutoRemove) {
        await handleRemoveBackground(imageUrl);
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate avatar');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveBackground = async (imageSource) => {
    if (!imageSource) return;
    setIsProcessing(true);
    
    try {
      // Convert to base64 if it's a URL (Backend typically wants base64)
      let base64;
      if (imageSource.startsWith('data:')) {
        base64 = imageSource.split(',')[1];
      } else {
        // Fetch URL and convert to blob then base64
        const response = await fetch(imageSource);
        const blob = await response.blob();
        base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const res = await axios.post(`${BACKEND_URL}/api/remove-background`, {
        image: base64
      }, {
        headers: getAuthHeaders(),
        timeout: 45000
      });

      if (res.data.result) {
        setProcessedImage(`data:image/png;base64,${res.data.result}`);
        toast.success('Background removed! Avatar is now "Living".');
      }
    } catch (error) {
      console.error('Background removal error:', error);
      toast.error('Could not automate background removal');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveAvatar = async () => {
    const uid = kernel.auth?.uid;
    if (!uid) {
      toast.error('You must be logged in to save to the vault');
      return;
    }

    const avatarData = {
      name: prompt.slice(0, 20) || 'New Avatar',
      image: processedImage || currentImage,
      behavior,
      stage,
      createdAt: new Date().toISOString()
    };
    
    const saved = await dbSaveAvatar(uid, avatarData);
    if (saved) {
      setSavedAvatars([saved, ...savedAvatars]);
      toast.success('Avatar successfully bonded to your cloud identity');
    } else {
      toast.error('Failed to save to cloud vault');
    }
  };

  const deleteAvatar = async (id) => {
    const uid = kernel.auth?.uid;
    if (!uid) return;

    const success = await dbDeleteAvatar(uid, id);
    if (success) {
      setSavedAvatars(savedAvatars.filter(a => a.id !== id));
      toast.success('Entity purged from vault');
    }
  };

  // --- UI Components ---

  return (
    <div className="h-full flex flex-col bg-[#050508] text-white overflow-hidden select-none">
      {/* Studio Header */}
      <div className="h-14 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">AURA AVATAR STUDIO</h1>
            <p className="text-[10px] text-cyan-400/70 font-mono tracking-widest uppercase">Neural Design Pipeline</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))} className="h-7 w-7 p-0"><ChevronRight className="w-3 h-3 rotate-180" /></Button>
          <span className="text-[10px] font-mono text-white/40">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="h-7 w-7 p-0"><ChevronRight className="w-3 h-3" /></Button>
          <div className="w-px h-4 bg-white/10 mx-2" />
          <Button variant="outline" size="sm" onClick={saveAvatar} disabled={!currentImage} className="h-8 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 gap-2">
            <Save className="w-3.5 h-3.5" /> Save to Vault
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Control Panel */}
        <div className="w-80 border-r border-white/5 bg-black/20 backdrop-blur-md p-5 flex flex-col gap-6 overflow-y-auto">
          {/* Generation Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Genesis</h2>
              <Zap className="w-3 h-3 text-yellow-400" />
            </div>
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your avatar entity..."
                className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-xs resize-none focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-white/20"
              />
              <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 pointer-events-none rounded-xl transition-opacity" />
            </div>
            
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div 
                  className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${isAutoRemove ? 'bg-cyan-600' : 'bg-white/10'}`}
                  onClick={() => setIsAutoRemove(!isAutoRemove)}
                >
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isAutoRemove ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-[10px] text-white/60">Auto-Remove Background</span>
              </div>
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || isProcessing}
              className="w-full h-10 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-900/20"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
              {isGenerating ? 'GENESIZING...' : 'GENERATE ENTITY'}
            </Button>
          </section>

          {/* Behavior Section */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Neural Behavior</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(BEHAVIORS).map(([id, info]) => (
                <button
                  key={id}
                  onClick={() => setBehavior(id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    behavior === id 
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.1)]' 
                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase mb-1">{info.name}</div>
                  <div className="text-[8px] opacity-60">Ambient Life</div>
                </button>
              ))}
            </div>
          </section>

          {/* Environmental Stage */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Environment</h2>
            <div className="grid grid-cols-1 gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStage(s.id)}
                  className={`px-4 py-2 rounded-lg border text-xs flex items-center justify-between transition-all ${
                    stage === s.id 
                    ? 'bg-white/10 border-white/20 text-white' 
                    : 'bg-transparent border-transparent text-white/40 hover:bg-white/5'
                  }`}
                >
                  {s.name}
                  <div className={`w-2 h-2 rounded-full ${s.bg}`} />
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Main View: The Stage */}
        <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
          {/* Stage Background */}
          <div className={`absolute inset-0 transition-colors duration-1000 ${STAGES.find(s => s.id === stage).bg}`}>
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '40px 40px'
            }} />
          </div>

          {/* The Avatar Entity */}
          <div 
            className="relative z-10 transition-transform duration-300 ease-out flex items-center justify-center"
            style={{ transform: `scale(${zoom})` }}
          >
            {isProcessing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-full aspect-square border border-cyan-500/20">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Stripping Background...</span>
              </div>
            )}

            {(processedImage || currentImage) ? (
              <div 
                className="relative"
                style={{
                  transform: `translateY(${animState.y}px) scale(${animState.scale})`,
                  opacity: animState.opacity,
                  transition: isProcessing ? 'none' : 'transform 0.1s linear'
                }}
              >
                <img 
                  src={processedImage || currentImage} 
                  alt="Avatar Entity"
                  className={`max-w-[400px] max-h-[400px] object-contain drop-shadow-[0_0_50px_rgba(0,255,255,0.2)] ${!processedImage ? 'rounded-3xl border-2 border-white/10' : ''}`}
                />
                
                {/* Visual Glow Layer */}
                {processedImage && (
                  <div className="absolute inset-0 bg-cyan-500/10 mix-blend-overlay blur-3xl rounded-full opacity-30 animate-pulse" />
                )}
              </div>
            ) : (
              <div className="w-64 h-80 rounded-[40px] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-4 text-white/10">
                <Ghost className="w-16 h-16" />
                <span className="text-xs font-mono uppercase tracking-widest">Waiting for Genesis</span>
              </div>
            )}
          </div>

          {/* Stage Controls Overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
            <button onClick={() => setIsAnimating(!isAnimating)} className="p-2 hover:text-cyan-400 transition-colors">
              {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button onClick={() => handleRemoveBackground(currentImage)} disabled={!currentImage || isProcessing} className="p-2 hover:text-cyan-400 transition-colors disabled:opacity-30">
              <Scissors className="w-4 h-4" />
            </button>
            <button onClick={() => {
              const link = document.createElement('a');
              link.href = processedImage || currentImage;
              link.download = `avatar-${Date.now()}.png`;
              link.click();
            }} disabled={!currentImage} className="p-2 hover:text-cyan-400 transition-colors disabled:opacity-30">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Panel: Vault / History */}
        <div className="w-64 border-l border-white/5 bg-black/40 backdrop-blur-xl p-4 flex flex-col gap-4 overflow-hidden shrink-0">
          <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3 h-3" /> Avatar Vault
          </h2>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
            {isVaultLoading ? (
              <div className="h-40 flex flex-col items-center justify-center text-white/10 gap-2">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-[9px] uppercase font-mono">Syncing Vault...</span>
              </div>
            ) : savedAvatars.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-white/10 gap-2">
                <ImageIcon className="w-8 h-8" />
                <span className="text-[9px] uppercase font-mono">Vault Empty</span>
              </div>
            ) : (
              savedAvatars.map((s) => (
                <div key={s.id} className="group relative bg-white/5 border border-white/5 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-all cursor-pointer"
                  onClick={() => {
                    setProcessedImage(s.image);
                    setBehavior(s.behavior);
                    setStage(s.stage);
                  }}>
                  <img src={s.image} alt={s.name} className="w-full aspect-square object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="p-2 bg-black/60 backdrop-blur-md">
                    <div className="text-[9px] font-bold truncate">{s.name}</div>
                    <div className="text-[8px] text-white/40">{new Date(s.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteAvatar(s.id); }}
                    className="absolute top-1 right-1 p-1.5 bg-black/80 rounded-lg opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-auto pt-4 border-t border-white/5">
            <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Wind className="w-3 h-3 text-cyan-400" />
                <span className="text-[9px] font-bold text-cyan-300 uppercase">Pro Tip</span>
              </div>
              <p className="text-[9px] text-white/40 leading-relaxed italic">
                Use behaviors like "Energetic" for action-based avatars, or "Serene" for peaceful companions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
