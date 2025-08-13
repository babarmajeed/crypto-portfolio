import { register, collectDefaultMetrics, Counter, Gauge, Histogram, Summary } from 'prom-client';
import { CustomMetric, PerformanceMetric } from '@/types/monitoring.types';
import { loggingService } from '@/services/loggingService';
import { healthCheckService } from '@/services/healthCheckService';
import { performanceMiddleware } from '@/middleware/performanceMiddleware';
import { monitoringConfig } from '@/config/monitoring.config';
import * as os from 'os';

class MetricsCollector {
  private counters = new Map<string, Counter<string>>();
  private gauges = new Map<string, Gauge<string>>();
  private histograms = new Map<string, Histogram<string>>();
  private summaries = new Map<string, Summary<string>>();
  private collectInterval?: NodeJS.Timeout;

  // Built-in metrics
  private httpRequestsTotal: Counter<string>;
  private httpRequestDuration: Histogram<string>;
  private httpRequestsInFlight: Gauge<string>;
  private databaseQueriesTotal: Counter<string>;
  private databaseQueryDuration: Histogram<string>;
  private externalApiCallsTotal: Counter<string>;
  private externalApiCallDuration: Histogram<string>;
  private businessMetricsGauge: Gauge<string>;
  private userActivityCounter: Counter<string>;
  private errorRate: Gauge<string>;
  private memoryUsage: Gauge<string>;
  private cpuUsage: Gauge<string>;
  private diskUsage: Gauge<string>;
  private activeUsers: Gauge<string>;

  constructor() {
    // Enable default metrics collection
    collectDefaultMetrics({
      register,
      timeout: 10000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      eventLoopMonitoringPrecision: 10
    });

    this.initializeBuiltInMetrics();
    this.startCollection();
  }

  private initializeBuiltInMetrics(): void {
    // HTTP Request metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [register]
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [register]
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      registers: [register]
    });

    // Database metrics
    this.databaseQueriesTotal = new Counter({
      name: 'database_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'status'],
      registers: [register]
    });

    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register]
    });

    // External API metrics
    this.externalApiCallsTotal = new Counter({
      name: 'external_api_calls_total',
      help: 'Total number of external API calls',
      labelNames: ['service', 'endpoint', 'status_code'],
      registers: [register]
    });

    this.externalApiCallDuration = new Histogram({
      name: 'external_api_call_duration_seconds',
      help: 'Duration of external API calls in seconds',
      labelNames: ['service', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [register]
    });

    // Business metrics
    this.businessMetricsGauge = new Gauge({
      name: 'business_metrics',
      help: 'Business-specific metrics',
      labelNames: ['metric_name', 'period'],
      registers: [register]
    });

    this.userActivityCounter = new Counter({
      name: 'user_activity_total',
      help: 'Total user activities',
      labelNames: ['activity_type', 'category'],
      registers: [register]
    });

    // System health metrics
    this.errorRate = new Gauge({
      name: 'error_rate',
      help: 'Current error rate percentage',
      registers: [register]
    });

    this.memoryUsage = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [register]
    });

    this.cpuUsage = new Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [register]
    });

    this.diskUsage = new Gauge({
      name: 'disk_usage_percent',
      help: 'Disk usage percentage',
      registers: [register]
    });

    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of currently active users',
      registers: [register]
    });

    loggingService.logInfo('Initialized Prometheus metrics collectors');
  }

  /**
   * Record HTTP request metrics
   */
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString()
    });

    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration / 1000 // Convert to seconds
    );
  }

  /**
   * Record request in flight
   */
  public recordRequestStart(): void {
    this.httpRequestsInFlight.inc();
  }

  /**
   * Record request completion
   */
  public recordRequestEnd(): void {
    this.httpRequestsInFlight.dec();
  }

  /**
   * Record database query metrics
   */
  public recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    success: boolean
  ): void {
    this.databaseQueriesTotal.inc({
      operation,
      table,
      status: success ? 'success' : 'error'
    });

    this.databaseQueryDuration.observe(
      { operation, table },
      duration / 1000 // Convert to seconds
    );
  }

  /**
   * Record external API call metrics
   */
  public recordExternalApiCall(
    service: string,
    endpoint: string,
    statusCode: number,
    duration: number
  ): void {
    this.externalApiCallsTotal.inc({
      service,
      endpoint,
      status_code: statusCode.toString()
    });

    this.externalApiCallDuration.observe(
      { service, endpoint },
      duration / 1000 // Convert to seconds
    );
  }

  /**
   * Record business metric
   */
  public recordBusinessMetric(
    metricName: string,
    value: number,
    period: string = 'current'
  ): void {
    this.businessMetricsGauge.set(
      { metric_name: metricName, period },
      value
    );
  }

  /**
   * Record user activity
   */
  public recordUserActivity(
    activityType: string,
    category: string = 'general'
  ): void {
    this.userActivityCounter.inc({
      activity_type: activityType,
      category
    });
  }

  /**
   * Update system metrics
   */
  public updateSystemMetrics(): void {
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.memoryUsage.set({ type: 'external' }, memUsage.external);
    this.memoryUsage.set({ type: 'rss' }, memUsage.rss);

    // System memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    this.memoryUsage.set({ type: 'system_total' }, totalMem);
    this.memoryUsage.set({ type: 'system_used' }, usedMem);
    this.memoryUsage.set({ type: 'system_free' }, freeMem);

    // CPU metrics (simplified - would need more sophisticated calculation)
    const loadAvg = os.loadavg();
    const numCpus = os.cpus().length;
    const cpuPercent = (loadAvg[0] / numCpus) * 100;
    this.cpuUsage.set(Math.min(cpuPercent, 100));

    // Error rate from performance middleware
    const perfSummary = performanceMiddleware.getPerformanceSummary();
    this.errorRate.set(perfSummary.errorRate);

    // Active users (from performance middleware active requests)
    const activeRequests = performanceMiddleware.getActiveRequestsCount();
    this.activeUsers.set(activeRequests);
  }

  /**
   * Create custom counter
   */
  public createCounter(config: CustomMetric): Counter<string> {
    if (this.counters.has(config.name)) {
      return this.counters.get(config.name)!;
    }

    const counter = new Counter({
      name: config.name,
      help: config.description,
      labelNames: config.labels || [],
      registers: [register]
    });

    this.counters.set(config.name, counter);
    return counter;
  }

  /**
   * Create custom gauge
   */
  public createGauge(config: CustomMetric): Gauge<string> {
    if (this.gauges.has(config.name)) {
      return this.gauges.get(config.name)!;
    }

    const gauge = new Gauge({
      name: config.name,
      help: config.description,
      labelNames: config.labels || [],
      registers: [register]
    });

    this.gauges.set(config.name, gauge);
    return gauge;
  }

  /**
   * Create custom histogram
   */
  public createHistogram(config: CustomMetric): Histogram<string> {
    if (this.histograms.has(config.name)) {
      return this.histograms.get(config.name)!;
    }

    const histogram = new Histogram({
      name: config.name,
      help: config.description,
      labelNames: config.labels || [],
      buckets: config.buckets || [0.1, 0.5, 1, 2, 5, 10],
      registers: [register]
    });

    this.histograms.set(config.name, histogram);
    return histogram;
  }

  /**
   * Create custom summary
   */
  public createSummary(config: CustomMetric): Summary<string> {
    if (this.summaries.has(config.name)) {
      return this.summaries.get(config.name)!;
    }

    const summary = new Summary({
      name: config.name,
      help: config.description,
      labelNames: config.labels || [],
      percentiles: config.percentiles || [0.5, 0.9, 0.95, 0.99],
      registers: [register]
    });

    this.summaries.set(config.name, summary);
    return summary;
  }

  /**
   * Get metrics for Prometheus endpoint
   */
  public async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Get metrics in JSON format
   */
  public async getMetricsJson(): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Clear all metrics
   */
  public clearMetrics(): void {
    register.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
  }

  /**
   * Get metric by name
   */
  public getMetric(name: string): any {
    return (
      this.counters.get(name) ||
      this.gauges.get(name) ||
      this.histograms.get(name) ||
      this.summaries.get(name) ||
      register.getSingleMetric(name)
    );
  }

  /**
   * Record performance metric
   */
  public recordPerformanceMetric(metric: PerformanceMetric): void {
    const metricName = `performance_${metric.name}`;
    
    if (metric.unit === 'ms' || metric.unit === 'seconds') {
      // Use histogram for timing metrics
      let histogram = this.histograms.get(metricName);
      if (!histogram) {
        histogram = this.createHistogram({
          name: metricName,
          type: 'histogram',
          description: `Performance metric: ${metric.name}`,
          labels: metric.tags ? Object.keys(metric.tags) : undefined
        });
      }
      
      const value = metric.unit === 'ms' ? metric.value / 1000 : metric.value;
      histogram.observe(metric.tags || {}, value);
    } else {
      // Use gauge for other metrics
      let gauge = this.gauges.get(metricName);
      if (!gauge) {
        gauge = this.createGauge({
          name: metricName,
          type: 'gauge',
          description: `Performance metric: ${metric.name}`,
          labels: metric.tags ? Object.keys(metric.tags) : undefined
        });
      }
      
      gauge.set(metric.tags || {}, metric.value);
    }
  }

  /**
   * Start periodic metrics collection
   */
  private startCollection(): void {
    if (!monitoringConfig.metrics.prometheus.enabled) {
      return;
    }

    this.collectInterval = setInterval(() => {
      try {
        this.updateSystemMetrics();
        this.collectHealthMetrics();
        this.collectBusinessMetrics();
      } catch (error) {
        loggingService.logError('Failed to collect metrics', error as Error);
      }
    }, monitoringConfig.metrics.collection.interval);

    loggingService.logInfo(`Started metrics collection every ${monitoringConfig.metrics.collection.interval}ms`);
  }

  /**
   * Collect health check metrics
   */
  private collectHealthMetrics(): void {
    const healthSummary = healthCheckService.getHealthSummary();
    
    // Health status as gauge (1 = healthy, 0.5 = degraded, 0 = unhealthy)
    const healthValue = healthSummary.status === 'healthy' ? 1 : 
                       healthSummary.status === 'degraded' ? 0.5 : 0;
    
    let healthGauge = this.gauges.get('system_health_status');
    if (!healthGauge) {
      healthGauge = this.createGauge({
        name: 'system_health_status',
        type: 'gauge',
        description: 'Overall system health status (1=healthy, 0.5=degraded, 0=unhealthy)'
      });
    }
    
    healthGauge.set(healthValue);

    // Individual health check metrics
    const lastResults = healthCheckService.getLastResults();
    for (const [checkName, result] of lastResults) {
      const checkValue = result.status === 'healthy' ? 1 : 
                        result.status === 'degraded' ? 0.5 : 0;
      
      let checkGauge = this.gauges.get(`health_check_${checkName}`);
      if (!checkGauge) {
        checkGauge = this.createGauge({
          name: `health_check_${checkName}`,
          type: 'gauge',
          description: `Health check status for ${checkName}`,
          labels: ['check_name']
        });
      }
      
      checkGauge.set({ check_name: checkName }, checkValue);
    }
  }

  /**
   * Collect business metrics
   */
  private async collectBusinessMetrics(): Promise<void> {
    try {
      // This would typically fetch from analytics service
      // For now, we'll use some example metrics
      
      const businessMetrics = [
        { name: 'daily_active_users', value: 150 },
        { name: 'total_portfolios', value: 1250 },
        { name: 'api_requests_per_minute', value: 45 },
        { name: 'average_response_time_ms', value: 180 }
      ];

      businessMetrics.forEach(metric => {
        this.recordBusinessMetric(metric.name, metric.value);
      });
      
    } catch (error) {
      loggingService.logError('Failed to collect business metrics', error as Error);
    }
  }

  /**
   * Stop metrics collection
   */
  public stopCollection(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = undefined;
      loggingService.logInfo('Stopped metrics collection');
    }
  }

  /**
   * Get built-in metrics instances
   */
  public getBuiltInMetrics() {
    return {
      httpRequestsTotal: this.httpRequestsTotal,
      httpRequestDuration: this.httpRequestDuration,
      httpRequestsInFlight: this.httpRequestsInFlight,
      databaseQueriesTotal: this.databaseQueriesTotal,
      databaseQueryDuration: this.databaseQueryDuration,
      externalApiCallsTotal: this.externalApiCallsTotal,
      externalApiCallDuration: this.externalApiCallDuration,
      businessMetricsGauge: this.businessMetricsGauge,
      userActivityCounter: this.userActivityCounter,
      errorRate: this.errorRate,
      memoryUsage: this.memoryUsage,
      cpuUsage: this.cpuUsage,
      activeUsers: this.activeUsers
    };
  }

  /**
   * Cleanup on service shutdown
   */
  public cleanup(): void {
    this.stopCollection();
    this.clearMetrics();
  }
}

export const metricsCollector = new MetricsCollector();