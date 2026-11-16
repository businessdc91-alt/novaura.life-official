import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  Upload, 
  DollarSign, 
  Check,
  File,
  X,
  Layers,
  Search as SearchIcon,
  Sparkles,
  Zap,
  Wand2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { createAsset, generateId, createSlug, getAssetById, uploadAssetFile } from '@/services/marketService';
import type { BackgroundRemovalResult } from '@/services/artStudioServices';
import { BackgroundRemovalModal } from '@/components/art/BackgroundRemovalModal';
import type { LicenseTier, EngineType, Complexity, Asset, PricingType, AssetType } from '@/types';

const steps = [
  { icon: Upload, label: 'Files & Media' },
  { icon: File, label: 'Basic Info' },
  { icon: Layers, label: 'Foundations' },
  { icon: DollarSign, label: 'Pricing' },
  { icon: Check, label: 'Review' },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024 * 1024; // 50GB

const licenseOptions: { 
  value: LicenseTier; 
  label: string; 
  description: string; 
  royalty: string;
  examples: string;
  color: string;
}[] = [
  { 
    value: 'art_3pct', 
    label: 'Standard Assets (3%)', 
    description: 'Individual art, sprites, or components used to build scenes.',
    royalty: '3%',
    examples: 'Single character, texture pack, SFX, background music',
    color: 'text-neon-lime'
  },
  { 
    value: 'integration_10pct', 
    label: 'Deep Integration (10%)', 
    description: '>80% overworld assets, >50% scene usage, all characters, or barebone logic templates.',
    royalty: '10%',
    examples: 'Complete art pack, full character roster, logic framework',
    color: 'text-neon-cyan'
  },
  { 
    value: 'functional_15pct', 
    label: 'Functional Game (15%)', 
    description: 'Playable base including graphics, sound, player controls, and characters for modification.',
    royalty: '15%',
    examples: 'Complete mechanics prototype to be heavily customized',
    color: 'text-neon-violet'
  },
  { 
    value: 'source_20pct', 
    label: 'Full Source Code (20%)', 
    description: 'Game projects, engine templates, or extensive mechanics where the buyer gets full project files.',
    royalty: '20%',
    examples: 'Full Godot project, complete Unity template',
    color: 'border-[#ff00ff] text-[#ff00ff] bg-[#ff00ff]/10 shadow-[0_0_15px_rgba(255,0,255,0.3)]'
  },
  { 
    value: 'opensource', 
    label: 'Open Source', 
    description: 'MIT/Apache licensed - free to use with proper attribution',
    royalty: 'Citation only',
    examples: 'Community tools, educational resources, MIT libraries',
    color: 'text-text-muted'
  },
];

export default function CreatorUpload() {
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const { user } = useAuthStore();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form data
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('dev_asset');
  const [category, setCategory] = useState('');
  const [tags] = useState('');
  const [contentRating, setContentRating] = useState<ContentRating>('safe');
  const [engineType, setEngineType] = useState<EngineType>('godot');
  const [complexity, setComplexity] = useState<Complexity>('intermediate');
  const [licenseTier, setLicenseTier] = useState<LicenseTier>('art_3pct');
  const [pricingType, setPricingType] = useState<PricingType>('fixed');
  const [price, setPrice] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  // Royalty & Foundations
  const [foundationAssets, setFoundationAssets] = useState<string[]>([]);
  const [revenueSplits, setRevenueSplits] = useState<{ userId: string, username: string, percentage: number, role: 'collaborator' }[]>([]);
  const [foundationSearch, setFoundationSearch] = useState('');
  const [purchasedAssets, setPurchasedAssets] = useState<Asset[]>([]);
  
  // Phase 3: Load purchased assets for lineage suggestions
  useEffect(() => {
    if (user?.purchasedAssetIds) {
      const loadPurchased = async () => {
        const assets = await Promise.all(user.purchasedAssetIds!.map(id => getAssetById(id)));
        setPurchasedAssets(assets.filter((a): a is Asset => !!a));
      };
      loadPurchased();
    }
  }, [user]);

  // Phase 3: Fair Stake Simulation logic
  const calculateStakePreview = () => {
    // Collect all royalties from foundations
    const foundationRoyalties = purchasedAssets
      .filter(a => foundationAssets.includes(a.id))
      .map(a => {
        switch (a.licenseTier) {
          case 'art_3pct': return 3;
          case 'music_1pct': return 1;
          case 'integration_10pct': return 10;
          case 'functional_15pct': return 15;
          case 'source_20pct': return 20;
          default: return 0;
        }
      });

    const collabRoyalties = revenueSplits.map(s => s.percentage);
    const totalExternal = [...foundationRoyalties, ...collabRoyalties].reduce((a, b) => a + b, 0);
    
    // Scale if > 50%
    if (totalExternal > 50) {
      return { stakeholder: 50, external: 50, scaled: true };
    }
    return { stakeholder: 100 - totalExternal, external: totalExternal, scaled: false };
  };

  const stakePreview = calculateStakePreview();

  // File uploads
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [screenshots] = useState<string[]>([]);
  const [assetFile, setAssetFile] = useState<File | null>(null);
  
  // Background removal modal
  const [showBgRemoval, setShowBgRemoval] = useState(false);
  const [processedThumbnail, setProcessedThumbnail] = useState<string | null>(null);
  
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const assetFileInputRef = useRef<HTMLInputElement>(null);

  const handleBgRemovalComplete = (result: BackgroundRemovalResult) => {
    setProcessedThumbnail(result.processedImage);
    setThumbnail(result.processedImage);
    addToast({
      type: 'success',
      title: 'Background Removed',
      message: 'Your image has been processed successfully.'
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setThumbnail(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAssetFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        addToast({ 
          type: 'error', 
          title: 'File too large', 
          message: 'The asset exceeds the 50GB production limit. Please optimize or contact support for shard-based uploads.' 
        });
        return;
      }
      setAssetFile(file);
      
      // AI Prefill Logic
      setIsAnalyzing(true);
      
      // 1. Prefill Title from Filename
      const cleanName = file.name
        .replace(/\.[^/.]+$/, "") // Remove extension
        .replace(/[_\-]/g, " ")     // Replace underscores/hyphens with spaces
        .split(' ')                 // Capitalize
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      setTitle(cleanName);

      // 2. Simulate "Static Reading" AI analysis
      setTimeout(() => {
        setShortDescription(`A high-performance ${file.name.split('.').pop()?.toUpperCase()} asset for production-scale ecosystems.`);
        setDescription(`The ${cleanName} package is a professional-grade solution designed for the NovAura ecosystem. \n\nFeatures include:\n- Optimised for high-tier performance\n- Production-ready architecture\n- Seamless integration with existing foundations`);
        setIsAnalyzing(false);
        addToast({ 
          type: 'info', 
          title: 'Aura Analysis Complete', 
          message: 'I have prefilled the metadata based on your file contents.'
        });
      }, 1500);
    }
  };

  const handleSubmit = async () => {
    if (!agreeTerms || !user || !assetFile) return;
    setIsSubmitting(true);

    try {
      // Step 1: Upload main file directly to storage (handles >50MB)
      const { path: mainFilePath } = await uploadAssetFile(assetFile, `assets/${user.id}`, (progress) => {
        setUploadProgress(progress);
      });

      // Convert thumbnail to base64 if present (usually small, so this is okay)
      let thumbnailData = null;
      if (thumbnail) {
        const thumbBase64 = thumbnail.split(',')[1];
        const thumbType = thumbnail.split(';')[0].split(':')[1];
        thumbnailData = { name: 'thumbnail.jpg', type: thumbType, base64: thumbBase64 };
      }

      const payload = {
        creatorId: user.id,
        title,
        description,
        shortDescription,
        category,
        assetType,
        engineType,
        complexity,
        contentRating,
        licenseTier,
        price: licenseTier === 'opensource' ? 0 : Math.round(parseFloat(price || '0') * 100),
        tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        foundationAssets,
        revenueSplits: revenueSplits.map(s => ({ ...s, role: 'collaborator' })),
        // Send storage path instead of base64
        mainFilePath,
        mainFileName: assetFile.name,
        mainFileSize: assetFile.size,
        mainFileType: assetFile.type || 'application/octet-stream',
        thumbnailData,
      };

      const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'https://novaura.life/api').replace(/\/$/, '');
      const authToken = await (window as any).firebase?.auth?.()?.currentUser?.getIdToken?.();

      const response = await fetch(`${BACKEND_URL}/assets/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      addToast({ type: 'success', title: 'Asset submitted!', message: 'Your asset is in review. You\'ll be notified when it goes live.' });
      navigate('/creator/assets');
    } catch (error: any) {
      addToast({ type: 'error', title: 'Upload failed', message: error.message || 'Failed to submit asset. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return assetFile !== null && !isAnalyzing;
      case 1: return title && shortDescription && category;
      case 2: return true;
      case 3: 
        if (!licenseTier) return false;
        if (pricingType === 'fixed') return !!price;
        if (pricingType === 'donation') return !!minPrice && !!suggestedPrice;
        return true; // Free
      case 4: return agreeTerms;
      default: return true;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">Upload New Asset</h1>
        <p className="text-text-secondary italic">"Fuel the next generation of creative masterpieces."</p>
      </div>

      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <div key={step.label} className="flex items-center flex-shrink-0">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isActive ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30' : isCompleted ? 'bg-neon-lime/10 text-neon-lime' : 'bg-void-light text-text-muted'}`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && <ChevronRight className="w-4 h-4 text-text-muted mx-2" />}
            </div>
          );
        })}
      </div>

      <div className="bg-void-light border border-white/5 rounded-xl p-8 mb-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Sparkles className="w-32 h-32 text-neon-cyan rotate-12" />
        </div>

        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h2 className="font-heading text-xl font-bold text-text-primary">Files & Media</h2>
              <div onClick={() => !isAnalyzing && assetFileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${assetFile ? 'border-neon-cyan/50 bg-neon-cyan/5' : 'border-white/10 hover:border-neon-cyan/30'} cursor-pointer relative overflow-hidden`}>
                {isAnalyzing ? (
                  <div className="space-y-4">
                    <Zap className="w-12 h-12 text-neon-cyan mx-auto animate-pulse" />
                    <p className="text-neon-cyan font-bold animate-pulse uppercase tracking-[0.2em]">Static Reading in Progress...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-text-muted mx-auto mb-4" />
                    <p className="text-text-primary font-medium">{assetFile ? assetFile.name : 'Upload Source ZIP (max 50GB)'}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mt-2">{assetFile ? 'Click to change file' : 'Prefills metadata automatically'}</p>
                  </>
                )}
                <input type="file" ref={assetFileInputRef} onChange={handleAssetFileUpload} className="hidden" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div onClick={() => thumbnailInputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center cursor-pointer hover:border-white/20">
                    {thumbnail ? <img src={thumbnail} className="h-20 mx-auto rounded" alt="Preview"/> : <p className="text-sm text-text-muted">Upload Thumbnail</p>}
                    <input type="file" ref={thumbnailInputRef} onChange={handleThumbnailUpload} className="hidden" accept="image/*" />
                  </div>
                  {thumbnail && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBgRemoval(true)}
                      className="w-full border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Remove Background
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Background Removal Modal */}
              <BackgroundRemovalModal
                isOpen={showBgRemoval}
                onClose={() => setShowBgRemoval(false)}
                imageUrl={thumbnail || ''}
                onProcessed={handleBgRemovalComplete}
              />
            </motion.div>
          )}

          {currentStep === 1 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold text-text-primary">Basic Information</h2>
                {assetFile && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-neon-cyan/10 border border-neon-cyan/30 rounded-full text-neon-cyan text-[10px] font-bold">
                    <Sparkles className="w-3 h-3" />
                    AI PREFILLED
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="relative group">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Asset Title" className="py-6 bg-void border-white/10 focus:border-neon-cyan/50" />
                  {assetFile && <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-cyan/30" />}
                </div>
                <div className="relative group">
                  <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Tagline (max 140 chars)" maxLength={140} className="py-6 bg-void border-white/10 focus:border-neon-cyan/50" />
                  {assetFile && <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-cyan/30" />}
                </div>
                <div className="relative group">
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Full description..." rows={6} className="bg-void border-white/10 focus:border-neon-cyan/50 resize-none" />
                  {assetFile && <Sparkles className="absolute right-4 top-4 w-4 h-4 text-neon-cyan/30" />}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Asset Genre</label>
                    <select 
                      value={assetType} 
                      onChange={(e) => setAssetType(e.target.value as AssetType)} 
                      className="w-full bg-void border border-white/10 rounded-xl p-4 text-text-primary outline-none focus:border-neon-cyan/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="avatar">Avatar (VRM/Character)</option>
                      <option value="animation">Animation</option>
                      <option value="dev_asset">3D Model / 2D Asset</option>
                      <option value="vfx">VFX & Particles</option>
                      <option value="environment">Environment & Nature</option>
                      <option value="audio">Audio & Music</option>
                      <option value="ui">UI & HUD</option>
                      <option value="game">Playable Game</option>
                      <option value="software">Software & Tools</option>
                      <option value="writing">Writing & Lore</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Maturity Level</label>
                    <select 
                      value={contentRating} 
                      onChange={(e) => setContentRating(e.target.value as ContentRating)} 
                      className="w-full bg-void border border-white/10 rounded-xl p-4 text-text-primary outline-none focus:border-neon-cyan/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="safe">Safe (G)</option>
                      <option value="suggestive">Suggestive (PG-13)</option>
                      <option value="mature">Mature (R)</option>
                      <option value="explicit">Explicit (X)</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Specific Classification</label>
                    <select 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)} 
                      className="w-full bg-void border border-white/10 rounded-xl p-4 text-text-primary outline-none focus:border-neon-cyan/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Classification</option>
                      <optgroup label="Characters & Rigging">
                        <option value="characters">Characters</option>
                        <option value="avatars">Avatars</option>
                        <option value="animations">Animations</option>
                        <option value="clothing">Clothing & Armor</option>
                        <option value="weapons">Weapons</option>
                      </optgroup>
                      <optgroup label="Visual Effects & Technical">
                        <option value="vfx">VFX</option>
                        <option value="particles">Particles</option>
                        <option value="shaders">Shaders</option>
                        <option value="spells">Spells</option>
                      </optgroup>
                      <optgroup label="World Building">
                        <option value="terrain">Terrain</option>
                        <option value="nature">Nature</option>
                        <option value="architecture">Architecture</option>
                        <option value="props">Props & Decorations</option>
                      </optgroup>
                      <optgroup label="Audio Engineering">
                        <option value="music">Music</option>
                        <option value="sfx">SFX</option>
                        <option value="voice">Voice</option>
                        <option value="ambient">Ambient</option>
                      </optgroup>
                      <optgroup label="Interface & Graphic">
                        <option value="ui">UI</option>
                        <option value="hud">HUD</option>
                        <option value="icons">Icons</option>
                        <option value="fonts">Fonts</option>
                      </optgroup>
                      <optgroup label="Code & Logic">
                        <option value="scripts">Scripts</option>
                        <option value="ai_logic">AI Logic</option>
                        <option value="physics">Physics</option>
                        <option value="networking">Networking</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold text-text-primary">Foundations & Stake</h2>
                {stakePreview.scaled && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-neon-violet/10 border border-neon-violet/30 rounded-full text-neon-violet text-xs font-bold">
                    <Zap className="w-3 h-4" />
                    REVENUE PROTECTION ACTIVE
                  </div>
                )}
              </div>

              {/* Fair Stake Simulation UI */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-void p-4 rounded-xl border border-white/5 group transition-all hover:border-neon-cyan/30">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Your Guaranteed Stake</p>
                  <p className="text-3xl font-black text-neon-cyan">{stakePreview.stakeholder.toFixed(1)}%</p>
                  {stakePreview.scaled && <p className="text-[10px] text-neon-violet mt-1">Maximum protection applied</p>}
                </div>
                <div className="bg-void p-4 rounded-xl border border-white/5">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Total Foundation Royalties</p>
                  <p className="text-3xl font-black text-text-primary">{stakePreview.external.toFixed(1)}%</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Suggested from Your Library</label>
                <div className="grid grid-cols-1 gap-2">
                  {purchasedAssets.length > 0 ? (
                    purchasedAssets.map(asset => (
                      <button
                        key={asset.id}
                        onClick={() => {
                          if (foundationAssets.includes(asset.id)) {
                            setFoundationAssets(foundationAssets.filter(id => id !== asset.id));
                          } else {
                            setFoundationAssets([...foundationAssets, asset.id]);
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${foundationAssets.includes(asset.id) ? 'bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan' : 'bg-void border-white/5 hover:border-white/20'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="w-4 h-4" />
                          <div className="text-left">
                            <p className="text-sm font-medium">{asset.title}</p>
                            <p className="text-[10px] opacity-60 capitalize">{asset.licenseTier.replace('_', ' ')}</p>
                          </div>
                        </div>
                        {foundationAssets.includes(asset.id) ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border border-white/20 rounded" />}
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted italic p-4 bg-void rounded-xl border border-dashed border-white/10">No purchased assets found. Purchase foundational logic or art to link them here.</p>
                  )}
                </div>
              </div>

              <div className="relative mt-6">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <Input value={foundationSearch} onChange={(e) => setFoundationSearch(e.target.value)} placeholder="Search other foundations to link..." className="pl-10 py-6 bg-void" />
              </div>

              <div className="pt-4 border-t border-white/5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">Direct Revenue Splits</label>
                <div className="flex gap-2">
                  <Input placeholder="Username" className="bg-void" id="u" />
                  <Input placeholder="%" type="number" className="w-20 bg-void" id="p" />
                  <Button variant="outline" onClick={() => {
                    const u = document.getElementById('u') as HTMLInputElement;
                    const p = document.getElementById('p') as HTMLInputElement;
                    if (u.value && p.value) setRevenueSplits([...revenueSplits, { userId: generateId(), username: u.value, percentage: parseInt(p.value), role: 'collaborator' }]);
                  }}>Add</Button>
                </div>
                {revenueSplits.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {revenueSplits.map((split, i) => (
                      <div key={i} className="flex justify-between items-center bg-void p-2 rounded border border-white/5">
                        <span className="text-xs">{split.username} ({split.percentage}%)</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRevenueSplits(revenueSplits.filter((_, idx) => idx !== i))}><X className="w-3 h-3"/></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h2 className="font-heading text-xl font-bold text-text-primary">License Tier</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {licenseOptions.map(opt => (
                  <div key={opt.value} onClick={() => setLicenseTier(opt.value)} className={`p-4 border rounded-xl cursor-pointer transition-all ${licenseTier === opt.value ? 'border-neon-cyan bg-neon-cyan/5' : 'border-white/10'}`}>
                    <h3 className="font-bold text-sm">{opt.label}</h3>
                    <p className="text-xs text-text-muted">{opt.royalty} platform fee</p>
                  </div>
                ))}
              </div>

              {licenseTier !== 'opensource' && (
                <>
                  <h2 className="font-heading text-xl font-bold text-text-primary pt-6 border-t border-white/5">Pricing Model</h2>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div onClick={() => setPricingType('fixed')} className={`p-4 border rounded-xl cursor-pointer text-center transition-all ${pricingType === 'fixed' ? 'border-neon-cyan bg-neon-cyan/5' : 'border-white/10'}`}>
                      <h3 className="font-bold text-sm mb-1">Fixed Price</h3>
                      <p className="text-xs text-text-muted">Standard commerce</p>
                    </div>
                    <div onClick={() => setPricingType('donation')} className={`p-4 border rounded-xl cursor-pointer text-center transition-all ${pricingType === 'donation' ? 'border-neon-cyan bg-neon-cyan/5' : 'border-white/10'}`}>
                      <h3 className="font-bold text-sm mb-1">Pay What You Want</h3>
                      <p className="text-xs text-text-muted">Minimum + Suggested Tip</p>
                    </div>
                    <div onClick={() => setPricingType('free')} className={`p-4 border rounded-xl cursor-pointer text-center transition-all ${pricingType === 'free' ? 'border-neon-cyan bg-neon-cyan/5' : 'border-white/10'}`}>
                      <h3 className="font-bold text-sm mb-1">Free/Optional Tip</h3>
                      <p className="text-xs text-text-muted">100% Free</p>
                    </div>
                  </div>

                  {pricingType === 'fixed' && (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                      <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Fixed Price in USD" className="pl-8 py-6 bg-void" />
                    </div>
                  )}

                  {pricingType === 'donation' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="text-xs text-text-muted mb-2 block">Minimum Price</label>
                        <span className="absolute left-4 top-[38px] -translate-y-1/2 text-text-muted">$</span>
                        <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="e.g. 5.00" className="pl-8 py-6 bg-void" />
                      </div>
                      <div className="relative">
                        <label className="text-xs text-text-muted mb-2 block">Suggested Price</label>
                        <span className="absolute left-4 top-[38px] -translate-y-1/2 text-text-muted">$</span>
                        <Input type="number" value={suggestedPrice} onChange={(e) => setSuggestedPrice(e.target.value)} placeholder="e.g. 10.00" className="pl-8 py-6 bg-void" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h2 className="font-heading text-xl font-bold text-text-primary">Review & Launch</h2>
              <div className="bg-void p-6 rounded-xl space-y-3">
                <div className="flex justify-between text-sm"><span>Title</span> <span>{title}</span></div>
                <div className="flex justify-between text-sm"><span>License</span> <span className="text-neon-cyan">{licenseTier}</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/5"><span>Price</span> <span className="text-neon-cyan">${price || '0.00'}</span></div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="custom-checkbox" />
                <span className="text-sm text-text-secondary">I agree to the Creator Fair-Stake and Revenue terms.</span>
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>Back</Button>
        <Button className="bg-gradient-rgb text-void font-bold min-w-[140px]" onClick={currentStep === 4 ? handleSubmit : handleNext} disabled={!canProceed() || isSubmitting}>
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{uploadProgress > 0 && uploadProgress < 100 ? `${Math.round(uploadProgress)}%` : 'Processing...'}</span>
            </div>
          ) : (
            <>
              {currentStep === 4 ? 'Launch Asset' : 'Continue'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

