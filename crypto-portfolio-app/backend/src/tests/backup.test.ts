/**
 * Comprehensive test suite for backup operations
 * Tests backup service, recovery, encryption, and monitoring functionality
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import {
  BackupConfiguration,
  BackupJob,
  BackupJobStatus,
  BackupType,
  RecoveryRequest,
  RecoveryType,
  UserDataExportRequest,
  ExportType,
  ExportFormat,
  StorageType
} from '../types/backup.types';
import BackupService from '../services/backupService';
import RecoveryService from '../services/recoveryService';
import UserDataExportService from '../services/userDataExportService';
import BackupScheduler from '../schedulers/backupScheduler';
import BackupMonitor from '../monitoring/backupMonitor';
import { EncryptionUtils, LocalKeyProvider } from '../utils/encryptionUtils';

describe('Backup and Recovery System', () => {
  let pool: Pool;
  let backupService: BackupService;
  let recoveryService: RecoveryService;
  let exportService: UserDataExportService;
  let scheduler: BackupScheduler;
  let monitor: BackupMonitor;
  let encryptionUtils: EncryptionUtils;
  let testClient: PoolClient;
  let tempDir: string;

  // Test data
  let testConfiguration: BackupConfiguration;
  let testBackupJob: BackupJob;
  let testRecoveryRequest: RecoveryRequest;

  before(async () => {
    // Setup test database connection
    pool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'crypto_portfolio_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
      max: 5
    });

    // Setup temporary directory for tests
    tempDir = path.join(__dirname, '../../temp/test');
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Initialize encryption utils with test key provider
    const keyProvider = new LocalKeyProvider(path.join(tempDir, 'keys'));
    encryptionUtils = new EncryptionUtils(keyProvider);

    // Initialize services
    backupService = new BackupService(pool);
    recoveryService = new RecoveryService(pool, backupService, encryptionUtils);
    exportService = new UserDataExportService(pool, encryptionUtils);
    scheduler = new BackupScheduler(pool, backupService, encryptionUtils);
    monitor = new BackupMonitor(pool);

    // Setup test database schema
    await setupTestDatabase();
  });

  after(async () => {
    // Cleanup
    if (testClient) {
      testClient.release();
    }
    
    await pool.end();
    
    // Cleanup temp directory
    try {
      await fs.promises.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    testClient = await pool.connect();
    
    // Create test configuration
    testConfiguration = createTestBackupConfiguration();
    
    // Clean test data
    await cleanupTestData();
  });

  afterEach(async () => {
    if (testClient) {
      testClient.release();
    }
    
    // Clean up test files
    await cleanupTestFiles();
  });

  describe('BackupService', () => {
    describe('createBackup', () => {
      it('should create a full backup successfully', async () => {
        const job = await backupService.createBackup(testConfiguration);
        
        expect(job).to.be.an('object');
        expect(job.id).to.be.a('string');
        expect(job.type).to.equal(BackupType.FULL);
        expect(job.status).to.be.oneOf([BackupJobStatus.COMPLETED, BackupJobStatus.VERIFIED]);
        expect(job.startTime).to.be.a('date');
        expect(job.configurationId).to.equal(testConfiguration.id);
      });

      it('should create a schema-only backup', async () => {
        const schemaConfig = {
          ...testConfiguration,
          type: BackupType.SCHEMA_ONLY
        };

        const job = await backupService.createBackup(schemaConfig);
        
        expect(job.type).to.equal(BackupType.SCHEMA_ONLY);
        expect(job.status).to.be.oneOf([BackupJobStatus.COMPLETED, BackupJobStatus.VERIFIED]);
      });

      it('should handle backup failures gracefully', async () => {
        const invalidConfig = {
          ...testConfiguration,
          target: {
            type: 'database' as const,
            database: {
              host: 'invalid-host',
              port: 5432,
              database: 'invalid-db',
              username: 'invalid-user',
              password: 'invalid-pass'
            }
          }
        };

        try {
          await backupService.createBackup(invalidConfig);
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).to.be.an('error');
          expect(error.message).to.include('failed');
        }
      });

      it('should encrypt backup when encryption is enabled', async () => {
        const encryptedConfig = {
          ...testConfiguration,
          encryption: {
            enabled: true,
            algorithm: 'AES-256-GCM' as const,
            keyId: 'test-key'
          }
        };

        // Mock the backup creation to avoid actual pg_dump
        const stub = sinon.stub(backupService as any, 'performBackup');
        stub.resolves(path.join(tempDir, 'test-backup.sql'));

        const job = await backupService.createBackup(encryptedConfig);
        
        expect(job.location).to.include('.encrypted');
        
        stub.restore();
      });

      it('should compress backup when compression is enabled', async () => {
        const compressedConfig = {
          ...testConfiguration,
          compression: {
            enabled: true,
            algorithm: 'gzip' as const,
            level: 6
          }
        };

        // Mock the backup creation
        const stub = sinon.stub(backupService as any, 'performBackup');
        stub.resolves(path.join(tempDir, 'test-backup.sql'));

        const job = await backupService.createBackup(compressedConfig);
        
        // Should have both compression and any additional processing
        expect(job.size).to.be.a('number');
        
        stub.restore();
      });
    });

    describe('listBackupJobs', () => {
      beforeEach(async () => {
        // Create some test backup jobs
        testBackupJob = await createTestBackupJob();
      });

      it('should list backup jobs with pagination', async () => {
        const { jobs, total } = await backupService.listBackupJobs(
          undefined, undefined, 10, 0
        );
        
        expect(jobs).to.be.an('array');
        expect(total).to.be.a('number');
        expect(jobs.length).to.be.at.most(10);
      });

      it('should filter backup jobs by configuration ID', async () => {
        const { jobs } = await backupService.listBackupJobs(
          testConfiguration.id, undefined, 10, 0
        );
        
        jobs.forEach(job => {
          expect(job.configurationId).to.equal(testConfiguration.id);
        });
      });

      it('should filter backup jobs by status', async () => {
        const { jobs } = await backupService.listBackupJobs(
          undefined, BackupJobStatus.COMPLETED, 10, 0
        );
        
        jobs.forEach(job => {
          expect(job.status).to.equal(BackupJobStatus.COMPLETED);
        });
      });
    });

    describe('getBackupJob', () => {
      beforeEach(async () => {
        testBackupJob = await createTestBackupJob();
      });

      it('should retrieve a backup job by ID', async () => {
        const job = await backupService.getBackupJob(testBackupJob.id);
        
        expect(job).to.not.be.null;
        expect(job!.id).to.equal(testBackupJob.id);
        expect(job!.configurationId).to.equal(testBackupJob.configurationId);
      });

      it('should return null for non-existent job', async () => {
        const job = await backupService.getBackupJob('non-existent-id');
        expect(job).to.be.null;
      });
    });

    describe('deleteBackupJob', () => {
      beforeEach(async () => {
        testBackupJob = await createTestBackupJob();
      });

      it('should delete a backup job and its files', async () => {
        await backupService.deleteBackupJob(testBackupJob.id);
        
        const job = await backupService.getBackupJob(testBackupJob.id);
        expect(job).to.be.null;
      });

      it('should handle deletion of non-existent job', async () => {
        try {
          await backupService.deleteBackupJob('non-existent-id');
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).to.include('not found');
        }
      });
    });

    describe('cleanupOldBackups', () => {
      it('should clean up old backups based on retention policy', async () => {
        // Create old backup jobs
        await createOldTestBackupJob();
        
        const deletedCount = await backupService.cleanupOldBackups(testConfiguration.id);
        
        expect(deletedCount).to.be.a('number');
        expect(deletedCount).to.be.at.least(0);
      });
    });

    describe('getBackupStatistics', () => {
      beforeEach(async () => {
        testBackupJob = await createTestBackupJob();
      });

      it('should return backup statistics', async () => {
        const stats = await backupService.getBackupStatistics();
        
        expect(stats).to.be.an('object');
        expect(stats.total_backups).to.be.a('string');
        expect(stats.successful_backups).to.be.a('string');
        expect(stats.failed_backups).to.be.a('string');
        expect(stats.total_size).to.be.a('string');
      });

      it('should return statistics for specific configuration', async () => {
        const stats = await backupService.getBackupStatistics(testConfiguration.id);
        
        expect(stats).to.be.an('object');
        expect(parseInt(stats.total_backups)).to.be.at.least(0);
      });
    });
  });

  describe('RecoveryService', () => {
    beforeEach(async () => {
      testBackupJob = await createTestBackupJob();
    });

    describe('createRecoveryRequest', () => {
      it('should create a recovery request successfully', async () => {
        const recoveryRequest = await recoveryService.createRecoveryRequest(
          testBackupJob.id,
          RecoveryType.FULL_RESTORE,
          {
            database: {
              host: 'localhost',
              port: 5432,
              database: 'test_restore',
              username: 'postgres',
              password: 'postgres'
            }
          },
          {
            validateBeforeRestore: true,
            createTargetIfNotExists: true,
            stopOnError: true,
            parallel: false
          },
          'test-user'
        );
        
        expect(recoveryRequest).to.be.an('object');
        expect(recoveryRequest.id).to.be.a('string');
        expect(recoveryRequest.backupJobId).to.equal(testBackupJob.id);
        expect(recoveryRequest.type).to.equal(RecoveryType.FULL_RESTORE);
        expect(recoveryRequest.status).to.equal('requested');
      });

      it('should validate recovery request parameters', async () => {
        try {
          await recoveryService.createRecoveryRequest(
            'invalid-backup-id',
            RecoveryType.FULL_RESTORE,
            {
              database: {
                host: 'localhost',
                port: 5432,
                database: 'test',
                username: 'user',
                password: 'pass'
              }
            },
            {
              validateBeforeRestore: false,
              createTargetIfNotExists: false,
              stopOnError: true,
              parallel: false
            },
            'test-user'
          );
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).to.include('not found');
        }
      });
    });

    describe('listRecoveryRequests', () => {
      beforeEach(async () => {
        testRecoveryRequest = await createTestRecoveryRequest();
      });

      it('should list recovery requests with pagination', async () => {
        const { requests, total } = await recoveryService.listRecoveryRequests(10, 0);
        
        expect(requests).to.be.an('array');
        expect(total).to.be.a('number');
        expect(requests.length).to.be.at.most(10);
      });

      it('should filter recovery requests by status', async () => {
        const { requests } = await recoveryService.listRecoveryRequests(
          10, 0, 'requested'
        );
        
        requests.forEach(request => {
          expect(request.status).to.equal('requested');
        });
      });
    });

    describe('getRecoveryRequest', () => {
      beforeEach(async () => {
        testRecoveryRequest = await createTestRecoveryRequest();
      });

      it('should retrieve a recovery request by ID', async () => {
        const request = await recoveryService.getRecoveryRequest(testRecoveryRequest.id);
        
        expect(request).to.not.be.null;
        expect(request!.id).to.equal(testRecoveryRequest.id);
        expect(request!.backupJobId).to.equal(testBackupJob.id);
      });

      it('should return null for non-existent request', async () => {
        const request = await recoveryService.getRecoveryRequest('non-existent-id');
        expect(request).to.be.null;
      });
    });

    describe('cancelRecovery', () => {
      beforeEach(async () => {
        testRecoveryRequest = await createTestRecoveryRequest();
      });

      it('should cancel a recovery request', async () => {
        await recoveryService.cancelRecovery(testRecoveryRequest.id);
        
        const request = await recoveryService.getRecoveryRequest(testRecoveryRequest.id);
        expect(request!.status).to.equal('cancelled');
      });
    });

    describe('getRecoveryProgress', () => {
      it('should return null for non-existent recovery', async () => {
        const progress = recoveryService.getRecoveryProgress('non-existent-id');
        expect(progress).to.be.null;
      });
    });
  });

  describe('UserDataExportService', () => {
    describe('createExportRequest', () => {
      it('should create a data export request', async () => {
        const exportRequest = await exportService.createExportRequest(
          'test-user-id',
          ExportType.PERSONAL_DATA,
          ExportFormat.JSON,
          {
            includeMetadata: true,
            includeSensitiveData: false
          }
        );
        
        expect(exportRequest).to.be.an('object');
        expect(exportRequest.id).to.be.a('string');
        expect(exportRequest.userId).to.equal('test-user-id');
        expect(exportRequest.type).to.equal(ExportType.PERSONAL_DATA);
        expect(exportRequest.format).to.equal(ExportFormat.JSON);
        expect(exportRequest.status).to.equal('requested');
      });

      it('should set appropriate expiry date', async () => {
        const exportRequest = await exportService.createExportRequest(
          'test-user-id',
          ExportType.PORTFOLIO_DATA,
          ExportFormat.CSV,
          { includeMetadata: true }
        );
        
        const now = new Date();
        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        expect(exportRequest.expiresAt.getTime()).to.be.closeTo(
          sevenDaysLater.getTime(),
          60000 // Within 1 minute
        );
      });
    });

    describe('listUserExportRequests', () => {
      beforeEach(async () => {
        await createTestExportRequest();
      });

      it('should list user export requests', async () => {
        const { requests, total } = await exportService.listUserExportRequests(
          'test-user-id', 10, 0
        );
        
        expect(requests).to.be.an('array');
        expect(total).to.be.a('number');
        requests.forEach(request => {
          expect(request.userId).to.equal('test-user-id');
        });
      });
    });

    describe('cleanupExpiredExports', () => {
      it('should clean up expired export files', async () => {
        // Create expired export
        await createExpiredTestExportRequest();
        
        const cleanedCount = await exportService.cleanupExpiredExports();
        
        expect(cleanedCount).to.be.a('number');
        expect(cleanedCount).to.be.at.least(0);
      });
    });
  });

  describe('EncryptionUtils', () => {
    describe('encryptData', () => {
      it('should encrypt data with AES-256-GCM', async () => {
        const testData = Buffer.from('Hello, World!');
        
        const result = await encryptionUtils.encryptData(testData, {
          algorithm: 'AES-256-GCM',
          keyId: 'test-key'
        });
        
        expect(result.encryptedData).to.be.instanceOf(Buffer);
        expect(result.iv).to.be.instanceOf(Buffer);
        expect(result.authTag).to.be.instanceOf(Buffer);
        expect(result.checksum).to.be.a('string');
        expect(result.algorithm).to.equal('AES-256-GCM');
      });
    });

    describe('decryptData', () => {
      it('should decrypt data successfully', async () => {
        const testData = Buffer.from('Hello, World!');
        
        const encrypted = await encryptionUtils.encryptData(testData, {
          algorithm: 'AES-256-GCM',
          keyId: 'test-key'
        });
        
        const decrypted = await encryptionUtils.decryptData(encrypted.encryptedData, {
          algorithm: encrypted.algorithm,
          keyId: encrypted.keyId,
          iv: encrypted.iv,
          authTag: encrypted.authTag
        });
        
        expect(decrypted.toString()).to.equal('Hello, World!');
      });
    });

    describe('calculateChecksum', () => {
      it('should calculate SHA-256 checksum', () => {
        const testData = Buffer.from('Hello, World!');
        const checksum = encryptionUtils.calculateChecksum(testData);
        
        expect(checksum).to.be.a('string');
        expect(checksum).to.have.length(64); // SHA-256 hex string
      });
    });

    describe('verifyFileIntegrity', () => {
      it('should verify file integrity with correct checksum', async () => {
        const testFile = path.join(tempDir, 'test-file.txt');
        const testContent = 'Hello, World!';
        
        await fs.promises.writeFile(testFile, testContent);
        
        const checksum = await encryptionUtils.calculateFileChecksum(testFile);
        const isValid = await encryptionUtils.verifyFileIntegrity(testFile, checksum);
        
        expect(isValid).to.be.true;
      });

      it('should fail verification with incorrect checksum', async () => {
        const testFile = path.join(tempDir, 'test-file.txt');
        const testContent = 'Hello, World!';
        
        await fs.promises.writeFile(testFile, testContent);
        
        const isValid = await encryptionUtils.verifyFileIntegrity(
          testFile, 
          'invalid-checksum'
        );
        
        expect(isValid).to.be.false;
      });
    });
  });

  describe('BackupScheduler', () => {
    describe('start and stop', () => {
      it('should start the scheduler successfully', async () => {
        await scheduler.start();
        
        const status = scheduler.getStatus();
        expect(status.isRunning).to.be.true;
        expect(status.jobs).to.be.an('array');
      });

      it('should stop the scheduler successfully', async () => {
        await scheduler.start();
        await scheduler.stop();
        
        const status = scheduler.getStatus();
        expect(status.isRunning).to.be.false;
      });
    });

    describe('addBackupConfiguration', () => {
      beforeEach(async () => {
        await scheduler.start();
      });

      afterEach(async () => {
        await scheduler.stop();
      });

      it('should add backup configuration to scheduler', async () => {
        await scheduler.addBackupConfiguration(testConfiguration);
        
        const status = scheduler.getStatus();
        const job = status.jobs.find(j => j.configurationId === testConfiguration.id);
        
        expect(job).to.not.be.undefined;
        expect(job!.enabled).to.be.true;
      });
    });

    describe('triggerBackup', () => {
      beforeEach(async () => {
        await scheduler.start();
        await createTestBackupConfiguration();
      });

      afterEach(async () => {
        await scheduler.stop();
      });

      it('should trigger manual backup', async () => {
        // Mock the backup service to avoid actual backup
        const stub = sinon.stub(backupService, 'createBackup');
        stub.resolves(testBackupJob);

        const jobId = await scheduler.triggerBackup(testConfiguration.id);
        
        expect(jobId).to.be.a('string');
        
        stub.restore();
      });
    });
  });

  describe('BackupMonitor', () => {
    describe('start and stop', () => {
      it('should start monitoring successfully', async () => {
        await monitor.start();
        
        const health = monitor.getSystemHealth();
        expect(health).to.be.an('object');
        expect(health.overall).to.be.oneOf(['healthy', 'warning', 'critical', 'down']);
        
        await monitor.stop();
      });
    });

    describe('getMonitoringMetrics', () => {
      it('should return monitoring metrics', async () => {
        const metrics = await monitor.getMonitoringMetrics();
        
        expect(metrics).to.be.an('object');
        expect(metrics.totalBackups).to.be.a('number');
        expect(metrics.successfulBackups).to.be.a('number');
        expect(metrics.failedBackups).to.be.a('number');
        expect(metrics.healthScore).to.be.a('number');
      });
    });

    describe('getPerformanceMetrics', () => {
      it('should return performance metrics', async () => {
        const metrics = await monitor.getPerformanceMetrics();
        
        expect(metrics).to.be.an('object');
        expect(metrics.throughput).to.be.a('number');
        expect(metrics.averageBackupTime).to.be.a('number');
        expect(metrics.successRate).to.be.a('number');
        expect(metrics.errorRate).to.be.a('number');
      });
    });

    describe('getActiveAlerts', () => {
      it('should return active alerts', async () => {
        const alerts = await monitor.getActiveAlerts();
        
        expect(alerts).to.be.an('array');
        alerts.forEach(alert => {
          expect(alert.id).to.be.a('string');
          expect(alert.type).to.be.a('string');
          expect(alert.severity).to.be.a('string');
          expect(alert.acknowledged).to.be.a('boolean');
        });
      });
    });

    describe('generateReport', () => {
      it('should generate comprehensive backup report', async () => {
        const timeRange = {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000),
          to: new Date()
        };
        
        const report = await monitor.generateReport(timeRange);
        
        expect(report).to.be.an('object');
        expect(report.summary).to.be.an('object');
        expect(report.performance).to.be.an('object');
        expect(report.alerts).to.be.an('array');
        expect(report.trends).to.be.an('object');
        expect(report.recommendations).to.be.an('array');
      });
    });
  });

  // Helper functions for test setup

  async function setupTestDatabase(): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Create test tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS backup_configurations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          enabled BOOLEAN DEFAULT true,
          schedule JSONB NOT NULL,
          type VARCHAR(50) NOT NULL,
          target JSONB NOT NULL,
          storage JSONB NOT NULL,
          retention JSONB NOT NULL,
          encryption JSONB NOT NULL,
          compression JSONB NOT NULL,
          verification JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS backup_jobs (
          id VARCHAR(255) PRIMARY KEY,
          configuration_id VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          type VARCHAR(50) NOT NULL,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP,
          duration INTEGER,
          size BIGINT,
          compressed_size BIGINT,
          location TEXT,
          checksum VARCHAR(255),
          error TEXT,
          metadata JSONB,
          verification JSONB
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS recovery_requests (
          id VARCHAR(255) PRIMARY KEY,
          backup_job_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          target JSONB NOT NULL,
          options JSONB NOT NULL,
          status VARCHAR(50) NOT NULL,
          requested_by VARCHAR(255) NOT NULL,
          requested_at TIMESTAMP NOT NULL,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          error TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_export_requests (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          format VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          requested_at TIMESTAMP NOT NULL,
          completed_at TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          download_url TEXT,
          file_path TEXT,
          file_size BIGINT,
          error TEXT,
          options JSONB
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS backup_alerts (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          severity VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          details JSONB,
          timestamp TIMESTAMP NOT NULL,
          acknowledged BOOLEAN DEFAULT false,
          acknowledged_by VARCHAR(255),
          acknowledged_at TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS backup_metrics (
          timestamp TIMESTAMP PRIMARY KEY,
          total_backups INTEGER,
          successful_backups INTEGER,
          failed_backups INTEGER,
          total_size BIGINT,
          average_duration REAL,
          health_score INTEGER,
          throughput REAL,
          success_rate REAL,
          error_rate REAL,
          storage_utilization JSONB
        )
      `);

      // Create test user tables for export testing
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS portfolios (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL REFERENCES users(id),
          name VARCHAR(255) NOT NULL,
          total_value DECIMAL(20, 8) DEFAULT 0,
          currency VARCHAR(10) DEFAULT 'USD',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL REFERENCES users(id),
          portfolio_id VARCHAR(255) REFERENCES portfolios(id),
          type VARCHAR(20) NOT NULL,
          symbol VARCHAR(20) NOT NULL,
          quantity DECIMAL(20, 8) NOT NULL,
          price DECIMAL(20, 8) NOT NULL,
          total_amount DECIMAL(20, 8) NOT NULL,
          executed_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

    } finally {
      client.release();
    }
  }

  function createTestBackupConfiguration(): BackupConfiguration {
    return {
      id: `test_config_${Date.now()}`,
      name: 'Test Backup Configuration',
      description: 'Test configuration for unit tests',
      enabled: true,
      schedule: {
        type: 'cron',
        expression: '0 2 * * *',
        enabled: true
      },
      type: BackupType.FULL,
      target: {
        type: 'database',
        database: {
          host: process.env.TEST_DB_HOST || 'localhost',
          port: parseInt(process.env.TEST_DB_PORT || '5432'),
          database: process.env.TEST_DB_NAME || 'crypto_portfolio_test',
          username: process.env.TEST_DB_USER || 'postgres',
          password: process.env.TEST_DB_PASSWORD || 'postgres'
        }
      },
      storage: {
        primary: {
          type: StorageType.LOCAL,
          local: {
            path: tempDir,
            permissions: '0640'
          }
        }
      },
      retention: {
        daily: 30,
        weekly: 12,
        monthly: 12,
        yearly: 7,
        minimumCopies: 3
      },
      encryption: {
        enabled: false,
        algorithm: 'AES-256-GCM',
        keyId: 'test-key'
      },
      compression: {
        enabled: false,
        algorithm: 'gzip',
        level: 6
      },
      verification: {
        enabled: true,
        checksumAlgorithm: 'SHA-256',
        integrityCheck: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async function createTestBackupJob(): Promise<BackupJob> {
    const job: BackupJob = {
      id: `test_job_${Date.now()}`,
      configurationId: testConfiguration.id,
      status: BackupJobStatus.COMPLETED,
      type: BackupType.FULL,
      startTime: new Date(),
      endTime: new Date(),
      duration: 30000,
      size: 1024 * 1024,
      location: path.join(tempDir, 'test-backup.sql'),
      checksum: 'test-checksum',
      metadata: {
        version: '1.0.0',
        platform: 'test',
        hostname: 'test-host',
        source: 'test-db'
      }
    };

    await testClient.query(
      `INSERT INTO backup_jobs (
        id, configuration_id, status, type, start_time, end_time, 
        duration, size, location, checksum, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        job.id, job.configurationId, job.status, job.type,
        job.startTime, job.endTime, job.duration, job.size,
        job.location, job.checksum, JSON.stringify(job.metadata)
      ]
    );

    return job;
  }

  async function createTestRecoveryRequest(): Promise<RecoveryRequest> {
    const request: RecoveryRequest = {
      id: `test_recovery_${Date.now()}`,
      backupJobId: testBackupJob.id,
      type: RecoveryType.FULL_RESTORE,
      target: {
        database: {
          host: 'localhost',
          port: 5432,
          database: 'test_restore',
          username: 'postgres',
          password: 'postgres'
        }
      },
      options: {
        validateBeforeRestore: true,
        createTargetIfNotExists: true,
        stopOnError: true,
        parallel: false
      },
      status: 'requested',
      requestedBy: 'test-user',
      requestedAt: new Date()
    };

    await testClient.query(
      `INSERT INTO recovery_requests (
        id, backup_job_id, type, target, options, status, requested_by, requested_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        request.id, request.backupJobId, request.type,
        JSON.stringify(request.target), JSON.stringify(request.options),
        request.status, request.requestedBy, request.requestedAt
      ]
    );

    return request;
  }

  async function createTestExportRequest(): Promise<UserDataExportRequest> {
    const request: UserDataExportRequest = {
      id: `test_export_${Date.now()}`,
      userId: 'test-user-id',
      type: ExportType.PERSONAL_DATA,
      format: ExportFormat.JSON,
      status: 'requested',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      options: {
        includeMetadata: true,
        includeSensitiveData: false
      }
    };

    await testClient.query(
      `INSERT INTO user_export_requests (
        id, user_id, type, format, status, requested_at, expires_at, options
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        request.id, request.userId, request.type, request.format,
        request.status, request.requestedAt, request.expiresAt,
        JSON.stringify(request.options)
      ]
    );

    return request;
  }

  async function createExpiredTestExportRequest(): Promise<void> {
    const request = {
      id: `expired_export_${Date.now()}`,
      userId: 'test-user-id',
      type: ExportType.PERSONAL_DATA,
      format: ExportFormat.JSON,
      status: 'completed',
      requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      filePath: path.join(tempDir, 'expired-export.json'),
      options: { includeMetadata: true }
    };

    await testClient.query(
      `INSERT INTO user_export_requests (
        id, user_id, type, format, status, requested_at, expires_at, file_path, options
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        request.id, request.userId, request.type, request.format,
        request.status, request.requestedAt, request.expiresAt,
        request.filePath, JSON.stringify(request.options)
      ]
    );
  }

  async function createOldTestBackupJob(): Promise<void> {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago

    await testClient.query(
      `INSERT INTO backup_jobs (
        id, configuration_id, status, type, start_time, end_time, 
        duration, size, location, checksum, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        `old_job_${Date.now()}`,
        testConfiguration.id,
        BackupJobStatus.COMPLETED,
        BackupType.FULL,
        oldDate,
        oldDate,
        30000,
        1024,
        '/tmp/old-backup.sql',
        'old-checksum',
        JSON.stringify({ version: '1.0.0' })
      ]
    );
  }

  async function cleanupTestData(): Promise<void> {
    // Clean up test data
    await testClient.query('DELETE FROM backup_jobs WHERE configuration_id LIKE $1', ['test_%']);
    await testClient.query('DELETE FROM backup_configurations WHERE id LIKE $1', ['test_%']);
    await testClient.query('DELETE FROM recovery_requests WHERE id LIKE $1', ['test_%']);
    await testClient.query('DELETE FROM user_export_requests WHERE id LIKE $1', ['test_%']);
    await testClient.query('DELETE FROM backup_alerts WHERE id LIKE $1', ['test_%']);
  }

  async function cleanupTestFiles(): Promise<void> {
    try {
      const files = await fs.promises.readdir(tempDir);
      
      for (const file of files) {
        if (file.startsWith('test-') || file.startsWith('backup-') || file.startsWith('export-')) {
          await fs.promises.unlink(path.join(tempDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});