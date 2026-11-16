import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, 
  Trash2, 
  ArrowRight, 
  Box,
  Shield,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { formatPrice, getLicenseDisplayName } from '@/utils/format';
import type { CartItem } from '@/types';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, total, clearCart } = useCartStore();

  const platformFee = Math.round(total * 0.1);
  const grandTotal = total;

  if (items.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center py-20">
            <ShoppingCart className="w-20 h-20 text-white/10 mx-auto mb-6" />
            <h1 className="font-heading text-3xl font-bold text-text-primary mb-4">
              Your cart is empty
            </h1>
            <p className="text-text-secondary mb-8">
              Browse our marketplace and add some assets to get started.
            </p>
            <Link to="/browse">
              <Button className="bg-gradient-rgb text-void font-bold px-8 py-6">
                Browse Assets
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-heading text-3xl font-bold text-text-primary mb-8">
            Shopping Cart ({items.length})
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {items.map((item: CartItem, index: number) => (
                  <motion.div
                    key={item.assetId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-void-light border border-white/5 rounded-xl p-6"
                  >
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="w-24 h-24 bg-void rounded-lg flex items-center justify-center flex-shrink-0">
                        <Box className="w-10 h-10 text-white/20" />
                      </div>

                      {/* Content */}
                      <div className="flex-grow">
                        <div className="flex items-start justify-between">
                          <div>
                            <Link 
                              to={`/asset/${item.asset.slug}`}
                              className="font-medium text-text-primary hover:text-neon-cyan transition-colors"
                            >
                              {item.asset.title}
                            </Link>
                            <p className="text-text-muted text-sm mt-1">
                              by {item.asset.creator?.username || 'Unknown'}
                            </p>
                            <p className="text-sm text-neon-violet mt-2">
                              {getLicenseDisplayName(item.asset.licenseTier)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(item.assetId)}
                            className="text-text-muted hover:text-neon-red transition-colors p-2"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="font-heading text-xl font-bold text-neon-cyan">
                          {formatPrice(item.customPrice ?? item.asset.price)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Clear Cart */}
              <button
                onClick={clearCart}
                className="mt-4 text-text-muted hover:text-neon-red transition-colors text-sm"
              >
                Clear cart
              </button>
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-void-light border border-white/5 rounded-xl p-6 mb-6">
                  <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
                    Order Summary
                  </h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-text-secondary">
                      <span>Subtotal</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Platform Fee (10%)</span>
                      <span>{formatPrice(platformFee)}</span>
                    </div>
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex justify-between">
                        <span className="font-medium text-text-primary">Total</span>
                        <span className="font-heading text-2xl font-bold text-neon-cyan">
                          {formatPrice(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-gradient-rgb text-void font-bold py-6 hover:opacity-90"
                    onClick={() => navigate('/checkout')}
                  >
                    Proceed to Checkout
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                  <p className="text-center text-text-muted text-sm mt-4">
                    or{' '}
                    <Link to="/browse" className="text-neon-cyan hover:text-neon-cyan/80">
                      continue shopping
                    </Link>
                  </p>
                </div>

                {/* Trust Badges */}
                <div className="bg-void-light border border-white/5 rounded-xl p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-text-secondary">
                      <Shield className="w-5 h-5 text-neon-cyan" />
                      <span className="text-sm">Secure checkout</span>
                    </div>
                    <div className="flex items-center gap-3 text-text-secondary">
                      <FileText className="w-5 h-5 text-neon-cyan" />
                      <span className="text-sm">License agreement included</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
