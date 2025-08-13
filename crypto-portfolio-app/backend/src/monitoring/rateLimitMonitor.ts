import { EventEmitter } from 'events';
import { redisService } from '../services/redisService';
import { logger } from '../utils/logger';
import {
  RateLimitMonitoringData,
  RateLimitAlert,
  AlertThreshold,
  RateLimitAnalytics,
  RateLimitMetrics,
} from '../types/rateLimit.types';
import { ALERT_THRESHOLDS, REDIS_KEYS, DEFAULT_CONFIG } from '../config/rateLimitConfig';

interface AlertStats {
  windowStart: number;
  blockedRequests: number;
  totalRequests: number;
  uniqueIdentifiers: Set<string>;
  errorCount: number;
}

export class RateLimitMonitor extends EventEmitter {
  private alertStats: Map<string, AlertStats> = new Map();
  private activeAlerts: Map<string, RateLimitAlert> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private alertCheckInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    try {
      this.isMonitoring = true;
      
      // Start periodic alert checking
      this.alertCheckInterval = setInterval(async () => {
        await this.checkAlertThresholds();
      }, 30000); // Check every 30 seconds

      // Start metrics collection
      this.monitoringInterval = setInterval(async () => {
        await this.collectMetrics();
      }, 60000); // Collect metrics every minute

      // Initialize alert stats
      for (const threshold of ALERT_THRESHOLDS) {
        if (threshold.enabled) {
          this.alertStats.set(threshold.name, {
            windowStart: Date.now(),
            blockedRequests: 0,
            totalRequests: 0,
            uniqueIdentifiers: new Set(),
            errorCount: 0,
          });
        }
      }

      logger.info('Rate limit monitoring started');
    } catch (error) {
      logger.error('Failed to start rate limit monitoring:', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Rate limit monitoring stopped');
  }

  async recordRequest(data: RateLimitMonitoringData): Promise<void> {
    try {
      // Store monitoring data in Redis
      const key = `${REDIS_KEYS.MONITORING}:${Date.now()}:${Math.random()}`;
      await redisService.set(key, data, { 
        ttl: Math.floor(DEFAULT_CONFIG.monitoringRetention / 1000) 
      });

      // Update alert statistics
      this.updateAlertStats(data);

      // Emit monitoring event
      this.emit('requestRecorded', data);

      // Check for immediate alerts if request was blocked
      if (data.blocked) {
        await this.checkImmediateAlerts(data);
      }
    } catch (error) {
      logger.error('Failed to record rate limit request:', error);
    }
  }

  private updateAlertStats(data: RateLimitMonitoringData): void {
    const now = Date.now();

    for (const [alertName, stats] of this.alertStats.entries()) {
      const threshold = ALERT_THRESHOLDS.find(t => t.name === alertName);
      if (!threshold || !threshold.enabled) continue;

      // Reset window if needed
      if (now - stats.windowStart > threshold.window * 1000) {
        stats.windowStart = now;
        stats.blockedRequests = 0;
        stats.totalRequests = 0;
        stats.uniqueIdentifiers.clear();
        stats.errorCount = 0;
      }

      // Update stats
      stats.totalRequests++;
      stats.uniqueIdentifiers.add(data.identifier);

      if (data.blocked) {
        stats.blockedRequests++;
      }

      if (data.responseTime > 5000) { // Consider slow responses as errors
        stats.errorCount++;
      }
    }
  }

  private async checkImmediateAlerts(data: RateLimitMonitoringData): Promise<void> {
    // Check for suspicious patterns that need immediate attention
    const suspiciousPatterns = [
      {
        name: 'Rapid Fire Requests',
        condition: () => this.detectRapidFireRequests(data.identifier),
        severity: 'high' as const,
      },
      {
        name: 'Distributed Attack',
        condition: () => this.detectDistributedAttack(),
        severity: 'critical' as const,
      },
      {
        name: 'Premium User Blocked',
        condition: () => data.userTier === 'PREMIUM' && data.blocked,
        severity: 'medium' as const,
      },
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.condition()) {
        await this.createAlert({
          type: pattern.name,
          message: `${pattern.name} detected for ${data.identifier}`,
          severity: pattern.severity,
          data: { monitoringData: data },
        });
      }
    }
  }

  private async detectRapidFireRequests(identifier: string): Promise<boolean> {
    try {
      // Check if this identifier has made too many requests in the last minute
      const keys = await redisService.keys(`${REDIS_KEYS.MONITORING}:*`);
      const recentKeys = keys.filter(key => {
        const timestamp = parseInt(key.split(':')[2]);
        return Date.now() - timestamp < 60000; // Last minute
      });

      let requestCount = 0;
      for (const key of recentKeys) {
        const data = await redisService.get<RateLimitMonitoringData>(key);
        if (data && data.identifier === identifier) {
          requestCount++;
        }
      }

      return requestCount > 100; // More than 100 requests per minute
    } catch (error) {
      logger.error('Error detecting rapid fire requests:', error);
      return false;
    }
  }

  private async detectDistributedAttack(): Promise<boolean> {
    try {
      // Check for coordinated attacks from multiple IPs
      const now = Date.now();
      const fiveMinutesAgo = now - 300000;
      
      const keys = await redisService.keys(`${REDIS_KEYS.MONITORING}:*`);
      const recentKeys = keys.filter(key => {
        const timestamp = parseInt(key.split(':')[2]);
        return timestamp > fiveMinutesAgo;
      });

      const identifierCounts = new Map<string, number>();
      let totalBlocked = 0;

      for (const key of recentKeys) {
        const data = await redisService.get<RateLimitMonitoringData>(key);
        if (data) {
          const count = identifierCounts.get(data.identifier) || 0;
          identifierCounts.set(data.identifier, count + 1);
          
          if (data.blocked) {
            totalBlocked++;
          }
        }
      }

      // Consider it a distributed attack if:
      // 1. More than 10 different identifiers are blocked
      // 2. More than 50% of requests are blocked
      const blockedIdentifiers = Array.from(identifierCounts.entries())
        .filter(([_, count]) => count > 10).length;

      const totalRequests = Array.from(identifierCounts.values())
        .reduce((sum, count) => sum + count, 0);

      return blockedIdentifiers > 10 && (totalBlocked / totalRequests) > 0.5;
    } catch (error) {
      logger.error('Error detecting distributed attack:', error);
      return false;
    }
  }

  private async checkAlertThresholds(): Promise<void> {
    for (const threshold of ALERT_THRESHOLDS) {
      if (!threshold.enabled) continue;

      const stats = this.alertStats.get(threshold.name);
      if (!stats) continue;

      let shouldAlert = false;
      let alertMessage = '';

      switch (threshold.metric) {
        case 'blocked_requests':
          const blockRate = stats.totalRequests > 0 
            ? (stats.blockedRequests / stats.totalRequests) * 100 
            : 0;
          
          if (blockRate > threshold.threshold) {
            shouldAlert = true;
            alertMessage = `Blocked request rate is ${blockRate.toFixed(1)}% (threshold: ${threshold.threshold}%)`;
          }
          break;

        case 'high_usage':
          const requestRate = stats.totalRequests / (threshold.window / 60); // requests per minute
          
          if (requestRate > threshold.threshold) {
            shouldAlert = true;
            alertMessage = `Request rate is ${requestRate.toFixed(1)}/min (threshold: ${threshold.threshold}/min)`;
          }
          break;

        case 'error_rate':
          const errorRate = stats.totalRequests > 0 
            ? (stats.errorCount / stats.totalRequests) * 100 
            : 0;
          
          if (errorRate > threshold.threshold) {
            shouldAlert = true;
            alertMessage = `Error rate is ${errorRate.toFixed(1)}% (threshold: ${threshold.threshold}%)`;
          }
          break;
      }

      if (shouldAlert) {
        await this.createAlert({
          type: threshold.name,
          message: alertMessage,
          severity: this.getSeverityForThreshold(threshold),
          data: { 
            threshold, 
            stats: { ...stats, uniqueIdentifiers: stats.uniqueIdentifiers.size } 
          },
        });
      }
    }
  }

  private getSeverityForThreshold(threshold: AlertThreshold): 'low' | 'medium' | 'high' | 'critical' {
    if (threshold.metric === 'blocked_requests' && threshold.threshold > 75) return 'critical';
    if (threshold.metric === 'high_usage' && threshold.threshold > 5000) return 'high';
    if (threshold.metric === 'error_rate' && threshold.threshold > 50) return 'critical';
    
    return 'medium';
  }

  private async createAlert(alertData: {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    data: any;
  }): Promise<void> {
    const alertId = `${alertData.type}_${Date.now()}`;
    
    // Check if similar alert is already active
    const existingAlert = Array.from(this.activeAlerts.values())
      .find(alert => alert.type === alertData.type && !alert.resolved);

    if (existingAlert) {
      logger.debug(`Alert type ${alertData.type} already active, skipping`);
      return;
    }

    const alert: RateLimitAlert = {
      id: alertId,
      type: alertData.type,
      message: alertData.message,
      severity: alertData.severity,
      timestamp: new Date(),
      data: alertData.data,
      resolved: false,
    };

    this.activeAlerts.set(alertId, alert);

    // Store alert in Redis
    await redisService.set(
      `${REDIS_KEYS.ALERTS}:${alertId}`,
      alert,
      { ttl: Math.floor(DEFAULT_CONFIG.alertRetention / 1000) }
    );

    // Emit alert event
    this.emit('alert', alert);

    // Log alert
    logger.warn(`Rate limit alert: ${alert.message}`, {
      alertId,
      type: alert.type,
      severity: alert.severity,
      data: alert.data,
    });

    // Auto-resolve alert after some time based on severity
    const autoResolveTime = this.getAutoResolveTime(alert.severity);
    setTimeout(async () => {
      await this.resolveAlert(alertId);
    }, autoResolveTime);
  }

  private getAutoResolveTime(severity: string): number {
    switch (severity) {
      case 'low': return 5 * 60 * 1000; // 5 minutes
      case 'medium': return 15 * 60 * 1000; // 15 minutes
      case 'high': return 30 * 60 * 1000; // 30 minutes
      case 'critical': return 60 * 60 * 1000; // 1 hour
      default: return 15 * 60 * 1000;
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.resolved) return;

    alert.resolved = true;
    alert.data.resolvedAt = new Date();

    // Update in Redis
    await redisService.set(
      `${REDIS_KEYS.ALERTS}:${alertId}`,
      alert,
      { ttl: Math.floor(DEFAULT_CONFIG.alertRetention / 1000) }
    );

    this.emit('alertResolved', alert);
    logger.info(`Rate limit alert resolved: ${alertId}`);
  }

  private async collectMetrics(): Promise<void> {
    try {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Get monitoring data from the last hour
      const keys = await redisService.keys(`${REDIS_KEYS.MONITORING}:*`);
      const recentKeys = keys.filter(key => {
        const timestamp = parseInt(key.split(':')[2]);
        return timestamp > oneHourAgo;
      });

      const metrics: RateLimitMetrics[] = [];
      const endpointStats = new Map<string, { total: number; blocked: number }>();
      const tierStats = new Map<string, { total: number; blocked: number }>();

      for (const key of recentKeys) {
        const data = await redisService.get<RateLimitMonitoringData>(key);
        if (!data) continue;

        // Update endpoint statistics
        const endpoint = data.endpoint || 'unknown';
        const epStats = endpointStats.get(endpoint) || { total: 0, blocked: 0 };
        epStats.total++;
        if (data.blocked) epStats.blocked++;
        endpointStats.set(endpoint, epStats);

        // Update tier statistics
        const tier = data.userTier || 'unknown';
        const tierStatsEntry = tierStats.get(tier) || { total: 0, blocked: 0 };
        tierStatsEntry.total++;
        if (data.blocked) tierStatsEntry.blocked++;
        tierStats.set(tier, tierStatsEntry);

        // Aggregate metrics by identifier
        const existingMetric = metrics.find(m => m.identifier === data.identifier);
        if (existingMetric) {
          existingMetric.totalRequests++;
          if (data.blocked) {
            existingMetric.blockedRequests++;
          } else {
            existingMetric.allowedRequests++;
          }
          existingMetric.lastRequest = data.timestamp;
          
          // Update average response time
          const totalTime = existingMetric.averageResponseTime * (existingMetric.totalRequests - 1);
          existingMetric.averageResponseTime = (totalTime + data.responseTime) / existingMetric.totalRequests;
        } else {
          metrics.push({
            identifier: data.identifier,
            totalRequests: 1,
            allowedRequests: data.blocked ? 0 : 1,
            blockedRequests: data.blocked ? 1 : 0,
            averageResponseTime: data.responseTime,
            lastRequest: data.timestamp,
            userTier: data.userTier,
            endpoint: data.endpoint,
          });
        }
      }

      // Store aggregated metrics
      const metricsKey = `${REDIS_KEYS.ANALYTICS}:metrics:${now}`;
      await redisService.set(metricsKey, metrics, { ttl: 86400 }); // 24 hours

      // Store analytics summary
      const analytics: RateLimitAnalytics = {
        period: '1h',
        totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
        blockedRequests: metrics.reduce((sum, m) => sum + m.blockedRequests, 0),
        uniqueUsers: new Set(metrics.map(m => m.identifier)).size,
        topEndpoints: Array.from(endpointStats.entries())
          .map(([endpoint, stats]) => ({
            endpoint,
            requests: stats.total,
            blocked: stats.blocked,
          }))
          .sort((a, b) => b.requests - a.requests)
          .slice(0, 10),
        tierBreakdown: Object.fromEntries(tierStats),
      };

      const analyticsKey = `${REDIS_KEYS.ANALYTICS}:summary:${now}`;
      await redisService.set(analyticsKey, analytics, { ttl: 86400 * 7 }); // 7 days

      this.emit('metricsCollected', { metrics, analytics });
    } catch (error) {
      logger.error('Error collecting rate limit metrics:', error);
    }
  }

  // Public API methods

  async getActiveAlerts(): Promise<RateLimitAlert[]> {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  async getAlertHistory(limit: number = 100): Promise<RateLimitAlert[]> {
    try {
      const keys = await redisService.keys(`${REDIS_KEYS.ALERTS}:*`);
      const alerts: RateLimitAlert[] = [];

      for (const key of keys.slice(0, limit)) {
        const alert = await redisService.get<RateLimitAlert>(key);
        if (alert) {
          alerts.push(alert);
        }
      }

      return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      logger.error('Error getting alert history:', error);
      return [];
    }
  }

  async getMetrics(timeframe: '1h' | '24h' | '7d' = '1h'): Promise<RateLimitMetrics[]> {
    try {
      const now = Date.now();
      let cutoff: number;

      switch (timeframe) {
        case '1h':
          cutoff = now - 3600000;
          break;
        case '24h':
          cutoff = now - 86400000;
          break;
        case '7d':
          cutoff = now - 604800000;
          break;
      }

      const keys = await redisService.keys(`${REDIS_KEYS.ANALYTICS}:metrics:*`);
      const recentKeys = keys.filter(key => {
        const timestamp = parseInt(key.split(':')[3]);
        return timestamp > cutoff;
      });

      const allMetrics: RateLimitMetrics[] = [];
      for (const key of recentKeys) {
        const metrics = await redisService.get<RateLimitMetrics[]>(key);
        if (metrics) {
          allMetrics.push(...metrics);
        }
      }

      return allMetrics;
    } catch (error) {
      logger.error('Error getting metrics:', error);
      return [];
    }
  }

  async getAnalytics(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<RateLimitAnalytics | null> {
    try {
      const now = Date.now();
      let cutoff: number;

      switch (timeframe) {
        case '1h':
          cutoff = now - 3600000;
          break;
        case '24h':
          cutoff = now - 86400000;
          break;
        case '7d':
          cutoff = now - 604800000;
          break;
      }

      const keys = await redisService.keys(`${REDIS_KEYS.ANALYTICS}:summary:*`);
      const recentKeys = keys.filter(key => {
        const timestamp = parseInt(key.split(':')[3]);
        return timestamp > cutoff;
      });

      if (recentKeys.length === 0) return null;

      // Get the most recent analytics
      const latestKey = recentKeys.sort((a, b) => {
        const timestampA = parseInt(a.split(':')[3]);
        const timestampB = parseInt(b.split(':')[3]);
        return timestampB - timestampA;
      })[0];

      return await redisService.get<RateLimitAnalytics>(latestKey);
    } catch (error) {
      logger.error('Error getting analytics:', error);
      return null;
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.isMonitoring && await redisService.healthCheck().then(h => h.status === 'healthy');
  }
}

// Export singleton instance
export const rateLimitMonitor = new RateLimitMonitor();