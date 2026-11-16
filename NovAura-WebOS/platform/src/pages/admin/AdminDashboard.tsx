import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Package, 
  DollarSign,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { 
  getAssets, 
  getPendingAssets, 
  approveAsset, 
  rejectAsset,
  getStoredOrders
} from '@/services/marketService';
import { useUIStore } from '@/stores/uiStore';
import type { Asset, Order } from '@/types';

export default function AdminDashboard() {
  const { addToast } = useUIStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pendingAssets, setPendingAssets] = useState<Asset[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingAssetId, setRejectingAssetId] = useState<string | null>(null);

  // Define loadData with useCallback BEFORE useEffect hooks that use it
  const loadData = useCallback(async () => {
    try {
      const [allAssets, pending, orders] = await Promise.all([
        getAssets(),
        getPendingAssets(),
        getStoredOrders()
      ]);
      setAssets(allAssets);
      setPendingAssets(pending);
      setOrders(orders);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate real stats
  const approvedAssets = assets.filter(a => a.status === 'approved');
  const uniqueCreators = new Set(assets.map(a => a.creatorId));
  const uniqueBuyers = new Set(orders.map(o => o.buyerId));
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  // Total paid to creators (for future use)
  // const totalPaidToCreators = royalties.reduce((sum, r) => sum + r.amount, 0);

  const stats = [
    { 
      label: 'Total Users', 
      value: (uniqueCreators.size + uniqueBuyers.size).toString(), 
      icon: Users, 
      color: 'neon-cyan' 
    },
    { 
      label: 'Total Assets', 
      value: approvedAssets.length.toString(), 
      icon: Package, 
      color: 'neon-violet' 
    },
    { 
      label: 'Total Revenue', 
      value: `$${(totalRevenue / 100).toFixed(0)}`, 
      icon: DollarSign, 
      color: 'neon-lime' 
    },
    { 
      label: 'Pending Review', 
      value: pendingAssets.length.toString(), 
      icon: AlertCircle, 
      color: 'neon-magenta' 
    },
  ];

  const handleApprove = async (assetId: string) => {
    try {
      await approveAsset(assetId);
      addToast({
        type: 'success',
        title: 'Asset approved',
        message: 'The asset has been approved and is now live.',
      });
      loadData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to approve',
        message: 'Could not approve asset. Please try again.',
      });
    }
  };

  const handleReject = async (assetId: string) => {
    if (!rejectionReason.trim()) {
      setRejectingAssetId(assetId);
      return;
    }
    try {
      await rejectAsset(assetId, rejectionReason);
      addToast({
        type: 'info',
        title: 'Asset rejected',
        message: 'The asset has been rejected.',
      });
      setRejectingAssetId(null);
      setRejectionReason('');
      loadData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to reject',
        message: 'Could not reject asset. Please try again.',
      });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">
          Admin Dashboard
        </h1>
        <p className="text-text-secondary">
          Platform overview and management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses: Record<string, { bg: string; text: string }> = {
            'neon-cyan': { bg: 'bg-neon-cyan/10', text: 'text-neon-cyan' },
            'neon-violet': { bg: 'bg-neon-violet/10', text: 'text-neon-violet' },
            'neon-lime': { bg: 'bg-neon-lime/10', text: 'text-neon-lime' },
            'neon-magenta': { bg: 'bg-neon-magenta/10', text: 'text-neon-magenta' },
          };
          const colorClass = colorClasses[stat.color];
          
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-void-light border border-white/5 rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg ${colorClass.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${colorClass.text}`} />
                </div>
              </div>
              <p className="text-text-muted text-sm mb-1">{stat.label}</p>
              <p className="font-heading text-2xl font-bold text-text-primary">
                {stat.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Pending Approvals */}
      <div className="bg-void-light border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl font-bold text-text-primary">
            Pending Approvals
          </h2>
          <span className="px-3 py-1 bg-neon-magenta/20 text-neon-magenta rounded-full text-sm font-medium">
            {pendingAssets.length} pending
          </span>
        </div>

        {pendingAssets.length > 0 ? (
          <div className="space-y-4">
            {pendingAssets.map((asset) => (
              <div 
                key={asset.id}
                className="flex flex-col gap-4 p-4 bg-void rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-void-light rounded-lg flex items-center justify-center overflow-hidden">
                    {asset.thumbnailUrl ? (
                      <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-white/20" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-medium text-text-primary">{asset.title}</h3>
                    <p className="text-sm text-text-muted">
                      by {asset.creator?.username || 'Unknown'} • {asset.category} • {asset.licenseTier}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApprove(asset.id)}
                      className="px-4 py-2 bg-neon-lime/20 text-neon-lime rounded-lg text-sm font-medium hover:bg-neon-lime/30 transition-colors flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button 
                      onClick={() => setRejectingAssetId(rejectingAssetId === asset.id ? null : asset.id)}
                      className="px-4 py-2 bg-neon-red/20 text-neon-red rounded-lg text-sm font-medium hover:bg-neon-red/30 transition-colors flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
                
                {/* Rejection reason input */}
                {rejectingAssetId === asset.id && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="flex-grow px-4 py-2 bg-void-light border border-white/10 rounded-lg text-text-primary text-sm"
                    />
                    <button
                      onClick={() => handleReject(asset.id)}
                      className="px-4 py-2 bg-neon-red text-void rounded-lg text-sm font-medium"
                    >
                      Confirm Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-text-muted">
            No pending approvals
          </div>
        )}
      </div>
    </div>
  );
}


