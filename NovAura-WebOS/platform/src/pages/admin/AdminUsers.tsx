import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users as UsersIcon, 
  Search, 
  Shield, 
  User as UserIcon,
  Crown,
  MoreVertical,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// Firestore-based admin functions
const getAllUsers = async () => {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const updateUserRole = async (userId: string, role: string) => {
  if (!db) return;
  await updateDoc(doc(db, 'users', userId), { role });
};

const deleteUser = async (userId: string) => {
  if (!db) return;
  await deleteDoc(doc(db, 'users', userId));
};
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

const roleIcons = {
  admin: Crown,
  creator: Shield,
  buyer: UserIcon,
};

const roleColors = {
  admin: 'text-neon-magenta bg-neon-magenta/10 border-neon-magenta/30',
  creator: 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30',
  buyer: 'text-text-secondary bg-white/5 border-white/10',
};

export default function AdminUsers() {
  const { addToast } = useUIStore();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Define loadUsers with useCallback BEFORE useEffect hooks that use it
  const loadUsers = useCallback(async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleChange = (userId: string, newRole: 'buyer' | 'creator' | 'admin') => {
    updateUserRole(userId, newRole);
    loadUsers();
    setEditingUser(null);
    
    addToast({
      type: 'success',
      title: 'Role updated',
      message: `User role changed to ${newRole}.`,
    });
  };

  const handleDelete = (userId: string) => {
    // Prevent deleting yourself
    if (userId === currentUser?.id) {
      addToast({
        type: 'error',
        title: 'Cannot delete',
        message: 'You cannot delete your own account from here.',
      });
      setShowDeleteConfirm(null);
      return;
    }
    
    deleteUser(userId);
    loadUsers();
    setShowDeleteConfirm(null);
    
    addToast({
      type: 'info',
      title: 'User deleted',
      message: 'The user has been permanently deleted.',
    });
  };

  const getRoleBadge = (role: string) => {
    const Icon = roleIcons[role as keyof typeof roleIcons] || UserIcon;
    const colorClass = roleColors[role as keyof typeof roleColors] || roleColors.buyer;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">
          User Management
        </h1>
        <p className="text-text-secondary">
          Manage user roles and permissions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: users.length, icon: UsersIcon },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: Crown },
          { label: 'Creators', value: users.filter(u => u.role === 'creator').length, icon: Shield },
          { label: 'Buyers', value: users.filter(u => u.role === 'buyer').length, icon: UserIcon },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-void-light border border-white/5 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-text-muted" />
                <p className="text-text-muted text-sm">{stat.label}</p>
              </div>
              <p className="font-heading text-2xl font-bold text-text-primary">
                {stat.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
        <Input
          type="text"
          placeholder="Search users by username or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 py-6 bg-void-light border-white/10 text-text-primary placeholder:text-text-muted rounded-xl"
        />
      </div>

      {/* Users List */}
      <div className="bg-void-light border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-text-muted text-sm font-medium px-6 py-4">User</th>
                <th className="text-left text-text-muted text-sm font-medium px-6 py-4">Email</th>
                <th className="text-left text-text-muted text-sm font-medium px-6 py-4">Role</th>
                <th className="text-left text-text-muted text-sm font-medium px-6 py-4">Joined</th>
                <th className="text-right text-text-muted text-sm font-medium px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={user.avatar} 
                        alt={user.username}
                        className="w-10 h-10 rounded-lg bg-void"
                      />
                      <div>
                        <p className="font-medium text-text-primary">{user.username}</p>
                        {user.id === currentUser?.id && (
                          <span className="text-xs text-neon-cyan">You</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{user.email}</td>
                  <td className="px-6 py-4">
                    {editingUser === user.id ? (
                      <div className="flex items-center gap-2">
                        {(['buyer', 'creator', 'admin'] as const).map((role) => (
                          <button
                            key={role}
                            onClick={() => handleRoleChange(user.id, role)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              user.role === role 
                                ? roleColors[role] 
                                : 'border-white/10 text-text-muted hover:text-text-primary'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      getRoleBadge(user.role)
                    )}
                  </td>
                  <td className="px-6 py-4 text-text-muted text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {editingUser === user.id ? (
                        <>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="p-2 text-neon-lime hover:bg-neon-lime/10 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="p-2 text-neon-red hover:bg-neon-red/10 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingUser(user.id)}
                            className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
                            title="Edit role"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(user.id)}
                            className="p-2 text-text-muted hover:text-neon-red hover:bg-neon-red/10 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary">No users found</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-void-light border border-white/10 rounded-xl p-6 max-w-md w-full"
          >
            <div className="flex items-center gap-3 text-neon-red mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-heading text-lg font-bold">Delete User?</h3>
            </div>
            <p className="text-text-secondary mb-6">
              This action cannot be undone. The user will be permanently deleted from the platform.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/20"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-neon-red text-white font-bold"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
