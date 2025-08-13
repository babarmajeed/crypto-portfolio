import { FileStorageConfig } from '../types/file.types';

export const storageConfig: FileStorageConfig = {
  provider: (process.env.STORAGE_PROVIDER as 'local' | 's3' | 'cloudinary') || 's3',
  
  local: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    publicPath: process.env.PUBLIC_PATH || '/uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '104857600') // 100MB default
  },
  
  s3: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || 'crypto-portfolio-files',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    endpoint: process.env.AWS_S3_ENDPOINT,
    signatureVersion: 'v4'
  },
  
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
  },
  
  cdnUrl: process.env.CDN_URL || process.env.CLOUDFRONT_URL,
  signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY || '3600'), // 1 hour default
  virusScanEnabled: process.env.VIRUS_SCAN_ENABLED === 'true',
  
  autoCleanup: {
    enabled: process.env.AUTO_CLEANUP_ENABLED !== 'false',
    temporaryFilesTTL: parseInt(process.env.TEMP_FILES_TTL || '24'), // 24 hours default
    runInterval: parseInt(process.env.CLEANUP_INTERVAL || '6') // Run every 6 hours
  }
};

export const uploadLimits = {
  profilePicture: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  },
  
  transactionImport: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['text/csv', 'application/json', 'text/plain'],
    allowedExtensions: ['.csv', '.json', '.txt']
  },
  
  portfolioExport: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: [
      'text/csv',
      'application/json',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    allowedExtensions: ['.csv', '.json', '.pdf', '.xlsx']
  },
  
  document: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf'],
    allowedExtensions: ['.pdf']
  }
};

export const imageProcessingConfig = {
  profilePicture: {
    sizes: [
      { name: 'thumbnail', width: 150, height: 150 },
      { name: 'small', width: 300, height: 300 },
      { name: 'medium', width: 600, height: 600 },
      { name: 'large', width: 1200, height: 1200 }
    ],
    format: 'webp' as const,
    quality: 85,
    optimize: true
  },
  
  general: {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 90,
    formats: ['jpeg', 'png', 'webp'] as const
  }
};

export const s3Config = {
  buckets: {
    main: process.env.AWS_S3_BUCKET || 'crypto-portfolio-files',
    backup: process.env.AWS_S3_BACKUP_BUCKET || 'crypto-portfolio-backups',
    temp: process.env.AWS_S3_TEMP_BUCKET || 'crypto-portfolio-temp'
  },
  
  folders: {
    profilePictures: 'profile-pictures',
    transactionImports: 'transaction-imports',
    portfolioExports: 'portfolio-exports',
    documents: 'documents',
    temporary: 'temp',
    backups: 'backups'
  },
  
  lifecycle: {
    temporary: {
      expiration: 1, // days
      storageClass: 'STANDARD' as const
    },
    archives: {
      transitionToIA: 30, // days to STANDARD_IA
      transitionToGlacier: 90, // days to GLACIER
      expiration: 365 // days
    }
  },
  
  encryption: {
    enabled: true,
    algorithm: 'AES256' as const
  },
  
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    allowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
    allowedHeaders: ['*'],
    maxAge: 3600
  }
};

export default {
  storageConfig,
  uploadLimits,
  imageProcessingConfig,
  s3Config
};