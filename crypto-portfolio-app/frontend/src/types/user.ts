export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  timezone: string;
  language: string;
  country?: string;
  memberSince: Date;
  lastLogin?: Date;
  phoneNumber?: string;
  bio?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  role: 'ADMIN' | 'PREMIUM' | 'BASIC';
}

export interface UserPreferences {
  id: string;
  userId: string;
  baseCurrency: string;
  theme: 'light' | 'dark' | 'auto';
  dashboardLayout: {
    widgets: string[];
    positions: Record<string, { x: number; y: number; w: number; h: number }>;
  };
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
    security: boolean;
    portfolio: boolean;
    priceAlerts: boolean;
    newsUpdates: boolean;
  };
  privacySettings: {
    portfolioPublic: boolean;
    showEmail: boolean;
    allowAnalytics: boolean;
    shareDataWithPartners: boolean;
  };
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  language: string;
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

export interface TrustedDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  lastSeen: Date;
  trustedAt: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface SecuritySettings {
  id: string;
  userId: string;
  twoFactorEnabled: boolean;
  backupCodesGenerated: boolean;
  backupCodesUsed: number;
  passwordLastChanged: Date;
  sessionTimeout: number; // minutes
  ipWhitelist: string[];
  loginNotifications: boolean;
  suspiciousActivityAlerts: boolean;
  deviceTrustRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceId?: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    city?: string;
    country?: string;
    coordinates?: [number, number];
  };
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface OnboardingProgress {
  id: string;
  userId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  isCompleted: boolean;
  skippedSteps: string[];
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserStats {
  totalPortfolioValue: number;
  totalProfit: number;
  totalLoss: number;
  bestPerformingAsset: string;
  worstPerformingAsset: string;
  totalTransactions: number;
  averageTransactionSize: number;
  riskScore: number;
  diversificationScore: number;
  joinDate: Date;
  lastActivity: Date;
}

// Request/Response types
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  country?: string;
}

export interface UpdatePreferencesRequest {
  baseCurrency?: string;
  theme?: 'light' | 'dark' | 'auto';
  notifications?: Partial<UserPreferences['notifications']>;
  privacySettings?: Partial<UserPreferences['privacySettings']>;
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  language?: string;
  timezone?: string;
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat?: '12h' | '24h';
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
  reason?: string;
  feedback?: string;
}

export interface ExportDataRequest {
  format: 'json' | 'csv' | 'pdf';
  includeTransactions: boolean;
  includePortfolio: boolean;
  includePreferences: boolean;
  includeAuditLogs: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface AuditLogFilter {
  startDate?: Date;
  endDate?: Date;
  actions?: string[];
  resources?: string[];
  success?: boolean;
  limit?: number;
  offset?: number;
}

// Avatar upload types
export interface AvatarUploadRequest {
  file: File;
  cropData?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AvatarUploadResponse {
  avatarUrl: string;
  thumbnailUrl?: string;
}

// Currency and locale types
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag?: string;
  popular?: boolean;
}

export interface Timezone {
  id: string;
  name: string;
  offset: string;
  country?: string;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
}

// Validation schemas (for Zod)
export interface UserProfileValidation {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  bio?: string;
  timezone: string;
  language: string;
  country?: string;
}

export interface PreferencesValidation {
  baseCurrency: string;
  theme: 'light' | 'dark' | 'auto';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  language: string;
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
}

// Component props types
export interface UserComponentProps {
  user: UserProfile;
  preferences: UserPreferences;
  onUpdate?: (data: any) => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface SecurityComponentProps {
  user: UserProfile;
  securitySettings: SecuritySettings;
  onUpdate?: (data: any) => void;
  isLoading?: boolean;
  error?: string | null;
}