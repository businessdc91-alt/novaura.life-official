import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Edit,
  Eye,
  Trash2,
  Box
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAssetsByCreator } from '@/services/marketService';
import { formatPrice } from '@/utils/format';
import { useAuthStore } from '@/stores/authStore';
import type { Asset, AssetStatus } from '@/types';

const statusColors: Record<AssetStatus, string> = {
  draft: 'bg-text-muted/20 text-text-muted',
  pending: 'bg-yellow-400/20 text-yellow-400',
  approved: 'bg-neon-lime/20 text-neon-lime',
  rejected: 'bg-neon-red/20 text-neon-red',
};

const statusLabels: Record<AssetStatus, string> = {
  draft: 'Draft',
  pending: 'Pending Review',
  approved: 'Published',
  rejected: 'Rejected',
};

export default function CreatorAssets() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssets = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const creatorAssets = await getAssetsByCreator(user.id);
        setAssets(creatorAssets);
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAssets();
  }, [user]);
  
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">
            My Assets
          </h1>
          <p className="text-text-secondary">
            Manage and track your published assets
          </p>
        </div>
        <Link to="/creator/assets/new">
          <Button className="bg-gradient-rgb text-void font-bold">
            <Plus className="w-5 h-5 mr-2" />
            Upload New Asset
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <Input
            type="text"
            placeholder="Search your assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-void-light border-white/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'all')}
          className="px-4 py-2 bg-void-light border border-white/10 rounded-lg text-text-primary"
        >
          <option value="all">All Status</option>
          <option value="approved">Published</option>
          <option value="pending">Pending Review</option>
          <option value="draft">Draft</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Assets Table */}
      <div className="bg-void-light border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-4 text-text-secondary font-medium">Asset</th>
                <th className="text-left px-6 py-4 text-text-secondary font-medium">Price</th>
                <th className="text-left px-6 py-4 text-text-secondary font-medium">Status</th>
                <th className="text-left px-6 py-4 text-text-secondary font-medium">Downloads</th>
                <th className="text-left px-6 py-4 text-text-secondary font-medium">Rating</th>
                <th className="text-left px-6 py-4 text-text-secondary font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                    <Box className="w-16 h-16 mx-auto mb-4 text-white/10" />
                    <p>No assets found</p>
                    <p className="text-sm mt-1">Upload your first asset to get started</p>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <motion.tr
                    key={asset.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-void flex items-center justify-center overflow-hidden">
                          {asset.thumbnailUrl ? (
                            <img
                              src={asset.thumbnailUrl}
                              alt={asset.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Box className="w-6 h-6 text-text-muted" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-text-primary">{asset.title}</h3>
                          <p className="text-sm text-text-secondary">{asset.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-heading font-bold text-neon-cyan">
                        {formatPrice(asset.price)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[asset.status]}`}>
                        {statusLabels[asset.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {asset.downloadCount?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-text-secondary">{asset.ratingAverage || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link to={`/asset/${asset.slug || asset.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link to={`/creator/assets/${asset.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" className="text-neon-red hover:text-neon-red">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
