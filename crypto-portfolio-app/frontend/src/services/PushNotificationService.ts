import { 
  PushNotification, 
  PushNotificationServiceInterface, 
  BaseNotification 
} from '../types/notification.types';

class PushNotificationService implements PushNotificationServiceInterface {
  private apiBaseUrl: string;
  private vapidPublicKey: string;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private isInitialized = false;
  private retryDelays = [1000, 5000, 15000, 60000]; // Exponential backoff delays

  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_URL || '/api';
    this.vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || '';
    this.initializeService();
  }

  // Service Initialization
  private async initializeService(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Workers not supported');
        return;
      }

      // Check if Push API is supported
      if (!('PushManager' in window)) {
        console.warn('Push Notifications not supported');
        return;
      }

      // Register service worker
      await this.registerServiceWorker();
      
      // Load existing subscription if any
      await this.loadExistingSubscription();
      
      this.isInitialized = true;
      console.log('Push notification service initialized');

    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
    }
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', this.registration);

      // Handle service worker updates
      this.registration.addEventListener('updatefound', () => {
        console.log('Service Worker update found');
      });

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  private async loadExistingSubscription(): Promise<void> {
    if (!this.registration) return;

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      
      if (this.subscription) {
        console.log('Existing push subscription found');
        // Verify subscription with server
        await this.verifySubscription();
      }
    } catch (error) {
      console.error('Failed to load existing push subscription:', error);
    }
  }

  private async verifySubscription(): Promise<void> {
    if (!this.subscription) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/push/verify-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: this.subscription.toJSON()
        })
      });

      if (!response.ok) {
        console.warn('Push subscription verification failed, resubscribing...');
        await this.unsubscribe();
        await this.subscribe();
      }
    } catch (error) {
      console.error('Failed to verify push subscription:', error);
    }
  }

  // Subscription Management
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.initializeService();
      if (!this.registration) return null;
    }

    try {
      // Check if already subscribed
      const existingSubscription = await this.registration.pushManager.getSubscription();
      if (existingSubscription) {
        this.subscription = existingSubscription;
        return existingSubscription;
      }

      // Request notification permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Push notification permission not granted');
      }

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(this.subscription);

      console.log('Push notification subscription successful');
      return this.subscription;

    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.subscription) return;

    try {
      // Unsubscribe from push manager
      await this.subscription.unsubscribe();
      
      // Remove subscription from server
      await this.removeSubscriptionFromServer(this.subscription);
      
      this.subscription = null;
      console.log('Push notification unsubscription successful');

    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send subscription to server: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      if (!response.ok) {
        console.warn('Failed to remove subscription from server:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }

  // Permission Management
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  getPermissionStatus(): NotificationPermission | null {
    if (!('Notification' in window)) {
      return null;
    }
    return Notification.permission;
  }

  // Core Push Notification Methods
  async sendPushNotification(notification: PushNotification, tokens: string[]): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification,
          tokens,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send push notification: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Push notification sent:', result);

    } catch (error) {
      console.error('Failed to send push notification:', error);
      throw error;
    }
  }

  async sendBulkPushNotification(notifications: PushNotification[], tokens: string[]): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/send-bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notifications,
          tokens,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send bulk push notifications: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Bulk push notifications sent:', result);

    } catch (error) {
      console.error('Failed to send bulk push notifications:', error);
      throw error;
    }
  }

  // Topic Management
  async subscribeToTopic(token: string, topic: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/topics/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, topic })
      });

      if (!response.ok) {
        throw new Error(`Failed to subscribe to topic: ${response.statusText}`);
      }

      console.log(`Subscribed to topic: ${topic}`);

    } catch (error) {
      console.error('Failed to subscribe to topic:', error);
      throw error;
    }
  }

  async unsubscribeFromTopic(token: string, topic: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/topics/unsubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, topic })
      });

      if (!response.ok) {
        throw new Error(`Failed to unsubscribe from topic: ${response.statusText}`);
      }

      console.log(`Unsubscribed from topic: ${topic}`);

    } catch (error) {
      console.error('Failed to unsubscribe from topic:', error);
      throw error;
    }
  }

  async getSubscriptions(token: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/topics?token=${token}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get subscriptions: ${response.statusText}`);
      }

      const data = await response.json();
      return data.topics || [];

    } catch (error) {
      console.error('Failed to get subscriptions:', error);
      throw error;
    }
  }

  // Token Management
  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/validate-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      return response.ok;

    } catch (error) {
      console.error('Failed to validate push token:', error);
      return false;
    }
  }

  getCurrentSubscription(): PushSubscription | null {
    return this.subscription;
  }

  getSubscriptionToken(): string | null {
    if (!this.subscription) return null;
    
    // Extract endpoint as token (simplified approach)
    return this.subscription.endpoint;
  }

  // Convenience Methods
  async sendNotificationFromBaseNotification(notification: BaseNotification): Promise<void> {
    if (!this.subscription) {
      console.warn('No push subscription available');
      return;
    }

    const pushNotification: PushNotification = {
      title: notification.title,
      body: notification.message,
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: {
        notificationId: notification.id,
        type: notification.type,
        timestamp: notification.timestamp,
        actionUrl: notification.actionUrl,
        ...notification.data
      },
      tag: notification.type,
      requireInteraction: notification.priority === 'critical' || notification.priority === 'high',
      timestamp: new Date(notification.timestamp).getTime()
    };

    // Add action buttons for important notifications
    if (notification.priority === 'high' || notification.priority === 'critical') {
      pushNotification.actions = [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icons/view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ];
    }

    const token = this.getSubscriptionToken();
    if (token) {
      await this.sendPushNotification(pushNotification, [token]);
    }
  }

  async sendPriceAlertNotification(asset: string, currentPrice: number, threshold: number, direction: 'above' | 'below'): Promise<void> {
    const pushNotification: PushNotification = {
      title: `Price Alert: ${asset}`,
      body: `${asset} has reached $${currentPrice.toLocaleString()} (${direction} your target of $${threshold.toLocaleString()})`,
      icon: '/icons/price-alert.png',
      badge: '/logo192.png',
      data: {
        type: 'price_alert',
        asset,
        currentPrice,
        threshold,
        direction
      },
      tag: 'price_alert',
      requireInteraction: true,
      actions: [
        {
          action: 'view_portfolio',
          title: 'View Portfolio',
          icon: '/icons/portfolio.png'
        },
        {
          action: 'manage_alerts',
          title: 'Manage Alerts',
          icon: '/icons/alerts.png'
        }
      ]
    };

    const token = this.getSubscriptionToken();
    if (token) {
      await this.sendPushNotification(pushNotification, [token]);
    }
  }

  async sendSecurityAlertNotification(alertType: string, details: any): Promise<void> {
    const pushNotification: PushNotification = {
      title: 'Security Alert',
      body: `${alertType}: Unusual activity detected on your account`,
      icon: '/icons/security.png',
      badge: '/logo192.png',
      data: {
        type: 'security',
        alertType,
        ...details
      },
      tag: 'security',
      requireInteraction: true,
      actions: [
        {
          action: 'review_activity',
          title: 'Review Activity',
          icon: '/icons/review.png'
        },
        {
          action: 'secure_account',
          title: 'Secure Account',
          icon: '/icons/lock.png'
        }
      ]
    };

    const token = this.getSubscriptionToken();
    if (token) {
      await this.sendPushNotification(pushNotification, [token]);
    }
  }

  // Auto-subscription Management
  async enableAutoSubscription(): Promise<void> {
    try {
      await this.subscribe();
      
      // Subscribe to default topics
      const token = this.getSubscriptionToken();
      if (token) {
        const defaultTopics = ['price_alerts', 'portfolio_updates', 'security_alerts'];
        for (const topic of defaultTopics) {
          await this.subscribeToTopic(token, topic);
        }
      }
    } catch (error) {
      console.error('Failed to enable auto-subscription:', error);
      throw error;
    }
  }

  async disableAutoSubscription(): Promise<void> {
    try {
      await this.unsubscribe();
    } catch (error) {
      console.error('Failed to disable auto-subscription:', error);
      throw error;
    }
  }

  // Utility Methods
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }

  // Service Worker Message Handling
  private setupServiceWorkerMessageHandler(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'NOTIFICATION_CLICKED':
          this.handleNotificationClick(data);
          break;
        case 'NOTIFICATION_CLOSED':
          this.handleNotificationClose(data);
          break;
        default:
          console.log('Unknown service worker message:', type, data);
      }
    });
  }

  private handleNotificationClick(data: any): void {
    console.log('Notification clicked:', data);
    
    // Track click event
    this.trackNotificationEvent('clicked', data.notificationId);
    
    // Handle action
    if (data.action) {
      this.handleNotificationAction(data.action, data);
    } else if (data.actionUrl) {
      window.open(data.actionUrl, '_blank');
    }
  }

  private handleNotificationClose(data: any): void {
    console.log('Notification closed:', data);
    
    // Track close event
    this.trackNotificationEvent('closed', data.notificationId);
  }

  private handleNotificationAction(action: string, data: any): void {
    switch (action) {
      case 'view':
      case 'view_portfolio':
        window.open('/portfolio', '_blank');
        break;
      case 'manage_alerts':
        window.open('/settings?tab=notifications', '_blank');
        break;
      case 'review_activity':
        window.open('/security', '_blank');
        break;
      case 'secure_account':
        window.open('/security/protect', '_blank');
        break;
      case 'dismiss':
        // Just close, no action needed
        break;
      default:
        console.log('Unknown notification action:', action);
    }
  }

  private async trackNotificationEvent(event: 'clicked' | 'closed', notificationId?: string): Promise<void> {
    try {
      await fetch(`${this.apiBaseUrl}/push/track-event`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event,
          notificationId,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to track notification event:', error);
    }
  }

  // Cleanup
  destroy(): void {
    this.subscription = null;
    this.registration = null;
    this.isInitialized = false;
  }
}

// Create and export singleton instance
export const pushNotificationService = new PushNotificationService();
export default PushNotificationService;