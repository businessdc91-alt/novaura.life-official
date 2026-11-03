// notificationCenter.js — The list behind the bell. Toasts come and go after a
// few seconds; every one is also kept here (newest first, a week at most) so
// nothing is missed while you are away. Also holds the Do Not Disturb switch.

const KEY = 'novaura_notifications';
const DND_KEY = 'novaura_dnd';
const MAX = 100;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

// Toasts raised by older code carry no app to open; these titles map to one.
const APP_FOR_TITLE = [
  [/^New follower|^Peer Joined/i, 'novasocial'],
  [/^Beta report/i, 'novamail'],
  [/Greeting Card|Card Received/i, 'greeting_cards'],
  [/P2P (File )?Transfer|File Delivered/i, 'files'],
  [/^AI access|Swarm Inference/i, 'ailounge'],
  [/P2P Creation/i, 'marketplace'],
  [/Encyclopedia/i, 'encyclopedia'],
];

const listeners = new Set();
let items = load();
let dnd = (() => { try { return localStorage.getItem(DND_KEY) === '1'; } catch { return false; } })();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    const cutoff = Date.now() - MAX_AGE_MS;
    return Array.isArray(saved) ? saved.filter(n => n && n.ts > cutoff).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full or blocked */ }
  for (const fn of listeners) fn();
}

/** Keep a notification. `detail` is a novaura:mesh_toast event's detail. */
export function recordNotification(detail = {}) {
  const title = String(detail.title || 'Notification').slice(0, 120);
  const appId = detail.appId || APP_FOR_TITLE.find(([re]) => re.test(title))?.[1] || null;
  const item = {
    id: `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    type: detail.type || 'info',
    title,
    message: String(detail.message || '').slice(0, 500),
    appId,
    props: detail.props && typeof detail.props === 'object' ? detail.props : null,
    ts: detail.timestamp || Date.now(),
    read: false,
  };
  items = [item, ...items].slice(0, MAX);
  save();
  return item;
}

export const getNotifications = () => items;
export const unreadCount = () => items.reduce((n, i) => n + (i.read ? 0 : 1), 0);

export function markAllRead() {
  if (!items.some(i => !i.read)) return;
  items = items.map(i => (i.read ? i : { ...i, read: true }));
  save();
}

export function markRead(id) {
  if (!items.some(i => i.id === id && !i.read)) return;
  items = items.map(i => (i.id === id ? { ...i, read: true } : i));
  save();
}

export function removeNotification(id) {
  items = items.filter(i => i.id !== id);
  save();
}

export function clearNotifications() {
  items = [];
  save();
}

export const isDoNotDisturb = () => dnd;
export function setDoNotDisturb(on) {
  dnd = Boolean(on);
  try { localStorage.setItem(DND_KEY, dnd ? '1' : '0'); } catch { /* blocked */ }
  for (const fn of listeners) fn();
}

/** Call fn on every change; returns the unsubscribe function. */
export function subscribeNotifications(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** "just now", "5 min ago", "3 h ago", "2 d ago" */
export function timeAgo(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
