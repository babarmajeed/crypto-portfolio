# CP-032: User Settings and Preferences Management

## Overview
Create a comprehensive settings management system that allows users to customize their portfolio application experience, manage account preferences, and configure display options.

## Objectives
- Build user-friendly settings interface with categorized options
- Implement theme customization and display preferences
- Add notification and alert configuration
- Create data export/import preferences

## Acceptance Criteria
- [ ] Categorized settings interface (Account, Display, Notifications, etc.)
- [ ] Theme selection (light, dark, auto) with custom color schemes
- [ ] Currency preference settings (USD, EUR, BTC)
- [ ] Timezone and date format preferences
- [ ] Notification preferences (email, push, in-app)
- [ ] Privacy and data sharing settings
- [ ] API key management for exchanges
- [ ] Data export/import preferences
- [ ] Language and localization settings
- [ ] Settings backup and restore functionality

## Technical Implementation

### File Structure
```
src/
  components/
    Settings/
      SettingsPage.jsx
      SettingsNavigation.jsx
      GeneralSettings.jsx
      DisplaySettings.jsx
      NotificationSettings.jsx
      SecuritySettings.jsx
      ApiKeyManager.jsx
      DataSettings.jsx
  hooks/
    useSettings.js
    useTheme.js
  services/
    SettingsService.js
  types/
    settings.types.js
```

### Main Settings Page Component
```jsx
// SettingsPage.jsx
import React, { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import SettingsNavigation from './SettingsNavigation';
import GeneralSettings from './GeneralSettings';
import DisplaySettings from './DisplaySettings';
import NotificationSettings from './NotificationSettings';
import SecuritySettings from './SecuritySettings';
import ApiKeyManager from './ApiKeyManager';
import DataSettings from './DataSettings';

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState('general');
  const { settings, updateSettings, isLoading, saveSettings, resetSettings } = useSettings();

  const settingsSections = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'display', name: 'Display', icon: '🎨' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'security', name: 'Security', icon: '🔒' },
    { id: 'api-keys', name: 'API Keys', icon: '🔑' },
    { id: 'data', name: 'Data & Privacy', icon: '📊' }
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSettings settings={settings} onUpdate={updateSettings} />;
      case 'display':
        return <DisplaySettings settings={settings} onUpdate={updateSettings} />;
      case 'notifications':
        return <NotificationSettings settings={settings} onUpdate={updateSettings} />;
      case 'security':
        return <SecuritySettings settings={settings} onUpdate={updateSettings} />;
      case 'api-keys':
        return <ApiKeyManager settings={settings} onUpdate={updateSettings} />;
      case 'data':
        return <DataSettings settings={settings} onUpdate={updateSettings} />;
      default:
        return <GeneralSettings settings={settings} onUpdate={updateSettings} />;
    }
  };

  const handleSaveSettings = async () => {
    try {
      await saveSettings();
      // Show success notification
    } catch (error) {
      // Show error notification
    }
  };

  const handleResetSettings = async () => {
    if (window.confirm('Are you sure you want to reset all settings to default? This action cannot be undone.')) {
      await resetSettings();
    }
  };

  if (isLoading) {
    return (
      <div className="settings-loading">
        <div className="loading-spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <div className="settings-actions">
          <button onClick={handleResetSettings} className="reset-btn">
            Reset to Default
          </button>
          <button onClick={handleSaveSettings} className="save-btn">
            Save Changes
          </button>
        </div>
      </div>

      <div className="settings-content">
        <SettingsNavigation
          sections={settingsSections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        <div className="settings-main">
          {renderActiveSection()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
```

### Display Settings Component
```jsx
// DisplaySettings.jsx
import React from 'react';
import { useTheme } from '../hooks/useTheme';

const DisplaySettings = ({ settings, onUpdate }) => {
  const { themes, currentTheme, setTheme } = useTheme();

  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'BTC', name: 'Bitcoin', symbol: '₿' },
    { code: 'ETH', name: 'Ethereum', symbol: 'Ξ' }
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' }
  ];

  const dateFormats = [
    { format: 'MM/dd/yyyy', example: '12/31/2023' },
    { format: 'dd/MM/yyyy', example: '31/12/2023' },
    { format: 'yyyy-MM-dd', example: '2023-12-31' },
    { format: 'MMM dd, yyyy', example: 'Dec 31, 2023' }
  ];

  const numberFormats = [
    { format: 'standard', example: '1,234.56' },
    { format: 'european', example: '1.234,56' },
    { format: 'indian', example: '1,23,456' },
    { format: 'compact', example: '1.23K' }
  ];

  const handleSettingChange = (key, value) => {
    onUpdate('display', { [key]: value });
  };

  return (
    <div className="display-settings">
      <div className="settings-section">
        <h2>Theme & Appearance</h2>
        
        <div className="setting-group">
          <label className="setting-label">Theme</label>
          <div className="theme-selector">
            {themes.map(theme => (
              <div
                key={theme.id}
                className={`theme-option ${currentTheme.id === theme.id ? 'active' : ''}`}
                onClick={() => setTheme(theme.id)}
              >
                <div className="theme-preview" style={{ backgroundColor: theme.primaryColor }}>
                  <div className="theme-accent" style={{ backgroundColor: theme.accentColor }}></div>
                </div>
                <span className="theme-name">{theme.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="setting-group">
          <label className="setting-label">Custom Colors</label>
          <div className="color-inputs">
            <div className="color-input-group">
              <label>Primary Color</label>
              <input
                type="color"
                value={settings.display?.customColors?.primary || '#007bff'}
                onChange={(e) => handleSettingChange('customColors', {
                  ...settings.display?.customColors,
                  primary: e.target.value
                })}
              />
            </div>
            <div className="color-input-group">
              <label>Accent Color</label>
              <input
                type="color"
                value={settings.display?.customColors?.accent || '#28a745'}
                onChange={(e) => handleSettingChange('customColors', {
                  ...settings.display?.customColors,
                  accent: e.target.value
                })}
              />
            </div>
          </div>
        </div>

        <div className="setting-group">
          <label className="setting-label">Font Size</label>
          <div className="font-size-selector">
            <input
              type="range"
              min="12"
              max="20"
              value={settings.display?.fontSize || 14}
              onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
              className="font-size-slider"
            />
            <span className="font-size-value">{settings.display?.fontSize || 14}px</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Localization</h2>
        
        <div className="setting-group">
          <label className="setting-label">Language</label>
          <select
            value={settings.display?.language || 'en'}
            onChange={(e) => handleSettingChange('language', e.target.value)}
            className="setting-select"
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">Primary Currency</label>
          <select
            value={settings.display?.currency || 'USD'}
            onChange={(e) => handleSettingChange('currency', e.target.value)}
            className="setting-select"
          >
            {currencies.map(currency => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.name} ({currency.code})
              </option>
            ))}
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">Date Format</label>
          <select
            value={settings.display?.dateFormat || 'MM/dd/yyyy'}
            onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
            className="setting-select"
          >
            {dateFormats.map(format => (
              <option key={format.format} value={format.format}>
                {format.example}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">Number Format</label>
          <select
            value={settings.display?.numberFormat || 'standard'}
            onChange={(e) => handleSettingChange('numberFormat', e.target.value)}
            className="setting-select"
          >
            {numberFormats.map(format => (
              <option key={format.format} value={format.format}>
                {format.example}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">Timezone</label>
          <select
            value={settings.display?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
            onChange={(e) => handleSettingChange('timezone', e.target.value)}
            className="setting-select"
          >
            {Intl.supportedValuesOf('timeZone').map(tz => (
              <option key={tz} value={tz}>
                {tz.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h2>Dashboard Layout</h2>
        
        <div className="setting-group">
          <label className="setting-label">Default View</label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="defaultView"
                value="grid"
                checked={settings.display?.defaultView === 'grid'}
                onChange={(e) => handleSettingChange('defaultView', e.target.value)}
              />
              <span>Grid View</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="defaultView"
                value="list"
                checked={settings.display?.defaultView === 'list'}
                onChange={(e) => handleSettingChange('defaultView', e.target.value)}
              />
              <span>List View</span>
            </label>
          </div>
        </div>

        <div className="setting-group">
          <label className="setting-label">Cards Per Row</label>
          <select
            value={settings.display?.cardsPerRow || 3}
            onChange={(e) => handleSettingChange('cardsPerRow', parseInt(e.target.value))}
            className="setting-select"
          >
            <option value={2}>2 Cards</option>
            <option value={3}>3 Cards</option>
            <option value={4}>4 Cards</option>
            <option value={5}>5 Cards</option>
          </select>
        </div>

        <div className="setting-group">
          <div className="checkbox-options">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings.display?.showSparklines !== false}
                onChange={(e) => handleSettingChange('showSparklines', e.target.checked)}
              />
              <span>Show price sparklines</span>
            </label>
            
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings.display?.showPercentageChanges !== false}
                onChange={(e) => handleSettingChange('showPercentageChanges', e.target.checked)}
              />
              <span>Show percentage changes</span>
            </label>
            
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings.display?.showMarketCap !== false}
                onChange={(e) => handleSettingChange('showMarketCap', e.target.checked)}
              />
              <span>Show market cap information</span>
            </label>
            
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings.display?.animateChanges !== false}
                onChange={(e) => handleSettingChange('animateChanges', e.target.checked)}
              />
              <span>Animate price changes</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisplaySettings;
```

### Settings Hook
```javascript
// useSettings.js
import { useState, useEffect } from 'react';
import { settingsService } from '../services/SettingsService';

export const useSettings = () => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const userSettings = await settingsService.getSettings();
      setSettings(userSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Load default settings
      setSettings(settingsService.getDefaultSettings());
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = (category, updates) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      [category]: {
        ...prevSettings[category],
        ...updates
      }
    }));
    setHasUnsavedChanges(true);
  };

  const saveSettings = async () => {
    try {
      await settingsService.saveSettings(settings);
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  };

  const resetSettings = async () => {
    const defaultSettings = settingsService.getDefaultSettings();
    setSettings(defaultSettings);
    await settingsService.saveSettings(defaultSettings);
    setHasUnsavedChanges(false);
  };

  const exportSettings = () => {
    return settingsService.exportSettings(settings);
  };

  const importSettings = async (settingsData) => {
    try {
      const importedSettings = settingsService.importSettings(settingsData);
      setSettings(importedSettings);
      await settingsService.saveSettings(importedSettings);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw error;
    }
  };

  return {
    settings,
    isLoading,
    hasUnsavedChanges,
    updateSettings,
    saveSettings,
    resetSettings,
    exportSettings,
    importSettings,
    refresh: loadSettings
  };
};
```

### Settings Service
```javascript
// SettingsService.js
class SettingsService {
  constructor() {
    this.defaultSettings = {
      general: {
        username: '',
        email: '',
        profilePicture: null,
        enableTwoFactor: false
      },
      display: {
        theme: 'light',
        customColors: {
          primary: '#007bff',
          accent: '#28a745'
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
        animateChanges: true
      },
      notifications: {
        email: {
          priceAlerts: true,
          portfolioSummary: true,
          tradingUpdates: true,
          securityAlerts: true
        },
        push: {
          priceAlerts: true,
          tradingUpdates: false,
          securityAlerts: true
        },
        inApp: {
          priceAlerts: true,
          tradingUpdates: true,
          newsUpdates: true,
          systemUpdates: true
        }
      },
      security: {
        sessionTimeout: 30,
        enableBiometric: false,
        requirePasswordForTrades: true,
        allowedIPs: []
      },
      data: {
        enableAnalytics: true,
        shareAnonymousData: false,
        autoBackup: true,
        backupFrequency: 'daily',
        dataRetentionDays: 365
      }
    };
  }

  async getSettings() {
    try {
      // Try to get from server first
      const response = await fetch('/api/user/settings', {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch settings from server, using local storage');
    }

    // Fallback to local storage
    const localSettings = localStorage.getItem('userSettings');
    if (localSettings) {
      return { ...this.defaultSettings, ...JSON.parse(localSettings) };
    }

    return this.defaultSettings;
  }

  async saveSettings(settings) {
    try {
      // Save to server
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings to server');
      }
    } catch (error) {
      console.warn('Failed to save to server, saving locally');
    }

    // Always save to local storage as backup
    localStorage.setItem('userSettings', JSON.stringify(settings));
    
    // Apply settings immediately
    this.applySettings(settings);
  }

  applySettings(settings) {
    // Apply theme
    if (settings.display?.theme) {
      document.documentElement.setAttribute('data-theme', settings.display.theme);
    }

    // Apply custom colors
    if (settings.display?.customColors) {
      document.documentElement.style.setProperty('--primary-color', settings.display.customColors.primary);
      document.documentElement.style.setProperty('--accent-color', settings.display.customColors.accent);
    }

    // Apply font size
    if (settings.display?.fontSize) {
      document.documentElement.style.setProperty('--base-font-size', `${settings.display.fontSize}px`);
    }

    // Apply language
    if (settings.display?.language) {
      document.documentElement.setAttribute('lang', settings.display.language);
    }
  }

  getDefaultSettings() {
    return { ...this.defaultSettings };
  }

  exportSettings(settings) {
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      settings: settings
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crypto-portfolio-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  importSettings(settingsData) {
    try {
      const parsed = typeof settingsData === 'string' ? JSON.parse(settingsData) : settingsData;
      
      if (parsed.version && parsed.settings) {
        return { ...this.defaultSettings, ...parsed.settings };
      } else {
        // Direct settings object
        return { ...this.defaultSettings, ...parsed };
      }
    } catch (error) {
      throw new Error('Invalid settings file format');
    }
  }

  getAuthToken() {
    return localStorage.getItem('authToken');
  }
}

export const settingsService = new SettingsService();
```

## Testing Requirements
- Settings persistence testing across sessions
- Theme application testing
- Settings import/export functionality testing
- UI responsiveness with different settings
- Settings validation and error handling

## Dependencies
- Depends on: CP-002 (User Authentication)
- Depends on: CP-031 (Asset Search and Filtering)
- Blocks: All UI-related features

## Time Estimate
**Beginner**: 7-8 days
**Intermediate**: 5-6 days
**Advanced**: 3-4 days

## Required Skills
- React component architecture
- Theme management and CSS variables
- Local storage and data persistence
- Form handling and validation
- Internationalization concepts