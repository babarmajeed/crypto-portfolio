# Data Persistence and Backup Strategy Requirements

## Overview
Comprehensive data persistence and backup strategy ensuring data integrity, availability, and compliance for crypto portfolio management with multi-tier redundancy and disaster recovery capabilities.

## 1. Database Architecture and Selection

### 1.1 Primary Database Requirements

#### Functional Requirements
- **FR-1.1.1**: ACID compliance for transaction consistency
- **FR-1.1.2**: Support for complex queries with joins and aggregations
- **FR-1.1.3**: Real-time data synchronization capabilities
- **FR-1.1.4**: Horizontal scaling for high-volume trading data
- **FR-1.1.5**: Time-series optimization for price and performance data

#### Technical Specification
```typescript
interface DatabaseConfig {
  primary: DatabaseConnection;
  readReplicas: DatabaseConnection[];
  cache: CacheConfig;
  backup: BackupConfig;
  monitoring: MonitoringConfig;
}

class DatabaseManager {
  private primaryDb: Database;
  private readReplicas: Database[];
  private cache: CacheManager;
  private backupManager: BackupManager;
  
  constructor(config: DatabaseConfig) {
    this.primaryDb = new Database(config.primary);
    this.readReplicas = config.readReplicas.map(conn => new Database(conn));
    this.cache = new CacheManager(config.cache);
    this.backupManager = new BackupManager(config.backup);
  }
  
  async writeTransaction(transaction: Transaction): Promise<void> {
    const dbTransaction = await this.primaryDb.beginTransaction();
    
    try {
      // Insert into transactions table
      await dbTransaction.query(`
        INSERT INTO transactions (
          id, user_id, symbol, type, quantity, price, 
          timestamp, exchange, fees, hash, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transaction.id,
        transaction.userId,
        transaction.symbol,
        transaction.type,
        transaction.quantity,
        transaction.price,
        transaction.timestamp,
        transaction.exchange,
        transaction.fees,
        transaction.hash,
        'confirmed'
      ]);
      
      // Update portfolio balances
      await this.updatePortfolioBalance(dbTransaction, transaction);
      
      // Update cost basis tracking
      await this.updateCostBasis(dbTransaction, transaction);
      
      // Commit transaction
      await dbTransaction.commit();
      
      // Invalidate relevant cache entries
      await this.cache.invalidate(`user:${transaction.userId}:portfolio`);
      await this.cache.invalidate(`user:${transaction.userId}:transactions`);
      
      // Trigger real-time sync to read replicas
      await this.syncToReplicas(transaction);
      
    } catch (error) {
      await dbTransaction.rollback();
      throw new Error(`Failed to write transaction: ${error.message}`);
    }
  }
  
  async readPortfolio(userId: string): Promise<Portfolio> {
    // Try cache first
    const cacheKey = `user:${userId}:portfolio`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Use read replica for performance
    const replica = this.selectOptimalReplica();
    
    const portfolio = await replica.query(`
      SELECT 
        p.symbol,
        p.total_quantity,
        p.available_quantity,
        p.average_cost,
        p.total_cost,
        p.last_updated,
        pr.current_price,
        pr.price_change_24h
      FROM portfolios p
      LEFT JOIN prices pr ON p.symbol = pr.symbol
      WHERE p.user_id = ? AND p.total_quantity > 0
      ORDER BY p.total_cost DESC
    `, [userId]);
    
    // Cache for 30 seconds
    await this.cache.set(cacheKey, JSON.stringify(portfolio), 30);
    
    return portfolio;
  }
  
  private selectOptimalReplica(): Database {
    // Load balancing logic - select replica with lowest latency
    return this.readReplicas.reduce((optimal, replica) => 
      replica.getAverageLatency() < optimal.getAverageLatency() ? replica : optimal
    );
  }
  
  private async updatePortfolioBalance(
    transaction: DatabaseTransaction, 
    trade: Transaction
  ): Promise<void> {
    if (trade.type === 'buy') {
      await transaction.query(`
        INSERT INTO portfolios (user_id, symbol, total_quantity, available_quantity, total_cost, average_cost)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          total_quantity = total_quantity + VALUES(total_quantity),
          available_quantity = available_quantity + VALUES(available_quantity),
          total_cost = total_cost + VALUES(total_cost),
          average_cost = total_cost / total_quantity,
          last_updated = NOW()
      `, [
        trade.userId,
        trade.symbol,
        trade.quantity,
        trade.quantity,
        trade.quantity * trade.price + trade.fees,
        trade.price
      ]);
    } else if (trade.type === 'sell') {
      await transaction.query(`
        UPDATE portfolios 
        SET 
          total_quantity = total_quantity - ?,
          available_quantity = available_quantity - ?,
          last_updated = NOW()
        WHERE user_id = ? AND symbol = ?
      `, [trade.quantity, trade.quantity, trade.userId, trade.symbol]);
    }
  }
}

interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionPool: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
  };
}
```

### 1.2 Time-Series Database for Price Data

#### Functional Requirements
- **FR-1.2.1**: High-frequency price data ingestion (1-second intervals)
- **FR-1.2.2**: Efficient storage and compression for historical data
- **FR-1.2.3**: Fast aggregation queries for different timeframes
- **FR-1.2.4**: Automatic data retention policies

#### Technical Specification
```typescript
class TimeSeriesManager {
  private timescaleDb: TimescaleDB;
  private compressionPolicy: CompressionPolicy;
  
  constructor(config: TimeSeriesConfig) {
    this.timescaleDb = new TimescaleDB(config.connection);
    this.compressionPolicy = new CompressionPolicy(config.compression);
  }
  
  async ingestPriceData(priceData: PriceDataPoint[]): Promise<void> {
    const batchSize = 10000;
    
    for (let i = 0; i < priceData.length; i += batchSize) {
      const batch = priceData.slice(i, i + batchSize);
      
      await this.timescaleDb.query(`
        INSERT INTO price_data (timestamp, symbol, price, volume, market_cap)
        VALUES ${batch.map(() => '(?, ?, ?, ?, ?)').join(', ')}
        ON CONFLICT (timestamp, symbol) DO UPDATE SET
          price = EXCLUDED.price,
          volume = EXCLUDED.volume,
          market_cap = EXCLUDED.market_cap
      `, batch.flatMap(point => [
        point.timestamp,
        point.symbol,
        point.price,
        point.volume,
        point.marketCap
      ]));
    }
  }
  
  async getPriceHistory(
    symbol: string,
    startTime: Date,
    endTime: Date,
    interval: '1m' | '5m' | '1h' | '1d'
  ): Promise<PriceDataPoint[]> {
    const intervalSeconds = this.getIntervalSeconds(interval);
    
    return await this.timescaleDb.query(`
      SELECT 
        time_bucket(INTERVAL '${intervalSeconds} seconds', timestamp) AS bucket,
        symbol,
        FIRST(price, timestamp) AS open,
        MAX(price) AS high,
        MIN(price) AS low,
        LAST(price, timestamp) AS close,
        SUM(volume) AS volume
      FROM price_data
      WHERE symbol = ? AND timestamp BETWEEN ? AND ?
      GROUP BY bucket, symbol
      ORDER BY bucket ASC
    `, [symbol, startTime, endTime]);
  }
  
  private getIntervalSeconds(interval: string): number {
    const intervals = {
      '1m': 60,
      '5m': 300,
      '1h': 3600,
      '1d': 86400
    };
    return intervals[interval] || 60;
  }
  
  async setupCompressionPolicies(): Promise<void> {
    // Compress data older than 7 days
    await this.timescaleDb.query(`
      SELECT add_compression_policy('price_data', INTERVAL '7 days');
    `);
    
    // Drop data older than 2 years for minute-level data
    await this.timescaleDb.query(`
      SELECT add_retention_policy('price_data', INTERVAL '2 years');
    `);
    
    // Create continuous aggregates for common intervals
    await this.timescaleDb.query(`
      CREATE MATERIALIZED VIEW price_data_1h
      WITH (timescaledb.continuous) AS
      SELECT 
        time_bucket(INTERVAL '1 hour', timestamp) AS bucket,
        symbol,
        FIRST(price, timestamp) AS open,
        MAX(price) AS high,
        MIN(price) AS low,
        LAST(price, timestamp) AS close,
        SUM(volume) AS volume
      FROM price_data
      GROUP BY bucket, symbol;
    `);
  }
}

interface PriceDataPoint {
  timestamp: Date;
  symbol: string;
  price: number;
  volume: number;
  marketCap: number;
}

interface TimeSeriesConfig {
  connection: DatabaseConnection;
  compression: CompressionConfig;
  retention: RetentionConfig;
}
```

## 2. Backup and Recovery Strategy

### 2.1 Multi-Tier Backup System

#### Functional Requirements
- **FR-2.1.1**: Continuous incremental backups with point-in-time recovery
- **FR-2.1.2**: Full database snapshots with encryption
- **FR-2.1.3**: Cross-region replication for disaster recovery
- **FR-2.1.4**: Automated backup verification and integrity checks

#### Technical Specification
```typescript
interface BackupConfig {
  schedule: BackupSchedule;
  destinations: BackupDestination[];
  encryption: EncryptionConfig;
  retention: RetentionPolicy;
  verification: VerificationConfig;
}

class BackupManager {
  private config: BackupConfig;
  private encryptor: Encryptor;
  private destinations: Map<string, BackupDestination>;
  
  constructor(config: BackupConfig) {
    this.config = config;
    this.encryptor = new Encryptor(config.encryption);
    this.destinations = new Map(
      config.destinations.map(dest => [dest.id, dest])
    );
  }
  
  async performFullBackup(): Promise<BackupResult> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    
    try {
      // Create database dump
      const dumpResult = await this.createDatabaseDump(backupId);
      
      // Encrypt the backup
      const encryptedDump = await this.encryptor.encrypt(dumpResult.data);
      
      // Upload to multiple destinations
      const uploadResults = await Promise.all(
        Array.from(this.destinations.values()).map(dest =>
          this.uploadToDestination(dest, backupId, encryptedDump, timestamp)
        )
      );
      
      // Verify backup integrity
      const verificationResults = await this.verifyBackupIntegrity(backupId);
      
      // Record backup metadata
      await this.recordBackupMetadata({
        id: backupId,
        type: 'full',
        timestamp,
        size: encryptedDump.length,
        destinations: uploadResults.map(r => r.destination),
        verified: verificationResults.every(r => r.success),
        retention: this.calculateRetentionDate(timestamp)
      });
      
      return {
        id: backupId,
        success: true,
        size: encryptedDump.length,
        duration: Date.now() - timestamp.getTime(),
        destinations: uploadResults.length
      };
      
    } catch (error) {
      console.error(`Full backup failed:`, error);
      return {
        id: backupId,
        success: false,
        error: error.message,
        timestamp
      };
    }
  }
  
  async performIncrementalBackup(lastBackupId: string): Promise<BackupResult> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    
    try {
      // Get changes since last backup
      const changes = await this.getChangesSinceBackup(lastBackupId);
      
      if (changes.length === 0) {
        return {
          id: backupId,
          success: true,
          size: 0,
          duration: 0,
          destinations: 0,
          message: 'No changes since last backup'
        };
      }
      
      // Create incremental backup data
      const incrementalData = await this.createIncrementalBackup(changes);
      
      // Encrypt and upload
      const encryptedData = await this.encryptor.encrypt(incrementalData);
      
      const uploadResults = await Promise.all(
        Array.from(this.destinations.values()).map(dest =>
          this.uploadToDestination(dest, backupId, encryptedData, timestamp)
        )
      );
      
      await this.recordBackupMetadata({
        id: backupId,
        type: 'incremental',
        timestamp,
        size: encryptedData.length,
        baseBackup: lastBackupId,
        destinations: uploadResults.map(r => r.destination),
        verified: true,
        retention: this.calculateRetentionDate(timestamp)
      });
      
      return {
        id: backupId,
        success: true,
        size: encryptedData.length,
        duration: Date.now() - timestamp.getTime(),
        destinations: uploadResults.length
      };
      
    } catch (error) {
      console.error(`Incremental backup failed:`, error);
      return {
        id: backupId,
        success: false,
        error: error.message,
        timestamp
      };
    }
  }
  
  async restoreFromBackup(backupId: string, pointInTime?: Date): Promise<RestoreResult> {
    try {
      const backupMetadata = await this.getBackupMetadata(backupId);
      
      if (!backupMetadata) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      // Download backup data from primary destination
      const primaryDestination = this.destinations.get(backupMetadata.destinations[0]);
      const encryptedData = await this.downloadFromDestination(primaryDestination, backupId);
      
      // Decrypt backup data
      const backupData = await this.encryptor.decrypt(encryptedData);
      
      // If incremental backup, we need to apply all changes in sequence
      const restoreChain = await this.buildRestoreChain(backupId);
      
      // Create restore point
      const restorePointId = await this.createRestorePoint();
      
      try {
        // Restore base backup
        await this.restoreBaseBackup(restoreChain[0]);
        
        // Apply incremental backups in order
        for (let i = 1; i < restoreChain.length; i++) {
          await this.applyIncrementalBackup(restoreChain[i]);
        }
        
        // If point-in-time recovery requested, apply transaction log
        if (pointInTime) {
          await this.applyTransactionLogToPoint(pointInTime);
        }
        
        // Verify database consistency
        const verificationResult = await this.verifyDatabaseConsistency();
        
        if (!verificationResult.success) {
          throw new Error('Database consistency check failed after restore');
        }
        
        return {
          success: true,
          backupId,
          restorePointId,
          duration: Date.now() - Date.now(),
          recordsRestored: verificationResult.recordCount
        };
        
      } catch (restoreError) {
        // Rollback to restore point
        await this.rollbackToRestorePoint(restorePointId);
        throw restoreError;
      }
      
    } catch (error) {
      console.error(`Restore failed:`, error);
      return {
        success: false,
        backupId,
        error: error.message
      };
    }
  }
  
  private async buildRestoreChain(backupId: string): Promise<BackupMetadata[]> {
    const chain: BackupMetadata[] = [];
    let currentBackup = await this.getBackupMetadata(backupId);
    
    while (currentBackup) {
      chain.unshift(currentBackup);
      
      if (currentBackup.type === 'full') {
        break;
      }
      
      currentBackup = await this.getBackupMetadata(currentBackup.baseBackup);
    }
    
    return chain;
  }
  
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `backup-${timestamp}-${random}`;
  }
}

interface BackupResult {
  id: string;
  success: boolean;
  size?: number;
  duration?: number;
  destinations?: number;
  error?: string;
  message?: string;
  timestamp?: Date;
}

interface RestoreResult {
  success: boolean;
  backupId: string;
  restorePointId?: string;
  duration?: number;
  recordsRestored?: number;
  error?: string;
}

interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental';
  timestamp: Date;
  size: number;
  destinations: string[];
  baseBackup?: string;
  verified: boolean;
  retention: Date;
}
```

### 2.2 Cross-Region Replication

#### Functional Requirements
- **FR-2.2.1**: Real-time data replication across multiple geographic regions
- **FR-2.2.2**: Automatic failover with minimal downtime
- **FR-2.2.3**: Conflict resolution for multi-master scenarios
- **FR-2.2.4**: Network partition tolerance

#### Technical Specification
```typescript
interface ReplicationConfig {
  regions: RegionConfig[];
  replicationMode: 'master-slave' | 'master-master' | 'multi-master';
  conflictResolution: ConflictResolutionStrategy;
  networkSettings: NetworkConfig;
}

class ReplicationManager {
  private config: ReplicationConfig;
  private regionNodes: Map<string, DatabaseNode>;
  private conflictResolver: ConflictResolver;
  
  constructor(config: ReplicationConfig) {
    this.config = config;
    this.regionNodes = new Map();
    this.conflictResolver = new ConflictResolver(config.conflictResolution);
    
    this.initializeRegionNodes();
  }
  
  async replicateTransaction(transaction: Transaction): Promise<ReplicationResult> {
    const replicationId = this.generateReplicationId();
    const timestamp = Date.now();
    
    try {
      // Prepare replication package
      const replicationPackage = this.createReplicationPackage(transaction, replicationId);
      
      // Send to all slave regions concurrently
      const replicationPromises = Array.from(this.regionNodes.values())
        .filter(node => node.role !== 'master')
        .map(node => this.replicateToNode(node, replicationPackage));
      
      const results = await Promise.allSettled(replicationPromises);
      
      // Check for failures
      const failures = results
        .map((result, index) => ({ result, node: Array.from(this.regionNodes.values())[index] }))
        .filter(({ result }) => result.status === 'rejected');
      
      if (failures.length > 0) {
        // Log failures but don't fail the entire operation
        console.warn(`Replication failed for ${failures.length} regions:`, failures);
        
        // Queue for retry
        await this.queueFailedReplications(failures.map(f => f.node), replicationPackage);
      }
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      return {
        replicationId,
        success: true,
        regionsReplicated: successCount,
        totalRegions: this.regionNodes.size - 1, // Excluding master
        duration: Date.now() - timestamp,
        failures: failures.length
      };
      
    } catch (error) {
      console.error(`Replication failed:`, error);
      return {
        replicationId,
        success: false,
        error: error.message,
        duration: Date.now() - timestamp
      };
    }
  }
  
  async handleFailover(failedRegion: string): Promise<FailoverResult> {
    const timestamp = Date.now();
    
    try {
      const failedNode = this.regionNodes.get(failedRegion);
      if (!failedNode) {
        throw new Error(`Region ${failedRegion} not found`);
      }
      
      // If master failed, promote a slave
      if (failedNode.role === 'master') {
        const newMaster = await this.selectNewMaster();
        
        // Promote slave to master
        await this.promoteToMaster(newMaster);
        
        // Update routing configuration
        await this.updateRoutingConfiguration(newMaster.region);
        
        // Notify all clients of the new master
        await this.notifyClientsOfFailover(newMaster.region);
        
        return {
          success: true,
          action: 'master_failover',
          newMaster: newMaster.region,
          downtime: Date.now() - timestamp
        };
      } else {
        // Slave failed, just remove from rotation
        await this.removeFromRotation(failedRegion);
        
        return {
          success: true,
          action: 'slave_removal',
          removedRegion: failedRegion,
          downtime: 0
        };
      }
      
    } catch (error) {
      console.error(`Failover failed:`, error);
      return {
        success: false,
        error: error.message,
        downtime: Date.now() - timestamp
      };
    }
  }
  
  async resolveConflicts(conflicts: ReplicationConflict[]): Promise<ConflictResolutionResult[]> {
    const results: ConflictResolutionResult[] = [];
    
    for (const conflict of conflicts) {
      try {
        const resolution = await this.conflictResolver.resolve(conflict);
        
        // Apply resolution to all regions
        await this.applyResolutionToAllRegions(resolution);
        
        results.push({
          conflictId: conflict.id,
          success: true,
          resolution: resolution.action,
          winningVersion: resolution.winningVersion
        });
        
      } catch (error) {
        results.push({
          conflictId: conflict.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  private async selectNewMaster(): Promise<DatabaseNode> {
    const slaves = Array.from(this.regionNodes.values())
      .filter(node => node.role === 'slave' && node.status === 'healthy');
    
    if (slaves.length === 0) {
      throw new Error('No healthy slaves available for promotion');
    }
    
    // Select slave with most recent data and best performance
    return slaves.reduce((best, current) => {
      if (current.lastSyncTimestamp > best.lastSyncTimestamp) {
        return current;
      }
      
      if (current.lastSyncTimestamp === best.lastSyncTimestamp &&
          current.avgLatency < best.avgLatency) {
        return current;
      }
      
      return best;
    });
  }
  
  private async promoteToMaster(node: DatabaseNode): Promise<void> {
    // Stop replication on this node
    await node.connection.query('STOP SLAVE');
    
    // Reset binary log
    await node.connection.query('RESET MASTER');
    
    // Update node configuration
    node.role = 'master';
    node.masterHost = null;
    
    // Start accepting writes
    await node.connection.query('SET GLOBAL read_only = OFF');
    
    // Update other slaves to replicate from new master
    const otherSlaves = Array.from(this.regionNodes.values())
      .filter(n => n.region !== node.region && n.role === 'slave');
    
    for (const slave of otherSlaves) {
      await this.reconfigureSlave(slave, node);
    }
  }
}

interface ReplicationResult {
  replicationId: string;
  success: boolean;
  regionsReplicated?: number;
  totalRegions?: number;
  duration: number;
  failures?: number;
  error?: string;
}

interface FailoverResult {
  success: boolean;
  action: 'master_failover' | 'slave_removal';
  newMaster?: string;
  removedRegion?: string;
  downtime: number;
  error?: string;
}

interface DatabaseNode {
  region: string;
  role: 'master' | 'slave';
  connection: Database;
  status: 'healthy' | 'degraded' | 'failed';
  lastSyncTimestamp: number;
  avgLatency: number;
  masterHost?: string;
}
```

## 3. Data Security and Encryption

### 3.1 Encryption at Rest and in Transit

#### Functional Requirements
- **FR-3.1.1**: AES-256 encryption for all stored data
- **FR-3.1.2**: TLS 1.3 for all network communications
- **FR-3.1.3**: Key rotation with zero-downtime
- **FR-3.1.4**: Hardware Security Module (HSM) integration

#### Technical Specification
```typescript
interface EncryptionConfig {
  algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  keyManagement: KeyManagementConfig;
  rotation: KeyRotationConfig;
  hsm: HSMConfig;
}

class EncryptionManager {
  private config: EncryptionConfig;
  private keyManager: KeyManager;
  private hsm: HSMClient;
  
  constructor(config: EncryptionConfig) {
    this.config = config;
    this.keyManager = new KeyManager(config.keyManagement);
    this.hsm = new HSMClient(config.hsm);
  }
  
  async encrypt(data: Buffer, keyId?: string): Promise<EncryptedData> {
    const encryptionKey = keyId 
      ? await this.keyManager.getKey(keyId)
      : await this.keyManager.getCurrentKey();
    
    if (!encryptionKey) {
      throw new Error('No encryption key available');
    }
    
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipher(this.config.algorithm, encryptionKey.key);
    cipher.setAAD(Buffer.from(encryptionKey.id)); // Additional authenticated data
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      data: encrypted,
      iv,
      authTag,
      keyId: encryptionKey.id,
      algorithm: this.config.algorithm,
      timestamp: Date.now()
    };
  }
  
  async decrypt(encryptedData: EncryptedData): Promise<Buffer> {
    const decryptionKey = await this.keyManager.getKey(encryptedData.keyId);
    
    if (!decryptionKey) {
      throw new Error(`Decryption key ${encryptedData.keyId} not found`);
    }
    
    const decipher = crypto.createDecipher(encryptedData.algorithm, decryptionKey.key);
    decipher.setAAD(Buffer.from(encryptedData.keyId));
    decipher.setAuthTag(encryptedData.authTag);
    
    try {
      const decrypted = Buffer.concat([
        decipher.update(encryptedData.data),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
  
  async rotateKeys(): Promise<KeyRotationResult> {
    const timestamp = Date.now();
    
    try {
      // Generate new key
      const newKey = await this.keyManager.generateKey();
      
      // Get all data encrypted with old keys
      const oldKeyIds = await this.keyManager.getExpiredKeyIds();
      
      let reencryptedCount = 0;
      
      for (const oldKeyId of oldKeyIds) {
        // Find all data encrypted with this key
        const encryptedRecords = await this.findRecordsWithKey(oldKeyId);
        
        for (const record of encryptedRecords) {
          // Decrypt with old key
          const decryptedData = await this.decrypt(record.encryptedData);
          
          // Re-encrypt with new key
          const newEncryptedData = await this.encrypt(decryptedData, newKey.id);
          
          // Update database record
          await this.updateEncryptedRecord(record.id, newEncryptedData);
          
          reencryptedCount++;
        }
        
        // Mark old key for deletion (after grace period)
        await this.keyManager.scheduleKeyDeletion(oldKeyId);
      }
      
      return {
        success: true,
        newKeyId: newKey.id,
        reencryptedRecords: reencryptedCount,
        duration: Date.now() - timestamp
      };
      
    } catch (error) {
      console.error('Key rotation failed:', error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - timestamp
      };
    }
  }
  
  async setupTransportSecurity(): Promise<TLSConfig> {
    // Generate or load TLS certificates
    const certificates = await this.loadTLSCertificates();
    
    return {
      cert: certificates.cert,
      key: certificates.key,
      ca: certificates.ca,
      secureProtocol: 'TLSv1_3_method',
      ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256'
      ].join(':'),
      honorCipherOrder: true,
      minVersion: 'TLSv1.3'
    };
  }
}

interface EncryptedData {
  data: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyId: string;
  algorithm: string;
  timestamp: number;
}

interface KeyRotationResult {
  success: boolean;
  newKeyId?: string;
  reencryptedRecords?: number;
  duration: number;
  error?: string;
}
```

### 3.2 Access Control and Auditing

#### Functional Requirements
- **FR-3.2.1**: Role-based access control (RBAC) for database operations
- **FR-3.2.2**: Comprehensive audit logging for all data access
- **FR-3.2.3**: Data masking for sensitive information
- **FR-3.2.4**: Compliance with GDPR, SOX, and PCI DSS

#### Technical Specification
```typescript
interface AccessControlConfig {
  rbac: RBACConfig;
  auditing: AuditConfig;
  masking: DataMaskingConfig;
  compliance: ComplianceConfig;
}

class AccessControlManager {
  private rbac: RBACEngine;
  private auditor: AuditLogger;
  private dataMasker: DataMasker;
  
  constructor(config: AccessControlConfig) {
    this.rbac = new RBACEngine(config.rbac);
    this.auditor = new AuditLogger(config.auditing);
    this.dataMasker = new DataMasker(config.masking);
  }
  
  async authorizeOperation(
    userId: string,
    operation: DatabaseOperation,
    resource: string,
    context: OperationContext
  ): Promise<AuthorizationResult> {
    try {
      // Check user permissions
      const userRoles = await this.rbac.getUserRoles(userId);
      const permissions = await this.rbac.getPermissionsForRoles(userRoles);
      
      // Evaluate access
      const hasPermission = await this.rbac.evaluateAccess(
        permissions,
        operation,
        resource,
        context
      );
      
      // Log access attempt
      await this.auditor.logAccessAttempt({
        userId,
        operation,
        resource,
        granted: hasPermission,
        timestamp: Date.now(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId
      });
      
      if (!hasPermission) {
        return {
          granted: false,
          reason: 'Insufficient permissions',
          requiredRoles: await this.rbac.getRequiredRoles(operation, resource)
        };
      }
      
      // Apply data masking if needed
      const maskingPolicy = await this.dataMasker.getPolicyForUser(userId, resource);
      
      return {
        granted: true,
        maskingPolicy,
        auditId: await this.auditor.generateAuditId()
      };
      
    } catch (error) {
      await this.auditor.logError({
        userId,
        operation,
        resource,
        error: error.message,
        timestamp: Date.now()
      });
      
      return {
        granted: false,
        reason: 'Authorization system error',
        error: error.message
      };
    }
  }
  
  async maskSensitiveData(data: any, maskingPolicy: MaskingPolicy): Promise<any> {
    if (!maskingPolicy || !maskingPolicy.enabled) {
      return data;
    }
    
    const maskedData = JSON.parse(JSON.stringify(data)); // Deep clone
    
    for (const rule of maskingPolicy.rules) {
      await this.applyMaskingRule(maskedData, rule);
    }
    
    return maskedData;
  }
  
  private async applyMaskingRule(data: any, rule: MaskingRule): Promise<void> {
    const fieldValue = this.getNestedField(data, rule.field);
    
    if (fieldValue === undefined) return;
    
    let maskedValue: any;
    
    switch (rule.type) {
      case 'redact':
        maskedValue = '***REDACTED***';
        break;
      case 'hash':
        maskedValue = crypto.createHash('sha256').update(String(fieldValue)).digest('hex');
        break;
      case 'partial':
        maskedValue = this.partialMask(String(fieldValue), rule.options);
        break;
      case 'tokenize':
        maskedValue = await this.tokenize(fieldValue, rule.options);
        break;
      default:
        maskedValue = fieldValue;
    }
    
    this.setNestedField(data, rule.field, maskedValue);
  }
  
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    standard: 'GDPR' | 'SOX' | 'PCI_DSS'
  ): Promise<ComplianceReport> {
    const auditLogs = await this.auditor.getLogsForPeriod(startDate, endDate);
    
    switch (standard) {
      case 'GDPR':
        return await this.generateGDPRReport(auditLogs, startDate, endDate);
      case 'SOX':
        return await this.generateSOXReport(auditLogs, startDate, endDate);
      case 'PCI_DSS':
        return await this.generatePCIDSSReport(auditLogs, startDate, endDate);
      default:
        throw new Error(`Unsupported compliance standard: ${standard}`);
    }
  }
  
  private async generateGDPRReport(
    auditLogs: AuditLog[],
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    // GDPR compliance metrics
    const personalDataAccess = auditLogs.filter(log => 
      log.operation.includes('personal_data') || 
      log.resource.includes('user_profile')
    );
    
    const dataSubjectRequests = auditLogs.filter(log =>
      log.operation === 'data_export' || 
      log.operation === 'data_deletion'
    );
    
    const unauthorizedAccess = auditLogs.filter(log => !log.granted);
    
    return {
      standard: 'GDPR',
      period: { start: startDate, end: endDate },
      metrics: {
        totalDataAccess: personalDataAccess.length,
        dataSubjectRequests: dataSubjectRequests.length,
        unauthorizedAccessAttempts: unauthorizedAccess.length,
        averageResponseTime: this.calculateAverageResponseTime(dataSubjectRequests),
        dataRetentionCompliance: await this.checkDataRetentionCompliance()
      },
      violations: await this.identifyGDPRViolations(auditLogs),
      recommendations: await this.generateGDPRRecommendations(auditLogs)
    };
  }
}

interface AuthorizationResult {
  granted: boolean;
  reason?: string;
  requiredRoles?: string[];
  maskingPolicy?: MaskingPolicy;
  auditId?: string;
  error?: string;
}

interface MaskingPolicy {
  enabled: boolean;
  rules: MaskingRule[];
}

interface MaskingRule {
  field: string;
  type: 'redact' | 'hash' | 'partial' | 'tokenize';
  options?: any;
}

interface ComplianceReport {
  standard: string;
  period: { start: Date; end: Date };
  metrics: any;
  violations: any[];
  recommendations: string[];
}
```

## 4. Monitoring and Performance Optimization

### 4.1 Real-Time Monitoring

#### Functional Requirements
- **FR-4.1.1**: Real-time database performance monitoring
- **FR-4.1.2**: Automated alerting for anomalies
- **FR-4.1.3**: Capacity planning and scaling recommendations
- **FR-4.1.4**: SLA monitoring and reporting

#### Technical Specification
```typescript
interface MonitoringConfig {
  metrics: MetricConfig[];
  alerts: AlertConfig[];
  dashboards: DashboardConfig[];
  sla: SLAConfig;
}

class DatabaseMonitor {
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private dashboardManager: DashboardManager;
  
  constructor(config: MonitoringConfig) {
    this.metricsCollector = new MetricsCollector(config.metrics);
    this.alertManager = new AlertManager(config.alerts);
    this.dashboardManager = new DashboardManager(config.dashboards);
  }
  
  async collectMetrics(): Promise<DatabaseMetrics> {
    const timestamp = Date.now();
    
    const metrics = await Promise.all([
      this.collectPerformanceMetrics(),
      this.collectResourceMetrics(),
      this.collectReplicationMetrics(),
      this.collectBackupMetrics(),
      this.collectSecurityMetrics()
    ]);
    
    const aggregatedMetrics: DatabaseMetrics = {
      timestamp,
      performance: metrics[0],
      resources: metrics[1],
      replication: metrics[2],
      backup: metrics[3],
      security: metrics[4]
    };
    
    // Store metrics for historical analysis
    await this.storeMetrics(aggregatedMetrics);
    
    // Check for alert conditions
    await this.checkAlertConditions(aggregatedMetrics);
    
    return aggregatedMetrics;
  }
  
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const [
      queryStats,
      connectionStats,
      lockStats,
      indexStats
    ] = await Promise.all([
      this.getQueryStatistics(),
      this.getConnectionStatistics(),
      this.getLockStatistics(),
      this.getIndexStatistics()
    ]);
    
    return {
      queryLatency: {
        avg: queryStats.avgLatency,
        p95: queryStats.p95Latency,
        p99: queryStats.p99Latency
      },
      throughput: {
        queriesPerSecond: queryStats.qps,
        transactionsPerSecond: queryStats.tps
      },
      connections: {
        active: connectionStats.active,
        idle: connectionStats.idle,
        total: connectionStats.total,
        maxUsed: connectionStats.maxUsed
      },
      locks: {
        waiting: lockStats.waiting,
        deadlocks: lockStats.deadlocks,
        timeouts: lockStats.timeouts
      },
      indexes: {
        hitRatio: indexStats.hitRatio,
        misses: indexStats.misses,
        scans: indexStats.scans
      }
    };
  }
  
  private async collectResourceMetrics(): Promise<ResourceMetrics> {
    return {
      cpu: {
        usage: await this.getCPUUsage(),
        load: await this.getCPULoad()
      },
      memory: {
        used: await this.getMemoryUsage(),
        buffers: await this.getBufferUsage(),
        cache: await this.getCacheUsage()
      },
      disk: {
        usage: await this.getDiskUsage(),
        iops: await this.getDiskIOPS(),
        latency: await this.getDiskLatency()
      },
      network: {
        bandwidth: await this.getNetworkBandwidth(),
        connections: await this.getNetworkConnections(),
        errors: await this.getNetworkErrors()
      }
    };
  }
  
  async generateCapacityPlan(horizon: number): Promise<CapacityPlan> {
    const historicalMetrics = await this.getHistoricalMetrics(30); // 30 days
    const trends = this.analyzeTrends(historicalMetrics);
    
    const projections = this.projectResourceNeeds(trends, horizon);
    
    return {
      horizon,
      currentCapacity: await this.getCurrentCapacity(),
      projectedNeeds: projections,
      recommendations: this.generateRecommendations(projections),
      costEstimate: await this.estimateCosts(projections),
      riskAssessment: this.assessCapacityRisks(projections)
    };
  }
  
  async generateSLAReport(period: { start: Date; end: Date }): Promise<SLAReport> {
    const metrics = await this.getMetricsForPeriod(period.start, period.end);
    
    const uptime = this.calculateUptime(metrics);
    const latency = this.calculateAverageLatency(metrics);
    const errorRate = this.calculateErrorRate(metrics);
    
    return {
      period,
      uptime: {
        actual: uptime,
        target: 99.9,
        breaches: uptime < 99.9 ? 1 : 0
      },
      latency: {
        actual: latency,
        target: 100,
        breaches: latency > 100 ? 1 : 0
      },
      errorRate: {
        actual: errorRate,
        target: 0.1,
        breaches: errorRate > 0.1 ? 1 : 0
      },
      overall: {
        met: uptime >= 99.9 && latency <= 100 && errorRate <= 0.1,
        score: this.calculateSLAScore(uptime, latency, errorRate)
      }
    };
  }
}

interface DatabaseMetrics {
  timestamp: number;
  performance: PerformanceMetrics;
  resources: ResourceMetrics;
  replication: ReplicationMetrics;
  backup: BackupMetrics;
  security: SecurityMetrics;
}

interface PerformanceMetrics {
  queryLatency: {
    avg: number;
    p95: number;
    p99: number;
  };
  throughput: {
    queriesPerSecond: number;
    transactionsPerSecond: number;
  };
  connections: {
    active: number;
    idle: number;
    total: number;
    maxUsed: number;
  };
  locks: {
    waiting: number;
    deadlocks: number;
    timeouts: number;
  };
  indexes: {
    hitRatio: number;
    misses: number;
    scans: number;
  };
}

interface CapacityPlan {
  horizon: number;
  currentCapacity: ResourceCapacity;
  projectedNeeds: ResourceProjection;
  recommendations: string[];
  costEstimate: number;
  riskAssessment: RiskLevel;
}

interface SLAReport {
  period: { start: Date; end: Date };
  uptime: SLAMetric;
  latency: SLAMetric;
  errorRate: SLAMetric;
  overall: {
    met: boolean;
    score: number;
  };
}
```

## Success Criteria

### Data Integrity
- **Zero data loss**: 100% transaction durability guarantee
- **Consistency**: ACID compliance across all operations
- **Recovery**: RTO < 1 hour, RPO < 5 minutes
- **Backup verification**: 100% automated integrity checks

### Performance
- **Query latency**: < 100ms for 95% of queries
- **Backup speed**: Full backup in < 2 hours for 1TB database
- **Replication lag**: < 1 second across regions
- **Availability**: 99.99% uptime SLA

### Security
- **Encryption**: AES-256 for all data at rest and in transit
- **Access control**: 100% RBAC compliance
- **Audit coverage**: Complete trail for all data access
- **Compliance**: SOC2 Type II, PCI DSS Level 1

### Scalability
- **Horizontal scaling**: Support for 10x data growth
- **Geographic distribution**: 5+ regions with < 50ms latency
- **Concurrent users**: 100,000+ simultaneous connections
- **Storage**: Petabyte-scale capability with linear performance

This comprehensive data persistence and backup strategy ensures enterprise-grade reliability, security, and performance for the crypto portfolio management system.