import React, { useState } from 'react';
import { Monitor, Zap, Eye, X, Check, CheckCircle2 } from 'lucide-react';
import { useGraphics, GRAPHICS_LEVELS } from '../../contexts/GraphicsContext.jsx';

const GRAPHICS_PRESETS = {
  low: {
    name: 'Performance',
    description: 'Maximum performance, minimal visuals',
    icon: Zap,
    color: '#34d399',
    particles: 75,
    shadows: false,
    effects: false,
    resolution: '720p',
    fps: '60+',
  },
  medium: {
    name: 'Balanced',
    description: 'Good balance of visuals and performance',
    icon: Monitor,
    color: '#fbbf24',
    particles: 220,
    shadows: true,
    effects: true,
    resolution: '1080p',
    fps: '30-60',
  },
  high: {
    name: 'Visuals',
    description: 'Maximum visual fidelity & orbital gravity',
    icon: Eye,
    color: '#f472b6',
    particles: 480,
    shadows: true,
    effects: true,
    resolution: '1440p+',
    fps: '15-30',
  },
};

const PARTICLE_THEMES = [
  { id: 'cosmic', name: 'Cosmic', gradient: 'linear-gradient(135deg, #0a0a0f, #1a1a2e)', preview: ['#00d9ff', '#a855f7', '#ff00ff'] },
  { id: 'blue-night', name: 'Blue Night', gradient: 'linear-gradient(135deg, #0f1729, #1e293b)', preview: ['#60a5fa', '#fbbf24', '#f97316'] },
  { id: 'matrix', name: 'Matrix Rain', gradient: 'linear-gradient(135deg, #000a00, #001400)', preview: ['#00ff00', '#00f500', '#39ff14'] },
  { id: 'stormy', name: 'Stormy Rain', gradient: 'linear-gradient(135deg, #0d1117, #1a1f29)', preview: ['#64748b', '#60a5fa', '#a855f7'] },
  { id: 'aurora', name: 'Aurora Borealis', gradient: 'linear-gradient(135deg, #0a0f1a, #1a1f3a)', preview: ['#22d3ee', '#a855f7', '#4ade80'] },
  { id: 'meshwater', name: 'Mesh Water', gradient: 'linear-gradient(135deg, #0c1a2d, #1a2d4a)', preview: ['#0ea5e9', '#22d3ee', '#67e8f9'] },
  { id: 'blaze', name: 'Blaze & Embers', gradient: 'linear-gradient(135deg, #1a0f05, #2d1a0a)', preview: ['#fbbf24', '#f97316', '#ef4444'] },
  { id: 'light', name: 'Aurora Light', gradient: 'linear-gradient(135deg, #f5f2ed, #e8e5e0)', preview: ['#5a8a6e', '#b86b7e', '#c9a35f'] },
];

export default function GraphicsSettingsWindow({ 
  onClose, 
  currentTheme, 
  onThemeChange,
  currentGraphicsLevel,
  onGraphicsLevelChange,
  currentIntensity,
  onIntensityChange,
}) {
  const {
    graphicsLevel,
    setGraphicsLevel,
    gravityStrength,
    setGravityStrength,
  } = useGraphics();

  const [selectedTheme, setSelectedTheme] = useState(() => {
    return currentTheme || localStorage.getItem('novaura-theme') || 'cosmic';
  });
  const [selectedLevel, setSelectedLevel] = useState(() => {
    return currentGraphicsLevel || graphicsLevel || 'medium';
  });
  const [selectedIntensity, setSelectedIntensity] = useState(() => {
    if (currentIntensity !== undefined) return currentIntensity;
    if (gravityStrength !== undefined) return gravityStrength;
    return 1.0;
  });
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    try {
      if (selectedTheme) {
        localStorage.setItem('novaura-theme', selectedTheme);
        document.documentElement.setAttribute('data-theme', selectedTheme);
        window.dispatchEvent(new CustomEvent('novaura-theme-change', { detail: selectedTheme }));
        window.dispatchEvent(new CustomEvent('novaura-theme-update', { detail: selectedTheme }));
        onThemeChange?.(selectedTheme);
      }
      if (selectedLevel) {
        setGraphicsLevel?.(selectedLevel);
        onGraphicsLevelChange?.(selectedLevel);
      }
      if (selectedIntensity !== undefined) {
        setGravityStrength?.(Number(selectedIntensity));
        onIntensityChange?.(Number(selectedIntensity));
      }
      setIsSaved(true);
      setTimeout(() => {
        onClose?.();
      }, 350);
    } catch (err) {
      console.error('[GraphicsSettings] Error applying settings:', err);
      onClose?.();
    }
  };

  const preset = GRAPHICS_PRESETS[selectedLevel] || GRAPHICS_PRESETS.medium;

  return (
    <div className="h-full flex flex-col bg-black/60 backdrop-blur-xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-white">Graphics & Visual Settings</h2>
          <p className="text-xs text-white/50 mt-0.5">Customize your sovereign desktop fidelity & dynamics</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-all text-white/60 hover:text-white cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-7">
        {/* Graphics Preset */}
        <div>
          <h3 className="text-sm font-medium text-white/80 mb-3">Graphics Preset</h3>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(GRAPHICS_PRESETS).map(([key, value]) => {
              const Icon = value.icon;
              const isSelected = selectedLevel === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedLevel(key)}
                  className={`p-4 rounded-xl border transition-all text-left cursor-pointer ${
                    isSelected 
                      ? 'border-white/30 bg-white/10 shadow-lg' 
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                  style={isSelected ? { borderColor: value.color + '80' } : {}}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={18} style={{ color: value.color }} />
                    <span className="text-sm font-medium text-white">{value.name}</span>
                  </div>
                  <div className="text-xs text-white/50 leading-relaxed">{value.description}</div>
                  {isSelected && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: value.color }}>
                      <Check size={12} />
                      <span>Active</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Particle Theme */}
        <div>
          <h3 className="text-sm font-medium text-white/80 mb-3">Desktop Dynamic Theme</h3>
          <div className="grid grid-cols-4 gap-3">
            {PARTICLE_THEMES.map((theme) => {
              const isSelected = selectedTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`relative rounded-xl overflow-hidden border transition-all text-left cursor-pointer p-3 ${
                    isSelected ? 'border-cyan-400 bg-white/15 scale-[1.02] shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'border-white/10 bg-white/5 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white truncate">{theme.name}</span>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {theme.preview.map((color, i) => (
                      <div 
                        key={i} 
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gravity & Kinetic Intensity */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white/80">Physics & Kinetic Intensity</h3>
            <span className="text-xs font-bold text-cyan-400 font-mono">{Number(selectedIntensity).toFixed(1)}×</span>
          </div>
          <input
            aria-label="Physics & Kinetic Intensity"
            type="range"
            min="0.2"
            max="2.5"
            step="0.1"
            value={selectedIntensity}
            onChange={(event) => setSelectedIntensity(event.target.value)}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/40">
            <span>Subtle (0.2×)</span><span>Balanced (1.0×)</span><span>Vigorous (2.5×)</span>
          </div>
        </div>

        {/* Current Settings Summary */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Live Telemetry Target</h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-white/50 block text-[10px]">Particles:</span>
              <span className="text-white font-medium">{preset.particles}</span>
            </div>
            <div>
              <span className="text-white/50 block text-[10px]">Shadows:</span>
              <span className="text-white font-medium">{preset.shadows ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div>
              <span className="text-white/50 block text-[10px]">Kinetic Effects:</span>
              <span className="text-white font-medium">{preset.effects ? 'Enabled' : 'Minimal'}</span>
            </div>
            <div>
              <span className="text-white/50 block text-[10px]">Target FPS:</span>
              <span className="text-white font-medium">{preset.fps}</span>
            </div>
            <div>
              <span className="text-white/50 block text-[10px]">Active Theme:</span>
              <span className="text-white font-medium capitalize">{selectedTheme}</span>
            </div>
            <div>
              <span className="text-white/50 block text-[10px]">Resolution:</span>
              <span className="text-white font-medium">{preset.resolution}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
            isSaved 
              ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle2 size={14} />
              <span>Applied!</span>
            </>
          ) : (
            <span>Apply Settings</span>
          )}
        </button>
      </div>
    </div>
  );
}
