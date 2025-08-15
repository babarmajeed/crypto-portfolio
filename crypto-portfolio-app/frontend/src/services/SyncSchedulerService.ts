import {
  SyncConfiguration,
  SyncSchedule,
  SyncJob,
  SyncQueue,
  ScheduledExport,
  SyncType,
  JobStatus,
  JobPriority,
  QueuePriority,
  RetryPolicy,
  SyncOptions,
  ExchangeConnection,
  SyncOperation,
  SyncMetadata
} from '../types/sync.types';
import { AutoSyncService } from './AutoSyncService';

export class SyncSchedulerService {
  private scheduledConfigurations: Map<string, SyncConfiguration> = new Map();
  private activeJobs: Map<string, SyncJob> = new Map();
  private jobQueues: Map<string, SyncQueue> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private autoSyncService: AutoSyncService;
  private isRunning = false;
  private maxConcurrentJobs = 3;
  private defaultRetryPolicy: RetryPolicy = {
    maxAttempts: 3,
    backoffType: 'exponential',
    backoffDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    jitter: true
  };

  constructor() {
    this.autoSyncService = new AutoSyncService();
    this.initializeQueues();
    this.loadScheduledConfigurations();
  }

  /**
   * Initialize default job queues
   */
  private initializeQueues(): void {
    const defaultQueues: SyncQueue[] = [
      {
        id: 'high-priority',
        name: 'High Priority Sync Queue',
        status: 'active',
        jobs: [],
        workers: 2,
        concurrency: 2,
        priority: 'high',
        retryPolicy: this.defaultRetryPolicy
      },
      {
        id: 'normal-priority',
        name: 'Normal Priority Sync Queue',
        status: 'active',
        jobs: [],
        workers: 3,
        concurrency: 3,
        priority: 'normal',
        retryPolicy: this.defaultRetryPolicy
      },
      {
        id: 'low-priority',
        name: 'Low Priority Sync Queue',
        status: 'active',
        jobs: [],
        workers: 1,
        concurrency: 1,
        priority: 'low',
        retryPolicy: this.defaultRetryPolicy
      },
      {
        id: 'scheduled',
        name: 'Scheduled Sync Queue',
        status: 'active',
        jobs: [],
        workers: 2,
        concurrency: 2,
        priority: 'normal',
        retryPolicy: this.defaultRetryPolicy
      }
    ];

    defaultQueues.forEach(queue => {
      this.jobQueues.set(queue.id, queue);
    });
  }

  /**
   * Start the scheduler
   */
  async startScheduler(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('SyncScheduler started');

    // Schedule all active configurations
    this.scheduledConfigurations.forEach(config => {
      if (config.enabled && config.schedule.enabled) {
        this.scheduleConfiguration(config);
      }
    });

    // Start job processors
    this.startJobProcessors();

    // Start cleanup routine
    this.startCleanupRoutine();
  }

  /**
   * Stop the scheduler
   */
  async stopScheduler(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('SyncScheduler stopping...');

    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Cancel active jobs
    this.activeJobs.forEach(job => {
      if (job.status === 'active') {
        job.status = 'paused';
      }
    });

    console.log('SyncScheduler stopped');
  }

  /**
   * Add or update sync configuration
   */
  addSyncConfiguration(config: SyncConfiguration): void {
    this.scheduledConfigurations.set(config.id, config);
    
    // Schedule if enabled and scheduler is running
    if (config.enabled && config.schedule.enabled && this.isRunning) {
      this.scheduleConfiguration(config);
    }

    // Persist configurations
    this.saveScheduledConfigurations();
  }

  /**
   * Remove sync configuration
   */
  removeSyncConfiguration(configId: string): void {
    const config = this.scheduledConfigurations.get(configId);
    if (config) {
      // Cancel any scheduled timer
      const timerId = `config_${configId}`;
      const timer = this.timers.get(timerId);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(timerId);
      }

      // Remove from configurations
      this.scheduledConfigurations.delete(configId);
      this.saveScheduledConfigurations();
    }
  }

  /**
   * Schedule a sync configuration
   */
  private scheduleConfiguration(config: SyncConfiguration): void {
    const timerId = `config_${config.id}`;
    
    // Clear existing timer
    const existingTimer = this.timers.get(timerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (config.schedule.type === 'interval' && config.schedule.interval) {
      // Schedule interval-based sync
      const timer = setInterval(() => {
        this.queueSyncJob(config, 'scheduled');
      }, config.schedule.interval);
      
      this.timers.set(timerId, timer as any);
      
      // Update next run time
      config.nextRun = new Date(Date.now() + config.schedule.interval).toISOString();

    } else if (config.schedule.type === 'cron' && config.schedule.cronExpression) {
      // Schedule cron-based sync
      const nextRun = this.calculateNextCronRun(config.schedule.cronExpression);
      if (nextRun) {
        const delay = nextRun.getTime() - Date.now();
        
        const timer = setTimeout(() => {
          this.queueSyncJob(config, 'scheduled');
          // Reschedule for next cron run
          this.scheduleConfiguration(config);
        }, delay);
        
        this.timers.set(timerId, timer);
        config.nextRun = nextRun.toISOString();
      }
    }

    // Update configuration
    this.scheduledConfigurations.set(config.id, config);
  }

  /**
   * Queue a sync job
   */
  async queueSyncJob(
    config: SyncConfiguration, 
    trigger: 'manual' | 'scheduled' | 'event',
    priority: JobPriority = 'normal'
  ): Promise<string> {
    const jobId = this.generateJobId();
    const queueId = this.selectQueue(priority);
    
    const job: SyncJob = {
      id: jobId,
      queueId,
      type: config.options.syncType,
      priority,
      status: 'waiting',
      data: {
        configurationId: config.id,
        exchanges: config.exchanges,
        options: config.options,
        trigger,
        context: {
          scheduleId: config.schedule.type !== 'manual' ? config.id : undefined,
          scheduledAt: new Date().toISOString()
        }
      },
      attempts: 0,
      maxAttempts: this.defaultRetryPolicy.maxAttempts,
      delay: 0,
      scheduledFor: new Date().toISOString(),
      progress: 0
    };

    // Add to queue
    const queue = this.jobQueues.get(queueId);
    if (queue) {
      queue.jobs.push(job);
      this.activeJobs.set(jobId, job);
    }

    return jobId;
  }

  /**
   * Start job processors for all queues
   */
  private startJobProcessors(): void {
    this.jobQueues.forEach(queue => {
      if (queue.status === 'active') {
        this.processQueue(queue);
      }
    });
  }

  /**
   * Process jobs in a queue
   */
  private async processQueue(queue: SyncQueue): Promise<void> {
    if (!this.isRunning || queue.status !== 'active') {
      return;
    }

    const processingJobs = queue.jobs.filter(job => job.status === 'active').length;
    
    if (processingJobs >= queue.concurrency) {
      // Queue is at capacity
      setTimeout(() => this.processQueue(queue), 1000);
      return;
    }

    // Find next waiting job
    const nextJob = queue.jobs
      .filter(job => job.status === 'waiting')
      .sort((a, b) => {
        // Sort by priority first, then by scheduled time
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
      })[0];

    if (nextJob) {
      await this.processJob(nextJob);
    }

    // Continue processing after a short delay
    setTimeout(() => this.processQueue(queue), 500);
  }

  /**
   * Process individual job
   */
  private async processJob(job: SyncJob): Promise<void> {
    try {
      job.status = 'active';
      job.startedAt = new Date().toISOString();
      job.attempts++;

      // Get configuration and exchanges
      const config = this.scheduledConfigurations.get(job.data.configurationId);
      if (!config) {
        throw new Error(`Configuration ${job.data.configurationId} not found`);
      }

      // Get exchange connections (mock)
      const exchanges: ExchangeConnection[] = config.exchanges.map(exchangeId => ({
        id: exchangeId,
        name: exchangeId,
        type: exchangeId as any,
        apiKey: 'mock-key',
        apiSecret: 'mock-secret',
        isConnected: true,
        rateLimits: {
          requestsPerSecond: 10,
          requestsPerMinute: 600,
          requestsPerHour: 36000,
          interval: 1000
        },
        endpoints: {
          baseUrl: `https://api.${exchangeId}.com`,
          tradingPairs: '/trading-pairs',
          transactions: '/transactions',
          balances: '/balances',
          orderHistory: '/orders',
          deposits: '/deposits',
          withdrawals: '/withdrawals'
        },
        permissions: {
          read: true,
          trade: false,
          withdraw: false
        }
      }));

      // Start sync operation
      const syncOperation = await this.autoSyncService.startSync(
        exchanges,
        job.data.options,
        (progress) => {
          job.progress = progress.overall;
        }
      );

      // Job completed successfully
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = {
        operationId: syncOperation.id,
        status: syncOperation.status,
        recordsProcessed: syncOperation.results.processedRecords,
        errors: syncOperation.errors.length,
        conflicts: syncOperation.conflicts.length
      };

      // Update configuration last run time
      config.lastRun = new Date().toISOString();
      this.scheduledConfigurations.set(config.id, config);

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      
      job.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if should retry
      if (job.attempts < job.maxAttempts) {
        // Schedule retry
        const queue = this.jobQueues.get(job.queueId);
        const retryDelay = this.calculateRetryDelay(job.attempts, queue?.retryPolicy || this.defaultRetryPolicy);
        
        job.status = 'delayed';
        job.delay = retryDelay;
        job.scheduledFor = new Date(Date.now() + retryDelay).toISOString();
        
        setTimeout(() => {
          if (job.status === 'delayed') {
            job.status = 'waiting';
          }
        }, retryDelay);
      } else {
        // Max attempts reached
        job.status = 'failed';
        job.failedAt = new Date().toISOString();
      }
    }

    // Update job in storage
    this.activeJobs.set(job.id, job);
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private calculateRetryDelay(attempt: number, retryPolicy: RetryPolicy): number {
    let delay = retryPolicy.backoffDelay;

    switch (retryPolicy.backoffType) {
      case 'exponential':
        delay = delay * Math.pow(retryPolicy.backoffMultiplier || 2, attempt - 1);
        break;
      case 'linear':
        delay = delay * attempt;
        break;
      case 'fixed':
      default:
        // Use base delay
        break;
    }

    // Apply max delay limit
    if (retryPolicy.maxDelay && delay > retryPolicy.maxDelay) {
      delay = retryPolicy.maxDelay;
    }

    // Apply jitter if enabled
    if (retryPolicy.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * jitterAmount;
    }

    return Math.max(delay, 1000); // Minimum 1 second delay
  }

  /**
   * Select appropriate queue based on priority
   */
  private selectQueue(priority: JobPriority): string {
    switch (priority) {
      case 'urgent':
      case 'high':
        return 'high-priority';
      case 'low':
        return 'low-priority';
      case 'normal':
      default:
        return 'normal-priority';
    }
  }

  /**
   * Calculate next cron run time (simplified implementation)
   */
  private calculateNextCronRun(cronExpression: string): Date | null {
    try {
      // This is a simplified implementation
      // In a real application, you'd use a proper cron parser like 'node-cron'
      
      // Parse basic patterns like "0 */6 * * *" (every 6 hours)
      const parts = cronExpression.split(' ');
      if (parts.length !== 5) {
        console.warn('Invalid cron expression format');
        return null;
      }

      const [minute, hour, day, month, weekday] = parts;
      
      // Simple implementation for hourly intervals
      if (hour.startsWith('*/')) {
        const interval = parseInt(hour.substring(2));
        const now = new Date();
        const nextRun = new Date(now);
        nextRun.setMinutes(parseInt(minute) || 0);
        nextRun.setSeconds(0);
        nextRun.setMilliseconds(0);
        
        // If time has passed today, move to next interval
        if (nextRun <= now) {
          nextRun.setHours(nextRun.getHours() + interval);
        }
        
        return nextRun;
      }

      // For more complex patterns, return a default next hour
      const nextRun = new Date();
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(0);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      return nextRun;
    } catch (error) {
      console.error('Error parsing cron expression:', error);
      return null;
    }
  }

  /**
   * Start cleanup routine for completed jobs
   */
  private startCleanupRoutine(): void {
    const cleanup = () => {
      if (!this.isRunning) return;

      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      // Clean up old completed/failed jobs
      this.jobQueues.forEach(queue => {
        queue.jobs = queue.jobs.filter(job => {
          if (job.status === 'completed' || job.status === 'failed') {
            const completedTime = new Date(job.completedAt || job.failedAt || job.startedAt || 0).getTime();
            return (now - completedTime) < maxAge;
          }
          return true;
        });
      });

      // Remove from active jobs map
      this.activeJobs.forEach((job, jobId) => {
        if (job.status === 'completed' || job.status === 'failed') {
          const completedTime = new Date(job.completedAt || job.failedAt || job.startedAt || 0).getTime();
          if ((now - completedTime) >= maxAge) {
            this.activeJobs.delete(jobId);
          }
        }
      });

      // Schedule next cleanup
      setTimeout(cleanup, 60 * 60 * 1000); // Run every hour
    };

    // Start cleanup routine
    setTimeout(cleanup, 60 * 60 * 1000); // First run in 1 hour
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load scheduled configurations from storage
   */
  private loadScheduledConfigurations(): void {
    try {
      const stored = localStorage.getItem('sync_configurations');
      if (stored) {
        const configs: SyncConfiguration[] = JSON.parse(stored);
        configs.forEach(config => {
          this.scheduledConfigurations.set(config.id, config);
        });
      }
    } catch (error) {
      console.error('Failed to load sync configurations:', error);
    }
  }

  /**
   * Save scheduled configurations to storage
   */
  private saveScheduledConfigurations(): void {
    try {
      const configs = Array.from(this.scheduledConfigurations.values());
      localStorage.setItem('sync_configurations', JSON.stringify(configs));
    } catch (error) {
      console.error('Failed to save sync configurations:', error);
    }
  }

  // Public API methods

  /**
   * Get all sync configurations
   */
  public getSyncConfigurations(): SyncConfiguration[] {
    return Array.from(this.scheduledConfigurations.values());
  }

  /**
   * Get sync configuration by ID
   */
  public getSyncConfiguration(configId: string): SyncConfiguration | undefined {
    return this.scheduledConfigurations.get(configId);
  }

  /**
   * Update sync configuration
   */
  public updateSyncConfiguration(configId: string, updates: Partial<SyncConfiguration>): void {
    const config = this.scheduledConfigurations.get(configId);
    if (config) {
      const updatedConfig = { ...config, ...updates, updatedAt: new Date().toISOString() };
      this.addSyncConfiguration(updatedConfig);
    }
  }

  /**
   * Enable/disable sync configuration
   */
  public toggleSyncConfiguration(configId: string, enabled: boolean): void {
    const config = this.scheduledConfigurations.get(configId);
    if (config) {
      config.enabled = enabled;
      config.updatedAt = new Date().toISOString();
      
      if (enabled && config.schedule.enabled && this.isRunning) {
        this.scheduleConfiguration(config);
      } else {
        // Remove timer if disabling
        const timerId = `config_${configId}`;
        const timer = this.timers.get(timerId);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(timerId);
        }
      }
      
      this.scheduledConfigurations.set(configId, config);
      this.saveScheduledConfigurations();
    }
  }

  /**
   * Get job status
   */
  public getJobStatus(jobId: string): SyncJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  public getAllJobs(): SyncJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get jobs by status
   */
  public getJobsByStatus(status: JobStatus): SyncJob[] {
    return Array.from(this.activeJobs.values()).filter(job => job.status === status);
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): { [queueId: string]: { name: string; jobs: number; active: number; waiting: number } } {
    const status: any = {};
    
    this.jobQueues.forEach((queue, queueId) => {
      const jobs = queue.jobs;
      status[queueId] = {
        name: queue.name,
        jobs: jobs.length,
        active: jobs.filter(j => j.status === 'active').length,
        waiting: jobs.filter(j => j.status === 'waiting').length
      };
    });
    
    return status;
  }

  /**
   * Cancel job
   */
  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && (job.status === 'waiting' || job.status === 'delayed')) {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      job.failedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Trigger immediate sync
   */
  public async triggerImmediateSync(configId: string): Promise<string> {
    const config = this.scheduledConfigurations.get(configId);
    if (!config) {
      throw new Error(`Configuration ${configId} not found`);
    }
    
    return await this.queueSyncJob(config, 'manual', 'high');
  }

  /**
   * Get scheduler status
   */
  public getSchedulerStatus(): {
    running: boolean;
    configurations: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    scheduledJobs: number;
  } {
    const allJobs = Array.from(this.activeJobs.values());
    
    return {
      running: this.isRunning,
      configurations: this.scheduledConfigurations.size,
      activeJobs: allJobs.filter(j => j.status === 'active').length,
      completedJobs: allJobs.filter(j => j.status === 'completed').length,
      failedJobs: allJobs.filter(j => j.status === 'failed').length,
      scheduledJobs: allJobs.filter(j => j.status === 'waiting' || j.status === 'delayed').length
    };
  }

  /**
   * Create default sync configuration
   */
  public createDefaultSyncConfiguration(
    name: string,
    exchanges: string[],
    syncType: SyncType = 'incremental'
  ): SyncConfiguration {
    const configId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: configId,
      name,
      exchanges,
      enabled: true,
      schedule: {
        type: 'interval',
        interval: 6 * 60 * 60 * 1000, // 6 hours
        enabled: true
      },
      options: {
        syncType,
        batchSize: 100,
        maxRetries: 3,
        retryDelay: 5000,
        timeout: 30000,
        includeOrderHistory: true,
        includeDeposits: true,
        includeWithdrawals: true,
        includeTrades: true,
        conflictResolution: {
          strategy: 'exchange-priority',
          autoResolve: true,
          timestampTolerance: 60000,
          amountTolerance: 0.001,
          requireManualReview: ['balance_inconsistency']
        },
        dataValidation: {
          enabled: true,
          strict: false,
          validateAmounts: true,
          validateDates: true,
          validateAssets: true,
          allowPartialSync: true,
          maxErrorThreshold: 10
        },
        backup: {
          enabled: true,
          beforeSync: true,
          retentionDays: 30,
          compressionEnabled: true,
          encryptionEnabled: false
        },
        notifications: {
          syncComplete: false,
          syncFailed: true,
          conflictsDetected: true,
          channels: [
            {
              type: 'push',
              enabled: true,
              config: {}
            }
          ]
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

export const syncSchedulerService = new SyncSchedulerService();