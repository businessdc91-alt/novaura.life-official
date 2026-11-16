import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AppWindow,
  Wrench,
  Puzzle,
  Zap,
  FileCode2,
  Cog,
  BarChart3,
  Rocket,
  Layers,
  Terminal,
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
import { getAssets } from '@/services/marketService';
import { formatPrice } from '@/utils/format';
import type { Asset, SoftwareCategory } from '@/types';

const softwareCategories: { id: SoftwareCategory; label: string; icon: typeof AppWindow; color: string }[] = [
  { id: 'tools', label: 'Tools', icon: Wrench, color: 'text-neon-cyan' },
  { id: 'plugins', label: 'Plugins', icon: Puzzle, color: 'text-neon-magenta' },
  { id: 'utilities', label: 'Utilities', icon: Zap, color: 'text-yellow-400' },
  { id: 'templates', label: 'Templates', icon: FileCode2, color: 'text-neon-violet' },
  { id: 'dev_aids', label: 'Dev Aids', icon: Terminal, color: 'text-green-400' },
  { id: 'editors', label: 'Editors', icon: Layers, color: 'text-orange-400' },
  { id: 'automation', label: 'Automation', icon: Cog, color: 'text-sky-400' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-emerald-400' },
  { id: 'deployment', label: 'Deployment', icon: Rocket, color: 'text-purple-400' },
];

const sortOptions = [
  { value: 'popular', label: 'Most Popular', icon: TrendingUp },
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'price_asc', label: 'Price: Low → High', icon: DollarSign },
  { value: 'price_desc', label: 'Price: High → Low', icon: DollarSign },
  { value: 'rating', label: 'Top Rated', icon: Star },
];

export default function SoftwarePage() {
  const [selectedCategory, setSelectedCategory] = useState<SoftwareCategory | null>(null);
  const [sortBy, setSortBy] = useState<string>('popular');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [allSoftware, setAllSoftware] = useState<Asset[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const assets = await getAssets();
        // Filter to software assets (by category or tags since backend doesn't have assetType field yet)
        const softwareAssets = assets.filter((a: Asset) => 
          a.status === 'approved' && (
            a.category?.toLowerCase().includes('tool') ||
            a.category?.toLowerCase().includes('framework') ||
            a.tags?.some((t: string) => t.toLowerCase().includes('software') || t.toLowerCase().includes('tool'))
          )
        );
        setAllSoftware(softwareAssets);
      } catch (err) {
        console.error('Failed to load software:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAssets();
  }, []);

  const filteredSoftware = useMemo(() => {
    let items = [...allSoftware];

    if (selectedCategory) {
      items = items.filter((s: Asset) => s.category?.toLowerCase().includes(selectedCategory.toLowerCase()));
    }

    if (pricingFilter === 'free') {
      items = items.filter((s: Asset) => s.price === 0);
    } else if (pricingFilter === 'paid') {
      items = items.filter((s: Asset) => s.price > 0);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((s: Asset) =>
        s.title.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.tags?.some((t: string) => t.toLowerCase().includes(query))
      );
    }

    switch (sortBy) {
      case 'newest':
        items.sort((a: Asset, b: Asset) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'price_asc':
        items.sort((a: Asset, b: Asset) => a.price - b.price);
        break;
      case 'price_desc':
        items.sort((a: Asset, b: Asset) => b.price - a.price);
        break;
      case 'rating':
        items.sort((a: Asset, b: Asset) => b.ratingAverage - a.ratingAverage);
        break;
      case 'popular':
      default:
        items.sort((a: Asset, b: Asset) => b.downloadCount - a.downloadCount);
        break;
    }

    return items;
  }, [allSoftware, selectedCategory, pricingFilter, searchQuery, sortBy]);

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-neon-violet/10 border border-neon-violet/30 rounded-full text-neon-violet text-sm font-medium mb-6">
              <AppWindow className="w-4 h-4" />
              Software & Developer Tools
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-text-primary mb-4">
              Tools & Software for{' '}
              <span className="text-gradient-rgb">Creators</span>
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Discover developer tools, plugins, utilities, and templates built by the community.
              Publish your own software and earn from every sale.
            </p>
          </motion.div>

          {/* Search & Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-2xl p-4 mb-8"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-grow relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <Input
                  placeholder="Search tools, plugins, templates..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-12 py-6 bg-void border-white/10 text-text-primary placeholder:text-text-muted"
                />
              </div>

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

              <Button
                variant="outline"
                className={`border-white/10 ${showFilters ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>

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

          {/* Categories */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="font-heading text-lg font-bold text-text-primary mb-4">Browse by Category</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
              {softwareCategories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-neon-violet/10 border border-neon-violet/30 text-neon-violet scale-105'
                        : 'bg-void-light border border-white/5 text-text-muted hover:text-text-primary hover:border-white/10'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-neon-violet' : cat.color}`} />
                    <span className="text-xs font-medium">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Results */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-text-secondary text-sm">
              {filteredSoftware.length} result{filteredSoftware.length !== 1 ? 's' : ''} found
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="ml-2 text-neon-violet hover:text-neon-violet/80"
                >
                  × Clear category
                </button>
              )}
            </p>
          </div>

          {/* Grid */}
          {filteredSoftware.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-void-light border border-white/5 rounded-2xl"
            >
              <AppWindow className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-text-primary mb-2">No software found</h3>
              <p className="text-text-secondary mb-6">
                {searchQuery ? 'Try different search terms or filters.' : 'Be the first to publish developer tools!'}
              </p>
              <Link to="/creator/assets/new">
                <Button className="bg-gradient-rgb text-void font-bold">
                  Publish Software
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredSoftware.map((item: Asset, index: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Link to={`/asset/${item.slug}`}>
                    <div className="group bg-void-light border border-white/5 rounded-xl overflow-hidden hover:border-neon-violet/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.05)]">
                      <div className="aspect-video bg-void relative overflow-hidden">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <AppWindow className="w-12 h-12 text-white/10" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          {item.pricingType === 'free' ? (
                            <span className="px-3 py-1 bg-green-500/90 text-white text-sm font-bold rounded-lg">
                              Free
                            </span>
                          ) : item.pricingType === 'donation' ? (
                            <span className="px-3 py-1 bg-neon-violet/90 text-white text-sm font-bold rounded-lg">
                              PWYW
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-void/90 text-neon-violet text-sm font-bold rounded-lg border border-neon-violet/30">
                              {formatPrice(item.price)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="font-medium text-text-primary group-hover:text-neon-violet transition-colors mb-1 truncate">
                          {item.title}
                        </h3>
                        <p className="text-text-muted text-sm mb-3 line-clamp-2">
                          {item.shortDescription}
                        </p>
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {item.downloadCount.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400" />
                            {item.ratingAverage.toFixed(1)}
                          </span>
                          <span className="capitalize">{item.engineType}</span>
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


