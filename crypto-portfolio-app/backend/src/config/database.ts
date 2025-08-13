import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient;

export const createPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'minimal',
    });

    // Log database queries in development
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e) => {
        logger.debug('Database Query:', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      });
    }

    // Log database errors
    prisma.$on('error', (e) => {
      logger.error('Database Error:', e);
    });

    // Log database info
    prisma.$on('info', (e) => {
      logger.info('Database Info:', e.message);
    });

    // Log database warnings
    prisma.$on('warn', (e) => {
      logger.warn('Database Warning:', e.message);
    });
  }

  return prisma;
};

export const connectToDatabase = async (): Promise<void> => {
  try {
    const client = createPrismaClient();
    await client.$connect();
    logger.info('Successfully connected to database');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

export const disconnectFromDatabase = async (): Promise<void> => {
  try {
    if (prisma) {
      await prisma.$disconnect();
      logger.info('Disconnected from database');
    }
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
};

// Health check function
export const checkDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}> => {
  try {
    const client = createPrismaClient();
    const start = Date.now();
    
    // Simple query to test connection
    await client.$queryRaw`SELECT 1`;
    
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export { prisma };
export default createPrismaClient;