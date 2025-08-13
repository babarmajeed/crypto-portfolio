import { Job } from 'bull';

// Base job data interface
export interface BaseJobData {
  id: string;
  userId?: string;
  timestamp: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

// Job priorities
export enum JobPriority {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 10,
  CRITICAL = 15
}

// Queue names
export enum QueueName {
  PRICE_UPDATE = 'priceUpdate',
  PORTFOLIO_CALCULATION = 'portfolioCalculation',
  EMAIL_NOTIFICATION = 'emailNotification',
  DATA_SYNC = 'dataSync',
  REPORT_GENERATION = 'reportGeneration'
}

// Price update job data
export interface PriceUpdateJobData extends BaseJobData {
  symbols?: string[];
  exchange?: string;
  updateAll?: boolean;
}

// Portfolio calculation job data
export interface PortfolioCalculationJobData extends BaseJobData {
  userId: string;
  portfolioId?: string;
  calculateAll?: boolean;
  metrics?: string[];
}

// Email notification job data
export interface EmailNotificationJobData extends BaseJobData {
  to: string | string[];
  template: string;
  subject: string;
  data: Record<string, any>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

// Data sync job data
export interface DataSyncJobData extends BaseJobData {
  userId: string;
  exchange: string;
  syncType: SyncType;
  startDate?: Date;
  endDate?: Date;
}

export enum SyncType {
  TRANSACTIONS = 'transactions',
  BALANCES = 'balances',
  ORDERS = 'orders',
  ALL = 'all'
}

// Report generation job data
export interface ReportGenerationJobData extends BaseJobData {
  userId: string;
  reportType: ReportType;
  format: ReportFormat;
  period: ReportPeriod;
  data?: Record<string, any>;
}

export enum ReportType {
  PORTFOLIO_SUMMARY = 'portfolio_summary',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  TAX_REPORT = 'tax_report',
  TRANSACTION_HISTORY = 'transaction_history'
}

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json'
}

export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

// Job result interfaces
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  metrics?: JobMetrics;
}

export interface JobMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;
  memory?: number;
  cpu?: number;
}

// Queue configuration
export interface QueueConfig {
  name: QueueName;
  concurrency: number;
  priority: JobPriority;
  retryAttempts: number;
  retryDelay: number;
  removeOnComplete: number;
  removeOnFail: number;
}

// Worker configuration
export interface WorkerConfig {
  queueName: QueueName;
  concurrency: number;
  maxStalledCount: number;
  stalledInterval: number;
  maxFailedAttempts: number;
}

// Queue monitoring data
export interface QueueStats {
  queueName: QueueName;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface WorkerStats {
  workerId: string;
  queueName: QueueName;
  status: WorkerStatus;
  jobsProcessed: number;
  lastActivity: Date;
  memory: number;
  cpu: number;
}

export enum WorkerStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  STOPPED = 'stopped'
}

// Job processor function type
export type JobProcessor<T extends BaseJobData> = (job: Job<T>) => Promise<JobResult>;

// Queue event types
export interface QueueEvents {
  'job.created': (job: Job) => void;
  'job.started': (job: Job) => void;
  'job.completed': (job: Job, result: JobResult) => void;
  'job.failed': (job: Job, error: Error) => void;
  'job.retry': (job: Job, attempt: number) => void;
  'queue.paused': (queueName: QueueName) => void;
  'queue.resumed': (queueName: QueueName) => void;
  'worker.started': (workerId: string, queueName: QueueName) => void;
  'worker.stopped': (workerId: string, queueName: QueueName) => void;
  'worker.error': (workerId: string, error: Error) => void;
}