/**
 * Automated backup scheduling with node-cron
 * Manages multiple backup schedules, verification, and cleanup jobs
 */

import cron from 'node-cron';
import { Pool } from 'pg';
import { 
  BackupConfiguration, 
  BackupType, 
  BackupJobStatus,
  AlertType,
  AlertSeverity 
} from '../types/backup.types';
import { backupSchedules, defaultBackupConfig } from '../config/backup.config';
import BackupService from '../services/backupService';
import { EncryptionUtils } from '../utils/encryptionUtils';
import { logger } from '../utils/logger';

export interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  task: cron.ScheduledTask;
  configurationId: string;
  type: 'backup' | 'verification' | 'cleanup' | 'health_check';
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  failureCount: number;
  maxFailures: number;
}

export interface SchedulerMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageRunTime: number;
  lastRunTime?: Date;
  healthScore: number;
}

export class BackupScheduler {
  private dbPool: Pool;
  private backupService: BackupService;
  private encryptionUtils: EncryptionUtils;
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private isRunning: boolean = false;
  private metrics: SchedulerMetrics;

  constructor(dbPool: Pool, backupService: BackupService, encryptionUtils: EncryptionUtils) {
    this.dbPool = dbPool;
    this.backupService = backupService;
    this.encryptionUtils = encryptionUtils;
    this.initializeMetrics();
  }

  /**
   * Start the backup scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Backup scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting backup scheduler');

    try {
      // Load existing backup configurations
      await this.loadBackupConfigurations();

      // Schedule default backup jobs
      await this.scheduleDefaultJobs();

      // Schedule maintenance jobs
      await this.scheduleMaintenanceJobs();

      // Start health monitoring
      this.scheduleHealthCheck();

      logger.info('Backup scheduler started successfully', {
        scheduledJobs: this.scheduledJobs.size
      });

    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start backup scheduler', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the backup scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping backup scheduler');

    // Stop all scheduled jobs
    for (const [jobId, job] of this.scheduledJobs) {
      if (job.task) {
        job.task.stop();
      }
    }

    this.scheduledJobs.clear();
    this.isRunning = false;

    logger.info('Backup scheduler stopped');
  }

  /**
   * Add a new backup configuration to the scheduler
   */
  async addBackupConfiguration(configuration: BackupConfiguration): Promise<void> {
    if (!configuration.schedule.enabled) {
      logger.info(`Backup configuration ${configuration.id} is disabled, skipping scheduling`);
      return;
    }

    const jobId = `backup_${configuration.id}`;
    
    // Remove existing job if present
    await this.removeJob(jobId);

    try {
      const task = cron.schedule(
        configuration.schedule.expression,
        async () => {
          await this.executeBackupJob(configuration);
        },
        {
          scheduled: false,
          timezone: configuration.schedule.timezone || 'UTC'
        }
      );

      const scheduledJob: ScheduledJob = {
        id: jobId,
        name: `Backup: ${configuration.name}`,
        schedule: configuration.schedule.expression,
        task,
        configurationId: configuration.id,
        type: 'backup',
        enabled: true,
        failureCount: 0,
        maxFailures: 3,
        nextRun: this.getNextRunTime(configuration.schedule.expression)
      };

      this.scheduledJobs.set(jobId, scheduledJob);
      
      if (this.isRunning) {
        task.start();
      }

      logger.info(`Backup configuration scheduled`, {
        configurationId: configuration.id,
        schedule: configuration.schedule.expression,
        nextRun: scheduledJob.nextRun
      });

    } catch (error) {
      logger.error(`Failed to schedule backup configuration ${configuration.id}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove a backup configuration from the scheduler
   */
  async removeBackupConfiguration(configurationId: string): Promise<void> {
    const jobId = `backup_${configurationId}`;
    await this.removeJob(jobId);
    
    logger.info(`Backup configuration removed from scheduler`, { configurationId });
  }

  /**
   * Update backup configuration schedule
   */
  async updateBackupConfiguration(configuration: BackupConfiguration): Promise<void> {
    await this.removeBackupConfiguration(configuration.id);
    
    if (configuration.schedule.enabled) {
      await this.addBackupConfiguration(configuration);
    }
  }

  /**
   * Get scheduler status and metrics
   */
  getStatus(): {
    isRunning: boolean;
    jobs: ScheduledJob[];
    metrics: SchedulerMetrics;
  } {
    return {
      isRunning: this.isRunning,
      jobs: Array.from(this.scheduledJobs.values()),
      metrics: this.metrics
    };
  }

  /**
   * Manually trigger a backup job
   */
  async triggerBackup(configurationId: string): Promise<string> {
    const configuration = await this.getBackupConfiguration(configurationId);
    
    if (!configuration) {
      throw new Error(`Backup configuration not found: ${configurationId}`);
    }

    logger.info(`Manually triggering backup for configuration ${configurationId}`);
    
    const job = await this.executeBackupJob(configuration);
    return job.id;
  }

  /**
   * Get next scheduled run times
   */
  getNextRunTimes(): Array<{ jobId: string; name: string; nextRun: Date | undefined }> {
    return Array.from(this.scheduledJobs.values()).map(job => ({
      jobId: job.id,
      name: job.name,
      nextRun: job.nextRun
    }));
  }

  /**
   * Load backup configurations from database
   */
  private async loadBackupConfigurations(): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      const query = `
        SELECT * FROM backup_configurations 
        WHERE enabled = true AND schedule_enabled = true
      `;
      
      const result = await client.query(query);
      
      for (const row of result.rows) {
        const configuration = this.mapRowToConfiguration(row);
        await this.addBackupConfiguration(configuration);
      }

      logger.info(`Loaded ${result.rows.length} backup configurations`);
      
    } finally {
      client.release();
    }
  }

  /**
   * Schedule default backup jobs
   */
  private async scheduleDefaultJobs(): Promise<void> {
    // Daily full backup
    await this.scheduleJob(
      'daily_full_backup',
      'Daily Full Backup',
      backupSchedules.full.daily,
      () => this.executeDefaultBackup(BackupType.FULL),
      'backup'
    );

    // Hourly incremental backup during business hours
    await this.scheduleJob(
      'hourly_incremental',
      'Hourly Incremental Backup',
      backupSchedules.incremental.businessHours,
      () => this.executeDefaultBackup(BackupType.INCREMENTAL),
      'backup'
    );

    // Weekly schema backup
    await this.scheduleJob(
      'weekly_schema',
      'Weekly Schema Backup',
      backupSchedules.schema.weekly,
      () => this.executeDefaultBackup(BackupType.SCHEMA_ONLY),
      'backup'
    );
  }

  /**
   * Schedule maintenance jobs
   */
  private async scheduleMaintenanceJobs(): Promise<void> {
    // Daily backup verification
    await this.scheduleJob(
      'daily_verification',
      'Daily Backup Verification',
      backupSchedules.verification.daily,
      () => this.executeVerificationJob(),
      'verification'
    );

    // Daily cleanup job
    await this.scheduleJob(
      'daily_cleanup',
      'Daily Backup Cleanup',
      backupSchedules.cleanup.daily,
      () => this.executeCleanupJob(),
      'cleanup'
    );

    // Export cleanup (twice daily)
    await this.scheduleJob(
      'export_cleanup',
      'Export Cleanup',
      '0 */12 * * *', // Every 12 hours
      () => this.executeExportCleanup(),
      'cleanup'
    );
  }

  /**
   * Schedule health check monitoring
   */
  private scheduleHealthCheck(): void {
    // Check scheduler health every 5 minutes
    const healthCheckJob = cron.schedule(
      '*/5 * * * *',
      async () => {
        await this.performHealthCheck();
      },
      { scheduled: false }
    );

    const scheduledJob: ScheduledJob = {
      id: 'health_check',
      name: 'Scheduler Health Check',
      schedule: '*/5 * * * *',
      task: healthCheckJob,
      configurationId: 'system',
      type: 'health_check',
      enabled: true,
      failureCount: 0,
      maxFailures: 5
    };

    this.scheduledJobs.set('health_check', scheduledJob);
    
    if (this.isRunning) {
      healthCheckJob.start();
    }
  }

  /**
   * Schedule a generic job
   */
  private async scheduleJob(
    jobId: string,
    name: string,
    schedule: string,
    task: () => Promise<void>,
    type: ScheduledJob['type']
  ): Promise<void> {
    const cronTask = cron.schedule(
      schedule,
      async () => {
        const job = this.scheduledJobs.get(jobId);
        if (!job) return;

        try {
          job.lastRun = new Date();
          await task();
          job.failureCount = 0;
          this.updateMetrics('success');
        } catch (error) {
          job.failureCount++;
          this.updateMetrics('failure');
          
          logger.error(`Scheduled job ${jobId} failed`, {
            error: error.message,
            failureCount: job.failureCount
          });

          if (job.failureCount >= job.maxFailures) {
            logger.error(`Job ${jobId} disabled after ${job.maxFailures} failures`);
            job.enabled = false;
            cronTask.stop();
            await this.sendAlert(AlertType.BACKUP_FAILED, AlertSeverity.HIGH, 
              `Job ${name} has been disabled after ${job.maxFailures} consecutive failures`);
          }
        }
      },
      { scheduled: false }
    );

    const scheduledJob: ScheduledJob = {
      id: jobId,
      name,
      schedule,
      task: cronTask,
      configurationId: 'default',
      type,
      enabled: true,
      failureCount: 0,
      maxFailures: 3,
      nextRun: this.getNextRunTime(schedule)
    };

    this.scheduledJobs.set(jobId, scheduledJob);
    
    if (this.isRunning) {
      cronTask.start();
    }

    logger.info(`Scheduled job: ${name}`, { schedule, nextRun: scheduledJob.nextRun });
  }

  /**
   * Execute backup job for a configuration
   */
  private async executeBackupJob(configuration: BackupConfiguration): Promise<any> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing backup job for configuration ${configuration.id}`);
      
      const job = await this.backupService.createBackup(configuration);
      
      const duration = Date.now() - startTime;
      this.updateMetrics('success', duration);
      
      // Update last run time for configuration
      await this.updateConfigurationLastRun(configuration.id);
      
      logger.info(`Backup job completed successfully`, {
        configurationId: configuration.id,
        jobId: job.id,
        duration
      });

      return job;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics('failure', duration);
      
      logger.error(`Backup job failed for configuration ${configuration.id}`, {
        error: error.message,
        duration
      });

      await this.sendAlert(
        AlertType.BACKUP_FAILED,
        AlertSeverity.HIGH,
        `Backup failed for configuration ${configuration.name}: ${error.message}`
      );

      throw error;
    }
  }

  /**
   * Execute default backup
   */
  private async executeDefaultBackup(type: BackupType): Promise<void> {
    const defaultConfiguration: BackupConfiguration = {
      id: `default_${type.toLowerCase()}`,
      name: `Default ${type} Backup`,
      description: `Automated ${type} backup`,
      enabled: true,
      schedule: {
        type: 'cron',
        expression: this.getScheduleForBackupType(type),
        enabled: true
      },
      type,
      target: {
        type: 'database',
        database: {
          host: defaultBackupConfig.database.host,
          port: defaultBackupConfig.database.port,
          database: defaultBackupConfig.database.database,
          username: defaultBackupConfig.database.username,
          password: defaultBackupConfig.database.password
        }
      },
      storage: {
        primary: {
          type: 'local',
          local: defaultBackupConfig.storage.local
        },
        secondary: {
          type: 's3',
          s3: defaultBackupConfig.storage.s3
        }
      },
      retention: defaultBackupConfig.retention,
      encryption: defaultBackupConfig.encryption,
      compression: defaultBackupConfig.compression,
      verification: {
        enabled: true,
        checksumAlgorithm: 'SHA-256',
        integrityCheck: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.executeBackupJob(defaultConfiguration);
  }

  /**
   * Execute verification job
   */
  private async executeVerificationJob(): Promise<void> {
    logger.info('Executing backup verification job');
    
    const client = await this.dbPool.connect();
    
    try {
      // Get recent unverified backups
      const query = `
        SELECT * FROM backup_jobs 
        WHERE status = 'completed' 
        AND verification IS NULL 
        AND start_time > NOW() - INTERVAL '24 hours'
        ORDER BY start_time DESC
        LIMIT 10
      `;
      
      const result = await client.query(query);
      
      for (const row of result.rows) {
        try {
          const job = this.mapRowToBackupJob(row);
          const configuration = await this.getBackupConfiguration(job.configurationId);
          
          if (configuration && configuration.verification.enabled) {
            // Verification logic would be implemented here
            logger.info(`Verifying backup job ${job.id}`);
            // The actual verification would be done by the backup service
          }
        } catch (error) {
          logger.error(`Failed to verify backup job ${row.id}`, { error: error.message });
        }
      }

      logger.info(`Verification job completed for ${result.rows.length} backups`);
      
    } finally {
      client.release();
    }
  }

  /**
   * Execute cleanup job
   */
  private async executeCleanupJob(): Promise<void> {
    logger.info('Executing backup cleanup job');
    
    const client = await this.dbPool.connect();
    
    try {
      // Get all backup configurations
      const configQuery = 'SELECT id FROM backup_configurations WHERE enabled = true';
      const configResult = await client.query(configQuery);
      
      let totalCleaned = 0;
      
      for (const row of configResult.rows) {
        const cleaned = await this.backupService.cleanupOldBackups(row.id);
        totalCleaned += cleaned;
      }

      logger.info(`Cleanup job completed`, { totalCleaned });
      
    } finally {
      client.release();
    }
  }

  /**
   * Execute export cleanup
   */
  private async executeExportCleanup(): Promise<void> {
    logger.info('Executing export cleanup job');
    
    // This would integrate with the UserDataExportService
    // const exportService = new UserDataExportService(this.dbPool, this.encryptionUtils);
    // const cleaned = await exportService.cleanupExpiredExports();
    
    // logger.info(`Export cleanup completed`, { cleaned });
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check database connectivity
      const client = await this.dbPool.connect();
      await client.query('SELECT 1');
      client.release();

      // Check disk space
      const diskUsage = await this.checkDiskSpace();
      if (diskUsage > defaultBackupConfig.storage.local.diskSpaceThreshold) {
        await this.sendAlert(
          AlertType.STORAGE_FULL,
          AlertSeverity.HIGH,
          `Disk usage is at ${diskUsage}%`
        );
      }

      // Check for overdue backups
      await this.checkOverdueBackups();

      // Update health score
      this.calculateHealthScore();

    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      
      await this.sendAlert(
        AlertType.BACKUP_FAILED,
        AlertSeverity.CRITICAL,
        `Backup scheduler health check failed: ${error.message}`
      );
    }
  }

  /**
   * Check for overdue backups
   */
  private async checkOverdueBackups(): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      const query = `
        SELECT bc.id, bc.name, 
               COALESCE(MAX(bj.start_time), bc.created_at) as last_backup
        FROM backup_configurations bc
        LEFT JOIN backup_jobs bj ON bc.id = bj.configuration_id 
          AND bj.status IN ('completed', 'verified')
        WHERE bc.enabled = true
        GROUP BY bc.id, bc.name, bc.created_at
        HAVING COALESCE(MAX(bj.start_time), bc.created_at) < NOW() - INTERVAL '6 hours'
      `;
      
      const result = await client.query(query);
      
      for (const row of result.rows) {
        await this.sendAlert(
          AlertType.BACKUP_OVERDUE,
          AlertSeverity.MEDIUM,
          `Backup configuration "${row.name}" is overdue. Last backup: ${row.last_backup}`
        );
      }
      
    } finally {
      client.release();
    }
  }

  /**
   * Check disk space usage
   */
  private async checkDiskSpace(): Promise<number> {
    // Implementation would check actual disk usage
    // For now, return a mock value
    return 75; // 75% usage
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(): void {
    const totalJobs = this.scheduledJobs.size;
    const activeJobs = Array.from(this.scheduledJobs.values()).filter(job => job.enabled).length;
    const failedJobs = Array.from(this.scheduledJobs.values()).filter(job => job.failureCount > 0).length;
    
    let healthScore = 100;
    
    if (totalJobs === 0) {
      healthScore = 0;
    } else {
      // Reduce score based on failed/disabled jobs
      const failureRatio = failedJobs / totalJobs;
      const disabledRatio = (totalJobs - activeJobs) / totalJobs;
      
      healthScore -= (failureRatio * 50); // Up to 50 points for failures
      healthScore -= (disabledRatio * 30); // Up to 30 points for disabled jobs
    }
    
    this.metrics.healthScore = Math.max(0, Math.round(healthScore));
  }

  /**
   * Send alert notification
   */
  private async sendAlert(
    type: AlertType,
    severity: AlertSeverity,
    message: string
  ): Promise<void> {
    try {
      // Implementation would send actual alerts via email, Slack, etc.
      logger.warn(`ALERT [${severity}] ${type}: ${message}`);
      
      // Store alert in database
      const client = await this.dbPool.connect();
      
      try {
        await client.query(
          `INSERT INTO backup_alerts (type, severity, message, timestamp) 
           VALUES ($1, $2, $3, $4)`,
          [type, severity, message, new Date()]
        );
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to send alert', { error: error.message });
    }
  }

  /**
   * Remove a scheduled job
   */
  private async removeJob(jobId: string): Promise<void> {
    const existingJob = this.scheduledJobs.get(jobId);
    
    if (existingJob) {
      existingJob.task.stop();
      this.scheduledJobs.delete(jobId);
      logger.info(`Removed scheduled job: ${jobId}`);
    }
  }

  /**
   * Get next run time for cron expression
   */
  private getNextRunTime(cronExpression: string): Date | undefined {
    try {
      const task = cron.schedule(cronExpression, () => {}, { scheduled: false });
      // This is a simplified implementation
      // In reality, you'd use a proper cron parser to get the next execution time
      return new Date(Date.now() + 60000); // Next minute as placeholder
    } catch {
      return undefined;
    }
  }

  /**
   * Get schedule expression for backup type
   */
  private getScheduleForBackupType(type: BackupType): string {
    switch (type) {
      case BackupType.FULL:
        return backupSchedules.full.daily;
      case BackupType.INCREMENTAL:
        return backupSchedules.incremental.hourly;
      case BackupType.SCHEMA_ONLY:
        return backupSchedules.schema.weekly;
      default:
        return backupSchedules.full.daily;
    }
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageRunTime: 0,
      healthScore: 100
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(result: 'success' | 'failure', duration?: number): void {
    this.metrics.totalJobs++;
    
    if (result === 'success') {
      this.metrics.completedJobs++;
    } else {
      this.metrics.failedJobs++;
    }
    
    if (duration) {
      this.metrics.averageRunTime = 
        (this.metrics.averageRunTime + duration) / 2;
    }
    
    this.metrics.lastRunTime = new Date();
    this.metrics.activeJobs = Array.from(this.scheduledJobs.values())
      .filter(job => job.enabled).length;
  }

  // Database helper methods
  private async getBackupConfiguration(configurationId: string): Promise<BackupConfiguration | null> {
    const client = await this.dbPool.connect();
    
    try {
      const query = 'SELECT * FROM backup_configurations WHERE id = $1';
      const result = await client.query(query, [configurationId]);
      
      return result.rows[0] ? this.mapRowToConfiguration(result.rows[0]) : null;
      
    } finally {
      client.release();
    }
  }

  private async updateConfigurationLastRun(configurationId: string): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      await client.query(
        'UPDATE backup_configurations SET last_run = $1 WHERE id = $2',
        [new Date(), configurationId]
      );
    } finally {
      client.release();
    }
  }

  private mapRowToConfiguration(row: any): BackupConfiguration {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      schedule: JSON.parse(row.schedule),
      type: row.type,
      target: JSON.parse(row.target),
      storage: JSON.parse(row.storage),
      retention: JSON.parse(row.retention),
      encryption: JSON.parse(row.encryption),
      compression: JSON.parse(row.compression),
      verification: JSON.parse(row.verification),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToBackupJob(row: any): any {
    return {
      id: row.id,
      configurationId: row.configuration_id,
      status: row.status,
      type: row.type,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      size: row.size,
      location: row.location,
      checksum: row.checksum,
      error: row.error,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
}

export default BackupScheduler;