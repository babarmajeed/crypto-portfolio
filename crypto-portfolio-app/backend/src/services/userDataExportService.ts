/**
 * GDPR-compliant user data export service
 * Provides comprehensive data portability and export capabilities
 */

import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import PDFDocument from 'pdfkit';
import {
  UserDataExportRequest,
  ExportType,
  ExportFormat,
  ExportStatus,
  ExportOptions,
  BackupApiResponse
} from '../types/backup.types';
import { EncryptionUtils } from '../utils/encryptionUtils';
import { logger } from '../utils/logger';
import { emailService } from './emailService';

export interface UserData {
  profile: UserProfile;
  portfolios: Portfolio[];
  transactions: Transaction[];
  apiKeys: ApiKey[];
  preferences: UserPreferences;
  auditLogs: AuditLog[];
  notifications: Notification[];
  sessions: UserSession[];
}

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  country?: string;
  timezone?: string;
  language?: string;
  kycStatus?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  totalValue: number;
  currency: string;
  holdings: Holding[];
  performanceMetrics: PerformanceMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface Holding {
  id: string;
  portfolioId: string;
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  totalValue: number;
  percentageOfPortfolio: number;
  addedAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  portfolioId: string;
  type: 'buy' | 'sell' | 'transfer' | 'dividend' | 'fee';
  symbol: string;
  quantity: number;
  price: number;
  totalAmount: number;
  fee: number;
  currency: string;
  exchange?: string;
  notes?: string;
  executedAt: Date;
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string; // Only show prefix for security
  permissions: string[];
  lastUsed?: Date;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

export interface UserPreferences {
  userId: string;
  currency: string;
  language: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  dataSharing: boolean;
  theme: 'light' | 'dark' | 'auto';
  defaultPortfolio?: string;
  privacySettings: PrivacySettings;
  updatedAt: Date;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private';
  portfolioVisibility: 'public' | 'private';
  shareAnalytics: boolean;
  shareUsageData: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  country?: string;
  city?: string;
  isActive: boolean;
  loginAt: Date;
  logoutAt?: Date;
  expiresAt: Date;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercentage: number;
  dayChange: number;
  dayChangePercentage: number;
  weekChange: number;
  weekChangePercentage: number;
  monthChange: number;
  monthChangePercentage: number;
  yearChange: number;
  yearChangePercentage: number;
  bestPerformingAsset: string;
  worstPerformingAsset: string;
}

export class UserDataExportService {
  private dbPool: Pool;
  private encryptionUtils: EncryptionUtils;
  private exportDir: string;

  constructor(dbPool: Pool, encryptionUtils: EncryptionUtils) {
    this.dbPool = dbPool;
    this.encryptionUtils = encryptionUtils;
    this.exportDir = process.env.EXPORT_DIR || '/tmp/exports';
    this.ensureExportDirectory();
  }

  /**
   * Create a new data export request
   */
  async createExportRequest(
    userId: string,
    type: ExportType,
    format: ExportFormat,
    options: ExportOptions = {
      includeMetadata: true,
      includeSensitiveData: false
    }
  ): Promise<UserDataExportRequest> {
    const request: UserDataExportRequest = {
      id: this.generateRequestId(),
      userId,
      type,
      format,
      status: ExportStatus.REQUESTED,
      requestedAt: new Date(),
      expiresAt: this.calculateExpiryDate(),
      options
    };

    // Store request in database
    await this.storeExportRequest(request);

    // Start export process asynchronously
    this.processExportRequest(request).catch(error => {
      logger.error(`Export request ${request.id} failed`, { error: error.message });
      this.updateExportStatus(request.id, ExportStatus.FAILED, error.message);
    });

    logger.info(`Data export request created`, { 
      requestId: request.id, 
      userId, 
      type, 
      format 
    });

    return request;
  }

  /**
   * Process export request
   */
  private async processExportRequest(request: UserDataExportRequest): Promise<void> {
    try {
      await this.updateExportStatus(request.id, ExportStatus.PROCESSING);

      // Collect user data
      const userData = await this.collectUserData(request.userId, request.type, request.options);

      // Generate export file
      const filePath = await this.generateExportFile(userData, request);

      // Encrypt file if required
      const finalPath = await this.secureExportFile(filePath, request);

      // Calculate file size
      const stats = await fs.promises.stat(finalPath);
      
      // Generate download URL (signed URL for security)
      const downloadUrl = await this.generateDownloadUrl(finalPath, request);

      // Update request with completion details
      await this.updateExportCompletion(request.id, finalPath, stats.size, downloadUrl);

      // Notify user
      await this.notifyUserExportReady(request);

      logger.info(`Export request completed`, { 
        requestId: request.id, 
        fileSize: stats.size 
      });

    } catch (error) {
      await this.updateExportStatus(request.id, ExportStatus.FAILED, error.message);
      throw error;
    }
  }

  /**
   * Collect user data based on export type
   */
  private async collectUserData(
    userId: string,
    type: ExportType,
    options: ExportOptions
  ): Promise<UserData> {
    const userData: UserData = {
      profile: await this.getUserProfile(userId),
      portfolios: [],
      transactions: [],
      apiKeys: [],
      preferences: await this.getUserPreferences(userId),
      auditLogs: [],
      notifications: [],
      sessions: []
    };

    switch (type) {
      case ExportType.PERSONAL_DATA:
        userData.auditLogs = await this.getAuditLogs(userId, options);
        userData.sessions = await this.getUserSessions(userId, options);
        if (options.includeSensitiveData) {
          userData.apiKeys = await this.getApiKeys(userId);
        }
        break;

      case ExportType.PORTFOLIO_DATA:
        userData.portfolios = await this.getPortfolios(userId, options);
        break;

      case ExportType.TRANSACTION_HISTORY:
        userData.transactions = await this.getTransactions(userId, options);
        userData.portfolios = await this.getPortfolios(userId, options);
        break;

      case ExportType.FULL_EXPORT:
        userData.portfolios = await this.getPortfolios(userId, options);
        userData.transactions = await this.getTransactions(userId, options);
        userData.auditLogs = await this.getAuditLogs(userId, options);
        userData.notifications = await this.getNotifications(userId, options);
        userData.sessions = await this.getUserSessions(userId, options);
        if (options.includeSensitiveData) {
          userData.apiKeys = await this.getApiKeys(userId);
        }
        break;
    }

    return userData;
  }

  /**
   * Generate export file in requested format
   */
  private async generateExportFile(
    userData: UserData,
    request: UserDataExportRequest
  ): Promise<string> {
    const filename = `${request.userId}_${request.type}_${request.id}`;
    
    switch (request.format) {
      case ExportFormat.JSON:
        return await this.generateJsonExport(userData, filename);
      
      case ExportFormat.CSV:
        return await this.generateCsvExport(userData, filename);
      
      case ExportFormat.PDF:
        return await this.generatePdfExport(userData, filename);
      
      case ExportFormat.XML:
        return await this.generateXmlExport(userData, filename);
      
      default:
        throw new Error(`Unsupported export format: ${request.format}`);
    }
  }

  /**
   * Generate JSON export
   */
  private async generateJsonExport(userData: UserData, filename: string): Promise<string> {
    const filePath = path.join(this.exportDir, `${filename}.json`);
    
    const exportData = {
      exportMetadata: {
        generatedAt: new Date().toISOString(),
        format: 'JSON',
        version: '1.0.0',
        gdprCompliant: true
      },
      userData: this.sanitizeUserData(userData)
    };

    await fs.promises.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    logger.info(`JSON export generated: ${filePath}`);
    
    return filePath;
  }

  /**
   * Generate CSV export
   */
  private async generateCsvExport(userData: UserData, filename: string): Promise<string> {
    const zipPath = path.join(this.exportDir, `${filename}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = createWriteStream(zipPath);
    
    archive.pipe(output);

    // Generate CSV files for each data type
    if (userData.profile) {
      const profileCsv = this.generateProfileCsv(userData.profile);
      archive.append(profileCsv, { name: 'profile.csv' });
    }

    if (userData.portfolios.length > 0) {
      const portfoliosCsv = this.generatePortfoliosCsv(userData.portfolios);
      archive.append(portfoliosCsv, { name: 'portfolios.csv' });
      
      const holdingsCsv = this.generateHoldingsCsv(userData.portfolios);
      archive.append(holdingsCsv, { name: 'holdings.csv' });
    }

    if (userData.transactions.length > 0) {
      const transactionsCsv = this.generateTransactionsCsv(userData.transactions);
      archive.append(transactionsCsv, { name: 'transactions.csv' });
    }

    if (userData.auditLogs.length > 0) {
      const auditLogsCsv = this.generateAuditLogsCsv(userData.auditLogs);
      archive.append(auditLogsCsv, { name: 'audit_logs.csv' });
    }

    if (userData.notifications.length > 0) {
      const notificationsCsv = this.generateNotificationsCsv(userData.notifications);
      archive.append(notificationsCsv, { name: 'notifications.csv' });
    }

    await archive.finalize();
    
    return new Promise((resolve, reject) => {
      output.on('close', () => {
        logger.info(`CSV export generated: ${zipPath}`);
        resolve(zipPath);
      });
      archive.on('error', reject);
    });
  }

  /**
   * Generate PDF export
   */
  private async generatePdfExport(userData: UserData, filename: string): Promise<string> {
    const filePath = path.join(this.exportDir, `${filename}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    
    doc.pipe(createWriteStream(filePath));

    // Title page
    doc.fontSize(20).text('Personal Data Export', { align: 'center' });
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.text(`GDPR Compliant Data Export`, { align: 'center' });
    doc.addPage();

    // Profile section
    if (userData.profile) {
      doc.fontSize(16).text('Profile Information', { underline: true });
      doc.fontSize(12);
      doc.text(`Email: ${userData.profile.email}`);
      doc.text(`Name: ${userData.profile.firstName} ${userData.profile.lastName}`);
      doc.text(`Country: ${userData.profile.country}`);
      doc.text(`Member since: ${userData.profile.createdAt.toLocaleDateString()}`);
      doc.text(`Last login: ${userData.profile.lastLoginAt?.toLocaleDateString() || 'Never'}`);
      doc.moveDown();
    }

    // Portfolios section
    if (userData.portfolios.length > 0) {
      doc.fontSize(16).text('Portfolio Summary', { underline: true });
      doc.fontSize(12);
      
      userData.portfolios.forEach(portfolio => {
        doc.text(`Portfolio: ${portfolio.name}`);
        doc.text(`Total Value: ${portfolio.currency} ${portfolio.totalValue.toFixed(2)}`);
        doc.text(`Holdings: ${portfolio.holdings.length} assets`);
        doc.text(`Created: ${portfolio.createdAt.toLocaleDateString()}`);
        doc.moveDown();
      });
    }

    // Transaction summary
    if (userData.transactions.length > 0) {
      doc.fontSize(16).text('Transaction Summary', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Transactions: ${userData.transactions.length}`);
      
      const buyTransactions = userData.transactions.filter(t => t.type === 'buy').length;
      const sellTransactions = userData.transactions.filter(t => t.type === 'sell').length;
      
      doc.text(`Buy Orders: ${buyTransactions}`);
      doc.text(`Sell Orders: ${sellTransactions}`);
      doc.moveDown();
    }

    // Privacy notice
    doc.addPage();
    doc.fontSize(14).text('Privacy Notice', { underline: true });
    doc.fontSize(10);
    doc.text('This export contains your personal data as stored in our system. ');
    doc.text('Please keep this file secure and delete it when no longer needed. ');
    doc.text('For questions about your data, please contact our data protection officer.');

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        logger.info(`PDF export generated: ${filePath}`);
        resolve(filePath);
      });
      doc.on('error', reject);
    });
  }

  /**
   * Generate XML export
   */
  private async generateXmlExport(userData: UserData, filename: string): Promise<string> {
    const filePath = path.join(this.exportDir, `${filename}.xml`);
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<userDataExport>\n';
    xml += '  <metadata>\n';
    xml += `    <generatedAt>${new Date().toISOString()}</generatedAt>\n`;
    xml += '    <format>XML</format>\n';
    xml += '    <version>1.0.0</version>\n';
    xml += '    <gdprCompliant>true</gdprCompliant>\n';
    xml += '  </metadata>\n';
    
    // Profile data
    if (userData.profile) {
      xml += '  <profile>\n';
      xml += `    <email>${this.escapeXml(userData.profile.email)}</email>\n`;
      xml += `    <firstName>${this.escapeXml(userData.profile.firstName || '')}</firstName>\n`;
      xml += `    <lastName>${this.escapeXml(userData.profile.lastName || '')}</lastName>\n`;
      xml += `    <country>${this.escapeXml(userData.profile.country || '')}</country>\n`;
      xml += `    <createdAt>${userData.profile.createdAt.toISOString()}</createdAt>\n`;
      xml += '  </profile>\n';
    }

    // Portfolios data
    if (userData.portfolios.length > 0) {
      xml += '  <portfolios>\n';
      userData.portfolios.forEach(portfolio => {
        xml += '    <portfolio>\n';
        xml += `      <name>${this.escapeXml(portfolio.name)}</name>\n`;
        xml += `      <totalValue>${portfolio.totalValue}</totalValue>\n`;
        xml += `      <currency>${portfolio.currency}</currency>\n`;
        xml += `      <createdAt>${portfolio.createdAt.toISOString()}</createdAt>\n`;
        xml += '    </portfolio>\n';
      });
      xml += '  </portfolios>\n';
    }

    xml += '</userDataExport>';

    await fs.promises.writeFile(filePath, xml, 'utf8');
    logger.info(`XML export generated: ${filePath}`);
    
    return filePath;
  }

  /**
   * Secure export file with encryption
   */
  private async secureExportFile(
    filePath: string,
    request: UserDataExportRequest
  ): Promise<string> {
    const encryptedPath = `${filePath}.encrypted`;
    
    await this.encryptionUtils.encryptFile(filePath, encryptedPath, {
      algorithm: 'AES-256-GCM',
      keyId: `export_${request.userId}`,
      additionalData: Buffer.from(request.id)
    });

    // Delete original unencrypted file
    await fs.promises.unlink(filePath);
    
    return encryptedPath;
  }

  /**
   * Generate secure download URL
   */
  private async generateDownloadUrl(
    filePath: string,
    request: UserDataExportRequest
  ): Promise<string> {
    // Generate a signed token for secure download
    const token = this.generateSecureToken(request);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    return `${baseUrl}/api/v1/exports/${request.id}/download?token=${token}`;
  }

  /**
   * Get export request by ID
   */
  async getExportRequest(requestId: string): Promise<UserDataExportRequest | null> {
    const client = await this.dbPool.connect();
    
    try {
      const query = `
        SELECT * FROM user_export_requests 
        WHERE id = $1
      `;
      
      const result = await client.query(query, [requestId]);
      return result.rows[0] ? this.mapRowToExportRequest(result.rows[0]) : null;
      
    } finally {
      client.release();
    }
  }

  /**
   * List user export requests
   */
  async listUserExportRequests(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ requests: UserDataExportRequest[]; total: number }> {
    const client = await this.dbPool.connect();
    
    try {
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM user_export_requests WHERE user_id = $1`;
      const countResult = await client.query(countQuery, [userId]);
      const total = parseInt(countResult.rows[0].count);

      // Get requests with pagination
      const requestsQuery = `
        SELECT * FROM user_export_requests 
        WHERE user_id = $1
        ORDER BY requested_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const requestsResult = await client.query(requestsQuery, [userId, limit, offset]);
      const requests = requestsResult.rows.map(row => this.mapRowToExportRequest(row));

      return { requests, total };
      
    } finally {
      client.release();
    }
  }

  /**
   * Delete expired export files
   */
  async cleanupExpiredExports(): Promise<number> {
    const client = await this.dbPool.connect();
    let cleanedCount = 0;
    
    try {
      const query = `
        SELECT id, file_path FROM user_export_requests 
        WHERE expires_at < NOW() 
        AND status = 'completed'
      `;
      
      const result = await client.query(query);
      
      for (const row of result.rows) {
        try {
          // Securely delete file
          if (row.file_path && await this.fileExists(row.file_path)) {
            await this.encryptionUtils.secureDelete(row.file_path);
          }
          
          // Update status to expired
          await client.query(
            'UPDATE user_export_requests SET status = $1 WHERE id = $2',
            [ExportStatus.EXPIRED, row.id]
          );
          
          cleanedCount++;
        } catch (error) {
          logger.error(`Failed to cleanup export ${row.id}`, { error: error.message });
        }
      }

      logger.info(`Cleaned up ${cleanedCount} expired exports`);
      
    } finally {
      client.release();
    }

    return cleanedCount;
  }

  // Private helper methods

  private generateRequestId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateExpiryDate(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7); // 7 days from now
    return expiry;
  }

  private generateSecureToken(request: UserDataExportRequest): string {
    const payload = {
      requestId: request.id,
      userId: request.userId,
      expiresAt: request.expiresAt.getTime()
    };
    
    // In production, use proper JWT signing
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private async ensureExportDirectory(): Promise<void> {
    await fs.promises.mkdir(this.exportDir, { recursive: true });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private sanitizeUserData(userData: UserData): UserData {
    // Remove sensitive fields that shouldn't be exported
    const sanitized = { ...userData };
    
    // Sanitize API keys - only show prefix
    if (sanitized.apiKeys) {
      sanitized.apiKeys = sanitized.apiKeys.map(key => ({
        ...key,
        // Remove actual key value, keep only metadata
      }));
    }

    // Remove IP addresses from audit logs for privacy
    if (sanitized.auditLogs) {
      sanitized.auditLogs = sanitized.auditLogs.map(log => ({
        ...log,
        ipAddress: this.anonymizeIpAddress(log.ipAddress)
      }));
    }

    return sanitized;
  }

  private anonymizeIpAddress(ip: string): string {
    // Replace last octet with 'xxx' for IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }
    // For IPv6 or other formats, return a masked version
    return 'xxx.xxx.xxx.xxx';
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // CSV generation helpers
  private generateProfileCsv(profile: UserProfile): string {
    const headers = ['Field', 'Value'];
    const rows = [
      ['Email', profile.email],
      ['First Name', profile.firstName || ''],
      ['Last Name', profile.lastName || ''],
      ['Country', profile.country || ''],
      ['Created At', profile.createdAt.toISOString()],
      ['Last Login', profile.lastLoginAt?.toISOString() || '']
    ];

    return this.arrayToCsv([headers, ...rows]);
  }

  private generatePortfoliosCsv(portfolios: Portfolio[]): string {
    const headers = ['Name', 'Description', 'Total Value', 'Currency', 'Holdings Count', 'Created At'];
    const rows = portfolios.map(p => [
      p.name,
      p.description || '',
      p.totalValue.toString(),
      p.currency,
      p.holdings.length.toString(),
      p.createdAt.toISOString()
    ]);

    return this.arrayToCsv([headers, ...rows]);
  }

  private generateHoldingsCsv(portfolios: Portfolio[]): string {
    const headers = ['Portfolio', 'Symbol', 'Name', 'Quantity', 'Average Cost', 'Current Price', 'Total Value'];
    const rows: string[][] = [];

    portfolios.forEach(portfolio => {
      portfolio.holdings.forEach(holding => {
        rows.push([
          portfolio.name,
          holding.symbol,
          holding.name,
          holding.quantity.toString(),
          holding.averageCost.toString(),
          holding.currentPrice.toString(),
          holding.totalValue.toString()
        ]);
      });
    });

    return this.arrayToCsv([headers, ...rows]);
  }

  private generateTransactionsCsv(transactions: Transaction[]): string {
    const headers = ['Type', 'Symbol', 'Quantity', 'Price', 'Total Amount', 'Fee', 'Currency', 'Executed At'];
    const rows = transactions.map(t => [
      t.type,
      t.symbol,
      t.quantity.toString(),
      t.price.toString(),
      t.totalAmount.toString(),
      t.fee.toString(),
      t.currency,
      t.executedAt.toISOString()
    ]);

    return this.arrayToCsv([headers, ...rows]);
  }

  private generateAuditLogsCsv(logs: AuditLog[]): string {
    const headers = ['Action', 'Resource', 'IP Address', 'Timestamp'];
    const rows = logs.map(log => [
      log.action,
      log.resource,
      this.anonymizeIpAddress(log.ipAddress),
      log.timestamp.toISOString()
    ]);

    return this.arrayToCsv([headers, ...rows]);
  }

  private generateNotificationsCsv(notifications: Notification[]): string {
    const headers = ['Type', 'Title', 'Message', 'Is Read', 'Created At'];
    const rows = notifications.map(n => [
      n.type,
      n.title,
      n.message,
      n.isRead.toString(),
      n.createdAt.toISOString()
    ]);

    return this.arrayToCsv([headers, ...rows]);
  }

  private arrayToCsv(data: string[][]): string {
    return data.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`)
         .join(',')
    ).join('\n');
  }

  // Database query methods (to be implemented based on your schema)
  private async getUserProfile(userId: string): Promise<UserProfile> {
    const client = await this.dbPool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      return this.mapRowToUserProfile(result.rows[0]);
    } finally {
      client.release();
    }
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    const client = await this.dbPool.connect();
    try {
      const result = await client.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
      return this.mapRowToUserPreferences(result.rows[0]);
    } finally {
      client.release();
    }
  }

  private async getPortfolios(userId: string, options: ExportOptions): Promise<Portfolio[]> {
    const client = await this.dbPool.connect();
    try {
      let query = 'SELECT * FROM portfolios WHERE user_id = $1';
      const params = [userId];

      if (options.dateRange) {
        query += ' AND created_at BETWEEN $2 AND $3';
        params.push(options.dateRange.from, options.dateRange.to);
      }

      const result = await client.query(query, params);
      const portfolios = result.rows.map(row => this.mapRowToPortfolio(row));

      // Get holdings for each portfolio
      for (const portfolio of portfolios) {
        portfolio.holdings = await this.getPortfolioHoldings(portfolio.id);
        portfolio.performanceMetrics = await this.getPortfolioPerformance(portfolio.id);
      }

      return portfolios;
    } finally {
      client.release();
    }
  }

  private async getTransactions(userId: string, options: ExportOptions): Promise<Transaction[]> {
    const client = await this.dbPool.connect();
    try {
      let query = 'SELECT * FROM transactions WHERE user_id = $1';
      const params = [userId];

      if (options.dateRange) {
        query += ' AND executed_at BETWEEN $2 AND $3';
        params.push(options.dateRange.from, options.dateRange.to);
      }

      query += ' ORDER BY executed_at DESC';

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToTransaction(row));
    } finally {
      client.release();
    }
  }

  private async getApiKeys(userId: string): Promise<ApiKey[]> {
    const client = await this.dbPool.connect();
    try {
      const result = await client.query('SELECT * FROM api_keys WHERE user_id = $1', [userId]);
      return result.rows.map(row => this.mapRowToApiKey(row));
    } finally {
      client.release();
    }
  }

  private async getAuditLogs(userId: string, options: ExportOptions): Promise<AuditLog[]> {
    const client = await this.dbPool.connect();
    try {
      let query = 'SELECT * FROM audit_logs WHERE user_id = $1';
      const params = [userId];

      if (options.dateRange) {
        query += ' AND timestamp BETWEEN $2 AND $3';
        params.push(options.dateRange.from, options.dateRange.to);
      }

      query += ' ORDER BY timestamp DESC LIMIT 1000'; // Limit for performance

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToAuditLog(row));
    } finally {
      client.release();
    }
  }

  private async getNotifications(userId: string, options: ExportOptions): Promise<Notification[]> {
    const client = await this.dbPool.connect();
    try {
      let query = 'SELECT * FROM notifications WHERE user_id = $1';
      const params = [userId];

      if (options.dateRange) {
        query += ' AND created_at BETWEEN $2 AND $3';
        params.push(options.dateRange.from, options.dateRange.to);
      }

      query += ' ORDER BY created_at DESC';

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToNotification(row));
    } finally {
      client.release();
    }
  }

  private async getUserSessions(userId: string, options: ExportOptions): Promise<UserSession[]> {
    const client = await this.dbPool.connect();
    try {
      let query = 'SELECT * FROM user_sessions WHERE user_id = $1';
      const params = [userId];

      if (options.dateRange) {
        query += ' AND login_at BETWEEN $2 AND $3';
        params.push(options.dateRange.from, options.dateRange.to);
      }

      query += ' ORDER BY login_at DESC';

      const result = await client.query(query, params);
      return result.rows.map(row => this.mapRowToUserSession(row));
    } finally {
      client.release();
    }
  }

  private async getPortfolioHoldings(portfolioId: string): Promise<Holding[]> {
    const client = await this.dbPool.connect();
    try {
      const result = await client.query('SELECT * FROM holdings WHERE portfolio_id = $1', [portfolioId]);
      return result.rows.map(row => this.mapRowToHolding(row));
    } finally {
      client.release();
    }
  }

  private async getPortfolioPerformance(portfolioId: string): Promise<PerformanceMetrics> {
    // Implementation would calculate performance metrics
    return {
      totalReturn: 0,
      totalReturnPercentage: 0,
      dayChange: 0,
      dayChangePercentage: 0,
      weekChange: 0,
      weekChangePercentage: 0,
      monthChange: 0,
      monthChangePercentage: 0,
      yearChange: 0,
      yearChangePercentage: 0,
      bestPerformingAsset: '',
      worstPerformingAsset: ''
    };
  }

  // Database operations
  private async storeExportRequest(request: UserDataExportRequest): Promise<void> {
    const client = await this.dbPool.connect();
    try {
      const query = `
        INSERT INTO user_export_requests (
          id, user_id, type, format, status, requested_at, expires_at, options
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await client.query(query, [
        request.id,
        request.userId,
        request.type,
        request.format,
        request.status,
        request.requestedAt,
        request.expiresAt,
        JSON.stringify(request.options)
      ]);
    } finally {
      client.release();
    }
  }

  private async updateExportStatus(
    requestId: string,
    status: ExportStatus,
    error?: string
  ): Promise<void> {
    const client = await this.dbPool.connect();
    try {
      const query = `
        UPDATE user_export_requests 
        SET status = $1, error = $2, completed_at = $3
        WHERE id = $4
      `;
      
      const completedAt = status === ExportStatus.COMPLETED ? new Date() : null;
      await client.query(query, [status, error, completedAt, requestId]);
    } finally {
      client.release();
    }
  }

  private async updateExportCompletion(
    requestId: string,
    filePath: string,
    fileSize: number,
    downloadUrl: string
  ): Promise<void> {
    const client = await this.dbPool.connect();
    try {
      const query = `
        UPDATE user_export_requests 
        SET status = $1, file_path = $2, file_size = $3, download_url = $4, completed_at = $5
        WHERE id = $6
      `;
      
      await client.query(query, [
        ExportStatus.COMPLETED,
        filePath,
        fileSize,
        downloadUrl,
        new Date(),
        requestId
      ]);
    } finally {
      client.release();
    }
  }

  private async notifyUserExportReady(request: UserDataExportRequest): Promise<void> {
    try {
      const user = await this.getUserProfile(request.userId);
      
      await emailService.sendEmail({
        to: user.email,
        subject: 'Your Data Export is Ready',
        template: 'data-export-ready',
        data: {
          userName: user.firstName || 'User',
          exportType: request.type,
          downloadUrl: request.downloadUrl,
          expiresAt: request.expiresAt.toLocaleDateString()
        }
      });
    } catch (error) {
      logger.error(`Failed to notify user about export completion`, { 
        requestId: request.id, 
        error: error.message 
      });
    }
  }

  // Mapping methods (implement based on your database schema)
  private mapRowToExportRequest(row: any): UserDataExportRequest {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      format: row.format,
      status: row.status,
      requestedAt: row.requested_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
      downloadUrl: row.download_url,
      fileSize: row.file_size,
      error: row.error,
      options: JSON.parse(row.options || '{}')
    };
  }

  private mapRowToUserProfile(row: any): UserProfile {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phoneNumber: row.phone_number,
      dateOfBirth: row.date_of_birth,
      country: row.country,
      timezone: row.timezone,
      language: row.language,
      kycStatus: row.kyc_status,
      emailVerified: row.email_verified,
      phoneVerified: row.phone_verified,
      twoFactorEnabled: row.two_factor_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at
    };
  }

  private mapRowToUserPreferences(row: any): UserPreferences {
    return {
      userId: row.user_id,
      currency: row.currency,
      language: row.language,
      timezone: row.timezone,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      marketingEmails: row.marketing_emails,
      dataSharing: row.data_sharing,
      theme: row.theme,
      defaultPortfolio: row.default_portfolio,
      privacySettings: JSON.parse(row.privacy_settings || '{}'),
      updatedAt: row.updated_at
    };
  }

  private mapRowToPortfolio(row: any): Portfolio {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isDefault: row.is_default,
      totalValue: parseFloat(row.total_value),
      currency: row.currency,
      holdings: [], // Will be populated separately
      performanceMetrics: {} as PerformanceMetrics, // Will be populated separately
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToHolding(row: any): Holding {
    return {
      id: row.id,
      portfolioId: row.portfolio_id,
      symbol: row.symbol,
      name: row.name,
      quantity: parseFloat(row.quantity),
      averageCost: parseFloat(row.average_cost),
      currentPrice: parseFloat(row.current_price),
      totalValue: parseFloat(row.total_value),
      percentageOfPortfolio: parseFloat(row.percentage_of_portfolio),
      addedAt: row.added_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToTransaction(row: any): Transaction {
    return {
      id: row.id,
      userId: row.user_id,
      portfolioId: row.portfolio_id,
      type: row.type,
      symbol: row.symbol,
      quantity: parseFloat(row.quantity),
      price: parseFloat(row.price),
      totalAmount: parseFloat(row.total_amount),
      fee: parseFloat(row.fee),
      currency: row.currency,
      exchange: row.exchange,
      notes: row.notes,
      executedAt: row.executed_at,
      createdAt: row.created_at
    };
  }

  private mapRowToApiKey(row: any): ApiKey {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      permissions: JSON.parse(row.permissions || '[]'),
      lastUsed: row.last_used,
      isActive: row.is_active,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    };
  }

  private mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      resource: row.resource,
      resourceId: row.resource_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: JSON.parse(row.metadata || '{}'),
      timestamp: row.timestamp
    };
  }

  private mapRowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      isRead: row.is_read,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      readAt: row.read_at
    };
  }

  private mapRowToUserSession(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      country: row.country,
      city: row.city,
      isActive: row.is_active,
      loginAt: row.login_at,
      logoutAt: row.logout_at,
      expiresAt: row.expires_at
    };
  }
}

export default UserDataExportService;