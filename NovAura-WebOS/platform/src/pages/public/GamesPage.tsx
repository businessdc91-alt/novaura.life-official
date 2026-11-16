import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Gamepad2,
  Swords,
  Puzzle,
  Brain,
  Compass,
  Ghost,
  Rocket,
  Crosshair,
  Car,
  Boxes,
  Eye,
  Joystick,
  Filter,
  Star,
  Download,
  ChevronDown,
  Gift,
  DollarSign,
  TrendingUp,
  Clock,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOMeta } from '@/components/seo/SEOMeta';
import { getAssets } from '@/services/marketService';
import { formatPrice } from '@/utils/format';
import type { Asset, GameCategory } from '@/types';

const gameCategories: { id: GameCategory; label: string; icon: typeof Gamepad2; color: string }[] = [
  { id: 'rpg', label: 'RPG', icon: Swords, color: 'text-neon-cyan' },
  { id: 'action', label: 'Action', icon: Crosshair, color: 'text-neon-magenta' },
  { id: 'puzzle', label: 'Puzzle', icon: Puzzle, color: 'text-neon-violet' },
  { id: 'strategy', label: 'Strategy', icon: Brain, color: 'text-yellow-400' },
  { id: 'adventure', label: 'Adventure', icon: Compass, color: 'text-green-400' },
  { id: 'horror', label: 'Horror', icon: Ghost, color: 'text-red-400' },
  { id: 'platformer', label: 'Platformer', icon: Rocket, color: 'text-orange-400' },
  { id: 'shooter', label: 'Shooter', icon: Crosshair, color: 'text-sky-400' },
  { id: 'racing', label: 'Racing', icon: Car, color: 'text-amber-400' },
  { id: 'sandbox', label: 'Sandbox', icon: Boxes, color: 'text-emerald-400' },
  { id: 'vr', label: 'VR', icon: Eye, color: 'text-purple-400' },
  { id: 'card_game', label: 'Card Game', icon: Joystick, color: 'text-pink-400' },
];

const sortOptions = [
  { value: 'popular', label: 'Most Popular', icon: TrendingUp },
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'price_asc', label: 'Price: Low → High', icon: DollarSign },
  { value: 'price_desc', label: 'Price: High → Low', icon: DollarSign },
  { value: 'rating', label: 'Top Rated', icon: Star },
];

export default function GamesPage() {
  const [selectedCategory, setSelectedCategory] = useState<GameCategory | null>(null);
  const [sortBy, setSortBy] = useState<string>('popular');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [allGames, setAllGames] = useState<Asset[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  // Get all games from assets
  useEffect(() => {
    const loadGames = async () => {
      setIsLoading(true);
      try {
        const assets = await getAssets();
        const games = assets.filter((a: Asset) => a.assetType === 'game' && a.status === 'approved');
        setAllGames(games);
      } catch (error) {
        console.error('Failed to load games:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGames();
  }, []);

  const filteredGames = useMemo(() => {
    let games = [...allGames];

    // Category filter
    if (selectedCategory) {
      games = games.filter((g: Asset) => g.category === selectedCategory || g.subcategory === selectedCategory);
    }

    // Pricing filter
    if (pricingFilter === 'free') {
      games = games.filter((g: Asset) => g.pricingType === 'free' || g.pricingType === 'donation');
    } else if (pricingFilter === 'paid') {
      games = games.filter((g: Asset) => g.pricingType === 'fixed' && g.price > 0);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      games = games.filter((g: Asset) =>
        g.title.toLowerCase().includes(query) ||
        g.description.toLowerCase().includes(query) ||
        g.tags.some((t: string) => t.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        games.sort((a: Asset, b: Asset) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'price_asc':
        games.sort((a: Asset, b: Asset) => a.price - b.price);
        break;
      case 'price_desc':
        games.sort((a: Asset, b: Asset) => b.price - a.price);
        break;
      case 'rating':
        games.sort((a: Asset, b: Asset) => b.ratingAverage - a.ratingAverage);
        break;
      case 'popular':
      default:
        games.sort((a: Asset, b: Asset) => b.downloadCount - a.downloadCount);
        break;
    }

    return games;
  }, [allGames, selectedCategory, pricingFilter, searchQuery, sortBy]);

  return (
    <div className="min-h-screen pt-24 pb-12">
      <SEOMeta
        title="Games"
        description="Play and download indie games built by the NovAura community. From RPGs to puzzles — discover what independent developers are shipping."
        keywords={['indie games', 'play games online', 'download games', 'indie developers', 'NovAura games']}
        url="https://novaura.life/games"
      />
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-neon-magenta/10 border border-neon-magenta/30 rounded-full text-neon-magenta text-sm font-medium mb-6">
              <Gamepad2 className="w-4 h-4" />
              Games & Interactive Experiences
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-text-primary mb-4">
              Discover & Publish{' '}
              <span className="text-gradient-rgb">Games</span>
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Browse games built by the community, from polished releases to playable prototypes.
              Publish your own creations and earn royalties.
            </p>
          </motion.div>

          {/* Search & Filters Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-2xl p-4 mb-8"
          >
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-grow relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <Input
                  placeholder="Search games by name, genre, or tags..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-12 py-6 bg-void border-white/10 text-text-primary placeholder:text-text-muted"
                />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)}
                  className="appearance-none bg-void border border-white/10 rounded-lg px-4 py-3 pr-10 text-text-primary text-sm cursor-pointer focus:border-neon-cyan focus:outline-none w-full md:w-48"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              </div>

              {/* Filter Toggle */}
              <Button
                variant="outline"
                className={`border-white/10 ${showFilters ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-white/5"
              >
                <div className="flex flex-wrap gap-2">
                  <span className="text-text-muted text-sm self-center mr-2">Pricing:</span>
                  {(['all', 'free', 'paid'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPricingFilter(opt)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        pricingFilter === opt
                          ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                          : 'bg-void text-text-muted hover:text-text-primary border border-white/5'
                      }`}
                    >
                      {opt === 'all' && 'All'}
                      {opt === 'free' && <><Gift className="w-3 h-3 inline mr-1" /> Free / PWYW</>}
                      {opt === 'paid' && <><DollarSign className="w-3 h-3 inline mr-1" /> Paid</>}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Category Grid */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="font-heading text-lg font-bold text-text-primary mb-4">Browse by Genre</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {gameCategories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan scale-105'
                        : 'bg-void-light border border-white/5 text-text-muted hover:text-text-primary hover:border-white/10'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-neon-cyan' : cat.color}`} />
                    <span className="text-xs font-medium">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-text-secondary text-sm">
              {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''} found
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="ml-2 text-neon-cyan hover:text-neon-cyan/80"
                >
                  × Clear genre
                </button>
              )}
            </p>
          </div>

          {/* Games Grid */}
          {filteredGames.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-void-light border border-white/5 rounded-2xl"
            >
              <Gamepad2 className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-text-primary mb-2">No games found</h3>
              <p className="text-text-secondary mb-6">
                {searchQuery ? 'Try different search terms or filters.' : 'Be the first to publish a game!'}
              </p>
              <Link to="/creator/assets/new">
                <Button className="bg-gradient-rgb text-void font-bold">
                  Publish a Game
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredGames.map((game: Asset, index: number) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Link to={`/asset/${game.slug}`}>
                    <div className="group bg-void-light border border-white/5 rounded-xl overflow-hidden hover:border-neon-cyan/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.05)]">
                      {/* Thumbnail */}
                      <div className="aspect-video bg-void relative overflow-hidden">
                        {game.thumbnailUrl ? (
                          <img
                            src={game.thumbnailUrl}
                            alt={game.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Gamepad2 className="w-12 h-12 text-white/10" />
                          </div>
                        )}
                        {/* Price Badge */}
                        <div className="absolute top-3 right-3">
                          {game.pricingType === 'free' ? (
                            <span className="px-3 py-1 bg-green-500/90 text-white text-sm font-bold rounded-lg">
                              Free
                            </span>
                          ) : game.pricingType === 'donation' ? (
                            <span className="px-3 py-1 bg-neon-violet/90 text-white text-sm font-bold rounded-lg">
                              PWYW
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-void/90 text-neon-cyan text-sm font-bold rounded-lg border border-neon-cyan/30">
                              {formatPrice(game.price)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <h3 className="font-medium text-text-primary group-hover:text-neon-cyan transition-colors mb-1 truncate">
                          {game.title}
                        </h3>
                        <p className="text-text-muted text-sm mb-3 line-clamp-2">
                          {game.shortDescription}
                        </p>
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {game.downloadCount.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400" />
                            {game.ratingAverage.toFixed(1)}
                          </span>
                          <span className="capitalize">{game.engineType}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


