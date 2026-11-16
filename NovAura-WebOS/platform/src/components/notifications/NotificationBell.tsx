import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { notificationService } from '@/services/notificationService';
import { NotificationPanel } from './NotificationPanel';

interface NotificationBellProps {
  className?: string;
  variant?: 'ghost' | 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function NotificationBell({
  className,
  variant = 'ghost',
  size = 'icon',
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [rgbGlow, setRgbGlow] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Update unread count
  const updateUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount('current_user');
      if (count > unreadCount && unreadCount > 0) {
        // New notification arrived
        setHasNewNotification(true);
        setRgbGlow(true);
        setTimeout(() => setRgbGlow(false), 3000);
      }
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to get unread count:', error);
    }
  }, [unreadCount]);

  // Initial load and subscription
  useEffect(() => {
    // Get initial count
    updateUnreadCount();

    // Subscribe to notification changes
    unsubscribeRef.current = notificationService.subscribeToNotifications(
      'current_user',
      (event: string, _data: any) => {
        if (event === 'new') {
          setHasNewNotification(true);
          setRgbGlow(true);
          setTimeout(() => setRgbGlow(false), 3000);
          updateUnreadCount();
        } else if (event === 'read' || event === 'allRead' || event === 'delete') {
          updateUnreadCount();
        }
      }
    );

    // Poll for updates every 30 seconds (fallback)
    const interval = setInterval(updateUnreadCount, 30000);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      clearInterval(interval);
    };
  }, [updateUnreadCount]);

  // Handle panel open/close
  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewNotification(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Format badge count
  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        ref={buttonRef}
        variant={variant}
        size={size}
        onClick={handleToggle}
        className={cn(
          'relative transition-all duration-300',
          'text-text-secondary hover:text-neon-cyan hover:bg-neon-cyan/10',
          rgbGlow && 'animate-rgb-glow',
          className
        )}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <AnimatePresence mode="wait">
          {hasNewNotification ? (
            <motion.div
              key="ringing"
              initial={{ rotate: 0 }}
              animate={{ rotate: [0, -15, 15, -10, 10, -5, 5, 0] }}
              transition={{ duration: 0.5 }}
            >
              <BellRing className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div
              key="bell"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <Bell className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unread Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={cn(
                'absolute -top-1 -right-1 min-w-[20px] h-5',
                'flex items-center justify-center',
                'bg-neon-magenta text-white text-[10px] font-bold rounded-full',
                'border-2 border-void',
                hasNewNotification && 'animate-pulse'
              )}
            >
              {displayCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* RGB Glow Effect */}
        <AnimatePresence>
          {rgbGlow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.2 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(139, 92, 246, 0.3), rgba(255, 0, 110, 0.3))',
                filter: 'blur(8px)',
                zIndex: -1,
              }}
            />
          )}
        </AnimatePresence>
      </Button>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={isOpen}
        onClose={handleClose}
        triggerRef={buttonRef as any}
      />
    </div>
  );
}

// Compact version for mobile or minimal layouts
export function NotificationBellCompact({
  className,
}: {
  className?: string;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      const count = await notificationService.getUnreadCount('current_user');
      setUnreadCount(count);
    };

    updateCount();

    const unsubscribe = notificationService.subscribeToNotifications(
      'current_user',
      () => updateCount()
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className={cn('relative', className)}>
      <Bell className="w-5 h-5 text-text-secondary" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-neon-magenta rounded-full animate-pulse" />
      )}
    </div>
  );
}

// Badge-only version for integration with other components
export function NotificationBadge({
  count,
  className,
  pulse = false,
}: {
  count: number;
  className?: string;
  pulse?: boolean;
}) {
  if (count === 0) return null;

  const displayCount = count > 99 ? '99+' : count;

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className={cn(
        'inline-flex items-center justify-center',
        'min-w-[18px] h-[18px] px-1',
        'bg-neon-magenta text-white text-[10px] font-bold rounded-full',
        pulse && 'animate-pulse',
        className
      )}
    >
      {displayCount}
    </motion.span>
  );
}

export default NotificationBell;
