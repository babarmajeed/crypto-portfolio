# CP-013: Logging, Monitoring and Analytics

## Objective
Implement comprehensive logging, monitoring, and analytics systems to track application performance, user behavior, error patterns, and business metrics with real-time dashboards and alerting capabilities.

## Priority
High

## Category
Backend Infrastructure

## Acceptance Criteria
- [ ] Structured logging system with multiple log levels
- [ ] Application performance monitoring (APM) integration
- [ ] Error tracking and alerting system
- [ ] User analytics and behavior tracking
- [ ] Business metrics dashboard and KPIs
- [ ] Real-time monitoring with health checks
- [ ] Log aggregation and search capabilities
- [ ] Custom alerting rules and notifications
- [ ] Performance bottleneck identification
- [ ] Security audit logging and compliance

## Technical Implementation Details

### Logging Service
```javascript
// services/loggingService.js
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

class LoggingService {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.metadata()
      ),
      defaultMeta: {
        service: 'crypto-portfolio',
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760,
          maxFiles: 10
        })
      ]
    });

    // Add Elasticsearch transport for production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: process.env.ELASTICSEARCH_URL,
          auth: {
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD
          }
        },
        index: 'crypto-portfolio-logs'
      }));
    }
  }

  // Enhanced logging methods with context
  info(message, metadata = {}) {
    this.logger.info(message, this.enhanceMetadata(metadata));
  }

  error(message, error = null, metadata = {}) {
    const errorMetadata = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : {};

    this.logger.error(message, {
      ...this.enhanceMetadata(metadata),
      ...errorMetadata
    });
  }

  warn(message, metadata = {}) {
    this.logger.warn(message, this.enhanceMetadata(metadata));
  }

  debug(message, metadata = {}) {
    this.logger.debug(message, this.enhanceMetadata(metadata));
  }

  // Business-specific logging methods
  logUserAction(userId, action, metadata = {}) {
    this.info('User action', {
      category: 'user_action',
      userId,
      action,
      ...metadata
    });
  }

  logAPICall(req, res, duration) {
    this.info('API call', {
      category: 'api',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }

  logSecurityEvent(event, metadata = {}) {
    this.warn('Security event', {
      category: 'security',
      event,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  logBusinessMetric(metric, value, metadata = {}) {
    this.info('Business metric', {
      category: 'business_metric',
      metric,
      value,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  enhanceMetadata(metadata) {
    return {
      ...metadata,
      requestId: metadata.requestId || this.generateRequestId(),
      timestamp: new Date().toISOString()
    };
  }

  generateRequestId() {
    return Math.random().toString(36).substring(2, 15);
  }
}

module.exports = new LoggingService();
```

### Performance Monitoring
```javascript
// middleware/performanceMiddleware.js
const logger = require('../services/loggingService');

class PerformanceMonitor {
  static middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = Math.random().toString(36).substring(2, 15);
      
      req.requestId = requestId;
      req.startTime = startTime;

      // Log incoming request
      logger.info('Request started', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id,
        ip: req.ip
      });

      // Hook into response finish
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log API call completion
        logger.logAPICall(req, res, duration);
        
        // Track performance metrics
        this.trackPerformanceMetrics(req, res, duration);
        
        // Alert on slow requests
        if (duration > 5000) { // 5 seconds
          logger.warn('Slow request detected', {
            requestId,
            method: req.method,
            url: req.originalUrl,
            duration,
            userId: req.user?.id
          });
        }
      });

      next();
    };
  }

  static trackPerformanceMetrics(req, res, duration) {
    const metrics = {
      endpoint: `${req.method} ${req.route?.path || req.originalUrl}`,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    };

    // Send to metrics collector (Prometheus, DataDog, etc.)
    this.sendToMetricsCollector(metrics);
  }

  static sendToMetricsCollector(metrics) {
    // Implementation for your metrics system
    // Example: Prometheus metrics
    if (global.prometheusRegistry) {
      global.httpRequestDuration.labels(
        metrics.endpoint,
        metrics.statusCode.toString()
      ).observe(metrics.duration);
    }
  }
}
```

### Error Tracking Service
```javascript
// services/errorTrackingService.js
const Sentry = require('@sentry/node');
const logger = require('./loggingService');

class ErrorTrackingService {
  constructor() {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 1.0,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: require('../app') })
        ]
      });
    }
  }

  captureException(error, context = {}) {
    // Log to our logging service
    logger.error('Exception captured', error, context);
    
    // Send to Sentry if configured
    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        Object.keys(context).forEach(key => {
          scope.setTag(key, context[key]);
        });
        
        Sentry.captureException(error);
      });
    }
  }

  captureMessage(message, level = 'info', context = {}) {
    logger[level](message, context);
    
    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        Object.keys(context).forEach(key => {
          scope.setTag(key, context[key]);
        });
        
        Sentry.captureMessage(message, level);
      });
    }
  }

  setUserContext(user) {
    if (process.env.SENTRY_DSN) {
      Sentry.configureScope((scope) => {
        scope.setUser({
          id: user.id,
          email: user.email,
          subscription: user.subscription
        });
      });
    }
  }
}

module.exports = new ErrorTrackingService();
```

### Analytics Service
```javascript
// services/analyticsService.js
class AnalyticsService {
  constructor() {
    this.redis = new Redis();
    this.logger = require('./loggingService');
  }

  async trackUserEvent(userId, event, properties = {}) {
    const eventData = {
      userId,
      event,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: properties.sessionId
    };

    // Log the event
    this.logger.logUserAction(userId, event, properties);

    // Store for real-time analytics
    await this.redis.lpush('analytics:events', JSON.stringify(eventData));
    await this.redis.expire('analytics:events', 86400); // 24 hours

    // Update user metrics
    await this.updateUserMetrics(userId, event);

    // Track business metrics
    await this.trackBusinessMetrics(event, properties);
  }

  async updateUserMetrics(userId, event) {
    const today = new Date().toISOString().split('T')[0];
    
    // Daily active users
    await this.redis.sadd(`analytics:dau:${today}`, userId);
    await this.redis.expire(`analytics:dau:${today}`, 86400 * 7); // Keep for 7 days

    // User event count
    await this.redis.hincrby(`analytics:user:${userId}`, 'totalEvents', 1);
    await this.redis.hincrby(`analytics:user:${userId}`, `${event}Count`, 1);
  }

  async trackBusinessMetrics(event, properties) {
    const today = new Date().toISOString().split('T')[0];

    switch (event) {
      case 'portfolio_created':
        await this.redis.hincrby(`analytics:business:${today}`, 'portfoliosCreated', 1);
        break;
      case 'transaction_added':
        await this.redis.hincrby(`analytics:business:${today}`, 'transactionsAdded', 1);
        if (properties.value) {
          await this.redis.hincrbyfloat(`analytics:business:${today}`, 'totalTransactionValue', properties.value);
        }
        break;
      case 'user_upgraded':
        await this.redis.hincrby(`analytics:business:${today}`, 'upgradesCount', 1);
        break;
    }
  }

  async getDashboardMetrics(timeframe = '7d') {
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 1;
    const metrics = {
      activeUsers: await this.getActiveUsers(days),
      portfolioMetrics: await this.getPortfolioMetrics(days),
      transactionMetrics: await this.getTransactionMetrics(days),
      userGrowth: await this.getUserGrowth(days)
    };

    return metrics;
  }

  async getActiveUsers(days) {
    const dates = this.getDateRange(days);
    const dauKeys = dates.map(date => `analytics:dau:${date}`);
    
    const totalUniqueUsers = await this.redis.sunion(...dauKeys);
    
    return {
      uniqueUsers: totalUniqueUsers.length,
      dailyBreakdown: await this.getDailyActiveUsers(dates)
    };
  }

  async getPortfolioMetrics(days) {
    const dates = this.getDateRange(days);
    let totalCreated = 0;
    
    for (const date of dates) {
      const created = await this.redis.hget(`analytics:business:${date}`, 'portfoliosCreated') || 0;
      totalCreated += parseInt(created);
    }

    return {
      totalCreated,
      averagePerDay: Math.round(totalCreated / days)
    };
  }

  getDateRange(days) {
    const dates = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }
}
```

### Health Check Service
```javascript
// services/healthCheckService.js
class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.registerDefaultChecks();
  }

  registerDefaultChecks() {
    this.register('database', this.checkDatabase);
    this.register('redis', this.checkRedis);
    this.register('external_apis', this.checkExternalAPIs);
    this.register('disk_space', this.checkDiskSpace);
    this.register('memory', this.checkMemoryUsage);
  }

  register(name, checkFunction) {
    this.checks.set(name, checkFunction);
  }

  async runHealthChecks() {
    const results = {};
    const startTime = Date.now();

    for (const [name, checkFn] of this.checks) {
      try {
        const checkStart = Date.now();
        const result = await Promise.race([
          checkFn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        
        results[name] = {
          status: 'healthy',
          responseTime: Date.now() - checkStart,
          details: result
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          responseTime: Date.now() - checkStart
        };
      }
    }

    const overallStatus = Object.values(results).every(r => r.status === 'healthy') 
      ? 'healthy' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      checks: results
    };
  }

  async checkDatabase() {
    const db = require('../models');
    await db.sequelize.authenticate();
    return { connection: 'active' };
  }

  async checkRedis() {
    const redis = new Redis();
    await redis.ping();
    return { connection: 'active' };
  }

  async checkExternalAPIs() {
    // Check key external services
    const results = {};
    
    try {
      const binanceResponse = await fetch('https://api.binance.com/api/v3/ping');
      results.binance = binanceResponse.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      results.binance = 'unhealthy';
    }

    return results;
  }

  async checkDiskSpace() {
    const fs = require('fs').promises;
    const stats = await fs.statfs('.');
    const freeSpace = stats.bavail * stats.bsize;
    const totalSpace = stats.blocks * stats.bsize;
    const usagePercent = ((totalSpace - freeSpace) / totalSpace) * 100;

    return {
      freeSpaceGB: Math.round(freeSpace / (1024**3)),
      totalSpaceGB: Math.round(totalSpace / (1024**3)),
      usagePercent: Math.round(usagePercent)
    };
  }

  async checkMemoryUsage() {
    const used = process.memoryUsage();
    
    return {
      heapUsedMB: Math.round(used.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(used.heapTotal / 1024 / 1024),
      externalMB: Math.round(used.external / 1024 / 1024),
      rssMB: Math.round(used.rss / 1024 / 1024)
    };
  }
}
```

## Required Technologies
- **Winston** - Logging library
- **Elasticsearch** - Log aggregation and search
- **Sentry** - Error tracking and monitoring
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards
- **Redis** - Real-time analytics storage

## Testing Requirements

### Unit Tests
```javascript
describe('LoggingService', () => {
  test('should log user actions correctly', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    
    logger.logUserAction(123, 'portfolio_viewed', { portfolioId: 456 });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('User action')
    );
  });

  test('should enhance metadata with request ID', () => {
    const metadata = logger.enhanceMetadata({ test: 'value' });
    
    expect(metadata).toHaveProperty('requestId');
    expect(metadata).toHaveProperty('timestamp');
    expect(metadata.test).toBe('value');
  });
});
```

### Integration Tests
```javascript
describe('Health Checks', () => {
  test('should return healthy status when all checks pass', async () => {
    const healthService = new HealthCheckService();
    const result = await healthService.runHealthChecks();
    
    expect(result.status).toBe('healthy');
    expect(result.checks.database.status).toBe('healthy');
    expect(result.checks.redis.status).toBe('healthy');
  });
});
```

## Dependencies
- CP-008: Caching Layer and Performance Optimization
- CP-009: Background Job Processing and Queues
- CP-001: Database Design and Schema

## Monitoring Dashboards

### System Health Dashboard
- Response time trends
- Error rate monitoring
- Database performance
- Cache hit ratios
- Queue depths

### Business Metrics Dashboard
- Daily/Monthly active users
- Portfolio creation trends
- Transaction volumes
- Revenue metrics
- User engagement

### Security Dashboard
- Failed login attempts
- Suspicious IP addresses
- API abuse patterns
- Security alert trends

## Alerting Rules
```yaml
# alerts.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    duration: 5m
    notification: slack
    
  - name: SlowResponse
    condition: avg_response_time > 2s
    duration: 3m
    notification: email
    
  - name: DatabaseDown
    condition: database_health != "healthy"
    duration: 1m
    notification: pagerduty
```

## Definition of Done
- [ ] Structured logging implemented across application
- [ ] Error tracking and monitoring system active
- [ ] Performance monitoring with bottleneck detection
- [ ] User analytics and behavior tracking functional
- [ ] Business metrics dashboard deployed
- [ ] Real-time health checks implemented
- [ ] Log aggregation and search capabilities working
- [ ] Custom alerting rules configured
- [ ] Security audit logging compliance ready
- [ ] All monitoring tests passing
- [ ] Documentation with monitoring runbooks
- [ ] Production deployment with full observability

## Estimated Time
**Beginner Developer**: 8-10 days
**Intermediate Developer**: 5-7 days
**Senior Developer**: 4-5 days

## Required Skills
- Logging frameworks and structured logging
- Application Performance Monitoring (APM)
- Error tracking and alerting systems
- Analytics and metrics collection
- Dashboard creation and visualization
- Database and system monitoring
- Security logging and compliance
- DevOps and observability practices

## Related Issues
- CP-008: Caching Layer and Performance Optimization
- CP-009: Background Job Processing and Queues
- CP-012: API Rate Limiting and Throttling
- CP-014: Data Backup and Recovery Systems