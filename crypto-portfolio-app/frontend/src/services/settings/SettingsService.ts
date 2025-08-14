import { 
  UserSettings, 
  SettingsValidationResult, 
  SettingsValidationError,
  SettingsExportData 
} from '../../types/settings.types';

class SettingsService {
  private readonly STORAGE_KEY = 'userSettings';
  private readonly API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

  private defaultSettings: UserSettings = {
    general: {
      username: '',
      email: '',
      profilePicture: null,
      enableTwoFactor: false,
      phoneNumber: '',
      country: '',
      bio: ''
    },
    display: {
      theme: 'light',
      customColors: {
        primary: '#007bff',
        accent: '#28a745',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
      },
      language: 'en',
      currency: 'USD',
      dateFormat: 'MM/dd/yyyy',
      numberFormat: 'standard',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      fontSize: 14,
      defaultView: 'grid',
      cardsPerRow: 3,
      showSparklines: true,
      showPercentageChanges: true,
      showMarketCap: true,
      animateChanges: true,
      compactMode: false,
      showTooltips: true
    },
    notifications: {
      email: {
        priceAlerts: true,
        portfolioSummary: true,
        tradingUpdates: true,
        securityAlerts: true,
        newsUpdates: false,
        marketAnalysis: false
      },
      push: {
        priceAlerts: true,
        tradingUpdates: false,
        securityAlerts: true,
        newsUpdates: false
      },
      inApp: {
        priceAlerts: true,
        tradingUpdates: true,
        newsUpdates: true,
        systemUpdates: true,
        soundEnabled: true,
        vibrationEnabled: false
      },
      frequency: {
        priceAlerts: 'instant',
        portfolioSummary: 'daily',
        newsUpdates: 'daily'
      }
    },
    security: {
      sessionTimeout: 30,
      enableBiometric: false,
      requirePasswordForTrades: true,
      allowedIPs: [],
      enableLoginNotifications: true,
      enableDeviceTracking: true,
      autoLogoutOnInactivity: true,
      enableEncryption: true
    },
    data: {
      enableAnalytics: false,
      shareAnonymousData: false,
      autoBackup: true,
      backupFrequency: 'daily',
      dataRetentionDays: 365,
      exportFormat: 'json',
      includeHistoricalData: true,
      enableCache: true,
      cacheSize: 100
    },
    apiKeys: [],
    version: '1.0.0',
    lastUpdated: new Date()
  };

  async getSettings(): Promise<UserSettings> {
    try {
      // Try to fetch from server first
      const response = await fetch(`${this.API_BASE_URL}/user/settings`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const serverSettings = await response.json();
        const mergedSettings = this.mergeWithDefaults(serverSettings);
        
        // Save to localStorage as backup
        this.saveToLocalStorage(mergedSettings);
        
        // Apply settings immediately
        this.applySettings(mergedSettings);
        
        return mergedSettings;
      }
    } catch (error) {
      console.warn('Failed to fetch settings from server, using local storage:', error);
    }

    // Fallback to localStorage
    return this.getFromLocalStorage();
  }

  async saveSettings(settings: UserSettings): Promise<boolean> {
    try {
      // Validate settings before saving
      const validation = this.validateSettings(settings);
      if (!validation.isValid) {
        console.error('Settings validation failed:', validation.errors);
        throw new Error(`Invalid settings: ${validation.errors[0]?.message}`);
      }

      // Update timestamp
      const settingsToSave = {
        ...settings,
        lastUpdated: new Date()
      };

      // Try to save to server
      try {
        const response = await fetch(`${this.API_BASE_URL}/user/settings`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.getAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settingsToSave)
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
      } catch (serverError) {
        console.warn('Failed to save to server, saving locally only:', serverError);
      }

      // Always save to localStorage as backup
      this.saveToLocalStorage(settingsToSave);
      
      // Apply settings immediately
      this.applySettings(settingsToSave);
      
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  getDefaultSettings(): UserSettings {
    return JSON.parse(JSON.stringify(this.defaultSettings));
  }

  validateSettings(settings: UserSettings): SettingsValidationResult {
    const errors: SettingsValidationError[] = [];

    try {
      // Validate general settings
      if (!settings.general) {
        errors.push({ field: 'general', message: 'General settings are required', code: 'REQUIRED' });
      } else {
        if (!settings.general.username || settings.general.username.trim().length === 0) {
          errors.push({ field: 'general.username', message: 'Username is required', code: 'REQUIRED' });
        }
        
        if (settings.general.username && settings.general.username.length > 30) {
          errors.push({ field: 'general.username', message: 'Username must be 30 characters or less', code: 'MAX_LENGTH' });
        }

        if (!settings.general.email || !this.isValidEmail(settings.general.email)) {
          errors.push({ field: 'general.email', message: 'Valid email is required', code: 'INVALID_EMAIL' });
        }
      }

      // Validate display settings
      if (!settings.display) {
        errors.push({ field: 'display', message: 'Display settings are required', code: 'REQUIRED' });
      } else {
        if (!['light', 'dark', 'auto'].includes(settings.display.theme)) {
          errors.push({ field: 'display.theme', message: 'Invalid theme selection', code: 'INVALID_VALUE' });
        }

        if (settings.display.fontSize < 12 || settings.display.fontSize > 20) {
          errors.push({ field: 'display.fontSize', message: 'Font size must be between 12 and 20', code: 'OUT_OF_RANGE' });
        }

        if (settings.display.cardsPerRow < 2 || settings.display.cardsPerRow > 5) {
          errors.push({ field: 'display.cardsPerRow', message: 'Cards per row must be between 2 and 5', code: 'OUT_OF_RANGE' });
        }
      }

      // Validate security settings
      if (!settings.security) {
        errors.push({ field: 'security', message: 'Security settings are required', code: 'REQUIRED' });
      } else {
        if (settings.security.sessionTimeout < 5 || settings.security.sessionTimeout > 1440) {
          errors.push({ field: 'security.sessionTimeout', message: 'Session timeout must be between 5 and 1440 minutes', code: 'OUT_OF_RANGE' });
        }

        // Validate IP addresses
        if (settings.security.allowedIPs) {
          for (const ip of settings.security.allowedIPs) {
            if (!this.isValidIP(ip)) {
              errors.push({ field: 'security.allowedIPs', message: `Invalid IP address: ${ip}`, code: 'INVALID_IP' });
            }
          }
        }
      }

      // Validate data settings
      if (!settings.data) {
        errors.push({ field: 'data', message: 'Data settings are required', code: 'REQUIRED' });
      } else {
        if (settings.data.cacheSize < 50 || settings.data.cacheSize > 1000) {
          errors.push({ field: 'data.cacheSize', message: 'Cache size must be between 50 and 1000 MB', code: 'OUT_OF_RANGE' });
        }

        if (settings.data.dataRetentionDays !== -1 && (settings.data.dataRetentionDays < 30 || settings.data.dataRetentionDays > 3650)) {
          errors.push({ field: 'data.dataRetentionDays', message: 'Data retention must be between 30 and 3650 days, or -1 for forever', code: 'OUT_OF_RANGE' });
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'validation', message: 'Settings validation failed', code: 'VALIDATION_ERROR' }]
      };
    }
  }

  applySettings(settings: UserSettings) {
    try {
      const root = document.documentElement;

      // Apply theme and colors
      if (settings.display?.theme) {
        root.setAttribute('data-theme', settings.display.theme);
      }

      if (settings.display?.customColors) {
        Object.entries(settings.display.customColors).forEach(([key, value]) => {
          root.style.setProperty(`--${key}-color`, value);
        });
      }

      // Apply font size
      if (settings.display?.fontSize) {
        root.style.setProperty('--base-font-size', `${settings.display.fontSize}px`);
      }

      // Apply language
      if (settings.display?.language) {
        root.setAttribute('lang', settings.display.language);
      }

      // Apply compact mode
      if (settings.display?.compactMode) {
        root.classList.add('compact-mode');
      } else {
        root.classList.remove('compact-mode');
      }
    } catch (error) {
      console.error('Failed to apply settings:', error);
    }
  }

  exportSettings(settings: UserSettings) {
    const exportData: SettingsExportData = {
      version: '1.0.0',
      exportDate: new Date(),
      settings: settings,
      metadata: {
        appVersion: process.env.REACT_APP_VERSION || '1.0.0',
        platform: navigator.platform,
        userAgent: navigator.userAgent
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crypto-portfolio-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  importSettings(data: string | SettingsExportData): UserSettings {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      let settingsToImport: UserSettings;
      
      if (parsed.version && parsed.settings) {
        // New format with metadata
        settingsToImport = parsed.settings;
      } else {
        // Direct settings object (legacy format)
        settingsToImport = parsed;
      }

      // Merge with defaults to ensure all required fields exist
      const mergedSettings = this.mergeWithDefaults(settingsToImport);
      
      // Validate imported settings
      const validation = this.validateSettings(mergedSettings);
      if (!validation.isValid) {
        throw new Error(`Invalid settings file: ${validation.errors[0]?.message}`);
      }

      return mergedSettings;
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error('Invalid settings file format');
    }
  }

  // Private methods
  private getFromLocalStorage(): UserSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const settings = this.mergeWithDefaults(parsed);
        this.applySettings(settings);
        return settings;
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }

    const defaultSettings = this.getDefaultSettings();
    this.applySettings(defaultSettings);
    return defaultSettings;
  }

  private saveToLocalStorage(settings: UserSettings) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }

  private mergeWithDefaults(userSettings: Partial<UserSettings>): UserSettings {
    const defaults = this.getDefaultSettings();
    
    return {
      ...defaults,
      ...userSettings,
      general: { ...defaults.general, ...userSettings.general },
      display: { 
        ...defaults.display, 
        ...userSettings.display,
        customColors: { ...defaults.display.customColors, ...userSettings.display?.customColors }
      },
      notifications: {
        ...defaults.notifications,
        ...userSettings.notifications,
        email: { ...defaults.notifications.email, ...userSettings.notifications?.email },
        push: { ...defaults.notifications.push, ...userSettings.notifications?.push },
        inApp: { ...defaults.notifications.inApp, ...userSettings.notifications?.inApp },
        frequency: { ...defaults.notifications.frequency, ...userSettings.notifications?.frequency }
      },
      security: { ...defaults.security, ...userSettings.security },
      data: { ...defaults.data, ...userSettings.data },
      apiKeys: userSettings.apiKeys || defaults.apiKeys,
      version: userSettings.version || defaults.version,
      lastUpdated: userSettings.lastUpdated ? new Date(userSettings.lastUpdated) : new Date()
    };
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidIP(ip: string): boolean {
    const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }
}

export const settingsService = new SettingsService();