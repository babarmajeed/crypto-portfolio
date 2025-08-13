import cron from 'node-cron';
import { 
  QueueName, 
  PriceUpdateJobData, 
  PortfolioCalculationJobData,
  DataSyncJobData,
  ReportGenerationJobData,
  JobPriority,
  SyncType,
  ReportType,
  ReportFormat,
  ReportPeriod
} from '../types/queue.types';
import { addJob, addRecurringJob } from '../queues';
import { logger } from '../utils/logger';

interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  queueName: QueueName;
  enabled: boolean;
  task: cron.ScheduledTask | null;
}

// Registry of scheduled jobs
const scheduledJobs = new Map<string, ScheduledJob>();

// Initialize job scheduler
export const initializeScheduler = async (): Promise<void> => {
  logger.info('Initializing job scheduler...');

  try {
    // Price update jobs
    await schedulePriceUpdates();
    
    // Portfolio calculation jobs
    await schedulePortfolioCalculations();
    
    // Data sync jobs
    await scheduleDataSync();
    
    // Report generation jobs
    await scheduleReportGeneration();
    
    // Maintenance jobs
    await scheduleMaintenanceJobs();

    logger.info(`Scheduler initialized with ${scheduledJobs.size} scheduled jobs`);
  } catch (error) {
    logger.error('Failed to initialize scheduler:', error);
    throw error;
  }
};

// Schedule price update jobs
const schedulePriceUpdates = async (): Promise<void> => {
  // Every minute - high priority symbols
  const highPriorityPriceJob = cron.schedule('* * * * *', async () => {
    const jobData: PriceUpdateJobData = {
      id: `price-update-high-${Date.now()}`,
      timestamp: new Date(),
      priority: JobPriority.HIGH,
      symbols: ['BTC', 'ETH', 'BNB', 'ADA', 'SOL'], // Top symbols
      updateAll: false
    };

    await addJob(QueueName.PRICE_UPDATE, jobData, {
      priority: JobPriority.HIGH,
      delay: 0
    });
  }, {
    scheduled: false
  });

  scheduledJobs.set('price-update-high', {
    id: 'price-update-high',
    name: 'High Priority Price Updates',
    schedule: '* * * * *',
    queueName: QueueName.PRICE_UPDATE,
    enabled: true,
    task: highPriorityPriceJob
  });

  // Every 5 minutes - all symbols
  const allPricesJob = cron.schedule('*/5 * * * *', async () => {
    const jobData: PriceUpdateJobData = {
      id: `price-update-all-${Date.now()}`,
      timestamp: new Date(),
      priority: JobPriority.MEDIUM,
      updateAll: true
    };

    await addJob(QueueName.PRICE_UPDATE, jobData, {
      priority: JobPriority.MEDIUM,
      delay: 0
    });
  }, {
    scheduled: false
  });

  scheduledJobs.set('price-update-all', {
    id: 'price-update-all',
    name: 'All Symbols Price Updates',
    schedule: '*/5 * * * *',
    queueName: QueueName.PRICE_UPDATE,
    enabled: true,
    task: allPricesJob
  });
};

// Schedule portfolio calculation jobs
const schedulePortfolioCalculations = async (): Promise<void> => {
  // Every 5 minutes - calculate all portfolios
  const portfolioCalcJob = cron.schedule('*/5 * * * *', async () => {
    // This will be enhanced to get actual user list
    const activeUsers = await getActiveUsers();
    
    for (const userId of activeUsers) {
      const jobData: PortfolioCalculationJobData = {
        id: `portfolio-calc-${userId}-${Date.now()}`,
        userId,
        timestamp: new Date(),
        priority: JobPriority.HIGH,
        calculateAll: true
      };

      await addJob(QueueName.PORTFOLIO_CALCULATION, jobData, {
        priority: JobPriority.HIGH,
        delay: Math.random() * 30000 // Spread over 30 seconds
      });
    }
  }, {
    scheduled: false
  });

  scheduledJobs.set('portfolio-calculations', {
    id: 'portfolio-calculations',
    name: 'Portfolio Calculations',
    schedule: '*/5 * * * *',
    queueName: QueueName.PORTFOLIO_CALCULATION,
    enabled: true,
    task: portfolioCalcJob
  });
};

// Schedule data synchronization jobs
const scheduleDataSync = async (): Promise<void> => {
  // Every hour - sync exchange data for active users
  const dataSyncJob = cron.schedule('0 * * * *', async () => {
    const activeUsers = await getActiveUsersWithExchanges();
    
    for (const user of activeUsers) {
      for (const exchange of user.exchanges) {
        const jobData: DataSyncJobData = {
          id: `data-sync-${user.id}-${exchange}-${Date.now()}`,
          userId: user.id,
          exchange,
          syncType: SyncType.ALL,
          timestamp: new Date(),
          priority: JobPriority.MEDIUM
        };

        await addJob(QueueName.DATA_SYNC, jobData, {
          priority: JobPriority.MEDIUM,
          delay: Math.random() * 300000 // Spread over 5 minutes
        });
      }
    }
  }, {
    scheduled: false
  });

  scheduledJobs.set('data-sync', {
    id: 'data-sync',
    name: 'Exchange Data Synchronization',
    schedule: '0 * * * *',
    queueName: QueueName.DATA_SYNC,
    enabled: true,
    task: dataSyncJob
  });
};

// Schedule report generation jobs
const scheduleReportGeneration = async (): Promise<void> => {
  // Daily reports at 6 AM
  const dailyReportsJob = cron.schedule('0 6 * * *', async () => {
    const usersWithReports = await getUsersWithDailyReports();
    
    for (const user of usersWithReports) {
      const jobData: ReportGenerationJobData = {
        id: `daily-report-${user.id}-${Date.now()}`,
        userId: user.id,
        reportType: ReportType.PORTFOLIO_SUMMARY,
        format: ReportFormat.PDF,
        period: ReportPeriod.DAILY,
        timestamp: new Date(),
        priority: JobPriority.LOW
      };

      await addJob(QueueName.REPORT_GENERATION, jobData, {
        priority: JobPriority.LOW,
        delay: Math.random() * 600000 // Spread over 10 minutes
      });
    }
  }, {
    scheduled: false
  });

  scheduledJobs.set('daily-reports', {
    id: 'daily-reports',
    name: 'Daily Portfolio Reports',
    schedule: '0 6 * * *',
    queueName: QueueName.REPORT_GENERATION,
    enabled: true,
    task: dailyReportsJob
  });

  // Weekly reports on Mondays at 7 AM
  const weeklyReportsJob = cron.schedule('0 7 * * 1', async () => {
    const usersWithReports = await getUsersWithWeeklyReports();
    
    for (const user of usersWithReports) {
      const jobData: ReportGenerationJobData = {
        id: `weekly-report-${user.id}-${Date.now()}`,
        userId: user.id,
        reportType: ReportType.PERFORMANCE_ANALYSIS,
        format: ReportFormat.PDF,
        period: ReportPeriod.WEEKLY,
        timestamp: new Date(),
        priority: JobPriority.LOW
      };

      await addJob(QueueName.REPORT_GENERATION, jobData, {
        priority: JobPriority.LOW,
        delay: Math.random() * 900000 // Spread over 15 minutes
      });
    }
  }, {
    scheduled: false
  });

  scheduledJobs.set('weekly-reports', {
    id: 'weekly-reports',
    name: 'Weekly Performance Reports',
    schedule: '0 7 * * 1',
    queueName: QueueName.REPORT_GENERATION,
    enabled: true,
    task: weeklyReportsJob
  });
};

// Schedule maintenance jobs
const scheduleMaintenanceJobs = async (): Promise<void> => {
  // Clean old completed jobs every 6 hours
  const cleanupJob = cron.schedule('0 */6 * * *', async () => {
    logger.info('Running scheduled queue cleanup');
    // This would call the cleanup functions from queue management
  }, {
    scheduled: false
  });

  scheduledJobs.set('queue-cleanup', {
    id: 'queue-cleanup',
    name: 'Queue Cleanup',
    schedule: '0 */6 * * *',
    queueName: QueueName.PRICE_UPDATE, // Dummy queue for registry
    enabled: true,
    task: cleanupJob
  });
};

// Start all scheduled jobs
export const startScheduler = (): void => {
  logger.info('Starting scheduled jobs...');
  
  for (const [jobId, job] of scheduledJobs) {
    if (job.enabled && job.task) {
      job.task.start();
      logger.info(`Started scheduled job: ${job.name}`);
    }
  }
  
  logger.info(`${scheduledJobs.size} scheduled jobs started`);
};

// Stop all scheduled jobs
export const stopScheduler = (): void => {
  logger.info('Stopping scheduled jobs...');
  
  for (const [jobId, job] of scheduledJobs) {
    if (job.task) {
      job.task.stop();
      logger.info(`Stopped scheduled job: ${job.name}`);
    }
  }
  
  logger.info('All scheduled jobs stopped');
};

// Enable/disable specific job
export const toggleScheduledJob = (jobId: string, enabled: boolean): void => {
  const job = scheduledJobs.get(jobId);
  if (!job || !job.task) {
    throw new Error(`Scheduled job ${jobId} not found`);
  }

  job.enabled = enabled;
  if (enabled) {
    job.task.start();
    logger.info(`Enabled scheduled job: ${job.name}`);
  } else {
    job.task.stop();
    logger.info(`Disabled scheduled job: ${job.name}`);
  }
};

// Get scheduled job status
export const getScheduledJobs = (): any[] => {
  return Array.from(scheduledJobs.values()).map(job => ({
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    queueName: job.queueName,
    enabled: job.enabled,
    running: job.task?.running || false
  }));
};

// Helper functions (these would normally query the database)
async function getActiveUsers(): Promise<string[]> {
  // Mock implementation - replace with actual database query
  return ['user1', 'user2', 'user3'];
}

async function getActiveUsersWithExchanges(): Promise<Array<{id: string, exchanges: string[]}>> {
  // Mock implementation - replace with actual database query
  return [
    { id: 'user1', exchanges: ['binance', 'coinbase'] },
    { id: 'user2', exchanges: ['kraken'] },
    { id: 'user3', exchanges: ['binance', 'kucoin'] }
  ];
}

async function getUsersWithDailyReports(): Promise<Array<{id: string}>> {
  // Mock implementation - replace with actual database query
  return [
    { id: 'user1' },
    { id: 'user2' }
  ];
}

async function getUsersWithWeeklyReports(): Promise<Array<{id: string}>> {
  // Mock implementation - replace with actual database query
  return [
    { id: 'user1' },
    { id: 'user3' }
  ];
}

// Graceful shutdown
export const shutdownScheduler = (): void => {
  stopScheduler();
  scheduledJobs.clear();
  logger.info('Scheduler shut down successfully');
};