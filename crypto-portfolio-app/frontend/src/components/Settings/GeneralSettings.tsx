import React, { useState } from 'react';
import { Camera, Edit3, Save, X, Eye, EyeOff, Smartphone, Globe } from 'lucide-react';
import { GeneralSettings as GeneralSettingsType } from '../../types/settings.types';

interface GeneralSettingsProps {
  settings: GeneralSettingsType;
  onUpdate: (updates: Partial<GeneralSettingsType>) => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, onUpdate }) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'UK', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'JP', name: 'Japan' },
    { code: 'AU', name: 'Australia' },
    { code: 'SG', name: 'Singapore' }
  ];

  const handleSettingChange = (key: keyof GeneralSettingsType, value: any) => {
    onUpdate({ [key]: value });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfileImagePreview(result);
        handleSettingChange('profilePicture', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTwoFactorToggle = () => {
    if (!settings.enableTwoFactor) {
      setShowTwoFactorSetup(true);
    } else {
      // Disable 2FA
      handleSettingChange('enableTwoFactor', false);
    }
  };

  const handleTwoFactorSetup = () => {
    // In a real app, this would initiate the 2FA setup process
    handleSettingChange('enableTwoFactor', true);
    setShowTwoFactorSetup(false);
  };

  return (
    <div className="general-settings">
      <div className="settings-section">
        <h2>Profile Information</h2>
        <p className="section-description">
          Manage your account details and public profile information
        </p>

        <div className="profile-section">
          <div className="profile-picture-section">
            <div className="profile-picture-container">
              <div className="profile-picture">
                {profileImagePreview || settings.profilePicture ? (
                  <img
                    src={profileImagePreview || settings.profilePicture || ''}
                    alt="Profile"
                    className="profile-image"
                  />
                ) : (
                  <div className="profile-placeholder">
                    <span className="profile-initials">
                      {settings.username ? settings.username.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                )}
                
                <label htmlFor="profile-upload" className="upload-overlay">
                  <Camera size={20} />
                  <span>Change</span>
                </label>
                
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden-file-input"
                />
              </div>
            </div>

            <div className="profile-picture-info">
              <h3>Profile Picture</h3>
              <p>Upload a profile picture to personalize your account</p>
              <div className="image-requirements">
                <small>• Recommended size: 200x200px</small>
                <small>• Maximum file size: 2MB</small>
                <small>• Supported formats: JPG, PNG, GIF</small>
              </div>
            </div>
          </div>

          <div className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Username
                  <span className="required">*</span>
                </label>
                <div className="input-with-icon">
                  <input
                    type="text"
                    value={settings.username}
                    onChange={(e) => handleSettingChange('username', e.target.value)}
                    className="form-input"
                    placeholder="Enter your username"
                    maxLength={30}
                  />
                  <Edit3 className="input-icon" size={16} />
                </div>
                <small className="form-hint">
                  Your username is visible to other users
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Email Address
                  <span className="required">*</span>
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleSettingChange('email', e.target.value)}
                  className="form-input"
                  placeholder="Enter your email"
                />
                <small className="form-hint">
                  Used for account notifications and recovery
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div className="input-with-icon">
                  <input
                    type="tel"
                    value={settings.phoneNumber || ''}
                    onChange={(e) => handleSettingChange('phoneNumber', e.target.value)}
                    className="form-input"
                    placeholder="+1 (555) 123-4567"
                  />
                  <Smartphone className="input-icon" size={16} />
                </div>
                <small className="form-hint">
                  Optional: Used for SMS notifications and 2FA
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Country</label>
                <div className="input-with-icon">
                  <select
                    value={settings.country || ''}
                    onChange={(e) => handleSettingChange('country', e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select your country</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  <Globe className="input-icon" size={16} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Bio</label>
              <textarea
                value={settings.bio || ''}
                onChange={(e) => handleSettingChange('bio', e.target.value)}
                className="form-textarea"
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={500}
              />
              <div className="character-count">
                {(settings.bio || '').length}/500 characters
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Security Settings</h2>
        <p className="section-description">
          Enhance your account security with two-factor authentication
        </p>

        <div className="security-section">
          <div className="security-item">
            <div className="security-item-header">
              <div className="security-item-info">
                <h3>Two-Factor Authentication</h3>
                <p>Add an extra layer of security to your account</p>
              </div>
              
              <div className="security-item-status">
                <div className={`status-badge ${settings.enableTwoFactor ? 'enabled' : 'disabled'}`}>
                  {settings.enableTwoFactor ? 'Enabled' : 'Disabled'}
                </div>
                
                <button
                  onClick={handleTwoFactorToggle}
                  className={`toggle-btn ${settings.enableTwoFactor ? 'enabled' : 'disabled'}`}
                >
                  {settings.enableTwoFactor ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            {settings.enableTwoFactor && (
              <div className="security-item-details">
                <div className="twofa-info">
                  <p>✅ Two-factor authentication is active on your account</p>
                  <p>You'll be prompted for a verification code when signing in</p>
                </div>
                
                <div className="twofa-actions">
                  <button className="secondary-btn">
                    View Backup Codes
                  </button>
                  <button className="secondary-btn">
                    Regenerate Codes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showTwoFactorSetup && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Set Up Two-Factor Authentication</h3>
              <button
                onClick={() => setShowTwoFactorSetup(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              <div className="twofa-setup">
                <div className="twofa-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Install Authenticator App</h4>
                    <p>Download and install an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator on your mobile device.</p>
                  </div>
                </div>

                <div className="twofa-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Scan QR Code</h4>
                    <div className="qr-code-placeholder">
                      <div className="qr-code">
                        {/* QR code would be generated here */}
                        <div className="qr-placeholder">QR Code</div>
                      </div>
                      <p>Or manually enter this key:</p>
                      <code className="manual-key">ABCD EFGH IJKL MNOP</code>
                    </div>
                  </div>
                </div>

                <div className="twofa-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Enter Verification Code</h4>
                    <p>Enter the 6-digit code from your authenticator app:</p>
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="verification-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowTwoFactorSetup(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleTwoFactorSetup}
                className="confirm-btn"
              >
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralSettings;