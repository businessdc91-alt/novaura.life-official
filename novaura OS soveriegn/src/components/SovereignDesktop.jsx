import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import ParticleBackground from './ParticleBackground';
import DraggableWindow from './DraggableWindow';
import SystemBar from './SystemBar';
import DesktopIcons from './DesktopIcons';
import Toolbar from './Toolbar';
import FloatingCompanions from './companions/FloatingCompanions';
import AppLauncherModal from './AppLauncherModal';
import { KernelErrorBoundary } from '../kernel/KernelErrorBoundary';
import { useKernel } from '../kernel/useKernel';
import { kernel as kernelSingleton } from '../kernel/NovaKernel.js';
import { APP_MAP, getAppById } from '../config/appRegistry';
import { getLocalIdentity, getUnreadCount } from '../services/sovereignMesh';
// Side-effect imports: register AI Lounge and Inference Exchange mesh handlers at boot,
// so hosting and room presence work while their window is closed.
import '../services/aiLoungeService';
// Registers the user's own apps (Cybeni / Discovery Forge builds) in the launcher.
import '../services/forge/userApps';
import { callService, CallState } from '../services/sovereignCallService';
import { Phone, PhoneCall, PhoneOff, Video } from 'lucide-react';
import SovereignLeftSidebar from './SovereignLeftSidebar';
import SovereignRightSidebar from './SovereignRightSidebar';
import SovereignChatBar from './SovereignChatBar';
import { useGraphics } from '../contexts/GraphicsContext';

const VALID_THEMES = ['cosmic', 'blue-night', 'matrix', 'stormy', 'aurora', 'meshwater', 'blaze', 'light'];

// Shown while a lazily loaded app window's code is fetched.
function WindowLoading({ color = '#00f0ff' }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, gap: 10 }}>
      <span className="animate-spin" style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${color}`, borderTopColor: 'transparent' }} />
      Loading…
    </div>
  );
}

export default function SovereignDesktop({ authRecord, onRevoke }) {
  const rawKernel = useKernel();
  const kernel = rawKernel?.wm ? rawKernel : (rawKernel?.kernel || rawKernel || kernelSingleton);
  const { graphicsLevel, setGraphicsLevel } = useGraphics();
  const [windows, setWindows] = useState([]);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('novaura-theme');
      return VALID_THEMES.includes(saved) ? saved : 'cosmic';
    } catch {
      return 'cosmic';
    }
  });
  const [identity, setIdentity] = useState(null);
  const [unreadMail, setUnreadMail] = useState(0);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isDockOpen, setIsDockOpen] = useState(true);
  const [focusedId, setFocusedId] = useState(null);
  const [meshToasts, setMeshToasts] = useState([]);

  // Apply theme to document data-theme attribute whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('novaura-theme', theme);

    // Listen to theme changes from PersonalizationWindow or settings
    const onThemeUpdate = (e) => {
      const newTheme = e.detail;
      if (VALID_THEMES.includes(newTheme)) {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };
    window.addEventListener('novaura-theme-update', onThemeUpdate);

    const onStorage = (e) => {
      if (e.key === 'novaura-theme' && VALID_THEMES.includes(e.newValue)) {
        setTheme(e.newValue);
        document.documentElement.setAttribute('data-theme', e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('novaura-theme-update', onThemeUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [theme]);

  // Subscribe to Kernel WindowManager
  useEffect(() => {
    const getWM = () => kernel?.wm || kernelSingleton?.wm;
    let unsub = null;

    const initWM = (wm) => {
      const existing = wm.getAll();
      if (existing.length === 0) {
        const hasCompletedOnboarding = localStorage.getItem('novaura_onboarding_completed');
        if (!hasCompletedOnboarding) {
          const wGuide = wm.open('onboarding_guide', 'Sovereign Onboarding, Dual Neural Core & Legal Enclave');
          if (wGuide?.id) setFocusedId(wGuide.id);
        } else {
          const w1 = wm.open('cybeni', 'Cybeni Builder — Omni Architecture IDE');
          const w2 = wm.open('files', 'Storage Explorer & Cloud Mount');
          if (w2?.id) setFocusedId(w2.id);
        }
      } else {
        setWindows([...existing]);
        const last = existing[existing.length - 1];
        if (last && last.state !== 'minimized') setFocusedId(last.id);
      }
      unsub = wm.subscribe((all) => {
        setWindows([...all]);
      });
    };

    const currentWM = getWM();
    if (currentWM) {
      initWM(currentWM);
    } else {
      const timer = setInterval(() => {
        const readyWM = getWM();
        if (readyWM) {
          clearInterval(timer);
          initWM(readyWM);
        }
      }, 50);
      return () => {
        clearInterval(timer);
        unsub?.();
      };
    }

    return () => unsub?.();
  }, [kernel]);

  // Load identity & mail count
  useEffect(() => {
    const localId = getLocalIdentity();
    if (localId) setIdentity(localId);

    setUnreadMail(getUnreadCount());
    const mailTimer = setInterval(() => setUnreadMail(getUnreadCount()), 5000);

    // Global Cmd+K / Ctrl+K shortcut for App Launcher
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setLauncherOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(mailTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Listen to Decentralized Incoming Calls across the Mesh
  useEffect(() => {
    const handleIncomingCall = (e) => {
      setIncomingCall(e.detail);
    };
    const handleStateChange = (e) => {
      if (e.detail.state !== CallState.RINGING) {
        setIncomingCall(null);
      }
    };
    callService.addEventListener('incoming_call', handleIncomingCall);
    callService.addEventListener('state_change', handleStateChange);
    return () => {
      callService.removeEventListener('incoming_call', handleIncomingCall);
      callService.removeEventListener('state_change', handleStateChange);
    };
  }, []);

  const openApp = useCallback((appId, props = {}) => {
    const wm = kernel?.wm || kernelSingleton?.wm;
    if (!wm) {
      console.warn(`[Desktop] WindowManager not ready for: ${appId}`);
      return;
    }
    const appDef = getAppById(appId);
    if (!appDef) {
      console.warn(`App definition not found for: ${appId}`);
      return;
    }

    // If already open, restore if minimized, toggle minimize if currently focused, or focus
    const existing = wm.getAll().find(w => (w.type || w.appType) === appId);
    if (existing) {
      if (props && Object.keys(props).length > 0) {
        existing.props = { ...(existing.props || {}), ...props };
      }
      if (existing.state === 'minimized') {
        wm.restore(existing.id);
        wm.focus(existing.id);
        setFocusedId(existing.id);
      } else if (focusedId === existing.id) {
        wm.minimize(existing.id);
        setFocusedId(null);
      } else {
        wm.focus(existing.id);
        setFocusedId(existing.id);
      }
    } else {
      const newWin = wm.open(appId, appDef.title, props);
      if (newWin?.id) setFocusedId(newWin.id);
    }
  }, [kernel, focusedId]);

  // Global listener allowing any window/component to trigger window opens
  useEffect(() => {
    const handleOpenWindowCustom = (e) => {
      const appId = typeof e.detail === 'string' ? e.detail : e.detail?.appId;
      const props = typeof e.detail === 'object' ? e.detail?.props : undefined;
      if (appId) {
        openApp(appId, props);
      }
    };
    window.addEventListener('novaura-open-window', handleOpenWindowCustom);
    return () => window.removeEventListener('novaura-open-window', handleOpenWindowCustom);
  }, [openApp]);

  // Swarm Mesh Notification Toasts listener
  useEffect(() => {
    const handleMeshToast = (e) => {
      const toast = {
        id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: e.detail?.type || 'info',
        title: e.detail?.title || 'Swarm Event',
        message: e.detail?.message || '',
        action: e.detail?.action,
      };
      setMeshToasts(prev => [...prev.slice(-3), toast]);
      setTimeout(() => {
        setMeshToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 5500);
    };
    window.addEventListener('novaura:mesh_toast', handleMeshToast);
    return () => window.removeEventListener('novaura:mesh_toast', handleMeshToast);
  }, []);

  const handleAnswerIncomingCall = async (video = true) => {
    try {
      await callService.answerCall(video);
      setIncomingCall(null);
      openApp('novaphone');
    } catch (err) {
      console.warn('[Desktop] Answer error:', err);
    }
  };

  const handleDeclineIncomingCall = () => {
    callService.rejectCall();
    setIncomingCall(null);
  };

  const handleCloseWindow = useCallback((id) => {
    (kernel?.wm || kernelSingleton?.wm)?.close(id);
    setFocusedId(prev => prev === id ? null : prev);
  }, [kernel]);

  const handleFocusWindow = useCallback((id) => {
    if (focusedId === id) return;
    setFocusedId(id);
    (kernel?.wm || kernelSingleton?.wm)?.focus(id);
  }, [focusedId, kernel]);

  const handleMinimizeWindow = useCallback((id) => {
    (kernel?.wm || kernelSingleton?.wm)?.minimize(id);
    setFocusedId(prev => prev === id ? null : prev);
  }, [kernel]);

  const handleRestoreWindow = useCallback((id) => {
    setFocusedId(id);
    const wm = kernel?.wm || kernelSingleton?.wm;
    if (wm) {
      wm.restore(id);
      wm.focus(id);
    }
  }, [kernel]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background font-sans select-none flex flex-col">
      {/* 1. Dynamic High-Fidelity Particle Background with 8-Theme Support */}
      <ParticleBackground
        theme={theme}
        config="idle"
      />

      {/* 2. Top System Bar with Active & Minimized Windows Taskbar Tray */}
      <SystemBar
        identity={identity}
        openApp={openApp}
        unreadMail={unreadMail}
        onOpenLauncher={() => setLauncherOpen(true)}
        windows={windows}
        focusedId={focusedId}
        onFocusWindow={handleFocusWindow}
        onMinimizeWindow={handleMinimizeWindow}
        onRestoreWindow={handleRestoreWindow}
        onCloseWindow={handleCloseWindow}
      />

      {/* 3. Left App Drawer Sidebar */}
      <SovereignLeftSidebar
        openApp={openApp}
        openWindows={windows}
      />

      {/* 4. Right Telemetry & Identity HUD Sidebar */}
      <SovereignRightSidebar
        openApp={openApp}
      />

      {/* 5. Main Desktop Canvas with Desktop Icons & Windows — bounded above the bottom dock */}
      <div
        className={`relative flex-1 overflow-hidden transition-[margin] duration-300 ease-in-out ${
          isDockOpen ? 'mb-28' : 'mb-16'
        }`}
      >
        {/* Desktop Icons */}
        <DesktopIcons
          openApp={openApp}
          openWindows={windows}
          unreadMail={unreadMail}
          theme={theme}
        />

        {/* Desktop Windows Map */}
        {windows.map((win, idx) => {
          const appDef = getAppById(win.type || win.appType);
          if (!appDef) return null;
          const WindowComponent = appDef.component;
          const isWinFocused = focusedId === win.id;

          return (
            <DraggableWindow
              key={win.id}
              title={win.title || appDef.title}
              zIndex={win.zIndex || 10 + idx}
              defaultSize={appDef.defaultSize || { width: 880, height: 600 }}
              initialOffset={idx * 28}
              minimized={win.state === 'minimized'}
              focused={isWinFocused}
              titleColor={appDef.color}
              onFocus={() => handleFocusWindow(win.id)}
              onClose={() => handleCloseWindow(win.id)}
              onMinimize={() => handleMinimizeWindow(win.id)}
            >
              <KernelErrorBoundary windowId={win.id} appType={win.type || win.appType}>
                <Suspense fallback={<WindowLoading color={appDef.color} />}>
                  <WindowComponent
                    windowId={win.id}
                    props={win.props}
                    onClose={() => handleCloseWindow(win.id)}
                  />
                </Suspense>
              </KernelErrorBoundary>
            </DraggableWindow>
          );
        })}
      </div>

      {/* 6. Bottom UI Layer (Toolbar dock slides up above SovereignChatBar) */}
      <div className="fixed bottom-0 left-0 right-0 z-[8000] flex flex-col items-center pointer-events-none pb-3">
        {/* Toolbar — slides up from behind ChatBar */}
        <div
          className={`pointer-events-auto transition-all duration-300 ease-in-out ${
            isDockOpen ? 'max-h-24 opacity-100 mb-2' : 'max-h-0 opacity-0 overflow-hidden mb-0'
          }`}
        >
          <Toolbar
            onOpenWindow={openApp}
            openWindows={windows}
          />
        </div>

        {/* Sovereign Chat Bar with centered toggle tab */}
        <div className="pointer-events-auto w-full">
          <SovereignChatBar
            openApp={openApp}
            isDockOpen={isDockOpen}
            onToggleDock={() => setIsDockOpen(prev => !prev)}
          />
        </div>
      </div>

      {/* 8. Always-Present Floating Aura & Nova Companions */}
      <FloatingCompanions />

      {/* 9. Full App Launcher Modal (Cmd+K) */}
      <AppLauncherModal
        isOpen={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        onLaunchApp={openApp}
      />

      {/* 7. Incoming Sovereign Call HUD Notification */}
      {incomingCall && (
        <div className="absolute top-12 right-6 z-50 w-84 bg-slate-900/95 backdrop-blur-xl border border-emerald-500/50 shadow-2xl shadow-emerald-500/20 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <PhoneCall className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono font-bold">
                Incoming Sovereign Call
              </div>
              <div className="text-sm font-semibold text-white">
                {incomingCall.remoteNumber || '+1-700-NOVA-XXXX'}
              </div>
              <div className="text-[11px] text-slate-400">
                Peer: @{incomingCall.remoteHandle || 'operator'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            <button
              onClick={handleDeclineIncomingCall}
              className="flex-1 py-2 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
            <button
              onClick={() => handleAnswerIncomingCall(true)}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-500/30"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Answer</span>
            </button>
          </div>
        </div>
      )}

      {/* 10. Swarm Mesh Real-Time Notification Toasts Stack */}
      {meshToasts.length > 0 && (
        <div className="absolute bottom-16 right-6 z-[9500] flex flex-col gap-2 pointer-events-none max-w-sm">
          {meshToasts.map(toast => (
            <div
              key={toast.id}
              className="pointer-events-auto p-3.5 rounded-xl bg-slate-900/95 border border-cyan-500/30 shadow-2xl backdrop-blur-xl text-xs space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{toast.title}</span>
                </span>
                <button
                  onClick={() => setMeshToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  ×
                </button>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">{toast.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
