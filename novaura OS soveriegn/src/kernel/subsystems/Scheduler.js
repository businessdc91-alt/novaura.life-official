/**
 * NovAura Sovereign OS — Task Scheduler Subsystem
 * Local background tasks, autosave, AI diagnostics, and local mesh heartbeats.
 */

import { isPopoutWindow } from '../../services/popoutWindows.js';

let _taskCounter = 0;

class Scheduler {
  constructor() {
    this._kernel = null;
    this._tasks = new Map();
    this._timers = new Map();
    this._runLog = [];
    this._MAX_LOG = 200;
    this._paused = false;
  }

  init(kernel) {
    this._kernel = kernel;
    this._registerSystemTasks();

    kernel.ipc.on('system:shutdown', () => this.destroy());
  }

  schedule(name, fn, options = {}) {
    const id = 'task_' + (++_taskCounter) + '_' + Date.now();
    const task = {
      id,
      name,
      fn,
      interval: options.interval || 60_000,
      immediate: options.immediate ?? false,
      tags: options.tags || [],
      retryOnError: options.retryOnError ?? false,
      enabled: true,
      runCount: 0,
      errorCount: 0,
      lastRun: null,
      lastError: null,
      nextRun: Date.now() + (options.interval || 60_000),
    };

    this._tasks.set(id, task);

    if (!this._paused && task.enabled) {
      this._startTimer(task);
    }

    if (options.immediate && !this._paused) {
      this._runTask(task);
    }

    this._kernel.ipc.emit('scheduler:task:added', { id, name, interval: task.interval });
    return id;
  }

  cancel(id) {
    this._stopTimer(id);
    this._tasks.delete(id);
    this._kernel.ipc.emit('scheduler:task:cancelled', { id });
  }

  pause(id) {
    const task = this._tasks.get(id);
    if (!task) return;
    task.enabled = false;
    this._stopTimer(id);
  }

  resume(id) {
    const task = this._tasks.get(id);
    if (!task) return;
    task.enabled = true;
    this._startTimer(task);
  }

  pauseAll() {
    this._paused = true;
    this._tasks.forEach((_, id) => this._stopTimer(id));
    this._kernel.ipc.emit('scheduler:paused', {});
  }

  resumeAll() {
    this._paused = false;
    this._tasks.forEach(task => { if (task.enabled) this._startTimer(task); });
    this._kernel.ipc.emit('scheduler:resumed', {});
  }

  async runNow(id) {
    const task = this._tasks.get(id);
    if (!task) throw new Error('[Scheduler] Task not found: ' + id);
    return this._runTask(task);
  }

  getAll() {
    return [...this._tasks.values()].map(t => ({
      id: t.id, name: t.name, interval: t.interval,
      enabled: t.enabled, runCount: t.runCount, errorCount: t.errorCount,
      lastRun: t.lastRun, nextRun: t.nextRun, tags: t.tags,
    }));
  }

  getLog(n = 20) {
    return this._runLog.slice(-n);
  }

  _registerSystemTasks() {
    // Workspace autosave to private cloud DB every 2 min. Pop-out windows skip it:
    // their empty window list would overwrite the desktop's saved layout.
    if (!isPopoutWindow()) {
      this.schedule('workspace:autosave', () => {
        if (this._kernel.memory) this._kernel.memory.snapshotWorkspace();
      }, { interval: 2 * 60_000, tags: ['system', 'workspace'] });
    }

    // AI provider health check every 5 min
    this.schedule('ai:providers:probe', async () => {
      if (this._kernel.ai?._probeProviders) await this._kernel.ai._probeProviders();
    }, { interval: 5 * 60_000, tags: ['system', 'ai'] });
  }

  async _runTask(task) {
    const start = Date.now();
    task.lastRun = start;
    task.runCount++;
    task.nextRun = start + task.interval;

    this._kernel.ipc.emit('scheduler:task:run', { id: task.id, name: task.name });

    try {
      const result = await task.fn();
      const record = { id: task.id, name: task.name, ts: start, duration: Date.now() - start, ok: true };
      this._log(record);
      return result;
    } catch (e) {
      task.errorCount++;
      task.lastError = e.message;
      const record = { id: task.id, name: task.name, ts: start, duration: Date.now() - start, ok: false, error: e.message };
      this._log(record);
      this._kernel.ipc.emit('scheduler:task:error', { id: task.id, name: task.name, error: e.message });

      if (task.retryOnError) {
        setTimeout(() => this._runTask(task), 5_000);
      }
    }
  }

  _startTimer(task) {
    if (this._timers.has(task.id)) return;
    const handle = setInterval(() => this._runTask(task), task.interval);
    this._timers.set(task.id, handle);
  }

  _stopTimer(id) {
    const handle = this._timers.get(id);
    if (handle) { clearInterval(handle); this._timers.delete(id); }
  }

  _log(record) {
    this._runLog.push(record);
    if (this._runLog.length > this._MAX_LOG) this._runLog.shift();
  }

  destroy() {
    this._timers.forEach(h => clearInterval(h));
    this._timers.clear();
    this._tasks.clear();
  }
}

export default Scheduler;
