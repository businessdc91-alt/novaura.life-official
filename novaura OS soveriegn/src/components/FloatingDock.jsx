import React, { useState } from 'react';
import { APP_REGISTRY } from '../config/appRegistry.js';

export default function FloatingDock({
  openApp,
  openWindows = [],
  isOpen = true,
}) {
  const [hoveredApp, setHoveredApp] = useState(null);

  // Core dock apps (e.g. Cybeni, Files, Terminal, Browser, Studio, Mail, Settings)
  const dockApps = APP_REGISTRY.slice(0, 10);

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-35 select-none transition-all duration-300 ease-in-out ${
        isOpen
          ? 'bottom-16 opacity-100 scale-100 pointer-events-auto'
          : 'bottom-2 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/85 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl">
        {dockApps.map((app) => {
          const Icon = app.icon;
          const isOpen = openWindows.some(w => (w.id || w.appType) === app.id);
          const isHovered = hoveredApp === app.id;

          return (
            <div
              key={app.id}
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHoveredApp(app.id)}
              onMouseLeave={() => setHoveredApp(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-10 px-2.5 py-1 bg-slate-900/95 border border-slate-700 text-slate-100 text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap pointer-events-none transition-all">
                  {app.label}
                </div>
              )}

              {/* App Icon Button */}
              <button
                onClick={() => openApp(app.id)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isHovered ? 'scale-115 -translate-y-1' : 'hover:scale-105'
                }`}
                style={{
                  background: isOpen ? 'rgba(30, 41, 59, 0.9)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isOpen ? app.color : 'rgba(51, 65, 85, 0.5)'}`,
                  boxShadow: isOpen ? `0 0 12px ${app.color}30` : 'none',
                }}
              >
                <Icon className="w-5 h-5 transition-colors" style={{ color: app.color }} />
              </button>

              {/* Running indicator dot */}
              {isOpen && (
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1 transition-all"
                  style={{
                    backgroundColor: app.color,
                    boxShadow: `0 0 6px ${app.color}`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
