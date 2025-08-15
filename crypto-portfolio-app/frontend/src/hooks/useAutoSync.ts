import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UseAutoSyncReturn,
  SyncProgress,
  SyncStatus,
  ConflictData,
  SyncError,
  SyncOperation,
  SyncConfiguration,
  ConflictResolution,
  ConflictResolutionStrategy,
  SyncHistoryEntry,
  SyncOptions,
  ExchangeConnection
} from '../types/sync.types';
import { AutoSyncService } from '../services/AutoSyncService';
import { SyncSchedulerService } from '../services/SyncSchedulerService';
import { ConflictResolutionService } from '../services/ConflictResolutionService';

interface UseAutoSyncOptions {
  autoStart?: boolean;
  exchanges?: ExchangeConnection[];
  defaultSyncOptions?: Partial<SyncOptions>;
  onProgress?: (progress: SyncProgress) => void;
  onComplete?: (operation: SyncOperation) => void;
  onError?: (error: SyncError) => void;
  onConflictDetected?: (conflict: ConflictData) => void;
}

export const useAutoSync = (options: UseAutoSyncOptions = {}): UseAutoSyncReturn => {
  const {
    autoStart = false,
    exchanges = [],
    defaultSyncOptions,
    onProgress,
    onComplete,
    onError,
    onConflictDetected
  } = options;

  // State
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTimes, setLastSyncTimes] = useState<{ [exchangeId: string]: string }>({});
  const [conflictingTransactions, setConflictingTransactions] = useState<ConflictData[]>([]);
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [syncConfig, setSyncConfig] = useState<SyncConfiguration | null>(null);

  // Services
  const autoSyncServiceRef = useRef(new AutoSyncService());
  const schedulerServiceRef = useRef(new SyncSchedulerService());
  const conflictServiceRef = useRef(new ConflictResolutionService());
  const currentOperationRef = useRef<SyncOperation | null>(null);

  // Default sync options
  const defaultOptions: SyncOptions = {
    syncType: 'incremental',
    batchSize: 100,
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 30000,
    includeOrderHistory: true,
    includeDeposits: true,
    includeWithdrawals: true,
    includeTrades: true,
    conflictResolution: {
      strategy: 'exchange-priority',
      autoResolve: true,
      timestampTolerance: 60000,
      amountTolerance: 0.001,
      requireManualReview: ['balance_inconsistency']
    },
    dataValidation: {
      enabled: true,
      strict: false,
      validateAmounts: true,
      validateDates: true,
      validateAssets: true,
      allowPartialSync: true,
      maxErrorThreshold: 10
    },
    backup: {
      enabled: true,
      beforeSync: true,
      retentionDays: 30,
      compressionEnabled: true,
      encryptionEnabled: false
    },
    notifications: {
      syncComplete: false,
      syncFailed: true,
      conflictsDetected: true,
      channels: [
        {
          type: 'push',
          enabled: true,
          config: {}
        }
      ]
    },
    ...defaultSyncOptions
  };

  // Load sync configuration on mount
  useEffect(() => {
    loadSyncConfiguration();
    loadLastSyncTimes();
    loadConflicts();
    
    if (autoStart && exchanges.length > 0) {
      startSync();
    }
  }, [autoStart, exchanges.length]);

  // Monitor sync status
  useEffect(() => {
    const interval = setInterval(() => {
      updateSyncStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Load sync configuration from storage
   */
  const loadSyncConfiguration = useCallback(() => {
    try {
      const stored = localStorage.getItem('current_sync_config');
      if (stored) {
        const config = JSON.parse(stored);
        setSyncConfig(config);
      }
    } catch (error) {
      console.error('Failed to load sync configuration:', error);
    }
  }, []);

  /**
   * Load last sync times from storage
   */
  const loadLastSyncTimes = useCallback(() => {
    try {
      const stored = localStorage.getItem('last_sync_times');
      if (stored) {
        setLastSyncTimes(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load last sync times:', error);
    }
  }, []);

  /**
   * Load conflicts from storage
   */
  const loadConflicts = useCallback(() => {
    try {
      const stored = localStorage.getItem('sync_conflicts');
      if (stored) {
        const conflicts = JSON.parse(stored);
        setConflictingTransactions(conflicts.filter((c: ConflictData) => c.status !== 'resolved'));
      }
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    }
  }, []);

  /**
   * Update sync status
   */
  const updateSyncStatus = useCallback(() => {
    const currentOperation = autoSyncServiceRef.current.getCurrentOperation();
    const isOperationRunning = autoSyncServiceRef.current.isOperationRunning();

    setIsRunning(isOperationRunning);

    if (currentOperation) {
      setSyncStatus(currentOperation.status);
      setSyncProgress(currentOperation.progress);
      setErrors(currentOperation.errors);
      
      // Update conflicts
      if (currentOperation.conflicts.length > 0) {
        const newConflicts = currentOperation.conflicts.filter(conflict => 
          !conflictingTransactions.find(existing => existing.id === conflict.id)
        );
        
        if (newConflicts.length > 0) {
          setConflictingTransactions(prev => [...prev, ...newConflicts]);
          newConflicts.forEach(conflict => onConflictDetected?.(conflict));
        }
      }

      currentOperationRef.current = currentOperation;
    } else {
      if (isRunning) {
        setSyncStatus('idle');
        setIsRunning(false);
        setSyncProgress(null);
      }
    }
  }, [isRunning, conflictingTransactions, onConflictDetected]);

  /**
   * Start sync operation
   */
  const startSync = useCallback(async (options?: Partial<SyncOptions>): Promise<SyncOperation> => {
    if (isRunning) {
      throw new Error('Sync operation already in progress');
    }

    const syncOptions = { ...defaultOptions, ...options };
    const exchangeConnections = exchanges.length > 0 ? exchanges : await getDefaultExchanges();

    if (exchangeConnections.length === 0) {
      throw new Error('No exchanges configured for synchronization');
    }

    try {
      setIsRunning(true);
      setSyncStatus('syncing');
      setErrors([]);

      const operation = await autoSyncServiceRef.current.startSync(
        exchangeConnections,
        syncOptions,
        (progress) => {
          setSyncProgress(progress);
          onProgress?.(progress);
        }
      );

      // Update last sync times
      const newLastSyncTimes = { ...lastSyncTimes };
      exchangeConnections.forEach(exchange => {
        newLastSyncTimes[exchange.id] = new Date().toISOString();
      });
      setLastSyncTimes(newLastSyncTimes);
      localStorage.setItem('last_sync_times', JSON.stringify(newLastSyncTimes));

      // Save conflicts
      if (operation.conflicts.length > 0) {
        saveConflicts(operation.conflicts);
      }

      onComplete?.(operation);
      return operation;
    } catch (error) {
      const syncError: SyncError = {
        id: `error_${Date.now()}`,
        type: 'sync_timeout',
        severity: 'high',
        message: error instanceof Error ? error.message : 'Sync failed',
        timestamp: new Date().toISOString(),
        retryable: true,
        retryCount: 0
      };
      
      setErrors([syncError]);
      onError?.(syncError);
      throw error;
    }
  }, [isRunning, exchanges, defaultOptions, lastSyncTimes, onProgress, onComplete, onError]);

  /**
   * Stop sync operation
   */
  const stopSync = useCallback(async (): Promise<void> => {
    if (!isRunning) {
      return;
    }

    await autoSyncServiceRef.current.stopSync();
    setIsRunning(false);
    setSyncStatus('stopped');
    setSyncProgress(null);
  }, [isRunning]);

  /**
   * Pause sync operation
   */
  const pauseSync = useCallback(async (): Promise<void> => {
    if (!isRunning) {
      return;
    }

    await autoSyncServiceRef.current.pauseSync();
    setSyncStatus('paused');
  }, [isRunning]);

  /**
   * Resume sync operation
   */
  const resumeSync = useCallback(async (): Promise<void> => {
    if (syncStatus !== 'paused') {
      return;
    }

    await autoSyncServiceRef.current.resumeSync();
    setSyncStatus('syncing');
  }, [syncStatus]);

  /**
   * Retry sync operation
   */
  const retrySync = useCallback(async (operationId: string): Promise<SyncOperation> => {
    // Get operation from history
    const history = autoSyncServiceRef.current.getSyncHistory();
    const operation = history.find(op => op.id === operationId);
    
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    // Retry with same configuration
    const retryOptions: Partial<SyncOptions> = {
      syncType: operation.type,
      ...defaultOptions
    };

    return await startSync(retryOptions);
  }, [startSync, defaultOptions]);

  /**
   * Update sync configuration
   */
  const updateSyncConfig = useCallback((config: Partial<SyncConfiguration>) => {
    const updatedConfig = syncConfig ? { ...syncConfig, ...config } : null;
    setSyncConfig(updatedConfig);
    
    if (updatedConfig) {
      localStorage.setItem('current_sync_config', JSON.stringify(updatedConfig));
    }
  }, [syncConfig]);

  /**
   * Get sync configuration
   */
  const getSyncConfig = useCallback((): SyncConfiguration | null => {
    return syncConfig;
  }, [syncConfig]);

  /**
   * Resolve conflict
   */
  const resolveConflict = useCallback(async (conflictId: string, resolution: ConflictResolution): Promise<void> => {
    const conflict = conflictingTransactions.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    try {
      // Apply resolution using conflict service
      const resolvedConflict = await conflictServiceRef.current.autoResolveConflict(
        conflict,
        resolution.strategy
      );

      // Update conflict status
      conflict.status = 'resolved';
      conflict.resolvedAt = new Date().toISOString();
      conflict.resolution = resolvedConflict;

      // Remove from active conflicts
      const updatedConflicts = conflictingTransactions.filter(c => c.id !== conflictId);
      setConflictingTransactions(updatedConflicts);

      // Save updated conflicts
      saveConflicts([...updatedConflicts, conflict]);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }, [conflictingTransactions]);

  /**
   * Resolve all conflicts with strategy
   */
  const resolveAllConflicts = useCallback(async (strategy: ConflictResolutionStrategy): Promise<void> => {
    const unresolvedConflicts = conflictingTransactions.filter(c => c.status !== 'resolved');
    
    if (unresolvedConflicts.length === 0) {
      return;
    }

    try {
      const resolutions = await conflictServiceRef.current.batchResolveConflicts(
        unresolvedConflicts,
        strategy
      );

      // Update conflicts with resolutions
      const updatedConflicts = conflictingTransactions.map(conflict => {
        const resolution = resolutions.get(conflict.id);
        if (resolution) {
          return {
            ...conflict,
            status: 'resolved' as const,
            resolvedAt: new Date().toISOString(),
            resolution
          };
        }
        return conflict;
      });

      setConflictingTransactions(updatedConflicts.filter(c => c.status !== 'resolved'));
      saveConflicts(updatedConflicts);
    } catch (error) {
      console.error('Failed to resolve all conflicts:', error);
      throw error;
    }
  }, [conflictingTransactions]);

  /**
   * Get sync history
   */
  const getSyncHistory = useCallback((limit?: number): SyncHistoryEntry[] => {
    const history = autoSyncServiceRef.current.getSyncHistory();
    return limit ? history.slice(0, limit) : history;
  }, []);

  /**
   * Clear sync history
   */
  const clearSyncHistory = useCallback(() => {
    localStorage.removeItem('sync_history');
    localStorage.removeItem('sync_conflicts');
    localStorage.removeItem('last_sync_times');
    setConflictingTransactions([]);
    setLastSyncTimes({});
    setErrors([]);
  }, []);

  /**
   * Get default exchanges from configuration
   */
  const getDefaultExchanges = useCallback(async (): Promise<ExchangeConnection[]> => {
    // Mock implementation - in real app, this would load from user settings
    return [
      {
        id: 'coinbase',
        name: 'Coinbase',
        type: 'coinbase',
        apiKey: 'mock-key',
        apiSecret: 'mock-secret',
        isConnected: true,
        rateLimits: {
          requestsPerSecond: 10,
          requestsPerMinute: 600,
          requestsPerHour: 36000,
          interval: 1000
        },
        endpoints: {
          baseUrl: 'https://api.coinbase.com/v2',
          tradingPairs: '/trading-pairs',
          transactions: '/transactions',
          balances: '/accounts',
          orderHistory: '/orders',
          deposits: '/deposits',
          withdrawals: '/withdrawals'
        },
        permissions: {
          read: true,
          trade: false,
          withdraw: false
        }
      }
    ];
  }, []);

  /**
   * Save conflicts to storage
   */
  const saveConflicts = useCallback((conflicts: ConflictData[]) => {
    try {
      localStorage.setItem('sync_conflicts', JSON.stringify(conflicts));
    } catch (error) {
      console.error('Failed to save conflicts:', error);
    }
  }, []);

  return {
    // State
    syncProgress,
    syncStatus,
    lastSyncTimes,
    conflictingTransactions,
    errors,
    isRunning,
    
    // Actions
    startSync,
    stopSync,
    pauseSync,
    resumeSync,
    retrySync,
    
    // Configuration
    updateSyncConfig,
    getSyncConfig,
    
    // Conflicts
    resolveConflict,
    resolveAllConflicts,
    
    // History
    getSyncHistory,
    clearSyncHistory
  };
};