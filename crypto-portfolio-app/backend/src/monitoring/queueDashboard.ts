import { Request, Response } from 'express';
import { QueueName } from '../types/queue.types';
import { queueMetricsCollector } from './queueMetrics';
import { getScheduledJobs } from '../scheduler';
import { healthCheck } from '../workers';
import { logger } from '../utils/logger';

interface DashboardData {
  overview: {
    totalQueues: number;
    totalJobs: number;
    activeWorkers: number;
    systemHealth: string;
    uptime: number;
  };
  queues: Array<{
    name: string;
    status: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    throughput: number;
    errorRate: number;
  }>;
  workers: Array<{
    id: string;
    status: string;
    jobsProcessed: number;
    uptime: number;
  }>;
  scheduler: Array<{
    id: string;
    name: string;
    enabled: boolean;
    nextRun?: string;
  }>;
  alerts: Array<{
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>;
}

export class QueueDashboard {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  // Get complete dashboard data
  public async getDashboardData(): Promise<DashboardData> {
    try {
      const currentStatus = await queueMetricsCollector.getCurrentStatus();
      const scheduledJobs = getScheduledJobs();
      const workerHealth = healthCheck();
      
      // Generate alerts based on current status
      const alerts = this.generateAlerts(currentStatus);

      const dashboardData: DashboardData = {
        overview: {
          totalQueues: currentStatus.queues.length,
          totalJobs: currentStatus.queues.reduce((sum, q) => 
            sum + q.waiting + q.active + q.completed + q.failed, 0),
          activeWorkers: currentStatus.workers.filter(w => w.status !== 'stopped').length,
          systemHealth: currentStatus.system.systemHealth,
          uptime: Date.now() - this.startTime.getTime()
        },
        queues: currentStatus.queues.map(q => ({
          name: q.queueName,
          status: q.paused ? 'paused' : q.active > 0 ? 'active' : 'idle',
          waiting: q.waiting,
          active: q.active,
          completed: q.completed,
          failed: q.failed,
          throughput: q.throughput,
          errorRate: q.errorRate
        })),
        workers: currentStatus.workers.map(w => ({
          id: w.workerId,
          status: w.status,
          jobsProcessed: w.jobsProcessed,
          uptime: w.uptime
        })),
        scheduler: scheduledJobs.map(job => ({
          id: job.id,
          name: job.name,
          enabled: job.enabled,
          nextRun: this.calculateNextRun(job.schedule)
        })),
        alerts
      };

      return dashboardData;
    } catch (error) {
      logger.error('Error generating dashboard data:', error);
      throw error;
    }
  }

  // Generate alerts based on system status
  private generateAlerts(status: any): Array<{level: 'info' | 'warning' | 'error', message: string, timestamp: Date}> {
    const alerts: any[] = [];
    const now = new Date();

    // System health alerts
    if (status.system.systemHealth === 'critical') {
      alerts.push({
        level: 'error',
        message: 'System health is critical - immediate attention required',
        timestamp: now
      });
    } else if (status.system.systemHealth === 'warning') {
      alerts.push({
        level: 'warning',
        message: 'System health degraded - monitoring recommended',
        timestamp: now
      });
    }

    // Worker alerts
    const inactiveWorkers = status.workers.filter((w: any) => w.status === 'stopped').length;
    if (inactiveWorkers > 0) {
      alerts.push({
        level: 'warning',
        message: `${inactiveWorkers} worker(s) are inactive`,
        timestamp: now
      });
    }

    // Queue alerts
    for (const queue of status.queues) {
      if (queue.errorRate > 10) {
        alerts.push({
          level: 'error',
          message: `High error rate (${queue.errorRate}%) in queue ${queue.queueName}`,
          timestamp: now
        });
      }

      if (queue.waiting > 1000) {
        alerts.push({
          level: 'warning',
          message: `High queue backlog (${queue.waiting} jobs) in ${queue.queueName}`,
          timestamp: now
        });
      }

      if (queue.paused) {
        alerts.push({
          level: 'warning',
          message: `Queue ${queue.queueName} is paused`,
          timestamp: now
        });
      }
    }

    return alerts;
  }

  // Calculate next run time for cron expression (simplified)
  private calculateNextRun(cronExpression: string): string {
    // This is a simplified implementation
    // In production, use a proper cron parser like 'cron-parser'
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60000); // Next minute as placeholder
    return nextRun.toISOString();
  }

  // Get queue metrics for a specific time period
  public async getQueueMetrics(queueName: QueueName, hours: number = 24): Promise<any> {
    try {
      const metrics = await queueMetricsCollector.getQueueMetrics(queueName, hours);
      
      return {
        queueName,
        period: `${hours}h`,
        data: metrics.map(m => ({
          timestamp: m.timestamp,
          waiting: m.waiting,
          active: m.active,
          completed: m.completed,
          failed: m.failed,
          throughput: m.throughput,
          errorRate: m.errorRate
        }))
      };
    } catch (error) {
      logger.error(`Error getting metrics for queue ${queueName}:`, error);
      throw error;
    }
  }

  // Get system metrics for a specific time period
  public async getSystemMetrics(hours: number = 24): Promise<any> {
    try {
      const metrics = await queueMetricsCollector.getSystemMetrics(hours);
      
      return {
        period: `${hours}h`,
        data: metrics.map(m => ({
          timestamp: m.timestamp,
          totalJobs: m.totalJobs,
          activeWorkers: m.activeWorkers,
          memoryUsage: m.memoryUsage,
          cpuUsage: m.cpuUsage,
          systemHealth: m.systemHealth
        }))
      };
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      throw error;
    }
  }

  // Get queue performance summary
  public async getPerformanceSummary(): Promise<any> {
    try {
      const currentStatus = await queueMetricsCollector.getCurrentStatus();
      
      const summary = {
        totalJobs: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0
        },
        throughput: {
          total: 0,
          byQueue: {} as Record<string, number>
        },
        errorRates: {
          overall: 0,
          byQueue: {} as Record<string, number>
        },
        topPerformers: [] as Array<{queue: string, throughput: number}>,
        bottlenecks: [] as Array<{queue: string, issue: string}>
      };

      // Calculate totals
      for (const queue of currentStatus.queues) {
        summary.totalJobs.waiting += queue.waiting;
        summary.totalJobs.active += queue.active;
        summary.totalJobs.completed += queue.completed;
        summary.totalJobs.failed += queue.failed;
        
        summary.throughput.total += queue.throughput;
        summary.throughput.byQueue[queue.queueName] = queue.throughput;
        summary.errorRates.byQueue[queue.queueName] = queue.errorRate;
        
        // Identify bottlenecks
        if (queue.waiting > 500) {
          summary.bottlenecks.push({
            queue: queue.queueName,
            issue: `High backlog: ${queue.waiting} jobs waiting`
          });
        }
        
        if (queue.errorRate > 5) {
          summary.bottlenecks.push({
            queue: queue.queueName,
            issue: `High error rate: ${queue.errorRate}%`
          });
        }
      }

      // Calculate overall error rate
      const totalJobs = summary.totalJobs.completed + summary.totalJobs.failed;
      summary.errorRates.overall = totalJobs > 0 
        ? Math.round((summary.totalJobs.failed / totalJobs) * 100) 
        : 0;

      // Identify top performers
      summary.topPerformers = Object.entries(summary.throughput.byQueue)
        .map(([queue, throughput]) => ({ queue, throughput }))
        .sort((a, b) => b.throughput - a.throughput)
        .slice(0, 3);

      return summary;
    } catch (error) {
      logger.error('Error generating performance summary:', error);
      throw error;
    }
  }

  // Express middleware for dashboard endpoint
  public dashboardHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const dashboardData = await this.getDashboardData();
      res.json({
        success: true,
        data: dashboardData,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Dashboard endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate dashboard data',
        timestamp: new Date()
      });
    }
  };

  // Express middleware for queue metrics endpoint
  public queueMetricsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const { queueName, hours = 24 } = req.params;
      
      if (!Object.values(QueueName).includes(queueName as QueueName)) {
        res.status(400).json({
          success: false,
          error: 'Invalid queue name'
        });
        return;
      }

      const metrics = await this.getQueueMetrics(queueName as QueueName, parseInt(hours as string));
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Queue metrics endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue metrics',
        timestamp: new Date()
      });
    }
  };

  // Express middleware for system metrics endpoint
  public systemMetricsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const { hours = 24 } = req.params;
      const metrics = await this.getSystemMetrics(parseInt(hours as string));
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('System metrics endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system metrics',
        timestamp: new Date()
      });
    }
  };

  // Express middleware for performance summary endpoint
  public performanceSummaryHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const summary = await this.getPerformanceSummary();
      res.json({
        success: true,
        data: summary,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Performance summary endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate performance summary',
        timestamp: new Date()
      });
    }
  };
}

// Export singleton instance
export const queueDashboard = new QueueDashboard();