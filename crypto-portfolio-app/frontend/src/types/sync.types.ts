// Sync operation types
export type SyncStatus = 'idle' | 'syncing' | 'paused' | 'stopping' | 'stopped' | 'error' | 'completed';
export type SyncType = 'manual' | 'scheduled' | 'auto' | 'incremental' | 'full';
export type ConflictResolutionStrategy = 'exchange-priority' | 'timestamp-priority' | 'manual' | 'merge' | 'skip';

// Exchange connection types
export interface ExchangeConnection {
  id: string;
  name: string;
  type: ExchangeType;
  apiKey: string;
  apiSecret: string;
  sandbox?: boolean;
  isConnected: boolean;
  lastConnected?: string;
  rateLimits: RateLimitConfig;
  endpoints: ExchangeEndpoints;
  permissions: ExchangePermissions;
  metadata?: ExchangeMetadata;
}

export type ExchangeType = 
  | 'coinbase' | 'coinbase-pro' 
  | 'binance' | 'binance-us' 
  | 'kraken' | 'kucoin' 
  | 'bittrex' | 'huobi' 
  | 'okx' | 'gate-io' 
  | 'bybit' | 'ftx' 
  | 'gemini' | 'crypto-com';

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit?: number;
  interval: number;
  retryAfter?: number;
}

export interface ExchangeEndpoints {
  baseUrl: string;
  wsUrl?: string;
  tradingPairs: string;
  transactions: string;
  balances: string;
  orderHistory: string;
  deposits: string;
  withdrawals: string;
}

export interface ExchangePermissions {
  read: boolean;
  trade: boolean;
  withdraw: boolean;
  futures?: boolean;
  margin?: boolean;
}

export interface ExchangeMetadata {
  timezone: string;
  tradingFees: { maker: number; taker: number };
  minTradeAmounts: { [symbol: string]: number };
  supportedAssets: string[];
  lastUpdated: string;
}

// Sync configuration types
export interface SyncConfiguration {
  id: string;
  name: string;
  exchanges: string[]; // Exchange IDs
  enabled: boolean;
  schedule: SyncSchedule;
  options: SyncOptions;
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
  nextRun?: string;
}

export interface SyncSchedule {
  type: 'interval' | 'cron' | 'manual';
  interval?: number; // milliseconds
  cronExpression?: string;
  timezone?: string;
  enabled: boolean;
}

export interface SyncOptions {
  syncType: SyncType;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  includeOrderHistory: boolean;
  includeDeposits: boolean;
  includeWithdrawals: boolean;
  includeTrades: boolean;
  conflictResolution: ConflictResolutionConfig;
  dataValidation: DataValidationConfig;
  backup: BackupConfig;
  notifications: NotificationConfig;
}

export interface ConflictResolutionConfig {
  strategy: ConflictResolutionStrategy;
  autoResolve: boolean;
  priorityOrder?: string[]; // Exchange priority order
  timestampTolerance: number; // milliseconds
  amountTolerance: number; // percentage
  requireManualReview: string[]; // Conflict types requiring manual review
}

export interface DataValidationConfig {
  enabled: boolean;
  strict: boolean;
  validateAmounts: boolean;
  validateDates: boolean;
  validateAssets: boolean;
  allowPartialSync: boolean;
  maxErrorThreshold: number; // percentage
}

export interface BackupConfig {
  enabled: boolean;
  beforeSync: boolean;
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface NotificationConfig {
  syncComplete: boolean;
  syncFailed: boolean;
  conflictsDetected: boolean;
  channels: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'email' | 'push' | 'webhook' | 'sms';
  enabled: boolean;
  config: any; // Channel-specific configuration
}

// Sync operation types
export interface SyncOperation {
  id: string;
  configurationId: string;
  exchanges: string[];
  status: SyncStatus;
  type: SyncType;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  progress: SyncProgress;
  results: SyncResults;
  errors: SyncError[];
  conflicts: ConflictData[];
  metadata: SyncMetadata;
}

export interface SyncProgress {
  stage: SyncStage;
  overall: number; // 0-100
  exchanges: { [exchangeId: string]: ExchangeProgress };
  currentExchange?: string;
  message: string;
  details?: string;
  estimatedTimeRemaining?: number;
}

export type SyncStage = 
  | 'initializing' 
  | 'connecting' 
  | 'fetching' 
  | 'validating' 
  | 'resolving-conflicts' 
  | 'processing' 
  | 'finalizing' 
  | 'complete' 
  | 'error';

export interface ExchangeProgress {
  exchangeId: string;
  stage: SyncStage;
  progress: number; // 0-100
  message: string;
  fetchedRecords: number;
  processedRecords: number;
  totalRecords?: number;
  errors: number;
  warnings: number;
  lastActivity: string;
}

export interface SyncResults {
  totalRecords: number;
  processedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  newRecords: number;
  updatedRecords: number;
  duplicateRecords: number;
  conflictRecords: number;
  exchangeResults: { [exchangeId: string]: ExchangeResult };
  summary: SyncSummary;
}

export interface ExchangeResult {
  exchangeId: string;
  status: 'success' | 'partial' | 'failed';
  records: ExchangeRecordCounts;
  performance: ExchangePerformanceMetrics;
  errors: SyncError[];
  warnings: string[];
}

export interface ExchangeRecordCounts {
  fetched: number;
  processed: number;
  skipped: number;
  errors: number;
  trades: number;
  deposits: number;
  withdrawals: number;
  orders: number;
}

export interface ExchangePerformanceMetrics {
  fetchTime: number;
  processTime: number;
  avgRequestTime: number;
  rateLimitHits: number;
  retries: number;
  dataTransferred: number; // bytes
}

export interface SyncSummary {
  success: boolean;
  exchangesProcessed: number;
  exchangesFailed: number;
  totalTransactions: number;
  newTransactions: number;
  portfolioValue: number;
  assetsUpdated: string[];
  performanceImpact: PerformanceImpact;
}

export interface PerformanceImpact {
  executionTime: number;
  memoryUsage: number;
  networkUsage: number;
  storageImpact: number;
  cpuUsage: number;
}

// Error and conflict types
export interface SyncError {
  id: string;
  type: SyncErrorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  exchangeId?: string;
  message: string;
  details?: string;
  stack?: string;
  timestamp: string;
  context?: SyncErrorContext;
  resolution?: ErrorResolution;
  retryable: boolean;
  retryCount: number;
}

export type SyncErrorType = 
  | 'connection_failed'
  | 'auth_failed'
  | 'rate_limit_exceeded'
  | 'api_error'
  | 'network_timeout'
  | 'data_validation_failed'
  | 'parsing_error'
  | 'storage_error'
  | 'conflict_resolution_failed'
  | 'sync_timeout'
  | 'insufficient_permissions'
  | 'exchange_maintenance'
  | 'unknown_error';

export interface SyncErrorContext {
  request?: any;
  response?: any;
  exchangeId?: string;
  transactionId?: string;
  stage?: SyncStage;
  retryAttempt?: number;
}

export interface ErrorResolution {
  strategy: 'retry' | 'skip' | 'manual' | 'fallback';
  action?: string;
  retryAfter?: number;
  fallbackData?: any;
}

// Conflict resolution types
export interface ConflictData {
  id: string;
  type: ConflictType;
  severity: 'low' | 'medium' | 'high';
  status: ConflictStatus;
  exchangeIds: string[];
  transactions: ConflictTransaction[];
  differences: ConflictDifference[];
  detectedAt: string;
  resolvedAt?: string;
  resolution?: ConflictResolution;
  metadata: ConflictMetadata;
}

export type ConflictType = 
  | 'duplicate_transaction'
  | 'amount_mismatch'
  | 'timestamp_mismatch'
  | 'asset_mismatch'
  | 'type_mismatch'
  | 'fee_mismatch'
  | 'missing_transaction'
  | 'orphaned_transaction'
  | 'balance_inconsistency';

export type ConflictStatus = 'detected' | 'analyzing' | 'resolved' | 'manual_review' | 'ignored';

export interface ConflictTransaction {
  source: 'exchange' | 'portfolio';
  exchangeId?: string;
  data: TransactionData;
  confidence: number; // 0-1
  metadata?: any;
}

export interface ConflictDifference {
  field: string;
  values: { [source: string]: any };
  severity: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  action: 'keep_existing' | 'use_incoming' | 'merge' | 'create_new' | 'ignore';
  resolvedTransaction?: TransactionData;
  reasoning: string;
  confidence: number;
  manual: boolean;
  resolvedBy?: string;
}

export interface ConflictMetadata {
  algorithmVersion: string;
  processingTime: number;
  similarityScore?: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedAction: string;
}

// Transaction data types
export interface TransactionData {
  id: string;
  exchangeId?: string;
  exchangeTransactionId?: string;
  type: TransactionType;
  asset: string;
  amount: number;
  price?: number;
  total?: number;
  fees?: number;
  timestamp: string;
  status: TransactionStatus;
  metadata?: TransactionMetadata;
}

export type TransactionType = 
  | 'buy' | 'sell' | 'trade'
  | 'deposit' | 'withdrawal'
  | 'transfer_in' | 'transfer_out'
  | 'staking_reward' | 'staking_penalty'
  | 'mining_reward' | 'airdrop'
  | 'fork' | 'dividend'
  | 'fee' | 'cashback';

export type TransactionStatus = 'pending' | 'completed' | 'cancelled' | 'failed' | 'processing';

export interface TransactionMetadata {
  orderId?: string;
  tradePair?: string;
  side?: 'buy' | 'sell';
  orderType?: 'market' | 'limit' | 'stop';
  address?: string;
  txHash?: string;
  confirmations?: number;
  notes?: string;
  tags?: string[];
}

// Sync history and monitoring types
export interface SyncHistoryEntry {
  id: string;
  configurationId: string;
  operationId: string;
  type: SyncType;
  status: SyncStatus;
  exchanges: string[];
  startedAt: string;
  completedAt?: string;
  duration?: number;
  results: SyncResults;
  errors: SyncError[];
  conflicts: ConflictData[];
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  totalTime: number;
  networkTime: number;
  processTime: number;
  memoryPeak: number;
  memoryAverage: number;
  cpuPeak: number;
  cpuAverage: number;
  diskIO: number;
  networkIO: number;
  cacheHitRate: number;
}

// Monitoring and alerts types
export interface SyncMonitoringConfig {
  enabled: boolean;
  healthChecks: HealthCheckConfig[];
  alerts: AlertConfig[];
  metrics: MetricConfig[];
  dashboards: DashboardConfig[];
}

export interface HealthCheckConfig {
  id: string;
  name: string;
  type: 'connection' | 'latency' | 'error_rate' | 'sync_frequency' | 'data_freshness';
  enabled: boolean;
  interval: number; // seconds
  timeout: number; // seconds
  thresholds: HealthThreshold[];
  exchanges?: string[];
}

export interface HealthThreshold {
  level: 'warning' | 'error' | 'critical';
  condition: string;
  value: number;
  action?: string;
}

export interface AlertConfig {
  id: string;
  name: string;
  type: AlertType;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldown: number; // minutes
  escalation?: EscalationConfig;
}

export type AlertType = 
  | 'sync_failed'
  | 'conflicts_detected'
  | 'high_error_rate'
  | 'slow_sync'
  | 'exchange_down'
  | 'data_inconsistency'
  | 'rate_limit_exceeded'
  | 'auth_failed';

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
  value: number;
  timeWindow: number; // minutes
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'sms' | 'push' | 'slack';
  config: any;
  enabled: boolean;
}

export interface EscalationConfig {
  levels: EscalationLevel[];
  enabled: boolean;
}

export interface EscalationLevel {
  level: number;
  delay: number; // minutes
  actions: AlertAction[];
  condition?: string;
}

export interface MetricConfig {
  id: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  labels: string[];
  enabled: boolean;
  retention: number; // days
}

export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  enabled: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'table' | 'stat' | 'gauge' | 'alert_list';
  title: string;
  config: any;
  position: { x: number; y: number; w: number; h: number };
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  margin: [number, number];
  padding: [number, number];
}

// Sync metadata types
export interface SyncMetadata {
  version: string;
  environment: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  timezone: string;
  clientVersion?: string;
  serverVersion?: string;
  features: string[];
  experimentFlags?: { [key: string]: boolean };
}

// Queue and background processing types
export interface SyncQueue {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'stopped';
  jobs: SyncJob[];
  workers: number;
  concurrency: number;
  priority: QueuePriority;
  retryPolicy: RetryPolicy;
  deadLetterQueue?: string;
}

export interface SyncJob {
  id: string;
  queueId: string;
  type: SyncType;
  priority: JobPriority;
  status: JobStatus;
  data: SyncJobData;
  attempts: number;
  maxAttempts: number;
  delay: number;
  scheduledFor: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  progress: number;
  result?: any;
  error?: string;
}

export type QueuePriority = 'low' | 'normal' | 'high' | 'critical';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

export interface SyncJobData {
  configurationId: string;
  exchanges: string[];
  options: SyncOptions;
  trigger: 'manual' | 'scheduled' | 'event';
  context?: any;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  backoffDelay: number;
  backoffMultiplier?: number;
  maxDelay?: number;
  jitter?: boolean;
}

// API and webhook types
export interface SyncWebhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  secret?: string;
  headers?: { [key: string]: string };
  timeout: number;
  retryPolicy: RetryPolicy;
  lastTriggered?: string;
  successCount: number;
  errorCount: number;
}

export type WebhookEvent = 
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'sync.paused'
  | 'conflict.detected'
  | 'conflict.resolved'
  | 'error.occurred'
  | 'health.degraded';

// Hook return types
export interface UseAutoSyncReturn {
  // State
  syncProgress: SyncProgress | null;
  syncStatus: SyncStatus;
  lastSyncTimes: { [exchangeId: string]: string };
  conflictingTransactions: ConflictData[];
  errors: SyncError[];
  isRunning: boolean;
  
  // Actions
  startSync: (options?: Partial<SyncOptions>) => Promise<SyncOperation>;
  stopSync: () => Promise<void>;
  pauseSync: () => Promise<void>;
  resumeSync: () => Promise<void>;
  retrySync: (operationId: string) => Promise<SyncOperation>;
  
  // Configuration
  updateSyncConfig: (config: Partial<SyncConfiguration>) => void;
  getSyncConfig: () => SyncConfiguration | null;
  
  // Conflicts
  resolveConflict: (conflictId: string, resolution: ConflictResolution) => Promise<void>;
  resolveAllConflicts: (strategy: ConflictResolutionStrategy) => Promise<void>;
  
  // History
  getSyncHistory: (limit?: number) => SyncHistoryEntry[];
  clearSyncHistory: () => void;
}

export interface UseSyncStatusReturn {
  // Overall status
  overallStatus: SyncStatus;
  isHealthy: boolean;
  lastActivity: string;
  
  // Exchange statuses
  exchangeStatuses: { [exchangeId: string]: ExchangeStatus };
  connectedExchanges: string[];
  disconnectedExchanges: string[];
  
  // Statistics
  syncStatistics: SyncStatistics;
  errorCount: number;
  warningCount: number;
  
  // Performance
  performanceMetrics: PerformanceMetrics;
  healthMetrics: HealthMetrics;
  
  // Actions
  refreshStatus: () => Promise<void>;
  testConnection: (exchangeId: string) => Promise<ConnectionTest>;
  getDetailedStatus: () => DetailedSyncStatus;
}

export interface ExchangeStatus {
  exchangeId: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'rate_limited' | 'maintenance';
  lastSync: string;
  nextSync?: string;
  health: HealthStatus;
  errors: SyncError[];
  warnings: string[];
  performance: ExchangePerformanceMetrics;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'error' | 'critical';
  checks: { [checkId: string]: HealthCheckResult };
  score: number; // 0-100
  lastChecked: string;
}

export interface HealthCheckResult {
  checkId: string;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

export interface SyncStatistics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalTransactions: number;
  totalConflicts: number;
  resolvedConflicts: number;
  averageSyncTime: number;
  averageTransactionsPerSync: number;
  uptimePercentage: number;
  errorRate: number;
}

export interface HealthMetrics {
  uptime: number;
  availability: number;
  reliability: number;
  performance: number;
  errorRate: number;
  responseTime: number;
  throughput: number;
  resourceUtilization: ResourceUtilization;
}

export interface ResourceUtilization {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  database: number;
}

export interface ConnectionTest {
  exchangeId: string;
  success: boolean;
  latency: number;
  error?: string;
  permissions: ExchangePermissions;
  rateLimits: RateLimitStatus;
  timestamp: string;
}

export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetTime: string;
  blocked: boolean;
}

export interface DetailedSyncStatus {
  overall: SyncStatus;
  exchanges: { [exchangeId: string]: ExchangeStatus };
  activeOperations: SyncOperation[];
  queuedOperations: SyncJob[];
  recentHistory: SyncHistoryEntry[];
  systemHealth: HealthMetrics;
  alerts: Alert[];
  configurations: SyncConfiguration[];
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
  metadata?: any;
}

// Cache and optimization types
export interface SyncCache {
  exchanges: { [exchangeId: string]: ExchangeCache };
  transactions: TransactionCache;
  conflicts: ConflictCache;
  metadata: CacheMetadata;
}

export interface ExchangeCache {
  exchangeId: string;
  lastUpdated: string;
  transactions: CachedTransaction[];
  balances: CachedBalance[];
  metadata: any;
  etag?: string;
  ttl: number;
}

export interface CachedTransaction {
  id: string;
  hash: string;
  data: TransactionData;
  timestamp: string;
  ttl: number;
}

export interface CachedBalance {
  asset: string;
  amount: number;
  available: number;
  locked: number;
  timestamp: string;
  ttl: number;
}

export interface TransactionCache {
  byId: { [id: string]: CachedTransaction };
  byExchange: { [exchangeId: string]: string[] };
  byAsset: { [asset: string]: string[] };
  byDate: { [date: string]: string[] };
  hashes: { [hash: string]: string };
}

export interface ConflictCache {
  active: { [id: string]: ConflictData };
  resolved: { [id: string]: ConflictData };
  patterns: ConflictPattern[];
}

export interface ConflictPattern {
  id: string;
  type: ConflictType;
  frequency: number;
  resolution: ConflictResolutionStrategy;
  confidence: number;
  lastSeen: string;
}

export interface CacheMetadata {
  version: string;
  createdAt: string;
  updatedAt: string;
  size: number;
  hitRate: number;
  missRate: number;
  evictions: number;
}

// All types are already exported with their individual declarations
export * from './importExport.types';