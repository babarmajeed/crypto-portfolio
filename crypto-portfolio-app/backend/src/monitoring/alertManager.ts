import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertRule, NotificationChannel } from '@/types/monitoring.types';
import { defaultAlertRules, defaultNotificationChannels, monitoringConfig } from '@/config/monitoring.config';
import { loggingService } from '@/services/loggingService';
import { WebClient as SlackWebClient } from '@slack/web-api';
import nodemailer from 'nodemailer';
import axios from 'axios';

interface AlertEvaluation {
  ruleId: string;
  value: number;
  threshold: number;
  triggered: boolean;
  timestamp: Date;
}

class AlertManager {
  private alertRules = new Map<string, AlertRule>();
  private notificationChannels = new Map<string, NotificationChannel>();
  private activeAlerts = new Map<string, Alert>();
  private alertHistory: Alert[] = [];
  private evaluationInterval?: NodeJS.Timeout;
  private slackClient?: SlackWebClient;
  private emailTransporter?: nodemailer.Transporter;

  constructor() {
    this.loadDefaultConfiguration();
    this.initializeNotificationServices();
    this.startAlertEvaluation();
  }

  /**
   * Load default alert rules and notification channels
   */
  private loadDefaultConfiguration(): void {
    // Load default alert rules
    defaultAlertRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    // Load default notification channels
    defaultNotificationChannels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel);
    });

    loggingService.logInfo(`Loaded ${this.alertRules.size} alert rules and ${this.notificationChannels.size} notification channels`);
  }

  /**
   * Initialize notification services
   */
  private initializeNotificationServices(): void {
    // Initialize Slack client
    if (process.env.SLACK_BOT_TOKEN) {
      this.slackClient = new SlackWebClient(process.env.SLACK_BOT_TOKEN);
      loggingService.logInfo('Slack notification client initialized');
    }

    // Initialize email transporter
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      loggingService.logInfo('Email notification transporter initialized');
    }
  }

  /**
   * Add or update alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    loggingService.logInfo(`Added alert rule: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      loggingService.logInfo(`Removed alert rule: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Add or update notification channel
   */
  public addNotificationChannel(channel: NotificationChannel): void {
    this.notificationChannels.set(channel.id, channel);
    loggingService.logInfo(`Added notification channel: ${channel.name}`);
  }

  /**
   * Remove notification channel
   */
  public removeNotificationChannel(channelId: string): boolean {
    const removed = this.notificationChannels.delete(channelId);
    if (removed) {
      loggingService.logInfo(`Removed notification channel: ${channelId}`);
    }
    return removed;
  }

  /**
   * Evaluate metric against alert rules
   */
  public async evaluateMetric(metricName: string, value: number): Promise<AlertEvaluation[]> {
    const evaluations: AlertEvaluation[] = [];

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.condition.metric !== metricName) {
        continue;
      }

      const evaluation: AlertEvaluation = {
        ruleId: rule.id,
        value,
        threshold: rule.condition.value,
        triggered: this.evaluateCondition(value, rule.condition.operator, rule.condition.value),
        timestamp: new Date()
      };

      evaluations.push(evaluation);

      if (evaluation.triggered) {
        await this.handleTriggeredAlert(rule, evaluation);
      } else {
        await this.handleResolvedAlert(rule.id);
      }
    }

    return evaluations;
  }

  /**
   * Handle triggered alert
   */
  private async handleTriggeredAlert(rule: AlertRule, evaluation: AlertEvaluation): Promise<void> {
    const existingAlert = this.activeAlerts.get(rule.id);

    // Check if this is a new alert or an existing one
    if (!existingAlert) {
      const alert: Alert = {
        id: uuidv4(),
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        status: 'firing',
        message: this.generateAlertMessage(rule, evaluation),
        value: evaluation.value,
        threshold: evaluation.threshold,
        timestamp: new Date(),
        metadata: {
          evaluation,
          rule: {
            description: rule.description,
            tags: rule.tags
          }
        }
      };

      this.activeAlerts.set(rule.id, alert);
      this.alertHistory.push(alert);

      // Send notifications
      await this.sendNotifications(alert, rule.channels);

      loggingService.logError(
        `Alert triggered: ${rule.name}`,
        undefined,
        {
          metadata: {
            alertId: alert.id,
            ruleId: rule.id,
            value: evaluation.value,
            threshold: evaluation.threshold,
            severity: rule.severity
          },
          tags: ['alert', 'triggered', rule.severity]
        }
      );
    }
  }

  /**
   * Handle resolved alert
   */
  private async handleResolvedAlert(ruleId: string): Promise<void> {
    const activeAlert = this.activeAlerts.get(ruleId);
    
    if (activeAlert && activeAlert.status === 'firing') {
      activeAlert.status = 'resolved';
      activeAlert.resolvedAt = new Date();

      // Send resolution notifications
      const rule = this.alertRules.get(ruleId);
      if (rule) {
        await this.sendResolutionNotifications(activeAlert, rule.channels);
      }

      // Remove from active alerts
      this.activeAlerts.delete(ruleId);

      loggingService.logInfo(
        `Alert resolved: ${activeAlert.ruleName}`,
        {
          metadata: {
            alertId: activeAlert.id,
            ruleId,
            duration: activeAlert.resolvedAt.getTime() - activeAlert.timestamp.getTime()
          },
          tags: ['alert', 'resolved']
        }
      );
    }
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.status = 'acknowledged';
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = acknowledgedBy;

        loggingService.logInfo(
          `Alert acknowledged: ${alert.ruleName}`,
          {
            metadata: {
              alertId,
              acknowledgedBy,
              ruleId: alert.ruleId
            },
            tags: ['alert', 'acknowledged']
          }
        );

        return true;
      }
    }

    return false;
  }

  /**
   * Send notifications for triggered alert
   */
  private async sendNotifications(alert: Alert, channelIds: string[]): Promise<void> {
    const promises = channelIds.map(channelId => {
      const channel = this.notificationChannels.get(channelId);
      if (channel && channel.enabled) {
        return this.sendNotification(channel, alert);
      }
      return Promise.resolve();
    });

    await Promise.allSettled(promises);
  }

  /**
   * Send resolution notifications
   */
  private async sendResolutionNotifications(alert: Alert, channelIds: string[]): Promise<void> {
    const promises = channelIds.map(channelId => {
      const channel = this.notificationChannels.get(channelId);
      if (channel && channel.enabled) {
        return this.sendResolutionNotification(channel, alert);
      }
      return Promise.resolve();
    });

    await Promise.allSettled(promises);
  }

  /**
   * Send single notification
   */
  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel, alert);
          break;
        case 'slack':
          await this.sendSlackNotification(channel, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, alert);
          break;
        default:
          loggingService.logWarning(`Unsupported notification channel type: ${channel.type}`);
      }
    } catch (error) {
      loggingService.logError(
        `Failed to send notification via ${channel.type}`,
        error as Error,
        {
          metadata: {
            channelId: channel.id,
            alertId: alert.id
          }
        }
      );
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!this.emailTransporter || !channel.config.email) {
      return;
    }

    const subject = channel.config.email.subject
      ?.replace('{{severity}}', alert.severity.toUpperCase())
      ?.replace('{{ruleName}}', alert.ruleName) || 
      `[${alert.severity.toUpperCase()}] Alert: ${alert.ruleName}`;

    const htmlContent = this.generateEmailContent(alert);

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: channel.config.email.recipients.join(', '),
      subject,
      html: htmlContent,
      text: alert.message
    });

    loggingService.logInfo(`Email notification sent for alert: ${alert.id}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.slack) {
      return;
    }

    const color = this.getSeverityColor(alert.severity);
    const slackMessage = {
      channel: channel.config.slack.channel,
      username: channel.config.slack.username || 'Alert Bot',
      attachments: [
        {
          color,
          title: `🚨 ${alert.severity.toUpperCase()} Alert: ${alert.ruleName}`,
          text: alert.message,
          fields: [
            {
              title: 'Value',
              value: alert.value.toString(),
              short: true
            },
            {
              title: 'Threshold',
              value: alert.threshold.toString(),
              short: true
            },
            {
              title: 'Time',
              value: alert.timestamp.toISOString(),
              short: true
            },
            {
              title: 'Alert ID',
              value: alert.id,
              short: true
            }
          ],
          footer: 'Crypto Portfolio Monitoring',
          ts: Math.floor(alert.timestamp.getTime() / 1000)
        }
      ]
    };

    if (this.slackClient) {
      await this.slackClient.chat.postMessage(slackMessage);
    } else if (channel.config.slack.webhook) {
      await axios.post(channel.config.slack.webhook, slackMessage);
    }

    loggingService.logInfo(`Slack notification sent for alert: ${alert.id}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.webhook) {
      return;
    }

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      source: 'crypto-portfolio-monitoring'
    };

    await axios.post(channel.config.webhook.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...channel.config.webhook.headers
      },
      timeout: 10000
    });

    loggingService.logInfo(`Webhook notification sent for alert: ${alert.id}`);
  }

  /**
   * Send resolution notification
   */
  private async sendResolutionNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      if (channel.type === 'slack' && channel.config.slack) {
        const color = 'good';
        const duration = alert.resolvedAt 
          ? Math.round((alert.resolvedAt.getTime() - alert.timestamp.getTime()) / 1000)
          : 0;

        const slackMessage = {
          channel: channel.config.slack.channel,
          username: channel.config.slack.username || 'Alert Bot',
          attachments: [
            {
              color,
              title: `✅ RESOLVED: ${alert.ruleName}`,
              text: `Alert has been resolved after ${duration} seconds`,
              fields: [
                {
                  title: 'Alert ID',
                  value: alert.id,
                  short: true
                },
                {
                  title: 'Duration',
                  value: `${duration}s`,
                  short: true
                }
              ],
              footer: 'Crypto Portfolio Monitoring',
              ts: Math.floor(Date.now() / 1000)
            }
          ]
        };

        if (this.slackClient) {
          await this.slackClient.chat.postMessage(slackMessage);
        } else if (channel.config.slack.webhook) {
          await axios.post(channel.config.slack.webhook, slackMessage);
        }
      }
    } catch (error) {
      loggingService.logError('Failed to send resolution notification', error as Error);
    }
  }

  /**
   * Start periodic alert evaluation
   */
  private startAlertEvaluation(): void {
    if (!monitoringConfig.alerts.enabled) {
      return;
    }

    const intervalMs = this.parseTimeInterval(monitoringConfig.alerts.evaluationInterval);
    
    this.evaluationInterval = setInterval(async () => {
      try {
        await this.performScheduledEvaluation();
      } catch (error) {
        loggingService.logError('Failed to perform scheduled alert evaluation', error as Error);
      }
    }, intervalMs);

    loggingService.logInfo(`Started alert evaluation every ${intervalMs}ms`);
  }

  /**
   * Perform scheduled evaluation of all alerts
   */
  private async performScheduledEvaluation(): Promise<void> {
    // This would typically query metrics from Prometheus or other monitoring systems
    // For this implementation, we'll simulate some metric evaluations
    
    // Example: Check error rate
    await this.evaluateMetric('http_requests_error_rate', Math.random() * 0.1); // 0-10%
    
    // Example: Check response time
    await this.evaluateMetric('http_request_duration_avg', 500 + Math.random() * 2000); // 500-2500ms
    
    // Example: Check memory usage
    await this.evaluateMetric('memory_usage_percent', 70 + Math.random() * 25); // 70-95%
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, evaluation: AlertEvaluation): string {
    return `${rule.description}. Current value: ${evaluation.value}, Threshold: ${evaluation.threshold}`;
  }

  /**
   * Generate email content
   */
  private generateEmailContent(alert: Alert): string {
    const severityColor = this.getSeverityColor(alert.severity);
    
    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 20px;">
          <div style="border-left: 4px solid ${severityColor}; padding-left: 16px;">
            <h2 style="color: ${severityColor}; margin-top: 0;">
              🚨 ${alert.severity.toUpperCase()} Alert: ${alert.ruleName}
            </h2>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Value:</strong> ${alert.value}</p>
            <p><strong>Threshold:</strong> ${alert.threshold}</p>
            <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
            <p><strong>Alert ID:</strong> ${alert.id}</p>
          </div>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This alert was generated by Crypto Portfolio Monitoring System
          </p>
        </body>
      </html>
    `;
  }

  /**
   * Get severity color
   */
  private getSeverityColor(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6600';
      case 'medium': return '#ffcc00';
      case 'low': return '#00cc00';
      default: return '#666666';
    }
  }

  /**
   * Parse time interval string to milliseconds
   */
  private parseTimeInterval(interval: string): number {
    const match = interval.match(/^(\d+)([smh])$/);
    if (!match) return 60000; // Default 1 minute

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 60000;
    }
  }

  /**
   * Get alert statistics
   */
  public getAlertStatistics(): {
    totalRules: number;
    enabledRules: number;
    activeAlerts: number;
    alertsBySevertiy: Record<string, number>;
    recentAlerts: Alert[];
  } {
    const enabledRules = Array.from(this.alertRules.values()).filter(r => r.enabled).length;
    const activeAlerts = this.activeAlerts.size;
    
    const alertsBySevertiy: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    Array.from(this.activeAlerts.values()).forEach(alert => {
      alertsBySevertiy[alert.severity]++;
    });

    const recentAlerts = this.alertHistory
      .slice(-10)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      totalRules: this.alertRules.size,
      enabledRules,
      activeAlerts,
      alertsBySevertiy,
      recentAlerts
    };
  }

  /**
   * Get all alert rules
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get all notification channels
   */
  public getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Stop alert evaluation
   */
  public stopAlertEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
      loggingService.logInfo('Stopped alert evaluation');
    }
  }

  /**
   * Cleanup on service shutdown
   */
  public cleanup(): void {
    this.stopAlertEvaluation();
    this.activeAlerts.clear();
    this.alertHistory.length = 0;
  }
}

export const alertManager = new AlertManager();