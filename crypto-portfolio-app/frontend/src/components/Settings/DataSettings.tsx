import React, { useState } from 'react';
import { Database, Download, Upload, Trash2, Shield, BarChart3, Cloud, HardDrive } from 'lucide-react';
import { DataSettings as DataSettingsType } from '../../types/settings.types';

interface DataSettingsProps {
  settings: DataSettingsType;
  onUpdate: (updates: Partial<DataSettingsType>) => void;
}

const DataSettings: React.FC<DataSettingsProps> = ({ settings, onUpdate }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isClearing, setIsClearing] = useState(false);

  const handleSettingChange = (key: keyof DataSettingsType, value: any) => {
    onUpdate({ [key]: value });
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportProgress(0);

    // Simulate export progress
    const progressInterval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsExporting(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);

    // In a real app, this would export actual data
    setTimeout(() => {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        portfolio: {
          assets: [],
          transactions: [],
          settings: settings
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `portfolio-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }, 3000);
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.xlsx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // In a real app, this would process the imported file
        console.log('Importing file:', file.name);
      }
    };
    input.click();
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all portfolio data? This action cannot be undone.')) {
      setIsClearing(true);
      // Simulate data clearing
      setTimeout(() => {
        setIsClearing(false);
        alert('Portfolio data cleared successfully.');
      }, 2000);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="data-settings">
      <div className="settings-section">
        <h2>Data Management</h2>
        <p className="section-description">
          Manage your portfolio data, backups, and privacy preferences
        </p>

        <div className="data-section">
          <div className="data-item">
            <div className="data-item-header">
              <div className="data-item-icon">
                <BarChart3 size={20} />
              </div>
              <div className="data-item-info">
                <h3>Analytics & Tracking</h3>
                <p>Enable usage analytics to help improve the application</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.enableAnalytics}
                  onChange={(e) => handleSettingChange('enableAnalytics', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>

          <div className="data-item">
            <div className="data-item-header">
              <div className="data-item-icon">
                <Shield size={20} />
              </div>
              <div className="data-item-info">
                <h3>Share Anonymous Data</h3>
                <p>Help improve the app by sharing anonymized usage data</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.shareAnonymousData}
                  onChange={(e) => handleSettingChange('shareAnonymousData', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>

          <div className="data-item">
            <div className="data-item-header">
              <div className="data-item-icon">
                <HardDrive size={20} />
              </div>
              <div className="data-item-info">
                <h3>Enable Local Cache</h3>
                <p>Cache data locally for faster loading times</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.enableCache}
                  onChange={(e) => handleSettingChange('enableCache', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </div>

          {settings.enableCache && (
            <div className="cache-settings">
              <div className="setting-group">
                <label className="setting-label">Cache Size Limit</label>
                <div className="cache-size-selector">
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={settings.cacheSize}
                    onChange={(e) => handleSettingChange('cacheSize', parseInt(e.target.value))}
                    className="cache-slider"
                  />
                  <span className="cache-size-value">{settings.cacheSize} MB</span>
                </div>
                <p className="setting-hint">
                  Higher cache sizes improve performance but use more storage space
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h2>Backup & Sync</h2>
        <p className="section-description">
          Configure automatic backups and data synchronization
        </p>

        <div className="backup-section">
          <div className="backup-item">
            <div className="backup-item-header">
              <div className="backup-item-icon">
                <Cloud size={20} />
              </div>
              <div className="backup-item-info">
                <h3>Automatic Backup</h3>
                <p>Automatically backup your portfolio data</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoBackup}
                  onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            {settings.autoBackup && (
              <div className="backup-options">
                <div className="setting-group">
                  <label className="setting-label">Backup Frequency</label>
                  <select
                    value={settings.backupFrequency}
                    onChange={(e) => handleSettingChange('backupFrequency', e.target.value)}
                    className="setting-select"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label className="setting-label">Include Historical Data</label>
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={settings.includeHistoricalData}
                      onChange={(e) => handleSettingChange('includeHistoricalData', e.target.checked)}
                    />
                    <span>Include all transaction history in backups</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="backup-status">
            <h4>Backup Status</h4>
            <div className="backup-info">
              <div className="backup-stat">
                <span className="stat-label">Last Backup:</span>
                <span className="stat-value">2 days ago</span>
              </div>
              <div className="backup-stat">
                <span className="stat-label">Backup Size:</span>
                <span className="stat-value">2.4 MB</span>
              </div>
              <div className="backup-stat">
                <span className="stat-label">Next Backup:</span>
                <span className="stat-value">Tomorrow at 3:00 AM</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Data Retention</h2>
        <p className="section-description">
          Control how long your data is stored
        </p>

        <div className="retention-section">
          <div className="setting-group">
            <label className="setting-label">Data Retention Period</label>
            <select
              value={settings.dataRetentionDays}
              onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
              className="setting-select"
            >
              <option value={30}>30 days</option>
              <option value={90}>3 months</option>
              <option value={180}>6 months</option>
              <option value={365}>1 year</option>
              <option value={730}>2 years</option>
              <option value={-1}>Keep forever</option>
            </select>
            <p className="setting-hint">
              {settings.dataRetentionDays === -1 
                ? 'Data will be kept indefinitely'
                : `Data older than ${settings.dataRetentionDays} days will be automatically deleted`
              }
            </p>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Import & Export</h2>
        <p className="section-description">
          Import data from other platforms or export your portfolio
        </p>

        <div className="import-export-section">
          <div className="setting-group">
            <label className="setting-label">Export Format</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportFormat"
                  value="json"
                  checked={settings.exportFormat === 'json'}
                  onChange={(e) => handleSettingChange('exportFormat', e.target.value)}
                />
                <span>JSON</span>
                <small>Complete data with full structure</small>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportFormat"
                  value="csv"
                  checked={settings.exportFormat === 'csv'}
                  onChange={(e) => handleSettingChange('exportFormat', e.target.value)}
                />
                <span>CSV</span>
                <small>Spreadsheet compatible format</small>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="exportFormat"
                  value="xlsx"
                  checked={settings.exportFormat === 'xlsx'}
                  onChange={(e) => handleSettingChange('exportFormat', e.target.value)}
                />
                <span>Excel (XLSX)</span>
                <small>Microsoft Excel format</small>
              </label>
            </div>
          </div>

          <div className="export-actions">
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="export-btn"
            >
              <Download size={16} />
              {isExporting ? 'Exporting...' : 'Export Portfolio Data'}
            </button>

            <button
              onClick={handleImportData}
              className="import-btn"
            >
              <Upload size={16} />
              Import Data
            </button>
          </div>

          {isExporting && (
            <div className="export-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
              <span className="progress-text">{exportProgress}% Complete</span>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h2>Data Usage</h2>
        <p className="section-description">
          Monitor your data usage and storage
        </p>

        <div className="usage-section">
          <div className="usage-stats">
            <div className="usage-stat">
              <div className="stat-icon">
                <Database size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-value">2.4 MB</span>
                <span className="stat-label">Total Data Size</span>
              </div>
            </div>

            <div className="usage-stat">
              <div className="stat-icon">
                <BarChart3 size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-value">1,247</span>
                <span className="stat-label">Transactions</span>
              </div>
            </div>

            <div className="usage-stat">
              <div className="stat-icon">
                <Cloud size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-value">850 KB</span>
                <span className="stat-label">Cache Size</span>
              </div>
            </div>
          </div>

          <div className="storage-breakdown">
            <h4>Storage Breakdown</h4>
            <div className="breakdown-list">
              <div className="breakdown-item">
                <span className="breakdown-label">Transaction History</span>
                <span className="breakdown-value">1.8 MB</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Price Data</span>
                <span className="breakdown-value">450 KB</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Settings & Preferences</span>
                <span className="breakdown-value">150 KB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section danger-zone">
        <h2>Danger Zone</h2>
        <p className="section-description">
          Irreversible actions that will permanently delete your data
        </p>

        <div className="danger-actions">
          <div className="danger-item">
            <div className="danger-info">
              <h3>Clear All Data</h3>
              <p>Permanently delete all portfolio data, transactions, and settings. This cannot be undone.</p>
            </div>
            <button
              onClick={handleClearData}
              disabled={isClearing}
              className="danger-btn"
            >
              <Trash2 size={16} />
              {isClearing ? 'Clearing...' : 'Clear All Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSettings;