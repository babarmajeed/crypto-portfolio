import { useState, useEffect, useCallback } from 'react';
import { newsService } from '../services/NewsService';
import { 
  NewsAlert, 
  NewsArticle, 
  UseNewsAlertsReturn,
  NewsFilters 
} from '../types/news.types';

export const useNewsAlerts = (): UseNewsAlertsReturn => {
  const [alerts, setAlerts] = useState<NewsAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load alerts from localStorage on mount
  useEffect(() => {
    loadAlertsFromStorage();
    loadAlertHistoryFromStorage();
  }, []);

  // Save alerts to localStorage whenever alerts change
  useEffect(() => {
    saveAlertsToStorage();
  }, [alerts]);

  const loadAlertsFromStorage = () => {
    try {
      const stored = localStorage.getItem('crypto-portfolio-news-alerts');
      if (stored) {
        const parsedAlerts = JSON.parse(stored);
        setAlerts(parsedAlerts);
      }
    } catch (err) {
      console.error('Error loading alerts from storage:', err);
    }
  };

  const saveAlertsToStorage = () => {
    try {
      localStorage.setItem('crypto-portfolio-news-alerts', JSON.stringify(alerts));
    } catch (err) {
      console.error('Error saving alerts to storage:', err);
    }
  };

  const loadAlertHistoryFromStorage = () => {
    try {
      const stored = localStorage.getItem('crypto-portfolio-alert-history');
      if (stored) {
        const parsedHistory = JSON.parse(stored);
        setAlertHistory(parsedHistory);
      }
    } catch (err) {
      console.error('Error loading alert history from storage:', err);
    }
  };

  const saveAlertHistoryToStorage = (history: NewsArticle[]) => {
    try {
      // Keep only last 100 alerts in history
      const limitedHistory = history.slice(-100);
      localStorage.setItem('crypto-portfolio-alert-history', JSON.stringify(limitedHistory));
      setAlertHistory(limitedHistory);
    } catch (err) {
      console.error('Error saving alert history to storage:', err);
    }
  };

  const createAlert = useCallback(async (
    alertData: Omit<NewsAlert, 'id' | 'createdAt' | 'triggerCount'>
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const newAlert: NewsAlert = {
        ...alertData,
        id: generateAlertId(),
        createdAt: new Date().toISOString(),
        triggerCount: 0
      };

      setAlerts(prev => [...prev, newAlert]);

      // If alert is active, start monitoring immediately
      if (newAlert.isActive) {
        await testAlert(newAlert.id);
      }

    } catch (err) {
      console.error('Error creating alert:', err);
      setError('Failed to create alert');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateAlert = useCallback(async (
    id: string, 
    updates: Partial<NewsAlert>
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      setAlerts(prev => prev.map(alert => 
        alert.id === id 
          ? { ...alert, ...updates }
          : alert
      ));

    } catch (err) {
      console.error('Error updating alert:', err);
      setError('Failed to update alert');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeAlert = useCallback(async (id: string): Promise<void> => {
    try {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    } catch (err) {
      console.error('Error removing alert:', err);
      setError('Failed to remove alert');
    }
  }, []);

  const toggleAlert = useCallback(async (id: string): Promise<void> => {
    const alert = alerts.find(a => a.id === id);
    if (!alert) return;

    await updateAlert(id, { isActive: !alert.isActive });
  }, [alerts, updateAlert]);

  const testAlert = useCallback(async (id: string): Promise<void> => {
    const alert = alerts.find(a => a.id === id);
    if (!alert) return;

    try {
      setIsLoading(true);
      
      // Create search filters based on alert criteria
      const filters: NewsFilters = {
        category: alert.category || 'all',
        sentiment: alert.sentiment || 'all',
        source: 'all',
        timeframe: '24h',
        portfolioOnly: false,
        searchQuery: alert.keywords.join(' OR '),
        minRelevanceScore: alert.minRelevanceScore || 0,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      // Search for news matching alert criteria
      const response = await newsService.getNews(filters);
      let matchingArticles = response.articles;

      // Additional filtering based on alert criteria
      if (alert.assets.length > 0) {
        matchingArticles = matchingArticles.filter(article =>
          alert.assets.some(asset =>
            article.relatedAssets?.includes(asset) ||
            article.title.toLowerCase().includes(asset.toLowerCase()) ||
            article.summary.toLowerCase().includes(asset.toLowerCase()) ||
            article.tags.some(tag => tag.toLowerCase().includes(asset.toLowerCase()))
          )
        );
      }

      // Filter by keywords (more specific than searchQuery)
      if (alert.keywords.length > 0) {
        matchingArticles = matchingArticles.filter(article => {
          const articleText = `${article.title} ${article.summary} ${article.tags.join(' ')}`.toLowerCase();
          return alert.keywords.some(keyword => 
            articleText.includes(keyword.toLowerCase())
          );
        });
      }

      // Filter by sentiment if specified
      if (alert.sentiment && alert.sentiment !== 'all') {
        matchingArticles = matchingArticles.filter(article =>
          article.sentiment?.label === alert.sentiment
        );
      }

      // Filter by relevance score if specified
      if (alert.minRelevanceScore) {
        matchingArticles = matchingArticles.filter(article =>
          (article.relevanceScore || 0) >= alert.minRelevanceScore!
        );
      }

      if (matchingArticles.length > 0) {
        // Trigger alert
        await triggerAlert(alert, matchingArticles);
      }

    } catch (err) {
      console.error('Error testing alert:', err);
      setError('Failed to test alert');
    } finally {
      setIsLoading(false);
    }
  }, [alerts]);

  const triggerAlert = useCallback(async (
    alert: NewsAlert, 
    matchingArticles: NewsArticle[]
  ): Promise<void> => {
    try {
      // Update alert trigger count and last triggered time
      await updateAlert(alert.id, {
        triggerCount: alert.triggerCount + 1,
        lastTriggered: new Date().toISOString()
      });

      // Add to alert history
      const newHistoryEntries = matchingArticles.map(article => ({
        ...article,
        alertId: alert.id,
        alertName: alert.name,
        triggeredAt: new Date().toISOString()
      }));

      const updatedHistory = [...alertHistory, ...newHistoryEntries];
      saveAlertHistoryToStorage(updatedHistory);

      // Send notifications based on alert preferences
      await sendNotifications(alert, matchingArticles);

    } catch (err) {
      console.error('Error triggering alert:', err);
    }
  }, [alertHistory, updateAlert]);

  const sendNotifications = useCallback(async (
    alert: NewsAlert, 
    articles: NewsArticle[]
  ): Promise<void> => {
    try {
      // Browser push notification
      if (alert.notificationMethod.includes('push') && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          const notification = new Notification(`News Alert: ${alert.name}`, {
            body: `Found ${articles.length} matching article(s)`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: alert.id,
            data: { alertId: alert.id, articles }
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          // Auto-close after 10 seconds
          setTimeout(() => notification.close(), 10000);
        } else if (Notification.permission === 'default') {
          // Request permission for future notifications
          await Notification.requestPermission();
        }
      }

      // Email notification (would be implemented with backend API)
      if (alert.notificationMethod.includes('email')) {
        console.log('Email notification would be sent:', {
          alertName: alert.name,
          articleCount: articles.length,
          articles: articles.slice(0, 5) // Send top 5 articles
        });
      }

      // SMS notification (would be implemented with backend API)
      if (alert.notificationMethod.includes('sms')) {
        console.log('SMS notification would be sent:', {
          alertName: alert.name,
          articleCount: articles.length
        });
      }

    } catch (err) {
      console.error('Error sending notifications:', err);
    }
  }, []);

  // Monitor active alerts periodically
  useEffect(() => {
    const monitorAlerts = async () => {
      const activeAlerts = alerts.filter(alert => alert.isActive);
      
      for (const alert of activeAlerts) {
        try {
          await testAlert(alert.id);
        } catch (err) {
          console.error(`Error monitoring alert ${alert.name}:`, err);
        }
      }
    };

    // Run every 5 minutes
    const interval = setInterval(monitorAlerts, 5 * 60 * 1000);
    
    // Also run on mount if there are active alerts
    if (alerts.some(alert => alert.isActive)) {
      monitorAlerts();
    }

    return () => clearInterval(interval);
  }, [alerts, testAlert]);

  // Computed values
  const activeAlerts = alerts.filter(alert => alert.isActive);

  // Utility functions
  const generateAlertId = (): string => {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const getAlertsByCategory = useCallback((category: string) => {
    return alerts.filter(alert => alert.category === category);
  }, [alerts]);

  const getRecentlyTriggeredAlerts = useCallback((hours: number = 24) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return alerts.filter(alert => 
      alert.lastTriggered && new Date(alert.lastTriggered) > cutoff
    );
  }, [alerts]);

  const exportAlerts = useCallback(() => {
    const exportData = {
      alerts,
      alertHistory,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `news-alerts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [alerts, alertHistory]);

  const importAlerts = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (importData.alerts && Array.isArray(importData.alerts)) {
        // Merge with existing alerts, avoiding duplicates
        const existingIds = new Set(alerts.map(a => a.id));
        const newAlerts = importData.alerts.filter((alert: NewsAlert) => 
          !existingIds.has(alert.id)
        );
        
        setAlerts(prev => [...prev, ...newAlerts]);
      }
      
      if (importData.alertHistory && Array.isArray(importData.alertHistory)) {
        const newHistory = [...alertHistory, ...importData.alertHistory];
        saveAlertHistoryToStorage(newHistory);
      }
      
    } catch (err) {
      console.error('Error importing alerts:', err);
      setError('Failed to import alerts');
    }
  }, [alerts, alertHistory]);

  return {
    alerts,
    activeAlerts,
    alertHistory,
    isLoading,
    error,
    
    // Core actions
    createAlert,
    updateAlert,
    removeAlert,
    toggleAlert,
    testAlert,
    
    // Utility functions
    getAlertsByCategory,
    getRecentlyTriggeredAlerts,
    exportAlerts,
    importAlerts
  };
};

export default useNewsAlerts;