import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UseSyncStatusReturn,
  SyncStatus,
  ExchangeStatus,
  SyncStatistics,
  PerformanceMetrics,
  HealthMetrics,
  ConnectionTest,
  DetailedSyncStatus,
  HealthStatus,
  HealthCheckResult,
  Alert,
  AlertType,
  ExchangeConnection,
  SyncConfiguration,
  SyncOperation,
  SyncJob,
  SyncHistoryEntry,
  ResourceUtilization,
  RateLimitStatus
} from '../types/sync.types';
import { AutoSyncService } from '../services/AutoSyncService';
import { SyncSchedulerService } from '../services/SyncSchedulerService';

interface UseSyncStatusOptions {
  refreshInterval?: number;
  enableHealthChecks?: boolean;
  enablePerformanceMonitoring?: boolean;
  onStatusChange?: (status: SyncStatus) => void;
  onHealthChange?: (health: HealthStatus) => void;
  onAlert?: (alert: Alert) => void;
}

export const useSyncStatus = (options: UseSyncStatusOptions = {}): UseSyncStatusReturn => {
  const {
    refreshInterval = 5000,
    enableHealthChecks = true,
    enablePerformanceMonitoring = true,
    onStatusChange,
    onHealthChange,
    onAlert
  } = options;

  // State
  const [overallStatus, setOverallStatus] = useState<SyncStatus>('idle');
  const [isHealthy, setIsHealthy] = useState(true);
  const [lastActivity, setLastActivity] = useState<string>(new Date().toISOString());
  const [exchangeStatuses, setExchangeStatuses] = useState<{ [exchangeId: string]: ExchangeStatus }>({});
  const [connectedExchanges, setConnectedExchanges] = useState<string[]>([]);
  const [disconnectedExchanges, setDisconnectedExchanges] = useState<string[]>([]);
  const [syncStatistics, setSyncStatistics] = useState<SyncStatistics>({
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalTransactions: 0,
    totalConflicts: 0,
    resolvedConflicts: 0,
    averageSyncTime: 0,
    averageTransactionsPerSync: 0,
    uptimePercentage: 100,
    errorRate: 0
  });
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    totalTime: 0,
    networkTime: 0,
    processTime: 0,
    memoryPeak: 0,
    memoryAverage: 0,
    cpuPeak: 0,
    cpuAverage: 0,
    diskIO: 0,
    networkIO: 0,
    cacheHitRate: 0
  });
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>({
    uptime: 0,
    availability: 100,
    reliability: 100,
    performance: 100,
    errorRate: 0,
    responseTime: 0,
    throughput: 0,
    resourceUtilization: {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0,
      database: 0
    }
  });

  // Services
  const autoSyncServiceRef = useRef(new AutoSyncService());
  const schedulerServiceRef = useRef(new SyncSchedulerService());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(Date.now());

  // Initialize monitoring
  useEffect(() => {
    refreshStatus();
    
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(refreshStatus, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshInterval]);

  /**
   * Refresh all status information
   */
  const refreshStatus = useCallback(async () => {
    try {
      await Promise.all([
        updateOverallStatus(),
        updateExchangeStatuses(),
        updateSyncStatistics(),
        updatePerformanceMetrics(),
        updateHealthMetrics()
      ]);
    } catch (error) {
      console.error('Failed to refresh sync status:', error);
    }
  }, []);

  /**
   * Update overall sync status
   */
  const updateOverallStatus = useCallback(async () => {
    const currentOperation = autoSyncServiceRef.current.getCurrentOperation();
    const isRunning = autoSyncServiceRef.current.isOperationRunning();
    const schedulerStatus = schedulerServiceRef.current.getSchedulerStatus();

    let status: SyncStatus = 'idle';
    
    if (currentOperation) {
      status = currentOperation.status;
    } else if (isRunning) {
      status = 'syncing';
    } else if (schedulerStatus.activeJobs > 0) {
      status = 'syncing';
    }

    const previousStatus = overallStatus;
    setOverallStatus(status);
    
    if (previousStatus !== status) {
      onStatusChange?.(status);
    }

    // Update last activity
    if (status !== 'idle') {
      setLastActivity(new Date().toISOString());
    }
  }, [overallStatus, onStatusChange]);

  /**
   * Update exchange statuses
   */
  const updateExchangeStatuses = useCallback(async () => {
    const exchanges = await getConfiguredExchanges();
    const statuses: { [exchangeId: string]: ExchangeStatus } = {};
    const connected: string[] = [];
    const disconnected: string[] = [];

    for (const exchange of exchanges) {
      const status = await getExchangeStatus(exchange);
      statuses[exchange.id] = status;
      
      if (status.status === 'connected') {
        connected.push(exchange.id);
      } else {
        disconnected.push(exchange.id);
      }
    }

    setExchangeStatuses(statuses);
    setConnectedExchanges(connected);
    setDisconnectedExchanges(disconnected);

    // Update overall health based on exchange statuses
    const healthyExchanges = Object.values(statuses).filter(s => s.health.overall === 'healthy').length;
    const totalExchanges = Object.keys(statuses).length;
    const healthRatio = totalExchanges > 0 ? healthyExchanges / totalExchanges : 1;
    
    const newIsHealthy = healthRatio >= 0.8; // 80% of exchanges should be healthy
    const previousIsHealthy = isHealthy;
    setIsHealthy(newIsHealthy);
    
    if (previousIsHealthy !== newIsHealthy) {
      onHealthChange?.({
        overall: newIsHealthy ? 'healthy' : 'warning',
        checks: {},
        score: healthRatio * 100,
        lastChecked: new Date().toISOString()
      });
    }
  }, [isHealthy, onHealthChange]);

  /**
   * Update sync statistics
   */
  const updateSyncStatistics = useCallback(async () => {
    const history = autoSyncServiceRef.current.getSyncHistory();
    const schedulerStatus = schedulerServiceRef.current.getSchedulerStatus();
    
    const totalSyncs = history.length;
    const successfulSyncs = history.filter(h => h.status === 'completed').length;
    const failedSyncs = history.filter(h => h.status === 'error').length;
    const totalTransactions = history.reduce((sum, h) => sum + h.results.totalRecords, 0);
    const totalConflicts = history.reduce((sum, h) => sum + h.conflicts.length, 0);
    const resolvedConflicts = history.reduce((sum, h) => 
      sum + h.conflicts.filter(c => c.status === 'resolved').length, 0
    );
    
    const avgSyncTime = totalSyncs > 0 
      ? history.reduce((sum, h) => sum + (h.duration || 0), 0) / totalSyncs 
      : 0;
    
    const avgTransactionsPerSync = totalSyncs > 0 ? totalTransactions / totalSyncs : 0;
    
    const uptime = Date.now() - startTimeRef.current;
    const uptimePercentage = 100; // Simplified - would track actual downtime in real implementation
    
    const errorRate = totalSyncs > 0 ? (failedSyncs / totalSyncs) * 100 : 0;

    setSyncStatistics({
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      totalTransactions,
      totalConflicts,
      resolvedConflicts,
      averageSyncTime: avgSyncTime,
      averageTransactionsPerSync: avgTransactionsPerSync,
      uptimePercentage,
      errorRate
    });

    // Update error and warning counts
    const allErrors = history.reduce((sum, h) => sum + h.errors.length, 0);
    setErrorCount(allErrors);
    
    const allWarnings = Object.values(exchangeStatuses).reduce((sum, e) => sum + e.warnings.length, 0);
    setWarningCount(allWarnings);
  }, [exchangeStatuses]);

  /**
   * Update performance metrics
   */
  const updatePerformanceMetrics = useCallback(async () => {
    if (!enablePerformanceMonitoring) return;

    const history = autoSyncServiceRef.current.getSyncHistory();
    
    if (history.length === 0) return;

    const recentHistory = history.slice(0, 10); // Last 10 operations
    
    const totalTime = recentHistory.reduce((sum, h) => sum + (h.duration || 0), 0) / recentHistory.length;
    const networkTime = recentHistory.reduce((sum, h) => sum + h.performance.networkTime, 0) / recentHistory.length;
    const processTime = recentHistory.reduce((sum, h) => sum + h.performance.processTime, 0) / recentHistory.length;
    
    setPerformanceMetrics({
      totalTime,
      networkTime,
      processTime,
      memoryPeak: Math.max(...recentHistory.map(h => h.performance.memoryPeak)),
      memoryAverage: recentHistory.reduce((sum, h) => sum + h.performance.memoryAverage, 0) / recentHistory.length,
      cpuPeak: Math.max(...recentHistory.map(h => h.performance.cpuPeak)),
      cpuAverage: recentHistory.reduce((sum, h) => sum + h.performance.cpuAverage, 0) / recentHistory.length,
      diskIO: recentHistory.reduce((sum, h) => sum + h.performance.diskIO, 0) / recentHistory.length,
      networkIO: recentHistory.reduce((sum, h) => sum + h.performance.networkIO, 0) / recentHistory.length,
      cacheHitRate: recentHistory.reduce((sum, h) => sum + h.performance.cacheHitRate, 0) / recentHistory.length
    });
  }, [enablePerformanceMonitoring]);

  /**
   * Update health metrics
   */
  const updateHealthMetrics = useCallback(async () => {
    if (!enableHealthChecks) return;

    const uptime = Date.now() - startTimeRef.current;
    const history = autoSyncServiceRef.current.getSyncHistory();
    
    const recentHistory = history.slice(0, 20); // Last 20 operations
    const successRate = recentHistory.length > 0 
      ? (recentHistory.filter(h => h.status === 'completed').length / recentHistory.length) * 100
      : 100;
    
    const avgResponseTime = recentHistory.length > 0
      ? recentHistory.reduce((sum, h) => sum + (h.duration || 0), 0) / recentHistory.length
      : 0;
    
    const throughput = recentHistory.length > 0
      ? recentHistory.reduce((sum, h) => sum + h.results.totalRecords, 0) / (uptime / 1000)
      : 0;

    const resourceUtilization: ResourceUtilization = {
      cpu: Math.random() * 30, // Mock values - would be real metrics in production
      memory: Math.random() * 40,
      disk: Math.random() * 20,
      network: Math.random() * 50,
      database: Math.random() * 35
    };

    setHealthMetrics({
      uptime: uptime / 1000, // Convert to seconds
      availability: successRate,
      reliability: successRate,
      performance: Math.max(0, 100 - (avgResponseTime / 1000)), // Inverse of response time
      errorRate: 100 - successRate,
      responseTime: avgResponseTime,
      throughput,
      resourceUtilization
    });
  }, [enableHealthChecks]);

  /**
   * Test connection to specific exchange
   */
  const testConnection = useCallback(async (exchangeId: string): Promise<ConnectionTest> => {
    const startTime = Date.now();
    
    try {
      // Mock connection test
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      const latency = Date.now() - startTime;
      const success = Math.random() > 0.1; // 90% success rate
      
      if (!success) {
        throw new Error('Connection test failed');
      }

      return {
        exchangeId,
        success: true,
        latency,
        permissions: {
          read: true,
          trade: false,
          withdraw: false
        },
        rateLimits: {
          remaining: Math.floor(Math.random() * 1000),
          limit: 1000,
          resetTime: new Date(Date.now() + 60000).toISOString(),
          blocked: false
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        exchangeId,
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Connection failed',
        permissions: {
          read: false,
          trade: false,
          withdraw: false
        },
        rateLimits: {
          remaining: 0,
          limit: 1000,
          resetTime: new Date(Date.now() + 60000).toISOString(),
          blocked: true
        },
        timestamp: new Date().toISOString()
      };
    }
  }, []);

  /**
   * Get detailed sync status
   */
  const getDetailedStatus = useCallback((): DetailedSyncStatus => {
    const activeOperations: SyncOperation[] = [];
    const currentOp = autoSyncServiceRef.current.getCurrentOperation();
    if (currentOp) {
      activeOperations.push(currentOp);
    }

    const queuedOperations = schedulerServiceRef.current.getJobsByStatus('waiting');
    const recentHistory = autoSyncServiceRef.current.getSyncHistory().slice(0, 10);
    const configurations = schedulerServiceRef.current.getSyncConfigurations();

    const alerts: Alert[] = []; // Would be populated from alert system

    return {
      overall: overallStatus,
      exchanges: exchangeStatuses,
      activeOperations,
      queuedOperations,
      recentHistory,
      systemHealth: healthMetrics,
      alerts,
      configurations
    };
  }, [overallStatus, exchangeStatuses, healthMetrics]);

  /**
   * Helper functions
   */
  const getConfiguredExchanges = useCallback(async (): Promise<ExchangeConnection[]> => {
    // Mock implementation - would load from user configuration
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
      },
      {
        id: 'binance',
        name: 'Binance',
        type: 'binance',
        apiKey: 'mock-key',
        apiSecret: 'mock-secret',
        isConnected: true,
        rateLimits: {
          requestsPerSecond: 20,
          requestsPerMinute: 1200,
          requestsPerHour: 72000,
          interval: 1000
        },
        endpoints: {
          baseUrl: 'https://api.binance.com/api/v3',
          tradingPairs: '/exchangeInfo',
          transactions: '/myTrades',
          balances: '/account',
          orderHistory: '/allOrders',
          deposits: '/depositHistory',
          withdrawals: '/withdrawHistory'
        },
        permissions: {
          read: true,
          trade: true,
          withdraw: false
        }
      }
    ];
  }, []);

  const getExchangeStatus = useCallback(async (exchange: ExchangeConnection): Promise<ExchangeStatus> => {
    const connectionTest = await testConnection(exchange.id);
    const history = autoSyncServiceRef.current.getSyncHistory();
    const exchangeHistory = history.filter(h => h.exchanges.includes(exchange.id));
    
    const lastSync = exchangeHistory.length > 0 
      ? exchangeHistory[0].completedAt || exchangeHistory[0].startedAt
      : '';

    const status = connectionTest.success ? 'connected' : 'error';
    
    const healthChecks: { [checkId: string]: HealthCheckResult } = {
      'connection': {
        checkId: 'connection',
        name: 'Connection Test',
        status: connectionTest.success ? 'pass' : 'fail',
        value: connectionTest.latency,
        threshold: 1000,
        message: connectionTest.success ? 'Connection successful' : connectionTest.error || 'Connection failed',
        timestamp: connectionTest.timestamp
      },
      'rate-limit': {
        checkId: 'rate-limit',
        name: 'Rate Limit Status',
        status: connectionTest.rateLimits.blocked ? 'fail' : 'pass',
        value: connectionTest.rateLimits.remaining,
        threshold: 100,
        message: connectionTest.rateLimits.blocked ? 'Rate limited' : 'Rate limit OK',
        timestamp: connectionTest.timestamp
      }
    };

    const healthScore = Object.values(healthChecks).reduce((score, check) => {
      return score + (check.status === 'pass' ? 50 : check.status === 'warn' ? 25 : 0);
    }, 0);

    const health: HealthStatus = {
      overall: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'warning' : 'error',
      checks: healthChecks,
      score: healthScore,
      lastChecked: new Date().toISOString()
    };

    const recentHistory = exchangeHistory.slice(0, 5);
    const performance = {
      fetchTime: recentHistory.reduce((sum, h) => sum + h.performance.networkTime, 0) / Math.max(recentHistory.length, 1),
      processTime: recentHistory.reduce((sum, h) => sum + h.performance.processTime, 0) / Math.max(recentHistory.length, 1),
      avgRequestTime: connectionTest.latency,
      rateLimitHits: 0, // Would be tracked from actual usage
      retries: 0,
      dataTransferred: 0
    };

    return {
      exchangeId: exchange.id,
      name: exchange.name,
      status,
      lastSync,
      health,
      errors: exchangeHistory.reduce((errors, h) => [...errors, ...h.errors], []).slice(0, 5),
      warnings: [], // Would be populated from exchange-specific warnings
      performance
    };
  }, [testConnection]);

  return {
    // Overall status
    overallStatus,
    isHealthy,
    lastActivity,
    
    // Exchange statuses
    exchangeStatuses,
    connectedExchanges,
    disconnectedExchanges,
    
    // Statistics
    syncStatistics,
    errorCount,
    warningCount,
    
    // Performance
    performanceMetrics,
    healthMetrics,
    
    // Actions
    refreshStatus,
    testConnection,
    getDetailedStatus
  };
};