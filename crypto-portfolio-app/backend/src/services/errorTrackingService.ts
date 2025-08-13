import * as Sentry from '@sentry/node';
import { ErrorContext } from '@/types/monitoring.types';
import { config } from '@/config/config';
import { loggingService } from './loggingService';

class ErrorTrackingService {
  private initialized = false;

  constructor() {
    this.initializeSentry();
  }

  private initializeSentry(): void {
    if (!process.env.SENTRY_DSN) {
      console.warn('Sentry DSN not provided. Error tracking will use local logging only.');
      return;
    }

    try {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: config.nodeEnv,
        release: `crypto-portfolio@${config.version || '1.0.0'}`,
        integrations: [
          // Add additional integrations as needed
          Sentry.httpIntegration({ tracing: true }),
          Sentry.expressIntegration({ app: undefined }),
          Sentry.prismaIntegration(),
          Sentry.redisIntegration(),
        ],
        tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
        profilesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
        beforeSend: (event, hint) => {
          // Filter out non-critical errors in production
          if (config.nodeEnv === 'production') {
            const error = hint.originalException;
            if (error instanceof Error) {
              // Don't send validation errors
              if (error.name === 'ValidationError') return null;
              // Don't send 404 errors
              if (error.message.includes('404')) return null;
            }
          }
          return event;
        },
        beforeBreadcrumb: (breadcrumb) => {
          // Filter sensitive data from breadcrumbs
          if (breadcrumb.data?.password) {
            breadcrumb.data.password = '[Filtered]';
          }
          if (breadcrumb.data?.token) {
            breadcrumb.data.token = '[Filtered]';
          }
          return breadcrumb;
        }
      });

      this.initialized = true;
      console.log('Sentry error tracking initialized');
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
      this.initialized = false;
    }
  }

  /**
   * Set user context for error tracking
   */
  public setUserContext(userId: string, email?: string, username?: string): void {
    if (!this.initialized) return;

    Sentry.setUser({
      id: userId,
      email,
      username
    });
  }

  /**
   * Clear user context
   */
  public clearUserContext(): void {
    if (!this.initialized) return;

    Sentry.setUser(null);
  }

  /**
   * Set additional context for errors
   */
  public setContext(key: string, context: Record<string, any>): void {
    if (!this.initialized) return;

    Sentry.setContext(key, context);
  }

  /**
   * Add breadcrumb for debugging
   */
  public addBreadcrumb(
    message: string,
    category: string,
    level: 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    if (!this.initialized) return;

    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data: this.sanitizeData(data || {}),
      timestamp: Date.now() / 1000
    });
  }

  /**
   * Set tags for error categorization
   */
  public setTags(tags: Record<string, string>): void {
    if (!this.initialized) return;

    Sentry.setTags(tags);
  }

  /**
   * Set single tag
   */
  public setTag(key: string, value: string): void {
    if (!this.initialized) return;

    Sentry.setTag(key, value);
  }

  /**
   * Capture error with enhanced context
   */
  public captureError(
    error: Error,
    context?: ErrorContext,
    tags?: Record<string, string>
  ): string | undefined {
    // Always log to our logging service
    loggingService.logError(
      `Error captured: ${error.message}`,
      error,
      {
        requestId: context?.requestId,
        userId: context?.userId,
        sessionId: context?.sessionId,
        url: context?.url,
        method: context?.method,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        tags: tags ? Object.keys(tags) : undefined,
        metadata: {
          fingerprint: context?.fingerprint,
          extra: context?.extra,
          tags
        }
      }
    );

    if (!this.initialized) return undefined;

    return Sentry.withScope((scope) => {
      // Set user context if available
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }

      // Set request context
      if (context?.requestId) {
        scope.setTag('requestId', context.requestId);
      }

      if (context?.sessionId) {
        scope.setTag('sessionId', context.sessionId);
      }

      // Set request details
      if (context?.url || context?.method) {
        scope.setContext('request', {
          url: context.url,
          method: context.method,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress
        });
      }

      // Set custom tags
      if (tags) {
        scope.setTags(tags);
      }

      // Set fingerprint for grouping
      if (context?.fingerprint) {
        scope.setFingerprint([context.fingerprint]);
      }

      // Add extra context
      if (context?.extra) {
        scope.setExtras(this.sanitizeData(context.extra));
      }

      // Add breadcrumbs
      if (context?.breadcrumbs) {
        context.breadcrumbs.forEach(breadcrumb => {
          scope.addBreadcrumb({
            message: breadcrumb.message,
            category: breadcrumb.category,
            level: breadcrumb.level,
            data: breadcrumb.data,
            timestamp: breadcrumb.timestamp.getTime() / 1000
          });
        });
      }

      return Sentry.captureException(error);
    });
  }

  /**
   * Capture message with context
   */
  public captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' | 'fatal' = 'info',
    context?: ErrorContext,
    tags?: Record<string, string>
  ): string | undefined {
    // Log to our logging service
    const logLevel = level === 'fatal' ? 'error' : level === 'warning' ? 'warn' : level;
    loggingService.getLogger().log(logLevel, message, {
      requestId: context?.requestId,
      userId: context?.userId,
      sessionId: context?.sessionId,
      url: context?.url,
      method: context?.method,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      tags,
      metadata: context?.extra
    });

    if (!this.initialized) return undefined;

    return Sentry.withScope((scope) => {
      // Set context similar to captureError
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }

      if (context?.requestId) {
        scope.setTag('requestId', context.requestId);
      }

      if (tags) {
        scope.setTags(tags);
      }

      if (context?.extra) {
        scope.setExtras(this.sanitizeData(context.extra));
      }

      return Sentry.captureMessage(message, level);
    });
  }

  /**
   * Start a new transaction for performance monitoring
   */
  public startTransaction(
    name: string,
    operation: string,
    description?: string
  ): any {
    if (!this.initialized) return null;

    return Sentry.startTransaction({
      name,
      op: operation,
      description
    });
  }

  /**
   * Start a new span within a transaction
   */
  public startSpan(
    operation: string,
    description?: string,
    parentSpan?: any
  ): any {
    if (!this.initialized) return null;

    const activeSpan = parentSpan || Sentry.getActiveSpan();
    if (!activeSpan) return null;

    return activeSpan.startChild({
      op: operation,
      description
    });
  }

  /**
   * Capture database query performance
   */
  public captureDbQuery(
    query: string,
    duration: number,
    table?: string,
    operation?: string
  ): void {
    if (!this.initialized) return;

    const span = this.startSpan('db.query', `${operation || 'query'} ${table || 'unknown'}`);
    if (span) {
      span.setData('db.statement', query);
      span.setData('db.table', table);
      span.setData('db.operation', operation);
      span.setData('duration', duration);
      span.finish();
    }

    // Add breadcrumb
    this.addBreadcrumb(
      `Database query executed in ${duration}ms`,
      'db.query',
      duration > 1000 ? 'warning' : 'info',
      {
        table,
        operation,
        duration,
        slow: duration > 1000
      }
    );
  }

  /**
   * Capture HTTP request performance
   */
  public captureHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestId?: string
  ): void {
    if (!this.initialized) return;

    const span = this.startSpan('http.request', `${method} ${url}`);
    if (span) {
      span.setData('http.method', method);
      span.setData('http.url', url);
      span.setData('http.status_code', statusCode);
      span.setData('duration', duration);
      span.setData('request_id', requestId);
      span.finish();
    }

    // Add breadcrumb
    this.addBreadcrumb(
      `HTTP ${method} ${url} ${statusCode} in ${duration}ms`,
      'http.request',
      statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warning' : 'info',
      {
        method,
        url,
        statusCode,
        duration,
        requestId
      }
    );
  }

  /**
   * Capture external API call
   */
  public captureExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ): void {
    if (!this.initialized) return;

    const span = this.startSpan('external.api', `${service} ${method} ${endpoint}`);
    if (span) {
      span.setData('external.service', service);
      span.setData('external.endpoint', endpoint);
      span.setData('http.method', method);
      span.setData('http.status_code', statusCode);
      span.setData('duration', duration);
      span.finish();
    }

    this.addBreadcrumb(
      `External API call to ${service}: ${method} ${endpoint} ${statusCode} in ${duration}ms`,
      'external.api',
      statusCode >= 400 ? 'error' : 'info',
      {
        service,
        endpoint,
        method,
        statusCode,
        duration
      }
    );
  }

  /**
   * Create error fingerprint for grouping
   */
  public createFingerprint(
    errorType: string,
    location: string,
    userId?: string
  ): string {
    const parts = [errorType, location];
    if (userId) parts.push(userId);
    return parts.join(':');
  }

  /**
   * Check if error tracking is available
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Flush all pending events
   */
  public async flush(timeout = 2000): Promise<boolean> {
    if (!this.initialized) return true;

    return Sentry.flush(timeout);
  }

  /**
   * Close the error tracking service
   */
  public async close(timeout = 2000): Promise<boolean> {
    if (!this.initialized) return true;

    return Sentry.close(timeout);
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'authorization',
      'cookie', 'session', 'credentials', 'apiKey', 'privateKey'
    ];

    const sanitized = { ...data };

    const sanitizeValue = (obj: any, key: string): any => {
      if (sensitiveKeys.some(sensitiveKey => 
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      )) {
        return '[Filtered]';
      }
      return obj[key];
    };

    const sanitizeObject = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = typeof value === 'object' 
          ? sanitizeObject(value)
          : sanitizeValue(obj, key);
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }
}

export const errorTrackingService = new ErrorTrackingService();