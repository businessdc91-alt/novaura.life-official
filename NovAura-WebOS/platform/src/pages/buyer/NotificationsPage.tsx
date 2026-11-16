import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Package,
  DollarSign,
  Tag,
  UserPlus,
  Info,
  Megaphone,
  Trash2,
  CheckCheck,
  X,
  Filter,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSocialStore } from '@/stores/socialStore';
import type { NotificationType, Notification } from '@/types';

const notifTypeConfig: Record<NotificationType, { icon: typeof Bell; color: string; label: string }> = {
  new_asset: { icon: Package, color: 'text-neon-cyan', label: 'New Asset' },
  sale: { icon: DollarSign, color: 'text-green-400', label: 'Sale' },
  price_drop: { icon: Tag, color: 'text-neon-magenta', label: 'Price Drop' },
  creator_update: { icon: Megaphone, color: 'text-neon-violet', label: 'Update' },
  follow: { icon: UserPlus, color: 'text-sky-400', label: 'Follow' },
  system: { icon: Info, color: 'text-yellow-400', label: 'System' },
  message: { icon: Info, color: 'text-blue-400', label: 'Message' },
  review: { icon: Info, color: 'text-amber-400', label: 'Review' },
  mention: { icon: Info, color: 'text-purple-400', label: 'Mention' },
  follower: { icon: UserPlus, color: 'text-cyan-400', label: 'Follower' },
  pioneer_badge: { icon: Bell, color: 'text-yellow-400', label: 'Pioneer Badge' },
};

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearNotifications,
  } = useSocialStore();

  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filteredNotifications = notifications.filter((n: Notification) => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (showUnreadOnly && n.read) return false;
    return true;
  });

  const groupByDate = (notifs: Notification[]): Record<string, Notification[]> => {
    const groups: Record<string, Notification[]> = {};
    notifs.forEach((n: Notification) => {
      const date = new Date(n.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  };

  const groupedNotifications = groupByDate(filteredNotifications);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="font-heading text-3xl font-bold text-text-primary flex items-center gap-3">
                <Bell className="w-8 h-8 text-neon-cyan" />
                Notifications
                {unreadCount > 0 && (
                  <span className="px-3 py-1 bg-neon-cyan/10 text-neon-cyan text-sm font-bold rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h1>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-text-secondary"
                  onClick={markAllNotificationsRead}
                >
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-neon-red hover:bg-neon-red/10"
                  onClick={clearNotifications}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-void-light border border-white/5 rounded-xl p-4 mb-6"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-text-muted" />
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                    : 'text-text-muted hover:text-text-primary border border-white/5'
                }`}
              >
                All
              </button>
              {Object.entries(notifTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type as NotificationType)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      typeFilter === type
                        ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                        : 'text-text-muted hover:text-text-primary border border-white/5'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </button>
                );
              })}
              <div className="ml-auto">
                <button
                  onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    showUnreadOnly
                      ? 'bg-neon-violet/10 text-neon-violet border border-neon-violet/30'
                      : 'text-text-muted hover:text-text-primary border border-white/5'
                  }`}
                >
                  {showUnreadOnly ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                  Unread only
                </button>
              </div>
            </div>
          </motion.div>

          {/* Notification List */}
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-void-light border border-white/5 rounded-xl"
            >
              <Bell className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                {showUnreadOnly ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-text-secondary">
                {showUnreadOnly
                  ? 'You\'re all caught up!'
                  : 'Follow creators to get notified when they publish new content.'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {Object.entries(groupedNotifications).map(([dateGroup, notifs]) => (
                  <motion.div
                    key={dateGroup}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <h3 className="text-text-muted text-sm font-medium mb-3">{dateGroup}</h3>
                    <div className="space-y-2">
                      {notifs.map((notif: Notification) => {
                        const config = notifTypeConfig[notif.type];
                        const Icon = config.icon;
                        return (
                          <motion.div
                            key={notif.id}
                            layout
                            exit={{ opacity: 0, x: -100 }}
                            className={`group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                              notif.read
                                ? 'bg-void-light border-white/5 hover:border-white/10'
                                : 'bg-void-light border-neon-cyan/20 hover:border-neon-cyan/40 shadow-[inset_0_0_0_1px_rgba(0,240,255,0.05)]'
                            }`}
                            onClick={() => !notif.read && markNotificationRead(notif.id)}
                          >
                            {/* Icon */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                              notif.read ? 'bg-white/5' : 'bg-neon-cyan/10'
                            }`}>
                              <Icon className={`w-5 h-5 ${notif.read ? 'text-text-muted' : config.color}`} />
                            </div>

                            {/* Content */}
                            <div className="flex-grow min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className={`text-sm font-medium ${notif.read ? 'text-text-secondary' : 'text-text-primary'}`}>
                                    {notif.title}
                                  </p>
                                  <p className="text-text-muted text-sm mt-0.5">{notif.message}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-text-muted text-xs whitespace-nowrap">
                                    {formatTime(notif.createdAt)}
                                  </span>
                                  {!notif.read && (
                                    <div className="w-2 h-2 rounded-full bg-neon-cyan" />
                                  )}
                                </div>
                              </div>

                              {/* Action links */}
                              {(notif.assetId || notif.creatorUsername) && (
                                <div className="flex items-center gap-3 mt-2">
                                  {notif.assetId && (
                                    <Link
                                      to={`/asset/${notif.assetId}`}
                                      className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1"
                                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    >
                                      View asset <ChevronRight className="w-3 h-3" />
                                    </Link>
                                  )}
                                  {notif.creatorUsername && (
                                    <Link
                                      to={`/creator/${notif.creatorUsername}`}
                                      className="text-xs text-neon-violet hover:text-neon-violet/80 flex items-center gap-1"
                                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    >
                                      View creator <ChevronRight className="w-3 h-3" />
                                    </Link>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Delete Button */}
                            <button
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-neon-red transition-all"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                removeNotification(notif.id);
                              }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
