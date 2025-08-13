import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { CacheService } from '../services/cacheService';
import { performanceMonitor } from '../services/performanceMonitor';
import { ApiCacheOptions, CacheEventData } from '../types/cache.types';
import { cacheTTLConfig } from '../config/cache.config';

export interface CacheMiddlewareOptions extends ApiCacheOptions {
  keyGenerator?: (req: Request) => string;
  shouldCache?: (req: Request, res: Response) => boolean;
  onHit?: (req: Request, res: Response, cached: any) => void;
  onMiss?: (req: Request, res: Response) => void;
  onError?: (req: Request, res: Response, error: Error) => void;
  varyHeaders?: string[];
  skipSuccessfulCache?: boolean;
  skipErrorCache?: boolean;
}

export interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  ttl: number;
  etag?: string;
  lastModified?: string;
  contentType?: string;
  contentLength?: number;
  compressed?: boolean;
}

export class CacheMiddleware {
  private cacheService: CacheService;
  private defaultOptions: Required<CacheMiddlewareOptions>;

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
    
    this.defaultOptions = {
      ttl: cacheTTLConfig.api.public,
      etag: true,
      vary: ['Accept', 'Accept-Encoding', 'Authorization'],
      varyHeaders: ['Accept', 'Accept-Encoding', 'Authorization'],
      staleWhileRevalidate: false,
      staleIfError: false,
      mustRevalidate: false,
      maxAge: cacheTTLConfig.api.public,
      sMaxAge: cacheTTLConfig.api.public,
      public: true,
      private: false,
      noCache: false,
      noStore: false,
      compress: true,
      skipSuccessfulCache: false,
      skipErrorCache: true,
      keyGenerator: this.defaultKeyGenerator.bind(this),
      shouldCache: this.defaultShouldCache.bind(this),
      onHit: () => {},
      onMiss: () => {},
      onError: (req, res, error) => logger.error('Cache middleware error:', error),
    };
  }

  /**
   * Create cache middleware for API responses
   */
  public create(options: Partial<CacheMiddlewareOptions> = {}) {
    const opts = { ...this.defaultOptions, ...options };

    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip caching for non-GET requests by default
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      // Check if caching should be applied
      if (!opts.shouldCache(req, res)) {
        return next();
      }

      const startTime = Date.now();
      const cacheKey = opts.keyGenerator(req);
      
      try {
        // Try to get cached response
        const cached = await this.getCachedResponse(cacheKey, req, opts);
        if (cached) {
          return this.sendCachedResponse(req, res, cached, opts, startTime);
        }

        // Cache miss - intercept response
        await this.interceptResponse(req, res, next, cacheKey, opts, startTime);
      } catch (error) {
        opts.onError(req, res, error as Error);
        return next();
      }
    };
  }

  /**
   * Create conditional cache middleware with ETag support
   */
  public conditional(options: Partial<CacheMiddlewareOptions> = {}) {
    const opts = { ...this.defaultOptions, ...options, etag: true };

    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const cacheKey = opts.keyGenerator(req);

      try {
        // Check for conditional headers
        const ifNoneMatch = req.headers['if-none-match'];
        const ifModifiedSince = req.headers['if-modified-since'];

        if (ifNoneMatch || ifModifiedSince) {
          const cached = await this.getCachedResponse(cacheKey, req, opts);
          if (cached && this.isNotModified(cached, ifNoneMatch, ifModifiedSince)) {
            // Send 304 Not Modified
            this.send304Response(res, cached);
            this.trackCacheEvent('hit', cacheKey, startTime, { conditional: true });
            return;
          }
        }

        // Continue with normal caching flow
        const cacheMiddleware = this.create(opts);
        return cacheMiddleware(req, res, next);
      } catch (error) {
        opts.onError(req, res, error as Error);
        return next();
      }
    };
  }

  /**
   * Create cache invalidation middleware
   */
  public invalidate(patterns: string[] | ((req: Request) => string[])) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Invalidate cache after successful write operations
      res.on('finish', async () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const invalidationPatterns = typeof patterns === 'function' ? patterns(req) : patterns;
            
            for (const pattern of invalidationPatterns) {
              await this.cacheService.invalidateNamespace('api');
              logger.debug('Cache invalidated for pattern:', pattern);
            }
          } catch (error) {
            logger.error('Cache invalidation error:', error);
          }
        }
      });

      next();
    };
  }

  /**
   * Cache warming middleware
   */
  public warm(routes: Array<{ path: string; method?: string; headers?: Record<string, string> }>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Trigger cache warming for specified routes
      setImmediate(async () => {
        for (const route of routes) {
          try {
            const warmKey = this.generateKeyForRoute(route.path, route.method || 'GET', route.headers);
            const exists = await this.cacheService.exists('api', warmKey);
            
            if (!exists) {
              // This would typically trigger a background request to warm the cache
              logger.debug('Cache warming needed for route:', route.path);
            }
          } catch (error) {
            logger.error('Cache warming error:', error);
          }
        }
      });

      next();
    };
  }

  private async getCachedResponse(
    cacheKey: string,
    req: Request,
    options: Required<CacheMiddlewareOptions>
  ): Promise<CachedResponse | null> {
    try {
      const cached = await this.cacheService.get<CachedResponse>('api', cacheKey);
      
      if (!cached) {
        return null;
      }

      // Check if cache entry is still valid
      if (!this.isCacheValid(cached, options)) {
        await this.cacheService.delete('api', cacheKey);
        return null;
      }

      // Check vary headers
      if (options.vary && !this.checkVaryHeaders(req, cached, options.vary)) {
        return null;
      }

      return cached;
    } catch (error) {
      logger.error('Error retrieving cached response:', error);
      return null;
    }
  }

  private async interceptResponse(
    req: Request,
    res: Response,
    next: NextFunction,
    cacheKey: string,
    options: Required<CacheMiddlewareOptions>,
    startTime: number
  ) {
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    let responseBody: any;
    let responseSent = false;

    // Intercept response body
    res.send = function(body: any) {
      if (!responseSent) {
        responseBody = body;
        responseSent = true;
      }
      return originalSend.call(this, body);
    };

    res.json = function(obj: any) {
      if (!responseSent) {
        responseBody = obj;
        responseSent = true;
      }
      return originalJson.call(this, obj);
    };

    res.end = function(chunk?: any) {
      if (!responseSent && chunk) {
        responseBody = chunk;
        responseSent = true;
      }
      return originalEnd.call(this, chunk);
    };

    // Call next middleware
    next();

    // Handle response completion
    res.on('finish', async () => {
      try {
        await this.handleResponseCaching(
          req, res, responseBody, cacheKey, options, startTime
        );
      } catch (error) {
        logger.error('Error caching response:', error);
      }
    });
  }

  private async handleResponseCaching(
    req: Request,
    res: Response,
    responseBody: any,
    cacheKey: string,
    options: Required<CacheMiddlewareOptions>,
    startTime: number
  ) {
    const shouldCacheResponse = this.shouldCacheResponse(res, options);
    
    if (!shouldCacheResponse) {
      this.trackCacheEvent('miss', cacheKey, startTime, { 
        reason: 'response-not-cacheable',
        statusCode: res.statusCode 
      });
      return;
    }

    // Generate ETag if enabled
    const etag = options.etag ? this.generateETag(responseBody) : undefined;
    const lastModified = new Date().toUTCString();

    // Create cached response
    const cachedResponse: CachedResponse = {
      statusCode: res.statusCode,
      headers: this.getResponseHeaders(res, options),
      body: responseBody,
      timestamp: Date.now(),
      ttl: options.ttl!,
      etag,
      lastModified,
      contentType: res.getHeader('content-type') as string,
      contentLength: Buffer.byteLength(JSON.stringify(responseBody)),
      compressed: options.compress,
    };

    // Set cache headers
    this.setCacheHeaders(res, options, etag, lastModified);

    // Store in cache
    await this.cacheService.set('api', cacheKey, cachedResponse, {
      ttl: options.ttl,
      tags: ['api-response'],
      namespace: 'api',
    });

    this.trackCacheEvent('set', cacheKey, Date.now() - startTime, {
      size: cachedResponse.contentLength,
      statusCode: res.statusCode,
    });
  }

  private sendCachedResponse(
    req: Request,
    res: Response,
    cached: CachedResponse,
    options: Required<CacheMiddlewareOptions>,
    startTime: number
  ) {
    // Set headers from cache
    Object.entries(cached.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Set cache headers
    if (cached.etag) {
      res.setHeader('ETag', cached.etag);
    }
    if (cached.lastModified) {
      res.setHeader('Last-Modified', cached.lastModified);
    }

    this.setCacheHeaders(res, options, cached.etag, cached.lastModified);

    // Set cache hit header
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Cache-Key', this.hashString(options.keyGenerator(req)));

    // Send response
    res.status(cached.statusCode);
    
    if (cached.contentType) {
      res.type(cached.contentType);
    }

    res.send(cached.body);

    // Track cache hit
    this.trackCacheEvent('hit', options.keyGenerator(req), Date.now() - startTime, {
      statusCode: cached.statusCode,
      age: Date.now() - cached.timestamp,
    });

    options.onHit(req, res, cached);
  }

  private send304Response(res: Response, cached: CachedResponse) {
    if (cached.etag) {
      res.setHeader('ETag', cached.etag);
    }
    if (cached.lastModified) {
      res.setHeader('Last-Modified', cached.lastModified);
    }
    
    res.setHeader('X-Cache', '304');
    res.status(304).end();
  }

  private shouldCacheResponse(res: Response, options: Required<CacheMiddlewareOptions>): boolean {
    const statusCode = res.statusCode;

    // Don't cache error responses if configured
    if (options.skipErrorCache && statusCode >= 400) {
      return false;
    }

    // Don't cache successful responses if configured
    if (options.skipSuccessfulCache && statusCode >= 200 && statusCode < 300) {
      return false;
    }

    // Only cache successful responses and some client errors by default
    return (statusCode >= 200 && statusCode < 300) || statusCode === 404;
  }

  private isCacheValid(cached: CachedResponse, options: Required<CacheMiddlewareOptions>): boolean {
    const now = Date.now();
    const age = now - cached.timestamp;
    const maxAge = (cached.ttl || options.ttl!) * 1000;

    return age < maxAge;
  }

  private isNotModified(
    cached: CachedResponse,
    ifNoneMatch?: string,
    ifModifiedSince?: string
  ): boolean {
    if (ifNoneMatch && cached.etag) {
      return ifNoneMatch === cached.etag;
    }

    if (ifModifiedSince && cached.lastModified) {
      const clientDate = new Date(ifModifiedSince);
      const cacheDate = new Date(cached.lastModified);
      return clientDate >= cacheDate;
    }

    return false;
  }

  private checkVaryHeaders(
    req: Request,
    cached: CachedResponse,
    varyHeaders: string[]
  ): boolean {
    // This is a simplified implementation
    // In practice, you'd want to store the vary header values with the cache
    return true;
  }

  private generateETag(content: any): string {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(content));
    return `"${hash.digest('hex')}"`;
  }

  private getResponseHeaders(res: Response, options: Required<CacheMiddlewareOptions>): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Copy relevant headers
    const headersToInclude = ['content-type', 'content-encoding', 'content-language'];
    headersToInclude.forEach(header => {
      const value = res.getHeader(header);
      if (value) {
        headers[header] = String(value);
      }
    });

    return headers;
  }

  private setCacheHeaders(
    res: Response,
    options: Required<CacheMiddlewareOptions>,
    etag?: string,
    lastModified?: string
  ) {
    const cacheControl: string[] = [];

    if (options.public) cacheControl.push('public');
    if (options.private) cacheControl.push('private');
    if (options.noCache) cacheControl.push('no-cache');
    if (options.noStore) cacheControl.push('no-store');
    if (options.mustRevalidate) cacheControl.push('must-revalidate');

    if (options.maxAge !== undefined) {
      cacheControl.push(`max-age=${options.maxAge}`);
    }

    if (options.sMaxAge !== undefined) {
      cacheControl.push(`s-maxage=${options.sMaxAge}`);
    }

    if (options.staleWhileRevalidate) {
      cacheControl.push('stale-while-revalidate=86400'); // 1 day
    }

    if (options.staleIfError) {
      cacheControl.push('stale-if-error=86400'); // 1 day
    }

    if (cacheControl.length > 0) {
      res.setHeader('Cache-Control', cacheControl.join(', '));
    }

    if (options.vary) {
      res.setHeader('Vary', options.vary.join(', '));
    }

    if (etag) {
      res.setHeader('ETag', etag);
    }

    if (lastModified) {
      res.setHeader('Last-Modified', lastModified);
    }
  }

  private defaultKeyGenerator(req: Request): string {
    const url = req.originalUrl || req.url;
    const method = req.method;
    const accept = req.headers.accept || '';
    const encoding = req.headers['accept-encoding'] || '';
    const auth = req.headers.authorization ? 'auth' : 'noauth';
    
    return this.hashString(`${method}:${url}:${accept}:${encoding}:${auth}`);
  }

  private defaultShouldCache(req: Request, res: Response): boolean {
    // Cache GET and HEAD requests by default
    return ['GET', 'HEAD'].includes(req.method);
  }

  private generateKeyForRoute(path: string, method: string, headers?: Record<string, string>): string {
    const headerString = headers ? JSON.stringify(headers) : '';
    return this.hashString(`${method}:${path}:${headerString}`);
  }

  private hashString(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }

  private trackCacheEvent(
    type: 'hit' | 'miss' | 'set' | 'error',
    key: string,
    startTime: number,
    metadata?: any
  ) {
    const event: CacheEventData = {
      type,
      key,
      layer: 'api',
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      namespace: 'api',
      metadata,
    };

    performanceMonitor.trackCacheEvent(event);

    // Update API metrics
    if (type === 'hit' || type === 'miss') {
      performanceMonitor.trackApiMetrics({
        totalRequests: 1,
        cachedResponses: type === 'hit' ? 1 : 0,
        cacheHitRate: type === 'hit' ? 1 : 0,
        avgResponseTime: event.executionTime || 0,
      });
    }
  }
}

// Helper functions for creating common cache middleware configurations
export function createApiCacheMiddleware(cacheService: CacheService, options?: Partial<CacheMiddlewareOptions>) {
  const middleware = new CacheMiddleware(cacheService);
  return middleware.create({
    ttl: cacheTTLConfig.api.public,
    public: true,
    maxAge: cacheTTLConfig.api.public,
    ...options,
  });
}

export function createPrivateApiCacheMiddleware(cacheService: CacheService, options?: Partial<CacheMiddlewareOptions>) {
  const middleware = new CacheMiddleware(cacheService);
  return middleware.create({
    ttl: cacheTTLConfig.api.private,
    private: true,
    maxAge: cacheTTLConfig.api.private,
    ...options,
  });
}

export function createConditionalCacheMiddleware(cacheService: CacheService, options?: Partial<CacheMiddlewareOptions>) {
  const middleware = new CacheMiddleware(cacheService);
  return middleware.conditional({
    ttl: cacheTTLConfig.api.public,
    etag: true,
    ...options,
  });
}

export function createCacheInvalidationMiddleware(patterns: string[]) {
  return (cacheService: CacheService) => {
    const middleware = new CacheMiddleware(cacheService);
    return middleware.invalidate(patterns);
  };
}