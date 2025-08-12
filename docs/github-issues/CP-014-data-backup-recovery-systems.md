# CP-014: Data Backup and Recovery Systems

## Objective
Implement comprehensive data backup and recovery systems to ensure data integrity, availability, and compliance with disaster recovery requirements for the crypto portfolio application.

## Priority
High

## Category
Backend Infrastructure

## Acceptance Criteria
- [ ] Automated database backup scheduling and execution
- [ ] Multiple backup storage locations (local, cloud, offsite)
- [ ] Point-in-time recovery capabilities
- [ ] Backup encryption and security measures
- [ ] Backup verification and integrity testing
- [ ] Recovery procedures and documentation
- [ ] Backup monitoring and alerting system
- [ ] User data export and portability features
- [ ] Compliance with data protection regulations
- [ ] Disaster recovery testing and validation

## Technical Implementation Details

### Backup Service Architecture
```javascript
// services/backupService.js
const { exec } = require('child_process');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class BackupService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
    
    this.backupBucket = process.env.BACKUP_S3_BUCKET;
    this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
    this.backupDir = process.env.BACKUP_LOCAL_DIR || '/backups';
    
    this.logger = require('./loggingService');
  }

  async createDatabaseBackup(options = {}) {
    const {
      type = 'full', // full, incremental, differential
      compress = true,
      encrypt = true
    } = options;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `db-backup-${type}-${timestamp}`;
      const backupPath = path.join(this.backupDir, `${backupName}.sql`);

      this.logger.info('Starting database backup', {
        type,
        backupName,
        timestamp
      });

      // Create database dump
      await this.createDatabaseDump(backupPath, type);

      // Compress if requested
      let finalBackupPath = backupPath;
      if (compress) {
        finalBackupPath = await this.compressBackup(backupPath);
        await fs.unlink(backupPath); // Remove uncompressed file
      }

      // Encrypt if requested
      if (encrypt) {
        finalBackupPath = await this.encryptBackup(finalBackupPath);
        
        if (compress) {
          await fs.unlink(finalBackupPath.replace('.enc', '')); // Remove unencrypted file
        }
      }

      // Generate checksum
      const checksum = await this.generateChecksum(finalBackupPath);

      // Upload to cloud storage
      const s3Key = await this.uploadToS3(finalBackupPath, `database/${backupName}`);

      // Store backup metadata
      const backupRecord = await Backup.create({
        name: backupName,
        type,
        path: finalBackupPath,
        s3Key,
        size: (await fs.stat(finalBackupPath)).size,
        checksum,
        compressed: compress,
        encrypted: encrypt,
        status: 'completed',
        createdAt: new Date()
      });

      this.logger.info('Database backup completed successfully', {
        backupId: backupRecord.id,
        size: backupRecord.size,
        s3Key
      });

      return backupRecord;
    } catch (error) {
      this.logger.error('Database backup failed', error, { type, options });
      throw error;
    }
  }

  async createDatabaseDump(outputPath, type) {
    return new Promise((resolve, reject) => {
      let command;
      
      switch (type) {
        case 'full':
          command = `pg_dump ${process.env.DATABASE_URL} > "${outputPath}"`;
          break;
        case 'schema':
          command = `pg_dump --schema-only ${process.env.DATABASE_URL} > "${outputPath}"`;
          break;
        case 'data':
          command = `pg_dump --data-only ${process.env.DATABASE_URL} > "${outputPath}"`;
          break;
        default:
          return reject(new Error(`Unknown backup type: ${type}`));
      }

      exec(command, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        
        if (stderr && !stderr.includes('NOTICE')) {
          return reject(new Error(stderr));
        }
        
        resolve(outputPath);
      });
    });
  }

  async compressBackup(filePath) {
    const compressedPath = `${filePath}.gz`;
    
    return new Promise((resolve, reject) => {
      exec(`gzip -c "${filePath}" > "${compressedPath}"`, (error) => {
        if (error) {
          return reject(error);
        }
        resolve(compressedPath);
      });
    });
  }

  async encryptBackup(filePath) {
    const encryptedPath = `${filePath}.enc`;
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    
    const input = await fs.readFile(filePath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    
    await fs.writeFile(encryptedPath, encrypted);
    return encryptedPath;
  }

  async generateChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  async uploadToS3(filePath, s3KeyPrefix) {
    const fileName = path.basename(filePath);
    const s3Key = `${s3KeyPrefix}/${fileName}`;
    
    const fileContent = await fs.readFile(filePath);
    
    const uploadParams = {
      Bucket: this.backupBucket,
      Key: s3Key,
      Body: fileContent,
      ServerSideEncryption: 'AES256',
      StorageClass: 'STANDARD_IA', // Infrequent Access for cost optimization
      Metadata: {
        created: new Date().toISOString(),
        checksum: await this.generateChecksum(filePath)
      }
    };

    await this.s3.upload(uploadParams).promise();
    return s3Key;
  }

  async verifyBackup(backupId) {
    try {
      const backup = await Backup.findById(backupId);
      
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Verify local file checksum
      if (await fs.access(backup.path).then(() => true).catch(() => false)) {
        const currentChecksum = await this.generateChecksum(backup.path);
        if (currentChecksum !== backup.checksum) {
          throw new Error('Local backup file checksum mismatch');
        }
      }

      // Verify S3 backup
      const s3Object = await this.s3.headObject({
        Bucket: this.backupBucket,
        Key: backup.s3Key
      }).promise();

      if (!s3Object) {
        throw new Error('S3 backup file not found');
      }

      // Update backup verification status
      await backup.update({
        lastVerified: new Date(),
        verificationStatus: 'verified'
      });

      this.logger.info('Backup verification successful', {
        backupId,
        localFileExists: true,
        s3FileExists: true,
        checksumValid: true
      });

      return true;
    } catch (error) {
      this.logger.error('Backup verification failed', error, { backupId });
      
      if (backupId) {
        await Backup.update(
          { verificationStatus: 'failed', lastVerificationError: error.message },
          { where: { id: backupId } }
        );
      }
      
      throw error;
    }
  }

  async restoreFromBackup(backupId, options = {}) {
    const {
      targetDatabase = process.env.DATABASE_URL,
      dropExisting = false,
      tableFilters = []
    } = options;

    try {
      const backup = await Backup.findById(backupId);
      
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      this.logger.info('Starting database restore', {
        backupId,
        backupName: backup.name,
        targetDatabase: targetDatabase.split('@')[1] // Hide credentials
      });

      // Download from S3 if not available locally
      let restoreFilePath = backup.path;
      if (!await fs.access(backup.path).then(() => true).catch(() => false)) {
        restoreFilePath = await this.downloadFromS3(backup.s3Key);
      }

      // Decrypt if encrypted
      if (backup.encrypted) {
        restoreFilePath = await this.decryptBackup(restoreFilePath);
      }

      // Decompress if compressed
      if (backup.compressed) {
        restoreFilePath = await this.decompressBackup(restoreFilePath);
      }

      // Verify backup integrity before restore
      const checksum = await this.generateChecksum(restoreFilePath);
      if (checksum !== backup.checksum) {
        throw new Error('Backup file integrity check failed');
      }

      // Perform restore
      await this.performDatabaseRestore(restoreFilePath, targetDatabase, {
        dropExisting,
        tableFilters
      });

      this.logger.info('Database restore completed successfully', {
        backupId,
        targetDatabase: targetDatabase.split('@')[1]
      });

      return true;
    } catch (error) {
      this.logger.error('Database restore failed', error, { backupId, options });
      throw error;
    }
  }

  async performDatabaseRestore(filePath, targetDatabase, options) {
    const { dropExisting, tableFilters } = options;
    
    return new Promise((resolve, reject) => {
      let command = `psql ${targetDatabase} < "${filePath}"`;
      
      if (dropExisting) {
        // This is dangerous - implement with extreme caution
        command = `dropdb ${targetDatabase.split('/').pop()} && createdb ${targetDatabase.split('/').pop()} && ${command}`;
      }

      exec(command, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        
        resolve(stdout);
      });
    });
  }
}
```

### Backup Scheduler
```javascript
// schedulers/backupScheduler.js
const cron = require('node-cron');
const backupService = new BackupService();

class BackupScheduler {
  static init() {
    // Daily full backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        await backupService.createDatabaseBackup({
          type: 'full',
          compress: true,
          encrypt: true
        });
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    });

    // Hourly incremental backups during business hours
    cron.schedule('0 9-17 * * 1-5', async () => {
      try {
        await backupService.createDatabaseBackup({
          type: 'incremental',
          compress: true,
          encrypt: true
        });
      } catch (error) {
        console.error('Incremental backup failed:', error);
      }
    });

    // Weekly backup verification
    cron.schedule('0 3 * * 0', async () => {
      try {
        await this.verifyRecentBackups();
      } catch (error) {
        console.error('Backup verification failed:', error);
      }
    });

    // Monthly cleanup of old backups
    cron.schedule('0 4 1 * *', async () => {
      try {
        await this.cleanupOldBackups();
      } catch (error) {
        console.error('Backup cleanup failed:', error);
      }
    });
  }

  static async verifyRecentBackups() {
    const recentBackups = await Backup.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      order: [['createdAt', 'DESC']]
    });

    for (const backup of recentBackups) {
      try {
        await backupService.verifyBackup(backup.id);
      } catch (error) {
        // Alert operations team
        await alertService.sendAlert({
          type: 'backup_verification_failed',
          backupId: backup.id,
          error: error.message
        });
      }
    }
  }

  static async cleanupOldBackups() {
    const retentionPeriod = 90; // days
    const cutoffDate = new Date(Date.now() - retentionPeriod * 24 * 60 * 60 * 1000);

    const oldBackups = await Backup.findAll({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate
        }
      }
    });

    for (const backup of oldBackups) {
      try {
        // Delete from S3
        await backupService.s3.deleteObject({
          Bucket: backupService.backupBucket,
          Key: backup.s3Key
        }).promise();

        // Delete local file if exists
        try {
          await fs.unlink(backup.path);
        } catch (error) {
          // File might not exist locally
        }

        // Remove from database
        await backup.destroy();

        backupService.logger.info('Old backup cleaned up', {
          backupId: backup.id,
          age: Math.ceil((new Date() - backup.createdAt) / (1000 * 60 * 60 * 24))
        });
      } catch (error) {
        backupService.logger.error('Failed to cleanup old backup', error, {
          backupId: backup.id
        });
      }
    }
  }
}
```

### User Data Export Service
```javascript
// services/userDataExportService.js
class UserDataExportService {
  constructor() {
    this.logger = require('./loggingService');
  }

  async exportUserData(userId, format = 'json') {
    try {
      this.logger.info('Starting user data export', { userId, format });

      const userData = await this.collectUserData(userId);
      
      let exportData;
      switch (format) {
        case 'json':
          exportData = JSON.stringify(userData, null, 2);
          break;
        case 'csv':
          exportData = await this.convertToCSV(userData);
          break;
        case 'pdf':
          exportData = await this.generatePDF(userData);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Store export file
      const exportRecord = await UserDataExport.create({
        userId,
        format,
        status: 'completed',
        fileSize: Buffer.byteLength(exportData),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      // Upload to secure storage
      const s3Key = await this.uploadExportToS3(exportData, exportRecord.id, format);
      
      await exportRecord.update({ s3Key });

      // Send notification to user
      await notificationService.sendDataExportReadyNotification(userId, exportRecord);

      return exportRecord;
    } catch (error) {
      this.logger.error('User data export failed', error, { userId, format });
      throw error;
    }
  }

  async collectUserData(userId) {
    const user = await User.findById(userId, {
      include: [
        { model: Portfolio, include: [Transaction, Holding] },
        { model: Alert },
        { model: UserPreference }
      ]
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
      },
      portfolios: user.Portfolios.map(portfolio => ({
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        createdAt: portfolio.createdAt,
        transactions: portfolio.Transactions,
        holdings: portfolio.Holdings
      })),
      alerts: user.Alerts,
      preferences: user.UserPreferences,
      exportedAt: new Date().toISOString()
    };
  }
}
```

## Required Technologies
- **PostgreSQL** - Database with backup utilities
- **AWS S3** - Cloud backup storage
- **node-cron** - Backup scheduling
- **crypto** - Backup encryption
- **zlib/gzip** - Backup compression

## Testing Requirements

### Unit Tests
```javascript
describe('BackupService', () => {
  test('should create database backup successfully', async () => {
    const backup = await backupService.createDatabaseBackup({
      type: 'full',
      compress: true,
      encrypt: true
    });

    expect(backup.name).toContain('db-backup-full');
    expect(backup.compressed).toBe(true);
    expect(backup.encrypted).toBe(true);
    expect(backup.status).toBe('completed');
  });

  test('should verify backup integrity', async () => {
    const backup = await Backup.findOne();
    const isValid = await backupService.verifyBackup(backup.id);
    
    expect(isValid).toBe(true);
  });
});
```

### Integration Tests
```javascript
describe('Backup and Restore', () => {
  test('should complete full backup and restore cycle', async () => {
    // Create test data
    const testUser = await User.create({ email: 'test@example.com' });
    
    // Create backup
    const backup = await backupService.createDatabaseBackup({ type: 'full' });
    
    // Modify data
    await testUser.update({ email: 'modified@example.com' });
    
    // Restore backup
    await backupService.restoreFromBackup(backup.id);
    
    // Verify original data restored
    const restoredUser = await User.findById(testUser.id);
    expect(restoredUser.email).toBe('test@example.com');
  });
});
```

## Dependencies
- CP-001: Database Design and Schema
- CP-013: Logging, Monitoring and Analytics
- CP-011: File Upload and Storage Management

## Backup Strategy

### Backup Types
1. **Full Backup** - Complete database dump (daily)
2. **Incremental Backup** - Changes since last backup (hourly)
3. **Schema Backup** - Database structure only (weekly)
4. **Configuration Backup** - Application settings (daily)

### Storage Locations
1. **Local Storage** - Fast access for recent backups
2. **AWS S3** - Primary cloud storage with versioning
3. **Glacier** - Long-term archival storage
4. **Offsite** - Geographic redundancy

### Retention Policy
- Daily backups: 30 days
- Weekly backups: 12 weeks
- Monthly backups: 12 months
- Yearly backups: 7 years

## Recovery Procedures

### Recovery Time Objectives (RTO)
- Critical data: 1 hour
- Full system: 4 hours
- Non-critical data: 24 hours

### Recovery Point Objectives (RPO)
- Transactional data: 1 hour
- User data: 4 hours
- Configuration: 24 hours

## Definition of Done
- [ ] Automated backup system implemented and scheduled
- [ ] Multiple storage locations configured
- [ ] Backup encryption and compression working
- [ ] Point-in-time recovery capabilities tested
- [ ] Backup verification and integrity checks functional
- [ ] User data export features implemented
- [ ] Recovery procedures documented and tested
- [ ] Monitoring and alerting for backup failures
- [ ] Compliance with data protection requirements
- [ ] Disaster recovery testing completed
- [ ] All backup tests passing
- [ ] Production deployment with full backup coverage

## Estimated Time
**Beginner Developer**: 8-10 days
**Intermediate Developer**: 5-7 days
**Senior Developer**: 4-5 days

## Required Skills
- Database backup and recovery procedures
- Cloud storage services (AWS S3, Glacier)
- Encryption and security best practices
- Disaster recovery planning
- Cron job scheduling and automation
- File compression and archiving
- Compliance and data protection laws
- System administration and DevOps

## Related Issues
- CP-001: Database Design and Schema
- CP-013: Logging, Monitoring and Analytics
- CP-011: File Upload and Storage Management
- CP-067: CI/CD Pipeline with GitHub Actions