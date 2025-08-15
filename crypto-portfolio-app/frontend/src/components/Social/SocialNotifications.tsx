import React, { useState, useEffect } from 'react';
import { 
  FiBell,
  FiX,
  FiUserPlus,
  FiTrendingUp,
  FiTrendingDown,
  FiMessageCircle,
  FiHeart,
  FiCopy,
  FiSettings,
  FiCheck,
  FiClock,
  FiDollarSign
} from 'react-icons/fi';

interface SocialNotification {
  id: string;
  type: 'follower' | 'trade' | 'comment' | 'like' | 'copy_trade' | 'mention' | 'achievement';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  author?: {
    id: string;
    name: string;
    avatar: string;
  };
  tradeData?: {
    asset: string;
    type: 'buy' | 'sell';
    pnl?: number;
    pnlPercentage?: number;
  };
}

interface SocialNotificationsProps {
  notifications: SocialNotification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onNotificationClick: (notification: SocialNotification) => void;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const SocialNotifications: React.FC<SocialNotificationsProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onNotificationClick,
  isOpen,
  onClose,
  className = ''
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'trades' | 'social'>('all');
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follower':
        return <FiUserPlus className="h-5 w-5 text-blue-500" />;
      case 'trade':
        return <FiTrendingUp className="h-5 w-5 text-green-500" />;
      case 'comment':
        return <FiMessageCircle className="h-5 w-5 text-purple-500" />;
      case 'like':
        return <FiHeart className="h-5 w-5 text-red-500" />;
      case 'copy_trade':
        return <FiCopy className="h-5 w-5 text-indigo-500" />;
      case 'mention':
        return <FiMessageCircle className="h-5 w-5 text-orange-500" />;
      case 'achievement':
        return <FiTrendingUp className="h-5 w-5 text-yellow-500" />;
      default:
        return <FiBell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'follower':
        return 'bg-blue-100 dark:bg-blue-900';
      case 'trade':
        return 'bg-green-100 dark:bg-green-900';
      case 'comment':
        return 'bg-purple-100 dark:bg-purple-900';
      case 'like':
        return 'bg-red-100 dark:bg-red-900';
      case 'copy_trade':
        return 'bg-indigo-100 dark:bg-indigo-900';
      case 'mention':
        return 'bg-orange-100 dark:bg-orange-900';
      case 'achievement':
        return 'bg-yellow-100 dark:bg-yellow-900';
      default:
        return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.isRead;
      case 'trades':
        return ['trade', 'copy_trade'].includes(notification.type);
      case 'social':
        return ['follower', 'comment', 'like', 'mention'].includes(notification.type);
      default:
        return true;
    }
  });

  const handleNotificationClick = (notification: SocialNotification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    onNotificationClick(notification);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[80vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FiBell className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={onMarkAllAsRead}
                disabled={unreadCount === 0}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all disabled:opacity-50"
                title="Mark all as read"
              >
                <FiCheck className="h-4 w-4" />
              </button>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'trades', label: 'Trades' },
              { id: 'social', label: 'Social' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`flex-1 py-1 px-3 rounded-md text-sm font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto max-h-96">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <FiBell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No notifications
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === 'unread' ? "You're all caught up!" : 'No notifications found'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                    !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {notification.message}
                          </p>
                          
                          {/* Trade Data */}
                          {notification.tradeData && (
                            <div className="mt-2 flex items-center space-x-2 text-xs">
                              <span className="text-gray-500 dark:text-gray-400">
                                {notification.tradeData.asset}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                notification.tradeData.type === 'buy' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                              }`}>
                                {notification.tradeData.type.toUpperCase()}
                              </span>
                              {notification.tradeData.pnlPercentage !== undefined && (
                                <span className={`font-medium ${
                                  notification.tradeData.pnlPercentage >= 0 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {notification.tradeData.pnlPercentage >= 0 ? '+' : ''}{notification.tradeData.pnlPercentage.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          )}

                          {/* Author */}
                          {notification.author && (
                            <div className="mt-2 flex items-center space-x-2">
                              <img
                                src={notification.author.avatar}
                                alt={notification.author.name}
                                className="w-4 h-4 rounded-full"
                              />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {notification.author.name}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 ml-4">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                              <FiClock className="h-3 w-3" />
                              <span>{formatTime(notification.timestamp)}</span>
                            </div>
                            
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNotification(notification.id);
                            }}
                            className="mt-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                            title="Delete notification"
                          >
                            <FiX className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <button
            onClick={() => {/* Navigate to notification settings */}}
            className="w-full flex items-center justify-center space-x-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <FiSettings className="h-4 w-4" />
            <span>Notification Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Notification Badge Component
interface NotificationBadgeProps {
  count: number;
  onClick: () => void;
  className?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  onClick,
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      className={`relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all ${className}`}
    >
      <FiBell className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};

export default SocialNotifications;