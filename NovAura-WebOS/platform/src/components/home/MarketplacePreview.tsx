import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Box, Star, TrendingUp, Package,
  Gamepad2, Wrench, Layout, Image, Music,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { platformCategories, getAssets, getFeaturedAssets } from '@/services/marketService';
import { formatPrice } from '@/utils/format';
import type { Asset } from '@/types';
import { useHighlightStore } from '@/stores/highlightStore';

const iconMap: Record<string, typeof Box> = { Gamepad2, Wrench, Layout, Image, Box, Music };

export default function MarketplacePreview() {
  const [featuredAssets, setFeaturedAssets] = useState<Asset[]>([]);
  const [trendingAssets, setTrendingAssets] = useState<Asset[]>([]);
  const { staffPicks, paidPromotions } = useHighlightStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [allAssets, featured] = await Promise.all([getAssets(), getFeaturedAssets()]);

        let highlights: Asset[] = [];
        if (paidPromotions.length > 0 || staffPicks.length > 0) {
          const promoted = allAssets.filter((a: Asset) => paidPromotions.includes(a.id));
          const picks = allAssets.filter((a: Asset) => staffPicks.includes(a.id));
          const combined = [...promoted, ...picks];
          highlights = combined.filter((v, i, a) => a.findIndex((t: Asset) => t.id === v.id) === i);
        }
        if (highlights.length === 0) highlights = featured.slice(0, 4);

        setFeaturedAssets(highlights);
        setTrendingAssets(featured.slice(0, 4));
      } catch (err) {
        console.error('Failed to load marketplace data:', err);
      }
    };
    loadData();
  }, [staffPicks, paidPromotions]);

  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-between mb-10"
        >
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-2">
              <span className="text-neon-cyan">Marketplace</span>
            </h2>
            <p className="text-text-secondary">Digital assets from our creator community</p>
          </div>
          <Link to="/browse" className="hidden sm:flex items-center gap-2 text-neon-cyan hover:text-neon-cyan/80 transition-colors">
            Browse All <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Categories Strip */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-8 scrollbar-hide">
          {platformCategories.map((cat, i) => {
            const Icon = iconMap[cat.icon] || Box;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/browse/${cat.slug}`}
                  className="group flex items-center gap-2 px-4 py-2.5 bg-void-light border border-white/5 rounded-lg whitespace-nowrap card-hover"
                >
                  <Icon className="w-4 h-4 text-neon-cyan group-hover:text-neon-cyan/80" />
                  <span className="text-sm text-text-primary group-hover:text-neon-cyan transition-colors">{cat.name}</span>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Featured Assets Grid */}
        {featuredAssets.length === 0 ? (
          <div className="text-center py-12 bg-void-light/50 border border-white/5 rounded-xl">
            <Package className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No assets yet</h3>
            <p className="text-text-secondary text-sm mb-4">Be the first to publish on NovAura!</p>
            <Link to="/creator/assets/new">
              <Button className="bg-gradient-rgb text-void font-bold">
                Upload Asset <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredAssets.map((asset, i) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to={`/asset/${asset.slug}`} className="group block">
                  <div className="bg-void-light border border-white/5 rounded-xl overflow-hidden card-hover relative">
                    {paidPromotions.includes(asset.id) && (
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-neon-cyan text-void text-[8px] font-black uppercase tracking-widest rounded">
                        Promoted
                      </div>
                    )}
                    {staffPicks.includes(asset.id) && (
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-neon-lime text-void text-[8px] font-black uppercase tracking-widest rounded">
                        Staff Pick
                      </div>
                    )}
                    <div className="aspect-video bg-void relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Box className="w-10 h-10 text-white/20" />
                      </div>
                      {asset.ratingAverage > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-void/80 rounded-lg">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-medium">{asset.ratingAverage}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-text-primary mb-1 group-hover:text-neon-cyan transition-colors line-clamp-1">
                        {asset.title}
                      </h3>
                      <p className="text-text-muted text-sm mb-2">by {asset.creator?.username || 'Unknown'}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-heading text-lg font-bold text-neon-cyan">
                          {asset.price === 0 ? 'Free' : formatPrice(asset.price)}
                        </span>
                        <span className="text-text-muted text-xs">{(asset.downloadCount || 0).toLocaleString()} downloads</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Trending Row */}
        {trendingAssets.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-neon-magenta" />
              <h3 className="font-heading text-xl font-bold text-text-primary">Trending</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trendingAssets.map((asset, i) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link to={`/asset/${asset.slug}`} className="group flex items-center gap-3 p-3 bg-void-light border border-white/5 rounded-lg card-hover">
                    <div className="w-12 h-12 rounded-lg bg-void flex items-center justify-center shrink-0">
                      <Box className="w-6 h-6 text-white/20" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <h4 className="text-sm font-medium text-text-primary group-hover:text-neon-cyan transition-colors truncate">
                        {asset.title}
                      </h4>
                      <p className="text-text-muted text-xs">{(asset.downloadCount || 0).toLocaleString()} downloads</p>
                    </div>
                    <span className="font-heading font-bold text-neon-cyan text-sm shrink-0">
                      {asset.price === 0 ? 'Free' : formatPrice(asset.price)}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile View All */}
        <div className="sm:hidden text-center mt-8">
          <Link to="/browse">
            <Button variant="outline" className="border-neon-cyan/30 text-neon-cyan">
              View All Assets <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
