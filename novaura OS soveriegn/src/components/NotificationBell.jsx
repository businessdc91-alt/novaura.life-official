import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bell, BellOff, X, CheckCheck, Trash2, ArrowUpRight } from 'lucide-react';
import { getAppById } from '../config/appRegistry.js';
import {
  getNotifications, unreadCount, markAllRead, removeNotification, clearNotifications,
  isDoNotDisturb, setDoNotDisturb, subscribeNotifications, timeAgo,
} from '../services/notificationCenter.js';

const DOT = { peer: 'bg-emerald-400', ai: 'bg-violet-400', celebration: 'bg-pink-400', error: 'bg-rose-400', info: 'bg-cyan-400' };

// The tray bell: unread count, and a drawer with every notification kept by notificationCenter.
export default function NotificationBell({ openApp }) {
  const list = useSyncExternalStore(subscribeNotifications, getNotifications);
  const dnd = useSyncExternalStore(subscribeNotifications, isDoNotDisturb);
  const unread = unreadCount();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const timer = setInterval(() => tick(n => n + 1), 30_000); // keep "5 min ago" current
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Opening the drawer marks everything seen, and so does anything arriving while it is open.
  useEffect(() => { if (open && unread) markAllRead(); }, [open, unread]);

  const go = (n) => {
    if (!n.appId) return;
    openApp?.(n.appId, n.props || {}, { toggle: false });
    setOpen(false);
  };

  const Icon = dnd ? BellOff : Bell;
  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-1 transition-colors ${open ? 'text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}
        title={dnd ? 'Notifications (Do Not Disturb is on)' : 'Notifications'}
        aria-label="Notifications"
      >
        <Icon className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 max-h-[70vh] flex flex-col rounded-xl bg-slate-900/97 border border-slate-700/80 shadow-2xl backdrop-blur-xl z-[9600] text-xs">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="font-semibold text-slate-100">Notifications</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDoNotDisturb(!dnd)}
                className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${dnd ? 'bg-amber-500/20 border-amber-500/50 text-amber-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}
                title="Keep collecting notifications without showing pop-ups"
              >
                {dnd ? 'Do Not Disturb: on' : 'Do Not Disturb'}
              </button>
              {list.length > 0 && (
                <button onClick={clearNotifications} className="p-1 text-slate-500 hover:text-rose-300" title="Clear all"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-500">
                <CheckCheck className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                You're all caught up.
              </div>
            ) : list.map((n) => {
              const app = n.appId ? getAppById(n.appId) : null;
              return (
                <div key={n.id} className="group px-3 py-2.5 border-b border-slate-800/70 hover:bg-slate-800/40 flex gap-2.5">
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${DOT[n.type] || DOT.info}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-100 leading-snug">{n.title}</span>
                      <button onClick={() => removeNotification(n.id)} className="text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" title="Dismiss"><X className="w-3 h-3" /></button>
                    </div>
                    {n.message && <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5 break-words">{n.message}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-500">{timeAgo(n.ts)}</span>
                      {app && (
                        <button onClick={() => go(n)} className="flex items-center gap-0.5 text-[10px] font-semibold text-cyan-300 hover:text-cyan-200">
                          Open {app.label || app.title} <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
