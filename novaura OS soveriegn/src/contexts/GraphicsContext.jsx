import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const GraphicsContext = createContext();

export const GRAPHICS_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high'
};

export const GRAVITY_MODES = {
  WELL: 'well',            // Newtonian Inverse-Square Gravity Well
  REPULSION: 'repulsion',  // Anti-Gravity / Kinetic Forcefield
  VORTEX: 'vortex',        // Cosmic Black Hole Swirl & Accretion Disk
  CELESTIAL: 'celestial',  // Multi-Body Orbit & Slingshots
  MESH: 'mesh',            // 2D Lattice Spring Water Dynamics
};

export const GRAPHICS_PRESETS = {
  [GRAPHICS_LEVELS.LOW]: {
    name: 'Low',
    description: 'Lightweight particles for low-power hardware',
    particles: {
      enabled: true,
      count: 75,
      microCount: 40,
      links: false,
      mouseInteraction: true,
      colorCycling: false,
      gravityStrength: 0.8,
    },
    borders: {
      animated: false,
      glow: false,
      flowLayer: false
    },
    background: {
      animated: true,
      mesh: false,
      aurora: false
    }
  },
  [GRAPHICS_LEVELS.MEDIUM]: {
    name: 'Medium',
    description: 'Balanced visual fidelity with full physics laws',
    particles: {
      enabled: true,
      count: 220,
      microCount: 120,
      links: true,
      mouseInteraction: true,
      colorCycling: true,
      gravityStrength: 1.0,
    },
    borders: {
      animated: true,
      glow: true,
      flowLayer: true
    },
    background: {
      animated: true,
      mesh: true,
      aurora: true
    }
  },
  [GRAPHICS_LEVELS.HIGH]: {
    name: 'High',
    description: 'Max visual fidelity, orbital mechanics & WebGPU acceleration',
    particles: {
      enabled: true,
      count: 480,
      microCount: 260,
      links: true,
      mouseInteraction: true,
      colorCycling: true,
      gravityStrength: 1.25,
    },
    borders: {
      animated: true,
      glow: true,
      flowLayer: true,
      intense: true,
      allBorders: true
    },
    background: {
      animated: true,
      mesh: true,
      aurora: true,
      intense: true
    }
  }
};

export function GraphicsProvider({ children }) {
  const [graphicsLevel, setGraphicsLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('novaura-graphics-level');
      return saved || GRAPHICS_LEVELS.MEDIUM;
    } catch {
      return GRAPHICS_LEVELS.MEDIUM;
    }
  });

  const [gravityMode, setGravityModeState] = useState(() => {
    try {
      const saved = localStorage.getItem('novaura-gravity-mode');
      return Object.values(GRAVITY_MODES).includes(saved) ? saved : GRAVITY_MODES.WELL;
    } catch {
      return GRAVITY_MODES.WELL;
    }
  });

  const [gravityStrength, setGravityStrengthState] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem('novaura-gravity-strength'));
      return !isNaN(saved) && saved >= 0.2 && saved <= 3.0 ? saved : 1.0;
    } catch {
      return 1.0;
    }
  });

  const [shockwavesEnabled, setShockwavesEnabledState] = useState(() => {
    try {
      const saved = localStorage.getItem('novaura-shockwaves-enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Dim and slow the background while app windows are open over it
  const [calmBehindWindows, setCalmBehindWindowsState] = useState(() => {
    try {
      return localStorage.getItem('novaura-calm-background') !== 'false';
    } catch {
      return true;
    }
  });

  // Pause the background while another app is in front (off: it keeps moving)
  const [pauseUnfocusedBackground, setPauseUnfocusedBackgroundState] = useState(() => {
    try {
      return localStorage.getItem('novaura-pause-unfocused-background') === 'true';
    } catch {
      return false;
    }
  });

  const [detectedLevel, setDetectedLevel] = useState(null);

  const detectHardwareCapability = useCallback(() => {
    const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    const memory = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 8;
    const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    let recommended;
    if (hasWebGPU && cores >= 8 && memory >= 8 && !isTouch) {
      recommended = GRAPHICS_LEVELS.HIGH;
    } else if (cores < 4 || memory < 4) {
      recommended = GRAPHICS_LEVELS.LOW;
    } else {
      recommended = GRAPHICS_LEVELS.MEDIUM;
    }
    
    setDetectedLevel(recommended);
    try {
      if (!localStorage.getItem('novaura-graphics-level')) {
        setGraphicsLevel(recommended);
      }
    } catch {}
    
    return recommended;
  }, []);

  useEffect(() => {
    if (detectedLevel === null) {
      detectHardwareCapability();
    }
  }, [detectedLevel, detectHardwareCapability]);

  const setLevel = useCallback((level) => {
    setGraphicsLevel(level);
    try {
      localStorage.setItem('novaura-graphics-level', level);
      window.dispatchEvent(new CustomEvent('novaura-graphics-update', { detail: { level } }));
    } catch {}
  }, []);

  const setGravityMode = useCallback((mode) => {
    if (Object.values(GRAVITY_MODES).includes(mode)) {
      setGravityModeState(mode);
      try {
        localStorage.setItem('novaura-gravity-mode', mode);
        window.dispatchEvent(new CustomEvent('novaura-gravity-mode-update', { detail: mode }));
      } catch {}
    }
  }, []);

  const setGravityStrength = useCallback((strength) => {
    const clamped = Math.max(0.2, Math.min(3.0, strength));
    setGravityStrengthState(clamped);
    try {
      localStorage.setItem('novaura-gravity-strength', clamped.toString());
      window.dispatchEvent(new CustomEvent('novaura-gravity-strength-update', { detail: clamped }));
    } catch {}
  }, []);

  const setShockwavesEnabled = useCallback((enabled) => {
    setShockwavesEnabledState(Boolean(enabled));
    try {
      localStorage.setItem('novaura-shockwaves-enabled', Boolean(enabled).toString());
    } catch {}
  }, []);

  const setCalmBehindWindows = useCallback((enabled) => {
    setCalmBehindWindowsState(Boolean(enabled));
    try {
      localStorage.setItem('novaura-calm-background', Boolean(enabled).toString());
    } catch {}
  }, []);

  const setPauseUnfocusedBackground = useCallback((enabled) => {
    setPauseUnfocusedBackgroundState(Boolean(enabled));
    try {
      localStorage.setItem('novaura-pause-unfocused-background', Boolean(enabled).toString());
    } catch {}
  }, []);

  const settings = GRAPHICS_PRESETS[graphicsLevel] || GRAPHICS_PRESETS[GRAPHICS_LEVELS.MEDIUM];

  return (
    <GraphicsContext.Provider value={{
      graphicsLevel,
      setGraphicsLevel: setLevel,
      settings,
      detectedLevel,
      detectHardwareCapability,
      GRAPHICS_LEVELS,
      GRAVITY_MODES,
      gravityMode,
      setGravityMode,
      gravityStrength,
      setGravityStrength,
      shockwavesEnabled,
      setShockwavesEnabled,
      calmBehindWindows,
      setCalmBehindWindows,
      pauseUnfocusedBackground,
      setPauseUnfocusedBackground,
    }}>
      {children}
    </GraphicsContext.Provider>
  );
}

export function useGraphics() {
  const context = useContext(GraphicsContext);
  if (!context) {
    return {
      graphicsLevel: GRAPHICS_LEVELS.MEDIUM,
      setGraphicsLevel: () => {},
      settings: GRAPHICS_PRESETS[GRAPHICS_LEVELS.MEDIUM],
      detectedLevel: GRAPHICS_LEVELS.MEDIUM,
      detectHardwareCapability: () => GRAPHICS_LEVELS.MEDIUM,
      GRAPHICS_LEVELS,
      GRAVITY_MODES,
      gravityMode: GRAVITY_MODES.WELL,
      setGravityMode: () => {},
      gravityStrength: 1.0,
      setGravityStrength: () => {},
      shockwavesEnabled: true,
      setShockwavesEnabled: () => {},
      calmBehindWindows: true,
      setCalmBehindWindows: () => {},
      pauseUnfocusedBackground: false,
      setPauseUnfocusedBackground: () => {},
    };
  }
  return context;
}

export default GraphicsContext;
