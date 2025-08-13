import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { loggingService } from '@/services/loggingService';
import { errorTrackingService } from '@/services/errorTrackingService';
import { analyticsService } from '@/services/analyticsService';
import { monitoringConfig } from '@/config/monitoring.config';

interface PerformanceMetrics {
  requestId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  method: string;
  url: string;
  statusCode?: number;
  contentLength?: number;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

interface ExtendedRequest extends Request {
  requestId?: string;
  startTime?: number;
  metrics?: PerformanceMetrics;
}

class PerformanceMiddleware {
  private activeRequests = new Map<string, PerformanceMetrics>();
  private recentMetrics: PerformanceMetrics[] = [];
  private readonly maxRecentMetrics = 1000;

  /**
   * Main performance monitoring middleware
   */
  public monitor() {
    return (req: ExtendedRequest, res: Response, next: NextFunction) => {
      const requestId = uuidv4();
      const startTime = Date.now();
      const cpuUsageStart = process.cpuUsage();
      const memoryUsageStart = process.memoryUsage();

      // Set request context
      req.requestId = requestId;
      req.startTime = startTime;

      const metrics: PerformanceMetrics = {
        requestId,
        startTime,
        method: req.method,
        url: req.originalUrl || req.url,
        userAgent: req.get('User-Agent'),
        ipAddress: this.getClientIP(req),
        userId: (req as any).user?.id,
        memoryUsage: memoryUsageStart,
        cpuUsage: cpuUsageStart
      };

      req.metrics = metrics;
      this.activeRequests.set(requestId, metrics);

      // Set request ID for logging context
      loggingService.setRequestContext(requestId, {
        requestId,
        userId: metrics.userId,
        method: req.method,
        url: req.originalUrl || req.url,
        ipAddress: metrics.ipAddress,
        userAgent: metrics.userAgent
      });

      // Set Sentry context
      errorTrackingService.setContext('request', {
        requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        userAgent: metrics.userAgent,
        ipAddress: metrics.ipAddress
      });

      // Start Sentry transaction
      const transaction = errorTrackingService.startTransaction(
        `${req.method} ${req.route?.path || req.path}`,
        'http.server',
        `HTTP ${req.method} request`
      );

      // Store transaction for cleanup
      if (transaction) {
        (req as any).transaction = transaction;
      }

      // Override res.json to capture response size
      const originalJson = res.json;
      res.json = function(body: any) {
        if (body && typeof body === 'object') {
          metrics.contentLength = JSON.stringify(body).length;
        }
        return originalJson.call(this, body);
      };

      // Override res.send to capture response size
      const originalSend = res.send;
      res.send = function(body: any) {
        if (body && typeof body === 'string') {
          metrics.contentLength = body.length;
        } else if (body && typeof body === 'object') {
          metrics.contentLength = JSON.stringify(body).length;
        }
        return originalSend.call(this, body);
      };

      // Handle response completion
      res.on('finish', () => {
        this.handleRequestCompletion(req, res);
      });

      // Handle request close (client disconnect)
      req.on('close', () => {
        if (!res.headersSent) {
          this.handleRequestCompletion(req, res, true);
        }
      });

      next();
    };
  }

  /**
   * Database query performance monitoring
   */
  public monitorDbQuery() {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const startTime = Date.now();
        const query = args[0]; // Assume first argument is the query
        
        try {
          const result = await method.apply(this, args);
          const duration = Date.now() - startTime;

          // Log slow queries
          if (duration > monitoringConfig.performance.slowQueryThreshold) {
            loggingService.logWarning(
              `Slow database query detected: ${duration}ms`,
              {
                metadata: {
                  query: typeof query === 'string' ? query.substring(0, 500) : 'Complex query',
                  duration,
                  table: this.tableName || 'unknown'
                },
                tags: ['performance', 'database', 'slow_query']
              }
            );
          }

          // Track performance metric
          loggingService.logDatabaseOperation(
            propertyName,
            this.tableName || 'unknown',
            duration
          );

          // Capture in Sentry
          errorTrackingService.captureDbQuery(
            typeof query === 'string' ? query.substring(0, 500) : 'Complex query',
            duration,
            this.tableName,
            propertyName
          );

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          // Log database error
          loggingService.logError(
            `Database query failed: ${propertyName}`,
            error as Error,
            {
              metadata: {
                query: typeof query === 'string' ? query.substring(0, 500) : 'Complex query',
                duration,
                table: this.tableName || 'unknown'
              },
              tags: ['database', 'error']
            }
          );

          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * External API call monitoring
   */
  public monitorExternalApi(serviceName: string) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const startTime = Date.now();
        const url = args[0] || 'unknown';
        
        try {
          const result = await method.apply(this, args);
          const duration = Date.now() - startTime;
          const statusCode = result?.status || result?.statusCode || 200;

          // Log API call
          loggingService.logExternalApiCall(
            serviceName,
            url,
            'GET', // Default, could be extracted from args
            statusCode,
            duration
          );

          // Capture in Sentry
          errorTrackingService.captureExternalApiCall(
            serviceName,
            url,
            'GET',
            statusCode,
            duration
          );

          // Track analytics
          analyticsService.trackEvent(
            'performance',
            'external_api',
            'call_completed',
            serviceName,
            duration,
            undefined,
            undefined,
            {
              service: serviceName,
              endpoint: url,
              statusCode,
              duration
            }
          );

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          // Log API error
          loggingService.logError(
            `External API call failed: ${serviceName}`,
            error as Error,
            {
              metadata: {
                service: serviceName,
                endpoint: url,
                duration
              },
              tags: ['external_api', 'error', serviceName]
            }
          );

          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Memory usage monitoring decorator
   */
  public monitorMemory() {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const memoryBefore = process.memoryUsage();
        
        try {
          const result = await method.apply(this, args);
          const memoryAfter = process.memoryUsage();
          
          const memoryDiff = {
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            external: memoryAfter.external - memoryBefore.external
          };

          // Log significant memory usage
          if (Math.abs(memoryDiff.heapUsed) > 50 * 1024 * 1024) { // 50MB
            loggingService.logPerformanceMetric(
              'memory_usage_change',
              memoryDiff.heapUsed,
              50 * 1024 * 1024,
              {
                metadata: {
                  method: propertyName,
                  memoryBefore: memoryBefore.heapUsed,
                  memoryAfter: memoryAfter.heapUsed,
                  memoryDiff
                },
                tags: ['performance', 'memory']
              }
            );
          }

          return result;
        } catch (error) {
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Handle request completion
   */
  private handleRequestCompletion(
    req: ExtendedRequest,
    res: Response,
    clientDisconnect = false
  ): void {
    const requestId = req.requestId;
    if (!requestId) return;

    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;

    const endTime = Date.now();
    const duration = endTime - metrics.startTime;
    const memoryUsageEnd = process.memoryUsage();
    const cpuUsageEnd = process.cpuUsage(metrics.cpuUsage);

    // Update metrics
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.statusCode = res.statusCode;

    // Calculate resource usage
    const memoryDiff = {
      heapUsed: memoryUsageEnd.heapUsed - (metrics.memoryUsage?.heapUsed || 0),
      heapTotal: memoryUsageEnd.heapTotal - (metrics.memoryUsage?.heapTotal || 0)
    };

    const cpuPercent = (cpuUsageEnd.user + cpuUsageEnd.system) / 1000; // Convert to ms

    // Log request completion
    loggingService.logApiRequest(
      metrics.method,
      metrics.url,
      metrics.statusCode || 0,
      duration,
      {
        requestId,
        userId: metrics.userId,
        ipAddress: metrics.ipAddress,
        userAgent: metrics.userAgent,
        metadata: {
          contentLength: metrics.contentLength,
          memoryDiff,
          cpuUsage: cpuPercent,
          clientDisconnect
        }
      }
    );

    // Capture performance in Sentry
    errorTrackingService.captureHttpRequest(
      metrics.method,
      metrics.url,
      metrics.statusCode || 0,
      duration,
      requestId
    );

    // Track analytics
    analyticsService.trackEvent(
      'performance',
      'http_request',
      'completed',
      `${metrics.method} ${metrics.url}`,
      duration,
      metrics.userId,
      undefined,
      {
        method: metrics.method,
        url: metrics.url,
        statusCode: metrics.statusCode,
        duration,
        contentLength: metrics.contentLength,
        clientDisconnect
      }
    );

    // Log slow requests
    if (duration > monitoringConfig.performance.requestTimeoutThreshold) {
      loggingService.logWarning(
        `Slow request detected: ${metrics.method} ${metrics.url} took ${duration}ms`,
        {
          requestId,
          metadata: {
            method: metrics.method,
            url: metrics.url,
            duration,
            threshold: monitoringConfig.performance.requestTimeoutThreshold
          },
          tags: ['performance', 'slow_request']
        }
      );
    }

    // Log errors
    if (metrics.statusCode && metrics.statusCode >= 400) {
      const level = metrics.statusCode >= 500 ? 'error' : 'warn';
      loggingService.getLogger().log(level, 
        `HTTP ${metrics.statusCode}: ${metrics.method} ${metrics.url}`,
        {
          requestId,
          metadata: {
            method: metrics.method,
            url: metrics.url,
            statusCode: metrics.statusCode,
            duration,
            userId: metrics.userId
          },
          tags: ['http_error', `status_${metrics.statusCode}`]
        }
      );
    }

    // Store in recent metrics (for dashboards)
    this.recentMetrics.push({ ...metrics });
    if (this.recentMetrics.length > this.maxRecentMetrics) {
      this.recentMetrics.shift();
    }

    // Cleanup
    this.activeRequests.delete(requestId);
    loggingService.clearRequestContext(requestId);

    // Finish Sentry transaction
    const transaction = (req as any).transaction;
    if (transaction) {
      transaction.setHttpStatus(metrics.statusCode || 0);
      transaction.finish();
    }
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(timeWindow = 300000): { // 5 minutes default
    requests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequests: number;
    throughput: number;
    statusCodes: Record<string, number>;
  } {
    const now = Date.now();
    const recentMetrics = this.recentMetrics.filter(
      m => m.endTime && (now - m.endTime) <= timeWindow
    );

    if (recentMetrics.length === 0) {
      return {
        requests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowRequests: 0,
        throughput: 0,
        statusCodes: {}
      };
    }

    const totalRequests = recentMetrics.length;
    const totalDuration = recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const errorRequests = recentMetrics.filter(m => m.statusCode && m.statusCode >= 400).length;
    const slowRequests = recentMetrics.filter(
      m => m.duration && m.duration > monitoringConfig.performance.requestTimeoutThreshold
    ).length;

    const statusCodes: Record<string, number> = {};
    recentMetrics.forEach(m => {
      const status = m.statusCode?.toString() || 'unknown';
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });

    return {
      requests: totalRequests,
      averageResponseTime: totalDuration / totalRequests,
      errorRate: (errorRequests / totalRequests) * 100,
      slowRequests,
      throughput: totalRequests / (timeWindow / 1000), // requests per second
      statusCodes
    };
  }

  /**
   * Get active requests count
   */
  public getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get current active requests
   */
  public getActiveRequests(): PerformanceMetrics[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Extract client IP address
   */
  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      req.get('x-forwarded-for')?.split(',')[0] ||
      req.get('x-real-ip') ||
      'unknown'
    );
  }

  /**
   * Cleanup old metrics
   */
  public cleanup(): void {
    this.activeRequests.clear();
    this.recentMetrics.length = 0;
  }
}

export const performanceMiddleware = new PerformanceMiddleware();