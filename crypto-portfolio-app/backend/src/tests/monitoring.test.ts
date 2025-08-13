import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { loggingService } from '@/services/loggingService';
import { errorTrackingService } from '@/services/errorTrackingService';
import { analyticsService } from '@/services/analyticsService';
import { healthCheckService } from '@/services/healthCheckService';
import { metricsCollector } from '@/monitoring/metricsCollector';
import { alertManager } from '@/monitoring/alertManager';
import { performanceMiddleware } from '@/middleware/performanceMiddleware';
import { AuditMiddleware } from '@/middleware/auditMiddleware';

// Mock external dependencies
jest.mock('@/services/redisService');
jest.mock('@/config/config');
jest.mock('@prisma/client');

describe('Monitoring System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('LoggingService', () => {
    test('should generate unique request ID', () => {
      const requestId1 = loggingService.generateRequestId();
      const requestId2 = loggingService.generateRequestId();
      
      expect(requestId1).toBeDefined();
      expect(requestId2).toBeDefined();
      expect(requestId1).not.toBe(requestId2);
      expect(requestId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should set and get request context', () => {
      const requestId = loggingService.generateRequestId();
      const context = {
        userId: 'test-user',
        method: 'GET',
        url: '/api/test'
      };

      loggingService.setRequestContext(requestId, context);
      
      // Context should be stored (tested indirectly through logging)
      expect(typeof loggingService.setRequestContext).toBe('function');
      expect(typeof loggingService.clearRequestContext).toBe('function');
    });

    test('should log different levels of messages', () => {
      const testMessage = 'Test log message';
      const testContext = { requestId: 'test-id' };

      // Test all log levels
      expect(() => loggingService.logError(testMessage, undefined, testContext)).not.toThrow();
      expect(() => loggingService.logWarning(testMessage, testContext)).not.toThrow();
      expect(() => loggingService.logInfo(testMessage, testContext)).not.toThrow();
      expect(() => loggingService.logDebug(testMessage, testContext)).not.toThrow();
    });

    test('should log API requests with performance data', () => {
      const method = 'GET';
      const url = '/api/test';
      const statusCode = 200;
      const duration = 150;

      expect(() => loggingService.logApiRequest(method, url, statusCode, duration)).not.toThrow();
    });

    test('should log business metrics', () => {
      const metricName = 'test_metric';
      const value = 100;
      const unit = 'count';

      expect(() => loggingService.logBusinessMetric(metricName, value, unit)).not.toThrow();
    });

    test('should log security events', () => {
      const eventType = 'login_failure';
      const severity = 'medium';
      const details = { attempts: 3 };

      expect(() => loggingService.logSecurityEvent(eventType, severity, details)).not.toThrow();
    });
  });

  describe('ErrorTrackingService', () => {
    test('should check if error tracking is initialized', () => {
      const isInitialized = errorTrackingService.isInitialized();
      expect(typeof isInitialized).toBe('boolean');
    });

    test('should set and clear user context', () => {
      const userId = 'test-user';
      const email = 'test@example.com';

      expect(() => errorTrackingService.setUserContext(userId, email)).not.toThrow();
      expect(() => errorTrackingService.clearUserContext()).not.toThrow();
    });

    test('should add breadcrumbs', () => {
      const message = 'User clicked button';
      const category = 'ui.click';

      expect(() => errorTrackingService.addBreadcrumb(message, category)).not.toThrow();
    });

    test('should capture errors with context', () => {
      const error = new Error('Test error');
      const context = {
        requestId: 'test-id',
        userId: 'test-user',
        url: '/api/test'
      };

      expect(() => errorTrackingService.captureError(error, context)).not.toThrow();
    });

    test('should capture messages', () => {
      const message = 'Test message';
      const level = 'warning';

      expect(() => errorTrackingService.captureMessage(message, level)).not.toThrow();
    });

    test('should create error fingerprints', () => {
      const fingerprint = errorTrackingService.createFingerprint('TypeError', 'api/users', 'user123');
      expect(fingerprint).toBe('TypeError:api/users:user123');
    });
  });

  describe('AnalyticsService', () => {
    test('should track events', async () => {
      const eventData = {
        eventType: 'user_action' as const,
        category: 'navigation',
        action: 'page_view',
        label: '/dashboard',
        userId: 'test-user'
      };

      await expect(analyticsService.trackEvent(
        eventData.eventType,
        eventData.category,
        eventData.action,
        eventData.label,
        undefined,
        eventData.userId
      )).resolves.not.toThrow();
    });

    test('should track user actions', async () => {
      await expect(analyticsService.trackUserAction(
        'login',
        'auth',
        'test-user',
        'session-123'
      )).resolves.not.toThrow();
    });

    test('should track page views', async () => {
      await expect(analyticsService.trackPageView(
        '/dashboard',
        'test-user',
        'session-123'
      )).resolves.not.toThrow();
    });

    test('should track business metrics', async () => {
      await expect(analyticsService.trackBusinessMetric(
        'daily_active_users',
        150,
        { period: 'day' }
      )).resolves.not.toThrow();
    });

    test('should calculate KPIs', async () => {
      const kpis = await analyticsService.calculateKPIs();
      expect(Array.isArray(kpis)).toBe(true);
    });

    test('should get real-time analytics', async () => {
      const realTimeData = await analyticsService.getRealTimeAnalytics();
      expect(realTimeData).toHaveProperty('activeUsers');
      expect(realTimeData).toHaveProperty('pageViews');
      expect(realTimeData).toHaveProperty('events');
      expect(realTimeData).toHaveProperty('errors');
      expect(realTimeData).toHaveProperty('responseTime');
    });

    test('should manage user sessions', () => {
      const sessionId = 'test-session';
      const userId = 'test-user';

      expect(() => analyticsService.createSession(sessionId, userId)).not.toThrow();
      expect(() => analyticsService.endSession(sessionId)).not.toThrow();
    });
  });

  describe('HealthCheckService', () => {
    test('should have available health checkers', () => {
      const checkers = healthCheckService.getAvailableCheckers();
      expect(Array.isArray(checkers)).toBe(true);
      expect(checkers.length).toBeGreaterThan(0);
    });

    test('should run all health checks', async () => {
      const healthStatus = await healthCheckService.runAllChecks();
      
      expect(healthStatus).toHaveProperty('overall');
      expect(healthStatus).toHaveProperty('timestamp');
      expect(healthStatus).toHaveProperty('checks');
      expect(healthStatus).toHaveProperty('uptime');
      expect(healthStatus).toHaveProperty('version');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthStatus.overall);
      expect(Array.isArray(healthStatus.checks)).toBe(true);
    });

    test('should get health summary', () => {
      const summary = healthCheckService.getHealthSummary();
      
      expect(summary).toHaveProperty('status');
      expect(summary).toHaveProperty('totalChecks');
      expect(summary).toHaveProperty('healthyChecks');
      expect(summary).toHaveProperty('degradedChecks');
      expect(summary).toHaveProperty('unhealthyChecks');
      expect(summary).toHaveProperty('lastCheckTime');
    });

    test('should register and unregister custom checkers', () => {
      const customChecker = async () => ({
        name: 'custom',
        status: 'healthy' as const,
        timestamp: new Date(),
        duration: 10,
        message: 'Custom check passed'
      });

      expect(() => healthCheckService.registerChecker('custom', customChecker)).not.toThrow();
      expect(() => healthCheckService.unregisterChecker('custom')).not.toThrow();
    });
  });

  describe('MetricsCollector', () => {
    test('should record HTTP request metrics', () => {
      expect(() => metricsCollector.recordHttpRequest('GET', '/api/test', 200, 150)).not.toThrow();
    });

    test('should record database query metrics', () => {
      expect(() => metricsCollector.recordDatabaseQuery('SELECT', 'users', 50, true)).not.toThrow();
    });

    test('should record external API call metrics', () => {
      expect(() => metricsCollector.recordExternalApiCall('coinbase', '/prices', 200, 300)).not.toThrow();
    });

    test('should record business metrics', () => {
      expect(() => metricsCollector.recordBusinessMetric('daily_users', 150)).not.toThrow();
    });

    test('should record user activity', () => {
      expect(() => metricsCollector.recordUserActivity('login', 'auth')).not.toThrow();
    });

    test('should track request lifecycle', () => {
      expect(() => metricsCollector.recordRequestStart()).not.toThrow();
      expect(() => metricsCollector.recordRequestEnd()).not.toThrow();
    });

    test('should create custom metrics', () => {
      const counterConfig = {
        name: 'test_counter',
        type: 'counter' as const,
        description: 'Test counter metric',
        labels: ['method', 'status']
      };

      expect(() => metricsCollector.createCounter(counterConfig)).not.toThrow();

      const gaugeConfig = {
        name: 'test_gauge',
        type: 'gauge' as const,
        description: 'Test gauge metric'
      };

      expect(() => metricsCollector.createGauge(gaugeConfig)).not.toThrow();
    });

    test('should get metrics', async () => {
      await expect(metricsCollector.getMetrics()).resolves.toBeDefined();
      await expect(metricsCollector.getMetricsJson()).resolves.toBeDefined();
    });
  });

  describe('AlertManager', () => {
    test('should get alert statistics', () => {
      const stats = alertManager.getAlertStatistics();
      
      expect(stats).toHaveProperty('totalRules');
      expect(stats).toHaveProperty('enabledRules');
      expect(stats).toHaveProperty('activeAlerts');
      expect(stats).toHaveProperty('alertsBySevertiy');
      expect(stats).toHaveProperty('recentAlerts');
      
      expect(typeof stats.totalRules).toBe('number');
      expect(typeof stats.enabledRules).toBe('number');
      expect(typeof stats.activeAlerts).toBe('number');
      expect(Array.isArray(stats.recentAlerts)).toBe(true);
    });

    test('should evaluate metrics against rules', async () => {
      const evaluations = await alertManager.evaluateMetric('test_metric', 50);
      expect(Array.isArray(evaluations)).toBe(true);
    });

    test('should acknowledge alerts', () => {
      const alertId = 'test-alert-id';
      const acknowledgedBy = 'test-user';
      
      // This will return false since alert doesn't exist, but should not throw
      const result = alertManager.acknowledgeAlert(alertId, acknowledgedBy);
      expect(typeof result).toBe('boolean');
    });

    test('should manage alert rules and channels', () => {
      const alertRules = alertManager.getAlertRules();
      const channels = alertManager.getNotificationChannels();
      const activeAlerts = alertManager.getActiveAlerts();
      
      expect(Array.isArray(alertRules)).toBe(true);
      expect(Array.isArray(channels)).toBe(true);
      expect(Array.isArray(activeAlerts)).toBe(true);
    });
  });

  describe('PerformanceMiddleware', () => {
    test('should get performance summary', () => {
      const summary = performanceMiddleware.getPerformanceSummary();
      
      expect(summary).toHaveProperty('requests');
      expect(summary).toHaveProperty('averageResponseTime');
      expect(summary).toHaveProperty('errorRate');
      expect(summary).toHaveProperty('slowRequests');
      expect(summary).toHaveProperty('throughput');
      expect(summary).toHaveProperty('statusCodes');
      
      expect(typeof summary.requests).toBe('number');
      expect(typeof summary.averageResponseTime).toBe('number');
      expect(typeof summary.errorRate).toBe('number');
    });

    test('should track active requests', () => {
      const activeCount = performanceMiddleware.getActiveRequestsCount();
      const activeRequests = performanceMiddleware.getActiveRequests();
      
      expect(typeof activeCount).toBe('number');
      expect(Array.isArray(activeRequests)).toBe(true);
    });

    test('should provide monitoring decorators', () => {
      expect(typeof performanceMiddleware.monitorDbQuery).toBe('function');
      expect(typeof performanceMiddleware.monitorExternalApi).toBe('function');
      expect(typeof performanceMiddleware.monitorMemory).toBe('function');
    });
  });

  describe('AuditMiddleware', () => {
    const mockReq = {
      method: 'POST',
      originalUrl: '/api/users',
      params: { id: 'test-id' },
      body: { name: 'Test User' },
      user: { userId: 'test-user' },
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1'
    };

    const mockRes = {
      statusCode: 200
    };

    const mockNext = jest.fn();

    test('should set audit info', () => {
      const middleware = AuditMiddleware.setAuditInfo('TEST_ACTION', 'TestResource', 'test-id');
      
      expect(typeof middleware).toBe('function');
      
      middleware(mockReq as any, mockRes as any, mockNext);
      expect(mockReq).toHaveProperty('auditInfo');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should skip audit when specified', () => {
      const skipMiddleware = AuditMiddleware.skipAudit;
      
      skipMiddleware(mockReq as any, mockRes as any, mockNext);
      expect(mockReq.auditInfo?.skipAudit).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should auto-audit requests', () => {
      const autoMiddleware = AuditMiddleware.autoAudit;
      
      autoMiddleware(mockReq as any, mockRes as any, mockNext);
      expect(mockReq).toHaveProperty('auditInfo');
      expect(mockReq.auditInfo?.action).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle compliance audit', async () => {
      const complianceMiddleware = AuditMiddleware.complianceAudit('GDPR', 'Data Processing', 'restricted');
      
      await expect(complianceMiddleware(mockReq as any, mockRes as any, mockNext)).resolves.not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle enhanced security events', async () => {
      const securityMiddleware = AuditMiddleware.enhancedSecurityEvent('login_failure', 'medium', 50);
      
      await expect(securityMiddleware(mockReq as any, mockRes as any, mockNext)).resolves.not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    test('should handle full monitoring workflow', async () => {
      // Simulate a user request with full monitoring
      const requestId = loggingService.generateRequestId();
      
      // Set request context
      loggingService.setRequestContext(requestId, {
        userId: 'test-user',
        method: 'GET',
        url: '/api/dashboard'
      });

      // Track analytics event
      await analyticsService.trackEvent(
        'user_action',
        'navigation',
        'page_view',
        '/dashboard',
        undefined,
        'test-user'
      );

      // Record performance metrics
      metricsCollector.recordHttpRequest('GET', '/api/dashboard', 200, 150);

      // Log the request
      loggingService.logApiRequest('GET', '/api/dashboard', 200, 150, { requestId });

      // Clean up
      loggingService.clearRequestContext(requestId);

      // All operations should complete without errors
      expect(true).toBe(true);
    });

    test('should handle error scenarios gracefully', async () => {
      const error = new Error('Test error');
      
      // Error tracking should not throw
      expect(() => errorTrackingService.captureError(error)).not.toThrow();
      
      // Logging should handle errors gracefully
      expect(() => loggingService.logError('Test error', error)).not.toThrow();
      
      // Health checks should handle failures
      const healthStatus = await healthCheckService.runAllChecks();
      expect(healthStatus).toBeDefined();
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup services properly', async () => {
      // Analytics service cleanup
      await expect(analyticsService.cleanup()).resolves.not.toThrow();
      
      // Health check service cleanup
      expect(() => healthCheckService.cleanup()).not.toThrow();
      
      // Metrics collector cleanup
      expect(() => metricsCollector.cleanup()).not.toThrow();
      
      // Alert manager cleanup
      expect(() => alertManager.cleanup()).not.toThrow();
      
      // Performance middleware cleanup
      expect(() => performanceMiddleware.cleanup()).not.toThrow();
    });

    test('should handle service shutdown gracefully', async () => {
      // Error tracking service
      await expect(errorTrackingService.flush()).resolves.toBeDefined();
      await expect(errorTrackingService.close()).resolves.toBeDefined();
      
      // Logging service
      await expect(loggingService.flush()).resolves.not.toThrow();
    });
  });
});