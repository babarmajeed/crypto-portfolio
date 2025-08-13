import { logger } from '../utils/logger';
import { EmailService } from './emailService';
import { SMSService } from './smsService';
import { PushNotificationService } from './pushNotificationService';
import { TemplateService } from './templateService';
import { PrismaService } from './prismaService';
import { QueueService } from '../queues';
import {
  NotificationType,
  NotificationChannel,
  NotificationPreference,
  NotificationJob,
  JobPriority,
  EmailOptions,
  SMSOptions,
  PushNotificationOptions
} from '../types/notification.types';

export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;
  private pushService: PushNotificationService;
  private templateService: TemplateService;
  private prisma: PrismaService;
  private queueService: QueueService;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.pushService = new PushNotificationService();
    this.templateService = new TemplateService();
    this.prisma = new PrismaService();
    this.queueService = QueueService.getInstance();
  }

  async sendNotification(
    userId: string,
    type: NotificationType,
    data: any,
    channels?: NotificationChannel[]
  ): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(userId);
      
      if (!preferences) {
        logger.warn(`No notification preferences found for user ${userId}`);
        return;
      }

      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true
        }
      });

      if (!user) {
        logger.error(`User not found: ${userId}`);
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences)) {
        logger.info(`Notification delayed due to quiet hours for user ${userId}`);
        await this.scheduleNotification(userId, type, data, channels);
        return;
      }

      // Determine channels to use
      const activeChannels = channels || this.getActiveChannels(type, preferences);

      // Send through each channel
      for (const channel of activeChannels) {
        await this.sendThroughChannel(channel, user, type, data, preferences);
      }
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  private async sendThroughChannel(
    channel: NotificationChannel,
    user: any,
    type: NotificationType,
    data: any,
    preferences: NotificationPreference
  ): Promise<void> {
    try {
      switch (channel) {
        case NotificationChannel.EMAIL:
          if (preferences.email.enabled && user.email) {
            await this.sendEmailNotification(user, type, data);
          }
          break;

        case NotificationChannel.SMS:
          if (preferences.sms.enabled && user.phoneNumber) {
            await this.sendSMSNotification(user, type, data);
          }
          break;

        case NotificationChannel.PUSH:
          if (preferences.push.enabled) {
            await this.sendPushNotification(user.id, type, data);
          }
          break;

        case NotificationChannel.IN_APP:
          await this.createInAppNotification(user.id, type, data);
          break;

        default:
          logger.warn(`Unsupported notification channel: ${channel}`);
      }
    } catch (error) {
      logger.error(`Failed to send notification through ${channel}:`, error);
      // Don't throw - allow other channels to proceed
    }
  }

  private async sendEmailNotification(user: any, type: NotificationType, data: any): Promise<void> {
    const template = this.getEmailTemplate(type);
    const subject = this.getEmailSubject(type, data);
    
    const emailData = {
      ...data,
      firstName: user.firstName,
      lastName: user.lastName,
      appName: process.env.APP_NAME || 'Crypto Portfolio Tracker',
      appUrl: process.env.APP_URL || 'https://cryptoportfolio.app',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@cryptoportfolio.app',
      year: new Date().getFullYear()
    };

    const html = await this.templateService.render(template, emailData);

    const emailOptions: EmailOptions = {
      to: user.email,
      subject,
      template,
      html,
      data: emailData
    };

    await this.emailService.queueEmail(emailOptions);
  }

  private async sendSMSNotification(user: any, type: NotificationType, data: any): Promise<void> {
    const message = this.getSMSMessage(type, data);
    
    const smsOptions: SMSOptions = {
      to: user.phoneNumber,
      body: message
    };

    await this.smsService.queueSMS(smsOptions);
  }

  private async sendPushNotification(userId: string, type: NotificationType, data: any): Promise<void> {
    const { title, body } = this.getPushContent(type, data);
    
    const pushOptions: PushNotificationOptions = {
      title,
      body,
      data: {
        type,
        ...data
      },
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    };

    await this.pushService.sendToUser(userId, pushOptions);
  }

  private async createInAppNotification(userId: string, type: NotificationType, data: any): Promise<void> {
    const { title, body } = this.getPushContent(type, data);
    
    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message: body,
        data,
        read: false
      }
    });

    // Emit through WebSocket for real-time update
    // This would integrate with your WebSocket server
    // this.websocketService.emitToUser(userId, 'notification', { type, title, body, data });
  }

  async sendBulkNotification(
    userIds: string[],
    type: NotificationType,
    data: any,
    channels?: NotificationChannel[]
  ): Promise<void> {
    const chunks = this.chunkArray(userIds, 100);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(userId => 
          this.queueNotification(userId, type, data, channels, JobPriority.MEDIUM)
        )
      );
    }
  }

  async queueNotification(
    userId: string,
    type: NotificationType,
    data: any,
    channels?: NotificationChannel[],
    priority: JobPriority = JobPriority.MEDIUM
  ): Promise<void> {
    const job: NotificationJob = {
      type,
      userId,
      channel: NotificationChannel.EMAIL, // Default, will be determined later
      data,
      priority
    };

    await this.queueService.addJob('notification', job, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }

  async scheduleNotification(
    userId: string,
    type: NotificationType,
    data: any,
    channels?: NotificationChannel[],
    scheduledFor?: Date
  ): Promise<void> {
    const delay = scheduledFor ? scheduledFor.getTime() - Date.now() : this.getQuietHoursDelay(userId);
    
    await this.queueNotification(userId, type, data, channels, JobPriority.LOW);
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference | null> {
    return await this.prisma.notificationPreference.findUnique({
      where: { userId }
    });
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreference>
  ): Promise<NotificationPreference> {
    return await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...this.getDefaultPreferences(),
        ...preferences
      }
    });
  }

  private getDefaultPreferences(): Partial<NotificationPreference> {
    return {
      email: {
        enabled: true,
        priceAlerts: true,
        portfolioSummary: true,
        transactionConfirmations: true,
        securityAlerts: true,
        marketing: false,
        frequency: 'IMMEDIATE' as any
      },
      push: {
        enabled: true,
        priceAlerts: true,
        portfolioUpdates: true,
        transactionAlerts: true,
        securityAlerts: true
      },
      sms: {
        enabled: false,
        criticalAlerts: true,
        priceAlerts: false,
        securityAlerts: true
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC'
      }
    };
  }

  private getActiveChannels(type: NotificationType, preferences: NotificationPreference): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    // Determine channels based on notification type and preferences
    switch (type) {
      case NotificationType.SECURITY_ALERT:
      case NotificationType.ACCOUNT_LOCKED:
      case NotificationType.TWO_FACTOR_CODE:
        // Critical notifications - use all available channels
        if (preferences.email.enabled) channels.push(NotificationChannel.EMAIL);
        if (preferences.sms.enabled && preferences.sms.criticalAlerts) channels.push(NotificationChannel.SMS);
        if (preferences.push.enabled) channels.push(NotificationChannel.PUSH);
        break;

      case NotificationType.PRICE_ALERT:
        if (preferences.email.enabled && preferences.email.priceAlerts) channels.push(NotificationChannel.EMAIL);
        if (preferences.push.enabled && preferences.push.priceAlerts) channels.push(NotificationChannel.PUSH);
        if (preferences.sms.enabled && preferences.sms.priceAlerts) channels.push(NotificationChannel.SMS);
        break;

      case NotificationType.TRANSACTION_CONFIRMATION:
        if (preferences.email.enabled && preferences.email.transactionConfirmations) channels.push(NotificationChannel.EMAIL);
        if (preferences.push.enabled && preferences.push.transactionAlerts) channels.push(NotificationChannel.PUSH);
        break;

      case NotificationType.PORTFOLIO_SUMMARY:
        if (preferences.email.enabled && preferences.email.portfolioSummary) channels.push(NotificationChannel.EMAIL);
        break;

      default:
        if (preferences.email.enabled) channels.push(NotificationChannel.EMAIL);
    }

    // Always add in-app notifications
    channels.push(NotificationChannel.IN_APP);

    return channels;
  }

  private getEmailTemplate(type: NotificationType): string {
    const templates: Record<NotificationType, string> = {
      [NotificationType.WELCOME]: 'welcome',
      [NotificationType.EMAIL_VERIFICATION]: 'emailVerification',
      [NotificationType.PASSWORD_RESET]: 'passwordReset',
      [NotificationType.PRICE_ALERT]: 'priceAlert',
      [NotificationType.PORTFOLIO_SUMMARY]: 'portfolioSummary',
      [NotificationType.TRANSACTION_CONFIRMATION]: 'transactionConfirmation',
      [NotificationType.SECURITY_ALERT]: 'securityAlert',
      [NotificationType.REBALANCING_SUGGESTION]: 'rebalancingSuggestion',
      [NotificationType.TWO_FACTOR_CODE]: 'twoFactorCode',
      [NotificationType.ACCOUNT_LOCKED]: 'accountLocked'
    };

    return templates[type] || 'default';
  }

  private getEmailSubject(type: NotificationType, data: any): string {
    const subjects: Record<NotificationType, string> = {
      [NotificationType.WELCOME]: 'Welcome to Crypto Portfolio Tracker!',
      [NotificationType.EMAIL_VERIFICATION]: 'Verify Your Email Address',
      [NotificationType.PASSWORD_RESET]: 'Reset Your Password',
      [NotificationType.PRICE_ALERT]: `Price Alert: ${data.symbol} ${data.direction === 'up' ? '📈' : '📉'}`,
      [NotificationType.PORTFOLIO_SUMMARY]: 'Your Portfolio Summary',
      [NotificationType.TRANSACTION_CONFIRMATION]: 'Transaction Confirmed',
      [NotificationType.SECURITY_ALERT]: '⚠️ Security Alert',
      [NotificationType.REBALANCING_SUGGESTION]: 'Portfolio Rebalancing Opportunity',
      [NotificationType.TWO_FACTOR_CODE]: 'Your Two-Factor Authentication Code',
      [NotificationType.ACCOUNT_LOCKED]: '🔒 Account Locked'
    };

    return subjects[type] || 'Notification from Crypto Portfolio Tracker';
  }

  private getSMSMessage(type: NotificationType, data: any): string {
    switch (type) {
      case NotificationType.TWO_FACTOR_CODE:
        return `Your verification code is: ${data.code}. Valid for 5 minutes.`;
      case NotificationType.PRICE_ALERT:
        return `${data.symbol} price alert: ${data.price} (${data.changePercent}%)`;
      case NotificationType.SECURITY_ALERT:
        return `Security alert: ${data.message}. Check your account immediately.`;
      default:
        return `You have a new notification. Check your app for details.`;
    }
  }

  private getPushContent(type: NotificationType, data: any): { title: string; body: string } {
    const content: Record<NotificationType, { title: string; body: string }> = {
      [NotificationType.WELCOME]: {
        title: 'Welcome! 🎉',
        body: 'Your account is ready. Start tracking your crypto portfolio!'
      },
      [NotificationType.EMAIL_VERIFICATION]: {
        title: 'Verify Your Email',
        body: 'Please verify your email to activate your account'
      },
      [NotificationType.PASSWORD_RESET]: {
        title: 'Password Reset Request',
        body: 'Click here to reset your password'
      },
      [NotificationType.PRICE_ALERT]: {
        title: `${data.symbol} Price Alert ${data.direction === 'up' ? '📈' : '📉'}`,
        body: `${data.symbol} is now ${data.price} (${data.changePercent}%)`
      },
      [NotificationType.PORTFOLIO_SUMMARY]: {
        title: 'Portfolio Update 📊',
        body: `Your portfolio value: ${data.totalValue} (${data.changePercent}%)`
      },
      [NotificationType.TRANSACTION_CONFIRMATION]: {
        title: 'Transaction Confirmed ✅',
        body: `${data.type} ${data.amount} ${data.symbol} completed`
      },
      [NotificationType.SECURITY_ALERT]: {
        title: 'Security Alert ⚠️',
        body: data.message
      },
      [NotificationType.REBALANCING_SUGGESTION]: {
        title: 'Rebalancing Opportunity 🔄',
        body: 'Your portfolio could benefit from rebalancing'
      },
      [NotificationType.TWO_FACTOR_CODE]: {
        title: 'Verification Code',
        body: `Your code: ${data.code}`
      },
      [NotificationType.ACCOUNT_LOCKED]: {
        title: 'Account Locked 🔒',
        body: 'Your account has been locked for security reasons'
      }
    };

    return content[type] || { title: 'Notification', body: 'You have a new notification' };
  }

  private isInQuietHours(preferences: NotificationPreference): boolean {
    if (!preferences.quietHours.enabled) return false;

    const now = new Date();
    const timezone = preferences.quietHours.timezone;
    
    // Convert to user's timezone
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = preferences.quietHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = preferences.quietHours.endTime.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  private async getQuietHoursDelay(userId: string): Promise<number> {
    const preferences = await this.getUserPreferences(userId);
    if (!preferences || !preferences.quietHours.enabled) return 0;

    const now = new Date();
    const [endHour, endMinute] = preferences.quietHours.endTime.split(':').map(Number);
    
    const endDate = new Date(now);
    endDate.setHours(endHour, endMinute, 0, 0);
    
    if (endDate <= now) {
      endDate.setDate(endDate.getDate() + 1);
    }

    return endDate.getTime() - now.getTime();
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}