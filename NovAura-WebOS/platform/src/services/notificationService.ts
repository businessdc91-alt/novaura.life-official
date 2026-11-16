import type { Notification, NotificationType } from '@/types';

// Extended notification interface for service
export interface NotificationWithMetadata extends Notification {
  priority?: 'low' | 'medium' | 'high';
  expiresAt?: string;
}

// Simulated delay for async operations
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class NotificationService {
  private notifications: NotificationWithMetadata[] = [];
  private subscribers: Map<string, Function[]> = new Map();

  /**
   * Get notifications for a user with pagination
   */
  async getNotifications(
    _userId: string,
    page: number = 1,
    perPage: number = 10,
    filter?: { type?: NotificationType; read?: boolean }
  ): Promise<{ notifications: Notification[]; hasMore: boolean }> {
    await delay(300); // Simulate API call

    let filtered = [...this.notifications];

    if (filter?.type) {
      filtered = filtered.filter(n => n.type === filter.type);
    }

    if (filter?.read !== undefined) {
      filtered = filtered.filter(n => n.read === filter.read);
    }

    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginated = filtered.slice(start, end);

    return {
      notifications: paginated,
      hasMore: end < filtered.length,
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await delay(150);
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.notifySubscribers('read', notificationId);
    }
  }

  /**
   * Mark a notification as unread
   */
  async markAsUnread(notificationId: string): Promise<void> {
    await delay(150);
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = false;
      this.notifySubscribers('unread', notificationId);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(_userId: string): Promise<void> {
    await delay(200);
    this.notifications.forEach(n => {
      n.read = true;
    });
    this.notifySubscribers('allRead', null);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await delay(150);
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.notifySubscribers('delete', notificationId);
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(_userId: string): Promise<number> {
    await delay(100);
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Subscribe to notification changes
   */
  subscribeToNotifications(userId: string, callback: Function): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, []);
    }
    this.subscribers.get(userId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(userId);
      if (subs) {
        const index = subs.indexOf(callback);
        if (index > -1) {
          subs.splice(index, 1);
        }
      }
    };
  }

  /**
   * Add a new notification (for testing/demo purposes)
   */
  async addNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<Notification> {
    await delay(100);
    const newNotification: NotificationWithMetadata = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(newNotification);
    this.notifySubscribers('new', newNotification);
    return newNotification;
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(notificationId: string): Promise<Notification | null> {
    await delay(100);
    return this.notifications.find(n => n.id === notificationId) || null;
  }

  /**
   * Filter notifications by type
   */
  async getNotificationsByType(
    userId: string,
    type: NotificationType,
    page: number = 1,
    perPage: number = 10
  ): Promise<{ notifications: Notification[]; hasMore: boolean }> {
    return this.getNotifications(userId, page, perPage, { type });
  }

  /**
   * Get unread notifications only
   */
  async getUnreadNotifications(
    userId: string,
    page: number = 1,
    perPage: number = 10
  ): Promise<{ notifications: Notification[]; hasMore: boolean }> {
    return this.getNotifications(userId, page, perPage, { read: false });
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(_userId: string): Promise<void> {
    await delay(200);
    this.notifications = [];
    this.notifySubscribers('clear', null);
  }

  private notifySubscribers(event: string, data: any) {
    this.subscribers.forEach((callbacks) => {
      callbacks.forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('Error in notification subscriber:', error);
        }
      });
    });
  }
}

export const notificationService = new NotificationService();

// React hook for using notifications
export function useNotificationService() {
  return notificationService;
}
