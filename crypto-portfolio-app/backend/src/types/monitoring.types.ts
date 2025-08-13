export interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  message: string;
  service: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface AnalyticsEvent {
  id: string;
  eventType: 'user_action' | 'business_metric' | 'performance' | 'security';
  category: string;
  action: string;
  label?: string;
  value?: number;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  properties?: Record<string, any>;
  context?: {
    page?: string;
    referrer?: string;
    userAgent?: string;
    ipAddress?: string;
    country?: string;
    device?: string;
  };
}

export interface BusinessMetric {
  name: string;
  value: number;
  timestamp: Date;
  period: 'minute' | 'hour' | 'day' | 'week' | 'month';
  tags?: Record<string, string>;
  description?: string;
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  duration: number;
  message?: string;
  details?: Record<string, any>;
  error?: Error;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  checks: HealthCheckResult[];
  uptime: number;
  version: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'seconds' | 'bytes' | 'count' | 'percent';
  timestamp: Date;
  tags?: Record<string, string>;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
    duration?: string; // e.g., '5m', '1h'
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  enabled: boolean;
  tags?: Record<string, string>;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'firing' | 'resolved' | 'acknowledged';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  metadata?: Record<string, any>;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  name: string;
  config: {
    email?: {
      recipients: string[];
      subject?: string;
    };
    slack?: {
      webhook: string;
      channel: string;
      username?: string;
    };
    webhook?: {
      url: string;
      headers?: Record<string, string>;
    };
    sms?: {
      phoneNumbers: string[];
      provider: string;
    };
  };
  enabled: boolean;
}

export interface DashboardMetric {
  name: string;
  displayName: string;
  value: number;
  change?: {
    value: number;
    percentage: number;
    period: string;
  };
  format: 'number' | 'currency' | 'percentage' | 'bytes' | 'duration';
  category: 'business' | 'performance' | 'security' | 'system';
  timestamp: Date;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  result: 'success' | 'failure' | 'unauthorized';
  reason?: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  compliance?: {
    regulation: string; // 'GDPR', 'PCI-DSS', 'SOX', etc.
    requirement: string;
    dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  };
}

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  calculation: 'sum' | 'average' | 'count' | 'unique_count' | 'percentage' | 'ratio';
  metric: string;
  filters?: Record<string, any>;
  period: 'realtime' | 'daily' | 'weekly' | 'monthly';
  target?: number;
  unit: string;
  category: 'business' | 'product' | 'financial' | 'operational';
}

export interface MonitoringConfig {
  logging: {
    level: string;
    transports: {
      console: boolean;
      file: boolean;
      elasticsearch: boolean;
    };
    elasticsearch?: {
      host: string;
      index: string;
      level: string;
    };
    retention: {
      file: string; // e.g., '30d'
      elasticsearch: string; // e.g., '90d'
    };
  };
  metrics: {
    prometheus: {
      enabled: boolean;
      port: number;
      endpoint: string;
    };
    collection: {
      interval: number;
      retention: string;
    };
  };
  healthChecks: {
    interval: number;
    timeout: number;
    retries: number;
    enabled: string[];
  };
  alerts: {
    enabled: boolean;
    evaluationInterval: string;
    defaultChannels: string[];
    escalationDelay: string;
  };
  analytics: {
    enabled: boolean;
    batchSize: number;
    flushInterval: number;
    retention: string;
  };
  performance: {
    slowQueryThreshold: number;
    requestTimeoutThreshold: number;
    memoryThreshold: number;
    cpuThreshold: number;
  };
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  fingerprint?: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  breadcrumbs?: Array<{
    message: string;
    category: string;
    level: 'info' | 'warning' | 'error';
    timestamp: Date;
    data?: Record<string, any>;
  }>;
}

export interface TrendData {
  metric: string;
  period: string;
  data: Array<{
    timestamp: Date;
    value: number;
  }>;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  forecast?: Array<{
    timestamp: Date;
    value: number;
    confidence: number;
  }>;
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface CustomMetric {
  name: string;
  type: MetricType;
  description: string;
  labels?: string[];
  buckets?: number[]; // for histograms
  percentiles?: number[]; // for summaries
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'password_change' | 
        'permission_change' | 'data_access' | 'suspicious_activity' | 'brute_force';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  location?: {
    country: string;
    city: string;
    coordinates?: [number, number];
  };
  details: Record<string, any>;
  riskScore: number;
  blocked: boolean;
  source: string;
}

export interface ComplianceReport {
  id: string;
  regulation: string;
  period: {
    start: Date;
    end: Date;
  };
  status: 'compliant' | 'non_compliant' | 'partial';
  findings: Array<{
    requirement: string;
    status: 'pass' | 'fail' | 'warning';
    details: string;
    evidence?: string[];
  }>;
  generatedAt: Date;
  generatedBy: string;
  metadata?: Record<string, any>;
}