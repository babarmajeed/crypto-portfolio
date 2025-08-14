import { 
  EmailNotification, 
  EmailServiceInterface, 
  NotificationTemplate, 
  NotificationHistory, 
  BaseNotification 
} from '../types/notification.types';
import { convertToEmailFormat } from '../utils/notificationUtils';

class EmailService implements EmailServiceInterface {
  private apiBaseUrl: string;
  private templates: NotificationTemplate[] = [];
  private deliveryQueue: EmailNotification[] = [];
  private isProcessing = false;
  private retryDelays = [1000, 5000, 15000, 60000]; // Exponential backoff delays

  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_URL || '/api';
    this.loadTemplates();
    this.startQueueProcessor();
  }

  // Core Email Sending Methods
  async sendEmail(notification: EmailNotification): Promise<void> {
    try {
      // Validate email addresses
      notification.to.forEach(email => {
        if (!this.validateEmail(email)) {
          throw new Error(`Invalid email address: ${email}`);
        }
      });

      // Add to delivery queue for processing
      this.deliveryQueue.push({
        ...notification,
        priority: notification.priority || 'medium'
      });

      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }

    } catch (error) {
      console.error('Failed to queue email notification:', error);
      throw error;
    }
  }

  async sendBulkEmail(notifications: EmailNotification[]): Promise<void> {
    try {
      // Validate all notifications
      for (const notification of notifications) {
        notification.to.forEach(email => {
          if (!this.validateEmail(email)) {
            throw new Error(`Invalid email address: ${email}`);
          }
        });
      }

      // Add all to queue
      this.deliveryQueue.push(...notifications.map(n => ({
        ...n,
        priority: n.priority || 'medium'
      })));

      // Process queue
      if (!this.isProcessing) {
        this.processQueue();
      }

    } catch (error) {
      console.error('Failed to queue bulk email notifications:', error);
      throw error;
    }
  }

  // Queue Processing
  private async processQueue() {
    if (this.isProcessing || this.deliveryQueue.length === 0) return;

    this.isProcessing = true;

    try {
      // Sort queue by priority (critical > high > medium > low)
      this.deliveryQueue.sort((a, b) => {
        const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      });

      // Process emails in batches of 10
      const batchSize = 10;
      
      while (this.deliveryQueue.length > 0) {
        const batch = this.deliveryQueue.splice(0, batchSize);
        await this.processBatch(batch);
        
        // Small delay between batches to avoid overwhelming the server
        if (this.deliveryQueue.length > 0) {
          await this.delay(100);
        }
      }

    } catch (error) {
      console.error('Error processing email queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatch(emails: EmailNotification[]): Promise<void> {
    const promises = emails.map(email => this.sendSingleEmail(email));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }

  private async sendSingleEmail(notification: EmailNotification, retryCount = 0): Promise<void> {
    try {
      const emailData = {
        to: notification.to,
        cc: notification.cc,
        bcc: notification.bcc,
        subject: notification.subject,
        body: notification.body,
        template: notification.template,
        variables: notification.variables,
        priority: notification.priority,
        attachments: notification.attachments
      };

      const response = await fetch(`${this.apiBaseUrl}/email/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Email sending failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Email sent successfully:`, result);

      // Track delivery
      await this.trackDelivery(notification, 'sent', result.messageId);

    } catch (error) {
      console.error(`Failed to send email (attempt ${retryCount + 1}):`, error);

      // Retry logic
      if (retryCount < this.retryDelays.length) {
        const delay = this.retryDelays[retryCount];
        console.log(`Retrying email send in ${delay}ms...`);
        
        await this.delay(delay);
        return this.sendSingleEmail(notification, retryCount + 1);
      } else {
        // Max retries exceeded
        console.error('Max retry attempts exceeded for email:', notification.subject);
        await this.trackDelivery(notification, 'failed', undefined, error.message);
        throw error;
      }
    }
  }

  // Template Management
  async getTemplates(): Promise<NotificationTemplate[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/templates`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        const templates = await response.json();
        this.templates = templates;
        return templates;
      } else {
        throw new Error(`Failed to load email templates: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to load email templates:', error);
      return this.getDefaultTemplates();
    }
  }

  async renderTemplate(templateId: string, variables: Record<string, any>): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/templates/${templateId}/render`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ variables })
      });

      if (response.ok) {
        const result = await response.json();
        return result.renderedContent;
      } else {
        throw new Error(`Failed to render template: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to render email template:', error);
      
      // Fallback to local template rendering
      return this.renderTemplateLocally(templateId, variables);
    }
  }

  private renderTemplateLocally(templateId: string, variables: Record<string, any>): string {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let content = template.body;
    
    // Simple variable substitution
    template.variables.forEach(variableName => {
      const value = variables[variableName] || '';
      const regex = new RegExp(`{{\\s*${variableName}\\s*}}`, 'g');
      content = content.replace(regex, String(value));
    });

    return content;
  }

  // Email Validation
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Delivery Tracking
  async getDeliveryStatus(messageId: string): Promise<NotificationHistory> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/delivery-status/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Failed to get delivery status: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to get email delivery status:', error);
      throw error;
    }
  }

  private async trackDelivery(
    notification: EmailNotification, 
    status: 'sent' | 'delivered' | 'failed', 
    messageId?: string, 
    failureReason?: string
  ): Promise<void> {
    try {
      const trackingData = {
        type: 'email',
        recipients: notification.to,
        subject: notification.subject,
        status,
        messageId,
        failureReason,
        timestamp: new Date().toISOString()
      };

      await fetch(`${this.apiBaseUrl}/email/track-delivery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(trackingData)
      });
    } catch (error) {
      console.error('Failed to track email delivery:', error);
    }
  }

  // Convenience Methods
  async sendNotificationEmail(notification: BaseNotification, recipients: string[]): Promise<void> {
    const emailFormat = convertToEmailFormat(notification);
    
    const emailNotification: EmailNotification = {
      to: recipients,
      subject: emailFormat.subject,
      body: emailFormat.body,
      priority: notification.priority,
      template: 'notification_default',
      variables: {
        title: notification.title,
        message: notification.message,
        details: notification.details,
        timestamp: notification.timestamp,
        actionUrl: notification.actionUrl,
        data: notification.data
      }
    };

    await this.sendEmail(emailNotification);
  }

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    const emailNotification: EmailNotification = {
      to: [userEmail],
      subject: 'Welcome to Crypto Portfolio Tracker',
      body: '', // Will be rendered from template
      priority: 'medium',
      template: 'welcome',
      variables: {
        userName,
        dashboardUrl: `${window.location.origin}/dashboard`,
        supportEmail: 'support@cryptoportfolio.com'
      }
    };

    await this.sendEmail(emailNotification);
  }

  async sendPasswordResetEmail(userEmail: string, resetToken: string): Promise<void> {
    const resetUrl = `${window.location.origin}/reset-password?token=${resetToken}`;
    
    const emailNotification: EmailNotification = {
      to: [userEmail],
      subject: 'Password Reset Request',
      body: '', // Will be rendered from template
      priority: 'high',
      template: 'password_reset',
      variables: {
        resetUrl,
        expiryTime: '1 hour',
        supportEmail: 'support@cryptoportfolio.com'
      }
    };

    await this.sendEmail(emailNotification);
  }

  async sendSecurityAlertEmail(userEmail: string, alertDetails: any): Promise<void> {
    const emailNotification: EmailNotification = {
      to: [userEmail],
      subject: 'Security Alert - Unusual Account Activity',
      body: '', // Will be rendered from template
      priority: 'critical',
      template: 'security_alert',
      variables: {
        alertType: alertDetails.type,
        timestamp: alertDetails.timestamp,
        ipAddress: alertDetails.ipAddress,
        location: alertDetails.location,
        device: alertDetails.device,
        actionRequired: alertDetails.actionRequired,
        supportEmail: 'support@cryptoportfolio.com'
      }
    };

    await this.sendEmail(emailNotification);
  }

  async sendDigestEmail(userEmail: string, digestData: any): Promise<void> {
    const emailNotification: EmailNotification = {
      to: [userEmail],
      subject: `Your Crypto Portfolio Digest - ${new Date().toLocaleDateString()}`,
      body: '', // Will be rendered from template
      priority: 'low',
      template: 'daily_digest',
      variables: {
        portfolioValue: digestData.portfolioValue,
        portfolioChange: digestData.portfolioChange,
        topGainer: digestData.topGainer,
        topLoser: digestData.topLoser,
        alertsTriggered: digestData.alertsTriggered,
        newsItems: digestData.newsItems,
        dashboardUrl: `${window.location.origin}/dashboard`
      }
    };

    await this.sendEmail(emailNotification);
  }

  // Template Management Helpers
  private async loadTemplates(): Promise<void> {
    try {
      this.templates = await this.getTemplates();
    } catch (error) {
      console.error('Failed to load email templates:', error);
      this.templates = this.getDefaultTemplates();
    }
  }

  private getDefaultTemplates(): NotificationTemplate[] {
    return [
      {
        id: 'notification_default',
        name: 'Default Notification',
        type: 'system',
        channel: 'email',
        subject: '{{title}}',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2>{{title}}</h2>
              <p>{{message}}</p>
              {{#if details}}
                <p><strong>Details:</strong> {{details}}</p>
              {{/if}}
              {{#if actionUrl}}
                <p>
                  <a href="{{actionUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    View Details
                  </a>
                </p>
              {{/if}}
              <p style="color: #666; font-size: 12px;">
                Received: {{timestamp}}
              </p>
            </body>
          </html>
        `,
        variables: ['title', 'message', 'details', 'actionUrl', 'timestamp'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'welcome',
        name: 'Welcome Email',
        type: 'system',
        channel: 'email',
        subject: 'Welcome to Crypto Portfolio Tracker',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h1>Welcome, {{userName}}!</h1>
              <p>Thank you for joining Crypto Portfolio Tracker. We're excited to help you manage your cryptocurrency investments.</p>
              
              <h3>Getting Started:</h3>
              <ul>
                <li>Connect your exchange accounts</li>
                <li>Set up price alerts</li>
                <li>Customize your dashboard</li>
                <li>Enable notifications</li>
              </ul>
              
              <p>
                <a href="{{dashboardUrl}}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                  Go to Dashboard
                </a>
              </p>
              
              <p>If you need help, contact us at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
            </body>
          </html>
        `,
        variables: ['userName', 'dashboardUrl', 'supportEmail'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'password_reset',
        name: 'Password Reset',
        type: 'security',
        channel: 'email',
        subject: 'Password Reset Request',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2>Password Reset Request</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              
              <p>
                <a href="{{resetUrl}}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                  Reset Password
                </a>
              </p>
              
              <p><strong>This link will expire in {{expiryTime}}.</strong></p>
              
              <p>If you didn't request this password reset, please ignore this email or contact support at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
              
              <p style="color: #666; font-size: 12px;">
                For security reasons, this link can only be used once.
              </p>
            </body>
          </html>
        `,
        variables: ['resetUrl', 'expiryTime', 'supportEmail'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  // Utility Methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }

  private startQueueProcessor(): void {
    // Process queue every 5 seconds
    setInterval(() => {
      if (!this.isProcessing && this.deliveryQueue.length > 0) {
        this.processQueue();
      }
    }, 5000);
  }

  // Cleanup
  destroy(): void {
    this.deliveryQueue = [];
    this.isProcessing = false;
  }
}

// Create and export singleton instance
export const emailService = new EmailService();
export default EmailService;