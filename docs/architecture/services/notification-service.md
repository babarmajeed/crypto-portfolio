# Notification Service Architecture

## Overview
Multi-channel notification service supporting email, push notifications, webhooks, and SMS for portfolio alerts, price movements, and system notifications.

## Service Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                             │
│              (Notification Endpoints)                      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Notification Service                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Email     │  │    Push     │  │   Webhook   │        │
│  │  Provider   │  │  Provider   │  │  Provider   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Template   │  │    Alert    │  │  Delivery   │        │
│  │   Engine    │  │   Engine    │  │   Queue     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│          Queue + Database + External Services              │
│         (Kafka + PostgreSQL + SendGrid/FCM)                │
└─────────────────────────────────────────────────────────────┘
```

### Notification Service Implementation

```typescript
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import axios from 'axios';
import { Kafka, Producer, Consumer } from 'kafkajs';
import Handlebars from 'handlebars';

interface NotificationChannel {
  type: 'email' | 'push' | 'webhook' | 'sms';
  enabled: boolean;
  config: Record<string, any>;
}

interface NotificationPreferences {
  userId: string;
  channels: NotificationChannel[];
  categories: {
    priceAlerts: boolean;
    portfolioUpdates: boolean;
    securityAlerts: boolean;
    systemNotifications: boolean;
    marketNews: boolean;
    tradingSignals: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM
    endTime: string;   // HH:MM
    timezone: string;
  };
  frequency: {
    priceAlerts: 'immediate' | 'hourly' | 'daily';
    portfolioSummary: 'daily' | 'weekly' | 'monthly';
    marketDigest: 'daily' | 'weekly' | 'disabled';
  };
}

interface NotificationTemplate {
  id: string;
  name: string;
  category: string;
  channel: string;
  subject?: string;
  htmlTemplate: string;
  textTemplate: string;
  variables: string[];
  metadata: Record<string, any>;
}

interface NotificationRequest {
  userId: string;
  category: string;
  template: string;
  data: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels?: string[];
  scheduledFor?: Date;
  expiresAt?: Date;
}

interface NotificationDelivery {
  id: string;
  userId: string;
  requestId: string;
  channel: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'expired';
  attempts: number;
  lastAttempt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  providerId?: string;
  metadata: Record<string, any>;
}

class NotificationService {
  private emailProvider: EmailProvider;
  private pushProvider: PushProvider;
  private webhookProvider: WebhookProvider;
  private smsProvider: SMSProvider;
  private templateEngine: TemplateEngine;
  private alertEngine: AlertEngine;
  private deliveryQueue: DeliveryQueue;
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  constructor() {
    this.emailProvider = new EmailProvider();
    this.pushProvider = new PushProvider();
    this.webhookProvider = new WebhookProvider();
    this.smsProvider = new SMSProvider();
    this.templateEngine = new TemplateEngine();
    this.alertEngine = new AlertEngine();
    this.deliveryQueue = new DeliveryQueue();
    
    this.kafka = new Kafka({
      clientId: 'notification-service',
      brokers: process.env.KAFKA_BROKERS!.split(',')
    });
    
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'notification-service' });
    
    this.setupEventHandlers();
  }

  private async setupEventHandlers(): Promise<void> {
    await this.consumer.subscribe({
      topics: [
        'portfolio.holdings.updated',
        'market.prices.updated',
        'user.security.alert',
        'trading.signals.generated'
      ]
    });

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const event = JSON.parse(message.value?.toString() || '{}');
        await this.handleEvent(topic, event);
      }
    });
  }

  private async handleEvent(topic: string, event: any): Promise<void> {
    switch (topic) {
      case 'portfolio.holdings.updated':
        await this.handlePortfolioUpdate(event);
        break;
      
      case 'market.prices.updated':
        await this.handlePriceUpdate(event);
        break;
      
      case 'user.security.alert':
        await this.handleSecurityAlert(event);
        break;
      
      case 'trading.signals.generated':
        await this.handleTradingSignal(event);
        break;
    }
  }

  async sendNotification(request: NotificationRequest): Promise<string> {
    // Generate unique request ID
    const requestId = this.generateRequestId();

    // Get user preferences
    const preferences = await this.getUserPreferences(request.userId);
    
    // Check if category is enabled
    if (!this.isCategoryEnabled(preferences, request.category)) {
      console.log(`Notification category ${request.category} disabled for user ${request.userId}`);
      return requestId;
    }

    // Check quiet hours
    if (this.isQuietHours(preferences)) {
      console.log(`User ${request.userId} is in quiet hours, deferring notification`);
      await this.scheduleNotification(request, this.getNextActiveTime(preferences));
      return requestId;
    }

    // Determine channels to use
    const channels = request.channels || this.getEnabledChannels(preferences);

    // Process each channel
    for (const channel of channels) {
      await this.processChannelNotification(requestId, request, channel, preferences);
    }

    return requestId;
  }

  private async processChannelNotification(
    requestId: string,
    request: NotificationRequest,
    channel: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      // Get template
      const template = await this.templateEngine.getTemplate(request.template, channel);
      
      // Render content
      const renderedContent = await this.templateEngine.render(template, request.data);

      // Create delivery record
      const delivery: NotificationDelivery = {
        id: this.generateDeliveryId(),
        userId: request.userId,
        requestId,
        channel,
        status: 'pending',
        attempts: 0,
        metadata: {
          category: request.category,
          priority: request.priority,
          template: request.template
        }
      };

      await this.saveDelivery(delivery);

      // Queue for delivery
      await this.deliveryQueue.enqueue({
        deliveryId: delivery.id,
        channel,
        content: renderedContent,
        recipient: await this.getRecipientInfo(request.userId, channel),
        priority: request.priority,
        maxAttempts: this.getMaxAttempts(request.priority),
        retryDelay: this.getRetryDelay(request.priority)
      });

    } catch (error) {
      console.error(`Error processing ${channel} notification:`, error);
    }
  }

  async processDeliveryQueue(): Promise<void> {
    const deliveryJobs = await this.deliveryQueue.dequeue(10); // Process 10 at a time

    for (const job of deliveryJobs) {
      try {
        await this.deliverNotification(job);
      } catch (error) {
        console.error('Error delivering notification:', error);
        await this.handleDeliveryFailure(job, error.message);
      }
    }
  }

  private async deliverNotification(job: any): Promise<void> {
    const { deliveryId, channel, content, recipient, priority } = job;

    // Update delivery attempt
    await this.updateDeliveryAttempt(deliveryId);

    let result: any;

    switch (channel) {
      case 'email':
        result = await this.emailProvider.send({
          to: recipient.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
          priority
        });
        break;

      case 'push':
        result = await this.pushProvider.send({
          token: recipient.pushToken,
          title: content.title,
          body: content.body,
          data: content.data,
          priority
        });
        break;

      case 'webhook':
        result = await this.webhookProvider.send({
          url: recipient.webhookUrl,
          payload: content.payload,
          headers: recipient.headers,
          priority
        });
        break;

      case 'sms':
        result = await this.smsProvider.send({
          to: recipient.phoneNumber,
          message: content.text,
          priority
        });
        break;

      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }

    // Update delivery status
    await this.updateDeliveryStatus(deliveryId, 'sent', {
      providerId: result.id,
      sentAt: new Date()
    });
  }

  private async handlePortfolioUpdate(event: any): Promise<void> {
    const { userId, totalValue, previousValue, holdings } = event.data;
    
    // Calculate change
    const change = totalValue - (previousValue || totalValue);
    const changePercent = previousValue ? ((change / previousValue) * 100) : 0;

    // Check if significant change warrants notification
    if (Math.abs(changePercent) >= 5) { // 5% threshold
      await this.sendNotification({
        userId,
        category: 'portfolioUpdates',
        template: 'portfolio_significant_change',
        data: {
          totalValue,
          change,
          changePercent: changePercent.toFixed(2),
          topPerformers: this.getTopPerformers(holdings),
          timestamp: new Date().toISOString()
        },
        priority: Math.abs(changePercent) >= 10 ? 'high' : 'medium'
      });
    }
  }

  private async handlePriceUpdate(event: any): Promise<void> {
    const { symbol, price, change24h } = event.data;
    
    // Get users with price alerts for this symbol
    const alerts = await this.alertEngine.getActivePriceAlerts(symbol);

    for (const alert of alerts) {
      if (this.shouldTriggerAlert(alert, price, change24h)) {
        await this.sendNotification({
          userId: alert.userId,
          category: 'priceAlerts',
          template: 'price_alert_triggered',
          data: {
            symbol,
            price,
            change24h,
            alertType: alert.type,
            targetPrice: alert.targetPrice,
            timestamp: new Date().toISOString()
          },
          priority: 'high'
        });

        // Deactivate one-time alerts
        if (alert.frequency === 'once') {
          await this.alertEngine.deactivateAlert(alert.id);
        }
      }
    }
  }

  private async handleSecurityAlert(event: any): Promise<void> {
    const { userId, alertType, details } = event.data;

    await this.sendNotification({
      userId,
      category: 'securityAlerts',
      template: 'security_alert',
      data: {
        alertType,
        details,
        timestamp: new Date().toISOString(),
        actionUrl: `${process.env.FRONTEND_URL}/security`
      },
      priority: 'urgent',
      channels: ['email', 'push'] // Force multiple channels for security
    });
  }

  private async handleTradingSignal(event: any): Promise<void> {
    const { symbol, signalType, strength, confidence, description } = event.data;
    
    // Get users subscribed to trading signals for this symbol
    const subscribers = await this.getSignalSubscribers(symbol);

    for (const userId of subscribers) {
      await this.sendNotification({
        userId,
        category: 'tradingSignals',
        template: 'trading_signal',
        data: {
          symbol,
          signalType,
          strength,
          confidence,
          description,
          timestamp: new Date().toISOString()
        },
        priority: strength > 70 ? 'high' : 'medium'
      });
    }
  }

  async createPriceAlert(
    userId: string,
    symbol: string,
    condition: 'above' | 'below' | 'change',
    targetPrice?: number,
    changePercent?: number,
    frequency: 'once' | 'daily' | 'always' = 'once'
  ): Promise<string> {
    const alert = {
      id: this.generateAlertId(),
      userId,
      symbol,
      condition,
      targetPrice,
      changePercent,
      frequency,
      isActive: true,
      createdAt: new Date(),
      lastTriggered: null
    };

    await this.alertEngine.saveAlert(alert);

    // Send confirmation
    await this.sendNotification({
      userId,
      category: 'systemNotifications',
      template: 'alert_created',
      data: {
        symbol,
        condition,
        targetPrice,
        changePercent
      },
      priority: 'low'
    });

    return alert.id;
  }

  async sendBulkNotification(
    userIds: string[],
    request: Omit<NotificationRequest, 'userId'>
  ): Promise<string[]> {
    const requestIds: string[] = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = 100;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(userId => 
        this.sendNotification({ ...request, userId })
      );

      const batchRequestIds = await Promise.all(batchPromises);
      requestIds.push(...batchRequestIds);

      // Add delay between batches to prevent rate limiting
      if (i + batchSize < userIds.length) {
        await this.delay(1000); // 1 second delay
      }
    }

    return requestIds;
  }

  async getNotificationHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationDelivery[]> {
    return this.getDeliveryHistory(userId, limit, offset);
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    await this.saveUserPreferences(userId, preferences);
  }

  // Utility methods
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeliveryId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isCategoryEnabled(preferences: NotificationPreferences, category: string): boolean {
    return preferences.categories[category as keyof typeof preferences.categories] ?? true;
  }

  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours.enabled) return false;

    const now = new Date();
    const userTime = new Intl.DateTimeFormat('en-US', {
      timeZone: preferences.quietHours.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    const currentTime = userTime.replace(':', '');
    const startTime = preferences.quietHours.startTime.replace(':', '');
    const endTime = preferences.quietHours.endTime.replace(':', '');

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Crosses midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private getEnabledChannels(preferences: NotificationPreferences): string[] {
    return preferences.channels
      .filter(channel => channel.enabled)
      .map(channel => channel.type);
  }

  private shouldTriggerAlert(alert: any, currentPrice: number, change24h: number): boolean {
    switch (alert.condition) {
      case 'above':
        return currentPrice >= alert.targetPrice;
      case 'below':
        return currentPrice <= alert.targetPrice;
      case 'change':
        return Math.abs(change24h) >= Math.abs(alert.changePercent);
      default:
        return false;
    }
  }

  private getTopPerformers(holdings: any[]): any[] {
    return holdings
      .filter(h => h.gainLoss !== undefined)
      .sort((a, b) => b.gainLoss - a.gainLoss)
      .slice(0, 3);
  }

  private getMaxAttempts(priority: string): number {
    const maxAttempts = {
      low: 2,
      medium: 3,
      high: 5,
      urgent: 7
    };
    return maxAttempts[priority as keyof typeof maxAttempts] || 3;
  }

  private getRetryDelay(priority: string): number {
    const delays = {
      low: 5 * 60 * 1000,      // 5 minutes
      medium: 2 * 60 * 1000,   // 2 minutes
      high: 60 * 1000,         // 1 minute
      urgent: 30 * 1000        // 30 seconds
    };
    return delays[priority as keyof typeof delays] || 2 * 60 * 1000;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getNextActiveTime(preferences: NotificationPreferences): Date {
    // Calculate next time outside quiet hours
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // This is a simplified implementation
    // Real implementation would properly handle timezone conversions
    return tomorrow;
  }

  // Database operations (implement with your chosen database)
  private async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    // Implementation depends on your database choice
    return {
      userId,
      channels: [
        { type: 'email', enabled: true, config: {} },
        { type: 'push', enabled: true, config: {} }
      ],
      categories: {
        priceAlerts: true,
        portfolioUpdates: true,
        securityAlerts: true,
        systemNotifications: true,
        marketNews: false,
        tradingSignals: false
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC'
      },
      frequency: {
        priceAlerts: 'immediate',
        portfolioSummary: 'daily',
        marketDigest: 'daily'
      }
    };
  }

  private async saveUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    // Implementation depends on your database choice
  }

  private async saveDelivery(delivery: NotificationDelivery): Promise<void> {
    // Implementation depends on your database choice
  }

  private async updateDeliveryAttempt(deliveryId: string): Promise<void> {
    // Implementation depends on your database choice
  }

  private async updateDeliveryStatus(deliveryId: string, status: string, metadata: any): Promise<void> {
    // Implementation depends on your database choice
  }

  private async getDeliveryHistory(userId: string, limit: number, offset: number): Promise<NotificationDelivery[]> {
    // Implementation depends on your database choice
    return [];
  }

  private async getRecipientInfo(userId: string, channel: string): Promise<any> {
    // Implementation depends on your database choice
    return {};
  }

  private async getSignalSubscribers(symbol: string): Promise<string[]> {
    // Implementation depends on your database choice
    return [];
  }

  private async handleDeliveryFailure(job: any, errorMessage: string): Promise<void> {
    // Implementation for handling delivery failures and retries
  }

  private async scheduleNotification(request: NotificationRequest, scheduledFor: Date): Promise<void> {
    // Implementation for scheduling notifications
  }
}

// Supporting provider classes would be implemented here
class EmailProvider {
  async send(options: any): Promise<any> {
    // SendGrid, SES, or other email provider implementation
    return { id: 'email_id' };
  }
}

class PushProvider {
  async send(options: any): Promise<any> {
    // Firebase FCM or other push notification provider implementation
    return { id: 'push_id' };
  }
}

class WebhookProvider {
  async send(options: any): Promise<any> {
    // HTTP webhook implementation
    return { id: 'webhook_id' };
  }
}

class SMSProvider {
  async send(options: any): Promise<any> {
    // Twilio or other SMS provider implementation
    return { id: 'sms_id' };
  }
}

class TemplateEngine {
  async getTemplate(templateName: string, channel: string): Promise<NotificationTemplate> {
    // Template retrieval implementation
    throw new Error('Not implemented');
  }

  async render(template: NotificationTemplate, data: Record<string, any>): Promise<any> {
    // Handlebars or other template rendering implementation
    throw new Error('Not implemented');
  }
}

class AlertEngine {
  async getActivePriceAlerts(symbol: string): Promise<any[]> {
    // Price alert retrieval implementation
    return [];
  }

  async saveAlert(alert: any): Promise<void> {
    // Alert persistence implementation
  }

  async deactivateAlert(alertId: string): Promise<void> {
    // Alert deactivation implementation
  }
}

class DeliveryQueue {
  async enqueue(job: any): Promise<void> {
    // Queue implementation (Redis, SQS, etc.)
  }

  async dequeue(count: number): Promise<any[]> {
    // Queue dequeue implementation
    return [];
  }
}
```

This notification service provides:
- **Multi-channel Support**: Email, push, webhook, and SMS notifications
- **User Preferences**: Granular control over notification categories and timing
- **Template System**: Flexible template engine for different message formats
- **Alert Engine**: Price alerts and portfolio monitoring
- **Delivery Tracking**: Comprehensive delivery status and retry logic
- **Bulk Operations**: Efficient bulk notification processing
- **Event-driven**: Automatic notifications based on system events
- **Scalability**: Queue-based processing for high-volume notifications