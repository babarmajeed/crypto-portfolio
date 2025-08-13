import { 
  QueueName, 
  PriceUpdateJobData, 
  PortfolioCalculationJobData,
  EmailNotificationJobData,
  DataSyncJobData,
  ReportGenerationJobData,
  JobPriority,
  SyncType,
  ReportType,
  ReportFormat,
  ReportPeriod
} from '../types/queue.types';
import { addJob, initializeQueues, shutdownQueues } from '../queues';
import { initializeWorkers } from '../workers';
import { initializeScheduler, startScheduler, stopScheduler, shutdownScheduler } from '../scheduler';
import { queueMetricsCollector } from '../monitoring/queueMetrics';
import { logger } from '../utils/logger';

export class JobProcessingService {
  private isInitialized: boolean = false;
  private isRunning: boolean = false;

  // Initialize the entire job processing system
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Job processing service already initialized');
      return;
    }

    try {
      logger.info('Initializing job processing service...');

      // Initialize queues first
      await initializeQueues();
      
      // Initialize workers
      await initializeWorkers();
      
      // Initialize scheduler
      await initializeScheduler();
      
      // Start metrics collection
      queueMetricsCollector.start();

      this.isInitialized = true;
      logger.info('Job processing service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize job processing service:', error);
      throw error;
    }
  }

  // Start the job processing system
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Job processing service not initialized');
    }

    if (this.isRunning) {
      logger.warn('Job processing service already running');
      return;
    }

    try {
      logger.info('Starting job processing service...');
      
      // Start scheduler
      startScheduler();
      
      this.isRunning = true;
      logger.info('Job processing service started successfully');
    } catch (error) {
      logger.error('Failed to start job processing service:', error);
      throw error;
    }
  }

  // Stop the job processing system
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Job processing service not running');
      return;
    }

    try {
      logger.info('Stopping job processing service...');
      
      // Stop scheduler
      stopScheduler();
      
      // Stop metrics collection
      queueMetricsCollector.stop();
      
      this.isRunning = false;
      logger.info('Job processing service stopped successfully');
    } catch (error) {
      logger.error('Failed to stop job processing service:', error);
      throw error;
    }
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down job processing service...');
      
      if (this.isRunning) {
        await this.stop();
      }
      
      // Shutdown components
      shutdownScheduler();
      await shutdownQueues();
      
      this.isInitialized = false;
      logger.info('Job processing service shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown job processing service:', error);
      throw error;
    }
  }

  // Price update job methods
  public async schedulePriceUpdate(data: Partial<PriceUpdateJobData>): Promise<string> {
    const jobData: PriceUpdateJobData = {
      id: `price-update-${Date.now()}`,
      timestamp: new Date(),
      priority: JobPriority.HIGH,
      ...data
    };

    const job = await addJob(QueueName.PRICE_UPDATE, jobData, {
      priority: jobData.priority,
      delay: 0
    });

    logger.info(`Price update job ${job.id} scheduled`, { data: jobData });
    return job.id!.toString();
  }

  public async scheduleImmediatePriceUpdate(symbols?: string[]): Promise<string> {
    return this.schedulePriceUpdate({
      symbols,
      priority: JobPriority.CRITICAL
    });
  }

  // Portfolio calculation job methods
  public async schedulePortfolioCalculation(data: Partial<PortfolioCalculationJobData>): Promise<string> {
    if (!data.userId) {
      throw new Error('userId is required for portfolio calculation');
    }

    const jobData: PortfolioCalculationJobData = {
      id: `portfolio-calc-${data.userId}-${Date.now()}`,
      timestamp: new Date(),
      priority: JobPriority.HIGH,
      ...data
    };

    const job = await addJob(QueueName.PORTFOLIO_CALCULATION, jobData, {
      priority: jobData.priority,
      delay: 0
    });

    logger.info(`Portfolio calculation job ${job.id} scheduled`, { data: jobData });
    return job.id!.toString();
  }

  public async scheduleUserPortfolioCalculation(userId: string): Promise<string> {
    return this.schedulePortfolioCalculation({
      userId,
      calculateAll: true,
      priority: JobPriority.HIGH
    });
  }

  // Email notification job methods
  public async scheduleEmailNotification(data: Partial<EmailNotificationJobData>): Promise<string> {
    if (!data.to || !data.template || !data.subject) {
      throw new Error('to, template, and subject are required for email notification');
    }

    const jobData: EmailNotificationJobData = {
      id: `email-${Date.now()}`,
      timestamp: new Date(),
      priority: JobPriority.MEDIUM,
      data: {},
      ...data
    };

    const job = await addJob(QueueName.EMAIL_NOTIFICATION, jobData, {
      priority: jobData.priority,
      delay: 0
    });

    logger.info(`Email notification job ${job.id} scheduled`, { data: jobData });
    return job.id!.toString();
  }

  public async scheduleWelcomeEmail(userEmail: string, userData: any): Promise<string> {
    return this.scheduleEmailNotification({
      to: userEmail,
      template: 'welcome',
      subject: 'Welcome to Crypto Portfolio',
      data: userData,
      priority: JobPriority.LOW
    });
  }

  public async scheduleAlertEmail(userEmail: string, alertData: any): Promise<string> {
    return this.scheduleEmailNotification({
      to: userEmail,
      template: 'price-alert',
      subject: 'Price Alert Triggered',
      data: alertData,
      priority: JobPriority.HIGH
    });
  }

  // Data sync job methods
  public async scheduleDataSync(data: Partial<DataSyncJobData>): Promise<string> {
    if (!data.userId || !data.exchange) {
      throw new Error('userId and exchange are required for data sync');
    }

    const jobData: DataSyncJobData = {
      id: `data-sync-${data.userId}-${data.exchange}-${Date.now()}`,
      timestamp: new Date(),
      priority: JobPriority.MEDIUM,
      syncType: SyncType.ALL,
      ...data
    };

    const job = await addJob(QueueName.DATA_SYNC, jobData, {
      priority: jobData.priority,
      delay: 0
    });

    logger.info(`Data sync job ${job.id} scheduled`, { data: jobData });
    return job.id!.toString();
  }

  public async scheduleExchangeSync(userId: string, exchange: string, syncType: SyncType = SyncType.ALL): Promise<string> {
    return this.scheduleDataSync({
      userId,
      exchange,
      syncType,
      priority: JobPriority.MEDIUM
    });
  }

  public async scheduleHistoricalSync(
    userId: string, 
    exchange: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<string> {
    return this.scheduleDataSync({
      userId,
      exchange,
      syncType: SyncType.TRANSACTIONS,
      startDate,
      endDate,
      priority: JobPriority.LOW
    });
  }

  // Report generation job methods
  public async scheduleReportGeneration(data: Partial<ReportGenerationJobData>): Promise<string> {
    if (!data.userId || !data.reportType || !data.format || !data.period) {
      throw new Error('userId, reportType, format, and period are required for report generation');
    }

    const jobData: ReportGenerationJobData = {
      id: `report-${data.userId}-${data.reportType}-${Date.now()}`,
      timestamp: new Date(),
      priority: JobPriority.LOW,
      ...data
    };

    const job = await addJob(QueueName.REPORT_GENERATION, jobData, {
      priority: jobData.priority,
      delay: 0
    });

    logger.info(`Report generation job ${job.id} scheduled`, { data: jobData });
    return job.id!.toString();
  }

  public async schedulePortfolioReport(userId: string, format: ReportFormat = ReportFormat.PDF): Promise<string> {
    return this.scheduleReportGeneration({
      userId,
      reportType: ReportType.PORTFOLIO_SUMMARY,
      format,
      period: ReportPeriod.MONTHLY,
      priority: JobPriority.LOW
    });
  }

  public async scheduleTaxReport(userId: string, year: number): Promise<string> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    return this.scheduleReportGeneration({
      userId,
      reportType: ReportType.TAX_REPORT,
      format: ReportFormat.PDF,
      period: ReportPeriod.YEARLY,
      data: { startDate, endDate, year },
      priority: JobPriority.MEDIUM
    });
  }

  // Bulk operations
  public async scheduleBulkPriceUpdates(symbolGroups: string[][]): Promise<string[]> {
    const jobIds: string[] = [];
    
    for (const symbols of symbolGroups) {
      const jobId = await this.schedulePriceUpdate({
        symbols,
        priority: JobPriority.MEDIUM
      });
      jobIds.push(jobId);
    }

    return jobIds;
  }

  public async scheduleBulkPortfolioCalculations(userIds: string[]): Promise<string[]> {
    const jobIds: string[] = [];
    
    for (const userId of userIds) {
      const jobId = await this.schedulePortfolioCalculation({
        userId,
        calculateAll: true,
        priority: JobPriority.MEDIUM
      });
      jobIds.push(jobId);
    }

    return jobIds;
  }

  // Utility methods
  public isSystemInitialized(): boolean {
    return this.isInitialized;
  }

  public isSystemRunning(): boolean {
    return this.isRunning;
  }

  public async getSystemStatus(): Promise<{
    initialized: boolean;
    running: boolean;
    uptime: number;
    startTime: Date | null;
  }> {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      uptime: this.isRunning ? Date.now() - Date.now() : 0, // This would track actual start time
      startTime: this.isRunning ? new Date() : null // This would track actual start time
    };
  }
}

// Export singleton instance
export const jobProcessingService = new JobProcessingService();