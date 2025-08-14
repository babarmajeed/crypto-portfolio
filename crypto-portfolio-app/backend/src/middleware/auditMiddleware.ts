import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from './authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogEntry, SecurityEvent } from '@/types/monitoring.types';
import { loggingService } from '@/services/loggingService';
import { analyticsService } from '@/services/analyticsService';
import { complianceSettings } from '@/config/monitoring.config';

const prisma = new PrismaClient();

interface AuditableRequest extends AuthenticatedRequest {
  auditInfo?: {
    action: string;
    resource?: string;
    resourceId?: string;
    oldValues?: Record<string, any>;
    skipAudit?: boolean;
  };
}

export class AuditMiddleware {
  // Set audit information for the request
  static setAuditInfo(action: string, resource?: string, resourceId?: string) {
    return (req: AuditableRequest, res: Response, next: NextFunction) => {
      req.auditInfo = {
        action,
        resource,
        resourceId,
        skipAudit: false
      };
      next();
    };
  }

  // Skip audit logging for this request
  static skipAudit(req: AuditableRequest, res: Response, next: NextFunction) {
    if (!req.auditInfo) {
      req.auditInfo = {
        action: 'UNKNOWN',
        skipAudit: true
      };
    } else {
      req.auditInfo.skipAudit = true;
    }
    next();
  }

  // Capture old values before modification (for PUT/PATCH requests)
  static captureOldValues(resourceType: string, idParam: string = 'id') {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      if (!req.user || !req.params[idParam]) {
        next();
        return;
      }

      try {
        let oldValues: Record<string, any> | null = null;
        const resourceId = req.params[idParam];

        switch (resourceType.toLowerCase()) {
          case 'profile':
            oldValues = await prisma.userProfile.findUnique({
              where: { userId: req.user.userId }
            });
            break;
          case 'preferences':
            oldValues = await prisma.userPreferences.findUnique({
              where: { userId: req.user.userId }
            });
            break;
          case 'user':
            oldValues = await prisma.user.findUnique({
              where: { id: req.user.userId },
              select: {
                email: true,
                firstName: true,
                lastName: true,
                isTwoFactorEnabled: true,
                isActive: true
              }
            });
            break;
          case 'portfolio':
            oldValues = await prisma.portfolio.findUnique({
              where: { id: resourceId }
            });
            break;
          case 'transaction':
            oldValues = await prisma.transaction.findUnique({
              where: { id: resourceId }
            });
            break;
        }

        if (req.auditInfo && oldValues) {
          req.auditInfo.oldValues = oldValues;
          req.auditInfo.resourceId = req.auditInfo.resourceId || resourceId;
        }
      } catch (error) {
        console.error('Error capturing old values for audit:', error);
      }

      next();
    };
  }

  // Main audit logging middleware (should be used after the actual operation)
  static logActivity = async (req: AuditableRequest, res: Response, next: NextFunction) => {
    // Skip if audit is disabled or user is not authenticated
    if (!req.user || !req.auditInfo || req.auditInfo.skipAudit) {
      next();
      return;
    }

    try {
      const { action, resource, resourceId, oldValues } = req.auditInfo;
      
      // Determine new values from request body for modification operations
      let newValues: Record<string, any> | null = null;
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        newValues = { ...req.body };
        // Remove sensitive fields
        delete newValues.password;
        delete newValues.currentPassword;
        delete newValues.newPassword;
        delete newValues.confirmPassword;
      }

      // Get client information
      const ipAddress = this.getClientIP(req);
      const userAgent = req.headers['user-agent'];

      // Log the audit entry
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action,
          resource: resource || this.extractResourceFromPath(req.originalUrl),
          resourceId: resourceId || req.params.id,
          oldValues: oldValues || null,
          newValues: newValues,
          ipAddress,
          userAgent
        }
      });

    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't fail the request if audit logging fails
    }

    next();
  };

  // Automatic audit middleware that infers action from HTTP method and path
  static autoAudit = (req: AuditableRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      next();
      return;
    }

    const action = this.inferActionFromRequest(req);
    const resource = this.extractResourceFromPath(req.originalUrl);
    
    req.auditInfo = {
      action,
      resource,
      resourceId: req.params.id,
      skipAudit: false
    };

    next();
  };

  // Sensitive operations middleware - always audit these actions
  static auditSensitiveOperation(action: string) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        next();
        return;
      }

      try {
        const ipAddress = this.getClientIP(req);
        const userAgent = req.headers['user-agent'];

        await prisma.auditLog.create({
          data: {
            userId: req.user.userId,
            action,
            resource: this.extractResourceFromPath(req.originalUrl),
            resourceId: req.params.id || null,
            newValues: req.body ? { ...req.body, password: undefined } : null,
            ipAddress,
            userAgent
          }
        });
      } catch (error) {
        console.error('Sensitive operation audit error:', error);
      }

      next();
    };
  }

  // Security event logging
  static logSecurityEvent(event: string, details?: Record<string, any>) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      try {
        const ipAddress = this.getClientIP(req);
        const userAgent = req.headers['user-agent'];

        await prisma.auditLog.create({
          data: {
            userId: req.user?.userId || '',
            action: `SECURITY_${event}`,
            resource: 'Security',
            newValues: details || null,
            ipAddress,
            userAgent
          }
        });
      } catch (error) {
        console.error('Security event logging error:', error);
      }

      next();
    };
  }

  // Enhanced compliance audit logging
  static complianceAudit(
    regulation: string,
    requirement: string,
    dataClassification: 'public' | 'internal' | 'confidential' | 'restricted'
  ) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      if (!req.user || (req.auditInfo && req.auditInfo.skipAudit)) {
        next();
        return;
      }

      try {
        const auditEntry: AuditLogEntry = {
          id: uuidv4(),
          timestamp: new Date(),
          userId: req.user.userId,
          sessionId: req.sessionID,
          ipAddress: this.getClientIP(req),
          userAgent: req.headers['user-agent'],
          action: req.auditInfo?.action || this.inferActionFromRequest(req),
          resource: req.auditInfo?.resource || this.extractResourceFromPath(req.originalUrl),
          resourceId: req.auditInfo?.resourceId || req.params.id,
          oldValues: req.auditInfo?.oldValues,
          newValues: ['POST', 'PUT', 'PATCH'].includes(req.method) ? this.sanitizeForCompliance(req.body) : undefined,
          result: res.statusCode >= 400 ? 'failure' : 'success',
          severity: this.determineAuditSeverity(req, dataClassification),
          compliance: {
            regulation,
            requirement,
            dataClassification
          },
          metadata: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: req.startTime ? Date.now() - req.startTime : undefined
          }
        };

        // Store in database
        await this.storeComplianceAuditEntry(auditEntry);

        // Log to monitoring system
        loggingService.logInfo('Compliance audit entry created', {
          userId: auditEntry.userId,
          metadata: {
            regulation,
            requirement,
            dataClassification,
            action: auditEntry.action,
            resource: auditEntry.resource
          },
          tags: ['compliance', 'audit', regulation.toLowerCase(), dataClassification]
        });

        // Track as analytics event
        await analyticsService.trackEvent(
          'security',
          'compliance',
          'audit_logged',
          regulation,
          undefined,
          req.user.userId,
          req.sessionID,
          {
            regulation,
            requirement,
            dataClassification,
            action: auditEntry.action,
            resource: auditEntry.resource
          }
        );

      } catch (error) {
        loggingService.logError('Compliance audit logging failed', error as Error, {
          userId: req.user?.userId,
          metadata: { regulation, requirement, dataClassification }
        });
      }

      next();
    };
  }

  // Financial data access audit (PCI-DSS, SOX compliance)
  static financialDataAudit() {
    return this.complianceAudit('PCI-DSS', 'Data Access Logging', 'confidential');
  }

  // Personal data access audit (GDPR compliance)
  static personalDataAudit() {
    return this.complianceAudit('GDPR', 'Personal Data Processing', 'restricted');
  }

  // Data retention compliance
  static dataRetentionAudit(retentionPeriod: string) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      if (req.method === 'DELETE' && req.user) {
        try {
          await this.logDataRetention(req.user.userId, {
            action: 'DATA_DELETION',
            resource: req.auditInfo?.resource || this.extractResourceFromPath(req.originalUrl),
            resourceId: req.params.id,
            retentionPeriod,
            reason: req.body?.reason || 'User requested deletion',
            ipAddress: this.getClientIP(req),
            userAgent: req.headers['user-agent']
          });
        } catch (error) {
          loggingService.logError('Data retention audit failed', error as Error);
        }
      }
      next();
    };
  }

  // Enhanced security event logging
  static enhancedSecurityEvent(
    eventType: SecurityEvent['type'],
    severity: SecurityEvent['severity'],
    riskScore?: number
  ) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      try {
        const securityEvent: SecurityEvent = {
          id: uuidv4(),
          timestamp: new Date(),
          type: eventType,
          severity,
          userId: req.user?.userId,
          ipAddress: this.getClientIP(req),
          userAgent: req.headers['user-agent'],
          location: await this.getLocationFromIP(this.getClientIP(req)),
          details: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            ...req.body
          },
          riskScore: riskScore || this.calculateRiskScore(req, eventType),
          blocked: res.statusCode === 403 || res.statusCode === 429,
          source: 'audit-middleware'
        };

        // Store security event
        await this.storeSecurityEvent(securityEvent);

        // Alert if high risk
        if (securityEvent.riskScore > 70) {
          loggingService.logError(`High-risk security event: ${eventType}`, undefined, {
            userId: securityEvent.userId,
            metadata: securityEvent,
            tags: ['security', 'high-risk', eventType]
          });
        }

      } catch (error) {
        loggingService.logError('Enhanced security event logging failed', error as Error);
      }

      next();
    };
  }

  // Private helper methods for enhanced functionality
  private static async storeComplianceAuditEntry(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          id: entry.id,
          userId: entry.userId || '',
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          oldValues: entry.oldValues,
          newValues: entry.newValues,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          result: entry.result,
          reason: entry.reason,
          metadata: entry.metadata,
          severity: entry.severity,
          createdAt: entry.timestamp
        }
      });

      // Store compliance-specific data if enabled
      if (complianceSettings.gdpr.enabled || complianceSettings.pciDss.enabled) {
        // Additional compliance storage logic would go here
      }
    } catch (error) {
      throw new Error(`Failed to store compliance audit entry: ${error}`);
    }
  }

  private static async storeSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Store in audit log with security classification
      await prisma.auditLog.create({
        data: {
          id: event.id,
          userId: event.userId || '',
          action: `SECURITY_${event.type.toUpperCase()}`,
          resource: 'Security Event',
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: {
            ...event.details,
            severity: event.severity,
            riskScore: event.riskScore,
            blocked: event.blocked,
            location: event.location
          },
          severity: event.severity,
          createdAt: event.timestamp
        }
      });
    } catch (error) {
      throw new Error(`Failed to store security event: ${error}`);
    }
  }

  private static async logDataRetention(userId: string, data: any): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        metadata: {
          retentionPeriod: data.retentionPeriod,
          reason: data.reason,
          compliance: 'Data Retention Policy'
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        severity: 'high'
      }
    });
  }

  private static sanitizeForCompliance(data: any): any {
    if (!data) return null;
    
    const sanitized = { ...data };
    
    // Remove sensitive fields that shouldn't be audited
    const sensitiveFields = [
      'password', 'currentPassword', 'newPassword', 'confirmPassword',
      'token', 'apiKey', 'privateKey', 'secret', 'ssn', 'creditCard'
    ];
    
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private static determineAuditSeverity(
    req: Request,
    dataClassification: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    // High-risk operations
    if (req.method === 'DELETE' || req.originalUrl.includes('delete')) {
      return 'high';
    }
    
    // Restricted data access
    if (dataClassification === 'restricted' || dataClassification === 'confidential') {
      return 'high';
    }
    
    // Administrative operations
    if (req.originalUrl.includes('admin') || req.originalUrl.includes('settings')) {
      return 'medium';
    }
    
    // Default
    return 'low';
  }

  private static calculateRiskScore(req: Request, eventType: string): number {
    let score = 0;
    
    // Base score by event type
    switch (eventType) {
      case 'login_failure': score += 20; break;
      case 'brute_force': score += 80; break;
      case 'suspicious_activity': score += 60; break;
      case 'data_access': score += 30; break;
      default: score += 10;
    }
    
    // Increase for failed requests
    if (req.statusCode && req.statusCode >= 400) {
      score += 20;
    }
    
    // Increase for admin endpoints
    if (req.originalUrl.includes('admin')) {
      score += 30;
    }
    
    return Math.min(score, 100);
  }

  private static async getLocationFromIP(ipAddress: string): Promise<SecurityEvent['location']> {
    // Simplified location detection - in production, use a proper GeoIP service
    return {
      country: 'Unknown',
      city: 'Unknown',
      coordinates: undefined
    };
  }

  // Utility methods
  private static getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  private static extractResourceFromPath(path: string): string {
    const pathParts = path.split('/').filter(part => part && !part.match(/^\d+$/));
    return pathParts[pathParts.length - 1] || 'unknown';
  }

  private static inferActionFromRequest(req: Request): string {
    const method = req.method.toUpperCase();
    const path = req.originalUrl.toLowerCase();

    // Specific actions based on path patterns
    if (path.includes('/login')) return 'LOGIN';
    if (path.includes('/logout')) return 'LOGOUT';
    if (path.includes('/register')) return 'REGISTER';
    if (path.includes('/verify')) return 'EMAIL_VERIFY';
    if (path.includes('/reset-password')) return 'PASSWORD_RESET';
    if (path.includes('/2fa')) return '2FA_SETUP';
    if (path.includes('/avatar')) return 'AVATAR_UPDATE';
    if (path.includes('/export')) return 'DATA_EXPORT';
    if (path.includes('/delete-account')) return 'ACCOUNT_DELETE';

    // Generic CRUD actions
    switch (method) {
      case 'GET': return 'READ';
      case 'POST': return 'CREATE';
      case 'PUT': 
      case 'PATCH': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return 'UNKNOWN';
    }
  }
}

// Convenience methods for common audit scenarios
export const auditMiddleware = {
  // Profile operations
  profileUpdate: AuditMiddleware.setAuditInfo('PROFILE_UPDATE', 'UserProfile'),
  avatarUpdate: AuditMiddleware.setAuditInfo('AVATAR_UPDATE', 'UserProfile'),
  
  // Preferences operations
  preferencesUpdate: AuditMiddleware.setAuditInfo('PREFERENCES_UPDATE', 'UserPreferences'),
  
  // Security operations
  passwordChange: AuditMiddleware.auditSensitiveOperation('PASSWORD_CHANGE'),
  emailChange: AuditMiddleware.auditSensitiveOperation('EMAIL_CHANGE'),
  twoFactorEnable: AuditMiddleware.auditSensitiveOperation('2FA_ENABLE'),
  twoFactorDisable: AuditMiddleware.auditSensitiveOperation('2FA_DISABLE'),
  
  // Device operations
  deviceTrust: AuditMiddleware.setAuditInfo('DEVICE_TRUST', 'TrustedDevice'),
  deviceRemove: AuditMiddleware.setAuditInfo('DEVICE_REMOVE', 'TrustedDevice'),
  
  // Account operations
  accountDelete: AuditMiddleware.auditSensitiveOperation('ACCOUNT_DELETE'),
  dataExport: AuditMiddleware.auditSensitiveOperation('DATA_EXPORT'),
  
  // Compliance operations
  gdprCompliance: AuditMiddleware.personalDataAudit(),
  pciCompliance: AuditMiddleware.financialDataAudit(),
  dataRetention: (period: string) => AuditMiddleware.dataRetentionAudit(period),
  
  // Enhanced security events
  loginFailure: AuditMiddleware.enhancedSecurityEvent('login_failure', 'medium'),
  suspiciousActivity: AuditMiddleware.enhancedSecurityEvent('suspicious_activity', 'high'),
  bruteForce: AuditMiddleware.enhancedSecurityEvent('brute_force', 'critical'),
  dataAccess: AuditMiddleware.enhancedSecurityEvent('data_access', 'medium'),
  
  // General middleware
  auto: AuditMiddleware.autoAudit,
  log: AuditMiddleware.logActivity,
  capture: AuditMiddleware.captureOldValues,
  skip: AuditMiddleware.skipAudit,
  security: AuditMiddleware.logSecurityEvent,
  compliance: AuditMiddleware.complianceAudit
};

export { AuditMiddleware };