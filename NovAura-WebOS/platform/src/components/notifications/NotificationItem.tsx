import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  MessageSquare,
  Star,
  Bell,
  AtSign,
  UserPlus,
  Check,
  Trash2,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onDelete: (id: string) => void;
  index?: number;
}

// Icon configuration based on notification type
const notificationConfig: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  sale: {
    icon: ShoppingCart,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  message: {
    icon: MessageSquare,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  review: {
    icon: Star,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  system: {
    icon: Bell,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
  },
  mention: {
    icon: AtSign,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  follower: {
    icon: UserPlus,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
  },
  // Legacy types for compatibility
  new_asset: {
    icon: ShoppingCart,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  price_drop: {
    icon: ShoppingCart,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  creator_update: {
    icon: Bell,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
  },
  follow: {
    icon: UserPlus,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
  },
  pioneer_badge: {
    icon: Star,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
  },
};

// Format relative time
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  index = 0,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  // Swipe handling for mobile
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, -50, 0], [0.5, 0.8, 1]);
  const background = useTransform(
    x,
    [-150, -100, 0],
    ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.1)', 'rgba(0, 0, 0, 0)']
  );

  const config = notificationConfig[notification.type];
  const Icon = config.icon;

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleSwipeEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -100) {
      onDelete(notification.id);
    }
  };

  const handleMarkAsReadToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (notification.read) {
      onMarkAsUnread(notification.id);
    } else {
      onMarkAsRead(notification.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification.id);
  };

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      style={{ x, opacity, background }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={handleSwipeEnd}
      onHoverStart={() => {
        setShowActions(true);
      }}
      onHoverEnd={() => {
        setShowActions(false);
      }}
      className={cn(
        'relative group cursor-pointer overflow-hidden',
        'p-4 border-b border-white/5 last:border-b-0',
        'transition-colors duration-200',
        notification.read
          ? 'bg-transparent hover:bg-white/[0.02]'
          : 'bg-neon-cyan/[0.03] hover:bg-neon-cyan/[0.05]'
      )}
      onClick={handleClick}
    >
      {/* Swipe hint for mobile */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500/20 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity md:hidden">
        <Trash2 className="w-5 h-5 text-red-400" />
      </div>

      <div className="flex gap-3">
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
            config.bgColor
          )}
        >
          <Icon className={cn('w-5 h-5', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                'text-sm font-medium leading-tight pr-2',
                notification.read ? 'text-text-secondary' : 'text-text-primary'
              )}
            >
              {notification.title}
            </h4>
            
            {/* Unread indicator */}
            {!notification.read && (
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-neon-cyan animate-pulse mt-1.5" />
            )}
          </div>

          {/* Message preview */}
          <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">
            {notification.description || notification.message}
          </p>

          {/* Timestamp & Actions */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-text-muted">
              {formatTimeAgo(notification.createdAt)}
            </span>

            {/* Action buttons (visible on hover) */}
            <motion.div
              initial={false}
              animate={{ opacity: showActions ? 1 : 0, x: showActions ? 0 : 10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center gap-1',
                !showActions && 'pointer-events-none'
              )}
            >
              <button
                onClick={handleMarkAsReadToggle}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                title={notification.read ? 'Mark as unread' : 'Mark as read'}
              >
                {notification.read ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="Delete notification"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        </div>

        {/* Creator avatar (if applicable) */}
        {notification.creatorAvatar && (
          <div className="flex-shrink-0">
            <img
              src={notification.creatorAvatar}
              alt={notification.creatorUsername}
              className="w-8 h-8 rounded-full border border-white/10"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Skeleton loader for notifications
export function NotificationItemSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="p-4 border-b border-white/5"
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-white/5 rounded w-full animate-pulse" />
          <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

export default NotificationItem;
