import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BaseNotification, 
  UseNotificationsReturn, 
  NotificationFilter,
  NotificationSettings 
} from '../types/notification.types';
import { notificationService } from '../services/NotificationService';
import { filterNotifications, sortNotifications } from '../utils/notificationUtils';

const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<BaseNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<NotificationFilter | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  
  const subscriptionRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize notifications on mount
  useEffect(() => {
    let isMounted = true;

    const initializeNotifications = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load initial notifications
        await loadNotifications();

        // Subscribe to real-time updates
        if (subscriptionRef.current) {
          subscriptionRef.current();
        }

        subscriptionRef.current = notificationService.subscribe(({ notifications: newNotifications, unreadCount: newUnreadCount }) => {
          if (isMounted) {
            setNotifications(newNotifications);
            setUnreadCount(newUnreadCount);
          }
        });

        // Load notification settings
        const userSettings = await notificationService.getSettings();
        if (isMounted) {
          setSettings(userSettings);
        }

      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load notifications');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeNotifications();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load notifications with optional filter
  const loadNotifications = useCallback(async (filter?: NotificationFilter) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const loadedNotifications = await notificationService.loadNotifications(filter);
      
      // Sort notifications (unread first, then by priority and timestamp)
      const sortedNotifications = sortNotifications(loadedNotifications);
      
      setNotifications(sortedNotifications);
      setUnreadCount(sortedNotifications.filter(n => !n.read).length);
      setCurrentFilter(filter || null);
      
      // Determine if there are more notifications to load
      const totalCount = sortedNotifications.length;
      const limit = filter?.limit || 50;
      setHasMore(totalCount >= limit);

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a new notification
  const addNotification = useCallback((notification: Omit<BaseNotification, 'id' | 'timestamp'>) => {
    try {
      notificationService.addNotification(notification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add notification');
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      setIsLoading(true);
      await notificationService.markAllAsRead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      setIsLoading(true);
      await notificationService.clearAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear all notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh notifications
  const refresh = useCallback(async () => {
    await loadNotifications(currentFilter || undefined);
  }, [loadNotifications, currentFilter]);

  // Load more notifications (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;

    try {
      setIsLoading(true);
      
      const offset = notifications.length;
      const filter: NotificationFilter = {
        ...currentFilter,
        offset,
        limit: 25 // Load 25 more notifications
      };

      const moreNotifications = await notificationService.loadNotifications(filter);
      
      if (moreNotifications.length > 0) {
        const sortedNew = sortNotifications(moreNotifications);
        setNotifications(prev => [...prev, ...sortedNew]);
        
        // Update hasMore based on returned count
        setHasMore(moreNotifications.length >= (filter.limit || 25));
      } else {
        setHasMore(false);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more notifications');
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, notifications.length, currentFilter]);

  // Filter notifications client-side
  const filterNotifications = useCallback((filter: NotificationFilter) => {
    setCurrentFilter(filter);
    
    // Apply filter to current notifications
    const filtered = filterNotifications(notifications, filter);
    setNotifications(sortNotifications(filtered));
  }, [notifications]);

  // Search notifications
  const searchNotifications = useCallback(async (query: string) => {
    const searchFilter: NotificationFilter = {
      ...currentFilter,
      search: query,
      limit: 100 // Increase limit for search
    };

    await loadNotifications(searchFilter);
  }, [currentFilter, loadNotifications]);

  // Bulk operations
  const bulkMarkAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      setIsLoading(true);
      await Promise.all(notificationIds.map(id => notificationService.markAsRead(id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notifications as read');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const bulkDelete = useCallback(async (notificationIds: string[]) => {
    try {
      setIsLoading(true);
      await Promise.all(notificationIds.map(id => notificationService.deleteNotification(id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get notifications by type
  const getNotificationsByType = useCallback((type: string) => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  // Get notifications by priority
  const getNotificationsByPriority = useCallback((priority: string) => {
    return notifications.filter(n => n.priority === priority);
  }, [notifications]);

  // Get unread notifications
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  // Get recent notifications (last 24 hours)
  const getRecentNotifications = useCallback(() => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return notifications.filter(n => new Date(n.timestamp) > dayAgo);
  }, [notifications]);

  // Update notification settings
  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    if (!settings) return;

    try {
      const updatedSettings = { ...settings, ...newSettings };
      await notificationService.updateSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification settings');
    }
  }, [settings]);

  // Request notification permission (for browser notifications)
  const requestPermission = useCallback(async () => {
    try {
      const permission = await notificationService.requestNotificationPermission();
      return permission;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request notification permission');
      return false;
    }
  }, []);

  return {
    // Data
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    settings,

    // Basic actions
    loadNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
    loadMore,

    // Filtering and search
    filterNotifications,
    searchNotifications,

    // Bulk operations
    bulkMarkAsRead,
    bulkDelete,

    // Getters
    getNotificationsByType,
    getNotificationsByPriority,
    getUnreadNotifications,
    getRecentNotifications,

    // Settings
    updateSettings,
    requestPermission
  };
};

export { useNotifications };
export default useNotifications;