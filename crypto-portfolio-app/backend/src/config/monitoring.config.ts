import { MonitoringConfig, AlertRule, NotificationChannel, KPIDefinition } from '@/types/monitoring.types';
import { config } from '@/config/config';

export const monitoringConfig: MonitoringConfig = {
  logging: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    transports: {
      console: config.nodeEnv !== 'production',
      file: true,
      elasticsearch: config.nodeEnv === 'production'
    },
    elasticsearch: {
      host: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200',
      index: `crypto-portfolio-logs-${config.nodeEnv}`,
      level: 'info'
    },
    retention: {
      file: '30d',
      elasticsearch: '90d'
    }
  },
  metrics: {
    prometheus: {
      enabled: true,
      port: parseInt(process.env.PROMETHEUS_PORT || '9090'),
      endpoint: '/metrics'
    },
    collection: {
      interval: 15000, // 15 seconds
      retention: '7d'
    }
  },
  healthChecks: {
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    retries: 3,
    enabled: ['database', 'redis', 'external_apis', 'disk_space', 'memory']
  },
  alerts: {
    enabled: true,
    evaluationInterval: '1m',
    defaultChannels: ['email', 'slack'],
    escalationDelay: '5m'
  },
  analytics: {
    enabled: true,
    batchSize: 100,
    flushInterval: 10000, // 10 seconds
    retention: '365d'
  },
  performance: {
    slowQueryThreshold: 1000, // 1 second
    requestTimeoutThreshold: 5000, // 5 seconds
    memoryThreshold: 80, // 80%
    cpuThreshold: 80 // 80%
  }
};

export const defaultAlertRules: AlertRule[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Alert when error rate exceeds 5% over 5 minutes',
    condition: {
      metric: 'http_requests_error_rate',
      operator: '>',
      value: 0.05,
      duration: '5m'
    },
    severity: 'high',
    channels: ['email', 'slack'],
    enabled: true,
    tags: { component: 'api', team: 'backend' }
  },
  {
    id: 'slow-response-time',
    name: 'Slow Response Time',
    description: 'Alert when average response time exceeds 2 seconds',
    condition: {
      metric: 'http_request_duration_avg',
      operator: '>',
      value: 2000,
      duration: '5m'
    },
    severity: 'medium',
    channels: ['slack'],
    enabled: true,
    tags: { component: 'api', team: 'backend' }
  },
  {
    id: 'high-memory-usage',
    name: 'High Memory Usage',
    description: 'Alert when memory usage exceeds 85%',
    condition: {
      metric: 'memory_usage_percent',
      operator: '>',
      value: 85,
      duration: '2m'
    },
    severity: 'critical',
    channels: ['email', 'slack'],
    enabled: true,
    tags: { component: 'system', team: 'devops' }
  },
  {
    id: 'database-connection-failure',
    name: 'Database Connection Failure',
    description: 'Alert when database health check fails',
    condition: {
      metric: 'database_health_status',
      operator: '==',
      value: 0
    },
    severity: 'critical',
    channels: ['email', 'slack'],
    enabled: true,
    tags: { component: 'database', team: 'backend' }
  },
  {
    id: 'redis-connection-failure',
    name: 'Redis Connection Failure',
    description: 'Alert when Redis health check fails',
    condition: {
      metric: 'redis_health_status',
      operator: '==',
      value: 0
    },
    severity: 'high',
    channels: ['email', 'slack'],
    enabled: true,
    tags: { component: 'cache', team: 'backend' }
  },
  {
    id: 'disk-space-low',
    name: 'Low Disk Space',
    description: 'Alert when disk usage exceeds 90%',
    condition: {
      metric: 'disk_usage_percent',
      operator: '>',
      value: 90
    },
    severity: 'critical',
    channels: ['email', 'slack'],
    enabled: true,
    tags: { component: 'system', team: 'devops' }
  },
  {
    id: 'failed-login-attempts',
    name: 'High Failed Login Attempts',
    description: 'Alert when failed login attempts exceed 10 per minute',
    condition: {
      metric: 'failed_login_attempts_rate',
      operator: '>',
      value: 10,
      duration: '1m'
    },
    severity: 'medium',
    channels: ['slack'],
    enabled: true,
    tags: { component: 'security', team: 'security' }
  },
  {
    id: 'queue-backlog',
    name: 'Job Queue Backlog',
    description: 'Alert when job queue backlog exceeds 1000 jobs',
    condition: {
      metric: 'job_queue_backlog',
      operator: '>',
      value: 1000
    },
    severity: 'medium',
    channels: ['slack'],
    enabled: true,
    tags: { component: 'jobs', team: 'backend' }
  }
];

export const defaultNotificationChannels: NotificationChannel[] = [
  {
    id: 'email-alerts',
    type: 'email',
    name: 'Email Alerts',
    config: {
      email: {
        recipients: [
          process.env.ALERT_EMAIL_PRIMARY || 'alerts@company.com',
          process.env.ALERT_EMAIL_SECONDARY || 'devops@company.com'
        ],
        subject: '[Crypto Portfolio] {{severity}} Alert: {{ruleName}}'
      }
    },
    enabled: true
  },
  {
    id: 'slack-alerts',
    type: 'slack',
    name: 'Slack Alerts',
    config: {
      slack: {
        webhook: process.env.SLACK_WEBHOOK_URL || '',
        channel: '#alerts',
        username: 'Crypto Portfolio Monitor'
      }
    },
    enabled: !!process.env.SLACK_WEBHOOK_URL
  },
  {
    id: 'webhook-alerts',
    type: 'webhook',
    name: 'Webhook Alerts',
    config: {
      webhook: {
        url: process.env.ALERT_WEBHOOK_URL || '',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN || ''}`
        }
      }
    },
    enabled: !!process.env.ALERT_WEBHOOK_URL
  }
];

export const businessKPIs: KPIDefinition[] = [
  {
    id: 'daily-active-users',
    name: 'Daily Active Users',
    description: 'Number of unique users who logged in today',
    calculation: 'unique_count',
    metric: 'user_login',
    period: 'daily',
    unit: 'users',
    category: 'business'
  },
  {
    id: 'monthly-active-users',
    name: 'Monthly Active Users',
    description: 'Number of unique users who logged in this month',
    calculation: 'unique_count',
    metric: 'user_login',
    period: 'monthly',
    unit: 'users',
    category: 'business'
  },
  {
    id: 'new-portfolios-created',
    name: 'New Portfolios Created',
    description: 'Number of new portfolios created today',
    calculation: 'count',
    metric: 'portfolio_created',
    period: 'daily',
    unit: 'portfolios',
    category: 'product'
  },
  {
    id: 'total-portfolio-value',
    name: 'Total Portfolio Value',
    description: 'Total value of all portfolios in USD',
    calculation: 'sum',
    metric: 'portfolio_value_usd',
    period: 'realtime',
    unit: 'USD',
    category: 'financial'
  },
  {
    id: 'api-requests-per-minute',
    name: 'API Requests Per Minute',
    description: 'Number of API requests per minute',
    calculation: 'count',
    metric: 'api_request',
    period: 'realtime',
    unit: 'requests/min',
    category: 'operational'
  },
  {
    id: 'average-response-time',
    name: 'Average Response Time',
    description: 'Average API response time in milliseconds',
    calculation: 'average',
    metric: 'response_time_ms',
    period: 'realtime',
    unit: 'ms',
    category: 'operational'
  },
  {
    id: 'error-rate',
    name: 'Error Rate',
    description: 'Percentage of requests that resulted in errors',
    calculation: 'percentage',
    metric: 'error_requests',
    period: 'realtime',
    unit: '%',
    category: 'operational'
  },
  {
    id: 'user-retention-rate',
    name: 'User Retention Rate',
    description: '7-day user retention rate',
    calculation: 'percentage',
    metric: 'user_retention_7d',
    period: 'weekly',
    target: 80,
    unit: '%',
    category: 'business'
  },
  {
    id: 'transaction-volume',
    name: 'Transaction Volume',
    description: 'Total value of transactions processed today',
    calculation: 'sum',
    metric: 'transaction_value_usd',
    period: 'daily',
    unit: 'USD',
    category: 'financial'
  },
  {
    id: 'successful-exchanges-sync',
    name: 'Successful Exchange Syncs',
    description: 'Percentage of successful exchange synchronizations',
    calculation: 'percentage',
    metric: 'exchange_sync_success',
    period: 'daily',
    target: 95,
    unit: '%',
    category: 'operational'
  }
];

export const securityThresholds = {
  failedLoginAttempts: {
    warning: 5,
    critical: 10,
    timeWindow: '5m'
  },
  suspiciousActivity: {
    riskScore: 70,
    timeWindow: '1h'
  },
  bruteForceDetection: {
    attempts: 20,
    timeWindow: '10m',
    blockDuration: '1h'
  },
  dataAccessAnomalies: {
    threshold: 3, // standard deviations
    minBaseline: 100 // minimum requests for baseline
  }
};

export const complianceSettings = {
  gdpr: {
    enabled: true,
    dataRetentionPeriod: '7y',
    auditLogRetention: '7y',
    consentTracking: true,
    rightToErasure: true
  },
  pciDss: {
    enabled: true,
    cardDataEncryption: true,
    accessLogging: true,
    vulnerabilityScanning: true
  },
  sox: {
    enabled: false,
    financialReportingControls: true,
    auditTrail: true,
    segregationOfDuties: true
  }
};