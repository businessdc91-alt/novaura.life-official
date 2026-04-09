/**
 * NovAura OS — Process Manager
 * Tracks all running processes: windows, background tasks, services.
 * Future hook point for Tauri native process spawning.
 */

let _pidCounter = 0;

class ProcessManager {
  constructor() {
    this._kernel = null;
    this._processes = new Map();
    this._subscribers = new Set();
  }

  init(kernel) {
    this._kernel = kernel;

    // Auto-register windows as processes
    kernel.ipc.on('window:opened', ({ id, type, title }) => {
      this._register(id, title || type, 'window', { windowId: id, windowType: type });
    });

    kernel.ipc.on('window:closed', ({ id }) => {
      this._killByWindowId(id);
    });
  }

  /**
   * Spawn a named process.
   * @param {string} name
   * @param {'window'|'background'|'service'} type
   * @param {object} config  { windowId?, description? }
   * @returns {string} pid
   */
  spawn(name, type = 'background', config = {}) {
    return this._register(null, name, type, config);
  }

  /**
   * Kill a process by pid.
   * @param {string} pid
   */
  kill(pid) {
    const proc = this._processes.get(pid);
    if (!proc) return;
    proc.status = 'stopped';

    // If it owns a window, close it
    if (proc.windowId) {
      try { this._kernel.wm.close(proc.windowId); } catch {}
    }

    this._processes.delete(pid);
    this._notify();
    this._kernel.ipc.emit('process:killed', { pid, name: proc.name });
  }

  suspend(pid) {
    this._setStatus(pid, 'suspended');
    const proc = this._processes.get(pid);
    if (proc) {
      proc.suspendedAt = Date.now();
      this._kernel.ipc.emit('process:suspended', { pid, name: proc.name, windowId: proc.windowId });
    }
  }

  resume(pid) {
    this._setStatus(pid, 'running');
    const proc = this._processes.get(pid);
    if (proc) {
      const sleepDuration = proc.suspendedAt ? Date.now() - proc.suspendedAt : 0;
      proc.suspendedAt = null;
      this._kernel.ipc.emit('process:resumed', { pid, name: proc.name, windowId: proc.windowId, sleepDuration });
    }
  }

  /**
   * Sleep a window process — serializes state, marks as sleeping.
   * The WindowManager unmounts the React tree but keeps the window entry.
   * @param {string} windowId
   * @param {object} savedState  Serializable state snapshot from the window
   */
  sleepWindow(windowId, savedState = null) {
    const proc = this.getByWindow(windowId);
    if (!proc) return;
    if (savedState !== null) {
      proc.savedState = savedState;
    }
    this.suspend(proc.pid);
  }

  /**
   * Wake a sleeping window — restores state, marks as running.
   * @param {string} windowId
   * @returns {object|null} The saved state snapshot, or null
   */
  wakeWindow(windowId) {
    const proc = this.getByWindow(windowId);
    if (!proc || proc.status !== 'suspended') return null;
    const state = proc.savedState || null;
    proc.savedState = null;
    this.resume(proc.pid);
    return state;
  }

  /**
   * Get all sleeping window processes.
   */
  getSleeping() {
    return [...this._processes.values()].filter(p => p.status === 'suspended' && p.type === 'window');
  }

  getRunning() {
    return [...this._processes.values()].filter(p => p.status === 'running');
  }

  getAll() {
    return [...this._processes.values()];
  }

  getByWindow(windowId) {
    return this.getAll().find(p => p.windowId === windowId) || null;
  }

  getByName(name) {
    return this.getAll().filter(p => p.name === name);
  }

  subscribe(handler) {
    this._subscribers.add(handler);
    return () => this._subscribers.delete(handler);
  }

  /** System stats snapshot */
  stats() {
    const all = this.getAll();
    return {
      total: all.length,
      running: all.filter(p => p.status === 'running').length,
      windows: all.filter(p => p.type === 'window').length,
      background: all.filter(p => p.type === 'background').length,
      services: all.filter(p => p.type === 'service').length,
      uptime: Date.now() - (this._bootTime || Date.now()),
    };
  }

  _register(id, name, type, config = {}) {
    const pid = id || 'pid_' + (++_pidCounter) + '_' + Date.now();
    const proc = {
      pid,
      name,
      type,
      status: 'running',
      startedAt: Date.now(),
      windowId: config.windowId || null,
      windowType: config.windowType || null,
      description: config.description || '',
      memEstimate: config.memEstimate || 0,
    };

    this._processes.set(pid, proc);
    this._notify();
    this._kernel.ipc.emit('process:spawned', { pid, name, type });
    return pid;
  }

  _killByWindowId(windowId) {
    const proc = this.getByWindow(windowId);
    if (proc) {
      this._processes.delete(proc.pid);
      this._notify();
      this._kernel.ipc.emit('process:killed', { pid: proc.pid, name: proc.name });
    }
  }

  _setStatus(pid, status) {
    const proc = this._processes.get(pid);
    if (!proc) return;
    proc.status = status;
    this._processes.set(pid, proc);
    this._notify();
  }

  _notify() {
    const all = this.getAll();
    this._subscribers.forEach(h => { try { h(all); } catch {} });
  }

  boot() {
    this._bootTime = Date.now();
    // Register kernel itself as a system service
    this._register('kernel', 'NovaKernel', 'service', { description: 'Core OS kernel' });
  }
}

export default ProcessManager;
