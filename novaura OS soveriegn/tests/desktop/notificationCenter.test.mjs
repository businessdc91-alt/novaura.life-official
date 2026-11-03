// The tray bell's store: history, unread count, app links, Do Not Disturb.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const nc = await import('../../src/services/notificationCenter.js');

test('notifications are kept newest first and counted until read', () => {
  nc.clearNotifications();
  const a = nc.recordNotification({ type: 'peer', title: 'HoloChess challenge', message: 'Ana challenged you.', appId: 'holochess' });
  const b = nc.recordNotification({ title: 'New follower', message: '@ana started following you.' });
  assert.deepEqual(nc.getNotifications().map(n => n.id), [b.id, a.id]);
  assert.equal(nc.unreadCount(), 2);
  assert.equal(a.appId, 'holochess');
  assert.equal(b.appId, 'novasocial'); // older toasts get their app from the title
  nc.markRead(a.id);
  assert.equal(nc.unreadCount(), 1);
  nc.markAllRead();
  assert.equal(nc.unreadCount(), 0);
  nc.removeNotification(b.id);
  assert.deepEqual(nc.getNotifications().map(n => n.id), [a.id]);
});

test('the history survives a restart and is capped', () => {
  nc.clearNotifications();
  for (let i = 0; i < 130; i++) nc.recordNotification({ title: `n${i}` });
  assert.equal(nc.getNotifications().length, 100);
  const saved = JSON.parse(store.get('novaura_notifications'));
  assert.equal(saved.length, 100);
  assert.equal(saved[0].title, 'n129');
});

test('Do Not Disturb is remembered and tells subscribers', () => {
  let calls = 0;
  const off = nc.subscribeNotifications(() => calls++);
  nc.setDoNotDisturb(true);
  assert.equal(nc.isDoNotDisturb(), true);
  assert.equal(store.get('novaura_dnd'), '1');
  nc.setDoNotDisturb(false);
  off();
  nc.setDoNotDisturb(true);
  assert.equal(calls, 2);
  nc.setDoNotDisturb(false);
});

test('relative times', () => {
  const now = 1_000_000_000;
  assert.equal(nc.timeAgo(now - 10_000, now), 'just now');
  assert.equal(nc.timeAgo(now - 5 * 60_000, now), '5 min ago');
  assert.equal(nc.timeAgo(now - 3 * 3600_000, now), '3 h ago');
  assert.equal(nc.timeAgo(now - 2 * 86400_000, now), '2 d ago');
});
