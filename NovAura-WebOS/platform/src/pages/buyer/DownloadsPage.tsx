import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Box, FileText, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/apiClient';

interface Order {
  id: string;
  status: string;
  pricePaid: number;
  licenseKey: string | null;
  createdAt: string;
  assetTitle: string;
  assetThumbnail: string;
  downloadUrl: string;
  creatorUsername: string;
}

export default function DownloadsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<{ orders: Order[] }>('/orders/my')
      .then(data => setOrders(data.orders.filter(o => o.status === 'completed')))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (order: Order) => {
    setDownloading(order.id);
    try {
      const data = await apiClient.get<{ url: string; fileName: string }>(`/orders/${order.id}/download`);
      const a = document.createElement('a');
      a.href = data.url;
      a.download = data.fileName || order.assetTitle;
      a.target = '_blank';
      a.click();
    } catch {
      // Fall back to stored URL if fresh fetch fails
      if (order.downloadUrl) {
        window.open(order.downloadUrl, '_blank');
      }
    } finally {
      setDownloading(null);
    }
  };

  const copyLicense = (orderId: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(orderId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-heading text-3xl font-bold text-text-primary mb-8">
            My Downloads
          </h1>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-white/40" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="text-center py-20 text-text-muted">
              <Box className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No purchases yet.</p>
              <p className="text-sm mt-1">Head to the marketplace to find assets.</p>
            </div>
          )}

          <div className="space-y-4">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-void-light border border-white/5 rounded-xl p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-void rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                    {order.assetThumbnail ? (
                      <img src={order.assetThumbnail} alt={order.assetTitle} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Box className="w-8 h-8 text-white/20" />
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-medium text-text-primary truncate">{order.assetTitle}</h3>
                    <p className="text-text-muted text-sm mt-1">
                      {order.creatorUsername && `by ${order.creatorUsername} · `}
                      Purchased {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {order.licenseKey && (
                      <p className="text-white/30 text-xs mt-1 font-mono">{order.licenseKey}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      onClick={() => handleDownload(order)}
                      disabled={downloading === order.id}
                      className="bg-gradient-rgb text-void font-bold"
                    >
                      {downloading === order.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Download
                    </Button>
                    {order.licenseKey && (
                      <Button
                        variant="outline"
                        className="border-white/20"
                        onClick={() => copyLicense(order.id, order.licenseKey!)}
                        title="Copy license key"
                      >
                        {copied === order.id ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </Button>
                    )}
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
