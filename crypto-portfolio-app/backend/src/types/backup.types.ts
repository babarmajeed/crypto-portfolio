/**
 * TypeScript definitions for backup and recovery operations
 * Supports comprehensive backup management and disaster recovery
 */

export interface BackupConfiguration {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: BackupSchedule;
  type: BackupType;
  target: BackupTarget;
  storage: StorageConfiguration;
  retention: RetentionPolicy;
  encryption: EncryptionSettings;
  compression: CompressionSettings;
  verification: VerificationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupSchedule {
  type: 'cron' | 'interval';
  expression: string; // cron expression or interval in ms
  timezone?: string;
  enabled: boolean;
  nextRun?: Date;
  lastRun?: Date;
}

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  DIFFERENTIAL = 'differential',
  SCHEMA_ONLY = 'schema_only',
  DATA_ONLY = 'data_only',
  TRANSACTION_LOG = 'transaction_log'
}

export interface BackupTarget {
  type: 'database' | 'filesystem' | 'application_data';
  database?: DatabaseTarget;
  filesystem?: FilesystemTarget;
  applicationData?: ApplicationDataTarget;
}

export interface DatabaseTarget {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string; // Will be encrypted
  tables?: string[];
  excludeTables?: string[];
  schemaOnly?: boolean;
  dataOnly?: boolean;
}

export interface FilesystemTarget {
  paths: string[];
  excludePatterns?: string[];
  includePatterns?: string[];
  followSymlinks?: boolean;
}

export interface ApplicationDataTarget {
  userDataExport: boolean;
  configurationData: boolean;
  logFiles: boolean;
  uploadedFiles: boolean;
}

export interface StorageConfiguration {
  primary: StorageLocation;
  secondary?: StorageLocation;
  offsite?: StorageLocation;
}

export interface StorageLocation {
  type: StorageType;
  local?: LocalStorage;
  s3?: S3Storage;
  glacier?: GlacierStorage;
  ftp?: FTPStorage;
}

export enum StorageType {
  LOCAL = 'local',
  S3 = 's3',
  GLACIER = 'glacier',
  FTP = 'ftp',
  SFTP = 'sftp',
  AZURE_BLOB = 'azure_blob',
  GCS = 'gcs'
}

export interface LocalStorage {
  path: string;
  permissions?: string;
  ownershipCheck?: boolean;
}

export interface S3Storage {
  region: string;
  bucket: string;
  prefix?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  storageClass?: 'STANDARD' | 'STANDARD_IA' | 'ONEZONE_IA' | 'REDUCED_REDUNDANCY';
}

export interface GlacierStorage {
  region: string;
  vaultName: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface FTPStorage {
  host: string;
  port: number;
  username: string;
  password: string;
  path: string;
  passive?: boolean;
  secure?: boolean;
}

export interface RetentionPolicy {
  daily: number; // days to keep daily backups
  weekly: number; // weeks to keep weekly backups
  monthly: number; // months to keep monthly backups
  yearly: number; // years to keep yearly backups
  minimumCopies: number;
  maximumAge?: number; // maximum age in days
}

export interface EncryptionSettings {
  enabled: boolean;
  algorithm?: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';
  keyId?: string;
  keyRotationInterval?: number; // days
}

export interface CompressionSettings {
  enabled: boolean;
  algorithm?: 'gzip' | 'bzip2' | 'lz4' | 'zstd';
  level?: number; // compression level 1-9
}

export interface VerificationSettings {
  enabled: boolean;
  checksumAlgorithm?: 'SHA-256' | 'SHA-512' | 'MD5';
  integrityCheck?: boolean;
  testRestore?: boolean;
}

export interface BackupJob {
  id: string;
  configurationId: string;
  status: BackupJobStatus;
  type: BackupType;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  size?: number; // bytes
  compressedSize?: number; // bytes
  location: string;
  checksum?: string;
  error?: string;
  metadata: BackupMetadata;
  verification?: VerificationResult;
}

export enum BackupJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  VERIFYING = 'verifying',
  VERIFIED = 'verified',
  CORRUPTED = 'corrupted'
}

export interface BackupMetadata {
  version: string;
  databaseVersion?: string;
  applicationVersion?: string;
  platform: string;
  hostname: string;
  userId?: string;
  source: string;
  tags?: Record<string, string>;
}

export interface VerificationResult {
  checksumValid: boolean;
  integrityValid: boolean;
  restoreTestPassed?: boolean;
  verifiedAt: Date;
  errors?: string[];
}

export interface RecoveryRequest {
  id: string;
  backupJobId: string;
  type: RecoveryType;
  target: RecoveryTarget;
  options: RecoveryOptions;
  status: RecoveryStatus;
  requestedBy: string;
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export enum RecoveryType {
  FULL_RESTORE = 'full_restore',
  POINT_IN_TIME = 'point_in_time',
  SELECTIVE_TABLE = 'selective_table',
  SELECTIVE_SCHEMA = 'selective_schema',
  DATA_ONLY = 'data_only',
  SCHEMA_ONLY = 'schema_only'
}

export interface RecoveryTarget {
  database?: DatabaseRecoveryTarget;
  filesystem?: FilesystemRecoveryTarget;
  pointInTime?: Date;
}

export interface DatabaseRecoveryTarget {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  tables?: string[];
  schemas?: string[];
  overwrite?: boolean;
}

export interface FilesystemRecoveryTarget {
  targetPath: string;
  overwrite?: boolean;
  preservePermissions?: boolean;
}

export interface RecoveryOptions {
  validateBeforeRestore: boolean;
  createTargetIfNotExists: boolean;
  stopOnError: boolean;
  parallel: boolean;
  maxParallelJobs?: number;
  dryRun?: boolean;
}

export enum RecoveryStatus {
  REQUESTED = 'requested',
  VALIDATING = 'validating',
  PREPARING = 'preparing',
  RESTORING = 'restoring',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface UserDataExportRequest {
  id: string;
  userId: string;
  type: ExportType;
  format: ExportFormat;
  status: ExportStatus;
  requestedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
  options: ExportOptions;
}

export enum ExportType {
  PERSONAL_DATA = 'personal_data',
  PORTFOLIO_DATA = 'portfolio_data',
  TRANSACTION_HISTORY = 'transaction_history',
  FULL_EXPORT = 'full_export'
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
  XML = 'xml'
}

export enum ExportStatus {
  REQUESTED = 'requested',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export interface ExportOptions {
  includeMetadata: boolean;
  anonymizeData?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
  includeSensitiveData?: boolean;
}

export interface BackupMonitoringMetrics {
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  totalSize: number; // bytes
  averageDuration: number; // milliseconds
  lastBackupTime?: Date;
  nextScheduledBackup?: Date;
  storageUtilization: StorageUtilization;
  healthScore: number; // 0-100
}

export interface StorageUtilization {
  local?: StorageStats;
  cloud?: StorageStats;
  offsite?: StorageStats;
}

export interface StorageStats {
  totalSpace: number;
  usedSpace: number;
  availableSpace: number;
  utilizationPercent: number;
}

export interface BackupAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export enum AlertType {
  BACKUP_FAILED = 'backup_failed',
  BACKUP_OVERDUE = 'backup_overdue',
  STORAGE_FULL = 'storage_full',
  VERIFICATION_FAILED = 'verification_failed',
  ENCRYPTION_ERROR = 'encryption_error',
  RETENTION_VIOLATION = 'retention_violation',
  RECOVERY_FAILED = 'recovery_failed'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface DisasterRecoveryPlan {
  id: string;
  name: string;
  description: string;
  procedures: RecoveryProcedure[];
  rto: number; // Recovery Time Objective in minutes
  rpo: number; // Recovery Point Objective in minutes
  lastTested?: Date;
  testResults?: TestResult[];
  contacts: EmergencyContact[];
}

export interface RecoveryProcedure {
  id: string;
  name: string;
  description: string;
  order: number;
  estimatedDuration: number; // minutes
  dependencies?: string[];
  commands?: string[];
  validationSteps?: string[];
}

export interface TestResult {
  id: string;
  testDate: Date;
  passed: boolean;
  duration: number; // minutes
  issues?: string[];
  recommendations?: string[];
}

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
  email: string;
  availability: string;
}

export interface BackupApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  requestId: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}