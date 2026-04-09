import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Grid, Home, Settings, X, ChevronLeft, ChevronRight,
  Layers, Plus, MoreHorizontal, Smartphone, Monitor,
  MessageSquare, User, Gamepad2, Code2, Image, Music,
  BookOpen, Wand2, Store, Terminal, Globe, Sparkles,
  Cpu, Palette, FolderOpen, Phone, Brain, Zap
} from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useTouch } from '../hooks/useTouch';

// Animated gradient background component
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Animated orbs */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ top: '10%', left: '-10%' }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-purple-500/20 blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ bottom: '20%', right: '-10%' }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full bg-pink-500/10 blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ top: '50%', left: '30%' }}
        />
      </div>
      
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 217, 255, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 217, 255, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
    </div>
  );
}

// Neon app icon component
function NeonAppIcon({ icon: Icon, color, isActive, onClick, label }) {
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
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center gap-2 p-3"
    >
      <div className={`
        relative w-16 h-16 rounded-2xl flex items-center justify-center
        bg-gradient-to-br ${gradient}
        ${isActive ? 'shadow-lg' : 'opacity-80'}
        transition-all duration-300
      `}
      style={{
        boxShadow: isActive 
          ? `0 0 30px currentColor, 0 0 60px currentColor` 
          : '0 4px 15px rgba(0,0,0,0.3)'
      }}
      >
        <Icon className="w-7 h-7 text-white drop-shadow-lg" />
        
        {/* Glow effect */}
        <div className={`
          absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient}
          blur-xl opacity-50 -z-10
          ${isActive ? 'animate-pulse' : ''}
        `} />
      </div>
      <span className="text-xs font-medium text-white/80 text-center leading-tight max-w-[70px]">
        {label}
      </span>
    </motion.button>
  );
}

// Glass card component
function GlassCard({ children, className = '', glowColor = 'cyan' }) {
  const glowColors = {
    cyan: 'shadow-cyan-500/20',
    purple: 'shadow-purple-500/20',
    pink: 'shadow-pink-500/20',
  };
  
  return (
    <div className={`
      relative overflow-hidden rounded-2xl
      bg-white/5 backdrop-blur-xl
      border border-white/10
      shadow-lg ${glowColors[glowColor] || glowColors.cyan}
      ${className}
    `}>
      {/* Inner glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-transparent to-purple-500/20 pointer-events-none" />
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// App categories for mobile nav
const APP_CATEGORIES = [
  {
    id: 'favorites',
    label: 'Favorites',
    icon: Sparkles,
    color: 'from-amber-500 to-yellow-400',
    apps: [
      { type: 'chat', label: 'AI Chat', icon: MessageSquare, color: 'text-blue-400' },
      { type: 'ide', label: 'Cybeni IDE', icon: Code2, color: 'text-cyan-400' },
      { type: 'art-studio', label: 'Art Studio', icon: Palette, color: 'text-pink-400' },
      { type: 'browser', label: 'Browser', icon: Globe, color: 'text-green-400' },
    ]
  },
  {
    id: 'creative',
    label: 'Creative',
    icon: Palette,
    color: 'from-pink-500 to-rose-400',
    apps: [
      { type: 'art-studio', label: 'Art Studio', icon: Palette, color: 'text-pink-400' },
      { type: 'art-gallery', label: 'Gallery', icon: Image, color: 'text-purple-400' },
      { type: 'vertex', label: 'Vertex AI', icon: Sparkles, color: 'text-amber-400' },
      { type: 'pixai', label: 'PixAI Art', icon: Image, color: 'text-rose-400' },
      { type: 'comic-creator', label: 'Comics', icon: BookOpen, color: 'text-indigo-400' },
    ]
  },
  {
    id: 'dev',
    label: 'Dev',
    icon: Code2,
    color: 'from-cyan-500 to-blue-400',
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
    id: 'media',
    label: 'Media',
    icon: Music,
    color: 'from-green-500 to-emerald-400',
    apps: [
      { type: 'media', label: 'Player', icon: Music, color: 'text-green-400' },
      { type: 'music-composer', label: 'Composer', icon: Music, color: 'text-teal-400' },
      { type: 'live-broadcast', label: 'Broadcast', icon: Phone, color: 'text-red-400' },
      { type: 'media-library', label: 'Library', icon: FolderOpen, color: 'text-blue-400' },
    ]
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: BookOpen,
    color: 'from-violet-500 to-purple-400',
    apps: [
      { type: 'literature-ide', label: 'Literature', icon: BookOpen, color: 'text-violet-400' },
      { type: 'poems', label: 'Poems', icon: Sparkles, color: 'text-pink-400' },
      { type: 'collab-writing', label: 'Collab', icon: User, color: 'text-cyan-400' },
    ]
  },
  {
    id: 'ai',
    label: 'AI',
    icon: Brain,
    color: 'from-purple-500 to-indigo-400',
    apps: [
      { type: 'chat', label: 'AI Chat', icon: MessageSquare, color: 'text-blue-400' },
      { type: 'ai-companion', label: 'Nova AI', icon: Brain, color: 'text-purple-400' },
      { type: 'voice', label: 'Voice', icon: Phone, color: 'text-green-400' },
      { type: 'ai-assistant', label: 'Assistant', icon: Sparkles, color: 'text-amber-400' },
      { type: 'live-ai', label: 'Nova Live', icon: Phone, color: 'text-red-400' },
    ]
  },
  {
    id: 'games',
    label: 'Games',
    icon: Gamepad2,
    color: 'from-orange-500 to-amber-400',
    apps: [
      { type: 'games-arena', label: 'Arena', icon: Gamepad2, color: 'text-cyan-400' },
      { type: 'aetherium-tcg', label: 'Aetherium', icon: Gamepad2, color: 'text-purple-400' },
      { type: 'gilded-cage', label: 'Gilded Cage', icon: Gamepad2, color: 'text-amber-400' },
    ]
  },
  {
    id: 'utility',
    label: 'Tools',
    icon: Store,
    color: 'from-slate-500 to-gray-400',
    apps: [
      { type: 'files', label: 'Files', icon: FolderOpen, color: 'text-blue-400' },
      { type: 'browser', label: 'Browser', icon: Globe, color: 'text-green-400' },
      { type: 'profile', label: 'Profile', icon: User, color: 'text-cyan-400' },
      { type: 'appstore', label: 'Repo Station', icon: Store, color: 'text-orange-400' },
      { type: 'settings', label: 'Settings', icon: Settings, color: 'text-gray-400' },
    ]
  },
];

// Quick access apps for bottom nav
const QUICK_APPS = [
  { type: 'chat', icon: MessageSquare, label: 'Chat', color: 'from-blue-500 to-cyan-400' },
  { type: 'ide', icon: Code2, label: 'IDE', color: 'from-cyan-500 to-blue-500' },
  { type: 'art-studio', icon: Palette, label: 'Art', color: 'from-pink-500 to-rose-400' },
  { type: 'games-arena', icon: Gamepad2, label: 'Games', color: 'from-orange-500 to-amber-400' },
];

function MobileWindow({ window: win, isActive, onClose, onFocus, children }) {
  if (!isActive) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[800] flex flex-col"
      onClick={() => onFocus(win.id)}
    >
      <AnimatedBackground />
      
      {/* Mobile Window Header */}
      <GlassCard className="mx-2 mt-2 rounded-xl border-cyan-500/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-500/50" />
            <span className="font-semibold text-sm text-white truncate max-w-[200px]">
              {win.title}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onClose(win.id)}
            className="h-8 w-8 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </GlassCard>
      
      {/* Window Content */}
      <div className="flex-1 overflow-auto p-2">
        <GlassCard className="h-full" glowColor="purple">
          {children}
        </GlassCard>
      </div>
    </motion.div>
  );
}

function AppDrawer({ onOpenWindow, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('favorites');
  const category = APP_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="flex flex-col h-full bg-slate-950/50">
      <AnimatedBackground />
      
      {/* Header */}
      <div className="relative z-10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">NovAura OS</h2>
            <p className="text-xs text-cyan-400">Mobile Edition</p>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="relative z-10 px-2 py-2">
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          {APP_CATEGORIES.map(cat => (
            <motion.button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              whileTap={{ scale: 0.95 }}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap text-xs font-medium
                transition-all duration-300 border
                ${selectedCategory === cat.id 
                  ? 'bg-gradient-to-r ' + cat.color + ' text-white border-white/20 shadow-lg' 
                  : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Apps Grid */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4">
        <motion.div 
          key={selectedCategory}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-4"
        >
          {category?.apps.map((app, index) => (
            <motion.button
              key={app.type}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => {
                onOpenWindow(app.type, app.label);
                onClose();
              }}
              className="group"
            >
              <NeonAppIcon 
                icon={app.icon} 
                color={app.color}
                label={app.label}
              />
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function WindowSwitcher({ windows, activeWindowId, onSwitch, onClose }) {
  if (windows.length <= 1) return null;

  const activeIndex = windows.findIndex(w => w.id === activeWindowId);
  const canGoLeft = activeIndex > 0;
  const canGoRight = activeIndex < windows.length - 1;

  return (
    <div className="fixed top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-2 z-[850] pointer-events-none">
      <AnimatePresence>
        {canGoLeft && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={() => onSwitch(windows[activeIndex - 1].id)}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center pointer-events-auto shadow-lg shadow-cyan-500/30"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
      <div className="flex-1" />
      <AnimatePresence>
        {canGoRight && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={() => onSwitch(windows[activeIndex + 1].id)}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center pointer-events-auto shadow-lg shadow-purple-500/30"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const [showAppDrawer, setShowAppDrawer] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const contentRef = useRef(null);

  // Update active window when windows change
  useEffect(() => {
    if (windows.length === 0) {
      setActiveWindowId(null);
    } else if (!activeWindowId || !windows.find(w => w.id === activeWindowId)) {
      setActiveWindowId(windows[windows.length - 1].id);
    }
  }, [windows, activeWindowId]);

  // Swipe gestures for window switching
  const handleSwipe = useCallback(({ direction }) => {
    if (windows.length <= 1) return;
    
    const activeIndex = windows.findIndex(w => w.id === activeWindowId);
    if (direction === 'left' && activeIndex < windows.length - 1) {
      setActiveWindowId(windows[activeIndex + 1].id);
      onFocusWindow(windows[activeIndex + 1].id);
    } else if (direction === 'right' && activeIndex > 0) {
      setActiveWindowId(windows[activeIndex - 1].id);
      onFocusWindow(windows[activeIndex - 1].id);
    }
  }, [windows, activeWindowId, onFocusWindow]);

  useTouch(contentRef, {
    onSwipe: handleSwipe,
    swipeThreshold: 80,
  });

  const activeWindow = windows.find(w => w.id === activeWindowId);

  const handleOpenWindow = (type, title) => {
    onOpenWindow(type, title);
    setShowAppDrawer(false);
  };

  return (
    <div ref={contentRef} className="relative w-full h-screen overflow-hidden bg-slate-950">
      <AnimatedBackground />
      
      {/* Main Content Area */}
      <div className="flex-1 h-full pb-24">
        {windows.length === 0 ? (
          // Empty State - Stunning home screen
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-8"
            >
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                <Zap className="w-16 h-16 text-white" />
              </div>
              <div className="absolute inset-0 w-32 h-32 rounded-3xl bg-gradient-to-br from-cyan-500 to-purple-500 blur-2xl opacity-50 -z-10" />
            </motion.div>
            
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-bold text-white mb-2"
            >
              NovAura OS
            </motion.h2>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/50 mb-8"
            >
              Mobile Edition
            </motion.p>
            
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              onClick={() => setShowAppDrawer(true)}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl text-white font-semibold shadow-lg shadow-cyan-500/30"
            >
              <Grid className="w-5 h-5" />
              Launch Apps
            </motion.button>
          </div>
        ) : (
          // Render active window full-screen
          <>
            <AnimatePresence mode="wait">
              {windows.map(win => {
                const Component = windowComponents[win.type];
                if (!Component) return null;
                
                return (
                  <MobileWindow
                    key={win.id}
                    window={win}
                    isActive={win.id === activeWindowId}
                    onClose={onCloseWindow}
                    onFocus={setActiveWindowId}
                  >
                    <Suspense fallback={
                      <div className="flex items-center justify-center h-full bg-black/50">
                        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
                      </div>
                    }>
                      <Component {...win.props} />
                    </Suspense>
                  </MobileWindow>
                );
              })}
            </AnimatePresence>
            
            {/* Window Switcher Indicators */}
            <WindowSwitcher
              windows={windows}
              activeWindowId={activeWindowId}
              onSwitch={(id) => {
                setActiveWindowId(id);
                onFocusWindow(id);
              }}
              onClose={onCloseWindow}
            />
            
            {/* Window Count Indicator */}
            {windows.length > 1 && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[850]">
                <GlassCard className="px-4 py-2 flex items-center gap-2">
                  {windows.map((w, i) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        setActiveWindowId(w.id);
                        onFocusWindow(w.id);
                      }}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        w.id === activeWindowId 
                          ? 'w-6 bg-gradient-to-r from-cyan-400 to-purple-400' 
                          : 'bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </GlassCard>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation Bar - Glassmorphism */}
      <div className="fixed bottom-0 left-0 right-0 z-[900] px-4 pb-4">
        <GlassCard className="rounded-2xl border-white/10">
          <div className="flex items-center justify-around py-3">
            {/* App Drawer Button */}
            <Sheet open={showAppDrawer} onOpenChange={setShowAppDrawer}>
              <SheetTrigger asChild>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Grid className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-white/70 font-medium">Apps</span>
                </motion.button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] p-0 bg-slate-950 border-cyan-500/20">
                <AppDrawer 
                  onOpenWindow={handleOpenWindow} 
                  onClose={() => setShowAppDrawer(false)}
                />
              </SheetContent>
            </Sheet>

            {/* Quick App Buttons */}
            {QUICK_APPS.map((app, index) => (
              <motion.button
                key={app.type}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleOpenWindow(app.type, app.label)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-lg`}>
                  <app.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] text-white/70 font-medium">{app.label}</span>
              </motion.button>
            ))}

            {/* Layout Toggle / More Menu */}
            <Sheet open={showQuickActions} onOpenChange={setShowQuickActions}>
              <SheetTrigger asChild>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <MoreHorizontal className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-white/70 font-medium">More</span>
                </motion.button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto bg-slate-950 border-purple-500/20">
                <div className="py-4 space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    Quick Actions
                  </h3>
                  
                  {/* Layout Toggle */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onToggleLayout();
                      setShowQuickActions(false);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-semibold">Switch to Desktop</p>
                      <p className="text-white/50 text-sm">Use floating windows</p>
                    </div>
                  </motion.button>

                  {/* Open Windows List */}
                  {windows.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-white/50 font-medium">Open Apps ({windows.length})</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {windows.map(win => (
                          <motion.button
                            key={win.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setActiveWindowId(win.id);
                              onFocusWindow(win.id);
                              setShowQuickActions(false);
                            }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                              win.id === activeWindowId 
                                ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30' 
                                : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <Layers className="w-5 h-5 text-cyan-400" />
                            <span className="text-sm text-white flex-1 text-left truncate">{win.title}</span>
                            {win.id === activeWindowId && (
                              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Close All */}
                  {windows.length > 0 && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        windows.forEach(w => onCloseWindow(w.id));
                        setShowQuickActions(false);
                      }}
                      className="w-full p-4 rounded-xl bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 text-red-400 font-semibold"
                    >
                      Close All Apps
                    </motion.button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </GlassCard>
        
        {/* Safe Area Spacer for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
