import { useState, useEffect, useCallback } from 'react';
import { copyTradingService } from '../services/CopyTradingService';
import { 
  CopyTrade, 
  CopyTradeSettings, 
  CopyTradeFilters 
} from '../types/social.types';

export const useCopyTrading = (userId?: string) => {
  const [activeCopyTrades, setActiveCopyTrades] = useState<CopyTrade[]>([]);
  const [copyTradeHistory, setCopyTradeHistory] = useState<CopyTrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<CopyTradeFilters>({
    status: 'active',
    sortBy: 'performance',
    sortOrder: 'desc'
  });

  const loadCopyTrades = useCallback(async (customFilters?: CopyTradeFilters) => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const copyTrades = await copyTradingService.getCopyTrades(userId, customFilters || filters);
      
      // Separate active and inactive copy trades
      const active = copyTrades.filter(ct => ct.status === 'active' || ct.status === 'paused');
      const inactive = copyTrades.filter(ct => ct.status === 'stopped');
      
      setActiveCopyTrades(active);
      setCopyTradeHistory(inactive);
      
    } catch (err) {
      console.error('Error loading copy trades:', err);
      setError('Failed to load copy trades');
    } finally {
      setIsLoading(false);
    }
  }, [userId, filters]);

  const startCopyTrade = useCallback(async (traderId: string, settings: CopyTradeSettings) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const newCopyTrade = await copyTradingService.startCopyTrade(traderId, settings);
      
      // Add to active copy trades
      setActiveCopyTrades(prev => [newCopyTrade, ...prev]);
      
      return newCopyTrade;
      
    } catch (err) {
      console.error('Error starting copy trade:', err);
      setError(err instanceof Error ? err.message : 'Failed to start copy trade');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCopyTrade = useCallback(async (copyTradeId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await copyTradingService.stopCopyTrade(copyTradeId);
      
      // Move from active to history
      const stoppedTrade = activeCopyTrades.find(ct => ct.id === copyTradeId);
      if (stoppedTrade) {
        const updatedTrade = { ...stoppedTrade, status: 'stopped' as const, endDate: new Date().toISOString() };
        
        setActiveCopyTrades(prev => prev.filter(ct => ct.id !== copyTradeId));
        setCopyTradeHistory(prev => [updatedTrade, ...prev]);
      }
      
    } catch (err) {
      console.error('Error stopping copy trade:', err);
      setError('Failed to stop copy trade');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [activeCopyTrades]);

  const pauseCopyTrade = useCallback(async (copyTradeId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await copyTradingService.pauseCopyTrade(copyTradeId);
      
      // Update status to paused
      setActiveCopyTrades(prev =>
        prev.map(ct =>
          ct.id === copyTradeId ? { ...ct, status: 'paused' as const } : ct
        )
      );
      
    } catch (err) {
      console.error('Error pausing copy trade:', err);
      setError('Failed to pause copy trade');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resumeCopyTrade = useCallback(async (copyTradeId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await copyTradingService.resumeCopyTrade(copyTradeId);
      
      // Update status to active
      setActiveCopyTrades(prev =>
        prev.map(ct =>
          ct.id === copyTradeId ? { ...ct, status: 'active' as const } : ct
        )
      );
      
    } catch (err) {
      console.error('Error resuming copy trade:', err);
      setError('Failed to resume copy trade');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCopyTradeSettings = useCallback(async (copyTradeId: string, settings: Partial<CopyTradeSettings>) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await copyTradingService.updateCopyTradeSettings(copyTradeId, settings);
      
      // Update local state
      setActiveCopyTrades(prev =>
        prev.map(ct =>
          ct.id === copyTradeId
            ? { ...ct, settings: { ...ct.settings, ...settings } }
            : ct
        )
      );
      
    } catch (err) {
      console.error('Error updating copy trade settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCopyTradePerformance = useCallback(async (copyTradeId: string) => {
    try {
      return await copyTradingService.getCopyTradePerformance(copyTradeId);
    } catch (err) {
      console.error('Error getting copy trade performance:', err);
      throw err;
    }
  }, []);

  const getCopyTradeRiskMetrics = useCallback(async (copyTradeId: string) => {
    try {
      return await copyTradingService.getCopyTradeRiskMetrics(copyTradeId);
    } catch (err) {
      console.error('Error getting copy trade risk metrics:', err);
      throw err;
    }
  }, []);

  const updateFilters = useCallback(async (newFilters: Partial<CopyTradeFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    await loadCopyTrades(updatedFilters);
  }, [filters, loadCopyTrades]);

  const refresh = useCallback(async () => {
    await loadCopyTrades();
  }, [loadCopyTrades]);

  // Utility functions
  const getTotalAllocated = useCallback(() => {
    return activeCopyTrades.reduce((sum, ct) => sum + ct.allocatedAmount, 0);
  }, [activeCopyTrades]);

  const getTotalCurrentValue = useCallback(() => {
    return activeCopyTrades.reduce((sum, ct) => sum + ct.currentValue, 0);
  }, [activeCopyTrades]);

  const getTotalReturn = useCallback(() => {
    const allocated = getTotalAllocated();
    const current = getTotalCurrentValue();
    return allocated > 0 ? ((current - allocated) / allocated) * 100 : 0;
  }, [getTotalAllocated, getTotalCurrentValue]);

  const getActiveTradesCount = useCallback(() => {
    return activeCopyTrades.filter(ct => ct.status === 'active').length;
  }, [activeCopyTrades]);

  const getPausedTradesCount = useCallback(() => {
    return activeCopyTrades.filter(ct => ct.status === 'paused').length;
  }, [activeCopyTrades]);

  const getTopPerformer = useCallback(() => {
    if (activeCopyTrades.length === 0) return null;
    
    return activeCopyTrades.reduce((best, current) => 
      current.totalReturnPercentage > best.totalReturnPercentage ? current : best
    );
  }, [activeCopyTrades]);

  const getWorstPerformer = useCallback(() => {
    if (activeCopyTrades.length === 0) return null;
    
    return activeCopyTrades.reduce((worst, current) => 
      current.totalReturnPercentage < worst.totalReturnPercentage ? current : worst
    );
  }, [activeCopyTrades]);

  const getAveragePerformance = useCallback(() => {
    if (activeCopyTrades.length === 0) return 0;
    
    const totalPerformance = activeCopyTrades.reduce((sum, ct) => sum + ct.totalReturnPercentage, 0);
    return totalPerformance / activeCopyTrades.length;
  }, [activeCopyTrades]);

  // Initial load
  useEffect(() => {
    loadCopyTrades();
  }, []);

  // Auto-refresh data every 30 seconds for active copy trades
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && activeCopyTrades.length > 0) {
        refresh();
      }
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [refresh, isLoading, activeCopyTrades.length]);

  return {
    // Data
    activeCopyTrades,
    copyTradeHistory,
    
    // State
    isLoading,
    error,
    filters,
    
    // Core Actions
    startCopyTrade,
    stopCopyTrade,
    pauseCopyTrade,
    resumeCopyTrade,
    updateCopyTradeSettings,
    
    // Data Actions
    getCopyTradePerformance,
    getCopyTradeRiskMetrics,
    updateFilters,
    refresh,
    loadCopyTrades,
    
    // Utility Functions
    getTotalAllocated,
    getTotalCurrentValue,
    getTotalReturn,
    getActiveTradesCount,
    getPausedTradesCount,
    getTopPerformer,
    getWorstPerformer,
    getAveragePerformance
  };
};

export default useCopyTrading;