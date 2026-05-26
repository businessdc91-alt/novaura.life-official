import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid, Home, Settings, X, ChevronLeft, ChevronRight,
  Layers, Plus, MoreHorizontal, Smartphone, Monitor,
  MessageSquare, User, Gamepad2, Code2, Image, Music,
  BookOpen, Wand2, Store, Terminal, Globe, Sparkles,
  Cpu, Palette, FolderOpen, Phone, Brain, Zap, Bot,
  Search, Wifi, Battery, Signal, Volume2, Moon, Sun,
  LogOut, GripHorizontal, ArrowLeft, Maximize2
} from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useTouch } from '../hooks/useTouch';
import NovaChatWindow from './windows/NovaChatWindow';

/* ───────────────────────────────────────────────
   MOBILE LAYOUT v2 — Net Navi Edition
   Separate mobile shell. Desktop is untouched.
   ─────────────────────────────────────────────── */

// ── Status Bar ──
function MobileStatusBar() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative z-[950] flex items-center justify-between px-5 pt-[env(safe-area-inset-top,8px)] pb-1 select-none">
      <span className="text-[13px] font-semibold text-white/90 tracking-tight">{timeStr}</span>
      <div className="flex items-center gap-1.5">
        <Signal className="w-4 h-4 text-white/70" />
        <Wifi className="w-4 h-4 text-white/70" />
        <Battery className="w-5 h-5 text-white/70" />
      </div>
    </div>
  );
}

// ── Animated ambient background ──
function MobileAmbientBg() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#06060a]">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#0a0a12] to-[#06060a]" />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-cyan-500/[0.07] blur-[100px]"
        animate={{ x: [-80, 60, -80], y: [-40, 40, -40], scale: [1, 1.15, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{ top: '-10%', left: '-20%' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-purple-500/[0.07] blur-[100px]"
        animate={{ x: [60, -60, 60], y: [40, -40, 40], scale: [1, 1.2, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        style={{ bottom: '-5%', right: '-15%' }}
      />
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,217,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(0,217,255,0.5) 1px,transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />
    </div>
  );
}

// ── Glass card ──
function GlassCard({ children, className = '', glowColor = 'cyan' }) {
  const glows = { cyan: 'shadow-cyan-500/10', purple: 'shadow-purple-500/10', pink: 'shadow-pink-500/10' };
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.06] shadow-lg ${glows[glowColor] || glows.cyan} ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ── App categories ──
const APP_CATEGORIES = [
  {
    id: 'favorites', label: 'Favorites', icon: Sparkles, color: 'from-amber-500 to-yellow-400',
    apps: [
      { type: 'chat', label: 'AI Chat', icon: MessageSquare, color: 'text-blue-400' },
      { type: 'ide', label: 'Cybeni IDE', icon: Code2, color: 'text-cyan-400' },
      { type: 'art-studio', label: 'Art Studio', icon: Palette, color: 'text-pink-400' },
      { type: 'browser', label: 'Browser', icon: Globe, color: 'text-green-400' },
    ]
  },
  {
    id: 'creative', label: 'Creative', icon: Palette, color: 'from-pink-500 to-rose-400',
    apps: [
      { type: 'art-studio', label: 'Art Studio', icon: Palette, color: 'text-pink-400' },
      { type: 'art-gallery', label: 'Gallery', icon: Image, color: 'text-purple-400' },
      { type: 'vertex', label: 'Vertex AI', icon: Sparkles, color: 'text-amber-400' },
      { type: 'pixai', label: 'PixAI Art', icon: Image, color: 'text-rose-400' },
      { type: 'comic-creator', label: 'Comics', icon: BookOpen, color: 'text-indigo-400' },
    ]
  },
  {
    id: 'dev', label: 'Dev', icon: Code2, color: 'from-cyan-500 to-blue-400',
    apps: [
      { type: 'ide', label: 'Cybeni IDE', icon: Code2, color: 'text-cyan-400' },
      { type: 'vibe-coding', label: 'Vibe Code', icon: Wand2, color: 'text-violet-400' },
      { type: 'website-builder', label: 'Builder', icon: Smartphone, color: 'text-emerald-400' },
      { type: 'creator-studio', label: 'Creator', icon: Cpu, color: 'text-orange-400' },
      { type: 'terminal', label: 'Terminal', icon: Terminal, color: 'text-gray-400' },
      { type: 'git', label: 'Git', icon: Code2, color: 'text-red-400' },
    ]
  },
  {
    id: 'media', label: 'Media', icon: Music, color: 'from-green-500 to-emerald-400',
    apps: [
      { type: 'media', label: 'Player', icon: Music, color: 'text-green-400' },
      { type: 'music-composer', label: 'Composer', icon: Music, color: 'text-teal-400' },
      { type: 'live-broadcast', label: 'Broadcast', icon: Phone, color: 'text-red-400' },
      { type: 'media-library', label: 'Library', icon: FolderOpen, color: 'text-blue-400' },
    ]
  },
  {
    id: 'writing', label: 'Writing', icon: BookOpen, color: 'from-violet-500 to-purple-400',
    apps: [
      { type: 'literature-ide', label: 'Literature', icon: BookOpen, color: 'text-violet-400' },
      { type: 'poems', label: 'Poems', icon: Sparkles, color: 'text-pink-400' },
      { type: 'collab-writing', label: 'Collab', icon: User, color: 'text-cyan-400' },
    ]
  },
  {
    id: 'ai', label: 'AI', icon: Brain, color: 'from-purple-500 to-indigo-400',
    apps: [
      { type: 'chat', label: 'AI Chat', icon: MessageSquare, color: 'text-blue-400' },
      { type: 'ai-companion', label: 'Nova AI', icon: Brain, color: 'text-purple-400' },
      { type: 'voice', label: 'Voice', icon: Phone, color: 'text-green-400' },
      { type: 'ai-assistant', label: 'Assistant', icon: Sparkles, color: 'text-amber-400' },
      { type: 'live-ai', label: 'Nova Live', icon: Phone, color: 'text-red-400' },
    ]
  },
  {
    id: 'games', label: 'Games', icon: Gamepad2, color: 'from-orange-500 to-amber-400',
    apps: [
      { type: 'games-arena', label: 'Arena', icon: Gamepad2, color: 'text-cyan-400' },
      { type: 'aetherium-tcg', label: 'Aetherium', icon: Gamepad2, color: 'text-purple-400' },
      { type: 'gilded-cage', label: 'Gilded Cage', icon: Gamepad2, color: 'text-amber-400' },
    ]
  },
  {
    id: 'utility', label: 'Tools', icon: Store, color: 'from-slate-500 to-gray-400',
    apps: [
      { type: 'files', label: 'Files', icon: FolderOpen, color: 'text-blue-400' },
      { type: 'browser', label: 'Browser', icon: Globe, color: 'text-green-400' },
      { type: 'profile', label: 'Profile', icon: User, color: 'text-cyan-400' },
      { type: 'appstore', label: 'Repo Station', icon: Store, color: 'text-orange-400' },
      { type: 'settings', label: 'Settings', icon: Settings, color: 'text-gray-400' },
    ]
  },
];

// ── Neon app icon (compact for grid) ──
function NeonAppIcon({ icon: Icon, color, onClick, label }) {
  const colorMap = {
    'text-blue-400': 'from-blue-500 to-cyan-400',
    'text-cyan-400': 'from-cyan-500 to-blue-400',
    'text-pink-400': 'from-pink-500 to-rose-400',
    'text-purple-400': 'from-purple-500 to-violet-400',
    'text-green-400': 'from-green-500 to-emerald-400',
    'text-amber-400': 'from-amber-500 to-yellow-400',
    'text-red-400': 'from-red-500 to-rose-400',
    'text-indigo-400': 'from-indigo-500 to-purple-400',
    'text-violet-400': 'from-violet-500 to-purple-400',
    'text-orange-400': 'from-orange-500 to-amber-400',
    'text-teal-400': 'from-teal-500 to-cyan-400',
    'text-rose-400': 'from-rose-500 to-pink-400',
    'text-emerald-400': 'from-emerald-500 to-green-400',
    'text-gray-400': 'from-gray-500 to-slate-400',
  };
  const gradient = colorMap[color] || 'from-cyan-500 to-blue-400';
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.92 }} className="flex flex-col items-center gap-1.5 p-1">
      <div className={`relative w-14 h-14 rounded-[18px] flex items-center justify-center bg-gradient-to-br ${gradient} shadow-lg`}>
        <Icon className="w-6 h-6 text-white drop-shadow-md" />
      </div>
      <span className="text-[10px] font-medium text-white/70 text-center leading-tight max-w-[64px]">{label}</span>
    </motion.button>
  );
}

// ── App Drawer (bottom sheet) ──
function AppDrawer({ onOpenWindow, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('favorites');
  const [searchQuery, setSearchQuery] = useState('');
  const category = APP_CATEGORIES.find(c => c.id === selectedCategory);

  const filteredApps = searchQuery.trim()
    ? APP_CATEGORIES.flatMap(c => c.apps).filter(a =>
        a.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : category?.apps || [];

  return (
    <div className="flex flex-col h-full bg-[#06060a]">
      <MobileAmbientBg />
      {/* Drag handle */}
      <div className="sheet-drag-handle" />

      {/* Search */}
      <div className="relative z-10 px-4 pb-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <Search className="w-4 h-4 text-white/30" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search apps..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 rounded-full bg-white/10">
              <X className="w-3 h-3 text-white/50" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="relative z-10 px-2 pb-2">
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide px-2">
            {APP_CATEGORIES.map(cat => (
              <motion.button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap text-[11px] font-medium transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r ' + cat.color + ' text-white border-white/20 shadow-lg'
                    : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white'
                }`}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Apps Grid */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 scrollbar-hide">
        {filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/30">
            <Search className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No apps found</p>
          </div>
        ) : (
          <motion.div
            key={searchQuery ? 'search' : selectedCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-4 gap-y-5 gap-x-2"
          >
            {filteredApps.map((app, index) => (
              <motion.button
                key={`${app.type}-${index}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => { onOpenWindow(app.type, app.label); onClose(); }}
              >
                <NeonAppIcon icon={app.icon} color={app.color} label={app.label} />
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Window Switcher (bottom sheet) ──
function WindowSwitcherSheet({ windows, activeWindowId, onSwitch, onClose }) {
  return (
    <div className="flex flex-col h-full bg-[#06060a]">
      <div className="sheet-drag-handle" />
      <div className="px-4 pb-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Open Apps ({windows.length})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
        {windows.map(win => (
          <motion.button
            key={win.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => { onSwitch(win.id); onClose(); }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
              win.id === activeWindowId
                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30'
                : 'bg-white/5 hover:bg-white/10 border border-transparent'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-sm text-white flex-1 text-left truncate">{win.title}</span>
            {win.id === activeWindowId && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── More Menu (bottom sheet) ──
function MoreMenu({ onToggleLayout, windows, onCloseAll, onClose }) {
  const items = [
    { icon: Monitor, label: 'Switch to Desktop', desc: 'Floating windows', action: onToggleLayout, color: 'from-cyan-500 to-blue-500' },
    { icon: Settings, label: 'Settings', desc: 'System preferences', action: () => { onClose(); /* open settings */ }, color: 'from-gray-500 to-slate-400' },
  ];
  return (
    <div className="flex flex-col bg-[#06060a]">
      <div className="sheet-drag-handle" />
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-bold text-white mb-2">Quick Actions</h3>
        {items.map((item, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.98 }}
            onClick={() => { item.action(); onClose(); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shrink-0`}>
              <item.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">{item.label}</p>
              <p className="text-[11px] text-white/40">{item.desc}</p>
            </div>
          </motion.button>
        ))}
        {windows.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { onCloseAll(); onClose(); }}
            className="w-full p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/20 text-red-400 text-sm font-medium"
          >
            Close All Apps
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ── Full-screen mobile app window ──
function MobileAppWindow({ window: win, isActive, onClose, onFocus, children }) {
  if (!isActive) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.97 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="fixed inset-0 z-[800] flex flex-col bg-[#06060a]"
      onClick={() => onFocus(win.id)}
    >
      {/* App Header */}
      <GlassCard className="mx-0 mt-0 rounded-none border-b border-white/[0.06] z-10">
        <div className="flex items-center justify-between px-4 py-3 pt-[env(safe-area-inset-top,12px)]">
          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); onClose(win.id); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold text-sm text-white truncate max-w-[180px]">{win.title}</span>
          </div>
        </div>
      </GlassCard>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <span className="text-xs text-white/40">Loading {win.title}...</span>
            </div>
          </div>
        }>
          {children}
        </Suspense>
      </div>
    </motion.div>
  );
}

// ── Navi Home Screen ──
function NaviHomeScreen({ onOpenWindow }) {
  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) setGreeting('Up late?');
    else if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else if (hour < 21) setGreeting('Good evening');
    else setGreeting('Good night');
  }, []);

  return (
    <div className="flex flex-col h-full relative">
      {/* Subtle top branding */}
      <div className="shrink-0 px-5 pt-2 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-white/60 tracking-wide">NOVAURA OS</span>
        </div>
        <span className="text-[11px] text-white/30">{greeting}</span>
      </div>

      {/* Nova Chat — the Net Navi */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <NovaChatWindow />
      </div>
    </div>
  );
}

// ── Main Mobile Layout ──
export default function MobileLayout({
  windows,
  onOpenWindow,
  onCloseWindow,
  onFocusWindow,
  onToggleLayout,
  windowComponents,
  children
}) {
  const [activeWindowId, setActiveWindowId] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'app'
  const [showAppDrawer, setShowAppDrawer] = useState(false);
  const [showWindowSwitcher, setShowWindowSwitcher] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const contentRef = useRef(null);

  // Keep active window in sync
  useEffect(() => {
    if (windows.length === 0) {
      setActiveWindowId(null);
      setView('home');
    } else if (!activeWindowId || !windows.find(w => w.id === activeWindowId)) {
      setActiveWindowId(windows[windows.length - 1].id);
    }
  }, [windows, activeWindowId]);

  // Swipe between open apps
  const handleSwipe = useCallback(({ direction }) => {
    if (windows.length <= 1 || view !== 'app') return;
    const idx = windows.findIndex(w => w.id === activeWindowId);
    if (direction === 'left' && idx < windows.length - 1) {
      setActiveWindowId(windows[idx + 1].id);
      onFocusWindow(windows[idx + 1].id);
    } else if (direction === 'right' && idx > 0) {
      setActiveWindowId(windows[idx - 1].id);
      onFocusWindow(windows[idx - 1].id);
    } else if (direction === 'right' && idx === 0) {
      // Swipe right on first app = go home
      setView('home');
    }
  }, [windows, activeWindowId, view, onFocusWindow]);

  useTouch(contentRef, { onSwipe: handleSwipe, swipeThreshold: 60 });

  const activeWindow = windows.find(w => w.id === activeWindowId);
  const hasWindows = windows.length > 0;

  const handleOpenFromDrawer = (type, title) => {
    onOpenWindow(type, title);
    setShowAppDrawer(false);
    setView('app');
  };

  return (
    <div ref={contentRef} className="relative w-full h-screen overflow-hidden bg-[#06060a] no-tap-highlight">
      <MobileAmbientBg />

      {/* Status Bar */}
      <MobileStatusBar />

      {/* ── Main Content Area ── */}
      <div className="absolute inset-0 top-[40px] bottom-[76px]">
        {/* Home / Net Navi View */}
        <AnimatePresence mode="wait">
          {(view === 'home' || !hasWindows) && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              <NaviHomeScreen onOpenWindow={onOpenWindow} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active App View */}
        <AnimatePresence>
          {view === 'app' && hasWindows && activeWindow && (
            <MobileAppWindow
              key={activeWindow.id}
              window={activeWindow}
              isActive={true}
              onClose={(id) => {
                onCloseWindow(id);
                if (windows.length <= 1) setView('home');
              }}
              onFocus={setActiveWindowId}
            >
              {React.createElement(windowComponents[activeWindow.type] || (() => null), activeWindow.props)}
            </MobileAppWindow>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Navigation ── */}
      <div className="fixed bottom-0 left-0 right-0 z-[900]">
        <GlassCard className="rounded-t-2xl border-t border-white/[0.08] shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-around py-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] px-2">

            {/* Home / Navi */}
            <NavButton
              icon={Home}
              label="Navi"
              active={view === 'home'}
              onClick={() => setView('home')}
            />

            {/* Apps Drawer */}
            <Sheet open={showAppDrawer} onOpenChange={setShowAppDrawer}>
              <SheetTrigger asChild>
                <NavButton icon={Grid} label="Apps" active={showAppDrawer} />
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[82vh] p-0 bg-[#06060a] border-cyan-500/10 rounded-t-2xl">
                <AppDrawer onOpenWindow={handleOpenFromDrawer} onClose={() => setShowAppDrawer(false)} />
              </SheetContent>
            </Sheet>

            {/* FAB — Quick action center */}
            <div className="relative -top-3">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => onOpenWindow('chat', 'AI Chat')}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.3)] border-2 border-white/10"
              >
                <Bot className="w-7 h-7 text-white" />
              </motion.button>
              {/* Active dot if windows exist */}
              {hasWindows && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-[#06060a]" />
              )}
            </div>

            {/* Window Switcher */}
            <Sheet open={showWindowSwitcher} onOpenChange={setShowWindowSwitcher}>
              <SheetTrigger asChild>
                <NavButton
                  icon={Layers}
                  label="Open"
                  active={showWindowSwitcher}
                  badge={hasWindows ? windows.length : 0}
                />
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto max-h-[70vh] p-0 bg-[#06060a] border-purple-500/10 rounded-t-2xl">
                <WindowSwitcherSheet
                  windows={windows}
                  activeWindowId={activeWindowId}
                  onSwitch={(id) => { setActiveWindowId(id); setView('app'); setShowWindowSwitcher(false); }}
                  onClose={() => setShowWindowSwitcher(false)}
                />
              </SheetContent>
            </Sheet>

            {/* More Menu */}
            <Sheet open={showMoreMenu} onOpenChange={setShowMoreMenu}>
              <SheetTrigger asChild>
                <NavButton icon={MoreHorizontal} label="More" active={showMoreMenu} />
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto p-0 bg-[#06060a] border-pink-500/10 rounded-t-2xl">
                <MoreMenu
                  onToggleLayout={() => { onToggleLayout(); setShowMoreMenu(false); }}
                  windows={windows}
                  onCloseAll={() => windows.forEach(w => onCloseWindow(w.id))}
                  onClose={() => setShowMoreMenu(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </GlassCard>
      </div>

      {/* Window dot indicators (when apps open and on home) */}
      {hasWindows && view === 'home' && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[850]">
          <GlassCard className="px-3 py-1.5 flex items-center gap-1.5">
            {windows.map((w, i) => (
              <button
                key={w.id}
                onClick={() => { setActiveWindowId(w.id); setView('app'); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  w.id === activeWindowId ? 'w-5 bg-gradient-to-r from-cyan-400 to-purple-400' : 'w-1.5 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ── Bottom Nav Button ──
function NavButton({ icon: Icon, label, active, onClick, badge = 0 }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${active ? 'mobile-nav-active' : ''}`}
    >
      <div className={`relative p-1.5 rounded-xl transition-colors ${active ? 'bg-white/10' : ''}`}>
        <Icon className={`w-5 h-5 transition-colors ${active ? 'text-cyan-400' : 'text-white/40'}`} />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-[9px] font-bold text-white flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className={`text-[9px] font-medium transition-colors ${active ? 'text-cyan-400' : 'text-white/40'}`}>{label}</span>
    </motion.button>
  );
}
