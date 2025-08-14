import { useState, useEffect } from 'react';
import { 
  UserSettings, 
  UseSettingsReturn, 
  SettingsValidationResult, 
  SettingsExportData 
} from '../../types/settings.types';
import { settingsService } from '../../services/settings/SettingsService';

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
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
      // Load default settings on error
      const defaultSettings = settingsService.getDefaultSettings();
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = (category: keyof UserSettings, updates: any) => {
    if (!settings) return;

    const updatedSettings = {
      ...settings,
      [category]: {
        ...(settings[category] as any),
        ...updates
      },
      lastUpdated: new Date()
    };

    setSettings(updatedSettings);
    setHasUnsavedChanges(true);

    // Apply settings immediately for UI changes
    settingsService.applySettings(updatedSettings);
  };

  const saveSettings = async (): Promise<boolean> => {
    if (!settings) return false;

    try {
      const success = await settingsService.saveSettings(settings);
      if (success) {
        setHasUnsavedChanges(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  };

  const resetSettings = async (): Promise<void> => {
    try {
      const defaultSettings = settingsService.getDefaultSettings();
      setSettings(defaultSettings);
      await settingsService.saveSettings(defaultSettings);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw error;
    }
  };

  const exportSettings = () => {
    if (!settings) return;
    settingsService.exportSettings(settings);
  };

  const importSettings = async (data: string | SettingsExportData): Promise<void> => {
    try {
      const importedSettings = settingsService.importSettings(data);
      setSettings(importedSettings);
      await settingsService.saveSettings(importedSettings);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw error;
    }
  };

  const validateSettings = (): SettingsValidationResult => {
    if (!settings) {
      return {
        isValid: false,
        errors: [{ field: 'settings', message: 'Settings not loaded', code: 'NOT_LOADED' }]
      };
    }

    return settingsService.validateSettings(settings);
  };

  const refresh = async (): Promise<void> => {
    await loadSettings();
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
    validateSettings,
    refresh
  };
};