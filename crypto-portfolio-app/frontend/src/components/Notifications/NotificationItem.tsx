import React, { useState, useCallback } from 'react';
import { NotificationItemProps, NotificationAction } from '../../types/notification.types';
import { 
  getNotificationIcon, 
  getNotificationColor, 
  formatNotificationTime,
  getPriorityColor 
} from '../../utils/notificationUtils';

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
  onAction,
  compact = false,
  showActions = true,
  ...props
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  const handleClick = useCallback(() => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank', 'noopener,noreferrer');
    } else if (notification.details) {
      setIsExpanded(!isExpanded);
    }
  }, [notification, onMarkAsRead, isExpanded]);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      await onDelete(notification.id);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      setIsDeleting(false);
    }
  }, [notification.id, onDelete, isDeleting]);

  const handleMarkAsRead = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isMarkingRead || notification.read) return;
    
    setIsMarkingRead(true);
    try {
      await onMarkAsRead(notification.id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
    setIsMarkingRead(false);
  }, [notification.id, notification.read, onMarkAsRead, isMarkingRead]);

  const handleActionClick = useCallback((action: NotificationAction, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (onAction) {
      onAction(action);
    } else if (action.handler) {
      action.handler();
    }
  }, [onAction]);

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  const renderNotificationData = () => {
    if (!notification.data) return null;

    switch (notification.type) {
      case 'price_alert':
        return (
          <div className="notification-data price-alert-data">
            <div className="data-row">
              <span className="data-label">Asset:</span>
              <span className="asset-symbol">{notification.data.asset}</span>
            </div>
            <div className="data-row">
              <span className="data-label">Current Price:</span>
              <span className={`price ${notification.data.direction === 'up' ? 'positive' : 'negative'}`}>
                ${notification.data.price?.toLocaleString()}
              </span>
            </div>
            <div className="data-row">
              <span className="data-label">Target:</span>
              <span className="threshold">
                ${notification.data.threshold?.toLocaleString()}
              </span>
            </div>
            {notification.data.changePercent !== undefined && (
              <div className="data-row">
                <span className="data-label">Change:</span>
                <span className={`change-percent ${notification.data.changePercent >= 0 ? 'positive' : 'negative'}`}>
                  {notification.data.changePercent >= 0 ? '+' : ''}
                  {notification.data.changePercent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        );

      case 'portfolio':
        return (
          <div className="notification-data portfolio-data">
            {notification.data.currentValue !== undefined && (
              <div className="data-row">
                <span className="data-label">Current Value:</span>
                <span className="current-value">
                  ${notification.data.currentValue.toLocaleString()}
                </span>
              </div>
            )}
            {notification.data.changePercent !== undefined && (
              <div className="data-row">
                <span className="data-label">Change:</span>
                <span className={`change ${notification.data.changePercent >= 0 ? 'positive' : 'negative'}`}>
                  {notification.data.changePercent >= 0 ? '+' : ''}
                  {notification.data.changePercent.toFixed(2)}%
                </span>
              </div>
            )}
            {notification.data.totalChange !== undefined && (
              <div className="data-row">
                <span className="data-label">Amount:</span>
                <span className={`total-change ${notification.data.totalChange >= 0 ? 'positive' : 'negative'}`}>
                  {notification.data.totalChange >= 0 ? '+' : ''}
                  ${Math.abs(notification.data.totalChange).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        );

      case 'trade':
        return (
          <div className="notification-data trade-data">
            {notification.data.orderType && (
              <div className="data-row">
                <span className="data-label">Type:</span>
                <span className="order-type">{notification.data.orderType}</span>
              </div>
            )}
            {notification.data.amount !== undefined && (
              <div className="data-row">
                <span className="data-label">Amount:</span>
                <span className="amount">${notification.data.amount.toLocaleString()}</span>
              </div>
            )}
            {notification.data.status && (
              <div className="data-row">
                <span className="data-label">Status:</span>
                <span className={`status status-${notification.data.status.toLowerCase()}`}>
                  {notification.data.status}
                </span>
              </div>
            )}
          </div>
        );

      case 'security':
        return (
          <div className="notification-data security-data">
            {notification.data.ipAddress && (
              <div className="data-row">
                <span className="data-label">IP Address:</span>
                <span className="ip-address">{notification.data.ipAddress}</span>
              </div>
            )}
            {notification.data.location && (
              <div className="data-row">
                <span className="data-label">Location:</span>
                <span className="location">{notification.data.location}</span>
              </div>
            )}
            {notification.data.device && (
              <div className="data-row">
                <span className="data-label">Device:</span>
                <span className="device">{notification.data.device}</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`notification-item ${!notification.read ? 'unread' : ''} ${getPriorityClass(notification.priority)} ${compact ? 'compact' : ''} ${isExpanded ? 'expanded' : ''}`}
      onClick={handleClick}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${notification.read ? 'Read' : 'Unread'} notification: ${notification.title}`}
      {...props}
    >
      <div className="notification-content">
        {/* Icon and Indicator */}
        <div className="notification-icon">
          <span 
            className="icon"
            style={{ color: getNotificationColor(notification.type) }}
            aria-hidden="true"
          >
            {getNotificationIcon(notification.type)}
          </span>
          {!notification.read && (
            <div 
              className="unread-dot" 
              aria-label="Unread"
              style={{ backgroundColor: getPriorityColor(notification.priority) }}
            ></div>
          )}
          {notification.priority === 'critical' && (
            <div className="critical-indicator" aria-label="Critical priority">⚠️</div>
          )}
        </div>

        {/* Main Content */}
        <div className="notification-body">
          <div className="notification-header">
            <h4 className="notification-title">{notification.title}</h4>
            <div className="notification-meta">
              <span className="timestamp" title={new Date(notification.timestamp).toLocaleString()}>
                {formatNotificationTime(notification.timestamp)}
              </span>
              {notification.priority === 'high' && (
                <span className="priority-indicator" aria-label="High priority">❗</span>
              )}
              {notification.persistent && (
                <span className="persistent-indicator" aria-label="Persistent notification">📌</span>
              )}
            </div>
          </div>

          <p className="notification-message">{notification.message}</p>

          {/* Data Section */}
          {notification.data && renderNotificationData()}

          {/* Expanded Details */}
          {isExpanded && notification.details && (
            <div className="notification-details">
              <p>{notification.details}</p>
            </div>
          )}

          {/* Action Buttons */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="notification-actions">
              {notification.actions.map(action => (
                <button
                  key={action.id}
                  className={`action-btn ${action.type}`}
                  onClick={(e) => handleActionClick(action, e)}
                  disabled={isDeleting}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Expand/Collapse Indicator */}
          {notification.details && !compact && (
            <button
              className="expand-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              aria-label={isExpanded ? 'Show less details' : 'Show more details'}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Controls */}
        {showActions && (
          <div className="notification-controls">
            {!notification.read && (
              <button
                className="mark-read-btn"
                onClick={handleMarkAsRead}
                title="Mark as read"
                aria-label="Mark as read"
                disabled={isMarkingRead}
              >
                {isMarkingRead ? (
                  <div className="loading-spinner small" aria-hidden="true"></div>
                ) : (
                  '✓'
                )}
              </button>
            )}
            
            <button
              className="delete-btn"
              onClick={handleDelete}
              title="Delete notification"
              aria-label="Delete notification"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="loading-spinner small" aria-hidden="true"></div>
              ) : (
                '🗑️'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Progress bar for persistent notifications */}
      {notification.persistent && notification.expiresAt && (
        <div className="expiry-progress" aria-hidden="true">
          <div 
            className="progress-bar"
            style={{
              width: `${Math.max(0, Math.min(100, 
                (new Date(notification.expiresAt).getTime() - Date.now()) / 
                (24 * 60 * 60 * 1000) * 100
              ))}%`
            }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default NotificationItem;