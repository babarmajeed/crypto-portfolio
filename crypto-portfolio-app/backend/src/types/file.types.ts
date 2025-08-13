export interface FileUploadOptions {
  fieldName: string;
  maxSize: number;
  allowedTypes: string[];
  destination: string;
  preserveOriginalName?: boolean;
  generateThumbnail?: boolean;
  scanForVirus?: boolean;
}

export interface FileMetadata {
  id: string;
  userId: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  url?: string;
  thumbnailUrl?: string;
  bucket?: string;
  key?: string;
  etag?: string;
  checksum?: string;
  category: FileCategory;
  metadata?: Record<string, any>;
  isTemporary: boolean;
  expiresAt?: Date;
  virusScanStatus?: VirusScanStatus;
  virusScanResult?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum FileCategory {
  PROFILE_PICTURE = 'PROFILE_PICTURE',
  TRANSACTION_IMPORT = 'TRANSACTION_IMPORT',
  PORTFOLIO_EXPORT = 'PORTFOLIO_EXPORT',
  DOCUMENT = 'DOCUMENT',
  REPORT = 'REPORT',
  BACKUP = 'BACKUP',
  TEMPORARY = 'TEMPORARY'
}

export enum VirusScanStatus {
  PENDING = 'PENDING',
  SCANNING = 'SCANNING',
  CLEAN = 'CLEAN',
  INFECTED = 'INFECTED',
  ERROR = 'ERROR',
  SKIPPED = 'SKIPPED'
}

export interface ImageProcessingOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  thumbnail?: {
    width: number;
    height: number;
  };
  optimize?: boolean;
  watermark?: {
    text?: string;
    imagePath?: string;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity?: number;
  };
}

export interface S3UploadOptions {
  bucket: string;
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType?: string;
  contentDisposition?: string;
  serverSideEncryption?: 'AES256';
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
  storageClass?: 'STANDARD' | 'REDUCED_REDUNDANCY' | 'STANDARD_IA' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'DEEP_ARCHIVE';
  tagging?: Record<string, string>;
}

export interface SignedUrlOptions {
  expires?: number; // seconds
  responseContentType?: string;
  responseContentDisposition?: string;
  versionId?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    size: number;
    mimeType: string;
    extension: string;
    dimensions?: {
      width: number;
      height: number;
    };
  };
}

export interface CSVImportOptions {
  headers?: string[] | boolean;
  delimiter?: string;
  skipLines?: number;
  maxRecords?: number;
  validateRow?: (row: any) => boolean;
  transformRow?: (row: any) => any;
}

export interface CSVImportResult {
  success: boolean;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  data: any[];
  warnings: string[];
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'excel';
  filters?: Record<string, any>;
  columns?: string[];
  includeHeaders?: boolean;
  compression?: boolean;
  encryptionKey?: string;
}

export interface FileCleanupOptions {
  olderThan?: Date;
  category?: FileCategory;
  includeTemporary?: boolean;
  dryRun?: boolean;
}

export interface FileStorageConfig {
  provider: 'local' | 's3' | 'cloudinary';
  local?: {
    uploadDir: string;
    publicPath: string;
    maxSize: number;
  };
  s3?: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    signatureVersion?: string;
  };
  cloudinary?: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    uploadPreset?: string;
  };
  cdnUrl?: string;
  signedUrlExpiry?: number;
  virusScanEnabled?: boolean;
  autoCleanup?: {
    enabled: boolean;
    temporaryFilesTTL: number; // hours
    runInterval: number; // hours
  };
}

export interface FileUploadProgress {
  filename: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface BatchUploadResult {
  successful: FileMetadata[];
  failed: Array<{
    filename: string;
    error: string;
  }>;
  totalFiles: number;
  successCount: number;
  failCount: number;
}

export interface FileAccessLog {
  id: string;
  fileId: string;
  userId: string;
  action: 'view' | 'download' | 'share' | 'delete';
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  DATA_FILE: 50 * 1024 * 1024, // 50MB
  EXPORT: 100 * 1024 * 1024 // 100MB
};

export const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENT: ['application/pdf'],
  DATA: ['text/csv', 'application/json', 'text/plain'],
  EXPORT: ['text/csv', 'application/json', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
};

export const FILE_EXTENSIONS = {
  IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  DOCUMENT: ['.pdf'],
  DATA: ['.csv', '.json', '.txt'],
  EXPORT: ['.csv', '.json', '.pdf', '.xlsx']
};