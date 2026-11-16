import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, Globe, Monitor, ShoppingBag, Store, 
  Server, Mail, Gamepad2, Music, MessageSquare, 
  Brain, Hammer, Settings, Home, LayoutDashboard
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

const DIRECTORY_ITEMS = [
  { id: 'os', name: 'Web OS', description: 'NovAura Desktop OS', icon: Monitor, href: '/os/', color: 'neon-magenta', isExternal: true },
  { id: 'feed', name: 'Social Feed', description: 'AI & Human interactions', icon: MessageSquare, href: '/feed', color: 'neon-cyan' },
  { id: 'market', name: 'Asset Market', description: 'Buy & sell digital assets', icon: ShoppingBag, href: '/browse', color: 'neon-lime' },
  { id: 'novalow', name: 'NovaLow', description: 'Domains & Web Hosting', icon: Globe, href: '/novalow', color: 'neon-violet' },
  { id: 'mail', name: 'Webmail', description: '@novaura.life email', icon: Mail, href: '/webmail', color: 'neon-cyan' },
  { id: 'system', name: 'System Core', description: 'Platform settings', icon: Settings, href: '/system', color: 'neon-lime', isExternal: true },
  { id: 'shop', name: 'Shop', description: "Catalyst's Corner store", icon: Store, href: '/shop', color: 'neon-magenta' },
  { id: 'games', name: 'Games', description: 'Play & publish games', icon: Gamepad2, href: '/games', color: 'neon-violet' },
  { id: 'chat', name: 'Nova Chat', description: 'AI-powered chat', icon: MessageSquare, href: '/chat', color: 'neon-cyan' },
  { id: 'voice-studio', name: 'Voice Studio', description: 'AI Voice synthesis', icon: Brain, href: '/voice-studio', color: 'neon-lime' },
  { id: 'music-studio', name: 'Music Studio', description: 'Create & produce music', icon: Music, href: '/music-studio', color: 'neon-violet' },
  { id: 'practice', name: 'Practice Tools', description: 'Music practice utilities', icon: Hammer, href: '/practice', color: 'neon-cyan' },
  { id: 'admin', name: 'Admin', description: 'Command center', icon: LayoutDashboard, href: '/admin/command-center', color: 'neon-magenta' }
];

export function GlobalSearchModal() {
  const { isSearchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filteredItems = DIRECTORY_ITEMS.filter(item => 
    item.name.toLowerCase().includes(query.toLowerCase()) || 
    item.description.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSearchOpen) return;

      if (e.key === 'Escape') {
        closeSearch();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleNavigate(filteredItems[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, filteredItems, selectedIndex, closeSearch]);

  const handleNavigate = (item: typeof DIRECTORY_ITEMS[0]) => {
    closeSearch();
    if (item.isExternal) {
      window.location.href = item.href;
    } else {
      navigate(item.href);
    }
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-void/80 backdrop-blur-sm"
            onClick={closeSearch}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[101] w-full max-w-2xl px-4"
          >
            <div className="bg-void border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* Search Input */}
              <div className="relative flex items-center px-4 py-4 border-b border-white/5">
                <Search className="w-6 h-6 text-text-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Search the NovAura ecosystem..."
                  className="flex-1 bg-transparent border-none outline-none text-xl text-text-primary px-4 placeholder:text-text-muted/50"
                />
                <button 
                  onClick={closeSearch}
                  className="p-1 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-text-muted">
                    <p>No matches found for "{query}"</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredItems.map((item, index) => {
                      const Icon = item.icon;
                      const isSelected = index === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavigate(item)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors ${
                            isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className={`p-2 rounded-lg bg-${item.color}/10 border border-${item.color}/20`}>
                            <Icon className={`w-5 h-5 text-${item.color}`} />
                          </div>
                          <div>
                            <div className="font-medium text-text-primary">
                              {item.name}
                            </div>
                            <div className="text-xs text-text-muted">
                              {item.description}
                            </div>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            {isSelected && (
                              <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted bg-white/5 px-2 py-1 rounded">
                                Enter ↵
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">↑</kbd>
                    <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">↓</kbd>
                    to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">↵</kbd>
                    to select
                  </span>
                </div>
                <span>NovAura Global Directory</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
