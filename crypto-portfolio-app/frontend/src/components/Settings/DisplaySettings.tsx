import React, { useState } from 'react';
import { Palette, Monitor, Sun, Moon, Globe, Type, Eye, Grid, List, Sliders } from 'lucide-react';
import { DisplaySettings as DisplaySettingsType, ThemeDefinition } from '../../types/settings.types';
import { useTheme } from '../../hooks/useSettings/useTheme';

interface DisplaySettingsProps {
  settings: DisplaySettingsType;
  onUpdate: (updates: Partial<DisplaySettingsType>) => void;
}

const DisplaySettings: React.FC<DisplaySettingsProps> = ({ settings, onUpdate }) => {
  const { themes, currentTheme, setTheme, createCustomTheme } = useTheme();
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);

  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'BTC', name: 'Bitcoin', symbol: '₿' },
    { code: 'ETH', name: 'Ethereum', symbol: 'Ξ' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' }
  ];

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' }
  ];

  const dateFormats = [
    { format: 'MM/dd/yyyy', example: '12/31/2023', region: 'US' },
    { format: 'dd/MM/yyyy', example: '31/12/2023', region: 'EU' },
    { format: 'yyyy-MM-dd', example: '2023-12-31', region: 'ISO' },
    { format: 'MMM dd, yyyy', example: 'Dec 31, 2023', region: 'Long' },
    { format: 'dd MMM yyyy', example: '31 Dec 2023', region: 'Long EU' }
  ];

  const numberFormats = [
    { format: 'standard', example: '1,234.56', description: 'US/UK Standard' },
    { format: 'european', example: '1.234,56', description: 'European' },
    { format: 'indian', example: '1,23,456', description: 'Indian Numbering' },
    { format: 'compact', example: '1.23K', description: 'Compact (K/M/B)' }
  ];

  const timezones = [
    'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Mumbai', 'Asia/Singapore',
    'Australia/Sydney', 'Australia/Melbourne'
  ];

  const fontSizes = [
    { size: 12, label: 'Small' },
    { size: 14, label: 'Medium' },
    { size: 16, label: 'Large' },
    { size: 18, label: 'Extra Large' },
    { size: 20, label: 'Huge' }
  ];

  const handleSettingChange = (key: keyof DisplaySettingsType, value: any) => {
    onUpdate({ [key]: value });
  };

  const handleCustomColorChange = (colorKey: string, value: string) => {
    const updatedColors = {
      ...settings.customColors,
      [colorKey]: value
    };
    handleSettingChange('customColors', updatedColors);
    
    // Create and apply custom theme
    const customTheme = createCustomTheme({
      name: 'Custom',
      primaryColor: updatedColors.primary,
      accentColor: updatedColors.accent
    });
    setTheme(customTheme.id);
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light': return <Sun size={20} />;
      case 'dark': return <Moon size={20} />;
      case 'auto': return <Monitor size={20} />;
      default: return <Palette size={20} />;
    }
  };

  return (
    <div className="display-settings">
      <div className="settings-section">
        <h2>Theme & Appearance</h2>
        <p className="section-description">
          Customize the look and feel of your portfolio dashboard
        </p>

        <div className="theme-section">
          <div className="setting-group">
            <label className="setting-label">
              <Palette size={16} />
              Theme Selection
            </label>
            
            <div className="theme-grid">
              {themes.slice(0, 3).map((theme) => (
                <div
                  key={theme.id}
                  className={`theme-card ${currentTheme.id === theme.id ? 'active' : ''}`}
                  onClick={() => setTheme(theme.id)}
                >
                  <div className="theme-preview">
                    <div 
                      className="theme-color-bar" 
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      <div 
                        className="theme-accent" 
                        style={{ backgroundColor: theme.accentColor }}
                      ></div>
                    </div>
                    <div className="theme-content">
                      <div className="theme-header" style={{ backgroundColor: theme.backgroundColor }}>
                        <div className="theme-text" style={{ color: theme.textColor }}></div>
                      </div>
                      <div className="theme-body" style={{ backgroundColor: theme.surfaceColor }}>
                        <div className="theme-card-sample"></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="theme-info">
                    <div className="theme-icon">
                      {getThemeIcon(theme.id)}
                    </div>
                    <div className="theme-details">
                      <span className="theme-name">{theme.displayName}</span>
                      <span className="theme-type">{theme.isDark ? 'Dark' : 'Light'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <div className="setting-header">
              <label className="setting-label">
                <Type size={16} />
                Custom Colors
              </label>
              <button
                onClick={() => setShowCustomColorPicker(!showCustomColorPicker)}
                className="toggle-custom-colors"
              >
                {showCustomColorPicker ? 'Hide' : 'Customize'}
              </button>
            </div>

            {showCustomColorPicker && (
              <div className="custom-color-section">
                <div className="color-grid">
                  <div className="color-input-group">
                    <label>Primary Color</label>
                    <div className="color-input-container">
                      <input
                        type="color"
                        value={settings.customColors.primary}
                        onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                        className="color-picker"
                      />
                      <span className="color-value">{settings.customColors.primary}</span>
                    </div>
                  </div>

                  <div className="color-input-group">
                    <label>Accent Color</label>
                    <div className="color-input-container">
                      <input
                        type="color"
                        value={settings.customColors.accent}
                        onChange={(e) => handleCustomColorChange('accent', e.target.value)}
                        className="color-picker"
                      />
                      <span className="color-value">{settings.customColors.accent}</span>
                    </div>
                  </div>

                  <div className="color-input-group">
                    <label>Success Color</label>
                    <div className="color-input-container">
                      <input
                        type="color"
                        value={settings.customColors.success}
                        onChange={(e) => handleCustomColorChange('success', e.target.value)}
                        className="color-picker"
                      />
                      <span className="color-value">{settings.customColors.success}</span>
                    </div>
                  </div>

                  <div className="color-input-group">
                    <label>Warning Color</label>
                    <div className="color-input-container">
                      <input
                        type="color"
                        value={settings.customColors.warning}
                        onChange={(e) => handleCustomColorChange('warning', e.target.value)}
                        className="color-picker"
                      />
                      <span className="color-value">{settings.customColors.warning}</span>
                    </div>
                  </div>

                  <div className="color-input-group">
                    <label>Error Color</label>
                    <div className="color-input-container">
                      <input
                        type="color"
                        value={settings.customColors.error}
                        onChange={(e) => handleCustomColorChange('error', e.target.value)}
                        className="color-picker"
                      />
                      <span className="color-value">{settings.customColors.error}</span>
                    </div>
                  </div>
                </div>

                <div className="color-presets">
                  <span className="preset-label">Quick presets:</span>
                  <button 
                    className="preset-btn blue"
                    onClick={() => {
                      handleCustomColorChange('primary', '#007bff');
                      handleCustomColorChange('accent', '#28a745');
                    }}
                  >
                    Blue
                  </button>
                  <button 
                    className="preset-btn green"
                    onClick={() => {
                      handleCustomColorChange('primary', '#28a745');
                      handleCustomColorChange('accent', '#17a2b8');
                    }}
                  >
                    Green
                  </button>
                  <button 
                    className="preset-btn purple"
                    onClick={() => {
                      handleCustomColorChange('primary', '#6f42c1');
                      handleCustomColorChange('accent', '#e83e8c');
                    }}
                  >
                    Purple
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <Type size={16} />
              Font Size
            </label>
            
            <div className="font-size-section">
              <div className="font-size-slider">
                <input
                  type="range"
                  min="12"
                  max="20"
                  value={settings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
                  className="slider"
                />
                <div className="slider-labels">
                  {fontSizes.map(({ size, label }) => (
                    <span 
                      key={size}
                      className={`slider-label ${settings.fontSize === size ? 'active' : ''}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="font-preview" style={{ fontSize: `${settings.fontSize}px` }}>
                Preview text at {settings.fontSize}px
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Localization</h2>
        <p className="section-description">
          Set your preferred language, currency, and regional formats
        </p>

        <div className="localization-section">
          <div className="setting-row">
            <div className="setting-group">
              <label className="setting-label">
                <Globe size={16} />
                Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
                className="setting-select"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Primary Currency</label>
              <select
                value={settings.currency}
                onChange={(e) => handleSettingChange('currency', e.target.value)}
                className="setting-select"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.name} ({currency.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-group">
              <label className="setting-label">Date Format</label>
              <select
                value={settings.dateFormat}
                onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
                className="setting-select"
              >
                {dateFormats.map((format) => (
                  <option key={format.format} value={format.format}>
                    {format.example} ({format.region})
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Number Format</label>
              <select
                value={settings.numberFormat}
                onChange={(e) => handleSettingChange('numberFormat', e.target.value)}
                className="setting-select"
              >
                {numberFormats.map((format) => (
                  <option key={format.format} value={format.format}>
                    {format.example} - {format.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => handleSettingChange('timezone', e.target.value)}
              className="setting-select"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Dashboard Layout</h2>
        <p className="section-description">
          Customize how your portfolio data is displayed
        </p>

        <div className="layout-section">
          <div className="setting-group">
            <label className="setting-label">
              <Eye size={16} />
              Default View Mode
            </label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="defaultView"
                  value="grid"
                  checked={settings.defaultView === 'grid'}
                  onChange={(e) => handleSettingChange('defaultView', e.target.value)}
                />
                <Grid size={16} />
                <span>Grid View</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="defaultView"
                  value="list"
                  checked={settings.defaultView === 'list'}
                  onChange={(e) => handleSettingChange('defaultView', e.target.value)}
                />
                <List size={16} />
                <span>List View</span>
              </label>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <Sliders size={16} />
              Cards Per Row (Grid View)
            </label>
            <div className="cards-per-row-selector">
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  className={`cards-option ${settings.cardsPerRow === count ? 'active' : ''}`}
                  onClick={() => handleSettingChange('cardsPerRow', count)}
                >
                  <div className="cards-preview">
                    {Array.from({ length: count }, (_, i) => (
                      <div key={i} className="card-preview"></div>
                    ))}
                  </div>
                  <span>{count} Cards</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">Display Options</label>
            <div className="checkbox-grid">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={settings.showSparklines}
                  onChange={(e) => handleSettingChange('showSparklines', e.target.checked)}
                />
                <span>Show price sparklines</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={settings.showPercentageChanges}
                  onChange={(e) => handleSettingChange('showPercentageChanges', e.target.checked)}
                />
                <span>Show percentage changes</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={settings.showMarketCap}
                  onChange={(e) => handleSettingChange('showMarketCap', e.target.checked)}
                />
                <span>Show market cap information</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={settings.animateChanges}
                  onChange={(e) => handleSettingChange('animateChanges', e.target.checked)}
                />
                <span>Animate price changes</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                />
                <span>Compact mode</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={settings.showTooltips}
                  onChange={(e) => handleSettingChange('showTooltips', e.target.checked)}
                />
                <span>Show helpful tooltips</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisplaySettings;