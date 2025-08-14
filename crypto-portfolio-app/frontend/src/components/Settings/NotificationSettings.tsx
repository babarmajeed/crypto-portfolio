import React, { useState } from 'react';
import { Bell, Mail, Smartphone, Monitor, Volume2, VolumeX, Vibrate } from 'lucide-react';
import { NotificationSettings as NotificationSettingsType } from '../../types/settings.types';

interface NotificationSettingsProps {
  settings: NotificationSettingsType;
  onUpdate: (updates: Partial<NotificationSettingsType>) => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ settings, onUpdate }) => {
  const [testNotification, setTestNotification] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleSettingChange = (
    category: 'email' | 'push' | 'inApp' | 'frequency',
    key: string,
    value: any
  ) => {
    onUpdate({
      [category]: {
        ...settings[category],
        [key]: value
      }
    });
  };

  const sendTestNotification = async () => {
    setTestNotification('sending');
    
    // Simulate API call
    setTimeout(() => {
      setTestNotification('sent');
      setTimeout(() => setTestNotification('idle'), 3000);
    }, 1000);
  };

  return (
    <div className="notification-settings">
      <div className="settings-section">
        <h2>Email Notifications</h2>
        <p className="section-description">
          Configure which events trigger email notifications
        </p>

        <div className="notification-section">
          <div className="notification-header">
            <Mail className="section-icon" size={20} />
            <div className="section-info">
              <h3>Email Preferences</h3>
              <p>Notifications will be sent to your registered email address</p>
            </div>
          </div>

          <div className="notification-options">
            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Price Alerts</span>
                  <span className="option-description">Get notified when assets reach target prices</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.email.priceAlerts}
                  onChange={(e) => handleSettingChange('email', 'priceAlerts', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Portfolio Summary</span>
                  <span className="option-description">Daily/weekly portfolio performance reports</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.email.portfolioSummary}
                  onChange={(e) => handleSettingChange('email', 'portfolioSummary', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Trading Updates</span>
                  <span className="option-description">Transaction confirmations and trade executions</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.email.tradingUpdates}
                  onChange={(e) => handleSettingChange('email', 'tradingUpdates', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Security Alerts</span>
                  <span className="option-description">Login attempts and security-related events</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.email.securityAlerts}
                  onChange={(e) => handleSettingChange('email', 'securityAlerts', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">News Updates</span>
                  <span className="option-description">Important cryptocurrency news and market updates</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.email.newsUpdates}
                  onChange={(e) => handleSettingChange('email', 'newsUpdates', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Market Analysis</span>
                  <span className="option-description">Weekly market insights and analysis reports</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.email.marketAnalysis}
                  onChange={(e) => handleSettingChange('email', 'marketAnalysis', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Push Notifications</h2>
        <p className="section-description">
          Receive instant notifications on your mobile device
        </p>

        <div className="notification-section">
          <div className="notification-header">
            <Smartphone className="section-icon" size={20} />
            <div className="section-info">
              <h3>Mobile Push Notifications</h3>
              <p>Notifications will appear on your mobile device</p>
            </div>
          </div>

          <div className="notification-options">
            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Price Alerts</span>
                  <span className="option-description">Instant alerts for price movements</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.push.priceAlerts}
                  onChange={(e) => handleSettingChange('push', 'priceAlerts', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Trading Updates</span>
                  <span className="option-description">Trade execution confirmations</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.push.tradingUpdates}
                  onChange={(e) => handleSettingChange('push', 'tradingUpdates', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Security Alerts</span>
                  <span className="option-description">Critical security notifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.push.securityAlerts}
                  onChange={(e) => handleSettingChange('push', 'securityAlerts', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">News Updates</span>
                  <span className="option-description">Breaking cryptocurrency news</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.push.newsUpdates}
                  onChange={(e) => handleSettingChange('push', 'newsUpdates', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>In-App Notifications</h2>
        <p className="section-description">
          Configure notifications within the application
        </p>

        <div className="notification-section">
          <div className="notification-header">
            <Monitor className="section-icon" size={20} />
            <div className="section-info">
              <h3>Desktop Notifications</h3>
              <p>Notifications that appear while using the app</p>
            </div>
          </div>

          <div className="notification-options">
            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Price Alerts</span>
                  <span className="option-description">Toast notifications for price changes</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.inApp.priceAlerts}
                  onChange={(e) => handleSettingChange('inApp', 'priceAlerts', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">Trading Updates</span>
                  <span className="option-description">In-app trade confirmations</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.inApp.tradingUpdates}
                  onChange={(e) => handleSettingChange('inApp', 'tradingUpdates', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">News Updates</span>
                  <span className="option-description">News ticker and important updates</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.inApp.newsUpdates}
                  onChange={(e) => handleSettingChange('inApp', 'newsUpdates', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <label className="notification-option">
              <div className="option-content">
                <div className="option-info">
                  <span className="option-name">System Updates</span>
                  <span className="option-description">App updates and maintenance notices</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.inApp.systemUpdates}
                  onChange={(e) => handleSettingChange('inApp', 'systemUpdates', e.target.checked)}
                  className="option-toggle"
                />
              </div>
            </label>

            <div className="audio-visual-section">
              <h4>Audio & Visual</h4>
              
              <label className="notification-option">
                <div className="option-content">
                  <div className="option-info">
                    <Volume2 size={16} />
                    <span className="option-name">Sound Notifications</span>
                    <span className="option-description">Play sound for notifications</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.inApp.soundEnabled}
                    onChange={(e) => handleSettingChange('inApp', 'soundEnabled', e.target.checked)}
                    className="option-toggle"
                  />
                </div>
              </label>

              <label className="notification-option">
                <div className="option-content">
                  <div className="option-info">
                    <Vibrate size={16} />
                    <span className="option-name">Vibration</span>
                    <span className="option-description">Vibrate on mobile devices</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.inApp.vibrationEnabled}
                    onChange={(e) => handleSettingChange('inApp', 'vibrationEnabled', e.target.checked)}
                    className="option-toggle"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Notification Frequency</h2>
        <p className="section-description">
          Control how often you receive different types of notifications
        </p>

        <div className="frequency-section">
          <div className="frequency-options">
            <div className="frequency-group">
              <label className="frequency-label">Price Alerts</label>
              <select
                value={settings.frequency.priceAlerts}
                onChange={(e) => handleSettingChange('frequency', 'priceAlerts', e.target.value)}
                className="frequency-select"
              >
                <option value="instant">Instant</option>
                <option value="hourly">Hourly digest</option>
                <option value="daily">Daily digest</option>
              </select>
            </div>

            <div className="frequency-group">
              <label className="frequency-label">Portfolio Summary</label>
              <select
                value={settings.frequency.portfolioSummary}
                onChange={(e) => handleSettingChange('frequency', 'portfolioSummary', e.target.value)}
                className="frequency-select"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="frequency-group">
              <label className="frequency-label">News Updates</label>
              <select
                value={settings.frequency.newsUpdates}
                onChange={(e) => handleSettingChange('frequency', 'newsUpdates', e.target.value)}
                className="frequency-select"
              >
                <option value="instant">Instant</option>
                <option value="hourly">Hourly digest</option>
                <option value="daily">Daily digest</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Test Notifications</h2>
        <p className="section-description">
          Test your notification settings to ensure they're working correctly
        </p>

        <div className="test-section">
          <div className="test-notification-card">
            <div className="test-info">
              <Bell className="test-icon" size={24} />
              <div>
                <h3>Test Notification</h3>
                <p>Send a test notification to verify your settings</p>
              </div>
            </div>
            
            <button
              onClick={sendTestNotification}
              disabled={testNotification === 'sending'}
              className={`test-btn ${testNotification === 'sent' ? 'success' : ''}`}
            >
              {testNotification === 'idle' && 'Send Test'}
              {testNotification === 'sending' && 'Sending...'}
              {testNotification === 'sent' && '✓ Sent!'}
            </button>
          </div>

          <div className="test-results">
            {testNotification === 'sent' && (
              <div className="test-success">
                <p>✅ Test notification sent successfully!</p>
                <p>Check your email and enabled notification channels.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;