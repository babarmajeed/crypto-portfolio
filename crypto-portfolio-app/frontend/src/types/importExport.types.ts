export interface ImportFile {
  file: File;
  name: string;
  size: number;
  type: string;
  extension: string;
  lastModified: Date;
}

export interface ParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
  skipEmptyLines?: boolean;
  trimWhitespace?: boolean;
  sheetName?: string; // For Excel files
  sheetIndex?: number; // For Excel files
  maxRows?: number;
  dateFormat?: string;
  numberFormat?: string;
}

export interface ParseResult {
  data: any[];
  headers: string[];
  originalHeaders?: string[];
  rowCount: number;
  columns: number;
  sheets?: string[]; // For Excel files
  errors?: ParseError[];
  warnings?: string[];
  metadata?: {
    fileSize: number;
    parseTime: number;
    encoding?: string;
    delimiter?: string;
  };
}

export interface ParseError {
  row: number;
  column?: number;
  message: string;
  value?: any;
  severity: 'error' | 'warning' | 'info';
}

export interface ColumnMapping {
  [fieldName: string]: number | string; // Column index or column name
}

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  type: ImportType;
  requiredFields: string[];
  optionalFields: string[];
  fieldMappings: { [key: string]: string[] }; // Field -> possible column names
  sampleData: any[];
  validationRules: ValidationRule[];
  transformationRules: TransformationRule[];
  category: 'exchange' | 'wallet' | 'custom' | 'generic';
  icon?: string;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type ImportType = 
  | 'generic'
  | 'coinbase'
  | 'coinbase-pro'
  | 'binance'
  | 'binance-us'
  | 'kraken'
  | 'kucoin'
  | 'bittrex'
  | 'huobi'
  | 'okx'
  | 'gate-io'
  | 'bybit'
  | 'ftx'
  | 'gemini'
  | 'crypto-com'
  | 'metamask'
  | 'trust-wallet'
  | 'ledger'
  | 'trezor'
  | 'blockfi'
  | 'celsius'
  | 'nexo'
  | 'custom';

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  constraint?: any;
  message: string;
  severity: 'error' | 'warning';
}

export interface TransformationRule {
  field: string;
  operation: 'rename' | 'convert' | 'split' | 'combine' | 'calculate' | 'format';
  parameters: any;
  condition?: string;
}

export interface ValidationResult {
  isValid: boolean;
  validCount: number;
  errorCount: number;
  warningCount: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  row: number;
  field?: string;
  message: string;
  value?: any;
  suggestedFix?: string;
  code: string;
}

export interface ValidationWarning {
  row: number;
  field?: string;
  message: string;
  value?: any;
  suggestion?: string;
  code: string;
}

export interface ValidationSummary {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  duplicateRows: number;
  emptyRows: number;
  fieldCoverage: { [field: string]: number };
  dataTypes: { [field: string]: string };
  dateRange?: {
    earliest: string;
    latest: string;
  };
  assetCount?: number;
  totalValue?: number;
}

export interface ImportProgress {
  stage: 'parsing' | 'validating' | 'transforming' | 'importing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  details?: string;
  startTime: string;
  estimatedTime?: number;
  processedRows: number;
  totalRows: number;
  errors: number;
  warnings: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportError[];
  warnings: string[];
  summary: ImportSummary;
  rollbackId?: string;
  importId: string;
  timestamp: string;
}

export interface ImportError {
  row: number;
  message: string;
  data?: any;
  code: string;
  severity: 'critical' | 'error' | 'warning';
}

export interface ImportSummary {
  totalRecords: number;
  successfulImports: number;
  failedImports: number;
  duplicatesSkipped: number;
  assetsAdded: string[];
  transactionTypes: { [type: string]: number };
  dateRange: {
    earliest: string;
    latest: string;
  };
  portfolioImpact: {
    totalValue: number;
    newAssets: number;
    updatedAssets: number;
  };
}

export interface ImportHistoryEntry {
  id: string;
  fileName: string;
  fileSize: number;
  importType: ImportType;
  timestamp: string;
  status: 'success' | 'partial' | 'failed';
  recordCount: number;
  successfulImports: number;
  errors: number;
  warnings: number;
  rollbackId?: string;
  userId?: string;
  notes?: string;
  metadata?: {
    originalColumns: string[];
    mappedFields: string[];
    validationSummary: ValidationSummary;
  };
}

export interface ExportOptions {
  format: ExportFormat;
  dateRange?: {
    start: string;
    end: string;
  };
  assets?: string[];
  transactionTypes?: string[];
  includeFields: string[];
  excludeFields?: string[];
  groupBy?: 'asset' | 'date' | 'type' | 'exchange';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeHeaders: boolean;
  includeMetadata: boolean;
  compression?: boolean;
  encryption?: {
    enabled: boolean;
    password?: string;
  };
  customFilters?: ExportFilter[];
}

export type ExportFormat = 
  | 'csv'
  | 'excel'
  | 'json'
  | 'pdf'
  | 'xml'
  | 'yaml';

export interface ExportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between' | 'in';
  value: any;
  condition?: 'and' | 'or';
}

export interface ExportProgress {
  stage: 'preparing' | 'filtering' | 'formatting' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
  recordsProcessed: number;
  totalRecords: number;
  startTime: string;
  estimatedTime?: number;
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  downloadUrl?: string;
  blob?: Blob;
  recordCount: number;
  format: ExportFormat;
  timestamp: string;
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  generatedAt: string;
  recordCount: number;
  format: ExportFormat;
  dateRange?: {
    start: string;
    end: string;
  };
  assets: string[];
  totalValue: number;
  fields: string[];
  filters: ExportFilter[];
  version: string;
  checksum?: string;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: ExportFormat;
  options: ExportOptions;
  isDefault: boolean;
  category: 'tax' | 'analysis' | 'backup' | 'exchange' | 'custom';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  usage: number;
  shared?: boolean;
}

export interface BatchImportConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  parallelBatches: number;
  onProgress?: (progress: ImportProgress) => void;
  onBatchComplete?: (batchIndex: number, results: any[]) => void;
  onError?: (error: Error, batchIndex: number) => void;
  stopOnError?: boolean;
  validateBeforeImport?: boolean;
}

export interface ImportPreviewData {
  originalData: any[];
  transformedData: any[];
  sampleSize: number;
  columnMapping: ColumnMapping;
  fieldTypes: { [field: string]: 'string' | 'number' | 'date' | 'boolean' | 'json' };
  statistics: {
    nullValues: { [field: string]: number };
    uniqueValues: { [field: string]: number };
    dataDistribution: { [field: string]: any };
  };
}

export interface FileUploadState {
  isDragOver: boolean;
  isUploading: boolean;
  uploadProgress: number;
  selectedFiles: File[];
  rejectedFiles: Array<{
    file: File;
    reason: string;
  }>;
  errors: string[];
}

export interface DataMappingField {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  description?: string;
  examples?: string[];
  validation?: ValidationRule[];
  transformation?: TransformationRule;
  defaultValue?: any;
  aliases?: string[];
}

export interface ImportWorkflow {
  id: string;
  name: string;
  steps: ImportWorkflowStep[];
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  data?: any;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
  metadata?: any;
}

export interface ImportWorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'file-select' | 'parse' | 'map' | 'validate' | 'preview' | 'import';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  data?: any;
  errors: string[];
  warnings: string[];
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface DataTransformation {
  id: string;
  name: string;
  description: string;
  type: 'field-mapping' | 'value-conversion' | 'data-cleaning' | 'aggregation' | 'filtering';
  configuration: any;
  enabled: boolean;
  order: number;
}

export interface ConversionRate {
  from: string;
  to: string;
  rate: number;
  timestamp: string;
  source: string;
}

export interface PriceHistoryEntry {
  asset: string;
  date: string;
  price: number;
  currency: string;
  source: string;
}

export interface ImportSettings {
  defaultImportType: ImportType;
  autoDetectFormat: boolean;
  validateOnImport: boolean;
  skipDuplicates: boolean;
  allowPartialImports: boolean;
  batchSize: number;
  backupBeforeImport: boolean;
  notifyOnComplete: boolean;
  retainImportHistory: boolean;
  maxHistoryEntries: number;
  defaultDateFormat: string;
  defaultCurrency: string;
  priceDataSource: string;
  customFieldMappings: { [importType: string]: ColumnMapping };
}

export interface ExportSettings {
  defaultFormat: ExportFormat;
  includeHeadersByDefault: boolean;
  includeMetadataByDefault: boolean;
  defaultDateFormat: string;
  defaultCurrency: string;
  compressionLevel: number;
  maxFileSize: number;
  autoDownload: boolean;
  retainExportHistory: boolean;
  maxHistoryEntries: number;
}

export interface ImportExportStats {
  totalImports: number;
  totalExports: number;
  totalRecordsImported: number;
  totalRecordsExported: number;
  importsByFormat: { [format: string]: number };
  exportsByFormat: { [format: string]: number };
  averageImportTime: number;
  averageExportTime: number;
  largestImport: {
    recordCount: number;
    fileSize: number;
    date: string;
  };
  largestExport: {
    recordCount: number;
    fileSize: number;
    date: string;
  };
  errorRates: {
    importErrors: number;
    exportErrors: number;
  };
  popularTemplates: string[];
}

export interface RollbackOperation {
  id: string;
  importId: string;
  timestamp: string;
  description: string;
  affectedRecords: number;
  backupData: any[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  rollbackType: 'full' | 'partial';
  selectedRecords?: string[];
}

export interface ScheduledExport {
  id: string;
  name: string;
  description?: string;
  exportOptions: ExportOptions;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    time: string;
    timezone: string;
    customCron?: string;
  };
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  runCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
  notifications: {
    email?: string;
    webhook?: string;
    slack?: string;
  };
}

export interface FileFormatDetection {
  detectedFormat: string;
  confidence: number;
  reasons: string[];
  suggestedOptions: ParseOptions;
  alternativeFormats: Array<{
    format: string;
    confidence: number;
    options: ParseOptions;
  }>;
}

export interface DataQualityReport {
  overallScore: number;
  issues: DataQualityIssue[];
  recommendations: string[];
  fieldQuality: { [field: string]: FieldQualityMetrics };
  summary: {
    totalRecords: number;
    cleanRecords: number;
    recordsWithIssues: number;
    criticalIssues: number;
    warnings: number;
  };
}

export interface DataQualityIssue {
  type: 'missing_data' | 'invalid_format' | 'outlier' | 'duplicate' | 'inconsistent';
  severity: 'critical' | 'high' | 'medium' | 'low';
  field: string;
  count: number;
  percentage: number;
  examples: any[];
  suggestion: string;
}

export interface FieldQualityMetrics {
  completeness: number; // % of non-null values
  uniqueness: number; // % of unique values
  validity: number; // % of valid format values
  consistency: number; // % of consistent values
  accuracy?: number; // % of accurate values (if reference data available)
  issues: DataQualityIssue[];
}

export interface ImportPerformanceMetrics {
  importId: string;
  fileSize: number;
  recordCount: number;
  parseTime: number;
  validationTime: number;
  transformationTime: number;
  importTime: number;
  totalTime: number;
  memoryUsage: {
    peak: number;
    average: number;
  };
  cpuUsage: {
    peak: number;
    average: number;
  };
  throughput: {
    recordsPerSecond: number;
    bytesPerSecond: number;
  };
}

// Event types for import/export system
export interface ImportExportEvent {
  type: ImportExportEventType;
  timestamp: string;
  data: any;
  userId?: string;
  sessionId?: string;
}

export type ImportExportEventType =
  | 'file_selected'
  | 'parsing_started'
  | 'parsing_completed'
  | 'parsing_failed'
  | 'validation_started'
  | 'validation_completed'
  | 'validation_failed'
  | 'mapping_updated'
  | 'import_started'
  | 'import_progress'
  | 'import_completed'
  | 'import_failed'
  | 'import_cancelled'
  | 'export_started'
  | 'export_progress'
  | 'export_completed'
  | 'export_failed'
  | 'rollback_initiated'
  | 'rollback_completed'
  | 'rollback_failed';

// API response types
export interface ImportExportApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

// Configuration types
export interface ImportExportConfig {
  maxFileSize: number;
  supportedFormats: string[];
  batchSizes: { [format: string]: number };
  timeouts: {
    parse: number;
    validate: number;
    import: number;
    export: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  security: {
    allowedMimeTypes: string[];
    scanForMalware: boolean;
    encryptionRequired: boolean;
  };
}

// Hook return types
export interface UseFileImportReturn {
  // State
  importState: ImportWorkflow | null;
  progress: ImportProgress | null;
  previewData: ImportPreviewData | null;
  validationResult: ValidationResult | null;
  importResult: ImportResult | null;
  
  // Actions
  selectFile: (file: File, importType: ImportType) => Promise<void>;
  updateColumnMapping: (mapping: ColumnMapping) => void;
  validateData: () => Promise<ValidationResult>;
  startImport: () => Promise<ImportResult>;
  cancelImport: () => void;
  resetImport: () => void;
  
  // Utils
  getTemplates: () => ImportTemplate[];
  downloadTemplate: (templateId: string) => void;
  getSampleData: (importType: ImportType) => any[];
}

export interface UseDataExportReturn {
  // State
  exportOptions: ExportOptions;
  exportProgress: ExportProgress | null;
  exportResult: ExportResult | null;
  isExporting: boolean;
  
  // Actions
  updateExportOptions: (options: Partial<ExportOptions>) => void;
  startExport: (data: any[]) => Promise<ExportResult>;
  cancelExport: () => void;
  downloadExport: () => void;
  
  // Utils
  getTemplates: () => ExportTemplate[];
  saveTemplate: (template: Omit<ExportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  scheduleExport: (schedule: Omit<ScheduledExport, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

// All types are already exported above with their declarations