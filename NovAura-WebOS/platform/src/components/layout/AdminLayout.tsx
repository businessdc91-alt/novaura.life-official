import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart,
  Shield,
  Crown
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
  { icon: Package, label: 'Assets', href: '/admin/assets' },
  { icon: Users, label: 'Users', href: '/admin/users' },
  { icon: ShoppingCart, label: 'Orders', href: '/admin/orders' },
];

// Check if user is the owner
const isOwner = (user: any): boolean => {
  if (!user) return false;
  return user.email === 'the.lost.catalyst@gmail.com' || user.email === 'Dillan.Copeland@Novauraverse.com';
};

export default function AdminLayout() {
  const location = useLocation();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-void text-text-primary pt-20">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8 py-8">
            {/* Sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
              <div className="sticky top-24">
                {/* Admin Badge */}
                <div className="bg-gradient-to-r from-neon-red/20 to-neon-magenta/20 border border-neon-red/30 p-4 rounded-xl mb-6">
                  <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-neon-red" />
                    <div>
                      <p className="font-heading font-bold text-neon-red">Admin</p>
                      <p className="text-neon-red/70 text-sm">Panel</p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-neon-red/10 text-neon-red border border-neon-red/30' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                  
                  {/* Command Center - Owner Only */}
                  {isOwner(user) && (
                    <Link
                      to="/admin/command-center"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        location.pathname === '/admin/command-center'
                          ? 'bg-gradient-rgb text-void font-bold' 
                          : 'text-neon-cyan hover:text-neon-cyan/80 hover:bg-neon-cyan/10'
                      }`}
                    >
                      <Crown className="w-5 h-5" />
                      <span className="font-medium">Command Center</span>
                    </Link>
                  )}
                </nav>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ErrorBoundary section="Admin Panel">
                  <Outlet />
                </ErrorBoundary>
              </motion.div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
