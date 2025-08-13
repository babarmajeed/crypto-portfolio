import { Router } from 'express';
import { authMiddleware } from '@/middleware/authMiddleware';
import { rbacMiddleware } from '@/middleware/rbacMiddleware';
import { healthCheckService } from '@/services/healthCheckService';
import { analyticsService } from '@/services/analyticsService';
import { metricsCollector } from '@/monitoring/metricsCollector';
import { alertManager } from '@/monitoring/alertManager';
import { performanceMiddleware } from '@/middleware/performanceMiddleware';
import { loggingService } from '@/services/loggingService';

const router = Router();

/**
 * @swagger
 * /api/v1/monitoring/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overall:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 checks:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Health check failed
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.runAllChecks();
    
    // Set appropriate status code based on health
    const statusCode = healthStatus.overall === 'healthy' ? 200 :
                      healthStatus.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    loggingService.logError('Health check endpoint failed', error as Error);
    res.status(500).json({
      overall: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date()
    });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/health/{checkName}:
 *   get:
 *     summary: Get specific health check status
 *     tags: [Monitoring]
 *     parameters:
 *       - in: path
 *         name: checkName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Specific health check result
 *       404:
 *         description: Health check not found
 */
router.get('/health/:checkName', async (req, res) => {
  try {
    const { checkName } = req.params;
    const result = await healthCheckService.runCheck(checkName);
    
    if (!result) {
      return res.status(404).json({ error: 'Health check not found' });
    }
    
    const statusCode = result.status === 'healthy' ? 200 :
                      result.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(result);
  } catch (error) {
    loggingService.logError(`Health check ${req.params.checkName} failed`, error as Error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Prometheus metrics in text format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsCollector.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    loggingService.logError('Failed to get metrics', error as Error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/metrics/json:
 *   get:
 *     summary: Get metrics in JSON format
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics in JSON format
 */
router.get('/metrics/json', authMiddleware, rbacMiddleware(['admin']), async (req, res) => {
  try {
    const metrics = await metricsCollector.getMetricsJson();
    res.json(metrics);
  } catch (error) {
    loggingService.logError('Failed to get metrics JSON', error as Error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/performance:
 *   get:
 *     summary: Get performance summary
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeWindow
 *         schema:
 *           type: integer
 *           default: 300000
 *         description: Time window in milliseconds
 *     responses:
 *       200:
 *         description: Performance summary
 */
router.get('/performance', authMiddleware, rbacMiddleware(['admin']), (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 300000;
    const performanceSummary = performanceMiddleware.getPerformanceSummary(timeWindow);
    
    res.json({
      timeWindow,
      summary: performanceSummary,
      activeRequests: performanceMiddleware.getActiveRequestsCount(),
      timestamp: new Date()
    });
  } catch (error) {
    loggingService.logError('Failed to get performance summary', error as Error);
    res.status(500).json({ error: 'Failed to get performance summary' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/analytics/realtime:
 *   get:
 *     summary: Get real-time analytics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time analytics data
 */
router.get('/analytics/realtime', authMiddleware, rbacMiddleware(['admin']), async (req, res) => {
  try {
    const realtimeData = await analyticsService.getRealTimeAnalytics();
    res.json(realtimeData);
  } catch (error) {
    loggingService.logError('Failed to get real-time analytics', error as Error);
    res.status(500).json({ error: 'Failed to get analytics data' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/analytics/kpis:
 *   get:
 *     summary: Get KPI dashboard metrics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPI metrics
 */
router.get('/analytics/kpis', authMiddleware, rbacMiddleware(['admin']), async (req, res) => {
  try {
    const kpis = await analyticsService.calculateKPIs();
    res.json(kpis);
  } catch (error) {
    loggingService.logError('Failed to calculate KPIs', error as Error);
    res.status(500).json({ error: 'Failed to calculate KPIs' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/analytics/trends/{metricName}:
 *   get:
 *     summary: Get trend data for a metric
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: metricName
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *       - in: query
 *         name: points
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Trend data
 */
router.get('/analytics/trends/:metricName', authMiddleware, rbacMiddleware(['admin']), async (req, res) => {
  try {
    const { metricName } = req.params;
    const period = (req.query.period as 'hour' | 'day' | 'week' | 'month') || 'day';
    const points = parseInt(req.query.points as string) || 30;
    
    const trendData = await analyticsService.getTrendData(metricName, period, points);
    res.json(trendData);
  } catch (error) {
    loggingService.logError('Failed to get trend data', error as Error);
    res.status(500).json({ error: 'Failed to get trend data' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts:
 *   get:
 *     summary: Get alert information
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert information
 */
router.get('/alerts', authMiddleware, rbacMiddleware(['admin']), (req, res) => {
  try {
    const statistics = alertManager.getAlertStatistics();
    const activeAlerts = alertManager.getActiveAlerts();
    
    res.json({
      statistics,
      activeAlerts,
      timestamp: new Date()
    });
  } catch (error) {
    loggingService.logError('Failed to get alert information', error as Error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts/rules:
 *   get:
 *     summary: Get all alert rules
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of alert rules
 */
router.get('/alerts/rules', authMiddleware, rbacMiddleware(['admin']), (req, res) => {
  try {
    const rules = alertManager.getAlertRules();
    res.json(rules);
  } catch (error) {
    loggingService.logError('Failed to get alert rules', error as Error);
    res.status(500).json({ error: 'Failed to get alert rules' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts/{alertId}/acknowledge:
 *   post:
 *     summary: Acknowledge an alert
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert acknowledged
 *       404:
 *         description: Alert not found
 */
router.post('/alerts/:alertId/acknowledge', authMiddleware, rbacMiddleware(['admin']), (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = (req as any).user?.id || 'unknown';
    
    const acknowledged = alertManager.acknowledgeAlert(alertId, userId);
    
    if (acknowledged) {
      res.json({ message: 'Alert acknowledged', alertId, acknowledgedBy: userId });
    } else {
      res.status(404).json({ error: 'Alert not found' });
    }
  } catch (error) {
    loggingService.logError('Failed to acknowledge alert', error as Error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/dashboard:
 *   get:
 *     summary: Get comprehensive monitoring dashboard data
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', authMiddleware, rbacMiddleware(['admin']), async (req, res) => {
  try {
    // Gather data from all monitoring services
    const [healthStatus, realtimeAnalytics, performanceSummary, alertStatistics, kpis] = await Promise.allSettled([
      healthCheckService.runAllChecks(),
      analyticsService.getRealTimeAnalytics(),
      performanceMiddleware.getPerformanceSummary(),
      alertManager.getAlertStatistics(),
      analyticsService.calculateKPIs()
    ]);

    const dashboardData = {
      health: healthStatus.status === 'fulfilled' ? healthStatus.value : { error: 'Health check failed' },
      analytics: realtimeAnalytics.status === 'fulfilled' ? realtimeAnalytics.value : { error: 'Analytics failed' },
      performance: performanceSummary.status === 'fulfilled' ? performanceSummary.value : { error: 'Performance data failed' },
      alerts: alertStatistics.status === 'fulfilled' ? alertStatistics.value : { error: 'Alert data failed' },
      kpis: kpis.status === 'fulfilled' ? kpis.value : { error: 'KPI calculation failed' },
      timestamp: new Date(),
      systemInfo: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV
      }
    };

    res.json(dashboardData);
  } catch (error) {
    loggingService.logError('Failed to get dashboard data', error as Error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/status:
 *   get:
 *     summary: Get simplified system status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: System status
 */
router.get('/status', async (req, res) => {
  try {
    const healthSummary = healthCheckService.getHealthSummary();
    const performanceSummary = performanceMiddleware.getPerformanceSummary();
    
    res.json({
      status: healthSummary.status,
      uptime: process.uptime(),
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        healthy: healthSummary.healthyChecks,
        total: healthSummary.totalChecks
      },
      performance: {
        responseTime: performanceSummary.averageResponseTime,
        errorRate: performanceSummary.errorRate,
        activeRequests: performanceMiddleware.getActiveRequestsCount()
      }
    });
  } catch (error) {
    loggingService.logError('Failed to get system status', error as Error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get status',
      timestamp: new Date()
    });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/user/{userId}/analytics:
 *   get:
 *     summary: Get user-specific analytics
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: 7d
 *     responses:
 *       200:
 *         description: User analytics
 */
router.get('/user/:userId/analytics', authMiddleware, rbacMiddleware(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const period = (req.query.period as string) || '7d';
    
    const userAnalytics = await analyticsService.getUserAnalytics(userId, period);
    res.json({
      userId,
      period,
      analytics: userAnalytics,
      timestamp: new Date()
    });
  } catch (error) {
    loggingService.logError('Failed to get user analytics', error as Error);
    res.status(500).json({ error: 'Failed to get user analytics' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/logs/query:
 *   post:
 *     summary: Query logs (if Elasticsearch is enabled)
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: object
 *               fromDate:
 *                 type: string
 *                 format: date-time
 *               toDate:
 *                 type: string
 *                 format: date-time
 *               size:
 *                 type: integer
 *                 default: 100
 *     responses:
 *       200:
 *         description: Log query results
 *       501:
 *         description: Log querying not implemented
 */
router.post('/logs/query', authMiddleware, rbacMiddleware(['admin']), async (req, res) => {
  try {
    const { query, fromDate, toDate, size } = req.body;
    
    const logs = await loggingService.queryLogs(
      query,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined,
      size
    );
    
    res.json({
      query,
      results: logs,
      count: logs.length,
      timestamp: new Date()
    });
  } catch (error) {
    loggingService.logError('Failed to query logs', error as Error);
    res.status(501).json({ error: 'Log querying not implemented or failed' });
  }
});

export default router;