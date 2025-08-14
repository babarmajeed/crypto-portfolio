import { User } from '@prisma/client';
import { prisma } from '../../config/database';
import bcrypt from 'bcrypt';

export interface TestUserData {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  role?: 'USER' | 'ADMIN' | 'MODERATOR';
  isEmailVerified?: boolean;
}

export async function createTestUser(userData: TestUserData): Promise<User> {
  const {
    email,
    firstName,
    lastName,
    password = 'test123456',
    role = 'USER',
    isEmailVerified = true
  } = userData;

  const hashedPassword = await bcrypt.hash(password, 10);

  return await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      password: hashedPassword,
      role,
      isEmailVerified
    }
  });
}

export async function createTestPortfolio(userId: string, portfolioData?: Partial<any>) {
  return await prisma.portfolio.create({
    data: {
      name: portfolioData?.name || 'Test Portfolio',
      description: portfolioData?.description || 'Test portfolio description',
      userId,
      isPublic: portfolioData?.isPublic || false,
      totalValue: portfolioData?.totalValue || 0,
      totalChange24h: portfolioData?.totalChange24h || 0,
      totalChangePercent24h: portfolioData?.totalChangePercent24h || 0
    }
  });
}

export async function createTestTransaction(portfolioId: string, transactionData?: Partial<any>) {
  return await prisma.transaction.create({
    data: {
      portfolioId,
      symbol: transactionData?.symbol || 'BTC',
      type: transactionData?.type || 'BUY',
      amount: transactionData?.amount || 1.0,
      price: transactionData?.price || 50000.0,
      fee: transactionData?.fee || 25.0,
      exchangeId: transactionData?.exchangeId || 'test-exchange',
      notes: transactionData?.notes || 'Test transaction',
      timestamp: transactionData?.timestamp || new Date()
    }
  });
}

export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@test.com`;
}

export async function cleanupTestUser(userId: string): Promise<void> {
  // Delete in proper order to avoid foreign key constraints
  await prisma.transaction.deleteMany({
    where: { portfolio: { userId } }
  });
  
  await prisma.portfolio.deleteMany({
    where: { userId }
  });
  
  await prisma.user.delete({
    where: { id: userId }
  });
}

export async function setupTestDatabase(): Promise<void> {
  // Clear test data if needed
  await prisma.transaction.deleteMany({
    where: { portfolio: { user: { email: { contains: 'test' } } } }
  });
  
  await prisma.portfolio.deleteMany({
    where: { user: { email: { contains: 'test' } } }
  });
  
  await prisma.user.deleteMany({
    where: { email: { contains: 'test' } }
  });
}

export async function teardownTestDatabase(): Promise<void> {
  await setupTestDatabase(); // Same cleanup
  await prisma.$disconnect();
}