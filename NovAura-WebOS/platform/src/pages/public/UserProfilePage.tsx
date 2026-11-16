import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  MapPin, 
  Twitter, 
  Github, 
  MessageCircle,
  Package,
  Image as ImageIcon,
  Calendar,
  Edit3,
  Globe,
  Cpu,
  Microchip,
  Laptop,
  Monitor,
  MonitorSmartphone,
  MousePointer2,
  Code2,
  Layers,
  UserPlus,
  UserMinus,
  Users,
  Flame,
  Crown,
  ShieldCheck,
  TrendingUp,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { useSocialStore } from '@/stores/socialStore';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAssetsByCreator } from '@/services/marketService';
import { getApprovedSubmissions } from '@/services/galleryService';
import { formatPrice } from '@/utils/format';
import { getUserPosts } from '@/services/socialService';
import type { User as UserType, Asset, GallerySubmission, PortfolioItem, SocialPost } from '@/types';

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuthStore();
  const [profileUser, setProfileUser] = useState<UserType | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [gallerySubmissions, setGallerySubmissions] = useState<GallerySubmission[]>([]);
  const [userPosts, setUserPosts] = useState<SocialPost[]>([]);
  const [activeTab, setActiveTab] = useState<'activity' | 'assets' | 'gallery' | 'portfolio' | 'hardware' | 'about'>('activity');
  const [isLoading, setIsLoading] = useState(true);

  const { followCreator, unfollowCreator, isFollowing, followedCreators } = useSocialStore();
  const isFollowingUser = profileUser ? isFollowing(profileUser.id) : false;

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    const loadProfileData = async () => {
      if (!username) return;
      
      setIsLoading(true);
      try {
        // First check if username is literal 'undefined'
        if (username === 'undefined') {
          setIsLoading(false);
          return; // Leave profileUser null, it will show "User not found"
        }

        // Query Firestore for user by username
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);
        
        let user: UserType | null = null;
        if (!querySnapshot.empty) {
          user = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as UserType;
        } else {
          // Fallback to checking if the 'username' parameter is actually a document ID
          try {
            const docRef = doc(db, 'users', username);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              user = { id: docSnap.id, ...docSnap.data() } as UserType;
            }
          } catch (err) {
            console.warn('Fallback by ID failed:', err);
          }
        }

        if (user) {
          setProfileUser(user);
          const [creatorAssets, userFeed] = await Promise.all([
            getAssetsByCreator(user.id),
            getUserPosts(user.id)
          ]);
          setAssets(creatorAssets.filter(a => a.status === 'approved'));
          setGallerySubmissions(getApprovedSubmissions({ creatorId: user.id }));
          setUserPosts(userFeed);
        }
      } catch (error) {
        console.error('Failed to load profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfileData();
  }, [username]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center py-20">
            <User className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold text-text-primary mb-2">User not found</h1>
            <p className="text-text-secondary">The user you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-void-light border border-white/5 rounded-2xl p-8 mb-8"
          >
            <div className="flex flex-col md:flex-row gap-8">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 rounded-2xl bg-gradient-rgb p-1">
                  {profileUser.avatar ? (
                    <img 
                      src={profileUser.avatar} 
                      alt={profileUser.username}
                      className="w-full h-full rounded-xl bg-void object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-void flex items-center justify-center">
                      <User className="w-16 h-16 text-text-muted" />
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-grow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="font-heading text-3xl font-bold text-text-primary">
                        {profileUser.username}
                      </h1>
                      {profileUser.role === 'admin' && (
                        <span className="px-2 py-1 bg-neon-magenta/20 text-neon-magenta rounded text-xs font-medium">
                          Admin
                        </span>
                      )}
                      {profileUser.role === 'moderator' && (
                        <span className="px-2 py-1 bg-neon-violet/20 text-neon-violet rounded text-xs font-medium">
                          Moderator
                        </span>
                      )}
                      {profileUser.role === 'creator' && (
                        <span className="px-2 py-1 bg-neon-cyan/20 text-neon-cyan rounded text-xs font-medium">
                          Creator
                        </span>
                      )}
                      
                      {/* Membership Tier Badges */}
                      {profileUser.membershipTier === 'catalyst' && (
                        <span className="px-2 py-1 bg-amber-400/20 text-amber-400 border border-amber-400/30 rounded text-xs font-bold flex items-center gap-1">
                          <Flame className="w-3 h-3" /> Catalyst
                        </span>
                      )}
                      {profileUser.membershipTier === 'nova' && (
                        <span className="px-2 py-1 bg-rose-400/20 text-rose-400 border border-rose-400/30 rounded text-xs font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Nova
                        </span>
                      )}
                      {(profileUser.membershipTier === 'investor' || profileUser.membershipTier === 'founding' || profileUser.equityTier) && (
                        <span className="px-2 py-1 bg-neon-lime/20 text-neon-lime border border-neon-lime/30 rounded text-xs font-bold flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Investor
                        </span>
                      )}
                    </div>
                    {profileUser.bio && (
                      <p className="text-text-secondary max-w-xl">{profileUser.bio}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    {!isOwnProfile && (
                      <>
                        <Button
                          onClick={() => {
                            if (profileUser) {
                              if (isFollowingUser) {
                                unfollowCreator(profileUser.id);
                              } else {
                                followCreator(profileUser.id, profileUser.username, profileUser.avatar);
                              }
                            }
                          }}
                          className={`font-bold transition-all ${
                            isFollowingUser
                              ? 'bg-void-light border border-neon-cyan/30 text-neon-cyan hover:border-neon-red hover:text-neon-red'
                              : 'bg-gradient-rgb text-void hover:opacity-90'
                          }`}
                        >
                          {isFollowingUser ? (
                            <><UserMinus className="w-4 h-4 mr-2" /> Following</>
                          ) : (
                            <><UserPlus className="w-4 h-4 mr-2" /> Follow</>
                          )}
                        </Button>
                        <Link to={`/messages/${profileUser.id}`}>
                          <Button variant="outline" className="border-white/20">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Message
                          </Button>
                        </Link>
                      </>
                    )}
                    {isOwnProfile && (
                      <Link to="/settings">
                        <Button variant="outline" className="border-white/20">
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit Profile
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-6 mb-4">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Package className="w-4 h-4" />
                    <span>{assets.length} assets</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Users className="w-4 h-4" />
                    <span>{profileUser.followerCount ?? followedCreators.filter(c => c.userId === profileUser.id).length} followers</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <ImageIcon className="w-4 h-4" />
                    <span>{gallerySubmissions.length} gallery posts</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(profileUser.createdAt).toLocaleDateString()}</span>
                  </div>
                  {profileUser.location && (
                    <div className="flex items-center gap-2 text-text-secondary">
                      <MapPin className="w-4 h-4" />
                      <span>{profileUser.location}</span>
                    </div>
                  )}
                </div>

                {/* Social Links */}
                <div className="flex gap-3">
                  {profileUser.website && (
                    <a 
                      href={profileUser.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-void rounded-lg text-text-muted hover:text-neon-cyan transition-colors"
                    >
                      <Globe className="w-5 h-5" />
                    </a>
                  )}
                  {profileUser.twitter && (
                    <a 
                      href={`https://twitter.com/${profileUser.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-void rounded-lg text-text-muted hover:text-neon-cyan transition-colors"
                    >
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                  {profileUser.github && (
                    <a 
                      href={`https://github.com/${profileUser.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-void rounded-lg text-text-muted hover:text-neon-cyan transition-colors"
                    >
                      <Github className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'activity', label: 'Activity', icon: MessageCircle },
              { id: 'assets', label: 'Assets', icon: Package },
              { id: 'gallery', label: 'Gallery', icon: ImageIcon },
              { id: 'portfolio', label: 'Portfolio', icon: Layers },
              { id: 'hardware', label: 'Hardware', icon: Cpu },
              { id: 'about', label: 'About', icon: User },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                      : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {activeTab === 'activity' && (
              <div className="space-y-6">
                {userPosts.length === 0 ? (
                  <div className="text-center py-16 bg-void-light border border-white/5 rounded-xl">
                    <MessageCircle className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-10" />
                    <p className="text-text-secondary">No posts yet</p>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto space-y-6">
                    {userPosts.map((post) => (
                      <div key={post.id} className="bg-void-light border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                        <p className="text-text-primary text-lg mb-4 whitespace-pre-wrap">{post.content}</p>
                        {post.mediaUrls && post.mediaUrls.length > 0 && (
                          <div className="rounded-xl overflow-hidden mb-4 border border-white/10">
                            <img src={post.mediaUrls[0]} className="w-full h-auto max-h-[400px] object-cover" />
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-text-muted">
                          <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" /> {post.likes}</span>
                          <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> {post.comments}</span>
                          <span className="ml-auto">{new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'assets' && (
              <div>
                {assets.length === 0 ? (
                  <div className="text-center py-16 bg-void-light border border-white/5 rounded-xl">
                    <Package className="w-16 h-16 text-text-muted mx-auto mb-4" />
                    <p className="text-text-secondary">No assets published yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assets.map((asset) => (
                      <Link key={asset.id} to={`/asset/${asset.id}`}>
                        <div className="bg-void-light border border-white/5 rounded-xl overflow-hidden hover:border-neon-cyan/30 transition-colors">
                          <div className="aspect-video bg-void flex items-center justify-center">
                            {asset.thumbnailUrl ? (
                              <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-12 h-12 text-text-muted" />
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-medium text-text-primary mb-1">{asset.title}</h3>
                            <p className="text-neon-cyan font-bold">{formatPrice(asset.price)}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'gallery' && (
              <div>
                {gallerySubmissions.length === 0 ? (
                  <div className="text-center py-16 bg-void-light border border-white/5 rounded-xl">
                    <ImageIcon className="w-16 h-16 text-text-muted mx-auto mb-4" />
                    <p className="text-text-secondary">No gallery posts yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {gallerySubmissions.map((submission) => (
                      <Link key={submission.id} to={`/gallery/${submission.id}`}>
                        <div className="aspect-square bg-void-light border border-white/5 rounded-xl overflow-hidden hover:border-neon-cyan/30 transition-colors">
                          {submission.thumbnailUrl ? (
                            <img 
                              src={submission.thumbnailUrl} 
                              alt={submission.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-text-muted" />
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div>
                {!profileUser.portfolio || profileUser.portfolio.length === 0 ? (
                  <div className="text-center py-16 bg-void-light border border-white/5 rounded-xl">
                    <Layers className="w-16 h-16 text-text-muted mx-auto mb-4" />
                    <p className="text-text-secondary">No portfolio projects to show yet</p>
                    {isOwnProfile && (
                      <Link to="/settings#portfolio">
                        <Button variant="link" className="text-neon-cyan mt-2">
                          Add your first project
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {profileUser.portfolio.map((item: PortfolioItem) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-void-light border border-white/5 rounded-xl overflow-hidden hover:border-neon-cyan/30 transition-all group"
                      >
                        <div className="aspect-video bg-void relative overflow-hidden">
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent opacity-60" />
                          <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                            {item.tags.map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-void/80 border border-white/10 rounded text-[10px] uppercase tracking-wider text-text-primary">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-5">
                          <h4 className="font-heading text-xl font-bold text-text-primary mb-2 flex items-center justify-between">
                            {item.title}
                            <div className="flex gap-2">
                              {item.projectUrl && (
                                <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-void border border-white/5 rounded-lg text-text-muted hover:text-neon-cyan transition-colors" title="Project Repo/Page">
                                  <Code2 className="w-4 h-4" />
                                </a>
                              )}
                              {item.websiteUrl && (
                                <a href={item.websiteUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-void border border-white/5 rounded-lg text-text-muted hover:text-neon-cyan transition-colors" title="Website">
                                  <Globe className="w-4 h-4" />
                                </a>
                              )}
                              {item.liveDemoUrl && (
                                <a href={item.liveDemoUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-neon-cyan/20 border border-neon-cyan/30 rounded-lg text-neon-cyan hover:bg-neon-cyan/30 transition-colors" title="Live Demo">
                                  <MonitorSmartphone className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </h4>
                          <p className="text-text-secondary text-sm mb-4 line-clamp-3">{item.description}</p>
                          
                          {item.screenshotUrls.length > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                              {item.screenshotUrls.slice(0, 4).map((url, i) => (
                                <div key={i} className="aspect-square rounded-lg bg-void border border-white/5 overflow-hidden">
                                  <img src={url} alt={`${item.title} screenshot`} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'hardware' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {!profileUser.hardwareSpecs ? (
                  <div className="col-span-full text-center py-16 bg-void-light border border-white/5 rounded-xl">
                    <Cpu className="w-16 h-16 text-text-muted mx-auto mb-4" />
                    <p className="text-text-secondary">No hardware specs listed yet</p>
                    {isOwnProfile && (
                      <Link to="/settings#hardware">
                        <Button variant="link" className="text-neon-cyan mt-2">
                          Configure your setup
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="bg-void-light border border-white/5 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 flex items-center justify-center text-neon-cyan">
                        <Microchip className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider">GPU / Graphics</p>
                        <p className="text-text-primary font-bold">{profileUser.hardwareSpecs.gpu || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="bg-void-light border border-white/5 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-neon-magenta/10 flex items-center justify-center text-neon-magenta">
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider">CPU / Processor</p>
                        <p className="text-text-primary font-bold">{profileUser.hardwareSpecs.cpu || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="bg-void-light border border-white/5 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-neon-violet/10 flex items-center justify-center text-neon-violet">
                        <Layers className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider">RAM / Memory</p>
                        <p className="text-text-primary font-bold">{profileUser.hardwareSpecs.ram || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="bg-void-light border border-white/5 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-sky-400/10 flex items-center justify-center text-sky-400">
                        <Monitor className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider">Monitor / Display</p>
                        <p className="text-text-primary font-bold">{profileUser.hardwareSpecs.monitor || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="bg-void-light border border-white/5 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-400/10 flex items-center justify-center text-green-400">
                        <Laptop className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider">Operating System</p>
                        <p className="text-text-primary font-bold">{profileUser.hardwareSpecs.os || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="bg-void-light border border-white/5 rounded-xl p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-yellow-400/10 flex items-center justify-center text-yellow-400">
                        <MousePointer2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider">Peripherals</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {profileUser.hardwareSpecs.peripherals?.slice(0, 3).map(p => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-text-secondary">{p}</span>
                          )) || <span className="text-text-muted font-bold">None</span>}
                        </div>
                      </div>
                    </div>
                    {profileUser.hardwareSpecs.notes && (
                      <div className="col-span-full bg-void-light border border-white/5 rounded-xl p-5">
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Setup Notes</p>
                        <p className="text-text-secondary text-sm italic">{profileUser.hardwareSpecs.notes}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'about' && (
              <div className="bg-void-light border border-white/5 rounded-xl p-6">
                <h3 className="font-heading text-xl font-bold text-text-primary mb-4">About</h3>
                <div className="space-y-4 text-text-secondary">
                  {profileUser.bio ? (
                    <p>{profileUser.bio}</p>
                  ) : (
                    <p className="text-text-muted italic">No bio provided</p>
                  )}
                  
                  {/* Equity & Governance Section */}
                  {(profileUser.shares || profileUser.equityTier) && (
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <h4 className="font-medium text-text-primary mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-neon-lime" /> Equity & Governance
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <span className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">Ownership</span>
                          <p className="text-neon-lime font-bold text-lg">{profileUser.shares?.toLocaleString() || 0} Shares</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <span className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">Investment Tier</span>
                          <p className="text-text-primary font-bold text-lg">{profileUser.equityTier || 'Early Participant'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-white/10 pt-4 mt-4">
                    <h4 className="font-medium text-text-primary mb-2">Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-text-muted text-sm">Role</span>
                        <p className="capitalize">{profileUser.role}</p>
                      </div>
                      <div>
                        <span className="text-text-muted text-sm">Joined</span>
                        <p>{new Date(profileUser.createdAt).toLocaleDateString()}</p>
                      </div>
                      {profileUser.location && (
                        <div>
                          <span className="text-text-muted text-sm">Location</span>
                          <p>{profileUser.location}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}


