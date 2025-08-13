/**
 * Backup configuration and settings
 * Centralized configuration for backup operations, storage, and policies
 */

import { BackupType, StorageType, AlertSeverity } from '../types/backup.types';

export interface BackupConfig {
  database: DatabaseConfig;
  storage: StorageConfig;
  retention: RetentionConfig;
  encryption: EncryptionConfig;
  compression: CompressionConfig;
  monitoring: MonitoringConfig;
  disaster: DisasterRecoveryConfig;
  compliance: ComplianceConfig;
  performance: PerformanceConfig;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionTimeout: number;
  queryTimeout: number;
  maxConnections: number;
  ssl: {
    enabled: boolean;
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
}

export interface StorageConfig {
  local: {
    basePath: string;
    tempPath: string;
    permissions: string;
    diskSpaceThreshold: number; // percentage
  };
  s3: {
    region: string;
    bucket: string;
    prefix: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    storageClass: 'STANDARD' | 'STANDARD_IA' | 'ONEZONE_IA' | 'GLACIER';
    multipartThreshold: number; // bytes
    partSize: number; // bytes
  };
  glacier: {
    region: string;
    vaultName: string;
    accessKeyId: string;
    secretAccessKey: string;
    archiveDescription: string;
  };
}

export interface RetentionConfig {
  policies: {
    [BackupType.FULL]: {
      daily: number;
      weekly: number;
      monthly: number;
      yearly: number;
    };
    [BackupType.INCREMENTAL]: {
      hours: number;
      daily: number;
    };
    [BackupType.SCHEMA_ONLY]: {
      weekly: number;
      monthly: number;
    };
    [BackupType.DATA_ONLY]: {
      daily: number;
      weekly: number;
    };
  };
  minimumCopies: number;
  maximumAge: number; // days
  archiveToGlacier: number; // days after which to move to Glacier
  deleteAfterArchive: number; // days after archiving to delete from S3
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';
  keyManagement: {
    provider: 'local' | 'aws-kms' | 'hashicorp-vault';
    keyId: string;
    rotationInterval: number; // days
    autoRotate: boolean;
  };
  atRest: boolean;
  inTransit: boolean;
}

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'bzip2' | 'lz4' | 'zstd';
  level: number; // 1-9
  threshold: number; // minimum file size to compress (bytes)
}

export interface MonitoringConfig {
  healthChecks: {
    enabled: boolean;
    interval: number; // minutes
    timeout: number; // seconds
  };
  alerts: {
    enabled: boolean;
    channels: AlertChannel[];
    thresholds: {
      backupFailure: AlertSeverity;
      storageUsage: number; // percentage
      backupOverdue: number; // hours
      verificationFailure: AlertSeverity;
    };
  };
  metrics: {
    enabled: boolean;
    retentionDays: number;
    aggregationInterval: number; // minutes
  };
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: {
    email?: {
      to: string[];
      from: string;
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
    slack?: {
      webhookUrl: string;
      channel: string;
      username: string;
      iconEmoji: string;
    };
    webhook?: {
      url: string;
      method: 'POST' | 'PUT';
      headers: Record<string, string>;
      timeout: number;
    };
    sms?: {
      provider: 'twilio' | 'aws-sns';
      accountSid?: string;
      authToken?: string;
      from?: string;
      to: string[];
    };
  };
}

export interface DisasterRecoveryConfig {
  enabled: boolean;
  testingSchedule: {
    frequency: 'monthly' | 'quarterly' | 'yearly';
    dayOfWeek: number; // 0-6, Sunday = 0
    hour: number; // 0-23
  };
  rto: {
    critical: number; // minutes
    high: number;
    medium: number;
    low: number;
  };
  rpo: {
    critical: number; // minutes
    high: number;
    medium: number;
    low: number;
  };
  contacts: {
    primary: string;
    secondary: string;
    escalation: string[];
  };
}

export interface ComplianceConfig {
  gdpr: {
    enabled: boolean;
    dataRetentionDays: number;
    anonymizationDays: number;
    exportFormats: string[];
    deletionPolicy: 'immediate' | 'scheduled';
  };
  sox: {
    enabled: boolean;
    auditRetentionYears: number;
    segregationOfDuties: boolean;
  };
  hipaa: {
    enabled: boolean;
    encryptionRequired: boolean;
    accessLogging: boolean;
    retentionYears: number;
  };
  pci: {
    enabled: boolean;
    cardDataRetentionDays: number;
    tokenization: boolean;
  };
}

export interface PerformanceConfig {
  maxConcurrentBackups: number;
  maxConcurrentRecoveries: number;
  networkTimeout: number; // seconds
  retryAttempts: number;
  retryDelay: number; // seconds
  chunkSize: number; // bytes for large file processing
  parallelUploads: number;
  checksumValidation: boolean;
  progressReporting: {
    enabled: boolean;
    interval: number; // seconds
  };
}

// Default configuration
export const defaultBackupConfig: BackupConfig = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'crypto_portfolio',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    connectionTimeout: 30000,
    queryTimeout: 300000,
    maxConnections: 5,
    ssl: {
      enabled: process.env.DB_SSL === 'true',
      rejectUnauthorized: false
    }
  },
  storage: {
    local: {
      basePath: process.env.BACKUP_LOCAL_PATH || '/var/backups/crypto-portfolio',
      tempPath: process.env.BACKUP_TEMP_PATH || '/tmp/crypto-portfolio-backups',
      permissions: '0640',
      diskSpaceThreshold: 85
    },
    s3: {
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.BACKUP_S3_BUCKET || 'crypto-portfolio-backups',
      prefix: 'backups/',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      storageClass: 'STANDARD_IA',
      multipartThreshold: 100 * 1024 * 1024, // 100MB
      partSize: 50 * 1024 * 1024 // 50MB
    },
    glacier: {
      region: process.env.AWS_REGION || 'us-east-1',
      vaultName: process.env.BACKUP_GLACIER_VAULT || 'crypto-portfolio-archive',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      archiveDescription: 'Crypto Portfolio Backup Archive'
    }
  },
  retention: {
    policies: {
      [BackupType.FULL]: {
        daily: 30,
        weekly: 12,
        monthly: 12,
        yearly: 7
      },
      [BackupType.INCREMENTAL]: {
        hours: 48,
        daily: 7
      },
      [BackupType.SCHEMA_ONLY]: {
        weekly: 12,
        monthly: 12
      },
      [BackupType.DATA_ONLY]: {
        daily: 30,
        weekly: 12
      }
    },
    minimumCopies: 3,
    maximumAge: 2555, // 7 years in days
    archiveToGlacier: 90,
    deleteAfterArchive: 365
  },
  encryption: {
    enabled: true,
    algorithm: 'AES-256-GCM',
    keyManagement: {
      provider: 'aws-kms',
      keyId: process.env.BACKUP_KMS_KEY_ID || '',
      rotationInterval: 90,
      autoRotate: true
    },
    atRest: true,
    inTransit: true
  },
  compression: {
    enabled: true,
    algorithm: 'gzip',
    level: 6,
    threshold: 1024 * 1024 // 1MB
  },
  monitoring: {
    healthChecks: {
      enabled: true,
      interval: 5, // minutes
      timeout: 30 // seconds
    },
    alerts: {
      enabled: true,
      channels: [
        {
          type: 'email',
          config: {
            email: {
              to: [process.env.ALERT_EMAIL || 'admin@example.com'],
              from: process.env.FROM_EMAIL || 'noreply@crypto-portfolio.com',
              smtp: {
                host: process.env.SMTP_HOST || 'localhost',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false,
                auth: {
                  user: process.env.SMTP_USER || '',
                  pass: process.env.SMTP_PASS || ''
                }
              }
            }
          }
        }
      ],
      thresholds: {
        backupFailure: AlertSeverity.HIGH,
        storageUsage: 80,
        backupOverdue: 6,
        verificationFailure: AlertSeverity.MEDIUM
      }
    },
    metrics: {
      enabled: true,
      retentionDays: 90,
      aggregationInterval: 15
    }
  },
  disaster: {
    enabled: true,
    testingSchedule: {
      frequency: 'quarterly',
      dayOfWeek: 0, // Sunday
      hour: 2
    },
    rto: {
      critical: 60,
      high: 240,
      medium: 480,
      low: 1440
    },
    rpo: {
      critical: 15,
      high: 60,
      medium: 240,
      low: 1440
    },
    contacts: {
      primary: process.env.DR_PRIMARY_CONTACT || 'admin@example.com',
      secondary: process.env.DR_SECONDARY_CONTACT || 'backup-admin@example.com',
      escalation: [
        process.env.DR_ESCALATION_1 || 'manager@example.com',
        process.env.DR_ESCALATION_2 || 'cto@example.com'
      ]
    }
  },
  compliance: {
    gdpr: {
      enabled: true,
      dataRetentionDays: 1095, // 3 years
      anonymizationDays: 30,
      exportFormats: ['json', 'csv', 'pdf'],
      deletionPolicy: 'scheduled'
    },
    sox: {
      enabled: false,
      auditRetentionYears: 7,
      segregationOfDuties: true
    },
    hipaa: {
      enabled: false,
      encryptionRequired: true,
      accessLogging: true,
      retentionYears: 6
    },
    pci: {
      enabled: false,
      cardDataRetentionDays: 90,
      tokenization: true
    }
  },
  performance: {
    maxConcurrentBackups: 3,
    maxConcurrentRecoveries: 2,
    networkTimeout: 300,
    retryAttempts: 3,
    retryDelay: 5,
    chunkSize: 64 * 1024 * 1024, // 64MB
    parallelUploads: 4,
    checksumValidation: true,
    progressReporting: {
      enabled: true,
      interval: 10
    }
  }
};

// Schedule configurations
export const backupSchedules = {
  full: {
    daily: '0 2 * * *', // 2 AM daily
    weekly: '0 1 * * 0', // 1 AM Sunday
    monthly: '0 0 1 * *' // Midnight on 1st of month
  },
  incremental: {
    hourly: '0 * * * *', // Every hour
    businessHours: '0 9-17 * * 1-5' // Business hours weekdays
  },
  schema: {
    weekly: '0 3 * * 0' // 3 AM Sunday
  },
  verification: {
    daily: '0 4 * * *', // 4 AM daily
    weekly: '0 5 * * 0' // 5 AM Sunday
  },
  cleanup: {
    daily: '0 6 * * *' // 6 AM daily
  }
};

// Recovery objectives by data classification
export const recoveryObjectives = {
  critical: {
    rto: 60, // 1 hour
    rpo: 15  // 15 minutes
  },
  important: {
    rto: 240, // 4 hours
    rpo: 60   // 1 hour
  },
  standard: {
    rto: 480, // 8 hours
    rpo: 240  // 4 hours
  },
  low: {
    rto: 1440, // 24 hours
    rpo: 1440  // 24 hours
  }
};

// Storage tier definitions
export const storageTiers = {
  hot: {
    type: StorageType.LOCAL,
    access: 'immediate',
    cost: 'high',
    durability: '99.9%'
  },
  warm: {
    type: StorageType.S3,
    access: 'minutes',
    cost: 'medium',
    durability: '99.999999999%'
  },
  cold: {
    type: StorageType.GLACIER,
    access: 'hours',
    cost: 'low',
    durability: '99.999999999%'
  }
};

export { BackupConfig };