import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Grid3X3, 
  List, 
  SlidersHorizontal,
  X,
  ChevronDown,
  Star,
  Box,
  Package,
  ArrowRight,
  Bot,
  Sparkles,
  Feather,
  Zap,
  Sword,
  User,
  Move,
  TreePine,
  Music,
  Layout,
  Gamepad2,
  Wrench,
  Shirt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOMeta } from '@/components/seo/SEOMeta';
import { apiClient } from '@/services/apiClient';
import { getAssets } from '@/services/marketService';
import { getCommissions, WRITING_CATEGORIES } from '@/services/writingCommissionService';
import { formatPrice, getLicenseBadgeClass, getLicenseDisplayName } from '@/utils/format';
import { parseIntent } from '@/utils/intentParser';
import type { AssetFilters, EngineType, Complexity, ContentRating, LicenseTier, Asset, AssetType, WritingCommission } from '@/types';

const engineTypes: { value: EngineType; label: string }[] = [
  { value: 'unity', label: 'Unity' },
  { value: 'unreal', label: 'Unreal Engine' },
  { value: 'godot', label: 'Godot' },
  { value: 'web', label: 'Web' },
  { value: 'other', label: 'Other' },
];

const complexities: { value: Complexity; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const contentRatings: { value: ContentRating; label: string }[] = [
  { value: 'safe', label: 'Safe (G)' },
  { value: 'suggestive', label: 'Suggestive (PG-13)' },
  { value: 'mature', label: 'Mature (R)' },
  { value: 'explicit', label: 'Explicit (X)' },
];

const mainAssetTypes: { id: AssetType | 'all'; label: string; icon: any; description: string; color: string }[] = [
  { id: 'all', label: 'All Assets', icon: Grid3X3, description: 'Complete Repository', color: 'from-neon-cyan/20 to-neon-violet/20' },
  { id: 'avatar', label: 'Characters', icon: User, description: 'VRM & Rigged Models', color: 'from-blue-500/20 to-cyan-500/20' },
  { id: 'animation', label: 'Animations', icon: Move, description: 'Mocap & Hand-keyed', color: 'from-purple-500/20 to-pink-500/20' },
  { id: 'armor', label: 'Armor & Gear', icon: Shirt, description: 'Wearables & Accessories', color: 'from-indigo-500/20 to-blue-500/20' },
  { id: 'weapon', label: 'Weapons', icon: Sword, description: 'Melee & Ranged', color: 'from-red-500/20 to-orange-500/20' },
  { id: 'vfx', label: 'Spells & VFX', icon: Zap, description: 'Shaders & Particles', color: 'from-yellow-500/20 to-orange-500/20' },
  { id: 'environment', label: 'Environments', icon: TreePine, description: 'Terrain & Nature', color: 'from-green-500/20 to-emerald-500/20' },
  { id: 'prop', label: 'Props', icon: Box, description: 'Decorations & Static', color: 'from-zinc-500/20 to-slate-500/20' },
  { id: 'audio', label: 'Audio', icon: Music, description: 'Music & Sound FX', color: 'from-pink-500/20 to-rose-500/20' },
  { id: 'ui', label: 'UI & HUD', icon: Layout, description: 'Interfaces & Icons', color: 'from-indigo-500/20 to-blue-500/20' },
  { id: 'game', label: 'Games', icon: Gamepad2, description: 'Playable Experiences', color: 'from-cyan-500/20 to-blue-500/20' },
  { id: 'software', label: 'Tools', icon: Wrench, description: 'Software & Utilities', color: 'from-slate-500/20 to-zinc-500/20' },
  { id: 'writing', label: 'Writing', icon: Feather, description: 'Scripts & Lore', color: 'from-amber-500/20 to-orange-500/20' },
];

const licenseTiers: { value: LicenseTier; label: string }[] = [
  { value: 'art_3pct', label: 'Standard Assets (3%)' },
  { value: 'integration_10pct', label: 'Integration (10%)' },
  { value: 'functional_15pct', label: 'Functional Game (15%)' },
  { value: 'source_20pct', label: 'Full Source (20%)' },
  { value: 'opensource', label: 'Open Source' },
];

const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

export default function BrowsePage() {
  const { category } = useParams();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isIntentMode, setIsIntentMode] = useState(false);
  const [activeAssetType, setActiveAssetType] = useState<AssetType | 'all'>('all');
  const [sortBy, setSortBy] = useState('popular');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [writingCommissions, setWritingCommissions] = useState<WritingCommission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [filters, setFilters] = useState<AssetFilters>({
    category: category || undefined,
  });

  // Intent parsing effect
  useEffect(() => {
    if (!isIntentMode) return;
    const intentResult = parseIntent(searchQuery);
    setFilters((prev: AssetFilters) => ({
      ...prev,
      priceMax: intentResult.priceMax !== undefined ? intentResult.priceMax : prev.priceMax,
      licenseTier: intentResult.licenseTier || prev.licenseTier,
      engineType: intentResult.engineType || prev.engineType,
      complexity: intentResult.complexity || prev.complexity,
      contentRating: intentResult.contentRating || prev.contentRating,
      category: intentResult.category || category || prev.category,
    }));
  }, [searchQuery, isIntentMode, category]);

  const sortMap: Record<string, string> = {
    popular: 'popular', newest: 'newest',
    price_asc: 'price_asc', price_desc: 'price_desc', rating: 'top_rated',
  };

  useEffect(() => {
    if (activeAssetType === 'writing') {
      setIsLoading(true);
      getCommissions({ status: 'open' })
        .then(setWritingCommissions)
        .catch(() => setWritingCommissions([]))
        .finally(() => setIsLoading(false));
      return;
    }
    
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (activeAssetType && activeAssetType !== 'all') params.set('assetType', activeAssetType);
    if (filters.category) params.set('category', filters.category);
    if (filters.engineType) params.set('engine', filters.engineType);
    if (searchQuery.trim() && !isIntentMode) params.set('search', searchQuery.trim());
    params.set('sort', sortMap[sortBy] ?? 'newest');

    setIsLoading(true);
    apiClient.get<{ assets: any[] }>(`/assets?${params}`)
      .then(({ assets: raw }) => {
        setAssets(raw.map(a => ({
          ...a,
          engineType: a.engine,
          ratingAverage: a.ratingCount > 0 ? a.ratingSum / a.ratingCount : 0,
          slug: a.id,
          assetType: a.assetType || 'dev_asset',
        })));
      })
      .catch(async () => {
        try {
          const localAssets = await getAssets();
          setAssets(localAssets);
        } catch {
          setAssets([]);
        }
      })
      .finally(() => setIsLoading(false));
  }, [filters.category, filters.engineType, sortBy, searchQuery, isIntentMode, activeAssetType]);

  const filteredAssets = useMemo(() => {
    let result = [...assets];
    if (filters.category) result = result.filter(a => a.category === filters.category);
    if (filters.engineType) result = result.filter(a => a.engineType === filters.engineType);
    if (filters.complexity) result = result.filter(a => a.complexity === filters.complexity);
    if (filters.contentRating) result = result.filter(a => a.contentRating === filters.contentRating);
    if (filters.licenseTier) result = result.filter(a => a.licenseTier === filters.licenseTier);
    if (filters.priceMin !== undefined) result = result.filter(a => a.price >= (filters.priceMin || 0));
    if (filters.priceMax !== undefined) result = result.filter(a => a.price <= (filters.priceMax || Infinity));
    if (filters.rating) result = result.filter(a => (a.ratingAverage || 0) >= (filters.rating || 0));
    
    if (searchQuery && !isIntentMode) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.tags.some((t: string) => t.toLowerCase().includes(query))
      );
    }
    return result;
  }, [filters, searchQuery, isIntentMode, assets]);

  const toggleFilter = (key: keyof AssetFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined).length + (searchQuery ? 1 : 0);

  return (
    <div className="min-h-screen pt-24 pb-12 bg-void selection:bg-neon-cyan/30">
      <SEOMeta
        title="Browse NovAura Marketplace"
        description="The ultimate creator hub for high-fidelity game assets, VRM avatars, custom shaders, and modular environment packs."
        keywords={['game assets', 'vrm avatars', 'unity assets', 'unreal engine assets', 'game dev tools']}
        url="https://novaura.life/market"
      />

      <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
        {/* Hero Section */}
        <section className="relative rounded-[3rem] overflow-hidden mb-16 bg-void-light border border-white/5 shadow-2xl">
          {/* Spinning ring background — same pattern as PricingPage */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3rem]">
            <div
              className="absolute w-[700px] h-[700px] rounded-full blur-[130px] opacity-20"
              style={{
                background: 'conic-gradient(from 0deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #9400d3, #ff00ff, #ff0000)',
                top: '-30%',
                right: '-10%',
                animation: 'spin 30s linear infinite',
              }}
            />
            <div
              className="absolute w-[500px] h-[500px] rounded-full blur-[110px] opacity-15"
              style={{
                background: 'conic-gradient(from 180deg, #00ffff, #ff00ff, #ffff00, #00ffff)',
                bottom: '-30%',
                left: '-5%',
                animation: 'spin 25s linear infinite reverse',
              }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/60 to-transparent z-10" />

          <div className="relative z-20 p-16 lg:p-24">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-xs font-black uppercase tracking-[0.2em] mb-8">
                <Sparkles className="w-4 h-4" />
                NovAura Ecosystem
              </div>
              <h1 className="text-6xl lg:text-8xl font-black mb-8 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent leading-[0.9]">
                CREATOR <br/>REPOSITORY
              </h1>
              <p className="text-white/40 text-2xl max-w-2xl mb-12 leading-relaxed font-medium">
                The world's most advanced marketplace for high-fidelity game development. 
                Rigged, tagged, and ready for deployment.
              </p>
              <div className="flex flex-wrap gap-6">
                <Button className="bg-neon-cyan text-void font-black px-10 py-8 rounded-2xl hover:bg-white transition-all text-lg shadow-[0_20px_40px_rgba(0,240,255,0.2)]">
                  Explore Repository
                </Button>
                <Button variant="outline" className="border-white/10 text-white px-10 py-8 rounded-2xl hover:bg-white/5 text-lg">
                  Submit Asset
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Category Navigation Grid */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8 px-2">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/30">Browse by Category</h2>
            <div className="h-px flex-grow mx-8 bg-white/5" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {mainAssetTypes.map((type) => {
              const Icon = type.icon;
              return (
                <motion.button
                  key={type.id}
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveAssetType(type.id)}
                  className={`relative group flex flex-col items-center justify-center p-8 rounded-[2rem] border transition-all duration-500 overflow-hidden ${
                    activeAssetType === type.id
                      ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_30px_60px_rgba(0,240,255,0.1)]'
                      : 'bg-void-light border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${type.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className={`relative z-10 p-4 rounded-2xl mb-4 transition-all duration-500 ${
                    activeAssetType === type.id ? 'bg-neon-cyan text-void' : 'bg-white/5 text-white/40 group-hover:text-white'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`relative z-10 text-[10px] uppercase tracking-[0.2em] font-black text-center ${
                    activeAssetType === type.id ? 'text-neon-cyan' : 'text-white/20 group-hover:text-white/60'
                  }`}>
                    {type.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Search & Global Controls */}
        <div className="sticky top-24 z-40 mb-12 backdrop-blur-md py-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Search Bar */}
            <div className="relative flex-grow group">
              <div className="absolute left-6 top-1/2 -translate-y-1/2">
                {isIntentMode ? (
                  <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                ) : (
                  <Search className="w-6 h-6 text-white/20 group-focus-within:text-neon-cyan transition-colors" />
                )}
              </div>
              <Input
                type="text"
                placeholder={isIntentMode ? "Ask Aura... (e.g. 'high-fidelity vrm character under 50')" : "Search the repository..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-16 pr-32 py-8 bg-void-light/80 border-white/5 text-white text-xl rounded-2xl transition-all ${
                  isIntentMode ? "ring-2 ring-purple-500/30 border-purple-500/20" : "focus:ring-2 focus:ring-neon-cyan/30"
                }`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <button
                  onClick={() => setIsIntentMode(!isIntentMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    isIntentMode 
                      ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' 
                      : 'bg-white/5 text-white/40 hover:text-white border border-white/5'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  Aura
                </button>
              </div>
            </div>

            {/* Filter Toggle */}
            <Button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-8 py-8 rounded-2xl border transition-all ${
                showFilters ? 'bg-white text-void' : 'bg-void-light border-white/5 text-white hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5 mr-3" />
              <span className="font-bold">Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-3 px-2 py-0.5 bg-neon-cyan text-void text-[10px] font-black rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Filter Panel Expansion */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                className="mt-6 overflow-hidden"
              >
                <div className="p-10 bg-void-light/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                  {/* Engine Selection */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-6">Engine Parity</h4>
                    <div className="flex flex-wrap gap-3">
                      {engineTypes.map(e => (
                        <button
                          key={e.value}
                          onClick={() => toggleFilter('engineType', e.value)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            filters.engineType === e.value
                              ? 'bg-neon-cyan border-neon-cyan text-void'
                              : 'bg-void border-white/5 text-white/40 hover:border-white/20'
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Maturity Matrix */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-6">Content Rating</h4>
                    <div className="flex flex-wrap gap-3">
                      {contentRatings.map(r => (
                        <button
                          key={r.value}
                          onClick={() => toggleFilter('contentRating', r.value)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            filters.contentRating === r.value
                              ? 'bg-purple-500 border-purple-500 text-white'
                              : 'bg-void border-white/5 text-white/40 hover:border-white/20'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* License Models */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-6">Royalties & Licensing</h4>
                    <div className="flex flex-col gap-2">
                      {licenseTiers.map(l => (
                        <button
                          key={l.value}
                          onClick={() => toggleFilter('licenseTier', l.value)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-medium transition-all ${
                            filters.licenseTier === l.value
                              ? 'bg-white/10 text-white border border-white/20'
                              : 'text-white/40 hover:bg-white/5'
                          }`}
                        >
                          {l.label.split('(')[0]}
                          <span className="text-neon-cyan font-black">{l.label.includes('(') ? l.label.split('(')[1].replace(')', '') : '0%'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-col justify-end">
                    <Button 
                      onClick={clearFilters}
                      variant="ghost" 
                      className="text-white/20 hover:text-red-400 transition-colors uppercase tracking-widest text-[10px] font-black mb-4"
                    >
                      Reset All Filters
                    </Button>
                    <Button className="w-full bg-white text-void font-black py-4 rounded-xl">
                      Apply Changes
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Results Grid */}
        <section>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full mb-8"
              />
              <span className="text-white/20 font-black tracking-[0.3em] uppercase text-xs">Accessing Data Stream...</span>
            </div>
          ) : filteredAssets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {filteredAssets.map((asset, index) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group"
                >
                  <Link to={`/asset/${asset.id}`}>
                    <div className="relative bg-void-light/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden transition-all duration-700 group-hover:border-neon-cyan/40 group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.7)] group-hover:-translate-y-4">
                      {/* Media Container */}
                      <div className="aspect-[4/5] overflow-hidden relative">
                        {asset.thumbnailUrl ? (
                          <img 
                            src={asset.thumbnailUrl} 
                            alt={asset.title}
                            className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full bg-void flex items-center justify-center">
                            <Box className="w-20 h-20 text-white/5" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/20 to-transparent opacity-90" />
                        
                        {/* Status Badges */}
                        <div className="absolute top-6 left-6 flex flex-col gap-2">
                          <div className="px-3 py-1 bg-void/60 backdrop-blur-md text-[9px] font-black uppercase tracking-[0.2em] text-neon-cyan rounded-full border border-neon-cyan/30">
                            {asset.engineType}
                          </div>
                          {asset.contentRating && asset.contentRating !== 'safe' && (
                            <div className={`px-3 py-1 bg-void/60 backdrop-blur-md text-[9px] font-black uppercase tracking-[0.2em] rounded-full border ${
                              asset.contentRating === 'explicit' ? 'text-red-500 border-red-500/30' : 'text-yellow-500 border-yellow-500/30'
                            }`}>
                              {asset.contentRating}
                            </div>
                          )}
                        </div>

                        {/* Price Tag */}
                        <div className="absolute bottom-6 left-6">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.2em] mb-1">Ownership</span>
                            <span className="text-3xl font-black text-white">
                              {asset.price === 0 ? 'FREE' : formatPrice(asset.price)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="p-8">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                            {asset.category?.replace(/-/g, ' ')}
                          </span>
                          <div className="flex items-center gap-1.5 text-yellow-500">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-xs font-black">{asset.ratingAverage > 0 ? asset.ratingAverage.toFixed(1) : 'NEW'}</span>
                          </div>
                        </div>
                        
                        <h3 className="text-2xl font-black text-white mb-3 group-hover:text-neon-cyan transition-colors truncate">
                          {asset.title}
                        </h3>
                        
                        <p className="text-white/40 text-sm line-clamp-2 mb-8 leading-relaxed font-medium">
                          {asset.description}
                        </p>

                        <div className="flex items-center justify-between pt-6 border-t border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                              <User className="w-4 h-4 text-white/40" />
                            </div>
                            <span className="text-xs font-bold text-white/60">{asset.creator?.username || 'Core Creator'}</span>
                          </div>
                          <ArrowRight className="w-5 h-5 text-white/10 group-hover:text-neon-cyan group-hover:translate-x-2 transition-all" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[4rem]">
              <Package className="w-24 h-24 text-white/5 mb-8" />
              <h3 className="text-2xl font-black text-white mb-4">No Matches Found</h3>
              <p className="text-white/30 text-lg mb-12 text-center max-w-md">
                We couldn't find any assets matching your current stream configuration.
              </p>
              <Button onClick={clearFilters} className="bg-white text-void font-black px-12 py-6 rounded-2xl">
                Reset Stream Filters
              </Button>
            </div>
          )}
        </section>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
