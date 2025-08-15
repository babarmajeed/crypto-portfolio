import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SentimentAnalysisResponse,
  AggregatedSentiment,
  SentimentFilters,
  SentimentHistory,
  SentimentError,
  SentimentAlert,
  TriggeredAlert,
  NewsSentiment,
  SocialSentiment,
  OnChainSentiment,
  SentimentCorrelation
} from '../types/sentiment.types';
import { sentimentAnalysisService } from '../services/SentimentAnalysisService';

interface UseSentimentAnalysisState {
  data: SentimentAnalysisResponse | null;
  aggregatedSentiment: AggregatedSentiment | null;
  newsSentiment: NewsSentiment | null;
  socialSentiment: SocialSentiment | null;
  onChainSentiment: OnChainSentiment | null;
  sentimentHistory: SentimentHistory | null;
  correlations: SentimentCorrelation | null;
  isLoading: boolean;
  error: SentimentError | null;
  lastUpdated: string | null;
}

interface UseSentimentAnalysisOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  symbols?: string[];
  filters?: SentimentFilters;
  enableAlerts?: boolean;
}

export const useSentimentAnalysis = (
  options: UseSentimentAnalysisOptions = {}
) => {
  const {
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes
    symbols = ['BTC'],
    filters = {},
    enableAlerts = false
  } = options;

  const [state, setState] = useState<UseSentimentAnalysisState>({
    data: null,
    aggregatedSentiment: null,
    newsSentiment: null,
    socialSentiment: null,
    onChainSentiment: null,
    sentimentHistory: null,
    correlations: null,
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  const [alerts, setAlerts] = useState<SentimentAlert[]>([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const alertCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousSentimentRef = useRef<AggregatedSentiment | null>(null);

  // Fetch sentiment data
  const fetchSentimentData = useCallback(async (force = false) => {
    if (state.isLoading && !force) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await sentimentAnalysisService.getSentimentAnalysis(symbols, filters);
      
      setState(prev => ({
        ...prev,
        data: response,
        aggregatedSentiment: response.aggregatedSentiment,
        newsSentiment: response.newsSentiment,
        socialSentiment: response.socialSentiment,
        onChainSentiment: response.onChainSentiment,
        sentimentHistory: response.sentimentHistory,
        correlations: response.correlations,
        isLoading: false,
        lastUpdated: response.lastUpdated
      }));

      // Store previous sentiment for alert checking
      previousSentimentRef.current = response.aggregatedSentiment;

      // Check alerts if enabled
      if (enableAlerts && response.aggregatedSentiment) {
        checkAlerts(response.aggregatedSentiment);
      }

    } catch (error) {
      const sentimentError = error as SentimentError;
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: sentimentError
      }));
    }
  }, [symbols, filters, enableAlerts, state.isLoading]);

  // Refresh sentiment data
  const refresh = useCallback(() => {
    fetchSentimentData(true);
  }, [fetchSentimentData]);

  // Update symbols
  const updateSymbols = useCallback((newSymbols: string[]) => {
    if (JSON.stringify(newSymbols) !== JSON.stringify(symbols)) {
      fetchSentimentData();
    }
  }, [symbols, fetchSentimentData]);

  // Update filters
  const updateFilters = useCallback((newFilters: SentimentFilters) => {
    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      fetchSentimentData();
    }
  }, [filters, fetchSentimentData]);

  // Alert management
  const createAlert = useCallback((alert: Omit<SentimentAlert, 'id' | 'createdAt'>) => {
    const newAlert: SentimentAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    
    setAlerts(prev => [...prev, newAlert]);
    return newAlert;
  }, []);

  const updateAlert = useCallback((alertId: string, updates: Partial<SentimentAlert>) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, ...updates } : alert
    ));
  }, []);

  const deleteAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const dismissTriggeredAlert = useCallback((alertId: string) => {
    setTriggeredAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Check alerts against current sentiment
  const checkAlerts = useCallback((currentSentiment: AggregatedSentiment) => {
    const activeAlerts = alerts.filter(alert => alert.isActive);
    
    activeAlerts.forEach(alert => {
      let shouldTrigger = false;
      let triggeredValue = 0;
      let message = '';

      // Get the metric value based on alert type and metric
      switch (alert.type) {
        case 'sentiment':
          triggeredValue = currentSentiment.score;
          break;
        case 'fearGreed':
          triggeredValue = state.data?.fearGreedIndex?.value || 50;
          break;
        case 'social':
          triggeredValue = state.socialSentiment?.score || 0;
          break;
        case 'onChain':
          triggeredValue = state.onChainSentiment?.score || 0;
          break;
      }

      // Check condition
      switch (alert.condition.operator) {
        case 'above':
          shouldTrigger = triggeredValue > alert.condition.value;
          message = `${alert.type} sentiment (${triggeredValue.toFixed(2)}) is above ${alert.condition.value}`;
          break;
        case 'below':
          shouldTrigger = triggeredValue < alert.condition.value;
          message = `${alert.type} sentiment (${triggeredValue.toFixed(2)}) is below ${alert.condition.value}`;
          break;
        case 'equals':
          shouldTrigger = Math.abs(triggeredValue - alert.condition.value) < 0.01;
          message = `${alert.type} sentiment equals ${alert.condition.value}`;
          break;
        case 'crosses_above':
          const prevValue = getPreviousValue(alert.type);
          shouldTrigger = prevValue <= alert.condition.value && triggeredValue > alert.condition.value;
          message = `${alert.type} sentiment crossed above ${alert.condition.value}`;
          break;
        case 'crosses_below':
          const prevValueBelow = getPreviousValue(alert.type);
          shouldTrigger = prevValueBelow >= alert.condition.value && triggeredValue < alert.condition.value;
          message = `${alert.type} sentiment crossed below ${alert.condition.value}`;
          break;
      }

      if (shouldTrigger) {
        const triggeredAlert: TriggeredAlert = {
          ...alert,
          triggeredValue,
          message,
          triggeredAt: new Date().toISOString()
        };
        
        setTriggeredAlerts(prev => [...prev, triggeredAlert]);
        
        // Optionally disable alert after triggering to prevent spam
        if (alert.condition.cooldown) {
          updateAlert(alert.id, { isActive: false });
          
          // Re-enable after cooldown period
          setTimeout(() => {
            updateAlert(alert.id, { isActive: true });
          }, (alert.condition.cooldown || 60) * 60 * 1000);
        }
      }
    });
  }, [alerts, state.data, state.socialSentiment, state.onChainSentiment, updateAlert]);

  // Get previous value for cross alerts
  const getPreviousValue = (type: string): number => {
    if (!previousSentimentRef.current) return 0;
    
    switch (type) {
      case 'sentiment':
        return previousSentimentRef.current.score;
      case 'fearGreed':
        return 50; // Would need to store previous fear/greed data
      case 'social':
        return 0; // Would need to store previous social data
      case 'onChain':
        return 0; // Would need to store previous on-chain data
      default:
        return 0;
    }
  };

  // Sentiment analysis utilities
  const getSentimentLabel = useCallback((score: number): string => {
    if (score > 0.6) return 'Very Bullish';
    if (score > 0.2) return 'Bullish';
    if (score > -0.2) return 'Neutral';
    if (score > -0.6) return 'Bearish';
    return 'Very Bearish';
  }, []);

  const getSentimentColor = useCallback((score: number): string => {
    if (score > 0.6) return '#00c851'; // Very bullish
    if (score > 0.2) return '#4caf50'; // Bullish
    if (score > -0.2) return '#ff9800'; // Neutral
    if (score > -0.6) return '#ff5722'; // Bearish
    return '#f44336'; // Very bearish
  }, []);

  const getSentimentTrend = useCallback((): 'up' | 'down' | 'stable' => {
    if (!state.sentimentHistory?.data || state.sentimentHistory.data.length < 2) {
      return 'stable';
    }

    const recent = state.sentimentHistory.data.slice(-2);
    const change = recent[1].sentiment - recent[0].sentiment;
    
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }, [state.sentimentHistory]);

  const getVolatilityLevel = useCallback((): 'low' | 'medium' | 'high' => {
    if (!state.aggregatedSentiment?.volatility) return 'medium';
    
    if (state.aggregatedSentiment.volatility < 0.2) return 'low';
    if (state.aggregatedSentiment.volatility < 0.5) return 'medium';
    return 'high';
  }, [state.aggregatedSentiment]);

  // Performance metrics
  const getCorrelationStrength = useCallback((correlation: number): 'weak' | 'moderate' | 'strong' => {
    const abs = Math.abs(correlation);
    if (abs < 0.3) return 'weak';
    if (abs < 0.7) return 'moderate';
    return 'strong';
  }, []);

  const getPredictivePower = useCallback((): number => {
    return state.correlations?.predictivePower || 0;
  }, [state.correlations]);

  // Historical analysis
  const getHistoricalAverage = useCallback((): number => {
    if (!state.sentimentHistory?.data) return 0;
    
    const sum = state.sentimentHistory.data.reduce((acc, point) => acc + point.sentiment, 0);
    return sum / state.sentimentHistory.data.length;
  }, [state.sentimentHistory]);

  const getMaxSentiment = useCallback((): { value: number; date: string } => {
    if (!state.sentimentHistory?.data) return { value: 0, date: '' };
    
    let max = state.sentimentHistory.data[0];
    state.sentimentHistory.data.forEach(point => {
      if (point.sentiment > max.sentiment) {
        max = point;
      }
    });
    
    return { value: max.sentiment, date: max.date };
  }, [state.sentimentHistory]);

  const getMinSentiment = useCallback((): { value: number; date: string } => {
    if (!state.sentimentHistory?.data) return { value: 0, date: '' };
    
    let min = state.sentimentHistory.data[0];
    state.sentimentHistory.data.forEach(point => {
      if (point.sentiment < min.sentiment) {
        min = point;
      }
    });
    
    return { value: min.sentiment, date: min.date };
  }, [state.sentimentHistory]);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        fetchSentimentData();
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchSentimentData]);

  // Initial data fetch
  useEffect(() => {
    fetchSentimentData();
  }, [symbols, filters]); // Removed fetchSentimentData from deps to avoid infinite loop

  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (alertCheckTimerRef.current) {
        clearInterval(alertCheckTimerRef.current);
      }
    };
  }, []);

  return {
    // Core data
    data: state.data,
    aggregatedSentiment: state.aggregatedSentiment,
    newsSentiment: state.newsSentiment,
    socialSentiment: state.socialSentiment,
    onChainSentiment: state.onChainSentiment,
    sentimentHistory: state.sentimentHistory,
    correlations: state.correlations,
    
    // State
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    
    // Actions
    refresh,
    updateSymbols,
    updateFilters,
    
    // Alert management
    alerts,
    triggeredAlerts,
    createAlert,
    updateAlert,
    deleteAlert,
    dismissTriggeredAlert,
    
    // Utility functions
    getSentimentLabel,
    getSentimentColor,
    getSentimentTrend,
    getVolatilityLevel,
    getCorrelationStrength,
    getPredictivePower,
    
    // Historical analysis
    getHistoricalAverage,
    getMaxSentiment,
    getMinSentiment
  };
};