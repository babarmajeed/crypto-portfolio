import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import { RedisService } from './redisService';
import { performanceMonitor } from './performanceMonitor';
import { logger } from '../utils/logger';
import {
  CacheOptions,
  CacheEntry,
  CacheEventData,
  CacheLayer,
  CacheNamespace,
  ApiCacheOptions,
} from '../types/cache.types';
import { cacheConfig, cacheTTLConfig } from '../config/cache.config';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

export interface MultiLayerCacheOptions {
  l1Enabled?: boolean;
  l2Enabled?: boolean;
  compression?: boolean;
  monitoring?: boolean;
  fallbackToL1?: boolean;
  fallbackToL2?: boolean;
}

export class CacheService extends EventEmitter {
  private l1Cache: LRUCache<string, CacheEntry>;
  private l2Cache: RedisService;
  private config: typeof cacheConfig;
  private options: Required<MultiLayerCacheOptions>;
  private compressionThreshold: number;

  // Statistics tracking
  private stats = {
    l1: { hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0, size: 0 },
    l2: { hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0, size: 0 },
    operations: { total: 0, compressed: 0, compressionTime: 0 },
  };

  constructor(
    redisService: RedisService,
    options: MultiLayerCacheOptions = {}
  ) {
    super();

    this.config = cacheConfig;
    this.l2Cache = redisService;
    this.compressionThreshold = this.config.compression.threshold;

    this.options = {
      l1Enabled: options.l1Enabled !== false,
      l2Enabled: options.l2Enabled !== false,
      compression: options.compression !== false && this.config.compression.enabled,
      monitoring: options.monitoring !== false,
      fallbackToL1: options.fallbackToL1 !== false,
      fallbackToL2: options.fallbackToL2 !== false,
    };

    // Initialize L1 cache (in-memory)
    this.l1Cache = new LRUCache<string, CacheEntry>({
      max: 1000, // Maximum number of items
      maxSize: this.config.memory.maxSize * 1024 * 1024, // Convert MB to bytes
      sizeCalculation: (value) => this.calculateSize(value),
      ttl: this.config.memory.ttl * 1000, // Convert seconds to milliseconds
      allowStale: true,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      dispose: (value, key, reason) => {
        this.handleL1Eviction(key, value, reason);
      },
    });

    // Setup monitoring
    if (this.options.monitoring) {
      this.setupMonitoring();
    }

    logger.info('CacheService initialized', {
      l1Enabled: this.options.l1Enabled,
      l2Enabled: this.options.l2Enabled,
      compression: this.options.compression,
      compressionThreshold: this.compressionThreshold,
    });
  }

  private setupMonitoring(): void {
    // Update performance monitor with cache metrics every 30 seconds
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 30000);
  }

  private updatePerformanceMetrics(): void {
    const l1Size = this.calculateL1Size();
    
    performanceMonitor.trackL1CacheMetrics({
      hits: this.stats.l1.hits,
      misses: this.stats.l1.misses,
      size: l1Size,
      items: this.l1Cache.size,
    });

    performanceMonitor.trackL2CacheMetrics({
      hits: this.stats.l2.hits,
      misses: this.stats.l2.misses,
      size: this.stats.l2.size,
      items: 0, // Redis doesn't easily provide this info
    });
  }

  private calculateL1Size(): number {
    let totalSize = 0;
    this.l1Cache.forEach((value) => {
      totalSize += this.calculateSize(value);
    });
    return totalSize;
  }

  private calculateSize(entry: CacheEntry): number {
    try {
      return entry.size || JSON.stringify(entry).length * 2; // Rough estimation
    } catch {
      return 1024; // Default size if calculation fails
    }
  }

  private handleL1Eviction(key: string, value: CacheEntry, reason: string): void {
    this.trackEvent({
      type: 'evict',
      key,
      layer: 'l1',
      timestamp: Date.now(),
      metadata: { reason, size: value.size },
    });
  }

  private trackEvent(event: CacheEventData): void {
    if (this.options.monitoring) {
      performanceMonitor.trackCacheEvent(event);
    }
    this.emit('cache-event', event);
  }

  private buildKey(namespace: CacheNamespace, key: string): string {
    return `${namespace}:${key}`;
  }

  private async compress(data: any): Promise<{ data: Buffer; compressed: boolean; originalSize: number; compressedSize: number }> {
    const serialized = JSON.stringify(data);
    const originalSize = Buffer.byteLength(serialized, 'utf8');

    if (!this.options.compression || originalSize < this.compressionThreshold) {
      return {
        data: Buffer.from(serialized, 'utf8'),
        compressed: false,
        originalSize,
        compressedSize: originalSize,
      };
    }

    const startTime = Date.now();
    let compressed: Buffer;

    try {
      switch (this.config.compression.algorithm) {
        case 'gzip':
          compressed = await gzip(serialized);
          break;
        case 'brotli':
          compressed = await brotliCompress(Buffer.from(serialized, 'utf8'));
          break;
        case 'deflate':
          compressed = await deflate(serialized);
          break;
        default:
          compressed = await gzip(serialized);
      }

      const compressionTime = Date.now() - startTime;
      this.stats.operations.compressed++;
      this.stats.operations.compressionTime += compressionTime;

      return {
        data: compressed,
        compressed: true,
        originalSize,
        compressedSize: compressed.length,
      };
    } catch (error) {
      logger.warn('Compression failed, storing uncompressed:', error);
      return {
        data: Buffer.from(serialized, 'utf8'),
        compressed: false,
        originalSize,
        compressedSize: originalSize,
      };
    }
  }

  private async decompress(data: Buffer, compressed: boolean): Promise<any> {
    if (!compressed) {
      return JSON.parse(data.toString('utf8'));
    }

    try {
      let decompressed: Buffer;

      switch (this.config.compression.algorithm) {
        case 'gzip':
          decompressed = await gunzip(data);
          break;
        case 'brotli':
          decompressed = await brotliDecompress(data);
          break;
        case 'deflate':
          decompressed = await inflate(data);
          break;
        default:
          decompressed = await gunzip(data);
      }

      return JSON.parse(decompressed.toString('utf8'));
    } catch (error) {
      logger.error('Decompression failed:', error);
      throw new Error('Failed to decompress cached data');
    }
  }

  // Public API methods
  public async get<T>(
    namespace: CacheNamespace,
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const fullKey = this.buildKey(namespace, key);
    const startTime = Date.now();
    let result: T | null = null;
    let fromCache = false;
    let layer: CacheLayer;

    try {
      // Try L1 cache first
      if (this.options.l1Enabled) {
        const l1Entry = this.l1Cache.get(fullKey);
        if (l1Entry && this.isEntryValid(l1Entry)) {
          result = l1Entry.value as T;
          fromCache = true;
          layer = 'l1';
          this.stats.l1.hits++;
          
          // Update access statistics
          l1Entry.accessCount++;
          l1Entry.lastAccessed = Date.now();
        } else {
          this.stats.l1.misses++;
        }
      }

      // Try L2 cache if L1 miss
      if (!result && this.options.l2Enabled) {
        try {
          const l2Data = await this.l2Cache.get<CacheEntry>(fullKey);
          if (l2Data && this.isEntryValid(l2Data)) {
            result = await this.decompress(
              Buffer.from(l2Data.value as string, 'base64'),
              l2Data.compressed || false
            ) as T;
            fromCache = true;
            layer = 'l2';
            this.stats.l2.hits++;

            // Promote to L1 cache
            if (this.options.l1Enabled) {
              const entry: CacheEntry = {
                ...l2Data,
                value: result,
                lastAccessed: Date.now(),
                accessCount: (l2Data.accessCount || 0) + 1,
              };
              this.l1Cache.set(fullKey, entry);
            }
          } else {
            this.stats.l2.misses++;
          }
        } catch (error) {
          this.stats.l2.errors++;
          this.trackEvent({
            type: 'error',
            key: fullKey,
            layer: 'l2',
            timestamp: Date.now(),
            error: error as Error,
          });

          // Fallback to L1 if enabled
          if (this.options.fallbackToL1 && this.options.l1Enabled) {
            layer = 'l1';
          }
        }
      }

      const executionTime = Date.now() - startTime;
      
      this.trackEvent({
        type: fromCache ? 'hit' : 'miss',
        key: fullKey,
        layer: layer!,
        timestamp: Date.now(),
        executionTime,
        metadata: { namespace, fromCache },
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.trackEvent({
        type: 'error',
        key: fullKey,
        layer: 'l1',
        timestamp: Date.now(),
        executionTime,
        error: error as Error,
      });

      logger.error(`Cache get error for key ${fullKey}:`, error);
      return null;
    }
  }

  public async set<T>(
    namespace: CacheNamespace,
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const fullKey = this.buildKey(namespace, key);
    const startTime = Date.now();
    const ttl = options.ttl || this.getTTLForNamespace(namespace);
    let success = false;

    try {
      // Prepare cache entry
      const entry: CacheEntry = {
        value,
        timestamp: Date.now(),
        ttl,
        size: 0, // Will be calculated
        accessCount: 0,
        lastAccessed: Date.now(),
        tags: options.tags,
        namespace,
        compressed: false,
      };

      // Calculate size and compress if needed
      const { data, compressed, originalSize, compressedSize } = await this.compress(value);
      entry.size = compressedSize;
      entry.compressed = compressed;

      // Store in L1 cache
      if (this.options.l1Enabled) {
        try {
          this.l1Cache.set(fullKey, entry, { ttl: ttl * 1000 });
          this.stats.l1.sets++;
          success = true;
        } catch (error) {
          this.stats.l1.errors++;
          logger.error(`L1 cache set error for key ${fullKey}:`, error);
        }
      }

      // Store in L2 cache
      if (this.options.l2Enabled) {
        try {
          const l2Entry: CacheEntry = {
            ...entry,
            value: data.toString('base64'),
          };
          
          await this.l2Cache.set(fullKey, l2Entry, { ttl });
          this.stats.l2.sets++;
          success = true;
        } catch (error) {
          this.stats.l2.errors++;
          this.trackEvent({
            type: 'error',
            key: fullKey,
            layer: 'l2',
            timestamp: Date.now(),
            error: error as Error,
          });

          // Continue if L1 succeeded
          if (!this.options.l1Enabled || !success) {
            throw error;
          }
        }
      }

      const executionTime = Date.now() - startTime;
      
      this.trackEvent({
        type: 'set',
        key: fullKey,
        layer: this.options.l1Enabled ? 'l1' : 'l2',
        timestamp: Date.now(),
        executionTime,
        size: compressedSize,
        ttl,
        metadata: { 
          namespace, 
          compressed, 
          originalSize, 
          compressedSize,
          compressionRatio: compressed ? compressedSize / originalSize : 1 
        },
      });

      this.stats.operations.total++;
      return success;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.trackEvent({
        type: 'error',
        key: fullKey,
        layer: 'l1',
        timestamp: Date.now(),
        executionTime,
        error: error as Error,
      });

      logger.error(`Cache set error for key ${fullKey}:`, error);
      return false;
    }
  }

  public async delete(namespace: CacheNamespace, key: string): Promise<boolean> {
    const fullKey = this.buildKey(namespace, key);
    const startTime = Date.now();
    let success = false;

    try {
      // Delete from L1 cache
      if (this.options.l1Enabled) {
        const deleted = this.l1Cache.delete(fullKey);
        if (deleted) {
          this.stats.l1.deletes++;
          success = true;
        }
      }

      // Delete from L2 cache
      if (this.options.l2Enabled) {
        try {
          const deleted = await this.l2Cache.del(fullKey);
          if (deleted) {
            this.stats.l2.deletes++;
            success = true;
          }
        } catch (error) {
          this.stats.l2.errors++;
          logger.error(`L2 cache delete error for key ${fullKey}:`, error);
        }
      }

      const executionTime = Date.now() - startTime;
      
      this.trackEvent({
        type: 'delete',
        key: fullKey,
        layer: 'l1',
        timestamp: Date.now(),
        executionTime,
        metadata: { namespace },
      });

      return success;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.trackEvent({
        type: 'error',
        key: fullKey,
        layer: 'l1',
        timestamp: Date.now(),
        executionTime,
        error: error as Error,
      });

      logger.error(`Cache delete error for key ${fullKey}:`, error);
      return false;
    }
  }

  public async exists(namespace: CacheNamespace, key: string): Promise<boolean> {
    const fullKey = this.buildKey(namespace, key);

    try {
      // Check L1 cache first
      if (this.options.l1Enabled && this.l1Cache.has(fullKey)) {
        const entry = this.l1Cache.get(fullKey);
        if (entry && this.isEntryValid(entry)) {
          return true;
        }
      }

      // Check L2 cache
      if (this.options.l2Enabled) {
        return await this.l2Cache.exists(fullKey);
      }

      return false;
    } catch (error) {
      logger.error(`Cache exists error for key ${fullKey}:`, error);
      return false;
    }
  }

  public async invalidateNamespace(namespace: CacheNamespace): Promise<number> {
    const pattern = `${namespace}:*`;
    let invalidated = 0;

    try {
      // Invalidate L1 cache
      if (this.options.l1Enabled) {
        const keys = Array.from(this.l1Cache.keys()).filter(key => key.startsWith(`${namespace}:`));
        keys.forEach(key => {
          this.l1Cache.delete(key);
          invalidated++;
        });
      }

      // Invalidate L2 cache
      if (this.options.l2Enabled) {
        try {
          const l2Invalidated = await this.l2Cache.invalidatePattern(pattern);
          invalidated += l2Invalidated;
        } catch (error) {
          logger.error(`L2 cache invalidation error for pattern ${pattern}:`, error);
        }
      }

      logger.info(`Invalidated ${invalidated} cache entries for namespace ${namespace}`);
      return invalidated;
    } catch (error) {
      logger.error(`Cache namespace invalidation error for ${namespace}:`, error);
      return 0;
    }
  }

  public async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;

    try {
      // Invalidate L1 cache by tags
      if (this.options.l1Enabled) {
        const keysToDelete: string[] = [];
        this.l1Cache.forEach((value, key) => {
          if (value.tags && value.tags.some(tag => tags.includes(tag))) {
            keysToDelete.push(key);
          }
        });

        keysToDelete.forEach(key => {
          this.l1Cache.delete(key);
          invalidated++;
        });
      }

      // L2 cache tag invalidation would require additional Redis structures
      // This is a simplified implementation

      logger.info(`Invalidated ${invalidated} cache entries by tags: ${tags.join(', ')}`);
      return invalidated;
    } catch (error) {
      logger.error(`Cache tag invalidation error for tags ${tags.join(', ')}:`, error);
      return 0;
    }
  }

  public async getOrSet<T>(
    namespace: CacheNamespace,
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(namespace, key, options);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const freshData = await fetchFunction();
    
    // Cache the result
    await this.set(namespace, key, freshData, options);
    
    return freshData;
  }

  // Utility methods
  private isEntryValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const expiresAt = entry.timestamp + (entry.ttl * 1000);
    return now < expiresAt;
  }

  private getTTLForNamespace(namespace: CacheNamespace): number {
    return cacheTTLConfig[namespace]?.summary || 300; // Default 5 minutes
  }

  // Statistics and monitoring
  public getStatistics() {
    const l1Size = this.calculateL1Size();
    const compressionRatio = this.stats.operations.compressed > 0 
      ? this.stats.operations.compressionTime / this.stats.operations.compressed 
      : 0;

    return {
      l1: {
        ...this.stats.l1,
        size: l1Size,
        items: this.l1Cache.size,
        maxSize: this.config.memory.maxSize * 1024 * 1024,
        hitRate: this.stats.l1.hits / (this.stats.l1.hits + this.stats.l1.misses) || 0,
      },
      l2: {
        ...this.stats.l2,
        hitRate: this.stats.l2.hits / (this.stats.l2.hits + this.stats.l2.misses) || 0,
      },
      total: {
        hits: this.stats.l1.hits + this.stats.l2.hits,
        misses: this.stats.l1.misses + this.stats.l2.misses,
        sets: this.stats.l1.sets + this.stats.l2.sets,
        deletes: this.stats.l1.deletes + this.stats.l2.deletes,
        errors: this.stats.l1.errors + this.stats.l2.errors,
        hitRate: (this.stats.l1.hits + this.stats.l2.hits) / 
                 (this.stats.l1.hits + this.stats.l1.misses + this.stats.l2.hits + this.stats.l2.misses) || 0,
      },
      compression: {
        enabled: this.options.compression,
        threshold: this.compressionThreshold,
        totalCompressed: this.stats.operations.compressed,
        avgCompressionTime: compressionRatio,
        totalOperations: this.stats.operations.total,
      },
    };
  }

  public clearL1Cache(): void {
    this.l1Cache.clear();
    logger.info('L1 cache cleared');
  }

  public async clearL2Cache(): Promise<void> {
    // This would clear the entire Redis database - use with caution
    // For now, we'll just clear our namespaced keys
    const namespaces: CacheNamespace[] = ['price', 'portfolio', 'user', 'exchange', 'market', 'session', 'ratelimit', 'query', 'api'];
    
    for (const namespace of namespaces) {
      await this.invalidateNamespace(namespace);
    }
    
    logger.info('L2 cache cleared');
  }

  public destroy(): void {
    this.clearL1Cache();
    this.removeAllListeners();
    logger.info('CacheService destroyed');
  }
}

// Create singleton instance (will be properly initialized in cacheManager)
export let cacheService: CacheService;