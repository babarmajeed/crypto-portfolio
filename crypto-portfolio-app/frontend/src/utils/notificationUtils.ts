// Notification Utility Functions

import { NotificationType, NotificationPriority, BaseNotification, PriceAlert, NotificationFilter } from '../types/notification.types';

/**
 * Get icon for notification type
 */
export const getNotificationIcon = (type: NotificationType): string => {
  const iconMap: Record<NotificationType, string> = {
    price_alert: '📈',
    portfolio: '💼',
    security: '🔒',
    system: '⚙️',
    trade: '💰',
    milestone: '🎯',
    news: '📰',
    maintenance: '🔧'
  };
  
  return iconMap[type] || '🔔';
};

/**
 * Get color for notification type
 */
export const getNotificationColor = (type: NotificationType): string => {
  const colorMap: Record<NotificationType, string> = {
    price_alert: '#10B981', // Green
    portfolio: '#3B82F6',   // Blue
    security: '#EF4444',    // Red
    system: '#6B7280',      // Gray
    trade: '#8B5CF6',       // Purple
    milestone: '#F59E0B',   // Amber
    news: '#06B6D4',        // Cyan
    maintenance: '#F97316'  // Orange
  };
  
  return colorMap[type] || '#6B7280';
};

/**
 * Get priority color
 */
export const getPriorityColor = (priority: NotificationPriority): string => {
  const colorMap: Record<NotificationPriority, string> = {
    low: '#6B7280',      // Gray
    medium: '#F59E0B',   // Amber
    high: '#EF4444',     // Red
    critical: '#DC2626'  // Dark Red
  };
  
  return colorMap[priority];
};

/**
 * Get priority badge text
 */
export const getPriorityBadge = (priority: NotificationPriority): string => {
  const badgeMap: Record<NotificationPriority, string> = {
    low: '',
    medium: '!',
    high: '!!',
    critical: '!!!'
  };
  
  return badgeMap[priority];
};

/**
 * Format notification timestamp
 */
export const formatNotificationTime = (timestamp: string): string => {
  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ago`;
  } else if (diffInMinutes < 10080) {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days}d ago`;
  } else {
    return notificationTime.toLocaleDateString();
  }
};

/**
 * Format relative time with full context
 */
export const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, seconds] of Object.entries(intervals)) {
    const interval = Math.floor(diffInSeconds / seconds);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'Just now';
};

/**
 * Sort notifications by priority and timestamp
 */
export const sortNotifications = (notifications: BaseNotification[]): BaseNotification[] => {
  const priorityWeight: Record<NotificationPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };
  
  return [...notifications].sort((a, b) => {
    // First sort by read status (unread first)
    if (a.read !== b.read) {
      return a.read ? 1 : -1;
    }
    
    // Then by priority
    const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    
    // Finally by timestamp (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
};

/**
 * Filter notifications based on criteria
 */
export const filterNotifications = (
  notifications: BaseNotification[],
  filter: NotificationFilter
): BaseNotification[] => {
  return notifications.filter(notification => {
    // Filter by type
    if (filter.type && filter.type.length > 0 && !filter.type.includes(notification.type)) {
      return false;
    }
    
    // Filter by priority
    if (filter.priority && filter.priority.length > 0 && !filter.priority.includes(notification.priority)) {
      return false;
    }
    
    // Filter by read status
    if (filter.read !== undefined && notification.read !== filter.read) {
      return false;
    }
    
    // Filter by date range
    if (filter.dateRange) {
      const notificationDate = new Date(notification.timestamp);
      const startDate = new Date(filter.dateRange.start);
      const endDate = new Date(filter.dateRange.end);
      
      if (notificationDate < startDate || notificationDate > endDate) {
        return false;
      }
    }
    
    // Filter by search query
    if (filter.search) {
      const query = filter.search.toLowerCase();
      const searchableText = `${notification.title} ${notification.message} ${notification.details || ''}`.toLowerCase();
      
      if (!searchableText.includes(query)) {
        return false;
      }
    }
    
    return true;
  });
};

/**
 * Group notifications by date
 */
export const groupNotificationsByDate = (notifications: BaseNotification[]): Record<string, BaseNotification[]> => {
  const groups: Record<string, BaseNotification[]> = {};
  
  notifications.forEach(notification => {
    const date = new Date(notification.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let groupKey: string;
    
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
      groupKey = 'This week';
    } else if (date.getTime() > today.getTime() - 30 * 24 * 60 * 60 * 1000) {
      groupKey = 'This month';
    } else {
      groupKey = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    groups[groupKey].push(notification);
  });
  
  return groups;
};

/**
 * Generate notification summary
 */
export const generateNotificationSummary = (notifications: BaseNotification[]): string => {
  if (notifications.length === 0) {
    return 'No notifications';
  }
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const typeCount = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<NotificationType, number>);
  
  const topType = Object.entries(typeCount)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (unreadCount === 0) {
    return 'All caught up!';
  } else if (unreadCount === 1) {
    return '1 unread notification';
  } else if (topType && typeCount[topType[0] as NotificationType] > 1) {
    return `${unreadCount} notifications (${typeCount[topType[0] as NotificationType]} ${topType[0].replace('_', ' ')})`;
  } else {
    return `${unreadCount} unread notifications`;
  }
};

/**
 * Check if notification should be shown based on quiet hours
 */
export const shouldShowNotification = (
  notification: BaseNotification,
  quietHours?: { enabled: boolean; startTime: string; endTime: string; timezone: string; days: number[]; exceptions: NotificationType[] }
): boolean => {
  if (!quietHours || !quietHours.enabled) {
    return true;
  }
  
  // Check if notification type is in exceptions
  if (quietHours.exceptions.includes(notification.type)) {
    return true;
  }
  
  // Check if critical priority bypasses quiet hours
  if (notification.priority === 'critical') {
    return true;
  }
  
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  // Check if current day is in quiet hours days
  if (!quietHours.days.includes(currentDay)) {
    return true;
  }
  
  // Check if current time is within quiet hours
  const startTime = quietHours.startTime;
  const endTime = quietHours.endTime;
  
  if (startTime <= endTime) {
    // Same day range (e.g., 09:00 to 17:00)
    return currentTime < startTime || currentTime > endTime;
  } else {
    // Overnight range (e.g., 22:00 to 06:00)
    return currentTime > endTime && currentTime < startTime;
  }
};

/**
 * Generate notification ID
 */
export const generateNotificationId = (): string => {
  return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate notification object
 */
export const validateNotification = (notification: Partial<BaseNotification>): string[] => {
  const errors: string[] = [];
  
  if (!notification.title || notification.title.trim().length === 0) {
    errors.push('Title is required');
  }
  
  if (!notification.message || notification.message.trim().length === 0) {
    errors.push('Message is required');
  }
  
  if (!notification.type) {
    errors.push('Type is required');
  }
  
  if (!notification.priority) {
    errors.push('Priority is required');
  }
  
  if (notification.title && notification.title.length > 100) {
    errors.push('Title must be 100 characters or less');
  }
  
  if (notification.message && notification.message.length > 500) {
    errors.push('Message must be 500 characters or less');
  }
  
  return errors;
};

/**
 * Create price alert notification
 */
export const createPriceAlertNotification = (
  alert: PriceAlert,
  currentPrice: number
): Omit<BaseNotification, 'id' | 'timestamp'> => {
  const direction = alert.direction === 'above' ? 'above' : 'below';
  const directionSymbol = alert.direction === 'above' ? '📈' : '📉';
  const changePercent = ((currentPrice - alert.threshold) / alert.threshold) * 100;
  
  return {
    type: 'price_alert',
    title: `Price Alert: ${alert.asset}`,
    message: `${alert.asset} has reached $${currentPrice.toLocaleString()} (${direction} your target of $${alert.threshold.toLocaleString()})`,
    priority: 'high',
    read: false,
    data: {
      asset: alert.asset,
      price: currentPrice,
      threshold: alert.threshold,
      direction: alert.direction,
      changePercent
    },
    details: `Alert was triggered at ${new Date().toLocaleString()}. ${directionSymbol} ${Math.abs(changePercent).toFixed(2)}% change from target.`,
    actionUrl: `/portfolio?asset=${alert.asset}`,
    persistent: true
  };
};

/**
 * Create portfolio milestone notification
 */
export const createPortfolioMilestoneNotification = (
  milestone: 'profit' | 'loss' | 'value',
  data: { currentValue: number; previousValue: number; threshold?: number }
): Omit<BaseNotification, 'id' | 'timestamp'> => {
  const changePercent = ((data.currentValue - data.previousValue) / data.previousValue) * 100;
  const isPositive = changePercent >= 0;
  
  let title: string;
  let message: string;
  let priority: NotificationPriority = 'medium';
  
  switch (milestone) {
    case 'profit':
      title = '🎉 Portfolio Milestone Reached!';
      message = `Your portfolio has reached a new profit milestone of $${data.currentValue.toLocaleString()}`;
      priority = 'medium';
      break;
    case 'loss':
      title = '⚠️ Portfolio Alert';
      message = `Your portfolio value has decreased to $${data.currentValue.toLocaleString()}`;
      priority = 'high';
      break;
    case 'value':
      title = isPositive ? '📈 Portfolio Growth' : '📉 Portfolio Update';
      message = `Your portfolio value is now $${data.currentValue.toLocaleString()} (${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
      priority = Math.abs(changePercent) > 10 ? 'high' : 'medium';
      break;
  }
  
  return {
    type: 'portfolio',
    title,
    message,
    priority,
    read: false,
    data: {
      currentValue: data.currentValue,
      previousValue: data.previousValue,
      changePercent,
      threshold: data.threshold
    },
    actionUrl: '/portfolio',
    persistent: milestone === 'loss'
  };
};

/**
 * Debounce function for notification updates
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for high-frequency notifications
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Convert notification to email format
 */
export const convertToEmailFormat = (notification: BaseNotification): {
  subject: string;
  body: string;
  priority: string;
} => {
  const priorityMap: Record<NotificationPriority, string> = {
    low: 'Low',
    medium: 'Normal',
    high: 'High',
    critical: 'Urgent'
  };
  
  let subject = `${getNotificationIcon(notification.type)} ${notification.title}`;
  
  if (notification.priority === 'high' || notification.priority === 'critical') {
    subject = `[${priorityMap[notification.priority]}] ${subject}`;
  }
  
  let body = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: ${getNotificationColor(notification.type)};">${notification.title}</h2>
        <p>${notification.message}</p>
        
        ${notification.details ? `<p><strong>Details:</strong> ${notification.details}</p>` : ''}
        
        ${notification.data ? `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Additional Information:</strong><br>
            ${Object.entries(notification.data)
              .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
              .join('<br>')}
          </div>
        ` : ''}
        
        <p style="color: #666; font-size: 12px;">
          Received: ${new Date(notification.timestamp).toLocaleString()}<br>
          Priority: ${priorityMap[notification.priority]}
        </p>
        
        ${notification.actionUrl ? `
          <p>
            <a href="${notification.actionUrl}" 
               style="background-color: ${getNotificationColor(notification.type)}; 
                      color: white; 
                      padding: 10px 20px; 
                      text-decoration: none; 
                      border-radius: 5px; 
                      display: inline-block;">
              View Details
            </a>
          </p>
        ` : ''}
      </body>
    </html>
  `;
  
  return {
    subject,
    body,
    priority: priorityMap[notification.priority]
  };
};

/**
 * Check if browser supports notifications
 */
export const checkNotificationSupport = (): {
  supported: boolean;
  permission: NotificationPermission | null;
} => {
  if (!('Notification' in window)) {
    return { supported: false, permission: null };
  }
  
  return {
    supported: true,
    permission: Notification.permission
  };
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }
  
  const permission = await Notification.requestPermission();
  return permission;
};

/**
 * Play notification sound
 */
export const playNotificationSound = (soundUrl?: string, volume: number = 0.5): void => {
  try {
    const audio = new Audio(soundUrl || '/sounds/notification.mp3');
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch(error => {
      console.warn('Could not play notification sound:', error);
    });
  } catch (error) {
    console.warn('Error playing notification sound:', error);
  }
};