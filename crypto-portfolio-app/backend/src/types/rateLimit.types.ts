import { UserRole } from '@prisma/client';

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
  blockDuration?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface UserTierConfig {
  [UserRole.ADMIN]: RateLimitConfig;
  [UserRole.PREMIUM]: RateLimitConfig;
  [UserRole.BASIC]: RateLimitConfig;
  ANONYMOUS: RateLimitConfig;
  INTERNAL: RateLimitConfig;
}

export interface ExchangeRateLimitConfig {
  name: string;
  limits: {
    requests: number;
    window: number;
    weight?: number;
    priority?: number;
  };
  retry: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
    jitter: boolean;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  totalRequests: number;
  remainingRequests: number;
  retryAfter?: number;
  resetTime: Date;
  userTier?: string;
}

export interface RateLimitMetrics {
  identifier: string;
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  averageResponseTime: number;
  lastRequest: Date;
  userTier?: string;
  endpoint?: string;
}

export interface ExchangeQueueItem {
  id: string;
  exchangeName: string;
  method: string;
  params: any;
  priority: number;
  timestamp: Date;
  retryCount: number;
  callback: (error: Error | null, result?: any) => void;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-RetryAfter'?: string;
  'X-RateLimit-Tier'?: string;
}

export interface BlacklistEntry {
  identifier: string;
  reason: string;
  expiresAt: Date;
  createdAt: Date;
  requestCount: number;
}

export interface RateLimitMonitoringData {
  timestamp: Date;
  identifier: string;
  endpoint: string;
  method: string;
  userTier?: string;
  blocked: boolean;
  responseTime: number;
  remainingRequests: number;
}

export interface AlertThreshold {
  name: string;
  metric: 'blocked_requests' | 'high_usage' | 'error_rate';
  threshold: number;
  window: number; // seconds
  enabled: boolean;
}

export interface RateLimitAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  data: any;
  resolved: boolean;
}

export interface InternalServiceConfig {
  serviceName: string;
  apiKey: string;
  limits: RateLimitConfig;
  bypassRateLimit: boolean;
}

export interface EndpointRateLimitConfig {
  path: string;
  method: string;
  config: RateLimitConfig;
  tierMultipliers?: {
    [UserRole.ADMIN]: number;
    [UserRole.PREMIUM]: number;
    [UserRole.BASIC]: number;
    ANONYMOUS: number;
  };
}

export interface RateLimitAnalytics {
  period: string;
  totalRequests: number;
  blockedRequests: number;
  uniqueUsers: number;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    blocked: number;
  }>;
  tierBreakdown: {
    [key: string]: {
      requests: number;
      blocked: number;
    };
  };
}

export type RateLimitStrategy = 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';

export interface RateLimiterOptions {
  strategy: RateLimitStrategy;
  redis: any;
  keyPrefix: string;
  enableMonitoring: boolean;
  enableBlacklist: boolean;
  gracefulMode: boolean; // Continue on Redis failure
}