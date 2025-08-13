import cluster from 'cluster';
import os from 'os';
import { QueueName, WorkerConfig, WorkerStatus } from '../types/queue.types';
import { getQueue } from '../queues';
import { processPriceUpdateJob } from '../jobs/priceUpdateJob';
import { processPortfolioCalculationJob } from '../jobs/portfolioCalculationJob';
import { processEmailNotificationJob } from '../jobs/emailNotificationJob';
import { processDataSyncJob } from '../jobs/dataSyncJob';
import { processReportGenerationJob } from '../jobs/reportGenerationJob';
import { logger } from '../utils/logger';

// Worker configurations
const workerConfigs: WorkerConfig[] = [
  {
    queueName: QueueName.PRICE_UPDATE,
    concurrency: 5,
    maxStalledCount: 1,
    stalledInterval: 30000,
    maxFailedAttempts: 3
  },
  {
    queueName: QueueName.PORTFOLIO_CALCULATION,
    concurrency: 3,
    maxStalledCount: 1,
    stalledInterval: 30000,
    maxFailedAttempts: 3
  },
  {
    queueName: QueueName.EMAIL_NOTIFICATION,
    concurrency: 10,
    maxStalledCount: 2,
    stalledInterval: 60000,
    maxFailedAttempts: 5
  },
  {
    queueName: QueueName.DATA_SYNC,
    concurrency: 3,
    maxStalledCount: 1,
    stalledInterval: 60000,
    maxFailedAttempts: 5
  },
  {
    queueName: QueueName.REPORT_GENERATION,
    concurrency: 2,
    maxStalledCount: 1,
    stalledInterval: 120000,
    maxFailedAttempts: 3
  }
];

// Worker registry
export const workers = new Map<string, any>();
export const workerStats = new Map<string, any>();

// Initialize workers based on environment
export const initializeWorkers = async (): Promise<void> => {
  const numCPUs = os.cpus().length;
  const maxWorkers = parseInt(process.env.MAX_WORKERS || String(Math.max(2, numCPUs - 1)));
  
  if (cluster.isPrimary) {
    logger.info(`Starting worker cluster with ${maxWorkers} processes`);
    
    // Fork workers
    for (let i = 0; i < maxWorkers; i++) {
      const worker = cluster.fork();
      workers.set(worker.id.toString(), {
        id: worker.id,
        process: worker,
        status: WorkerStatus.IDLE,
        startTime: new Date(),
        jobsProcessed: 0,
        lastActivity: new Date()
      });
    }

    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
      workers.delete(worker.id.toString());
      
      // Restart worker if it wasn't intentionally killed
      if (code !== 0 && !worker.exitedAfterDisconnect) {
        logger.info('Starting a new worker');
        const newWorker = cluster.fork();
        workers.set(newWorker.id.toString(), {
          id: newWorker.id,
          process: newWorker,
          status: WorkerStatus.IDLE,
          startTime: new Date(),
          jobsProcessed: 0,
          lastActivity: new Date()
        });
      }
    });

    cluster.on('online', (worker) => {
      logger.info(`Worker ${worker.process.pid} is online`);
    });

    // Setup graceful shutdown
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } else {
    // Worker process - setup job processors
    await setupJobProcessors();
  }
};

// Setup job processors for worker processes
const setupJobProcessors = async (): Promise<void> => {
  logger.info(`Worker ${process.pid} setting up job processors`);

  for (const config of workerConfigs) {
    const queue = getQueue(config.queueName);
    
    // Get appropriate job processor
    const processor = getJobProcessor(config.queueName);
    
    // Process jobs with concurrency
    queue.process(config.concurrency, processor);

    // Setup error handling
    queue.on('error', (error) => {
      logger.error(`Queue ${config.queueName} error in worker ${process.pid}:`, error);
    });

    queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled in queue ${config.queueName} worker ${process.pid}`);
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed in queue ${config.queueName} worker ${process.pid}:`, error);
    });

    queue.on('completed', (job, result) => {
      logger.debug(`Job ${job.id} completed in queue ${config.queueName} worker ${process.pid}`);
      updateWorkerStats(process.pid.toString(), 'job_completed');
    });

    logger.info(`Worker ${process.pid} setup for queue ${config.queueName} with concurrency ${config.concurrency}`);
  }
};

// Get job processor function for queue
const getJobProcessor = (queueName: QueueName) => {
  switch (queueName) {
    case QueueName.PRICE_UPDATE:
      return processPriceUpdateJob;
    case QueueName.PORTFOLIO_CALCULATION:
      return processPortfolioCalculationJob;
    case QueueName.EMAIL_NOTIFICATION:
      return processEmailNotificationJob;
    case QueueName.DATA_SYNC:
      return processDataSyncJob;
    case QueueName.REPORT_GENERATION:
      return processReportGenerationJob;
    default:
      throw new Error(`No processor found for queue: ${queueName}`);
  }
};

// Update worker statistics
const updateWorkerStats = (workerId: string, event: string): void => {
  const stats = workerStats.get(workerId) || {
    jobsProcessed: 0,
    lastActivity: new Date(),
    events: {}
  };

  stats.jobsProcessed++;
  stats.lastActivity = new Date();
  stats.events[event] = (stats.events[event] || 0) + 1;

  workerStats.set(workerId, stats);
};

// Get worker statistics
export const getWorkerStats = (): any[] => {
  const stats = [];
  
  for (const [workerId, worker] of workers) {
    const workerStat = workerStats.get(workerId) || {};
    stats.push({
      workerId,
      pid: worker.process?.pid,
      status: worker.status,
      startTime: worker.startTime,
      jobsProcessed: workerStat.jobsProcessed || 0,
      lastActivity: workerStat.lastActivity || worker.startTime,
      uptime: Date.now() - worker.startTime.getTime()
    });
  }

  return stats;
};

// Health check for workers
export const healthCheck = (): { healthy: boolean; workers: any[] } => {
  const workerList = getWorkerStats();
  const healthyWorkers = workerList.filter(w => 
    w.status !== WorkerStatus.ERROR && 
    (Date.now() - new Date(w.lastActivity).getTime()) < 300000 // 5 minutes
  );

  return {
    healthy: healthyWorkers.length > 0,
    workers: workerList
  };
};

// Graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
  logger.info('Initiating graceful shutdown of workers...');

  if (cluster.isPrimary) {
    // Close all workers
    for (const [workerId, worker] of workers) {
      logger.info(`Shutting down worker ${workerId}`);
      worker.process.disconnect();
    }

    // Wait for workers to exit
    await new Promise((resolve) => {
      const checkWorkers = setInterval(() => {
        if (workers.size === 0) {
          clearInterval(checkWorkers);
          resolve(void 0);
        }
      }, 100);
    });

    logger.info('All workers shut down successfully');
  } else {
    // Worker process shutdown
    logger.info(`Worker ${process.pid} shutting down...`);
    process.exit(0);
  }
};

// Scale workers up or down
export const scaleWorkers = async (targetCount: number): Promise<void> => {
  if (!cluster.isPrimary) {
    throw new Error('Worker scaling can only be done from master process');
  }

  const currentCount = workers.size;
  
  if (targetCount > currentCount) {
    // Scale up
    const toAdd = targetCount - currentCount;
    logger.info(`Scaling up workers by ${toAdd}`);
    
    for (let i = 0; i < toAdd; i++) {
      const worker = cluster.fork();
      workers.set(worker.id.toString(), {
        id: worker.id,
        process: worker,
        status: WorkerStatus.IDLE,
        startTime: new Date(),
        jobsProcessed: 0,
        lastActivity: new Date()
      });
    }
  } else if (targetCount < currentCount) {
    // Scale down
    const toRemove = currentCount - targetCount;
    logger.info(`Scaling down workers by ${toRemove}`);
    
    const workerIds = Array.from(workers.keys()).slice(0, toRemove);
    for (const workerId of workerIds) {
      const worker = workers.get(workerId);
      if (worker) {
        worker.process.disconnect();
        workers.delete(workerId);
      }
    }
  }
};

// Export worker configurations for reference
export { workerConfigs };