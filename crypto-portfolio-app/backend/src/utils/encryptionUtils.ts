/**
 * Backup encryption and decryption utilities
 * Provides secure file handling, key management, and integrity verification
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { Transform } from 'stream';

const streamPipeline = promisify(pipeline);

export interface EncryptionOptions {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';
  keyId: string;
  additionalData?: Buffer;
}

export interface EncryptionResult {
  encryptedData: Buffer;
  iv: Buffer;
  authTag?: Buffer;
  checksum: string;
  algorithm: string;
  keyId: string;
}

export interface DecryptionOptions {
  algorithm: string;
  keyId: string;
  iv: Buffer;
  authTag?: Buffer;
  additionalData?: Buffer;
}

export interface FileEncryptionMetadata {
  algorithm: string;
  keyId: string;
  iv: string;
  authTag?: string;
  checksum: string;
  originalSize: number;
  encryptedSize: number;
  timestamp: string;
}

export class EncryptionUtils {
  private keyCache: Map<string, Buffer> = new Map();
  private keyProvider: KeyProvider;

  constructor(keyProvider: KeyProvider) {
    this.keyProvider = keyProvider;
  }

  /**
   * Encrypt data with specified algorithm
   */
  async encryptData(
    data: Buffer,
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    const key = await this.getKey(options.keyId);
    const iv = crypto.randomBytes(16);
    
    let cipher: crypto.Cipher;
    let authTag: Buffer | undefined;

    switch (options.algorithm) {
      case 'AES-256-GCM':
        cipher = crypto.createCipher('aes-256-gcm', key);
        cipher.setAAD(options.additionalData || Buffer.alloc(0));
        break;
      case 'AES-256-CBC':
        cipher = crypto.createCipher('aes-256-cbc', key);
        break;
      case 'ChaCha20-Poly1305':
        cipher = crypto.createCipher('chacha20-poly1305', key);
        if (options.additionalData) {
          cipher.setAAD(options.additionalData);
        }
        break;
      default:
        throw new Error(`Unsupported encryption algorithm: ${options.algorithm}`);
    }

    const encryptedData = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);

    if (options.algorithm === 'AES-256-GCM' || options.algorithm === 'ChaCha20-Poly1305') {
      authTag = cipher.getAuthTag();
    }

    const checksum = this.calculateChecksum(encryptedData);

    return {
      encryptedData,
      iv,
      authTag,
      checksum,
      algorithm: options.algorithm,
      keyId: options.keyId
    };
  }

  /**
   * Decrypt data with specified options
   */
  async decryptData(
    encryptedData: Buffer,
    options: DecryptionOptions
  ): Promise<Buffer> {
    const key = await this.getKey(options.keyId);
    
    let decipher: crypto.Decipher;

    switch (options.algorithm) {
      case 'AES-256-GCM':
        decipher = crypto.createDecipher('aes-256-gcm', key);
        if (options.authTag) {
          decipher.setAuthTag(options.authTag);
        }
        if (options.additionalData) {
          decipher.setAAD(options.additionalData);
        }
        break;
      case 'AES-256-CBC':
        decipher = crypto.createDecipher('aes-256-cbc', key);
        break;
      case 'ChaCha20-Poly1305':
        decipher = crypto.createDecipher('chacha20-poly1305', key);
        if (options.authTag) {
          decipher.setAuthTag(options.authTag);
        }
        if (options.additionalData) {
          decipher.setAAD(options.additionalData);
        }
        break;
      default:
        throw new Error(`Unsupported decryption algorithm: ${options.algorithm}`);
    }

    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
  }

  /**
   * Encrypt file with streaming for large files
   */
  async encryptFile(
    inputPath: string,
    outputPath: string,
    options: EncryptionOptions
  ): Promise<FileEncryptionMetadata> {
    const key = await this.getKey(options.keyId);
    const iv = crypto.randomBytes(16);
    const originalStats = await fs.promises.stat(inputPath);
    
    const cipher = crypto.createCipher(this.getAlgorithmName(options.algorithm), key);
    const checksumHash = crypto.createHash('sha256');
    
    if (options.algorithm === 'AES-256-GCM' || options.algorithm === 'ChaCha20-Poly1305') {
      cipher.setAAD(options.additionalData || Buffer.from(path.basename(inputPath)));
    }

    // Create transform stream for checksum calculation
    const checksumTransform = new Transform({
      transform(chunk: Buffer, encoding, callback) {
        checksumHash.update(chunk);
        callback(null, chunk);
      }
    });

    await streamPipeline(
      createReadStream(inputPath),
      cipher,
      checksumTransform,
      createWriteStream(outputPath)
    );

    const encryptedStats = await fs.promises.stat(outputPath);
    let authTag: Buffer | undefined;

    if (options.algorithm === 'AES-256-GCM' || options.algorithm === 'ChaCha20-Poly1305') {
      authTag = cipher.getAuthTag();
    }

    const metadata: FileEncryptionMetadata = {
      algorithm: options.algorithm,
      keyId: options.keyId,
      iv: iv.toString('hex'),
      authTag: authTag?.toString('hex'),
      checksum: checksumHash.digest('hex'),
      originalSize: originalStats.size,
      encryptedSize: encryptedStats.size,
      timestamp: new Date().toISOString()
    };

    // Write metadata file
    await fs.promises.writeFile(
      `${outputPath}.meta`,
      JSON.stringify(metadata, null, 2)
    );

    return metadata;
  }

  /**
   * Decrypt file with streaming for large files
   */
  async decryptFile(
    inputPath: string,
    outputPath: string,
    metadataPath?: string
  ): Promise<boolean> {
    const metaPath = metadataPath || `${inputPath}.meta`;
    
    if (!await this.fileExists(metaPath)) {
      throw new Error(`Metadata file not found: ${metaPath}`);
    }

    const metadata: FileEncryptionMetadata = JSON.parse(
      await fs.promises.readFile(metaPath, 'utf8')
    );

    const key = await this.getKey(metadata.keyId);
    const iv = Buffer.from(metadata.iv, 'hex');
    const authTag = metadata.authTag ? Buffer.from(metadata.authTag, 'hex') : undefined;
    
    const decipher = crypto.createDecipher(this.getAlgorithmName(metadata.algorithm), key);
    const checksumHash = crypto.createHash('sha256');

    if (authTag && (metadata.algorithm === 'AES-256-GCM' || metadata.algorithm === 'ChaCha20-Poly1305')) {
      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.from(path.basename(inputPath.replace('.encrypted', ''))));
    }

    // Create transform stream for checksum verification
    const checksumTransform = new Transform({
      transform(chunk: Buffer, encoding, callback) {
        checksumHash.update(chunk);
        callback(null, chunk);
      }
    });

    await streamPipeline(
      createReadStream(inputPath),
      decipher,
      checksumTransform,
      createWriteStream(outputPath)
    );

    // Verify checksum (note: this checks the encrypted file checksum)
    const calculatedChecksum = checksumHash.digest('hex');
    const isValid = calculatedChecksum === metadata.checksum;

    if (!isValid) {
      await fs.promises.unlink(outputPath); // Remove corrupted file
      throw new Error('File integrity verification failed');
    }

    return true;
  }

  /**
   * Calculate SHA-256 checksum of data
   */
  calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Calculate SHA-256 checksum of file
   */
  async calculateFileChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Verify file integrity using checksum
   */
  async verifyFileIntegrity(
    filePath: string,
    expectedChecksum: string
  ): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateFileChecksum(filePath);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate secure random encryption key
   */
  generateEncryptionKey(size: number = 32): Buffer {
    return crypto.randomBytes(size);
  }

  /**
   * Derive key from password using PBKDF2
   */
  deriveKeyFromPassword(
    password: string,
    salt: Buffer,
    iterations: number = 100000,
    keyLength: number = 32
  ): Buffer {
    return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
  }

  /**
   * Secure file deletion (overwrite before delete)
   */
  async secureDelete(filePath: string, passes: number = 3): Promise<void> {
    if (!await this.fileExists(filePath)) {
      return;
    }

    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;
    
    const fd = await fs.promises.open(filePath, 'r+');
    
    try {
      for (let pass = 0; pass < passes; pass++) {
        const randomData = crypto.randomBytes(Math.min(fileSize, 1024 * 1024)); // 1MB chunks
        let position = 0;
        
        while (position < fileSize) {
          const chunkSize = Math.min(randomData.length, fileSize - position);
          await fd.write(randomData.subarray(0, chunkSize), 0, chunkSize, position);
          position += chunkSize;
        }
        
        await fd.sync();
      }
    } finally {
      await fd.close();
    }
    
    await fs.promises.unlink(filePath);
  }

  /**
   * Encrypt backup metadata
   */
  async encryptMetadata(
    metadata: any,
    keyId: string
  ): Promise<{ encrypted: string; iv: string; authTag?: string }> {
    const data = Buffer.from(JSON.stringify(metadata));
    const result = await this.encryptData(data, {
      algorithm: 'AES-256-GCM',
      keyId
    });

    return {
      encrypted: result.encryptedData.toString('base64'),
      iv: result.iv.toString('hex'),
      authTag: result.authTag?.toString('hex')
    };
  }

  /**
   * Decrypt backup metadata
   */
  async decryptMetadata(
    encryptedMetadata: { encrypted: string; iv: string; authTag?: string },
    keyId: string
  ): Promise<any> {
    const encryptedData = Buffer.from(encryptedMetadata.encrypted, 'base64');
    const iv = Buffer.from(encryptedMetadata.iv, 'hex');
    const authTag = encryptedMetadata.authTag ? Buffer.from(encryptedMetadata.authTag, 'hex') : undefined;

    const decryptedData = await this.decryptData(encryptedData, {
      algorithm: 'AES-256-GCM',
      keyId,
      iv,
      authTag
    });

    return JSON.parse(decryptedData.toString());
  }

  /**
   * Get encryption key from provider
   */
  private async getKey(keyId: string): Promise<Buffer> {
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }

    const key = await this.keyProvider.getKey(keyId);
    this.keyCache.set(keyId, key);
    
    // Auto-expire cache after 1 hour
    setTimeout(() => {
      this.keyCache.delete(keyId);
    }, 60 * 60 * 1000);

    return key;
  }

  /**
   * Get cipher algorithm name
   */
  private getAlgorithmName(algorithm: string): string {
    switch (algorithm) {
      case 'AES-256-GCM':
        return 'aes-256-gcm';
      case 'AES-256-CBC':
        return 'aes-256-cbc';
      case 'ChaCha20-Poly1305':
        return 'chacha20-poly1305';
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Key provider interface for different key management systems
 */
export interface KeyProvider {
  getKey(keyId: string): Promise<Buffer>;
  createKey(keyId: string, keyData?: Buffer): Promise<Buffer>;
  rotateKey(keyId: string): Promise<Buffer>;
  deleteKey(keyId: string): Promise<void>;
}

/**
 * Local key provider (for development/testing)
 */
export class LocalKeyProvider implements KeyProvider {
  private keys: Map<string, Buffer> = new Map();
  private keyDir: string;

  constructor(keyDir: string = '/var/keys/crypto-portfolio') {
    this.keyDir = keyDir;
    this.ensureKeyDirectory();
  }

  async getKey(keyId: string): Promise<Buffer> {
    if (this.keys.has(keyId)) {
      return this.keys.get(keyId)!;
    }

    const keyPath = path.join(this.keyDir, `${keyId}.key`);
    
    try {
      const keyData = await fs.promises.readFile(keyPath);
      this.keys.set(keyId, keyData);
      return keyData;
    } catch (error) {
      throw new Error(`Key not found: ${keyId}`);
    }
  }

  async createKey(keyId: string, keyData?: Buffer): Promise<Buffer> {
    const key = keyData || crypto.randomBytes(32);
    const keyPath = path.join(this.keyDir, `${keyId}.key`);
    
    await fs.promises.writeFile(keyPath, key, { mode: 0o600 });
    this.keys.set(keyId, key);
    
    return key;
  }

  async rotateKey(keyId: string): Promise<Buffer> {
    const oldKeyPath = path.join(this.keyDir, `${keyId}.key`);
    const backupKeyPath = path.join(this.keyDir, `${keyId}.key.bak`);
    
    // Backup old key
    if (await this.fileExists(oldKeyPath)) {
      await fs.promises.copyFile(oldKeyPath, backupKeyPath);
    }
    
    // Create new key
    const newKey = await this.createKey(keyId);
    
    return newKey;
  }

  async deleteKey(keyId: string): Promise<void> {
    const keyPath = path.join(this.keyDir, `${keyId}.key`);
    
    if (await this.fileExists(keyPath)) {
      await fs.promises.unlink(keyPath);
    }
    
    this.keys.delete(keyId);
  }

  private async ensureKeyDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.keyDir, { recursive: true, mode: 0o700 });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * AWS KMS key provider
 */
export class KMSKeyProvider implements KeyProvider {
  private kmsClient: any; // AWS KMS client
  private dataKeys: Map<string, Buffer> = new Map();

  constructor(kmsClient: any) {
    this.kmsClient = kmsClient;
  }

  async getKey(keyId: string): Promise<Buffer> {
    if (this.dataKeys.has(keyId)) {
      return this.dataKeys.get(keyId)!;
    }

    try {
      const result = await this.kmsClient.generateDataKey({
        KeyId: keyId,
        KeySpec: 'AES_256'
      }).promise();

      const key = Buffer.from(result.Plaintext);
      this.dataKeys.set(keyId, key);
      
      // Auto-expire cache after 1 hour
      setTimeout(() => {
        this.dataKeys.delete(keyId);
      }, 60 * 60 * 1000);

      return key;
    } catch (error) {
      throw new Error(`Failed to get key from KMS: ${error.message}`);
    }
  }

  async createKey(keyId: string): Promise<Buffer> {
    // KMS manages key creation
    return this.getKey(keyId);
  }

  async rotateKey(keyId: string): Promise<Buffer> {
    // Clear cache to force new key generation
    this.dataKeys.delete(keyId);
    return this.getKey(keyId);
  }

  async deleteKey(keyId: string): Promise<void> {
    this.dataKeys.delete(keyId);
    // Note: KMS keys are not deleted immediately for security reasons
  }
}

// Export singleton instance with default local key provider
const defaultKeyProvider = new LocalKeyProvider();
export const encryptionUtils = new EncryptionUtils(defaultKeyProvider);

export default EncryptionUtils;