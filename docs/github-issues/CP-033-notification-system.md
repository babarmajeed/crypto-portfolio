# CP-033: Comprehensive Notification System

## Overview
Build a multi-channel notification system that delivers price alerts, portfolio updates, and system notifications through in-app notifications, email, and push notifications with intelligent filtering and priority management.

## Objectives
- Implement in-app notification center with real-time updates
- Build email notification system with templates
- Add push notification support for mobile devices
- Create intelligent notification filtering and priority system

## Acceptance Criteria
- [ ] In-app notification center with categorization
- [ ] Real-time notification delivery via WebSocket
- [ ] Email notifications with customizable templates
- [ ] Push notifications for mobile devices
- [ ] Price alert system with threshold management
- [ ] Portfolio milestone notifications
- [ ] System and security notifications
- [ ] Notification history and management
- [ ] Do Not Disturb and quiet hours
- [ ] Notification analytics and insights

## Technical Implementation

### File Structure
```
src/
  components/
    Notifications/
      NotificationCenter.jsx
      NotificationItem.jsx
      NotificationFilters.jsx
      NotificationSettings.jsx
      PriceAlertManager.jsx
  hooks/
    useNotifications.js
    usePriceAlerts.js
  services/
    NotificationService.js
    EmailService.js
    PushNotificationService.js
  types/
    notification.types.js
```

### Notification Center Component
```jsx
// NotificationCenter.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import NotificationItem from './NotificationItem';
import NotificationFilters from './NotificationFilters';

const NotificationCenter = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const centerRef = useRef(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    isLoading
  } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (centerRef.current && !centerRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return notification.type === filter;
  });

  const notificationCategories = [
    { id: 'all', name: 'All', count: notifications.length },
    { id: 'unread', name: 'Unread', count: unreadCount },
    { id: 'price_alert', name: 'Price Alerts', count: notifications.filter(n => n.type === 'price_alert').length },
    { id: 'portfolio', name: 'Portfolio', count: notifications.filter(n => n.type === 'portfolio').length },
    { id: 'security', name: 'Security', count: notifications.filter(n => n.type === 'security').length },
    { id: 'system', name: 'System', count: notifications.filter(n => n.type === 'system').length }
  ];

  if (!isOpen) return null;

  return (
    <div className="notification-center-overlay">
      <div className="notification-center" ref={centerRef}>
        <div className="notification-header">
          <div className="header-title">
            <h2>Notifications</h2>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </div>
          
          <div className="header-actions">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="settings-btn"
              title="Notification Settings"
            >
              ⚙️
            </button>
            
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="mark-all-read-btn"
                title="Mark all as read"
              >
                Mark all read
              </button>
            )}
            
            <button
              onClick={onClose}
              className="close-btn"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        <NotificationFilters
          categories={notificationCategories}
          activeFilter={filter}
          onFilterChange={setFilter}
        />

        <div className="notification-list">
          {isLoading ? (
            <div className="notification-loading">
              <div className="loading-spinner"></div>
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="no-notifications">
              <div className="no-notifications-icon">🔔</div>
              <h3>No notifications</h3>
              <p>
                {filter === 'unread' 
                  ? "You're all caught up!" 
                  : "You'll see notifications here when they arrive."}
              </p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="notification-footer">
            <button
              onClick={clearAll}
              className="clear-all-btn"
            >
              Clear All Notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
```

### Notification Item Component
```jsx
// NotificationItem.jsx
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { getNotificationIcon, getNotificationColor } from '../utils/notificationUtils';

const NotificationItem = ({ notification, onMarkAsRead, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(notification.id);
  };

  const handleMarkAsRead = (e) => {
    e.stopPropagation();
    onMarkAsRead(notification.id);
  };

  const formatTimestamp = (timestamp) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  return (
    <div
      className={`notification-item ${!notification.read ? 'unread' : ''} ${getPriorityClass(notification.priority)}`}
      onClick={handleClick}
    >
      <div className="notification-content">
        <div className="notification-icon">
          <span 
            className="icon"
            style={{ color: getNotificationColor(notification.type) }}
          >
            {getNotificationIcon(notification.type)}
          </span>
          {!notification.read && <div className="unread-dot"></div>}
        </div>

        <div className="notification-body">
          <div className="notification-header">
            <h4 className="notification-title">{notification.title}</h4>
            <div className="notification-meta">
              <span className="timestamp">
                {formatTimestamp(notification.timestamp)}
              </span>
              {notification.priority === 'high' && (
                <span className="priority-indicator">❗</span>
              )}
            </div>
          </div>

          <p className="notification-message">{notification.message}</p>

          {notification.data && (
            <div className="notification-data">
              {notification.type === 'price_alert' && (
                <div className="price-alert-data">
                  <span className="asset">{notification.data.asset}</span>
                  <span className={`price ${notification.data.direction === 'up' ? 'positive' : 'negative'}`}>
                    ${notification.data.price}
                  </span>
                  <span className="threshold">
                    Target: ${notification.data.threshold}
                  </span>
                </div>
              )}

              {notification.type === 'portfolio' && notification.data.changePercent && (
                <div className="portfolio-data">
                  <span className={`change ${notification.data.changePercent >= 0 ? 'positive' : 'negative'}`}>
                    {notification.data.changePercent >= 0 ? '+' : ''}
                    {notification.data.changePercent.toFixed(2)}%
                  </span>
                  <span className="value">
                    ${notification.data.currentValue?.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {isExpanded && notification.details && (
            <div className="notification-details">
              <p>{notification.details}</p>
            </div>
          )}

          {notification.actions && notification.actions.length > 0 && (
            <div className="notification-actions">
              {notification.actions.map(action => (
                <button
                  key={action.id}
                  className={`action-btn ${action.type}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.handler();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="notification-controls">
          {!notification.read && (
            <button
              className="mark-read-btn"
              onClick={handleMarkAsRead}
              title="Mark as read"
            >
              ✓
            </button>
          )}
          
          <button
            className="delete-btn"
            onClick={handleDelete}
            title="Delete notification"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
```

### Price Alert Manager Component
```jsx
// PriceAlertManager.jsx
import React, { useState } from 'react';
import { usePriceAlerts } from '../hooks/usePriceAlerts';

const PriceAlertManager = () => {
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({
    asset: '',
    threshold: '',
    direction: 'above',
    frequency: 'once'
  });

  const {
    alerts,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlert,
    isLoading
  } = usePriceAlerts();

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    
    try {
      await createAlert({
        ...newAlert,
        threshold: parseFloat(newAlert.threshold)
      });
      
      setNewAlert({
        asset: '',
        threshold: '',
        direction: 'above',
        frequency: 'once'
      });
      setShowCreateAlert(false);
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  };

  const formatThreshold = (threshold, direction) => {
    return `${direction === 'above' ? '≥' : '≤'} $${threshold.toLocaleString()}`;
  };

  return (
    <div className="price-alert-manager">
      <div className="alert-header">
        <h2>Price Alerts</h2>
        <button
          onClick={() => setShowCreateAlert(true)}
          className="create-alert-btn"
        >
          + Create Alert
        </button>
      </div>

      {showCreateAlert && (
        <div className="create-alert-form">
          <h3>Create New Price Alert</h3>
          <form onSubmit={handleCreateAlert}>
            <div className="form-group">
              <label>Asset</label>
              <input
                type="text"
                value={newAlert.asset}
                onChange={(e) => setNewAlert({ ...newAlert, asset: e.target.value.toUpperCase() })}
                placeholder="e.g., BTC, ETH"
                required
              />
            </div>

            <div className="form-group">
              <label>Price Threshold</label>
              <input
                type="number"
                value={newAlert.threshold}
                onChange={(e) => setNewAlert({ ...newAlert, threshold: e.target.value })}
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Direction</label>
              <select
                value={newAlert.direction}
                onChange={(e) => setNewAlert({ ...newAlert, direction: e.target.value })}
              >
                <option value="above">Above (≥)</option>
                <option value="below">Below (≤)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Frequency</label>
              <select
                value={newAlert.frequency}
                onChange={(e) => setNewAlert({ ...newAlert, frequency: e.target.value })}
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="always">Every time</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" className="create-btn">
                Create Alert
              </button>
              <button
                type="button"
                onClick={() => setShowCreateAlert(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="alerts-list">
        {isLoading ? (
          <div className="loading-state">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            <h3>No price alerts set</h3>
            <p>Create your first alert to get notified when prices hit your target.</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className={`alert-item ${alert.isActive ? 'active' : 'inactive'}`}>
              <div className="alert-info">
                <div className="alert-asset">
                  <img src={alert.assetIcon} alt={alert.asset} className="asset-icon" />
                  <span className="asset-symbol">{alert.asset}</span>
                </div>
                
                <div className="alert-condition">
                  <span className="threshold">
                    {formatThreshold(alert.threshold, alert.direction)}
                  </span>
                  <span className="frequency">• {alert.frequency}</span>
                </div>

                <div className="alert-status">
                  {alert.triggered && (
                    <span className="triggered-badge">Triggered</span>
                  )}
                  <span className="created-date">
                    Created {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="alert-actions">
                <button
                  onClick={() => toggleAlert(alert.id)}
                  className={`toggle-btn ${alert.isActive ? 'active' : 'inactive'}`}
                  title={alert.isActive ? 'Disable alert' : 'Enable alert'}
                >
                  {alert.isActive ? '🔔' : '🔕'}
                </button>
                
                <button
                  onClick={() => deleteAlert(alert.id)}
                  className="delete-btn"
                  title="Delete alert"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PriceAlertManager;
```

### Notification Service
```javascript
// NotificationService.js
class NotificationService {
  constructor() {
    this.notifications = [];
    this.subscribers = new Set();
    this.unreadCount = 0;
    this.websocket = null;
    this.initializeWebSocket();
  }

  initializeWebSocket() {
    if (typeof window !== 'undefined' && 'WebSocket' in window) {
      this.websocket = new WebSocket(process.env.REACT_APP_WS_URL + '/notifications');
      
      this.websocket.onmessage = (event) => {
        const notification = JSON.parse(event.data);
        this.addNotification(notification);
      };

      this.websocket.onclose = () => {
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.initializeWebSocket(), 5000);
      };
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers() {
    this.subscribers.forEach(callback => {
      try {
        callback({
          notifications: this.notifications,
          unreadCount: this.unreadCount
        });
      } catch (error) {
        console.error('Error in notification subscriber:', error);
      }
    });
  }

  async loadNotifications() {
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.notifications = data.notifications;
        this.unreadCount = data.unreadCount;
        this.notifySubscribers();
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  addNotification(notification) {
    // Add to beginning of array for latest-first order
    this.notifications.unshift({
      ...notification,
      id: notification.id || this.generateId(),
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false
    });

    // Keep only last 100 notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }

    this.unreadCount++;
    this.notifySubscribers();

    // Show browser notification if permission granted
    this.showBrowserNotification(notification);

    // Save to local storage for persistence
    this.saveToLocalStorage();
  }

  async markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
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
      this.saveToLocalStorage();
    }
  }

  async markAllAsRead() {
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
    this.saveToLocalStorage();
  }

  async deleteNotification(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index > -1) {
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
      this.saveToLocalStorage();
    }
  }

  async clearAll() {
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
    this.saveToLocalStorage();
  }

  showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: notification.type,
        requireInteraction: notification.priority === 'high'
      });

      browserNotification.onclick = () => {
        window.focus();
        if (notification.actionUrl) {
          window.location.href = notification.actionUrl;
        }
        browserNotification.close();
      };

      // Auto-close after 5 seconds unless high priority
      if (notification.priority !== 'high') {
        setTimeout(() => browserNotification.close(), 5000);
      }
    }
  }

  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  generateId() {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('notifications', JSON.stringify({
        notifications: this.notifications.slice(0, 50), // Save only recent 50
        unreadCount: this.unreadCount
      }));
    } catch (error) {
      console.error('Failed to save notifications to localStorage:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('notifications');
      if (saved) {
        const data = JSON.parse(saved);
        this.notifications = data.notifications || [];
        this.unreadCount = data.unreadCount || 0;
        this.notifySubscribers();
      }
    } catch (error) {
      console.error('Failed to load notifications from localStorage:', error);
    }
  }

  getAuthToken() {
    return localStorage.getItem('authToken');
  }
}

export const notificationService = new NotificationService();
```

## Testing Requirements
- Real-time notification delivery testing
- Browser notification permission handling
- Email notification template testing
- Push notification functionality testing
- Notification persistence and sync testing

## Dependencies
- Depends on: CP-021 (Real-time WebSocket Integration)
- Depends on: CP-032 (Settings and Preferences)
- Blocks: CP-054 (Automated Trading Strategies)

## Time Estimate
**Beginner**: 8-9 days
**Intermediate**: 5-6 days
**Advanced**: 3-4 days

## Required Skills
- WebSocket integration
- Browser notification APIs
- Email service integration
- Push notification services
- Real-time state management