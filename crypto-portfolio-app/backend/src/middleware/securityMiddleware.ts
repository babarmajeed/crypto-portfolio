import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { auditService } from '../services/auditService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export class SecurityMiddleware {
  // Helmet configuration for security headers
  helmetConfig = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        connectSrc: ["'self'", "https://api.coingecko.com", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for some APIs
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin"
    }
  });

  // CORS configuration
  corsConfig = cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'https://localhost:3000',
        'https://localhost:3001'
      ].filter(Boolean) as string[];

      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Session-ID',
      'X-2FA-Token',
      'X-Device-Info',
      'X-API-Key'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400 // 24 hours
  });

  // Request sanitization
  sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize query parameters
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            req.query[key] = this.sanitizeString(value);
          }
        }
      }

      // Sanitize request body (except for raw file uploads)
      if (req.body && req.headers['content-type']?.includes('application/json')) {
        req.body = this.sanitizeObject(req.body);
      }

      next();
    } catch (error) {
      console.error('Request sanitization error:', error);
      next();
    }
  };

  // XSS protection
  xssProtection = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  };

  // Prevent parameter pollution
  parameterPollutionProtection = (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (Array.isArray(value) && value.length > 10) {
            // Limit array parameters to prevent pollution
            req.query[key] = value.slice(0, 10);
          }
        }
      }
      next();
    } catch (error) {
      console.error('Parameter pollution protection error:', error);
      next();
    }
  };

  // SQL Injection protection (basic)
  sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
    try {
      const suspiciousPatterns = [
        /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UPDATE|UNION|INTO|FROM|WHERE)\b)/i,
        /(\b(AND|OR)\s+(\w+\s*[=<>]\s*\w+|\w+\s+(LIKE|IN)\s+\([^)]+\)))/i,
        /('|(\\)?;|--|#|\/\*|\*\/)/i
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(checkValue);
        }
        return false;
      };

      const checkRequest = (obj: any): boolean => {
        if (typeof obj === 'object' && obj !== null) {
          return Object.values(obj).some(checkValue);
        }
        return checkValue(obj);
      };

      if (checkRequest(req.query) || checkRequest(req.body) || checkRequest(req.params)) {
        const clientIP = this.getClientIP(req);
        
        auditService.log(
          'SQL_INJECTION_ATTEMPT',
          (req as AuthenticatedRequest).user?.userId || null,
          'Potential SQL injection attempt detected',
          clientIP,
          req.headers['user-agent']
        ).catch(console.error);

        return res.status(400).json({
          success: false,
          message: 'Invalid request parameters'
        });
      }

      next();
    } catch (error) {
      console.error('SQL injection protection error:', error);
      next();
    }
  };

  // NoSQL Injection protection
  noSQLInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
    try {
      const checkNoSQLInjection = (obj: any): boolean => {
        if (typeof obj === 'object' && obj !== null) {
          for (const key in obj) {
            if (key.startsWith('$') || key.includes('.')) {
              return true;
            }
            if (typeof obj[key] === 'object' && checkNoSQLInjection(obj[key])) {
              return true;
            }
          }
        }
        return false;
      };

      if (checkNoSQLInjection(req.body) || checkNoSQLInjection(req.query)) {
        const clientIP = this.getClientIP(req);
        
        auditService.log(
          'NOSQL_INJECTION_ATTEMPT',
          (req as AuthenticatedRequest).user?.userId || null,
          'Potential NoSQL injection attempt detected',
          clientIP,
          req.headers['user-agent']
        ).catch(console.error);

        return res.status(400).json({
          success: false,
          message: 'Invalid request parameters'
        });
      }

      next();
    } catch (error) {
      console.error('NoSQL injection protection error:', error);
      next();
    }
  };

  // Content length limit
  contentLengthLimit = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content-length'];
      
      if (contentLength && parseInt(contentLength) > maxSize) {
        return res.status(413).json({
          success: false,
          message: 'Request entity too large'
        });
      }

      next();
    };
  };

  // Request logging for security monitoring
  securityLogging = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const clientIP = this.getClientIP(req);
    const userAgent = req.headers['user-agent'];
    const userId = req.user?.userId;

    // Log suspicious patterns
    const suspiciousPatterns = [
      /\.(php|asp|jsp|cgi)$/i,
      /\/(admin|wp-admin|phpmyadmin)/i,
      /\.(env|config|backup|sql|db)$/i,
      /\b(eval|exec|system|shell_exec|passthru)\b/i
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(req.path) || pattern.test(req.originalUrl)
    );

    if (isSuspicious) {
      await auditService.log(
        'SUSPICIOUS_REQUEST',
        userId || null,
        `Suspicious request pattern detected: ${req.method} ${req.originalUrl}`,
        clientIP,
        userAgent
      );
    }

    // Log failed authentication attempts
    res.on('finish', async () => {
      if (req.path.includes('/auth/') && res.statusCode === 401) {
        await auditService.log(
          'AUTH_FAILED',
          userId || null,
          `Authentication failed: ${req.method} ${req.path}`,
          clientIP,
          userAgent
        );
      }
    });

    next();
  };

  // API key validation
  validateApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required'
      });
    }

    // In a real implementation, you would validate against a database
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    
    if (!validApiKeys.includes(apiKey as string)) {
      const clientIP = this.getClientIP(req);
      
      auditService.log(
        'INVALID_API_KEY',
        null,
        'Invalid API key used',
        clientIP,
        req.headers['user-agent']
      ).catch(console.error);

      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    next();
  };

  // Device fingerprinting
  deviceFingerprinting = (req: Request, res: Response, next: NextFunction) => {
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      acceptLanguage: req.headers['accept-language'],
      acceptEncoding: req.headers['accept-encoding'],
      ip: this.getClientIP(req),
      timestamp: new Date().toISOString()
    };

    // Add device fingerprint to request
    req.headers['x-device-fingerprint'] = Buffer.from(
      JSON.stringify(deviceInfo)
    ).toString('base64');

    next();
  };

  // Private helper methods
  private sanitizeString(str: string): string {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>]/g, '') // Remove angle brackets
      .trim();
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
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

  // Comprehensive security middleware stack
  applySecurityMiddleware() {
    return [
      this.helmetConfig,
      this.corsConfig,
      this.xssProtection,
      this.sanitizeRequest,
      this.parameterPollutionProtection,
      this.sqlInjectionProtection,
      this.noSQLInjectionProtection,
      this.contentLengthLimit(),
      this.deviceFingerprinting,
      this.securityLogging
    ];
  }
}

export const securityMiddleware = new SecurityMiddleware();