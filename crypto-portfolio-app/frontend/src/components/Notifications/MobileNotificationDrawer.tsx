import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Bell, X, Check, Trash2, Settings, Filter, Search, ChevronDown, AlertCircle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useSwipe } from '../../hooks/useSwipe';
import { useTouch } from '../../hooks/useTouch';
import NavigationDrawer from '../Mobile/NavigationDrawer';
import { formatDate, formatCurrency, formatPercentage } from '../../utils/formatters';

interface Notification {
  id: string;
  type: 'price_alert' | 'portfolio_update' | 'news' | 'transaction' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionable: boolean;
  data?: {
    symbol?: string;
    price?: number;
    change?: number;
    transactionId?: string;
    url?: string;
  };
}

interface MobileNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onNotificationMarkRead?: (notificationId: string) => void;
  onNotificationDelete?: (notificationId: string) => void;
  onMarkAllRead?: () => void;
  onClearAll?: () => void;
  onSettingsClick?: () => void;
  loading?: boolean;
  className?: string;
}

type NotificationFilter = 'all' | 'unread' | 'price_alert' | 'portfolio_update' | 'news' | 'transaction' | 'system';

const MobileNotificationDrawer: React.FC<MobileNotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
  onNotificationMarkRead,
  onNotificationDelete,
  onMarkAllRead,
  onClearAll,
  onSettingsClick,
  loading = false,
  className = ''
}) => {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [swipeStates, setSwipeStates] = useState<{ [key: string]: number }>({});
  
  const { isMobile, isTablet } = useResponsive();
  const isTouchDevice = isMobile || isTablet;

  // Filter notifications based on selected filter and search
  const filteredNotifications = React.useMemo(() => {
    let filtered = notifications;

    // Apply filter
    if (filter !== 'all') {
      if (filter === 'unread') {
        filtered = filtered.filter(n => !n.read);
      } else {
        filtered = filtered.filter(n => n.type === filter);
      }
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query) ||
        (n.data?.symbol && n.data.symbol.toLowerCase().includes(query))
      );
    }

    // Sort by timestamp (newest first) and priority
    return filtered.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp;
    });
  }, [notifications, filter, searchQuery]);

  // Create swipe handlers for each notification
  const createSwipeHandlers = useCallback((notificationId: string) => {
    if (!isTouchDevice) return {};

    return useSwipe({
      threshold: 50,
      onSwipeMove: (point, delta) => {
        const maxSwipe = 80;
        const swipeAmount = Math.max(-maxSwipe, Math.min(maxSwipe, delta.x));
        setSwipeStates(prev => ({ ...prev, [notificationId]: swipeAmount }));
      },
      onSwipe: (direction, distance) => {
        if (direction === 'right' && distance > 50) {
          // Mark as read
          onNotificationMarkRead?.(notificationId);
        } else if (direction === 'left' && distance > 50) {
          // Delete
          onNotificationDelete?.(notificationId);
        }
        
        // Reset swipe state
        setTimeout(() => {
          setSwipeStates(prev => ({ ...prev, [notificationId]: 0 }));
        }, 200);
      },
      onSwipeEnd: () => {
        // Reset swipe state if not fully swiped
        setTimeout(() => {
          setSwipeStates(prev => ({ ...prev, [notificationId]: 0 }));
        }, 200);
      }
    });
  }, [isTouchDevice, onNotificationMarkRead, onNotificationDelete]);

  const handleNotificationClick = useCallback((notification: Notification, event?: React.MouseEvent) => {
    event?.stopPropagation();
    
    // Mark as read if not already read
    if (!notification.read) {
      onNotificationMarkRead?.(notification.id);
    }
    
    onNotificationClick?.(notification);
  }, [onNotificationClick, onNotificationMarkRead]);

  const handleSelectNotification = useCallback((notificationId: string) => {
    setSelectedNotifications(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(notificationId)) {
        newSelected.delete(notificationId);
      } else {
        newSelected.add(notificationId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
    }
  }, [selectedNotifications.size, filteredNotifications]);

  const getNotificationIcon = (type: Notification['type'], data?: Notification['data']) => {
    switch (type) {
      case 'price_alert':
        if (data?.change && data.change > 0) {
          return <TrendingUp size={20} className="text-green-600" />;
        } else if (data?.change && data.change < 0) {
          return <TrendingDown size={20} className="text-red-600" />;
        }
        return <AlertCircle size={20} className="text-yellow-600" />;
      case 'portfolio_update':
        return <DollarSign size={20} className="text-blue-600" />;
      case 'transaction':
        return <DollarSign size={20} className="text-purple-600" />;
      case 'news':
        return <Bell size={20} className="text-gray-600" />;
      case 'system':
        return <Settings size={20} className="text-gray-600" />;
      default:
        return <Bell size={20} className="text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-gray-500 bg-gray-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NavigationDrawer
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      width="100%"
      className={className}
    >
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Bell size={24} className="text-gray-900" />
              <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-5 text-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {onSettingsClick && (
                <button
                  onClick={onSettingsClick}
                  className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-target"
                  aria-label="Notification settings"
                >
                  <Settings size={20} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-target"
                aria-label="Close notifications"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm touch-target"
            />
          </div>

          {/* Filter and actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target text-sm"
                >
                  <Filter size={14} />
                  <span className="capitalize">{filter}</span>
                  <ChevronDown size={14} />
                </button>

                {showFilterMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-40">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'unread', label: 'Unread' },
                      { value: 'price_alert', label: 'Price Alerts' },
                      { value: 'portfolio_update', label: 'Portfolio' },
                      { value: 'transaction', label: 'Transactions' },
                      { value: 'news', label: 'News' },
                      { value: 'system', label: 'System' }
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => {
                          setFilter(value as NotificationFilter);
                          setShowFilterMenu(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 active:bg-gray-100 first:rounded-t-lg last:rounded-b-lg touch-target ${
                          filter === value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedNotifications.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedNotifications.size} selected
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 && onMarkAllRead && (
                <button
                  onClick={onMarkAllRead}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium touch-target"
                >
                  Mark all read
                </button>
              )}
              
              {selectedNotifications.size > 0 && onClearAll && (
                <button
                  onClick={() => {
                    selectedNotifications.forEach(id => onNotificationDelete?.(id));
                    setSelectedNotifications(new Set());
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium touch-target"
                >
                  Delete selected
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="p-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-start space-x-3 p-3">
                      <div className="w-5 h-5 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Bell size={48} className="text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications</h3>
                <p className="text-gray-600">
                  {searchQuery ? 'No notifications match your search' : 'You\'re all caught up!'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="pb-safe">
                {filteredNotifications.map((notification) => {
                  const swipeAmount = swipeStates[notification.id] || 0;
                  const swipeHandlers = createSwipeHandlers(notification.id);

                  return (
                    <div
                      key={notification.id}
                      className="relative overflow-hidden"
                      {...swipeHandlers}
                    >
                      {/* Swipe action indicators */}
                      {Math.abs(swipeAmount) > 20 && (
                        <div className="absolute inset-0 flex">
                          {swipeAmount > 20 && (
                            <div className="flex items-center justify-center w-20 bg-green-500">
                              <Check size={20} className="text-white" />
                            </div>
                          )}
                          {swipeAmount < -20 && (
                            <div className="flex items-center justify-center w-20 bg-red-500 ml-auto">
                              <Trash2 size={20} className="text-white" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notification content */}
                      <div
                        className={`relative bg-white transition-transform duration-200 ${
                          !notification.read ? `border-l-4 ${getPriorityColor(notification.priority)}` : 'border-l-4 border-l-transparent'
                        }`}
                        style={{
                          transform: isTouchDevice ? `translateX(${swipeAmount}px)` : undefined
                        }}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-start space-x-3">
                            {/* Selection checkbox */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectNotification(notification.id);
                              }}
                              className="mt-1 touch-target"
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                selectedNotifications.has(notification.id)
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300 hover:border-gray-400'
                              }`}>
                                {selectedNotifications.has(notification.id) && (
                                  <Check size={14} className="text-white" />
                                )}
                              </div>
                            </button>

                            {/* Notification icon */}
                            <div className="flex-shrink-0 mt-1">
                              {getNotificationIcon(notification.type, notification.data)}
                            </div>

                            {/* Notification content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h4 className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'} truncate`}>
                                    {notification.title}
                                  </h4>
                                  
                                  {notification.data?.symbol && (
                                    <div className="flex items-center mt-1 text-xs text-gray-600">
                                      <span className="font-medium">{notification.data.symbol}</span>
                                      {notification.data.price && (
                                        <span className="ml-2">{formatCurrency(notification.data.price)}</span>
                                      )}
                                      {notification.data.change && (
                                        <span className={`ml-2 ${notification.data.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {notification.data.change >= 0 ? '+' : ''}{formatPercentage(notification.data.change)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center space-x-2 ml-3">
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {formatDate(notification.timestamp, 'relative')}
                                  </span>
                                  
                                  {!notification.read && (
                                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                  )}
                                </div>
                              </div>

                              <p className={`mt-1 text-sm ${!notification.read ? 'text-gray-700' : 'text-gray-600'} line-clamp-2`}>
                                {notification.message}
                              </p>

                              {notification.actionable && (
                                <div className="mt-2">
                                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                                    Take Action
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-col space-y-1">
                              {!notification.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNotificationMarkRead?.(notification.id);
                                  }}
                                  className="p-1 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors touch-target"
                                  aria-label="Mark as read"
                                >
                                  <Check size={16} className="text-gray-600" />
                                </button>
                              )}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNotificationDelete?.(notification.id);
                                }}
                                className="p-1 rounded hover:bg-gray-200 active:bg-gray-300 transition-colors touch-target"
                                aria-label="Delete notification"
                              >
                                <Trash2 size={16} className="text-gray-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Instructions for mobile gestures */}
        {isTouchDevice && filteredNotifications.length > 0 && (
          <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-200">
            <div className="text-xs text-gray-600 text-center">
              Swipe right to mark as read • Swipe left to delete
            </div>
          </div>
        )}
      </div>
    </NavigationDrawer>
  );
};

export default MobileNotificationDrawer;