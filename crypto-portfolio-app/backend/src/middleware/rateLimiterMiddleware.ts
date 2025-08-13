import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { rateLimitService } from '../services/rateLimitService';
import { auditService } from '../services/auditService';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export class RateLimiterMiddleware {
  // General API rate limiting
  apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: 900 // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return this.getClientIP(req);
    },
    onLimitReached: async (req: Request) => {
      await auditService.log(
        'RATE_LIMIT_EXCEEDED',
        (req as AuthenticatedRequest).user?.userId || null,
        'API rate limit exceeded',
        this.getClientIP(req),
        req.headers['user-agent']
      );
    }
  });

  // Stricter rate limiting for authentication endpoints
  authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return this.getClientIP(req);
    },
    onLimitReached: async (req: Request) => {
      await auditService.log(
        'AUTH_RATE_LIMIT_EXCEEDED',
        null,
        'Authentication rate limit exceeded',
        this.getClientIP(req),
        req.headers['user-agent']
      );
    }
  });

  // Very strict rate limiting for login attempts
  loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 login attempts per windowMs
    message: {
      success: false,
      message: 'Too many login attempts, please try again later.',
      retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return this.getClientIP(req);
    },
    onLimitReached: async (req: Request) => {
      await auditService.log(
        'LOGIN_RATE_LIMIT_EXCEEDED',
        null,
        'Login rate limit exceeded',
        this.getClientIP(req),
        req.headers['user-agent']
      );
    }
  });

  // Password reset rate limiting
  passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 password reset requests per hour
    message: {
      success: false,
      message: 'Too many password reset requests, please try again later.',
      retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return this.getClientIP(req);
    },
    onLimitReached: async (req: Request) => {
      await auditService.log(
        'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
        null,
        'Password reset rate limit exceeded',
        this.getClientIP(req),
        req.headers['user-agent']
      );
    }
  });

  // Email verification rate limiting
  emailVerificationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 verification requests per hour
    message: {
      success: false,
      message: 'Too many email verification requests, please try again later.',
      retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return this.getClientIP(req);
    },
    onLimitReached: async (req: Request) => {
      await auditService.log(
        'EMAIL_VERIFICATION_RATE_LIMIT_EXCEEDED',
        null,
        'Email verification rate limit exceeded',
        this.getClientIP(req),
        req.headers['user-agent']
      );
    }
  });

  // Two-factor authentication attempts
  twoFactorLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 2FA attempts per windowMs
    message: {
      success: false,
      message: 'Too many two-factor authentication attempts, please try again later.',
      retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return this.getClientIP(req);
    },
    onLimitReached: async (req: Request) => {
      await auditService.log(
        'TWO_FACTOR_RATE_LIMIT_EXCEEDED',
        (req as AuthenticatedRequest).user?.userId || null,
        'Two-factor authentication rate limit exceeded',
        this.getClientIP(req),
        req.headers['user-agent']
      );
    }
  });

  // Registration rate limiting
  registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 registrations per hour
    message: {
      success: false,
      message: 'Too many registration attempts, please try again later.',
      retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return this.getClientIP(req);
    },
    onLimitReached: async (req: Request) => {
      await auditService.log(
        'REGISTRATION_RATE_LIMIT_EXCEEDED',
        null,
        'Registration rate limit exceeded',
        this.getClientIP(req),
        req.headers['user-agent']
      );
    }
  });

  // Custom rate limiter for specific actions
  customLimiter(options: {
    windowMs: number;
    max: number;
    message: string;
    keyGenerator?: (req: Request) => string;
    onLimitReached?: (req: Request) => Promise<void>;
  }) {
    return rateLimit({
      windowMs: options.windowMs,
      max: options.max,
      message: {
        success: false,
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: options.keyGenerator || ((req: Request) => this.getClientIP(req)),
      onLimitReached: options.onLimitReached || (async (req: Request) => {
        await auditService.log(
          'CUSTOM_RATE_LIMIT_EXCEEDED',
          (req as AuthenticatedRequest).user?.userId || null,
          'Custom rate limit exceeded',
          this.getClientIP(req),
          req.headers['user-agent']
        );
      })
    });
  }

  // Per-user rate limiting using database
  async userRateLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
    options: {
      action: string;
      maxAttempts: number;
      windowMs: number;
    }
  ) {
    try {
      const userId = req.user?.userId;
      const ipAddress = this.getClientIP(req);
      const key = userId ? `user:${userId}:${options.action}` : `ip:${ipAddress}:${options.action}`;

      const canProceed = await rateLimitService.checkRateLimit(
        key,
        options.maxAttempts,
        Math.ceil(options.windowMs / 1000)
      );

      if (!canProceed) {
        await auditService.log(
          'USER_RATE_LIMIT_EXCEEDED',
          userId || null,
          `User rate limit exceeded for action: ${options.action}`,
          ipAddress,
          req.headers['user-agent']
        );

        return res.status(429).json({
          success: false,
          message: `Too many attempts for this action. Please try again later.`,
          retryAfter: Math.ceil(options.windowMs / 1000),
          action: options.action
        });
      }

      next();
    } catch (error) {
      console.error('User rate limit error:', error);
      next(); // Continue on error to avoid breaking the application
    }
  }

  // Progressive rate limiting based on user role
  roleBasedLimiter(baseMax: number = 100) {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: (req: AuthenticatedRequest) => {
        if (!req.user) return Math.floor(baseMax * 0.5); // Lower limit for unauthenticated users
        
        switch (req.user.role) {
          case 'ADMIN':
            return baseMax * 5; // 5x limit for admins
          case 'PREMIUM':
            return baseMax * 2; // 2x limit for premium users
          case 'BASIC':
          default:
            return baseMax; // Base limit for basic users
        }
      },
      message: {
        success: false,
        message: 'Rate limit exceeded for your user tier.',
        retryAfter: 900
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: AuthenticatedRequest) => {
        return req.user ? `user:${req.user.userId}` : `ip:${this.getClientIP(req)}`;
      },
      onLimitReached: async (req: AuthenticatedRequest) => {
        await auditService.log(
          'ROLE_BASED_RATE_LIMIT_EXCEEDED',
          req.user?.userId || null,
          'Role-based rate limit exceeded',
          this.getClientIP(req),
          req.headers['user-agent']
        );
      }
    });
  }

  // Burst protection for high-frequency actions
  burstProtection(burstMax: number = 10, burstWindowMs: number = 60000) {
    return rateLimit({
      windowMs: burstWindowMs,
      max: burstMax,
      message: {
        success: false,
        message: 'Burst limit exceeded. Please slow down your requests.',
        retryAfter: Math.ceil(burstWindowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        return `burst:${this.getClientIP(req)}`;
      },
      onLimitReached: async (req: Request) => {
        await auditService.log(
          'BURST_PROTECTION_TRIGGERED',
          (req as AuthenticatedRequest).user?.userId || null,
          'Burst protection triggered',
          this.getClientIP(req),
          req.headers['user-agent']
        );
      }
    });
  }

  // Sliding window rate limiter (more sophisticated)
  slidingWindowLimiter(maxRequests: number, windowSizeMs: number) {
    const requestCounts = new Map<string, Array<number>>();

    return async (req: Request, res: Response, next: NextFunction) => {
      const key = this.getClientIP(req);
      const now = Date.now();
      const windowStart = now - windowSizeMs;

      // Get or create request history for this key
      let requests = requestCounts.get(key) || [];
      
      // Remove requests outside the window
      requests = requests.filter(timestamp => timestamp > windowStart);
      
      // Check if we're over the limit
      if (requests.length >= maxRequests) {
        const oldestRequest = Math.min(...requests);
        const retryAfter = Math.ceil((oldestRequest + windowSizeMs - now) / 1000);

        await auditService.log(
          'SLIDING_WINDOW_RATE_LIMIT_EXCEEDED',
          (req as AuthenticatedRequest).user?.userId || null,
          'Sliding window rate limit exceeded',
          this.getClientIP(req),
          req.headers['user-agent']
        );

        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          retryAfter
        });
      }

      // Add current request
      requests.push(now);
      requestCounts.set(key, requests);

      // Set headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - requests.length).toString(),
        'X-RateLimit-Reset': new Date(now + windowSizeMs).toISOString()
      });

      next();
    };
  }

  // Bypass rate limiting for certain conditions
  bypassRateLimit() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Skip rate limiting for admin users
      if (req.user?.role === 'ADMIN') {
        return next();
      }

      // Skip rate limiting for localhost in development
      if (process.env.NODE_ENV === 'development' && 
          (this.getClientIP(req) === '127.0.0.1' || this.getClientIP(req) === '::1')) {
        return next();
      }

      // Skip rate limiting for health checks
      if (req.path === '/health' || req.path === '/api/health') {
        return next();
      }

      next();
    };
  }

  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  // Clean up old entries periodically (should be called via cron job)
  async cleanupRateLimitEntries() {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      await prisma.rateLimitEntry.deleteMany({
        where: {
          expiresAt: {
            lt: cutoffTime
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning up rate limit entries:', error);
    }
  }

  // Cleanup method for graceful shutdown
  async shutdown(): Promise<void> {
    try {
      await rateLimitMonitor.stopMonitoring();
      logger.info('Rate limiter middleware shutdown complete');
    } catch (error) {
      logger.error('Error during rate limiter shutdown:', error);
    }
  }
}

export const rateLimiterMiddleware = new RateLimiterMiddleware();