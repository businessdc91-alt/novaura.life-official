import { useState, useEffect } from 'react';

/**
 * Hook to provide real-time system telemetry.
 * Note: Browser APIs are limited for privacy, so we approximate/estimate where needed.
 */
export function useSystemTelemetry() {
  const [stats, setStats] = useState({
    cpuUsage: 0,
    cpuCores: navigator.hardwareConcurrency || 4,
    memoryUsed: 0,
    memoryTotal: navigator.deviceMemory || 8,
    gpuStatus: 'Ready',
    gpuVendor: 'Default',
    networkType: 'unknown',
    networkSpeed: 0,
    isOnline: navigator.onLine,
    aiStatus: 'Checking...',
    aiLatency: 0,
    aiReachable: false
  });

  useEffect(() => {
    let lastTime = performance.now();
    let cpuUsageHistory = [];
    let cpuLoopRef;

    let lastStateUpdateTime = performance.now();
    // 1. Monitor CPU Usage via Event Loop Lag approximation
    const monitorCPU = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      
      // If delta is significantly > 16.6ms (at 60fps), it means the main thread was busy
      // We'll calculate "load" based on how much the frame time exceeded the target
      const expected = 1000 / 60; // 16.67ms
      const lag = Math.max(0, delta - expected);
      
      // Map lag to a 0-100% scale (where 50ms lag is "100% load" for the UI thread)
      const instantLoad = Math.min(100, (lag / 50) * 100);
      
      cpuUsageHistory.push(instantLoad);
      if (cpuUsageHistory.length > 60) cpuUsageHistory.shift(); // keep 1 sec of frames
      
      // Only trigger a React state update once every second
      if (now - lastStateUpdateTime > 1000) {
        const avgLoad = cpuUsageHistory.reduce((a, b) => a + b, 0) / cpuUsageHistory.length;
        
        setStats(prev => {
          const newUsage = Math.round(avgLoad);
          if (prev.cpuUsage === newUsage) return prev; // Avoid unnecessary re-renders
          return {
            ...prev,
            cpuUsage: newUsage
          };
        });
        lastStateUpdateTime = now;
      }

      cpuLoopRef = requestAnimationFrame(monitorCPU);
    };

    // 2. Monitor Memory (Chrome/Edge only)
    const updateMemory = () => {
      if (performance.memory) {
        const used = performance.memory.usedJSHeapSize / (1024 * 1024 * 1024); // GB
        const total = performance.memory.jsHeapSizeLimit / (1024 * 1024 * 1024); // GB
        setStats(prev => ({
          ...prev,
          memoryUsed: used,
          memoryTotal: Math.round(total)
        }));
      }
    };

    // 3. Monitor Network
    const updateNetwork = () => {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      setStats(prev => ({
        ...prev,
        isOnline: navigator.onLine,
        networkType: conn?.effectiveType || 'unknown',
        networkSpeed: conn?.downlink || 0
      }));
    };

    // 4. GPU Info
    const checkGPU = async () => {
      if (navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            setStats(prev => ({ ...prev, gpuStatus: 'WebGPU', gpuVendor: 'Accelerated' }));
          }
        } catch (e) {
          setStats(prev => ({ ...prev, gpuStatus: 'WebGL' }));
        }
      } else {
        setStats(prev => ({ ...prev, gpuStatus: 'WebGL' }));
      }
    };

    // 5. AI Backend Health & Latency
    const checkAIHealth = async () => {
      const startTime = performance.now();
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-life.cloudfunctions.net/api';
        const token = kernelStorage.getItem('auth_token') || '';
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${backendUrl}/ai/health-check`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const latency = performance.now() - startTime;
        
        let status = 'Unknown';
        let reachable = false;
        
        const hasUserOpenAI = !!kernelStorage.getItem('openai_api_key') || !!kernelStorage.getItem('user_openai_key');
        const hasUserGemini = !!kernelStorage.getItem('gemini_api_key') || !!kernelStorage.getItem('user_gemini_key');

        if (res.ok) {
          const data = await res.json();
          // If backend says 'ok' but inference is inactive/limited
          if (data.status === 'limited' || data.inference === 'standby' || data.active === false) {
            status = (hasUserOpenAI || hasUserGemini) ? 'BYOK Active' : 'Standby';
            reachable = (hasUserOpenAI || hasUserGemini);
          } else {
            status = 'Healthy';
            reachable = true;
          }
        } else if (res.status === 402 || res.status === 403 || res.status === 401) {
          status = (hasUserOpenAI || hasUserGemini) ? 'BYOK Active' : 'Depleted';
          reachable = (hasUserOpenAI || hasUserGemini);
        } else {
          status = 'Offline';
          reachable = false;
        }

        setStats(prev => ({
          ...prev,
          aiStatus: status,
          aiLatency: reachable ? Math.round(latency) : 0,
          aiReachable: reachable
        }));
      } catch (e) {
        setStats(prev => ({
          ...prev,
          aiStatus: 'Offline',
          aiLatency: 0,
          aiReachable: false
        }));
      }
    };

    cpuLoopRef = requestAnimationFrame(monitorCPU);
    const memInterval = setInterval(updateMemory, 5000);
    const netInterval = setInterval(updateNetwork, 5000);
    const aiInterval = setInterval(checkAIHealth, 15000); // Check AI every 15s
    
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    
    updateMemory();
    updateNetwork();
    checkGPU();
    checkAIHealth();

    return () => {
      cancelAnimationFrame(cpuLoopRef);
      clearInterval(memInterval);
      clearInterval(netInterval);
      clearInterval(aiInterval);
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
    };
  }, []);

  return stats;
}
