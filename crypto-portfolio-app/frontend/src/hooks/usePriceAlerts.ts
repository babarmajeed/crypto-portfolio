import { useState, useEffect, useCallback, useRef } from 'react';
import { PriceAlert, UsePriceAlertsReturn, AlertDirection, NotificationFrequency } from '../types/notification.types';

const usePriceAlerts = (): UsePriceAlertsReturn => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load alerts on mount
  useEffect(() => {
    loadAlerts();
    
    // Set up periodic price checking (every 30 seconds)
    checkIntervalRef.current = setInterval(() => {
      checkAlerts();
    }, 30000);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // Load all price alerts
  const loadAlerts = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/price-alerts', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to load price alerts: ${response.statusText}`);
      }

      const data = await response.json();
      setAlerts(data.alerts || []);

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load price alerts';
        setError(errorMessage);
        
        // Fallback to localStorage
        try {
          const savedAlerts = localStorage.getItem('priceAlerts');
          if (savedAlerts) {
            setAlerts(JSON.parse(savedAlerts));
          }
        } catch (storageError) {
          console.error('Failed to load alerts from localStorage:', storageError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new price alert
  const createAlert = useCallback(async (alertData: Omit<PriceAlert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      setIsLoading(true);
      setError(null);

      const newAlert: Omit<PriceAlert, 'id'> = {
        ...alertData,
        userId: getCurrentUserId(),
        triggered: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('/api/price-alerts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newAlert)
      });

      if (!response.ok) {
        throw new Error(`Failed to create price alert: ${response.statusText}`);
      }

      const data = await response.json();
      const createdAlert = data.alert;

      setAlerts(prev => [createdAlert, ...prev]);
      saveToLocalStorage([createdAlert, ...alerts]);

      return createdAlert;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create price alert';
      setError(errorMessage);
      
      // Fallback: create locally with generated ID
      const fallbackAlert: PriceAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: getCurrentUserId(),
        ...alertData,
        triggered: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setAlerts(prev => [fallbackAlert, ...prev]);
      saveToLocalStorage([fallbackAlert, ...alerts]);
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [alerts]);

  // Update an existing price alert
  const updateAlert = useCallback(async (alertId: string, updates: Partial<PriceAlert>) => {
    try {
      setError(null);

      const response = await fetch(`/api/price-alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...updates,
          updatedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update price alert: ${response.statusText}`);
      }

      const data = await response.json();
      const updatedAlert = data.alert;

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? updatedAlert : alert
      ));

      const updatedAlerts = alerts.map(alert => 
        alert.id === alertId ? updatedAlert : alert
      );
      saveToLocalStorage(updatedAlerts);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update price alert';
      setError(errorMessage);
      
      // Fallback: update locally
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, ...updates, updatedAt: new Date().toISOString() }
          : alert
      ));
      
      const fallbackUpdatedAlerts = alerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, ...updates, updatedAt: new Date().toISOString() }
          : alert
      );
      saveToLocalStorage(fallbackUpdatedAlerts);
    }
  }, [alerts]);

  // Delete a price alert
  const deleteAlert = useCallback(async (alertId: string) => {
    try {
      setError(null);

      const response = await fetch(`/api/price-alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete price alert: ${response.statusText}`);
      }

      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      
      const remainingAlerts = alerts.filter(alert => alert.id !== alertId);
      saveToLocalStorage(remainingAlerts);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete price alert';
      setError(errorMessage);
      
      // Fallback: delete locally
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      
      const fallbackAlerts = alerts.filter(alert => alert.id !== alertId);
      saveToLocalStorage(fallbackAlerts);
    }
  }, [alerts]);

  // Toggle alert active status
  const toggleAlert = useCallback(async (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    await updateAlert(alertId, { isActive: !alert.isActive });
  }, [alerts, updateAlert]);

  // Bulk toggle alerts
  const bulkToggle = useCallback(async (alertIds: string[], isActive: boolean) => {
    try {
      setError(null);

      const response = await fetch('/api/price-alerts/bulk-toggle', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ alertIds, isActive })
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk toggle alerts: ${response.statusText}`);
      }

      setAlerts(prev => prev.map(alert => 
        alertIds.includes(alert.id) 
          ? { ...alert, isActive, updatedAt: new Date().toISOString() }
          : alert
      ));

      const updatedAlerts = alerts.map(alert => 
        alertIds.includes(alert.id) 
          ? { ...alert, isActive, updatedAt: new Date().toISOString() }
          : alert
      );
      saveToLocalStorage(updatedAlerts);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk toggle alerts';
      setError(errorMessage);
      
      // Fallback: update locally
      setAlerts(prev => prev.map(alert => 
        alertIds.includes(alert.id) 
          ? { ...alert, isActive, updatedAt: new Date().toISOString() }
          : alert
      ));
    }
  }, [alerts]);

  // Bulk delete alerts
  const bulkDelete = useCallback(async (alertIds: string[]) => {
    try {
      setError(null);

      const response = await fetch('/api/price-alerts/bulk-delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ alertIds })
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk delete alerts: ${response.statusText}`);
      }

      setAlerts(prev => prev.filter(alert => !alertIds.includes(alert.id)));
      
      const remainingAlerts = alerts.filter(alert => !alertIds.includes(alert.id));
      saveToLocalStorage(remainingAlerts);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk delete alerts';
      setError(errorMessage);
      
      // Fallback: delete locally
      setAlerts(prev => prev.filter(alert => !alertIds.includes(alert.id)));
    }
  }, [alerts]);

  // Check alerts against current prices
  const checkAlerts = useCallback(async () => {
    const activeAlerts = alerts.filter(alert => alert.isActive && !alert.triggered);
    
    if (activeAlerts.length === 0) return;

    try {
      // Get unique asset symbols
      const assetSymbols = [...new Set(activeAlerts.map(alert => alert.asset))];
      
      // Fetch current prices for all assets
      const pricesResponse = await fetch(`/api/crypto/prices?symbols=${assetSymbols.join(',')}`);
      
      if (!pricesResponse.ok) {
        throw new Error('Failed to fetch current prices');
      }

      const pricesData = await pricesResponse.json();
      const currentPrices = pricesData.prices || {};

      // Check each alert
      const triggeredAlerts: string[] = [];
      
      for (const alert of activeAlerts) {
        const currentPrice = currentPrices[alert.asset];
        
        if (currentPrice !== undefined) {
          const shouldTrigger = 
            (alert.direction === 'above' && currentPrice >= alert.threshold) ||
            (alert.direction === 'below' && currentPrice <= alert.threshold);

          if (shouldTrigger) {
            triggeredAlerts.push(alert.id);
            
            // Update alert as triggered
            await updateAlert(alert.id, {
              triggered: true,
              triggeredAt: new Date().toISOString(),
              lastTriggered: new Date().toISOString()
            });

            // Send notification (this would be handled by the notification service)
            try {
              await fetch('/api/notifications/price-alert', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${getAuthToken()}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  alertId: alert.id,
                  asset: alert.asset,
                  currentPrice,
                  threshold: alert.threshold,
                  direction: alert.direction
                })
              });
            } catch (notificationError) {
              console.error('Failed to send price alert notification:', notificationError);
            }
          }
        }
      }

      if (triggeredAlerts.length > 0) {
        console.log(`Triggered ${triggeredAlerts.length} price alerts`);
      }

    } catch (err) {
      console.error('Failed to check price alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to check price alerts');
    }
  }, [alerts, updateAlert]);

  // Get triggered alerts
  const getTriggeredAlerts = useCallback(() => {
    return alerts.filter(alert => alert.triggered);
  }, [alerts]);

  // Get active alerts
  const getActiveAlerts = useCallback(() => {
    return alerts.filter(alert => alert.isActive);
  }, [alerts]);

  // Helper functions
  const getAuthToken = () => {
    return localStorage.getItem('authToken') || '';
  };

  const getCurrentUserId = () => {
    return localStorage.getItem('userId') || 'anonymous';
  };

  const saveToLocalStorage = (alertsToSave: PriceAlert[]) => {
    try {
      localStorage.setItem('priceAlerts', JSON.stringify(alertsToSave));
    } catch (err) {
      console.error('Failed to save alerts to localStorage:', err);
    }
  };

  return {
    alerts,
    isLoading,
    error,
    createAlert,
    updateAlert,
    deleteAlert,
    toggleAlert,
    bulkToggle,
    bulkDelete,
    checkAlerts,
    getTriggeredAlerts,
    getActiveAlerts
  };
};

export { usePriceAlerts };
export default usePriceAlerts;