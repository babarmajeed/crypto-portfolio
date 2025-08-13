import winston from 'winston';
import ElasticSearch from 'winston-elasticsearch';
import { v4 as uuidv4 } from 'uuid';
import { LogEntry } from '@/types/monitoring.types';
import { monitoringConfig } from '@/config/monitoring.config';
import { config } from '@/config/config';

class LoggingService {
  private logger: winston.Logger;
  private requestIdMap = new Map<string, string>();

  constructor() {
    this.initializeLogger();
  }

  private initializeLogger(): void {
    const transports: winston.transport[] = [];

    // Console transport for development
    if (monitoringConfig.logging.transports.console) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, requestId, userId, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              const contextStr = requestId ? `[${requestId}]` : '';
              const userStr = userId ? `[User:${userId}]` : '';
              return `${timestamp} ${level} ${contextStr}${userStr}: ${message} ${metaStr}`;
            })
          )
        })
      );
    }

    // File transport
    if (monitoringConfig.logging.transports.file) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 5,
          tailable: true
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 10,
          tailable: true
        })
      );
    }

    // Elasticsearch transport for production
    if (monitoringConfig.logging.transports.elasticsearch && monitoringConfig.logging.elasticsearch) {
      const esTransport = new ElasticSearch({
        level: monitoringConfig.logging.elasticsearch.level,
        clientOpts: {
          node: monitoringConfig.logging.elasticsearch.host,
          maxRetries: 3,
          requestTimeout: 10000,
          sniffOnStart: false
        },
        index: monitoringConfig.logging.elasticsearch.index,
        indexTemplate: {
          name: 'crypto-portfolio-logs',
          pattern: 'crypto-portfolio-logs-*',
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            'index.lifecycle.name': 'crypto-portfolio-logs-policy',
            'index.lifecycle.rollover_alias': monitoringConfig.logging.elasticsearch.index
          },
          mappings: {
            properties: {
              '@timestamp': { type: 'date' },
              level: { type: 'keyword' },
              message: { type: 'text' },
              service: { type: 'keyword' },
              requestId: { type: 'keyword' },
              userId: { type: 'keyword' },
              sessionId: { type: 'keyword' },
              ipAddress: { type: 'ip' },
              userAgent: { type: 'text' },
              method: { type: 'keyword' },
              url: { type: 'keyword' },
              statusCode: { type: 'integer' },
              duration: { type: 'integer' },
              error: {
                properties: {
                  name: { type: 'keyword' },
                  message: { type: 'text' },
                  stack: { type: 'text' },
                  code: { type: 'keyword' }
                }
              },
              tags: { type: 'keyword' },
              metadata: { type: 'object' }
            }
          }
        },
        transformer: (logData: any) => {
          return {
            '@timestamp': logData.timestamp || new Date().toISOString(),
            ...logData
          };
        }
      });

      transports.push(esTransport);
    }

    this.logger = winston.createLogger({
      level: monitoringConfig.logging.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'crypto-portfolio-api',
        version: config.version || '1.0.0',
        environment: config.nodeEnv
      },
      transports,
      exitOnError: false
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    );

    this.logger.rejections.handle(
      new winston.transports.File({ filename: 'logs/rejections.log' })
    );
  }

  /**
   * Generate a unique request ID for correlation
   */
  public generateRequestId(): string {
    return uuidv4();
  }

  /**
   * Set request context for correlation
   */
  public setRequestContext(requestId: string, context: Partial<LogEntry>): void {
    this.requestIdMap.set(requestId, JSON.stringify(context));
  }

  /**
   * Get request context
   */
  private getRequestContext(requestId?: string): Partial<LogEntry> {
    if (!requestId) return {};
    
    const contextStr = this.requestIdMap.get(requestId);
    if (!contextStr) return {};
    
    try {
      return JSON.parse(contextStr);
    } catch {
      return {};
    }
  }

  /**
   * Clear request context to prevent memory leaks
   */
  public clearRequestContext(requestId: string): void {
    this.requestIdMap.delete(requestId);
  }

  /**
   * Log error with enhanced context
   */
  public logError(
    message: string,
    error?: Error,
    context?: Partial<LogEntry>
  ): void {
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message,
      level: 'error',
      timestamp: new Date(),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code
        }
      })
    };

    this.logger.error(logEntry);
  }

  /**
   * Log warning with context
   */
  public logWarning(
    message: string,
    context?: Partial<LogEntry>
  ): void {
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message,
      level: 'warn',
      timestamp: new Date()
    };

    this.logger.warn(logEntry);
  }

  /**
   * Log info with context
   */
  public logInfo(
    message: string,
    context?: Partial<LogEntry>
  ): void {
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message,
      level: 'info',
      timestamp: new Date()
    };

    this.logger.info(logEntry);
  }

  /**
   * Log debug information
   */
  public logDebug(
    message: string,
    context?: Partial<LogEntry>
  ): void {
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message,
      level: 'debug',
      timestamp: new Date()
    };

    this.logger.debug(logEntry);
  }

  /**
   * Log API request with enhanced details
   */
  public logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: Partial<LogEntry>
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message: `${method} ${url} ${statusCode} - ${duration}ms`,
      level,
      method,
      url,
      statusCode,
      duration,
      timestamp: new Date(),
      tags: ['api', 'request']
    };

    this.logger.log(level, logEntry);
  }

  /**
   * Log user action for analytics and audit
   */
  public logUserAction(
    userId: string,
    action: string,
    resource: string,
    context?: Partial<LogEntry>
  ): void {
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      userId,
      message: `User ${userId} performed ${action} on ${resource}`,
      level: 'info',
      timestamp: new Date(),
      tags: ['user_action', 'audit'],
      metadata: {
        action,
        resource,
        userId
      }
    };

    this.logger.info(logEntry);
  }

  /**
   * Log security event
   */
  public logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    context?: Partial<LogEntry>
  ): void {
    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message: `Security event: ${eventType}`,
      level,
      timestamp: new Date(),
      tags: ['security', eventType, severity],
      metadata: {
        eventType,
        severity,
        ...details
      }
    };

    this.logger.log(level, logEntry);
  }

  /**
   * Log business metric
   */
  public logBusinessMetric(
    metricName: string,
    value: number,
    unit: string,
    context?: Partial<LogEntry>
  ): void {
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message: `Business metric: ${metricName} = ${value} ${unit}`,
      level: 'info',
      timestamp: new Date(),
      tags: ['business_metric', metricName],
      metadata: {
        metricName,
        value,
        unit
      }
    };

    this.logger.info(logEntry);
  }

  /**
   * Log database operation
   */
  public logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    context?: Partial<LogEntry>
  ): void {
    const level = duration > monitoringConfig.performance.slowQueryThreshold ? 'warn' : 'debug';
    
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message: `Database ${operation} on ${table} took ${duration}ms`,
      level,
      duration,
      timestamp: new Date(),
      tags: ['database', operation, table],
      metadata: {
        operation,
        table,
        duration,
        slow: duration > monitoringConfig.performance.slowQueryThreshold
      }
    };

    this.logger.log(level, logEntry);
  }

  /**
   * Log external API call
   */
  public logExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: Partial<LogEntry>
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message: `External API call to ${service} ${method} ${endpoint} returned ${statusCode} in ${duration}ms`,
      level,
      method,
      url: endpoint,
      statusCode,
      duration,
      timestamp: new Date(),
      tags: ['external_api', service],
      metadata: {
        service,
        endpoint,
        method,
        statusCode,
        duration
      }
    };

    this.logger.log(level, logEntry);
  }

  /**
   * Log performance metric
   */
  public logPerformanceMetric(
    metricName: string,
    value: number,
    threshold?: number,
    context?: Partial<LogEntry>
  ): void {
    const level = threshold && value > threshold ? 'warn' : 'info';
    
    const logEntry: Partial<LogEntry> = {
      ...this.getRequestContext(context?.requestId),
      ...context,
      message: `Performance metric: ${metricName} = ${value}${threshold ? ` (threshold: ${threshold})` : ''}`,
      level,
      timestamp: new Date(),
      tags: ['performance', metricName],
      metadata: {
        metricName,
        value,
        threshold,
        exceededThreshold: threshold ? value > threshold : false
      }
    };

    this.logger.log(level, logEntry);
  }

  /**
   * Create child logger with additional context
   */
  public createChildLogger(defaultContext: Partial<LogEntry>): winston.Logger {
    return this.logger.child(defaultContext);
  }

  /**
   * Get current logger instance
   */
  public getLogger(): winston.Logger {
    return this.logger;
  }

  /**
   * Flush all transports
   */
  public async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  /**
   * Query logs from Elasticsearch
   */
  public async queryLogs(
    query: any,
    fromDate?: Date,
    toDate?: Date,
    size = 100
  ): Promise<any[]> {
    if (!monitoringConfig.logging.transports.elasticsearch) {
      throw new Error('Elasticsearch logging is not enabled');
    }

    // This would typically use an Elasticsearch client
    // Implementation would depend on the specific ES client being used
    console.warn('Log querying not implemented yet - requires Elasticsearch client setup');
    return [];
  }
}

export const loggingService = new LoggingService();