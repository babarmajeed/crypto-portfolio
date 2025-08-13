import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../services/performanceMonitor';
import { cacheConfig } from '../config/cache.config';

export interface CompressionOptions {
  enabled?: boolean;
  threshold?: number; // Minimum response size to compress (bytes)
  level?: number; // Compression level (1-9 for gzip, 1-11 for brotli)
  algorithm?: 'gzip' | 'brotli' | 'deflate';
  chunkSize?: number;
  memLevel?: number;
  strategy?: number;
  skipOnError?: boolean;
  trackMetrics?: boolean;
}

export interface CompressionMetrics {
  totalRequests: number;
  compressedRequests: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  compressionRatio: number;
  avgCompressionTime: number;
  errors: number;
  timestamp: number;
}

export class CompressionMiddleware {
  private options: Required<CompressionOptions>;
  private metrics: CompressionMetrics;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      enabled: options.enabled !== false,
      threshold: options.threshold || cacheConfig.compression.threshold,
      level: options.level || 6,
      algorithm: options.algorithm || cacheConfig.compression.algorithm,
      chunkSize: options.chunkSize || 16384, // 16KB
      memLevel: options.memLevel || 8,
      strategy: options.strategy || 0, // Z_DEFAULT_STRATEGY
      skipOnError: options.skipOnError !== false,
      trackMetrics: options.trackMetrics !== false,
    };

    this.metrics = {
      totalRequests: 0,
      compressedRequests: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 0,
      avgCompressionTime: 0,
      errors: 0,
      timestamp: Date.now(),
    };

    logger.info('CompressionMiddleware initialized', {
      enabled: this.options.enabled,
      threshold: this.options.threshold,
      algorithm: this.options.algorithm,
      level: this.options.level,
    });
  }

  /**
   * Create compression middleware
   */
  public create() {
    if (!this.options.enabled) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    const compressionHandler = compression({
      threshold: this.options.threshold,
      level: this.options.level,
      chunkSize: this.options.chunkSize,
      memLevel: this.options.memLevel,
      strategy: this.options.strategy,
      filter: (req: Request, res: Response) => {
        return this.shouldCompress(req, res);
      },
    });

    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.shouldCompress(req, res)) {
        return next();
      }

      const startTime = Date.now();
      let originalSize = 0;
      let compressedSize = 0;
      let compressionApplied = false;

      // Track metrics if enabled
      if (this.options.trackMetrics) {
        this.metrics.totalRequests++;

        // Intercept response to track sizes
        const originalWrite = res.write;
        const originalEnd = res.end;

        res.write = function(chunk: any, encoding?: any) {
          if (chunk) {
            originalSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
          }
          return originalWrite.call(this, chunk, encoding);
        };

        res.end = function(chunk?: any, encoding?: any) {
          if (chunk) {
            originalSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
          }
          return originalEnd.call(this, chunk, encoding);
        };

        // Track when compression is applied
        res.on('finish', () => {
          const compressionTime = Date.now() - startTime;
          compressionApplied = res.getHeader('content-encoding') !== undefined;
          
          if (compressionApplied) {
            this.metrics.compressedRequests++;
            compressedSize = parseInt(res.getHeader('content-length') as string) || 0;
            
            this.updateCompressionMetrics(originalSize, compressedSize, compressionTime);
            
            // Track in performance monitor
            if (performanceMonitor) {
              performanceMonitor.trackApiMetrics({
                compressionRatio: compressedSize / originalSize,
              });
            }
          }
        });
      }

      // Apply compression
      try {
        compressionHandler(req, res, next);
      } catch (error) {
        if (this.options.skipOnError) {
          logger.warn('Compression error, skipping:', error);
          if (this.options.trackMetrics) {
            this.metrics.errors++;
          }
          next();
        } else {
          throw error;
        }
      }
    };
  }

  /**
   * Create brotli-specific compression middleware
   */
  public createBrotli(options: Partial<CompressionOptions> = {}) {
    return this.create({
      ...this.options,
      ...options,
      algorithm: 'brotli',
    });
  }

  /**
   * Create gzip-specific compression middleware
   */
  public createGzip(options: Partial<CompressionOptions> = {}) {
    return this.create({
      ...this.options,
      ...options,
      algorithm: 'gzip',
    });
  }

  /**
   * Create adaptive compression middleware that chooses algorithm based on client support
   */
  public createAdaptive(options: Partial<CompressionOptions> = {}) {
    return (req: Request, res: Response, next: NextFunction) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';
      
      let algorithm: 'gzip' | 'brotli' | 'deflate' = 'gzip';
      
      if (acceptEncoding.includes('br')) {
        algorithm = 'brotli';
      } else if (acceptEncoding.includes('gzip')) {
        algorithm = 'gzip';
      } else if (acceptEncoding.includes('deflate')) {
        algorithm = 'deflate';
      }

      const adaptiveMiddleware = this.create({
        ...this.options,
        ...options,
        algorithm,
      });

      adaptiveMiddleware(req, res, next);
    };
  }

  /**
   * Create selective compression middleware for specific content types
   */
  public createSelective(contentTypes: string[], options: Partial<CompressionOptions> = {}) {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalShouldCompress = this.shouldCompress.bind(this);
      
      // Override shouldCompress to check content types
      this.shouldCompress = (req: Request, res: Response) => {
        const contentType = res.getHeader('content-type') as string;
        const matchesContentType = contentTypes.some(type => 
          contentType && contentType.includes(type)
        );
        
        return matchesContentType && originalShouldCompress(req, res);
      };

      const selectiveMiddleware = this.create({
        ...this.options,
        ...options,
      });

      selectiveMiddleware(req, res, next);
      
      // Restore original shouldCompress
      this.shouldCompress = originalShouldCompress;
    };
  }

  /**
   * Check if response should be compressed
   */
  private shouldCompress(req: Request, res: Response): boolean {
    // Don't compress if client doesn't support it
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip') && 
        !acceptEncoding.includes('deflate') && 
        !acceptEncoding.includes('br')) {
      return false;
    }

    // Don't compress if already compressed
    if (res.getHeader('content-encoding')) {
      return false;
    }

    // Don't compress certain content types
    const contentType = res.getHeader('content-type') as string;
    if (contentType) {
      const nonCompressibleTypes = [
        'image/',
        'video/',
        'audio/',
        'application/zip',
        'application/gzip',
        'application/x-rar',
        'application/x-7z-compressed',
      ];

      if (nonCompressibleTypes.some(type => contentType.includes(type))) {
        return false;
      }
    }

    // Don't compress small responses
    const contentLength = res.getHeader('content-length');
    if (contentLength && parseInt(contentLength as string) < this.options.threshold) {
      return false;
    }

    // Don't compress if Cache-Control says no-transform
    const cacheControl = res.getHeader('cache-control') as string;
    if (cacheControl && cacheControl.includes('no-transform')) {
      return false;
    }

    return true;
  }

  /**
   * Update compression metrics
   */
  private updateCompressionMetrics(originalSize: number, compressedSize: number, compressionTime: number): void {
    this.metrics.totalOriginalSize += originalSize;
    this.metrics.totalCompressedSize += compressedSize;
    
    if (this.metrics.totalOriginalSize > 0) {
      this.metrics.compressionRatio = this.metrics.totalCompressedSize / this.metrics.totalOriginalSize;
    }

    // Update average compression time
    const totalTime = this.metrics.avgCompressionTime * (this.metrics.compressedRequests - 1) + compressionTime;
    this.metrics.avgCompressionTime = totalTime / this.metrics.compressedRequests;
    
    this.metrics.timestamp = Date.now();
  }

  /**
   * Get compression metrics
   */
  public getMetrics(): CompressionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset compression metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      compressedRequests: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 0,
      avgCompressionTime: 0,
      errors: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Get compression statistics report
   */
  public getReport(): {
    metrics: CompressionMetrics;
    performance: {
      compressionRate: number;
      averageSavings: number;
      errorRate: number;
      efficiency: string;
    };
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const compressionRate = metrics.totalRequests > 0 
      ? metrics.compressedRequests / metrics.totalRequests 
      : 0;
    
    const averageSavings = metrics.totalOriginalSize > 0
      ? ((metrics.totalOriginalSize - metrics.totalCompressedSize) / metrics.totalOriginalSize) * 100
      : 0;

    const errorRate = metrics.totalRequests > 0
      ? metrics.errors / metrics.totalRequests
      : 0;

    let efficiency = 'Good';
    if (averageSavings > 70) efficiency = 'Excellent';
    else if (averageSavings > 50) efficiency = 'Very Good';
    else if (averageSavings > 30) efficiency = 'Good';
    else efficiency = 'Poor';

    const recommendations: string[] = [];
    
    if (compressionRate < 0.8) {
      recommendations.push('Consider lowering the compression threshold to compress more responses');
    }
    
    if (averageSavings < 30) {
      recommendations.push('Review content types being compressed - some may not benefit from compression');
    }
    
    if (errorRate > 0.01) {
      recommendations.push('Investigate compression errors and consider enabling skipOnError');
    }
    
    if (metrics.avgCompressionTime > 100) {
      recommendations.push('Consider reducing compression level to improve performance');
    }

    return {
      metrics,
      performance: {
        compressionRate,
        averageSavings,
        errorRate,
        efficiency,
      },
      recommendations,
    };
  }
}

// Helper functions for common compression scenarios
export function createJsonCompressionMiddleware(options?: CompressionOptions) {
  const middleware = new CompressionMiddleware(options);
  return middleware.createSelective(['application/json', 'text/json']);
}

export function createApiCompressionMiddleware(options?: CompressionOptions) {
  const middleware = new CompressionMiddleware(options);
  return middleware.createSelective([
    'application/json',
    'text/json',
    'text/plain',
    'text/html',
    'text/css',
    'application/javascript',
    'text/javascript',
  ]);
}

export function createAdaptiveCompressionMiddleware(options?: CompressionOptions) {
  const middleware = new CompressionMiddleware(options);
  return middleware.createAdaptive();
}

// Export singleton instance
export const compressionMiddleware = new CompressionMiddleware();