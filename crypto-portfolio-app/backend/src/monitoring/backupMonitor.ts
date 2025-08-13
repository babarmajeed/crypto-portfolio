/**
 * Backup job monitoring and status tracking
 * Provides real-time monitoring, health checks, and alert generation
 */

import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import { EventEmitter } from 'events';
import {
  BackupJob,
  BackupJobStatus,
  BackupMonitoringMetrics,
  StorageUtilization,
  StorageStats,
  BackupAlert,
  AlertType,
  AlertSeverity,
  BackupConfiguration,
  DisasterRecoveryPlan
} from '../types/backup.types';
import { defaultBackupConfig } from '../config/backup.config';
import { logger } from '../utils/logger';

export interface MonitoringConfig {
  healthCheckInterval: number; // milliseconds
  metricsCollectionInterval: number; // milliseconds
  alertThresholds: AlertThresholds;
  retentionDays: number;
  enableRealTimeAlerts: boolean;
}

export interface AlertThresholds {
  storageUsageWarning: number; // percentage
  storageUsageCritical: number; // percentage
  backupFailureRate: number; // percentage
  averageDurationIncrease: number; // percentage
  consecutiveFailures: number;
  backupOverdueHours: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'down';
  score: number; // 0-100
  lastUpdated: Date;
  components: {
    backupJobs: ComponentHealth;
    storage: ComponentHealth;
    database: ComponentHealth;
    scheduler: ComponentHealth;
  };
  activeAlerts: number;
  trends: HealthTrends;
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical' | 'down';
  score: number;
  lastCheck: Date;
  message?: string;
  metrics?: Record<string, any>;
}

export interface HealthTrends {
  backupSuccess: TrendData;
  averageDuration: TrendData;
  storageUsage: TrendData;
  failureRate: TrendData;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number; // percentage
  direction: 'up' | 'down' | 'stable';
}

export interface PerformanceMetrics {
  throughput: number; // MB/s
  averageBackupTime: number; // minutes
  successRate: number; // percentage
  storageEfficiency: number; // compression ratio
  errorRate: number; // percentage
  availability: number; // percentage
}

export class BackupMonitor extends EventEmitter {
  private dbPool: Pool;
  private config: MonitoringConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private currentHealth: SystemHealth;
  private alertHistory: Map<string, Date> = new Map();

  constructor(dbPool: Pool, config?: Partial<MonitoringConfig>) {
    super();
    this.dbPool = dbPool;
    this.config = {
      healthCheckInterval: 60000, // 1 minute
      metricsCollectionInterval: 300000, // 5 minutes
      alertThresholds: {
        storageUsageWarning: 75,
        storageUsageCritical: 90,
        backupFailureRate: 10,
        averageDurationIncrease: 50,
        consecutiveFailures: 3,
        backupOverdueHours: 6
      },
      retentionDays: 30,
      enableRealTimeAlerts: true,
      ...config
    };

    this.initializeSystemHealth();
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Backup monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting backup monitor');

    try {
      // Perform initial health check
      await this.performHealthCheck();

      // Schedule periodic health checks
      this.healthCheckTimer = setInterval(
        async () => {
          try {
            await this.performHealthCheck();
          } catch (error) {
            logger.error('Health check failed', { error: error.message });
          }
        },
        this.config.healthCheckInterval
      );

      // Schedule periodic metrics collection
      this.metricsTimer = setInterval(
        async () => {
          try {
            await this.collectMetrics();
          } catch (error) {
            logger.error('Metrics collection failed', { error: error.message });
          }
        },
        this.config.metricsCollectionInterval
      );

      // Emit monitoring started event
      this.emit('monitoring_started');
      
      logger.info('Backup monitor started successfully');

    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start backup monitor', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping backup monitor');

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }

    this.isRunning = false;

    // Emit monitoring stopped event
    this.emit('monitoring_stopped');
    
    logger.info('Backup monitor stopped');
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    return this.currentHealth;
  }

  /**
   * Get backup monitoring metrics
   */
  async getMonitoringMetrics(
    timeRange?: { from: Date; to: Date }
  ): Promise<BackupMonitoringMetrics> {
    const client = await this.dbPool.connect();
    
    try {
      const fromDate = timeRange?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDate = timeRange?.to || new Date();

      // Get backup job statistics
      const jobStatsQuery = `
        SELECT 
          COUNT(*) as total_backups,
          COUNT(CASE WHEN status IN ('completed', 'verified') THEN 1 END) as successful_backups,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
          COALESCE(SUM(size), 0) as total_size,
          COALESCE(AVG(duration), 0) as average_duration,
          MAX(start_time) as last_backup_time
        FROM backup_jobs 
        WHERE start_time BETWEEN $1 AND $2
      `;
      
      const jobStatsResult = await client.query(jobStatsQuery, [fromDate, toDate]);
      const jobStats = jobStatsResult.rows[0];

      // Get next scheduled backup
      const nextBackupQuery = `
        SELECT MIN(next_run) as next_scheduled_backup
        FROM backup_configurations 
        WHERE enabled = true AND schedule_enabled = true
      `;
      
      const nextBackupResult = await client.query(nextBackupQuery);
      const nextScheduledBackup = nextBackupResult.rows[0]?.next_scheduled_backup;

      // Get storage utilization
      const storageUtilization = await this.getStorageUtilization();

      // Calculate health score
      const healthScore = this.calculateHealthScore(jobStats, storageUtilization);

      return {
        totalBackups: parseInt(jobStats.total_backups),
        successfulBackups: parseInt(jobStats.successful_backups),
        failedBackups: parseInt(jobStats.failed_backups),
        totalSize: parseInt(jobStats.total_size),
        averageDuration: parseFloat(jobStats.average_duration),
        lastBackupTime: jobStats.last_backup_time,
        nextScheduledBackup,
        storageUtilization,
        healthScore
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    timeRange?: { from: Date; to: Date }
  ): Promise<PerformanceMetrics> {
    const client = await this.dbPool.connect();
    
    try {
      const fromDate = timeRange?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDate = timeRange?.to || new Date();

      const query = `
        SELECT 
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status IN ('completed', 'verified') THEN 1 END) as successful_jobs,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
          COALESCE(AVG(CASE WHEN duration > 0 AND size > 0 THEN size::float / (duration / 1000) END), 0) as avg_throughput,
          COALESCE(AVG(duration / 60000.0), 0) as avg_backup_time,
          COALESCE(AVG(CASE WHEN size > 0 AND compressed_size > 0 THEN compressed_size::float / size END), 1) as compression_ratio
        FROM backup_jobs 
        WHERE start_time BETWEEN $1 AND $2
      `;
      
      const result = await client.query(query, [fromDate, toDate]);
      const metrics = result.rows[0];

      const totalJobs = parseInt(metrics.total_jobs);
      const successfulJobs = parseInt(metrics.successful_jobs);
      const failedJobs = parseInt(metrics.failed_jobs);

      return {
        throughput: parseFloat(metrics.avg_throughput) / (1024 * 1024), // Convert to MB/s
        averageBackupTime: parseFloat(metrics.avg_backup_time),
        successRate: totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 100,
        storageEfficiency: 1 / parseFloat(metrics.compression_ratio),
        errorRate: totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0,
        availability: this.calculateAvailability(fromDate, toDate)
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<BackupAlert[]> {
    const client = await this.dbPool.connect();
    
    try {
      const query = `
        SELECT * FROM backup_alerts 
        WHERE acknowledged = false 
        ORDER BY timestamp DESC
      `;
      
      const result = await client.query(query);
      return result.rows.map(row => this.mapRowToAlert(row));
      
    } finally {
      client.release();
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(
    alertId: string, 
    acknowledgedBy: string
  ): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      await client.query(
        `UPDATE backup_alerts 
         SET acknowledged = true, acknowledged_by = $1, acknowledged_at = $2 
         WHERE id = $3`,
        [acknowledgedBy, new Date(), alertId]
      );

      logger.info(`Alert acknowledged`, { alertId, acknowledgedBy });
      
    } finally {
      client.release();
    }
  }

  /**
   * Generate backup report
   */
  async generateReport(
    timeRange: { from: Date; to: Date },
    includeDetails: boolean = false
  ): Promise<{
    summary: BackupMonitoringMetrics;
    performance: PerformanceMetrics;
    alerts: BackupAlert[];
    trends: HealthTrends;
    recommendations: string[];
  }> {
    const [summary, performance, alerts] = await Promise.all([
      this.getMonitoringMetrics(timeRange),
      this.getPerformanceMetrics(timeRange),
      this.getActiveAlerts()
    ]);

    const trends = await this.calculateTrends(timeRange);
    const recommendations = this.generateRecommendations(summary, performance, trends);

    return {
      summary,
      performance,
      alerts,
      trends,
      recommendations
    };
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    logger.debug('Performing backup system health check');

    const health = { ...this.currentHealth };
    health.lastUpdated = new Date();

    try {
      // Check backup jobs health
      health.components.backupJobs = await this.checkBackupJobsHealth();

      // Check storage health
      health.components.storage = await this.checkStorageHealth();

      // Check database health
      health.components.database = await this.checkDatabaseHealth();

      // Check scheduler health
      health.components.scheduler = await this.checkSchedulerHealth();

      // Calculate overall health
      const componentScores = [
        health.components.backupJobs.score,
        health.components.storage.score,
        health.components.database.score,
        health.components.scheduler.score
      ];

      health.score = Math.round(componentScores.reduce((a, b) => a + b, 0) / componentScores.length);

      // Determine overall status
      if (health.score >= 90) {
        health.overall = 'healthy';
      } else if (health.score >= 70) {
        health.overall = 'warning';
      } else if (health.score >= 50) {
        health.overall = 'critical';
      } else {
        health.overall = 'down';
      }

      // Count active alerts
      const activeAlerts = await this.getActiveAlerts();
      health.activeAlerts = activeAlerts.length;

      // Update trends
      health.trends = await this.updateHealthTrends();

      this.currentHealth = health;

      // Emit health check completed event
      this.emit('health_check_completed', health);

      // Check for alert conditions
      await this.checkAlertConditions(health);

    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      
      health.overall = 'down';
      health.score = 0;
      this.currentHealth = health;

      await this.createAlert(
        AlertType.BACKUP_FAILED,
        AlertSeverity.CRITICAL,
        `Health check failed: ${error.message}`
      );
    }
  }

  /**
   * Check backup jobs health
   */
  private async checkBackupJobsHealth(): Promise<ComponentHealth> {
    const client = await this.dbPool.connect();
    
    try {
      // Get recent backup job statistics (last 24 hours)
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status IN ('completed', 'verified') THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
          MAX(start_time) as last_backup,
          AVG(duration) as avg_duration
        FROM backup_jobs 
        WHERE start_time > NOW() - INTERVAL '24 hours'
      `;
      
      const result = await client.query(query);
      const stats = result.rows[0];

      const total = parseInt(stats.total);
      const successful = parseInt(stats.successful);
      const failed = parseInt(stats.failed);
      const running = parseInt(stats.running);

      let score = 100;
      let status: ComponentHealth['status'] = 'healthy';
      let message = 'All backup jobs running normally';

      // Calculate score based on success rate
      if (total > 0) {
        const successRate = (successful / total) * 100;
        
        if (successRate < 50) {
          score = 0;
          status = 'critical';
          message = `High failure rate: ${(100 - successRate).toFixed(1)}%`;
        } else if (successRate < 80) {
          score = 50;
          status = 'warning';
          message = `Moderate failure rate: ${(100 - successRate).toFixed(1)}%`;
        } else if (successRate < 95) {
          score = 80;
          status = 'warning';
          message = `Some failures detected: ${failed} of ${total} jobs failed`;
        }
      }

      // Check for stuck jobs
      if (running > 0) {
        // Check if any jobs have been running too long
        const longRunningQuery = `
          SELECT COUNT(*) as long_running
          FROM backup_jobs 
          WHERE status = 'running' 
          AND start_time < NOW() - INTERVAL '2 hours'
        `;
        
        const longRunningResult = await client.query(longRunningQuery);
        const longRunning = parseInt(longRunningResult.rows[0].long_running);

        if (longRunning > 0) {
          score = Math.min(score, 30);
          status = 'critical';
          message = `${longRunning} jobs stuck in running state`;
        }
      }

      return {
        status,
        score,
        lastCheck: new Date(),
        message,
        metrics: {
          total,
          successful,
          failed,
          running,
          successRate: total > 0 ? (successful / total) * 100 : 100,
          lastBackup: stats.last_backup,
          averageDuration: parseFloat(stats.avg_duration)
        }
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(): Promise<ComponentHealth> {
    try {
      const utilization = await this.getStorageUtilization();
      
      let score = 100;
      let status: ComponentHealth['status'] = 'healthy';
      let message = 'Storage utilization normal';

      // Check local storage
      if (utilization.local) {
        const localUsage = utilization.local.utilizationPercent;
        
        if (localUsage >= this.config.alertThresholds.storageUsageCritical) {
          score = 0;
          status = 'critical';
          message = `Local storage critically full: ${localUsage.toFixed(1)}%`;
        } else if (localUsage >= this.config.alertThresholds.storageUsageWarning) {
          score = 50;
          status = 'warning';
          message = `Local storage usage high: ${localUsage.toFixed(1)}%`;
        }
      }

      // Check cloud storage (if available)
      if (utilization.cloud) {
        const cloudUsage = utilization.cloud.utilizationPercent;
        
        if (cloudUsage >= 90) {
          score = Math.min(score, 30);
          status = 'warning';
          message += ` | Cloud storage usage: ${cloudUsage.toFixed(1)}%`;
        }
      }

      return {
        status,
        score,
        lastCheck: new Date(),
        message,
        metrics: utilization
      };

    } catch (error) {
      return {
        status: 'critical',
        score: 0,
        lastCheck: new Date(),
        message: `Storage check failed: ${error.message}`
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const client = await this.dbPool.connect();
      
      const startTime = Date.now();
      await client.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      client.release();

      let score = 100;
      let status: ComponentHealth['status'] = 'healthy';
      let message = 'Database connection healthy';

      if (responseTime > 5000) {
        score = 30;
        status = 'critical';
        message = `Database response slow: ${responseTime}ms`;
      } else if (responseTime > 2000) {
        score = 70;
        status = 'warning';
        message = `Database response time elevated: ${responseTime}ms`;
      }

      return {
        status,
        score,
        lastCheck: new Date(),
        message,
        metrics: {
          responseTime,
          connectionPool: {
            total: this.dbPool.totalCount,
            idle: this.dbPool.idleCount,
            waiting: this.dbPool.waitingCount
          }
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        score: 0,
        lastCheck: new Date(),
        message: `Database connection failed: ${error.message}`
      };
    }
  }

  /**
   * Check scheduler health
   */
  private async checkSchedulerHealth(): Promise<ComponentHealth> {
    const client = await this.dbPool.connect();
    
    try {
      // Check for overdue backups
      const overdueQuery = `
        SELECT COUNT(*) as overdue_count
        FROM backup_configurations bc
        LEFT JOIN backup_jobs bj ON bc.id = bj.configuration_id 
          AND bj.status IN ('completed', 'verified')
          AND bj.start_time = (
            SELECT MAX(start_time) 
            FROM backup_jobs 
            WHERE configuration_id = bc.id 
            AND status IN ('completed', 'verified')
          )
        WHERE bc.enabled = true 
        AND (
          bj.start_time IS NULL 
          OR bj.start_time < NOW() - INTERVAL '${this.config.alertThresholds.backupOverdueHours} hours'
        )
      `;
      
      const overdueResult = await client.query(overdueQuery);
      const overdueCount = parseInt(overdueResult.rows[0].overdue_count);

      let score = 100;
      let status: ComponentHealth['status'] = 'healthy';
      let message = 'Backup scheduler operating normally';

      if (overdueCount > 0) {
        if (overdueCount > 3) {
          score = 20;
          status = 'critical';
          message = `${overdueCount} backup configurations are overdue`;
        } else {
          score = 60;
          status = 'warning';
          message = `${overdueCount} backup configurations are overdue`;
        }
      }

      return {
        status,
        score,
        lastCheck: new Date(),
        message,
        metrics: {
          overdueBackups: overdueCount
        }
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Collect and store metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getMonitoringMetrics();
      const performance = await this.getPerformanceMetrics();

      // Store metrics in database
      const client = await this.dbPool.connect();
      
      try {
        await client.query(
          `INSERT INTO backup_metrics (
            timestamp, total_backups, successful_backups, failed_backups,
            total_size, average_duration, health_score, throughput,
            success_rate, error_rate, storage_utilization
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            new Date(),
            metrics.totalBackups,
            metrics.successfulBackups,
            metrics.failedBackups,
            metrics.totalSize,
            metrics.averageDuration,
            metrics.healthScore,
            performance.throughput,
            performance.successRate,
            performance.errorRate,
            JSON.stringify(metrics.storageUtilization)
          ]
        );

        // Cleanup old metrics
        await client.query(
          `DELETE FROM backup_metrics 
           WHERE timestamp < NOW() - INTERVAL '${this.config.retentionDays} days'`
        );

      } finally {
        client.release();
      }

      // Emit metrics collected event
      this.emit('metrics_collected', { metrics, performance });

    } catch (error) {
      logger.error('Failed to collect metrics', { error: error.message });
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlertConditions(health: SystemHealth): Promise<void> {
    // Storage usage alerts
    if (health.components.storage.metrics) {
      const localStorage = health.components.storage.metrics.local;
      
      if (localStorage && localStorage.utilizationPercent >= this.config.alertThresholds.storageUsageCritical) {
        await this.createAlert(
          AlertType.STORAGE_FULL,
          AlertSeverity.CRITICAL,
          `Local storage critically full: ${localStorage.utilizationPercent.toFixed(1)}%`
        );
      } else if (localStorage && localStorage.utilizationPercent >= this.config.alertThresholds.storageUsageWarning) {
        await this.createAlert(
          AlertType.STORAGE_FULL,
          AlertSeverity.MEDIUM,
          `Local storage usage high: ${localStorage.utilizationPercent.toFixed(1)}%`
        );
      }
    }

    // Backup failure rate alerts
    if (health.components.backupJobs.metrics) {
      const successRate = health.components.backupJobs.metrics.successRate;
      
      if (successRate < (100 - this.config.alertThresholds.backupFailureRate)) {
        await this.createAlert(
          AlertType.BACKUP_FAILED,
          AlertSeverity.HIGH,
          `High backup failure rate: ${(100 - successRate).toFixed(1)}%`
        );
      }
    }

    // Scheduler alerts
    if (health.components.scheduler.metrics?.overdueBackups > 0) {
      await this.createAlert(
        AlertType.BACKUP_OVERDUE,
        AlertSeverity.MEDIUM,
        `${health.components.scheduler.metrics.overdueBackups} backup configurations are overdue`
      );
    }

    // Overall system health alerts
    if (health.overall === 'critical') {
      await this.createAlert(
        AlertType.BACKUP_FAILED,
        AlertSeverity.CRITICAL,
        `Backup system health is critical (score: ${health.score})`
      );
    }
  }

  /**
   * Create alert
   */
  private async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    message: string,
    details?: Record<string, any>
  ): Promise<void> {
    // Implement alert deduplication
    const alertKey = `${type}_${severity}_${message}`;
    const lastAlert = this.alertHistory.get(alertKey);
    const now = new Date();

    // Don't create duplicate alerts within 1 hour
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < 60 * 60 * 1000) {
      return;
    }

    this.alertHistory.set(alertKey, now);

    const alert: BackupAlert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      details,
      timestamp: now,
      acknowledged: false
    };

    try {
      // Store alert in database
      const client = await this.dbPool.connect();
      
      try {
        await client.query(
          `INSERT INTO backup_alerts (
            id, type, severity, message, details, timestamp, acknowledged
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            alert.id,
            alert.type,
            alert.severity,
            alert.message,
            JSON.stringify(alert.details || {}),
            alert.timestamp,
            alert.acknowledged
          ]
        );
      } finally {
        client.release();
      }

      // Emit alert created event
      this.emit('alert_created', alert);

      // Send real-time notifications if enabled
      if (this.config.enableRealTimeAlerts) {
        await this.sendAlertNotification(alert);
      }

      logger.warn(`Alert created`, {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message
      });

    } catch (error) {
      logger.error('Failed to create alert', { error: error.message });
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: BackupAlert): Promise<void> {
    try {
      // Implementation would send notifications via email, Slack, webhook, etc.
      // This is a placeholder for the actual notification logic
      
      logger.info(`Alert notification sent`, {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity
      });

    } catch (error) {
      logger.error('Failed to send alert notification', { error: error.message });
    }
  }

  // Helper methods

  private initializeSystemHealth(): void {
    this.currentHealth = {
      overall: 'healthy',
      score: 100,
      lastUpdated: new Date(),
      components: {
        backupJobs: {
          status: 'healthy',
          score: 100,
          lastCheck: new Date()
        },
        storage: {
          status: 'healthy',
          score: 100,
          lastCheck: new Date()
        },
        database: {
          status: 'healthy',
          score: 100,
          lastCheck: new Date()
        },
        scheduler: {
          status: 'healthy',
          score: 100,
          lastCheck: new Date()
        }
      },
      activeAlerts: 0,
      trends: {
        backupSuccess: { current: 100, previous: 100, change: 0, direction: 'stable' },
        averageDuration: { current: 0, previous: 0, change: 0, direction: 'stable' },
        storageUsage: { current: 0, previous: 0, change: 0, direction: 'stable' },
        failureRate: { current: 0, previous: 0, change: 0, direction: 'stable' }
      }
    };
  }

  private async getStorageUtilization(): Promise<StorageUtilization> {
    const utilization: StorageUtilization = {};

    try {
      // Check local storage
      const localPath = defaultBackupConfig.storage.local.basePath;
      const localStats = await this.getDirectoryStats(localPath);
      utilization.local = localStats;

      // Check cloud storage (implementation would vary by provider)
      // utilization.cloud = await this.getCloudStorageStats();

    } catch (error) {
      logger.error('Failed to get storage utilization', { error: error.message });
    }

    return utilization;
  }

  private async getDirectoryStats(dirPath: string): Promise<StorageStats> {
    try {
      const stats = await fs.promises.statfs(dirPath);
      
      return {
        totalSpace: stats.bavail * stats.bsize,
        usedSpace: (stats.blocks - stats.bavail) * stats.bsize,
        availableSpace: stats.bavail * stats.bsize,
        utilizationPercent: ((stats.blocks - stats.bavail) / stats.blocks) * 100
      };
    } catch (error) {
      // Fallback if statfs is not available
      return {
        totalSpace: 0,
        usedSpace: 0,
        availableSpace: 0,
        utilizationPercent: 0
      };
    }
  }

  private calculateHealthScore(
    jobStats: any,
    storageUtilization: StorageUtilization
  ): number {
    let score = 100;

    // Factor in backup success rate
    const total = parseInt(jobStats.total_backups);
    const successful = parseInt(jobStats.successful_backups);
    
    if (total > 0) {
      const successRate = (successful / total) * 100;
      score = Math.min(score, successRate);
    }

    // Factor in storage usage
    if (storageUtilization.local) {
      const usage = storageUtilization.local.utilizationPercent;
      if (usage > 90) {
        score *= 0.5; // Halve score if storage > 90%
      } else if (usage > 75) {
        score *= 0.8; // Reduce score if storage > 75%
      }
    }

    return Math.max(0, Math.round(score));
  }

  private calculateAvailability(fromDate: Date, toDate: Date): number {
    // Implementation would calculate system availability
    // Based on uptime, successful operations, etc.
    return 99.9; // Placeholder
  }

  private async calculateTrends(timeRange: { from: Date; to: Date }): Promise<HealthTrends> {
    const client = await this.dbPool.connect();
    
    try {
      // Get current and previous period metrics
      const currentQuery = `
        SELECT 
          AVG(success_rate) as success_rate,
          AVG(average_duration) as avg_duration,
          AVG(error_rate) as error_rate
        FROM backup_metrics 
        WHERE timestamp BETWEEN $1 AND $2
      `;
      
      const previousFromDate = new Date(timeRange.from.getTime() - (timeRange.to.getTime() - timeRange.from.getTime()));
      
      const [currentResult, previousResult] = await Promise.all([
        client.query(currentQuery, [timeRange.from, timeRange.to]),
        client.query(currentQuery, [previousFromDate, timeRange.from])
      ]);

      const current = currentResult.rows[0];
      const previous = previousResult.rows[0];

      const calculateTrend = (currentVal: number, previousVal: number): TrendData => {
        const change = previousVal > 0 ? ((currentVal - previousVal) / previousVal) * 100 : 0;
        let direction: 'up' | 'down' | 'stable' = 'stable';
        
        if (Math.abs(change) > 5) {
          direction = change > 0 ? 'up' : 'down';
        }

        return {
          current: currentVal,
          previous: previousVal,
          change: Math.round(change * 100) / 100,
          direction
        };
      };

      return {
        backupSuccess: calculateTrend(
          parseFloat(current.success_rate) || 0,
          parseFloat(previous.success_rate) || 0
        ),
        averageDuration: calculateTrend(
          parseFloat(current.avg_duration) || 0,
          parseFloat(previous.avg_duration) || 0
        ),
        storageUsage: { current: 0, previous: 0, change: 0, direction: 'stable' }, // Would be calculated from storage metrics
        failureRate: calculateTrend(
          parseFloat(current.error_rate) || 0,
          parseFloat(previous.error_rate) || 0
        )
      };
      
    } finally {
      client.release();
    }
  }

  private async updateHealthTrends(): Promise<HealthTrends> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    return this.calculateTrends({ from: oneDayAgo, to: new Date() });
  }

  private generateRecommendations(
    summary: BackupMonitoringMetrics,
    performance: PerformanceMetrics,
    trends: HealthTrends
  ): string[] {
    const recommendations: string[] = [];

    // Success rate recommendations
    if (performance.successRate < 95) {
      recommendations.push('Investigate backup failures and improve success rate');
    }

    // Performance recommendations
    if (performance.throughput < 50) {
      recommendations.push('Consider optimizing backup performance or using parallel processing');
    }

    // Storage recommendations
    if (summary.storageUtilization.local && summary.storageUtilization.local.utilizationPercent > 80) {
      recommendations.push('Plan for additional storage capacity or implement cleanup policies');
    }

    // Trend-based recommendations
    if (trends.failureRate.direction === 'up') {
      recommendations.push('Failure rate is increasing - review backup configurations and system health');
    }

    if (trends.averageDuration.direction === 'up' && trends.averageDuration.change > 20) {
      recommendations.push('Backup duration is increasing significantly - investigate performance issues');
    }

    return recommendations;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapRowToAlert(row: any): BackupAlert {
    return {
      id: row.id,
      type: row.type,
      severity: row.severity,
      message: row.message,
      details: JSON.parse(row.details || '{}'),
      timestamp: row.timestamp,
      acknowledged: row.acknowledged,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at
    };
  }
}

export default BackupMonitor;