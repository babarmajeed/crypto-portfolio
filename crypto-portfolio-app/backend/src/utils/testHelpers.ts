import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import express from 'express';
import { setupMiddleware } from '../middleware/index';
import { setupRoutes } from '../routes/index';
import { setupSwagger } from '../docs/swagger.config';

const prisma = new PrismaClient();

/**
 * Test Application Factory
 */
export async function createTestApp(): Promise<Express> {
  const app = express();
  
  // Setup middleware
  await setupMiddleware(app);
  
  // Setup routes
  setupRoutes(app);
  
  // Setup documentation
  setupSwagger(app);
  
  return app;
}

/**
 * Test User Generator
 */
export interface TestUserOptions {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'BASIC' | 'PREMIUM' | 'ADMIN';
  isEmailVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export async function generateTestUser(options: TestUserOptions = {}): Promise<any> {
  const password = options.password || 'TestPassword123!';
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const userData = {
    email: options.email || faker.internet.email(),
    password: hashedPassword,
    firstName: options.firstName || faker.person.firstName(),
    lastName: options.lastName || faker.person.lastName(),
    role: options.role || 'BASIC',
    isEmailVerified: options.isEmailVerified !== undefined ? options.isEmailVerified : true,
    twoFactorEnabled: options.twoFactorEnabled || false,
    preferences: {
      currency: 'USD',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: false,
        sms: false
      },
      privacy: {
        sharePortfolio: false,
        analyticsOptOut: false
      }
    }
  };

  try {
    const user = await prisma.user.create({
      data: userData
    });
    
    // Store original password for testing
    (user as any).originalPassword = password;
    return user;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}

/**
 * Test Portfolio Generator
 */
export interface TestPortfolioOptions {
  name?: string;
  description?: string;
  type?: 'MANUAL' | 'EXCHANGE_SYNC' | 'TEMPLATE';
  isDefault?: boolean;
  isActive?: boolean;
  exchangeId?: string;
}

export async function generateTestPortfolio(
  userId: string, 
  options: TestPortfolioOptions = {}
): Promise<any> {
  const portfolioData = {
    name: options.name || faker.company.name() + ' Portfolio',
    description: options.description || faker.lorem.sentence(),
    type: options.type || 'MANUAL',
    userId,
    exchangeId: options.exchangeId || null,
    isDefault: options.isDefault || false,
    isActive: options.isActive !== undefined ? options.isActive : true,
    totalValue: 0,
    performance: {
      totalReturn: 0,
      totalReturnPercentage: 0,
      dayChange: 0,
      dayChangePercentage: 0,
      weekChange: 0,
      monthChange: 0,
      yearChange: 0
    }
  };

  try {
    return await prisma.portfolio.create({
      data: portfolioData
    });
  } catch (error) {
    console.error('Error creating test portfolio:', error);
    throw error;
  }
}

/**
 * Test Transaction Generator
 */
export interface TestTransactionOptions {
  type?: 'BUY' | 'SELL' | 'TRANSFER' | 'DIVIDEND';
  symbol?: string;
  quantity?: number;
  price?: number;
  fee?: number;
  exchangeId?: string;
  notes?: string;
  executedAt?: Date;
}

export async function generateTestTransaction(
  portfolioId: string,
  options: TestTransactionOptions = {}
): Promise<any> {
  const quantity = options.quantity || faker.number.float({ min: 0.01, max: 100, fractionDigits: 8 });
  const price = options.price || faker.number.float({ min: 1, max: 100000, fractionDigits: 2 });
  const fee = options.fee || faker.number.float({ min: 0, max: 100, fractionDigits: 2 });

  const transactionData = {
    portfolioId,
    type: options.type || faker.helpers.arrayElement(['BUY', 'SELL', 'TRANSFER', 'DIVIDEND']),
    symbol: options.symbol || faker.helpers.arrayElement(['BTC', 'ETH', 'ADA', 'DOT', 'LINK']),
    quantity,
    price,
    fee,
    total: (quantity * price) + fee,
    exchangeId: options.exchangeId || null,
    externalId: faker.string.uuid(),
    notes: options.notes || faker.lorem.sentence(),
    executedAt: options.executedAt || faker.date.recent({ days: 30 })
  };

  try {
    return await prisma.transaction.create({
      data: transactionData
    });
  } catch (error) {
    console.error('Error creating test transaction:', error);
    throw error;
  }
}

/**
 * Test API Key Generator
 */
export interface TestApiKeyOptions {
  name?: string;
  exchangeId?: string;
  permissions?: string[];
  isActive?: boolean;
  expiresAt?: Date;
}

export async function generateTestApiKey(
  userId: string,
  options: TestApiKeyOptions = {}
): Promise<any> {
  const apiKeyData = {
    userId,
    name: options.name || faker.company.name() + ' API Key',
    exchangeId: options.exchangeId || faker.helpers.arrayElement(['binance', 'coinbase', 'kraken']),
    keyHash: faker.string.alphanumeric(64),
    secretHash: faker.string.alphanumeric(64),
    permissions: options.permissions || ['read', 'trade'],
    isActive: options.isActive !== undefined ? options.isActive : true,
    lastUsed: null,
    expiresAt: options.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
  };

  try {
    return await prisma.apiKey.create({
      data: apiKeyData
    });
  } catch (error) {
    console.error('Error creating test API key:', error);
    throw error;
  }
}

/**
 * Test Audit Log Generator
 */
export interface TestAuditLogOptions {
  action?: string;
  resource?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function generateTestAuditLog(
  userId: string,
  options: TestAuditLogOptions = {}
): Promise<any> {
  const auditLogData = {
    userId,
    action: options.action || faker.helpers.arrayElement(['USER_LOGIN', 'PORTFOLIO_CREATE', 'TRANSACTION_ADD']),
    resource: options.resource || faker.helpers.arrayElement(['User', 'Portfolio', 'Transaction']),
    resourceId: faker.string.uuid(),
    details: options.details || { method: 'API', success: true },
    ipAddress: options.ipAddress || faker.internet.ip(),
    userAgent: options.userAgent || faker.internet.userAgent(),
    timestamp: new Date()
  };

  try {
    return await prisma.auditLog.create({
      data: auditLogData
    });
  } catch (error) {
    console.error('Error creating test audit log:', error);
    throw error;
  }
}

/**
 * Test Session Generator
 */
export interface TestSessionOptions {
  ipAddress?: string;
  userAgent?: string;
  isActive?: boolean;
  expiresAt?: Date;
}

export async function generateTestSession(
  userId: string,
  options: TestSessionOptions = {}
): Promise<any> {
  const sessionData = {
    userId,
    sessionToken: faker.string.alphanumeric(128),
    ipAddress: options.ipAddress || faker.internet.ip(),
    userAgent: options.userAgent || faker.internet.userAgent(),
    isActive: options.isActive !== undefined ? options.isActive : true,
    lastActivity: new Date(),
    expiresAt: options.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };

  try {
    return await prisma.session.create({
      data: sessionData
    });
  } catch (error) {
    console.error('Error creating test session:', error);
    throw error;
  }
}

/**
 * Bulk Test Data Generator
 */
export async function generateBulkTestData(userId: string, counts: {
  portfolios?: number;
  transactions?: number;
  apiKeys?: number;
  auditLogs?: number;
} = {}): Promise<{
  portfolios: any[];
  transactions: any[];
  apiKeys: any[];
  auditLogs: any[];
}> {
  const results = {
    portfolios: [],
    transactions: [],
    apiKeys: [],
    auditLogs: []
  };

  // Generate portfolios
  if (counts.portfolios) {
    const portfolioPromises = Array.from({ length: counts.portfolios }, () =>
      generateTestPortfolio(userId)
    );
    results.portfolios = await Promise.all(portfolioPromises);
  }

  // Generate transactions (distributed across portfolios)
  if (counts.transactions && results.portfolios.length > 0) {
    const transactionPromises = Array.from({ length: counts.transactions }, (_, i) => {
      const portfolio = results.portfolios[i % results.portfolios.length];
      return generateTestTransaction(portfolio.id);
    });
    results.transactions = await Promise.all(transactionPromises);
  }

  // Generate API keys
  if (counts.apiKeys) {
    const apiKeyPromises = Array.from({ length: counts.apiKeys }, () =>
      generateTestApiKey(userId)
    );
    results.apiKeys = await Promise.all(apiKeyPromises);
  }

  // Generate audit logs
  if (counts.auditLogs) {
    const auditLogPromises = Array.from({ length: counts.auditLogs }, () =>
      generateTestAuditLog(userId)
    );
    results.auditLogs = await Promise.all(auditLogPromises);
  }

  return results;
}

/**
 * Market Data Generator
 */
export function generateMarketData(symbol: string = 'BTC') {
  return {
    symbol,
    price: faker.number.float({ min: 1000, max: 100000, fractionDigits: 2 }),
    change24h: faker.number.float({ min: -10, max: 10, fractionDigits: 2 }),
    volume24h: faker.number.float({ min: 1000000, max: 10000000000, fractionDigits: 0 }),
    marketCap: faker.number.float({ min: 1000000000, max: 1000000000000, fractionDigits: 0 }),
    lastUpdated: new Date()
  };
}

/**
 * Test Data Factories
 */
export const TestDataFactories = {
  user: (overrides: Partial<TestUserOptions> = {}) => ({
    email: faker.internet.email(),
    password: 'TestPassword123!',
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: 'BASIC' as const,
    isEmailVerified: true,
    twoFactorEnabled: false,
    ...overrides
  }),

  portfolio: (overrides: Partial<TestPortfolioOptions> = {}) => ({
    name: faker.company.name() + ' Portfolio',
    description: faker.lorem.sentence(),
    type: 'MANUAL' as const,
    isDefault: false,
    isActive: true,
    ...overrides
  }),

  transaction: (overrides: Partial<TestTransactionOptions> = {}) => ({
    type: 'BUY' as const,
    symbol: 'BTC',
    quantity: faker.number.float({ min: 0.01, max: 10, fractionDigits: 8 }),
    price: faker.number.float({ min: 1000, max: 100000, fractionDigits: 2 }),
    fee: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
    executedAt: faker.date.recent({ days: 30 }),
    ...overrides
  })
};

/**
 * Database Cleanup Utilities
 */
export async function cleanupTestData(): Promise<void> {
  try {
    // Delete in correct order to avoid foreign key constraints
    await prisma.auditLog.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.apiKey.deleteMany({});
    await prisma.portfolio.deleteMany({});
    await prisma.user.deleteMany({});
    
    console.log('Test data cleanup completed');
  } catch (error) {
    console.error('Error during test data cleanup:', error);
    throw error;
  }
}

export async function cleanupTestUser(userId: string): Promise<void> {
  try {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ 
      where: { portfolio: { userId } }
    });
    await prisma.apiKey.deleteMany({ where: { userId } });
    await prisma.portfolio.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    
    console.log(`Test user ${userId} cleanup completed`);
  } catch (error) {
    console.error(`Error during test user ${userId} cleanup:`, error);
    throw error;
  }
}

/**
 * Test Utilities
 */
export const TestUtils = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random test data
   */
  randomString: (length: number = 10): string =>
    faker.string.alphanumeric(length),

  /**
   * Generate random email
   */
  randomEmail: (): string =>
    faker.internet.email(),

  /**
   * Generate random UUID
   */
  randomUuid: (): string =>
    faker.string.uuid(),

  /**
   * Generate random future date
   */
  futureDate: (days: number = 30): Date =>
    faker.date.future({ years: 1 }),

  /**
   * Generate random past date
   */
  pastDate: (days: number = 30): Date =>
    faker.date.recent({ days }),

  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

  /**
   * Validate UUID format
   */
  isValidUuid: (uuid: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),

  /**
   * Generate realistic crypto symbols
   */
  cryptoSymbols: (): string[] =>
    ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI', 'AVAX', 'SOL', 'MATIC', 'ATOM'],

  /**
   * Generate realistic exchange IDs
   */
  exchangeIds: (): string[] =>
    ['binance', 'coinbase', 'kraken', 'kucoin', 'huobi', 'bitfinex', 'gemini'],

  /**
   * Generate test performance metrics
   */
  performanceMetrics: () => ({
    totalReturn: faker.number.float({ min: -10000, max: 50000, fractionDigits: 2 }),
    totalReturnPercentage: faker.number.float({ min: -50, max: 200, fractionDigits: 2 }),
    dayChange: faker.number.float({ min: -1000, max: 1000, fractionDigits: 2 }),
    dayChangePercentage: faker.number.float({ min: -10, max: 10, fractionDigits: 2 }),
    weekChange: faker.number.float({ min: -5000, max: 5000, fractionDigits: 2 }),
    monthChange: faker.number.float({ min: -10000, max: 10000, fractionDigits: 2 }),
    yearChange: faker.number.float({ min: -20000, max: 100000, fractionDigits: 2 })
  })
};

/**
 * Test Database Utilities
 */
export const TestDatabaseUtils = {
  /**
   * Count records in a table
   */
  countRecords: async (table: string): Promise<number> => {
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ${table}`;
    return Number((result as any)[0].count);
  },

  /**
   * Verify foreign key relationships
   */
  verifyRelationships: async (userId: string): Promise<boolean> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        portfolios: {
          include: {
            transactions: true
          }
        },
        apiKeys: true,
        auditLogs: true,
        sessions: true
      }
    });

    return user !== null;
  },

  /**
   * Reset auto-increment sequences
   */
  resetSequences: async (): Promise<void> => {
    // This would be database-specific
    // For PostgreSQL:
    await prisma.$executeRaw`ALTER SEQUENCE users_id_seq RESTART WITH 1`;
  }
};

export default {
  createTestApp,
  generateTestUser,
  generateTestPortfolio,
  generateTestTransaction,
  generateTestApiKey,
  generateTestAuditLog,
  generateTestSession,
  generateBulkTestData,
  generateMarketData,
  TestDataFactories,
  cleanupTestData,
  cleanupTestUser,
  TestUtils,
  TestDatabaseUtils
};