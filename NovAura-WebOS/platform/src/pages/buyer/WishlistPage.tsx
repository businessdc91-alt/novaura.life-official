import { motion } from 'framer-motion';
import { ShoppingCart, Box, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/utils/format';

export default function WishlistPage() {
  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-heading text-3xl font-bold text-text-primary mb-8">
            My Wishlist
          </h1>

          <div className="space-y-4">
            {[1, 2, 3].map((_, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-void-light border border-white/5 rounded-xl p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-void rounded-lg flex items-center justify-center">
                    <Box className="w-10 h-10 text-white/20" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-medium text-text-primary text-lg">
                      Neon District UI Kit
                    </h3>
                    <p className="text-text-muted text-sm mt-1">
                      by Studio K-9 • UI Kits & HUDs
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-xl font-bold text-neon-cyan">
                      {formatPrice(4900)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button className="bg-gradient-rgb text-void font-bold">
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Add to Cart
                    </Button>
                    <button className="p-3 text-text-muted hover:text-neon-red transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
