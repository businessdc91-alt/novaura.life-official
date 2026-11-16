import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Settings,
  Filter,
  X,
  Inbox,
  ShoppingCart,
  MessageSquare,
  Star,
  AtSign,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { notificationService } from '@/services/notificationService';
import { NotificationItem, NotificationItemSkeleton } from './NotificationItem';
import type { Notification, NotificationType, NotificationFilterType } from '@/types';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
}

// Filter configuration
const filterTabs: { value: NotificationFilterType; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Inbox },
  { value: 'unread', label: 'Unread', icon: Bell },
  { value: 'mentions', label: 'Mentions', icon: AtSign },
];

const typeFilters: { type: NotificationType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'sale', label: 'Sales', icon: ShoppingCart, color: 'text-emerald-400' },
  { type: 'message', label: 'Messages', icon: MessageSquare, color: 'text-blue-400' },
  { type: 'review', label: 'Reviews', icon: Star, color: 'text-amber-400' },
  { type: 'system', label: 'System', icon: Bell, color: 'text-gray-400' },
];

const PER_PAGE = 10;

export function NotificationPanel({ isOpen, onClose, triggerRef }: NotificationPanelProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<NotificationFilterType>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<NotificationType | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load notifications
  const loadNotifications = useCallback(async (reset = false) => {
    if (isLoading) return;
    
    setIsLoading(true);
    const currentPage = reset ? 1 : page;

    try {
      let filter: { type?: NotificationType; read?: boolean } = {};

      if (activeTab === 'unread') {
        filter.read = false;
      } else if (activeTab === 'mentions') {
        filter.type = 'mention';
      } else if (activeTab === 'sales') {
        filter.type = 'sale';
      } else if (activeTab === 'messages') {
        filter.type = 'message';
      } else if (activeTab === 'system') {
        filter.type = 'system';
      }

      // Apply type filter if selected
      if (selectedTypeFilter && activeTab === 'all') {
        filter.type = selectedTypeFilter;
      }

      const result = await notificationService.getNotifications(
        'current_user',
        currentPage,
        PER_PAGE,
        filter
      );

      if (reset) {
        setNotifications(result.notifications);
        setPage(2);
      } else {
        setNotifications(prev => [...prev, ...result.notifications]);
        setPage(prev => prev + 1);
      }

      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedTypeFilter, page, isLoading]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadNotifications(true);
      updateUnreadCount();
    }
  }, [isOpen, activeTab, selectedTypeFilter]);

  // Subscribe to notification changes
  useEffect(() => {
    const unsubscribe = notificationService.subscribeToNotifications(
      'current_user',
      (event: string, _data: any) => {
        if (event === 'read' || event === 'unread' || event === 'delete') {
          loadNotifications(true);
        } else if (event === 'allRead') {
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } else if (event === 'new') {
          loadNotifications(true);
        }
        updateUnreadCount();
      }
    );

    return () => unsubscribe();
  }, []);

  const updateUnreadCount = async () => {
    const count = await notificationService.getUnreadCount('current_user');
    setUnreadCount(count);
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead('current_user');
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAsUnread = async (id: string) => {
    await notificationService.markAsUnread(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: false } : n))
    );
    setUnreadCount(prev => prev + 1);
  };

  const handleDelete = async (id: string) => {
    await notificationService.deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    updateUnreadCount();
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadNotifications();
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      handleLoadMore();
    }
  };

  const handleViewAll = () => {
    onClose();
    navigate('/notifications');
  };

  // Filter notifications by type
  const filteredNotifications = selectedTypeFilter && activeTab === 'all'
    ? notifications.filter(n => n.type === selectedTypeFilter)
    : notifications;

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>
        <div ref={triggerRef as any} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          'w-[400px] p-0 overflow-hidden',
          'bg-void-light border-white/10',
          'shadow-card'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-neon-cyan" />
            <h3 className="font-heading font-semibold text-text-primary">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-neon-cyan/20 text-neon-cyan text-xs rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-muted hover:text-text-primary"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 transition-colors',
                showFilters ? 'text-neon-cyan' : 'text-text-muted hover:text-text-primary'
              )}
              onClick={() => setShowFilters(!showFilters)}
              title="Filter notifications"
            >
              <Filter className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-muted hover:text-text-primary"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Type Filters (expandable) */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-white/5 overflow-hidden"
            >
              <div className="p-3 flex flex-wrap gap-2">
                {typeFilters.map(({ type, label, icon: Icon, color }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedTypeFilter(
                      selectedTypeFilter === type ? null : type
                    )}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      selectedTypeFilter === type
                        ? 'bg-white/10 text-text-primary'
                        : 'bg-white/5 text-text-muted hover:bg-white/[0.08] hover:text-text-secondary'
                    )}
                  >
                    <Icon className={cn('w-3.5 h-3.5', color)} />
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NotificationFilterType)}>
          <TabsList className="w-full justify-start rounded-none border-b border-white/5 bg-transparent p-0 h-10">
            {filterTabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  'flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-neon-cyan data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                  'text-text-muted data-[state=active]:text-text-primary text-xs font-medium py-2.5'
                )}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {label}
                {value === 'unread' && unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-neon-cyan/20 text-neon-cyan text-[10px] rounded-full">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="m-0">
            <ScrollArea
              ref={scrollRef}
              className="h-[400px]"
              onScrollCapture={handleScroll}
            >
              <AnimatePresence mode="popLayout">
                {isLoading && notifications.length === 0 ? (
                  // Loading skeletons
                  Array.from({ length: 3 }).map((_, i) => (
                    <NotificationItemSkeleton key={`skeleton-${i}`} index={i} />
                  ))
                ) : filteredNotifications.length === 0 ? (
                  // Empty state
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-16 px-4 text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                      <Bell className="w-8 h-8 text-text-muted" />
                    </div>
                    <h4 className="text-text-primary font-medium mb-1">
                      No notifications
                    </h4>
                    <p className="text-sm text-text-secondary max-w-[200px]">
                      {activeTab === 'unread'
                        ? "You're all caught up! No unread notifications."
                        : activeTab === 'mentions'
                        ? "No mentions found. You'll be notified when someone mentions you."
                        : 'No notifications to show.'}
                    </p>
                  </motion.div>
                ) : (
                  // Notification list
                  <>
                    {filteredNotifications.map((notification, index) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={handleMarkAsRead}
                        onMarkAsUnread={handleMarkAsUnread}
                        onDelete={handleDelete}
                        index={index}
                      />
                    ))}
                    
                    {/* Load more indicator */}
                    {hasMore && (
                      <div className="flex justify-center py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleLoadMore}
                          disabled={isLoading}
                          className="text-text-muted hover:text-text-primary"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            'Load more'
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </AnimatePresence>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-white/5 bg-white/[0.02]">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-text-muted hover:text-text-primary"
            onClick={handleViewAll}
          >
            View all notifications
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-text-muted hover:text-text-primary"
            onClick={() => navigate('/notifications')}
            title="Notification settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationPanel;
