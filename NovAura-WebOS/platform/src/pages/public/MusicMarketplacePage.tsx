import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Heart,
  Download,
  Share2,
  Search,
  Clock,
  Disc,
  Mic2,
  Radio,
  Headphones,
  Zap,
  Info
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/utils/format';

import { db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

// Music genres
const genres = [
  { id: 'all', name: 'All', icon: Music },
  { id: 'electronic', name: 'Electronic', icon: Zap },
  { id: 'orchestral', name: 'Orchestral', icon: Disc },
  { id: 'ambient', name: 'Ambient', icon: Radio },
  { id: 'rock', name: 'Rock', icon: Mic2 },
  { id: 'chiptune', name: 'Chiptune', icon: Headphones },
  { id: 'sfx', name: 'Sound Effects', icon: Zap },
];

// Usage types
const usageTypes = [
  { id: 'all', name: 'All Types' },
  { id: 'free', name: 'Free to Use', color: 'text-neon-lime' },
  { id: 'commercial', name: 'Commercial License', color: 'text-neon-cyan' },
  { id: 'exclusive', name: 'Exclusive Rights', color: 'text-neon-magenta' },
];

interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  genre: string;
  duration: number;
  price: number;
  previewUrl: string;
  coverArt: string;
  licenseType: string;
  royaltyRate: number;
  bpm: number;
  tags: string[];
  createdAt: string;
  plays: number;
  likes: number;
  trackCount?: number;
}

// Format duration from seconds to MM:SS
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds === 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function MusicMarketplacePage() {
  const [activeGenre, setActiveGenre] = useState('all');
  const [activeUsage, setActiveUsage] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [likedTracks, setLikedTracks] = useState<string[]>([]);
  
  const progressRef = useRef<HTMLDivElement>(null);

  // Fetch real tracks from Firestore
  useEffect(() => {
    const fetchTracks = async () => {
      if (!db) return;
      
      try {
        const assetsRef = collection(db, 'assets');
        // Approved audio assets ordered by creation date.
        // The status filter is required: security rules only allow public
        // reads of approved assets, and the composite index covers
        // category + status + createdAt.
        const q = query(
          assetsRef,
          where('category', '==', 'audio-music'),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetchedTracks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Track[];
        setTracks(fetchedTracks);
      } catch (err) {
        console.error('Failed to fetch music tracks:', err);
      }
    };

    fetchTracks();
  }, [activeGenre]); // Refresh when switching genres if we decide to fetch only activeGenre

  // Filter tracks Locally for responsiveness
  const filteredTracks = tracks.filter((track) => {
    const matchesGenre = activeGenre === 'all' || track.genre === activeGenre;
    const matchesUsage = activeUsage === 'all' || track.licenseType === activeUsage;
    const matchesSearch = 
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesGenre && matchesUsage && matchesSearch;
  });

  // Play/Pause toggle
  const togglePlay = (track?: Track) => {
    if (track && track.id !== currentTrack?.id) {
      setCurrentTrack(track);
      setIsPlaying(true);
      setShowPlayer(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Handle progress click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !currentTrack) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    setCurrentTime(percent * currentTrack.duration);
  };

  // Toggle like
  const toggleLike = (trackId: string) => {
    setLikedTracks((prev) => 
      prev.includes(trackId) 
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  // Simulated progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && currentTrack) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= currentTrack.duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrack]);

  return (
    <div className="min-h-screen pt-24 pb-32">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-violet/10 border border-neon-violet/30 mb-6">
              <Music className="w-4 h-4 text-neon-violet" />
              <span className="text-sm text-neon-violet font-medium">Audio Marketplace</span>
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold text-text-primary mb-4">
              Music & <span className="text-gradient-rgb">Sound</span>
            </h1>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Discover original music, sound effects, and audio assets for your games. 
              Preview before you buy with our built-in player.
            </p>
          </motion.div>

          {/* Royalty Info Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 p-4 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-neon-cyan flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-neon-cyan mb-1">
                  Music Creator Royalty Program
                </p>
                <p className="text-neon-cyan/80 text-sm">
                  When you use music from a single creator for the majority of your game's audio 
                  (soundtrack, SFX, ambience), that creator receives <strong>1% royalties</strong> on 
                  your commercial revenue. This ensures fair compensation for artists whose work 
                  defines your game's sonic identity.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            {/* Genre Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {genres.map((genre) => {
                const Icon = genre.icon;
                return (
                  <button
                    key={genre.id}
                    onClick={() => setActiveGenre(genre.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      activeGenre === genre.id
                        ? 'bg-neon-violet text-void'
                        : 'bg-void-light text-text-muted border border-white/5 hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{genre.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Search & Usage Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <Input
                  type="text"
                  placeholder="Search tracks, artists, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 py-5 bg-void-light border-white/10 text-text-primary placeholder:text-text-muted rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                {usageTypes.map((usage) => (
                  <button
                    key={usage.id}
                    onClick={() => setActiveUsage(usage.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      activeUsage === usage.id
                        ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                        : 'bg-void-light text-text-muted border border-white/5 hover:border-white/20'
                    }`}
                  >
                    {usage.name}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Tracks Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredTracks.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="group bg-void-light border border-white/5 rounded-xl overflow-hidden hover:border-neon-violet/30 transition-all"
              >
                {/* Cover Art */}
                <div className="relative aspect-square bg-void">
                  <div className="absolute inset-0 bg-gradient-to-br from-neon-violet/20 to-neon-cyan/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Music className="w-16 h-16 text-white/10" />
                  </div>
                  
                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => togglePlay(track)}
                      className="w-14 h-14 rounded-full bg-neon-violet flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      {currentTrack?.id === track.id && isPlaying ? (
                        <Pause className="w-6 h-6 text-void" />
                      ) : (
                        <Play className="w-6 h-6 text-void ml-1" />
                      )}
                    </button>
                  </div>

                  {/* License Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      track.licenseType === 'free'
                        ? 'bg-neon-lime/20 text-neon-lime'
                        : track.licenseType === 'exclusive'
                        ? 'bg-neon-magenta/20 text-neon-magenta'
                        : 'bg-neon-cyan/20 text-neon-cyan'
                    }`}>
                      {track.licenseType === 'free' ? 'Free' : track.licenseType === 'exclusive' ? 'Exclusive' : 'Commercial'}
                    </span>
                  </div>

                  {/* Royalty Badge */}
                  {track.royaltyRate > 0 && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-neon-violet/20 text-neon-violet">
                        {track.royaltyRate}% royalty
                      </span>
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="p-4">
                  <h3 className="font-medium text-text-primary mb-1 truncate group-hover:text-neon-violet transition-colors">
                    {track.title}
                  </h3>
                  <p className="text-text-muted text-sm mb-3">{track.artist}</p>
                  
                  <div className="flex items-center gap-3 text-xs text-text-muted mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(track.duration)}
                    </span>
                    {track.bpm > 0 && (
                      <span>{track.bpm} BPM</span>
                    )}
                    {track.trackCount && (
                      <span>{track.trackCount} tracks</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-heading text-lg font-bold text-neon-cyan">
                      {track.price === 0 ? 'Free' : formatPrice(track.price)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleLike(track.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          likedTracks.includes(track.id)
                            ? 'bg-neon-magenta/20 text-neon-magenta'
                            : 'bg-white/5 text-text-muted hover:text-neon-magenta'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${likedTracks.includes(track.id) ? 'fill-current' : ''}`} />
                      </button>
                      <button className="p-2 bg-neon-cyan/10 text-neon-cyan rounded-lg hover:bg-neon-cyan/20 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Empty State */}
          {filteredTracks.length === 0 && (
            <div className="text-center py-20">
              <Music className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                No tracks found
              </h3>
              <p className="text-text-secondary">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Player Bar */}
      <AnimatePresence>
        {showPlayer && currentTrack && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 bg-void-light border-t border-white/10 z-50"
          >
            <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
              <div className="max-w-7xl mx-auto flex items-center gap-4">
                {/* Track Info */}
                <div className="flex items-center gap-3 w-48 flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-void flex items-center justify-center">
                    <Music className="w-6 h-6 text-text-muted" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-medium text-text-primary truncate">{currentTrack.title}</p>
                    <p className="text-text-muted text-sm truncate">{currentTrack.artist}</p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 flex-grow">
                  <button className="text-text-muted hover:text-text-primary transition-colors">
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => togglePlay()}
                    className="w-10 h-10 rounded-full bg-neon-violet flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 text-void" />
                    ) : (
                      <Play className="w-5 h-5 text-void ml-0.5" />
                    )}
                  </button>
                  <button className="text-text-muted hover:text-text-primary transition-colors">
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 flex-grow max-w-md">
                  <span className="text-xs text-text-muted w-10 text-right">
                    {formatDuration(currentTime)}
                  </span>
                  <div
                    ref={progressRef}
                    onClick={handleProgressClick}
                    className="flex-grow h-1 bg-white/10 rounded-full cursor-pointer"
                  >
                    <div
                      className="h-full bg-neon-violet rounded-full transition-all"
                      style={{ width: `${(currentTime / currentTrack.duration) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-10">
                    {formatDuration(currentTrack.duration)}
                  </span>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2 w-32 flex-shrink-0">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(Number(e.target.value));
                      setIsMuted(false);
                    }}
                    className="flex-grow h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleLike(currentTrack.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      likedTracks.includes(currentTrack.id)
                        ? 'bg-neon-magenta/20 text-neon-magenta'
                        : 'text-text-muted hover:text-neon-magenta'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${likedTracks.includes(currentTrack.id) ? 'fill-current' : ''}`} />
                  </button>
                  <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
