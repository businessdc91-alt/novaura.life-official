/**
 * Command Palette - Global Quick Actions
 * MVP Version: 1-day implementation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, Terminal, Settings, FileCode, GitBranch, FolderOpen, Globe, Shield, CreditCard, User, Plus, Moon, LogOut, Palette, Image, Sparkles, Bot,
  Paintbrush, Shirt, Wand2, Grid as GridIcon, Heart, BookOpen, Feather, PenTool, Library, Zap, Wrench, Blocks, GitMerge, Swords, Smile, Music, Radio,
  Play, MessageSquare, Phone, Brain, Eraser, Briefcase, Dumbbell, BrainCircuit, Gamepad2, Rocket, Package, Crown, ShoppingBag, Store, Activity,
  Bitcoin, Calculator, BellRing, CloudSun
} from 'lucide-react';
import { AIOrchestrator } from '../utils/AIOrchestrator.js';

const COMMANDS = [
  // ─── Creative ───
  { id: 'art-studio', label: 'Art Studio', icon: Paintbrush, category: 'Creative' },
  { id: 'art-gallery', label: 'Art Gallery', icon: Image, category: 'Creative' },
  { id: 'clothing-creator', label: 'Clothing Creator', icon: Shirt, category: 'Creative' },
  { id: 'outfit-generator', label: 'Outfit Generator', icon: Wand2, category: 'Creative' },
  { id: 'avatar-builder', label: 'Avatar Builder', icon: User, category: 'Creative' },
  { id: 'avatar-gallery', label: 'Avatar Gallery', icon: GridIcon, category: 'Creative' },
  { id: 'outfit-manager', label: 'Wardrobe Manager', icon: Heart, category: 'Creative' },
  { id: 'comic-creator', label: 'Comic Creator', icon: Palette, category: 'Creative' },

  // ─── Writing ───
  { id: 'literature-ide', label: 'Literature IDE', icon: BookOpen, category: 'Writing' },
  { id: 'poems', label: 'Poems Creator', icon: Feather, category: 'Writing' },
  { id: 'collab-writing', label: 'Collaborative Writing', icon: PenTool, category: 'Writing' },
  { id: 'writing-library', label: 'Writing Library', icon: Library, category: 'Writing' },

  // ─── Dev Tools ───
  { id: 'ide', label: 'Cybeni IDE', icon: FileCode, category: 'Development', shortcut: 'Ctrl+I' },
  { id: 'website-builder', label: 'Website Builder', icon: Globe, category: 'Development' },
  { id: 'vibe-coding', label: 'Vibe Coding', icon: Zap, category: 'Development' },
  { id: 'creator-studio', label: 'Creator Studio', icon: Wrench, category: 'Development' },
  { id: 'constructor', label: 'Constructor', icon: Blocks, category: 'Development' },
  { id: 'script-fusion', label: 'Script Fusion', icon: GitMerge, category: 'Development' },
  { id: 'workspace', label: 'Workspace Manager', icon: FolderOpen, category: 'Development' },
  { id: 'dojo', label: 'Dojo Arena', icon: Swords, category: 'Development' },
  { id: 'avatar-creator', label: 'Living Avatar Creator', icon: Smile, category: 'Development' },
  { id: 'git', label: 'Git Interface', icon: GitBranch, category: 'Development', shortcut: 'Ctrl+G' },
  { id: 'catalyst', label: 'Catalyst Station', icon: Rocket, category: 'Development', shortcut: 'Ctrl+Shift+C' },

  // ─── Media ───
  { id: 'music-composer', label: 'Music Composer', icon: Music, category: 'Media' },
  { id: 'live-broadcast', label: 'Live Broadcast', icon: Radio, category: 'Media' },
  { id: 'media', label: 'Media Player', icon: Play, category: 'Media' },
  { id: 'media-library', label: 'Media Library', icon: FolderOpen, category: 'Media' },

  // ─── AI ───
  { id: 'social', label: 'Social Network', icon: MessageSquare, category: 'AI' },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare, category: 'AI' },
  { id: 'voice', label: 'Voice Chat', icon: Phone, category: 'AI' },
  { id: 'ai-assistant', label: 'Aura Assistant', icon: Brain, category: 'AI' },
  { id: 'ai-companion', label: 'Nova AI', icon: Bot, category: 'AI' },
  { id: 'vertex', label: 'Vertex AI', icon: Sparkles, category: 'AI' },
  { id: 'pixai', label: 'PixAI Art Studio', icon: Image, category: 'AI' },
  { id: 'bg-remover', label: 'Background Remover', icon: Eraser, category: 'AI' },

  // ─── Utility ───
  { id: 'terminal', label: 'Terminal', icon: Terminal, category: 'Utility', shortcut: 'Ctrl+T' },
  { id: 'browser', label: 'Web Browser', icon: Globe, category: 'Utility', shortcut: 'Ctrl+B' },
  { id: 'business-card', label: 'Business Cards', icon: CreditCard, category: 'Utility' },
  { id: 'tax-filing', label: 'Tax Filing', icon: FileCode, category: 'Utility' },
  { id: 'weather', label: 'Weather', icon: CloudSun, category: 'Utility' },
  { id: 'system-diagnostics', label: 'System Health', icon: Activity, category: 'Utility' },
  { id: 'crypto', label: 'Crypto Markets', icon: Bitcoin, category: 'Utility' },
  { id: 'calculator', label: 'Calculator', icon: Calculator, category: 'Utility' },
  { id: 'notifications', label: 'Notifications', icon: BellRing, category: 'Utility' },
  { id: 'profile', label: 'User Profile', icon: User, category: 'Utility' },
  { id: 'appstore', label: 'Repo Station', icon: Store, category: 'Utility' },
  { id: 'platform', label: 'NovAura Platform', icon: ShoppingBag, category: 'Utility' },

  // ─── Business ───
  { id: 'business-operator', label: 'Venture Orchestrator', icon: Briefcase, category: 'Business' },
  { id: 'nova-concierge', label: 'Ecosystem Manager', icon: Sparkles, category: 'Business' },
  { id: 'admin-panel', label: 'Admin Panel', icon: Shield, category: 'Admin' },

  // ─── Learn & Play ───
  { id: 'challenges', label: 'Coding Challenges', icon: Dumbbell, category: 'Learn' },
  { id: 'psychometrics', label: 'Psychometrics', icon: BrainCircuit, category: 'Learn' },
  { id: 'games-arena', label: 'Games Arena', icon: Gamepad2, category: 'Play' },
  { id: 'aetherium-tcg', label: 'Aetherium TCG', icon: Swords, category: 'Play' },
  { id: 'gilded-cage', label: 'The Gilded Cage', icon: Crown, category: 'Play' },
  { id: 'inventory', label: 'Inventory Manager', icon: Package, category: 'Play' },

  // ─── System ───
  { id: 'secrets', label: 'Secrets Manager', icon: Shield, category: 'System' },
  { id: 'settings', label: 'Theme & Settings', icon: Settings, category: 'System', shortcut: 'Ctrl+S' },
  { id: 'billing', label: 'Billing & Plans', icon: CreditCard, category: 'System' },
  { id: 'logout', label: 'Logout Session', icon: LogOut, category: 'Account' },
];

export default function CommandPalette({ isOpen, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    
    let results = [...COMMANDS];
    if (q) {
      results = COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    }

    // Add Semantic Intent at the top if detected
    if (q) {
      const intent = AIOrchestrator.matchIntent(q);
      if (intent && !results.some(r => r.id === intent.appType)) {
        results.unshift({
          id: intent.appType,
          label: intent.label,
          icon: Sparkles,
          category: 'AI Intent',
          isIntent: true,
          params: intent.params
        });
      }
    }

    return results;
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected(s => (s + 1) % filtered.length);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected(s => (s - 1 + filtered.length) % filtered.length);
      }
      if (e.key === 'Enter' && filtered[selected]) {
        const item = filtered[selected];
        if (item.isIntent) {
          onSelect(item.id, item.label, item.params);
        } else {
          onSelect(item.id);
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selected, onClose, onSelect]);

  useEffect(() => {
    setSelected(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-2xl bg-[#0f0f1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
            <Search className="w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-white/30"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <kbd className="px-2 py-1 text-xs bg-white/10 rounded text-white/50">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/40">
                No commands found
              </div>
            ) : (
              filtered.map((cmd, i) => {
                const Icon = cmd.icon;
                const isSelected = i === selected;
                
                return (
                  <button
                    key={cmd.id + (cmd.isIntent ? '-intent' : '')}
                    className={`w-full flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-left transition-colors ${
                      isSelected 
                        ? cmd.isIntent ? 'bg-primary/20 text-primary' : 'bg-cyan-500/20 text-cyan-300' 
                        : 'text-white/70 hover:bg-white/5'
                    }`}
                    style={{ width: 'calc(100% - 16px)' }}
                    onClick={() => { 
                      if (cmd.isIntent) onSelect(cmd.id, cmd.label, cmd.params);
                      else onSelect(cmd.id); 
                      onClose(); 
                    }}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <Icon className={`w-5 h-5 ${cmd.isIntent ? 'animate-pulse text-primary' : ''}`} />
                    <div className="flex-1">
                      <span className="block">{cmd.label}</span>
                      {cmd.isIntent && <span className="text-[9px] text-primary/60 uppercase font-bold tracking-tighter">Powered by Aura</span>}
                    </div>
                    <span className="text-xs text-white/40">{cmd.category}</span>
                    {cmd.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs bg-white/10 rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/10 text-xs text-white/40">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span className="ml-auto">{filtered.length} commands</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
