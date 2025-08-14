// Notification Types and Interfaces

export type NotificationType = 
  | 'price_alert' 
  | 'portfolio' 
  | 'security' 
  | 'system' 
  | 'trade' 
  | 'milestone'
  | 'news'
  | 'maintenance';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationFrequency = 'once' | 'daily' | 'weekly' | 'always';

export type AlertDirection = 'above' | 'below';

export interface NotificationData {
  // Price alert specific data
  asset?: string;
  price?: number;
  threshold?: number;
  direction?: AlertDirection;
  changePercent?: number;
  
  // Portfolio specific data
  currentValue?: number;
  previousValue?: number;
  totalChange?: number;
  percentChange?: number;
  
  // Trade specific data
  tradeId?: string;
  orderType?: string;
  amount?: number;
  status?: string;
  
  // Security specific data
  ipAddress?: string;
  location?: string;
  device?: string;
  
  // General data
  [key: string]: any;
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  handler: () => void;
  url?: string;
}

export interface BaseNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  timestamp: string;
  read: boolean;
  data?: NotificationData;
  details?: string;
  actionUrl?: string;
  actions?: NotificationAction[];
  expiresAt?: string;
  persistent?: boolean;
}

export interface PriceAlert {
  id: string;
  userId: string;
  asset: string;
  assetIcon?: string;
  threshold: number;
  direction: AlertDirection;
  frequency: NotificationFrequency;
  isActive: boolean;
  triggered: boolean;
  triggeredAt?: string;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
  notificationChannels: NotificationChannel[];
}

export interface NotificationSettings {
  enabled: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  types: {
    [K in NotificationType]: {
      enabled: boolean;
      channels: NotificationChannel[];
      priority: NotificationPriority;
      quietHours?: QuietHours;
    };
  };
  quietHours?: QuietHours;
  doNotDisturb: boolean;
  frequency: {
    digest: 'never' | 'daily' | 'weekly';
    realTime: boolean;
  };
  sound: {
    enabled: boolean;
    volume: number;
    customSounds: { [key in NotificationType]?: string };
  };
}

export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  timezone: string;
  days: number[];    // 0-6 (Sunday-Saturday)
  exceptions: NotificationType[]; // Types that bypass quiet hours
}

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms' | 'webhook';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailNotification {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  template?: string;
  variables?: Record<string, any>;
  priority: NotificationPriority;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  size: number;
}

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: PushNotificationAction[];
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
  vibrate?: number[];
}

export interface PushNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationHistory {
  id: string;
  notificationId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'clicked';
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  clickedAt?: string;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface NotificationAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  avgDeliveryTime: number;
  avgReadTime: number;
  channelBreakdown: {
    [K in NotificationChannel]: {
      sent: number;
      delivered: number;
      read: number;
      clicked: number;
      rate: number;
    };
  };
  typeBreakdown: {
    [K in NotificationType]: {
      sent: number;
      delivered: number;
      read: number;
      clicked: number;
      rate: number;
    };
  };
  timeRange: {
    start: string;
    end: string;
  };
}

export interface NotificationFilter {
  type?: NotificationType[];
  priority?: NotificationPriority[];
  read?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'priority' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface NotificationBatch {
  id: string;
  notifications: BaseNotification[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  completedAt?: string;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

// WebSocket message types
export interface WebSocketNotificationMessage {
  type: 'notification' | 'notification_read' | 'notification_deleted' | 'batch_update';
  data: BaseNotification | BaseNotification[] | { id: string } | NotificationBatch;
  timestamp: string;
}

// Hook return types
export interface UseNotificationsReturn {
  notifications: BaseNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  
  // Actions
  loadNotifications: (filter?: NotificationFilter) => Promise<void>;
  addNotification: (notification: Omit<BaseNotification, 'id' | 'timestamp'>) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  
  // Filtering and search
  filterNotifications: (filter: NotificationFilter) => void;
  searchNotifications: (query: string) => void;
}

export interface UsePriceAlertsReturn {
  alerts: PriceAlert[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createAlert: (alert: Omit<PriceAlert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAlert: (alertId: string, updates: Partial<PriceAlert>) => Promise<void>;
  deleteAlert: (alertId: string) => Promise<void>;
  toggleAlert: (alertId: string) => Promise<void>;
  bulkToggle: (alertIds: string[], isActive: boolean) => Promise<void>;
  bulkDelete: (alertIds: string[]) => Promise<void>;
  
  // Utilities
  checkAlerts: () => Promise<void>;
  getTriggeredAlerts: () => PriceAlert[];
  getActiveAlerts: () => PriceAlert[];
}

// Service interfaces
export interface NotificationServiceInterface {
  // Core methods
  loadNotifications(filter?: NotificationFilter): Promise<BaseNotification[]>;
  addNotification(notification: Omit<BaseNotification, 'id' | 'timestamp'>): Promise<BaseNotification>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  deleteNotification(notificationId: string): Promise<void>;
  clearAll(): Promise<void>;
  
  // Settings
  getSettings(): Promise<NotificationSettings>;
  updateSettings(settings: Partial<NotificationSettings>): Promise<void>;
  
  // Analytics
  getAnalytics(timeRange: { start: string; end: string }): Promise<NotificationAnalytics>;
  
  // Templates
  getTemplates(): Promise<NotificationTemplate[]>;
  createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate>;
  updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): Promise<void>;
  deleteTemplate(templateId: string): Promise<void>;
}

export interface EmailServiceInterface {
  sendEmail(notification: EmailNotification): Promise<void>;
  sendBulkEmail(notifications: EmailNotification[]): Promise<void>;
  getTemplates(): Promise<NotificationTemplate[]>;
  renderTemplate(templateId: string, variables: Record<string, any>): Promise<string>;
  validateEmail(email: string): boolean;
  getDeliveryStatus(messageId: string): Promise<NotificationHistory>;
}

export interface PushNotificationServiceInterface {
  sendPushNotification(notification: PushNotification, tokens: string[]): Promise<void>;
  sendBulkPushNotification(notifications: PushNotification[], tokens: string[]): Promise<void>;
  subscribeToTopic(token: string, topic: string): Promise<void>;
  unsubscribeFromTopic(token: string, topic: string): Promise<void>;
  getSubscriptions(token: string): Promise<string[]>;
  validateToken(token: string): Promise<boolean>;
}

// Component props interfaces
export interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  maxHeight?: string;
  showSettings?: boolean;
  className?: string;
}

export interface NotificationItemProps {
  notification: BaseNotification;
  onMarkAsRead: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
  onAction?: (action: NotificationAction) => void;
  compact?: boolean;
  showActions?: boolean;
}

export interface NotificationFiltersProps {
  categories: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
}

export interface PriceAlertManagerProps {
  alerts?: PriceAlert[];
  onCreateAlert?: (alert: Omit<PriceAlert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateAlert?: (alertId: string, updates: Partial<PriceAlert>) => void;
  onDeleteAlert?: (alertId: string) => void;
  showCreateForm?: boolean;
  className?: string;
}

export interface NotificationSettingsProps {
  settings: NotificationSettings;
  onUpdateSettings: (settings: Partial<NotificationSettings>) => void;
  showAdvanced?: boolean;
  className?: string;
}