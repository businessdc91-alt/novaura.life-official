import React, { useState, useEffect } from 'react';
import { 
  Palette, Layout, Grid, Check, Moon, Sun, Stars, Monitor,
  Save, RotateCcw, Cpu, Cloud, Waves, Flame, Zap, Sliders, Type,
  Atom, Orbit, Disc, Compass, Sparkles, Activity
} from 'lucide-react';
import { useGraphics, GRAPHICS_LEVELS, GRAPHICS_PRESETS, GRAVITY_MODES } from '../../contexts/GraphicsContext.jsx';
import { APP_REGISTRY } from '../../config/appRegistry.js';

export const THEMES = [
  {
    id: 'cosmic',
    name: 'Cosmic (Default)',
    description: 'Deep space void with RGB constellation links',
    icon: Stars,
    preview: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
    particleColors: ['#00d9ff', '#a855f7', '#ff00ff'],
  },
  {
    id: 'blue-night',
    name: 'Blue Night',
    description: 'Deep navy night with golden sunset stars',
    icon: Moon,
    preview: 'linear-gradient(135deg, #0f1729 0%, #1e293b 100%)',
    particleColors: ['#60a5fa', '#fbbf24', '#f97316'],
  },
  {
    id: 'matrix',
    name: 'Matrix Rain',
    description: 'Air-gapped digital phosphor green code trails',
    icon: Monitor,
    preview: 'linear-gradient(135deg, #000a00 0%, #001400 100%)',
    particleColors: ['#00ff00', '#00f500', '#39ff14'],
  },
  {
    id: 'stormy',
    name: 'Stormy Rain',
    description: 'Thunder clouds with dynamic animated falling rain',
    icon: Cloud,
    preview: 'linear-gradient(135deg, #0d1117 0%, #1a1f29 100%)',
    particleColors: ['#64748b', '#60a5fa', '#a855f7'],
  },
  {
    id: 'cyberstorm',
    name: 'Cyber Storm',
    description: 'Neon-lit storm clouds, RGB lightning & flocks of birds',
    icon: Zap,
    preview: 'linear-gradient(135deg, #05060f 0%, #1a1240 60%, #3a0d3f 100%)',
    particleColors: ['#00f0ff', '#ff2bd6', '#6366f1'],
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    description: 'Dancing northern light ribbons & starry sky',
    icon: Stars,
    preview: 'linear-gradient(135deg, #0a0f1a 0%, #1a1f3a 100%)',
    particleColors: ['#22d3ee', '#a855f7', '#4ade80'],
  },
  {
    id: 'meshwater',
    name: 'Mesh Water',
    description: 'Interactive 3D ocean mesh wave simulation',
    icon: Waves,
    preview: 'linear-gradient(135deg, #0c1a2d 0%, #1a2d4a 100%)',
    particleColors: ['#0ea5e9', '#22d3ee', '#67e8f9'],
  },
  {
    id: 'blaze',
    name: 'Blaze & Embers',
    description: 'Warm fiery embers, heat distortion & rising sparks',
    icon: Flame,
    preview: 'linear-gradient(135deg, #1a0f05 0%, #2d1a0a 100%)',
    particleColors: ['#fbbf24', '#f97316', '#ef4444'],
  },
  {
    id: 'light',
    name: 'Aurora Light',
    description: 'Ethereal warm cream tones — soft on the eyes',
    icon: Sun,
    preview: 'linear-gradient(135deg, #f5f2ed 0%, #e8e5e0 100%)',
    particleColors: ['#5a8a6e', '#b86b7e', '#c9a35f'],
  },
];

export const FONTS = [
  { id: 'default', name: 'Inter (Modern UI)', family: "'Inter', system-ui, sans-serif" },
  { id: 'razor', name: 'Orbitron (Cyberpunk/Razor)', family: "'Orbitron', sans-serif" },
  { id: 'luxe', name: 'Playfair (Editorial/Luxe)', family: "'Playfair Display', serif" },
  { id: 'nova', name: 'Montserrat (Geometric)', family: "'Montserrat', sans-serif" },
  { id: 'code', name: 'JetBrains Mono (Console)', family: "'JetBrains Mono', monospace" },
  { id: 'gothic', name: 'Cinzel (Classical)', family: "'Cinzel', serif" },
  { id: 'soft', name: 'Quicksand (Rounded)', family: "'Quicksand', sans-serif" },
];

const GRAVITY_MODE_DEFS = [
  {
    id: GRAVITY_MODES.WELL,
    name: 'Newtonian Gravity Well',
    icon: Atom,
    description: 'Inverse-square attraction (F = G·M/r²) with orbital tangential arcs',
    tag: 'DEFAULT PHYSICS',
  },
  {
    id: GRAVITY_MODES.REPULSION,
    name: 'Anti-Gravity Forcefield',
    icon: Compass,
    description: 'Kinetic repulsor bubble pushing particles away with bow shockwaves',
    tag: 'REPULSOR',
  },
  {
    id: GRAVITY_MODES.VORTEX,
    name: 'Cosmic Kerr Vortex',
    icon: Disc,
    description: 'Singularity with relativistic accretion disk swirl & tangential velocity',
    tag: 'BLACK HOLE',
  },
  {
    id: GRAVITY_MODES.CELESTIAL,
    name: 'Multi-Body Celestial',
    icon: Orbit,
    description: 'Multi-body slingshots interacting with 4 wandering stellar attractors',
    tag: 'ORBITAL',
  },
  {
    id: GRAVITY_MODES.MESH,
    name: 'Fluid Spring Water Mesh',
    icon: Waves,
    description: 'Hooke\'s law 2D lattice spring tension, Laplacian wave propagation & ripples',
    tag: 'FLUID DYNAMICS',
  },
];

export default function PersonalizationWindow({ onThemeChange, currentTheme = 'cosmic' }) {
  const [activeTab, setActiveTab] = useState('physics'); // 'physics', 'themes', 'graphics', 'fonts'
  const [selectedTheme, setSelectedTheme] = useState(() => {
    return localStorage.getItem('novaura-theme') || currentTheme || 'cosmic';
  });
  const [selectedFont, setSelectedFont] = useState(() => {
    return localStorage.getItem('novaura-font') || 'default';
  });

  const {
    graphicsLevel,
    setGraphicsLevel,
    settings,
    detectedLevel,
    gravityMode,
    setGravityMode,
    gravityStrength,
    setGravityStrength,
    shockwavesEnabled,
    setShockwavesEnabled,
    calmBehindWindows,
    setCalmBehindWindows,
  } = useGraphics();

  const handleSelectTheme = (themeId) => {
    setSelectedTheme(themeId);
    try {
      localStorage.setItem('novaura-theme', themeId);
      document.documentElement.setAttribute('data-theme', themeId);
      window.dispatchEvent(new CustomEvent('novaura-theme-change', { detail: themeId }));
      window.dispatchEvent(new CustomEvent('novaura-theme-update', { detail: themeId }));
      if (onThemeChange) onThemeChange(themeId);
    } catch {}
  };

  const handleSelectFont = (fontId) => {
    setSelectedFont(fontId);
    const fontDef = FONTS.find(f => f.id === fontId);
    if (fontDef) {
      try {
        localStorage.setItem('novaura-font', fontId);
        document.body.style.fontFamily = fontDef.family;
      } catch {}
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950/95 text-slate-100 p-6 overflow-y-auto select-none font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Atom className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Personalization & Gravity Engine
            </h1>
            <p className="text-xs text-slate-400">
              Universal physics laws, gravitational attraction, 8-theme engine & typography
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('physics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'physics' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Physics & Gravity
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'themes' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Themes ({THEMES.length})
          </button>
          <button
            onClick={() => setActiveTab('graphics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'graphics' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Graphics Fidelity
          </button>
          <button
            onClick={() => setActiveTab('fonts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'fonts' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Typography
          </button>
        </div>
      </div>

      {/* Tab 0: Physics & Gravity Engine */}
      {activeTab === 'physics' && (
        <div className="mt-6 space-y-6 max-w-3xl">
          {/* Gravity Laws Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Active Gravitational Law</h3>
                <p className="text-xs text-slate-400">Select the universal law governing desktop particles and fluid mesh</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono uppercase">
                Mode: {gravityMode}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {GRAVITY_MODE_DEFS.map((def) => {
                const Icon = def.icon;
                const isSelected = gravityMode === def.id;
                return (
                  <div
                    key={def.id}
                    onClick={() => setGravityMode(def.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                        <span className="font-semibold text-xs text-slate-100">{def.name}</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {def.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{def.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gravity Strength & Physics Controls */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Gravitational Constant (G)
                </span>
                <p className="text-[11px] text-slate-400">Attraction strength & kinetic impulse coefficient</p>
              </div>
              <span className="font-mono text-cyan-400 text-sm font-bold">
                {gravityStrength.toFixed(2)}x
              </span>
            </div>

            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.05"
              value={gravityStrength}
              onChange={(e) => setGravityStrength(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                <span className="text-xs font-medium text-slate-200">Gravitational Shockwave on Click</span>
                <p className="text-[10px] text-slate-400">Blasts particles outward in a high-speed compression ring when clicking</p>
              </div>
              <button
                onClick={() => setShockwavesEnabled(!shockwavesEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  shockwavesEnabled ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform absolute top-1 ${
                    shockwavesEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                <span className="text-xs font-medium text-slate-200">Calm Background Behind Windows</span>
                <p className="text-[10px] text-slate-400">Dims the background and slows it to half speed while app windows are open. It always pauses while Sovereign is minimized or another app has focus.</p>
              </div>
              <button
                onClick={() => setCalmBehindWindows(!calmBehindWindows)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  calmBehindWindows ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform absolute top-1 ${
                    calmBehindWindows ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Realtime Diagnostics Readout */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2 font-mono text-xs text-slate-400">
            <div className="flex items-center gap-2 text-cyan-300 font-bold mb-1">
              <Activity className="w-4 h-4" /> Realtime Physics Telemetry
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>• Active Particles: <span className="text-slate-100">{settings.particles.count}</span></div>
              <div>• Micro Dust: <span className="text-slate-100">{settings.particles.microCount}</span></div>
              <div>• Hover Tracking: <span className="text-emerald-400">Continuous 60 FPS</span></div>
              <div>• Boundary Law: <span className="text-slate-100">Elastic Restitution (e = 0.85)</span></div>
              <div>• Damping Factor: <span className="text-slate-100">0.990 (Viscous)</span></div>
              <div>• Shockwave Wavefront: <span className="text-slate-100">{shockwavesEnabled ? 'Super-Sonic (15px/frame)' : 'Disabled'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Themes */}
      {activeTab === 'themes' && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const isActive = selectedTheme === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  className={`group relative p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                    isActive
                      ? 'border-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.3)] bg-slate-900/90'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900/70'
                  }`}
                >
                  <div 
                    className="w-full h-20 rounded-xl mb-3 border border-white/10 relative overflow-hidden flex items-center justify-center"
                    style={{ background: t.preview }}
                  >
                    <div className="flex items-center gap-2">
                      {t.particleColors.map((c, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 rounded-full shadow-lg border border-white/20 animate-pulse"
                          style={{ background: c, animationDelay: `${i * 300}ms` }}
                        />
                      ))}
                    </div>
                    {isActive && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" /> ACTIVE
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-white'}`} />
                    <span className="font-semibold text-sm text-slate-100">{t.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{t.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Graphics Engine */}
      {activeTab === 'graphics' && (
        <div className="mt-6 space-y-6 max-w-2xl">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Hardware Detection</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Recommended tier based on detected GPU & compute cores: <span className="text-cyan-400 font-bold uppercase">{detectedLevel || 'MEDIUM'}</span>
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                Current: {graphicsLevel.toUpperCase()}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {Object.values(GRAPHICS_LEVELS).map((lvl) => {
                const isSelected = graphicsLevel === lvl;
                const preset = GRAPHICS_PRESETS[lvl];
                return (
                  <button
                    key={lvl}
                    onClick={() => setGraphicsLevel(lvl)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs uppercase text-slate-200">{preset.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">{preset.description}</p>
                    <div className="mt-2 text-[10px] text-slate-500 font-mono">
                      {preset.particles.count} particles • {preset.particles.links ? 'Links On' : 'Links Off'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Typography */}
      {activeTab === 'fonts' && (
        <div className="mt-6 space-y-4 max-w-2xl">
          <div className="space-y-2.5">
            {FONTS.map((f) => {
              const isSelected = selectedFont === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => handleSelectFont(f.id)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/10 shadow-sm'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                  }`}
                >
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">{f.name}</span>
                    <span className="text-base text-slate-100 font-medium" style={{ fontFamily: f.family }}>
                      The quick brown fox jumps over the lazy dog 0123456789
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
