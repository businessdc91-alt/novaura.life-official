import { useState, useEffect, useCallback } from 'react';
import { kernelStorage } from '../kernel/kernelStorage.js';

const STORAGE_KEY = 'novaura_layout_mode';

/**
 * Hook for managing mobile/desktop/headless layout mode.
 * headless = kernel-only mode (no desktop chrome) for Tauri / embedded use.
 */
export const useLayoutMode = () => {
  const [layoutMode, setLayoutMode] = useState(() => {
    // Tauri / headless detection (window.__TAURI__ or ?headless query param)
    if (window.__TAURI_INTERNALS__ || new URLSearchParams(window.location.search).has('headless')) {
      return 'headless';
    }

    // Check for saved preference first
    const saved = kernelStorage.getItem(STORAGE_KEY);
    if (saved === 'mobile' || saved === 'desktop') {
      return saved;
    }
    
    // Default to auto-detect on first load
    const isMobileDevice = window.innerWidth < 768 || 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    return isMobileDevice ? 'mobile' : 'desktop';
  });

  const [isAutoMode, setIsAutoMode] = useState(() => {
    const saved = kernelStorage.getItem(STORAGE_KEY);
    return saved === null; // Auto if no saved preference
  });

  // Save preference when changed
  useEffect(() => {
    if (!isAutoMode) {
      kernelStorage.setItem(STORAGE_KEY, layoutMode);
    }
  }, [layoutMode, isAutoMode]);

  // Handle auto-switching on resize (only in auto mode)
  useEffect(() => {
    if (!isAutoMode) return;

    const handleResize = () => {
      const isMobileDevice = window.innerWidth < 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const newMode = isMobileDevice ? 'mobile' : 'desktop';
      setLayoutMode(newMode);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoMode]);

  const setMode = useCallback((mode) => {
    setIsAutoMode(false);
    setLayoutMode(mode);
    kernelStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const setAuto = useCallback(() => {
    setIsAutoMode(true);
    kernelStorage.removeItem(STORAGE_KEY);
    // Trigger immediate detection
    const isMobileDevice = window.innerWidth < 768 || 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setLayoutMode(isMobileDevice ? 'mobile' : 'desktop');
  }, []);

  const toggleMode = useCallback(() => {
    const newMode = layoutMode === 'mobile' ? 'desktop' : 'mobile';
    setMode(newMode);
  }, [layoutMode, setMode]);

  const isMobile = layoutMode === 'mobile';
  const isDesktop = layoutMode === 'desktop';
  const isHeadless = layoutMode === 'headless';

  return {
    layoutMode,
    isMobile,
    isDesktop,
    isHeadless,
    isAutoMode,
    setMode,
    setAuto,
    toggleMode,
  };
};

export default useLayoutMode;
