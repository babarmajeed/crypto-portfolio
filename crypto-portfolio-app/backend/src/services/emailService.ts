import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';

interface EmailData {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private templatesPath: string;

  constructor() {
    this.templatesPath = path.join(__dirname, '../templates/email');
    this.setupTransporter();
  }

  private setupTransporter(): void {
    if (process.env.NODE_ENV === 'production') {
      // Production SMTP configuration
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Development configuration (using Ethereal for testing)
      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: process.env.ETHEREAL_USER || 'ethereal.user@ethereal.email',
          pass: process.env.ETHEREAL_PASS || 'ethereal.pass'
        }
      });
    }
  }

  async sendEmail(emailData: EmailData): Promise<void> {
    try {
      let html = emailData.html;
      let text = emailData.text;

      // If template is specified, compile it
      if (emailData.template) {
        const templateResult = await this.compileTemplate(emailData.template, emailData.data || {});
        html = templateResult.html;
        text = templateResult.text;
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@cryptoportfolio.com',
        to: emailData.to,
        subject: emailData.subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV === 'development') {
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(result));
      }

      console.log('Email sent successfully:', result.messageId);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  private async compileTemplate(templateName: string, data: Record<string, any>): Promise<{ html: string; text: string }> {
    try {
      // Read HTML template
      const htmlTemplatePath = path.join(this.templatesPath, `${templateName}.html`);
      const htmlTemplate = await fs.readFile(htmlTemplatePath, 'utf-8');
      const htmlCompiled = handlebars.compile(htmlTemplate);
      const html = htmlCompiled(data);

      // Read text template (optional)
      let text = '';
      try {
        const textTemplatePath = path.join(this.templatesPath, `${templateName}.txt`);
        const textTemplate = await fs.readFile(textTemplatePath, 'utf-8');
        const textCompiled = handlebars.compile(textTemplate);
        text = textCompiled(data);
      } catch {
        // If text template doesn't exist, create a simple text version
        text = this.htmlToText(html);
      }

      return { html, text };
    } catch (error) {
      console.error(`Failed to compile template ${templateName}:`, error);
      throw new Error(`Failed to compile email template: ${templateName}`);
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Welcome to Crypto Portfolio!',
      template: 'welcome',
      data: {
        firstName,
        loginUrl: `${process.env.FRONTEND_URL}/auth/login`,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@cryptoportfolio.com'
      }
    });
  }

  async sendPasswordChangedNotification(to: string, firstName: string, ipAddress?: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Password Changed - Crypto Portfolio',
      template: 'password-changed',
      data: {
        firstName,
        changeTime: new Date().toLocaleString(),
        ipAddress,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@cryptoportfolio.com'
      }
    });
  }

  async sendSecurityAlert(to: string, firstName: string, alertType: string, details: Record<string, any>): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Security Alert - Crypto Portfolio',
      template: 'security-alert',
      data: {
        firstName,
        alertType,
        details,
        timestamp: new Date().toLocaleString(),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@cryptoportfolio.com'
      }
    });
  }

  async sendTwoFactorDisabledNotification(to: string, firstName: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Two-Factor Authentication Disabled - Crypto Portfolio',
      template: 'two-factor-disabled',
      data: {
        firstName,
        timestamp: new Date().toLocaleString(),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@cryptoportfolio.com'
      }
    });
  }
}

export const emailService = new EmailService();
export const sendEmail = (emailData: EmailData) => emailService.sendEmail(emailData);