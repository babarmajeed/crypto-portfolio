import { 
  BaseNotification, 
  NotificationServiceInterface, 
  NotificationSettings, 
  NotificationFilter,
  NotificationTemplate,
  NotificationAnalytics,
  NotificationHistory
} from '../types/notification.types';
import { 
  generateNotificationId, 
  shouldShowNotification, 
  validateNotification,
  debounce
} from '../utils/notificationUtils';

class NotificationService implements NotificationServiceInterface {
  private notifications: BaseNotification[] = [];
  private subscribers = new Set<(data: { notifications: BaseNotification[]; unreadCount: number }) => void>();
  private unreadCount = 0;
  private websocket: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private settings: NotificationSettings | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  // Initialize the service
  private async initializeService() {
    if (this.isInitialized) return;

    try {
      // Load settings first
      await this.loadSettings();
      
      // Load existing notifications
      await this.loadFromStorage();
      
      // Initialize WebSocket connection
      this.initializeWebSocket();
      
      // Set up periodic cleanup
      this.setupPeriodicCleanup();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  // WebSocket Management
  private initializeWebSocket() {
    if (typeof window === 'undefined' || !('WebSocket' in window)) {
      console.warn('WebSocket not supported');
      return;
    }

    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';
      const token = this.getAuthToken();
      
      this.websocket = new WebSocket(`${wsUrl}/notifications${token ? `?token=${token}` : ''}`);
      
      this.websocket.onopen = () => {
        console.log('Notification WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Send initial subscription message
        this.websocket?.send(JSON.stringify({
          type: 'subscribe',
          topics: ['notifications', 'price_alerts', 'portfolio_updates']
        }));
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.websocket.onclose = (event) => {
        console.log('Notification WebSocket disconnected:', event.code, event.reason);
        this.websocket = null;
        
        // Attempt to reconnect if not a clean closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.websocket.onerror = (error) => {
        console.error('Notification WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'notification':
        this.addNotification(data.data);
        break;
      
      case 'notification_read':
        this.handleNotificationRead(data.data.id);
        break;
      
      case 'notification_deleted':
        this.handleNotificationDeleted(data.data.id);
        break;
      
      case 'batch_update':
        this.handleBatchUpdate(data.data);
        break;
      
      case 'settings_updated':
        this.handleSettingsUpdated(data.data);
        break;
      
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.reconnectTimeout = null;
      console.log(`Attempting to reconnect WebSocket (attempt ${this.reconnectAttempts})`);
      this.initializeWebSocket();
    }, delay);
  }

  // Subscription Management
  subscribe(callback: (data: { notifications: BaseNotification[]; unreadCount: number }) => void) {
    this.subscribers.add(callback);
    
    // Immediately call with current data
    callback({
      notifications: this.notifications,
      unreadCount: this.unreadCount
    });
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers = debounce(() => {
    const data = {
      notifications: [...this.notifications],
      unreadCount: this.unreadCount
    };
    
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in notification subscriber:', error);
      }
    });
  }, 100);

  // Core Notification Methods
  async loadNotifications(filter?: NotificationFilter): Promise<BaseNotification[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filter) {
        if (filter.type && filter.type.length > 0) {
          queryParams.append('types', filter.type.join(','));
        }
        if (filter.priority && filter.priority.length > 0) {
          queryParams.append('priorities', filter.priority.join(','));
        }
        if (filter.read !== undefined) {
          queryParams.append('read', filter.read.toString());
        }
        if (filter.dateRange) {
          queryParams.append('start_date', filter.dateRange.start);
          queryParams.append('end_date', filter.dateRange.end);
        }
        if (filter.search) {
          queryParams.append('search', filter.search);
        }
        if (filter.limit) {
          queryParams.append('limit', filter.limit.toString());
        }
        if (filter.offset) {
          queryParams.append('offset', filter.offset.toString());
        }
        if (filter.sortBy) {
          queryParams.append('sort_by', filter.sortBy);
        }
        if (filter.sortOrder) {
          queryParams.append('sort_order', filter.sortOrder);
        }
      }

      const response = await fetch(`/api/notifications?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (!filter || filter.offset === 0) {
          // Replace notifications if this is a fresh load
          this.notifications = data.notifications || [];
          this.unreadCount = data.unreadCount || 0;
        }
        
        this.notifySubscribers();
        this.saveToStorage();
        
        return data.notifications || [];
      } else {
        throw new Error(`Failed to load notifications: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to load notifications from server, using local storage:', error);
      return this.notifications;
    }
  }

  async addNotification(notification: Omit<BaseNotification, 'id' | 'timestamp'>): Promise<BaseNotification> {
    // Validate notification
    const errors = validateNotification(notification);
    if (errors.length > 0) {
      throw new Error(`Invalid notification: ${errors.join(', ')}`);
    }

    // Check if notifications should be shown based on settings
    if (this.settings && !shouldShowNotification(notification as BaseNotification, this.settings.quietHours)) {
      console.log('Notification suppressed due to quiet hours');
      return notification as BaseNotification;
    }

    const completeNotification: BaseNotification = {
      ...notification,
      id: generateNotificationId(),
      timestamp: new Date().toISOString(),
      read: false
    };

    // Add to beginning of array for latest-first order
    this.notifications.unshift(completeNotification);

    // Keep only the most recent notifications (limit to 1000)
    if (this.notifications.length > 1000) {
      this.notifications = this.notifications.slice(0, 1000);
    }

    this.unreadCount++;
    
    // Try to save to server
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(completeNotification)
      });
    } catch (error) {
      console.error('Failed to save notification to server:', error);
    }

    // Always notify subscribers and save locally
    this.notifySubscribers();
    this.saveToStorage();
    
    // Show browser notification if enabled and permitted
    this.showBrowserNotification(completeNotification);
    
    return completeNotification;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification || notification.read) return;

    notification.read = true;
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    
    // Update on server
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
    } catch (error) {
      console.error('Failed to mark notification as read on server:', error);
    }

    this.notifySubscribers();
    this.saveToStorage();
  }

  async markAllAsRead(): Promise<void> {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    
    this.unreadCount = 0;

    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read on server:', error);
    }

    this.notifySubscribers();
    this.saveToStorage();
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index === -1) return;

    const notification = this.notifications[index];
    this.notifications.splice(index, 1);
    
    if (!notification.read) {
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    }

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
    } catch (error) {
      console.error('Failed to delete notification on server:', error);
    }

    this.notifySubscribers();
    this.saveToStorage();
  }

  async clearAll(): Promise<void> {
    this.notifications = [];
    this.unreadCount = 0;

    try {
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
    } catch (error) {
      console.error('Failed to clear notifications on server:', error);
    }

    this.notifySubscribers();
    this.saveToStorage();
  }

  // Settings Management
  async getSettings(): Promise<NotificationSettings> {
    if (this.settings) {
      return this.settings;
    }

    try {
      const response = await fetch('/api/user/notification-settings', {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        const settings = await response.json();
        this.settings = settings;
        return settings;
      }
    } catch (error) {
      console.error('Failed to load notification settings from server:', error);
    }

    // Return default settings
    const defaultSettings: NotificationSettings = {
      enabled: true,
      channels: {
        inApp: true,
        email: false,
        push: false,
        sms: false
      },
      types: {
        price_alert: { enabled: true, channels: ['in_app'], priority: 'high' },
        portfolio: { enabled: true, channels: ['in_app'], priority: 'medium' },
        security: { enabled: true, channels: ['in_app', 'email'], priority: 'high' },
        system: { enabled: true, channels: ['in_app'], priority: 'medium' },
        trade: { enabled: true, channels: ['in_app'], priority: 'medium' },
        milestone: { enabled: true, channels: ['in_app'], priority: 'medium' },
        news: { enabled: false, channels: ['in_app'], priority: 'low' },
        maintenance: { enabled: true, channels: ['in_app'], priority: 'medium' }
      },
      doNotDisturb: false,
      frequency: {
        digest: 'never',
        realTime: true
      },
      sound: {
        enabled: true,
        volume: 0.7,
        customSounds: {}
      }
    };

    this.settings = defaultSettings;
    return defaultSettings;
  }

  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings } as NotificationSettings;

    try {
      await fetch('/api/user/notification-settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.settings)
      });
    } catch (error) {
      console.error('Failed to update notification settings on server:', error);
    }

    // Save to localStorage as backup
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save notification settings locally:', error);
    }
  }

  // Analytics
  async getAnalytics(timeRange: { start: string; end: string }): Promise<NotificationAnalytics> {
    try {
      const response = await fetch(`/api/notifications/analytics?start=${timeRange.start}&end=${timeRange.end}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to load notification analytics:', error);
    }

    // Return empty analytics
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalRead: 0,
      totalClicked: 0,
      deliveryRate: 0,
      readRate: 0,
      clickRate: 0,
      avgDeliveryTime: 0,
      avgReadTime: 0,
      channelBreakdown: {} as any,
      typeBreakdown: {} as any,
      timeRange
    };
  }

  // Templates
  async getTemplates(): Promise<NotificationTemplate[]> {
    try {
      const response = await fetch('/api/notification-templates', {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to load notification templates:', error);
    }

    return [];
  }

  async createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    try {
      const response = await fetch('/api/notification-templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(template)
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to create notification template:', error);
    }

    throw new Error('Failed to create notification template');
  }

  async updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<void> {
    try {
      await fetch(`/api/notification-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
    } catch (error) {
      console.error('Failed to update notification template:', error);
      throw error;
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      await fetch(`/api/notification-templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
    } catch (error) {
      console.error('Failed to delete notification template:', error);
      throw error;
    }
  }

  // Browser Notifications
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  private showBrowserNotification(notification: BaseNotification) {
    if (!this.settings?.enabled || !this.settings.channels.push) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.type,
        requireInteraction: notification.priority === 'critical',
        data: notification.data
      });

      browserNotification.onclick = () => {
        window.focus();
        if (notification.actionUrl) {
          window.location.href = notification.actionUrl;
        }
        browserNotification.close();
      };

      // Auto-close unless high priority or critical
      if (notification.priority !== 'high' && notification.priority !== 'critical') {
        setTimeout(() => browserNotification.close(), 5000);
      }
    } catch (error) {
      console.error('Failed to show browser notification:', error);
    }
  }

  // Storage Management
  private async loadSettings() {
    try {
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        this.settings = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
  }

  private async loadFromStorage() {
    try {
      const saved = localStorage.getItem('notifications');
      if (saved) {
        const data = JSON.parse(saved);
        this.notifications = data.notifications || [];
        this.unreadCount = data.unreadCount || 0;
      }
    } catch (error) {
      console.error('Failed to load notifications from localStorage:', error);
    }
  }

  private saveToStorage() {
    try {
      const data = {
        notifications: this.notifications.slice(0, 100), // Save only recent 100
        unreadCount: this.unreadCount,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('notifications', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save notifications to localStorage:', error);
    }
  }

  // Event Handlers
  private handleNotificationRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.notifySubscribers();
      this.saveToStorage();
    }
  }

  private handleNotificationDeleted(notificationId: string) {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index > -1) {
      const notification = this.notifications[index];
      this.notifications.splice(index, 1);
      
      if (!notification.read) {
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }
      
      this.notifySubscribers();
      this.saveToStorage();
    }
  }

  private handleBatchUpdate(notifications: BaseNotification[]) {
    this.notifications = notifications;
    this.unreadCount = notifications.filter(n => !n.read).length;
    this.notifySubscribers();
    this.saveToStorage();
  }

  private handleSettingsUpdated(settings: NotificationSettings) {
    this.settings = settings;
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save updated settings:', error);
    }
  }

  // Cleanup
  private setupPeriodicCleanup() {
    // Clean up old notifications every hour
    setInterval(() => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const initialLength = this.notifications.length;
      
      this.notifications = this.notifications.filter(notification => 
        new Date(notification.timestamp) > oneWeekAgo || notification.persistent
      );
      
      if (this.notifications.length !== initialLength) {
        this.notifySubscribers();
        this.saveToStorage();
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  // Utility Methods
  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }

  // Cleanup method for component unmount
  destroy() {
    if (this.websocket) {
      this.websocket.close(1000, 'Service destroyed');
      this.websocket = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.subscribers.clear();
  }
}

// Create and export singleton instance
export const notificationService = new NotificationService();
export default NotificationService;