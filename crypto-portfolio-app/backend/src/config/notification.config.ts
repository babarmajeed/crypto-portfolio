import { EmailConfig, SMSConfig, PushConfig } from '../types/notification.types';

export const emailConfig: EmailConfig = {
  provider: process.env.EMAIL_PROVIDER as 'sendgrid' | 'ses' | 'smtp' || 'sendgrid',
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    from: process.env.FROM_EMAIL || 'noreply@cryptoportfolio.app',
    replyTo: process.env.REPLY_TO_EMAIL || 'support@cryptoportfolio.app'
  },
  ses: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    from: process.env.FROM_EMAIL || 'noreply@cryptoportfolio.app'
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    from: process.env.FROM_EMAIL || 'noreply@cryptoportfolio.app'
  },
  rateLimit: {
    maxPerSecond: parseInt(process.env.EMAIL_RATE_LIMIT_PER_SECOND || '10'),
    maxPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_PER_MINUTE || '100'),
    maxPerHour: parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR || '1000')
  }
};

export const smsConfig: SMSConfig = {
  provider: process.env.SMS_PROVIDER as 'twilio' | 'aws-sns' || 'twilio',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_PHONE_NUMBER || ''
  },
  sns: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  rateLimit: {
    maxPerMinute: parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE || '10'),
    maxPerHour: parseInt(process.env.SMS_RATE_LIMIT_PER_HOUR || '100')
  }
};

export const pushConfig: PushConfig = {
  vapidKeys: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
  },
  gcm: {
    apiKey: process.env.GCM_API_KEY || ''
  },
  apn: {
    key: process.env.APN_KEY || '',
    keyId: process.env.APN_KEY_ID || '',
    teamId: process.env.APN_TEAM_ID || ''
  },
  ttl: parseInt(process.env.PUSH_TTL || '2419200') // 28 days default
};

export const notificationConfig = {
  email: emailConfig,
  sms: smsConfig,
  push: pushConfig,
  app: {
    name: process.env.APP_NAME || 'Crypto Portfolio Tracker',
    url: process.env.APP_URL || 'https://cryptoportfolio.app',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@cryptoportfolio.app',
    logo: process.env.APP_LOGO || 'https://cryptoportfolio.app/logo.png'
  },
  templates: {
    directory: process.env.TEMPLATE_DIR || 'src/templates/email',
    cache: process.env.NODE_ENV === 'production'
  },
  queues: {
    email: {
      name: 'emailNotification',
      concurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY || '10'),
      retries: parseInt(process.env.EMAIL_QUEUE_RETRIES || '3')
    },
    sms: {
      name: 'smsNotification',
      concurrency: parseInt(process.env.SMS_QUEUE_CONCURRENCY || '5'),
      retries: parseInt(process.env.SMS_QUEUE_RETRIES || '3')
    },
    push: {
      name: 'pushNotification',
      concurrency: parseInt(process.env.PUSH_QUEUE_CONCURRENCY || '20'),
      retries: parseInt(process.env.PUSH_QUEUE_RETRIES || '3')
    }
  },
  compliance: {
    gdpr: {
      enabled: process.env.GDPR_ENABLED === 'true',
      dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '365')
    },
    unsubscribe: {
      enabled: true,
      url: process.env.UNSUBSCRIBE_URL || 'https://cryptoportfolio.app/unsubscribe'
    },
    doubleOptIn: {
      enabled: process.env.DOUBLE_OPT_IN === 'true',
      expirationHours: parseInt(process.env.OPT_IN_EXPIRATION_HOURS || '48')
    }
  }
};

export default notificationConfig;