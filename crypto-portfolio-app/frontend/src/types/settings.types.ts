// Settings type definitions for the crypto portfolio application

export interface GeneralSettings {
  username: string;
  email: string;
  profilePicture: string | null;
  enableTwoFactor: boolean;
  phoneNumber?: string;
  country?: string;
  bio?: string;
}

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'auto';
  customColors: {
    primary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
  };
  language: string;
  currency: string;
  dateFormat: string;
  numberFormat: 'standard' | 'european' | 'indian' | 'compact';
  timezone: string;
  fontSize: number;
  defaultView: 'grid' | 'list';
  cardsPerRow: number;
  showSparklines: boolean;
  showPercentageChanges: boolean;
  showMarketCap: boolean;
  animateChanges: boolean;
  compactMode: boolean;
  showTooltips: boolean;
}

export interface NotificationSettings {
  email: {
    priceAlerts: boolean;
    portfolioSummary: boolean;
    tradingUpdates: boolean;
    securityAlerts: boolean;
    newsUpdates: boolean;
    marketAnalysis: boolean;
  };
  push: {
    priceAlerts: boolean;
    tradingUpdates: boolean;
    securityAlerts: boolean;
    newsUpdates: boolean;
  };
  inApp: {
    priceAlerts: boolean;
    tradingUpdates: boolean;
    newsUpdates: boolean;
    systemUpdates: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  };
  frequency: {
    priceAlerts: 'instant' | 'hourly' | 'daily';
    portfolioSummary: 'daily' | 'weekly' | 'monthly';
    newsUpdates: 'instant' | 'hourly' | 'daily';
  };
}

export interface SecuritySettings {
  sessionTimeout: number; // minutes
  enableBiometric: boolean;
  requirePasswordForTrades: boolean;
  allowedIPs: string[];
  enableLoginNotifications: boolean;
  enableDeviceTracking: boolean;
  autoLogoutOnInactivity: boolean;
  enableEncryption: boolean;
}

export interface ApiKeyData {
  id: string;
  exchangeName: string;
  keyName: string;
  apiKey: string;
  secretKey?: string;
  passphrase?: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
}

export interface DataSettings {
  enableAnalytics: boolean;
  shareAnonymousData: boolean;
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  dataRetentionDays: number;
  exportFormat: 'json' | 'csv' | 'xlsx';
  includeHistoricalData: boolean;
  enableCache: boolean;
  cacheSize: number; // MB
}

export interface UserSettings {
  general: GeneralSettings;
  display: DisplaySettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  data: DataSettings;
  apiKeys: ApiKeyData[];
  version: string;
  lastUpdated: Date;
}

export interface SettingsSection {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  displayName: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  isDark: boolean;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isCrypto?: boolean;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export interface DateFormatOption {
  format: string;
  example: string;
  locale: string;
}

export interface NumberFormatOption {
  format: string;
  example: string;
  description: string;
}

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

// Settings validation interfaces
export interface SettingsValidationError {
  field: string;
  message: string;
  code: string;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: SettingsValidationError[];
}

// Settings service interfaces
export interface SettingsBackup {
  version: string;
  createdAt: Date;
  settings: UserSettings;
  checksum: string;
}

export interface SettingsExportData {
  version: string;
  exportDate: Date;
  settings: UserSettings;
  metadata: {
    appVersion: string;
    platform: string;
    userAgent: string;
  };
}

// Hook interfaces
export interface UseSettingsReturn {
  settings: UserSettings | null;
  isLoading: boolean;
  hasUnsavedChanges: boolean;
  updateSettings: (category: keyof UserSettings, updates: Partial<any>) => void;
  saveSettings: () => Promise<boolean>;
  resetSettings: () => Promise<void>;
  exportSettings: () => void;
  importSettings: (data: string | SettingsExportData) => Promise<void>;
  validateSettings: () => SettingsValidationResult;
  refresh: () => Promise<void>;
}

export interface UseThemeReturn {
  themes: ThemeDefinition[];
  currentTheme: ThemeDefinition;
  setTheme: (themeId: string) => void;
  toggleTheme: () => void;
  createCustomTheme: (theme: Partial<ThemeDefinition>) => ThemeDefinition;
  deleteCustomTheme: (themeId: string) => void;
}

// Event interfaces
export interface SettingsChangeEvent {
  category: keyof UserSettings;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export interface ThemeChangeEvent {
  fromTheme: string;
  toTheme: string;
  timestamp: Date;
}

// API interfaces
export interface SettingsApiResponse {
  success: boolean;
  data?: UserSettings;
  message?: string;
  errors?: SettingsValidationError[];
}

export interface SettingsSyncResult {
  success: boolean;
  conflictsResolved: boolean;
  lastSyncTime: Date;
  errors?: string[];
}