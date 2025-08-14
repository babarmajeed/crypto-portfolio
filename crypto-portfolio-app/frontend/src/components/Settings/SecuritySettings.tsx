import React, { useState } from 'react';
import { Shield, Lock, Clock, Fingerprint, MapPin, Activity, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { SecuritySettings as SecuritySettingsType } from '../../types/settings.types';

interface SecuritySettingsProps {
  settings: SecuritySettingsType;
  onUpdate: (updates: Partial<SecuritySettingsType>) => void;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({ settings, onUpdate }) => {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showIPForm, setShowIPForm] = useState(false);
  const [newIP, setNewIP] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const sessionTimeouts = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 480, label: '8 hours' },
    { value: 1440, label: '24 hours' }
  ];

  const handleSettingChange = (key: keyof SecuritySettingsType, value: any) => {
    onUpdate({ [key]: value });
  };

  const handleAddIP = () => {
    if (newIP.trim() && !settings.allowedIPs.includes(newIP.trim())) {
      const updatedIPs = [...settings.allowedIPs, newIP.trim()];
      handleSettingChange('allowedIPs', updatedIPs);
      setNewIP('');
      setShowIPForm(false);
    }
  };

  const handleRemoveIP = (ipToRemove: string) => {
    const updatedIPs = settings.allowedIPs.filter(ip => ip !== ipToRemove);
    handleSettingChange('allowedIPs', updatedIPs);
  };

  const handlePasswordChange = () => {
    // In a real app, this would validate and update the password
    console.log('Password change requested:', passwordForm);
    setShowPasswordForm(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validateIP = (ip: string): boolean => {
    const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  return (
    <div className="security-settings">
      <div className="settings-section">
        <h2>Authentication & Access</h2>
        <p className="section-description">
          Manage your login security and account access controls
        </p>

        <div className="security-section">
          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <Lock size={20} />
              </div>
              <div className="security-item-info">
                <h3>Password</h3>
                <p>Change your account password</p>
              </div>
              <button
                onClick={() => setShowPasswordForm(true)}
                className="change-password-btn"
              >
                Change Password
              </button>
            </div>

            {showPasswordForm && (
              <div className="password-form">
                <div className="form-group">
                  <label>Current Password</label>
                  <div className="password-input-container">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        currentPassword: e.target.value
                      }))}
                      className="password-input"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="password-toggle"
                    >
                      {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <div className="password-input-container">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      className="password-input"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new')}
                      className="password-toggle"
                    >
                      {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div className="strength-fill weak"></div>
                    </div>
                    <span className="strength-text">Password strength: Weak</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div className="password-input-container">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      className="password-input"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="password-toggle"
                    >
                      {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="password-form-actions">
                  <button
                    onClick={() => setShowPasswordForm(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    className="save-btn"
                    disabled={!passwordForm.currentPassword || !passwordForm.newPassword || 
                             passwordForm.newPassword !== passwordForm.confirmPassword}
                  >
                    Update Password
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <Fingerprint size={20} />
              </div>
              <div className="security-item-info">
                <h3>Biometric Authentication</h3>
                <p>Use fingerprint or face recognition for quick access</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.enableBiometric}
                  onChange={(e) => handleSettingChange('enableBiometric', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>

          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <Clock size={20} />
              </div>
              <div className="security-item-info">
                <h3>Session Timeout</h3>
                <p>Automatically sign out after period of inactivity</p>
              </div>
              <select
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
                className="timeout-select"
              >
                {sessionTimeouts.map((timeout) => (
                  <option key={timeout.value} value={timeout.value}>
                    {timeout.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Trading Security</h2>
        <p className="section-description">
          Additional security measures for trading activities
        </p>

        <div className="security-section">
          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <Shield size={20} />
              </div>
              <div className="security-item-info">
                <h3>Password for Trades</h3>
                <p>Require password confirmation for all trading activities</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.requirePasswordForTrades}
                  onChange={(e) => handleSettingChange('requirePasswordForTrades', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>

          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <Activity size={20} />
              </div>
              <div className="security-item-info">
                <h3>Auto-logout on Inactivity</h3>
                <p>Automatically sign out when inactive during trading</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoLogoutOnInactivity}
                  onChange={(e) => handleSettingChange('autoLogoutOnInactivity', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>

          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <Lock size={20} />
              </div>
              <div className="security-item-info">
                <h3>Data Encryption</h3>
                <p>Encrypt sensitive data stored locally</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.enableEncryption}
                  onChange={(e) => handleSettingChange('enableEncryption', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Access Control</h2>
        <p className="section-description">
          Control which devices and locations can access your account
        </p>

        <div className="security-section">
          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <MapPin size={20} />
              </div>
              <div className="security-item-info">
                <h3>Allowed IP Addresses</h3>
                <p>Restrict account access to specific IP addresses</p>
              </div>
              <button
                onClick={() => setShowIPForm(true)}
                className="add-ip-btn"
              >
                Add IP Address
              </button>
            </div>

            <div className="allowed-ips-list">
              {settings.allowedIPs.length === 0 ? (
                <div className="no-ips">
                  <p>No IP restrictions configured. Account can be accessed from any location.</p>
                </div>
              ) : (
                <div className="ip-list">
                  {settings.allowedIPs.map((ip, index) => (
                    <div key={index} className="ip-item">
                      <span className="ip-address">{ip}</span>
                      <button
                        onClick={() => handleRemoveIP(ip)}
                        className="remove-ip-btn"
                        title="Remove IP address"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showIPForm && (
              <div className="ip-form">
                <div className="ip-input-container">
                  <input
                    type="text"
                    value={newIP}
                    onChange={(e) => setNewIP(e.target.value)}
                    placeholder="Enter IP address (e.g., 192.168.1.1)"
                    className={`ip-input ${newIP && !validateIP(newIP) ? 'invalid' : ''}`}
                  />
                  {newIP && !validateIP(newIP) && (
                    <span className="ip-error">Please enter a valid IP address</span>
                  )}
                </div>
                <div className="ip-form-actions">
                  <button
                    onClick={() => {
                      setShowIPForm(false);
                      setNewIP('');
                    }}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddIP}
                    className="add-btn"
                    disabled={!newIP || !validateIP(newIP)}
                  >
                    Add IP
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <Activity size={20} />
              </div>
              <div className="security-item-info">
                <h3>Login Notifications</h3>
                <p>Get notified of new login attempts</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.enableLoginNotifications}
                  onChange={(e) => handleSettingChange('enableLoginNotifications', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>

          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-icon">
                <MapPin size={20} />
              </div>
              <div className="security-item-info">
                <h3>Device Tracking</h3>
                <p>Track and manage devices that access your account</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.enableDeviceTracking}
                  onChange={(e) => handleSettingChange('enableDeviceTracking', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Security Status</h2>
        <p className="section-description">
          Overview of your current security configuration
        </p>

        <div className="security-status">
          <div className="status-grid">
            <div className={`status-item ${settings.enableTwoFactor ? 'secure' : 'warning'}`}>
              <div className="status-icon">
                {settings.enableTwoFactor ? <Shield size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div className="status-info">
                <h4>Two-Factor Authentication</h4>
                <span className="status-value">
                  {settings.enableTwoFactor ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div className={`status-item ${settings.enableBiometric ? 'secure' : 'neutral'}`}>
              <div className="status-icon">
                <Fingerprint size={20} />
              </div>
              <div className="status-info">
                <h4>Biometric Login</h4>
                <span className="status-value">
                  {settings.enableBiometric ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="status-item secure">
              <div className="status-icon">
                <Clock size={20} />
              </div>
              <div className="status-info">
                <h4>Session Timeout</h4>
                <span className="status-value">
                  {sessionTimeouts.find(t => t.value === settings.sessionTimeout)?.label}
                </span>
              </div>
            </div>

            <div className={`status-item ${settings.allowedIPs.length > 0 ? 'secure' : 'neutral'}`}>
              <div className="status-icon">
                <MapPin size={20} />
              </div>
              <div className="status-info">
                <h4>IP Restrictions</h4>
                <span className="status-value">
                  {settings.allowedIPs.length > 0 
                    ? `${settings.allowedIPs.length} IP(s) allowed`
                    : 'No restrictions'
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="security-score">
            <div className="score-header">
              <h4>Security Score</h4>
              <div className="score-value">
                <span className="score-number">85</span>
                <span className="score-suffix">/100</span>
              </div>
            </div>
            <div className="score-bar">
              <div className="score-fill" style={{ width: '85%' }}></div>
            </div>
            <p className="score-description">
              Your account security is strong. Consider enabling two-factor authentication for maximum protection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;