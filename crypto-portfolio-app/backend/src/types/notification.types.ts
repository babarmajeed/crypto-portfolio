export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  tags?: string[];
  trackingSettings?: {
    clickTracking?: boolean;
    openTracking?: boolean;
    subscriptionTracking?: boolean;
  };
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  type?: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

export interface EmailLog {
  id: string;
  to: string;
  from: string;
  subject: string;
  template?: string;
  status: EmailStatus;
  messageId?: string;
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum EmailStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  OPENED = 'OPENED',
  CLICKED = 'CLICKED',
  BOUNCED = 'BOUNCED',
  FAILED = 'FAILED',
  SPAM = 'SPAM',
  UNSUBSCRIBED = 'UNSUBSCRIBED'
}

export interface SMSOptions {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string[];
  statusCallback?: string;
}

export interface SMSLog {
  id: string;
  to: string;
  from: string;
  body: string;
  status: SMSStatus;
  messageId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
  price?: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum SMSStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  UNDELIVERED = 'UNDELIVERED'
}

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: PushNotificationAction[];
  tag?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  silent?: boolean;
  timestamp?: number;
  vibrate?: number[];
}

export interface PushNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  email: {
    enabled: boolean;
    priceAlerts: boolean;
    portfolioSummary: boolean;
    transactionConfirmations: boolean;
    securityAlerts: boolean;
    marketing: boolean;
    frequency: NotificationFrequency;
  };
  push: {
    enabled: boolean;
    priceAlerts: boolean;
    portfolioUpdates: boolean;
    transactionAlerts: boolean;
    securityAlerts: boolean;
  };
  sms: {
    enabled: boolean;
    criticalAlerts: boolean;
    priceAlerts: boolean;
    securityAlerts: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export enum NotificationFrequency {
  IMMEDIATE = 'IMMEDIATE',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY'
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: string[];
  category: TemplateCategory;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum TemplateCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  TRANSACTION = 'TRANSACTION',
  ALERT = 'ALERT',
  REPORT = 'REPORT',
  MARKETING = 'MARKETING',
  SYSTEM = 'SYSTEM'
}

export interface NotificationJob {
  type: NotificationType;
  userId: string;
  channel: NotificationChannel;
  data: any;
  priority: JobPriority;
  scheduledFor?: Date;
  attempts?: number;
  lastError?: string;
}

export enum NotificationType {
  WELCOME = 'WELCOME',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PRICE_ALERT = 'PRICE_ALERT',
  PORTFOLIO_SUMMARY = 'PORTFOLIO_SUMMARY',
  TRANSACTION_CONFIRMATION = 'TRANSACTION_CONFIRMATION',
  SECURITY_ALERT = 'SECURITY_ALERT',
  REBALANCING_SUGGESTION = 'REBALANCING_SUGGESTION',
  TWO_FACTOR_CODE = 'TWO_FACTOR_CODE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED'
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP'
}

export enum JobPriority {
  LOW = 0,
  MEDIUM = 5,
  HIGH = 10,
  CRITICAL = 20
}

export interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp';
  sendgrid?: {
    apiKey: string;
    from: string;
    replyTo?: string;
  };
  ses?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    from: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
  };
  rateLimit: {
    maxPerSecond: number;
    maxPerMinute: number;
    maxPerHour: number;
  };
}

export interface SMSConfig {
  provider: 'twilio' | 'aws-sns';
  twilio?: {
    accountSid: string;
    authToken: string;
    from: string;
  };
  sns?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  rateLimit: {
    maxPerMinute: number;
    maxPerHour: number;
  };
}

export interface PushConfig {
  vapidKeys: {
    publicKey: string;
    privateKey: string;
  };
  gcm?: {
    apiKey: string;
  };
  apn?: {
    key: string;
    keyId: string;
    teamId: string;
  };
  ttl: number;
}

export interface NotificationMetrics {
  email: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
  };
  sms: {
    sent: number;
    delivered: number;
    failed: number;
  };
  push: {
    sent: number;
    delivered: number;
    clicked: number;
    failed: number;
  };
  timestamp: Date;
}