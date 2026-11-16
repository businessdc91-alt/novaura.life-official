import { motion } from 'framer-motion';
import { 
  Search as SearchIcon, 
  AlertTriangle as AlertTriangleIcon, 
  FileText as FileTextIcon, 
  CheckCircle as CheckCircleIcon, 
  XCircle as XCircleIcon 
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Asset {
  id: string;
  title: string;
  thumbnailUrl?: string;
  licenseTier?: string;
  status: string;
  creator?: {
    username: string;
  };
}

interface AssetSubmissionsProps {
  pendingAssets: Asset[];
  filteredAssets: Asset[];
  assetSearch: string;
  setAssetSearch: (value: string) => void;
  handleApproveAsset: (id: string) => void;
  handleRejectAsset: (id: string) => void;
}

export const AssetSubmissions = ({
  pendingAssets,
  filteredAssets,
  assetSearch,
  setAssetSearch,
  handleApproveAsset,
  handleRejectAsset
}: AssetSubmissionsProps) => {
  return (
    <motion.div
      key="submissions"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="bg-void-light border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-xl font-bold text-text-primary">
            Asset Submissions
          </h3>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              type="text"
              placeholder="Search assets..."
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              className="pl-10 py-2 bg-void border-white/10 w-64"
            />
          </div>
        </div>

        {/* Pending Section */}
        <div className="mb-8">
          <h4 className="font-medium text-text-primary mb-4 flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-yellow-400" />
            Pending Review ({pendingAssets.length})
          </h4>
          {pendingAssets.length === 0 ? (
            <p className="text-text-muted bg-void p-4 rounded-lg">No pending submissions</p>
          ) : (
            <div className="space-y-3">
              {pendingAssets.map((asset) => (
                <div key={asset.id} className="flex items-center gap-4 p-4 bg-void border border-yellow-400/20 rounded-lg">
                  <div className="w-14 h-14 bg-void-light rounded-lg flex items-center justify-center overflow-hidden">
                    {asset.thumbnailUrl ? (
                      <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
                    ) : (
                      <FileTextIcon className="w-6 h-6 text-text-muted" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className="font-medium text-text-primary">{asset.title}</p>
                    <p className="text-text-muted text-sm">by {asset.creator?.username} • {asset.licenseTier}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveAsset(asset.id)}
                      className="px-4 py-2 bg-neon-lime/20 text-neon-lime rounded-lg hover:bg-neon-lime/30 transition-colors"
                    >
                      <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectAsset(asset.id)}
                      className="px-4 py-2 bg-neon-red/20 text-neon-red rounded-lg hover:bg-neon-red/30 transition-colors"
                    >
                      <XCircleIcon className="w-4 h-4 inline mr-1" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Assets Section */}
        <div>
          <h4 className="font-medium text-text-primary mb-4">All Assets ({filteredAssets.length})</h4>
          <div className="space-y-2">
            {filteredAssets.slice(0, 10).map((asset) => (
              <div key={asset.id} className="flex items-center gap-4 p-3 bg-void rounded-lg">
                <div className="w-10 h-10 bg-void-light rounded-lg flex items-center justify-center overflow-hidden">
                  {asset.thumbnailUrl ? (
                    <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
                  ) : (
                    <FileTextIcon className="w-4 h-4 text-text-muted" />
                  )}
                </div>
                <div className="flex-grow">
                  <p className="font-medium text-text-primary">{asset.title}</p>
                  <p className="text-text-muted text-xs">by {asset.creator?.username}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  asset.status === 'approved' ? 'bg-neon-lime/20 text-neon-lime' :
                  asset.status === 'pending' ? 'bg-yellow-400/20 text-yellow-400' :
                  'bg-neon-red/20 text-neon-red'
                }`}>
                  {asset.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
