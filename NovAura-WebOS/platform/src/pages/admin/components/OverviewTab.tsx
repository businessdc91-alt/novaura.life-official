import { motion } from 'framer-motion';
import { 
  Users as UsersIcon, 
  FileText as FileTextIcon, 
  AlertTriangle as AlertTriangleIcon, 
  CheckCircle as CheckCircleIcon, 
  Edit3 as Edit3Icon, 
  Crown as CrownIcon 
} from 'lucide-react';

interface OverviewTabProps {
  usersCount: number;
  assetsCount: number;
  pendingAssets: any[];
  agreementsCount: number;
  setActiveTab: (tab: string) => void;
  StatCard: React.ElementType;
}

export const OverviewTab = ({
  usersCount,
  assetsCount,
  pendingAssets,
  agreementsCount,
  setActiveTab,
  StatCard
}: OverviewTabProps) => {
  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          icon={UsersIcon} 
          label="Total Users" 
          value={usersCount} 
          color="neon-cyan" 
        />
        <StatCard 
          icon={FileTextIcon} 
          label="Total Assets" 
          value={assetsCount} 
          color="neon-violet" 
        />
        <StatCard 
          icon={AlertTriangleIcon} 
          label="Pending Review" 
          value={pendingAssets.length} 
          color="neon-magenta" 
        />
        <StatCard 
          icon={CheckCircleIcon} 
          label="Agreements" 
          value={agreementsCount} 
          color="neon-lime" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Submissions */}
        <div className="bg-void-light border border-white/5 rounded-xl p-6">
          <h3 className="font-heading text-lg font-bold text-text-primary mb-4">
            Pending Submissions
          </h3>
          {pendingAssets.length === 0 ? (
            <p className="text-text-muted">No pending submissions</p>
          ) : (
            <div className="space-y-3">
              {pendingAssets.slice(0, 3).map((asset) => (
                <div key={asset.id} className="flex items-center gap-3 p-3 bg-void rounded-lg">
                  <div className="w-10 h-10 bg-void-light rounded-lg flex items-center justify-center">
                    <FileTextIcon className="w-5 h-5 text-text-muted" />
                  </div>
                  <div className="flex-grow">
                    <p className="font-medium text-text-primary">{asset.title}</p>
                    <p className="text-text-muted text-sm">by {asset.creator?.username}</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('submissions')}
                    className="px-3 py-1.5 bg-neon-cyan/10 text-neon-cyan rounded-lg text-sm"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-void-light border border-white/5 rounded-xl p-6">
          <h3 className="font-heading text-lg font-bold text-text-primary mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setActiveTab('content')}
              className="p-4 bg-void rounded-lg hover:bg-void-light transition-colors text-left"
            >
              <Edit3Icon className="w-5 h-5 text-neon-cyan mb-2" />
              <p className="font-medium text-text-primary">Edit Site Content</p>
              <p className="text-text-muted text-sm">Update homepage text</p>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className="p-4 bg-void rounded-lg hover:bg-void-light transition-colors text-left"
            >
              <UsersIcon className="w-5 h-5 text-neon-violet mb-2" />
              <p className="font-medium text-text-primary">Manage Users</p>
              <p className="text-text-muted text-sm">View and edit users</p>
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className="p-4 bg-void rounded-lg hover:bg-void-light transition-colors text-left"
            >
              <CrownIcon className="w-5 h-5 text-neon-magenta mb-2" />
              <p className="font-medium text-text-primary">Assign Roles</p>
              <p className="text-text-muted text-sm">Make admins/mods</p>
            </button>
            <button
              onClick={() => setActiveTab('agreements')}
              className="p-4 bg-void rounded-lg hover:bg-void-light transition-colors text-left"
            >
              <CheckCircleIcon className="w-5 h-5 text-neon-lime mb-2" />
              <p className="font-medium text-text-primary">View Agreements</p>
              <p className="text-text-muted text-sm">Check royalty records</p>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
