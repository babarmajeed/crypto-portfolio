import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { rateLimitService } from '../services/rateLimitService';
import { auditService } from '../services/auditService';
import { logger } from '../utils/logger';
import {
  RateLimitResult,
  RateLimitHeaders,
  EndpointRateLimitConfig,
} from '../types/rateLimit.types';
import {
  ENDPOINT_RATE_LIMITS,
  INTERNAL_SERVICES,
  BLACKLIST_CONFIG,
} from '../config/rateLimitConfig';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

export class RateLimitMiddleware {
  private endpointConfigs: Map<string, EndpointRateLimitConfig> = new Map();

  constructor() {
    this.initializeEndpointConfigs();
  }

  private initializeEndpointConfigs(): void {
    for (const config of ENDPOINT_RATE_LIMITS) {
      const key = `${config.method}:${config.path}`;
      this.endpointConfigs.set(key, config);
    }
  }

  // Main rate limiting middleware
  rateLimiter = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const startTime = Date.now();
      
      // Check if request should bypass rate limiting
      if (await this.shouldBypass(req)) {
        return next();
      }

      // Get client identifier and user tier
      const identifier = this.getClientIdentifier(req);
      const userTier = await rateLimitService.getUserTier(req.user?.userId, req.user?.role);
      const endpoint = this.getEndpointKey(req);

      // Check rate limits
      const result = await rateLimitService.checkRateLimit(identifier, userTier, endpoint);
      
      // Set rate limit headers
      const headers = await rateLimitService.getRateLimitHeaders(identifier, userTier);
      this.setRateLimitHeaders(res, headers);

      // Log request
      await this.logRequest(req, result, Date.now() - startTime);

      if (!result.allowed) {
        // Rate limit exceeded
        await this.handleRateLimitExceeded(req, res, result);
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiting middleware error:', error);
      // Continue on error to avoid breaking the application
      next();
    }
  };

  // Endpoint-specific rate limiting
  endpointRateLimiter = (path: string, method: string = 'GET') => {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const configKey = `${method.toUpperCase()}:${path}`;
        const config = this.endpointConfigs.get(configKey);
        
        if (!config) {
          // No specific config, use general rate limiter
          return this.rateLimiter(req, res, next);
        }

        const identifier = this.getClientIdentifier(req);
        const userTier = await rateLimitService.getUserTier(req.user?.userId, req.user?.role);
        
        // Apply tier multipliers if configured
        let effectiveLimit = config.config.requests;
        if (config.tierMultipliers && userTier in config.tierMultipliers) {
          const multiplier = config.tierMultipliers[userTier as keyof typeof config.tierMultipliers];
          effectiveLimit = Math.floor(config.config.requests * multiplier);
        }

        // Create a temporary limiter for this endpoint
        const tempConfig = {
          ...config.config,
          requests: effectiveLimit,
        };

        // Check the endpoint-specific rate limit
        const result = await rateLimitService.checkRateLimit(identifier, userTier, path);
        
        const headers = await rateLimitService.getRateLimitHeaders(identifier, userTier);
        this.setRateLimitHeaders(res, headers);

        if (!result.allowed) {
          await this.handleRateLimitExceeded(req, res, result);
          return;
        }

        next();
      } catch (error) {
        logger.error(`Endpoint rate limiting error for ${path}:`, error);
        next();
      }
    };
  };

  // Authentication-specific rate limiting
  authRateLimiter = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const identifier = this.getClientIdentifier(req);
    const endpoint = req.path;

    try {
      // Use anonymous tier for auth endpoints
      const result = await rateLimitService.checkRateLimit(identifier, 'ANONYMOUS', endpoint);
      
      const headers = await rateLimitService.getRateLimitHeaders(identifier, 'ANONYMOUS');
      this.setRateLimitHeaders(res, headers);

      if (!result.allowed) {
        await auditService.log(
          'AUTH_RATE_LIMIT_EXCEEDED',
          null,
          `Authentication rate limit exceeded for ${endpoint}`,
          identifier,
          req.headers['user-agent']
        );

        res.status(429).json({
          success: false,
          error: 'Too many authentication attempts',
          message: 'Please wait before trying again',
          retryAfter: result.retryAfter,
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Auth rate limiting error:', error);
      next();
    }
  };

  // High-security endpoints (2FA, password reset, etc.)
  highSecurityRateLimiter = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const identifier = this.getClientIdentifier(req);
    const userId = req.user?.userId;

    try {
      // Combine IP and user ID for higher security
      const secureIdentifier = userId ? `${identifier}:${userId}` : identifier;
      
      const result = await rateLimitService.checkRateLimit(
        secureIdentifier,
        req.user?.role || 'ANONYMOUS',
        req.path
      );

      const headers = await rateLimitService.getRateLimitHeaders(
        secureIdentifier,
        req.user?.role || 'ANONYMOUS'
      );
      this.setRateLimitHeaders(res, headers);

      if (!result.allowed) {
        await auditService.log(
          'HIGH_SECURITY_RATE_LIMIT_EXCEEDED',
          userId || null,
          `High-security rate limit exceeded for ${req.path}`,
          identifier,
          req.headers['user-agent']
        );

        res.status(429).json({
          success: false,
          error: 'Security rate limit exceeded',
          message: 'Too many attempts for this security-sensitive operation',
          retryAfter: result.retryAfter,
          code: 'HIGH_SECURITY_RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('High-security rate limiting error:', error);
      next();
    }
  };

  // Internal service authentication and rate limiting
  internalServiceRateLimiter = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      const serviceName = req.headers['x-service-name'] as string;

      if (!apiKey || !serviceName) {
        res.status(401).json({
          success: false,
          error: 'Internal service authentication required',
          code: 'INTERNAL_AUTH_REQUIRED',
        });
        return;
      }

      // Validate internal service
      const service = INTERNAL_SERVICES.find(
        s => s.serviceName === serviceName && s.apiKey === apiKey
      );

      if (!service) {
        await auditService.log(
          'INVALID_INTERNAL_SERVICE',
          null,
          `Invalid internal service authentication: ${serviceName}`,
          this.getClientIdentifier(req),
          req.headers['user-agent']
        );

        res.status(401).json({
          success: false,
          error: 'Invalid internal service credentials',
          code: 'INVALID_INTERNAL_SERVICE',
        });
        return;
      }

      // Check if service bypasses rate limiting
      if (service.bypassRateLimit) {
        logger.debug(`Bypassing rate limit for internal service: ${serviceName}`);
        return next();
      }

      // Apply internal service rate limits
      const result = await rateLimitService.checkRateLimit(
        `internal:${serviceName}`,
        'INTERNAL',
        req.path
      );

      if (!result.allowed) {
        logger.warn(`Internal service rate limit exceeded: ${serviceName}`);
        res.status(429).json({
          success: false,
          error: 'Internal service rate limit exceeded',
          retryAfter: result.retryAfter,
          code: 'INTERNAL_RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Internal service rate limiting error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  };

  // Burst protection for high-frequency endpoints
  burstProtection = (maxBurst: number = 10, windowMs: number = 1000) => {
    const burstCounts = new Map<string, Array<number>>();

    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const identifier = this.getClientIdentifier(req);
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get or create burst history
        let bursts = burstCounts.get(identifier) || [];
        
        // Remove old entries
        bursts = bursts.filter(timestamp => timestamp > windowStart);
        
        if (bursts.length >= maxBurst) {
          const nextAllowed = Math.min(...bursts) + windowMs;
          const retryAfter = Math.ceil((nextAllowed - now) / 1000);

          res.status(429).json({
            success: false,
            error: 'Burst limit exceeded',
            message: 'Too many requests in a short time period',
            retryAfter,
            code: 'BURST_LIMIT_EXCEEDED',
          });
          return;
        }

        // Add current request
        bursts.push(now);
        burstCounts.set(identifier, bursts);

        // Cleanup old entries periodically
        if (Math.random() < 0.01) { // 1% chance
          this.cleanupBurstCounts(burstCounts, windowMs);
        }

        next();
      } catch (error) {
        logger.error('Burst protection error:', error);
        next();
      }
    };
  };

  // Helper methods

  private async shouldBypass(req: AuthenticatedRequest): Promise<boolean> {
    // Check whitelist
    const clientIP = this.getClientIP(req);
    if (BLACKLIST_CONFIG.whitelist.includes(clientIP)) {
      return true;
    }

    // Bypass for health checks
    if (req.path === '/health' || req.path === '/api/health') {
      return true;
    }

    // Bypass for admin users (optional)
    if (req.user?.role === UserRole.ADMIN && process.env.BYPASS_ADMIN_RATE_LIMIT === 'true') {
      return true;
    }

    // Bypass in development for localhost
    if (
      process.env.NODE_ENV === 'development' &&
      (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === 'localhost')
    ) {
      return true;
    }

    return false;
  }

  private getClientIdentifier(req: AuthenticatedRequest): string {
    // Prefer user ID for authenticated requests
    if (req.user?.userId) {
      return `user:${req.user.userId}`;
    }
    
    // Fall back to IP address
    return `ip:${this.getClientIP(req)}`;
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }

  private getEndpointKey(req: Request): string {
    return `${req.method}:${req.route?.path || req.path}`;
  }

  private setRateLimitHeaders(res: Response, headers: RateLimitHeaders): void {
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        res.set(key, value);
      }
    }
  }

  private async handleRateLimitExceeded(
    req: AuthenticatedRequest,
    res: Response,
    result: RateLimitResult
  ): Promise<void> {
    const identifier = this.getClientIdentifier(req);
    
    await auditService.log(
      'RATE_LIMIT_EXCEEDED',
      req.user?.userId || null,
      `Rate limit exceeded for ${req.path}`,
      this.getClientIP(req),
      req.headers['user-agent']
    );

    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: this.getRateLimitMessage(result),
      retryAfter: result.retryAfter,
      remaining: result.remainingRequests,
      resetTime: result.resetTime,
      userTier: result.userTier,
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }

  private getRateLimitMessage(result: RateLimitResult): string {
    const tier = result.userTier?.toLowerCase() || 'user';
    const retryAfter = result.retryAfter || 60;
    
    if (retryAfter < 60) {
      return `Too many requests. Please wait ${retryAfter} seconds before trying again.`;
    } else if (retryAfter < 3600) {
      const minutes = Math.ceil(retryAfter / 60);
      return `Rate limit exceeded for ${tier} tier. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`;
    } else {
      const hours = Math.ceil(retryAfter / 3600);
      return `Rate limit exceeded for ${tier} tier. Please wait ${hours} hour${hours > 1 ? 's' : ''} before trying again.`;
    }
  }

  private async logRequest(
    req: AuthenticatedRequest,
    result: RateLimitResult,
    responseTime: number
  ): Promise<void> {
    try {
      const logData = {
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        identifier: this.getClientIdentifier(req),
        userTier: result.userTier,
        allowed: result.allowed,
        remainingRequests: result.remainingRequests,
        responseTime,
        timestamp: new Date(),
      };

      // Log to monitoring system
      logger.debug('Rate limit check', logData);

      // Log blocked requests at higher level
      if (!result.allowed) {
        logger.warn('Request blocked by rate limiter', logData);
      }
    } catch (error) {
      logger.error('Failed to log rate limit request:', error);
    }
  }

  private cleanupBurstCounts(
    burstCounts: Map<string, Array<number>>,
    windowMs: number
  ): void {
    const cutoff = Date.now() - windowMs * 10; // Keep 10x window for cleanup
    
    for (const [key, timestamps] of burstCounts.entries()) {
      const filtered = timestamps.filter(t => t > cutoff);
      if (filtered.length === 0) {
        burstCounts.delete(key);
      } else {
        burstCounts.set(key, filtered);
      }
    }
  }

  // Factory methods for common rate limiting patterns

  createEndpointLimiter(config: EndpointRateLimitConfig) {
    return this.endpointRateLimiter(config.path, config.method);
  }

  createCustomLimiter(
    requests: number,
    windowMs: number,
    identifier?: (req: AuthenticatedRequest) => string
  ) {
    return async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = identifier ? identifier(req) : this.getClientIdentifier(req);
        const userTier = await rateLimitService.getUserTier(req.user?.userId, req.user?.role);
        
        const result = await rateLimitService.checkRateLimit(id, userTier, req.path);
        
        if (!result.allowed) {
          await this.handleRateLimitExceeded(req, res, result);
          return;
        }

        next();
      } catch (error) {
        logger.error('Custom rate limiter error:', error);
        next();
      }
    };
  }
}

// Export singleton instance and factory
export const rateLimitMiddleware = new RateLimitMiddleware();

// Convenience exports for common patterns
export const {
  rateLimiter,
  authRateLimiter,
  highSecurityRateLimiter,
  internalServiceRateLimiter,
  burstProtection,
} = rateLimitMiddleware;