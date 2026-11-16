import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Gift,
  Heart,
  Download,
  Star,
  Search,
  ChevronDown,
  TrendingUp,
  Clock,
  Package,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAssets } from '@/services/marketService';
import { formatPrice } from '@/utils/format';
import type { Asset } from '@/types';

const sortOptions = [
  { value: 'popular', label: 'Most Popular', icon: TrendingUp },
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'rating', label: 'Top Rated', icon: Star },
  { value: 'downloads', label: 'Most Downloads', icon: Download },
];

export default function FreeItemsPage() {
  const [sortBy, setSortBy] = useState<string>('popular');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'donation'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allFreeItems, setAllFreeItems] = useState<Asset[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFreeItems = async () => {
      setIsLoading(true);
      try {
        const assets = await getAssets();
        const freeItems = assets.filter(
          (a: Asset) => (a.pricingType === 'free' || a.pricingType === 'donation') && a.status === 'approved'
        );
        setAllFreeItems(freeItems);
      } catch (error) {
        console.error('Failed to load free items:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFreeItems();
  }, []);

  const filteredItems = useMemo(() => {
    let items = [...allFreeItems];

    if (pricingFilter === 'free') {
      items = items.filter((s: Asset) => s.pricingType === 'free');
    } else if (pricingFilter === 'donation') {
      items = items.filter((s: Asset) => s.pricingType === 'donation');
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((s: Asset) =>
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some((t: string) => t.toLowerCase().includes(query))
      );
    }

    switch (sortBy) {
      case 'newest':
        items.sort((a: Asset, b: Asset) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'rating':
        items.sort((a: Asset, b: Asset) => b.ratingAverage - a.ratingAverage);
        break;
      case 'downloads':
        items.sort((a: Asset, b: Asset) => b.downloadCount - a.downloadCount);
        break;
      case 'popular':
      default:
        items.sort((a: Asset, b: Asset) => (b.downloadCount + b.viewCount) - (a.downloadCount + a.viewCount));
        break;
    }

    return items;
  }, [allFreeItems, pricingFilter, searchQuery, sortBy]);

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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-sm font-medium mb-6">
              <Gift className="w-4 h-4" />
              Free & Pay-What-You-Want
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-text-primary mb-4">
              Free{' '}
              <span className="text-gradient-rgb">Community Assets</span>
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-4">
              Explore free assets shared by generous creators. If you find something useful,
              consider supporting the creator with a donation.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-void-light border border-white/10 rounded-xl text-text-muted text-sm">
              <Heart className="w-4 h-4 text-neon-magenta" />
              Donations help creators keep building amazing things
            </div>
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
                  placeholder="Search free assets..."
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
            </div>

            {/* Pricing Tabs */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              {([
                { key: 'all' as const, label: 'All Free', icon: Package },
                { key: 'free' as const, label: 'Completely Free', icon: Gift },
                { key: 'donation' as const, label: 'Pay What You Want', icon: Heart },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPricingFilter(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pricingFilter === key
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                      : 'bg-void text-text-muted hover:text-text-primary border border-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Results */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-text-secondary text-sm">
              {filteredItems.length} free item{filteredItems.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {/* Grid */}
          {filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-void-light border border-white/5 rounded-2xl"
            >
              <Gift className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-text-primary mb-2">No free items found</h3>
              <p className="text-text-secondary mb-6">
                {searchQuery ? 'Try different search terms.' : 'Be the first to share free assets with the community!'}
              </p>
              <Link to="/creator/assets/new">
                <Button className="bg-gradient-rgb text-void font-bold">
                  Share an Asset
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item: Asset, index: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Link to={`/asset/${item.slug}`}>
                    <div className="group bg-void-light border border-white/5 rounded-xl overflow-hidden hover:border-green-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.05)]">
                      <div className="aspect-video bg-void relative overflow-hidden">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-white/10" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          {item.pricingType === 'free' ? (
                            <span className="px-3 py-1 bg-green-500/90 text-white text-sm font-bold rounded-lg flex items-center gap-1">
                              <Gift className="w-3.5 h-3.5" /> Free
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-neon-violet/90 text-white text-sm font-bold rounded-lg flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5" /> PWYW
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="font-medium text-text-primary group-hover:text-green-400 transition-colors mb-1 truncate">
                          {item.title}
                        </h3>
                        <p className="text-text-muted text-sm mb-3 line-clamp-2">
                          {item.shortDescription}
                        </p>

                        {/* Donation suggestion for PWYW */}
                        {item.pricingType === 'donation' && (item as any).suggestedDonation && (
                          <div className="bg-neon-violet/5 border border-neon-violet/20 rounded-lg px-3 py-2 mb-3">
                            <p className="text-xs text-neon-violet flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Suggested: {formatPrice((item as any).suggestedDonation || 0)}
                            </p>
                          </div>
                        )}

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


