/**
 * Command Palette - Global Quick Actions
 * MVP Version: 1-day implementation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Terminal, Settings, FileCode, GitBranch, FolderOpen, Globe, Shield, CreditCard, User, Plus, Moon, LogOut, Palette, Image, Sparkles, Bot } from 'lucide-react';
import { AIOrchestrator } from '../utils/AIOrchestrator.js';

const COMMANDS = [
  { id: 'ide', label: 'Open IDE', icon: FileCode, category: 'Apps' },
  { id: 'terminal', label: 'Open Terminal', icon: Terminal, category: 'Apps' },
  { id: 'browser', label: 'Open Browser', icon: Globe, category: 'Apps' },
  { id: 'git', label: 'Open Git', icon: GitBranch, category: 'Apps' },
  { id: 'files', label: 'Open Files', icon: FolderOpen, category: 'Apps' },
  { id: 'pixai', label: 'PixAI Art Studio', icon: Image, category: 'Apps' },
  { id: 'secrets', label: 'Secrets Manager', icon: Shield, category: 'Apps' },
  { id: 'settings', label: 'Settings', icon: Settings, category: 'Apps' },
  { id: 'billing', label: 'Billing', icon: CreditCard, category: 'Apps' },
  { id: 'profile', label: 'Profile', icon: User, category: 'Apps' },
  { id: 'new-file', label: 'New File', icon: Plus, category: 'Actions', shortcut: 'Ctrl+N' },
  { id: 'dark-mode', label: 'Toggle Dark Mode', icon: Moon, category: 'Preferences' },
  { id: 'logout', label: 'Logout', icon: LogOut, category: 'Account' },
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
