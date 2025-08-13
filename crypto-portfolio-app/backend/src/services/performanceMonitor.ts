import { EventEmitter } from 'events';
import os from 'os';
import { logger } from '../utils/logger';
import { 
  PerformanceMetrics, 
  CacheMetrics, 
  CacheHealth, 
  CacheStatistics, 
  CacheEventData,
  CacheEventCallback,
  CacheMetricsCallback 
} from '../types/cache.types';
import { performanceThresholds } from '../config/cache.config';

export interface PerformanceMonitorOptions {
  metricsInterval?: number;
  healthCheckInterval?: number;
  enableDetailedMetrics?: boolean;
  enableAlerting?: boolean;
  alertThresholds?: typeof performanceThresholds;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private cacheStatistics: Map<string, CacheStatistics>;
  private eventCallbacks: Map<string, CacheEventCallback[]>;
  private metricsCallbacks: CacheMetricsCallback[];
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime: number;
  private options: Required<PerformanceMonitorOptions>;

  // Detailed tracking
  private operationTimes: Map<string, number[]>;
  private errorCounts: Map<string, number>;
  private hitMissCounters: Map<string, { hits: number; misses: number }>;

  constructor(options: PerformanceMonitorOptions = {}) {
    super();
    
    this.startTime = Date.now();
    this.options = {
      metricsInterval: options.metricsInterval || 30000, // 30 seconds
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      enableDetailedMetrics: options.enableDetailedMetrics !== false,
      enableAlerting: options.enableAlerting !== false,
      alertThresholds: options.alertThresholds || performanceThresholds,
    };

    this.metrics = this.initializeMetrics();
    this.cacheStatistics = new Map();
    this.eventCallbacks = new Map();
    this.metricsCallbacks = [];
    this.operationTimes = new Map();
    this.errorCounts = new Map();
    this.hitMissCounters = new Map();

    this.setupIntervals();
    
    logger.info('Performance Monitor initialized', {
      metricsInterval: this.options.metricsInterval,
      healthCheckInterval: this.options.healthCheckInterval,
      detailedMetrics: this.options.enableDetailedMetrics,
      alerting: this.options.enableAlerting,
    });
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      cache: {
        l1: { hits: 0, misses: 0, size: 0, items: 0, hitRate: 0, avgAccessTime: 0 },
        l2: { hits: 0, misses: 0, size: 0, items: 0, hitRate: 0, avgAccessTime: 0 },
        total: { hits: 0, misses: 0, hitRate: 0, avgAccessTime: 0 },
      },
      database: {
        totalQueries: 0,
        cachedQueries: 0,
        cacheHitRate: 0,
        avgQueryTime: 0,
        slowQueries: 0,
      },
      api: {
        totalRequests: 0,
        cachedResponses: 0,
        cacheHitRate: 0,
        avgResponseTime: 0,
        compressionRatio: 0,
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0,
        cacheMemoryUsage: 0,
      },
      system: {
        cpuUsage: 0,
        loadAverage: [0, 0, 0],
        uptime: 0,
        freeMemory: 0,
        totalMemory: 0,
      },
    };
  }

  private setupIntervals(): void {
    // Metrics collection interval
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.options.metricsInterval);

    // Health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }

  // Event tracking methods
  public trackCacheEvent(event: CacheEventData): void {
    const key = `${event.layer}:${event.type}`;
    
    // Update hit/miss counters
    if (event.type === 'hit' || event.type === 'miss') {
      if (!this.hitMissCounters.has(event.layer)) {
        this.hitMissCounters.set(event.layer, { hits: 0, misses: 0 });
      }
      const counter = this.hitMissCounters.get(event.layer)!;
      if (event.type === 'hit') counter.hits++;
      else counter.misses++;
    }

    // Track operation times
    if (event.executionTime !== undefined) {
      if (!this.operationTimes.has(key)) {
        this.operationTimes.set(key, []);
      }
      const times = this.operationTimes.get(key)!;
      times.push(event.executionTime);
      
      // Keep only recent measurements (last 1000)
      if (times.length > 1000) {
        times.splice(0, times.length - 1000);
      }
    }

    // Track errors
    if (event.error) {
      const errorKey = `${event.layer}:error`;
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    }

    // Execute callbacks
    const callbacks = this.eventCallbacks.get(event.type) || [];
    callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        logger.error('Error in cache event callback:', error);
      }
    });

    // Emit event for external listeners
    this.emit('cache-event', event);

    // Check for alerts
    if (this.options.enableAlerting) {
      this.checkAlerts(event);
    }
  }

  public trackL1CacheMetrics(metrics: { hits: number; misses: number; size: number; items: number }): void {
    this.metrics.cache.l1 = {
      ...metrics,
      hitRate: metrics.hits + metrics.misses > 0 ? metrics.hits / (metrics.hits + metrics.misses) : 0,
      avgAccessTime: this.getAverageTime('l1:get') || 0,
    };
    this.updateTotalCacheMetrics();
  }

  public trackL2CacheMetrics(metrics: { hits: number; misses: number; size: number; items: number }): void {
    this.metrics.cache.l2 = {
      ...metrics,
      hitRate: metrics.hits + metrics.misses > 0 ? metrics.hits / (metrics.hits + metrics.misses) : 0,
      avgAccessTime: this.getAverageTime('l2:get') || 0,
    };
    this.updateTotalCacheMetrics();
  }

  public trackDatabaseMetrics(metrics: Partial<PerformanceMetrics['database']>): void {
    Object.assign(this.metrics.database, metrics);
  }

  public trackApiMetrics(metrics: Partial<PerformanceMetrics['api']>): void {
    Object.assign(this.metrics.api, metrics);
  }

  private updateTotalCacheMetrics(): void {
    const l1 = this.metrics.cache.l1;
    const l2 = this.metrics.cache.l2;
    
    this.metrics.cache.total = {
      hits: l1.hits + l2.hits,
      misses: l1.misses + l2.misses,
      hitRate: (l1.hits + l2.hits) / (l1.hits + l1.misses + l2.hits + l2.misses) || 0,
      avgAccessTime: (l1.avgAccessTime + l2.avgAccessTime) / 2,
    };
  }

  private getAverageTime(key: string): number | null {
    const times = this.operationTimes.get(key);
    if (!times || times.length === 0) return null;
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  private collectMetrics(): void {
    // System metrics
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      cacheMemoryUsage: 0, // Will be updated by cache services
    };

    this.metrics.system = {
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      loadAverage: os.loadavg(),
      uptime: process.uptime(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
    };

    this.metrics.timestamp = Date.now();

    // Notify callbacks
    this.metricsCallbacks.forEach(callback => {
      try {
        const cacheMetrics: CacheMetrics = {
          hits: this.metrics.cache.total.hits,
          misses: this.metrics.cache.total.misses,
          sets: 0, // Updated by individual cache operations
          deletes: 0, // Updated by individual cache operations
          errors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
          totalOperations: this.metrics.cache.total.hits + this.metrics.cache.total.misses,
          hitRate: this.metrics.cache.total.hitRate,
          memoryUsage: this.metrics.memory.cacheMemoryUsage,
          connectionCount: 0, // Updated by Redis service
          avgResponseTime: this.metrics.cache.total.avgAccessTime,
          timestamp: this.metrics.timestamp,
        };
        callback(cacheMetrics);
      } catch (error) {
        logger.error('Error in metrics callback:', error);
      }
    });

    // Emit metrics event
    this.emit('metrics', this.metrics);
  }

  private performHealthCheck(): void {
    const health: CacheHealth = {
      status: 'healthy',
      checks: {
        redis: {
          connected: false,
          latency: 0,
          memoryUsage: 0,
          connectionCount: 0,
        },
        memory: {
          usage: this.metrics.memory.heapUsed / this.metrics.memory.heapTotal,
          itemCount: this.metrics.cache.l1.items,
          evictionRate: 0, // Would need to track evictions
        },
        performance: {
          hitRate: this.metrics.cache.total.hitRate,
          avgResponseTime: this.metrics.cache.total.avgAccessTime,
          errorRate: this.calculateErrorRate(),
        },
      },
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
    };

    // Determine overall health status
    const { excellent, good } = this.options.alertThresholds.cache;
    const hitRate = health.checks.performance.hitRate;
    const responseTime = health.checks.performance.avgResponseTime;
    const errorRate = health.checks.performance.errorRate;

    if (hitRate < excellent.hitRate || 
        responseTime > excellent.responseTime || 
        errorRate > excellent.errorRate) {
      health.status = hitRate < good.hitRate || 
                    responseTime > good.responseTime || 
                    errorRate > good.errorRate ? 'unhealthy' : 'degraded';
    }

    this.emit('health-check', health);
  }

  private calculateErrorRate(): number {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalOperations = this.metrics.cache.total.hits + this.metrics.cache.total.misses;
    return totalOperations > 0 ? totalErrors / totalOperations : 0;
  }

  private checkAlerts(event: CacheEventData): void {
    const thresholds = this.options.alertThresholds;

    // Check response time alerts
    if (event.executionTime && event.executionTime > thresholds.cache.responseTime.acceptable) {
      this.emit('alert', {
        type: 'slow-operation',
        severity: event.executionTime > thresholds.cache.responseTime.good ? 'high' : 'medium',
        message: `Slow ${event.type} operation on ${event.layer}: ${event.executionTime}ms`,
        event,
      });
    }

    // Check error alerts
    if (event.error) {
      this.emit('alert', {
        type: 'cache-error',
        severity: 'high',
        message: `Cache error in ${event.layer}: ${event.error.message}`,
        event,
      });
    }

    // Check hit rate alerts (periodically)
    const hitRate = this.metrics.cache.total.hitRate;
    if (hitRate < thresholds.cache.hitRate.acceptable) {
      this.emit('alert', {
        type: 'low-hit-rate',
        severity: hitRate < thresholds.cache.hitRate.good ? 'high' : 'medium',
        message: `Low cache hit rate: ${(hitRate * 100).toFixed(2)}%`,
        metrics: this.metrics,
      });
    }
  }

  // Public API methods
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getCacheStatistics(namespace?: string): CacheStatistics | Map<string, CacheStatistics> {
    if (namespace) {
      return this.cacheStatistics.get(namespace) || this.createEmptyStatistics();
    }
    return new Map(this.cacheStatistics);
  }

  public getTopKeys(limit: number = 10): Array<{ key: string; hits: number; avgTime: number }> {
    const keyStats = new Map<string, { hits: number; times: number[] }>();

    // Aggregate statistics from operation times
    this.operationTimes.forEach((times, key) => {
      const parts = key.split(':');
      if (parts[1] === 'get') {
        const cleanKey = parts[0];
        if (!keyStats.has(cleanKey)) {
          keyStats.set(cleanKey, { hits: 0, times: [] });
        }
        const stats = keyStats.get(cleanKey)!;
        stats.hits += times.length;
        stats.times.push(...times);
      }
    });

    return Array.from(keyStats.entries())
      .map(([key, stats]) => ({
        key,
        hits: stats.hits,
        avgTime: stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }

  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.cacheStatistics.clear();
    this.operationTimes.clear();
    this.errorCounts.clear();
    this.hitMissCounters.clear();
    this.startTime = Date.now();
    
    logger.info('Performance metrics reset');
  }

  public onCacheEvent(eventType: string, callback: CacheEventCallback): void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    this.eventCallbacks.get(eventType)!.push(callback);
  }

  public onMetrics(callback: CacheMetricsCallback): void {
    this.metricsCallbacks.push(callback);
  }

  public generateReport(): {
    summary: any;
    performance: PerformanceMetrics;
    statistics: Map<string, CacheStatistics>;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const hitRate = this.metrics.cache.total.hitRate;
    const avgResponseTime = this.metrics.cache.total.avgAccessTime;
    const errorRate = this.calculateErrorRate();

    // Generate recommendations based on performance
    if (hitRate < 0.8) {
      recommendations.push('Consider increasing cache TTL for frequently accessed data');
      recommendations.push('Review cache warming strategies for better hit rates');
    }

    if (avgResponseTime > 10) {
      recommendations.push('Optimize Redis configuration for better performance');
      recommendations.push('Consider increasing connection pool size');
    }

    if (errorRate > 0.01) {
      recommendations.push('Investigate and fix recurring cache errors');
      recommendations.push('Implement better error handling and fallback mechanisms');
    }

    if (this.metrics.memory.heapUsed / this.metrics.memory.heapTotal > 0.8) {
      recommendations.push('Monitor memory usage and consider implementing cache size limits');
    }

    const summary = {
      uptime: Date.now() - this.startTime,
      totalOperations: this.metrics.cache.total.hits + this.metrics.cache.total.misses,
      hitRate: hitRate,
      avgResponseTime: avgResponseTime,
      errorRate: errorRate,
      topKeys: this.getTopKeys(5),
    };

    return {
      summary,
      performance: this.metrics,
      statistics: this.cacheStatistics,
      recommendations,
    };
  }

  private createEmptyStatistics(): CacheStatistics {
    return {
      totalOperations: 0,
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      hitRate: 0,
      missRate: 0,
      errorRate: 0,
      avgResponseTime: 0,
      memoryUsage: { l1: 0, l2: 0, total: 0 },
      compressionStats: {
        enabled: false,
        totalCompressed: 0,
        compressionRatio: 0,
        timeSaved: 0,
      },
      topKeys: [],
      timestamps: {
        startTime: this.startTime,
        lastReset: this.startTime,
        uptime: Date.now() - this.startTime,
      },
    };
  }

  public destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.removeAllListeners();
    this.eventCallbacks.clear();
    this.metricsCallbacks.splice(0);
    
    logger.info('Performance Monitor destroyed');
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();