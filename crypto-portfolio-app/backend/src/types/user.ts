import { UserRole } from '@prisma/client';

export interface UserProfileData {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  timezone?: string;
  language?: string;
  country?: string | null;
}

export interface UserPreferencesData {
  baseCurrency?: string;
  theme?: string;
  dashboardLayout?: Record<string, any>;
  notifications?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
  };
  privacySettings?: {
    portfolio_public?: boolean;
    show_balances?: boolean;
    data_sharing?: boolean;
  };
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
}

export interface TrustedDeviceData {
  deviceFingerprint: string;
  deviceName?: string;
}

export interface AuditLogData {
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserExportData {
  profile: UserProfileData;
  preferences: UserPreferencesData;
  auditLogs: AuditLogData[];
  trustedDevices: TrustedDeviceData[];
  portfolios?: any[];
  transactions?: any[];
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogFilters {
  action?: string;
  resource?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface DeviceInfo {
  fingerprint: string;
  name?: string;
  userAgent?: string;
  lastSeen?: Date;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  trustedDevicesCount: number;
  recentLoginAttempts: number;
  passwordLastChanged: Date;
}

export interface UserProfileUpdate extends UserProfileData {
  id: string;
}

export interface UserPreferencesUpdate extends UserPreferencesData {
  id: string;
}

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';
export type Theme = 'light' | 'dark' | 'auto';

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  priceAlerts?: boolean;
  portfolioUpdates?: boolean;
  newsUpdates?: boolean;
  marketAlerts?: boolean;
}

export interface PrivacySettings {
  portfolio_public: boolean;
  show_balances: boolean;
  data_sharing: boolean;
  analytics_tracking?: boolean;
  marketing_emails?: boolean;
}

export interface DashboardLayout {
  widgets: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    config?: Record<string, any>;
  }>;
  theme_customization?: {
    primary_color?: string;
    sidebar_collapsed?: boolean;
    chart_preferences?: Record<string, any>;
  };
}