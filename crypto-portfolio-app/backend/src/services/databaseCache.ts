import crypto from 'crypto';
import { logger } from '../utils/logger';
import { CacheService } from './cacheService';
import { performanceMonitor } from './performanceMonitor';
import {
  DatabaseCacheOptions,
  DatabaseCacheResult,
  CacheEventData,
} from '../types/cache.types';
import { cacheTTLConfig } from '../config/cache.config';

export interface QueryCacheEntry {
  sql: string;
  params: any[];
  result: any;
  timestamp: number;
  executionTime: number;
  affectedTables: string[];
  queryType: 'select' | 'insert' | 'update' | 'delete';
  hash: string;
}

export interface DatabaseCacheConfig {
  enabled: boolean;
  defaultTTL: number;
  maxQueryLength: number;
  excludePatterns: string[];
  includePatterns: string[];
  invalidationRules: {
    [table: string]: {
      patterns: string[];
      dependencies: string[];
    };
  };
}

export class DatabaseCache {
  private cacheService: CacheService;
  private config: DatabaseCacheConfig;
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number; lastExecuted: number }>;
  private invalidationMap: Map<string, Set<string>>; // table -> cache keys

  constructor(cacheService: CacheService, config: Partial<DatabaseCacheConfig> = {}) {
    this.cacheService = cacheService;
    this.queryStats = new Map();
    this.invalidationMap = new Map();

    this.config = {
      enabled: config.enabled !== false,
      defaultTTL: config.defaultTTL || cacheTTLConfig.database.select,
      maxQueryLength: config.maxQueryLength || 10000,
      excludePatterns: config.excludePatterns || [
        'INSERT INTO',
        'UPDATE SET',
        'DELETE FROM',
        'CREATE TABLE',
        'DROP TABLE',
        'ALTER TABLE',
        'TRUNCATE',
        'PRAGMA',
      ],
      includePatterns: config.includePatterns || [
        'SELECT',
      ],
      invalidationRules: config.invalidationRules || this.getDefaultInvalidationRules(),
    };

    logger.info('DatabaseCache initialized', {
      enabled: this.config.enabled,
      defaultTTL: this.config.defaultTTL,
      maxQueryLength: this.config.maxQueryLength,
    });
  }

  private getDefaultInvalidationRules() {
    return {
      users: {
        patterns: ['user:*', 'session:*'],
        dependencies: ['portfolios', 'transactions', 'preferences'],
      },
      portfolios: {
        patterns: ['portfolio:*', 'user:*/portfolios'],
        dependencies: ['transactions', 'holdings'],
      },
      transactions: {
        patterns: ['portfolio:*', 'transaction:*'],
        dependencies: ['portfolios'],
      },
      prices: {
        patterns: ['price:*', 'market:*'],
        dependencies: ['portfolios'],
      },
      exchange_keys: {
        patterns: ['user:*/keys', 'exchange:*/keys'],
        dependencies: [],
      },
      preferences: {
        patterns: ['user:*/preferences'],
        dependencies: [],
      },
    };
  }

  /**
   * Cache a database query result
   */
  public async cacheQuery<T>(
    sql: string,
    params: any[] = [],
    result: T,
    options: DatabaseCacheOptions = {}
  ): Promise<boolean> {
    if (!this.config.enabled || !this.shouldCacheQuery(sql)) {
      return false;
    }

    try {
      const queryHash = this.generateQueryHash(sql, params);
      const cacheKey = `query:${queryHash}`;
      const queryType = this.detectQueryType(sql);
      const affectedTables = this.extractAffectedTables(sql);
      
      const cacheEntry: QueryCacheEntry = {
        sql: sql.trim(),
        params,
        result,
        timestamp: Date.now(),
        executionTime: options.ttl || 0,
        affectedTables,
        queryType,
        hash: queryHash,
      };

      const ttl = options.ttl || this.getTTLForQueryType(queryType);
      
      // Store in cache
      const cached = await this.cacheService.set('query', queryHash, cacheEntry, {
        ttl,
        tags: [...affectedTables, queryType],
        namespace: 'database',
      });

      if (cached) {
        // Track invalidation mapping
        affectedTables.forEach(table => {
          if (!this.invalidationMap.has(table)) {
            this.invalidationMap.set(table, new Set());
          }
          this.invalidationMap.get(table)!.add(cacheKey);
        });

        // Update query statistics
        this.updateQueryStats(queryHash, 0); // Cache time is essentially 0

        logger.debug('Query cached successfully', {
          hash: queryHash,
          tables: affectedTables,
          ttl,
          size: JSON.stringify(result).length,
        });
      }

      return cached;
    } catch (error) {
      logger.error('Failed to cache query:', error);
      return false;
    }
  }

  /**
   * Retrieve cached query result
   */
  public async getCachedQuery<T>(
    sql: string,
    params: any[] = [],
    options: DatabaseCacheOptions = {}
  ): Promise<DatabaseCacheResult<T> | null> {
    if (!this.config.enabled || !this.shouldCacheQuery(sql)) {
      return null;
    }

    const startTime = Date.now();

    try {
      const queryHash = this.generateQueryHash(sql, params);
      const cached = await this.cacheService.get<QueryCacheEntry>('query', queryHash);

      if (!cached) {
        this.trackCacheEvent('miss', queryHash, Date.now() - startTime);
        return null;
      }

      // Validate cache entry
      if (!this.isCacheEntryValid(cached, options)) {
        await this.cacheService.delete('query', queryHash);
        this.trackCacheEvent('miss', queryHash, Date.now() - startTime);
        return null;
      }

      const executionTime = Date.now() - startTime;
      this.trackCacheEvent('hit', queryHash, executionTime);

      return {
        data: cached.result as T,
        fromCache: true,
        cacheKey: queryHash,
        executionTime,
        queryHash,
      };
    } catch (error) {
      logger.error('Failed to retrieve cached query:', error);
      this.trackCacheEvent('error', sql, Date.now() - startTime, error as Error);
      return null;
    }
  }

  /**
   * Execute query with caching
   */
  public async executeWithCache<T>(
    executeFunction: () => Promise<T>,
    sql: string,
    params: any[] = [],
    options: DatabaseCacheOptions = {}
  ): Promise<DatabaseCacheResult<T>> {
    const startTime = Date.now();
    const queryHash = this.generateQueryHash(sql, params);

    try {
      // Try to get from cache first
      const cached = await this.getCachedQuery<T>(sql, params, options);
      if (cached) {
        return cached;
      }

      // Execute the actual query
      const queryStartTime = Date.now();
      const result = await executeFunction();
      const queryExecutionTime = Date.now() - queryStartTime;

      // Update query statistics
      this.updateQueryStats(queryHash, queryExecutionTime);

      // Cache the result if it's a SELECT query
      const queryType = this.detectQueryType(sql);
      if (queryType === 'select') {
        await this.cacheQuery(sql, params, result, {
          ...options,
          queryType,
        });
      }

      // Handle write operations - invalidate related cache entries
      if (queryType !== 'select') {
        await this.handleWriteOperation(sql, queryType);
      }

      const totalExecutionTime = Date.now() - startTime;
      
      // Track performance metrics
      performanceMonitor.trackDatabaseMetrics({
        totalQueries: 1,
        cachedQueries: 0,
        avgQueryTime: queryExecutionTime,
        slowQueries: queryExecutionTime > 1000 ? 1 : 0,
      });

      return {
        data: result,
        fromCache: false,
        cacheKey: queryHash,
        executionTime: totalExecutionTime,
        queryHash,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.trackCacheEvent('error', queryHash, executionTime, error as Error);
      throw error;
    }
  }

  /**
   * Invalidate cache entries for specific tables
   */
  public async invalidateByTable(tableName: string): Promise<number> {
    let invalidatedCount = 0;

    try {
      // Get cache keys for this table
      const cacheKeys = this.invalidationMap.get(tableName);
      if (!cacheKeys) {
        return 0;
      }

      // Invalidate each cache key
      for (const cacheKey of cacheKeys) {
        const keyParts = cacheKey.split(':');
        if (keyParts.length >= 2) {
          const hash = keyParts[1];
          const deleted = await this.cacheService.delete('query', hash);
          if (deleted) {
            invalidatedCount++;
          }
        }
      }

      // Clear the mapping for this table
      this.invalidationMap.delete(tableName);

      // Also invalidate by tags
      const tagInvalidated = await this.cacheService.invalidateByTags([tableName]);
      invalidatedCount += tagInvalidated;

      logger.info(`Invalidated ${invalidatedCount} cache entries for table: ${tableName}`);
      return invalidatedCount;
    } catch (error) {
      logger.error(`Failed to invalidate cache for table ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate cache entries by query pattern
   */
  public async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const invalidated = await this.cacheService.invalidateNamespace('query');
      logger.info(`Invalidated ${invalidated} query cache entries by pattern: ${pattern}`);
      return invalidated;
    } catch (error) {
      logger.error(`Failed to invalidate cache by pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Clear all query cache
   */
  public async clearCache(): Promise<void> {
    try {
      await this.cacheService.invalidateNamespace('query');
      this.invalidationMap.clear();
      this.queryStats.clear();
      logger.info('Database cache cleared');
    } catch (error) {
      logger.error('Failed to clear database cache:', error);
    }
  }

  private shouldCacheQuery(sql: string): boolean {
    const normalizedSql = sql.trim().toUpperCase();

    // Check if query is too long
    if (sql.length > this.config.maxQueryLength) {
      return false;
    }

    // Check exclude patterns
    if (this.config.excludePatterns.some(pattern => normalizedSql.includes(pattern))) {
      return false;
    }

    // Check include patterns
    return this.config.includePatterns.some(pattern => normalizedSql.startsWith(pattern));
  }

  private generateQueryHash(sql: string, params: any[]): string {
    const normalizedSql = sql.trim().replace(/\s+/g, ' ');
    const queryString = normalizedSql + JSON.stringify(params);
    return crypto.createHash('md5').update(queryString).digest('hex');
  }

  private detectQueryType(sql: string): 'select' | 'insert' | 'update' | 'delete' {
    const normalizedSql = sql.trim().toUpperCase();
    
    if (normalizedSql.startsWith('SELECT')) return 'select';
    if (normalizedSql.startsWith('INSERT')) return 'insert';
    if (normalizedSql.startsWith('UPDATE')) return 'update';
    if (normalizedSql.startsWith('DELETE')) return 'delete';
    
    return 'select'; // Default fallback
  }

  private extractAffectedTables(sql: string): string[] {
    const tables: string[] = [];
    const normalizedSql = sql.toUpperCase();

    // Simple regex patterns to extract table names
    const patterns = [
      /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(normalizedSql)) !== null) {
        const tableName = match[1].toLowerCase();
        if (!tables.includes(tableName)) {
          tables.push(tableName);
        }
      }
    });

    return tables;
  }

  private getTTLForQueryType(queryType: 'select' | 'insert' | 'update' | 'delete'): number {
    switch (queryType) {
      case 'select':
        return this.config.defaultTTL;
      default:
        return 0; // Don't cache write operations
    }
  }

  private isCacheEntryValid(entry: QueryCacheEntry, options: DatabaseCacheOptions): boolean {
    // Check if entry has expired
    const now = Date.now();
    const ttl = options.ttl || this.getTTLForQueryType(entry.queryType);
    const expiresAt = entry.timestamp + (ttl * 1000);
    
    if (now > expiresAt) {
      return false;
    }

    // Check dependencies if specified
    if (options.dependencies) {
      // This would require more complex dependency tracking
      // For now, we'll assume the entry is valid
    }

    return true;
  }

  private async handleWriteOperation(sql: string, queryType: 'insert' | 'update' | 'delete'): Promise<void> {
    const affectedTables = this.extractAffectedTables(sql);
    
    // Invalidate cache entries for affected tables
    for (const table of affectedTables) {
      await this.invalidateByTable(table);
      
      // Also invalidate dependent tables based on rules
      const rules = this.config.invalidationRules[table];
      if (rules) {
        for (const dependency of rules.dependencies) {
          await this.invalidateByTable(dependency);
        }
      }
    }

    logger.debug('Cache invalidation completed for write operation', {
      queryType,
      affectedTables,
      sql: sql.substring(0, 100) + '...',
    });
  }

  private updateQueryStats(queryHash: string, executionTime: number): void {
    const existing = this.queryStats.get(queryHash);
    if (existing) {
      existing.count++;
      existing.totalTime += executionTime;
      existing.avgTime = existing.totalTime / existing.count;
      existing.lastExecuted = Date.now();
    } else {
      this.queryStats.set(queryHash, {
        count: 1,
        totalTime: executionTime,
        avgTime: executionTime,
        lastExecuted: Date.now(),
      });
    }
  }

  private trackCacheEvent(
    type: 'hit' | 'miss' | 'error',
    key: string,
    executionTime: number,
    error?: Error
  ): void {
    const event: CacheEventData = {
      type,
      key,
      layer: 'database',
      timestamp: Date.now(),
      executionTime,
      namespace: 'query',
    };

    if (error) {
      event.error = error;
    }

    performanceMonitor.trackCacheEvent(event);
  }

  /**
   * Get cache statistics
   */
  public getStatistics() {
    const stats = {
      totalQueries: this.queryStats.size,
      cacheEnabled: this.config.enabled,
      invalidationMappings: this.invalidationMap.size,
      topQueries: Array.from(this.queryStats.entries())
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([hash, stats]) => ({
          hash,
          count: stats.count,
          avgTime: stats.avgTime,
          lastExecuted: stats.lastExecuted,
        })),
      slowQueries: Array.from(this.queryStats.entries())
        .filter(([, stats]) => stats.avgTime > 1000)
        .sort(([, a], [, b]) => b.avgTime - a.avgTime)
        .slice(0, 5)
        .map(([hash, stats]) => ({
          hash,
          avgTime: stats.avgTime,
          count: stats.count,
        })),
    };

    return stats;
  }

  /**
   * Warm up cache with common queries
   */
  public async warmCache(queries: Array<{ sql: string; params: any[]; executor: () => Promise<any> }>): Promise<void> {
    logger.info('Starting database cache warming...');
    
    for (const query of queries) {
      try {
        await this.executeWithCache(query.executor, query.sql, query.params);
      } catch (error) {
        logger.warn('Failed to warm cache for query:', { sql: query.sql.substring(0, 100), error });
      }
    }
    
    logger.info(`Database cache warmed with ${queries.length} queries`);
  }
}

// Export singleton instance (will be properly initialized in cacheManager)
export let databaseCache: DatabaseCache;