import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Download, Box, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice, formatDate } from '@/utils/format';

interface ApiOrder {
  id: string;
  status: string;
  pricePaid: number;
  licenseKey?: string;
  createdAt: string;
  assetTitle?: string;
  assetThumbnail?: string;
  downloadUrl?: string;
  creatorUsername?: string;
}

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successBanner, setSuccessBanner] = useState<{ show: boolean; items: string[] }>({ show: false, items: [] });
  const [verifying, setVerifying] = useState(false);

  // On mount: if redirected from Stripe with ?success=true&session_id=xxx, verify the session
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');

    if (success === 'true' && sessionId) {
      setVerifying(true);
      apiClient.get<{ verified: boolean; items: { assetTitle: string }[] }>(`/stripe/session/${sessionId}`)
        .then(({ verified, items }) => {
          if (verified) {
            setSuccessBanner({ show: true, items: items.map(i => i.assetTitle).filter(Boolean) });
            // Clear query params without re-navigation
            window.history.replaceState({}, '', '/orders');
          }
        })
        .catch(() => {}) // non-fatal — orders will still load below
        .finally(() => setVerifying(false));
    }
  }, []);

  // Load orders from backend
  useEffect(() => {
    if (!user) return;
    apiClient.get<{ orders: ApiOrder[] }>('/orders/my')
      .then(({ orders }) => setOrders(orders))
      .catch(() => setOrders([]))
      .finally(() => setIsLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">

          {/* Success Banner */}
          <AnimatePresence>
            {successBanner.show && (
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="mb-6 p-4 bg-neon-lime/10 border border-neon-lime/30 rounded-xl flex items-start gap-3"
              >
                <CheckCircle className="w-5 h-5 text-neon-lime shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-neon-lime">Payment confirmed!</p>
                  {successBanner.items.length > 0 && (
                    <p className="text-text-secondary text-sm mt-1">
                      You now have access to: {successBanner.items.join(', ')}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {verifying && (
            <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
              <p className="text-text-secondary text-sm">Verifying your payment...</p>
            </div>
          )}

          <h1 className="font-heading text-3xl font-bold text-text-primary mb-8">
            My Orders
          </h1>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-void-light border border-white/5 rounded-xl p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-text-muted text-sm">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-text-secondary text-sm">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === 'completed'
                        ? 'bg-neon-lime/20 text-neon-lime'
                        : 'bg-yellow-400/20 text-yellow-400'
                    }`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-void rounded-lg mb-4">
                    {order.assetThumbnail ? (
                      <img src={order.assetThumbnail} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-void-light rounded-lg flex items-center justify-center">
                        <Box className="w-6 h-6 text-white/20" />
                      </div>
                    )}
                    <div className="flex-grow">
                      <p className="font-medium text-text-primary">
                        {order.assetTitle || 'Asset'}
                      </p>
                      {order.creatorUsername && (
                        <p className="text-text-muted text-sm">by {order.creatorUsername}</p>
                      )}
                    </div>
                    <span className="font-heading font-bold text-neon-cyan">
                      {formatPrice(order.pricePaid)}
                    </span>
                  </div>

                  {order.licenseKey && (
                    <div className="mb-4 px-3 py-2 bg-neon-violet/10 border border-neon-violet/20 rounded-lg">
                      <p className="text-xs text-text-muted mb-1">License Key</p>
                      <p className="text-sm font-mono text-neon-violet">{order.licenseKey}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div>
                      <p className="text-text-muted text-sm">Total</p>
                      <p className="font-heading text-xl font-bold text-text-primary">
                        {formatPrice(order.pricePaid)}
                      </p>
                    </div>
                    {order.status === 'completed' && order.downloadUrl ? (
                      <a
                        href={order.downloadUrl}
                        className="flex items-center gap-2 px-4 py-2 bg-neon-cyan/10 text-neon-cyan rounded-lg hover:bg-neon-cyan/20 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    ) : order.status === 'completed' ? (
                      <span className="flex items-center gap-2 text-sm text-text-muted">
                        <AlertCircle className="w-4 h-4" />
                        Download pending
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              ))}

              {orders.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <p className="text-text-secondary">No orders yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
