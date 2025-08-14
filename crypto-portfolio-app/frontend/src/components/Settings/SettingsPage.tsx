import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Download, Upload, AlertTriangle } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings/useSettings';
import SettingsNavigation from './SettingsNavigation';
import GeneralSettings from './GeneralSettings';
import DisplaySettings from './DisplaySettings';
import NotificationSettings from './NotificationSettings';
import SecuritySettings from './SecuritySettings';
import ApiKeyManager from './ApiKeyManager';
import DataSettings from './DataSettings';
import { SettingsSection } from '../../types/settings.types';

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('general');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const {
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
  } = useSettings();

  const settingsSections: SettingsSection[] = [
    { 
      id: 'general', 
      name: 'General', 
      icon: '👤',
      description: 'Profile and account settings'
    },
    { 
      id: 'display', 
      name: 'Display', 
      icon: '🎨',
      description: 'Theme, language, and appearance'
    },
    { 
      id: 'notifications', 
      name: 'Notifications', 
      icon: '🔔',
      description: 'Alerts and notification preferences'
    },
    { 
      id: 'security', 
      name: 'Security', 
      icon: '🔒',
      description: 'Security and privacy settings'
    },
    { 
      id: 'api-keys', 
      name: 'API Keys', 
      icon: '🔑',
      description: 'Exchange API key management'
    },
    { 
      id: 'data', 
      name: 'Data & Privacy', 
      icon: '📊',
      description: 'Data management and privacy options'
    }
  ];

  useEffect(() => {
    // Auto-save settings when user navigates away
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Auto-save after 5 seconds of inactivity
    if (hasUnsavedChanges) {
      const autoSaveTimer = setTimeout(async () => {
        try {
          await handleSaveSettings();
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 5000);

      return () => clearTimeout(autoSaveTimer);
    }
  }, [hasUnsavedChanges]);

  const renderActiveSection = () => {
    if (!settings) return null;

    switch (activeSection) {
      case 'general':
        return <GeneralSettings settings={settings.general} onUpdate={(updates) => updateSettings('general', updates)} />;
      case 'display':
        return <DisplaySettings settings={settings.display} onUpdate={(updates) => updateSettings('display', updates)} />;
      case 'notifications':
        return <NotificationSettings settings={settings.notifications} onUpdate={(updates) => updateSettings('notifications', updates)} />;
      case 'security':
        return <SecuritySettings settings={settings.security} onUpdate={(updates) => updateSettings('security', updates)} />;
      case 'api-keys':
        return <ApiKeyManager apiKeys={settings.apiKeys} onUpdate={(updates) => updateSettings('apiKeys', updates)} />;
      case 'data':
        return <DataSettings settings={settings.data} onUpdate={(updates) => updateSettings('data', updates)} />;
      default:
        return <GeneralSettings settings={settings.general} onUpdate={(updates) => updateSettings('general', updates)} />;
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('saving');
      
      const validationResult = validateSettings();
      if (!validationResult.isValid) {
        setSaveStatus('error');
        // Show validation errors to user
        console.error('Settings validation failed:', validationResult.errors);
        return;
      }

      const success = await saveSettings();
      if (success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }

    try {
      await resetSettings();
      setShowResetConfirm(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setSaveStatus('error');
    }
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          await importSettings(text);
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
          console.error('Failed to import settings:', error);
          setSaveStatus('error');
        }
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div className="settings-loading">
        <div className="loading-container">
          <div className="loading-spinner large"></div>
          <h2>Loading Settings...</h2>
          <p>Please wait while we retrieve your preferences</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="settings-error">
        <div className="error-container">
          <AlertTriangle className="error-icon" size={48} />
          <h2>Failed to Load Settings</h2>
          <p>We couldn't retrieve your settings. Please try refreshing the page.</p>
          <button onClick={refresh} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="header-content">
          <div className="header-title">
            <Settings className="header-icon" size={24} />
            <div>
              <h1>Settings</h1>
              <p className="header-subtitle">Customize your portfolio experience</p>
            </div>
          </div>

          <div className="settings-actions">
            {hasUnsavedChanges && (
              <div className="unsaved-indicator">
                <span className="unsaved-dot"></span>
                Unsaved changes
              </div>
            )}

            <div className="save-status">
              {saveStatus === 'saving' && <span className="status saving">Saving...</span>}
              {saveStatus === 'saved' && <span className="status saved">Saved ✓</span>}
              {saveStatus === 'error' && <span className="status error">Save failed</span>}
            </div>

            <div className="action-buttons">
              <button 
                onClick={handleImportSettings} 
                className="import-btn"
                title="Import settings from file"
              >
                <Upload size={16} />
                Import
              </button>

              <button 
                onClick={exportSettings} 
                className="export-btn"
                title="Export settings to file"
              >
                <Download size={16} />
                Export
              </button>

              <button 
                onClick={() => setShowResetConfirm(true)} 
                className={`reset-btn ${showResetConfirm ? 'confirm' : ''}`}
                title="Reset all settings to default"
              >
                <RotateCcw size={16} />
                {showResetConfirm ? 'Confirm Reset' : 'Reset'}
              </button>

              <button 
                onClick={handleSaveSettings} 
                className={`save-btn ${hasUnsavedChanges ? 'has-changes' : ''}`}
                disabled={isSaving || !hasUnsavedChanges}
                title="Save all changes"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {showResetConfirm && (
          <div className="reset-confirmation">
            <div className="confirm-content">
              <AlertTriangle className="confirm-icon" size={20} />
              <span>Are you sure you want to reset all settings to default? This action cannot be undone.</span>
              <div className="confirm-actions">
                <button onClick={() => setShowResetConfirm(false)} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={handleResetSettings} className="confirm-btn">
                  Yes, Reset All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="settings-content">
        <SettingsNavigation
          sections={settingsSections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        <div className="settings-main">
          <div className="settings-section-content">
            {renderActiveSection()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;