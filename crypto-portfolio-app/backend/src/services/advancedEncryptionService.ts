import { createCipher, createDecipher, randomBytes, pbkdf2Sync, createHash, timingSafeEqual } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { EncryptedData, EncryptedApiKey, EncryptionService } from '../types/encryption';
import { CryptoUtils } from '../utils/cryptoUtils';

export class AdvancedEncryptionService implements EncryptionService {
  private readonly prisma: PrismaClient;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32;
  private readonly IV_LENGTH = 12;
  private readonly TAG_LENGTH = 16;
  private readonly SALT_LENGTH = 32;
  private readonly PBKDF2_ITERATIONS = 100000;
  private readonly MASTER_KEY_ENV = process.env.MASTER_ENCRYPTION_KEY;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    if (!this.MASTER_KEY_ENV) {
      throw new Error('MASTER_ENCRYPTION_KEY environment variable is required');
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM with envelope encryption
   */
  async encrypt(plaintext: string, keyId?: string): Promise<EncryptedData> {
    try {
      // Generate or retrieve data key
      const dataKey = keyId ? await this.getDataKey(keyId) : await this.generateDataKey('API_CREDENTIALS');
      
      // Generate IV
      const iv = randomBytes(this.IV_LENGTH);
      
      // Create cipher
      const cipher = createCipher(this.ALGORITHM, dataKey.key);
      
      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      return {
        ciphertext: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        keyId: dataKey.keyId,
        algorithm: this.ALGORITHM,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt ciphertext using AES-256-GCM with envelope encryption
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      // Retrieve data key
      const dataKey = await this.getDataKey(encryptedData.keyId);
      
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      // Create decipher
      const decipher = createDecipher(this.ALGORITHM, dataKey.key);
      decipher.setAuthTag(authTag);
      
      // Decrypt
      let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt API key with additional security measures
   */
  async encryptApiKey(
    apiKey: string, 
    masterPassword: string, 
    salt?: Buffer
  ): Promise<EncryptedApiKey> {
    try {
      // Generate salt if not provided
      const keySalt = salt || randomBytes(this.SALT_LENGTH);
      
      // Derive encryption key using PBKDF2
      const derivedKey = pbkdf2Sync(
        masterPassword, 
        keySalt, 
        this.PBKDF2_ITERATIONS,
        this.KEY_LENGTH, 
        'sha512'
      );
      
      // Generate IV
      const iv = randomBytes(this.IV_LENGTH);
      
      // Create cipher
      const cipher = createCipher(this.ALGORITHM, derivedKey);
      cipher.setAAD(keySalt); // Use salt as additional authenticated data
      
      // Encrypt
      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Generate unique key ID
      const keyId = CryptoUtils.generateUniqueId('key');
      
      return {
        ciphertext: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: keySalt.toString('hex'),
        keyId,
        algorithm: this.ALGORITHM,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`API key encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt API key
   */
  async decryptApiKey(encryptedData: EncryptedApiKey, masterPassword: string): Promise<string> {
    try {
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      // Derive the same key
      const derivedKey = pbkdf2Sync(
        masterPassword, 
        salt, 
        this.PBKDF2_ITERATIONS,
        this.KEY_LENGTH, 
        'sha512'
      );
      
      // Create decipher
      const decipher = createDecipher(this.ALGORITHM, derivedKey);
      decipher.setAuthTag(authTag);
      decipher.setAAD(salt);
      
      // Decrypt
      let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`API key decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate a new master key
   */
  async generateMasterKey(): Promise<string> {
    try {
      const masterKey = randomBytes(this.KEY_LENGTH).toString('hex');
      const keyId = CryptoUtils.generateUniqueId('master');
      const keyHash = CryptoUtils.sha256Hash(masterKey);
      
      // In production, this should be stored in HSM or secure key management service
      const encryptedMasterKey = this.encryptMasterKey(masterKey);
      
      await this.prisma.masterKey.create({
        data: {
          keyId,
          encryptedKey: encryptedMasterKey,
          keyDerivationSalt: randomBytes(32).toString('hex'),
          createdBy: 'system',
          nextRotation: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        }
      });
      
      return masterKey;
    } catch (error) {
      throw new Error(`Master key generation failed: ${error.message}`);
    }
  }

  /**
   * Rotate master key
   */
  async rotateMasterKey(): Promise<void> {
    try {
      // Get current active master key
      const currentMasterKey = await this.prisma.masterKey.findFirst({
        where: {
          status: 'ACTIVE',
          isActive: true
        }
      });

      if (!currentMasterKey) {
        throw new Error('No active master key found');
      }

      // Generate new master key
      const newMasterKey = await this.generateMasterKey();
      
      // Mark current key as rotating
      await this.prisma.masterKey.update({
        where: { id: currentMasterKey.id },
        data: {
          status: 'ROTATING',
          lastRotated: new Date()
        }
      });

      // Create rotation history entry
      await this.prisma.keyRotationHistory.create({
        data: {
          masterKeyId: currentMasterKey.id,
          rotationType: 'MASTER_KEY',
          rotationReason: 'SCHEDULED',
          oldKeyVersion: currentMasterKey.version,
          newKeyVersion: currentMasterKey.version + 1,
          initiatedBy: 'system',
          initiatedAt: new Date()
        }
      });

      // In a real implementation, you would:
      // 1. Re-encrypt all data keys with the new master key
      // 2. Verify integrity of all encrypted data
      // 3. Mark old key as deprecated after grace period
      
    } catch (error) {
      throw new Error(`Master key rotation failed: ${error.message}`);
    }
  }

  /**
   * Derive data key for specific purpose
   */
  async deriveDataKey(keyId: string): Promise<Buffer> {
    try {
      const dataKey = await this.prisma.dataKey.findUnique({
        where: { dataKeyId: keyId },
        include: { masterKey: true }
      });

      if (!dataKey || !dataKey.masterKey) {
        throw new Error('Data key not found');
      }

      // Decrypt data key using master key
      const masterKey = this.decryptMasterKey(dataKey.masterKey.encryptedKey);
      const decryptedDataKey = this.decryptDataKeyWithMaster(dataKey.encryptedDataKey, masterKey);
      
      return Buffer.from(decryptedDataKey, 'hex');
    } catch (error) {
      throw new Error(`Data key derivation failed: ${error.message}`);
    }
  }

  /**
   * Secure delete operation (best effort)
   */
  secureDelete(data: string): void {
    try {
      // Convert string to buffer and overwrite with random data
      const buffer = Buffer.from(data, 'utf8');
      
      // Multiple overwrite passes
      for (let i = 0; i < 3; i++) {
        const randomData = randomBytes(buffer.length);
        randomData.copy(buffer);
      }
      
      // Final zero pass
      buffer.fill(0);
      
      // Force garbage collection (Node.js specific)
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      // Secure delete is best effort - don't throw on failure
      console.warn('Secure delete failed:', error.message);
    }
  }

  /**
   * Validate data integrity
   */
  validateIntegrity(encryptedData: EncryptedData): boolean {
    try {
      // Validate required fields
      if (!encryptedData.ciphertext || !encryptedData.iv || !encryptedData.authTag) {
        return false;
      }

      // Validate hex format
      if (!CryptoUtils.isValidHex(encryptedData.iv) || 
          !CryptoUtils.isValidHex(encryptedData.authTag)) {
        return false;
      }

      // Validate lengths
      if (encryptedData.iv.length !== this.IV_LENGTH * 2 ||
          encryptedData.authTag.length !== this.TAG_LENGTH * 2) {
        return false;
      }

      // Validate timestamp (not too old, not in future)
      const now = Date.now();
      const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
      const futureThreshold = 5 * 60 * 1000; // 5 minutes

      if (encryptedData.timestamp < now - maxAge || 
          encryptedData.timestamp > now + futureThreshold) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate new data key
   */
  private async generateDataKey(purpose: string): Promise<{ keyId: string; key: Buffer }> {
    const activeMasterKey = await this.prisma.masterKey.findFirst({
      where: {
        status: 'ACTIVE',
        isActive: true
      }
    });

    if (!activeMasterKey) {
      throw new Error('No active master key found');
    }

    const dataKeyValue = randomBytes(this.KEY_LENGTH);
    const keyId = CryptoUtils.generateUniqueId('data');
    
    // Encrypt data key with master key
    const masterKey = this.decryptMasterKey(activeMasterKey.encryptedKey);
    const encryptedDataKey = this.encryptDataKeyWithMaster(dataKeyValue.toString('hex'), masterKey);

    await this.prisma.dataKey.create({
      data: {
        dataKeyId: keyId,
        masterKeyId: activeMasterKey.id,
        encryptedDataKey,
        keyPurpose: purpose as any
      }
    });

    return { keyId, key: dataKeyValue };
  }

  /**
   * Get existing data key
   */
  private async getDataKey(keyId: string): Promise<{ keyId: string; key: Buffer }> {
    const dataKey = await this.prisma.dataKey.findUnique({
      where: { dataKeyId: keyId },
      include: { masterKey: true }
    });

    if (!dataKey || !dataKey.masterKey) {
      throw new Error('Data key not found');
    }

    const masterKey = this.decryptMasterKey(dataKey.masterKey.encryptedKey);
    const decryptedDataKey = this.decryptDataKeyWithMaster(dataKey.encryptedDataKey, masterKey);
    
    return { 
      keyId, 
      key: Buffer.from(decryptedDataKey, 'hex') 
    };
  }

  /**
   * Encrypt master key (in production, use HSM)
   */
  private encryptMasterKey(masterKey: string): string {
    if (!this.MASTER_KEY_ENV) {
      throw new Error('Master encryption key not available');
    }
    
    const key = Buffer.from(this.MASTER_KEY_ENV, 'hex');
    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipher(this.ALGORITHM, key);
    
    let encrypted = cipher.update(masterKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  /**
   * Decrypt master key (in production, use HSM)
   */
  private decryptMasterKey(encryptedMasterKey: string): string {
    if (!this.MASTER_KEY_ENV) {
      throw new Error('Master encryption key not available');
    }

    const key = Buffer.from(this.MASTER_KEY_ENV, 'hex');
    const data = JSON.parse(encryptedMasterKey);
    
    const decipher = createDecipher(this.ALGORITHM, key);
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Encrypt data key with master key
   */
  private encryptDataKeyWithMaster(dataKey: string, masterKey: string): string {
    const key = Buffer.from(masterKey, 'hex');
    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipher(this.ALGORITHM, key);
    
    let encrypted = cipher.update(dataKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }

  /**
   * Decrypt data key with master key
   */
  private decryptDataKeyWithMaster(encryptedDataKey: string, masterKey: string): string {
    const key = Buffer.from(masterKey, 'hex');
    const data = JSON.parse(encryptedDataKey);
    
    const decipher = createDecipher(this.ALGORITHM, key);
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}