import { PrismaClient, Exchange, ExchangeStatus, UserExchangeCredential } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { logger } from '../utils/logger';

interface CreateExchangeInput {
  name: string;
  displayName: string;
  websiteUrl?: string;
  apiBaseUrl: string;
  websocketUrl?: string;
  rateLimitPerMinute?: number;
  requiresKyc?: boolean;
  supportedCountries?: string[];
  tradingFees?: Record<string, any>;
}

interface AddCredentialInput {
  userId: string;
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  sandboxMode?: boolean;
  permissions?: string[];
}

interface UpdateCredentialInput {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  permissions?: string[];
  isActive?: boolean;
}

interface ExchangeWithCredentials extends Exchange {
  userCredentials: UserExchangeCredential[];
}

interface SyncResult {
  success: boolean;
  message: string;
  portfoliosUpdated?: number;
  transactionsImported?: number;
  lastSync?: Date;
}

export class ExchangeService {
  private prisma: PrismaClient;
  private encryptionKey: string;
  private algorithm = 'aes-256-gcm';

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here';
    
    if (this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
    }
  }

  /**
   * Create a new exchange
   */
  async createExchange(data: CreateExchangeInput): Promise<Exchange> {
    return this.prisma.exchange.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        websiteUrl: data.websiteUrl,
        apiBaseUrl: data.apiBaseUrl,
        websocketUrl: data.websocketUrl,
        rateLimitPerMinute: data.rateLimitPerMinute || 1200,
        requiresKyc: data.requiresKyc || false,
        supportedCountries: data.supportedCountries || [],
        tradingFees: data.tradingFees || {},
      },
    });
  }

  /**
   * Get all exchanges
   */
  async getAllExchanges(): Promise<Exchange[]> {
    return this.prisma.exchange.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });
  }

  /**
   * Get exchange by ID
   */
  async getExchangeById(exchangeId: string): Promise<Exchange | null> {
    return this.prisma.exchange.findFirst({
      where: {
        id: exchangeId,
        isActive: true,
      },
    });
  }

  /**
   * Get exchange by name
   */
  async getExchangeByName(name: string): Promise<Exchange | null> {
    return this.prisma.exchange.findFirst({
      where: {
        name,
        isActive: true,
      },
    });
  }

  /**
   * Get exchanges with user credentials
   */
  async getUserExchanges(userId: string): Promise<ExchangeWithCredentials[]> {
    return this.prisma.exchange.findMany({
      where: {
        isActive: true,
        userCredentials: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
      include: {
        userCredentials: {
          where: {
            userId,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Add user exchange credentials
   */
  async addUserCredentials(data: AddCredentialInput): Promise<UserExchangeCredential> {
    // Check if credentials already exist for this user and exchange
    const existing = await this.prisma.userExchangeCredential.findUnique({
      where: {
        userId_exchangeId: {
          userId: data.userId,
          exchangeId: data.exchangeId,
        },
      },
    });

    if (existing) {
      throw new Error('Credentials already exist for this exchange');
    }

    // Encrypt the credentials
    const encryptedApiKey = this.encrypt(data.apiKey);
    const encryptedApiSecret = this.encrypt(data.apiSecret);
    const encryptedPassphrase = data.passphrase ? this.encrypt(data.passphrase) : null;

    return this.prisma.userExchangeCredential.create({
      data: {
        userId: data.userId,
        exchangeId: data.exchangeId,
        apiKeyEncrypted: encryptedApiKey,
        apiSecretEncrypted: encryptedApiSecret,
        passphraseEncrypted: encryptedPassphrase,
        sandboxMode: data.sandboxMode || false,
        permissions: data.permissions || ['read'],
      },
    });
  }

  /**
   * Update user exchange credentials
   */
  async updateUserCredentials(
    userId: string,
    exchangeId: string,
    data: UpdateCredentialInput
  ): Promise<UserExchangeCredential> {
    const credential = await this.prisma.userExchangeCredential.findUnique({
      where: {
        userId_exchangeId: {
          userId,
          exchangeId,
        },
      },
    });

    if (!credential) {
      throw new Error('Credentials not found');
    }

    const updateData: any = {};

    if (data.apiKey) {
      updateData.apiKeyEncrypted = this.encrypt(data.apiKey);
    }
    
    if (data.apiSecret) {
      updateData.apiSecretEncrypted = this.encrypt(data.apiSecret);
    }
    
    if (data.passphrase !== undefined) {
      updateData.passphraseEncrypted = data.passphrase ? this.encrypt(data.passphrase) : null;
    }
    
    if (data.permissions) {
      updateData.permissions = data.permissions;
    }
    
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    return this.prisma.userExchangeCredential.update({
      where: {
        userId_exchangeId: {
          userId,
          exchangeId,
        },
      },
      data: updateData,
    });
  }

  /**
   * Remove user exchange credentials
   */
  async removeUserCredentials(userId: string, exchangeId: string): Promise<void> {
    const credential = await this.prisma.userExchangeCredential.findUnique({
      where: {
        userId_exchangeId: {
          userId,
          exchangeId,
        },
      },
    });

    if (!credential) {
      throw new Error('Credentials not found');
    }

    await this.prisma.userExchangeCredential.update({
      where: {
        userId_exchangeId: {
          userId,
          exchangeId,
        },
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get decrypted credentials for API calls
   */
  async getDecryptedCredentials(userId: string, exchangeId: string): Promise<{
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    sandboxMode: boolean;
    permissions: string[];
  } | null> {
    const credential = await this.prisma.userExchangeCredential.findUnique({
      where: {
        userId_exchangeId: {
          userId,
          exchangeId,
        },
        isActive: true,
      },
    });

    if (!credential) {
      return null;
    }

    try {
      const apiKey = this.decrypt(credential.apiKeyEncrypted);
      const apiSecret = this.decrypt(credential.apiSecretEncrypted);
      const passphrase = credential.passphraseEncrypted 
        ? this.decrypt(credential.passphraseEncrypted)
        : undefined;

      return {
        apiKey,
        apiSecret,
        passphrase,
        sandboxMode: credential.sandboxMode,
        permissions: credential.permissions,
      };
    } catch (error) {
      logger.error('Failed to decrypt credentials:', error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Test exchange API connection
   */
  async testConnection(userId: string, exchangeId: string): Promise<{
    success: boolean;
    message: string;
    permissions?: string[];
  }> {
    const credentials = await this.getDecryptedCredentials(userId, exchangeId);
    if (!credentials) {
      return {
        success: false,
        message: 'No credentials found for this exchange',
      };
    }

    const exchange = await this.getExchangeById(exchangeId);
    if (!exchange) {
      return {
        success: false,
        message: 'Exchange not found',
      };
    }

    try {
      // This would integrate with actual exchange APIs
      // For now, we'll simulate the connection test
      const testResult = await this.performApiTest(exchange, credentials);
      
      if (testResult.success) {
        // Update sync status
        await this.prisma.userExchangeCredential.update({
          where: {
            userId_exchangeId: {
              userId,
              exchangeId,
            },
          },
          data: {
            syncStatus: 'connected',
            errorMessage: null,
            lastSync: new Date(),
          },
        });
      } else {
        // Update error status
        await this.prisma.userExchangeCredential.update({
          where: {
            userId_exchangeId: {
              userId,
              exchangeId,
            },
          },
          data: {
            syncStatus: 'error',
            errorMessage: testResult.message,
          },
        });
      }

      return testResult;
    } catch (error) {
      logger.error('Exchange API test failed:', error);
      
      await this.prisma.userExchangeCredential.update({
        where: {
          userId_exchangeId: {
            userId,
            exchangeId,
          },
        },
        data: {
          syncStatus: 'error',
          errorMessage: 'Connection test failed',
        },
      });

      return {
        success: false,
        message: 'Connection test failed',
      };
    }
  }

  /**
   * Sync user data from exchange
   */
  async syncExchangeData(userId: string, exchangeId: string): Promise<SyncResult> {
    const credentials = await this.getDecryptedCredentials(userId, exchangeId);
    if (!credentials) {
      return {
        success: false,
        message: 'No credentials found for this exchange',
      };
    }

    const exchange = await this.getExchangeById(exchangeId);
    if (!exchange) {
      return {
        success: false,
        message: 'Exchange not found',
      };
    }

    try {
      // Update sync status to in progress
      await this.prisma.userExchangeCredential.update({
        where: {
          userId_exchangeId: {
            userId,
            exchangeId,
          },
        },
        data: {
          syncStatus: 'syncing',
        },
      });

      // This would integrate with actual exchange APIs to:
      // 1. Fetch account balances
      // 2. Fetch transaction history
      // 3. Update portfolio holdings
      // 4. Import new transactions
      
      const syncResult = await this.performDataSync(exchange, credentials, userId);

      // Update sync status
      await this.prisma.userExchangeCredential.update({
        where: {
          userId_exchangeId: {
            userId,
            exchangeId,
          },
        },
        data: {
          syncStatus: syncResult.success ? 'synced' : 'error',
          errorMessage: syncResult.success ? null : syncResult.message,
          lastSync: syncResult.success ? new Date() : undefined,
        },
      });

      return syncResult;
    } catch (error) {
      logger.error('Exchange data sync failed:', error);
      
      await this.prisma.userExchangeCredential.update({
        where: {
          userId_exchangeId: {
            userId,
            exchangeId,
          },
        },
        data: {
          syncStatus: 'error',
          errorMessage: 'Data sync failed',
        },
      });

      return {
        success: false,
        message: 'Data sync failed',
      };
    }
  }

  /**
   * Update exchange status
   */
  async updateExchangeStatus(exchangeId: string, status: ExchangeStatus): Promise<Exchange> {
    return this.prisma.exchange.update({
      where: { id: exchangeId },
      data: { status },
    });
  }

  /**
   * Get user credential status
   */
  async getUserCredentialStatus(userId: string, exchangeId: string): Promise<{
    hasCredentials: boolean;
    syncStatus: string;
    lastSync?: Date;
    errorMessage?: string;
  }> {
    const credential = await this.prisma.userExchangeCredential.findUnique({
      where: {
        userId_exchangeId: {
          userId,
          exchangeId,
        },
      },
    });

    return {
      hasCredentials: !!credential && credential.isActive,
      syncStatus: credential?.syncStatus || 'none',
      lastSync: credential?.lastSync || undefined,
      errorMessage: credential?.errorMessage || undefined,
    };
  }

  // Private helper methods
  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, Buffer.from(this.encryptionKey), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async performApiTest(exchange: Exchange, credentials: any): Promise<{
    success: boolean;
    message: string;
    permissions?: string[];
  }> {
    // This would integrate with actual exchange APIs
    // For demonstration, we'll simulate different scenarios
    
    // Simulate API rate limiting
    if (Math.random() < 0.1) { // 10% chance of rate limiting
      return {
        success: false,
        message: 'API rate limit exceeded',
      };
    }
    
    // Simulate invalid credentials
    if (credentials.apiKey.includes('invalid')) {
      return {
        success: false,
        message: 'Invalid API credentials',
      };
    }
    
    // Simulate successful connection
    return {
      success: true,
      message: 'Connection successful',
      permissions: credentials.permissions,
    };
  }

  private async performDataSync(exchange: Exchange, credentials: any, userId: string): Promise<SyncResult> {
    // This would integrate with actual exchange APIs to:
    // 1. Fetch account balances and update holdings
    // 2. Fetch transaction history and import new transactions
    // 3. Update portfolio values
    
    // For demonstration, we'll simulate the sync process
    return {
      success: true,
      message: 'Data synced successfully',
      portfoliosUpdated: 1,
      transactionsImported: Math.floor(Math.random() * 50),
      lastSync: new Date(),
    };
  }
}