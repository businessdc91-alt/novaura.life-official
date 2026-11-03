/**
 * NovAura Sovereign OS — Window Manager Subsystem
 * Manages OS windows as first-class desktop processes.
 */

let _windowCounter = 0;

class WindowManager {
  constructor() {
    this._kernel = null;
    this._windows = new Map();
    this._nextZIndex = 100;
    this._subscribers = new Set();
  }

  init(kernel) {
    this._kernel = kernel;

    kernel.ipc.on('window:restart', ({ windowId }) => {
      const win = this._windows.get(windowId);
      if (!win) return;
      const { type, title, props } = win;
      this.close(windowId);
      setTimeout(() => {
        kernel.ipc.emit('window:restarting', { windowId, type, title });
        this.open(type, title, props);
      }, 300);
    });
  }

  open(type, title, props = {}) {
    const id = 'win_' + (++_windowCounter) + '_' + Date.now();
    const win = {
      id,
      type,
      appType: type,
      title: title || type,
      props,
      state: 'normal',
      zIndex: ++this._nextZIndex,
      createdAt: Date.now(),
    };

    this._windows.set(id, win);
    this._notify();
    this._kernel?.ipc.emit('window:opened', { id, type, title: win.title });
    return win;
  }

  openWindow(type, props = {}, title = '') {
    return this.open(type, title, props);
  }

  close(id) {
    const win = this._windows.get(id);
    if (!win) return;
    this._windows.delete(id);
    this._notify();
    this._kernel?.ipc.emit('window:closed', { id, type: win.type });
  }

  closeWindow(id) {
    return this.close(id);
  }

  focus(id) {
    const win = this._windows.get(id);
    if (!win) return;
    if (win.zIndex === this._nextZIndex && win.state === 'normal') {
      return;
    }
    if (this._nextZIndex >= 7000) {
      const sorted = Array.from(this._windows.values()).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      sorted.forEach((w, idx) => {
        w.zIndex = 100 + idx;
      });
      this._nextZIndex = 100 + sorted.length;
    }
    win.zIndex = ++this._nextZIndex;
    if (win.state === 'minimized') win.state = 'normal';
    this._windows.set(id, win);
    this._notify();
    this._kernel?.ipc.emit('window:focused', { id });
  }

  focusWindow(id) {
    return this.focus(id);
  }

  minimizeWindow(id) {
    return this.minimize(id);
  }

  maximizeWindow(id) {
    return this.maximize(id);
  }

  getOpenWindows() {
    return this.getAll();
  }

  minimize(id) {
    this._setState(id, 'minimized');
    this._kernel?.ipc.emit('window:minimized', { id });
  }

  restore(id) {
    const win = this._windows.get(id);
    if (!win) return;
    win.state = 'normal';
    this.focus(id);
    this._kernel?.ipc.emit('window:restored', { id });
  }

  maximize(id) {
    const win = this._windows.get(id);
    if (!win) return;
    win.state = win.state === 'maximized' ? 'normal' : 'maximized';
    this._windows.set(id, win);
    this._notify();
    this._kernel?.ipc.emit('window:maximized', { id, state: win.state });
  }

  updateProps(id, props) {
    const win = this._windows.get(id);
    if (!win) return;
    win.props = { ...win.props, ...props };
    this._windows.set(id, win);
    this._notify();
  }

  closeAll() {
    const ids = [...this._windows.keys()];
    ids.forEach(id => this.close(id));
  }

  getAll() {
    return [...this._windows.values()];
  }

  getById(id) {
    return this._windows.get(id) || null;
  }

  getByType(type) {
    return this.getAll().filter(w => w.type === type);
  }

  subscribe(handler) {
    this._subscribers.add(handler);
    return () => this._subscribers.delete(handler);
  }

  _setState(id, state) {
    const win = this._windows.get(id);
    if (!win) return;
    win.state = state;
    this._windows.set(id, win);
    this._notify();
  }

  _notify() {
    this._subscribers.forEach(h => {
      try { h(this.getAll()); } catch (e) { console.error('[WM] subscriber error', e); }
    });
  }
}

export default WindowManager;
