import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';

export interface WebGPUState {
  isSupported: boolean;
  isEnabled: boolean;
  toggle: () => void;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  isInitializing: boolean;
}

/**
 * Hook to manage WebGPU access as an opt-in performance enhancement.
 * Falls back gracefully when WebGPU is unavailable or disabled.
 *
 * Usage:
 *   const { isSupported, isEnabled, device } = useWebGPU();
 *   if (isEnabled && device) { // use GPU-accelerated path }
 *   else { // use CSS/canvas fallback }
 */
export function useWebGPU(): WebGPUState {
  const { webGPUEnabled, toggleWebGPU } = useUIStore();
  const [isSupported, setIsSupported] = useState(false);
  const [adapter, setAdapter] = useState<GPUAdapter | null>(null);
  const [device, setDevice] = useState<GPUDevice | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Detect browser support once on mount
  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && 'gpu' in navigator);
  }, []);

  // Initialize or tear down GPU device based on enabled state
  useEffect(() => {
    if (!isSupported || !webGPUEnabled) {
      setAdapter(null);
      setDevice(null);
      return;
    }

    let cancelled = false;
    setIsInitializing(true);

    async function init() {
      try {
        const gpuAdapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance',
        });
        if (cancelled || !gpuAdapter) return;

        const gpuDevice = await gpuAdapter.requestDevice();
        if (cancelled) {
          gpuDevice.destroy();
          return;
        }

        gpuDevice.lost.then(() => {
          if (!cancelled) {
            setAdapter(null);
            setDevice(null);
          }
        });

        setAdapter(gpuAdapter);
        setDevice(gpuDevice);
      } catch {
        // WebGPU init failed — silently fall back, user stays in CSS mode
        setAdapter(null);
        setDevice(null);
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    }

    void init();

    return () => {
      cancelled = true;
      setIsInitializing(false);
    };
  }, [isSupported, webGPUEnabled]);

  // Destroy device on unmount
  useEffect(() => {
    return () => {
      device?.destroy();
    };
  }, [device]);

  return {
    isSupported,
    isEnabled: webGPUEnabled && isSupported,
    toggle: toggleWebGPU,
    adapter,
    device,
    isInitializing,
  };
}
