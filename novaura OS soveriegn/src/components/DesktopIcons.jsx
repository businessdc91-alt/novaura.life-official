import React, { useState, useEffect, useRef, useCallback } from 'react';
import { APP_REGISTRY, getAppById } from '../config/appRegistry.js';
import { 
  Sparkles, RotateCcw, Grid, ExternalLink, ShieldCheck, 
  Mail, PhoneCall, Code2, Layers, CheckCircle2 
} from 'lucide-react';

const STORAGE_KEY = 'novaura-desktop-icon-positions';
const CONFIG_KEY = 'novaura-desktop-icons-config';

const ICON_WIDTH = 84;
const ICON_HEIGHT = 96;
const GRID_GAP_X = 20;
const GRID_GAP_Y = 16;
const START_X = 28;
const START_Y = 24;

export default function DesktopIcons({ openApp, openWindows = [], unreadMail = 0, theme = 'cosmic' }) {
  const [positions, setPositions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [selectedId, setSelectedId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ id: null, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const containerRef = useRef(null);

  // Compute default grid coordinates for an index
  const getDefaultPos = useCallback((index) => {
    const availableHeight = typeof window !== 'undefined' ? window.innerHeight - 200 : 700;
    const rows = Math.max(4, Math.floor(availableHeight / (ICON_HEIGHT + GRID_GAP_Y)));
    const col = Math.floor(index / rows);
    const row = index % rows;
    return {
      x: START_X + col * (ICON_WIDTH + GRID_GAP_X),
      y: START_Y + row * (ICON_HEIGHT + GRID_GAP_Y),
    };
  }, []);

  // Save positions to localStorage
  const savePositions = useCallback((newPositions) => {
    setPositions(newPositions);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPositions));
    } catch (e) {
      console.warn('Failed to save desktop positions:', e);
    }
  }, []);

  // Reset all icon positions back to clean auto-aligned grid
  const handleAutoArrange = useCallback(() => {
    const newPos = {};
    APP_REGISTRY.forEach((app, idx) => {
      newPos[app.id] = getDefaultPos(idx);
    });
    savePositions(newPos);
    setContextMenu(null);
  }, [getDefaultPos, savePositions]);

  // Mouse down on icon (initiates drag or selection)
  const handleMouseDown = (e, appId) => {
    // Only handle left clicks for drag/select
    if (e.button !== 0) return;
    e.stopPropagation();

    const currentPos = positions[appId] || getDefaultPos(APP_REGISTRY.findIndex(a => a.id === appId));
    dragRef.current = {
      id: appId,
      startX: e.clientX,
      startY: e.clientY,
      origX: currentPos.x,
      origY: currentPos.y,
      moved: false,
    };

    setSelectedId(appId);
    setContextMenu(null);

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragRef.current.moved = true;
        setIsDragging(true);

        const maxX = (window.innerWidth || 1200) - ICON_WIDTH - 20;
        const maxY = (window.innerHeight || 800) - ICON_HEIGHT - 120;
        const newX = Math.max(16, Math.min(maxX, dragRef.current.origX + dx));
        const newY = Math.max(16, Math.min(maxY, dragRef.current.origY + dy));

        setPositions(prev => ({
          ...prev,
          [appId]: { x: newX, y: newY }
        }));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (dragRef.current.moved) {
        // Dragged to new spot — persist final position
        setPositions(current => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          } catch {}
          return current;
        });
      }
      setIsDragging(false);
      dragRef.current.id = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Open on click (when not dragging)
  const handleIconClick = (e, appId) => {
    e.stopPropagation();
    if (!dragRef.current.moved) {
      setSelectedId(appId);
      openApp(appId);
    }
  };

  // Right-click context menu on specific icon
  const handleContextMenu = (e, app) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(app.id);
    const menuWidth = 190;
    const menuHeight = 170;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenu({ x, y, app });
  };

  // Click on empty canvas deselects and closes menu
  useEffect(() => {
    const handleGlobalClick = () => {
      setSelectedId(null);
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Listen to keyboard Enter to launch selected
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && selectedId) {
        openApp(selectedId);
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, openApp]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden"
    >
      {/* Interactive Desktop Icons Canvas */}
      <div className="relative w-full h-full pointer-events-none">
        {APP_REGISTRY.map((app, index) => {
          const Icon = app.icon;
          const pos = positions[app.id] || getDefaultPos(index);
          const isSelected = selectedId === app.id;
          const isRunning = openWindows.some(w => (w.type || w.appType) === app.id);
          const hasUnreadMail = app.id === 'novamail' && unreadMail > 0;
          const isSentinel = app.id === 'sentinel';

          return (
            <div
              key={app.id}
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                width: `${ICON_WIDTH}px`,
                height: `${ICON_HEIGHT}px`,
              }}
              onMouseDown={(e) => handleMouseDown(e, app.id)}
              onClick={(e) => handleIconClick(e, app.id)}
              onContextMenu={(e) => handleContextMenu(e, app)}
              className={`absolute top-0 left-0 flex flex-col items-center justify-start p-1.5 rounded-2xl cursor-pointer pointer-events-auto transition-all duration-150 group ${
                isDragging && dragRef.current.id === app.id ? 'z-50 scale-105 opacity-90' : 'z-10'
              } ${
                isSelected
                  ? 'bg-cyan-500/15 ring-1.5 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.35)] backdrop-blur-md'
                  : 'hover:bg-slate-800/40 hover:backdrop-blur-sm'
              }`}
            >
              {/* Premium 3D Squircle Icon Container */}
              <div className="relative">
                <div
                  className="w-13 h-13 rounded-2xl flex items-center justify-center transition-all duration-300 relative overflow-hidden group-hover:scale-108 group-hover:-translate-y-0.5 group-active:scale-95 shadow-lg border"
                  style={{
                    background: isSelected 
                      ? `linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))`
                      : `linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.75))`,
                    borderColor: isSelected ? `${app.color}cc` : `${app.color}45`,
                    boxShadow: isSelected
                      ? `0 0 18px ${app.color}80, inset 0 1px 1px rgba(255, 255, 255, 0.3)`
                      : `0 4px 14px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.15)`,
                  }}
                >
                  {/* Chromatic ambient glow on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 50% 30%, ${app.color}, transparent 70%)`
                    }}
                  />

                  {/* Specular glass reflection bar across upper curve */}
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent rounded-t-2xl pointer-events-none" />

                  {/* Lucide Vector Icon */}
                  <Icon
                    className="w-6.5 h-6.5 transition-all duration-300 relative z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                    style={{
                      color: app.color,
                      filter: isSelected ? `drop-shadow(0 0 6px ${app.color})` : undefined
                    }}
                  />

                  {/* Running state indicator pip at bottom */}
                  {isRunning && (
                    <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                  )}
                </div>

                {/* Unread Mail Counter Badge */}
                {hasUnreadMail && (
                  <div className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-4.5 h-4.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-lg shadow-rose-500/50 border border-white/30 animate-bounce">
                    {unreadMail > 9 ? '9+' : unreadMail}
                  </div>
                )}

                {/* Sentinel Active Shield Dot */}
                {isSentinel && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_8px_#10b981] border border-white/40">
                    <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Icon Label with High-Contrast Glass Readability */}
              <span
                className={`text-[11px] font-medium mt-1.5 truncate max-w-[80px] text-center transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
                  isSelected
                    ? 'text-cyan-200 font-semibold'
                    : 'text-slate-200 group-hover:text-white'
                }`}
              >
                {app.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Glassmorphic Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[9999] w-48 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 shadow-2xl shadow-black/80 rounded-xl p-1.5 flex flex-col gap-1 text-xs text-slate-200 animate-in fade-in duration-100"
        >
          <div className="px-2.5 py-1.5 border-b border-slate-800 flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: contextMenu.app.color }}
            />
            <span className="font-semibold text-white truncate">
              {contextMenu.app.label}
            </span>
          </div>

          <button
            onClick={() => {
              openApp(contextMenu.app.id);
              setContextMenu(null);
              setSelectedId(null);
            }}
            className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-cyan-500/20 hover:text-cyan-300 flex items-center gap-2 transition-colors font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span>Launch App</span>
          </button>

          <button
            onClick={() => {
              const appIdx = APP_REGISTRY.findIndex(a => a.id === contextMenu.app.id);
              const def = getDefaultPos(appIdx);
              setPositions(prev => {
                const next = { ...prev, [contextMenu.app.id]: def };
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                } catch {}
                return next;
              });
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Position</span>
          </button>

          <button
            onClick={handleAutoArrange}
            className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-2 transition-colors border-t border-slate-800 pt-1.5"
          >
            <Grid className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto-Arrange All</span>
          </button>
        </div>
      )}
    </div>
  );
}
