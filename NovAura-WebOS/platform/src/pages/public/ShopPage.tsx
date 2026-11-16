import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  ExternalLink,
  Search,
  Loader2,
  Tag,
  Store,
  Sparkles,
  Package,
  ArrowRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { fetchProducts, getCheckoutUrl, getStoreUrl, type ShopifyProduct } from '@/services/shopifyService';

export default function ShopPage() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    let filtered = products;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedType !== 'all') {
      filtered = filtered.filter((p) => p.productType === selectedType);
    }
    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedType]);

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProducts(50);
      setProducts(data);
      setFilteredProducts(data);
    } catch (err) {
      setError('Unable to load products right now. Visit the store directly!');
      console.error('Shopify fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  const productTypes = ['all', ...new Set(products.map((p) => p.productType).filter(Boolean))];

  function formatPrice(amount: string, currency: string) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(parseFloat(amount));
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="max-w-7xl mx-auto mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-magenta/10 border border-neon-magenta/30 mb-6">
            <Store className="w-4 h-4 text-neon-magenta" />
            <span className="text-neon-magenta text-sm font-semibold">Catalyst's Corner</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-heading font-black text-text-primary mb-4">
            Home Wares & Tech{' '}
            <span className="text-gradient-rgb">Galore</span>
          </h1>

          <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-6">
            Look no further than right next door! Browse our curated collection of home essentials,
            tech gadgets, and lifestyle products.
          </p>

          <a
            href={getStoreUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neon-magenta/10 border border-neon-magenta/30 text-neon-magenta font-semibold hover:bg-neon-magenta/20 transition-all"
          >
            Visit Full Store <ExternalLink className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-void-light border-white/10 text-text-primary"
            />
          </div>

          {productTypes.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {productTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedType === type
                      ? 'bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/30'
                      : 'bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {type === 'all' ? 'All' : type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-neon-magenta animate-spin" />
            <p className="text-text-secondary">Loading products...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-6">{error}</p>
            <a
              href={getStoreUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neon-magenta text-white font-semibold hover:bg-neon-magenta/80 transition-all"
            >
              Go to Catalyst's Corner <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary">No products match your search.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product, i) => (
                <motion.a
                  key={product.id}
                  href={getCheckoutUrl(product.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative bg-void-light border border-white/5 rounded-2xl overflow-hidden hover:border-neon-magenta/30 transition-all duration-300 hover:shadow-lg hover:shadow-neon-magenta/5"
                >
                  {/* Image */}
                  <div className="aspect-square bg-white/5 relative overflow-hidden">
                    {product.featuredImage ? (
                      <img
                        src={product.featuredImage.url}
                        alt={product.featuredImage.altText || product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-12 h-12 text-text-muted" />
                      </div>
                    )}

                    {!product.availableForSale && (
                      <div className="absolute inset-0 bg-void/60 flex items-center justify-center">
                        <span className="px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full text-red-400 text-xs font-bold">
                          Sold Out
                        </span>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                      <span className="flex items-center gap-2 px-4 py-2 bg-neon-magenta/90 rounded-lg text-white text-sm font-semibold">
                        View Product <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-heading font-semibold text-text-primary mb-1 line-clamp-2 group-hover:text-neon-magenta transition-colors">
                      {product.title}
                    </h3>

                    {product.productType && (
                      <div className="flex items-center gap-1 mb-2">
                        <Tag className="w-3 h-3 text-text-muted" />
                        <span className="text-text-muted text-xs">{product.productType}</span>
                      </div>
                    )}

                    <p className="text-text-secondary text-sm line-clamp-2 mb-3">
                      {product.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-neon-lime font-bold text-lg">
                        {formatPrice(
                          product.priceRange.minVariantPrice.amount,
                          product.priceRange.minVariantPrice.currencyCode
                        )}
                      </span>
                      {product.priceRange.minVariantPrice.amount !== product.priceRange.maxVariantPrice.amount && (
                        <span className="text-text-muted text-xs">
                          up to{' '}
                          {formatPrice(
                            product.priceRange.maxVariantPrice.amount,
                            product.priceRange.maxVariantPrice.currencyCode
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Bottom CTA */}
      {!loading && !error && filteredProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-7xl mx-auto mt-12 text-center"
        >
          <div className="p-6 rounded-2xl bg-gradient-to-r from-neon-magenta/5 via-neon-cyan/5 to-neon-lime/5 border border-white/10">
            <Sparkles className="w-6 h-6 text-neon-cyan mx-auto mb-3" />
            <p className="text-text-primary font-heading font-semibold mb-2">
              Want to see the full catalog?
            </p>
            <p className="text-text-secondary text-sm mb-4">
              Catalyst's Corner has even more products available on our Shopify store.
            </p>
            <a
              href={getStoreUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan font-semibold hover:bg-neon-cyan/20 transition-all"
            >
              Browse Full Store <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
