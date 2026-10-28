import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { KernelContext } from './KernelContext.js';
import { kernel as kernelSingleton } from './NovaKernel.js';
import { kernelStorage } from './kernelStorage.js';

export function useKernel() {
  const ctx = useContext(KernelContext);
  const inst = ctx || kernelSingleton;
  if (inst && !inst.kernel) {
    try {
      inst.kernel = inst;
    } catch {}
  }
  return inst;
}

export function useWindows() {
  const kernel = useKernel();
  const [windows, setWindows] = useState(() => kernel.wm?.getAll() || []);

  useEffect(() => {
    if (!kernel.wm) return;
    setWindows(kernel.wm.getAll());
    return kernel.wm.subscribe(setWindows);
  }, [kernel]);

  return windows;
}

export function useAuth() {
  const kernel = useKernel();
  const [authState, setAuthState] = useState({
    user: kernel.auth?.currentUser || null,
    uid: kernel.auth?.uid || null,
    isAuthenticated: kernel.auth?.isAuthenticated || false,
    identity: kernel.auth?.identity || null,
  });

  useEffect(() => {
    return kernel.ipc.on('auth:changed', ({ user, uid, isAuthenticated, identity }) => {
      setAuthState({ user, uid, isAuthenticated, identity });
    });
  }, [kernel]);

  return authState;
}

export function useNotifications() {
  const kernel = useKernel();
  const [notifications, setNotifications] = useState(
    () => kernel.notifications?.getActive() || []
  );

  useEffect(() => {
    if (!kernel.notifications) return;
    setNotifications(kernel.notifications.getActive());
    return kernel.notifications.subscribe(setNotifications);
  }, [kernel]);

  return notifications;
}

export function useSettings(key, defaultValue = null) {
  const kernel = useKernel();
  const [value, setValue] = useState(() => kernel.settings?.get(key, defaultValue) ?? defaultValue);

  useEffect(() => {
    if (!kernel.settings) return;
    setValue(kernel.settings.get(key, defaultValue));
    return kernel.settings.watch(key, (newVal) => setValue(newVal));
  }, [kernel, key]);

  const set = useCallback((newValue) => {
    kernel.settings?.set(key, newValue);
  }, [kernel, key]);

  return [value, set];
}

export function useAI() {
  const kernel = useKernel();
  const [pending, setPending] = useState(false);
  const [providers, setProviders] = useState({});

  useEffect(() => {
    const unsubStart = kernel.ipc.on('ai:request:start', () => setPending(true));
    const unsubEnd = kernel.ipc.on('ai:request:complete', () => setPending(false));
    const unsubErr = kernel.ipc.on('ai:request:error', () => setPending(false));
    const unsubProviders = kernel.ipc.on('ai:providers:updated', ({ providers: p }) => setProviders(p));

    if (kernel.ai) setProviders(kernel.ai.getProviderStatus());

    return () => { unsubStart(); unsubEnd(); unsubErr(); unsubProviders(); };
  }, [kernel]);

  const request = useCallback((prompt, options = {}) => {
    return kernel.ai?.request(prompt, options);
  }, [kernel]);

  return { request, pending, providers };
}

export function useIPC(channel, handler, deps = []) {
  const kernel = useKernel();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return kernel.ipc.on(channel, (payload, ch) => handlerRef.current(payload, ch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kernel, channel, ...deps]);
}

export function useScopedIPC(appId) {
  const kernel = useKernel();
  const scopedRef = useRef(null);
  if (!scopedRef.current && kernel?.createScopedIPC) {
    scopedRef.current = kernel.createScopedIPC(appId);
  }
  return scopedRef.current || kernel?.ipc;
}


export function useProcesses() {
  const kernel = useKernel();
  const [processes, setProcesses] = useState(() => kernel.processes?.getAll() || []);

  useEffect(() => {
    if (!kernel.processes) return;
    setProcesses(kernel.processes.getAll());
    return kernel.processes.subscribe(setProcesses);
  }, [kernel]);

  return processes;
}

export function useMemory() {
  const kernel = useKernel();
  const get = useCallback((key, fallback = null) => {
    return kernel.memory?.get(key, fallback) ?? fallback;
  }, [kernel]);
  const set = useCallback((key, value, options = {}) => {
    return kernel.memory?.set(key, value, options);
  }, [kernel]);
  const forget = useCallback((key) => {
    return kernel.memory?.forget(key);
  }, [kernel]);
  return { get, set, forget };
}

export function usePlugins() {
  const kernel = useKernel();
  const register = useCallback((id, name, handler) => {
    return kernel.plugins?.register(id, name, handler);
  }, [kernel]);
  const call = useCallback((id, capability, args) => {
    return kernel.plugins?.call(id, capability, args);
  }, [kernel]);
  const broadcast = useCallback((capability, args) => {
    return kernel.plugins?.broadcast(capability, args);
  }, [kernel]);
  const findByCapability = useCallback((name) => {
    return kernel.plugins?.findByCapability(name) || [];
  }, [kernel]);
  return { register, call, broadcast, findByCapability };
}

export function useScheduler() {
  const kernel = useKernel();
  const [tasks, setTasks] = useState(() => kernel.scheduler?.getAll?.() || []);

  useEffect(() => {
    const unsub = kernel.ipc.on('scheduler:task:run', () => {
      setTasks(kernel.scheduler?.getAll?.() || []);
    });
    return unsub;
  }, [kernel]);

  const runNow = useCallback((name) => kernel.scheduler?.runNow(name), [kernel]);
  const pause = useCallback((name) => kernel.scheduler?.pause(name), [kernel]);
  const resume = useCallback((name) => kernel.scheduler?.resume(name), [kernel]);

  return { tasks, runNow, pause, resume };
}

export function useCrash() {
  const kernel = useKernel();
  const [crashes, setCrashes] = useState(() => kernel.crash?.getLog(10) || []);
  const [circuitOpen, setCircuitOpen] = useState(false);

  useEffect(() => {
    const unsubCrash  = kernel.ipc.on('crash:detected', () => setCrashes(kernel.crash?.getLog(10) || []));
    const unsubRepair = kernel.ipc.on('crash:repair:ready', () => setCrashes(kernel.crash?.getLog(10) || []));
    const unsubOpen   = kernel.ipc.on('crash:circuit:open', () => setCircuitOpen(true));
    const unsubClosed = kernel.ipc.on('crash:circuit:closed', () => setCircuitOpen(false));
    return () => { unsubCrash(); unsubRepair(); unsubOpen(); unsubClosed(); };
  }, [kernel]);

  const repairStatus = useCallback((crashId) => {
    return kernel.crash?.getRepairStatus(crashId) || null;
  }, [kernel]);

  return { crashes, circuitOpen, repairStatus };
}

export function useLocalModel() {
  const kernel = useKernel();
  const [status, setStatus] = useState(() => kernel.localModel?.checkSupport() || {});

  useEffect(() => {
    const unsub1 = kernel.ipc.on('localmodel:status', setStatus);
    const unsub2 = kernel.ipc.on('localmodel:ready', () => setStatus(kernel.localModel?.checkSupport() || {}));
    const unsub3 = kernel.ipc.on('localmodel:progress', (p) =>
      setStatus(prev => ({ ...prev, progress: p.progress, downloadText: p.text }))
    );
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [kernel]);

  const activate = useCallback(() => kernel.localModel?.activate(), [kernel]);
  const deactivate = useCallback(() => kernel.localModel?.deactivate(), [kernel]);
  const chat = useCallback((prompt, opts) => kernel.localModel?.chat(prompt, opts), [kernel]);

  return { status, activate, deactivate, chat, isReady: !!kernel.localModel?.isReady };
}

export function useWindowMemory(windowType, key, initialValue = null) {
  const storageKey = `win_mem:${windowType}:${key}`;

  const [state, setStateRaw] = useState(() => {
    try {
      const saved = kernelStorage.getItem(storageKey);
      if (saved === null || saved === undefined) return initialValue;
      try { return JSON.parse(saved); } catch { return saved; }
    } catch {
      return initialValue;
    }
  });

  const debounceRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setState = useCallback((valueOrUpdater) => {
    setStateRaw(prev => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          kernelStorage.setItem(storageKey, typeof next === 'string' ? next : JSON.stringify(next));
        } catch { /* non-critical */ }
      }, 600);
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        try {
          kernelStorage.setItem(
            storageKey,
            typeof stateRef.current === 'string' ? stateRef.current : JSON.stringify(stateRef.current)
          );
        } catch { /* non-critical */ }
      }
    };
  }, [storageKey]);

  return [state, setState];
}
