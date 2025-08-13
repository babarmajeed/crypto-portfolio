import { UserRole } from '@prisma/client';
import { 
  UserTierConfig, 
  ExchangeRateLimitConfig, 
  EndpointRateLimitConfig,
  AlertThreshold,
  InternalServiceConfig
} from '../types/rateLimit.types';

// User tier-based rate limiting configuration
export const USER_TIER_LIMITS: UserTierConfig = {
  [UserRole.ADMIN]: {
    requests: 10000,
    windowMs: 60 * 1000, // 1 minute
    blockDuration: 0, // No blocking for admins
  },
  [UserRole.PREMIUM]: {
    requests: 1000,
    windowMs: 60 * 1000, // 1 minute
    blockDuration: 60 * 1000, // 1 minute block
  },
  [UserRole.BASIC]: {
    requests: 200,
    windowMs: 60 * 1000, // 1 minute
    blockDuration: 300 * 1000, // 5 minute block
  },
  ANONYMOUS: {
    requests: 100,
    windowMs: 60 * 1000, // 1 minute
    blockDuration: 600 * 1000, // 10 minute block
  },
  INTERNAL: {
    requests: 50000,
    windowMs: 60 * 1000, // 1 minute
    blockDuration: 0, // No blocking for internal services
  },
};

// Hourly limits
export const HOURLY_LIMITS: UserTierConfig = {
  [UserRole.ADMIN]: {
    requests: 500000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  [UserRole.PREMIUM]: {
    requests: 20000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  [UserRole.BASIC]: {
    requests: 5000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  ANONYMOUS: {
    requests: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  INTERNAL: {
    requests: 1000000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
};

// Daily limits
export const DAILY_LIMITS: UserTierConfig = {
  [UserRole.ADMIN]: {
    requests: 5000000,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  [UserRole.PREMIUM]: {
    requests: 200000,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  [UserRole.BASIC]: {
    requests: 50000,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  ANONYMOUS: {
    requests: 10000,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  INTERNAL: {
    requests: 10000000,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// Exchange-specific rate limiting configurations
export const EXCHANGE_RATE_LIMITS: Record<string, ExchangeRateLimitConfig> = {
  binance: {
    name: 'Binance',
    limits: {
      requests: 1200,
      window: 60 * 1000, // 1 minute
      weight: 1200, // Weight-based limiting
      priority: 1,
    },
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      maxBackoffMs: 30000,
      jitter: true,
    },
  },
  coinbase: {
    name: 'Coinbase Pro',
    limits: {
      requests: 10000,
      window: 60 * 60 * 1000, // 1 hour
      priority: 2,
    },
    retry: {
      maxRetries: 3,
      backoffMultiplier: 1.5,
      maxBackoffMs: 20000,
      jitter: true,
    },
  },
  kraken: {
    name: 'Kraken',
    limits: {
      requests: 60,
      window: 60 * 1000, // 1 minute
      priority: 3,
    },
    retry: {
      maxRetries: 5,
      backoffMultiplier: 2,
      maxBackoffMs: 60000,
      jitter: true,
    },
  },
  kucoin: {
    name: 'KuCoin',
    limits: {
      requests: 1800,
      window: 60 * 1000, // 1 minute
      priority: 2,
    },
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      maxBackoffMs: 30000,
      jitter: false,
    },
  },
};

// Endpoint-specific rate limiting
export const ENDPOINT_RATE_LIMITS: EndpointRateLimitConfig[] = [
  {
    path: '/api/v1/auth/login',
    method: 'POST',
    config: {
      requests: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDuration: 15 * 60 * 1000, // 15 minutes
    },
  },
  {
    path: '/api/v1/auth/register',
    method: 'POST',
    config: {
      requests: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDuration: 60 * 60 * 1000, // 1 hour
    },
  },
  {
    path: '/api/v1/auth/forgot-password',
    method: 'POST',
    config: {
      requests: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDuration: 60 * 60 * 1000, // 1 hour
    },
  },
  {
    path: '/api/v1/auth/verify-2fa',
    method: 'POST',
    config: {
      requests: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDuration: 15 * 60 * 1000, // 15 minutes
    },
  },
  {
    path: '/api/v1/portfolios',
    method: 'POST',
    config: {
      requests: 50,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    tierMultipliers: {
      [UserRole.ADMIN]: 10,
      [UserRole.PREMIUM]: 5,
      [UserRole.BASIC]: 1,
      ANONYMOUS: 0.1,
    },
  },
  {
    path: '/api/v1/transactions',
    method: 'POST',
    config: {
      requests: 100,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    tierMultipliers: {
      [UserRole.ADMIN]: 10,
      [UserRole.PREMIUM]: 3,
      [UserRole.BASIC]: 1,
      ANONYMOUS: 0,
    },
  },
  {
    path: '/api/v1/prices/*',
    method: 'GET',
    config: {
      requests: 500,
      windowMs: 60 * 1000, // 1 minute
    },
    tierMultipliers: {
      [UserRole.ADMIN]: 20,
      [UserRole.PREMIUM]: 5,
      [UserRole.BASIC]: 1,
      ANONYMOUS: 0.2,
    },
  },
];

// Alert thresholds for monitoring
export const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    name: 'High Block Rate',
    metric: 'blocked_requests',
    threshold: 50, // 50% blocked requests
    window: 300, // 5 minutes
    enabled: true,
  },
  {
    name: 'Unusual High Usage',
    metric: 'high_usage',
    threshold: 1000, // 1000 requests per minute
    window: 60, // 1 minute
    enabled: true,
  },
  {
    name: 'Rate Limit Error Rate',
    metric: 'error_rate',
    threshold: 25, // 25% error rate
    window: 300, // 5 minutes
    enabled: true,
  },
];

// Internal service configurations
export const INTERNAL_SERVICES: InternalServiceConfig[] = [
  {
    serviceName: 'portfolio-sync',
    apiKey: process.env.INTERNAL_PORTFOLIO_API_KEY || '',
    limits: {
      requests: 10000,
      windowMs: 60 * 1000, // 1 minute
    },
    bypassRateLimit: true,
  },
  {
    serviceName: 'price-updater',
    apiKey: process.env.INTERNAL_PRICE_API_KEY || '',
    limits: {
      requests: 5000,
      windowMs: 60 * 1000, // 1 minute
    },
    bypassRateLimit: true,
  },
  {
    serviceName: 'data-sync',
    apiKey: process.env.INTERNAL_DATA_SYNC_API_KEY || '',
    limits: {
      requests: 2000,
      windowMs: 60 * 1000, // 1 minute
    },
    bypassRateLimit: false,
  },
];

// Configuration for automatic blacklisting
export const BLACKLIST_CONFIG = {
  enabled: true,
  thresholds: {
    requestsPerMinute: 2000, // Auto-blacklist after 2000 requests/min
    consecutiveBlocks: 10, // Auto-blacklist after 10 consecutive blocks
    errorRate: 90, // Auto-blacklist if 90% of requests result in errors
  },
  durations: {
    light: 15 * 60 * 1000, // 15 minutes
    medium: 60 * 60 * 1000, // 1 hour
    heavy: 24 * 60 * 60 * 1000, // 24 hours
  },
  whitelist: [
    '127.0.0.1',
    '::1',
    'localhost',
    ...(process.env.RATE_LIMIT_WHITELIST?.split(',') || []),
  ],
};

// Redis key prefixes
export const REDIS_KEYS = {
  RATE_LIMIT: 'rate_limit',
  BLACKLIST: 'blacklist',
  EXCHANGE_QUEUE: 'exchange_queue',
  MONITORING: 'rate_limit_monitoring',
  ALERTS: 'rate_limit_alerts',
  ANALYTICS: 'rate_limit_analytics',
};

// Default configuration
export const DEFAULT_CONFIG = {
  strategy: 'sliding-window' as const,
  keyPrefix: 'rl',
  enableMonitoring: true,
  enableBlacklist: true,
  gracefulMode: true,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  monitoringRetention: 24 * 60 * 60 * 1000, // 24 hours
  alertRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
};