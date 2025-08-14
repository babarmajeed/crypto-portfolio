import React, { useState, useCallback, useEffect } from 'react';
import { NotificationSettingsProps, NotificationSettings as NotificationSettingsType, NotificationType, NotificationChannel } from '../../types/notification.types';

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings,
  onUpdateSettings,
  showAdvanced = false,
  className = '',
  ...props
}) => {
  const [localSettings, setLocalSettings] = useState<NotificationSettingsType>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(showAdvanced);
  const [activeTab, setActiveTab] = useState<'general' | 'types' | 'channels' | 'schedule'>('general');

  // Sync external settings changes
  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  // Check for changes
  useEffect(() => {
    const hasAnyChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasChanges(hasAnyChanges);
  }, [localSettings, settings]);

  const handleSave = useCallback(async () => {
    if (!hasChanges || isSaving) return;
    
    setIsSaving(true);
    try {
      await onUpdateSettings(localSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
    setIsSaving(false);
  }, [localSettings, onUpdateSettings, hasChanges, isSaving]);

  const handleReset = useCallback(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<NotificationSettingsType>) => {
    setLocalSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateChannelSettings = useCallback((enabled: boolean, channels: Partial<NotificationSettingsType['channels']>) => {
    updateSettings({
      enabled,
      channels: { ...localSettings.channels, ...channels }
    });
  }, [localSettings.channels, updateSettings]);

  const updateTypeSettings = useCallback((type: NotificationType, updates: Partial<NotificationSettingsType['types'][NotificationType]>) => {
    updateSettings({
      types: {
        ...localSettings.types,
        [type]: { ...localSettings.types[type], ...updates }
      }
    });
  }, [localSettings.types, updateSettings]);

  const updateQuietHours = useCallback((updates: Partial<NotificationSettingsType['quietHours']>) => {
    updateSettings({
      quietHours: localSettings.quietHours ? { ...localSettings.quietHours, ...updates } : undefined
    });
  }, [localSettings.quietHours, updateSettings]);

  const updateSoundSettings = useCallback((updates: Partial<NotificationSettingsType['sound']>) => {
    updateSettings({
      sound: { ...localSettings.sound, ...updates }
    });
  }, [localSettings.sound, updateSettings]);

  const notificationTypes: Array<{ type: NotificationType; label: string; description: string; icon: string }> = [
    { type: 'price_alert', label: 'Price Alerts', description: 'Notifications when asset prices hit your targets', icon: '📈' },
    { type: 'portfolio', label: 'Portfolio Updates', description: 'Changes in your portfolio value and performance', icon: '💼' },
    { type: 'security', label: 'Security Alerts', description: 'Account security and login notifications', icon: '🔒' },
    { type: 'system', label: 'System Messages', description: 'Platform updates and maintenance notifications', icon: '⚙️' },
    { type: 'trade', label: 'Trading Activity', description: 'Order executions and trading confirmations', icon: '💰' },
    { type: 'milestone', label: 'Milestones', description: 'Achievement and goal notifications', icon: '🎯' },
    { type: 'news', label: 'Market News', description: 'Important market and crypto news updates', icon: '📰' },
    { type: 'maintenance', label: 'Maintenance', description: 'Scheduled maintenance and service updates', icon: '🔧' }
  ];

  const channels: Array<{ channel: NotificationChannel; label: string; description: string; icon: string }> = [
    { channel: 'in_app', label: 'In-App', description: 'Notifications within the application', icon: '📱' },
    { channel: 'email', label: 'Email', description: 'Email notifications to your registered address', icon: '📧' },
    { channel: 'push', label: 'Push Notifications', description: 'Browser push notifications', icon: '🔔' },
    { channel: 'sms', label: 'SMS', description: 'Text message notifications', icon: '📨' }
  ];

  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className={`notification-settings ${className}`} {...props}>
      {/* Header */}
      <div className="settings-header">
        <h3>Notification Settings</h3>
        
        {hasChanges && (
          <div className="save-actions">
            <button
              onClick={handleReset}
              className="reset-btn"
              disabled={isSaving}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              className="save-btn"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="settings-tabs">
        <button
          onClick={() => setActiveTab('general')}
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={`tab ${activeTab === 'channels' ? 'active' : ''}`}
        >
          Channels
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`tab ${activeTab === 'types' ? 'active' : ''}`}
        >
          Types
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`tab ${activeTab === 'schedule' ? 'active' : ''}`}
        >
          Schedule
        </button>
      </div>

      <div className="settings-content">
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="general-settings">
            <div className="setting-group">
              <div className="setting-item">
                <div className="setting-info">
                  <h4>Enable Notifications</h4>
                  <p>Master switch for all notifications</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={localSettings.enabled}
                    onChange={(e) => updateSettings({ enabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h4>Do Not Disturb</h4>
                  <p>Temporarily disable all notifications</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={localSettings.doNotDisturb}
                    onChange={(e) => updateSettings({ doNotDisturb: e.target.checked })}
                    disabled={!localSettings.enabled}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h4>Real-time Updates</h4>
                  <p>Receive notifications as they happen</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={localSettings.frequency.realTime}
                    onChange={(e) => updateSettings({
                      frequency: { ...localSettings.frequency, realTime: e.target.checked }
                    })}
                    disabled={!localSettings.enabled}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="setting-group">
              <h4>Digest Settings</h4>
              <div className="setting-item">
                <div className="setting-info">
                  <label htmlFor="digest-frequency">Email Digest Frequency</label>
                  <p>How often to receive summary emails</p>
                </div>
                <select
                  id="digest-frequency"
                  value={localSettings.frequency.digest}
                  onChange={(e) => updateSettings({
                    frequency: { ...localSettings.frequency, digest: e.target.value as 'never' | 'daily' | 'weekly' }
                  })}
                  disabled={!localSettings.enabled || !localSettings.channels.email}
                >
                  <option value="never">Never</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div className="setting-group">
              <h4>Sound Settings</h4>
              <div className="setting-item">
                <div className="setting-info">
                  <h4>Enable Sounds</h4>
                  <p>Play notification sounds</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={localSettings.sound.enabled}
                    onChange={(e) => updateSoundSettings({ enabled: e.target.checked })}
                    disabled={!localSettings.enabled}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {localSettings.sound.enabled && (
                <div className="setting-item">
                  <div className="setting-info">
                    <label htmlFor="sound-volume">Volume</label>
                    <p>Notification sound volume</p>
                  </div>
                  <input
                    id="sound-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localSettings.sound.volume}
                    onChange={(e) => updateSoundSettings({ volume: parseFloat(e.target.value) })}
                    className="volume-slider"
                  />
                  <span className="volume-label">{Math.round(localSettings.sound.volume * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Channel Settings */}
        {activeTab === 'channels' && (
          <div className="channel-settings">
            <div className="setting-group">
              <h4>Notification Channels</h4>
              <p>Choose how you want to receive notifications</p>
              
              {channels.map(({ channel, label, description, icon }) => (
                <div key={channel} className="setting-item">
                  <div className="setting-info">
                    <h4>
                      <span className="channel-icon">{icon}</span>
                      {label}
                    </h4>
                    <p>{description}</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={localSettings.channels[channel]}
                      onChange={(e) => updateChannelSettings(localSettings.enabled, { [channel]: e.target.checked })}
                      disabled={!localSettings.enabled}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              ))}
            </div>

            {localSettings.channels.push && (
              <div className="setting-group">
                <h4>Push Notification Permissions</h4>
                <div className="permission-status">
                  {Notification.permission === 'granted' ? (
                    <div className="permission-granted">
                      <span className="status-icon">✅</span>
                      Push notifications are enabled
                    </div>
                  ) : Notification.permission === 'denied' ? (
                    <div className="permission-denied">
                      <span className="status-icon">❌</span>
                      Push notifications are blocked. Please enable them in your browser settings.
                    </div>
                  ) : (
                    <div className="permission-default">
                      <span className="status-icon">⚠️</span>
                      <button
                        onClick={() => Notification.requestPermission()}
                        className="request-permission-btn"
                      >
                        Enable Push Notifications
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Type Settings */}
        {activeTab === 'types' && (
          <div className="type-settings">
            <div className="setting-group">
              <h4>Notification Types</h4>
              <p>Customize settings for each type of notification</p>
              
              {notificationTypes.map(({ type, label, description, icon }) => (
                <div key={type} className="notification-type-setting">
                  <div className="type-header">
                    <div className="type-info">
                      <h4>
                        <span className="type-icon">{icon}</span>
                        {label}
                      </h4>
                      <p>{description}</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={localSettings.types[type].enabled}
                        onChange={(e) => updateTypeSettings(type, { enabled: e.target.checked })}
                        disabled={!localSettings.enabled}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  {localSettings.types[type].enabled && (
                    <div className="type-details">
                      <div className="type-setting">
                        <label>Priority Level</label>
                        <select
                          value={localSettings.types[type].priority}
                          onChange={(e) => updateTypeSettings(type, { priority: e.target.value as any })}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      
                      <div className="type-setting">
                        <label>Channels</label>
                        <div className="channel-checkboxes">
                          {channels.map(({ channel, label: channelLabel, icon: channelIcon }) => (
                            <label key={channel} className="channel-checkbox">
                              <input
                                type="checkbox"
                                checked={localSettings.types[type].channels.includes(channel)}
                                onChange={(e) => {
                                  const channels = localSettings.types[type].channels;
                                  const newChannels = e.target.checked
                                    ? [...channels, channel]
                                    : channels.filter(c => c !== channel);
                                  updateTypeSettings(type, { channels: newChannels });
                                }}
                                disabled={!localSettings.channels[channel]}
                              />
                              <span className="channel-label">
                                <span className="channel-icon">{channelIcon}</span>
                                {channelLabel}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule Settings */}
        {activeTab === 'schedule' && (
          <div className="schedule-settings">
            <div className="setting-group">
              <div className="setting-item">
                <div className="setting-info">
                  <h4>Quiet Hours</h4>
                  <p>Disable notifications during specific hours</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={localSettings.quietHours?.enabled || false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateSettings({
                          quietHours: {
                            enabled: true,
                            startTime: '22:00',
                            endTime: '07:00',
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                            days: [0, 1, 2, 3, 4, 5, 6],
                            exceptions: ['security']
                          }
                        });
                      } else {
                        updateSettings({ quietHours: undefined });
                      }
                    }}
                    disabled={!localSettings.enabled}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {localSettings.quietHours?.enabled && (
                <>
                  <div className="time-settings">
                    <div className="time-input">
                      <label htmlFor="start-time">Start Time</label>
                      <input
                        id="start-time"
                        type="time"
                        value={localSettings.quietHours.startTime}
                        onChange={(e) => updateQuietHours({ startTime: e.target.value })}
                      />
                    </div>
                    <div className="time-input">
                      <label htmlFor="end-time">End Time</label>
                      <input
                        id="end-time"
                        type="time"
                        value={localSettings.quietHours.endTime}
                        onChange={(e) => updateQuietHours({ endTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="day-settings">
                    <label>Days of the Week</label>
                    <div className="day-checkboxes">
                      {dayLabels.map((day, index) => (
                        <label key={index} className="day-checkbox">
                          <input
                            type="checkbox"
                            checked={localSettings.quietHours!.days.includes(index)}
                            onChange={(e) => {
                              const days = localSettings.quietHours!.days;
                              const newDays = e.target.checked
                                ? [...days, index]
                                : days.filter(d => d !== index);
                              updateQuietHours({ days: newDays });
                            }}
                          />
                          <span className="day-label">{day.slice(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="exception-settings">
                    <label>Exceptions (Always Allow)</label>
                    <div className="exception-checkboxes">
                      {notificationTypes.map(({ type, label, icon }) => (
                        <label key={type} className="exception-checkbox">
                          <input
                            type="checkbox"
                            checked={localSettings.quietHours!.exceptions.includes(type)}
                            onChange={(e) => {
                              const exceptions = localSettings.quietHours!.exceptions;
                              const newExceptions = e.target.checked
                                ? [...exceptions, type]
                                : exceptions.filter(t => t !== type);
                              updateQuietHours({ exceptions: newExceptions });
                            }}
                          />
                          <span className="exception-label">
                            <span className="exception-icon">{icon}</span>
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Settings Toggle */}
      {!showAdvanced && (
        <div className="advanced-toggle">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="advanced-toggle-btn"
          >
            {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="settings-footer">
        <div className="footer-info">
          <p>Changes will be applied immediately for new notifications.</p>
          {hasChanges && (
            <div className="unsaved-changes-warning">
              <span className="warning-icon">⚠️</span>
              You have unsaved changes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;