# CP-010: Email and Notification Services

## Objective
Implement a comprehensive email and notification system for portfolio alerts, price notifications, transaction confirmations, and user engagement communications using modern email delivery services and template management.

## Priority
High

## Category
Backend Services

## Acceptance Criteria
- [ ] Email service provider integration (SendGrid/AWS SES)
- [ ] Template engine for dynamic email content (Handlebars)
- [ ] Queue-based email delivery with retry mechanisms
- [ ] Email verification and double opt-in system
- [ ] Notification preferences management
- [ ] Real-time push notifications for web/mobile
- [ ] SMS notifications for critical alerts (Twilio)
- [ ] Email analytics and delivery tracking
- [ ] Unsubscribe management and compliance
- [ ] Email rate limiting and spam prevention

## Technical Implementation Details

### Email Service Architecture
```javascript
// services/emailService.js
const sgMail = require('@sendgrid/mail');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.templates = new Map();
    this.loadTemplates();
  }

  async loadTemplates() {
    const templatesDir = path.join(__dirname, '../templates/email');
    const files = await fs.readdir(templatesDir);
    
    for (const file of files) {
      if (file.endsWith('.hbs')) {
        const content = await fs.readFile(path.join(templatesDir, file), 'utf8');
        const templateName = file.replace('.hbs', '');
        this.templates.set(templateName, handlebars.compile(content));
      }
    }
  }

  async sendTemplatedEmail(to, subject, templateName, data) {
    try {
      const template = this.templates.get(templateName);
      if (!template) {
        throw new Error(`Template ${templateName} not found`);
      }

      const html = template(data);
      
      const msg = {
        to,
        from: {
          email: process.env.FROM_EMAIL,
          name: 'Crypto Portfolio Tracker'
        },
        subject,
        html,
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      };

      const result = await sgMail.send(msg);
      
      // Log email sent
      await EmailLog.create({
        to,
        subject,
        template: templateName,
        status: 'sent',
        messageId: result[0].headers['x-message-id']
      });

      return result;
    } catch (error) {
      console.error('Email sending failed:', error);
      
      // Log failed email
      await EmailLog.create({
        to,
        subject,
        template: templateName,
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
}
```

### Notification Types and Templates
```javascript
// services/notificationService.js
class NotificationService {
  constructor() {
    this.emailService = new EmailService();
    this.queues = require('../queues');
  }

  async sendPriceAlert(userId, alert) {
    const user = await User.findById(userId);
    
    if (user.preferences.emailNotifications.priceAlerts) {
      await this.queues.emailNotification.add('priceAlert', {
        to: user.email,
        subject: `Price Alert: ${alert.symbol} ${alert.condition}`,
        template: 'price-alert',
        data: {
          userName: user.firstName,
          symbol: alert.symbol,
          currentPrice: alert.currentPrice,
          targetPrice: alert.targetPrice,
          condition: alert.condition,
          portfolioLink: `${process.env.APP_URL}/portfolio`
        }
      });
    }
  }

  async sendPortfolioSummary(userId, summary) {
    const user = await User.findById(userId);
    
    if (user.preferences.emailNotifications.dailyReports) {
      await this.queues.emailNotification.add('portfolioSummary', {
        to: user.email,
        subject: 'Daily Portfolio Summary',
        template: 'portfolio-summary',
        data: {
          userName: user.firstName,
          date: new Date().toLocaleDateString(),
          totalValue: summary.totalValue,
          dayChange: summary.dayChange,
          dayChangePercent: summary.dayChangePercent,
          topPerformers: summary.topPerformers,
          portfolioLink: `${process.env.APP_URL}/portfolio`
        }
      });
    }
  }

  async sendTransactionConfirmation(userId, transaction) {
    const user = await User.findById(userId);
    
    await this.queues.emailNotification.add('transactionConfirmation', {
      to: user.email,
      subject: `Transaction Confirmed: ${transaction.type} ${transaction.symbol}`,
      template: 'transaction-confirmation',
      data: {
        userName: user.firstName,
        transaction: {
          type: transaction.type,
          symbol: transaction.symbol,
          amount: transaction.amount,
          price: transaction.price,
          total: transaction.total,
          date: transaction.createdAt.toLocaleDateString()
        }
      }
    });
  }
}
```

### Email Templates
```handlebars
<!-- templates/email/price-alert.hbs -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Alert</title>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .alert-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .price { font-size: 24px; font-weight: bold; color: #059669; }
    .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Price Alert Triggered</h1>
    </div>
    <div class="content">
      <h2>Hello {{userName}},</h2>
      
      <div class="alert-box">
        <h3>{{symbol}} Price Alert</h3>
        <p>Current Price: <span class="price">${{currentPrice}}</span></p>
        <p>Target Price: ${{targetPrice}}</p>
        <p>Condition: {{condition}}</p>
      </div>
      
      <p>Your price alert for {{symbol}} has been triggered. The current price has reached your target criteria.</p>
      
      <a href="{{portfolioLink}}" class="button">View Portfolio</a>
      
      <p>Best regards,<br>Crypto Portfolio Tracker Team</p>
    </div>
  </div>
</body>
</html>
```

### Push Notification Service
```javascript
// services/pushNotificationService.js
const webpush = require('web-push');

class PushNotificationService {
  constructor() {
    webpush.setVapidDetails(
      'mailto:' + process.env.SUPPORT_EMAIL,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  async sendPushNotification(subscription, payload) {
    try {
      const result = await webpush.sendNotification(subscription, JSON.stringify(payload));
      return result;
    } catch (error) {
      console.error('Push notification failed:', error);
      throw error;
    }
  }

  async sendPriceAlert(userId, alert) {
    const subscriptions = await PushSubscription.findByUserId(userId);
    
    const payload = {
      title: 'Price Alert',
      body: `${alert.symbol} is now $${alert.currentPrice}`,
      icon: '/icons/alert-icon.png',
      data: {
        url: '/portfolio',
        alertId: alert.id
      }
    };

    for (const subscription of subscriptions) {
      try {
        await this.sendPushNotification(subscription.data, payload);
      } catch (error) {
        if (error.statusCode === 410) {
          // Subscription expired, remove it
          await subscription.destroy();
        }
      }
    }
  }
}
```

### SMS Service Integration
```javascript
// services/smsService.js
const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendSMS(to, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      await SMSLog.create({
        to,
        message,
        status: 'sent',
        messageId: result.sid
      });

      return result;
    } catch (error) {
      console.error('SMS sending failed:', error);
      
      await SMSLog.create({
        to,
        message,
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }

  async sendCriticalAlert(userId, alert) {
    const user = await User.findById(userId);
    
    if (user.phoneNumber && user.preferences.smsNotifications.criticalAlerts) {
      const message = `CRITICAL ALERT: ${alert.symbol} price ${alert.condition} $${alert.targetPrice}. Current: $${alert.currentPrice}`;
      await this.sendSMS(user.phoneNumber, message);
    }
  }
}
```

## Required Technologies
- **SendGrid/AWS SES** - Email delivery service
- **Handlebars** - Template engine
- **Bull Queue** - Queue management
- **Twilio** - SMS service
- **web-push** - Push notifications
- **nodemailer** - Email client alternative

## Testing Requirements

### Unit Tests
```javascript
describe('EmailService', () => {
  test('should send templated email successfully', async () => {
    const emailService = new EmailService();
    
    const result = await emailService.sendTemplatedEmail(
      'test@example.com',
      'Test Subject',
      'test-template',
      { name: 'Test User' }
    );
    
    expect(result[0].statusCode).toBe(202);
  });

  test('should handle template not found error', async () => {
    const emailService = new EmailService();
    
    await expect(
      emailService.sendTemplatedEmail(
        'test@example.com',
        'Test',
        'non-existent-template',
        {}
      )
    ).rejects.toThrow('Template non-existent-template not found');
  });
});
```

### Integration Tests
```javascript
describe('NotificationService Integration', () => {
  test('should send price alert notification', async () => {
    const user = await User.create({
      email: 'test@example.com',
      preferences: { emailNotifications: { priceAlerts: true } }
    });

    const alert = {
      symbol: 'BTC',
      currentPrice: 50000,
      targetPrice: 45000,
      condition: 'below'
    };

    await notificationService.sendPriceAlert(user.id, alert);
    
    // Verify email was queued
    const jobs = await queues.emailNotification.getJobs(['waiting']);
    expect(jobs.length).toBeGreaterThan(0);
  });
});
```

## Dependencies
- CP-009: Background Job Processing and Queues
- CP-002: User Authentication and Authorization
- CP-004: Real-time Price Updates

## Email Templates Required
1. **Welcome Email** - User registration
2. **Email Verification** - Account verification
3. **Password Reset** - Password recovery
4. **Price Alerts** - Price target notifications
5. **Portfolio Summary** - Daily/weekly reports
6. **Transaction Confirmation** - Trade confirmations
7. **Security Alert** - Account security notifications
8. **Rebalancing Suggestions** - Portfolio optimization

## Notification Preferences Schema
```javascript
// models/notificationPreferences.js
const preferences = {
  emailNotifications: {
    priceAlerts: true,
    dailyReports: true,
    weeklyReports: false,
    transactionConfirmations: true,
    securityAlerts: true,
    marketingEmails: false
  },
  pushNotifications: {
    priceAlerts: true,
    criticalAlerts: true,
    dailyReports: false
  },
  smsNotifications: {
    criticalAlerts: false,
    securityAlerts: true
  }
};
```

## Definition of Done
- [ ] Email service provider configured and tested
- [ ] All email templates created and responsive
- [ ] Queue-based delivery system implemented
- [ ] Push notification service functional
- [ ] SMS service integrated for critical alerts
- [ ] Notification preferences system working
- [ ] Email verification and unsubscribe flows
- [ ] Analytics and delivery tracking implemented
- [ ] Rate limiting and spam prevention active
- [ ] All tests passing with high coverage
- [ ] Documentation complete with examples
- [ ] Production deployment with monitoring

## Estimated Time
**Beginner Developer**: 7-9 days
**Intermediate Developer**: 4-6 days
**Senior Developer**: 3-4 days

## Required Skills
- Email service APIs (SendGrid, AWS SES)
- Template engines (Handlebars, Mustache)
- Message queue systems
- Push notification services
- SMS API integration
- HTML/CSS for email design
- Database schema design
- GDPR compliance understanding

## Related Issues
- CP-009: Background Job Processing and Queues
- CP-002: User Authentication and Authorization
- CP-013: Logging, Monitoring and Analytics
- CP-004: Real-time Price Updates