import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Key, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { ApiKeyData } from '../../types/settings.types';

interface ApiKeyManagerProps {
  apiKeys: ApiKeyData[];
  onUpdate: (apiKeys: ApiKeyData[]) => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ apiKeys, onUpdate }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [newKeyForm, setNewKeyForm] = useState({
    exchangeName: '',
    keyName: '',
    apiKey: '',
    secretKey: '',
    passphrase: '',
    permissions: [] as string[]
  });

  const supportedExchanges = [
    { id: 'binance', name: 'Binance', logo: '🔶' },
    { id: 'coinbase', name: 'Coinbase Pro', logo: '🔵' },
    { id: 'kraken', name: 'Kraken', logo: '🐙' },
    { id: 'bitfinex', name: 'Bitfinex', logo: '🟢' },
    { id: 'huobi', name: 'Huobi', logo: '🔴' },
    { id: 'okx', name: 'OKX', logo: '⚫' }
  ];

  const availablePermissions = [
    { id: 'read', name: 'Read Portfolio', description: 'View account balances and positions' },
    { id: 'trade', name: 'Execute Trades', description: 'Place buy/sell orders' },
    { id: 'withdraw', name: 'Withdrawals', description: 'Withdraw funds from exchange' },
    { id: 'deposit', name: 'Deposits', description: 'View deposit addresses and history' }
  ];

  const handleAddKey = () => {
    const newKey: ApiKeyData = {
      id: `key_${Date.now()}`,
      ...newKeyForm,
      isActive: true,
      createdAt: new Date()
    };

    onUpdate([...apiKeys, newKey]);
    setNewKeyForm({
      exchangeName: '',
      keyName: '',
      apiKey: '',
      secretKey: '',
      passphrase: '',
      permissions: []
    });
    setShowAddForm(false);
  };

  const handleDeleteKey = (keyId: string) => {
    if (window.confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      onUpdate(apiKeys.filter(key => key.id !== keyId));
    }
  };

  const handleToggleActive = (keyId: string) => {
    onUpdate(apiKeys.map(key => 
      key.id === keyId ? { ...key, isActive: !key.isActive } : key
    ));
  };

  const toggleSecretVisibility = (keyId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    const updatedPermissions = checked
      ? [...newKeyForm.permissions, permission]
      : newKeyForm.permissions.filter(p => p !== permission);
    
    setNewKeyForm(prev => ({ ...prev, permissions: updatedPermissions }));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getExchangeInfo = (exchangeName: string) => {
    return supportedExchanges.find(ex => ex.id === exchangeName) || 
           { id: exchangeName, name: exchangeName, logo: '🔑' };
  };

  return (
    <div className="api-key-manager">
      <div className="settings-section">
        <div className="section-header">
          <div>
            <h2>Exchange API Keys</h2>
            <p className="section-description">
              Connect your exchange accounts to automatically sync your portfolio
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="add-key-btn"
          >
            <Plus size={16} />
            Add API Key
          </button>
        </div>

        <div className="security-notice">
          <AlertTriangle className="notice-icon" size={20} />
          <div className="notice-content">
            <h3>Security Notice</h3>
            <p>API keys are encrypted and stored securely. We recommend using read-only keys when possible.</p>
            <ul>
              <li>Never share your API keys with anyone</li>
              <li>Regularly rotate your API keys</li>
              <li>Use IP restrictions on your exchange accounts</li>
              <li>Monitor your API key usage regularly</li>
            </ul>
          </div>
        </div>

        {apiKeys.length === 0 ? (
          <div className="no-keys">
            <div className="no-keys-content">
              <Key className="no-keys-icon" size={48} />
              <h3>No API Keys Configured</h3>
              <p>Add your first exchange API key to start syncing your portfolio automatically.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="add-first-key-btn"
              >
                <Plus size={16} />
                Add Your First API Key
              </button>
            </div>
          </div>
        ) : (
          <div className="api-keys-list">
            {apiKeys.map((keyData) => {
              const exchangeInfo = getExchangeInfo(keyData.exchangeName);
              
              return (
                <div key={keyData.id} className="api-key-card">
                  <div className="key-header">
                    <div className="key-info">
                      <div className="exchange-info">
                        <span className="exchange-logo">{exchangeInfo.logo}</span>
                        <div>
                          <h3>{keyData.keyName}</h3>
                          <p className="exchange-name">{exchangeInfo.name}</p>
                        </div>
                      </div>
                      
                      <div className="key-status">
                        <div className={`status-badge ${keyData.isActive ? 'active' : 'inactive'}`}>
                          {keyData.isActive ? (
                            <>
                              <CheckCircle size={12} />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle size={12} />
                              Inactive
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="key-actions">
                      <button
                        onClick={() => handleToggleActive(keyData.id)}
                        className={`toggle-btn ${keyData.isActive ? 'active' : 'inactive'}`}
                        title={keyData.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {keyData.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      
                      <button
                        onClick={() => setEditingKey(keyData.id)}
                        className="edit-btn"
                        title="Edit API Key"
                      >
                        <Edit size={16} />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteKey(keyData.id)}
                        className="delete-btn"
                        title="Delete API Key"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="key-details">
                    <div className="key-field">
                      <label>API Key</label>
                      <div className="secret-field">
                        <code className="secret-value">
                          {showSecrets[keyData.id] 
                            ? keyData.apiKey 
                            : `${keyData.apiKey.substring(0, 8)}...${keyData.apiKey.substring(keyData.apiKey.length - 4)}`
                          }
                        </code>
                        <button
                          onClick={() => toggleSecretVisibility(keyData.id)}
                          className="toggle-secret-btn"
                        >
                          {showSecrets[keyData.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="key-permissions">
                      <label>Permissions</label>
                      <div className="permissions-list">
                        {keyData.permissions.map(permission => {
                          const permInfo = availablePermissions.find(p => p.id === permission);
                          return (
                            <span key={permission} className="permission-badge">
                              {permInfo?.name || permission}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="key-metadata">
                      <div className="metadata-item">
                        <span className="metadata-label">Created:</span>
                        <span className="metadata-value">{formatDate(keyData.createdAt)}</span>
                      </div>
                      {keyData.lastUsed && (
                        <div className="metadata-item">
                          <span className="metadata-label">Last used:</span>
                          <span className="metadata-value">{formatDate(keyData.lastUsed)}</span>
                        </div>
                      )}
                      {keyData.expiresAt && (
                        <div className="metadata-item">
                          <span className="metadata-label">Expires:</span>
                          <span className="metadata-value">{formatDate(keyData.expiresAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-container large">
            <div className="modal-header">
              <h3>Add Exchange API Key</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="modal-close-btn"
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <form className="api-key-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Exchange</label>
                    <select
                      value={newKeyForm.exchangeName}
                      onChange={(e) => setNewKeyForm(prev => ({ ...prev, exchangeName: e.target.value }))}
                      className="form-select"
                    >
                      <option value="">Select exchange</option>
                      {supportedExchanges.map(exchange => (
                        <option key={exchange.id} value={exchange.id}>
                          {exchange.logo} {exchange.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Key Name</label>
                    <input
                      type="text"
                      value={newKeyForm.keyName}
                      onChange={(e) => setNewKeyForm(prev => ({ ...prev, keyName: e.target.value }))}
                      className="form-input"
                      placeholder="e.g., My Trading Account"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>API Key</label>
                  <input
                    type="text"
                    value={newKeyForm.apiKey}
                    onChange={(e) => setNewKeyForm(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="form-input"
                    placeholder="Enter your API key"
                  />
                </div>

                <div className="form-group">
                  <label>Secret Key</label>
                  <input
                    type="password"
                    value={newKeyForm.secretKey}
                    onChange={(e) => setNewKeyForm(prev => ({ ...prev, secretKey: e.target.value }))}
                    className="form-input"
                    placeholder="Enter your secret key"
                  />
                </div>

                <div className="form-group">
                  <label>Passphrase (if required)</label>
                  <input
                    type="password"
                    value={newKeyForm.passphrase}
                    onChange={(e) => setNewKeyForm(prev => ({ ...prev, passphrase: e.target.value }))}
                    className="form-input"
                    placeholder="Enter passphrase (optional)"
                  />
                </div>

                <div className="form-group">
                  <label>Permissions</label>
                  <div className="permissions-grid">
                    {availablePermissions.map(permission => (
                      <label key={permission.id} className="permission-checkbox">
                        <input
                          type="checkbox"
                          checked={newKeyForm.permissions.includes(permission.id)}
                          onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                        />
                        <div className="permission-info">
                          <span className="permission-name">{permission.name}</span>
                          <span className="permission-description">{permission.description}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowAddForm(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleAddKey}
                className="add-btn"
                disabled={!newKeyForm.exchangeName || !newKeyForm.keyName || !newKeyForm.apiKey}
              >
                Add API Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManager;