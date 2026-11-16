import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  Package, 
  Users,
  ExternalLink,
  Box,
  User,
  UserPlus,
  UserMinus,
  MessageSquare,
  Shield,
  Zap,
  Layout,
  Globe,
  Twitter,
  Github,
  Award,
  Sparkles,
  Search,
  Grid,
  List
} from 'lucide-react';
import { getAssets } from '@/services/marketService';
import { getUserPosts } from '@/services/socialService';
import { formatPrice } from '@/utils/format';
import { useState, useEffect, useMemo } from 'react';
import { useSocialStore } from '@/stores/socialStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SEOMeta } from '@/components/seo/SEOMeta';
import type { Asset, SocialPost } from '@/types';

export default function CreatorProfilePage() {
  const { username } = useParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [creator, setCreator] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('portfolio');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { followCreator, unfollowCreator, isFollowing, followedCreators } = useSocialStore();

  const creatorId = creator?.id || '';
  const following = isFollowing(creatorId);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCreatorData = async () => {
      setIsLoading(true);
      try {
        const allAssets = await getAssets();
        const creatorAssets = allAssets.filter(a => 
          a.creator?.username?.toLowerCase() === username?.toLowerCase()
        );
        
        if (creatorAssets.length > 0) {
          const mainCreator = creatorAssets[0].creator;
          setCreator(mainCreator);
          setAssets(creatorAssets.filter(a => a.status === 'approved'));
          
          // Fetch social posts for this creator
          if (mainCreator?.id) {
            const userPosts = await getUserPosts(mainCreator.id);
            setPosts(userPosts);
          }
        }
      } catch (error) {
        console.error('Failed to load creator data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCreatorData();
  }, [username]);

  const stats = useMemo(() => {
    return [
      { label: 'Published Assets', value: assets.length, icon: Package },
      { label: 'Network Followers', value: creator?.followerCount ?? 0, icon: Users },
      { label: 'Avg User Rating', value: '4.9', icon: Star, color: 'text-yellow-400' },
      { label: 'System Rank', value: 'Elite', icon: Award, color: 'text-neon-cyan' },
    ];
  }, [assets, creator]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 bg-void flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full mb-6"
        />
        <span className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px]">Accessing Creator Bio-Data...</span>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center bg-void">
        <div className="text-center p-12 bg-void-light border border-white/5 rounded-[3rem]">
          <User className="w-20 h-20 text-white/5 mx-auto mb-6" />
          <h1 className="text-3xl font-black text-white mb-4">CREATOR NOT FOUND</h1>
          <p className="text-white/30 mb-8 max-w-md">The specified identity hash does not exist in our global registry.</p>
          <Link to="/browse">
            <Button className="bg-white text-void font-black px-8 py-6 rounded-2xl">Return to Market</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-24 bg-void">
      <SEOMeta 
        title={`${creator.username} - Creator Portfolio | NovAura`}
        description={creator.bio || `Explore the creative works and digital assets of ${creator.username} on the NovAura Marketplace.`}
      />

      {/* Cinematic Banner */}
      <div className="w-full h-[400px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-30 grayscale blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-r from-void via-transparent to-void z-10" />
        
        {/* Animated Particles/Overlay */}
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ y: [0, -20, 0], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-neon-cyan/10 blur-[100px] rounded-full"
          />
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 -mt-40 relative z-20">
        {/* Profile Identity Card */}
        <div className="p-10 bg-void-light/80 backdrop-blur-3xl border border-white/5 rounded-[3.5rem] shadow-2xl mb-16">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12">
            {/* Avatar Hexagon/Square */}
            <div className="relative group">
              <div className="w-48 h-48 rounded-[2.5rem] bg-gradient-rgb p-1.5 rotate-3 group-hover:rotate-0 transition-transform duration-500 shadow-2xl">
                <div className="w-full h-full rounded-[2.2rem] bg-void overflow-hidden">
                  {creator.avatar ? (
                    <img src={creator.avatar} alt={creator.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-void">
                      <User className="w-20 h-20 text-white/10" />
                    </div>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-neon-cyan rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                <Shield className="w-6 h-6 text-void" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-grow text-center lg:text-left space-y-6">
              <div>
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-2">
                  <h1 className="text-5xl font-black text-white tracking-tight">{creator.username}</h1>
                  <div className="px-3 py-1 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full text-[10px] font-black text-neon-cyan uppercase tracking-widest">Verified Creator</div>
                </div>
                <p className="text-xl text-white/40 font-medium max-w-2xl">{creator.bio || 'This creator is focusing on building the future of the sovereign web.'}</p>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                <Button 
                  onClick={() => following ? unfollowCreator(creatorId) : followCreator(creatorId, creator.username, creator.avatar)}
                  className={`px-10 py-7 rounded-[2rem] font-black text-lg transition-all ${following ? 'bg-void border border-neon-cyan/30 text-neon-cyan hover:border-red-500 hover:text-red-500' : 'bg-white text-void hover:bg-neon-cyan transition-colors'}`}
                >
                  {following ? 'UNLINK IDENTITY' : 'ESTABLISH LINK'}
                </Button>
                <Button variant="outline" className="px-8 py-7 rounded-[2rem] border-white/5 text-white/60 hover:bg-white/5 font-black uppercase tracking-widest text-xs">
                  <MessageSquare className="w-5 h-5 mr-3" />
                  Message
                </Button>
                <div className="flex items-center gap-2 px-6">
                  {[Globe, Twitter, Github].map((Icon, i) => (
                    <button key={i} className="p-3 rounded-2xl bg-white/5 border border-white/5 text-white/20 hover:text-white hover:border-white/20 transition-all">
                      <Icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Vertical Stats */}
            <div className="hidden lg:grid grid-cols-2 gap-4 w-full lg:w-auto">
              {stats.map((stat, i) => (
                <div key={i} className="p-6 bg-void border border-white/5 rounded-3xl min-w-[160px] group hover:border-neon-cyan/20 transition-all">
                  <stat.icon className={`w-5 h-5 mb-4 ${stat.color || 'text-white/20'}`} />
                  <div className="text-2xl font-black text-white">{stat.value}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="portfolio" className="w-full" onValueChange={setActiveTab}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <TabsList className="bg-void-light border border-white/5 p-2 rounded-[2rem]">
              <TabsTrigger value="portfolio" className="px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-white data-[state=active]:text-void">Asset Repository</TabsTrigger>
              <TabsTrigger value="stream" className="px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-white data-[state=active]:text-void">Network Stream</TabsTrigger>
              <TabsTrigger value="commissions" className="px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-white data-[state=active]:text-void">Active Jobs</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="text" 
                  placeholder="Scan Assets..." 
                  className="bg-void-light border border-white/5 rounded-full pl-12 pr-6 py-3 text-sm text-white focus:outline-none focus:border-neon-cyan/30 transition-all w-64"
                />
              </div>
              <div className="flex p-1 bg-void-light border border-white/5 rounded-xl">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/20'}`}><Grid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/20'}`}><List className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <TabsContent value="portfolio">
            {assets.length === 0 ? (
              <div className="text-center py-32 border border-dashed border-white/5 rounded-[4rem]">
                <Package className="w-16 h-16 text-white/5 mx-auto mb-6" />
                <h3 className="text-xl font-black text-white/20 uppercase tracking-widest">No Active Acquisitions</h3>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8" : "space-y-4"}>
                {assets.map((asset, index) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link to={`/asset/${asset.id}`} className="group block h-full">
                      <div className="bg-void-light border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-neon-cyan/30 transition-all duration-500 h-full flex flex-col group relative">
                        <div className="aspect-[4/3] bg-void relative overflow-hidden">
                          {asset.thumbnailUrl ? (
                            <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neon-cyan/5 to-neon-violet/5">
                              <Box className="w-16 h-16 text-white/5" />
                            </div>
                          )}
                          <div className="absolute top-6 left-6 px-4 py-1.5 bg-void/60 backdrop-blur-md rounded-full text-[9px] font-black text-neon-cyan border border-neon-cyan/20 uppercase tracking-widest">
                            {asset.assetType || 'DEV_ASSET'}
                          </div>
                        </div>

                        <div className="p-8 flex-grow flex flex-col">
                          <h3 className="text-xl font-black text-white mb-2 group-hover:text-neon-cyan transition-colors leading-tight">{asset.title}</h3>
                          <p className="text-sm text-white/30 font-medium mb-6 line-clamp-2 flex-grow">{asset.shortDescription}</p>
                          
                          <div className="flex items-center justify-between pt-6 border-t border-white/5">
                            <div className="text-xl font-black text-white">
                              {asset.pricingType === 'free' ? '0.00' : formatPrice(asset.price)}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-black text-white/20">
                              <Zap className="w-3.5 h-3.5" />
                              {asset.engineType || 'GODOT'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stream">
            <div className="max-w-3xl mx-auto space-y-8">
              {posts.length === 0 ? (
                <div className="text-center py-32 border border-dashed border-white/5 rounded-[4rem]">
                  <MessageSquare className="w-16 h-16 text-white/5 mx-auto mb-6" />
                  <h3 className="text-xl font-black text-white/20 uppercase tracking-widest">End of Stream Transmission</h3>
                </div>
              ) : (
                posts.map((post, i) => (
                  <motion.div 
                    key={post.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-10 bg-void-light border border-white/5 rounded-[3rem] space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <img src={creator.avatar} className="w-10 h-10 rounded-full" alt="" />
                        <div>
                          <div className="text-sm font-black text-white uppercase tracking-widest">{creator.username}</div>
                          <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">Network Update</div>
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">Pulse Recorded</div>
                    </div>
                    <p className="text-lg text-white/60 font-medium leading-relaxed">{post.content}</p>
                    {post.mediaUrls?.[0] && (
                      <div className="rounded-[2rem] overflow-hidden border border-white/5">
                        <img src={post.mediaUrls[0]} className="w-full h-auto" alt="" />
                      </div>
                    )}
                    <div className="flex items-center gap-8 pt-4">
                      <button className="flex items-center gap-2 text-white/20 hover:text-neon-cyan transition-colors font-black text-[10px] uppercase tracking-widest">
                        <Star className="w-4 h-4" /> {post.likes} Resonance
                      </button>
                      <button className="flex items-center gap-2 text-white/20 hover:text-neon-cyan transition-colors font-black text-[10px] uppercase tracking-widest">
                        <MessageSquare className="w-4 h-4" /> {post.comments} Responses
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
