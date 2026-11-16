import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  ShoppingCart,
  Heart,
  Share2,
  AlertCircle,
  FileText,
  Box,
  Calendar,
  Tag,
  ChevronRight,
  User,
  ArrowLeft,
  Shield,
  Zap,
  Download,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Info,
  Check,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SEOMeta } from '@/components/seo/SEOMeta';
import { apiClient } from '@/services/apiClient';
import { getAssets } from '@/services/marketService';
import { getUserPosts, getGlobalFeed } from '@/services/socialService';
import { useAuthStore } from '@/stores/authStore';
import { useSocialStore } from '@/stores/socialStore';
import { useCartStore } from '@/stores/cartStore';
import { useUIStore } from '@/stores/uiStore';
import { formatPrice, formatDate, getLicenseBadgeClass, getLicenseDisplayName } from '@/utils/format';
import type { LicenseTier, Asset, ContentRating } from '@/types';

const licenseDetails: Record<LicenseTier, { title: string; description: string; points: string[] }> = {
  art_3pct: {
    title: 'Individual Art License',
    description: 'For single sprites, textures, and artwork. 3% royalty on product revenue.',
    points: [
      'Use in unlimited commercial projects',
      'Modify and adapt for your needs',
      'Credit the original creator',
      '3% royalty on product revenue',
    ],
  },
  music_1pct: {
    title: 'Music & Audio License',
    description: 'For music and audio when defining your game\'s sonic identity. 1% royalty.',
    points: [
      'Use as primary soundtrack or ambience',
      'Loop and edit for your needs',
      'Credit the musician prominently',
      '1% royalty on product revenue',
    ],
  },
  integration_10pct: {
    title: 'Asset Collection License',
    description: 'When multiple assets from one creator define your game\'s aesthetic. 10% royalty.',
    points: [
      'Complete art packs or soundtracks',
      'Dominant visual/audio identity',
      '10% royalty on total revenue',
      'Prominent attribution required',
    ],
  },
  functional_15pct: {
    title: 'Game Framework License',
    description: 'Reusable systems powering core mechanics. 15% royalty on product revenue.',
    points: [
      'Card games, battle systems, UI kits',
      'Modify and extend the framework',
      '15% royalty on product revenue',
      'Preserve copyright in code',
    ],
  },
  source_20pct: {
    title: 'Full Source License',
    description: 'Complete game projects with full source code. 20% royalty on product revenue.',
    points: [
      'Full source code access',
      '20% royalty on product revenue',
      'Right to rebrand & modify',
      'Commercial use permitted'
    ]
  },
  opensource: {
    title: 'Open Source License',
    description: 'MIT/Apache licensed. Free to use with proper attribution.',
    points: [
      'No royalties required',
      'Free for any use',
      'Keep license file intact',
      'Community contributions welcome',
    ],
  },
};

const ratingLabels: Record<ContentRating, { label: string, color: string }> = {
  safe: { label: 'Safe (G)', color: 'text-neon-lime' },
  suggestive: { label: 'Suggestive (PG-13)', color: 'text-yellow-500' },
  mature: { label: 'Mature (R)', color: 'text-orange-500' },
  explicit: { label: 'Explicit (X)', color: 'text-red-500' },
};

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isAuthenticated } = useAuthStore();
  const { addItem, isInCart } = useCartStore();
  const { addToast, openLoginModal } = useUIStore();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [relatedAssets, setRelatedAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [customPrice, setCustomPrice] = useState<string>('0');
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [devlogs, setDevlogs] = useState<any[]>([]);
  const { followCreator, unfollowCreator, isFollowing } = useSocialStore();

  const media = useMemo(() => {
    if (!asset) return [];
    const list = [];
    if (asset.thumbnailUrl) list.push({ type: 'image', url: asset.thumbnailUrl });
    if (asset.screenshotUrls) {
      asset.screenshotUrls.forEach(url => list.push({ type: 'image', url }));
    }
    if (asset.videoUrl) list.unshift({ type: 'video', url: asset.videoUrl }); // Video first if exists
    return list;
  }, [asset]);

  useEffect(() => {
    if (!id) return;
    
    const fetchAssetData = async () => {
      setIsLoading(true);
      try {
        const { asset: raw } = await apiClient.get<{ asset: any }>(`/assets/${id}`);
        const mapped: Asset = {
          ...raw,
          engineType: raw.engine,
          ratingAverage: raw.ratingCount > 0 ? (raw.ratingSum / raw.ratingCount) : 0,
          slug: raw.id,
        };
        setAsset(mapped);
        setCustomPrice(raw.pricingType === 'donation'
          ? ((raw.suggestedPrice || raw.minPrice || 0) / 100).toString()
          : '0');

        const { assets: relatedRaw } = await apiClient.get<{ assets: any[] }>(`/assets?category=${raw.category}&limit=5`);
        setRelatedAssets(
          relatedRaw
            .filter((a: any) => a.id !== id)
            .slice(0, 4)
            .map((a: any) => ({ ...a, engineType: a.engine }))
        );
      } catch (err) {
        console.error('API fetch failed, trying local fallback:', err);
        try {
          const allAssets = await getAssets();
          const local = allAssets.find((a: any) => a.id === id || a.slug === id);
          if (local) {
            setAsset(local);
            const related = allAssets
              .filter((a: any) => a.category === local.category && a.id !== local.id)
              .slice(0, 4);
            setRelatedAssets(related);
          } else {
            setNotFound(true);
          }
        } catch (fallbackErr) {
          console.error('Fallback failed:', fallbackErr);
          setNotFound(true);
        }
      } finally {
        setIsLoading(false);
        // Load devlogs (social posts tagged with this asset ID)
        if (id) {
          try {
            const allPosts = await getGlobalFeed();
            const filtered = allPosts.filter(p => 
              p.tags?.includes(id) || 
              p.content.toLowerCase().includes(id.toLowerCase())
            );
            setDevlogs(filtered);
          } catch (postErr) {
            console.error('Error loading devlogs:', postErr);
          }
        }
      }
    };

    fetchAssetData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 flex flex-col items-center justify-center bg-void">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full mb-6"
        />
        <span className="text-white/20 font-black uppercase tracking-[0.3em] text-xs">Decrypting Asset Stream...</span>
      </div>
    );
  }

  if (notFound || !asset) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center bg-void">
        <div className="text-center p-12 bg-void-light border border-white/5 rounded-[3rem]">
          <AlertCircle className="w-20 h-20 text-red-500/20 mx-auto mb-6" />
          <h1 className="text-3xl font-black text-white mb-4">ASSET NOT FOUND</h1>
          <p className="text-white/30 mb-8 max-w-md">The requested data fragment could not be located in the repository.</p>
          <Link to="/browse">
            <Button className="bg-white text-void font-black px-8 py-6 rounded-2xl">Return to Market</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    if (isInCart(asset.id)) {
      addToast({ type: 'info', title: 'Already in cart' });
      return;
    }
    const parsedPrice = Math.round(parseFloat(customPrice || '0') * 100);
    const priceToAdd = asset.pricingType === 'donation' ? Math.max(parsedPrice, asset.minPrice || 0) : undefined;
    addItem(asset, priceToAdd);
    addToast({ type: 'success', title: 'Asset Linked', message: `${asset.title} added to your acquisition list.` });
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    if (!isInCart(asset.id)) {
      const parsedPrice = Math.round(parseFloat(customPrice || '0') * 100);
      const priceToAdd = asset.pricingType === 'donation' ? Math.max(parsedPrice, asset.minPrice || 0) : undefined;
      addItem(asset, priceToAdd);
    }
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen pt-24 pb-24 bg-void selection:bg-neon-cyan/30">
      <SEOMeta
        title={`${asset.title} - NovAura Marketplace`}
        description={asset.shortDescription || asset.description.substring(0, 160)}
        keywords={[...asset.tags, 'game asset', 'novaura']}
        url={`https://novaura.life/asset/${asset.id}`}
      />

      <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-12">
          <Link to="/browse" className="group flex items-center gap-3 text-white/40 hover:text-white transition-colors">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-white/20 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Back to Repository</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <button className="p-3 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 text-white/40 hover:text-white transition-all">
              <Share2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsWishlisted(!isWishlisted)}
              className={`p-3 rounded-full border transition-all ${isWishlisted ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}
            >
              <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Main Content Column */}
          <div className="lg:col-span-8 space-y-12">
            {/* Cinematic Media Gallery */}
            <section className="relative group">
              <div className="aspect-[16/9] bg-void-light border border-white/5 rounded-[3rem] overflow-hidden relative shadow-2xl">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeMediaIndex}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5 }}
                    className="w-full h-full"
                  >
                    {media[activeMediaIndex]?.type === 'video' ? (
                      <video 
                        src={media[activeMediaIndex].url} 
                        className="w-full h-full object-cover" 
                        autoPlay muted loop 
                      />
                    ) : (
                      <img 
                        src={media[activeMediaIndex]?.url || asset.thumbnailUrl} 
                        className="w-full h-full object-cover" 
                        alt={asset.title} 
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
                
                <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent opacity-60" />
                
                {/* Media Overlay Badges */}
                <div className="absolute top-8 left-8 flex flex-col gap-3">
                  <div className="px-4 py-1.5 bg-void/60 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan rounded-full border border-neon-cyan/30">
                    {asset.engineType} COMPATIBLE
                  </div>
                  {asset.contentRating && asset.contentRating !== 'safe' && (
                    <div className={`px-4 py-1.5 bg-void/60 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.2em] rounded-full border ${ratingLabels[asset.contentRating].color} border-current/30`}>
                      {ratingLabels[asset.contentRating].label}
                    </div>
                  )}
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-4 mt-6 overflow-x-auto pb-4 scrollbar-hide">
                {media.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveMediaIndex(i)}
                    className={`relative flex-shrink-0 w-32 aspect-video rounded-2xl overflow-hidden border-2 transition-all duration-300 ${activeMediaIndex === i ? 'border-neon-cyan scale-105 shadow-[0_10px_20px_rgba(0,240,255,0.2)]' : 'border-white/5 hover:border-white/20 opacity-50 hover:opacity-100'}`}
                  >
                    <img src={item.url} className="w-full h-full object-cover" alt="" />
                    {item.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-void/40">
                        <Zap className="w-6 h-6 text-white fill-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* Asset Breakdown */}
            <section className="space-y-12">
              <div className="flex items-center justify-between border-b border-white/5 pb-8">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-4">Primary Documentation</div>
                  <h1 className="text-5xl font-black text-white mb-4 leading-tight">{asset.title}</h1>
                  <p className="text-white/40 text-xl font-medium max-w-xl">{asset.shortDescription}</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-2">Acquisition Cost</div>
                  <div className="text-5xl font-black text-neon-cyan">
                    {asset.pricingType === 'free' ? '0.00' : formatPrice(asset.price)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-3">
                    <Info className="w-4 h-4" />
                    Deep Logic Overview
                  </h3>
                  <p className="text-white/60 leading-relaxed text-lg whitespace-pre-line font-medium">
                    {asset.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-3 mt-8">
                    {asset.tags.map(tag => (
                      <span key={tag} className="px-5 py-2 bg-white/5 border border-white/5 rounded-2xl text-xs font-bold text-white/40 uppercase tracking-widest hover:border-neon-cyan/20 hover:text-white transition-all cursor-default">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-8 p-10 bg-void-light border border-white/5 rounded-[2.5rem]">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-3">
                    <Shield className="w-4 h-4 text-neon-cyan" />
                    Contractual Lineage
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-sm font-medium">License Architecture</span>
                      <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${getLicenseBadgeClass(asset.licenseTier)}`}>
                        {getLicenseDisplayName(asset.licenseTier)}
                      </span>
                    </div>
                    
                    <div className="space-y-3 pt-4">
                      {licenseDetails[asset.licenseTier as LicenseTier]?.points.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-white/60 font-medium">
                          <Check className="w-4 h-4 text-neon-lime" />
                          {p}
                        </div>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest mb-4">
                        <span className="text-white/20">Revenue Stake Split</span>
                        <span className="text-neon-cyan">Fair Share Protocol Active</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div className="h-full bg-neon-cyan" style={{ width: '70%' }} title="Creator Stake (70%)" />
                        <div className="h-full bg-neon-violet" style={{ width: '20%' }} title="Foundation Royalty (20%)" />
                        <div className="h-full bg-white/20" style={{ width: '10%' }} title="Platform Fee (10%)" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Version History & Reviews */}
            <Tabs defaultValue="specs" className="w-full">
              <TabsList className="bg-void-light border border-white/5 p-2 rounded-[2rem] mb-8">
                <TabsTrigger value="specs" className="px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px]">Specifications</TabsTrigger>
                <TabsTrigger value="pulse" className="px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] text-neon-cyan">Aura Pulse</TabsTrigger>
                <TabsTrigger value="reviews" className="px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px]">Neural Reviews</TabsTrigger>
                <TabsTrigger value="changelog" className="px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px]">Iterative Updates</TabsTrigger>
              </TabsList>

              <TabsContent value="specs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Complexity', value: asset.complexity, icon: Zap },
                    { label: 'Rating', value: asset.contentRating, icon: Shield },
                    { label: 'Downloads', value: asset.downloadCount.toLocaleString(), icon: Download },
                    { label: 'Engine', value: asset.engineType, icon: Box },
                  ].map((spec, i) => (
                    <div key={i} className="p-6 bg-void-light border border-white/5 rounded-3xl group hover:border-neon-cyan/30 transition-all">
                      <spec.icon className="w-6 h-6 text-white/20 group-hover:text-neon-cyan transition-colors mb-4" />
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-1">{spec.label}</div>
                      <div className="text-lg font-black text-white uppercase">{spec.value}</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="pulse">
                <div className="space-y-6">
                  {devlogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-[3rem]">
                      <Zap className="w-12 h-12 text-white/5 mb-4" />
                      <span className="text-white/20 font-black tracking-[0.2em] uppercase text-xs">No active pulse transmissions detected.</span>
                    </div>
                  ) : (
                    devlogs.map((log, i) => (
                      <motion.div 
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-8 bg-void-light border border-white/5 rounded-[2.5rem] space-y-4"
                      >
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-neon-cyan/60">
                          <span>Sequence Update</span>
                          <span>{formatDate(log.createdAt)}</span>
                        </div>
                        <p className="text-white/60 font-medium leading-relaxed">{log.content}</p>
                        <div className="flex items-center gap-6 pt-2">
                          <span className="text-[10px] font-black text-white/20 uppercase tracking-widest flex items-center gap-2">
                            <Star className="w-3 h-3" /> {log.likes} Resonance
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="reviews">
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-[3rem]">
                  <MessageSquare className="w-12 h-12 text-white/5 mb-4" />
                  <span className="text-white/20 font-black tracking-[0.2em] uppercase text-xs">No feedback loops recorded yet.</span>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Acquisition Sidebar */}
          <div className="lg:col-span-4">
            <aside className="sticky top-32 space-y-8">
              {/* Purchase Card */}
              <div className="p-10 bg-void-light/80 backdrop-blur-3xl border border-white/5 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                
                <div className="relative z-10 space-y-8">
                  {/* Creator Info */}
                  <div className="flex flex-col gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                      <Link to={`/creator/${asset.creator?.username}`} className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-all">
                        <img src={asset.creator?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${asset.creatorId}`} className="w-12 h-12 rounded-full ring-2 ring-neon-cyan/20" alt="" />
                        <div className="flex-grow">
                          <div className="text-[10px] font-black uppercase tracking-widest text-white/20">Authorized Creator</div>
                          <div className="text-lg font-black text-white">{asset.creator?.username || 'Unknown'}</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-white/20" />
                      </Link>

                      {/* Social Links Integration */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                        {asset.creator?.twitter && (
                          <a href={`https://twitter.com/${asset.creator.twitter}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/10 text-white/40 hover:text-cyan-400 transition-all">
                            <span className="text-[10px] font-black">TW</span>
                          </a>
                        )}
                        {asset.creator?.github && (
                          <a href={`https://github.com/${asset.creator.github}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                            <span className="text-[10px] font-black">GH</span>
                          </a>
                        )}
                        {asset.creator?.discord && (
                          <a href={`https://discord.com/users/${asset.creator.discord}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/10 text-white/40 hover:text-indigo-400 transition-all">
                            <span className="text-[10px] font-black">DC</span>
                          </a>
                        )}
                        {asset.creator?.website && (
                          <a href={asset.creator.website} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-purple-500/10 text-white/40 hover:text-purple-400 transition-all">
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const cid = asset.creatorId || '';
                        if (isFollowing(cid)) {
                          unfollowCreator(cid);
                        } else {
                          followCreator(cid, asset.creator?.username || 'Creator', asset.creator?.avatar);
                        }
                      }}
                      className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] border-white/5 transition-all ${isFollowing(asset.creatorId || '') ? 'text-neon-cyan border-neon-cyan/30' : 'text-white/40 hover:text-white'}`}
                    >
                      {isFollowing(asset.creatorId || '') ? 'Linked to Pulse' : 'Link Identity'}
                    </Button>
                  </div>

                  {/* Pricing Matrix */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 text-center">Acquisition Matrix</div>
                    {asset.pricingType === 'donation' ? (
                      <div className="space-y-6">
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 text-2xl font-black">$</span>
                          <Input 
                            type="number"
                            value={customPrice}
                            onChange={(e) => setCustomPrice(e.target.value)}
                            className="w-full bg-void border-white/5 py-8 pl-12 text-3xl font-black rounded-2xl focus:ring-neon-cyan"
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-white/20">MIN: {formatPrice(asset.minPrice || 0)}</span>
                          <span className="text-neon-cyan">SUGGESTED: {formatPrice(asset.suggestedPrice || 0)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-6xl font-black text-white mb-2">
                          {asset.pricingType === 'free' ? '0.00' : formatPrice(asset.price)}
                        </div>
                        <div className="text-[10px] font-black text-neon-cyan uppercase tracking-widest">Single Entity License</div>
                      </div>
                    )}
                  </div>

                  {/* Call to Action */}
                  <div className="space-y-4">
                    <Button 
                      onClick={handleBuyNow}
                      className="w-full bg-neon-cyan text-void font-black py-8 rounded-[2rem] text-xl shadow-[0_20px_40px_rgba(0,240,255,0.2)] hover:bg-white transition-all"
                    >
                      Instant Acquisition
                    </Button>
                    <Button 
                      onClick={handleAddToCart}
                      variant="outline"
                      className="w-full border-white/10 text-white font-black py-8 rounded-[2rem] text-xl hover:bg-white/5 transition-all"
                    >
                      <ShoppingCart className="w-5 h-5 mr-3" />
                      Queue to Hub
                    </Button>
                  </div>

                  <div className="pt-8 border-t border-white/5 flex items-center justify-between text-white/20">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-xs font-black">{asset.ratingAverage > 0 ? asset.ratingAverage.toFixed(1) : 'NEW'}</span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest">
                      {asset.downloadCount.toLocaleString()} Cycles
                    </div>
                  </div>
                </div>
              </div>

              {/* Related Stream */}
              {relatedAssets.length > 0 && (
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 px-4">Synchronized Components</h3>
                  <div className="space-y-4">
                    {relatedAssets.map(related => (
                      <Link key={related.id} to={`/asset/${related.id}`} className="flex items-center gap-4 p-4 bg-void-light border border-white/5 rounded-3xl hover:border-neon-cyan/30 transition-all group">
                        <div className="w-16 h-16 rounded-2xl bg-void overflow-hidden flex-shrink-0 border border-white/5">
                          <img src={related.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                        </div>
                        <div className="flex-grow">
                          <div className="text-sm font-black text-white group-hover:text-neon-cyan transition-colors">{related.title}</div>
                          <div className="text-[10px] font-black text-neon-cyan uppercase tracking-widest">{formatPrice(related.price)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
