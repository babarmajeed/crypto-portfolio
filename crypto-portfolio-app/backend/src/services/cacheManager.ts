import { EventEmitter } from 'events';
import { CacheService } from './cacheService';
import { DatabaseCache } from './databaseCache';
import { performanceMonitor } from './performanceMonitor';
import { RedisService, redisService } from './redisService';
import { logger } from '../utils/logger';
import {
  CacheWarmingJob,
  CacheInvalidationRule,
  CacheHealth,
  CacheStatistics,
  PerformanceMetrics,
} from '../types/cache.types';
import { 
  cacheConfig, 
  cacheWarmingConfig, 
  cacheInvalidationRules,
  getEnvironmentConfig 
} from '../config/cache.config';
import cron from 'node-cron';

export interface CacheManagerOptions {
  enableMonitoring?: boolean;
  enableWarming?: boolean;
  enableAutoInvalidation?: boolean;
  enableHealthChecks?: boolean;
  warmingConcurrency?: number;
}

export class CacheManager extends EventEmitter {
  private cacheService!: CacheService;
  private databaseCache!: DatabaseCache;
  private redisService: RedisService;
  private options: Required<CacheManagerOptions>;
  
  // Warming and invalidation
  private warmingJobs: Map<string, CacheWarmingJob>;
  private invalidationRules: Map<string, CacheInvalidationRule>;
  private cronJobs: Map<string, cron.ScheduledTask>;
  
  // Health and monitoring
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(options: CacheManagerOptions = {}) {
    super();
    
    this.redisService = redisService;
    this.warmingJobs = new Map();
    this.invalidationRules = new Map();
    this.cronJobs = new Map();
    
    this.options = {
      enableMonitoring: options.enableMonitoring !== false,
      enableWarming: options.enableWarming !== false,
      enableAutoInvalidation: options.enableAutoInvalidation !== false,
      enableHealthChecks: options.enableHealthChecks !== false,
      warmingConcurrency: options.warmingConcurrency || cacheConfig.warming.concurrency,
    };

    logger.info('CacheManager initialized', this.options);
  }

  /**
   * Initialize all cache services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CacheManager already initialized');
      return;
    }

    try {
      logger.info('Initializing CacheManager...');

      // Ensure Redis is connected
      if (!this.redisService) {
        throw new Error('RedisService not available');
      }

      // Initialize cache service
      this.cacheService = new CacheService(this.redisService, {
        compression: cacheConfig.compression.enabled,
        monitoring: this.options.enableMonitoring,
      });

      // Initialize database cache
      this.databaseCache = new DatabaseCache(this.cacheService, {
        enabled: true,
        defaultTTL: cacheConfig.redis.connectTimeout || 300,
      });

      // Set global instances
      const cacheServiceModule = await import('./cacheService');
      const databaseCacheModule = await import('./databaseCache');
      (cacheServiceModule as any).cacheService = this.cacheService;
      (databaseCacheModule as any).databaseCache = this.databaseCache;

      // Setup monitoring
      if (this.options.enableMonitoring) {
        this.setupMonitoring();
      }

      // Setup health checks
      if (this.options.enableHealthChecks) {
        this.setupHealthChecks();
      }

      // Setup cache warming
      if (this.options.enableWarming) {
        await this.setupCacheWarming();
      }

      // Setup invalidation rules
      if (this.options.enableAutoInvalidation) {
        this.setupInvalidationRules();
      }

      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('CacheManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CacheManager:', error);
      throw error;
    }
  }

  /**
   * Get cache service instance
   */
  public getCacheService(): CacheService {
    this.ensureInitialized();
    return this.cacheService;
  }

  /**
   * Get database cache instance
   */
  public getDatabaseCache(): DatabaseCache {
    this.ensureInitialized();
    return this.databaseCache;
  }

  /**
   * Warm cache with predefined strategies
   */
  public async warmCache(strategy: 'startup' | 'scheduled' | 'manual' = 'manual'): Promise<void> {
    if (!this.options.enableWarming) {
      logger.warn('Cache warming is disabled');
      return;
    }

    logger.info(`Starting cache warming with strategy: ${strategy}`);
    
    try {
      const jobs = this.createWarmingJobs(strategy);
      await this.executeWarmingJobs(jobs);
      
      logger.info(`Cache warming completed for strategy: ${strategy}`);
      this.emit('warming-completed', { strategy, jobs: jobs.length });
    } catch (error) {
      logger.error(`Cache warming failed for strategy ${strategy}:`, error);
      this.emit('warming-failed', { strategy, error });
      throw error;
    }
  }

  /**
   * Invalidate cache based on rules
   */
  public async invalidateByEvent(event: string, data?: any): Promise<number> {
    if (!this.options.enableAutoInvalidation) {
      return 0;
    }

    let totalInvalidated = 0;

    try {
      // Find matching invalidation rules
      const matchingRules = Array.from(this.invalidationRules.values())
        .filter(rule => this.matchesInvalidationRule(rule, event, data));

      for (const rule of matchingRules) {
        const invalidated = await this.executeInvalidationRule(rule);
        totalInvalidated += invalidated;
      }

      if (totalInvalidated > 0) {
        logger.info(`Invalidated ${totalInvalidated} cache entries for event: ${event}`);
        this.emit('invalidation-completed', { event, count: totalInvalidated });
      }

      return totalInvalidated;
    } catch (error) {
      logger.error(`Cache invalidation failed for event ${event}:`, error);
      this.emit('invalidation-failed', { event, error });
      return 0;
    }
  }

  /**
   * Get comprehensive health status
   */
  public async getHealth(): Promise<CacheHealth> {
    this.ensureInitialized();

    const redisHealth = await this.redisService.healthCheck();
    const cacheStats = this.cacheService.getStatistics();
    
    const health: CacheHealth = {
      status: 'healthy',
      checks: {
        redis: {
          connected: redisHealth.connected,
          latency: redisHealth.latency || 0,
          memoryUsage: 0, // Would need Redis memory info
          connectionCount: 1, // Would need Redis connection count
        },
        memory: {
          usage: cacheStats.l1.size / cacheStats.l1.maxSize,
          itemCount: cacheStats.l1.items,
          evictionRate: 0, // Would need eviction tracking
        },
        performance: {
          hitRate: cacheStats.total.hitRate,
          avgResponseTime: 0, // Average from performance monitor
          errorRate: cacheStats.total.errors / (cacheStats.total.hits + cacheStats.total.misses) || 0,
        },
      },
      timestamp: Date.now(),
      uptime: process.uptime() * 1000,
    };

    // Determine overall status
    if (!redisHealth.connected) {
      health.status = 'unhealthy';
    } else if (health.checks.performance.hitRate < 0.7 || 
               health.checks.memory.usage > 0.9 ||
               health.checks.performance.errorRate > 0.05) {
      health.status = 'degraded';
    }

    return health;
  }

  /**
   * Get comprehensive statistics
   */
  public getStatistics(): {
    cache: any;
    database: any;
    performance: PerformanceMetrics;
    warming: any;
    invalidation: any;
  } {
    this.ensureInitialized();

    const cacheStats = this.cacheService.getStatistics();
    const dbStats = this.databaseCache.getStatistics();
    const performanceStats = performanceMonitor.getMetrics();

    return {
      cache: cacheStats,
      database: dbStats,
      performance: performanceStats,
      warming: {
        enabled: this.options.enableWarming,
        activeJobs: this.warmingJobs.size,
        strategies: cacheWarmingConfig,
      },
      invalidation: {
        enabled: this.options.enableAutoInvalidation,
        rules: this.invalidationRules.size,
        lastInvalidation: null, // Would track last invalidation time
      },
    };
  }

  /**
   * Clear all caches
   */
  public async clearAll(): Promise<void> {
    this.ensureInitialized();

    logger.info('Clearing all caches...');
    
    try {
      await Promise.all([
        this.cacheService.clearL1Cache(),
        this.cacheService.clearL2Cache(),
        this.databaseCache.clearCache(),
      ]);
      
      logger.info('All caches cleared successfully');
      this.emit('caches-cleared');
    } catch (error) {
      logger.error('Failed to clear caches:', error);
      throw error;
    }
  }

  /**
   * Shutdown cache manager
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down CacheManager...');

    try {
      // Stop monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }

      // Stop cron jobs
      this.cronJobs.forEach(job => job.stop());
      this.cronJobs.clear();

      // Cleanup services
      if (this.cacheService) {
        this.cacheService.destroy();
      }

      // Cleanup performance monitor
      performanceMonitor.destroy();

      this.isInitialized = false;
      this.emit('shutdown');
      
      logger.info('CacheManager shutdown completed');
    } catch (error) {
      logger.error('Error during CacheManager shutdown:', error);
      throw error;
    }
  }

  private setupMonitoring(): void {
    // Setup metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectAndEmitMetrics();
    }, cacheConfig.monitoring.metricsInterval * 1000);

    // Listen to performance monitor events
    performanceMonitor.on('alert', (alert) => {
      this.emit('performance-alert', alert);
      logger.warn('Performance alert:', alert);
    });

    performanceMonitor.on('metrics', (metrics) => {
      this.emit('metrics-updated', metrics);
    });
  }

  private setupHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealth();
        this.emit('health-check', health);
        
        if (health.status === 'unhealthy') {
          logger.error('Cache system is unhealthy:', health);
        } else if (health.status === 'degraded') {
          logger.warn('Cache system is degraded:', health);
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, cacheConfig.monitoring.healthCheckInterval * 1000);
  }

  private async setupCacheWarming(): Promise<void> {
    if (cacheWarmingConfig.startup.enabled) {
      // Warm cache on startup
      setTimeout(() => {
        this.warmCache('startup').catch(error => {
          logger.error('Startup cache warming failed:', error);
        });
      }, 5000); // Wait 5 seconds for system to stabilize
    }

    if (cacheWarmingConfig.scheduled.enabled) {
      // Setup scheduled warming
      const cronJob = cron.schedule(cacheWarmingConfig.scheduled.schedule, () => {
        this.warmCache('scheduled').catch(error => {
          logger.error('Scheduled cache warming failed:', error);
        });
      }, { scheduled: false });

      this.cronJobs.set('scheduled-warming', cronJob);
      cronJob.start();
    }
  }

  private setupInvalidationRules(): void {
    Object.entries(cacheInvalidationRules).forEach(([event, rule]) => {
      this.invalidationRules.set(event, {
        pattern: rule.patterns[0], // Simplified
        tags: [],
        namespace: 'api',
        strategy: rule.strategy,
        dependencies: [],
      });
    });
  }

  private createWarmingJobs(strategy: 'startup' | 'scheduled' | 'manual'): CacheWarmingJob[] {
    const jobs: CacheWarmingJob[] = [];
    const config = strategy === 'startup' ? cacheWarmingConfig.startup : cacheWarmingConfig.scheduled;

    if (!config.enabled) {
      return jobs;
    }

    const job: CacheWarmingJob = {
      id: `${strategy}-${Date.now()}`,
      type: strategy,
      keys: config.keys,
      priority: config.priority,
      batchSize: cacheConfig.warming.batchSize,
      status: 'pending',
    };

    jobs.push(job);
    this.warmingJobs.set(job.id, job);

    return jobs;
  }

  private async executeWarmingJobs(jobs: CacheWarmingJob[]): Promise<void> {
    const concurrency = this.options.warmingConcurrency;
    const batches = this.chunkArray(jobs, concurrency);

    for (const batch of batches) {
      await Promise.all(batch.map(job => this.executeWarmingJob(job)));
    }
  }

  private async executeWarmingJob(job: CacheWarmingJob): Promise<void> {
    job.status = 'running';
    job.startTime = Date.now();

    try {
      // This is a simplified implementation
      // In practice, you'd execute actual warming strategies
      for (const key of job.keys) {
        // Simulate warming by checking if key exists
        await this.cacheService.exists('api', key);
      }

      job.status = 'completed';
      job.endTime = Date.now();
      job.progress = 100;
    } catch (error) {
      job.status = 'failed';
      job.endTime = Date.now();
      job.error = (error as Error).message;
    } finally {
      this.warmingJobs.delete(job.id);
    }
  }

  private matchesInvalidationRule(rule: CacheInvalidationRule, event: string, data?: any): boolean {
    // Simplified rule matching
    return rule.pattern.includes(event) || event.includes(rule.pattern);
  }

  private async executeInvalidationRule(rule: CacheInvalidationRule): Promise<number> {
    let invalidated = 0;

    try {
      if (rule.tags && rule.tags.length > 0) {
        invalidated += await this.cacheService.invalidateByTags(rule.tags);
      }

      if (rule.namespace) {
        invalidated += await this.cacheService.invalidateNamespace(rule.namespace as any);
      }

      return invalidated;
    } catch (error) {
      logger.error('Failed to execute invalidation rule:', error);
      return 0;
    }
  }

  private collectAndEmitMetrics(): void {
    try {
      const stats = this.getStatistics();
      this.emit('metrics-collected', stats);
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('CacheManager not initialized. Call initialize() first.');
    }
  }
}

// Create and export singleton instance
export const cacheManager = new CacheManager({
  enableMonitoring: process.env.NODE_ENV !== 'test',
  enableWarming: process.env.NODE_ENV === 'production',
  enableAutoInvalidation: true,
  enableHealthChecks: process.env.NODE_ENV !== 'test',
});