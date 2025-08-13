import { QueueName, QueueStats, WorkerStats, WorkerStatus } from '../types/queue.types';
import { getQueue, getQueueStats } from '../queues';
import { getWorkerStats } from '../workers';
import { redisService } from '../services/redisService';
import { logger } from '../utils/logger';

interface QueueMetrics {
  timestamp: Date;
  queueName: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  throughput: number; // jobs per minute
  avgProcessingTime: number; // milliseconds
  errorRate: number; // percentage
}

interface SystemMetrics {
  timestamp: Date;
  totalQueues: number;
  totalJobs: number;
  activeWorkers: number;
  totalWorkers: number;
  memoryUsage: number;
  cpuUsage: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

// Metrics storage keys
const METRICS_PREFIX = 'queue:metrics';
const METRICS_RETENTION = 24 * 60 * 60; // 24 hours in seconds

export class QueueMetricsCollector {
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly collectionInterval: number;

  constructor(collectionInterval: number = 60000) { // 1 minute default
    this.collectionInterval = collectionInterval;
  }

  // Start metrics collection
  public start(): void {
    if (this.metricsInterval) {
      logger.warn('Metrics collection already started');
      return;
    }

    logger.info(`Starting queue metrics collection (interval: ${this.collectionInterval}ms)`);
    
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error('Error collecting queue metrics:', error);
      }
    }, this.collectionInterval);

    // Collect initial metrics
    this.collectMetrics().catch(error => {
      logger.error('Error collecting initial metrics:', error);
    });
  }

  // Stop metrics collection
  public stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      logger.info('Queue metrics collection stopped');
    }
  }

  // Collect metrics for all queues
  private async collectMetrics(): Promise<void> {
    const timestamp = new Date();
    
    // Collect queue metrics
    const queueMetrics: QueueMetrics[] = [];
    for (const queueName of Object.values(QueueName)) {
      try {
        const metrics = await this.collectQueueMetrics(queueName, timestamp);
        queueMetrics.push(metrics);
      } catch (error) {
        logger.error(`Error collecting metrics for queue ${queueName}:`, error);
      }
    }

    // Collect system metrics
    const systemMetrics = await this.collectSystemMetrics(timestamp, queueMetrics);

    // Store metrics
    await this.storeMetrics(queueMetrics, systemMetrics);
    
    // Log summary
    this.logMetricsSummary(queueMetrics, systemMetrics);
  }

  // Collect metrics for a specific queue
  private async collectQueueMetrics(queueName: QueueName, timestamp: Date): Promise<QueueMetrics> {
    const stats = await getQueueStats(queueName);
    const queue = getQueue(queueName);

    // Calculate throughput and processing time
    const throughput = await this.calculateThroughput(queueName);
    const avgProcessingTime = await this.calculateAvgProcessingTime(queueName);
    const errorRate = await this.calculateErrorRate(queueName);

    return {
      timestamp,
      queueName,
      waiting: stats.waiting,
      active: stats.active,
      completed: stats.completed,
      failed: stats.failed,
      delayed: stats.delayed,
      paused: stats.paused,
      throughput,
      avgProcessingTime,
      errorRate
    };
  }

  // Collect system-wide metrics
  private async collectSystemMetrics(timestamp: Date, queueMetrics: QueueMetrics[]): Promise<SystemMetrics> {
    const workerStats = getWorkerStats();
    const totalJobs = queueMetrics.reduce((sum, q) => 
      sum + q.waiting + q.active + q.completed + q.failed + q.delayed, 0);
    
    const activeWorkers = workerStats.filter(w => w.status !== WorkerStatus.STOPPED).length;
    const memoryUsage = process.memoryUsage().heapUsed;
    const cpuUsage = process.cpuUsage().user;

    // Determine system health
    const systemHealth = this.determineSystemHealth(queueMetrics, workerStats);

    return {
      timestamp,
      totalQueues: queueMetrics.length,
      totalJobs,
      activeWorkers,
      totalWorkers: workerStats.length,
      memoryUsage,
      cpuUsage,
      systemHealth
    };
  }

  // Calculate jobs per minute for a queue
  private async calculateThroughput(queueName: QueueName): Promise<number> {
    const key = `${METRICS_PREFIX}:throughput:${queueName}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Store current job completion
    await redisService.zadd(key, now, `job:${now}`);
    
    // Remove old entries
    await redisService.zremrangebyscore(key, '-inf', oneMinuteAgo);
    
    // Count jobs in last minute
    const count = await redisService.zcard(key);
    
    // Set expiry
    await redisService.expire(key, 300); // 5 minutes

    return count;
  }

  // Calculate average processing time for a queue
  private async calculateAvgProcessingTime(queueName: QueueName): Promise<number> {
    const key = `${METRICS_PREFIX}:processing_time:${queueName}`;
    const values = await redisService.lrange(key, 0, 99); // Last 100 jobs
    
    if (values.length === 0) return 0;

    const times = values.map(v => parseInt(v, 10)).filter(t => !isNaN(t));
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    
    return Math.round(avg);
  }

  // Calculate error rate for a queue
  private async calculateErrorRate(queueName: QueueName): Promise<number> {
    const successKey = `${METRICS_PREFIX}:success:${queueName}`;
    const errorKey = `${METRICS_PREFIX}:error:${queueName}`;
    
    const [successCount, errorCount] = await Promise.all([
      redisService.get(successKey).then(v => parseInt(v || '0', 10)),
      redisService.get(errorKey).then(v => parseInt(v || '0', 10))
    ]);

    const total = successCount + errorCount;
    return total > 0 ? Math.round((errorCount / total) * 100) : 0;
  }

  // Determine overall system health
  private determineSystemHealth(queueMetrics: QueueMetrics[], workerStats: any[]): 'healthy' | 'warning' | 'critical' {
    // Critical conditions
    const activeWorkers = workerStats.filter(w => w.status !== WorkerStatus.STOPPED).length;
    if (activeWorkers === 0) return 'critical';

    const failedQueues = queueMetrics.filter(q => q.errorRate > 50).length;
    if (failedQueues > queueMetrics.length / 2) return 'critical';

    // Warning conditions
    const highErrorRate = queueMetrics.some(q => q.errorRate > 10);
    const highWaitingJobs = queueMetrics.some(q => q.waiting > 1000);
    const stalledQueues = queueMetrics.filter(q => q.paused).length;

    if (highErrorRate || highWaitingJobs || stalledQueues > 0) return 'warning';

    return 'healthy';
  }

  // Store metrics in Redis
  private async storeMetrics(queueMetrics: QueueMetrics[], systemMetrics: SystemMetrics): Promise<void> {
    const pipeline = redisService.pipeline();

    // Store queue metrics
    for (const metrics of queueMetrics) {
      const key = `${METRICS_PREFIX}:queue:${metrics.queueName}`;
      pipeline.lpush(key, JSON.stringify(metrics));
      pipeline.ltrim(key, 0, 1439); // Keep 24 hours (1440 minutes)
      pipeline.expire(key, METRICS_RETENTION);
    }

    // Store system metrics
    const systemKey = `${METRICS_PREFIX}:system`;
    pipeline.lpush(systemKey, JSON.stringify(systemMetrics));
    pipeline.ltrim(systemKey, 0, 1439);
    pipeline.expire(systemKey, METRICS_RETENTION);

    await pipeline.exec();
  }

  // Log metrics summary
  private logMetricsSummary(queueMetrics: QueueMetrics[], systemMetrics: SystemMetrics): void {
    const summary = {
      timestamp: systemMetrics.timestamp,
      health: systemMetrics.systemHealth,
      totalJobs: systemMetrics.totalJobs,
      activeWorkers: systemMetrics.activeWorkers,
      queues: queueMetrics.map(q => ({
        name: q.queueName,
        waiting: q.waiting,
        active: q.active,
        throughput: q.throughput,
        errorRate: q.errorRate
      }))
    };

    logger.info('Queue metrics summary:', summary);
  }

  // Get recent metrics for a queue
  public async getQueueMetrics(queueName: QueueName, hours: number = 1): Promise<QueueMetrics[]> {
    const key = `${METRICS_PREFIX}:queue:${queueName}`;
    const count = hours * 60; // minutes
    const data = await redisService.lrange(key, 0, count - 1);
    
    return data.map(item => JSON.parse(item));
  }

  // Get recent system metrics
  public async getSystemMetrics(hours: number = 1): Promise<SystemMetrics[]> {
    const key = `${METRICS_PREFIX}:system`;
    const count = hours * 60; // minutes
    const data = await redisService.lrange(key, 0, count - 1);
    
    return data.map(item => JSON.parse(item));
  }

  // Get current status of all queues
  public async getCurrentStatus(): Promise<{
    queues: QueueMetrics[];
    system: SystemMetrics;
    workers: any[];
  }> {
    const timestamp = new Date();
    
    const queueMetrics: QueueMetrics[] = [];
    for (const queueName of Object.values(QueueName)) {
      const metrics = await this.collectQueueMetrics(queueName, timestamp);
      queueMetrics.push(metrics);
    }

    const systemMetrics = await this.collectSystemMetrics(timestamp, queueMetrics);
    const workerStats = getWorkerStats();

    return {
      queues: queueMetrics,
      system: systemMetrics,
      workers: workerStats
    };
  }

  // Record job completion for metrics
  public async recordJobCompletion(queueName: QueueName, processingTime: number, success: boolean): Promise<void> {
    const pipeline = redisService.pipeline();

    // Record processing time
    const timeKey = `${METRICS_PREFIX}:processing_time:${queueName}`;
    pipeline.lpush(timeKey, processingTime.toString());
    pipeline.ltrim(timeKey, 0, 99); // Keep last 100
    pipeline.expire(timeKey, 3600); // 1 hour

    // Record success/error
    const statusKey = success 
      ? `${METRICS_PREFIX}:success:${queueName}`
      : `${METRICS_PREFIX}:error:${queueName}`;
    pipeline.incr(statusKey);
    pipeline.expire(statusKey, 3600); // 1 hour

    await pipeline.exec();
  }
}

// Export singleton instance
export const queueMetricsCollector = new QueueMetricsCollector();