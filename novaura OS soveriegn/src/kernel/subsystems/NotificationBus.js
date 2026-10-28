/**
 * NovAura Sovereign OS — Notification Bus Subsystem
 */

let _notifCounter = 0;
const DEFAULT_TTL = 5000;
const MAX_VISIBLE = 5;

class NotificationBus {
  constructor() {
    this._kernel = null;
    this._active = [];
    this._queue = [];
    this._badgeCounts = new Map();
    this._subscribers = new Set();
    this._timers = new Map();
  }

  init(kernel) {
    this._kernel = kernel;
  }

  push(notification) {
    const id = 'notif_' + (++_notifCounter) + '_' + Date.now();
    const n = {
      id,
      type: notification.type || 'info',
      title: notification.title || '',
      body: notification.body || '',
      actions: notification.actions || [],
      ttl: notification.ttl ?? DEFAULT_TTL,
      source: notification.source || 'system',
      createdAt: Date.now(),
    };

    const badgeKey = n.source;
    this._badgeCounts.set(badgeKey, (this._badgeCounts.get(badgeKey) || 0) + 1);

    if (this._active.length < MAX_VISIBLE) {
      this._show(n);
    } else {
      this._queue.push(n);
    }

    this._kernel.ipc.emit('notification:push', n);
    return id;
  }

  dismiss(id) {
    this._clear(id);
    this._active = this._active.filter(n => n.id !== id);
    this._notify();
    this._kernel.ipc.emit('notification:dismiss', { id });
    this._dequeue();
  }

  dismissAll() {
    [...this._active].forEach(n => this.dismiss(n.id));
    this._queue = [];
  }

  getActive() {
    return [...this._active];
  }

  getBadgeCount(source) {
    return this._badgeCounts.get(source) || 0;
  }

  clearBadge(source) {
    this._badgeCounts.set(source, 0);
    this._notify();
  }

  subscribe(handler) {
    this._subscribers.add(handler);
    return () => this._subscribers.delete(handler);
  }

  _show(n) {
    this._active.push(n);
    this._notify();

    if (n.ttl > 0) {
      const timer = setTimeout(() => this.dismiss(n.id), n.ttl);
      this._timers.set(n.id, timer);
    }
  }

  _clear(id) {
    const timer = this._timers.get(id);
    if (timer) { clearTimeout(timer); this._timers.delete(id); }
  }

  _dequeue() {
    if (this._queue.length === 0 || this._active.length >= MAX_VISIBLE) return;
    const next = this._queue.shift();
    this._show(next);
  }

  _notify() {
    const active = this.getActive();
    this._subscribers.forEach(h => { try { h(active); } catch {} });
  }

  destroy() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers.clear();
  }
}

export default NotificationBus;
