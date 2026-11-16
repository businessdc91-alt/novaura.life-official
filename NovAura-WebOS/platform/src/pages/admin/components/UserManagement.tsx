import { motion } from 'framer-motion';
import { Search as SearchIcon, MoreVertical as MoreVerticalIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar: string;
  createdAt: string;
}

interface UserManagementProps {
  filteredUsers: User[];
  userSearch: string;
  setUserSearch: (value: string) => void;
  setSelectedUser: (user: User) => void;
  setShowRoleModal: (show: boolean) => void;
}

export const UserManagement = ({
  filteredUsers,
  userSearch,
  setUserSearch,
  setSelectedUser,
  setShowRoleModal
}: UserManagementProps) => {
  return (
    <motion.div
      key="users"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="bg-void-light border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-xl font-bold text-text-primary">
            User Management
          </h3>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-10 py-2 bg-void border-white/10 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-text-muted text-sm font-medium px-4 py-3">User</th>
                <th className="text-left text-text-muted text-sm font-medium px-4 py-3">Role</th>
                <th className="text-left text-text-muted text-sm font-medium px-4 py-3">Joined</th>
                <th className="text-right text-text-muted text-sm font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-lg" />
                      <div>
                        <p className="font-medium text-text-primary">{u.username}</p>
                        <p className="text-text-muted text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      u.role === 'admin' ? 'bg-neon-magenta/20 text-neon-magenta' :
                      u.role === 'moderator' ? 'bg-neon-violet/20 text-neon-violet' :
                      u.role === 'creator' ? 'bg-neon-cyan/20 text-neon-cyan' :
                      'bg-white/10 text-text-secondary'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-sm">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setShowRoleModal(true);
                      }}
                      className="p-2 text-text-muted hover:text-neon-cyan transition-colors"
                    >
                      <MoreVerticalIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
