import React, { useState, useRef, useEffect, useCallback } from 'react';
import useNotifications from '../../hooks/useNotifications';
import { NotificationCenterProps } from '../../types/notification.types';
import NotificationItem from './NotificationItem';
import NotificationFilters from './NotificationFilters';
import NotificationSettings from './NotificationSettings';

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  maxHeight = '600px',
  showSettings = true,
  className = ''
}) => {
  const [filter, setFilter] = useState('all');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const centerRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    isLoading,
    hasMore,
    loadMore,
    searchNotifications
  } = useNotifications();

  // Close notification center when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          // Focus next notification item
          break;
        case 'ArrowUp':
          event.preventDefault();
          // Focus previous notification item
          break;
        case 'Enter':
          event.preventDefault();
          // Activate focused notification
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filter notifications based on current filter and search
  const filteredNotifications = React.useMemo(() => {
    let filtered = notifications;

    // Apply type filter
    if (filter !== 'all') {
      if (filter === 'unread') {
        filtered = filtered.filter(n => !n.read);
      } else {
        filtered = filtered.filter(n => n.type === filter);
      }
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query) ||
        (n.details && n.details.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [notifications, filter, searchQuery]);

  // Notification categories with counts
  const notificationCategories = React.useMemo(() => [
    { id: 'all', name: 'All', count: notifications.length },
    { id: 'unread', name: 'Unread', count: unreadCount },
    { id: 'price_alert', name: 'Price Alerts', count: notifications.filter(n => n.type === 'price_alert').length },
    { id: 'portfolio', name: 'Portfolio', count: notifications.filter(n => n.type === 'portfolio').length },
    { id: 'security', name: 'Security', count: notifications.filter(n => n.type === 'security').length },
    { id: 'system', name: 'System', count: notifications.filter(n => n.type === 'system').length },
    { id: 'trade', name: 'Trades', count: notifications.filter(n => n.type === 'trade').length },
    { id: 'news', name: 'News', count: notifications.filter(n => n.type === 'news').length }
  ], [notifications, unreadCount]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [markAllAsRead]);

  const handleClearAll = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
      try {
        await clearAll();
      } catch (error) {
        console.error('Failed to clear all notifications:', error);
      }
    }
  }, [clearAll]);

  const handleLoadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      try {
        await loadMore();
      } catch (error) {
        console.error('Failed to load more notifications:', error);
      }
    }
  }, [hasMore, isLoading, loadMore]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    searchNotifications(query);
  }, [searchNotifications]);

  if (!isOpen) return null;

  return (
    <div className={`notification-center-overlay ${className}`}>
      <div 
        className="notification-center" 
        ref={centerRef}
        style={{ maxHeight }}
        role="dialog"
        aria-labelledby="notification-center-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="notification-header">
          <div className="header-title">
            <h2 id="notification-center-title">Notifications</h2>
            {unreadCount > 0 && (
              <span className="unread-badge" aria-label={`${unreadCount} unread notifications`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          
          <div className="header-actions">
            {showSettings && (
              <button
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                className={`settings-btn ${showSettingsPanel ? 'active' : ''}`}
                title="Notification Settings"
                aria-label="Open notification settings"
              >
                ⚙️
              </button>
            )}
            
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="mark-all-read-btn"
                title="Mark all as read"
                aria-label="Mark all notifications as read"
                disabled={isLoading}
              >
                Mark all read
              </button>
            )}
            
            <button
              onClick={onClose}
              className="close-btn"
              title="Close"
              aria-label="Close notification center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettingsPanel && (
          <div className="settings-panel">
            <NotificationSettings 
              settings={{}as any}
              onUpdateSettings={() => {}}
              showAdvanced={false}
            />
          </div>
        )}

        {/* Filters */}
        <NotificationFilters
          categories={notificationCategories}
          activeFilter={filter}
          onFilterChange={setFilter}
          showSearch={true}
          onSearch={handleSearch}
          searchQuery={searchQuery}
        />

        {/* Notification List */}
        <div className="notification-list" role="list">
          {isLoading && notifications.length === 0 ? (
            <div className="notification-loading" role="status" aria-live="polite">
              <div className="loading-spinner" aria-hidden="true"></div>
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="no-notifications">
              <div className="no-notifications-icon" aria-hidden="true">🔔</div>
              <h3>No notifications</h3>
              <p>
                {searchQuery ? (
                  <>No notifications match "{searchQuery}"</>
                ) : filter === 'unread' ? (
                  "You're all caught up!"
                ) : (
                  "You'll see notifications here when they arrive."
                )}
              </p>
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="clear-search-btn"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredNotifications.map((notification, index) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                  showActions={true}
                  tabIndex={0}
                />
              ))}
              
              {/* Load More Button */}
              {hasMore && (
                <div className="load-more-container">
                  <button
                    onClick={handleLoadMore}
                    className="load-more-btn"
                    disabled={isLoading}
                    aria-label="Load more notifications"
                  >
                    {isLoading ? (
                      <>
                        <div className="loading-spinner small" aria-hidden="true"></div>
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="notification-footer">
            <div className="footer-stats">
              <span className="total-count">
                {notifications.length} total notifications
              </span>
              {unreadCount > 0 && (
                <span className="unread-count">
                  • {unreadCount} unread
                </span>
              )}
            </div>
            
            <div className="footer-actions">
              <button
                onClick={handleClearAll}
                className="clear-all-btn"
                disabled={isLoading}
                aria-label="Clear all notifications"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;