import { z } from 'zod';
import { logger } from './logger';

// Environment validation schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(65535)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Encryption
  ENCRYPTION_KEY: z.string().length(32, 'ENCRYPTION_KEY must be exactly 32 characters long'),
  API_ENCRYPTION_ALGORITHM: z.enum(['aes-256-gcm', 'aes-256-cbc']).default('aes-256-gcm'),
  
  // Server
  PORT: z.string().transform(val => parseInt(val)).pipe(z.number().min(1000).max(65535)).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // External APIs
  COINGECKO_API_KEY: z.string().optional(),
  COINMARKETCAP_API_KEY: z.string().optional(),
  
  // Email (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(65535)).optional(),
  SMTP_SECURE: z.string().transform(val => val === 'true').optional(),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  
  // AWS (Optional)
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  
  // OAuth (Optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(val => parseInt(val)).pipe(z.number().min(1000)).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(val => parseInt(val)).pipe(z.number().min(1)).default('100'),
  
  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),
  SESSION_MAX_AGE: z.string().transform(val => parseInt(val)).pipe(z.number().min(3600000)).default('86400000'),
  
  // WebSocket
  WS_PORT: z.string().transform(val => parseInt(val)).pipe(z.number().min(1000).max(65535)).default('3002'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/app.log'),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(val => parseInt(val)).pipe(z.number().min(8).max(15)).default('12'),
  MAX_LOGIN_ATTEMPTS: z.string().transform(val => parseInt(val)).pipe(z.number().min(3).max(10)).default('5'),
  ACCOUNT_LOCK_TIME: z.string().transform(val => parseInt(val)).pipe(z.number().min(60000)).default('300000'),
  
  // Features
  ENABLE_2FA: z.string().transform(val => val === 'true').default('true'),
  ENABLE_EMAIL_VERIFICATION: z.string().transform(val => val === 'true').default('true'),
  ENABLE_PASSWORD_RESET: z.string().transform(val => val === 'true').default('true'),
  ENABLE_AUDIT_LOGS: z.string().transform(val => val === 'true').default('true'),
  
  // Background Jobs
  ENABLE_PRICE_UPDATES: z.string().transform(val => val === 'true').default('true'),
  PRICE_UPDATE_INTERVAL: z.string().transform(val => parseInt(val)).pipe(z.number().min(60000)).default('300000'),
  ENABLE_PORTFOLIO_SNAPSHOTS: z.string().transform(val => val === 'true').default('true'),
  SNAPSHOT_INTERVAL: z.string().transform(val => parseInt(val)).pipe(z.number().min(600000)).default('3600000'),
  
  // Admin
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let validatedEnv: EnvConfig;

export const validateEnvironment = (): EnvConfig => {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    logger.info('Environment variables validated successfully');
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Environment validation failed:');
      error.errors.forEach(err => {
        logger.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      
      // Log missing required variables
      const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET', 
        'ENCRYPTION_KEY',
        'SESSION_SECRET'
      ];
      
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        logger.error('Missing required environment variables:');
        missingVars.forEach(varName => {
          logger.error(`  ${varName}`);
        });
      }
    }
    
    throw new Error('Environment validation failed. Check your .env file.');
  }
};

export const getEnvConfig = (): EnvConfig => {
  if (!validatedEnv) {
    return validateEnvironment();
  }
  return validatedEnv;
};

// Helper functions for common config access
export const isDevelopment = (): boolean => {
  return getEnvConfig().NODE_ENV === 'development';
};

export const isProduction = (): boolean => {
  return getEnvConfig().NODE_ENV === 'production';
};

export const isTest = (): boolean => {
  return getEnvConfig().NODE_ENV === 'test';
};

// Database configuration
export const getDatabaseConfig = () => {
  const config = getEnvConfig();
  return {
    url: config.DATABASE_URL,
  };
};

// Redis configuration
export const getRedisConfig = () => {
  const config = getEnvConfig();
  return {
    url: config.REDIS_URL,
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
  };
};

// JWT configuration
export const getJWTConfig = () => {
  const config = getEnvConfig();
  return {
    secret: config.JWT_SECRET,
    expiresIn: config.JWT_EXPIRES_IN,
    refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
  };
};

// Encryption configuration
export const getEncryptionConfig = () => {
  const config = getEnvConfig();
  return {
    key: config.ENCRYPTION_KEY,
    algorithm: config.API_ENCRYPTION_ALGORITHM,
  };
};

// Rate limiting configuration
export const getRateLimitConfig = () => {
  const config = getEnvConfig();
  return {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  };
};

// External API configuration
export const getExternalAPIConfig = () => {
  const config = getEnvConfig();
  return {
    coingecko: {
      apiKey: config.COINGECKO_API_KEY,
    },
    coinmarketcap: {
      apiKey: config.COINMARKETCAP_API_KEY,
    },
  };
};

// Feature flags
export const getFeatureFlags = () => {
  const config = getEnvConfig();
  return {
    enable2FA: config.ENABLE_2FA,
    enableEmailVerification: config.ENABLE_EMAIL_VERIFICATION,
    enablePasswordReset: config.ENABLE_PASSWORD_RESET,
    enableAuditLogs: config.ENABLE_AUDIT_LOGS,
    enablePriceUpdates: config.ENABLE_PRICE_UPDATES,
    enablePortfolioSnapshots: config.ENABLE_PORTFOLIO_SNAPSHOTS,
  };
};

// Background job configuration
export const getBackgroundJobConfig = () => {
  const config = getEnvConfig();
  return {
    priceUpdateInterval: config.PRICE_UPDATE_INTERVAL,
    snapshotInterval: config.SNAPSHOT_INTERVAL,
  };
};

// Validate environment on module load
if (process.env.NODE_ENV !== 'test') {
  validateEnvironment();
}