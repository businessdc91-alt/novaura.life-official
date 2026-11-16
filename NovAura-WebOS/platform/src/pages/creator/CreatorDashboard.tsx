import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Download, 
  DollarSign, 
  Package,
  ArrowUpRight,
  Box,
  Plus,
  Eye,
  Star,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  BarChart3
} from 'lucide-react';
import { 
  getAssetsByCreator, 
  getCreatorStats,
  getOrders
} from '@/services/marketService';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice, getLicenseBadgeClass, getLicenseShortName } from '@/utils/format';
import type { Asset, CreatorStats } from '@/types';

export default function CreatorDashboard() {
  const { user } = useAuthStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<CreatorStats>({
    totalAssets: 0,
    totalSales: 0,
    totalDownloads: 0,
    totalEarnings: 0,
    pendingRoyalties: 0,
    availableRoyalties: 0,
    lifetimeRoyalties: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const [userAssets, creatorStats, orders] = await Promise.all([
          getAssetsByCreator((user as any).id),
          getCreatorStats((user as any).id),
          getOrders((user as any).id)
        ]);
        
        setAssets(userAssets);
        setStats(creatorStats);
        
        // Generate recent activity from orders
        const userAssetIds = userAssets.map(a => a.id);
        const userOrders = orders.filter(o => 
          o.items.some(i => userAssetIds.includes(i.assetId))
        ).slice(0, 5);
        
        setRecentActivity(userOrders.map(o => ({
          type: 'sale',
          date: o.createdAt,
          amount: o.totalAmount,
          buyer: o.buyerId,
        })));
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDashboardData();
  }, [user]);

  // Calculate additional stats
  const approvedAssets = assets.filter(a => a.status === 'approved');
  const pendingAssets = assets.filter(a => a.status === 'pending');
  const totalViews = assets.reduce((sum, a) => sum + (a.viewCount || 0), 0);
  const avgRating = assets.length > 0 
    ? assets.reduce((sum, a) => sum + (a.ratingAverage || 0), 0) / assets.length 
    : 0;

  const statCards = [
    { 
      label: 'Total Earnings', 
      value: stats.lifetimeRoyalties, 
      icon: DollarSign, 
      format: 'price',
      color: 'neon-cyan',
      trend: '+12%'
    },
    { 
      label: 'Total Sales', 
      value: stats.totalSales, 
      icon: Package, 
      format: 'number',
      color: 'neon-violet',
      trend: '+5'
    },
    { 
      label: 'Downloads', 
      value: stats.totalDownloads, 
      icon: Download, 
      format: 'number',
      color: 'neon-lime',
      trend: '+23%'
    },
    { 
      label: 'Available Now', 
      value: stats.availableRoyalties, 
      icon: DollarSign, 
      format: 'price',
      color: 'neon-magenta',
      trend: null
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-neon-lime bg-neon-lime/10';
      case 'pending': return 'text-yellow-400 bg-yellow-400/10';
      case 'rejected': return 'text-neon-red bg-neon-red/10';
      case 'draft': return 'text-text-muted bg-white/5';
      default: return 'text-text-muted bg-white/5';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return CheckCircle;
      case 'pending': return Clock;
      case 'rejected': return AlertCircle;
      default: return FileText;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">
            Creator Dashboard
          </h1>
          <p className="text-text-secondary">
            Welcome back, {user?.username || 'Creator'}! Here's how your assets are performing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-4 py-2 bg-void-light border border-white/10 rounded-lg text-text-primary text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Link to="/creator/assets/new">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-rgb text-void font-bold rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Upload
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-void-light border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg bg-${stat.color}/10 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${stat.color}`} />
                </div>
                {stat.trend && (
                  <span className="text-xs text-neon-lime bg-neon-lime/10 px-2 py-1 rounded-full">
                    {stat.trend}
                  </span>
                )}
              </div>
              <p className="text-text-muted text-sm mb-1">{stat.label}</p>
              <p className="font-heading text-2xl font-bold text-text-primary">
                {stat.format === 'number' 
                  ? stat.value.toLocaleString() 
                  : formatPrice(stat.value)
                }
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-void-light border border-white/5 rounded-xl p-4">
          <p className="text-text-muted text-xs mb-1">Published Assets</p>
          <p className="font-heading text-xl font-bold text-text-primary">{approvedAssets.length}</p>
        </div>
        <div className="bg-void-light border border-white/5 rounded-xl p-4">
          <p className="text-text-muted text-xs mb-1">Pending Review</p>
          <p className="font-heading text-xl font-bold text-yellow-400">{pendingAssets.length}</p>
        </div>
        <div className="bg-void-light border border-white/5 rounded-xl p-4">
          <p className="text-text-muted text-xs mb-1">Total Views</p>
          <p className="font-heading text-xl font-bold text-text-primary">{totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-void-light border border-white/5 rounded-xl p-4">
          <p className="text-text-muted text-xs mb-1">Avg Rating</p>
          <p className="font-heading text-xl font-bold text-neon-cyan">{avgRating.toFixed(1)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Assets List */}
        <div className="lg:col-span-2">
          <div className="bg-void-light border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl font-bold text-text-primary">
                Your Assets
              </h2>
              <Link 
                to="/creator/assets" 
                className="text-neon-cyan hover:text-neon-cyan/80 text-sm flex items-center gap-1"
              >
                View All
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            {assets.length === 0 ? (
              <div className="text-center py-12">
                <Box className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">No assets yet</h3>
                <p className="text-text-secondary mb-6">Upload your first asset to start earning!</p>
                <Link to="/creator/assets/new">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-rgb text-void font-bold rounded-lg"
                  >
                    <Plus className="w-5 h-5" />
                    Upload Your First Asset
                  </motion.div>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {assets.slice(0, 5).map((asset) => {
                  const StatusIcon = getStatusIcon(asset.status);
                  return (
                    <div 
                      key={asset.id} 
                      className="flex items-center gap-4 p-4 bg-void rounded-lg hover:bg-void-light transition-colors"
                    >
                      <div className="w-14 h-14 bg-void-light rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {asset.thumbnailUrl ? (
                          <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
                        ) : (
                          <Box className="w-7 h-7 text-white/20" />
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className="font-medium text-text-primary truncate">{asset.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-text-muted mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${getStatusColor(asset.status)}`}>
                            <StatusIcon className="w-3 h-3" />
                            {asset.status}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {(asset.viewCount || 0).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {(asset.downloadCount || 0).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {(asset.ratingAverage || 0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-heading text-lg font-bold text-neon-cyan">
                          {formatPrice(asset.price)}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded border ${getLicenseBadgeClass(asset.licenseTier)}`}>
                          {getLicenseShortName(asset.licenseTier)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-void-light border border-white/5 rounded-xl p-6">
            <h3 className="font-medium text-text-primary mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link to="/creator/assets/new">
                <div className="flex items-center gap-3 p-3 bg-void rounded-lg hover:bg-void-light transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-neon-cyan" />
                  </div>
                  <span className="text-text-secondary">Upload New Asset</span>
                </div>
              </Link>
              <Link to="/creator/earnings">
                <div className="flex items-center gap-3 p-3 bg-void rounded-lg hover:bg-void-light transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-neon-violet/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-neon-violet" />
                  </div>
                  <span className="text-text-secondary">View Earnings</span>
                </div>
              </Link>
              <Link to="/creator/earnings">
                <div className="flex items-center gap-3 p-3 bg-void rounded-lg hover:bg-void-light transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-neon-lime/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-neon-lime" />
                  </div>
                  <span className="text-text-secondary">Analytics</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-void-light border border-white/5 rounded-xl p-6">
            <h3 className="font-medium text-text-primary mb-4">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-text-muted text-sm">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-4 h-4 text-neon-cyan" />
                    </div>
                    <div className="flex-grow">
                      <p className="text-text-primary">New sale</p>
                      <p className="text-text-muted text-xs">
                        {new Date(activity.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-neon-cyan font-medium">
                      {formatPrice(activity.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-br from-neon-cyan/10 to-neon-violet/10 border border-neon-cyan/20 rounded-xl p-6">
            <h3 className="font-medium text-text-primary mb-2">Creator Tip</h3>
            <p className="text-text-secondary text-sm">
              Assets with high-quality thumbnails and detailed descriptions get 3x more views. 
              Consider adding screenshots and a video demo!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


