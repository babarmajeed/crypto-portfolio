import Bull from 'bull';
import { QueueName, QueueConfig, JobPriority } from '../types/queue.types';
import { redisService } from '../services/redisService';
import { logger } from '../utils/logger';

// Queue configurations
const queueConfigs: QueueConfig[] = [
  {
    name: QueueName.PRICE_UPDATE,
    concurrency: 5,
    priority: JobPriority.HIGH,
    retryAttempts: 3,
    retryDelay: 5000,
    removeOnComplete: 100,
    removeOnFail: 50
  },
  {
    name: QueueName.PORTFOLIO_CALCULATION,
    concurrency: 3,
    priority: JobPriority.HIGH,
    retryAttempts: 3,
    retryDelay: 10000,
    removeOnComplete: 100,
    removeOnFail: 50
  },
  {
    name: QueueName.EMAIL_NOTIFICATION,
    concurrency: 10,
    priority: JobPriority.MEDIUM,
    retryAttempts: 5,
    retryDelay: 30000,
    removeOnComplete: 200,
    removeOnFail: 100
  },
  {
    name: QueueName.DATA_SYNC,
    concurrency: 3,
    priority: JobPriority.MEDIUM,
    retryAttempts: 5,
    retryDelay: 60000,
    removeOnComplete: 50,
    removeOnFail: 25
  },
  {
    name: QueueName.REPORT_GENERATION,
    concurrency: 2,
    priority: JobPriority.LOW,
    retryAttempts: 3,
    retryDelay: 120000,
    removeOnComplete: 25,
    removeOnFail: 10
  }
];

// Queue instances
export const queues = new Map<QueueName, Bull.Queue>();

// Initialize all queues
export const initializeQueues = async (): Promise<void> => {
  try {
    logger.info('Initializing job queues...');

    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_QUEUE_DB || '1'),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    };

    for (const config of queueConfigs) {
      const queue = new Bull(config.name, {
        redis: redisConfig,
        defaultJobOptions: {
          attempts: config.retryAttempts,
          backoff: {
            type: 'exponential',
            delay: config.retryDelay
          },
          removeOnComplete: config.removeOnComplete,
          removeOnFail: config.removeOnFail
        },
        settings: {
          stalledInterval: 30000,
          maxStalledCount: 1,
          retryProcessDelay: 5000
        }
      });

      // Add event listeners
      queue.on('error', (error) => {
        logger.error(`Queue ${config.name} error:`, error);
      });

      queue.on('waiting', (jobId) => {
        logger.debug(`Job ${jobId} waiting in queue ${config.name}`);
      });

      queue.on('active', (job) => {
        logger.debug(`Job ${job.id} started in queue ${config.name}`);
      });

      queue.on('completed', (job, result) => {
        logger.info(`Job ${job.id} completed in queue ${config.name}`, { result });
      });

      queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed in queue ${config.name}:`, error);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} stalled in queue ${config.name}`);
      });

      queues.set(config.name, queue);
      logger.info(`Queue ${config.name} initialized with ${config.concurrency} workers`);
    }

    logger.info('All job queues initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize queues:', error);
    throw error;
  }
};

// Get queue by name
export const getQueue = (queueName: QueueName): Bull.Queue => {
  const queue = queues.get(queueName);
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }
  return queue;
};

// Add job to queue
export const addJob = async <T>(
  queueName: QueueName,
  data: T,
  options?: Bull.JobOptions
): Promise<Bull.Job<T>> => {
  const queue = getQueue(queueName);
  const config = queueConfigs.find(c => c.name === queueName);
  
  const jobOptions: Bull.JobOptions = {
    priority: config?.priority || JobPriority.MEDIUM,
    delay: 0,
    ...options
  };

  const job = await queue.add(data, jobOptions);
  logger.info(`Job ${job.id} added to queue ${queueName}`, { data, options: jobOptions });
  
  return job;
};

// Add recurring job
export const addRecurringJob = async <T>(
  queueName: QueueName,
  jobId: string,
  data: T,
  cronExpression: string,
  options?: Bull.JobOptions
): Promise<Bull.Job<T>> => {
  const queue = getQueue(queueName);
  
  const jobOptions: Bull.JobOptions = {
    repeat: { cron: cronExpression },
    jobId,
    ...options
  };

  const job = await queue.add(data, jobOptions);
  logger.info(`Recurring job ${jobId} added to queue ${queueName}`, { cron: cronExpression });
  
  return job;
};

// Remove recurring job
export const removeRecurringJob = async (
  queueName: QueueName,
  jobId: string
): Promise<void> => {
  const queue = getQueue(queueName);
  await queue.removeRepeatable(jobId);
  logger.info(`Recurring job ${jobId} removed from queue ${queueName}`);
};

// Pause queue
export const pauseQueue = async (queueName: QueueName): Promise<void> => {
  const queue = getQueue(queueName);
  await queue.pause();
  logger.info(`Queue ${queueName} paused`);
};

// Resume queue
export const resumeQueue = async (queueName: QueueName): Promise<void> => {
  const queue = getQueue(queueName);
  await queue.resume();
  logger.info(`Queue ${queueName} resumed`);
};

// Get queue statistics
export const getQueueStats = async (queueName: QueueName) => {
  const queue = getQueue(queueName);
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed(),
    queue.getDelayed(),
    queue.isPaused()
  ]);

  return {
    queueName,
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    paused
  };
};

// Clean old jobs
export const cleanQueue = async (
  queueName: QueueName,
  grace: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<void> => {
  const queue = getQueue(queueName);
  await queue.clean(grace, 'completed');
  await queue.clean(grace, 'failed');
  logger.info(`Queue ${queueName} cleaned`);
};

// Graceful shutdown
export const shutdownQueues = async (): Promise<void> => {
  logger.info('Shutting down job queues...');
  
  const shutdownPromises = Array.from(queues.values()).map(async (queue) => {
    await queue.close();
  });

  await Promise.all(shutdownPromises);
  queues.clear();
  logger.info('All job queues shut down successfully');
};

// Export queue configurations for reference
export { queueConfigs };