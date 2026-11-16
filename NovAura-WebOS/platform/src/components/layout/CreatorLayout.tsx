import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  LayoutDashboard, 
  Package, 
  DollarSign, 
  Settings,
  Plus,
  Sparkles,
  Layers
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/creator/dashboard' },
  { icon: Package, label: 'My Assets', href: '/creator/assets' },
  { icon: Layers, label: 'TCG Card Forge', href: '/creator/tcg-forge' },
  { icon: DollarSign, label: 'Earnings', href: '/creator/earnings' },
  { icon: Settings, label: 'Settings', href: '/creator/settings' },
];

export default function CreatorLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-void text-text-primary pt-20">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8 py-8">
            {/* Sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
              <div className="sticky top-24">
                {/* Creator Badge */}
                <div className="bg-gradient-rgb p-4 rounded-xl mb-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-void" />
                    <div>
                      <p className="font-heading font-bold text-void">Creator</p>
                      <p className="text-void/70 text-sm">Portal</p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="space-y-1 mb-6">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                {/* Upload Button */}
                <Link to="/creator/assets/new">
                  <button className="w-full flex items-center justify-center gap-2 bg-gradient-rgb text-void font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                    <Plus className="w-5 h-5" />
                    Upload Asset
                  </button>
                </Link>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ErrorBoundary section="Creator Portal">
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
