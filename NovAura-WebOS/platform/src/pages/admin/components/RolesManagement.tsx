import { motion } from 'framer-motion';
import { 
  Crown as CrownIcon, 
  Shield as ShieldIcon, 
  Star as StarIcon, 
  Zap as ZapIcon 
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  role: string;
}

interface RolesManagementProps {
  users: User[];
  staffOnboarding: boolean;
  toggleStaffOnboarding: (value: boolean) => void;
  setActiveTab: (tab: string) => void;
  RoleCard: React.ElementType;
}

export const RolesManagement = ({
  users,
  staffOnboarding,
  toggleStaffOnboarding,
  setActiveTab,
  RoleCard
}: RolesManagementProps) => {
  return (
    <motion.div
      key="roles"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="bg-void-light border border-white/5 rounded-xl p-6">
        <h3 className="font-heading text-xl font-bold text-text-primary mb-6">
          Role & Title Management
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <RoleCard
            icon={CrownIcon}
            title="Owner"
            description="Full platform control"
            color="text-neon-magenta"
            bgColor="bg-neon-magenta/10"
            count={users.filter(u => u.email === 'the.lost.catalyst@gmail.com').length}
          />
          <RoleCard
            icon={ShieldIcon}
            title="Admin"
            description="Manage users & content"
            color="text-neon-violet"
            bgColor="bg-neon-violet/10"
            count={users.filter(u => u.role === 'admin').length}
          />
          <RoleCard
            icon={StarIcon}
            title="Moderator"
            description="Review submissions"
            color="text-neon-cyan"
            bgColor="bg-neon-cyan/10"
            count={users.filter(u => u.role === 'moderator').length}
          />
          <RoleCard
            icon={ZapIcon}
            title="Creator"
            description="Can upload assets"
            color="text-neon-lime"
            bgColor="bg-neon-lime/10"
            count={users.filter(u => u.role === 'creator').length}
          />
        </div>

        <div className="bg-void rounded-lg p-4">
          <h4 className="font-medium text-text-primary mb-4">Assign Roles</h4>
          <p className="text-text-muted text-sm mb-4">
            Select a user from the Users tab and click the menu to assign roles.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className="px-4 py-2 bg-neon-cyan/10 text-neon-cyan rounded-lg"
            >
              Go to Users
            </button>
          </div>
        </div>

        {/* Staff Onboarding Toggle */}
        <div className="mt-6 bg-void rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-text-primary">Staff Onboarding</h4>
              <p className="text-text-muted text-sm mt-1">
                Controls whether new staff can register at <span className="text-neon-cyan">/staff-login</span>.
                Disable this after your team is set up.
              </p>
            </div>
            <button
              onClick={() => toggleStaffOnboarding(!staffOnboarding)}
              className={`relative w-12 h-6 rounded-full transition-colors flex items-center ${
                staffOnboarding ? 'bg-neon-cyan' : 'bg-white/10'
              }`}
            >
              <span className={`absolute w-5 h-5 bg-white rounded-full shadow transition-transform ${
                staffOnboarding ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className={`mt-3 text-xs px-3 py-1.5 rounded inline-block ${
            staffOnboarding
              ? 'bg-neon-lime/10 text-neon-lime'
              : 'bg-neon-red/10 text-neon-red'
          }`}>
            {staffOnboarding ? 'OPEN — staff can register' : 'CLOSED — registration locked'}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
