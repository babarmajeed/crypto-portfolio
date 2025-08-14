import { EventEmitter } from 'events';

/**
 * Usage Monitor for API Rate Limiting
 * Tracks usage patterns, generates alerts, and provides analytics
 */
class UsageMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    const {
      alertThresholds = {
        approachingLimit: 0.8, // 80% of limit used
        excessiveRateLimits: 0.3, // 30% of requests rate limited
        highLatency: 5000 // 5 second response time
      },
      monitoringWindow = 3600000, // 1 hour
      cleanupInterval = 86400000 // 24 hours
    } = options;
    
    this.alertThresholds = alertThresholds;
    this.monitoringWindow = monitoringWindow;
    this.cleanupInterval = cleanupInterval;
    
    // Usage tracking
    this.usage = new Map(); // key -> usage stats
    this.timeSeriesData = new Map(); // key -> array of timestamped data points
    this.alerts = new Map(); // key -> alert info
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Record successful API request
   */
  recordSuccess(exchange, endpoint, responseTime = 0) {
    const key = `${exchange}:${endpoint}`;
    const now = Date.now();
    
    const stats = this.getStats(key);
    stats.requests++;
    stats.successes++;
    stats.lastSuccess = now;
    
    // Update response time metrics
    if (responseTime > 0) {
      stats.totalResponseTime += responseTime;
      stats.averageResponseTime = stats.totalResponseTime / stats.successes;
      stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
      stats.minResponseTime = Math.min(stats.minResponseTime || Infinity, responseTime);
    }
    
    // Add to time series
    this.addTimeSeriesPoint(key, {
      timestamp: now,
      type: 'success',
      responseTime
    });
    
    // Check for high latency alert
    if (responseTime > this.alertThresholds.highLatency) {
      this.checkHighLatencyAlert(exchange, endpoint, responseTime);
    }
    
    // Update usage calculations
    this.updateUsageMetrics(key, stats);
  }

  /**
   * Record rate limited request
   */
  recordRateLimit(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    const now = Date.now();
    
    const stats = this.getStats(key);
    stats.requests++;
    stats.rateLimits++;
    stats.lastRateLimit = now;
    
    // Add to time series
    this.addTimeSeriesPoint(key, {
      timestamp: now,
      type: 'rate_limit'
    });
    
    // Update usage calculations
    this.updateUsageMetrics(key, stats);
    
    // Check for excessive rate limits alert
    this.checkExcessiveRateLimitsAlert(exchange, endpoint, stats);
  }

  /**
   * Record API error
   */
  recordError(exchange, endpoint, error) {
    const key = `${exchange}:${endpoint}`;
    const now = Date.now();
    
    const stats = this.getStats(key);
    stats.requests++;
    stats.errors++;
    stats.lastError = now;
    
    // Track error types
    if (!stats.errorTypes) {
      stats.errorTypes = new Map();
    }
    const errorType = this.getErrorType(error);
    stats.errorTypes.set(errorType, (stats.errorTypes.get(errorType) || 0) + 1);
    
    // Add to time series
    this.addTimeSeriesPoint(key, {
      timestamp: now,
      type: 'error',
      errorType
    });
    
    // Update usage calculations
    this.updateUsageMetrics(key, stats);
  }

  /**
   * Get or create stats object for key
   */
  getStats(key) {
    if (!this.usage.has(key)) {
      this.usage.set(key, {
        requests: 0,
        successes: 0,
        rateLimits: 0,
        errors: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        lastSuccess: null,
        lastRateLimit: null,
        lastError: null,
        firstRequest: Date.now(),
        errorTypes: new Map()
      });
    }
    return this.usage.get(key);
  }

  /**
   * Add data point to time series
   */
  addTimeSeriesPoint(key, dataPoint) {
    if (!this.timeSeriesData.has(key)) {
      this.timeSeriesData.set(key, []);
    }
    
    const series = this.timeSeriesData.get(key);
    series.push(dataPoint);
    
    // Keep only data within monitoring window
    const cutoff = Date.now() - this.monitoringWindow;
    while (series.length > 0 && series[0].timestamp < cutoff) {
      series.shift();
    }
  }

  /**
   * Update usage metrics and check thresholds
   */
  updateUsageMetrics(key, stats) {
    // Calculate ratios
    stats.successRate = stats.requests > 0 ? stats.successes / stats.requests : 0;
    stats.rateLimitRatio = stats.requests > 0 ? stats.rateLimits / stats.requests : 0;
    stats.errorRate = stats.requests > 0 ? stats.errors / stats.requests : 0;
    
    // Check approaching limit alert
    if (stats.rateLimitRatio > this.alertThresholds.approachingLimit) {
      const [exchange, endpoint] = key.split(':');
      this.emitAlert('approachingLimit', {
        exchange,
        endpoint,
        rateLimitRatio: stats.rateLimitRatio,
        requests: stats.requests,
        rateLimits: stats.rateLimits
      });
    }
  }

  /**
   * Check for excessive rate limits alert
   */
  checkExcessiveRateLimitsAlert(exchange, endpoint, stats) {
    if (stats.requests < 10) return; // Need minimum requests for meaningful ratio
    
    if (stats.rateLimitRatio > this.alertThresholds.excessiveRateLimits) {
      this.emitAlert('excessiveRateLimits', {
        exchange,
        endpoint,
        rateLimitRatio: stats.rateLimitRatio,
        requests: stats.requests,
        rateLimits: stats.rateLimits,
        recommendation: 'Consider reducing request frequency or implementing better request spacing'
      });
    }
  }

  /**
   * Check for high latency alert
   */
  checkHighLatencyAlert(exchange, endpoint, responseTime) {
    this.emitAlert('highLatency', {
      exchange,
      endpoint,
      responseTime,
      threshold: this.alertThresholds.highLatency,
      recommendation: 'API response times are elevated, consider implementing caching or request optimization'
    });
  }

  /**
   * Emit alert with deduplication
   */
  emitAlert(alertType, alertData) {
    const key = `${alertType}:${alertData.exchange}:${alertData.endpoint}`;
    const now = Date.now();
    
    // Deduplicate alerts (don't send same alert within 5 minutes)
    const lastAlert = this.alerts.get(key);
    if (lastAlert && now - lastAlert.timestamp < 300000) {
      return;
    }
    
    // Store alert info
    this.alerts.set(key, {
      ...alertData,
      timestamp: now,
      type: alertType
    });
    
    // Emit event
    this.emit(alertType, alertData);
    this.emit('alert', { type: alertType, ...alertData });
  }

  /**
   * Generate usage report for timeframe
   */
  generateUsageReport(timeframe = '1h') {
    const cutoff = Date.now() - this.parseTimeframe(timeframe);
    const report = {
      timeframe,
      generatedAt: new Date().toISOString(),
      exchanges: {},
      summary: {
        totalRequests: 0,
        totalRateLimits: 0,
        totalErrors: 0,
        averageResponseTime: 0,
        efficiency: 0
      }
    };
    
    let totalResponseTime = 0;
    let totalResponseTimeCount = 0;
    
    for (const [key, stats] of this.usage) {
      if (stats.firstRequest < cutoff) continue;
      
      const [exchange, endpoint] = key.split(':');
      
      if (!report.exchanges[exchange]) {
        report.exchanges[exchange] = {
          requests: 0,
          rateLimits: 0,
          errors: 0,
          successes: 0,
          averageResponseTime: 0,
          endpoints: {}
        };
      }
      
      // Aggregate exchange stats
      report.exchanges[exchange].requests += stats.requests;
      report.exchanges[exchange].rateLimits += stats.rateLimits;
      report.exchanges[exchange].errors += stats.errors;
      report.exchanges[exchange].successes += stats.successes;
      
      // Store endpoint stats
      report.exchanges[exchange].endpoints[endpoint] = {
        ...stats,
        errorTypes: stats.errorTypes ? Object.fromEntries(stats.errorTypes) : {}
      };
      
      // Update totals
      report.summary.totalRequests += stats.requests;
      report.summary.totalRateLimits += stats.rateLimits;
      report.summary.totalErrors += stats.errors;
      
      if (stats.averageResponseTime > 0 && stats.successes > 0) {
        totalResponseTime += stats.averageResponseTime * stats.successes;
        totalResponseTimeCount += stats.successes;
      }
    }
    
    // Calculate averages and ratios
    for (const [exchange, exchangeStats] of Object.entries(report.exchanges)) {
      if (exchangeStats.successes > 0) {
        const totalExchangeResponseTime = Object.values(exchangeStats.endpoints)
          .reduce((total, ep) => total + (ep.averageResponseTime * ep.successes), 0);
        exchangeStats.averageResponseTime = totalExchangeResponseTime / exchangeStats.successes;
      }
      
      exchangeStats.successRate = exchangeStats.requests > 0 ? 
        exchangeStats.successes / exchangeStats.requests : 0;
      exchangeStats.rateLimitRatio = exchangeStats.requests > 0 ? 
        exchangeStats.rateLimits / exchangeStats.requests : 0;
      exchangeStats.errorRate = exchangeStats.requests > 0 ? 
        exchangeStats.errors / exchangeStats.requests : 0;
    }
    
    // Calculate summary metrics
    if (totalResponseTimeCount > 0) {
      report.summary.averageResponseTime = totalResponseTime / totalResponseTimeCount;
    }
    
    report.summary.efficiency = report.summary.totalRequests > 0 ? 
      (1 - (report.summary.totalRateLimits / report.summary.totalRequests)) * 100 : 100;
    
    report.summary.successRate = report.summary.totalRequests > 0 ? 
      ((report.summary.totalRequests - report.summary.totalRateLimits - report.summary.totalErrors) / report.summary.totalRequests) * 100 : 100;
    
    return report;
  }

  /**
   * Get time series data for visualization
   */
  getTimeSeriesData(exchange, endpoint, timeframe = '1h') {
    const key = `${exchange}:${endpoint}`;
    const series = this.timeSeriesData.get(key) || [];
    const cutoff = Date.now() - this.parseTimeframe(timeframe);
    
    return series.filter(point => point.timestamp >= cutoff);
  }

  /**
   * Get aggregated metrics for dashboard
   */
  getDashboardMetrics() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    let totalRequests = 0;
    let rateLimitedRequests = 0;
    let errorRequests = 0;
    let activeEndpoints = 0;
    let averageResponseTime = 0;
    let responseTimeCount = 0;
    
    for (const [key, stats] of this.usage) {
      if (stats.lastSuccess && stats.lastSuccess > oneHourAgo) {
        activeEndpoints++;
      }
      
      totalRequests += stats.requests;
      rateLimitedRequests += stats.rateLimits;
      errorRequests += stats.errors;
      
      if (stats.averageResponseTime > 0 && stats.successes > 0) {
        averageResponseTime += stats.averageResponseTime * stats.successes;
        responseTimeCount += stats.successes;
      }
    }
    
    return {
      totalRequests,
      rateLimitedRequests,
      errorRequests,
      successfulRequests: totalRequests - rateLimitedRequests - errorRequests,
      activeEndpoints,
      averageResponseTime: responseTimeCount > 0 ? averageResponseTime / responseTimeCount : 0,
      efficiency: totalRequests > 0 ? ((totalRequests - rateLimitedRequests) / totalRequests) * 100 : 100,
      alertCount: this.alerts.size
    };
  }

  /**
   * Get error type from error object
   */
  getErrorType(error) {
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      if (status >= 400 && status < 500) return 'client_error';
      if (status >= 500) return 'server_error';
    }
    
    if (error.code) {
      return error.code;
    }
    
    const message = error.message?.toLowerCase() || '';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network_error';
    if (message.includes('connection')) return 'connection_error';
    
    return 'unknown_error';
  }

  /**
   * Parse timeframe string to milliseconds
   */
  parseTimeframe(timeframe) {
    const match = timeframe.match(/^(\d+)([hmd])$/);
    if (!match) return 3600000; // Default 1 hour
    
    const [, amount, unit] = match;
    const multipliers = { m: 60000, h: 3600000, d: 86400000 };
    
    return parseInt(amount) * (multipliers[unit] || 3600000);
  }

  /**
   * Start cleanup interval for old data
   */
  startCleanup() {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const cutoff = Date.now() - (this.monitoringWindow * 2); // Keep 2x monitoring window
    
    // Clean up usage stats for inactive endpoints
    for (const [key, stats] of this.usage) {
      if (stats.lastSuccess && stats.lastSuccess < cutoff && 
          stats.lastRateLimit && stats.lastRateLimit < cutoff &&
          stats.lastError && stats.lastError < cutoff) {
        this.usage.delete(key);
      }
    }
    
    // Clean up time series data
    for (const [key, series] of this.timeSeriesData) {
      const filteredSeries = series.filter(point => point.timestamp >= cutoff);
      if (filteredSeries.length === 0) {
        this.timeSeriesData.delete(key);
      } else {
        this.timeSeriesData.set(key, filteredSeries);
      }
    }
    
    // Clean up old alerts
    const alertCutoff = Date.now() - 86400000; // 24 hours
    for (const [key, alert] of this.alerts) {
      if (alert.timestamp < alertCutoff) {
        this.alerts.delete(key);
      }
    }
  }

  /**
   * Get current stats for specific endpoint
   */
  getEndpointStats(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    return this.usage.get(key) || null;
  }

  /**
   * Clear stats for specific endpoint
   */
  clearEndpointStats(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    this.usage.delete(key);
    this.timeSeriesData.delete(key);
  }

  /**
   * Clear all statistics
   */
  clearAllStats() {
    this.usage.clear();
    this.timeSeriesData.clear();
    this.alerts.clear();
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(newThresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      alertThresholds: this.alertThresholds,
      monitoringWindow: this.monitoringWindow,
      cleanupInterval: this.cleanupInterval
    };
  }

  /**
   * Cleanup and shutdown
   */
  cleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    this.removeAllListeners();
  }
}

export { UsageMonitor };