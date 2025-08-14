import React, { useState, useCallback } from 'react';
import { usePriceAlerts } from '../../hooks/usePriceAlerts';
import { PriceAlertManagerProps, PriceAlert, AlertDirection, NotificationFrequency } from '../../types/notification.types';

const PriceAlertManager: React.FC<PriceAlertManagerProps> = ({
  alerts: externalAlerts,
  onCreateAlert: externalOnCreateAlert,
  onUpdateAlert: externalOnUpdateAlert,
  onDeleteAlert: externalOnDeleteAlert,
  showCreateForm: externalShowCreateForm = false,
  className = ''
}) => {
  const [showCreateAlert, setShowCreateAlert] = useState(externalShowCreateForm);
  const [newAlert, setNewAlert] = useState({
    asset: '',
    threshold: '',
    direction: 'above' as AlertDirection,
    frequency: 'once' as NotificationFrequency,
    isActive: true,
    notificationChannels: ['in_app' as const, 'email' as const]
  });
  const [isCreating, setIsCreating] = useState(false);
  const [editingAlert, setEditingAlert] = useState<string | null>(null);
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [sortBy, setSortBy] = useState<'asset' | 'threshold' | 'created' | 'triggered'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const {
    alerts: hookAlerts,
    createAlert: hookCreateAlert,
    updateAlert: hookUpdateAlert,
    deleteAlert: hookDeleteAlert,
    toggleAlert,
    bulkToggle,
    bulkDelete,
    isLoading
  } = usePriceAlerts();

  // Use external alerts if provided, otherwise use hook alerts
  const alerts = externalAlerts || hookAlerts;
  const createAlert = externalOnCreateAlert || hookCreateAlert;
  const updateAlert = externalOnUpdateAlert || hookUpdateAlert;
  const deleteAlert = externalOnDeleteAlert || hookDeleteAlert;

  const handleCreateAlert = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating) return;
    
    setIsCreating(true);
    try {
      await createAlert({
        ...newAlert,
        threshold: parseFloat(newAlert.threshold),
        triggered: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Omit<PriceAlert, 'id' | 'userId'>);
      
      setNewAlert({
        asset: '',
        threshold: '',
        direction: 'above',
        frequency: 'once',
        isActive: true,
        notificationChannels: ['in_app', 'email']
      });
      setShowCreateAlert(false);
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
    setIsCreating(false);
  }, [newAlert, createAlert, isCreating]);

  const handleToggleAlert = useCallback(async (alertId: string) => {
    try {
      await toggleAlert(alertId);
    } catch (error) {
      console.error('Failed to toggle alert:', error);
    }
  }, [toggleAlert]);

  const handleDeleteAlert = useCallback(async (alertId: string) => {
    if (window.confirm('Are you sure you want to delete this price alert?')) {
      try {
        await deleteAlert(alertId);
        setSelectedAlerts(prev => prev.filter(id => id !== alertId));
      } catch (error) {
        console.error('Failed to delete alert:', error);
      }
    }
  }, [deleteAlert]);

  const handleBulkToggle = useCallback(async (isActive: boolean) => {
    if (selectedAlerts.length === 0) return;
    
    try {
      await bulkToggle(selectedAlerts, isActive);
      setSelectedAlerts([]);
      setShowBulkActions(false);
    } catch (error) {
      console.error('Failed to bulk toggle alerts:', error);
    }
  }, [selectedAlerts, bulkToggle]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedAlerts.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedAlerts.length} selected alerts?`)) {
      try {
        await bulkDelete(selectedAlerts);
        setSelectedAlerts([]);
        setShowBulkActions(false);
      } catch (error) {
        console.error('Failed to bulk delete alerts:', error);
      }
    }
  }, [selectedAlerts, bulkDelete]);

  const handleSelectAlert = useCallback((alertId: string, selected: boolean) => {
    if (selected) {
      setSelectedAlerts(prev => [...prev, alertId]);
    } else {
      setSelectedAlerts(prev => prev.filter(id => id !== alertId));
    }
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedAlerts(filteredAndSortedAlerts.map(alert => alert.id));
    } else {
      setSelectedAlerts([]);
    }
  }, []);

  // Filter and sort alerts
  const filteredAndSortedAlerts = React.useMemo(() => {
    let filtered = alerts;

    // Filter by active status
    if (filterActive === 'active') {
      filtered = filtered.filter(alert => alert.isActive);
    } else if (filterActive === 'inactive') {
      filtered = filtered.filter(alert => !alert.isActive);
    }

    // Sort alerts
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'asset':
          comparison = a.asset.localeCompare(b.asset);
          break;
        case 'threshold':
          comparison = a.threshold - b.threshold;
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'triggered':
          comparison = (a.triggered ? 1 : 0) - (b.triggered ? 1 : 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [alerts, filterActive, sortBy, sortOrder]);

  const formatThreshold = (threshold: number, direction: AlertDirection) => {
    return `${direction === 'above' ? '≥' : '≤'} $${threshold.toLocaleString()}`;
  };

  const getDirectionIcon = (direction: AlertDirection) => {
    return direction === 'above' ? '📈' : '📉';
  };

  const getFrequencyLabel = (frequency: NotificationFrequency) => {
    const labels = {
      once: 'Once',
      daily: 'Daily',
      weekly: 'Weekly',
      always: 'Always'
    };
    return labels[frequency] || frequency;
  };

  return (
    <div className={`price-alert-manager ${className}`}>
      {/* Header */}
      <div className="alert-header">
        <div className="header-title">
          <h2>Price Alerts</h2>
          <span className="alert-count">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
            {alerts.filter(a => a.isActive).length !== alerts.length && (
              <span className="active-count">
                • {alerts.filter(a => a.isActive).length} active
              </span>
            )}
          </span>
        </div>
        
        <div className="header-actions">
          {selectedAlerts.length > 0 && (
            <div className="bulk-actions">
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="bulk-toggle"
              >
                {selectedAlerts.length} selected
              </button>
              
              {showBulkActions && (
                <div className="bulk-action-menu">
                  <button
                    onClick={() => handleBulkToggle(true)}
                    className="bulk-action enable"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={() => handleBulkToggle(false)}
                    className="bulk-action disable"
                  >
                    Disable All
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="bulk-action delete"
                  >
                    Delete All
                  </button>
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => setShowCreateAlert(true)}
            className="create-alert-btn"
            disabled={showCreateAlert}
          >
            + Create Alert
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="alert-controls">
        <div className="filter-controls">
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
            className="filter-select"
          >
            <option value="all">All Alerts</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div className="sort-controls">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="sort-select"
          >
            <option value="created">Sort by Created</option>
            <option value="asset">Sort by Asset</option>
            <option value="threshold">Sort by Price</option>
            <option value="triggered">Sort by Status</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="sort-order"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {filteredAndSortedAlerts.length > 0 && (
          <div className="select-controls">
            <input
              type="checkbox"
              checked={selectedAlerts.length === filteredAndSortedAlerts.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              id="select-all"
            />
            <label htmlFor="select-all">Select All</label>
          </div>
        )}
      </div>

      {/* Create Alert Form */}
      {showCreateAlert && (
        <div className="create-alert-form">
          <h3>Create New Price Alert</h3>
          <form onSubmit={handleCreateAlert}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="asset">Asset Symbol</label>
                <input
                  id="asset"
                  type="text"
                  value={newAlert.asset}
                  onChange={(e) => setNewAlert({ ...newAlert, asset: e.target.value.toUpperCase() })}
                  placeholder="e.g., BTC, ETH, ADA"
                  required
                  maxLength={10}
                />
              </div>

              <div className="form-group">
                <label htmlFor="threshold">Price Threshold</label>
                <input
                  id="threshold"
                  type="number"
                  value={newAlert.threshold}
                  onChange={(e) => setNewAlert({ ...newAlert, threshold: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="direction">Alert Direction</label>
                <select
                  id="direction"
                  value={newAlert.direction}
                  onChange={(e) => setNewAlert({ ...newAlert, direction: e.target.value as AlertDirection })}
                >
                  <option value="above">Above (≥) - Price rises to or above threshold</option>
                  <option value="below">Below (≤) - Price falls to or below threshold</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="frequency">Alert Frequency</label>
                <select
                  id="frequency"
                  value={newAlert.frequency}
                  onChange={(e) => setNewAlert({ ...newAlert, frequency: e.target.value as NotificationFrequency })}
                >
                  <option value="once">Once - Alert only once when triggered</option>
                  <option value="daily">Daily - Alert once per day when active</option>
                  <option value="always">Always - Alert every time threshold is crossed</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="create-btn"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Alert'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateAlert(false)}
                className="cancel-btn"
                disabled={isCreating}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alerts List */}
      <div className="alerts-list">
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading price alerts...</p>
          </div>
        ) : filteredAndSortedAlerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <h3>No price alerts found</h3>
            <p>
              {alerts.length === 0 
                ? "Create your first alert to get notified when prices hit your target."
                : "No alerts match your current filter criteria."
              }
            </p>
            {alerts.length === 0 && (
              <button
                onClick={() => setShowCreateAlert(true)}
                className="create-first-alert"
              >
                Create Your First Alert
              </button>
            )}
          </div>
        ) : (
          filteredAndSortedAlerts.map(alert => (
            <div 
              key={alert.id} 
              className={`alert-item ${alert.isActive ? 'active' : 'inactive'} ${alert.triggered ? 'triggered' : ''} ${selectedAlerts.includes(alert.id) ? 'selected' : ''}`}
            >
              <div className="alert-select">
                <input
                  type="checkbox"
                  checked={selectedAlerts.includes(alert.id)}
                  onChange={(e) => handleSelectAlert(alert.id, e.target.checked)}
                  id={`alert-${alert.id}`}
                />
              </div>

              <div className="alert-info">
                <div className="alert-asset">
                  {alert.assetIcon && (
                    <img src={alert.assetIcon} alt={alert.asset} className="asset-icon" />
                  )}
                  <span className="asset-symbol">{alert.asset}</span>
                  <span className="direction-icon">{getDirectionIcon(alert.direction)}</span>
                </div>
                
                <div className="alert-condition">
                  <span className="threshold">
                    {formatThreshold(alert.threshold, alert.direction)}
                  </span>
                  <span className="frequency">• {getFrequencyLabel(alert.frequency)}</span>
                </div>

                <div className="alert-status">
                  {alert.triggered && (
                    <span className="triggered-badge">
                      ✓ Triggered
                      {alert.triggeredAt && (
                        <span className="trigger-time">
                          {new Date(alert.triggeredAt).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="created-date">
                    Created {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="alert-channels">
                  {alert.notificationChannels.map(channel => (
                    <span key={channel} className={`channel-badge ${channel}`}>
                      {channel === 'in_app' ? '📱' : channel === 'email' ? '📧' : channel === 'push' ? '🔔' : '📨'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="alert-actions">
                <button
                  onClick={() => handleToggleAlert(alert.id)}
                  className={`toggle-btn ${alert.isActive ? 'active' : 'inactive'}`}
                  title={alert.isActive ? 'Disable alert' : 'Enable alert'}
                  aria-label={alert.isActive ? 'Disable alert' : 'Enable alert'}
                >
                  {alert.isActive ? '🔔' : '🔕'}
                </button>
                
                <button
                  onClick={() => setEditingAlert(editingAlert === alert.id ? null : alert.id)}
                  className="edit-btn"
                  title="Edit alert"
                  aria-label="Edit alert"
                >
                  ✏️
                </button>
                
                <button
                  onClick={() => handleDeleteAlert(alert.id)}
                  className="delete-btn"
                  title="Delete alert"
                  aria-label="Delete alert"
                >
                  🗑️
                </button>
              </div>

              {/* Inline Edit Form */}
              {editingAlert === alert.id && (
                <div className="inline-edit-form">
                  <div className="edit-form-content">
                    <h4>Edit Price Alert</h4>
                    <div className="edit-fields">
                      <input
                        type="number"
                        defaultValue={alert.threshold}
                        placeholder="New threshold"
                        step="0.01"
                        min="0"
                        onBlur={(e) => {
                          const newThreshold = parseFloat(e.target.value);
                          if (!isNaN(newThreshold) && newThreshold !== alert.threshold) {
                            updateAlert(alert.id, { threshold: newThreshold });
                          }
                        }}
                      />
                      <select
                        defaultValue={alert.direction}
                        onChange={(e) => updateAlert(alert.id, { direction: e.target.value as AlertDirection })}
                      >
                        <option value="above">Above (≥)</option>
                        <option value="below">Below (≤)</option>
                      </select>
                    </div>
                    <button
                      onClick={() => setEditingAlert(null)}
                      className="close-edit"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary Stats */}
      {alerts.length > 0 && (
        <div className="alert-summary">
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">{alerts.length}</span>
              <span className="stat-label">Total Alerts</span>
            </div>
            <div className="stat">
              <span className="stat-value">{alerts.filter(a => a.isActive).length}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat">
              <span className="stat-value">{alerts.filter(a => a.triggered).length}</span>
              <span className="stat-label">Triggered</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceAlertManager;