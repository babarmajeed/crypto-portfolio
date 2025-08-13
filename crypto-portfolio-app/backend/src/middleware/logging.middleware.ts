import { Request, Response, NextFunction } from 'express'
import { logger } from '@/utils/logger'
import { randomUUID } from 'crypto'

export interface LoggedRequest extends Request {
  requestId?: string
  startTime?: number
}

/**
 * Enhanced logging middleware with request tracking and performance monitoring
 */
export const requestLoggingMiddleware = (req: LoggedRequest, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.requestId = randomUUID()
  req.startTime = Date.now()

  // Add request ID to response headers for debugging
  res.setHeader('X-Request-ID', req.requestId)

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    userId: (req as any).user?.id,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    params: Object.keys(req.params).length > 0 ? req.params : undefined,
    timestamp: new Date().toISOString()
  })

  // Log request body for non-GET requests (excluding sensitive data)
  if (req.method !== 'GET' && req.body) {
    const sanitizedBody = sanitizeRequestBody(req.body)
    if (Object.keys(sanitizedBody).length > 0) {
      logger.debug('Request body', {
        requestId: req.requestId,
        body: sanitizedBody
      })
    }
  }

  // Override res.json to capture response data
  const originalJson = res.json.bind(res)
  res.json = function(body: any) {
    // Log response
    const duration = Date.now() - (req.startTime || Date.now())
    const responseSize = JSON.stringify(body).length

    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: `${responseSize} bytes`,
      userId: (req as any).user?.id,
      success: res.statusCode < 400,
      timestamp: new Date().toISOString()
    })

    // Log detailed response for errors
    if (res.statusCode >= 400) {
      logger.warn('Request failed', {
        requestId: req.requestId,
        statusCode: res.statusCode,
        errorResponse: body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      })
    }

    // Log performance warnings for slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        userId: (req as any).user?.id
      })
    }

    return originalJson(body)
  }

  next()
}

/**
 * Sanitize request body to remove sensitive information from logs
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return {}
  }

  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'apiKey', 'apiSecret', 
    'passphrase', 'privateKey', 'refreshToken', 'accessToken',
    'authorization', 'auth', 'credentials', 'otp', 'code'
  ]

  const sanitized = { ...body }

  function recursiveSanitize(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => recursiveSanitize(item))
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase()
        const isSensitive = sensitiveFields.some(field => 
          lowerKey.includes(field.toLowerCase())
        )
        
        if (isSensitive) {
          result[key] = '[REDACTED]'
        } else if (typeof value === 'object') {
          result[key] = recursiveSanitize(value)
        } else {
          result[key] = value
        }
      }
      return result
    }
    
    return obj
  }

  return recursiveSanitize(sanitized)
}

/**
 * Audit logging middleware for sensitive operations
 */
export const auditLoggingMiddleware = (operation: string) => {
  return (req: LoggedRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res)
    
    res.json = function(body: any) {
      // Log audit trail for successful operations
      if (res.statusCode < 400) {
        logger.info('Audit trail', {
          operation,
          requestId: req.requestId,
          userId: (req as any).user?.id,
          userEmail: (req as any).user?.email,
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
          resourceId: req.params.id || req.params.portfolioId || req.params.credentialId,
          result: body.success ? 'success' : 'failure'
        })
      }
      
      return originalJson(body)
    }
    
    next()
  }
}

/**
 * Security logging middleware for authentication events
 */
export const securityLoggingMiddleware = (req: LoggedRequest, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res)
  
  res.json = function(body: any) {
    // Log security events
    const isAuthEndpoint = req.originalUrl.includes('/auth/')
    const isSecurityEndpoint = req.originalUrl.includes('/security/')
    
    if (isAuthEndpoint || isSecurityEndpoint) {
      const event = determineSecurityEvent(req.originalUrl, req.method, res.statusCode)
      
      logger.info('Security event', {
        event,
        requestId: req.requestId,
        userId: (req as any).user?.id,
        email: req.body?.email || (req as any).user?.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        success: res.statusCode < 400,
        timestamp: new Date().toISOString(),
        failureReason: res.statusCode >= 400 ? body.message || body.error : undefined
      })
    }
    
    return originalJson(body)
  }
  
  next()
}

function determineSecurityEvent(url: string, method: string, statusCode: number): string {
  if (url.includes('/login')) return statusCode < 400 ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED'
  if (url.includes('/register')) return statusCode < 400 ? 'REGISTRATION_SUCCESS' : 'REGISTRATION_FAILED'
  if (url.includes('/logout')) return 'LOGOUT'
  if (url.includes('/forgot-password')) return 'PASSWORD_RESET_REQUESTED'
  if (url.includes('/reset-password')) return statusCode < 400 ? 'PASSWORD_RESET_SUCCESS' : 'PASSWORD_RESET_FAILED'
  if (url.includes('/2fa/setup')) return statusCode < 400 ? '2FA_SETUP_SUCCESS' : '2FA_SETUP_FAILED'
  if (url.includes('/2fa/verify')) return statusCode < 400 ? '2FA_VERIFY_SUCCESS' : '2FA_VERIFY_FAILED'
  if (url.includes('/2fa/disable')) return statusCode < 400 ? '2FA_DISABLED' : '2FA_DISABLE_FAILED'
  if (url.includes('/change-password')) return statusCode < 400 ? 'PASSWORD_CHANGED' : 'PASSWORD_CHANGE_FAILED'
  if (url.includes('/sessions') && method === 'DELETE') return 'SESSION_REVOKED'
  
  return 'SECURITY_EVENT'
}

export default {
  requestLoggingMiddleware,
  auditLoggingMiddleware,
  securityLoggingMiddleware
}